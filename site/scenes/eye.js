// Eye anatomy: sagittal cutaway of the real right eye (Z-Anatomy meshes, site/meshes/eye.js)
// with a procedural choroid, ciliary body, trabecular meshwork and the pathology overlays.
(function () {
  var h = Kit.helpers, V = h.V;

  /* ---------- cut caps (the kit has no section caps, so they are built here) ---------- */
  // Slices a closed (or nearly closed) mesh with the plane n.p = d (local coordinates) and
  // returns a flat BufferGeometry that fills the section, drawn `off` towards the removed side.
  function capGeometry(geo, n, d, off, shell, loopsOut) {
    var pos = geo.attributes.position, idx = geo.index, N = pos.count, i;
    var ids = new Int32Array(N), seen = {}, nid = 0, s = new Float64Array(N);
    for (i = 0; i < N; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      var k = Math.round(x * 2e4) + ',' + Math.round(y * 2e4) + ',' + Math.round(z * 2e4);
      if (seen[k] === undefined) seen[k] = nid++;
      ids[i] = seen[k];
      s[i] = n.x * x + n.y * y + n.z * z - d;
      if (Math.abs(s[i]) < 1e-7) s[i] = 1e-7;
    }
    var P = {}, adj = {}, segs = [];
    function ep(a, b) {
      var ia = ids[a], ib = ids[b], k = ia < ib ? ia + '_' + ib : ib + '_' + ia;
      if (!P[k]) {
        var t = s[a] / (s[a] - s[b]);
        P[k] = V(pos.getX(a) + t * (pos.getX(b) - pos.getX(a)), pos.getY(a) + t * (pos.getY(b) - pos.getY(a)), pos.getZ(a) + t * (pos.getZ(b) - pos.getZ(a)));
      }
      return k;
    }
    var T = idx ? idx.count / 3 : N / 3;
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
      var pts = c.map(function (k) { return P[k]; });
      if (c.closed) loops.push(pts); else open.push(pts);
    });
    if (loopsOut) loops.forEach(function (l) { loopsOut.push(l); });
    // Open chains come from single-surface shells (the Z-Anatomy sclera has no thickness):
    // with shell = { t, c } each becomes a band t thick, offset towards the point c.
    if (shell) {
      open.forEach(function (pts) {
        var inner = pts.map(function (p) { return p.clone().add(shell.c.clone().sub(p).normalize().multiplyScalar(shell.t)); });
        loops.push(pts.concat(inner.reverse()));
      });
      open = [];
    }
    // Otherwise join nearest ends of open chains.
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
    // 2D basis in the plane.
    var U = Math.abs(n.x) < 0.9 ? V(1, 0, 0) : V(0, 1, 0);
    U = U.sub(n.clone().multiplyScalar(U.dot(n))).normalize();
    var W = n.clone().cross(U);
    var L2 = loops.filter(function (l) { return l.length > 2; }).map(function (l) {
      return l.map(function (p) { return new THREE.Vector2(p.dot(U), p.dot(W)); });
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
          var p3 = U.clone().multiplyScalar(p2.x).add(W.clone().multiplyScalar(p2.y)).add(o0);
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


  // Flat cap for a 2D polygon [[z, y], ...] drawn in the section plane x = X0 - off.
  function polyCap(poly, off) {
    var pts = poly.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var faces = THREE.ShapeUtils.triangulateShape(pts, []), v = [], n = [];
    faces.forEach(function (f) { f.forEach(function (k) { v.push(X0 - off, pts[k].y, pts[k].x); n.push(-1, 0, 0); }); });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    return g;
  }
  // Sweeps a closed section profile half way round the visual axis, through the kept (nasal)
  // half: the superior profile `top` ([[z, y], ...] in the section) morphs into the inferior
  // profile `bot` (same vertex count), because the real anterior segment is not symmetric.
  function sweep(top, bot, n) {
    var K = top.length, pos = [], idx = [];
    for (var i = 0; i <= n; i++) {
      var ph = Math.PI * i / n, w = (1 - Math.cos(ph)) / 2;
      for (var k = 0; k < K; k++) {
        var r = (top[k][1] - AY) * (1 - w) + (AY - bot[k][1]) * w, z = top[k][0] * (1 - w) + bot[k][0] * w;
        pos.push(X0 + r * Math.sin(ph), AY + r * Math.cos(ph), z);
      }
    }
    for (i = 0; i < n; i++) {
      for (k = 0; k < K; k++) {
        var a = i * K + k, b = i * K + (k + 1) % K, c = a + K, d = b + K;
        idx.push(a, b, d, a, d, c);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function ellipse(cz, cy, rz, ry, n) {
    var p = [];
    for (var i = 0; i < n; i++) { var t = Math.PI * 2 * i / n; p.push([cz + rz * Math.cos(t), cy + ry * Math.sin(t)]); }
    return p;
  }
  // Copy of a shared mesh geometry with each vertex moved by fn(position, normal).
  function deformed(geo, fn) {
    var g = geo.clone(); g.userData = {};
    var p = g.attributes.position, nr = g.attributes.normal, v = V(0, 0, 0), nn = V(0, 0, 0);
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); nn.fromBufferAttribute(nr, i);
      fn(v, nn); p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
  // Resamples a closed polygon [[z, y], ...] as a smooth closed Catmull-Rom curve.
  function round(poly, k) {
    var c = new THREE.CatmullRomCurve3(poly.map(function (p) { return V(p[0], p[1], 0); }), true, 'centripetal');
    return c.getSpacedPoints(poly.length * k).slice(0, -1).map(function (p) { return [p.x, p.y]; });
  }
  function smooth(e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

  // Eye frame (mesh coordinates, cm): +z anterior along the visual axis, +y superior,
  // +x nasal (this is the right eye). The section is the vertical plane x = X0 through the
  // visual axis; the nasal half (with the optic disc and nerve) is kept. AY: axis height.
  var X0 = -0.1, AY = 0.05;
  // Procedural anterior-segment profiles in the section, superior and inferior ([z, y], cm),
  // fitted to the Z-Anatomy sclera, iris, lens and retina (Z-Anatomy has no ciliary body).
  var CIL_TOP = [[0.56, 1.12], [0.70, 1.085], [0.82, 1.035], [0.91, 0.95], [0.965, 0.865], [0.975, 0.80], [0.94, 0.745], [0.89, 0.70], [0.85, 0.685], [0.815, 0.70], [0.79, 0.76], [0.755, 0.86], [0.71, 0.95], [0.66, 1.01], [0.61, 1.055], [0.56, 1.09]];
  var CIL_BOT = [[0.66, -1.13], [0.80, -1.04], [0.92, -0.94], [1.02, -0.84], [1.08, -0.75], [1.09, -0.69], [1.05, -0.645], [1.00, -0.62], [0.94, -0.60], [0.90, -0.59], [0.865, -0.60], [0.84, -0.66], [0.82, -0.75], [0.78, -0.86], [0.73, -0.97], [0.69, -1.04], [0.66, -1.09]];
  var TM_TOP = [[0.955, 0.765], [0.975, 0.805], [1.065, 0.79], [1.07, 0.772], [1.0, 0.757]];
  var TM_BOT = [[1.07, -0.66], [1.09, -0.70], [1.18, -0.675], [1.185, -0.655], [1.12, -0.645]];
  CIL_TOP = round(CIL_TOP, 4); CIL_BOT = round(CIL_BOT, 4); TM_TOP = round(TM_TOP, 6); TM_BOT = round(TM_BOT, 6);
  var SC_TOP = ellipse(1.0, 0.822, 0.03, 0.011, 12), SC_BOT = ellipse(1.12, -0.712, 0.03, 0.011, 12);
  // The angle shown magnified in the inset (superior iridocorneal angle).
  var ANG = V(X0, 0.735, 0.98), ANG_H = 0.13, INSET_K = 4.1;
  var ROT = [0.1, -0.38];
  var NOCLIP = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5);
  var DISC = [0.265, 0.333], FOV = [-0.06, 0.05], RV = 1.06;

  function geoOf(part) { var m = Kit.meshPart(new THREE.Group(), 'eye', part, Kit.tissue('bone')); m.material.dispose(); return m.geometry; }
  // Places a flat disc (facing +z) at p on the inner retinal surface, facing the eye centre.
  function face(m, p) { m.position.copy(p); m.quaternion.setFromUnitVectors(V(0, 0, 1), p.clone().negate().normalize()); }
  function onRetina(x, y, r) { return V(x, y, -Math.sqrt(Math.max(0.01, (r || RV) * (r || RV) - x * x - y * y))); }

  // Builds the whole eye into group E. roles: each mesh gets userData.clip = 'cut' | 'nerve' | 'cap'.
  function buildEye(E, c) {
    var meshes = [];
    function keep(m, role) { m.userData.clip = role; meshes.push(m); return m; }
    // Cut surfaces are matte: no clearcoat or sheen (also cheaper to shade on software GL).
    function cap(geo, kind, opts) { var m = new THREE.Mesh(geo, Kit.tissue(kind, Object.assign({ clearcoat: 0, sheen: 0 }, opts || {}))); E.add(m); return keep(m, 'cap'); }
    function solid(geo, kind, opts, role) { var m = new THREE.Mesh(geo, Kit.tissue(kind, opts || {})); E.add(m); return keep(m, role || 'cut'); }
    var NX = V(1, 0, 0);
    function partCap(geo, off, shell) { return capGeometry(geo, NX, X0, off, shell); }

    // Sclera: a single surface in Z-Anatomy, so its section is drawn as a band 0.65 mm thick.
    var scl = keep(Kit.meshPart(E, 'eye', 'sclera', Kit.tissue('sclera')), 'cut');
    cap(partCap(scl.geometry, 0.004, { t: 0.065, c: V(0, 0, 0) }), 'sclera', { roughness: 0.55 });
    var cor = keep(Kit.meshPart(E, 'eye', 'cornea', Kit.tissue('cornea', { opacity: 0.3 })), 'cut');
    cap(partCap(cor.geometry, 0.004), 'cornea', { opacity: 0.7, color: 0xcfe6f5 });

    // Retina (and, for detachment, the lifted retina with subretinal fluid beneath it).
    var retG = geoOf('retina');
    var retCol = c === 'cra' ? 0xd8bea2 : 0xd9744f, retOpts = { color: retCol };
    var lift = function () { return 0; };
    if (c === 'rd') {
      // Superior bullous detachment: lifted up to 3.4 mm, still attached at the ora serrata
      // and at the disc; a horseshoe tear near its anterior edge in the kept half.
      lift = function (p) {
        var d = p.clone().normalize();
        var w = smooth(0.42, 0.9, d.y) * (1 - smooth(0.3, 0.6, p.z)) * smooth(-1.0, -0.55, p.z);
        return 0.34 * w;
      };
      var tearDir = V(0.38, 0.88, 0.28).normalize();
      var detG = deformed(retG, function (p) { var l = lift(p); if (l) p.sub(p.clone().normalize().multiplyScalar(l)); });
      // Subretinal fluid: a shell from the choroid (retina outer surface) to the lifted retina;
      // its inner surface collapses onto the outer one where the retina is attached.
      var fluG = deformed(retG, function (p, nrm) {
        var d = p.clone().normalize();
        if (nrm.dot(d) < 0) p.add(d.multiplyScalar(0.1 - lift(p)));
      });
      // Cut the tear (a gap in the lifted retina).
      var ix = detG.index.array, keepIdx = [], q = V(0, 0, 0), pa = detG.attributes.position;
      for (var t = 0; t < ix.length; t += 3) {
        q.set(0, 0, 0);
        for (var j = 0; j < 3; j++) q.add(V(0, 0, 0).fromBufferAttribute(pa, ix[t + j]));
        if (q.normalize().dot(tearDir) < 0.992) keepIdx.push(ix[t], ix[t + 1], ix[t + 2]);
      }
      var full = detG.clone(); full.userData = {};
      detG.setIndex(keepIdx);
      solid(fluG, 'lens', { color: 0xf2cf5a, opacity: 0.93 });
      // Its section: the outer edge of the retina's section where it is lifted, and that edge
      // moved in by the lift.
      var rl = [];
      capGeometry(retG, NX, X0, 0, null, rl).dispose();
      rl.forEach(function (loop) {
        var run = [], best = [];
        loop.concat(loop).forEach(function (p) {
          if (p.length() > 1.14 && lift(p) > 0.004) run.push(p);
          else { if (run.length > best.length) best = run; run = []; }
        });
        if (run.length > best.length) best = run;
        if (best.length < 3) return;
        var poly = best.concat(best.slice().reverse().map(function (p) { return p.clone().sub(p.clone().normalize().multiplyScalar(lift(p) + 0.01)); }));
        cap(polyCap(poly.map(function (p) { return [p.z, p.y]; }), 0.005), 'lens', { color: 0xf0c64a, clearcoat: 0.6, emissive: 0x5a4000, emissiveIntensity: 0.25 });
      });
      solid(detG, 'retina', retOpts);
      cap(partCap(full, 0.007), 'retina', retOpts);
      full.dispose();
    } else {
      solid(retG, 'retina', retOpts);
      cap(partCap(retG, 0.006), 'retina', retOpts);
    }
    // Choroid (not in Z-Anatomy): the retina shell grown 6% fills the gap under the sclera.
    // Only its section is visible (the sclera hides it outside, the retina inside).
    var chc = cap(capGeometry(retG, NX, X0 / 1.06, 0.002), 'choroid', {});
    chc.scale.setScalar(1.06);
    // Ciliary body, trabecular meshwork, canal of Schlemm (procedural, fitted to the meshes).
    solid(sweep(CIL_TOP, CIL_BOT, 48), 'choroid', { color: 0x6e3226, roughness: 0.7 });
    cap(polyCap(CIL_TOP, 0.0045), 'choroid', { color: 0x7a3a2c });
    cap(polyCap(CIL_BOT, 0.0045), 'choroid', { color: 0x7a3a2c });
    var tmKind = c === 'ac' ? { color: 0xe0352b, emissive: 0x8a1010, emissiveIntensity: 0.6 } : { color: 0x48c9b0, emissive: 0x13584c, emissiveIntensity: 0.5 };
    solid(sweep(TM_TOP, TM_BOT, 48), 'retina', tmKind);
    cap(polyCap(TM_TOP, 0.0095), 'retina', tmKind);
    cap(polyCap(TM_BOT, 0.0095), 'retina', tmKind);
    solid(sweep(SC_TOP, SC_BOT, 48), 'vessel-vein', { color: 0x40548a });
    cap(polyCap(SC_TOP, 0.006), 'vessel-vein', { color: 0x2c3a66 });
    cap(polyCap(SC_BOT, 0.006), 'vessel-vein', { color: 0x2c3a66 });

    // Iris: in angle closure the peripheral iris bows forward (iris bombe) onto the meshwork.
    var irisG = geoOf('iris');
    if (c === 'ac') {
      // t: 0 at the pupil margin, 1 at the iris root (the Z-Anatomy pupil is not centred).
      irisG = deformed(irisG, function (p) {
        var dx = p.x + 0.06, dy = p.y - 0.035, r = Math.hypot(dx, dy) || 1e-6;
        var w = (1 - dy / r) / 2, rp = 0.435 * (1 - w) + 0.155 * w, rr = 0.655 * (1 - w) + 0.625 * w;
        var t = Math.max(0, Math.min(1.05, (r - rp) / (rr - rp)));
        var dz = 0.085 * smooth(0, 0.5, t) * (1 - 0.15 * smooth(0.9, 1, t)), dr = 0.075 * smooth(0.55, 0.95, t);
        p.x += dx / r * dr; p.y += dy / r * dr; p.z += dz;
      });
    }
    solid(irisG, 'iris', {});
    cap(partCap(irisG, 0.008), 'iris', { color: 0x4f6f96 });
    var lens = keep(Kit.meshPart(E, 'eye', 'lens', Kit.tissue('lens', { opacity: 0.5 })), 'cut');
    cap(partCap(lens.geometry, 0.008), 'lens', { opacity: 0.6, color: 0xf4f2e4, clearcoat: 0.9, emissive: 0x30302a, emissiveIntensity: 0.3 });
    // Vitreous and aqueous: only their sections are drawn (clear gel and fluid).
    cap(partCap(geoOf('vitreous'), 0.001), 'air', { opacity: 0.1, color: 0xd5ece4 });
    cap(partCap(geoOf('anterior_chamber'), 0.001), 'air', { opacity: c === 'ac' ? 0.06 : 0.14, color: 0xbfe3ff });

    // Optic nerve: the Z-Anatomy tract (clipped at the globe) inside a procedural dural sheath.
    keep(Kit.meshPart(E, 'eye', 'optic_nerve', Kit.tissue('nerve')), 'nerve');
    var path = new THREE.CatmullRomCurve3([V(0.27, 0.33, -1.0), V(0.31, 0.345, -1.2), V(0.46, 0.42, -1.5), V(0.67, 0.52, -1.8), V(0.9, 0.67, -2.1), V(1.3, 0.9, -2.5)]);
    solid(new THREE.TubeGeometry(path, 40, 0.16, 18, false), 'fascia', { opacity: 0.6, color: 0xf3ead8 }, 'nerve');
    // Optic disc, retinal vessels and macula on the inner surface of the kept half.
    var dp = onRetina(DISC[0], DISC[1], 1.068);
    var disc = solid(new THREE.CircleGeometry(0.075, 28), 'nerve', { color: c === 'cra' ? 0xf4e7cf : 0xf3d7a8, emissive: 0x3a2a10, emissiveIntensity: 0.2 });
    face(disc, dp);
    var cup = solid(new THREE.CircleGeometry(0.03, 20), 'nerve', { color: 0xfff6e0 });
    face(cup, onRetina(DISC[0], DISC[1], 1.064));
    var art = c === 'cra' ? 0.0055 : 0.011, vein = 0.014;
    var arcs = [
      [[0.24, 0.4], [0.2, 0.58], [0.06, 0.76], [-0.14, 0.86]],
      [[0.24, 0.27], [0.2, 0.08], [0.06, -0.2], [-0.14, -0.4]],
      [[0.3, 0.38], [0.45, 0.52], [0.62, 0.66], [0.74, 0.72]],
      [[0.31, 0.3], [0.47, 0.2], [0.66, 0.02], [0.78, -0.12]],
      [[0.3, 0.33], [0.5, 0.36], [0.72, 0.36], [0.9, 0.34]],
    ];
    arcs.forEach(function (a, i) {
      var pts = [[DISC[0], DISC[1]]].concat(a);
      var va = pts.map(function (p) { return onRetina(p[0] + 0.025, p[1] + 0.02, RV - 0.004); });
      var aa = pts.map(function (p) { return onRetina(p[0], p[1], RV - 0.008); });
      solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(va), 40, vein, 8, false), 'vessel-vein', { color: 0x6a1f2a });
      if (c === 'cra') {
        // Attenuated arteries with segmented ("box-car") flow.
        var cv = new THREE.CatmullRomCurve3(aa);
        for (var s = 0; s < 8; s++) {
          var sub = []; for (var u = 0; u <= 4; u++) sub.push(cv.getPoint((s + u * 0.12) / 8));
          solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sub), 6, art, 6, false), 'vessel-artery', { color: 0xb84a40 });
        }
      } else {
        solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(aa), 40, art, 8, false), 'vessel-artery', { color: 0xc8382c });
      }
    });
    // Macula and fovea: on the inner surface and as a mark on the retinal section.
    var mac = solid(new THREE.CircleGeometry(c === 'cra' ? 0.1 : 0.11, 28), 'retina', c === 'cra'
      ? { color: 0xd01818, emissive: 0x7a0808, emissiveIntensity: 0.7 } : { color: 0x8c3a1e, opacity: 0.75 });
    face(mac, onRetina(FOV[0], FOV[1], RV + 0.008));
    var fov = cap(new THREE.CircleGeometry(c === 'cra' ? 0.065 : 0.04, 24), 'retina', c === 'cra'
      ? { color: 0xd01818, emissive: 0x900808, emissiveIntensity: 0.8 } : { color: 0x7a2e14 });
    fov.position.set(X0 - 0.011, FOV[1], -1.11); fov.rotation.y = -Math.PI / 2; fov.scale.set(1, 1, 1);
    if (c === 'cra') {
      // Embolus (e.g. a cholesterol Hollenhorst plaque) lodged in the central retinal artery at the disc.
      var emb = solid(new THREE.SphereGeometry(0.022, 14, 10), 'highlight', { color: 0xfff2a0, emissive: 0xc9a000, emissiveIntensity: 0.6 });
      emb.position.copy(onRetina(DISC[0], DISC[1] + 0.01, 1.05));
    }
    return { meshes: meshes, discPos: dp };
  }

  // Keeps only the triangles of each mesh of group G that come near box (eye coordinates), so
  // the magnified inset does not rasterise the whole eye at 4x (slow on software GL).
  function cropTo(G, box) {
    var inv = new THREE.Matrix4(), lb = new THREE.Box3(), v = V(0, 0, 0);
    G.children.slice().forEach(function (m) {
      if (!m.isMesh) return;
      m.updateMatrix();
      lb.copy(box).applyMatrix4(inv.copy(m.matrix).invert()).expandByScalar(0.03);
      var geo = m.geometry, pos = geo.attributes.position, idx = geo.index, keepI = [], map = {}, np = [], nn = [];
      var nor = geo.attributes.normal, T = idx ? idx.count / 3 : pos.count / 3;
      for (var t = 0; t < T; t++) {
        var tri = idx ? [idx.getX(3 * t), idx.getX(3 * t + 1), idx.getX(3 * t + 2)] : [3 * t, 3 * t + 1, 3 * t + 2];
        var hit = tri.some(function (k) { return lb.containsPoint(v.fromBufferAttribute(pos, k)); });
        if (!hit) continue;
        tri.forEach(function (k) {
          if (map[k] === undefined) {
            map[k] = np.length / 3;
            np.push(pos.getX(k), pos.getY(k), pos.getZ(k));
            if (nor) nn.push(nor.getX(k), nor.getY(k), nor.getZ(k));
          }
          keepI.push(map[k]);
        });
      }
      if (!(geo.userData && geo.userData.kitShared)) geo.dispose();
      if (!keepI.length) { G.remove(m); m.material.dispose(); return; }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(np, 3));
      if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
      g.setIndex(keepI);
      m.geometry = g;
    });
  }

  Kit.register({
    id: 'eye',
    meshes: ['eye'],
    center: [0.12, 0.37, 0],
    zoom: 8.4,
    rot: ROT,
    controls: [{ k: 'c', label: 'Condition', def: 'norm', opts: [
      ['norm', 'Normal anatomy'],
      ['ac', 'Acute angle-closure glaucoma'],
      ['rd', 'Retinal detachment'],
      ['cra', 'Central retinal artery occlusion'],
    ] }],
    build: function (g, st) {
      var c = st.c, S = 1.4;
      // Main eye: anterior points right (+x on screen), the section faces the viewer.
      var E = new THREE.Group(); E.scale.setScalar(S); E.rotation.y = Math.PI / 2; g.add(E); E.updateMatrix();
      var main = buildEye(E, c);
      // Inset: the superior iridocorneal angle magnified INSET_K times, cropped to a box.
      // It is turned against the default view so that it faces the camera squarely.
      var I = new THREE.Group(); I.scale.setScalar(S * INSET_K);
      I.quaternion.setFromEuler(new THREE.Euler(ROT[0], ROT[1], 0)).invert()
        .multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2));
      I.updateMatrix();
      var T = V(2.62, 1.82, -X0 * S);
      I.position.copy(T).sub(ANG.clone().applyMatrix4(I.matrix));
      g.add(I); I.updateMatrix();
      buildEye(I, c);
      cropTo(I, new THREE.Box3(V(X0 - 0.05, ANG.y - ANG_H, ANG.z - ANG_H), V(X0 + 0.15, ANG.y + ANG_H, ANG.z + ANG_H)));
      // Local clipping planes: [plane in eye coordinates, group, world copy].
      var planes = [];
      function P(nx, ny, nz, cst, grp) { var p = new THREE.Plane(V(nx, ny, nz), cst); var w = p.clone(); planes.push([p, grp, w]); return w; }
      var cutE = P(1, 0, 0, -X0, E);
      var nerveA = P(0, 0, -1, -1.08, E), nerveB = P(0, 0, 1, 2.6, E);
      var cutI = P(1, 0, 0, -X0, I);
      var box = [P(0, 1, 0, -(ANG.y - ANG_H), I), P(0, -1, 0, ANG.y + ANG_H, I), P(0, 0, 1, -(ANG.z - ANG_H), I), P(0, 0, -1, ANG.z + ANG_H, I), P(-1, 0, 0, X0 + 0.1, I)];
      // Every material gets exactly six planes (padded with planes that clip nothing) so all
      // meshes of one tissue share one shader program: compiling is slow on software GL.
      function six(list) { list = list.slice(); while (list.length < 6) list.push(NOCLIP); return list; }
      main.meshes.forEach(function (m) {
        var r = m.userData.clip;
        m.material.clippingPlanes = six(r === 'cap' ? [] : r === 'nerve' ? [cutE, nerveA, nerveB] : [cutE]);
      });
      I.traverse(function (m) {
        if (!m.isMesh) return;
        m.material.clippingPlanes = six(m.userData.clip === 'cap' ? box.slice(0, 4) : [cutI].concat(box));
      });
      // Inset frame, dark backing and the marker on the real angle.
      var gold = Kit.tissue('highlight', { color: 0xffd23f, emissiveIntensity: 0.8 });
      var y0 = ANG.y - ANG_H, y1 = ANG.y + ANG_H, z0 = ANG.z - ANG_H, z1 = ANG.z + ANG_H, fx = X0 - 0.012;
      var fr = new THREE.CatmullRomCurve3([V(fx, y0, z0), V(fx, y1, z0), V(fx, y1, z1), V(fx, y0, z1)], true, 'catmullrom', 0);
      I.add(new THREE.Mesh(new THREE.TubeGeometry(fr, 64, 0.0035, 6, true), gold));
      var back = new THREE.Mesh(new THREE.PlaneGeometry(2 * ANG_H, 2 * ANG_H), new THREE.MeshBasicMaterial({ color: 0x161c25, side: THREE.DoubleSide }));
      back.position.set(X0 + 0.1, ANG.y, ANG.z); back.rotation.y = Math.PI / 2; I.add(back);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(ANG_H * 0.8, 0.008, 6, 40), gold);
      ring.position.set(X0 - 0.02, ANG.y, ANG.z); ring.rotation.y = Math.PI / 2; E.add(ring);
      function W(grp, x, y, z) { return V(x, y, z).applyMatrix4(grp.matrix).toArray(); }
      var a0 = V(X0 - 0.02, ANG.y + ANG_H * 0.57, ANG.z + ANG_H * 0.57).applyMatrix4(E.matrix);
      var a1 = V(fx, y0, z0).applyMatrix4(I.matrix);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(a0, a1), 2, 0.012, 6, false), gold));

      var L = [
        { t: 'Cornea', p: W(E, X0, 0.35, 1.43) },
        { t: 'Iris / pupil', p: W(E, X0, -0.42, 1.02) },
        { t: 'Lens', p: W(E, X0, 0.05, 0.8) },
        { t: 'Anterior chamber', p: W(E, X0, 0.12, 1.2) },
        { t: 'Vitreous', p: W(E, X0, -0.3, -0.3) },
        { t: 'Retina', p: W(E, X0, -0.79, -0.79) },
        { t: 'Choroid', p: W(E, X0, -0.6, -1.07) },
        { t: 'Sclera', p: W(E, X0, -1.21, 0.38) },
        { t: 'Macula / fovea', p: W(E, X0, FOV[1], -1.11) },
        { t: 'Optic disc / nerve', p: W(E, 0.46, 0.42, -1.5) },
        { t: 'Trabecular meshwork / canal of Schlemm', p: W(I, X0, ANG.y + ANG_H * 1.12, ANG.z - ANG_H * 0.75) },
        { t: 'Ciliary body', p: W(E, X0, -0.85, 0.86) },
        { t: c === 'ac' ? 'Angle closed by the iris' : 'Iridocorneal angle (open)', p: W(I, X0, ANG.y - ANG_H * 1.12, ANG.z - ANG_H * 0.75) },
      ];
      if (c === 'rd') {
        L.push({ t: 'Detached retina', p: W(E, X0, 0.88, -0.1) }, { t: 'Subretinal fluid', p: W(E, X0, 1.06, 0.15) });
      }
      if (c === 'cra') L.push({ t: 'Embolus at the disc', p: main.discPos.clone().applyMatrix4(E.matrix).toArray() });
      var infos = {
        norm: '<ul><li>Light path: cornea → aqueous (anterior chamber) → pupil → lens → vitreous → retina (macula/fovea for central vision).</li><li>Aqueous is made by the ciliary body, passes through the pupil, and drains through the <b>trabecular meshwork / canal of Schlemm</b> at the iridocorneal angle (magnified in the inset).</li><li>Sagittal cutaway of a real right eye (Z-Anatomy), front to the right; the choroid and ciliary body are drawn in. Rotate to look at the optic disc and retinal vessels inside.</li></ul>',
        ac: '<ul><li><b>Acute angle-closure</b>: the peripheral iris bows forward against the trabecular meshwork (red, inset), blocking aqueous drainage → rapid IOP rise.</li><li>Painful red eye, halos, headache, nausea/vomiting, <b>mid-dilated fixed pupil</b>, hazy cornea. An emergency.</li><li>Treat: lower IOP (acetazolamide, topical beta-blocker, alpha agonist, pilocarpine once IOP falls) then laser peripheral iridotomy. Avoid mydriatics.</li></ul>',
        rd: '<ul><li><b>Rhegmatogenous retinal detachment</b> (most common; tractional and exudative types have no tear): fluid passes through a tear and separates the neurosensory retina from the pigment epithelium/choroid (superior retina shown lifted, yellow subretinal fluid beneath, tear at its front edge).</li><li>Flashes, new floaters, then a “curtain” over part of the visual field; painless.</li><li>Emergency: laser/cryo for tears; pneumatic retinopexy, scleral buckle or vitrectomy for detachment.</li></ul>',
        cra: '<ul><li><b>Central retinal artery occlusion</b>: sudden, painless monocular vision loss.</li><li>The retina turns pale (ischemic) while the fovea stays red: <b>cherry-red spot</b>, because it is supplied by the choroid. Arteries are thin, with segmented flow.</li><li>Embolic source (carotid, heart); consider giant cell arteritis. Ocular emergency.</li></ul>',
      };
      return {
        labels: L,
        info: infos[c],
        update: function () {
          planes.forEach(function (p) { p[1].updateWorldMatrix(true, false); p[2].copy(p[0]).applyMatrix4(p[1].matrixWorld); });
        },
      };
    },
  });
})();
