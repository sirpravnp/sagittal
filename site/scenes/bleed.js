// Intracranial hemorrhage by layer: a coronal slab through the real Z-Anatomy skull
// (site/meshes/cranium.js: parietal, temporal, sphenoid and occipital bones, temporalis,
// epicranial aponeurosis, falx cerebri, superior sagittal sinus, middle meningeal artery).
// The skin, dura, arachnoid, subarachnoid space, pia and brain are built here as layers fitted
// to the section of the cranial-cavity endocast (site/meshes/endocast.js, computed from the same
// skull), so they follow the real inner table. No brain-cortex objects are used.
(function () {
  var V = Kit.helpers.V;
  var S = 0.43;                  // cm -> scene units
  var ZF = 1.0, ZB = -1.6;       // front and back faces of the slab (mesh frame, cm)
  var YB = -3.1;                 // lower limit of the slab
  var N = 1600;                  // samples round the cavity outline
  var EPS = 0.002;               // layers sit just in front of the cut plane, bone caps further
  // Layer thicknesses (cm): mildly exaggerated so each layer reads at card size.
  var BONE_CUT = { color: 0xe6cf9c, roughness: 0.9, clearcoat: 0, sheen: 0, emissive: 0x3b2f18, emissiveIntensity: 0.35 };
  var T_DURA = 0.2, T_ARACH = 0.07, T_SAS = 0.32, T_PIA = 0.035, T_CORTEX = 0.3;

  /* ---------- section of a mesh by a plane (as in scenes/eye.js) ---------- */
  // Slices a mesh with the plane n.p = d and returns its section as a flat geometry drawn at
  // n * (d - off); loopsOut collects the closed outlines. shell: band for single-surface sheets.
  function capGeometry(geo, n, d, off, shell, loopsOut) {
    var pos = geo.attributes.position, idx = geo.index, NV = pos.count, i;
    var ids = new Int32Array(NV), seen = {}, nid = 0, s = new Float64Array(NV);
    for (i = 0; i < NV; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var k = Math.round(x * 2e4) + ',' + Math.round(y * 2e4) + ',' + Math.round(z * 2e4);
      if (seen[k] === undefined) seen[k] = nid++;
      ids[i] = seen[k];
      s[i] = n.x * x + n.y * y + n.z * z - d;
      if (Math.abs(s[i]) < 1e-7) s[i] = 1e-7;
    }
    var P = {}, adj = {}, segs = [];
    function ep(a, b) {
      var ia = ids[a], ib = ids[b], key = ia < ib ? ia + '_' + ib : ib + '_' + ia;
      if (!P[key]) {
        var t = s[a] / (s[a] - s[b]);
        P[key] = V(pos.getX(a) + t * (pos.getX(b) - pos.getX(a)), pos.getY(a) + t * (pos.getY(b) - pos.getY(a)), pos.getZ(a) + t * (pos.getZ(b) - pos.getZ(a)));
      }
      return key;
    }
    var T = idx ? idx.count / 3 : NV / 3;
    for (var t = 0; t < T; t++) {
      var v = idx ? [idx.getX(3 * t), idx.getX(3 * t + 1), idx.getX(3 * t + 2)] : [3 * t, 3 * t + 1, 3 * t + 2];
      var e = [];
      for (var j = 0; j < 3; j++) {
        var a = v[j], b = v[(j + 1) % 3];
        if ((s[a] > 0) !== (s[b] > 0)) e.push(ep(a, b));
      }
      if (e.length === 2 && e[0] !== e[1]) {
        var si = segs.length; segs.push(e);
        (adj[e[0]] = adj[e[0]] || []).push(si); (adj[e[1]] = adj[e[1]] || []).push(si);
      }
    }
    var used = new Uint8Array(segs.length), chains = [];
    function walk(ch) {
      for (;;) {
        var end = ch[ch.length - 1], nx = null, L = adj[end] || [];
        for (var q = 0; q < L.length; q++) if (!used[L[q]]) { nx = L[q]; break; }
        if (nx === null) return;
        used[nx] = 1;
        var o = segs[nx][0] === end ? segs[nx][1] : segs[nx][0];
        if (o === ch[0]) { ch.closed = true; return; }
        ch.push(o);
      }
    }
    for (i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      var ch = [segs[i][0], segs[i][1]];
      walk(ch);
      if (!ch.closed) { ch.reverse(); walk(ch); }
      chains.push(ch);
    }
    var loops = [], open = [];
    chains.forEach(function (c) {
      var pts = c.map(function (key) { return P[key]; });
      if (c.closed) loops.push(pts); else open.push(pts);
    });
    if (loopsOut) loops.forEach(function (l) { loopsOut.push(l); });
    if (shell) {
      open.forEach(function (pts) {
        var inner = pts.map(function (p) { return p.clone().add(shell.c.clone().sub(p).setZ(0).normalize().multiplyScalar(shell.t)); });
        loops.push(pts.concat(inner.reverse()));
      });
      open = [];
    }
    while (open.length) {
      var c0 = open.shift();
      for (;;) {
        var end0 = c0[c0.length - 1], best = -1, bd = c0[0].distanceTo(end0), rev = false;
        for (i = 0; i < open.length; i++) {
          var d0 = open[i][0].distanceTo(end0), d1 = open[i][open[i].length - 1].distanceTo(end0);
          if (d0 < bd) { bd = d0; best = i; rev = false; }
          if (d1 < bd) { bd = d1; best = i; rev = true; }
        }
        if (best < 0) break;
        var nxt = open.splice(best, 1)[0];
        if (rev) nxt.reverse();
        c0 = c0.concat(nxt);
      }
      loops.push(c0);
    }
    var U = Math.abs(n.x) < 0.9 ? V(1, 0, 0) : V(0, 1, 0);
    U = U.sub(n.clone().multiplyScalar(U.dot(n))).normalize();
    var Wb = n.clone().cross(U);
    var L2 = loops.filter(function (l) { return l.length > 2; }).map(function (l) {
      return l.map(function (p) { return new THREE.Vector2(p.dot(U), p.dot(Wb)); });
    });
    function inside(pt, poly) {
      var c = false;
      for (var a = 0, b = poly.length - 1; a < poly.length; b = a++) {
        if (((poly[a].y > pt.y) !== (poly[b].y > pt.y)) && (pt.x < (poly[b].x - poly[a].x) * (pt.y - poly[a].y) / (poly[b].y - poly[a].y) + poly[a].x)) c = !c;
      }
      return c;
    }
    var depth = L2.map(function (l, li) {
      var dd = 0;
      L2.forEach(function (o, oi) { if (oi !== li && inside(l[0], o)) dd++; });
      return dd;
    });
    var verts = [], o0 = n.clone().multiplyScalar(d - off);
    L2.forEach(function (outer, oi) {
      if (depth[oi] % 2) return;
      var holes = L2.filter(function (hl, hi) { return depth[hi] === depth[oi] + 1 && inside(hl[0], outer); });
      var faces = THREE.ShapeUtils.triangulateShape(outer, holes);
      var all = outer.concat.apply(outer, holes);
      faces.forEach(function (f) {
        for (var q = 0; q < 3; q++) {
          var p2 = all[f[q]];
          var p3 = U.clone().multiplyScalar(p2.x).add(Wb.clone().multiplyScalar(p2.y)).add(o0);
          verts.push(p3.x, p3.y, p3.z);
        }
      });
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    var nm = new Float32Array(verts.length);
    for (i = 0; i < nm.length; i += 3) { nm[i] = -n.x; nm[i + 1] = -n.y; nm[i + 2] = -n.z; }
    g.setAttribute('normal', new THREE.BufferAttribute(nm, 3));
    return g;
  }

  function geoOf(mesh, part) {
    var m = Kit.meshPart(new THREE.Group(), mesh, part, Kit.tissue('bone'));
    m.material.dispose();
    return m.geometry;
  }
  function ss(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* ---------- the cavity outline in a coronal plane ---------- */
  // Largest section loop of the endocast at z, as N [x, y] points evenly spaced by arc length,
  // starting at the vertex (top, x ~ 0) and running first towards +x (patient's left).
  function cavityOutline(z) {
    var loops = [];
    capGeometry(geoOf('endocast', 'endocast'), V(0, 0, -1), -z, 0, null, loops).dispose();
    var L = loops.reduce(function (a, b) { return b.length > a.length ? b : a; });
    var pts = L.map(function (p) { return [p.x, p.y]; });
    var area = 0;
    for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area > 0) pts.reverse(); // clockwise on screen: top -> patient's left (screen right) -> floor -> right
    // Smooth away the small foramina and voxel steps.
    for (var it = 0; it < 6; it++) {
      pts = pts.map(function (p, k) {
        var q = pts[(k + pts.length - 1) % pts.length], r = pts[(k + 1) % pts.length];
        return [(q[0] + 2 * p[0] + r[0]) / 4, (q[1] + 2 * p[1] + r[1]) / 4];
      });
    }
    // Start at the top point nearest the midline.
    var st = 0, by = -1e9;
    pts.forEach(function (p, k) { var sc = p[1] - 4 * Math.abs(p[0]); if (sc > by) { by = sc; st = k; } });
    pts = pts.slice(st).concat(pts.slice(0, st));
    // Resample by arc length.
    var cum = [0];
    for (i = 1; i <= pts.length; i++) { var p0 = pts[i - 1], p1 = pts[i % pts.length]; cum.push(cum[i - 1] + Math.hypot(p1[0] - p0[0], p1[1] - p0[1])); }
    var tot = cum[pts.length], out = [], j = 0;
    for (i = 0; i < N; i++) {
      var sTarget = tot * i / N;
      while (cum[j + 1] < sTarget) j++;
      var f = (sTarget - cum[j]) / (cum[j + 1] - cum[j]), A = pts[j], B = pts[(j + 1) % pts.length];
      out.push([A[0] + f * (B[0] - A[0]), A[1] + f * (B[1] - A[1])]);
    }
    // Inward unit normals (the outline runs clockwise, so inward is to the right of travel).
    var nrm = out.map(function (p, k) {
      var a = out[(k + N - 2) % N], b = out[(k + 2) % N], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
      return [ty / l, -tx / l];
    });
    return { p: out, n: nrm, len: tot };
  }

  Kit.register({
    id: 'bleed',
    meshes: ['cranium', 'endocast'],
    center: [0.75, 1.15, 0],
    zoom: 9,
    rot: [0.16, -0.32],
    controls: [{ k: 'v', label: 'Bleed', def: 'epi', opts: [
      ['epi', 'Epidural hematoma'],
      ['sub', 'Subdural hematoma'],
      ['sah', 'Subarachnoid hemorrhage'],
    ] }],
    build: function (g, st) {
      var v = st.v;
      var M = new THREE.Group(); M.scale.setScalar(S); g.add(M); M.updateMatrix();
      var planes = [];
      function P(nx, ny, nz, c) { var p = new THREE.Plane(V(nx, ny, nz), c); var w = p.clone(); planes.push([p, w]); return w; }
      var front = P(0, 0, -1, ZF), back = P(0, 0, 1, -ZB), bottom = P(0, 1, 0, -YB);
      var SLAB = [front, back, bottom];

      /* --- real parts, clipped to the slab, with section caps on the front face --- */
      var NZ = V(0, 0, -1);
      function real(part, kind, opts, capOpts, shell) {
        var m = Kit.meshPart(M, 'cranium', part, Kit.tissue(kind, Object.assign({ clippingPlanes: SLAB }, opts || {})));
        var cg = capGeometry(m.geometry, NZ, -ZF, 3 * EPS, shell || null);
        var cap = new THREE.Mesh(cg, Kit.tissue(kind, Object.assign({ clearcoat: 0, sheen: 0, clippingPlanes: [bottom] }, opts || {}, capOpts || {})));
        M.add(cap);
        return m;
      }
      var boneCut = BONE_CUT;
      ['parietal_l', 'parietal_r', 'temporal_l', 'temporal_r', 'sphenoid', 'occipital'].forEach(function (p) { real(p, 'bone', {}, boneCut); });
      real('temporalis_l', 'muscle', {}, { color: 0x8e3a32 });
      real('temporalis_r', 'muscle', {}, { color: 0x8e3a32 });
      real('galea', 'fascia', { color: 0xe9e2d4, opacity: 1 }, { color: 0xf2ece0 }, { t: 0.08, c: V(0, 1.5, ZF) });
      real('falx', 'fascia', { color: 0xdcd6cc, opacity: 1 }, { color: 0xe9e4da }, { t: 0.07, c: V(-5, 4, ZF) });
      real('sss', 'vessel-vein', { color: 0x2f4f96 }, { color: 0x24396e });
      Kit.meshPart(M, 'cranium', 'mma_l', Kit.tissue('vessel-artery', { color: 0xc4291f, clippingPlanes: [bottom] }));

      /* --- the cavity outline at both faces, and the bone (and suture) beside each sample --- */
      var CF = cavityOutline(ZF), CB = cavityOutline(ZB);
      var bones = ['parietal_l', 'parietal_r', 'temporal_l', 'temporal_r', 'sphenoid', 'occipital'];
      var bonePts = bones.map(function (b) {
        var loops = []; capGeometry(geoOf('cranium', b), NZ, -ZF, 0, null, loops).dispose();
        var a = []; loops.forEach(function (l) { l.forEach(function (p) { a.push([p.x, p.y]); }); });
        return a;
      });
      var boneAt = CF.p.map(function (p) {
        var best = -1, bd = 1e9;
        bonePts.forEach(function (a, bi) { a.forEach(function (q) { var d = (q[0] - p[0]) * (q[0] - p[0]) + (q[1] - p[1]) * (q[1] - p[1]); if (d < bd) { bd = d; best = bi; } }); });
        return bones[best];
      });
      // Squamosal suture (parietal over temporal squama) on the patient's left, inner table.
      var iSq = -1, iFloorL = -1, i;
      for (i = 1; i < N / 2; i++) if (boneAt[i - 1] === 'parietal_l' && boneAt[i] === 'temporal_l') { iSq = i; break; }
      if (iSq < 0) iSq = Math.round(N * 0.17);
      // Lateral end of the middle cranial fossa floor on the left: lowest point of the left half.
      var ylo = 1e9;
      for (i = 0; i < N / 2; i++) if (CF.p[i][0] > 3 && CF.p[i][1] < ylo) { ylo = CF.p[i][1]; iFloorL = i; }

      /* --- layer depths along the outline (cm inwards from the inner table) --- */
      var hE = new Float64Array(N), hS = new Float64Array(N), sas = new Float64Array(N), sulc = new Float64Array(N);
      // EDH: under the temporal squama, from the squamosal suture down to near the fossa floor.
      var iE1 = iSq, iE0 = iSq;
      while (iE0 < iFloorL && CF.p[iE0][1] > ylo + 0.45) iE0++;
      var iS0 = Math.round(N * 0.012), iS1 = iFloorL - Math.round(N * 0.01); // SDH: vertex to fossa floor
      for (i = 0; i < N; i++) {
        var x = CF.p[i][0], y = CF.p[i][1];
        if (v === 'epi' && i >= iE1 && i <= iE0) {
          var u = (i - iE1) / (iE0 - iE1) * 2 - 1;
          hE[i] = 1.2 * Math.pow(Math.max(0, 1 - u * u), 0.7);
        }
        if (v === 'sub' && i >= iS0 && i <= iS1) {
          var w = (i - iS0) / (iS1 - iS0);
          hS[i] = 0.62 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, w))), 0.55) * (0.75 + 0.25 * Math.sin(Math.PI * w));
        }
        // Subarachnoid space: thin over the convexity, wide in the basal cisterns and the
        // Sylvian fissure region.
        sas[i] = T_SAS + 0.9 * (1 - ss(0.6, 2.2, Math.abs(x))) * (1 - ss(-2.2, -0.8, y));
      }
      // Sulci: notches in the brain surface, about 1.1 cm apart over the convexity; the lateral
      // (Sylvian) fissure is a deep one at the top of the temporal lobe.
      var arc = CF.len / N, wmN = new Float64Array(N);
      // A sulcus: a narrow CSF cleft (half-width c) of depth D between rounded gyral shoulders
      // (radius r); the white matter keeps a cortex's thickness (T_CORTEX) away from it.
      function notch(ci, D, c, r) {
        var reach = Math.ceil((c + r + T_CORTEX + 0.2) / arc);
        for (var k = -reach; k <= reach; k++) {
          var ii = ((ci + k) % N + N) % N, dd = Math.abs(k * arc), b = 0, w = 0;
          if (dd < c) b = D; else if (dd < c + r) { var e = c + r - dd; b = Math.min(D, r - Math.sqrt(Math.max(0, r * r - e * e))); }
          var cw = c + T_CORTEX * 0.95; // white matter: a rounded U around the fundus
          if (dd < cw) w = D * Math.sqrt(1 - (dd / cw) * (dd / cw));
          sulc[ii] = Math.max(sulc[ii], b); wmN[ii] = Math.max(wmN[ii], w);
        }
      }
      var sylL = -1, sylR = -1;
      CF.p.forEach(function (p, k) { // Sylvian (lateral) fissure: on each lateral wall above the temporal lobe
        if (p[0] > 4 && Math.abs(p[1] - (ylo + 2.75)) < 0.05 && sylL < 0) sylL = k;
        if (p[0] < -4 && Math.abs(p[1] - (ylo + 2.75)) < 0.05) sylR = k;
      });
      if (sylL > 0) notch(sylL, 2.7, 0.06, 0.16);
      if (sylR > 0) notch(sylR, 2.7, 0.06, 0.16);
      var gy = 0;
      for (var sA = 0.95; sA < CF.len - 0.8; sA += 1.05 + 0.5 * (((gy * 5) % 7) / 6)) {
        var k0 = Math.round(sA / arc) % N, p0 = CF.p[k0];
        gy++;
        if (p0[1] < ylo + 1.2 && Math.abs(p0[0]) < 3.6) continue; // none in the basal cisterns
        if ((sylL > 0 && Math.abs(k0 - sylL) * arc < 0.9) || (sylR > 0 && Math.abs(k0 - sylR) * arc < 0.9)) continue;
        notch(k0, 0.75 + 0.7 * ((gy * 3) % 5) / 4, 0.035, 0.12);
      }

      // Depth (cm) of each boundary at sample i.
      function dDuraOut(i) { return hE[i]; }
      function dDuraIn(i) { return hE[i] + T_DURA; }
      function dArachOut(i) { return dDuraIn(i) + hS[i]; }
      function dArachIn(i) { return dArachOut(i) + T_ARACH; }
      function dBrain(i) { return dArachIn(i) + sas[i]; }
      function at(C, i, d) { return [C.p[i][0] + C.n[i][0] * d, C.p[i][1] + C.n[i][1] * d]; }
      function curve(C, fn) { var a = []; for (var k = 0; k < N; k++) a.push(at(C, k, fn(k))); return a; }

      /* --- geometry builders: bands and filled regions, front face at ZF, back at ZB --- */
      function bandGeo(OF, IF, OB, IB, closed, zo) {
        var e = EPS * (zo || 1);
        var pos = [], idx = [], n = OF.length;
        function quadStrip(A, B, z, flip) {
          var base = pos.length / 3;
          for (var k = 0; k < n; k++) { pos.push(A[k][0], A[k][1], z, B[k][0], B[k][1], z); }
          for (k = 0; k < (closed ? n : n - 1); k++) {
            var a = base + 2 * k, b = base + 2 * ((k + 1) % n);
            if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1); else idx.push(a, b, a + 1, b, b + 1, a + 1);
          }
        }
        quadStrip(OF, IF, ZF + e, false);
        quadStrip(OB, IB, ZB - e, true);
        var g2 = new THREE.BufferGeometry();
        g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g2.setIndex(idx); g2.computeVertexNormals();
        return g2;
      }
      function wallGeo(AF, AB, closed) { // side wall between the same outline at both faces
        var pos = [], idx = [], n = AF.length;
        for (var k = 0; k < n; k++) pos.push(AF[k][0], AF[k][1], ZF + EPS, AB[k][0], AB[k][1], ZB - EPS);
        for (k = 0; k < (closed ? n : n - 1); k++) { var a = 2 * k, b = 2 * ((k + 1) % n); idx.push(a, a + 1, b, b, a + 1, b + 1); }
        var g2 = new THREE.BufferGeometry();
        g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g2.setIndex(idx); g2.computeVertexNormals();
        return g2;
      }
      function polyGeo(poly, z, holes) {
        var pts = poly.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
        var hs = (holes || []).map(function (h2) { return h2.map(function (p) { return new THREE.Vector2(p[0], p[1]); }); });
        var faces = THREE.ShapeUtils.triangulateShape(pts, hs), all = pts.concat.apply(pts, hs), pos = [];
        faces.forEach(function (f) { f.forEach(function (k) { pos.push(all[k].x, all[k].y, z); }); });
        var g2 = new THREE.BufferGeometry();
        g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g2.computeVertexNormals();
        return g2;
      }
      function flat(kind, opts) { return Kit.tissue(kind, Object.assign({ clearcoat: 0, sheen: 0, roughness: 0.75 }, opts || {})); }
      function addBand(fnOut, fnIn, mat, range, zo) {
        var OF = curve(CF, fnOut), IF = curve(CF, fnIn), OB = curve(CB, fnOut), IB = curve(CB, fnIn);
        if (range) { OF = OF.slice(range[0], range[1] + 1); IF = IF.slice(range[0], range[1] + 1); OB = OB.slice(range[0], range[1] + 1); IB = IB.slice(range[0], range[1] + 1); }
        var m = new THREE.Mesh(bandGeo(OF, IF, OB, IB, !range, zo), mat); m.material.clippingPlanes = [bottom]; M.add(m); return m;
      }

      /* --- scalp: skin and subcutaneous tissue outside the bones, temporalis and galea --- */
      var outer = []; // farthest real tissue along the outward normal, per sample
      var segPts = [];
      ['parietal_l', 'parietal_r', 'temporal_l', 'temporal_r', 'temporalis_l', 'temporalis_r', 'galea'].forEach(function (b) {
        var loops = []; capGeometry(geoOf('cranium', b), NZ, -ZF, 0, null, loops).dispose();
        loops.forEach(function (l) { l.forEach(function (p) { segPts.push([p.x, p.y]); }); });
        var gg = geoOf('cranium', b), pp = gg.attributes.position; // open sheets (galea) have no loops
        for (var k = 0; k < pp.count; k++) if (Math.abs(pp.getZ(k) - ZF) < 0.25) segPts.push([pp.getX(k), pp.getY(k)]);
      });
      for (i = 0; i < N; i++) {
        var p = CF.p[i], nn = CF.n[i], far = 0.5;
        segPts.forEach(function (q) {
          var dx = q[0] - p[0], dy = q[1] - p[1], along = -(dx * nn[0] + dy * nn[1]), perp = Math.abs(dx * nn[1] - dy * nn[0]);
          if (along > 0 && along < 3.5 && perp < 0.3 && along > far) far = along;
        });
        outer.push(far);
      }
      for (var it = 0; it < 4; it++) outer = outer.map(function (o, k) { return (outer[(k + N - 1) % N] + 2 * o + outer[(k + 1) % N]) / 4; });
      // The scalp covers the vault down to the zygomatic arch level on each side.
      var sc0 = -1, sc1 = -1;
      for (i = 0; i < N / 2; i++) if (CF.p[i][1] < ylo + 1.3 && CF.p[i][0] > 0) { sc0 = i; break; }
      for (i = N - 1; i > N / 2; i--) if (CF.p[i][1] < ylo + 1.3 && CF.p[i][0] < 0) { sc1 = i; break; }
      var scalpIdx = [];
      for (i = sc1; i < N; i++) scalpIdx.push(i);
      for (i = 0; i <= sc0; i++) scalpIdx.push(i);
      function scalpCurve(C, extra) { return scalpIdx.map(function (k) { return at(C, k, -(outer[k] + extra)); }); }
      var skinMat = flat('fat', { color: 0xe2b49a, roughness: 0.6 });
      var subq = flat('fat', { color: 0xf0d48a });
      M.add(new THREE.Mesh(bandGeo(scalpCurve(CF, 0.02), scalpCurve(CF, 0.28), scalpCurve(CB, 0.02), scalpCurve(CB, 0.28), false), subq));
      M.add(new THREE.Mesh(bandGeo(scalpCurve(CF, 0.28), scalpCurve(CF, 0.5), scalpCurve(CB, 0.28), scalpCurve(CB, 0.5), false), skinMat));
      M.add(new THREE.Mesh(wallGeo(scalpCurve(CF, 0.5), scalpCurve(CB, 0.5), false), Kit.tissue('fat', { color: 0xd9a58c, roughness: 0.55, clearcoat: 0.3 })));

      /* --- meninges, CSF and brain --- */
      var blood = { color: 0x7a0f12, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 };
      var fresh = { color: 0x9c1a18, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.25 };
      // Behind everything: a dark base so no gap between bone and dura shows through.
      addBand(function () { return -0.35; }, function () { return 0; }, Kit.tissue('bone', BONE_CUT));
      if (v === 'epi') addBand(function () { return -0.02; }, function (k) { return hE[k] + 0.01; }, flat('fat', fresh), [iE1 - 2, iE0 + 2], 1.3);
      addBand(dDuraOut, dDuraIn, flat('fascia', { color: 0xd9cbb4, opacity: 1, roughness: 0.6 }));
      if (v === 'sub') addBand(dDuraIn, dArachOut, flat('fat', blood));
      addBand(dArachOut, dArachIn, flat('fascia', { color: 0xf3f0ea, opacity: 1 }));
      var brainD = function (k) { return dBrain(k) + sulc[k]; };
      addBand(dArachIn, brainD, v === 'sah' ? flat('fat', fresh) : flat('fat', { color: 0xa9d0e6 }));

      // Brain: one outline with the interhemispheric fissure cut down to the corpus callosum.
      function brainPoly(C) {
        var B = curve(C, brainD), out = [], k;
        var ccY = 2.9, half = 0.2;
        var k1 = 0; while (B[k1][0] < half) k1++;
        var k2 = N - 1; while (B[k2][0] > -half) k2--;
        for (k = k1; k <= k2; k++) out.push(B[k]);
        var topR = B[k2][1], topL = B[k1][1];
        for (var t = 0; t <= 6; t++) out.push([-half, topR + (ccY - topR) * t / 6]);
        for (t = 1; t < 8; t++) { var a = Math.PI * t / 8; out.push([-half * Math.cos(a), ccY - half * Math.sin(a)]); }
        for (t = 0; t <= 6; t++) out.push([half, ccY + (topL - ccY) * t / 6]);
        return out;
      }
      var bF = brainPoly(CF), bB = brainPoly(CB);
      var gm = flat('muscle', { color: 0xa9837d, roughness: 0.7 });
      M.add(new THREE.Mesh(polyGeo(bF, ZF + EPS), gm));
      M.add(new THREE.Mesh(polyGeo(bB, ZB - EPS), gm));
      // Fissure CSF (or blood) between the hemispheres, around the falx.
      var fis = [[-0.21, 9], [0.21, 9], [0.21, 2.85], [-0.21, 2.85]];
      M.add(new THREE.Mesh(polyGeo(fis, ZF + EPS * 0.5), v === 'sah' ? flat('fat', fresh) : flat('fat', { color: 0xa9d0e6 })));
      // Pia: a thin bright lining of the brain surface, into the sulci.
      addBand(brainD, function (k) { return brainD(k) + T_PIA; }, flat('fascia', { color: 0xf6d6cc, opacity: 1 }), null, 1.5);
      // White matter, with gyral cores; deep grey and ventricles.
      var wmD = function (k) { return dBrain(k) + T_CORTEX + wmN[k]; };
      function wmPoly(C) {
        var Wc = curve(C, wmD), out = [], k, half = 0.5, ccY = 2.95;
        var k1 = 0; while (Wc[k1][0] < half) k1++;
        var k2 = N - 1; while (Wc[k2][0] > -half) k2--;
        for (k = k1; k <= k2; k++) {
          var q = Wc[k].slice();
          if (Math.abs(q[0]) < 2.6) q[1] = Math.max(q[1], -0.5 + 0.12 * Math.abs(q[0])); // deep grey above the base
          out.push(q);
        }
        // Medial (cingulate) cortex beside the fissure; the corpus callosum crosses below it.
        var topR = Wc[k2][1], topL = Wc[k1][1];
        out.push([-half, ccY + 0.5], [-0.42, ccY + 0.22], [-0.24, ccY + 0.06], [0.24, ccY + 0.06], [0.42, ccY + 0.22], [half, ccY + 0.5]);
        return out;
      }
      var wm = flat('fat', { color: 0xf1e8de, roughness: 0.8 });
      M.add(new THREE.Mesh(polyGeo(wmPoly(CF), ZF + 2 * EPS), wm));
      // Lateral ventricles (bodies) and third ventricle, as CSF.
      var csf = flat('air', { color: 0x7fb2d6, opacity: 0.9 });
      [[1, 0], [-1, 0]].forEach(function (sg) {
        var vp = [[0.12, 2.42], [0.7, 2.62], [1.3, 2.5], [1.05, 2.18], [0.5, 1.95], [0.14, 1.7]].map(function (q) { return [q[0] * sg[0], q[1]]; });
        if (sg[0] < 0) vp.reverse();
        M.add(new THREE.Mesh(polyGeo(vp, ZF + 3 * EPS), csf));
      });
      M.add(new THREE.Mesh(polyGeo([[-0.08, 1.35], [0.08, 1.35], [0.08, -0.35], [-0.08, -0.35]], ZF + 3 * EPS), csf));

      /* --- middle meningeal artery: from the foramen spinosum along the inner table --- */
      var mmaPts = [V(2.5, -2.0, 0.72)];
      var mmaIdx = [];
      for (i = iFloorL + Math.round(N * 0.035); i >= iSq - Math.round(N * 0.06); i -= 3) mmaIdx.push(i);
      mmaIdx.forEach(function (k) { var q = at(CF, k, (hE[k] > 0 ? 0.12 : 0.05)); mmaPts.push(V(q[0], q[1], ZF - 0.06)); });
      var tearAt = null;
      var artMat = Kit.tissue('vessel-artery', { color: 0xc4291f });
      if (v === 'epi') {
        // Torn where it crosses the hematoma: a gap with a jet of fresh blood.
        var mid = Math.round(mmaPts.length * 0.5);
        var aPts = mmaPts.slice(0, mid - 1), bPts = mmaPts.slice(mid + 1);
        M.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(aPts), 60, 0.085, 10, false), artMat));
        M.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bPts), 40, 0.085, 10, false), artMat));
        tearAt = mmaPts[mid].clone();
        var jet = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), Kit.tissue('blood-oxy', { color: 0xe0281e, emissive: 0x8a0a06, emissiveIntensity: 0.6 }));
        jet.position.copy(tearAt).add(V(-0.25, 0, 0.02)); jet.scale.set(0.28, 0.16, 0.08); M.add(jet);
        // Fracture of the temporal squama over the tear.
        var kf = mmaIdx[Math.round(mmaIdx.length * 0.5)];
        var thick = 0.3;
        bonePts[2].forEach(function (q) {
          var dx = q[0] - CF.p[kf][0], dy = q[1] - CF.p[kf][1], al = -(dx * CF.n[kf][0] + dy * CF.n[kf][1]), pe = Math.abs(dx * CF.n[kf][1] - dy * CF.n[kf][0]);
          if (pe < 0.12 && al > thick && al < 1.2) thick = al;
        });
        var inner = at(CF, kf, -0.02), outerP = at(CF, kf, -thick - 0.02), fr = [];
        for (var q = 0; q <= 6; q++) {
          var tt = q / 6, jx = (q % 2 ? 0.08 : -0.08) * (q > 0 && q < 6 ? 1 : 0);
          fr.push(V(inner[0] + (outerP[0] - inner[0]) * tt + jx * CF.n[kf][1], inner[1] + (outerP[1] - inner[1]) * tt - jx * CF.n[kf][0], ZF + 4 * EPS));
        }
        M.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fr, false, 'catmullrom', 0), 24, 0.035, 6, false), flat('fat', { color: 0x1d1210 })));
        var frMid = fr[3];
      } else {
        M.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(mmaPts), 80, 0.085, 10, false), artMat));
      }

      /* --- squamosal suture: the bevelled parietal-temporal seam through the bone --- */
      var sqThick = 0.3;
      bonePts[0].concat(bonePts[2]).forEach(function (q) {
        var dx = q[0] - CF.p[iSq][0], dy = q[1] - CF.p[iSq][1], al = -(dx * CF.n[iSq][0] + dy * CF.n[iSq][1]), pe = Math.abs(dx * CF.n[iSq][1] - dy * CF.n[iSq][0]);
        if (pe < 0.12 && al > sqThick && al < 1.0) sqThick = al;
      });
      var kUp = Math.max(0, iSq - Math.round(0.45 / arc));
      var sq0 = at(CF, iSq, -0.03), sq1 = at(CF, kUp, -sqThick - 0.02);
      M.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V(sq0[0], sq0[1], ZF + 4 * EPS), V(sq1[0], sq1[1], ZF + 4 * EPS)), 2, 0.022, 6, false), flat('fat', { color: 0x5a4630 })));

      /* --- bridging veins: cortex to the superior sagittal sinus --- */
      var veinMat = Kit.tissue('vessel-vein', { color: 0x37589e });
      var kv = Math.round(N * 0.035), bv = at(CF, kv, dBrain(kv) + 0.02), sv = V(0.18, 8.65, ZF + 0.02);
      var veinTorn = null;
      if (v === 'sub') {
        var vA = [V(bv[0], bv[1], ZF + 0.02), V(bv[0] - 0.05, bv[1] + (8.5 - bv[1]) * 0.45, ZF + 0.02)];
        M.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vA), 10, 0.06, 8, false), veinMat));
        M.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.75, 8.45, ZF + 0.02), sv]), 6, 0.06, 8, false), veinMat));
        veinTorn = V(bv[0] - 0.1, bv[1] + (8.5 - bv[1]) * 0.6, ZF + 0.02);
      } else {
        M.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(bv[0], bv[1], ZF + 0.02), V(bv[0] - 0.1, bv[1] + 0.3, ZF + 0.02), sv]), 16, 0.06, 8, false), veinMat));
      }

      /* --- labels --- */
      function W(q) { return (q.isVector3 ? q : V(q[0], q[1], ZF)).clone().applyMatrix4(M.matrix).toArray(); }
      function mid2(fnA, fnB, k) { return at(CF, k, (fnA(k) + fnB(k)) / 2); }
      var kR = Math.round(N * 0.86), kT = Math.round(N * 0.92), kL = Math.round(N * 0.12);
      var L = [
        { t: 'Scalp', p: W(at(CF, Math.round(N * 0.93), -(outer[Math.round(N * 0.93)] + 0.38))) },
        { t: 'Skull (parietal bone)', p: W(at(CF, kT, -0.3)) },
        { t: 'Dura mater', p: W(mid2(dDuraOut, dDuraIn, kR)) },
        { t: 'Arachnoid mater', p: W(mid2(dArachOut, dArachIn, Math.round(N * 0.8))) },
        { t: 'Subarachnoid space', p: W(mid2(dArachIn, dBrain, Math.round(N * 0.75))) },
        { t: 'Pia mater / cortex', p: W(at(CF, Math.round(N * 0.7), dBrain(Math.round(N * 0.7)) + 0.15)) },
        { t: 'Falx cerebri', p: W([0, 5.4]) },
        { t: 'Superior sagittal sinus', p: W([0.05, 8.6]) },
        { t: 'Temporalis', p: W(at(CF, Math.round((iSq + iFloorL) / 2), -1.1)) },
      ];
      if (v === 'epi') {
        L.push({ t: 'Epidural hematoma', p: W(at(CF, Math.round((iE0 + iE1) / 2), 0.7)) });
        L.push({ t: 'Torn middle meningeal a.', p: W(tearAt) });
        L.push({ t: 'Temporal bone fracture', p: W(frMid) });
        L.push({ t: 'Squamosal suture (stops it)', p: W([(sq0[0] + sq1[0]) / 2, (sq0[1] + sq1[1]) / 2]) });
      } else {
        L.push({ t: 'Middle meningeal artery', p: W(mmaPts[Math.round(mmaPts.length * 0.5)]) });
      }
      if (v === 'sub') {
        L.push({ t: 'Subdural hematoma', p: W(mid2(dDuraIn, dArachOut, Math.round((iS0 + iS1) * 0.5))) });
        L.push({ t: 'Torn bridging vein', p: W(veinTorn) });
        L.push({ t: 'Squamosal suture (crossed)', p: W([(sq0[0] + sq1[0]) / 2, (sq0[1] + sq1[1]) / 2]) });
      }
      if (v === 'sah') {
        L.push({ t: 'Blood in sulci', p: W(at(CF, kL, dBrain(kL) + 0.3)) });
        L.push({ t: 'Basal cistern blood', p: W([0.6, ylo + 0.5]) });
      }
      var infos = {
        epi: '<ul><li><b>Epidural hematoma</b>: arterial blood between the <b>skull and the dura</b>, classically from a <b>middle meningeal artery</b> torn by a temporal bone fracture at the pterion.</li><li><b>Biconvex (lens-shaped)</b> on CT; it <b>does not cross sutures</b>, where the dura is fixed to the skull (here the squamosal suture), but can cross the midline.</li><li>Brief loss of consciousness, a <b>lucid interval</b>, then rapid decline (herniation, CN III palsy). Emergency craniotomy.</li></ul>',
        sub: '<ul><li><b>Subdural hematoma</b>: venous blood between the <b>dura and the arachnoid</b>, from torn <b>bridging veins</b> running from the cortex to the dural sinuses.</li><li><b>Crescent-shaped</b>, concave toward the brain; it <b>crosses sutures</b> but not the falx or tentorium.</li><li>Elderly (brain atrophy stretches the veins), alcohol use, anticoagulation, shaken infants; acute after trauma or chronic with gradual confusion.</li></ul>',
        sah: '<ul><li><b>Subarachnoid hemorrhage</b>: blood in the <b>subarachnoid space</b> (between arachnoid and pia, with the CSF), tracking into the <b>sulci, fissures and basal cisterns</b>.</li><li>Most non-traumatic SAH is from a ruptured <b>berry aneurysm</b> (circle of Willis): sudden "worst headache of my life", neck stiffness.</li><li>CT without contrast first; if negative, lumbar puncture for xanthochromia. Watch for vasospasm (nimodipine) and hydrocephalus.</li></ul>',
      };
      return {
        labels: L,
        info: infos[v],
        update: function () {
          M.updateWorldMatrix(true, false);
          planes.forEach(function (p) { p[1].copy(p[0]).applyMatrix4(M.matrixWorld); });
        },
      };
    },
  });
})();
