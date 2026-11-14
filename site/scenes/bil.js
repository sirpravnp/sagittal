// Biliary tree on real anatomy: Z-Anatomy liver, gallbladder, pancreas, duodenum, portal vein,
// hepatic arteries and pancreatic ducts (site/meshes/biliary.js). Z-Anatomy has no cystic,
// common hepatic or hepatic duct objects, so the duct system is drawn as smooth tubes: the
// cystic duct and common bile duct follow Z-Anatomy's own "Bile duct" centre line (sampled
// below, mesh frame, cm), and the common hepatic and right/left hepatic ducts continue it up
// to the porta hepatis. Stones, the pancreatic head mass and the inflamed pancreas are overlays.
(function () {
  var S = 0.36; // cm -> scene units
  // One shader program for every material (clearcoat, no sheen): each extra MeshPhysicalMaterial
  // feature combination costs a separate shader compile, which is slow on software GL.
  function T(kind, opts) {
    var o = Object.assign({ sheen: 0 }, opts || {});
    if (kind === 'highlight' && o.clearcoat === undefined) o.clearcoat = 0.2;
    return Kit.tissue(kind, o);
  }
  function P(x, y, z) { return [x * S, y * S, z * S]; }
  function V3(a) { return new THREE.Vector3(a[0], a[1], a[2]); }

  // Z-Anatomy "Bile duct" curve centre line (every 3rd ring), mesh frame (cm, centred on [-2, 113, 4]).
  // It starts at the gallbladder neck; the first stretch is the cystic duct, then the
  // common bile duct runs down behind the duodenum and through the pancreatic head.
  var BD = [[-1.02, 2.74, -0.08], [-0.84, 2.88, -0.14], [-0.66, 3.04, -0.13], [-0.48, 3.15, -0.11], [-0.26, 3.14, -0.09],
    [0.23, 2.79, -0.08], [0.46, 2.25, -0.07], [0.54, 1.60, -0.06], [0.57, 0.91, -0.09], [0.58, 0.58, -0.13],
    [0.55, 0.28, -0.18], [0.46, 0.00, -0.22], [0.31, -0.29, -0.25], [0.10, -0.54, -0.24], [-0.13, -0.72, -0.21],
    [-0.39, -0.88, -0.18], [-0.68, -1.06, -0.15], [-1.07, -1.29, -0.12], [-1.43, -1.47, -0.08], [-1.78, -1.67, -0.07],
    [-2.13, -1.94, -0.09], [-2.50, -2.35, -0.12], [-2.77, -2.76, -0.17], [-3.02, -3.17, -0.27], [-3.31, -3.58, -0.48],
    [-3.44, -3.71, -0.61], [-3.54, -3.81, -0.75], [-3.64, -3.89, -0.91], [-3.76, -3.99, -1.08]];
  var NECK = [-1.45, 2.45, -0.2];     // gallbladder neck (Hartmann pouch), from the Gallbladder mesh
  var FUNDUS = [-3.2, -0.95, 3.55];   // gallbladder fundus
  var GB_C = [-2.84, 0.42, 1.6];      // gallbladder centroid
  var J = BD[5];                      // cystic duct joins the common hepatic duct
  var HILUM = [0.42, 4.75, -0.3];     // hepatic duct confluence at the porta hepatis
  var AMP = BD[BD.length - 1];        // major duodenal papilla (ampulla of Vater)
  var HEAD = [-1.5, -3.5, -0.4];      // pancreatic head

  function cm(a) { return P(a[0], a[1], a[2]); }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // Tube along cm points with a radius profile r(t) (cm), smooth closed ends.
  function duct(g, pts, rf, material, seg) {
    var curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return V3(cm(p)); }), false, 'centripetal');
    var n = seg || 96, rad = 18;
    var geo = new THREE.TubeGeometry(curve, n, 1, rad, false);
    var pos = geo.attributes.position, frames = curve.computeFrenetFrames(n, false), c = new THREE.Vector3(), v = new THREE.Vector3();
    for (var i = 0; i <= n; i++) {
      var t = i / n, r = rf(t) * S;
      curve.getPointAt(t, c);
      for (var j = 0; j <= rad; j++) {
        var k = i * (rad + 1) + j;
        v.fromBufferAttribute(pos, k).sub(c).setLength(r).add(c);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
    var me = new THREE.Mesh(geo, material); g.add(me);
    [0, 1].forEach(function (e) {
      var cap = new THREE.Mesh(new THREE.SphereGeometry(rf(e) * S, 18, 12), material);
      cap.position.copy(curve.getPointAt(e)); g.add(cap);
    });
    return me;
  }
  // r(t) helper: piecewise-linear through [t, r] stops.
  function prof(stops) {
    return function (t) {
      for (var i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) { var a = stops[i - 1], b = stops[i], u = (t - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * u; }
      }
      return stops[stops.length - 1][1];
    };
  }

  function stone(g, p, r, seed) {
    var geo = new THREE.IcosahedronGeometry(r * S, 1), pos = geo.attributes.position, v = new THREE.Vector3();
    var s = seed || 1;
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      s = (s * 9301 + 49297) % 233280;
      v.multiplyScalar(0.88 + 0.2 * (s / 233280));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    var me = new THREE.Mesh(geo, T('bone', { color: 0xf5d36a, roughness: 0.7, emissive: 0xa07010, emissiveIntensity: 0.75 }));
    me.position.set.apply(me.position, cm(p)); me.rotation.set(s % 3, s % 5, s % 7); g.add(me);
    return me;
  }

  Kit.register({
    id: 'bil',
    meshes: ['biliary'],
    center: [-0.15, -0.1, 0],
    zoom: 9.5,
    rot: [0.15, -0.38],
    controls: [{ k: 'p', label: 'Condition', def: 'norm', opts: [
      ['norm', 'Normal anatomy'],
      ['gb', 'Cholelithiasis (gallbladder stones)'],
      ['cbd', 'Choledocholithiasis / cholangitis'],
      ['pan', 'Gallstone pancreatitis (ampulla)'],
      ['mir', 'Mirizzi syndrome'],
      ['cou', 'Courvoisier sign (pancreatic head mass)'],
    ] }],
    build: function (g, st) {
      var p = st.p;
      var body = new THREE.Group(); body.scale.setScalar(S); g.add(body);
      var stones = (p === 'gb' || p === 'mir' || p === 'cbd' || p === 'pan');

      // --- real organs ---
      Kit.meshPart(body, 'biliary', 'liver', T('liver', { opacity: 0.17, depthWrite: false }));
      Kit.meshPart(body, 'biliary', 'portal_vein', T('vessel-vein'));
      Kit.meshPart(body, 'biliary', 'hepatic_artery', T('vessel-artery'));
      var panc = Kit.meshPart(body, 'biliary', 'pancreas', p === 'pan'
        ? T('pancreas', { color: 0xd9735a, emissive: 0x8a1e10, emissiveIntensity: 0.35, opacity: 0.62 })
        : T('pancreas', { opacity: p === 'cou' ? 0.3 : 0.62, depthWrite: false }));
      if (p === 'pan') { // oedematous gland: swell it about its own centre
        var pc = new THREE.Vector3();
        panc.geometry.computeBoundingBox(); panc.geometry.boundingBox.getCenter(pc);
        panc.scale.setScalar(1.06); panc.position.copy(pc).multiplyScalar(-0.06);
      }
      Kit.meshPart(body, 'biliary', 'pancreatic_duct', T('pancreas', { color: 0xe6c34a, roughness: 0.4 }));
      Kit.meshPart(body, 'biliary', 'duodenum', T('bowel', { opacity: 0.5, depthWrite: false }));

      // Gallbladder: distended in Courvoisier (scaled about the neck so it stays on the cystic duct).
      var gbG = new THREE.Group(); gbG.position.set(NECK[0], NECK[1], NECK[2]); body.add(gbG);
      var gb = Kit.meshPart(gbG, 'biliary', 'gallbladder', stones ? T('gallbladder', { opacity: 0.28, depthWrite: false }) : T('gallbladder'));
      gb.position.set(-NECK[0], -NECK[1], -NECK[2]);
      if (p === 'cou') gbG.scale.set(1.3, 1.3, 1.3);

      // --- ducts ---
      var dil = (p === 'cbd' || p === 'cou') ? 1.85 : p === 'pan' ? 1.35 : 1;
      var see = (p === 'cbd' || p === 'pan');
      var dm = function () { return T('bile-duct', see ? { opacity: 0.6, depthWrite: false } : {}); };
      if (p === 'cbd') dm = function () { return T('bile-duct', { color: 0x8f8a3a, emissive: 0x7a2a00, emissiveIntensity: 0.3, opacity: 0.6, depthWrite: false }); };
      // cystic duct: gallbladder neck -> junction, along the real curve
      duct(g, [NECK].concat(BD.slice(0, 6)), prof([[0, 0.3], [0.2, 0.2], [1, 0.2]]), T('bile-duct'), 48);
      // common bile duct: junction -> ampulla, along the real curve; tapers into the papilla
      var cbdR = 0.3 * dil;
      duct(g, BD.slice(5), prof([[0, cbdR], [0.82, cbdR], [1, 0.16]]), dm(), 120);
      // common hepatic duct: junction -> porta hepatis (narrowed by the Mirizzi stone)
      var chdPts = [J, [0.42, 3.35, -0.1], [0.48, 4.05, -0.18], HILUM];
      var chdR = 0.27 * (dil > 1 ? Math.min(dil, 1.6) : 1);
      duct(g, chdPts, p === 'mir' ? prof([[0, 0.27], [0.15, 0.1], [0.45, 0.1], [0.62, 0.38], [1, 0.38]]) : prof([[0, chdR], [1, chdR]]), dm(), 48);
      // right and left hepatic ducts entering the liver (dilated above any obstruction)
      var hr = (dil > 1 || p === 'mir') ? 0.34 : 0.22;
      duct(g, [HILUM, [-0.4, 5.25, -0.45], [-1.5, 5.75, -0.75], [-2.6, 6.5, -1.1]], prof([[0, hr], [1, hr * 0.7]]), dm(), 40);
      duct(g, [HILUM, [1.2, 5.2, -0.4], [2.3, 5.55, -0.4], [3.4, 6.2, -0.3]], prof([[0, hr], [1, hr * 0.7]]), dm(), 40);
      // cystic artery: from the right hepatic artery through Calot triangle to the gallbladder neck
      duct(g, [[-1.22, 2.72, 2.3], [-0.7, 3.4, 1.2], [-0.75, 3.55, 0.35], [-1.35, 3.0, 0.05]], prof([[0, 0.09], [1, 0.07]]), T('vessel-artery'), 40);
      // Calot triangle: cystic duct, common hepatic duct, inferior surface of the liver
      var tri = new THREE.Shape([[-0.9, 3.12], [0.3, 2.95], [0.4, 4.4]].map(function (q) { return new THREE.Vector2(q[0] * S, q[1] * S); }));
      var tm = new THREE.Mesh(new THREE.ShapeGeometry(tri), T('highlight', { opacity: 0.5, depthWrite: false }));
      tm.position.z = 0.25 * S; g.add(tm);

      // --- pathology ---
      if (p === 'gb' || p === 'mir') {
        [[0.55, 0.35, 0.2, 0.42], [0.62, -0.3, -0.1, 0.36], [0.72, 0.15, 0.35, 0.4], [0.8, -0.25, 0.1, 0.34], [0.68, 0.45, -0.3, 0.3]].forEach(function (s, i) {
          var a = lerp(NECK, FUNDUS, s[0]); stone(g, [a[0] + s[1], a[1] + s[2] * 0.5, a[2] + s[2]], s[3], i + 3);
        });
      }
      if (p === 'mir') stone(g, [-1.05, 2.5, 0.05], 0.62, 11); // impacted in Hartmann pouch, pressing on the CHD
      if (p === 'cbd') stone(g, BD[19], 0.42, 5);
      if (p === 'pan') stone(g, lerp(BD[26], AMP, 0.6), 0.4, 7);
      if (p === 'cou') {
        // lobulated, firm mass replacing the pancreatic head
        var mass = new THREE.Mesh(new THREE.SphereGeometry(1.7 * S, 48, 32), T('fibroid', { color: 0xc9b79c, roughness: 0.8, emissive: 0x3a2418, emissiveIntensity: 0.3 }));
        var mp = mass.geometry.attributes.position, v = new THREE.Vector3();
        for (var i = 0; i < mp.count; i++) { v.fromBufferAttribute(mp, i).normalize(); var k = 1 + 0.09 * Math.sin(v.x * 5.1 + 1) * Math.cos(v.y * 4.3) + 0.05 * Math.sin(v.z * 7.7 + v.x * 3); v.multiplyScalar(1.7 * S * k); mp.setXYZ(i, v.x, v.y * 0.9, v.z * 0.85); }
        mass.geometry.computeVertexNormals();
        mass.position.set.apply(mass.position, cm(HEAD)); g.add(mass);
      }

      var L = [
        { t: 'Liver', p: P(5.5, 7.5, 2) }, { t: 'Gallbladder', p: P(-3.2, 0.2, 2.6) }, { t: 'Hartmann pouch / neck', p: P(-1.9, 2.1, 0.2) },
        { t: 'Cystic duct', p: P(-0.7, 2.75, 0.1) }, { t: 'Common hepatic duct', p: P(0.55, 3.7, 0) }, { t: 'Common bile duct', p: P(0.6, 0.6, 0) },
        { t: 'Right / left hepatic ducts', p: P(1.4, 5.4, 0) }, { t: 'Calot triangle', p: P(-0.3, 4.0, 0.3) }, { t: 'Cystic artery', p: P(-0.7, 3.4, 1.2) },
        { t: 'Duodenum', p: P(-4.6, -3.6, 1.5) }, { t: 'Pancreatic head', p: P(-1.0, -3.6, 0) }, { t: 'Ampulla of Vater', p: P(-3.8, -4.1, -1) },
        { t: 'Pancreatic duct', p: P(3.0, -0.6, -1.5) },
      ];
      if (p === 'gb') L.push({ t: 'Gallstones', p: P(-2.6, 0.6, 1.8) });
      if (p === 'cbd') L.push({ t: 'CBD stone (dilated duct)', p: BD[19].map(function (x) { return x * S; }) });
      if (p === 'pan') L.push({ t: 'Stone impacted at ampulla', p: P(-3.6, -4.0, -0.9) });
      if (p === 'mir') L.push({ t: 'Impacted stone compressing CHD', p: P(-0.95, 2.55, 0) });
      if (p === 'cou') L.push({ t: 'Pancreatic head mass', p: P(-0.6, -4.9, 0.4) });
      var infos = {
        norm: '<ul><li>Bile flows: hepatic ducts → common hepatic duct → (cystic duct to gallbladder) → common bile duct → ampulla of Vater (sphincter of Oddi) → duodenum.</li><li><b>Calot triangle</b>: cystic duct, common hepatic duct and inferior liver edge; contains the cystic artery. Key landmark in cholecystectomy.</li></ul>',
        gb: '<ul><li><b>Cholelithiasis</b>: often silent; biliary colic after fatty meals (RUQ pain, 30 min to hours).</li><li>If the stone impacts the cystic duct and inflammation follows: acute cholecystitis (fever, Murphy sign, ↑WBC).</li></ul>',
        cbd: '<ul><li><b>Choledocholithiasis</b>: duct dilates; ↑ALP, ↑direct bilirubin.</li><li>If infected: <b>cholangitis</b> with Charcot triad (fever, jaundice, RUQ pain); add shock and confusion for Reynold pentad.</li><li>Management: broad-spectrum antibiotics, urgent biliary decompression (ERCP).</li></ul>',
        pan: '<ul><li>A stone at the <b>ampulla of Vater</b> blocks the pancreatic duct and bile duct → <b>gallstone pancreatitis</b> (the most common cause with alcohol).</li><li>Epigastric pain radiating to the back, ↑lipase; often with ↑ALT.</li></ul>',
        mir: '<ul><li><b>Mirizzi syndrome</b>: a stone in the Hartmann pouch/cystic duct compresses the common hepatic duct (note the narrowed CHD).</li><li>Obstructive jaundice with a gallbladder source; diagnosed on imaging/ERCP.</li></ul>',
        cou: '<ul><li><b>Courvoisier sign</b>: painless jaundice plus a palpable, non-tender gallbladder suggests malignant obstruction (e.g. pancreatic head cancer), not stones.</li><li>The mass blocks the distal common bile duct, which dilates, as does the gallbladder.</li></ul>',
      };
      return { labels: L, info: infos[p] };
    },
  });
})();
