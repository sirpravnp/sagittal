"""tools/organs: similarity fit, centre-line helpers and the organ spec."""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "organs"))
import build  # noqa: E402
import register  # noqa: E402


def test_umeyama_recovers_a_similarity_transform():
    rng = np.random.default_rng(1)
    src = rng.normal(size=(8, 3))
    a = np.radians(20)
    R = np.array([[np.cos(a), -np.sin(a), 0], [np.sin(a), np.cos(a), 0], [0, 0, 1]])
    dst = 1.3 * src @ R.T + np.array([1.0, -2.0, 0.5])
    s, R2, t = register.umeyama(src, dst)
    assert abs(s - 1.3) < 1e-9
    assert np.allclose(R2, R)
    assert np.allclose(register.apply((s, R2, t), src), dst)


def test_resample_keeps_source_points_and_both_ends():
    pts = np.stack([np.linspace(0, 10, 101), np.zeros(101), np.zeros(101)], 1)
    out = build.resample(pts, 1.0)
    assert np.allclose(out[0], pts[0]) and np.allclose(out[-1], pts[-1])
    assert all(any(np.allclose(p, q) for q in pts) for p in out)  # no new points invented
    assert 10 <= len(out) <= 12


def test_dist_to_line():
    line = np.array([[0, 0, 0], [10, 0, 0.0]])
    d, q = build.dist_to_line(np.array([5, 3, 0.0]), line)
    assert abs(d - 3) < 1e-9 and np.allclose(q, [5, 0, 0])


def test_spec_ids_are_unique_and_parts_have_tissue():
    spec = json.loads((ROOT / "tools" / "organs" / "organs.json").read_text())
    ids = [o["id"] for o in spec["organs"]]
    assert len(ids) == len(set(ids))
    lms = [lm["id"] for o in spec["organs"] for lm in o.get("landmarks", [])]
    assert len(lms) == len(set(lms))
    for o in spec["organs"]:
        assert o["src"] in spec["defaults"]
        for p in o["parts"]:
            assert p["tissue"] and p["files"]
    # never the Z-Anatomy kidney model (CC BY-NC) or its renal pelvis / intrarenal vessels
    files = " ".join(f for o in spec["organs"] if o["src"] == "zanatomy" for p in o["parts"] for f in p["files"])
    assert "Kidney" not in files and "Renal_pelvis" not in files and "Intrarenal" not in files
    # nor its ureters and suprarenal glands (possible overlap with that model: licence unclear)
    assert "Ureter" not in files and "Suprarenal" not in files
    match = (ROOT / "tools" / "organs" / "zanatomy_organs.txt").read_text()
    rules = [l for l in match.splitlines() if l.strip() and not l.lstrip().startswith("#")]
    assert not any(k in r for r in rules for k in ("Kidney", "Renal pelvis", "Intrarenal", "Ureter", "Suprarenal"))


def _cube(offset):
    v = np.array([[x, y, z] for x in (0, 1) for y in (0, 1) for z in (0, 1)], float) * 2 + offset
    f = np.array([[0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], [0, 4, 5], [0, 5, 1],
                  [2, 3, 7], [2, 7, 6], [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3]])
    return v, f


def test_volume_centroid_does_not_depend_on_the_frame_origin():
    # The organ frame's origin is 1-1.6 m from the organs. With the signed tetrahedra taken from the
    # origin, an open surface (the heart walls) gave a 'centroid' 25-50 cm outside the heart.
    off = np.array([3.0, 130.0, -2.0])
    v, f = _cube(off)
    c, kind = build.volume_centroid(v, f)
    assert kind == "volume centroid" and np.allclose(c, off + 1)
    assert build.boundary_edges(f) == 0 and abs(build.winding_number(off + 1, v, f) - 1) < 1e-9
    open_f = f[2:]  # one face of the cube removed
    assert build.boundary_edges(open_f) == 4
    c2, _ = build.volume_centroid(v, open_f)
    assert np.linalg.norm(c2 - (off + 1)) < 1.0  # stays near the solid, not pulled towards the origin
    assert abs(build.winding_number(off + [10, 0, 0], v, f)) < 1e-9


def _baked(organ):
    return build.load_baked(str(ROOT / "organs" / "meshes" / (organ + ".js")), organ)[1]


def _landmarks(organ):
    return {k: np.array(l["p"]) for k, l in json.loads((ROOT / "organs" / "manifests" / (organ + ".json")).read_text())["landmarks"].items()}


def _ray_hits(p, d, v, f):
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    e1, e2 = b - a, c - a
    h = np.cross(d, e2)
    det = np.einsum("ij,ij->i", e1, h)
    ok = np.abs(det) > 1e-12
    inv = np.where(ok, 1 / np.where(ok, det, 1), 0)
    s = p - a
    u = inv * np.einsum("ij,ij->i", s, h)
    q = np.cross(s, e1)
    w = inv * (q @ d)
    t = inv * np.einsum("ij,ij->i", e2, q)
    return bool(np.any(ok & (u >= 0) & (w >= 0) & (u + w <= 1) & (t > 0)))


