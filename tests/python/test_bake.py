"""tools/meshes/bake.py: readers, frame transform, budgets, output format, license gate."""
import base64
import json
import re
import struct
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "meshes"))
import bake  # noqa: E402


def sphere(n=24):
    """UV sphere of radius 1 as (verts, tris)."""
    vs, fs = [], []
    for i in range(n + 1):
        th = np.pi * i / n
        for j in range(2 * n):
            ph = np.pi * j / n
            vs.append((np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)))
    W = 2 * n
    for i in range(n):
        for j in range(W):
            a, b = i * W + j, i * W + (j + 1) % W
            c, d = a + W, b + W
            fs += [(a, c, b), (b, c, d)]
    return np.array(vs), np.array(fs)


def write_obj(path, v, f, shift=(0, 0, 0)):
    with open(path, "w") as fh:
        for p in v + np.array(shift):
            fh.write("v %f %f %f\n" % tuple(p))
        for t in f:
            fh.write("f %d %d %d\n" % tuple(t + 1))


def decode(js):
    m = re.search(r'\["([a-z0-9-]+)"\] = (\{.*\});\s*$', js, re.S)
    return m.group(1), json.loads(m.group(2))


def make_cfg(tmp_path, **over):
    v, f = sphere()
    src = tmp_path / "src"
    src.mkdir(exist_ok=True)
    write_obj(src / "Ball.l.obj", v * 0.05, f, (0.1, 0, 1.2))   # 5 cm ball, patient left, 1.2 m up
    write_obj(src / "Ball.r.obj", v * 0.05, f, (-0.1, 0, 1.2))
    cfg = {"name": "balls", "credit": "test", "license": "CC BY-SA 4.0", "source_root": str(src),
           "transform": "zanatomy", "parts": {"left": {"files": ["Ball.l.obj"], "budget": 200},
                                              "right": {"files": ["Ball.r.obj"], "budget": 5000}}}
    cfg.update(over)
    p = tmp_path / "balls.json"
    p.write_text(json.dumps(cfg))
    return p


def test_bake_writes_classic_script_in_sagittal_frame(tmp_path):
    out_dir = tmp_path / "meshes"
    bake.bake(str(make_cfg(tmp_path)), "", str(out_dir), quiet=True)
    js = (out_dir / "balls.js").read_text()
    assert js.count("window.SagittalMeshes = window.SagittalMeshes || {}") == 1
    name, doc = decode(js)
    assert name == "balls" and doc["unit"] == "cm" and doc["credit"] == "test"
    left = doc["parts"]["left"]
    p = np.frombuffer(base64.b64decode(left["p"]), np.float32).reshape(-1, 3)
    i = np.frombuffer(base64.b64decode(left["i"]), np.uint16 if left["it"] == "u16" else np.uint32)
    assert len(i) % 3 == 0 and len(i) // 3 <= 200 and i.max() < len(p)
    # metres -> cm, centred on the combined bbox: the left ball sits at +x (patient left), radius 5 cm
    assert p[:, 0].mean() == pytest.approx(10, abs=0.5)
    assert (p.max(0) - p.min(0)).tolist() == pytest.approx([10, 10, 10], abs=1.0)
    assert doc["offset"][1] == pytest.approx(120, abs=0.1)       # +y superior (Blender +Z)
    assert left["bbox"][:3] == pytest.approx(p.min(0).tolist(), abs=1e-3)
    right = doc["parts"]["right"]
    # under budget: not decimated (only the UV sphere's degenerate pole triangles are welded away)
    assert len(base64.b64decode(right["i"])) // 2 // 3 == len(sphere()[1]) - 2 * 2 * 24


def test_anterior_is_plus_z(tmp_path):
    v, f = sphere(8)
    src = tmp_path / "src"
    src.mkdir()
    write_obj(src / "front.obj", v * 0.01, f, (0, -0.1, 0))  # Blender -Y is anterior
    write_obj(src / "back.obj", v * 0.01, f, (0, 0.1, 0))
    cfg = {"name": "ap", "credit": "t", "license": "CC BY 4.0", "source_root": str(src),
           "parts": {"front": {"files": ["front.obj"]}, "back": {"files": ["back.obj"]}}}
    (tmp_path / "ap.json").write_text(json.dumps(cfg))
    bake.bake(str(tmp_path / "ap.json"), "", str(tmp_path / "o"), quiet=True)
    _, doc = decode((tmp_path / "o" / "ap.js").read_text())
    assert doc["parts"]["front"]["bbox"][2] > 0 > doc["parts"]["back"]["bbox"][5]


