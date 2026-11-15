#!/usr/bin/env python3
"""Build a cranial-cavity "endocast" surface from the Z-Anatomy skull bones.

The neuro scenes need the shape of the inside of the skull (the envelope the brain and meninges
fill) without using Z-Anatomy's brain cortex objects (Brainder parcellation, licence unclear).
This voxelises the cranial bones, seals small foramina by dilation, flood-fills the cavity from a
seed in the middle of the cranium (closed below by a plane through the foramen magnum), restores
the dilation, and writes the voxel boundary as an OBJ in Z-Anatomy's Blender frame (metres,
+X left, -Y anterior, +Z up) so tools/meshes/bake.py can smooth and decimate it.

  .venv/bin/python tools/meshes/make_endocast.py \
    --src <cache>/zanatomy-neuro/obj --out <cache>/zanatomy-neuro/derived/Endocast.obj
"""
import argparse
import os

import numpy as np

BONES = ["Frontal_bone.obj", "Parietal_bone.l.obj", "Parietal_bone.r.obj", "Temporal_bone.l.obj",
         "Temporal_bone.r.obj", "Occipital_bone.obj", "Sphenoid_bone.obj", "Ethmoid_bone.obj"]


def load(path):
    vs, fs = [], []
    with open(path) as f:
        for line in f:
            if line.startswith("v "):
                vs.append([float(t) for t in line.split()[1:4]])
            elif line.startswith("f "):
                idx = [int(t.split("/")[0]) - 1 for t in line.split()[1:]]
                for k in range(1, len(idx) - 1):
                    fs.append((idx[0], idx[k], idx[k + 1]))
    v = np.array(vs)
    return np.stack([v[:, 0] * 100, v[:, 2] * 100, -v[:, 1] * 100], 1), np.array(fs)  # cm, sagittal frame


def shift_or(m):
    o = m.copy()
    o[1:] |= m[:-1]; o[:-1] |= m[1:]
    o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]
    o[:, :, 1:] |= m[:, :, :-1]; o[:, :, :-1] |= m[:, :, 1:]
    return o


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--h", type=float, default=0.2, help="voxel size, cm")
    ap.add_argument("--seal", type=int, default=3, help="dilation (voxels) that seals foramina")
    ap.add_argument("--floor", type=float, default=156.2, help="y (cm) of the plane closing the foramen magnum")
    a = ap.parse_args()
    h = a.h
    pts = []
    for b in BONES:
        v, f = load(os.path.join(a.src, b))
        A, B, C = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
        L = np.max([np.linalg.norm(B - A, axis=1), np.linalg.norm(C - A, axis=1), np.linalg.norm(C - B, axis=1)], 0)
        n = np.maximum(1, np.ceil(L / (h * 0.4)).astype(int))
        for k in np.unique(n):
            sel = n == k
            for i in range(k + 1):
                for j in range(k + 1 - i):
                    u, w = i / k, j / k
                    pts.append(A[sel] + u * (B[sel] - A[sel]) + w * (C[sel] - A[sel]))
    P = np.concatenate(pts)
    lo = P.min(0) - 1.0
    dims = np.ceil((P.max(0) + 1.0 - lo) / h).astype(int) + 1
    bone = np.zeros(dims, bool)
    ijk = np.floor((P - lo) / h).astype(int)
    bone[ijk[:, 0], ijk[:, 1], ijk[:, 2]] = True
    ys = lo[1] + (np.arange(dims[1]) + 0.5) * h
    wall = bone.copy()
    for _ in range(a.seal):
        wall = shift_or(wall)
    wall[:, ys < a.floor, :] = True  # closes the foramen magnum (and everything below it)
    free = ~wall
    seed = np.floor((np.array([0.0, 165.0, 0.0]) - lo) / h).astype(int)
    cav = np.zeros(dims, bool)
    cav[tuple(seed)] = True
    it = 0
    while True:
        nxt = shift_or(cav) & free
        it += 1
        if nxt.sum() == cav.sum():
            break
        cav = nxt
    border = cav[0].any() or cav[-1].any() or cav[:, 0].any() or cav[:, -1].any() or cav[:, :, 0].any() or cav[:, :, -1].any()
    print("flood iterations", it, "cavity voxels", int(cav.sum()), "leak to border:", bool(border))
    if border:
        raise SystemExit("cavity leaks: raise --seal or the --floor plane")
    for _ in range(a.seal + 1):  # restore the sealing dilation, without growing into bone or below the floor
        cav = shift_or(cav) & ~bone
        cav[:, ys < a.floor, :] = False
    # Boundary faces of the voxel set, as quads.
    verts, vid, faces = [], {}, []

    def V(i, j, k):
        key = (i, j, k)
        if key not in vid:
            vid[key] = len(verts)
            verts.append(lo + np.array([i, j, k]) * h)
        return vid[key]
    pad = np.pad(cav, 1)
    for ax in range(3):
        for sgn in (1, -1):
            nb = np.roll(pad, -sgn, axis=ax)
            face = pad & ~nb
            I = np.argwhere(face[1:-1, 1:-1, 1:-1])
            for (i, j, k) in I:
                c = [i, j, k]
                if sgn == 1:
                    c[ax] += 1
                o = [ax, (ax + 1) % 3, (ax + 2) % 3]
                q = []
                for (du, dv) in ((0, 0), (1, 0), (1, 1), (0, 1)):
                    p = list(c)
                    p[o[1]] += du
                    p[o[2]] += dv
                    q.append(V(*p))
                if sgn == -1:
                    q = q[::-1]
                faces.append((q[0], q[1], q[2]))
                faces.append((q[0], q[2], q[3]))
    verts = np.array(verts)
    # Light Laplacian relaxation of the voxel staircase (bake.py adds Taubin smoothing).
    f = np.array(faces)
    for _ in range(12):
        acc = np.zeros_like(verts)
        cnt = np.zeros(len(verts))
        for e in ((0, 1), (1, 2), (2, 0)):
            np.add.at(acc, f[:, e[0]], verts[f[:, e[1]]])
            np.add.at(cnt, f[:, e[0]], 1)
        verts = 0.5 * verts + 0.5 * acc / cnt[:, None]
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w") as fo:
        fo.write("# cranial cavity endocast from Z-Anatomy skull bones (sagittal tools/meshes/make_endocast.py)\n")
        for x, y, z in verts:
            fo.write("v %.6f %.6f %.6f\n" % (x / 100, -z / 100, y / 100))
        for t in f:
            fo.write("f %d %d %d\n" % (t[0] + 1, t[1] + 1, t[2] + 1))
    print("wrote", a.out, len(verts), "verts", len(f), "tris")


if __name__ == "__main__":
    main()
