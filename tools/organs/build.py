#!/usr/bin/env python3
"""Build the base organ library: bake configs, meshes, manifests and index.

  .venv/bin/python tools/organs/build.py [--assets CACHE] [--only id,id] [--no-bake]

Reads tools/organs/organs.json. For each organ it
  1. writes tools/meshes/configs/organ-<id>.json (a normal bake.py config, centre pinned at [0,0,0]
     so every organ shares one body frame: Z-Anatomy world, cm, +x left, +y superior, +z anterior),
  2. bakes organs/meshes/<id>.js with tools/meshes/bake.py,
  3. writes organs/manifests/<id>.json (schema sagittal-organ/0): parts, centre lines taken point for
     point from Z-Anatomy curves (CACHE/zanatomy-organs/all_curves.json, made by dump_curves.py) and
     landmarks computed from that geometry by the rules in organs.json, each with a 'derived' note,
and finally organs/index.json. Mesh landmarks use the baked vertices, so they lie on the rendered surface.
Prerequisites (asset cache): zanatomy-organs/obj (extract_blend.py), zanatomy-organs/all_curves.json
(dump_curves.py), organs-registered/ (register.py). See organs/README.md.
"""
import argparse
import base64
import json
import os
import re
import sys

import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, "tools", "meshes"))
import bake  # noqa: E402
import register  # noqa: E402

SCHEMA = "sagittal-organ/0"
CONFIG_DIR = os.path.join(REPO, "tools", "meshes", "configs")
OUT = os.path.join(REPO, "organs")
R = 3  # decimals for coordinates


def rnd(p):
    return [round(float(x), R) for x in p]


def fmt(p):
    return "(%s)" % ", ".join("%.2f" % x for x in p)


# ---------------------------------------------------------------- meshes


def bake_config(org, spec):
    d = dict(spec["defaults"][org["src"]])
    cfg = {"name": org["id"], "credit": d["credit"], "license": d["license"], "source": d["source"],
           "source_root": d["source_root"], "transform": d["transform"], "center": [0, 0, 0],
           "default_budget": 1500, "parts": {}}
    for p in org["parts"]:
        cfg["parts"][p["id"]] = {k: p[k] for k in ("files", "budget", "subdivide", "smooth") if k in p}
    return cfg


def load_baked(path, name):
    txt = open(path).read()
    m = re.search(r'\|\| \{\}\)\[".*?"\] = ', txt)
    body = txt[m.end():].rstrip().rstrip(";")
    doc = json.loads(body)
    off = np.array(doc["offset"])
    parts = {}
    for pn, p in doc["parts"].items():
        v = np.frombuffer(base64.b64decode(p["p"]), np.float32).reshape(-1, 3).astype(np.float64) + off
        f = np.frombuffer(base64.b64decode(p["i"]), np.uint16 if p["it"] == "u16" else np.uint32).reshape(-1, 3).astype(np.int64)
        parts[pn] = (v, f)
    return doc, parts


def tri_count(parts):
    return {k: int(len(f)) for k, (v, f) in parts.items()}


def boundary_edges(f):
    """Number of edges used by only one triangle (0 for a closed surface)."""
    e = np.sort(np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]]), 1)
    return int((np.unique(e, axis=0, return_counts=True)[1] == 1).sum())


def volume_centroid(v, f):
    """Volume centroid of a closed surface. The signed tetrahedra are taken from the vertex mean, not the
    frame origin: the body-frame origin is 1-1.6 m away, and on an open surface (the heart walls, open at
    the valve rings) the far apex put the 'centroid' 25-50 cm outside the heart (Task 0b)."""
    o = v.mean(0)
    a, b, c = v[f[:, 0]] - o, v[f[:, 1]] - o, v[f[:, 2]] - o
    vol = np.einsum("ij,ij->i", a, np.cross(b, c)) / 6.0
    if abs(vol.sum()) > 1e-6:
        return ((a + b + c) / 4.0 * vol[:, None]).sum(0) / vol.sum() + o, "volume centroid"
    area = np.linalg.norm(np.cross(b - a, c - a), axis=1)
    return ((a + b + c) / 3.0 * area[:, None]).sum(0) / area.sum() + o, "surface-area centroid (mesh is open)"


