#!/usr/bin/env python3
"""Minimal pure-Python reader for uncompressed .blend files (Blender 2.8 - 3.x).

Only what sagittal needs: list mesh objects and pull their world-space triangles.
No Blender install required. Used by extract_blend.py to turn Z-Anatomy's
Startup.blend into per-object OBJ files that bake.py can read.

Supported mesh layouts:
  * vertex positions: legacy MVert (co[3]) or the 3.5+ "position" float3 attribute
  * faces: legacy MPoly/MLoop, or 3.6+ poly_offset_indices + ".corner_vert"
Not supported: zstd/gzip-compressed .blend files (decompress first), big-endian files.
"""
import re
import struct

import numpy as np


class BlendError(Exception):
    pass


class Struct:
    def __init__(self, name, fields, size):
        self.name = name
        self.fields = fields  # name(clean) -> (offset, type_name, raw_name, size)
        self.size = size


class Block:
    __slots__ = ("code", "size", "addr", "sdna", "count", "off", "idx")

    def __init__(self, code, size, addr, sdna, count, off, idx):
        self.code, self.size, self.addr, self.sdna, self.count, self.off = code, size, addr, sdna, count, off
        self.idx = idx


class BlendFile:
    def __init__(self, path):
        with open(path, "rb") as f:
            self.buf = f.read()
        b = self.buf
        if b[:7] != b"BLENDER":
            if b[:4] == b"\x28\xb5\x2f\xfd":
                raise BlendError("zstd-compressed .blend: decompress first (pip zstandard)")
            raise BlendError("not a .blend file")
        self.psize = 8 if b[7:8] == b"-" else 4
        if b[8:9] != b"v":
            raise BlendError("big-endian .blend not supported")
        self.version = int(b[9:12])
        self.blocks = []
        self.by_addr = {}
        self.id_by_addr = {}  # ID blocks (OB, ME, CU, ...) only
        off = 12
        hdr = struct.Struct("<4siQii" if self.psize == 8 else "<4siIii")
        while off < len(b):
            code, size, addr, sdna, count = hdr.unpack_from(b, off)
            off += hdr.size
            blk = Block(code.rstrip(b"\0"), size, addr, sdna, count, off, len(self.blocks))
            off += size
            if blk.code == b"ENDB":
                break
            self.blocks.append(blk)
            # Old pointers are not unique across a whole 3.x file, so keep the first one globally
            # and resolve an ID's own data through local() (its DATA blocks follow it in the file).
            if addr and addr not in self.by_addr:
                self.by_addr[addr] = blk
            if addr and blk.code != b"DATA" and len(blk.code) == 2:
                self.id_by_addr.setdefault(addr, blk)
            if blk.code == b"DNA1":
                self._parse_dna(blk)

    # ---------- SDNA ----------
    def _parse_dna(self, blk):
        b, o = self.buf, blk.off
        assert b[o:o + 8] == b"SDNANAME"
        o += 8

        def strings(o, n):
            out = []
            for _ in range(n):
                e = b.index(b"\0", o)
                out.append(b[o:e].decode("latin-1"))
                o = e + 1
            return out, o

        start = blk.off

        def align(o):  # 4-byte alignment relative to the DNA block start
            return start + (((o - start) + 3) & ~3)

        n = struct.unpack_from("<i", b, o)[0]; o += 4
        names, o = strings(o, n); o = align(o)
        assert b[o:o + 4] == b"TYPE"; o += 4
        n = struct.unpack_from("<i", b, o)[0]; o += 4
        types, o = strings(o, n); o = align(o)
        assert b[o:o + 4] == b"TLEN"; o += 4
        tlen = list(struct.unpack_from("<%dh" % n, b, o)); o += 2 * n; o = align(o)
        assert b[o:o + 4] == b"STRC"; o += 4
        n = struct.unpack_from("<i", b, o)[0]; o += 4
        self.structs = []
        self.struct_by_name = {}
        for _ in range(n):
            ti, nf = struct.unpack_from("<hh", b, o); o += 4
            fields = {}
            fo = 0
            for _ in range(nf):
                ft, fn = struct.unpack_from("<hh", b, o); o += 4
                raw = names[fn]
                sz = self._field_size(raw, tlen[ft])
                clean = re.sub(r"\[.*", "", raw).lstrip("*").replace("(", "").replace(")", "")
                fields[clean] = (fo, types[ft], raw, sz)
                fo += sz
            s = Struct(types[ti], fields, tlen[ti])
            self.structs.append(s)
            self.struct_by_name[s.name] = s

    def _field_size(self, raw, tsize):
        mult = 1
        for m in re.findall(r"\[(\d+)\]", raw):
            mult *= int(m)
        if raw.startswith("*") or raw.startswith("(*"):
            return self.psize * mult
        return tsize * mult

    # ---------- field access ----------
    def get(self, sname, base, field):
        s = self.struct_by_name[sname]
        fo, ftype, raw, sz = s.fields[field]
        o = base + fo
        b = self.buf
        if raw.startswith("*"):
            return struct.unpack_from("<Q" if self.psize == 8 else "<I", b, o)[0]
        if ftype == "char" and "[" in raw:
            return b[o:o + sz].split(b"\0", 1)[0].decode("utf-8", "replace")
        fmt = {"int": "i", "short": "h", "char": "b", "float": "f", "uint": "I", "ushort": "H", "uchar": "B",
               "int64_t": "q", "uint64_t": "Q", "double": "d", "int8_t": "b"}.get(ftype)
        if fmt is None:
            return o  # nested struct: return its absolute offset
        cnt = sz // struct.calcsize(fmt)
        vals = struct.unpack_from("<%d%s" % (cnt, fmt), b, o)
        return vals[0] if cnt == 1 else vals

    def has(self, sname, field):
        s = self.struct_by_name.get(sname)
        return s is not None and field in s.fields

    def local(self, owner, addr):
        """Resolves a pointer among the DATA blocks written right after `owner` (an ID block)."""
        if not addr:
            return None
        for k in range(owner.idx + 1, len(self.blocks)):
            blk = self.blocks[k]
            if blk.code != b"DATA":
                break
            if blk.addr == addr:
                return blk
        return self.by_addr.get(addr)

    def block_struct(self, blk):
        return self.structs[blk.sdna].name

    # ---------- objects ----------
    OB_MESH, OB_CURVE = 1, 2

    def objects(self, types=(1,)):
        """Yields (name, otype, data_block, world_matrix, object_block) for objects of the given types.

        world_matrix is 4x4 as stored (Blender column-major float[4][4] read row by row), so a
        point transforms as  p_world = p @ M[:3, :3] + M[3, :3].
        """
        mfield = "object_to_world" if self.has("Object", "object_to_world") else "obmat"
        for blk in self.blocks:
            if blk.code != b"OB":
                continue
            base = blk.off
            otype = self.get("Object", base, "type")
            if otype not in types:
                continue
            name = self.get("ID", self.get("Object", base, "id"), "name")[2:]
            data = self.id_by_addr.get(self.get("Object", base, "data"))
            if data is None or data.code not in (b"ME", b"CU"):
                continue
            m = np.array(self.get("Object", base, mfield), dtype=np.float64).reshape(4, 4)
            yield name, otype, data, m, blk

    def modifiers(self, ob_blk):
        """[(type, name)] of an object's modifier stack (1 = subsurf, 5 = mirror, 6 = decimate...)."""
        out = []
        first = self.get("ListBase", self.get("Object", ob_blk.off, "modifiers"), "first")
        seen = set()
        blk = self.local(ob_blk, first)
        while blk is not None and blk.addr not in seen:
            seen.add(blk.addr)
            out.append((self.get("ModifierData", blk.off, "type"), self.get("ModifierData", blk.off, "name")))
            blk = self.local(ob_blk, self.get("ModifierData", blk.off, "next"))
        return out

    # ---------- curves (Z-Anatomy draws vessels, ducts and nerves as bevelled curves) ----------
    def curve_polylines(self, cu_blk):
        """Returns (bevel_depth, [(points Nx3, radii N, cyclic)]) in curve-local space."""
        base = cu_blk.off
        depth = self.get("Curve", base, "ext2")
        cres = max(1, self.get("Curve", base, "resolu"))
        first = self.get("ListBase", self.get("Curve", base, "nurb"), "first")
        out, seen = [], set()
        nb = self.local(cu_blk, first)
        while nb is not None and nb.addr not in seen:
            seen.add(nb.addr)
            o = nb.off
            ntype = self.get("Nurb", o, "type")
            cyclic = bool(self.get("Nurb", o, "flagu") & 1)
            res = max(1, self.get("Nurb", o, "resolu") or cres)
            if ntype == 1:  # Bezier
                n = self.get("Nurb", o, "pntsu")
                bb = self.local(cu_blk, self.get("Nurb", o, "bezt"))
                if bb is not None and n > 0:
                    sz = self.struct_by_name["BezTriple"].size
                    raw = np.frombuffer(self.buf, np.uint8, n * sz, bb.off).reshape(n, sz)
                    vec = raw[:, 0:36].copy().view("<f4").reshape(n, 3, 3).astype(np.float64)
                    rad = raw[:, 44:48].copy().view("<f4").ravel().astype(np.float64)
                    out.append(self._bezier(vec, rad, res, cyclic) + (cyclic,))
            else:  # poly / NURBS: control polygon, smoothed by Catmull-Rom when NURBS
                n = self.get("Nurb", o, "pntsu") * max(1, self.get("Nurb", o, "pntsv"))
                bp = self.local(cu_blk, self.get("Nurb", o, "bp"))
                if bp is not None and n > 0:
                    sz = self.struct_by_name["BPoint"].size
                    raw = np.frombuffer(self.buf, np.uint8, n * sz, bp.off).reshape(n, sz)
                    pts = raw[:, 0:12].copy().view("<f4").reshape(n, 3).astype(np.float64)
                    rad = raw[:, 28:32].copy().view("<f4").ravel().astype(np.float64)
                    if ntype == 4 and n >= 3:
                        pts, rad = _catmull(pts, rad, res, cyclic)
                    out.append((pts, rad, cyclic))
            nb = self.local(cu_blk, self.get("Nurb", o, "next"))
        return depth, out

    @staticmethod
    def _bezier(vec, rad, res, cyclic):
        n = len(vec)
        segs = n if cyclic else n - 1
        if segs <= 0:
            return vec[:, 1], rad
        t = np.linspace(0, 1, res, endpoint=False)[:, None]
        pts, rr = [], []
        for i in range(segs):
            j = (i + 1) % n
            p0, p1, p2, p3 = vec[i, 1], vec[i, 2], vec[j, 0], vec[j, 1]
            b = ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3
            pts.append(b)
            rr.append(rad[i] + (rad[j] - rad[i]) * t[:, 0])
        if not cyclic:
            pts.append(vec[-1:, 1])
            rr.append(rad[-1:])
        return np.concatenate(pts), np.concatenate(rr)

    def _layers(self, owner, cd_off):
        """[(type, name, data_block)] of a CustomData struct at absolute offset cd_off inside `owner`."""
        lp = self.get("CustomData", cd_off, "layers")
        tot = self.get("CustomData", cd_off, "totlayer")
        if not lp or not tot:
            return []
        blk = self.local(owner, lp)
        lsize = self.struct_by_name["CustomDataLayer"].size
        out = []
        for k in range(tot):
            o = blk.off + k * lsize
            out.append((self.get("CustomDataLayer", o, "type"), self.get("CustomDataLayer", o, "name"),
                        self.local(owner, self.get("CustomDataLayer", o, "data"))))
        return out

    def _array(self, blk, dtype, width):
        if blk is None:
            return None
        a = np.frombuffer(self.buf, dtype=dtype, count=blk.size // np.dtype(dtype).itemsize, offset=blk.off)
        return a.reshape(-1, width) if width > 1 else a

    def mesh_triangles(self, me_blk):
        """Returns (positions float32 Nx3 in mesh-local space, triangles int64 Mx3)."""
        base = me_blk.off
        totvert = self.get("Mesh", base, "totvert")
        totpoly = self.get("Mesh", base, "totpoly") if self.has("Mesh", "totpoly") else self.get("Mesh", base, "faces_num")
        totloop = self.get("Mesh", base, "totloop") if self.has("Mesh", "totloop") else self.get("Mesh", base, "totloop")
        vdata = self._layers(me_blk, self.get("Mesh", base, "vdata"))
        pdata = self._layers(me_blk, self.get("Mesh", base, "pdata"))
        ldata = self._layers(me_blk, self.get("Mesh", base, "ldata"))

        pos = None
        for t, n, a in vdata:
            if n == "position":
                pos = self._array(a, "<f4", 3)
        if pos is None:
            for t, n, a in vdata:
                if t == 0:  # CD_MVERT
                    blk = a
                    sz = self.struct_by_name["MVert"].size
                    raw = np.frombuffer(self.buf, dtype=np.uint8, count=totvert * sz, offset=blk.off).reshape(totvert, sz)
                    pos = raw[:, 0:12].copy().view("<f4").reshape(totvert, 3)
        if pos is None:
            raise BlendError("no vertex positions")
        pos = pos[:totvert]

        corner = None
        for t, n, a in ldata:
            if n == ".corner_vert":
                corner = self._array(a, "<i4", 1)
        if corner is None:
            for t, n, a in ldata:
                if t == 26:  # CD_MLOOP {uint v, e}
                    corner = self._array(a, "<u4", 2)[:, 0].astype(np.int64)
        if corner is None:
            raise BlendError("no face corners")
        corner = np.asarray(corner[:totloop], dtype=np.int64)

        starts = counts = None
        for t, n, a in pdata:
            if t == 25:  # CD_MPOLY {int loopstart, totloop; short mat_nr; char flag, pad}
                blk = a
                sz = self.struct_by_name["MPoly"].size
                raw = np.frombuffer(self.buf, dtype=np.uint8, count=totpoly * sz, offset=blk.off).reshape(totpoly, sz)
                starts = raw[:, 0:4].copy().view("<i4").ravel().astype(np.int64)
                counts = raw[:, 4:8].copy().view("<i4").ravel().astype(np.int64)
        if starts is None and self.has("Mesh", "poly_offset_indices"):
            offs = self._array(self.local(me_blk, self.get("Mesh", base, "poly_offset_indices")), "<i4", 1)[:totpoly + 1].astype(np.int64)
            starts, counts = offs[:-1], np.diff(offs)
        if starts is None:
            raise BlendError("no polygons")

        tris = []
        for k in range(3, int(counts.max()) + 1 if len(counts) else 3):
            sel = counts == k
            if not sel.any():
                continue
            s = starts[sel]
            for j in range(1, k - 1):  # fan triangulation
                tris.append(np.stack([corner[s], corner[s + j], corner[s + j + 1]], 1))
        tri = np.concatenate(tris) if tris else np.zeros((0, 3), np.int64)
        return np.asarray(pos, dtype=np.float32), tri


def _catmull(pts, rad, res, cyclic):
    n = len(pts)
    idx = np.arange(n)
    P = np.concatenate([pts[-1:], pts, pts[:2]]) if cyclic else np.concatenate([pts[:1], pts, pts[-1:]])
    R = np.concatenate([rad[-1:], rad, rad[:2]]) if cyclic else np.concatenate([rad[:1], rad, rad[-1:]])
    segs = n if cyclic else n - 1
    t = np.linspace(0, 1, res, endpoint=False)[:, None]
    out, rr = [], []
    for i in range(segs):
        p0, p1, p2, p3 = P[i], P[i + 1], P[i + 2], P[i + 3]
        c = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
        out.append(c)
        rr.append(R[i + 1] + (R[i + 2] - R[i + 1]) * t[:, 0])
    if not cyclic:
        out.append(pts[-1:])
        rr.append(rad[-1:])
    del idx
    return np.concatenate(out), np.concatenate(rr)


def tube(points, radii, sides=12, cyclic=False, caps=True):
    """Sweeps a circle along a polyline (parallel-transport frames). Returns (positions, triangles)."""
    P = np.asarray(points, np.float64)
    keep = np.r_[True, np.linalg.norm(np.diff(P, axis=0), axis=1) > 1e-9]
    P, R = P[keep], np.asarray(radii, np.float64)[keep]
    n = len(P)
    if n < 2:
        return np.zeros((0, 3), np.float32), np.zeros((0, 3), np.int64)
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-12
    a = np.array([0, 0, 1.0]) if abs(T[0, 2]) < 0.9 else np.array([1.0, 0, 0])
    N = np.zeros_like(P)
    N[0] = np.cross(T[0], a)
    N[0] /= np.linalg.norm(N[0])
    for i in range(1, n):
        v = N[i - 1] - np.dot(N[i - 1], T[i]) * T[i]
        L = np.linalg.norm(v)
        N[i] = v / L if L > 1e-9 else N[i - 1]
    B = np.cross(T, N)
    ang = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    ring = np.cos(ang)[None, :, None] * N[:, None, :] + np.sin(ang)[None, :, None] * B[:, None, :]
    V = (P[:, None, :] + ring * R[:, None, None]).reshape(-1, 3)
    tris = []
    rows = n if cyclic else n - 1
    for i in range(rows):
        i2 = (i + 1) % n
        for k in range(sides):
            k2 = (k + 1) % sides
            a0, a1, b0, b1 = i * sides + k, i * sides + k2, i2 * sides + k, i2 * sides + k2
            tris.append((a0, b0, a1))
            tris.append((a1, b0, b1))
    F = np.array(tris, np.int64)
    if caps and not cyclic:
        c0, c1 = len(V), len(V) + 1
        V = np.vstack([V, P[0], P[-1]])
        cap = [(c0, (k + 1) % sides, k) for k in range(sides)]
        last = (n - 1) * sides
        cap += [(c1, last + k, last + (k + 1) % sides) for k in range(sides)]
        F = np.vstack([F, np.array(cap, np.int64)])
    return V.astype(np.float32), F
