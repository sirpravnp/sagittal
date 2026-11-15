"""tools/meshes/ct_to_obj.py: label selection, RAS/LPS -> sagittal axis mapping, mm -> cm, outward
winding, and that its OBJs bake with bake.py. Uses a small synthetic labelled volume (no downloads)."""
import base64
import json
import re
import sys
from pathlib import Path

import numpy as np
import pytest

nib = pytest.importorskip("nibabel")
pytest.importorskip("skimage")

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "meshes"))
import bake  # noqa: E402
import ct_to_obj  # noqa: E402

R = 12.0  # mm, sphere radius
# Sphere centres in RAS+ world mm (+X patient's RIGHT, +Y anterior, +Z superior).
CENTRES = {1: (-40.0, 0.0, 0.0),   # patient's left  -> sagittal +x
           2: (0.0, 0.0, 40.0),    # superior        -> sagittal +y
           3: (0.0, 40.0, 0.0)}    # anterior        -> sagittal +z

AFFINES = {
    # DICOM-like LPS storage, anisotropic voxels
    "lps": np.array([[-2.0, 0, 0, 70], [0, -2.0, 0, 70], [0, 0, 2.5, -70], [0, 0, 0, 1]]),
    # plain RAS, isotropic
    "ras": np.array([[2.0, 0, 0, -70], [0, 2.0, 0, -70], [0, 0, 2.0, -70], [0, 0, 0, 1]]),
    # LAS ("radiological") storage: a left-handed affine, mirrors space
    "las": np.array([[-2.0, 0, 0, 70], [0, 2.0, 0, -70], [0, 0, 2.0, -70], [0, 0, 0, 1]]),
    # permuted axes (voxel axis 0 runs superior, axis 2 runs left)
    "perm": np.array([[0, 0, -2.0, 70], [0, 2.0, 0, -70], [2.0, 0, 0, -70], [0, 0, 0, 1]]),
}


def volume(aff, shape=(71, 71, 57)):
    ijk = np.stack(np.meshgrid(*[np.arange(n) for n in shape], indexing="ij"), -1).reshape(-1, 3)
    w = ijk @ aff[:3, :3].T + aff[:3, 3]
    lab = np.zeros(len(w), np.int16)
    for k, c in CENTRES.items():
        lab[np.linalg.norm(w - np.array(c), axis=1) <= R] = k
    lab[np.linalg.norm(w - np.array([30.0, -30.0, -30.0]), axis=1) <= 2.0] = 1  # a speck of label 1
    return lab.reshape(shape)


def write_volume(tmp_path, kind="lps", shape=None):
    aff = AFFINES[kind]
    shp = shape or ((71, 71, 57) if kind == "lps" else (71, 71, 71))
    p = tmp_path / ("seg_%s.nii.gz" % kind)
    nib.save(nib.Nifti1Image(volume(aff, shp), aff), str(p))
    return p


def read_obj(path):
    v, f = bake.read_obj(str(path))
    return v, f


@pytest.mark.parametrize("kind", ["lps", "ras", "las", "perm"])
def test_axis_mapping_units_and_outward_winding(tmp_path, kind):
    seg = write_volume(tmp_path, kind)
    out = tmp_path / "obj"
    ct_to_obj.main(["--volume", str(seg), "--out", str(out),
                    "--part", "left=1", "--part", "up=2", "--part", "front=3"])
    expect = {"left": (4, 0, 0), "up": (0, 4, 0), "front": (0, 0, 4)}  # cm, sagittal frame
    for name, c in expect.items():
        v, f = read_obj(out / (name + ".obj"))
        centre = (v.min(0) + v.max(0)) / 2
        assert centre.tolist() == pytest.approx(list(c), abs=0.25), name
        # mm -> cm: a 12 mm sphere is ~2.4 cm across (blur + smoothing shrink it slightly)
        assert (v.max(0) - v.min(0)).tolist() == pytest.approx([2.4] * 3, abs=0.35), name
        vol = ct_to_obj.signed_volume(v, f)
        assert vol > 0, "%s: triangles face inward" % name
        assert vol == pytest.approx(4 / 3 * np.pi * 1.2 ** 3, rel=0.2), name