def test_rejects_non_open_license(tmp_path):
    with pytest.raises(SystemExit, match="not allowed"):
        bake.bake(str(make_cfg(tmp_path, license="CC BY-NC 4.0")), "", str(tmp_path / "o"), quiet=True)


def test_size_limit(tmp_path):
    with pytest.raises(SystemExit, match="limit"):
        bake.bake(str(make_cfg(tmp_path, max_bytes=1000)), "", str(tmp_path / "o"), quiet=True)


def test_readers_agree(tmp_path):
    v, f = sphere(6)
    write_obj(tmp_path / "s.obj", v, f)
    with open(tmp_path / "s.stl", "wb") as fh:  # binary STL
        fh.write(b"\0" * 80 + struct.pack("<I", len(f)))
        for t in f:
            fh.write(struct.pack("<3f", 0, 0, 0) + v[t].astype("<f4").tobytes() + b"\0\0")
    with open(tmp_path / "s.ply", "w") as fh:  # ASCII PLY
        fh.write("ply\nformat ascii 1.0\nelement vertex %d\nproperty float x\nproperty float y\nproperty float z\n"
                 "element face %d\nproperty list uchar int vertex_indices\nend_header\n" % (len(v), len(f)))
        for p in v:
            fh.write("%f %f %f\n" % tuple(p))
        for t in f:
            fh.write("3 %d %d %d\n" % tuple(t))
    with open(tmp_path / "s.vtk", "w") as fh:  # legacy VTK polydata
        fh.write("# vtk DataFile Version 3.0\ns\nASCII\nDATASET POLYDATA\nPOINTS %d float\n" % len(v))
        for p in v:
            fh.write("%f %f %f\n" % tuple(p))
        fh.write("POLYGONS %d %d\n" % (len(f), 4 * len(f)))
        for t in f:
            fh.write("3 %d %d %d\n" % tuple(t))
    areas = []
    for ext in ("obj", "stl", "ply", "vtk"):
        vv, ff = bake.load(str(tmp_path / ("s." + ext)))
        vv, ff = bake.weld(vv, ff, 1e-5)
        areas.append(np.linalg.norm(np.cross(vv[ff[:, 1]] - vv[ff[:, 0]], vv[ff[:, 2]] - vv[ff[:, 0]]), axis=1).sum() / 2)
    assert areas == pytest.approx([areas[0]] * 4, rel=1e-3)


def test_cluster_decimate_fallback_meets_budget():
    v, f = sphere(40)
    v2, f2 = bake.decimate(v, f, 500, "cluster")
    assert 0 < len(f2) <= 500 and f2.max() < len(v2)


def test_quadric_decimate_meets_budget():
    v, f = sphere(40)
    v2, f2 = bake.decimate(v, f, 500, "quadric")
    assert 0 < len(f2) <= 520 and f2.max() < len(v2)


def test_part_rigid_correction_is_applied_after_the_frame_transform(tmp_path):
    # a 90 degree turn about +y then a shift, in the output frame (cm)
    R = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]]
    cfg = make_cfg(tmp_path, center="none")
    c = json.loads(cfg.read_text())
    c["parts"]["left"]["rigid"] = {"rotation": R, "translation": [0, 0, 3]}
    cfg.write_text(json.dumps(c))
    bake.bake(str(cfg), "", str(tmp_path / "o"), quiet=True)
    _, doc = decode((tmp_path / "o" / "balls.js").read_text())
    left = np.frombuffer(base64.b64decode(doc["parts"]["left"]["p"]), np.float32).reshape(-1, 3)
    right = np.frombuffer(base64.b64decode(doc["parts"]["right"]["p"]), np.float32).reshape(-1, 3)
    # left ball centre (10, 120, 0) cm -> R @ c + t = (0, 120, -10 + 3)
    assert left.mean(0).tolist() == pytest.approx([0, 120, -7], abs=0.3)
    assert right.mean(0).tolist() == pytest.approx([-10, 120, 0], abs=0.3)  # other parts untouched
