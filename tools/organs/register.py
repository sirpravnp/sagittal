#!/usr/bin/env python3
"""Register non-Z-Anatomy organ sources into the organ library's shared body frame.

The body frame is Z-Anatomy's world frame converted to sagittal's axes: cm, +x patient left,
+y superior, +z anterior (Blender x, z, -y times 100). Z-Anatomy organs need no registration.
Other sources are mapped by a similarity transform (scale, rotation, translation) fitted on
structures both sources contain, and written as OBJs already in the body frame, so bake.py
only needs the identity transform:

  heart   Rodero et al. average heart -> Z-Anatomy heart: Umeyama fit on 6 paired points
          (4 chamber centroids, aortic and pulmonary valve centres)
  abdomen TotalSegmentator s1304 vertebrae T10-L4 -> Z-Anatomy T10-L4: centroid fit then
          similarity ICP on the vertebra surfaces; then each kidney is translated so its hilum
          opening meets the hilar ends of Z-Anatomy's renal artery, renal vein and ureter (kidneys)
  neck    TotalSegmentator s1304 vertebrae C3-T3 -> Z-Anatomy C3-T3: same method (thyroid)
  brain   TotalSegmentator s1304 brain -> Z-Anatomy cranial-cavity endocast: similarity ICP

  .venv/bin/python tools/organs/register.py [--assets CACHE]

Writes CACHE/organs-registered/<group>/*.obj and tools/organs/registration.json (transforms and
residuals, cm). Needs numpy, scipy, nibabel (tools/requirements.txt).
"""
import argparse
import json
import os
import sys

import numpy as np
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, "tools", "meshes"))
import bake  # noqa: E402

VERT_ABDOMEN = ["T10", "T11", "T12", "L1", "L2", "L3", "L4"]
VERT_NECK = ["C3", "C4", "C5", "C6", "C7", "T1", "T2", "T3"]


def read_obj(path):
    return bake.read_obj(path)


def write_obj(path, v, f, header):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        for line in header:
            fh.write("# %s\n" % line)
        np.savetxt(fh, v, fmt="v %.5f %.5f %.5f")
        np.savetxt(fh, f + 1, fmt="f %d %d %d")


def zframe(v):
    """Blender world (m) -> body frame (cm)."""
    return np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1) * 100.0


def umeyama(src, dst, with_scale=True):
    ms, md = src.mean(0), dst.mean(0)
    A, B = src - ms, dst - md
    U, S, Vt = np.linalg.svd(B.T @ A)
    D = np.eye(3)
    D[2, 2] = np.sign(np.linalg.det(U @ Vt))
    R = U @ D @ Vt
    s = (S * np.diag(D)).sum() / (A ** 2).sum() if with_scale else 1.0
    t = md - s * R @ ms
    return s, R, t


def apply(T, p):
    s, R, t = T
    return (s * (R @ np.atleast_2d(p).T)).T + t


def compose(T2, T1):
    """T2 after T1."""
    s1, R1, t1 = T1
    s2, R2, t2 = T2
    return s2 * s1, R2 @ R1, s2 * (R2 @ t1) + t2


def icp(src, dst, T0, iters=60, trim=0.9):
    """Similarity ICP of point set src onto dst (nearest neighbours, trimmed)."""
    tree = cKDTree(dst)
    T = T0
    for _ in range(iters):
        p = apply(T, src)
        d, j = tree.query(p)
        keep = d <= np.quantile(d, trim)
        dT = umeyama(p[keep], dst[j[keep]])
        T = compose(dT, T)
        if abs(dT[0] - 1) < 1e-5 and np.linalg.norm(dT[2]) < 1e-4:
            break
    d, _ = tree.query(apply(T, src))
    return T, float(np.sqrt((d ** 2).mean())), float(np.median(d))


def surface_sample(v, f, n=20000, seed=0):
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    area = np.linalg.norm(np.cross(b - a, c - a), axis=1) / 2
    rng = np.random.default_rng(seed)
    k = rng.choice(len(f), n, p=area / area.sum())
    r1, r2 = rng.random(n), rng.random(n)
    s = np.sqrt(r1)
    return (1 - s)[:, None] * a[k] + (s * (1 - r2))[:, None] * b[k] + (s * r2)[:, None] * c[k]


