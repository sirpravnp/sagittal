// Aspiration sites by position. Ported from the anatomy3d.html prototype.
(function () {
  var h = Kit.helpers, mat = h.mat, ell = h.ell, tube = h.tube, seg = h.seg, arrow = h.arrow, dot = h.dot;

  Kit.register({
    id: 'asp',
    center: [0, 0.5, 0],
    zoom: 9.5,
    rot: [-0.1, 0.35],
    controls: [{ k: 'p', label: 'Patient position when aspirating', def: 'up', opts: [
      ['up', 'Upright / sitting'],
      ['sup', 'Supine'],
      ['rl', 'Right side down (lateral decubitus)'],
    ] }],
    build: function (g, st) {
      var cart = mat(0xcfd8e3, 0.95);
      tube(g, [[0, 2.6, 0], [0, 1.8, 0], [0, 1, 0]], 0.15, cart, 10);
      seg(g, [0, 1, 0], [-0.3, 0.4, 0], 0.16, cart); seg(g, [0, 1, 0], [0.8, 0.5, 0], 0.12, cart);
      seg(g, [-0.12, 0.7, 0], [-1, 1.3, -0.2], 0.07, cart); seg(g, [-0.3, 0.4, 0], [-1.2, 0.15, 0.4], 0.07, cart); seg(g, [-0.3, 0.4, 0], [-0.9, -0.9, -0.3], 0.09, cart);
      seg(g, [0.8, 0.5, 0], [1.3, 1.2, 0], 0.08, cart); seg(g, [0.8, 0.5, 0], [1.2, -0.9, -0.3], 0.09, cart);
      ell(g, 0xe0a060, 0.28, [-1.35, 1.3, 0], [0.8, 0.95, 0.7]); ell(g, 0x7ac47a, 0.28, [-1.4, 0.15, 0.45], [0.75, 0.5, 0.5]); ell(g, 0x6aa0e0, 0.28, [-1.2, -0.85, -0.35], [0.9, 1.1, 0.8]);
      ell(g, 0xe0a060, 0.28, [1.4, 1, 0.05], [0.8, 1.2, 0.7]); ell(g, 0x6aa0e0, 0.28, [1.25, -0.85, -0.35], [0.85, 1.1, 0.8]);
      var S = { rulp: [-1.3, 1.55, -0.5], rlls: [-1.1, -0.15, -0.7], rllb: [-1, -1.45, -0.6], lllb: [1.1, -1.45, -0.6], rml: [-2, 0.2, 0.3], rllat: [-1.85, -1.1, -0.2] };
      var L = [{ t: 'Right main bronchus: wider, shorter, more vertical', p: [-1.9, 0.8, 0.9] }, { t: 'Left main bronchus', p: [1.5, 0.35, 0.3] }, { t: 'RUL', p: [-2.2, 1.9, 0] }, { t: 'RML', p: [-2.3, 0.5, 0.5] }, { t: 'RLL', p: [-2.1, -1.6, 0] }, { t: 'LUL', p: [2.3, 1.9, 0] }, { t: 'LLL', p: [2.2, -1.5, 0] }];
      var sites = [], info = '', grav;
      if (st.p === 'up') {
        sites = ['rllb', 'lllb']; grav = [[3.3, 1.5, 0], [3.3, 0.4, 0]];
        L.push({ t: 'Posterior basal segments (R > L)', p: [S.rllb[0] - 0.3, S.rllb[1] - 0.4, S.rllb[2]] });
        info = '<ul><li><b>Upright</b>: aspirate follows gravity into the <b>basal segments of the lower lobes</b>, right more than left.</li><li>Why right: the right main bronchus is wider, shorter and runs more vertically.</li></ul>';
      }
      if (st.p === 'sup') {
        sites = ['rulp', 'rlls']; grav = [[3.3, 1, 0.9], [3.3, 1, -0.3]];
        L.push({ t: 'RUL posterior segment', p: [S.rulp[0] - 0.2, S.rulp[1] + 0.35, S.rulp[2]] }, { t: 'RLL superior segment', p: [S.rlls[0] + 1.2, S.rlls[1] - 0.2, S.rlls[2]] });
        info = '<ul><li><b>Supine</b>: the dependent (posterior) segments fill first: the <b>superior segment of the right lower lobe</b> and the <b>posterior segment of the right upper lobe</b>.</li><li>Rotate the model to look from the side and see how these segments lie posteriorly.</li></ul>';
      }
      if (st.p === 'rl') {
        sites = ['rulp', 'rml', 'rllat']; grav = [[0.3, 3.2, 0], [-1.7, 3.2, 0]];
        L.push({ t: 'RUL posterior segment', p: [S.rulp[0] - 0.2, S.rulp[1] + 0.35, S.rulp[2]] }, { t: 'RML lateral', p: [S.rml[0] - 0.3, S.rml[1] + 0.3, S.rml[2]] }, { t: 'RLL lateral basal', p: [S.rllat[0] - 0.3, S.rllat[1] - 0.3, S.rllat[2]] });
        info = '<ul><li><b>Right lateral decubitus</b>: the right lung is dependent, so aspirate favors its lateral and posterior regions.</li><li>This position is commonly taught less consistently than upright vs. supine: confirm the exact segments against your question-bank resource.</li></ul>';
      }
      sites.forEach(function (k) { dot(g, S[k], 0xffd23f, 0.17); });
      arrow(g, grav[0], grav[1], 0xff7a3f); L.push({ t: 'Gravity', p: [grav[0][0] + 0.2, grav[0][1] + 0.1, grav[0][2]] });
      return { labels: L, info: info };
    },
  });
})();