def winding_number(p, v, f):
    """Generalised winding number of point p for surface (v, f): ~1 inside a closed surface, ~0 outside."""
    a, b, c = v[f[:, 0]] - p, v[f[:, 1]] - p, v[f[:, 2]] - p
    la, lb, lc = (np.linalg.norm(x, axis=1) for x in (a, b, c))
    num = np.einsum("ij,ij->i", a, np.cross(b, c))
    den = la * lb * lc + np.einsum("ij,ij->i", a, b) * lc + np.einsum("ij,ij->i", b, c) * la + np.einsum("ij,ij->i", c, a) * lb
    return float(np.arctan2(num, den).sum() / (2 * np.pi))


# ---------------------------------------------------------------- centre lines


def resample(pts, spacing):
    """Keep source points, dropping those closer than `spacing` cm (arc length) to the last kept one."""
    if spacing <= 0 or len(pts) < 3:
        return pts
    keep, acc = [0], 0.0
    for i in range(1, len(pts) - 1):
        acc += np.linalg.norm(pts[i] - pts[i - 1])
        if acc >= spacing:
            keep.append(i)
            acc = 0.0
    keep.append(len(pts) - 1)
    return pts[keep]


def dist_to_line(p, pts):
    """Distance from point p to polyline pts and the nearest point on it."""
    a, b = pts[:-1], pts[1:]
    ab = b - a
    t = np.clip(((p - a) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-12), 0, 1)
    q = a + t[:, None] * ab
    d = np.linalg.norm(q - p, axis=1)
    k = int(np.argmin(d))
    return float(d[k]), q[k]