def mask_centroid_cm(path):
    """Centroid (body frame cm) of the largest connected component of a binary NIfTI mask."""
    import nibabel as nib
    from scipy import ndimage
    img = nib.load(path)
    m = np.asanyarray(img.dataobj) > 0
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        m = lab == (1 + int(np.argmax(sizes)))
    ijk = np.argwhere(m).mean(0)
    ras = img.affine[:3, :3] @ ijk + img.affine[:3, 3]
    return np.array([-ras[0], ras[2], ras[1]]) / 10.0


def mesh_centroid(v, f):
    """Volume centroid of a closed triangle mesh (falls back to area centroid)."""
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    vol = np.einsum("ij,ij->i", a, np.cross(b, c)) / 6.0
    V = vol.sum()
    if abs(V) > 1e-6:
        return ((a + b + c) / 4.0 * vol[:, None]).sum(0) / V
    area = np.linalg.norm(np.cross(b - a, c - a), axis=1)
    return ((a + b + c) / 3.0 * area[:, None]).sum(0) / area.sum()


def largest_component(v, f):
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    e = np.concatenate([f[:, [0, 1]], f[:, [1, 2]]])
    g = coo_matrix((np.ones(len(e)), (e[:, 0], e[:, 1])), shape=(len(v), len(v)))
    n, lab = connected_components(g, directed=False)
    if n == 1:
        return v, f
    big = np.argmax(np.bincount(lab[f[:, 0]]))
    keep = lab[f[:, 0]] == big
    return bake.compact(v, f[keep])


def vertebra_fit(assets, levels):
    zo = os.path.join(assets, "zanatomy-organs", "obj")
    to = os.path.join(assets, "ct-totalseg", "obj")
    seg = os.path.join(assets, "ct-totalseg", "raw", "s1304", "segmentations")
    zc, tc, zs, ts, names = [], [], [], [], []
    for lv in levels:
        zv, zf = read_obj(os.path.join(zo, "Vertebra_%s.obj" % lv))
        zv = zframe(zv)
        tv, tf = largest_component(*read_obj(os.path.join(to, "vertebrae_%s.obj" % lv)))
        zc.append(mesh_centroid(zv, zf))
        tc.append(mask_centroid_cm(os.path.join(seg, "vertebrae_%s.nii.gz" % lv)))
        zs.append(surface_sample(zv, zf, 3000, seed=len(zs)))
        ts.append(surface_sample(tv, tf, 3000, seed=100 + len(ts)))
        names.append(lv)
    zc, tc = np.array(zc), np.array(tc)
    # start: scale + translation from the centroids, no rotation (both scans are in patient axes)
    s0 = np.sqrt(((zc - zc.mean(0)) ** 2).sum() / ((tc - tc.mean(0)) ** 2).sum())
    T0 = (s0, np.eye(3), zc.mean(0) - s0 * tc.mean(0))
    T, rms, med = icp(np.vstack(ts), np.vstack(zs), T0)
    res = np.linalg.norm(apply(T, tc) - zc, axis=1)
    return T, {"levels": names, "icp_rms_cm": round(rms, 3), "icp_median_cm": round(med, 3),
               "centroid_residual_cm": {n: round(float(r), 2) for n, r in zip(names, res)},
               "centroid_residual_rms_cm": round(float(np.sqrt((res ** 2).mean())), 2)}


def hilum_lid(v):
    """Area centroid of the convex-hull facets that bridge the renal sinus (facet centre > 4 mm from
    the kidney surface): the opening of the hilum."""
    from scipy.spatial import ConvexHull
    h = ConvexHull(v)
    tri = v[h.simplices]
    fc = tri.mean(1)
    area = np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1) / 2
    lid = cKDTree(v).query(fc)[0] > 0.4
    return (fc[lid] * area[lid, None]).sum(0) / area[lid].sum(), int(lid.sum())


