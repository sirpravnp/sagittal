#!/usr/bin/env python3
"""Turn a CT segmentation (NIfTI label volume or binary masks) into OBJ surfaces in sagittal's frame.

  # one multi-label volume (e.g. TotalSegmentator --ml output): pick label ids per part
  .venv/bin/python tools/meshes/ct_to_obj.py --volume seg.nii.gz \\
      --part liver=5 --part kidneys=2,3 --out CACHE/ct-<source>/obj

  # per-structure binary masks (e.g. the TotalSegmentator dataset's segmentations/<class>.nii.gz)
  .venv/bin/python tools/meshes/ct_to_obj.py \\
      --mask femur_left=s0011/segmentations/femur_left.nii.gz --out CACHE/ct-<source>/obj

  # inspect a volume first: orientation, voxel size, label ids and voxel counts
  .venv/bin/python tools/meshes/ct_to_obj.py --volume seg.nii.gz --list

Per part: select voxels -> drop specks (connected components under --min-voxels) -> Gaussian blur of
the binary mask (--sigma-mm, removes the voxel staircase) -> marching cubes at 0.5 -> Taubin smoothing
-> pre-decimation (--max-tris) -> voxel indices through the NIfTI affine (RAS+, mm) -> sagittal frame.

Output OBJs are already in sagittal's frame: **cm, +x patient's left, +y superior, +z anterior**
(x = -R, y = S, z = A, divided by 10), so the bake config uses
  "transform": {"axes": ["x", "y", "z"], "scale": 1}
Triangles face outward. An index.tsv in --out lists every part (labels, voxels, tris, bbox in cm).
Final triangle budgets are set in the bake config (tools/meshes/bake.py), not here.
"""
import argparse
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bake  # noqa: E402  (shared taubin / decimate / compact)

# RAS+ (nibabel world space, mm) -> sagittal (cm): x = -R (patient left), y = S, z = A.
RAS_TO_SAGITTAL = np.array([[-1.0, 0, 0], [0, 0, 1.0], [0, 1.0, 0]]) * 0.1


def load_nifti(path):
    """(data ndarray, 4x4 affine voxel->RAS mm, voxel sizes mm)."""
    import nibabel as nib
    img = nib.load(path)
    data = np.asanyarray(img.dataobj)
    if data.ndim == 4 and data.shape[3] == 1:
        data = data[..., 0]
    if data.ndim != 3:
        raise SystemExit("%s: expected a 3D volume, got shape %s" % (path, data.shape))
    aff = np.asarray(img.affine, np.float64)
    return data, aff, np.sqrt((aff[:3, :3] ** 2).sum(0))


def orientation(aff):
    import nibabel as nib
    return "".join(nib.aff2axcodes(aff))


def parse_ids(spec):
    try:
        return [int(float(t)) for t in spec.split(",") if t.strip()]
    except ValueError:
        raise SystemExit("label ids must be integers, e.g. liver=5 or kidneys=2,3 (got %r)" % spec)


def keep_components(mask, min_voxels):
    """Drop connected components smaller than min_voxels (segmentation specks)."""
    if min_voxels <= 1:
        return mask
    from scipy import ndimage
    lab, n = ndimage.label(mask)
    if n <= 1:
        return mask
    sizes = np.bincount(lab.ravel())
    keep = sizes >= min_voxels
    keep[0] = False
    if not keep.any():  # never drop everything: keep the largest
        keep[np.argmax(sizes[1:]) + 1] = True
    return keep[lab]


def surface(mask, aff, vox, sigma_mm=1.0, smooth=10, max_tris=60000, step=1):
    """Binary mask -> (verts cm in sagittal frame, outward tris)."""
    from skimage import measure
    idx = np.argwhere(mask)
    lo = np.maximum(idx.min(0) - 3, 0)
    hi = idx.max(0) + 4
    sub = np.zeros(tuple(hi - lo), np.float32)  # padded so surfaces close at the volume edge
    crop = mask[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]]
    sub[:crop.shape[0], :crop.shape[1], :crop.shape[2]] = crop
    sub = np.pad(sub, 1)
    lo = lo - 1
    if sigma_mm > 0:
        from scipy import ndimage
        sub = ndimage.gaussian_filter(sub, sigma=[sigma_mm / max(v, 1e-6) for v in vox])
    if sub.max() <= 0.5:
        raise SystemExit("structure vanished after smoothing (too thin for --sigma-mm %.2g); lower it" % sigma_mm)
    v, f, _, _ = measure.marching_cubes(sub, level=0.5, step_size=step, allow_degenerate=False)
    v = v.astype(np.float64) + lo  # back to full-volume voxel indices
    f = f.astype(np.int64)
    # In voxel-index space skimage's triangles wind inward for a bright object (checked by
    # tests/python/test_ct_to_obj.py), so reverse them; a left-handed affine (e.g. LAS storage)
    # mirrors space, which reverses them once more.
    world = v @ aff[:3, :3].T + aff[:3, 3]
    if np.linalg.det(aff[:3, :3]) > 0:
        f = f[:, ::-1]
    out = world @ RAS_TO_SAGITTAL.T  # proper rotation (det +1): winding preserved
    if smooth:
        out = bake.taubin(out, f, int(smooth))
    out, f = bake.decimate(out, f, int(max_tris), "auto")
    out, f = bake.compact(out, f)
    return out, f


