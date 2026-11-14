// Aortic dissection.
// External view: the real aorta and its branches (Z-Anatomy / BodyParts3D, baked into
// meshes/aorta.js) with a translucent wall, and a procedural intimal flap and false lumen swept
// along the vessel's own centreline from the entry tear (Stanford A or B).
// Intimal view: a histology-style (H&E) cross-section of the wall, drawn procedurally: intima,
// media with elastic lamellae and smooth-muscle nuclei, adventitia with vasa vasorum, and a
// spiralling flap with a blood-filled false lumen in the outer third of the media.
(function () {
  var h = Kit.helpers, V = h.V;
  var TAU = Math.PI * 2;

  // Centreline of the Z-Anatomy aorta (ascending -> arch -> thoracic -> abdominal), resampled at
  // 1 cm along its length: [x, y, z, radius] in the frame of meshes/aorta.js (cm, +x left,
  // +y superior, +z anterior). Read off the swept-curve rings of the source objects.
  var CL = [[2.01,8.60,0.23,1.50],[1.33,9.25,0.58,1.50],[0.78,9.95,1.04,1.50],[0.54,10.91,1.25,1.47],[0.53,11.92,1.31,1.43],[0.63,12.93,1.17,1.40],[0.82,13.86,0.82,1.37],[1.14,14.62,0.22,1.33],[1.49,15.14,-0.57,1.29],[1.79,15.38,-1.51,1.26],[1.98,15.32,-2.50,1.22],[2.04,14.93,-3.43,1.19],[2.01,14.26,-4.20,1.15],[1.98,13.43,-4.79,1.12],[2.00,12.52,-5.25,1.10],[2.04,11.54,-5.51,1.09],[2.07,10.53,-5.56,1.08],[2.09,9.51,-5.45,1.07],[2.08,8.51,-5.28,1.06],[2.04,7.50,-5.12,1.05],[1.94,6.51,-4.92,1.04],[1.80,5.55,-4.62,1.03],[1.64,4.61,-4.27,1.02],[1.50,3.65,-3.95,1.01],[1.38,2.67,-3.69,1.00],[1.26,1.68,-3.49,0.99],[1.15,0.68,-3.33,0.98],[1.06,-0.32,-3.17,0.97],[0.99,-1.32,-2.97,0.96],[0.95,-2.30,-2.70,0.95],[0.94,-3.26,-2.37,0.94],[0.97,-4.20,-1.98,0.93],[1.02,-5.13,-1.56,0.92],[1.06,-6.06,-1.16,0.91],[1.07,-7.02,-0.80,0.90],[1.03,-7.99,-0.50,0.90],[0.97,-8.97,-0.25,0.90],[0.90,-9.96,-0.01,0.90],[0.83,-10.96,0.21,0.90],[0.80,-11.95,0.42,0.90],[0.78,-12.94,0.66,0.90],[0.78,-13.93,0.88,0.90],[0.77,-14.94,1.02,0.90],[0.76,-15.96,1.02,0.90],[0.74,-16.98,0.97,0.90],[0.69,-17.98,1.10,0.90],[0.61,-18.98,1.31,0.90],[0.59,-19.98,1.45,0.90]];
  // Arc length (cm from the aortic valve) of landmarks on that centreline.
  var S_LSA = 10.2;   // left subclavian origin
  var S_END = 45.5;   // dissection runs down to just above the bifurcation (DeBakey I / IIIb)
  // Direction the false lumen faces, by arc length (spirals: right-anterior in the ascending
  // aorta, greater curvature of the arch, posterolateral left in the descending, left lateral at
  // the renal arteries, so the left renal artery comes off the false lumen).
  var FL_DIR = [[0, 0.55, 0, 1], [6, 0.2, 0.4, 1], [10, 0, 1, 0.2], [12, 1, 0.6, -0.3], [16, 0.8, 0.3, -0.7], [25, 0.45, 0, -1], [33, 1, 0, -0.3], [40, 1, 0, 0.1], [47, 0.8, 0, 0.6]];

  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function lerpKeys(keys, s) {
    if (s <= keys[0][0]) return keys[0].slice(1);
    for (var i = 1; i < keys.length; i++) {
      if (s <= keys[i][0]) {
        var a = keys[i - 1], b = keys[i], t = (s - a[0]) / (b[0] - a[0]);
        return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
      }
    }
    return keys[keys.length - 1].slice(1);
  }

  // Centreline curve parametrised by arc length (cm).
  var curve = null, CL_LEN = 0;
  function centre() {
    if (!curve) {
      curve = new THREE.CatmullRomCurve3(CL.map(function (p) { return V(p[0], p[1], p[2]); }), false, 'centripetal');
      CL_LEN = curve.getLength();
    }
    return curve;
  }
  function radiusAt(s) {
    var i = Math.max(0, Math.min(CL.length - 2, Math.floor(s))), t = Math.max(0, Math.min(1, s - i));
    return CL[i][3] + (CL[i + 1][3] - CL[i][3]) * t;
  }
  // Point, tangent and the false-lumen frame (n towards the false lumen, b = t x n) at arc length s.
  function frameAt(s) {
    var c = centre(), u = Math.max(0, Math.min(1, s / CL_LEN));
    var p = c.getPointAt(u), t = c.getTangentAt(u).normalize();
    var d = lerpKeys(FL_DIR, s), n = V(d[0], d[1], d[2]);
    n.addScaledVector(t, -n.dot(t)).normalize();
    return { p: p, t: t, n: n, b: new THREE.Vector3().crossVectors(t, n), r: radiusAt(s) };
  }

  // Sweep a cross-section profile along the centreline. profile(s, fr) returns [[angle, radius]...]
  // (angle from n towards b). closed: join the last profile point to the first.
  function sweep(s0, s1, rows, profile, closed) {
    var pos = [], idx = [], cols = 0;
    for (var i = 0; i <= rows; i++) {
      var s = s0 + (s1 - s0) * i / rows, fr = frameAt(s), pr = profile(s, fr);
      cols = pr.length;
      pr.forEach(function (q) {
        var ca = Math.cos(q[0]), sa = Math.sin(q[0]);
        pos.push(fr.p.x + q[1] * (ca * fr.n.x + sa * fr.b.x), fr.p.y + q[1] * (ca * fr.n.y + sa * fr.b.y), fr.p.z + q[1] * (ca * fr.n.z + sa * fr.b.z));
      });
    }
    var jn = closed ? cols : cols - 1;
    for (i = 0; i < rows; i++) {
      for (var j = 0; j < jn; j++) {
        var a = i * cols + j, b = i * cols + (j + 1) % cols, c = a + cols, d = b + cols;
        idx.push(a, c, b, b, c, d);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }

  // A copy of a baked part keeping only the triangles that pass keep(x, y, z) (all three corners).
  // The shared geometry is never modified.
  function trimmedPart(group, part, material, keep) {
    var src = Kit.meshPart(new THREE.Group(), 'aorta', part, material).geometry;
    var P = src.attributes.position.array, I = src.index.array, map = {}, pos = [], idx = [];
    function vid(k) {
      if (map[k] === undefined) { map[k] = pos.length / 3; pos.push(P[3 * k], P[3 * k + 1], P[3 * k + 2]); }
      return map[k];
    }
    for (var t = 0; t < I.length; t += 3) {
      var ok = true;
      for (var e = 0; e < 3; e++) { var k = I[t + e]; if (!keep(P[3 * k], P[3 * k + 1], P[3 * k + 2])) ok = false; }
      if (ok) idx.push(vid(I[t]), vid(I[t + 1]), vid(I[t + 2]));
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    var me = new THREE.Mesh(geo, material); group.add(me); return me;
  }

  // Nearest centreline sample to a point: its index (about the arc length in cm) and distance.
  function nearCL(x, y, z) {
    var best = 1e9, bi = 0;
    for (var i = 0; i < CL.length; i++) {
      var dx = x - CL[i][0], dy = y - CL[i][1], dz = z - CL[i][2], d = dx * dx + dy * dy + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    return { i: bi, d: Math.sqrt(best) };
  }

  /* ---------------- external view ---------------- */
  function buildExternal(g, st) {
    var A = st.t === 'A';
    centre();
    var S = 0.15;
    var body = new THREE.Group();
    body.scale.setScalar(S);
    body.rotation.set(0.06, -1.1, 0);          // left anterior oblique: the arch opens out
    body.position.set(0, 0.12, 0);
    g.add(body);
    body.updateMatrix();
    var toG = function (v) { return v.clone().applyMatrix4(body.matrix); };
    var arr = function (v) { return [v.x, v.y, v.z]; };

    // Context: a faint outline of the heart the aortic root arises from.
    var heart = Kit.meshPart(body, 'aorta', 'heart', Kit.tissue('myocardium', { opacity: 0.1, depthWrite: false }));
    heart.renderOrder = 1;
    // Branches (opaque), the arch vessels cut short so the whole aorta fits.
    var art = function () { return Kit.tissue('vessel-artery', { color: 0xc8443a }); };
    // Clip planes live in the mesh frame and follow the model as it is turned (see update()).
    var clips = [[new THREE.Plane(V(0, -1, 0), 19), null], [new THREE.Plane(V(0, 1, 0), 22.5), null]];
    clips.forEach(function (c) { c[1] = c[0].clone(); });
    Kit.meshPart(body, 'aorta', 'arch_branches', Kit.tissue('vessel-artery', { color: 0xc8443a, clippingPlanes: [clips[0][1]] }));
    Kit.meshPart(body, 'aorta', 'iliac', Kit.tissue('vessel-artery', { color: 0xc8443a, clippingPlanes: [clips[1][1]] }));
    var update = function () {
      body.updateMatrixWorld(true);
      clips.forEach(function (c) { c[1].copy(c[0]).applyMatrix4(body.matrixWorld); });
    };
    // Visceral branches (coeliac, SMA, renals) kept as their first few centimetres.
    trimmedPart(body, 'visceral_branches', art(), function (x, y, z) { return y > -15.5 && nearCL(x, y, z).d < 2.9; });
    // The aortic wall: see-through, so the blood in the true and false lumens shows. The source
    // tubes' end caps (on the centreline) are dropped so segment joins do not show as rings, and
    // the first 2 cm are replaced by the root with its sinus bulge (the source tube has none).
    var wallMat = function () { return Kit.tissue('vessel-artery', { color: 0xf0a49a, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.15, roughness: 0.25 }); };
    var wall = trimmedPart(body, 'aorta', wallMat(), function (x, y, z) { var c = nearCL(x, y, z); return c.d > 0.6 && c.i >= 2; });
    wall.renderOrder = 2;
    function rootR(s, fr) { return fr.r * (1 + 0.16 * Math.sin(Math.PI * Math.min(s, 2.2) / 2.2)); }
    // Aortic valve: three semilunar cusps closing the root.
    var f0 = frameAt(0.05), valve = new THREE.Group();
    add(valve, new THREE.CircleGeometry(f0.r * 0.98, 48), Kit.tissue('vessel-artery', { color: 0xf1d9c8, roughness: 0.5 }));
    for (var c = 0; c < 3; c++) {
      var ca = TAU * c / 3 + 0.4;
      var line = add(valve, new THREE.PlaneGeometry(f0.r * 0.98, 0.07), Kit.tissue('vessel-artery', { color: 0x8a3a30 }));
      line.position.set(Math.cos(ca) * f0.r * 0.49, Math.sin(ca) * f0.r * 0.49, -0.01); line.rotation.z = ca;
    }
    valve.position.copy(f0.p);
    valve.quaternion.setFromUnitVectors(V(0, 0, -1), f0.t);
    body.add(valve);
    var root = add(body, sweep(0, 2.3, 16, function (s, fr) {
      var out = [], r = rootR(s, fr);
      for (var j = 0; j < 36; j++) out.push([TAU * j / 36, r]);
      return out;
    }, true), wallMat());
    root.renderOrder = 2;

    // Dissection, swept along the real centreline from the entry tear: blood in the true lumen
    // (bright) and the false lumen (dark), the intimal flap between them, and the flap's lines of
    // attachment to the wall, which spiral down the vessel.
    var s0 = A ? 2.8 : S_LSA + 1.6, s1 = S_END;
    var K = 18, ALPHA = 1.75, DEPTH = 0.5, RO = 0.9;
    function alphaAt(s) { return ALPHA * smooth((s - s0) / 1.2) * smooth((s1 - s) / 3); }
    function flapR(fr, a, q) { return RO * fr.r * (1 - DEPTH * (a / ALPHA) * Math.cos(Math.PI / 2 * q / Math.max(a, 1e-4))); }
    var tlMat = Kit.tissue('blood-oxy', { color: 0xd23a30, roughness: 0.35 });
    var flMat = Kit.tissue('blood-deoxy', { color: 0x4a0c1c, roughness: 0.5, clearcoat: 0.4 });
    var flapMat = Kit.tissue('vessel-artery', { color: 0xf6e2d6, roughness: 0.4, emissive: 0x3a2620 });
    var full = function (rf) {
      return function (s, fr) { var out = [], r = rf ? rf(s, fr) : fr.r; for (var j = 0; j < 32; j++) out.push([TAU * j / 32, r * RO]); return out; };
    };
    // undissected blood column above and below
    add(body, sweep(0, s0, Math.round(s0 * 4) + 4, full(function (s, fr) { return s < 2.3 ? rootR(s, fr) : fr.r; }), true), tlMat);
    add(body, sweep(s1, CL_LEN, Math.round((CL_LEN - s1) * 4) + 2, full(null), true), tlMat);
    var rows = Math.round((s1 - s0) * 5);
    add(body, sweep(s0, s1, rows, function (s, fr) {        // true lumen
      var a = alphaAt(s), out = [], j, q;
      for (j = 0; j <= 2 * K; j++) { q = a + (TAU - 2 * a) * j / (2 * K); out.push([q, RO * fr.r]); }
      for (j = 1; j < K; j++) { q = -a + 2 * a * j / K; out.push([q, flapR(fr, a, q) - 0.035 * fr.r]); }
      return out;
    }, true), tlMat);
    add(body, sweep(s0, s1, rows, function (s, fr) {        // false lumen
      var a = alphaAt(s), out = [], j, q;
      for (j = 0; j <= K; j++) { q = -a + 2 * a * j / K; out.push([q, RO * fr.r]); }
      for (j = K - 1; j > 0; j--) { q = -a + 2 * a * j / K; out.push([q, flapR(fr, a, q) + 0.035 * fr.r]); }
      return out;
    }, true), flMat);
    add(body, sweep(s0, s1, rows, function (s, fr) {        // intimal flap
      var a = alphaAt(s), out = [];
      for (var j = 0; j <= K; j++) { var q = -a + 2 * a * j / K; out.push([q, flapR(fr, a, q)]); }
      return out;
    }, false), flapMat);
    [-1, 1].forEach(function (sg) {                          // lines of attachment
      var pts = [];
      for (var i = 0; i <= 120; i++) {
        var s = s0 + (s1 - s0) * i / 120, fr = frameAt(s), q = sg * alphaAt(s), r = RO * fr.r * 1.01;
        pts.push(fr.p.clone().addScaledVector(fr.n, r * Math.cos(q)).addScaledVector(fr.b, r * Math.sin(q)));
      }
      add(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.09, 8, false), flapMat);
    });

    // Entry tear: a transverse slit in the intima, outlined on the wall where the flap begins.
    var sT = s0 + 0.7, ft = frameAt(sT);
    var tearG = toG(ft.p.clone().addScaledVector(ft.n, ft.r));
    var slit = [];
    for (var k = 0; k <= 48; k++) {
      var th = TAU * k / 48, fs = frameAt(sT + 0.45 * Math.sin(th)), q = 0.75 * Math.cos(th), rr = fs.r * 1.02;
      slit.push(fs.p.clone().addScaledVector(fs.n, rr * Math.cos(q)).addScaledVector(fs.b, rr * Math.sin(q)));
    }
    add(body, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(slit, true), 96, 0.13, 8, true), Kit.tissue('highlight'));

    // Labels sit on the structures they name.
    var sFL = A ? 6 : 20, sTL = A ? 24 : 28;
    var fl = frameAt(sFL), tl = frameAt(sTL);
    var L = [
      { t: 'Entry tear (intimal)', p: arr(tearG) },
      { t: 'False lumen', p: arr(toG(fl.p.clone().addScaledVector(fl.n, fl.r * 0.75))) },
      { t: 'True lumen', p: arr(toG(tl.p.clone().addScaledVector(tl.n, -tl.r * 0.55))) },
      { t: 'Aortic root / valve', p: arr(toG(frameAt(0.6).p)) },
      { t: 'Arch branches', p: arr(toG(V(1.6, 19.2, -1.2))) },
      { t: 'Descending aorta', p: arr(toG(frameAt(A ? 32 : 36).p)) },
    ];
    if (!A) L.push({ t: 'Left subclavian artery', p: arr(toG(V(4.4, 17.6, -1.9))) });

    var info = A
      ? '<ul><li><b>Stanford A</b>: involves the ascending aorta (± arch/descending). Surgical emergency.</li><li>Complications: aortic regurgitation, tamponade, coronary (usually RCA) occlusion, stroke.</li></ul>'
      : '<ul><li><b>Stanford B</b>: distal to the left subclavian artery. Usually medical: IV beta-blocker first (impulse control), then vasodilator.</li><li>Complications: renal or mesenteric malperfusion, limb ischemia, rupture.</li></ul>';
    info += '<ul><li>Tearing chest/back pain, BP difference between arms, widened mediastinum on CXR.</li><li>Risk: hypertension, Marfan/Ehlers-Danlos, bicuspid valve, cocaine, trauma.</li></ul>';
    return { labels: L, info: info, update: update };
  }
  function add(g, geo, m) { var me = new THREE.Mesh(geo, m); g.add(me); return me; }

  /* ---------------- intimal view: histology-style cross-section ---------------- */
  // Radii in units of the lumen radius. The wall is drawn thicker than life (about 2 mm in a
  // 25 mm aorta) so the layers read, but the ratios hold: thin intima, media the thickest layer,
  // adventitia about a third of the media.
  var R_INT = 1.0, R_MED = 1.04, R_SPLIT = 1.29, R_ADV = 1.38, R_OUT = 1.56;
  var BETA = 1.25;          // half-width of the false lumen (rad)
  var DEP = 2.2;            // slab length
  var PHI0 = 1.95;          // false lumen centre on the cut face (rad, from +x)
  var TWIST = -0.9;         // spiral of the flap over the slab length (rad)
  var TEAR = 0.55;          // tear position within the false lumen, fraction of BETA
  var TEAR_W = 0.11;        // tear half-width (rad)
  var TEAR_LEN = 0.55;      // fraction of the slab length the tear runs back from the cut face

  function phiC(z) { return PHI0 + TWIST * (DEP / 2 - z) / DEP; }
  function angDiff(a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
  // Wall shape at angle phi on the slice at z: the flap's inner (fi) and outer (fo) radii.
  function wallAt(phi, z, dis) {
    var d = angDiff(phi, phiC(z));
    if (!dis || Math.abs(d) >= BETA) return { fl: false, fi: R_INT, fo: R_SPLIT };
    var w = Math.cos(Math.PI / 2 * d / BETA);
    var fi = R_INT - 0.42 * w;
    return { fl: true, fi: fi, fo: fi + (R_SPLIT - R_INT) - 0.06 * w, d: d };
  }
  function inTear(phi, z, dis) {
    if (!dis || z < DEP / 2 - TEAR_LEN * DEP) return false;
    return Math.abs(angDiff(phi, phiC(z) + TEAR * BETA)) < TEAR_W * (0.6 + 0.4 * (z - (DEP / 2 - TEAR_LEN * DEP)) / (TEAR_LEN * DEP));
  }

  // Cheap value noise for the texture.
  function hash(i, j) { var n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); }
  function noise(x, y) {
    var i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function mix(c1, c2, t) { return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t]; }
  // H&E palette.
  var HE = {
    media: [232, 146, 172], lamella: [190, 78, 128], nucleus: [86, 52, 138],
    intima: [244, 196, 210], endo: [110, 70, 150],
    adv: [242, 190, 200], advGap: [252, 236, 240], fibro: [120, 80, 150],
    blood: [190, 34, 44], bloodDark: [128, 18, 30], rbc: [226, 74, 70], fibrin: [236, 150, 160],
  };
  // Media: wavy elastic lamellae (darker pink) with circumferential smooth-muscle nuclei.
  function shadeMedia(phi, t, r) {
    var NL = 13, a = phi * r * 30;
    var wave = t * NL + 0.45 * Math.sin(a * 0.9 + t * 7) + 0.6 * (noise(a * 0.25, t * 4) - 0.5);
    var f = wave - Math.floor(wave), lam = Math.max(0, 1 - Math.abs(f - 0.5) * 7) ;
    var c = mix(HE.media, HE.lamella, 0.75 * lam);
    c = mix(c, [255, 220, 230], 0.18 * noise(a * 0.6, t * 30));
    // nuclei in a grid of cells between lamellae
    var cu = a * 0.55, cv = wave;
    var ci = Math.floor(cu), cj = Math.floor(cv), hx = hash(ci, cj);
    if (hx < 0.42) {
      var cx = ci + 0.25 + 0.5 * hash(ci + 7, cj), cy = cj + 0.5;
      var dx = (cu - cx) / 0.42, dy = (cv - cy) / 0.16, e = dx * dx + dy * dy;
      if (e < 1) c = mix(c, HE.nucleus, 0.85 * (1 - e * e));
    }
    return c;
  }
  function shadeAdv(phi, r) {
    var a = phi * r * 40, q = (r - R_ADV) / (R_OUT - R_ADV);
    var fib = noise(a * 0.35, q * 18 + 2 * Math.sin(a * 0.2));
    var c = mix(HE.adv, HE.advGap, smooth((fib - 0.55) * 4));
    // fibroblast nuclei, sparse and flat
    var cu = a * 0.4, cv = q * 6, ci = Math.floor(cu), cj = Math.floor(cv);
    if (hash(ci, cj + 31) < 0.18) {
      var dx = (cu - ci - 0.5) / 0.35, dy = (cv - cj - 0.5) / 0.12, e = dx * dx + dy * dy;
      if (e < 1) c = mix(c, HE.fibro, 0.8 * (1 - e));
    }
    // vasa vasorum: a few small vessels in the adventitia
    for (var k = 0; k < 5; k++) {
      var pv = 0.6 + k * 1.31, rv = R_ADV + 0.09;
      var dxv = r * Math.cos(phi) - rv * Math.cos(pv), dyv = r * Math.sin(phi) - rv * Math.sin(pv);
      var dv = Math.sqrt(dxv * dxv + dyv * dyv), rr = 0.032 + 0.008 * (k % 2);
      if (dv < rr) c = dv < rr - 0.009 ? mix(HE.blood, HE.rbc, noise(dxv * 300, dyv * 300)) : HE.endo;
    }
    return c;
  }
  function shadeBlood(x, y, edge) {
    var n1 = noise(x * 90, y * 90), n2 = noise(x * 14 + 3, y * 14);
    var c = mix(HE.bloodDark, HE.blood, 0.4 + 0.6 * n2);
    if (n1 > 0.62) c = mix(c, HE.rbc, Math.min(1, (n1 - 0.62) * 5));
    var fb = noise(x * 6 + 9, y * 30);
    if (fb > 0.8) c = mix(c, HE.fibrin, (fb - 0.8) * 3);
    return mix(c, HE.bloodDark, 0.5 * (1 - smooth(edge * 25)));
  }
  // The cut face as an RGBA texture: transparent lumen and outside, tissue everywhere else.
  function faceTexture(z, dis, size) {
    var cv = document.createElement('canvas'); cv.width = cv.height = size;
    var ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), D = img.data;
    var half = R_OUT * 1.02, px = 2 * half / size;
    for (var yy = 0; yy < size; yy++) {
      for (var xx = 0; xx < size; xx++) {
        var x = -half + (xx + 0.5) * px, y = half - (yy + 0.5) * px;
        var r = Math.sqrt(x * x + y * y), phi = Math.atan2(y, x);
        var w = wallAt(phi, z, dis), c = null, alpha = 1;
        if (r > R_OUT) { alpha = 1 - (r - R_OUT) / px; if (alpha <= 0) continue; }
        if (r >= R_ADV) c = shadeAdv(phi, r);
        else if (!w.fl) {
          if (r < R_INT) { alpha = 1 - (R_INT - r) / px; if (alpha <= 0) continue; }
          if (r < R_MED) c = (r - R_INT) < 0.008 ? mix(HE.intima, HE.endo, 0.7 * (noise(phi * 160, 1) > 0.6 ? 1 : 0)) : HE.intima;
          else c = shadeMedia(phi, (r - R_MED) / (R_ADV - R_MED), r);
        } else {
          var tear = inTear(phi, z, dis);
          if (r >= R_SPLIT) c = shadeMedia(phi, (r - R_MED) / (R_ADV - R_MED), r);
          else if (r >= w.fo || (tear && r >= w.fi)) c = shadeBlood(x, y, Math.min(r - w.fo, R_SPLIT - r) + (tear ? 0.05 : 0));
          else if (r >= w.fi) {
            var depth = r - w.fi, thick = w.fo - w.fi;
            if (depth < R_MED - R_INT) c = HE.intima;
            else c = shadeMedia(phi - w.d * 0.0, (depth - (R_MED - R_INT)) / (thick - (R_MED - R_INT)) * ((R_SPLIT - R_MED) / (R_ADV - R_MED)), R_INT + depth);
          } else { alpha = 1 - (w.fi - r) / px; if (alpha <= 0) continue; c = HE.intima; }
        }
        var o = 4 * (yy * size + xx);
        D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = Math.max(0, Math.min(1, alpha)) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return { tex: tex, half: half };
  }
  // Outer (adventitial) surface: pinkish-tan with longitudinal collagen streaks.
  function fibreTexture() {
    var W = 512, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), D = img.data;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var u = x / W * 64, v = y / H * 4;
      var f = noise(u * 1.0 + 3 * noise(u * 0.1, v * 2), v * 0.6) * 0.65 + noise(u * 4, v * 6) * 0.35;
      var c = mix([204, 140, 120], [240, 200, 182], f);
      var o = 4 * (y * W + x); D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  // A surface r = rFn(phi, z) over phi in [p0, p1] and the slab length.
  function radial(p0, p1, nu, nv, rFn) {
    var pos = [], idx = [];
    for (var j = 0; j <= nv; j++) {
      var z = DEP / 2 - DEP * j / nv;
      for (var i = 0; i <= nu; i++) {
        var phi = p0 + (p1 - p0) * i / nu, r = rFn(phi, z);
        pos.push(r * Math.cos(phi), r * Math.sin(phi), z);
      }
    }
    for (j = 0; j < nv; j++) {
      for (i = 0; i < nu; i++) {
        var a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }

  function buildIntimal(g, st) {
    var dis = st.x === 'dis';
    var slab = new THREE.Group();
    slab.rotation.set(-0.3, 0.32, 0.0);
    slab.scale.setScalar(1.04);
    slab.position.set(0.02, 0.06, 0);
    g.add(slab);
    slab.updateMatrix();

    // Cut faces, front and back, textured as an H&E section.
    [[DEP / 2 + 0.002, 1024, 0], [-DEP / 2 - 0.002, 512, Math.PI]].forEach(function (f) {
      var ft = faceTexture(f[0], dis, f[1]);
      var face = new THREE.Mesh(new THREE.PlaneGeometry(2 * ft.half, 2 * ft.half),
        Kit.tissue('vessel-artery', { color: 0x9a9a9a, map: ft.tex, emissive: 0xffffff, emissiveMap: ft.tex, emissiveIntensity: 0.42,
          alphaTest: 0.5, roughness: 0.85, clearcoat: 0, envMapIntensity: 0.25, side: THREE.DoubleSide }));
      face.position.z = f[0];
      slab.add(face);
    });
    // Outer surface (adventitia).
    var outer = add(slab, new THREE.CylinderGeometry(R_OUT, R_OUT, DEP, 128, 1, true),
      Kit.tissue('vessel-artery', { color: 0xffffff, map: fibreTexture(), roughness: 0.8, clearcoat: 0, envMapIntensity: 0.2, sheen: 0.3, sheenColor: 0xffe2d6 }));
    outer.rotation.x = Math.PI / 2;
    // Luminal surface: intima, and over the false lumen the inner face of the flap. (The tear shows on the cut face.)
    add(slab, radial(0, TAU, 220, 44, function (phi, z) { return wallAt(phi, z, dis).fi; }),
      Kit.tissue('vessel-artery', { color: 0xe9b3a4, roughness: 0.85, clearcoat: 0, specularIntensity: 0.35, envMapIntensity: 0.15, emissive: 0x4a2220 }));
    if (dis) {
      // The false lumen's walls (flap outer face and split media), lined with blood.
      var bl = Kit.tissue('blood-oxy', { color: 0x8a1a1e, roughness: 0.55, clearcoat: 0.3, envMapIntensity: 0.3 });
      for (var k = 0; k < 2; k++) {
        (function (outer) {
          // the false lumen turns with the flap, so build it in z-slices around phiC(z)
          var pos = [], idx = [], nu = 60, nv = 44;
          for (var j = 0; j <= nv; j++) {
            var z = DEP / 2 - DEP * j / nv, pc = phiC(z);
            for (var i = 0; i <= nu; i++) {
              var phi = pc - BETA + 2 * BETA * i / nu, w = wallAt(phi, z, true);
              var r = outer ? R_SPLIT : Math.min(R_SPLIT, w.fo);
              pos.push(r * Math.cos(phi), r * Math.sin(phi), z);
            }
          }
          for (j = 0; j < nv; j++) for (var i2 = 0; i2 < nu; i2++) {
            var a = j * (nu + 1) + i2, b = a + 1, c = a + nu + 1, d = c + 1;
            idx.push(a, b, c, b, d, c);
          }
          var geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          geo.setIndex(idx); geo.computeVertexNormals();
          add(slab, geo, bl);
        })(k === 1);
      }
      // Blood entering the false lumen through the tear.
      var pt = phiC(DEP / 2) + TEAR * BETA, wt = wallAt(pt, DEP / 2, true);
      var a0 = new THREE.Vector3(0.45 * Math.cos(pt - 0.35), 0.45 * Math.sin(pt - 0.35), DEP / 2 + 0.25).applyMatrix4(slab.matrix);
      var a1 = new THREE.Vector3((wt.fo + 0.08) * Math.cos(pt), (wt.fo + 0.08) * Math.sin(pt), DEP / 2 + 0.25).applyMatrix4(slab.matrix);
      h.arrow(g, [a0.x, a0.y, a0.z], [a1.x, a1.y, a1.z]);
    }

    var front = DEP / 2;
    var P = function (r, phi) { return new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), front).applyMatrix4(slab.matrix); };
    var arr = function (v) { return [v.x, v.y, v.z]; };
    var pc = phiC(front);
    var L = [
      { t: 'Intima', p: arr(P(1.015, pc + Math.PI + 0.35)) },
      { t: 'Media', p: arr(P(1.2, pc + Math.PI + 1.05)) },
      { t: 'Adventitia', p: arr(P(1.47, pc + Math.PI + 1.75)) },
      { t: 'True lumen', p: arr(dis ? P(0.35, pc + Math.PI) : P(0, 0)) },
    ];
    var info;
    if (dis) {
      var wf = wallAt(pc - 0.45 * BETA, front, true), wc = wallAt(pc, front, true), wt2 = wallAt(pc + TEAR * BETA, front, true);
      L.push(
        { t: 'Intimal tear', p: arr(P((wt2.fi + wt2.fo) / 2, pc + TEAR * BETA)) },
        { t: 'False lumen', p: arr(P((wc.fo + R_SPLIT) / 2, pc - 0.15)) },
        { t: 'Intimal flap', p: arr(P((wf.fi + wf.fo) / 2, pc - 0.45 * BETA)) }
      );
      info = '<ul><li>An <b>intimal tear</b> lets blood enter the media and split the layers, creating a <b>false lumen</b>.</li><li>The <b>intimal flap</b> separates true and false lumens and can occlude branch vessels (malperfusion).</li><li>Shown here as a cutaway: the wall layers from the inside out. The plane of cleavage is in the outer media; the flap spirals along the vessel.</li></ul>';
    } else {
      info = '<ul><li>Three layers: <b>intima</b> (endothelium), <b>media</b> (elastic lamellae and smooth muscle, most of the strength), <b>adventitia</b>.</li><li>Cystic medial degeneration weakens the media (Marfan, aging, hypertension).</li></ul>';
    }
    return { labels: L, info: info };
  }

  Kit.register({
    id: 'aorta',
    meshes: ['aorta'],
    center: [0, 0, 0],
    zoom: 9.4,
    rot: [0, 0],
    controls: [
      { k: 'v', label: 'Perspective', def: 'ext', opts: [
        ['ext', 'Aortic (external, whole aorta)'],
        ['int', 'Intimal (wall layers in cross-section)'],
      ] },
      { k: 't', label: 'Stanford type (aortic view)', def: 'A', opts: [
        ['A', 'Type A (involves ascending aorta)'],
        ['B', 'Type B (distal to left subclavian)'],
      ] },
      { k: 'x', label: 'Wall in cross-section', def: 'dis', opts: [
        ['norm', 'Normal wall'],
        ['dis', 'Dissection'],
      ] },
    ],
    build: function (g, st) {
      return st.v === 'ext' ? buildExternal(g, st) : buildIntimal(g, st);
    },
  });
})();