def kidney_hilum_shift(assets, part, v):
    """Translate a vertebra-registered CT kidney so its hilum opening sits at the mean of the hilar ends
    of Z-Anatomy's renal artery, renal vein and ureter (the vessels the kidney must connect to)."""
    curves = json.load(open(os.path.join(assets, "zanatomy-organs", "all_curves.json")))
    side, L = ("l", "Left") if part.endswith("left") else ("r", "Right")

    def ends(name):
        p = np.array(curves[name]["splines"][0]["points"])
        return p[0], p[-1]

    def far_end(name):  # the end farther from the midline
        a, b = ends(name)
        return a if abs(a[0]) > abs(b[0]) else b

    ra, rv = far_end(L + " renal artery"), far_end(L + " renal vein")
    ua, ub = ends("Ureter." + side)
    ur = ua if ua[1] > ub[1] else ub  # upper end
    target = np.mean([ra, rv, ur], 0)
    hil, nlid = hilum_lid(v)
    shift = target - hil
    v2 = v + shift
    t = cKDTree(v2)
    rep = {"hilum_before_cm": np.round(hil, 2).tolist(), "target_cm": np.round(target, 2).tolist(),
           "translation_cm": np.round(shift, 2).tolist(), "translation_length_cm": round(float(np.linalg.norm(shift)), 2),
           "lid_facets": nlid,
           "distance_to_kidney_surface_cm": {"renal_artery_end": round(float(t.query(ra)[0]), 2),
                                             "renal_vein_end": round(float(t.query(rv)[0]), 2),
                                             "ureter_upper_end": round(float(t.query(ur)[0]), 2)}}
    return v2, rep


def tdict(T):
    s, R, t = T
    ang = np.degrees(np.arccos(np.clip((np.trace(R) - 1) / 2, -1, 1)))
    return {"scale": round(float(s), 4), "rotation": np.round(R, 5).tolist(), "translation_cm": np.round(t, 3).tolist(),
            "rotation_angle_deg": round(float(ang), 2)}


def register_ct(assets, out, report):
    to = os.path.join(assets, "ct-totalseg", "obj")
    groups = {"abdomen": (VERT_ABDOMEN, ["kidney_left", "kidney_right"]),
              "neck": (VERT_NECK, ["thyroid_gland"])}
    for g, (levels, parts) in groups.items():
        T, rep = vertebra_fit(assets, levels)
        rep["transform"] = tdict(T)
        rep["source"] = "TotalSegmentator CT dataset v2.0.1 subject s1304 (doi:10.5281/zenodo.10047292)"
        rep["parts"] = parts
        for p in parts:
            v, f = largest_component(*read_obj(os.path.join(to, p + ".obj")))
            v = apply(T, v)
            note = []
            if p.startswith("kidney_"):
                v, kr = kidney_hilum_shift(assets, p, v)
                rep.setdefault("kidney_hilum_translation", {})[p] = kr
                note = ["then translated so its hilum (convex-hull lid over the renal sinus) meets the ends of",
                        "Z-Anatomy's renal artery, renal vein and ureter (see registration.json)"]
            write_obj(os.path.join(out, "totalseg", p + ".obj"), v, f,
                      ["TotalSegmentator s1304 %s, registered to the sagittal organ body frame (cm)" % p,
                       "similarity fit '%s' on vertebrae %s, see tools/organs/registration.json" % (g, ",".join(levels))] + note)
        report["totalseg_" + g] = rep
        print(g, json.dumps({k: rep[k] for k in ("icp_rms_cm", "centroid_residual_rms_cm")}), "scale %.3f rot %.1f deg" % (T[0], rep["transform"]["rotation_angle_deg"]))
    # brain onto the Z-Anatomy cranial-cavity endocast
    ev, ef = read_obj(os.path.join(assets, "zanatomy-neuro", "derived", "Endocast.obj"))
    ev = zframe(ev)
    bv, bf = largest_component(*read_obj(os.path.join(to, "brain.obj")))
    src, dst = surface_sample(bv, bf, 20000, 1), surface_sample(ev, ef, 20000, 2)
    s0 = np.sqrt(((dst - dst.mean(0)) ** 2).sum() / ((src - src.mean(0)) ** 2).sum())
    T0 = (s0, np.eye(3), dst.mean(0) - s0 * src.mean(0))
    T, rms, med = icp(src, dst, T0, iters=100, trim=0.85)
    # signed check: how far brain points lie outside / inside the endocast surface
    d_out, _ = cKDTree(dst).query(apply(T, src))
    rep = {"transform": tdict(T), "icp_rms_cm": round(rms, 3), "icp_median_cm": round(med, 3),
           "p95_surface_distance_cm": round(float(np.quantile(d_out, 0.95)), 3),
           "source": "TotalSegmentator s1304 brain mask; target: Z-Anatomy endocast (zanatomy-neuro/derived/Endocast.obj)",
           "parts": ["brain"]}
    write_obj(os.path.join(out, "totalseg", "brain.obj"), apply(T, bv), bf,
              ["TotalSegmentator s1304 brain, registered by similarity ICP onto the Z-Anatomy cranial-cavity endocast"])
    report["totalseg_brain"] = rep
    print("brain", rep["icp_rms_cm"], rep["p95_surface_distance_cm"], "scale %.3f" % T[0])