def signed_volume(v, f):
    """Enclosed volume (positive when triangles face outward)."""
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    return float(np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6.0)


def write_obj(path, name, src, labels, v, f, note):
    with open(path, "w") as fh:
        fh.write("# sagittal ct_to_obj: %s\n# source: %s\n# labels: %s\n%s" % (name, src, labels, note))
        fh.write("# frame: sagittal, cm, +x patient left, +y superior, +z anterior "
                 "(bake with \"transform\": {\"axes\": [\"x\",\"y\",\"z\"], \"scale\": 1})\n")
        fh.write("o %s\n" % name)
        np.savetxt(fh, v, fmt="v %.4f %.4f %.4f")
        np.savetxt(fh, f + 1, fmt="f %d %d %d")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--volume", help="multi-label NIfTI (.nii / .nii.gz) used by --part")
    ap.add_argument("--part", action="append", default=[], metavar="NAME=ID[,ID...]",
                    help="part from label ids of --volume (repeatable); ids are merged")
    ap.add_argument("--mask", action="append", default=[], metavar="NAME=FILE",
                    help="part from a binary mask NIfTI, any non-zero voxel (repeatable)")
    ap.add_argument("--out", help="output directory for <name>.obj and index.tsv")
    ap.add_argument("--list", action="store_true", help="print orientation, voxel size and label counts of --volume")
    ap.add_argument("--sigma-mm", type=float, default=1.0, help="Gaussian blur of each mask before meshing (0 = off)")
    ap.add_argument("--smooth", type=int, default=10, help="Taubin smoothing iterations after meshing")
    ap.add_argument("--min-voxels", type=int, default=64, help="drop connected components smaller than this")
    ap.add_argument("--max-tris", type=int, default=60000, help="pre-decimation cap per part (bake sets the real budget)")
    ap.add_argument("--step", type=int, default=1, help="marching-cubes step in voxels (2 = faster, coarser)")
    a = ap.parse_args(argv)

    vol = None
    if a.volume:
        vol = load_nifti(a.volume)
    if a.list:
        if vol is None:
            raise SystemExit("--list needs --volume")
        data, aff, vox = vol
        ids, counts = np.unique(data, return_counts=True)
        print("%s: shape %s, orientation %s, voxel %s mm" % (a.volume, data.shape, orientation(aff),
                                                             " x ".join("%.3g" % x for x in vox)))
        for i, c in zip(ids, counts):
            if i != 0:
                print("  label %-5s %10d voxels  %.1f cm^3" % (i, c, c * float(np.prod(vox)) / 1000))
        if not a.part and not a.mask:
            return 0
    jobs = []
    for spec in a.part:
        if vol is None:
            raise SystemExit("--part needs --volume")
        name, _, ids = spec.partition("=")
        jobs.append((name, a.volume, parse_ids(ids), vol))
    for spec in a.mask:
        name, _, path = spec.partition("=")
        jobs.append((name, path, None, load_nifti(path)))
    if not jobs:
        raise SystemExit("nothing to do: give --part NAME=IDS (with --volume) or --mask NAME=FILE")
    if not a.out:
        raise SystemExit("--out is required")
    os.makedirs(a.out, exist_ok=True)

    rows = []
    for name, src, ids, (data, aff, vox) in jobs:
        if not name or not all(c.isalnum() or c in "_-" for c in name):
            raise SystemExit("part name must be [A-Za-z0-9_-]+: %r" % name)
        mask = np.isin(data, ids) if ids is not None else data != 0
        if not mask.any():
            raise SystemExit("%s: no voxels with label %s in %s (see --list)" % (name, ids if ids is not None else "!=0", src))
        mask = keep_components(mask, a.min_voxels)
        v, f = surface(mask, aff, vox, a.sigma_mm, a.smooth, a.max_tris, a.step)
        labels = ",".join(map(str, ids)) if ids is not None else "mask!=0"
        note = "# input: orientation %s, voxel %s mm, %d voxels; sigma %.3g mm, smooth %d\n" % (
            orientation(aff), "x".join("%.3g" % x for x in vox), int(mask.sum()), a.sigma_mm, a.smooth)
        write_obj(os.path.join(a.out, name + ".obj"), name, src, labels, v, f, note)
        lo, hi = v.min(0), v.max(0)
        rows.append([name, name + ".obj", src, labels, str(int(mask.sum())), str(len(v)), str(len(f)),
                     " ".join("%.2f" % x for x in lo), " ".join("%.2f" % x for x in hi)])
        print("%-20s labels %-10s %8d voxels -> %6d tris  bbox cm [%s] .. [%s]  vol %.1f cm^3" % (
            name, labels, mask.sum(), len(f), rows[-1][7], rows[-1][8], signed_volume(v, f)))

    idx_path = os.path.join(a.out, "index.tsv")
    old = {}
    if os.path.exists(idx_path):
        for line in open(idx_path).read().splitlines()[1:]:
            old[line.split("\t")[0]] = line
    for r in rows:
        old[r[0]] = "\t".join(r)
    with open(idx_path, "w") as fh:
        fh.write("name\tfile\tsource\tlabels\tvoxels\tverts\ttris\tbbox_min_cm\tbbox_max_cm\n")
        for k in sorted(old):
            fh.write(old[k] + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
