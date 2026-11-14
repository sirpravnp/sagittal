// Tension pneumothorax (coronal). Ported from the anatomy3d.html prototype.
(function () {
  var h = Kit.helpers, mat = h.mat, add = h.add, ell = h.ell, tube = h.tube, arrow = h.arrow;

  Kit.register({
    id: 'tension',
    center: [0, 0, 0],
    zoom: 9,
    rot: [0, 0],
    controls: [{ k: 's', label: 'State', def: 'tension', opts: [
      ['normal', 'Normal chest'],
      ['tension', 'Tension pneumothorax (patient’s right)'],
    ] }],
    build: function (g, st) {
      var T = st.s === 'tension';
      var wall = new THREE.Shape(); wall.moveTo(-2.4, -2.4); wall.bezierCurveTo(-3.1, -1, -3, 1.8, -1.5, 2.7); wall.lineTo(1.5, 2.7); wall.bezierCurveTo(3, 1.8, 3.1, -1, 2.4, -2.4); wall.lineTo(-2.4, -2.4);
      var wg = new THREE.ExtrudeGeometry(wall, { depth: 1.2, bevelEnabled: false }); wg.translate(0, 0, -0.6);
      add(g, wg, mat(0x8899aa, 0.1));
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(wg, 30), new THREE.LineBasicMaterial({ color: 0x6f8196 })));
      for (var k = 0; k < 6; k++) {
        var yk = 2.1 - k * 0.7;
        [-1, 1].forEach(function (s) {
          var w = Math.sqrt(Math.max(0.2, 1 - Math.pow((yk - 0.2) / 3, 2)));
          tube(g, [[s * 0.2, yk + 0.1, 0], [s * 1, yk + 0.3, 0], [s * 1.9 * w, yk + 0.1, 0], [s * 2.45 * w, yk - 0.45, 0]], 0.04, mat(0xe9dcc3, 0.9), 16);
        });
      }
      var heartX = T ? 1.25 : 0.35, tx = T ? 0.55 : 0;
      ell(g, 0xc24a4a, 0.9, [heartX, -0.6, 0], [0.85, 0.95, 0.5]);
      // Trachea: one continuous tube ending at the carina, where the two main bronchi
      // fork. The carina is closed with a sphere so the fork has no visible seam.
      var tm = mat(0xcfd8e3), carina = [tx * 0.9, 1.2, 0], tr = 0.12;
      tube(g, [[tx * 0.2, 2.75, 0], [tx, 1.6, 0], carina], tr, tm, 20);
      ell(g, 0xcfd8e3, 1, carina, [tr, tr, tr]);
      tube(g, [carina, [carina[0] - 0.35, 0.95, 0], [carina[0] - 0.7, 0.7, 0]], 0.09, tm, 8);
      tube(g, [carina, [carina[0] + 0.35, 0.95, 0], [carina[0] + 0.7, 0.7, 0]], 0.09, tm, 8);
      if (!T) {
        ell(g, 0xe99aa6, 0.5, [-1.45, 0.45, 0], [1, 1.7, 0.55]); ell(g, 0xe99aa6, 0.5, [1.45, 0.45, 0], [0.95, 1.65, 0.55]);
        ell(g, 0xb89a74, 0.8, [-1.45, -1.6, 0], [1.25, 0.5, 0.6]); ell(g, 0xb89a74, 0.8, [1.45, -1.75, 0], [1.2, 0.5, 0.6]);
      } else {
        ell(g, 0x9fd8f2, 0.22, [-1.5, 0.25, 0], [1.15, 1.95, 0.6], { emissive: 0x226688, emissiveIntensity: 0.3 });
        ell(g, 0xb08a92, 0.8, [-0.9, 0.9, 0], [0.4, 0.6, 0.4]);
        ell(g, 0xe99aa6, 0.55, [2.0, 0.4, 0], [0.55, 1.4, 0.5]);
        ell(g, 0xb89a74, 0.8, [-1.5, -2.15, 0], [1.25, 0.22, 0.6]); ell(g, 0xb89a74, 0.8, [1.45, -1.75, 0], [1.2, 0.5, 0.6]);
        arrow(g, [-0.3, 0.2, 0.7], [0.9, 0.2, 0.7]);
      }
      var L = [{ t: 'Trachea', p: [tx + 0.2, 2.2, 0] }, { t: 'Heart', p: [heartX + 0.2, -1.2, 0.5] }, { t: 'Left lung', p: [2.1, 1.7, 0] }, { t: 'Right hemidiaphragm', p: [-2.9, -1.9, 0] }];
      L.push(T ? { t: 'Collapsed right lung', p: [-0.9, 1.6, 0.4] } : { t: 'Right lung', p: [-2.3, 1.7, 0] });
      if (T) L.push({ t: 'Trapped pleural air', p: [-2.9, 0.6, 0.4] }, { t: 'Mediastinal shift →', p: [0.3, -0.1, 0.8] }, { t: 'Trachea deviated away', p: [0.9, 2.6, 0] }, { t: 'Compressed left lung', p: [2.4, -0.5, 0] });
      var info = T
        ? '<ul><li>Air enters the pleural space through a <b>one-way valve</b>; intrapleural pressure rises.</li><li>Ipsilateral lung collapses; the <b>mediastinum and trachea shift away</b>; the hemidiaphragm flattens; the contralateral lung is compressed.</li><li>Kinking of the great veins reduces venous return → <b>obstructive shock</b> (hypotension, JVD, tachycardia).</li><li>Exam: absent breath sounds and hyperresonance on the affected side. <b>Clinical diagnosis: do not wait for imaging.</b></li><li>Immediate needle decompression (classically 2nd intercostal space, midclavicular line; ATLS 10th ed. uses the 5th space, anterior axillary line), then chest tube.</li></ul>'
        : '<ul><li>Normal coronal view: trachea midline, mediastinum central, both lungs inflated, right hemidiaphragm slightly higher than left.</li><li>Switch to the tension state to compare.</li></ul>';
      return { labels: L, info: info };
    },
  });
})();
