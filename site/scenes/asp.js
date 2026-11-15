// Aspiration sites by patient position.
// Base anatomy: the real tracheobronchial tree (trachea, main, intermediate, lobar and all segmental
// bronchi) and the five lung lobes from Z-Anatomy (baked mesh 'airways'). The dependent
// bronchopulmonary segments are drawn on the real lobes: each lobe surface point is assigned to its
// nearest segmental bronchus (a nearest-airway partition, the way segments are defined), and the
// territory of the target bronchus is lit. The whole model is turned to match the patient's position
// (upright, lying supine seen from the right, lying on the right side seen from the front), so the
// gravity arrow always points down the screen.
(function () {
  var h = Kit.helpers;
  var M = 'airways';
  var SCALE = 0.15; // cm -> scene units (lying positions use a little less: the model is wide)

  // Segmental bronchi supplying each lobe (part names in meshes/airways.js).
  var LOBES = {
    lobe_rul: ['seg_r_b1_apical', 'seg_r_b2_posterior', 'seg_r_b3_anterior'],
    lobe_rml: ['seg_r_b4_lateral', 'seg_r_b5_medial'],
    lobe_rll: ['seg_r_b6_superior', 'seg_r_b7_medial_basal', 'seg_r_b8_anterior_basal', 'seg_r_b9_lateral_basal', 'seg_r_b10_posterior_basal'],
    lobe_lul: ['seg_l_b1_2_apicoposterior', 'seg_l_b3_anterior', 'seg_l_b4_superior_lingular', 'seg_l_b5_inferior_lingular'],
    lobe_lll: ['seg_l_b6_superior', 'seg_l_b7_medial_basal', 'seg_l_b7_8_anteromedial_basal', 'seg_l_b8_anterior_basal', 'seg_l_b9_lateral_basal', 'seg_l_b10_posterior_basal'],
  };
  var LOBE_OF = {};
  Object.keys(LOBES).forEach(function (l) { LOBES[l].forEach(function (s) { LOBE_OF[s] = l; }); });
  var AIRWAY_PARTS = ['trachea', 'main_bronchus_r', 'main_bronchus_l', 'intermediate_bronchus_r',
    'lobar_r_upper', 'lobar_r_middle', 'lobar_r_lower', 'lobar_l_upper', 'lobar_l_lower'];

  // Route from the carina to each target segment (lit with the segment).
  var ROUTE = {
    seg_r_b2_posterior: ['main_bronchus_r', 'lobar_r_upper'],
    seg_r_b4_lateral: ['main_bronchus_r', 'intermediate_bronchus_r', 'lobar_r_middle'],
    seg_r_b6_superior: ['main_bronchus_r', 'intermediate_bronchus_r', 'lobar_r_lower'],
    seg_r_b9_lateral_basal: ['main_bronchus_r', 'intermediate_bronchus_r', 'lobar_r_lower'],
    seg_r_b10_posterior_basal: ['main_bronchus_r', 'intermediate_bronchus_r', 'lobar_r_lower'],
    seg_l_b10_posterior_basal: ['main_bronchus_l', 'lobar_l_lower'],
  };

  // Per position: body orientation (where the patient's left, superior and anterior axes point in
  // the scene), a small view turn and the lit segments (strength 1 = main site, <1 = lesser site).
  // labelDir overrides the on-screen direction used to place a lobe label.
  var POS = {
    up: {
      basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], yaw: 0.6, pitch: 0.12,
      sites: [['seg_r_b10_posterior_basal', 1], ['seg_l_b10_posterior_basal', 0.55]],
      labelDir: { lobe_rml: [-1, -0.15] },
    },
    sup: { // lying on the back, seen from the patient's right; head to the left of the screen
      basis: [[0, 0, -1], [-1, 0, 0], [0, 1, 0]], yaw: 0.35, pitch: 0.15,
      sites: [['seg_r_b2_posterior', 1], ['seg_r_b6_superior', 1]],
    },
    rl: { // lying on the right side, seen from the front; head to the left of the screen
      basis: [[0, 1, 0], [-1, 0, 0], [0, 0, 1]], yaw: 0.3, pitch: 0.2,
      sites: [['seg_r_b2_posterior', 1], ['seg_r_b4_lateral', 1], ['seg_r_b9_lateral_basal', 1]],
    },
  };

  /* ---------- segment territories on the real lobes (cached per page) ---------- */
  var terrCache = {};
  function attr(part) {
    // Kit.meshPart shares decoded geometry; read its position attribute through a throwaway mesh.
    var tmp = new THREE.Group(), me = Kit.meshPart(tmp, M, part, Kit.tissue('air'));
    me.material.dispose();
    return me.geometry;
  }
  function territory(lobe, seg) {
    var key = lobe + '|' + seg;
    if (terrCache[key]) return terrCache[key];
    var geo = attr(lobe), pos = geo.attributes.position.array, idx = geo.index.array;
    var segs = LOBES[lobe], pts = [];
    segs.forEach(function (s, k) {
      var a = attr(s).attributes.position.array;
      for (var i = 0; i < a.length; i += 6) pts.push(a[i], a[i + 1], a[i + 2], k); // every 2nd vertex
    });
    // Soft partition: weight 1 where the target bronchus is clearly the nearest airway, 0 where
    // another segmental bronchus is, with a ~2 cm blend across the boundary (per-vertex alpha).
    var target = segs.indexOf(seg), nv = pos.length / 3, w = new Float32Array(nv);
    for (var v = 0; v < nv; v++) {
      var x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], dt = 1e9, dn = 1e9;
      for (var p = 0; p < pts.length; p += 4) {
        var dx = pts[p] - x, dy = pts[p + 1] - y, dz = pts[p + 2] - z, d = dx * dx + dy * dy + dz * dz;
        if (pts[p + 3] === target) { if (d < dt) dt = d; } else if (d < dn) dn = d;
      }
      var u = Math.max(0, Math.min(1, (Math.sqrt(dn) - Math.sqrt(dt)) / 2 + 0.5));
      w[v] = u * u * (3 - 2 * u);
    }
    var out = [], col = new Float32Array(nv * 4);
    for (v = 0; v < nv; v++) { col[v * 4] = col[v * 4 + 1] = col[v * 4 + 2] = 1; col[v * 4 + 3] = w[v]; }
    for (var t = 0; t < idx.length; t += 3) {
      if (w[idx[t]] + w[idx[t + 1]] + w[idx[t + 2]] > 0.02) out.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', geo.attributes.position);
    g.setAttribute('normal', geo.attributes.normal);
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setIndex(out);
    g.computeBoundingBox(); g.computeBoundingSphere();
    g.userData = { kitShared: true };
    // Label anchor: centroid of the territory's core.
    var c = [0, 0, 0], cnt = 0;
    for (v = 0; v < nv; v++) if (w[v] > 0.5) { c[0] += pos[v * 3]; c[1] += pos[v * 3 + 1]; c[2] += pos[v * 3 + 2]; cnt++; }
    terrCache[key] = { geo: g, c: cnt ? [c[0] / cnt, c[1] / cnt, c[2] / cnt] : [0, 0, 0] };
    return terrCache[key];
  }

  var LOBE_TINT = { lobe_rul: 0xf0aaa8, lobe_lul: 0xf0aaa8, lobe_rml: 0xf6c6b4, lobe_rll: 0xe0939c, lobe_lll: 0xe0939c };
  var centCache = {};
  function centroid(part) {
    if (centCache[part]) return centCache[part];
    var a = attr(part).attributes.position.array, c = [0, 0, 0], n = a.length / 3;
    for (var i = 0; i < a.length; i += 3) { c[0] += a[i]; c[1] += a[i + 1]; c[2] += a[i + 2]; }
    centCache[part] = [c[0] / n, c[1] / n, c[2] / n];
    return centCache[part];
  }
  // A label point for a lobe: from the model centre out through the lobe's centroid (as seen on
  // screen), pick the lobe's farthest vertex and come back a quarter of the way to the centroid.
  // toG maps mesh cm into the scene; the model is centred on the scene origin.
  function lobeAnchor(k, toG, dir) {
    var a = attr(k).attributes.position.array, c = toG(centroid(k));
    if (!dir) dir = [c[0], c[1]];
    var n = Math.hypot(dir[0], dir[1]) || 1, dx = dir[0] / n, dy = dir[1] / n, best = -1e9, bp = c;
    for (var i = 0; i < a.length; i += 9) {
      var q = toG([a[i], a[i + 1], a[i + 2]]), s = q[0] * dx + q[1] * dy;
      if (s > best) { best = s; bp = q; }
    }
    return [c[0] + (bp[0] - c[0]) * 0.75, c[1] + (bp[1] - c[1]) * 0.75, c[2] + (bp[2] - c[2]) * 0.75];
  }
  function bboxCenter(bb) { return [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2]; }

  Kit.register({
    id: 'asp',
    meshes: ['airways'],
    center: [0, 0, 0],
    zoom: 8.6,
    rot: [0, 0],
    controls: [{ k: 'p', label: 'Patient position when aspirating', def: 'up', opts: [
      ['up', 'Upright / sitting'],
      ['sup', 'Supine'],
      ['rl', 'Right side down (lateral decubitus)'],
    ] }],
    build: function (g, st) {
      var P = POS[st.p] || POS.up;
      var info = Kit.meshInfo(M).bbox;

      // Body frame: rotate the patient into position, then a small view turn so depth reads.
      var body = new THREE.Group();
      var B = P.basis, rot = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(B[0][0], B[0][1], B[0][2]), new THREE.Vector3(B[1][0], B[1][1], B[1][2]), new THREE.Vector3(B[2][0], B[2][1], B[2][2]));
      var view = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(P.pitch, P.yaw, 0, 'XYZ'));
      body.quaternion.setFromRotationMatrix(view.multiply(rot));
      body.scale.setScalar(st.p === 'up' ? SCALE : SCALE * 0.8);
      // Centre the model on the lungs (mesh is centred on the trachea).
      var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      Object.keys(LOBES).concat(['trachea']).forEach(function (k) {
        var bb = info[k];
        for (var i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], bb[i]); hi[i] = Math.max(hi[i], bb[i + 3]); }
      });
      var mid = new THREE.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
      body.updateMatrix();
      var off = mid.clone().applyMatrix4(body.matrix);
      body.position.set(-off.x, -off.y, -off.z);
      body.updateMatrix();
      g.add(body);
      function toG(p) { var v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(body.matrix); return [v.x, v.y, v.z]; }

      // Which parts are lit.
      var lit = {}, litLobe = {};
      P.sites.forEach(function (s) {
        lit[s[0]] = Math.max(lit[s[0]] || 0, s[1]); litLobe[LOBE_OF[s[0]]] = true;
        (ROUTE[s[0]] || []).forEach(function (r) { lit[r] = Math.max(lit[r] || 0, s[1]); });
      });
      var AMBER = 0xffb02e;
      // Seen from the right (supine), the left lung sits behind the right one: fade it.
      var fadeLeft = st.p === 'sup';
      function isLeft(k) { return /(^seg_l_|_l$|_l_|lobe_l)/.test(k); }
      function airwayMat(k) {
        var s = lit[k];
        if (!s && fadeLeft && isLeft(k)) return Kit.tissue('cartilage', { color: 0xdfe6ea, opacity: 0.3 });
        if (!s) return Kit.tissue('cartilage', { color: 0xdfe6ea });
        return Kit.tissue('cartilage', { color: s >= 1 ? AMBER : 0xf3c978, emissive: AMBER, emissiveIntensity: s >= 1 ? 0.6 : 0.3 });
      }

      // Vertebral column for orientation (it marks posterior).
      var spine = Kit.meshPart(body, M, 'thoracic_spine', 'bone');
      // Airways: opaque, drawn first.
      AIRWAY_PARTS.forEach(function (k) { Kit.meshPart(body, M, k, airwayMat(k)); });
      Object.keys(LOBE_OF).forEach(function (k) { Kit.meshPart(body, M, k, airwayMat(k)); });

      // Lit segment territories: solid patches on the real lobe surface.
      var segAnchor = {}, segMesh = {};
      P.sites.forEach(function (s) {
        var t = territory(LOBE_OF[s[0]], s[0]);
        var m = Kit.tissue('lung', { color: s[1] >= 1 ? 0xff9a1a : 0xf2c56e, emissive: AMBER, emissiveIntensity: s[1] >= 1 ? 0.9 : 0.4,
          sheen: 0, vertexColors: true, opacity: s[1] >= 1 ? 0.9 : 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        var me = new THREE.Mesh(t.geo, m); me.renderOrder = 2; body.add(me);
        segAnchor[s[0]] = t.c; segMesh[s[0]] = me;
      });

      // Translucent lobes (pleural surface), drawn last, front faces only so the tree shows through.
      Object.keys(LOBES).forEach(function (k) {
        var me = Kit.meshPart(body, M, k, Kit.tissue('lung', { color: LOBE_TINT[k], emissive: LOBE_TINT[k], emissiveIntensity: 0.38, opacity: fadeLeft && isLeft(k) ? 0.12 : 0.32, depthWrite: false, side: THREE.FrontSide }));
        me.renderOrder = 3;
      });

      // Labels (positions in mesh cm, mapped into the scene).
      var C = {};
      Object.keys(info).forEach(function (k) { C[k] = bboxCenter(info[k]); });
      var L = [
        { t: 'Trachea', p: toG([C.trachea[0], info.trachea[4] - 2.5, C.trachea[2]]) },
        // upright: chip to the left of the right bronchus so it does not lie across the left one
        { t: 'Right main bronchus: wider, shorter, more vertical', p: toG(C.main_bronchus_r), side: st.p === 'up' ? 'left' : undefined },
      ];
      if (st.p !== 'sup') L.push({ t: 'Left main bronchus', p: toG(C.main_bronchus_l) });
      else L.push({ t: 'Spine (posterior)', p: toG([0, info.thoracic_spine[1] + 6, info.thoracic_spine[2] + 1]), on: spine });
      // Lobe labels near each lobe's outer edge.
      ['lobe_rul', 'lobe_rml', 'lobe_rll', 'lobe_lul', 'lobe_lll'].forEach(function (k) {
        // Seen from the right (supine) the left lobes are hidden; lit lobes are named by their segment label.
        if ((st.p === 'sup' && k.charAt(5) === 'l') || (st.p !== 'up' && litLobe[k])) return;
        L.push({ t: k.slice(5).toUpperCase(), p: lobeAnchor(k, toG, (P.labelDir || {})[k]) });
      });
      var NAMES = {
        seg_r_b10_posterior_basal: 'Posterior basal segment, RLL (most common)',
        seg_l_b10_posterior_basal: 'Posterior basal segment, LLL (less often)',
        seg_r_b2_posterior: 'RUL posterior segment',
        seg_r_b6_superior: 'RLL superior segment',
        seg_r_b4_lateral: 'RML lateral segment',
        seg_r_b9_lateral_basal: 'RLL lateral basal segment',
      };
      P.sites.forEach(function (s) { L.push({ t: NAMES[s[0]], p: toG(segAnchor[s[0]]), on: segMesh[s[0]] }); });

      // Model extent in the scene (for the bed and the gravity arrow).
      var low = 1e9, top = -1e9, xl = 1e9, xh = -1e9;
      Object.keys(LOBES).concat(['thoracic_spine', 'trachea']).forEach(function (k) {
        var a = attr(k).attributes.position.array;
        for (var i = 0; i < a.length; i += 6) {
          var q = toG([a[i], a[i + 1], a[i + 2]]);
          if (q[1] < low) low = q[1]; if (q[1] > top) top = q[1];
          if (q[0] < xl) xl = q[0]; if (q[0] > xh) xh = q[0];
        }
      });
      // Lying positions: a bed under the dependent side, so "down" reads at a glance.
      if (st.p !== 'up') {
        var bed = h.add(g, new THREE.BoxGeometry(xh - xl + 0.5, 0.08, 2.2), h.mat(0x46525f, 0.6, { roughness: 0.95 }), [(xl + xh) / 2, low - 0.06, 0]);
        bed.renderOrder = 1;
      }

      // Gravity: straight down the screen, above the model's right end (beside it would fall off a
      // phone screen; above an upright model it sits over the empty space lateral to the apex).
      var gx = st.p === 'up' ? xh - 0.35 : xh - 0.6, gy = st.p === 'up' ? top + 0.2 : top + 1.25;
      h.arrow(g, [gx, gy, 0], [gx, gy - 1.1, 0], 0xff7a3f);
      L.push({ t: 'Gravity', p: [gx + 0.1, gy - 0.1, 0] });

      var info2;
      if (st.p === 'sup') {
        info2 = '<ul><li><b>Supine</b>: the dependent (posterior) segments fill first: the <b>superior segment of the right lower lobe</b> and the <b>posterior segment of the right upper lobe</b>.</li><li>The model lies on its back, seen from the patient\'s right (head to the left): gravity points to the back, where the spine is.</li></ul>';
      } else if (st.p === 'rl') {
        info2 = '<ul><li><b>Right lateral decubitus</b>: the right lung is dependent, so aspirate favors its lateral and posterior regions (shown: RUL posterior, RML lateral and RLL lateral basal segments).</li><li>This position is commonly taught less consistently than upright vs. supine: confirm the exact segments against your question-bank resource.</li><li>The model lies on its right side, seen from the front (head to the left).</li></ul>';
      } else {
        info2 = '<ul><li><b>Upright</b>: aspirate follows gravity into the <b>basal segments of the lower lobes</b>, right more than left (posterior basal segments lit).</li><li>Why right: the right main bronchus is wider, shorter and runs more vertically, in line with the trachea.</li></ul>';
      }
      return { labels: L, info: info2 };
    },
  });
})();
