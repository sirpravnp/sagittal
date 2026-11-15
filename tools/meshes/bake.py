#!/usr/bin/env python3
"""Bake open anatomical meshes into sagittal's compact classic-script format.

  .venv/bin/python tools/meshes/bake.py tools/meshes/configs/thorax.json
  .venv/bin/python tools/meshes/bake.py tools/meshes/configs/*.json --assets /path/to/sagittal-assets-cache

Reads OBJ / PLY / STL / legacy-VTK sources named in a JSON config, maps them into sagittal's frame
(+x patient's left, +y superior, +z anterior, centimetres), decimates each part to its triangle
budget and writes site/meshes/<name>.js:

  (window.SagittalMeshes = window.SagittalMeshes || {})["<name>"] = {
    parts: { <part>: { p: <b64 Float32 xyz>, i: <b64 Uint16|Uint32>, it: "u16"|"u32", n?: <b64 Float32>,
                       bbox: [minx,miny,minz,maxx,maxy,maxz] } },
    unit: "cm", credit: "<id in site/meshes/CREDITS.md>", frame: "...", offset: [x,y,z], version: 1 };

See docs/meshes.md for the config format.
"""
import argparse
import base64
import fnmatch
import json
import os
import re
import struct
import sys

import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_ASSETS = os.environ.get("SAGITTAL_ASSETS") or os.path.join(os.path.dirname(REPO), "sagittal-assets-cache")
# A worktree may live one level deeper than the main checkout; fall back to the Desktop-level cache.
if not os.path.isdir(DEFAULT_ASSETS):
    DEFAULT_ASSETS = os.path.join(os.path.dirname(os.path.dirname(REPO)), "sagittal-assets-cache")
MAX_BYTES = 400 * 1024
FRAME = "+x patient left, +y superior, +z anterior; cm"
ALLOWED_LICENSES = {"CC0", "CC BY", "CC BY-SA", "CC BY 4.0", "CC BY-SA 4.0", "CC BY-SA 2.1 JP", "PD", "MIT"}

# ---------------------------------------------------------------- readers


def read_obj(path):
    vs, faces = [], []
    with open(path, "r", errors="replace") as f:
        for line in f:
            if line.startswith("v "):
                vs.append(line.split()[1:4])
            elif line.startswith("f "):
                idx = [int(t.split("/")[0]) for t in line.split()[1:]]
                n = len(vs)
                idx = [i - 1 if i > 0 else n + i for i in idx]
                for k in range(1, len(idx) - 1):
                    faces.append((idx[0], idx[k], idx[k + 1]))
    return np.array(vs, np.float64).reshape(-1, 3), np.array(faces, np.int64).reshape(-1, 3)


