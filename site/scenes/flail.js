// Flail chest. Ported from the anatomy3d.html prototype.
(function () {
  var h = Kit.helpers, V = h.V, mat = h.mat, add = h.add, ell = h.ell, tube = h.tube;
  var D = Math.PI / 180;

  function ribPt(i, th) {
    var k = Math.sin(Math.PI * (i + 1) / 9);
    var a = 1.25 + 0.3 * k, b = 0.8 + 0.25 * k, y = 1.5 - i * 0.42;
    var f = Math.max(0, Math.sin(th * D));
    return [a * Math.cos(th * D), y - 0.3 * f, b * Math.sin(th * D)];
  }
  function ribArc(i, t0, t1) {
    var n = Math.max(4, Math.ceil((t1 - t0) / 10)), p = [];
    for (var j = 0; j <= n; j++) p.push(ribPt(i, t0 + (t1 - t0) * j / n));
    return p;
  }

  Kit.register({
    id: 'flail',
    center: [0, 0, 0],
    zoom: 8,
    rot: [-0.15, -0.5],
    controls: [
      { k: 'ph', label: 'Breathing phase', def: 'anim', opts: [['anim', 'Animate'], ['insp', 'Inspiration'], ['exp', 'Expiration']] },
      { k: 'c', label: 'Show pulmonary contusion', def: true, type: 'chk' },
    ],
    build: function (g, st) {
      var thorax = new THREE.Group(), flail = new THREE.Group(); g.add(thorax, flail);
      var bone = mat(0xe9dcc3, 1);
      for (var i = 0; i < 8; i++) {
        if (!(i >= 2 && i <= 5)) { tube(thorax, ribArc(i, 104, 436), 0.05, bone, 40); }
        else {
          tube(thorax, ribArc(i, 104, 338), 0.05, bone, 32); tube(thorax, ribArc(i, 422, 436), 0.05, bone, 4);
          tube(flail, ribArc(i, 345, 415), 0.05, bone, 10);
          ell(thorax, 0xe23b3b, 1, ribPt(i, 340), [0.07, 0.07, 0.07]); ell(thorax, 0xe23b3b, 1, ribPt(i, 420), [0.07, 0.07, 0.07]);
        }
      }
      // Sternum: narrower than the prototype's and tinted like the ribs (bone).
      add(thorax, new THREE.BoxGeometry(0.3, 2.7, 0.1), bone, [0, 0.05, 0.88]);
      tube(thorax, [[0, 1.8, -0.95], [0, 0, -1], [0, -1.8, -0.9]], 0.11, mat(0xbfb59d));
      ell(thorax, 0xe99aa6, 0.4, [-0.65, 0, 0], [0.55, 1.2, 0.7]); ell(thorax, 0xe99aa6, 0.4, [0.65, 0, 0], [0.55, 1.2, 0.7]);
      if (st.c) ell(thorax, 0xb22222, 0.75, [0.8, 0.15, 0.35], [0.3, 0.45, 0.3]);
      var fp = ribPt(3, 380), fx = ribPt(2, 340);
      // The breathing phase also sets the label: the segment moves paradoxically.
      var flailText = st.ph === 'insp' ? 'Flail segment: sucked inward (paradoxical)'
        : st.ph === 'exp' ? 'Flail segment: pushed outward (paradoxical)'
        : 'Flail segment (paradoxical motion)';
      var L = [
        { t: flailText, p: [fp[0] + 0.2, fp[1] + 0.5, fp[2] + 0.2] },
        { t: 'Fracture sites', p: [fx[0] + 0.25, fx[1], fx[2]] },
        { t: 'Sternum', p: [-0.3, 1.5, 0.95] },
      ];
      if (st.c) L.push({ t: 'Pulmonary contusion', p: [0.9, -0.5, 0.45] });
      var dir = V(Math.cos(20 * D), 0, Math.sin(20 * D));
      var update = function (t) {
        var s = st.ph === 'insp' ? 1 : st.ph === 'exp' ? -1 : Math.sin(t * 1.6);
        thorax.scale.set(1 + 0.05 * s, 1, 1 + 0.05 * s);
        flail.position.copy(dir).multiplyScalar(-0.14 * s);
      };
      var info = '<ul><li><b>Flail chest</b>: ≥3 adjacent ribs each fractured in ≥2 places, producing a free-floating segment.</li><li><b>Paradoxical motion</b>: the segment moves inward on inspiration and outward on expiration (watch the loose ribs against the rest of the thorax).</li><li>Hypoxia is driven mainly by the underlying <b>pulmonary contusion</b> and pain-limited breathing, not the paradoxical motion itself.</li><li>Management: oxygen, analgesia (including regional blocks), judicious fluids; ventilatory support if failing; rib fixation in selected patients.</li></ul>';
      return { labels: L, info: info, update: update };
    },
  });
})();