def test_heart_chamber_centroids_lie_inside_the_heart():
    parts = _baked("heart")
    lm = _landmarks("heart")
    dirs = np.array([[i, j, k] for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1) if (i, j, k) != (0, 0, 0)], float)
    dirs /= np.linalg.norm(dirs, axis=1)[:, None]
    for ch, wall in (("left_ventricle", "wall_lv"), ("right_ventricle", "wall_rv"), ("left_atrium", "wall_la"), ("right_atrium", "wall_ra")):
        p = lm[ch + "_centroid"]
        v, _ = parts[wall]
        assert np.all(p > v.min(0)) and np.all(p < v.max(0)), ch  # inside its own chamber's bounding box
        # enclosed by the heart: a ray hits a heart part in (almost) every direction (the atria open to the veins)
        hits = sum(any(_ray_hits(p, d, *parts[k]) for k in parts) for d in dirs)
        assert hits >= 25, (ch, hits)
    # inflow valves between their atrium and ventricle; centroids on the expected sides
    assert lm["left_ventricle_centroid"][0] > lm["right_ventricle_centroid"][0]
    assert lm["right_ventricle_centroid"][2] > lm["left_ventricle_centroid"][2]  # RV anterior
    assert lm["left_atrium_centroid"][2] < lm["left_ventricle_centroid"][2]  # LA posterior
    for v_, a_, b_ in (("mitral", "left_atrium", "left_ventricle"), ("tricuspid", "right_atrium", "right_ventricle")):
        a, b, m = lm[a_ + "_centroid"], lm[b_ + "_centroid"], lm[v_ + "_valve_centre"]
        t = (m - a) @ (b - a) / ((b - a) @ (b - a))
        assert 0 < t < 1, v_


def test_rotation_onto_is_the_smallest_proper_rotation():
    a, b = np.array([1.0, 2, 0.5]), np.array([-0.3, 1, 2])
    R = build.rotation_onto(a, b)
    assert np.allclose(R @ R.T, np.eye(3)) and abs(np.linalg.det(R) - 1) < 1e-9
    assert np.allclose(R @ (a / np.linalg.norm(a)), b / np.linalg.norm(b))
    axis = np.cross(a, b)
    assert np.allclose(R @ axis, axis)  # turns about the common normal only
    assert np.allclose(build.rotation_onto(a, a), np.eye(3))


def test_bile_duct_correction_is_rigid_and_recorded():
    spec = json.loads((ROOT / "tools" / "organs" / "organs.json").read_text())
    rec = json.loads((ROOT / "tools" / "organs" / "corrections.json").read_text())["corrections"]
    assert set(rec) == set(spec["corrections"]) == {"bile_duct_onto_d2"}
    c = rec["bile_duct_onto_d2"]
    R, t = np.array(c["rotation"]), np.array(c["translation_cm"])
    assert np.allclose(R @ R.T, np.eye(3), atol=1e-5) and abs(np.linalg.det(R) - 1) < 1e-5
    assert np.allclose(R @ np.array(c["pivot_cm"]) + t, c["pivot_cm"], atol=1e-3)  # the upper end stays
    assert c["rotation_deg"] < 25 and c["moving_end_shift_cm"] < 3
    # the baked gallbladder config carries the same transform for the swept duct mesh
    cfg = json.loads((ROOT / "tools" / "meshes" / "configs" / "organ-gallbladder.json").read_text())
    assert cfg["parts"]["bile_duct"]["rigid"]["rotation"] == c["rotation"]
    # every landmark on the corrected duct says so
    lm = json.loads((ROOT / "organs" / "manifests" / "gallbladder.json").read_text())["landmarks"]
    for k in ("bile_duct_upper_end", "bile_duct_lower_end"):
        assert "rigidly corrected" in lm[k]["derived"] and "bile_duct_onto_d2" in lm[k]["derived"]


def test_bile_duct_enters_the_posteromedial_wall_of_the_descending_duodenum():
    from scipy.spatial import cKDTree
    dv, df = _baked("duodenum")["duodenum"]
    gl, dl = _landmarks("gallbladder"), _landmarks("duodenum")
    for p in (gl["bile_duct_lower_end"], dl["major_duodenal_papilla"]):
        slab = dv[(np.abs(dv[:, 1] - p[1]) < 0.25) & (dv[:, 0] < -3.5)]  # descending part, this height
        off = p - slab.mean(0)
        assert off[0] > 0.3 and off[2] < -0.5, off  # medial (+x for the right-sided D2) and posterior (-z)
        assert cKDTree(dv).query(p)[0] < 0.3  # on the wall
    # the duct's upper end still meets the gallbladder neck; its middle runs through the pancreatic head
    assert np.linalg.norm(gl["bile_duct_upper_end"] - gl["gallbladder_neck"]) < 0.2
    pv, pf = _baked("pancreas")["pancreas"]
    line = np.array(json.loads((ROOT / "organs" / "manifests" / "gallbladder.json").read_text())["centerlines"]["bile_duct"]["points"])
    inside = [build.winding_number(p, pv, pf) > 0.5 for p in line]
    assert sum(inside) >= 10, sum(inside)
