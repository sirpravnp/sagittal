#!/usr/bin/env python3
"""Dump Z-Anatomy centre-line curves (vessels, ducts, airways) as JSON in sagittal's body frame.

  .venv/bin/python tools/organs/dump_curves.py STARTUP.blend --match-file tools/organs/curves.txt \\
      --out CACHE/zanatomy-organs/curves.json

Each matched curve object becomes {"bevel_cm", "splines": [{"points": [[x,y,z]...], "radius_cm": [...],
"cyclic"}]}. Points are the evaluated curve (Bezier / Catmull-Rom NURBS at the curve's own resolution,
exactly what extract_blend.py sweeps into tubes), in world space converted to sagittal's frame:
cm, +x patient left, +y superior, +z anterior (Blender x, z, -y times 100). No other change.
"""
import argparse
import json
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "meshes"))
from blendfile import BlendFile  # noqa: E402


def to_body(p_world):
    p = np.asarray(p_world, np.float64)
    return np.stack([p[:, 0], p[:, 2], -p[:, 1]], 1) * 100.0


def dump(blend, patterns):
    bf = BlendFile(blend)
    pats = [re.compile(p, re.I) for p in patterns]
    out = {}
    for name, otype, data, m, ob in bf.objects(types=(bf.OB_CURVE,)):
        if not any(p.search(name) for p in pats):
            continue
        depth, lines = bf.curve_polylines(data)
        # object scale applies to the bevel too; use the mean axis scale of the world matrix
        sc = float(np.mean(np.linalg.norm(m[:3, :3], axis=1)))
        spl = []
        for pts, rad, cyc in lines:
            w = np.asarray(pts, np.float64) @ m[:3, :3] + m[3, :3]
            spl.append({"points": np.round(to_body(w), 3).tolist(),
                        "radius_cm": np.round(np.maximum(rad, 0.05) * depth * sc * 100.0, 3).tolist(),
                        "cyclic": bool(cyc)})
        out[name] = {"bevel_cm": round(depth * sc * 100.0, 4), "splines": spl}
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("blend")
    ap.add_argument("--match", action="append", default=[])
    ap.add_argument("--match-file")
    ap.add_argument("--out", required=True)
    a = ap.parse_args(argv)
    if a.match_file:
        a.match += [l.split("#", 1)[0].strip() for l in open(a.match_file) if l.split("#", 1)[0].strip()]
    d = dump(a.blend, a.match)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    json.dump(d, open(a.out, "w"))
    print("wrote %d curves to %s" % (len(d), a.out))


if __name__ == "__main__":
    main()
