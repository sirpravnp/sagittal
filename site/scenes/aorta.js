// Aortic dissection. Ported from the anatomy3d.html prototype.
(function () {
  var h = Kit.helpers, V = h.V, mat = h.mat, add = h.add, ell = h.ell, seg = h.seg, arrow = h.arrow, sector = h.sector, disk = h.disk, dot = h.dot;
  var D = Math.PI / 180;

  Kit.register({
    id: 'aorta',
    center: [1, 0, 0],
    zoom: 8.5,
    rot: [-0.1, 0.2],
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
      var L = [], info = '';
      if (st.v === 'ext') {
        var pts = [[0, -2, 0], [0, -0.5, 0], [0.1, 0.7, 0], [0.7, 1.6, 0], [1.5, 1.7, 0], [2.1, 1, 0], [2.2, -0.3, 0], [2.2, -2.3, 0]].map(function (p) { return V(p[0], p[1], p[2]); });
        var cur = new THREE.CatmullRomCurve3(pts);
        add(g, new THREE.TubeGeometry(cur, 80, 0.3, 16, false), mat(0xd8605a, 0.45));
        ell(g, 0xd8605a, 0.5, [0, -2, 0], [0.5, 0.35, 0.5]);
        [[0.7, 1.65, 0.75, 2.4], [1.1, 1.72, 1.15, 2.5], [1.45, 1.74, 1.55, 2.45]].forEach(function (b) {
          seg(g, [b[0], b[1], 0], [b[2], b[3], 0], 0.1, mat(0xd8605a, 0.6));
        });
        var A = st.t === 'A';
        var t0 = A ? 0.2 : 0.62, t1 = A ? 0.85 : 0.93;
        var sub = [];
        for (var i = 0; i <= 40; i++) sub.push(cur.getPoint(t0 + (t1 - t0) * i / 40).add(V(0, 0, 0.17)));
        add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sub), 80, 0.15, 12, false), mat(0x6b0f0f, 0.95));
        var tp = cur.getPoint(t0).add(V(0, 0, 0.3));
        dot(g, [tp.x, tp.y, tp.z], 0xffd23f, 0.12);
        // Labels sit on the structures they name: both lumens are read off the dissected
        // stretch of the curve (false lumen in front, true lumen behind), the root and
        // descending labels off the ends of the curve.
        var fl = cur.getPoint(A ? 0.5 : 0.78);
        var root = cur.getPoint(0), desc = cur.getPoint(0.98);
        L.push(
          { t: 'Entry tear (intimal)', p: [tp.x - 0.1, tp.y, tp.z + 0.1] },
          { t: 'False lumen', p: [fl.x + 0.2, fl.y, fl.z + 0.25] },
          { t: 'True lumen', p: [fl.x + 0.2, fl.y - 0.35, fl.z - 0.25] },
          { t: 'Aortic root / valve', p: [root.x + 0.5, root.y, root.z] },
          { t: 'Arch branches', p: [1.1, 2.7, 0] },
          { t: 'Descending aorta', p: [desc.x + 0.3, desc.y, desc.z] }
        );
        info = A
          ? '<ul><li><b>Stanford A</b>: involves the ascending aorta (± arch/descending). Surgical emergency.</li><li>Complications: aortic regurgitation, tamponade, coronary (usually RCA) occlusion, stroke.</li></ul>'
          : '<ul><li><b>Stanford B</b>: distal to the left subclavian artery. Usually medical: IV beta-blocker first (impulse control), then vasodilator.</li><li>Complications: renal or mesenteric malperfusion, limb ischemia, rupture.</li></ul>';
        info += '<ul><li>Tearing chest/back pain, BP difference between arms, widened mediastinum on CXR.</li><li>Risk: hypertension, Marfan/Ehlers-Danlos, bicuspid valve, cocaine, trauma.</li></ul>';
      } else {
        var dep = 1.6, dis = st.x === 'dis';
        var mi = mat(0xf0c9b6, 0.95), mm = mat(0xb04a4a, 0.8), ma = mat(0xc9a27a, 0.85);
        var tearA = 0.70, tearB = 0.80, flEnd = 3.0, TAU = Math.PI * 2;
        if (!dis) {
          add(g, sector(0.95, 1, 0, TAU, dep), mi); add(g, sector(1, 1.35, 0, TAU, dep), mm); add(g, sector(1.35, 1.55, 0, TAU, dep), ma);
          add(g, disk(0.93, dep), mat(0xd8403a, 0.35));
          info = '<ul><li>Three layers: <b>intima</b> (endothelium), <b>media</b> (elastic lamellae and smooth muscle, most of the strength), <b>adventitia</b>.</li><li>Cystic medial degeneration weakens the media (Marfan, aging, hypertension).</li></ul>';
        } else {
          add(g, sector(0.95, 1, flEnd, TAU + tearA, dep), mi);
          add(g, sector(1, 1.1, flEnd, TAU + tearA, dep), mm);
          var flap = new THREE.Group(); add(flap, sector(0.95, 1.1, tearB, flEnd, dep), mat(0xe9a98f, 0.95)); flap.scale.set(0.84, 0.84, 1); g.add(flap);
          add(g, sector(1.1, 1.25, tearA, flEnd, dep), mat(0x6b0f0f, 0.8));
          add(g, sector(1.1, 1.25, flEnd, TAU + tearA, dep), mm);
          add(g, sector(1.25, 1.35, 0, TAU, dep), mm);
          add(g, sector(1.35, 1.55, 0, TAU, dep), ma);
          add(g, disk(0.78, dep), mat(0xd8403a, 0.35));
          arrow(g, [0.37, 0.34, 0], [0.86, 0.8, 0]);
          info = '<ul><li>An <b>intimal tear</b> lets blood enter the media and split the layers, creating a <b>false lumen</b>.</li><li>The <b>intimal flap</b> separates true and false lumens and can occlude branch vessels (malperfusion).</li><li>Shown here as a cutaway: the wall layers from the inside out.</li></ul>';
        }
        var lp = function (r, a) { return [r * Math.cos(a * D), r * Math.sin(a * D), dep / 2]; };
        L.push({ t: 'Intima', p: lp(0.97, 200) }, { t: 'Media', p: lp(1.2, 250) }, { t: 'Adventitia', p: lp(1.46, 300) }, { t: 'True lumen', p: [0, 0, dep / 2] });
        if (dis) L.push({ t: 'Intimal tear', p: lp(1.0, 43) }, { t: 'False lumen', p: lp(1.18, 110) }, { t: 'Intimal flap', p: lp(0.8, 150) });
      }
      return { labels: L, info: info };
    },
  });
})();