def register_heart(assets, out, report):
    zo = os.path.join(assets, "zanatomy-organs", "obj")
    rw = os.path.join(assets, "rodero", "work")

    def rframe(v):  # Rodero LPS mm -> sagittal axes cm (no centring)
        return np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1) * 0.1

    d = np.load(os.path.join(rw, "average.npz"))
    P, Tt, tag = d["pts"].astype(np.float64), d["tets"], d["tag"]

    def rl(k):
        return rframe(P[Tt[tag == k]].reshape(-1, 3)).mean(0)

    def rc(n):
        return rframe(read_obj(os.path.join(rw, "parts", n + ".obj"))[0]).mean(0)

    def zc(n):
        return zframe(read_obj(os.path.join(zo, n + ".obj"))[0]).mean(0)

    src, dst, names = [], [], []
    for zn, rn in (("Left_ventricle", "cav_lv"), ("Right_ventricle", "cav_rv"), ("Left_atrium", "cav_la"), ("Right_atrium", "cav_ra")):
        src.append(rc(rn)); dst.append(zc(zn)); names.append(zn.lower() + "_centroid")
    # aortic valve: Z-Anatomy ascending aorta start (lowest end of its centre line); pulmonary valve:
    # the lowest 0.6 cm of the Z-Anatomy pulmonary trunk mesh
    curves = json.load(open(os.path.join(assets, "zanatomy-organs", "all_curves.json")))
    aa = np.array(curves["Ascending aorta"]["splines"][0]["points"])
    src.append(rl(9)); dst.append(aa[0] if aa[0][1] < aa[-1][1] else aa[-1]); names.append("aortic_valve")
    pt = zframe(read_obj(os.path.join(assets, "zanatomy", "obj", "Pulmonary_trunk.obj"))[0])
    src.append(rl(10)); dst.append(pt[pt[:, 1] < pt[:, 1].min() + 0.6].mean(0)); names.append("pulmonary_valve")
    src, dst = np.array(src), np.array(dst)
    T = umeyama(src, dst)
    res = np.linalg.norm(apply(T, src) - dst, axis=1)
    rep = {"transform": tdict(T), "pairs": names,
           "residual_cm": {n: round(float(r), 2) for n, r in zip(names, res)},
           "residual_rms_cm": round(float(np.sqrt((res ** 2).mean())), 2),
           "source": "Rodero et al. 2021 average heart (doi:10.5281/zenodo.4593739), rodero/work/parts",
           "target": "Z-Anatomy heart chambers (centroids of the cage vertices), ascending aorta start, pulmonary trunk base"}
    for n in ("wall_lv", "wall_rv", "wall_la", "wall_ra", "aorta"):
        v, f = read_obj(os.path.join(rw, "parts", n + ".obj"))
        write_obj(os.path.join(out, "heart", n + ".obj"), apply(T, rframe(v)), f,
                  ["Rodero average heart %s, registered to the sagittal organ body frame (cm)" % n])
    # valve centres for landmarks (body frame)
    rep["valve_centres_cm"] = {k: np.round(apply(T, rl(t))[0], 2).tolist()
                               for k, t in (("mitral", 7), ("tricuspid", 8), ("aortic", 9), ("pulmonary", 10))}
    report["rodero_heart"] = rep
    print("heart residuals", rep["residual_cm"], "scale %.3f" % T[0])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--assets", default=bake.DEFAULT_ASSETS)
    a = ap.parse_args(argv)
    out = os.path.join(a.assets, "organs-registered")
    report = {"frame": "cm, +x patient left, +y superior, +z anterior; Z-Anatomy world frame (Blender x, z, -y x 100)"}
    register_heart(a.assets, out, report)
    register_ct(a.assets, out, report)
    json.dump(report, open(os.path.join(HERE, "registration.json"), "w"), indent=1)
    print("wrote", os.path.join(HERE, "registration.json"))


if __name__ == "__main__":
    main()