def read_stl(path):
    with open(path, "rb") as f:
        data = f.read()
    if len(data) >= 84:
        n = struct.unpack_from("<I", data, 80)[0]
        if 84 + n * 50 == len(data):
            rec = np.frombuffer(data, dtype=np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")]), count=n, offset=84)
            v = rec["v"].reshape(-1, 3).astype(np.float64)
            return v, np.arange(len(v)).reshape(-1, 3)
    pts = re.findall(rb"vertex\s+(\S+)\s+(\S+)\s+(\S+)", data)
    v = np.array(pts, dtype=np.float64).reshape(-1, 3)
    return v, np.arange(len(v)).reshape(-1, 3)


def read_ply(path):
    with open(path, "rb") as f:
        data = f.read()
    end = data.index(b"end_header") + len(b"end_header")
    while data[end:end + 1] in (b"\r", b"\n"):
        end += 1
        if data[end - 1:end] == b"\n":
            break
    header = data[:end].decode("latin-1").splitlines()
    fmt = next(l.split()[1] for l in header if l.startswith("format"))
    elements, cur = [], None
    for l in header:
        t = l.split()
        if t[:1] == ["element"]:
            cur = {"name": t[1], "count": int(t[2]), "props": []}
            elements.append(cur)
        elif t[:1] == ["property"] and cur is not None:
            cur["props"].append(t[1:])
    tmap = {"char": "b", "uchar": "B", "short": "h", "ushort": "H", "int": "i", "uint": "I", "float": "f", "double": "d",
            "int8": "b", "uint8": "B", "int16": "h", "uint16": "H", "int32": "i", "uint32": "I", "float32": "f", "float64": "d"}
    verts, faces = None, []
    if fmt == "ascii":
        toks = data[end:].split()
        k = 0
        for el in elements:
            rows = []
            for _ in range(el["count"]):
                row = []
                for p in el["props"]:
                    if p[0] == "list":
                        n = int(toks[k]); k += 1
                        row.append([int(x) for x in toks[k:k + n]]); k += n
                    else:
                        row.append(float(toks[k])); k += 1
                rows.append(row)
            if el["name"] == "vertex":
                names = [p[-1] for p in el["props"]]
                ix = [names.index(c) for c in "xyz"]
                verts = np.array([[r[i] for i in ix] for r in rows], np.float64)
            elif el["name"] == "face":
                for r in rows:
                    poly = r[0]
                    faces += [(poly[0], poly[j], poly[j + 1]) for j in range(1, len(poly) - 1)]
    else:
        end_c = "<" if fmt == "binary_little_endian" else ">"
        o = end
        for el in elements:
            props = el["props"]
            if all(p[0] != "list" for p in props):
                dt = np.dtype([(p[1], end_c + tmap[p[0]]) for p in props])
                arr = np.frombuffer(data, dt, el["count"], o)
                o += dt.itemsize * el["count"]
                if el["name"] == "vertex":
                    verts = np.stack([arr["x"], arr["y"], arr["z"]], 1).astype(np.float64)
            else:
                for _ in range(el["count"]):
                    row = []
                    for p in props:
                        if p[0] == "list":
                            cf, vf = end_c + tmap[p[1]], end_c + tmap[p[2]]
                            n = struct.unpack_from(cf, data, o)[0]; o += struct.calcsize(cf)
                            row.append(struct.unpack_from("%s%d%s" % (end_c, n, tmap[p[2]]), data, o)); o += n * struct.calcsize(vf)
                        else:
                            f = end_c + tmap[p[0]]
                            row.append(struct.unpack_from(f, data, o)[0]); o += struct.calcsize(f)
                    if el["name"] == "face":
                        poly = row[0]
                        faces += [(poly[0], poly[j], poly[j + 1]) for j in range(1, len(poly) - 1)]
    return verts, np.array(faces, np.int64).reshape(-1, 3)


def read_vtk(path):
    """Legacy ASCII VTK: POLYDATA (POLYGONS) or UNSTRUCTURED_GRID (triangles, quads, tetra boundary)."""
    toks = open(path, "r", errors="replace").read().split()
    i = toks.index("POINTS")
    n = int(toks[i + 1])
    pts = np.array(toks[i + 3:i + 3 + 3 * n], np.float64).reshape(n, 3)
    faces = []
    if "POLYGONS" in toks:
        j = toks.index("POLYGONS")
        m = int(toks[j + 1]); k = j + 3
        for _ in range(m):
            c = int(toks[k]); poly = [int(x) for x in toks[k + 1:k + 1 + c]]; k += 1 + c
            faces += [(poly[0], poly[q], poly[q + 1]) for q in range(1, c - 1)]
    elif "CELLS" in toks:
        j = toks.index("CELLS")
        m = int(toks[j + 1]); k = j + 3
        cells = []
        for _ in range(m):
            c = int(toks[k]); cells.append([int(x) for x in toks[k + 1:k + 1 + c]]); k += 1 + c
        tets = [c for c in cells if len(c) == 4]
        if tets:  # boundary faces of a tetrahedral volume
            T = np.array(tets)
            F = np.concatenate([T[:, [0, 2, 1]], T[:, [0, 1, 3]], T[:, [1, 2, 3]], T[:, [0, 3, 2]]])
            key = np.sort(F, 1)
            _, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True)
            faces = F[cnt[inv.ravel()] == 1].tolist()
        for c in cells:
            if len(c) == 3:
                faces.append(tuple(c))
    return pts, np.array(faces, np.int64).reshape(-1, 3)


READERS = {".obj": read_obj, ".stl": read_stl, ".ply": read_ply, ".vtk": read_vtk}


def load(path):
    ext = os.path.splitext(path)[1].lower()
    if ext not in READERS:
        raise SystemExit("unsupported mesh format: %s" % path)
    return READERS[ext](path)


# ---------------------------------------------------------------- geometry


def weld(v, f, tol):
    if len(v) == 0:
        return v, f
    q = np.round(v / tol).astype(np.int64)
    _, first, inv = np.unique(q, axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel()
    f = inv[f]
    keep = (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])
    return v[first], f[keep]


def compact(v, f):
    used = np.unique(f)
    remap = np.full(len(v), -1, np.int64)
    remap[used] = np.arange(len(used))
    return v[used], remap[f]


def subdivide(v, f):
    """Midpoint 1->4 split (used before smoothing coarse subdivision-surface cages)."""
    e = np.sort(np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]]), 1)
    ue, inv = np.unique(e, axis=0, return_inverse=True)
    inv = inv.ravel()
    mid = len(v) + inv.reshape(3, -1).T  # columns: (0,1), (1,2), (2,0)
    v2 = np.vstack([v, (v[ue[:, 0]] + v[ue[:, 1]]) / 2])
    a, b, c = f[:, 0], f[:, 1], f[:, 2]
    ab, bc, ca = mid[:, 0], mid[:, 1], mid[:, 2]
    f2 = np.concatenate([np.stack([a, ab, ca], 1), np.stack([ab, b, bc], 1), np.stack([ca, bc, c], 1), np.stack([ab, bc, ca], 1)])
    return v2, f2