def test_label_selection_merges_ids_and_drops_specks(tmp_path):
    seg = write_volume(tmp_path)
    out = tmp_path / "obj"
    ct_to_obj.main(["--volume", str(seg), "--out", str(out), "--part", "pair=2,3", "--part", "one=1"])
    v, _ = read_obj(out / "pair.obj")
    assert v[:, 1].max() > 4.8 and v[:, 2].max() > 4.8      # both spheres present
    assert v[:, 0].max() < 1.5                                # not the left sphere
    v1, _ = read_obj(out / "one.obj")
    assert v1[:, 0].min() > 2.5                               # the speck at patient's right is gone
    rows = (out / "index.tsv").read_text().splitlines()
    assert rows[0].startswith("name\tfile") and {r.split("\t")[0] for r in rows[1:]} == {"one", "pair"}
    header = (out / "one.obj").read_text().splitlines()[:6]
    assert any("labels: 1" in h for h in header) and any("orientation LPS" in h for h in header)


def test_keeps_specks_when_asked(tmp_path):
    seg = write_volume(tmp_path)
    ct_to_obj.main(["--volume", str(seg), "--out", str(tmp_path / "o"), "--part", "one=1", "--min-voxels", "1"])
    v, _ = read_obj(tmp_path / "o" / "one.obj")
    assert v[:, 0].min() < -2.5                               # speck at RAS x=+30 mm -> sagittal x=-3 cm


def test_binary_mask_input(tmp_path):
    aff = AFFINES["ras"]
    m = (volume(aff, (71, 71, 71)) == 3).astype(np.uint8)
    p = tmp_path / "front.nii.gz"
    nib.save(nib.Nifti1Image(m, aff), str(p))
    ct_to_obj.main(["--mask", "front=%s" % p, "--out", str(tmp_path / "o")])
    v, _ = read_obj(tmp_path / "o" / "front.obj")
    assert ((v.min(0) + v.max(0)) / 2).tolist() == pytest.approx([0, 0, 4], abs=0.25)


def test_missing_label_is_an_error(tmp_path):
    seg = write_volume(tmp_path)
    with pytest.raises(SystemExit, match="no voxels"):
        ct_to_obj.main(["--volume", str(seg), "--out", str(tmp_path / "o"), "--part", "x=9"])


def test_list_reports_labels(tmp_path, capsys):
    seg = write_volume(tmp_path)
    ct_to_obj.main(["--volume", str(seg), "--list"])
    out = capsys.readouterr().out
    assert "orientation LPS" in out and "label 1" in out and "label 3" in out and "label 0" not in out


def test_output_bakes_with_bake_py(tmp_path):
    seg = write_volume(tmp_path)
    obj = tmp_path / "obj"
    ct_to_obj.main(["--volume", str(seg), "--out", str(obj), "--part", "left=1", "--part", "front=3"])
    cfg = {"name": "ct-test", "credit": "totalsegmentator", "license": "CC BY 4.0",
           "source": "synthetic", "source_root": str(obj),
           "transform": {"axes": ["x", "y", "z"], "scale": 1}, "center": "none",
           "parts": {"left": {"files": ["left.obj"], "budget": 400},
                     "front": {"files": ["front.obj"], "budget": 400}}}
    cp = tmp_path / "ct-test.json"
    cp.write_text(json.dumps(cfg))
    bake.bake(str(cp), "", str(tmp_path / "meshes"), quiet=True)
    js = (tmp_path / "meshes" / "ct-test.js").read_text()
    doc = json.loads(re.search(r'\] = (\{.*\});\s*$', js, re.S).group(1))
    assert doc["unit"] == "cm" and doc["offset"] == [0, 0, 0]
    left = doc["parts"]["left"]
    p = np.frombuffer(base64.b64decode(left["p"]), np.float32).reshape(-1, 3)
    i = np.frombuffer(base64.b64decode(left["i"]), np.uint16).reshape(-1, 3)
    assert 0 < len(i) <= 400 and i.max() < len(p)
    assert left["bbox"][0] > 2.5 and doc["parts"]["front"]["bbox"][2] > 2.5
    assert ct_to_obj.signed_volume(p.astype(np.float64), i.astype(np.int64)) > 0
