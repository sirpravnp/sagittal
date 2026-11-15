// Thyroid surgery and the nerves at risk, on real Z-Anatomy neck anatomy (site/meshes/thyroid.js):
// larynx (thyroid and cricoid cartilages, hyoid, cricothyroid muscles), trachea, aortic arch and
// its branches, external carotids, thyrocervical trunks, jugular veins and pulmonary trunk.
// Z-Anatomy's thyroid gland is a thin shell draped over the thyroid cartilage (above its real
// level), so the gland is built here: two lobes from the oblique line of the thyroid cartilage
// to about the 5th tracheal ring and an isthmus over rings 2-4, moulded around the real trachea,
// larynx and common carotids. Parathyroids sit on the back of the lobes. Z-Anatomy's vagus runs
// inside the carotid and has no recurrent or external laryngeal branches, so the nerves follow its
// neck course but are re-routed into the carotid sheath; the recurrent laryngeal nerves loop under
// the arch (left) and right subclavian artery (right) and climb in the tracheo-oesophageal grooves.
// All coordinates: mesh frame, cm, +x patient left, +y superior, +z anterior (centred on y=142).
(function () {
  var S = 0.3; // cm -> scene units

  // One shader program for every material (clearcoat, no sheen): software GL compiles are slow.
  function T(kind, opts) {
    var o = Object.assign({ sheen: 0 }, opts || {});
    if (kind === 'highlight' && o.clearcoat === undefined) o.clearcoat = 0.2;
    return Kit.tissue(kind, o);
  }
  function V3(p) { return new THREE.Vector3(p[0], p[1], p[2]); }
  function P(x, y, z) { return [x * S, y * S, z * S]; }
  function mx(pts) { return pts.map(function (p) { return [-p[0], p[1], p[2]]; }); }

  // ---- centre lines (cm, mesh frame) ----
  // Descending aorta and oesophagus: Z-Anatomy curves, cropped.
  var DESC_AO = [[1.93, -5.96, -3.33], [1.97, -7.29, -3.79], [2.02, -8.57, -3.85], [2.04, -9.89, -3.68], [2.0, -11.0, -3.5]];
  var OES = [[0.0, 5.48, 0.31], [0.06, 3.72, -0.07], [0.1, 1.97, -0.47], [0.09, -0.55, -1.13], [0.06, -3.06, -1.8],
    [0.07, -5.59, -2.49], [0.1, -8.16, -2.95], [0.14, -9.9, -2.97], [0.16, -10.72, -2.89]];
  // Left vagus: Z-Anatomy course at the skull base, then posterior between common carotid and
  // internal jugular, between left common carotid and subclavian, over the left side of the arch,
  // behind the lung root onto the oesophagus.
  var VAG_L = [[2.55, 12.0, -0.2], [2.7, 10.0, -0.4], [3.05, 8.0, -0.5], [3.3, 6.6, -0.55], [2.95, 5.0, -0.45],
    [2.3, 3.0, -0.25], [2.2, 1.5, -0.15], [2.3, 0.0, -0.15], [2.45, -1.5, -0.05], [2.6, -2.5, 0.15],
    [3.3, -3.6, 0.35], [3.25, -5.0, 0.2], [2.9, -6.4, -1.0], [2.3, -7.4, -2.0], [1.0, -8.8, -2.25], [0.85, -10.5, -2.1]];
  // Right vagus: crosses in front of the first part of the right subclavian artery.
  var VAG_R = [[-2.55, 12.0, -0.2], [-2.7, 10.0, -0.4], [-3.05, 8.0, -0.5], [-3.3, 6.6, -0.55], [-2.95, 5.0, -0.25],
    [-2.55, 3.0, 0.15], [-2.25, 1.5, 0.55], [-2.2, 0.4, 0.85], [-2.45, -0.4, 0.95], [-2.15, -1.6, 0.55],
    [-1.8, -3.5, -0.3], [-1.55, -5.5, -1.2], [-1.25, -7.0, -2.4], [-0.75, -9.0, -3.6], [-0.6, -10.5, -3.5]];
  // Recurrent laryngeal nerves: hook under the arch (left, lateral to the ligamentum arteriosum)
  // or the right subclavian artery, then up the tracheo-oesophageal groove to enter the larynx
  // behind the cricothyroid joint, deep to the inferior constrictor.
  var RLN_L = [[3.25, -5.0, 0.2], [3.05, -6.1, -0.35], [2.55, -6.65, -1.05], [1.85, -6.6, -1.7], [1.3, -5.9, -1.95],
    [1.15, -4.5, -1.55], [1.28, -2.0, -0.9], [1.38, 0.0, -0.32], [1.42, 2.0, 0.05], [1.34, 3.2, 0.3], [1.22, 4.1, 0.42]];
  var RLN_R = [[-2.45, -0.4, 0.95], [-2.62, -0.95, 0.4], [-2.6, -0.9, -0.3], [-2.3, -0.25, -0.6], [-1.8, 0.8, -0.45],
    [-1.4, 2.0, -0.02], [-1.3, 3.2, 0.3], [-1.22, 4.1, 0.42]];
  // Superior laryngeal nerve: internal branch through the thyrohyoid membrane, external branch on
  // the inferior constrictor alongside the superior thyroid artery to the cricothyroid muscle.
  var SLN = [[2.65, 10.6, -0.35], [2.35, 9.8, -0.05], [2.05, 9.0, 0.4]];
  var SLN_INT = [[2.05, 9.0, 0.4], [1.8, 8.5, 1.0], [1.5, 8.15, 1.55]];
  var SLN_EXT = [[2.05, 9.0, 0.4], [2.28, 7.8, 0.62], [2.22, 6.6, 0.88], [1.85, 5.5, 1.12], [1.5, 4.85, 1.38], [1.27, 4.6, 1.5]];
  // Superior thyroid artery: first branch of the external carotid, down to the upper pole.
  var STA = [[3.15, 6.9, 0.05], [3.05, 7.45, 0.55], [2.7, 7.25, 1.15], [2.5, 6.55, 1.38], [2.25, 5.85, 1.4], [2.05, 5.35, 1.35]];
  // Inferior thyroid artery: thyrocervical trunk (Z-Anatomy), up, then medially behind the common
  // carotid and down to the back of the lobe, where it crosses the recurrent laryngeal nerve.
  var ITA = [[4.17, 1.19, 0.1], [4.25, 2.3, 0.05], [4.0, 3.3, -0.2], [3.0, 3.55, -0.6], [2.25, 3.0, -0.7], [1.75, 2.6, 0.0]];
  var ITA_DN = [[1.75, 2.6, 0.0], [1.7, 1.9, 0.5], [1.6, 1.2, 0.68]];
  var ITA_UP = [[1.75, 2.6, 0.0], [1.68, 3.2, 0.45], [1.58, 3.8, 0.62]];
  var LIG_ART = [[1.75, -5.35, -0.95], [1.85, -6.2, -0.85], [2.0, -7.0, -0.65]]; // ligamentum arteriosum
  // Common carotids (Z-Anatomy), used to mould the thyroid lobes.
  var LCCA = [[1.66, -2.42, 0.33], [1.64, -0.76, 0.56], [1.73, 0.35, 0.59], [1.81, 1.66, 0.45], [1.92, 3.03, 0.22], [2.33, 4.37, 0.08], [2.83, 5.54, -0.01], [3.12, 6.61, -0.01]];
  var RCCA = [[-1.48, -0.74, 1.62], [-1.71, 0.21, 1.48], [-1.86, 1.44, 1.23], [-1.99, 2.3, 1.02], [-2.3, 3.55, 0.68], [-2.65, 4.71, 0.34], [-2.95, 5.74, 0.07], [-3.12, 6.61, -0.01]];

  // Airway axis (trachea, then cricoid and thyroid cartilage laminae), fitted to the Z-Anatomy meshes.
  function airZ(y) { return y < 4 ? 0.33 + 0.21 * y : 1.17 + (Math.min(y, 6.5) - 4) * 0.15; }
  function airRx(y) {
    if (y < 3.5) return 1.16;
    if (y < 4.2) return 1.16 + (y - 3.5) * 0.25;
    if (y < 6) return 1.33 + (y - 4.2) * 0.3;
    return 1.87 + (y - 6) * 0.2;
  }

  // Swept tube (radius r0 -> r1) with rounded ends.
  function vtube(parent, pts, r0, r1, m, seg) {
    var curve = new THREE.CatmullRomCurve3(pts.map(V3), false, 'centripetal');
    var n = seg || Math.max(24, pts.length * 12), rs = 12;
    var geo = new THREE.TubeGeometry(curve, n, 1, rs, false);
    var pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (var i = 0; i <= n; i++) {
      var t = i / n, r = r0 + (r1 - r0) * t;
      curve.getPointAt(t, c);
      for (var j = 0; j <= rs; j++) {
        var k = i * (rs + 1) + j;
        v.fromBufferAttribute(pos, k).sub(c).setLength(r).add(c);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
    parent.add(new THREE.Mesh(geo, m));
    [[0, r0], [1, r1]].forEach(function (e) {
      var cap = new THREE.Mesh(new THREE.SphereGeometry(e[1], 12, 8), m);
      cap.position.copy(curve.getPointAt(e[0])); parent.add(cap);
    });
    return curve;
  }

  // Pushes v out to distance r from a polyline (a vessel the gland must not overlap).
  function pushOut(v, line, r) {
    var best = null, bd = 1e9, a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3(), ab = new THREE.Vector3();
    for (var i = 0; i < line.length - 1; i++) {
      a.set(line[i][0], line[i][1], line[i][2]); b.set(line[i + 1][0], line[i + 1][1], line[i + 1][2]);
      ab.subVectors(b, a); var t = Math.max(0, Math.min(1, q.subVectors(v, a).dot(ab) / ab.lengthSq()));
      q.copy(a).addScaledVector(ab, t); var d = q.distanceTo(v);
      if (d < bd) { bd = d; best = q.clone(); }
    }
    if (bd < r) v.sub(best).setLength(r).add(best);
  }
  function mould(v) {
    // out of the airway (elliptical section) ...
    var zc = airZ(v.y), rx = airRx(v.y), rz = 0.95;
    var dx = v.x / rx, dz = (v.z - zc) / rz, d = Math.hypot(dx, dz);
    if (d < 1) { v.x = dx / d * rx; v.z = zc + dz / d * rz; }
    // ... and out of the common carotids
    pushOut(v, v.x > 0 ? LCCA : RCCA, 0.5);
  }

  // One thyroid lobe (side = +1 left, -1 right): pear-shaped, pointed upper pole, moulded.
  function lobeGeo(side) {
    var geo = new THREE.SphereGeometry(1, 40, 32), pos = geo.attributes.position, v = new THREE.Vector3();
    var cy = 2.95, hy = 2.6, cx = 1.5 * side;
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      var t = v.y; // -1 lower pole .. +1 upper pole
      var w = t > 0 ? 1 - 0.55 * t * t : 1 - 0.12 * t * t; // tapering upper pole, full lower pole
      var y = cy + t * hy + (t > 0 ? 0.25 * t * t : 0);
      var x = cx + v.x * 0.98 * w + side * 0.18 * Math.max(0, t); // upper pole leans onto the lamina
      var z = airZ(y) + 0.72 + v.z * 0.82 * w;
      v.set(x, y, z); mould(v);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }
  // Isthmus: a bent bar over tracheal rings 2-4.
  function isthmusGeo() {
    var geo = new THREE.SphereGeometry(1, 36, 20), pos = geo.attributes.position, v = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      var th = v.x * 1.05, y = 2.5 + v.y * 0.5, rad = 0.12 + v.z * 0.12;
      v.set(Math.sin(th) * (1.16 + rad), y, airZ(y) + Math.cos(th) * (0.95 + rad));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }
  // Posterior surface point of a lobe near (x, y): used to seat the parathyroids.
  function backOf(geo, x, y) {
    var pos = geo.attributes.position, z = 1e9;
    for (var i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getY(i) - y) < 0.25 && Math.abs(pos.getX(i) - x) < 0.25) z = Math.min(z, pos.getZ(i));
    }
    return z;
  }
  function blob(parent, p, s, m) {
    var me = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), m);
    me.position.set(p[0], p[1], p[2]); me.scale.set(s[0], s[1], s[2]); parent.add(me); return me;
  }
  function mark(parent, p, r, col) { // injury marker: a glowing ring facing the viewer
    var m = T('highlight', { color: col, emissive: col, emissiveIntensity: 0.9 });
    var ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.16, 8, 32), m);
    ring.position.set(p[0], p[1], p[2]); ring.rotation.y = 0.45; parent.add(ring); // faces the default camera
    return ring;
  }
  function split(pts, k) { return [pts.slice(0, k + 1), pts.slice(k)]; }

  Kit.register({
    id: 'thyroid',
    meshes: ['thyroid'],
    center: [0.35, 0.3, 0],
    zoom: 7.6,
    rot: [0.1, -0.45],
    controls: [{ k: 'v', label: 'Condition', def: 'norm', opts: [
      ['norm', 'Normal anatomy'],
      ['rln', 'Recurrent laryngeal nerve injury'],
      ['sln', 'External branch of superior laryngeal nerve injury'],
      ['para', 'Parathyroids removed / devascularised'],
    ] }],
    build: function (g, st) {
      var v = st.v;
      var b = new THREE.Group(); b.scale.setScalar(S); g.add(b);
      var hot = 0x3de0ff; // injury markers: cyan stands out against arteries and nerves

      // --- real Z-Anatomy structures ---
      Kit.meshPart(b, 'thyroid', 'thyroid_cartilage', T('cartilage'));
      Kit.meshPart(b, 'thyroid', 'cricoid', T('cartilage'));
      Kit.meshPart(b, 'thyroid', 'trachea', T('cartilage', { color: 0xb3c4c6 }));
      Kit.meshPart(b, 'thyroid', 'hyoid', T('bone'));
      Kit.meshPart(b, 'thyroid', 'cricothyroid', v === 'sln'
        ? T('muscle', { color: 0x8a6a8f, emissive: 0x5a1a6a, emissiveIntensity: 0.45 }) : T('muscle'));
      ['aorta', 'brachiocephalic_trunk', 'subclavians', 'external_carotids', 'thyrocervical'].forEach(function (k) {
        Kit.meshPart(b, 'thyroid', k, T('vessel-artery'));
      });
      // common carotids see-through so the nerves behind them stay visible
      Kit.meshPart(b, 'thyroid', 'carotids', T('vessel-artery', { opacity: v === 'norm' ? 0.45 : v === 'rln' ? 0.15 : 0.22, depthWrite: false }));
      Kit.meshPart(b, 'thyroid', 'pulmonary', T('vessel-vein', { color: 0x5a6fb0, opacity: 0.45, depthWrite: false }));
      Kit.meshPart(b, 'thyroid', 'jugular_veins', T('vessel-vein', { opacity: v === 'norm' ? 0.3 : 0.12, depthWrite: false }));
      vtube(b, DESC_AO, 1.25, 1.2, T('vessel-artery'));
      vtube(b, OES, 0.72, 0.8, T('bowel', { color: 0xc98a78 }));
      vtube(b, LIG_ART, 0.2, 0.2, T('fascia', { color: 0xd9cfc0, opacity: 1 }));

      // --- arteries to the gland ---
      var art = T('vessel-artery');
      var artHot = T('vessel-artery', { emissive: 0x8a1408, emissiveIntensity: 0.5 });
      [1, -1].forEach(function (s) {
        var f = s > 0 ? function (p) { return p; } : mx;
        var hiI = v === 'rln' && s > 0, hiS = v === 'sln' && s > 0;
        vtube(b, f(ITA), 0.17, 0.15, hiI ? artHot : art);
        vtube(b, f(ITA_DN), 0.12, 0.08, hiI ? artHot : art);
        vtube(b, f(ITA_UP), 0.12, 0.08, hiI ? artHot : art);
        vtube(b, f(STA), 0.16, 0.11, hiS ? artHot : art);
      });

      // --- thyroid gland and parathyroids (procedural, moulded on the real airway and carotids) ---
      var glandM = T('liver', { color: 0xb35a48, roughness: 0.5, opacity: v === 'norm' ? 0.82 : v === 'para' ? 0.42 : 0.26, depthWrite: false });
      var lobeL = lobeGeo(1), lobeR = lobeGeo(-1);
      b.add(new THREE.Mesh(lobeL, glandM), new THREE.Mesh(lobeR, glandM), new THREE.Mesh(isthmusGeo(), glandM));
      var para = v === 'para'
        ? T('liver', { color: 0x4b3a4f, roughness: 0.7, emissive: 0x200a28, emissiveIntensity: 0.3 })
        : T('fat', { color: 0xc99a3c, emissive: 0x3a2405, emissiveIntensity: 0.25 });
      var PTH = [];
      [[1, lobeL], [-1, lobeR]].forEach(function (e) {
        var s = e[0];
        var sup = [1.45 * s, 4.05, backOf(e[1], 1.45 * s, 4.05) - 0.12];
        var inf = [1.65 * s, 1.15, backOf(e[1], 1.65 * s, 1.15) - 0.12];
        PTH.push(sup, inf);
        blob(b, sup, [0.3, 0.38, 0.2], para);
        blob(b, inf, [0.32, 0.4, 0.2], para);
        if (v === 'para') { mark(b, sup, 0.55, 0xffd23f); mark(b, inf, 0.55, 0xffd23f); }
      });

      // --- nerves ---
      var nerve = T('nerve', { color: 0xffe27a, emissive: 0xb08a20, emissiveIntensity: 0.7 });
      var dead = T('nerve', { color: 0x6f6a5c, roughness: 0.7 });
      var nr = 0.13, br = 0.12;
      vtube(b, VAG_L, nr, nr, nerve); vtube(b, VAG_R, nr, nr, nerve);
      if (v === 'rln') {
        // left RLN divided where it crosses the inferior thyroid artery: distal stump dead
        var hk = split(RLN_L, 8);
        vtube(b, hk[0], br, br, nerve); vtube(b, hk[1], br, br, dead);
        mark(b, RLN_L[8], 0.5, hot);
      } else vtube(b, RLN_L, br, br, nerve);
      vtube(b, RLN_R, br, br, nerve);
      vtube(b, SLN, 0.075, 0.07, nerve); vtube(b, SLN_INT, 0.06, 0.05, nerve);
      if (v === 'sln') {
        var hs = split(SLN_EXT, 2);
        vtube(b, hs[0], 0.055, 0.055, nerve); vtube(b, hs[1], 0.055, 0.05, dead);
        mark(b, SLN_EXT[2], 0.38, hot);
      } else vtube(b, SLN_EXT, 0.055, 0.05, nerve);
      // right-side superior laryngeal nerve (mirror)
      vtube(b, mx(SLN), 0.075, 0.07, nerve); vtube(b, mx(SLN_INT), 0.06, 0.05, nerve); vtube(b, mx(SLN_EXT), 0.055, 0.05, nerve);

      // --- labels (each lists the variants it appears in) ---
      var A = 'norm rln sln para';
      var L = [
        { t: 'Thyroid gland', p: P(2.5, 3.6, 1.6), in: A },
        { t: 'Trachea', p: P(0.9, -1.0, 0.9), in: A },
        { t: 'Thyroid cartilage', p: P(1.9, 7.4, 1.8), in: 'norm sln' },
        { t: v === 'sln' ? 'Cricothyroid paralysed: loss of high pitch' : 'Cricothyroid muscle', p: P(1.35, 4.5, 1.6), in: 'norm sln' },
        { t: 'Left vagus nerve', p: P(3.35, -3.2, 0.4), in: A },
        { t: 'Right vagus nerve', p: P(-2.3, 1.5, 0.55), in: 'norm rln para' },
        { t: 'Left recurrent laryngeal n. (under arch)', p: P(2.6, -6.65, -1.05), in: 'norm rln' },
        { t: 'Right recurrent laryngeal n. (under subclavian)', p: P(-2.62, -0.95, 0.4), in: 'norm rln' },
        { t: 'Superior thyroid artery', p: P(2.5, 6.55, 1.38), in: 'norm sln' },
        { t: 'Inferior thyroid artery', p: P(4.0, 3.3, -0.2), in: 'norm rln para' },
        { t: 'Aortic arch', p: P(1.0, -3.0, 1.6), in: A },
        { t: 'Right subclavian artery', p: P(-5.5, 0.1, 0), in: 'norm rln' },
        { t: 'Common carotid artery', p: P(2.75, 4.4, 0.1), in: 'norm sln' },
        { t: 'Ext. branch superior laryngeal n.', p: P(2.28, 7.6, 0.65), in: 'norm' },
        { t: 'Internal branch (sensory, spared)', p: P(1.7, 8.4, 1.2), in: 'sln' },
        { t: 'RLN cut where it crosses the inferior thyroid a.', p: P(1.9, 2.0, 0.05), in: 'rln' },
        { t: 'External branch cut beside sup. thyroid a.', p: P(2.6, 6.6, 0.9), in: 'sln' },
        { t: v === 'para' ? 'Superior parathyroid (devascularised)' : 'Parathyroid glands', p: P(PTH[0][0] + 0.3, PTH[0][1], PTH[0][2]), in: 'norm para' },
        { t: 'Inferior parathyroid (devascularised)', p: P(PTH[1][0] + 0.3, PTH[1][1], PTH[1][2]), in: 'para' },
      ].filter(function (l) { return l.in.split(' ').indexOf(v) >= 0; })
        .map(function (l) { return { t: l.t, p: l.p }; });

      var infos = {
        norm: '<ul><li><b>Recurrent laryngeal nerves</b> (vagus): the left hooks under the <b>aortic arch</b> beside the ligamentum arteriosum, the right under the <b>right subclavian artery</b>; both climb in the tracheo-oesophageal groove and enter the larynx behind the cricothyroid joint. They supply every intrinsic laryngeal muscle except cricothyroid.</li><li>The <b>inferior thyroid artery</b> (thyrocervical trunk) crosses the RLN near the lower pole; the <b>external branch of the superior laryngeal nerve</b> runs with the <b>superior thyroid artery</b> (first branch of the external carotid) to the upper pole and supplies <b>cricothyroid</b>.</li><li>Four <b>parathyroids</b> on the back of the lobes (superior near the cricothyroid junction, inferior near the lower pole), mostly supplied by the inferior thyroid artery.</li></ul>',
        rln: '<ul><li><b>Recurrent laryngeal nerve injury</b>: most at risk where it crosses the <b>inferior thyroid artery</b> and at its entry to the larynx (ligate the artery away from the nerve).</li><li>Unilateral: <b>hoarseness</b> (ipsilateral vocal fold paralysed near the midline), weak cough, aspiration.</li><li>Bilateral: both folds lie near the midline → <b>stridor and airway obstruction</b> after extubation; may need reintubation or tracheostomy.</li><li>The longer left nerve (aortic arch) is also hit by thoracic disease: aortic aneurysm, left atrial enlargement (Ortner), apical lung cancer.</li></ul>',
        sln: '<ul><li><b>External branch of the superior laryngeal nerve</b> runs close to the <b>superior thyroid artery</b>: ligate the upper pole vessels close to the gland.</li><li>It is the only motor supply to <b>cricothyroid</b>, which tenses the vocal folds: injury → <b>loss of high pitch</b>, voice fatigue, a weak or monotonous voice (singers notice).</li><li>The internal branch (sensory above the vocal folds) is usually spared; injury loses the cough reflex → aspiration.</li></ul>',
        para: '<ul><li>Parathyroids removed or <b>devascularised</b> (their blood mostly comes from the <b>inferior thyroid artery</b>) during total thyroidectomy → <b>hypoparathyroidism</b>.</li><li><b>Hypocalcaemia</b> within 1-3 days: <b>perioral and fingertip tingling</b>, muscle cramps, <b>Chvostek sign</b> (tap the facial nerve → facial twitch), <b>Trousseau sign</b> (BP cuff → carpal spasm), prolonged QT, seizures, laryngospasm.</li><li>Low calcium with <b>low PTH</b> and high phosphate. Treat with IV calcium gluconate if severe, then oral calcium and calcitriol.</li></ul>',
      };
      return { labels: L, info: infos[v] };
    },
  });
})();