def taubin(v, f, iterations, lam=0.5, mu=-0.53):
    """Volume-preserving Laplacian smoothing."""
    e = np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
    e = np.concatenate([e, e[:, ::-1]])
    deg = np.bincount(e[:, 0], minlength=len(v)).astype(np.float64)
    deg[deg == 0] = 1
    v = v.copy()
    for _ in range(iterations):
        for w in (lam, mu):
            acc = np.zeros_like(v)
            np.add.at(acc, e[:, 0], v[e[:, 1]])
            v += w * (acc / deg[:, None] - v)
    return v


def cluster_decimate(v, f, target):
    """Fallback vertex-clustering decimation (numpy only)."""
    lo, hi = v.min(0), v.max(0)
    size = float((hi - lo).max()) or 1.0
    cells = max(4, int(np.sqrt(target) * 1.2))
    for _ in range(30):
        q = np.floor((v - lo) / (size / cells)).astype(np.int64)
        _, inv = np.unique(q, axis=0, return_inverse=True)
        inv = inv.ravel()
        f2 = inv[f]
        keep = (f2[:, 0] != f2[:, 1]) & (f2[:, 1] != f2[:, 2]) & (f2[:, 0] != f2[:, 2])
        f2 = np.unique(np.sort(f2[keep], 1), axis=0, return_index=True)[1]
        if len(f2) <= target:
            break
        cells = int(cells * 0.9)
    cnt = np.bincount(inv, minlength=inv.max() + 1)[:, None]
    vs = np.zeros((inv.max() + 1, 3))
    np.add.at(vs, inv, v)
    vs /= np.maximum(cnt, 1)
    fi = inv[f]
    keep = (fi[:, 0] != fi[:, 1]) & (fi[:, 1] != fi[:, 2]) & (fi[:, 0] != fi[:, 2])
    fi = fi[keep]
    _, u = np.unique(np.sort(fi, 1), axis=0, return_index=True)
    return compact(vs, fi[np.sort(u)])


def decimate(v, f, target, method):
    if len(f) <= target:
        return v, f
    if method != "cluster":
        try:
            import fast_simplification
            v2, f2 = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=1 - target / len(f))
            return np.asarray(v2, np.float64), np.asarray(f2, np.int64)
        except ImportError:
            if method == "quadric":
                raise SystemExit("fast-simplification is not installed (pip install -r tools/requirements.txt)")
    return cluster_decimate(v, f, target)


def vertex_normals(v, f):
    n = np.zeros_like(v)
    fn = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for k in range(3):
        np.add.at(n, f[:, k], fn)
    L = np.linalg.norm(n, axis=1, keepdims=True)
    return n / np.where(L > 0, L, 1)


AXES = {"x": (0, 1), "-x": (0, -1), "y": (1, 1), "-y": (1, -1), "z": (2, 1), "-z": (2, -1)}
PRESET_FRAMES = {
    # Z-Anatomy / BodyParts3D Blender scene: metres, +X patient left, -Y anterior, +Z superior.
    "zanatomy": {"axes": ["x", "z", "-y"], "scale": 100.0},
}


def to_frame(v, tr):
    out = np.empty_like(v)
    for k, a in enumerate(tr["axes"]):
        i, s = AXES[a]
        out[:, k] = s * v[:, i]
    return out * float(tr.get("scale", 1.0))


def b64(arr):
    return base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode("ascii")


# ---------------------------------------------------------------- bake


def resolve_files(spec, root):
    files = []
    for pat in spec.get("files", []):
        p = pat if os.path.isabs(pat) else os.path.join(root, pat)
        hits = sorted(fnmatch.filter(os.listdir(os.path.dirname(p)), os.path.basename(p))) if any(c in pat for c in "*?[") else [os.path.basename(p)]
        if not hits:
            raise SystemExit("no source files match %s" % p)
        files += [os.path.join(os.path.dirname(p), h) for h in hits]
    for pat in spec.get("exclude", []):
        files = [f for f in files if not fnmatch.fnmatch(os.path.basename(f), pat)]
    if not files:
        raise SystemExit("part has no source files after exclude: %r" % spec)
    for f in files:
        if not os.path.isfile(f):
            raise SystemExit("missing source file: %s (populate the asset cache, see docs/meshes.md)" % f)
    return files


