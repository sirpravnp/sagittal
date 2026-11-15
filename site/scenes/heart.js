// Congenital heart defects on a real, CT-derived four-chamber heart.
// Base anatomy: Rodero et al. 2021 average adult heart (meshes/heart.js walls + great-vessel roots,
// meshes/heart-blood.js chamber cavities as blood casts; CC BY 4.0). The myocardium is drawn as
// see-through glass over colour-coded blood casts so septa, shunts and outflow tracts stay visible.
// Great-vessel continuations (arch, branches, descending aorta, pulmonary trunk/branches, cavae,
// pulmonary veins) are swept tubes whose centrelines come from Z-Anatomy (CC BY-SA 4.0), registered
// to the Rodero heart (similarity fit on chamber centroids and valve centres, residuals < 1 cm).
// All coordinates below are in the baked mesh frame: cm, +x patient left, +y superior, +z anterior.
(function () {
  var S = 0.3; // cm -> scene units

  // ---- centrelines (cm, mesh frame) ----
  var AO_ASC = [[-2.2, 5.3, 0.5], [-2.2, 6.5, 1.0], [-2.0, 7.7, 0.9]];
  var AO_ARCH = [[-1.6, 8.8, 0.0], [-1.2, 9.3, -1.2], [-1.0, 9.1, -2.6], [-1.0, 8.5, -3.8], [-1.0, 7.4, -4.8],
    [-0.8, 5.1, -5.6], [-0.7, 2.3, -5.7], [-0.8, 0.2, -5.5]];
  var BCT = [[-1.8, 8.9, 0.1], [-2.0, 9.8, 0.4], [-3.0, 10.7, 0.7], [-3.8, 11.3, 0.8]];
  var LCCA = [[-1.3, 9.4, -0.9], [-1.4, 10.5, -0.4], [-1.4, 11.7, -0.2]];
  var LSA = [[-1.0, 9.3, -2.0], [-0.8, 10.3, -1.6], [-0.3, 11.3, -1.1], [0.6, 11.9, -0.7]];
  var PT = [[0.75, 2.95, 2.3], [0.45, 4.35, 2.8], [0.3, 5.2, 1.8], [0.12, 5.65, 0.4], [0.0, 5.65, -0.7]];
  var LPA = [[0.0, 5.65, -0.7], [1.2, 6.0, -2.1], [2.3, 5.8, -3.5], [3.3, 5.1, -4.7], [4.1, 4.3, -5.3]];
  var RPA = [[0.0, 5.65, -0.7], [-1.2, 5.3, -1.9], [-2.6, 5.0, -2.3], [-4.0, 4.7, -2.4], [-5.4, 4.3, -2.6]];
  var SVC = [[-4.3, 8.6, 0.9], [-4.3, 6.8, 0.6], [-4.2, 5.0, 0.0], [-4.0, 3.5, -0.8]];
  var IVC = [[-3.7, -4.3, -2.3], [-4.1, -3.1, -2.3], [-4.6, -1.8, -2.6]];
  var PVS = [ // pulmonary vein stubs from the Rodero inlet rings outwards
    [[0.5, 4.85, -3.3], [1.9, 4.2, -4.4], [3.2, 3.9, -5.0]],
    [[0.9, 3.7, -4.5], [2.3, 3.4, -5.1], [3.6, 3.2, -5.4]],
    [[-3.7, 4.0, -2.4], [-5.1, 4.3, -2.9], [-6.3, 4.5, -3.1]],
    [[-4.0, 2.6, -4.2], [-5.3, 2.5, -4.6], [-6.4, 2.4, -4.8]],
  ];
  // TGA: aorta from the RV infundibulum, anterior and to the right; pulmonary trunk from the LV.
  var TGA_AO = [[0.6, 3.0, 2.3], [-0.2, 4.4, 2.7], [-1.2, 6.0, 2.2], [-1.8, 7.5, 1.1]];
  var TGA_PT = [[-0.4, 1.8, -0.3], [0.1, 3.3, -0.5], [0.25, 4.7, -0.7], [0.0, 5.65, -0.7]];
  // landmarks
  var PV = [0.69, 3.21, 2.34];      // pulmonary valve centre (Rodero valve plane)
  var AV = [-0.46, 1.7, -0.3];      // aortic valve centre
  var RV_BODY = [-0.47, -1.18, 2.14];
  var FO = [-2.8, 0.9, -2.4];       // fossa ovalis region of the interatrial septum
  var FO_N = [0.6, 0.15, -0.78];    // septal normal, RA -> LA
  var VSD_LV = [-0.45, 1.15, 0.05], VSD_RV = [-0.65, 0.25, 1.0]; // perimembranous, just below the aortic valve
  var DUCT = [[0.9, 6.3, -2.1], [0.45, 7.25, -2.75], [-0.3, 8.05, -3.25]]; // LPA origin -> aortic isthmus

  function V3(p) { return new THREE.Vector3(p[0], p[1], p[2]); }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function addv(a, b, k) { k = k === undefined ? 1 : k; return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  // Swept tube with a radius that tapers from r0 to r1, closed with flat caps (a cut vessel).
  function vtube(parent, pts, r0, r1, m, caps) {
    var curve = new THREE.CatmullRomCurve3(pts.map(V3), false, 'centripetal');
    var n = Math.max(24, pts.length * 14), rs = 18;
    var fr = curve.computeFrenetFrames(n, false);
    var pos = [], idx = [], i, j;
    for (i = 0; i <= n; i++) {
      var t = i / n, c = curve.getPointAt(t), r = r0 + (r1 - r0) * t;
      for (j = 0; j < rs; j++) {
        var a = j / rs * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
        pos.push(c.x + r * (cs * fr.normals[i].x + sn * fr.binormals[i].x),
          c.y + r * (cs * fr.normals[i].y + sn * fr.binormals[i].y),
          c.z + r * (cs * fr.normals[i].z + sn * fr.binormals[i].z));
      }
    }
    for (i = 0; i < n; i++) for (j = 0; j < rs; j++) {
      var a0 = i * rs + j, a1 = i * rs + (j + 1) % rs, b0 = a0 + rs, b1 = a1 + rs;
      idx.push(a0, b0, a1, a1, b0, b1);
    }
    if (caps !== false) [0, n].forEach(function (ri) {
      var c = curve.getPointAt(ri / n), ci = pos.length / 3;
      pos.push(c.x, c.y, c.z);
      for (j = 0; j < rs; j++) {
        var q0 = ri * rs + j, q1 = ri * rs + (j + 1) % rs;
        if (ri === 0) idx.push(ci, q0, q1); else idx.push(ci, q1, q0);
      }
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    var me = new THREE.Mesh(geo, m); parent.add(me); return me;
  }

  // Cloned, editable copy of a baked part (the shared geometry must not be mutated).
  function editable(parent, mesh, part, m, fn) {
    var me = Kit.meshPart(parent, mesh, part, m);
    var geo = me.geometry.clone(); geo.userData = {};
    var p = geo.attributes.position, v = new THREE.Vector3();
    for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, i, geo); p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals(); geo.computeBoundingSphere();
    me.geometry = geo; return me;
  }
  // Pull points within `reach` cm of `centre` toward the axis (centre, dir) by up to `k`.
  function pinch(v, centre, dir, reach, k) {
    var c = V3(centre), d = V3(dir).normalize();
    var dist = v.distanceTo(c); if (dist > reach) return;
    var w = 1 - dist / reach; w = w * w * (3 - 2 * w);
    var rel = v.clone().sub(c), along = d.clone().multiplyScalar(rel.dot(d));
    v.copy(c).add(along).add(rel.sub(along).multiplyScalar(1 - k * w));
  }

  Kit.register({
    id: 'heart',
    meshes: ['heart', 'heart-blood'],
    center: [0, 0.75, 0],
    zoom: 9.2,
    rot: [0.12, 0],
    controls: [{ k: 'd', label: 'Defect', def: 'normal', opts: [
      ['normal', 'Normal heart'],
      ['asd', 'Atrial septal defect (ASD)'],
      ['vsd', 'Ventricular septal defect (VSD)'],
      ['pda', 'Patent ductus arteriosus (PDA)'],
      ['tof', 'Tetralogy of Fallot'],
      ['tga', 'Transposition of great arteries'],
    ] }],
    build: function (g, st) {
      var d = st.d, h = Kit.helpers;
      var H = new THREE.Group(); H.scale.setScalar(S); g.add(H);
      // per-variant viewing angle: the atrial septum is best seen from behind (posterior view),
      // the ventricular septum and outflow tracts from a shallow left anterior oblique, the ductus
      // from the left side
      var view = { asd: 2.6, vsd: -0.3, pda: -1.25, tof: -0.3, tga: -0.2 }[d] || 0;
      H.rotation.set(0, view, 0);
      H.updateMatrix();
      // teaching overlays stay visible through the casts
      function top(o) { o.traverse(function (x) { x.renderOrder = 10; if (x.material) { x.material.depthTest = false; x.material.transparent = true; } }); return o; }
      function P(p) { return V3(p).applyMatrix4(H.matrix).toArray(); } // mesh cm -> scene units

      // blood content per compartment
      var c = { RA: 'deoxy', RV: 'deoxy', PA: 'deoxy', LA: 'oxy', LV: 'oxy', AO: 'oxy', DUCT: 'oxy' };
      if (d === 'asd') { c.RA = c.RV = c.PA = 'mixed'; }
      if (d === 'vsd') { c.RV = c.PA = 'mixed'; }
      if (d === 'pda') { c.PA = 'mixed'; }
      if (d === 'tof') { c.AO = 'mixed'; }
      if (d === 'tga') { c.AO = 'deoxy'; c.PA = 'oxy'; }
      var mats = {}; // one shared material per kind keeps draw-state changes down
      function blood(k, o) {
        var key = c[k] + (o ? JSON.stringify(o) : '');
        return mats[key] || (mats[key] = Kit.tissue('blood-' + c[k], o));
      }

      // ---- blood casts of the four chambers ----
      var see = { opacity: 0.4 };
      var cav = {}; // chamber casts, so each chamber label can find a visible point on its own chamber
      cav.la = Kit.meshPart(H, 'heart-blood', 'cav_la', blood('LA'));
      cav.lv = Kit.meshPart(H, 'heart-blood', 'cav_lv', blood('LV'));
      cav.ra = Kit.meshPart(H, 'heart-blood', 'cav_ra', blood('RA', d === 'asd' || d === 'tga' ? see : {}));
      var rvO = d === 'vsd' ? see : {};
      if (d === 'tof') {
        // narrowed right ventricular outflow tract (infundibular stenosis)
        cav.rv = editable(H, 'heart-blood', 'cav_rv', blood('RV', rvO), function (v) { pinch(v, PV, sub(PV, RV_BODY), 3.2, 0.62); });
      } else cav.rv = Kit.meshPart(H, 'heart-blood', 'cav_rv', blood('RV', rvO));

      // ---- myocardium as glass ----
      // (no sheen/clearcoat on the see-through shell: it covers most pixels and software GL pays per pixel)
      function glass(o) { return Kit.tissue('myocardium', Object.assign({ opacity: 0.3, side: THREE.FrontSide, color: 0xb2483f, sheen: 0, clearcoat: 0 }, o || {})); }
      var gl0 = glass();
      Kit.meshPart(H, 'heart', 'wall_lv', gl0);
      Kit.meshPart(H, 'heart', 'wall_la', gl0);
      Kit.meshPart(H, 'heart', 'wall_ra', gl0);
      if (d === 'tof') {
        // RV hypertrophy: thicken the free wall (taper to zero where it meets the LV)
        var lvp = Kit.meshInfo('heart').bbox.wall_lv, lvc = [(lvp[0] + lvp[3]) / 2, (lvp[1] + lvp[4]) / 2, (lvp[2] + lvp[5]) / 2];
        var rvw = editable(H, 'heart', 'wall_rv', glass({ opacity: 0.5, color: 0x8e2b26 }), function (v, i, geo) {
          var n = geo.attributes.normal; var nv = new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i));
          var away = v.clone().sub(V3(lvc)); away.y = 0;
          var w = Math.max(0, Math.min(1, (away.dot(new THREE.Vector3(-0.78, 0, 0.63)) - 0.5) / 2.5));
          v.addScaledVector(nv, 0.55 * w);
          pinch(v, PV, sub(PV, RV_BODY), 2.6, 0.45);
        });
        rvw.renderOrder = 2;
      } else Kit.meshPart(H, 'heart', 'wall_rv', gl0);

      // ---- great vessels ----
      var tubeM = function (k) { return blood(k); };
      var aoShift = d === 'tof' ? [-0.55, 0, 0.45] : [0, 0, 0]; // overriding aorta: root moved over the septum
      if (d !== 'tga') {
        var ao = Kit.meshPart(H, 'heart', 'aorta', tubeM('AO')); cav.ao = [ao];
        ao.position.set(aoShift[0], aoShift[1], aoShift[2]);
        var asc = AO_ASC.map(function (p, i) { return i === 0 ? addv(p, aoShift) : p; });
        cav.ao.push(vtube(H, asc.concat(AO_ARCH), 1.3, 1.0, tubeM('AO'), true));
        var pr = d === 'tof' ? 0.62 : 1;
        cav.pa = [vtube(H, PT, 1.3 * pr, 1.1 * pr, tubeM('PA')), vtube(H, LPA, 0.85 * pr, 0.7 * pr, tubeM('PA')),
          vtube(H, RPA, 0.85 * pr, 0.7 * pr, tubeM('PA'))];
      } else {
        cav.ao = [vtube(H, TGA_AO.concat(AO_ARCH), 1.3, 1.0, tubeM('AO'))];
        cav.pa = [vtube(H, TGA_PT, 1.2, 1.1, tubeM('PA')), vtube(H, LPA, 0.85, 0.7, tubeM('PA')), vtube(H, RPA, 0.85, 0.7, tubeM('PA'))];
      }
      vtube(H, BCT, 0.6, 0.55, tubeM('AO'));
      vtube(H, LCCA, 0.42, 0.4, tubeM('AO'));
      vtube(H, LSA, 0.42, 0.38, tubeM('AO'));
      var venous = mats.deoxy || Kit.tissue('blood-deoxy'), pvM = mats.oxy || Kit.tissue('blood-oxy');
      vtube(H, SVC, 1.0, 1.0, venous);
      vtube(H, IVC, 1.05, 1.05, venous);
      PVS.forEach(function (pv) { vtube(H, pv, 0.55, 0.5, pvM); });

      var back = d === 'asd'; // posterior view: anchor labels on the posterior surfaces
      // Each chamber/vessel label names its mesh (on): if the preferred point is hidden in this view the
      // kit moves the dot to the nearest visible point of that chamber. The right atrium is not seen
      // from the left side (PDA view), so it is not labelled there.
      var L = [
        { t: 'Right atrium', p: P(back ? [-5.4, 0.2, -1.6] : [-5.6, 0.6, 0.4]), on: cav.ra, skip: d === 'pda' },
        { t: 'Left atrium', p: P(back ? [-2.6, 3.4, -4.4] : [1.6, 2.6, -3.0]), on: cav.la, skip: d === 'normal' },
        { t: 'Right ventricle', p: P(back ? [-0.4, -3.8, -0.6] : [-1.2, -3.6, 3.6]), on: cav.rv },
        { t: 'Left ventricle', p: P(back ? [0.9, -2.2, -3.3] : [3.6, -2.4, 0.6]), on: cav.lv },
        { t: 'Aorta', p: P(d === 'tga' ? [-1.6, 7.0, 2.4] : [-1.4, 9.6, -0.4]), on: cav.ao },
        { t: 'Pulmonary artery', p: P(d === 'tga' ? [3.6, 5.0, -4.5] : back ? [-2.9, 5.7, -2.3] : [0.6, 5.2, 3.7]), on: cav.pa },
      ].filter(function (l) { return !l.skip; });
      var info = '';
      if (d === 'normal') {
        info = '<ul><li>Blue = deoxygenated, red = oxygenated, purple = mixed.</li><li>Systemic return: RA → RV → pulmonary artery. Pulmonary return: LA → LV → aorta.</li><li>Left-sided pressures exceed right-sided, so a hole between the sides shunts left → right unless the right side is obstructed.</li></ul>';
      }
      var hl = 0xffd23f;
      if (d === 'asd' || d === 'tga') {
        // defect in the fossa ovalis region of the interatrial septum
        var a = addv(FO, FO_N, 0.75), b = addv(FO, FO_N, -0.75);
        vtube(H, [a, FO, b], 0.55, 0.55, Kit.tissue('blood-mixed'));
        top(h.ring(g, P(FO), 0.22, hl)).quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V3(FO_N).transformDirection(H.matrix));
      }
      if (d === 'asd') {
        top(h.arrow(g, P(addv(FO, FO_N, 1.9)), P(addv(FO, FO_N, -1.6))));
        L.push({ t: 'ASD (fossa ovalis)', p: P(FO), behind: true }); // in the septum: ring drawn through the heart
        info = '<ul><li><b>Left-to-right shunt</b> at atrial level (ostium secundum most common; ostium primum is associated with Down syndrome).</li><li>Right atrial/ventricular volume overload and increased pulmonary flow.</li><li>Fixed split S2; systolic ejection murmur at the left upper sternal border (extra flow across the pulmonic valve).</li><li>Paradoxical embolism is possible. Eisenmenger if the shunt reverses.</li></ul>';
      }
      if (d === 'vsd' || d === 'tof') {
        var vm = [(VSD_LV[0] + VSD_RV[0]) / 2, (VSD_LV[1] + VSD_RV[1]) / 2, (VSD_LV[2] + VSD_RV[2]) / 2];
        var vd = norm(sub(VSD_RV, VSD_LV));
        vtube(H, [addv(VSD_LV, vd, -0.3), vm, addv(VSD_RV, vd, 0.3)], 0.62, 0.62, Kit.tissue('blood-mixed'));
        top(h.ring(g, P(vm), 0.23, hl)).quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V3(vd).transformDirection(H.matrix));
        if (d === 'vsd') {
          top(h.arrow(g, P([1.6, 1.4, -0.8]), P([-2.4, 0.15, 1.6])));
          L.push({ t: 'VSD (membranous)', p: P(addv(vm, [0.6, -0.6, 0.9])) });
          info = '<ul><li>Most common congenital heart defect; membranous septum is the usual site.</li><li><b>Left-to-right shunt</b>; holosystolic murmur at the left lower sternal border (smaller defects are louder).</li><li>Large defects: pulmonary overcirculation, heart failure, then pulmonary hypertension and <b>Eisenmenger</b> (shunt reverses, cyanosis, clubbing).</li></ul>';
        }
      }
      if (d === 'pda') {
        vtube(H, DUCT, 0.55, 0.6, Kit.tissue('blood-oxy', { emissive: 0xff5a3a, emissiveIntensity: 0.35 }));
        top(h.ring(g, P(DUCT[1]), 0.24, hl)).quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V3(norm(sub(DUCT[2], DUCT[0]))).transformDirection(H.matrix));
        top(h.arrow(g, P([0.0, 8.9, -5.0]), P([1.9, 6.4, -3.6])));
        L.push({ t: 'Ductus (PDA)', p: P([1.4, 7.4, -3.0]) });
        info = '<ul><li>Persistent channel between the <b>descending aorta (just distal to the left subclavian)</b> and the left pulmonary artery.</li><li>Left-to-right shunt: continuous “machinery” murmur, bounding pulses, wide pulse pressure.</li><li>Associated with prematurity and maternal rubella. Closure: indomethacin/ibuprofen. If a ductus-dependent lesion exists, keep it open with prostaglandin E1.</li></ul>';
      }
      if (d === 'tof') {
        top(h.ring(g, P(addv(PV, [0, 0.2, 0])), 0.2, 0xff7a3f)).quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V3(norm(sub(PV, RV_BODY))).transformDirection(H.matrix));
        top(h.arrow(g, P([-1.2, -1.2, 2.4]), P([-1.9, 3.0, 0.9])));
        L.push({ t: 'VSD', p: P(vm), behind: true }, { t: 'Pulmonary stenosis', p: P([1.6, 3.4, 3.4]) },
          { t: 'RV hypertrophy', p: P([-3.6, -2.4, 4.0]) }, { t: 'Overriding aorta', p: P([-2.1, 5.1, 2.6]), on: cav.ao });
        info = '<ul><li>Four features: <b>pulmonary (infundibular) stenosis, RVH, overriding aorta, VSD.</b></li><li>Right-to-left shunt across the VSD → cyanosis. “Tet spells” improve with squatting (raises SVR, pushes blood toward the lungs).</li><li>Boot-shaped heart on CXR. Associated with 22q11 deletion. Classically the most common cyanotic CHD beyond infancy.</li></ul>';
      }
      if (d === 'tga') {
        L.push({ t: 'Mixing site needed (ASD/VSD/PDA)', p: P(FO), behind: true }); // at the atrial septum (ring drawn through)
        info = '<ul><li><b>Aorta arises from the RV; pulmonary artery from the LV</b> → two parallel circuits.</li><li>Not compatible with life without mixing (PDA, ASD or VSD). Cyanosis in the first days of life.</li><li>“Egg on a string” CXR (narrow mediastinum). Associated with maternal diabetes.</li><li>Keep the ductus open with prostaglandin E1; definitive fix is the arterial switch.</li></ul>';
      }
      return { labels: L, info: info };
    },
  });
})();
