// Eye anatomy (cutaway). Ported from the anatomy3d.html prototype.
(function () {
  var h = Kit.helpers, V = h.V, mat = h.mat, add = h.add, tube = h.tube, dot = h.dot;

  // The eye group is rotated -90 degrees about Z so the front points right. Label anchors
  // are given in the eye's own coordinates (front = +y) and mapped to world with E().
  // Rotation by -90 deg about Z sends (x, y, z) to (y, -x, z).
  function E(x, y, z) { return [y, -x, z || 0]; }
  // Point on a sphere of radius r around the eye centre, at angle a (degrees) from the
  // front axis (world +x), measured counter-clockwise in the cut plane.
  function P(r, a) { var t = a * Math.PI / 180; return [r * Math.cos(t), r * Math.sin(t), 0]; }

  Kit.register({
    id: 'eye',
    center: [0.2, 0, 0],
    zoom: 8,
    rot: [0, 0.15],
    controls: [{ k: 'c', label: 'Condition', def: 'norm', opts: [
      ['norm', 'Normal anatomy'],
      ['ac', 'Acute angle-closure glaucoma'],
      ['rd', 'Retinal detachment'],
      ['cra', 'Central retinal artery occlusion'],
    ] }],
    build: function (g, st) {
      var clip = [new THREE.Plane(V(0, 0, -1), 0)];
      var cm = function (c, o, x) { return mat(c, o, Object.assign({ clippingPlanes: clip }, x)); };
      var eye = new THREE.Group(); eye.rotation.z = -Math.PI / 2; g.add(eye);
      var c = st.c, ac = c === 'ac';
      add(eye, new THREE.SphereGeometry(1.5, 48, 32, 0, Math.PI * 2, 0.55, Math.PI - 0.55), cm(0xf4f1ea, 0.9));
      add(eye, new THREE.SphereGeometry(0.85, 32, 16, 0, Math.PI * 2, 0, 1.04), cm(0xbfe6f5, 0.4), [0, 0.85, 0]);
      add(eye, new THREE.SphereGeometry(1.42, 40, 28, 0, Math.PI * 2, 0.6, Math.PI - 0.6), cm(0x6b2a1f, 0.85));
      var retCol = c === 'cra' ? 0xe8d8c8 : 0xf0903a;
      if (c === 'rd') {
        add(eye, new THREE.SphereGeometry(1.36, 40, 28, 0, Math.PI * 2, 0.6, 1.5), cm(retCol, 0.9));
        add(eye, new THREE.SphereGeometry(1.36, 40, 28, 0, Math.PI * 2, 2.55, Math.PI - 2.55), cm(retCol, 0.9));
        var flap = add(eye, new THREE.SphereGeometry(1.1, 40, 28, 0.9, 2.4, 2.1, 0.45), cm(retCol, 0.9)); flap.position.y = -0.1;
        var flap2 = add(eye, new THREE.SphereGeometry(1.1, 40, 28, 3.3 + 0.1, 2.4 - 0.2, 2.1, 0.45), cm(retCol, 0.9)); flap2.position.y = -0.1;
      } else add(eye, new THREE.SphereGeometry(1.36, 40, 28, 0, Math.PI * 2, 0.6, Math.PI - 0.6), cm(retCol, 0.85));
      // lens
      add(eye, new THREE.SphereGeometry(1, 32, 24), cm(0xd8f0ff, 0.75), [0, ac ? 0.8 : 0.75, 0], [0.55, 0.32, 0.55]);
      var iy = ac ? 1.12 : 0.93;
      var ir = add(eye, new THREE.RingGeometry(ac ? 0.3 : 0.22, 0.78, 40), cm(0x3a78b8, 0.95), [0, iy, 0]); ir.rotation.x = -Math.PI / 2;
      // Thinner rings than the prototype (ciliary 0.1 -> 0.05, trabecular 0.04 -> 0.025) so the angle stays readable.
      add(eye, new THREE.TorusGeometry(0.88, 0.05, 10, 32), cm(0xcba37a, 0.95), [0, 0.98, 0]).rotation.x = Math.PI / 2;
      var tm = add(eye, new THREE.TorusGeometry(0.77, 0.025, 8, 32), cm(ac ? 0xff3b3b : 0x2fd0c0, 1), [0, 1.14, 0]); tm.rotation.x = Math.PI / 2;
      tube(eye, [[0.35, -1.4, 0], [0.45, -2, 0], [0.6, -2.8, 0]], 0.2, mat(0xf1ede0, 0.95), 12);
      var fovea = c === 'cra' ? 0xc81e1e : 0x7a3a10;
      dot(eye, [0, -1.34, 0], c === 'cra' ? 0xe02020 : 0xf2d04a, 0.17); dot(eye, [0, -1.38, 0], fovea, 0.07);
      dot(eye, [0.35, -1.37, 0], 0xffffff, 0.12);
      // Labels are anchored in world coordinates on the structures they name.
      var L = [
        { t: 'Cornea', p: E(0, 1.7, 0) },
        { t: 'Iris / pupil', p: E(-0.55, iy, 0) },
        { t: 'Lens', p: E(0, ac ? 0.8 : 0.75, 0) },
        { t: 'Anterior chamber', p: E(0.2, 1.35, 0) },
        { t: 'Vitreous', p: [-0.3, 0, 0] },
        { t: 'Retina', p: P(1.36, 150) },
        { t: 'Choroid', p: P(1.42, 215) },
        { t: 'Sclera', p: P(1.5, 245) },
        { t: 'Macula / fovea', p: E(0, -1.34, 0) },
        { t: 'Optic disc / nerve', p: E(0.45, -2, 0) },
        { t: 'Trabecular meshwork / canal of Schlemm', p: E(0.77, 1.14, 0) },
        { t: 'Ciliary body', p: E(-0.88, 0.98, 0) },
      ];
      var infos = {
        norm: '<ul><li>Light path: cornea → aqueous (anterior chamber) → pupil → lens → vitreous → retina (macula/fovea for central vision).</li><li>Aqueous is made by the ciliary body, passes through the pupil, and drains through the <b>trabecular meshwork / canal of Schlemm</b> at the iridocorneal angle.</li><li>The cutaway is oriented with the front on the right; rotate to explore.</li></ul>',
        ac: '<ul><li><b>Acute angle-closure</b>: the peripheral iris bows forward against the trabecular meshwork (red), blocking aqueous drainage → rapid IOP rise.</li><li>Painful red eye, halos, headache, nausea/vomiting, <b>mid-dilated fixed pupil</b>, hazy cornea. An emergency.</li><li>Treat: lower IOP (acetazolamide, topical beta-blocker, alpha agonist, pilocarpine once IOP falls) then laser peripheral iridotomy. Avoid mydriatics.</li></ul>',
        rd: '<ul><li><b>Retinal detachment</b>: fluid passes through a tear and separates the neurosensory retina from the pigment epithelium/choroid (shown lifted).</li><li>Flashes, new floaters, then a “curtain” over part of the visual field; painless.</li><li>Emergency: laser/cryo for tears; pneumatic retinopexy, scleral buckle or vitrectomy for detachment.</li></ul>',
        cra: '<ul><li><b>Central retinal artery occlusion</b>: sudden, painless monocular vision loss.</li><li>The retina turns pale (ischemic) while the fovea stays red: <b>cherry-red spot</b>, because it is supplied by the choroid.</li><li>Embolic source (carotid, heart); consider giant cell arteritis. Ocular emergency.</li></ul>',
      };
      return { labels: L, info: infos[c] };
    },
  });
})();