class Library:
    def __init__(self, spec, curves, registration, baked, assets=None):
        self.spec, self.curves, self.reg, self.baked, self.assets = spec, curves, registration, baked, assets
        self.lines = {}       # id -> dict(points ndarray, organ, ...)
        self.landmarks = {}   # id -> dict(p, name, derived, organ)
        self.warnings = []

    # -- curves
    def curve_pts(self, name, spline=0):
        if name not in self.curves:
            raise SystemExit("curve %r not in all_curves.json" % name)
        s = self.curves[name]["splines"][spline]
        return np.array(s["points"], np.float64), float(np.mean(s["radius_cm"]))

    def curve_end(self, name, which):
        pts, _ = self.curve_pts(name)
        a, b = pts[0], pts[-1]
        key = {"lowest": lambda p: -p[1], "highest": lambda p: p[1], "most_left": lambda p: p[0],
               "most_right": lambda p: -p[0]}[which]
        return a if key(a) >= key(b) else b

    def part(self, organ_id, part_id):
        return self.baked[organ_id][part_id]

    # -- landmark rules
    def landmark(self, organ, lm):
        r = lm["rule"]
        t = r["type"]
        if t == "curve_end":
            p = self.curve_end(r["curve"], r["end"])
            return p, "%s end of Z-Anatomy curve '%s' (spline 0)" % (r["end"], r["curve"])
        if t == "line_point":
            ln = self.lines.get(r["line"])
            if ln is None:
                return None
            p = ln["points"][0 if r["at"] == "start" else -1]
            return p, "%s point of centre line '%s' (Z-Anatomy curve '%s')" % (r["at"], r["line"], ln["curve"])
        if t == "curve_ends_meet":
            (a, _), (b, _) = self.curve_pts(r["curves"][0]), self.curve_pts(r["curves"][1])
            best = min(((np.linalg.norm(x - y), x, y) for x in (a[0], a[-1]) for y in (b[0], b[-1])), key=lambda z: z[0])
            return (best[1] + best[2]) / 2, "midpoint of the nearest end points of Z-Anatomy curves '%s' and '%s' (%.2f cm apart)" % (
                r["curves"][0], r["curves"][1], best[0])
        if t == "registration":
            obj = self.reg
            for k in r["key"].split("."):
                obj = obj[k]
            return np.array(obj, np.float64), r["note"] + " (tools/organs/registration.json %s)" % r["key"]
        if t == "registered_centroid":
            # a closed source surface (e.g. a Rodero cavity), centroid taken in the source frame and mapped
            # by the stored registration transform (a similarity maps centroids to centroids)
            sv, sf = bake.read_obj(os.path.join(self.assets, r["file"]))
            sv = {"rodero": register.rodero_frame}[r["frame"]](sv.astype(np.float64))
            nb = boundary_edges(sf)
            if nb:
                raise SystemExit("%s: %s is not closed (%d boundary edges)" % (lm["id"], r["file"], nb))
            c, kind = volume_centroid(sv, sf)
            obj = self.reg
            for k in r["transform"].split("."):
                obj = obj[k]
            T = (obj["scale"], np.array(obj["rotation"]), np.array(obj["translation_cm"]))
            return register.apply(T, c)[0], "%s of the closed %s surface (asset cache %s), mapped into the body frame by the registration (tools/organs/registration.json %s)%s" % (
                kind, r["what"], r["file"], r["transform"], (": " + r["note"]) if r.get("note") else "")
        v, f = self.part(organ["id"], r["part"])
        if t == "mesh_extreme":
            ax = {"x": 0, "y": 1, "z": 2}[r["axis"][1]]
            sgn = 1 if r["axis"][0] == "+" else -1
            sel = np.ones(len(v), bool)
            note = ""
            if r.get("side"):
                c = (v[:, 0].min() + v[:, 0].max()) / 2
                sel = v[:, 0] > c if r["side"] == "left" else v[:, 0] < c
                note = " among vertices on the patient's %s of the part's bounding-box midline (x %s %.2f)" % (
                    r["side"], ">" if r["side"] == "left" else "<", c)
            idx = np.where(sel)[0][np.argmax(sgn * v[sel, ax])]
            return v[idx], "baked '%s' vertex with the %s %s%s" % (r["part"], "largest" if sgn > 0 else "smallest", r["axis"][1], note)
        if t == "mesh_centroid":
            c, kind = volume_centroid(v, f)
            note = "%s of the baked '%s' mesh" % (kind, r["part"])
            nb = boundary_edges(f)
            if nb:
                note += " (%d open boundary edges)" % nb
            if winding_number(c, v, f) < 0.5:
                if not r.get("outside"):
                    raise SystemExit("%s: centroid of '%s' lies outside the mesh; use another rule or state why in 'outside'" % (lm["id"], r["part"]))
                note += "; it lies outside the mesh: %s" % r["outside"]
            return c, note
        if t == "mesh_nearest":
            q = self.landmarks.get(r["to"])
            if q is None:
                return None
            d, i = cKDTree(v).query(q["p"])
            return v[i], "baked '%s' vertex nearest landmark '%s' (%.2f cm away)" % (r["part"], r["to"], d)
        if t == "mesh_farthest":
            q = self.landmarks.get(r["from"])
            if q is None:
                return None
            i = int(np.argmax(np.linalg.norm(v - q["p"], axis=1)))
            return v[i], "baked '%s' vertex farthest from landmark '%s'" % (r["part"], r["from"])
        if t == "mesh_contact":
            oid, opid = r["other"].split(".")
            if oid not in self.baked:
                return None
            w, _ = self.part(oid, opid)
            d, j = cKDTree(w).query(v)
            i = int(np.argmin(d))
            if r.get("pick") == "a":
                return v[i], "baked '%s' vertex closest to the '%s' mesh (%.2f cm gap)" % (r["part"], r["other"], d[i])
            return (v[i] + w[j[i]]) / 2, "midpoint of the closest vertex pair between baked '%s' and '%s' (%.2f cm gap)" % (
                r["part"], r["other"], d[i])
        if t == "hilum_lid":
            from scipy.spatial import ConvexHull
            h = ConvexHull(v)
            tri = v[h.simplices]
            fc = tri.mean(1)
            area = np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1) / 2
            lid = cKDTree(v).query(fc)[0] > 0.4
            c = (fc[lid] * area[lid, None]).sum(0) / area[lid].sum()
            return c, ("area centroid of the %d convex-hull facets of baked '%s' whose centres lie > 4 mm from the "
                       "kidney surface (the lid over the renal sinus)") % (int(lid.sum()), r["part"])
        raise SystemExit("unknown landmark rule %r" % t)

    def build_lines(self, organ):
        out = {}
        for c in organ.get("centerlines", []):
            pts, rad = self.curve_pts(c["curve"], c.get("spline", 0))
            note = None
            parent = c.get("parent")
            if parent == "auto":
                cands = [(min(dist_to_line(pts[0], l["points"])[0], dist_to_line(pts[-1], l["points"])[0]), k)
                         for k, l in self.lines.items() if k != c["id"]]
                parent = min(cands)[1]
            if parent:
                pl = self.lines.get(parent)
                if pl is None:
                    raise SystemExit("%s: parent %s must be defined earlier" % (c["id"], parent))
                d0, _ = dist_to_line(pts[0], pl["points"])
                d1, _ = dist_to_line(pts[-1], pl["points"])
                if d1 < d0:
                    pts = pts[::-1]
                    d0 = d1
                if d0 > 0.35:
                    self.warnings.append("%s: start is %.2f cm from parent %s" % (c["id"], d0, parent))
                kind = c.get("kind", "artery")
                suffix = {"vein": "junction", "segment": "start"}.get(kind, "origin")
                lid = "%s_%s" % (c["id"], suffix)
                what = {"vein": "Junction of the %s with the %s", "segment": "Start of the %s (end of the %s)"}.get(
                    kind, "Origin of the %s from the %s")
                self.landmarks[lid] = {"p": pts[0], "name": what % (c["name"].split(" (")[0].lower(), pl["name"].split(" (")[0].lower()),
                                       "derived": "end of Z-Anatomy curve '%s'%s nearest the '%s' centre line; it lies %.2f cm from that line" % (
                                           c["curve"], (" spline %d" % c["spline"]) if c.get("spline") else "", parent, d0),
                                       "organ": organ["id"]}
                frm = lid
            else:
                frm = c.get("from")
                o = c.get("orient")
                if o == "down" and pts[0][1] < pts[-1][1]:
                    pts = pts[::-1]
                elif o and o.startswith("start_near:"):
                    q = self.landmarks.get(o.split(":", 1)[1])
                    if q is None:
                        return None
                    if np.linalg.norm(pts[-1] - q["p"]) < np.linalg.norm(pts[0] - q["p"]):
                        pts = pts[::-1]
            spacing = c.get("spacing_cm", 0.25)
            line = {"name": c["name"], "points": resample(pts, spacing), "radius_cm": rad, "from": frm,
                    "curve": c["curve"], "spline": c.get("spline", 0), "organ": organ["id"], "parent": parent}
            self.lines[c["id"]] = line
            out[c["id"]] = line
        return out


