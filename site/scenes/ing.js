// Inguinal canal and hernias on the real right groin: Z-Anatomy abdominal wall muscles,
// transversalis fascia, inguinal ligament, hip bone, inferior epigastric and external
// iliac / femoral vessels, femoral nerve, ductus deferens and testicular vessels
// (site/meshes/groin.js). The deep and superficial rings, Hesselbach triangle, the cord's
// coverings and the hernia sacs are overlays placed on that anatomy (mesh frame, cm,
// centred on [-5, 89, 4]: +x patient's left = medial for this right groin).
(function () {
  var S = 0.36;
  // One shader program for every material (clearcoat, no sheen): each extra MeshPhysicalMaterial
  // feature combination costs a separate shader compile, which is slow on software GL.
  function T(kind, opts) {
    var o = Object.assign({ sheen: 0 }, opts || {});
    if (kind === 'highlight' && o.clearcoat === undefined) o.clearcoat = 0.2;
    return Kit.tissue(kind, o);
  }
  function P(x, y, z) { return [x * S, y * S, z * S]; }
  function V3(a) { return new THREE.Vector3(a[0] * S, a[1] * S, a[2] * S); }

  var DEEP = [-0.9, 0.0, 1.45];      // deep ring: in transversalis fascia, lateral to the inferior epigastric vessels
  var SUP = [2.45, -3.7, 1.75];      // superficial ring: in the external oblique aponeurosis, above the pubic tubercle
  // spermatic cord course (follows Z-Anatomy's ductus deferens and testicular vessels)
  var CORD = [DEEP, [0.4, -1.3, 1.5], [1.6, -2.75, 1.6], SUP, [3.0, -5.2, 1.5], [3.05, -7.5, 1.05], [3.05, -10.2, 0.6]];
  // Hesselbach triangle: inferior epigastric vessels (lateral), rectus border (medial), inguinal ligament (inferior)
  var HESS = [[-0.3, -1.95], [2.55, -4.2], [-0.1, 2.3]];
  var FEM_RING = [1.9, -4.15, 0.7];  // femoral ring: below the ligament, medial to the femoral vein

  function tubeR(g, pts, rf, material, n) {
    var curve = new THREE.CatmullRomCurve3(pts.map(V3), false, 'centripetal');
    var seg = n || 80, rad = 20;
    var geo = new THREE.TubeGeometry(curve, seg, 1, rad, false);
    var pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (var i = 0; i <= seg; i++) {
      var t = i / seg; curve.getPointAt(t, c);
      for (var j = 0; j <= rad; j++) { var k = i * (rad + 1) + j; v.fromBufferAttribute(pos, k).sub(c).setLength(rf(t) * S).add(c); pos.setXYZ(k, v.x, v.y, v.z); }
    }
    geo.computeVertexNormals();
    var me = new THREE.Mesh(geo, material); g.add(me);
    [0, 1].forEach(function (e) { var cap = new THREE.Mesh(new THREE.SphereGeometry(rf(e) * S, 20, 14), material); cap.position.copy(curve.getPointAt(e)); g.add(cap); });
    return me;
  }
  // A copy of a baked part keeping only triangles whose centroid passes keep(x, y, z) (mesh cm).
  var cropCache = {};
  function cropped(body, part, key, keep, material) {
    var ck = part + '|' + key;
    if (!cropCache[ck]) {
      var src = Kit.meshPart(new THREE.Group(), 'groin', part, material).geometry;
      var pos = src.attributes.position, idx = src.index.array, out = [];
      for (var i = 0; i < idx.length; i += 3) {
        var a = idx[i], b = idx[i + 1], c = idx[i + 2];
        if (keep((pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3)) out.push(a, b, c);
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', pos); geo.setAttribute('normal', src.attributes.normal);
      geo.setIndex(out); geo.userData = { kitShared: true };
      cropCache[ck] = geo;
    }
    var me = new THREE.Mesh(cropCache[ck], material); body.add(me); return me;
  }
  function blob(g, p, r, material) {
    var me = new THREE.Mesh(new THREE.SphereGeometry(S, 40, 28), material);
    me.position.copy(V3(p)); me.scale.set(r[0], r[1], r[2]); g.add(me); return me;
  }
  function sacMat() { return T('bowel', { color: 0xe8b94a, opacity: 0.72, depthWrite: false, emissive: 0x7a4a08, emissiveIntensity: 0.35 }); }
  function ringAt(g, p, r, normal) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(r * S, 0.07 * S * 1.6, 12, 40), T('highlight', { color: 0xff9f3f, emissive: 0xff8a1f }));
    m.position.copy(V3(p)); m.lookAt(m.position.clone().add(new THREE.Vector3(normal[0], normal[1], normal[2]))); g.add(m); return m;
  }

  Kit.register({
    id: 'ing',
    meshes: ['groin'],
    center: [-0.4, -0.5, 0.45],
    zoom: 8,
    // Anterior oblique view of the right groin, from in front and slightly lateral.
    rot: [0.05, 0.14],
    controls: [
      { k: 'h', label: 'Condition', def: 'norm', opts: [
        ['norm', 'Normal anatomy'],
        ['ind', 'Indirect inguinal hernia'],
        ['dir', 'Direct inguinal hernia'],
        ['fem', 'Femoral hernia'],
      ] },
      { k: 'eo', label: 'Show external oblique aponeurosis', def: true, type: 'chk' },
    ],
    build: function (g, st) {
      var body = new THREE.Group(); body.scale.setScalar(S); g.add(body);
      var mp = function (part, m) { return Kit.meshPart(body, 'groin', part, m); };

      // deep -> superficial
      mp('hip_bone', T('bone'));
      mp('pubic_symphysis', T('cartilage'));
      mp('iliopsoas', T('muscle', { color: 0x8a3a33 }));
      mp('pectineus', T('muscle', { color: 0x8a3a33 }));
      mp('artery', T('vessel-artery'));
      mp('vein', T('vessel-vein'));
      mp('femoral_nerve', T('nerve'));
      mp('inferior_epigastric_artery', T('vessel-artery', { emissive: 0x6a0a04, emissiveIntensity: 0.5 }));
      mp('inferior_epigastric_vein', T('vessel-vein', { emissive: 0x0a1a5a, emissiveIntensity: 0.5 }));
      mp('ductus_deferens', T('fibroid', { color: 0xf1e7da }));
      mp('testicular_vessels', T('vessel-vein', { color: 0x5a6fb0 }));
      mp('testis', T('fibroid', { color: 0xe9d3c8 }));
      mp('inguinal_ligament', T('cartilage', { color: 0xe9e2cf, roughness: 0.45 }));
      mp('rectus', T('muscle', { opacity: 0.26, depthWrite: false }));
      // right half only (the fascia sheet spans both sides; midline is x = 5 in this frame)
      cropped(body, 'transversalis_fascia', 'right', function (x) { return x < 4.9; }, T('fascia', { opacity: 0.14 }));
      // internal oblique and transversus: their lower fibres arch over the cord, so the canal
      // below that arch is left open to show the cord and the posterior wall
      var arch = function (x, y) { return y > 3.4 + 0.3 * (x + 1); };
      cropped(body, 'transversus', 'arch', arch, T('muscle', { color: 0xa8504a, opacity: 0.22, depthWrite: false }));
      cropped(body, 'internal_oblique', 'arch', arch, T('muscle', { color: 0xb05a50, opacity: 0.24, depthWrite: false }));
      if (st.eo) mp('external_oblique', T('fascia', { color: 0xe6c9b4, opacity: 0.2 }));

      // Hesselbach triangle, on the transversalis fascia
      var tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.Float32BufferAttribute([].concat(P(HESS[0][0], HESS[0][1], 1.5), P(HESS[1][0], HESS[1][1], 1.45), P(HESS[2][0], HESS[2][1], 1.75)), 3));
      tri.setIndex([0, 1, 2]); tri.computeVertexNormals();
      g.add(new THREE.Mesh(tri, T('highlight', { opacity: 0.6, depthWrite: false })));
      var hz = [1.5, 1.45, 1.75];
      [[0, 1], [1, 2], [2, 0]].forEach(function (e) {
        tubeR(g, [[HESS[e[0]][0], HESS[e[0]][1], hz[e[0]]], [HESS[e[1]][0], HESS[e[1]][1], hz[e[1]]]], function () { return 0.06; }, T('highlight'), 8);
      });

      // spermatic cord coverings through the canal, and the two rings
      tubeR(g, CORD, function () { return 0.42; }, T('fascia', { color: 0xf0d8c8, opacity: 0.38 }), 90);
      ringAt(g, DEEP, 0.62, [0.3, -0.2, 1]);
      ringAt(g, SUP, 0.55, [0.2, 0.1, 1]);

      var L = [
        { t: 'Deep (internal) ring', p: P(-1.5, 0.3, 1.5) }, { t: 'Superficial ring', p: P(2.5, -3.5, 1.8) },
        { t: 'Spermatic cord', p: P(3.05, -7.5, 1.05) }, { t: 'Inguinal ligament', p: P(-4.5, 2.4, 1.4) },
        { t: 'Inferior epigastric vessels', p: P(0.9, 4.0, 1.3) }, { t: 'Hesselbach triangle', p: P(0.7, -1.2, 1.6) },
        { t: 'Rectus', p: P(3.2, 5.5, 3) }, { t: 'Femoral N / A / V', p: P(-1.3, -5.5, 0.3) },
      ];
      var info = '<ul><li><b>Inguinal canal</b>: runs from the deep ring (in transversalis fascia) to the superficial ring (in the external oblique aponeurosis), carrying the spermatic cord / round ligament.</li><li><b>Hesselbach triangle</b>: inferior epigastric vessels (lateral), lateral border of rectus (medial), inguinal ligament (inferior).</li><li>Femoral triangle, lateral → medial: Nerve, Artery, Vein, (empty space) Lymphatics. The femoral sheath holds the artery, vein and femoral canal; the nerve lies outside it.</li><li>Anterior oblique view of the right groin; hide the external oblique to see the canal contents more clearly.</li></ul>';
      if (st.h === 'ind') {
        tubeR(g, CORD.slice(0, 6), function (t) { return 0.5 + 0.35 * t; }, sacMat(), 90);
        blob(g, [3.05, -7.9, 1.0], [1.05, 1.3, 1.0], sacMat());
        L.push({ t: 'Indirect sac', p: P(3.9, -7.9, 1.2) });
        info = '<ul><li>Passes through the <b>deep ring, lateral to the inferior epigastric vessels</b>, and follows the spermatic cord in the canal; can reach the scrotum.</li><li>Cause: patent processus vaginalis (congenital). Most common hernia in both sexes.</li><li>Covered by all layers of the spermatic cord fascia. “MD’s don’t lie”: Medial = Direct, Lateral = indirect.</li></ul>';
      }
      if (st.h === 'dir') {
        tubeR(g, [[1.25, -1.8, 0.7], [1.25, -1.85, 1.6]], function () { return 0.85; }, sacMat(), 8);
        blob(g, [1.3, -1.95, 2.4], [1.2, 1.15, 1.0], sacMat());
        L.push({ t: 'Direct hernia', p: P(2.4, -1.2, 2.6) });
        info = '<ul><li>Bulges through <b>Hesselbach triangle, medial to the inferior epigastric vessels</b>; an acquired weakness of the transversalis fascia.</li><li>Older men, heavy lifting, chronic cough/straining.</li><li>Does not follow the cord through the deep ring and rarely reaches the scrotum.</li></ul>';
      }
      if (st.h === 'fem') {
        tubeR(g, [[1.9, -3.3, -0.6], FEM_RING, [1.95, -4.9, 1.4]], function (t) { return 0.38 + 0.12 * t; }, sacMat(), 40);
        blob(g, [2.0, -5.5, 1.9], [0.95, 0.9, 0.85], sacMat());
        ringAt(g, FEM_RING, 0.42, [0, 0.6, 1]);
        L.push({ t: 'Femoral hernia', p: P(2.9, -5.8, 2.0) });
        info = '<ul><li>Through the femoral canal, <b>below the inguinal ligament and medial to the femoral vein</b>.</li><li>More common in women; the narrow neck gives the <b>highest risk of strangulation</b>.</li><li>Needs urgent repair.</li></ul>';
      }
      return { labels: L, info: info };
    },
  });
})();
