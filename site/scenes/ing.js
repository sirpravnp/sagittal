// Inguinal canal and hernias. Ported from the anatomy3d.html prototype.
(function () {
  var h = Kit.helpers, mat = h.mat, add = h.add, ell = h.ell, seg = h.seg, tube = h.tube, ring = h.ring, dot = h.dot;

  Kit.register({
    id: 'ing',
    center: [-0.5, -0.2, 0],
    zoom: 9,
    // Side-on preset: the abdominal wall layers are stacked along z, so turning the model
    // about 60 degrees lets you see them one behind the other.
    rot: [-0.15, 1.05],
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
      var lig = function (x) { return 1.5 - 1.174 * (x + 2); };
      var wallPos = [-0.5, -0.15];
      if (st.eo) add(g, new THREE.BoxGeometry(4.3, 4.3, 0.03), mat(0xd98b7a, 0.25), [wallPos[0], wallPos[1], 0.3]);
      add(g, new THREE.BoxGeometry(4.3, 4.3, 0.03), mat(0xc96a6a, 0.22), [wallPos[0], wallPos[1], 0.15]);
      add(g, new THREE.BoxGeometry(4.3, 4.3, 0.03), mat(0xb85a5a, 0.22), [wallPos[0], wallPos[1], 0]);
      add(g, new THREE.BoxGeometry(4.3, 4.3, 0.03), mat(0x889099, 0.12), [wallPos[0], wallPos[1], -0.25]);
      add(g, new THREE.BoxGeometry(0.8, 3.2, 0.12), mat(0x9b3b3b, 0.55), [0.7, 0.4, 0.1]);
      var lm = mat(0xf3e9b0);
      seg(g, [-2, 1.5, 0.28], [0.3, -1.2, 0.28], 0.06, lm);
      dot(g, [-2, 1.5, 0.28], 0xf3e9b0, 0.12); dot(g, [0.3, -1.2, 0.28], 0xf3e9b0, 0.12);
      tube(g, [[-0.8, lig(-0.8), -0.05], [-0.3, 0.4, -0.05], [0.3, 0.7, -0.05]], 0.05, mat(0xe23b3b), 16);
      var tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.8, lig(-0.8), -0.03, 0.3, 0.7, -0.03, 0.3, -1.2, -0.03], 3));
      tri.setIndex([0, 1, 2]); tri.computeVertexNormals();
      add(g, tri, mat(0xffd23f, 0.4, { emissive: 0xffd23f, emissiveIntensity: 0.25 }));
      ring(g, [-1.1, 0.55, 0], 0.2, 0xff9f3f); ring(g, [0.05, -0.88, 0.3], 0.15, 0xff9f3f);
      var cord = [[-1.1, 0.55, 0], [-0.6, 0, 0.14], [-0.2, -0.5, 0.26], [0.05, -0.88, 0.3], [0.1, -1.8, 0.3]];
      tube(g, cord, 0.08, mat(0xf0e0d0, 0.9), 30);
      tube(g, [[-1.15, 0.45, 0.05], [-1.2, -2.2, 0.05]], 0.07, mat(0xe23b3b), 20);
      tube(g, [[-0.85, 0.35, 0.05], [-0.9, -2.2, 0.05]], 0.08, mat(0x3a6fd8), 20);
      tube(g, [[-1.5, 0.5, 0.05], [-1.55, -2.2, 0.05]], 0.04, mat(0xf0d94a), 20);
      var L = [
        { t: 'Deep (internal) ring', p: [-1.6, 0.85, 0] }, { t: 'Superficial ring', p: [-0.9, -1.3, 0.3] },
        { t: 'Spermatic cord', p: [0.5, -1.5, 0.3] }, { t: 'Inguinal ligament', p: [-1.6, 1.3, 0.3] },
        { t: 'Inferior epigastric vessels', p: [0.45, 0.9, -0.05] }, { t: 'Hesselbach triangle', p: [0.4, -0.5, -0.03] },
        { t: 'Rectus', p: [1, 1.4, 0.1] }, { t: 'Femoral N / A / V', p: [-2.1, -1.7, 0.05] },
      ];
      var info = '';
      if (st.h === 'norm') info = '<ul><li><b>Inguinal canal</b>: runs from the deep ring (in transversalis fascia) to the superficial ring (in the external oblique aponeurosis), carrying the spermatic cord / round ligament.</li><li><b>Hesselbach triangle</b>: inferior epigastric vessels (lateral), lateral border of rectus (medial), inguinal ligament (inferior).</li><li>Femoral sheath: lateral → medial = Nerve, Artery, Vein, (empty space) Lymphatics.</li><li>The view opens side-on so the wall layers show one behind the other; hide the external oblique to expose deeper structures.</li></ul>';
      if (st.h === 'ind') {
        tube(g, cord, 0.17, mat(0xe8b94a, 0.55), 30); ell(g, 0xe8b94a, 0.6, [0.1, -1.9, 0.3], [0.3, 0.4, 0.3]);
        L.push({ t: 'Indirect sac', p: [0.6, -2, 0.3] });
        info = '<ul><li>Passes through the <b>deep ring, lateral to the inferior epigastric vessels</b>, and follows the spermatic cord in the canal; can reach the scrotum.</li><li>Cause: patent processus vaginalis (congenital). Most common hernia in both sexes.</li><li>Covered by all layers of the spermatic cord fascia. “MD’s don’t lie”: Medial = Direct, Lateral = indirect.</li></ul>';
      }
      if (st.h === 'dir') {
        ell(g, 0xe8b94a, 0.65, [-0.05, -0.15, 0.17], [0.38, 0.38, 0.35]); L.push({ t: 'Direct hernia', p: [0.55, -0.15, 0.35] });
        info = '<ul><li>Bulges through <b>Hesselbach triangle, medial to the inferior epigastric vessels</b>; an acquired weakness of the transversalis fascia.</li><li>Older men, heavy lifting, chronic cough/straining.</li><li>Does not follow the cord through the deep ring and rarely reaches the scrotum.</li></ul>';
      }
      if (st.h === 'fem') {
        ell(g, 0xe8b94a, 0.65, [-0.55, -0.55, 0.1], [0.3, 0.32, 0.3]); L.push({ t: 'Femoral hernia', p: [-0.2, -1, 0.15] });
        info = '<ul><li>Through the femoral canal, <b>below the inguinal ligament and medial to the femoral vein</b>.</li><li>More common in women; the narrow neck gives the <b>highest risk of strangulation</b>.</li><li>Needs urgent repair.</li></ul>';
      }
      return { labels: L, info: info };
    },
  });
})();
