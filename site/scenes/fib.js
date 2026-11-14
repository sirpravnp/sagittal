// Uterine fibroids by FIGO layer. Ported from the anatomy3d.html prototype.
(function () {
  var h = Kit.helpers, V = h.V, mat = h.mat, add = h.add, ell = h.ell, tube = h.tube;

  Kit.register({
    id: 'fib',
    center: [0, 0.3, 0],
    zoom: 8.5,
    rot: [-0.1, 0.1],
    controls: [
      { k: 'sh', label: 'Highlight group', def: 'all', opts: [
        ['all', 'All types'],
        ['sub', 'Submucosal (FIGO 0-2)'],
        ['int', 'Intramural (FIGO 3-4)'],
        ['ser', 'Subserosal (FIGO 5-7)'],
      ] },
      { k: 'sr', label: 'Serosa', def: true, type: 'chk' },
      { k: 'my', label: 'Myometrium', def: true, type: 'chk' },
      { k: 'en', label: 'Endometrium / cavity', def: true, type: 'chk' },
    ],
    build: function (g, st) {
      // Clipping plane removes the front half (z > 0) so the cavity is visible.
      var clip = [new THREE.Plane(V(0, 0, -1), 0)];
      var cm = function (c, o, x) { return mat(c, o, Object.assign({ clippingPlanes: clip }, x)); };
      if (st.sr) ell(g, 0xf0a0a8, 0.22, [0, 0.3, 0], [1.15, 1.4, 0.9]).material.clippingPlanes = clip;
      if (st.my) ell(g, 0xc05060, 0.4, [0, 0.3, 0], [1.07, 1.31, 0.84]).material.clippingPlanes = clip;
      if (st.en) add(g, new THREE.SphereGeometry(1, 32, 24), cm(0xf2dcb8, 0.65), [0, 0.35, 0], [0.6, 0.85, 0.3]);
      add(g, new THREE.CylinderGeometry(0.42, 0.38, 0.9, 24, 1, true), cm(0xd89aa0, 0.5), [0, -1.4, 0]);
      [[-1, 1], [1, 1]].forEach(function (s) {
        tube(g, [[s[0] * 0.9, 1.2, 0], [s[0] * 1.6, 1.7, 0], [s[0] * 2.2, 1.4, 0]], 0.07, mat(0xe8a0a8, 0.9), 16);
        ell(g, 0xc9b27a, 0.9, [s[0] * 2.35, 0.9, 0], [0.28, 0.2, 0.2]);
      });
      // FIGO 0 moved up and left of the prototype position so it no longer sits inside FIGO 1.
      var F = [
        { n: '0', g: 'sub', c: [-0.2, 0.75, -0.05], r: 0.26, stalk: [[0, 1.15, -0.05], [-0.18, 0.95, -0.05]] },
        { n: '1', g: 'sub', c: [0.45, 0.55, -0.05], r: 0.3 },
        { n: '2', g: 'sub', c: [-0.58, 0, -0.05], r: 0.3 },
        { n: '3', g: 'int', c: [0.77, -0.2, -0.05], r: 0.25 },
        { n: '4', g: 'int', c: [-0.8, 0.8, -0.05], r: 0.2 },
        { n: '5', g: 'ser', c: [1, 0.1, -0.05], r: 0.3 },
        { n: '6', g: 'ser', c: [-1.12, -0.35, -0.05], r: 0.3 },
        { n: '7', g: 'ser', c: [1, 2.15, -0.05], r: 0.25, stalk: [[0.5, 1.58, -0.05], [0.95, 1.95, -0.05]] },
      ];
      var L = [];
      F.forEach(function (f) {
        if (!(st.sh === 'all' || st.sh === f.g)) return;
        var col = f.g === 'sub' ? 0xf3f0c8 : f.g === 'int' ? 0xffffff : 0xf5d8e0;
        ell(g, col, 0.98, f.c, [f.r, f.r, f.r]).material.clippingPlanes = clip;
        if (f.stalk) { var m = mat(0xf5d8e0); m.clippingPlanes = clip; tube(g, f.stalk, 0.05, m, 8); }
        L.push({ t: 'FIGO ' + f.n, p: [f.c[0] + (f.c[0] < 0 ? -f.r - 0.1 : f.r + 0.1), f.c[1], f.c[2] + 0.3] });
      });
      L.push({ t: 'Cervix', p: [0.5, -1.4, 0] }, { t: 'Fallopian tube', p: [1.9, 1.9, 0] }, { t: 'Ovary', p: [2.7, 0.9, 0] });
      var defs = '<li>FIGO 0: pedunculated, intracavitary. FIGO 1: submucosal, &lt;50% intramural. FIGO 2: submucosal, ≥50% intramural.</li><li>FIGO 3: intramural, touches the endometrium. FIGO 4: intramural, no contact. FIGO 5: subserosal, ≥50% intramural. FIGO 6: subserosal, &lt;50% intramural. FIGO 7: pedunculated subserosal.</li>';
      var infos = {
        all: '<ul><li>FIGO classification by position relative to the endometrial cavity and serosa: <b>0-2 submucosal, 3-4 intramural, 5-7 subserosal</b> (8 = other, e.g. cervical).</li>' + defs + '<li>The cutaway shows the layers: serosa (outer), myometrium, endometrium (lining the cavity). Toggle layers to look inside.</li></ul>',
        sub: '<ul><li><b>Submucosal</b> fibroids distort the cavity: heavy menstrual bleeding, anemia, infertility, recurrent pregnancy loss.</li><li>Hysteroscopic resection is an option for types 0-2 (as selected).</li>' + defs + '</ul>',
        int: '<ul><li><b>Intramural</b> fibroids enlarge the uterus: bulk symptoms, heavy or prolonged bleeding, pain.</li><li>Type 3 touches the endometrium and can behave like a submucosal lesion.</li>' + defs + '</ul>',
        ser: '<ul><li><b>Subserosal</b> fibroids bulge outward: pelvic pressure, urinary frequency (bladder), constipation; less often abnormal bleeding.</li><li>A pedunculated one (FIGO 7) can <b>torse</b>, causing acute pain. Red degeneration is more common in pregnancy.</li>' + defs + '</ul>',
      };
      return { labels: L, info: infos[st.sh] };
    },
  });
})();