def resolve_all(lib, organs):
    """Centre lines and landmarks depend on each other across organs; iterate until all are resolved."""
    pending_lines = [o for o in organs]
    pending_lms = [(o, lm) for o in organs for lm in o.get("landmarks", [])]
    for _ in range(20):
        progress = False
        # landmarks first (curve_end ones need nothing)
        still = []
        for o, lm in pending_lms:
            r = lib.landmark(o, lm)
            if r is None:
                still.append((o, lm))
                continue
            p, derived = r
            lib.landmarks[lm["id"]] = {"p": np.asarray(p, np.float64), "name": lm["name"], "derived": derived, "organ": o["id"]}
            progress = True
        pending_lms = still
        nxt = []
        for o in pending_lines:
            snapshot = dict(lib.lines)
            try:
                res = lib.build_lines(o)
            except SystemExit as e:
                if "must be defined earlier" in str(e):
                    lib.lines = snapshot
                    nxt.append(o)
                    continue
                raise
            if res is None:
                lib.lines = snapshot
                nxt.append(o)
                continue
            progress = True
        pending_lines = nxt
        if not pending_lines and not pending_lms:
            return
        if not progress:
            break
    raise SystemExit("unresolved: lines %s, landmarks %s" % ([o["id"] for o in pending_lines], [lm["id"] for _, lm in pending_lms]))


