// Congenital heart defects. Ported from the anatomy3d.html prototype.
(function () {
  var h = Kit.helpers, ell = h.ell, add = h.add, tube = h.tube, ring = h.ring, arrow = h.arrow, mat = h.mat;

  Kit.register({
    id: 'heart',
    center: [0, 0.3, 0],
    zoom: 9.5,
    rot: [-0.15, 0.35],
    controls: [{ k: 'd', label: 'Defect', def: 'normal', opts: [
      ['normal', 'Normal heart'],
      ['asd', 'Atrial septal defect (ASD)'],
      ['vsd', 'Ventricular septal defect (VSD)'],
      ['pda', 'Patent ductus arteriosus (PDA)'],
      ['tof', 'Tetralogy of Fallot'],
      ['tga', 'Transposition of great arteries'],
    ] }],
    build: function (g, st) {
      var d = st.d, B = 0x3a6fd8, R = 0xd8403a, P = 0x9553c9;
      var c = { RA: B, RV: B, LA: R, LV: R, AO: R, PA: B };
      if (d === 'asd') { c.RA = c.RV = c.PA = P; }
      if (d === 'vsd') { c.RV = c.PA = P; }
      if (d === 'pda') { c.PA = P; }
      if (d === 'tof') { c.AO = P; }
      if (d === 'tga') { c.AO = B; c.PA = R; }
      var rvS = d === 'tof' ? [0.98, 1.14, 0.85] : [0.8, 1, 0.7];
      ell(g, c.RA, 0.72, [-1.1, 0.9, 0], [0.7, 0.8, 0.6]);
      ell(g, c.LA, 0.72, [1.1, 0.9, -0.4], [0.7, 0.7, 0.6]);
      ell(g, c.RV, 0.72, [-0.4, -0.7, 0.3], rvS);
      ell(g, c.LV, 0.72, [0.7, -0.7, 0], [0.85, 1.1, 0.7]);
      add(g, new THREE.BoxGeometry(0.06, 1.6, 1), mat(0xcccccc, 0.6), [0.15, -0.7, 0.15]);
      add(g, new THREE.BoxGeometry(0.06, 1.2, 0.9), mat(0xcccccc, 0.6), [0, 0.9, -0.2]);
      var tail = [[1.7, 2.2, -0.6], [2, 1, -0.8], [2, -0.9, -0.8]];
      var ao;
      if (d === 'tga') ao = [[-0.4, -0.1, 0.45], [-0.3, 0.9, 0.6], [-0.1, 1.8, 0.3], [0.8, 2.5, -0.3]].concat(tail);
      else if (d === 'tof') ao = [[0.1, -0.15, 0.15], [0.15, 0.9, 0], [0.2, 1.7, -0.1], [0.8, 2.5, -0.3]].concat(tail);
      else ao = [[0.4, -0.2, -0.1], [0.2, 0.9, -0.1], [0.2, 1.7, -0.1], [0.8, 2.5, -0.3]].concat(tail);
      tube(g, ao, 0.27, mat(c.AO, 0.9));
      var pr = d === 'tof' ? 0.12 : 0.22;
      if (d === 'tga') {
        tube(g, [[0.4, -0.2, -0.1], [0.2, 0.9, -0.1], [0.2, 1.7, -0.2]], pr, mat(c.PA, 0.9), 20);
        tube(g, [[0.2, 1.7, -0.2], [-0.6, 1.95, -0.2], [-1.5, 2, -0.2]], pr * 0.8, mat(c.PA, 0.9), 20);
        tube(g, [[0.2, 1.7, -0.2], [0.8, 1.9, -0.1], [1.3, 1.9, 0]], pr * 0.8, mat(c.PA, 0.9), 20);
      } else {
        tube(g, [[-0.4, -0.1, 0.5], [-0.3, 0.9, 0.6], [-0.2, 1.7, 0.4]], pr, mat(c.PA, 0.9), 20);
        tube(g, [[-0.2, 1.7, 0.4], [-0.7, 1.95, 0.1], [-1.5, 2, -0.1]], pr * 0.8, mat(c.PA, 0.9), 20);
        tube(g, [[-0.2, 1.7, 0.4], [0.5, 1.95, 0.3], [1.3, 1.9, 0]], pr * 0.8, mat(c.PA, 0.9), 20);
      }
      var L = [
        { t: 'Right atrium', p: [-1.6, 1.4, 0.3] }, { t: 'Left atrium', p: [1.7, 1.3, -0.4] },
        { t: 'Right ventricle', p: [-1.3, -1.2, 0.5] }, { t: 'Left ventricle', p: [1.5, -1.2, 0.2] },
        { t: 'Aorta', p: [1.4, 2.5, -0.5] }, { t: 'Pulmonary artery', p: [-1.6, 2.3, 0.3] },
      ];
      var info = '';
      if (d === 'normal') {
        info = '<ul><li>Blue = deoxygenated, red = oxygenated, purple = mixed.</li><li>Systemic return: RA → RV → pulmonary artery. Pulmonary return: LA → LV → aorta.</li><li>Left-sided pressures exceed right-sided, so a hole between the sides shunts left → right unless the right side is obstructed.</li></ul>';
      }
      if (d === 'asd') {
        ring(g, [0, 0.9, -0.2], 0.3, 0xffd23f, [0, Math.PI / 2, 0]); arrow(g, [0.8, 0.95, -0.25], [-0.5, 0.95, -0.25]);
        L.push({ t: 'ASD', p: [0, 1.5, -0.2] });
        info = '<ul><li><b>Left-to-right shunt</b> at atrial level (ostium secundum most common; ostium primum is associated with Down syndrome).</li><li>Right atrial/ventricular volume overload and increased pulmonary flow.</li><li>Fixed split S2; systolic ejection murmur at the left upper sternal border (extra flow across the pulmonic valve).</li><li>Paradoxical embolism is possible. Eisenmenger if the shunt reverses.</li></ul>';
      }
      if (d === 'vsd') {
        ring(g, [0.15, -0.4, 0.15], 0.28, 0xffd23f, [0, Math.PI / 2, 0]); arrow(g, [0.7, -0.4, 0.1], [-0.2, -0.4, 0.2]);
        L.push({ t: 'VSD (membranous)', p: [0.2, -1.7, 0.4] });
        info = '<ul><li>Most common congenital heart defect; membranous septum is the usual site.</li><li><b>Left-to-right shunt</b>; holosystolic murmur at the left lower sternal border (smaller defects are louder).</li><li>Large defects: pulmonary overcirculation, heart failure, then pulmonary hypertension and <b>Eisenmenger</b> (shunt reverses, cyanosis, clubbing).</li></ul>';
      }
      if (d === 'pda') {
        tube(g, [[1.75, 1.9, -0.65], [1.4, 1.95, -0.3], [1, 1.93, 0.15]], 0.1, mat(0xffd23f, 1, { emissive: 0xffd23f, emissiveIntensity: 0.4 }), 12);
        arrow(g, [1.9, 1.6, -0.7], [1.3, 1.4, -0.1]);
        L.push({ t: 'Ductus (PDA)', p: [1.9, 1.5, -0.2] });
        info = '<ul><li>Persistent channel between the <b>descending aorta (just distal to the left subclavian)</b> and the left pulmonary artery.</li><li>Left-to-right shunt: continuous “machinery” murmur, bounding pulses, wide pulse pressure.</li><li>Associated with prematurity and maternal rubella. Closure: indomethacin/ibuprofen. If a ductus-dependent lesion exists, keep it open with prostaglandin E1.</li></ul>';
      }
      if (d === 'tof') {
        ring(g, [0.15, -0.4, 0.15], 0.28, 0xffd23f, [0, Math.PI / 2, 0]); ring(g, [-0.37, 0.2, 0.52], 0.2, 0xff7a3f, [Math.PI / 2, 0, 0]);
        arrow(g, [-0.2, -0.4, 0.2], [0.6, -0.2, 0.1]);
        L.push({ t: 'VSD', p: [0.2, -1.7, 0.4] }, { t: 'Pulmonary stenosis', p: [-1.4, 0.4, 0.7] }, { t: 'RV hypertrophy', p: [-1.5, -0.4, 0.8] }, { t: 'Overriding aorta', p: [0.9, 0.3, 0.2] });
        info = '<ul><li>Four features: <b>pulmonary (infundibular) stenosis, RVH, overriding aorta, VSD.</b></li><li>Right-to-left shunt across the VSD → cyanosis. “Tet spells” improve with squatting (raises SVR, pushes blood toward the lungs).</li><li>Boot-shaped heart on CXR. Associated with 22q11 deletion. Classically the most common cyanotic CHD beyond infancy.</li></ul>';
      }
      if (d === 'tga') {
        ring(g, [0, 0.9, -0.2], 0.3, 0xffd23f, [0, Math.PI / 2, 0]);
        L.push({ t: 'Mixing site needed (ASD/VSD/PDA)', p: [0, 1.5, -0.2] });
        info = '<ul><li><b>Aorta arises from the RV; pulmonary artery from the LV</b> → two parallel circuits.</li><li>Not compatible with life without mixing (PDA, ASD or VSD). Cyanosis in the first days of life.</li><li>“Egg on a string” CXR (narrow mediastinum). Associated with maternal diabetes.</li><li>Keep the ductus open with prostaglandin E1; definitive fix is the arterial switch.</li></ul>';
      }
      return { labels: L, info: info };
    },
  });
})();