def bake(cfg_path, assets, out_dir, quiet=False):
    cfg = json.load(open(cfg_path))
    name = cfg["name"]
    if not re.match(r"^[a-z0-9][a-z0-9-]*$", name):
        raise SystemExit("mesh name must be [a-z0-9-]+: %r" % name)
    lic = cfg.get("license", "")
    if lic not in ALLOWED_LICENSES:
        raise SystemExit("%s: license %r is not allowed (CC BY / CC BY-SA / compatible only)" % (cfg_path, lic))
    root = cfg.get("source_root", "").replace("${ASSETS}", assets)
    tr = cfg.get("transform", "zanatomy")
    tr = PRESET_FRAMES[tr] if isinstance(tr, str) else tr
    method = cfg.get("decimate", "auto")
    parts = {}
    for pname, spec in cfg["parts"].items():
        if not re.match(r"^[a-z0-9_]+$", pname):
            raise SystemExit("part names must be [a-z0-9_]+: %r" % pname)
        vs, fs, off = [], [], 0
        for f in resolve_files(spec, root):
            v, t = load(f)
            vs.append(v); fs.append(t + off); off += len(v)
        v = to_frame(np.vstack(vs), tr)
        if spec.get("rigid"):  # a documented rigid correction in the output frame: v' = R v + t
            v = v @ np.array(spec["rigid"]["rotation"], np.float64).T + np.array(spec["rigid"]["translation"], np.float64)
        f = np.vstack(fs)
        n_in = len(f)
        v, f = weld(v, f, float(spec.get("weld", cfg.get("weld", 1e-4))))
        for _ in range(int(spec.get("subdivide", 0))):
            v, f = subdivide(v, f)
        if spec.get("smooth"):
            v = taubin(v, f, int(spec["smooth"]))
        budget = int(spec.get("budget", cfg.get("default_budget", 2000)))
        v, f = decimate(v, f, budget, method)
        v, f = compact(v, f)
        parts[pname] = {"v": v, "f": f, "n_in": n_in, "normals": bool(spec.get("normals", cfg.get("normals", False)))}

    allv = np.vstack([p["v"] for p in parts.values()])
    c = cfg.get("center", "bbox")
    if c == "bbox":
        center = (allv.min(0) + allv.max(0)) / 2
    elif c == "none":
        center = np.zeros(3)
    elif isinstance(c, str) and c.startswith("part:"):
        pv = parts[c[5:]]["v"]
        center = (pv.min(0) + pv.max(0)) / 2
    else:
        center = np.array(c, np.float64)

    out_parts, report = {}, []
    for pname, p in parts.items():
        v = (p["v"] - center).astype(np.float32)
        f = p["f"]
        it = "u16" if len(v) <= 65535 else "u32"
        entry = {"p": b64(v), "i": b64(f.astype(np.uint16 if it == "u16" else np.uint32)), "it": it}
        if p["normals"]:
            entry["n"] = b64(vertex_normals(v.astype(np.float64), f).astype(np.float32))
        entry["bbox"] = [round(float(x), 3) for x in np.concatenate([v.min(0), v.max(0)])]
        out_parts[pname] = entry
        report.append((pname, p["n_in"], len(f), len(v)))

    doc = {"parts": out_parts, "unit": "cm", "credit": cfg["credit"], "frame": FRAME,
           "offset": [round(float(x), 4) for x in center], "version": 1}
    body = json.dumps(doc, separators=(",", ":"))
    js = ("// Generated by tools/meshes/bake.py from %s. Do not edit by hand.\n"
          "// Source: %s (%s). Credits: site/meshes/CREDITS.md#%s\n"
          "(window.SagittalMeshes = window.SagittalMeshes || {})[%s] = %s;\n"
          % (os.path.relpath(cfg_path, REPO), cfg.get("source", "?"), lic, cfg["credit"], json.dumps(name), body))
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, name + ".js")
    with open(out, "w") as fh:
        fh.write(js)
    size = len(js.encode())
    if not quiet:
        print("%s -> %s (%.1f KB)" % (cfg_path, os.path.relpath(out, REPO), size / 1024))
        for r in report:
            print("  %-22s %7d -> %6d tris, %6d verts" % r)
    if size > int(cfg.get("max_bytes", MAX_BYTES)):
        raise SystemExit("%s is %.1f KB, over the %d KB limit: lower the part budgets" % (out, size / 1024, MAX_BYTES // 1024))
    return out, report


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("configs", nargs="+")
    ap.add_argument("--assets", default=DEFAULT_ASSETS, help="asset cache root (default: $SAGITTAL_ASSETS or ../sagittal-assets-cache)")
    ap.add_argument("--out", default=os.path.join(REPO, "site", "meshes"))
    a = ap.parse_args(argv)
    for c in a.configs:
        bake(c, a.assets, a.out)


if __name__ == "__main__":
    sys.exit(main())