def manifest(org, spec, lib, credit):
    lines = {k: {"name": v["name"], "points": [rnd(p) for p in v["points"]], "radius_cm": round(v["radius_cm"], 3),
                 "from": v["from"]} for k, v in lib.lines.items() if v["organ"] == org["id"]}
    lms = {k: {"name": v["name"], "p": rnd(v["p"]), "derived": v["derived"]}
           for k, v in lib.landmarks.items() if v["organ"] == org["id"]}
    return {"schema": SCHEMA, "id": org["id"], "name": org["name"], "system": org["system"], "mesh": org["id"], "credit": credit,
            "parts": [{"id": p["id"], "name": p["name"], "tissue": p["tissue"]} for p in org["parts"]],
            "centerlines": lines, "landmarks": lms}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--assets", default=bake.DEFAULT_ASSETS)
    ap.add_argument("--spec", default=os.path.join(HERE, "organs.json"))
    ap.add_argument("--no-bake", action="store_true", help="reuse organs/meshes/*.js")
    a = ap.parse_args(argv)
    spec = json.load(open(a.spec))
    organs = spec["organs"]
    ids = [o["id"] for o in organs]
    assert len(set(ids)) == len(ids), "duplicate organ ids"
    os.makedirs(os.path.join(OUT, "meshes"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "manifests"), exist_ok=True)
    baked, stats, credits = {}, {}, {}
    for o in organs:
        cfg = bake_config(o, spec)
        cpath = os.path.join(CONFIG_DIR, "organ-%s.json" % o["id"])
        with open(cpath, "w") as fh:
            json.dump(cfg, fh, indent=2)
            fh.write("\n")
        mpath = os.path.join(OUT, "meshes", o["id"] + ".js")
        if not a.no_bake:
            bake.bake(cpath, a.assets, os.path.join(OUT, "meshes"), quiet=True)
        doc, parts = load_baked(mpath, o["id"])
        baked[o["id"]] = parts
        credits[o["id"]] = doc["credit"]
        stats[o["id"]] = {"kb": round(os.path.getsize(mpath) / 1024, 1), "tris": tri_count(parts), "credit": doc["credit"],
                          "license": cfg["license"]}
    curves = json.load(open(os.path.join(a.assets, "zanatomy-organs", "all_curves.json")))
    reg = json.load(open(os.path.join(HERE, "registration.json")))
    lib = Library(spec, curves, reg, baked, a.assets)
    resolve_all(lib, organs)
    # landmark ids are global: make sure no clash between organs
    index = []
    for o in organs:
        m = manifest(o, spec, lib, credits[o["id"]])
        with open(os.path.join(OUT, "manifests", o["id"] + ".json"), "w") as fh:
            json.dump(m, fh, indent=1)
            fh.write("\n")
        index.append({"id": o["id"], "name": o["name"], "system": o["system"]})
        stats[o["id"]]["landmarks"] = len(m["landmarks"])
        stats[o["id"]]["centerlines"] = len(m["centerlines"])
    with open(os.path.join(OUT, "index.json"), "w") as fh:
        json.dump(index, fh, indent=1)
        fh.write("\n")
    with open(os.path.join(HERE, "build-stats.json"), "w") as fh:
        json.dump(stats, fh, indent=1)
    for k, s in stats.items():
        print("%-20s %6.1f KB %6d tris  %2d lines %2d landmarks  %s" % (k, s["kb"], sum(s["tris"].values()), s["centerlines"], s["landmarks"], s["credit"]))
    for w in lib.warnings:
        print("WARNING", w)


if __name__ == "__main__":
    main()
