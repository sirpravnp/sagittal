#!/usr/bin/env python3
"""Extract named objects from a .blend file (e.g. Z-Anatomy's Startup.blend) into OBJ files.

Meshes are written as their base cage (modifiers such as subdivision are NOT applied; the
modifier stack is recorded in the OBJ header and in index.tsv). Curves (Z-Anatomy draws vessels,
ducts and nerves as bevelled curves) are swept into tubes using the curve's bevel depth x the
per-point radius. Coordinates are world space in Blender's frame exactly as stored
(Z-Anatomy: metres, +Z superior, -Y anterior, +X patient's left); bake.py converts to sagittal's frame.

Usage:
  python tools/meshes/extract_blend.py STARTUP.blend --out CACHE/zanatomy/obj \\
      --match '^(Sternum|Body of sternum)$' --match 'rib\\.(l|r)$'
  python tools/meshes/extract_blend.py STARTUP.blend --list CACHE/zanatomy/objects.tsv
"""
import argparse
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blendfile import BlendFile, tube  # noqa: E402

MOD_NAMES = {1: "subsurf", 2: "lattice", 3: "curve", 5: "mirror", 6: "decimate", 8: "armature",
             11: "boolean", 12: "array", 16: "smooth", 25: "solidify", 28: "shrinkwrap"}


def safe_name(name):
    return re.sub(r"[^A-Za-z0-9._()+-]+", "_", name).strip("_")


def world(points, m):
    return np.asarray(points, np.float64) @ m[:3, :3] + m[3, :3]


def object_geometry(bf, otype, data, m, sides):
    """World-space (positions, triangles) for a mesh or curve object, or None."""
    if otype == bf.OB_MESH:
        if bf.get("Mesh", data.off, "totpoly") == 0:
            return None
        p, t = bf.mesh_triangles(data)
        return world(p, m).astype(np.float32), t
    depth, lines = bf.curve_polylines(data)
    if depth <= 0 or not lines:
        return None
    vs, fs, off = [], [], 0
    for pts, rad, cyc in lines:
        v, f = tube(pts, np.maximum(rad, 0.05) * depth, sides=sides, cyclic=cyc)
        if len(f):
            vs.append(world(v, m))
            fs.append(f + off)
            off += len(v)
    if not vs:
        return None
    return np.vstack(vs).astype(np.float32), np.vstack(fs)


def write_obj(path, name, kind, mods, pos, tri):
    with open(path, "w") as f:
        f.write("# source object: %s\n# kind: %s\n# modifiers (not applied): %s\n" % (name, kind, ",".join(mods) or "-"))
        f.write("# frame: Blender world as stored in the .blend (Z-Anatomy: metres, +Z up)\n")
        f.write("o %s\n" % safe_name(name))
        np.savetxt(f, pos, fmt="v %.6f %.6f %.6f")
        np.savetxt(f, tri + 1, fmt="f %d %d %d")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("blend")
    ap.add_argument("--out", help="directory for OBJ files")
    ap.add_argument("--match", action="append", default=[], help="regex on object name (repeatable, case-insensitive)")
    ap.add_argument("--match-file", help="file of regexes, one per line ('#' comments allowed)")
    ap.add_argument("--list", help="write a TSV of every mesh/curve object (name, kind, verts, polys/splines)")
    ap.add_argument("--sides", type=int, default=12, help="tube sides for curves")
    a = ap.parse_args(argv)

    if a.match_file:
        for line in open(a.match_file):
            line = line.split("#", 1)[0].strip()
            if line:
                a.match.append(line)
    bf = BlendFile(a.blend)
    objs = list(bf.objects(types=(bf.OB_MESH, bf.OB_CURVE)))
    print("%s: Blender %d, %d mesh/curve objects" % (a.blend, bf.version, len(objs)))

    if a.list:
        with open(a.list, "w") as f:
            f.write("name\tkind\tverts\tpolys_or_splines\tmodifiers\n")
            for name, otype, data, m, ob in objs:
                mods = ",".join(MOD_NAMES.get(t, str(t)) for t, _ in bf.modifiers(ob))
                if otype == bf.OB_MESH:
                    f.write("%s\tmesh\t%d\t%d\t%s\n" % (name, bf.get("Mesh", data.off, "totvert"),
                                                         bf.get("Mesh", data.off, "totpoly"), mods))
                else:
                    depth, lines = bf.curve_polylines(data)
                    f.write("%s\tcurve(bevel=%.4g)\t%d\t%d\t%s\n" % (name, depth, sum(len(l[0]) for l in lines), len(lines), mods))
        print("wrote", a.list)

    if a.out and a.match:
        os.makedirs(a.out, exist_ok=True)
        pats = [re.compile(p, re.I) for p in a.match]
        idx_path = os.path.join(a.out, "index.tsv")
        rows = {}
        if os.path.exists(idx_path):
            for line in open(idx_path).read().splitlines()[1:]:
                rows[line.split("\t")[0]] = line
        n = 0
        for name, otype, data, m, ob in objs:
            if not any(p.search(name) for p in pats):
                continue
            g = object_geometry(bf, otype, data, m, a.sides)
            if g is None:
                continue
            pos, tri = g
            kind = "mesh" if otype == bf.OB_MESH else "curve-tube"
            mods = [MOD_NAMES.get(t, str(t)) for t, _ in bf.modifiers(ob)]
            fn = safe_name(name) + ".obj"
            write_obj(os.path.join(a.out, fn), name, kind, mods, pos, tri)
            lo, hi = pos.min(0), pos.max(0)
            rows[name] = "\t".join([name, fn, kind, str(len(pos)), str(len(tri)), ",".join(mods) or "-",
                                    " ".join("%.4f" % v for v in lo), " ".join("%.4f" % v for v in hi)])
            n += 1
        with open(idx_path, "w") as f:
            f.write("name\tfile\tkind\tverts\ttris\tmodifiers\tbbox_min\tbbox_max\n")
            for k in sorted(rows):
                f.write(rows[k] + "\n")
        print("extracted %d objects into %s" % (n, a.out))


if __name__ == "__main__":
    main()
