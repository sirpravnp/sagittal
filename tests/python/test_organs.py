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
