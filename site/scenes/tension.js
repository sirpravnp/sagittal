// Tension pneumothorax (coronal, front-on like a chest X-ray), built on the baked Z-Anatomy
// thorax (ribs, sternum, spine) and chest (lungs, airway, heart, great vessels,
// diaphragm) meshes. The tension state deforms copies of the real meshes: the right lung
// collapses towards its hilum, air fills the right pleural cavity, the mediastinum and lower
// trachea shift to the patient's left, the right hemidiaphragm flattens and the left lung is
// squeezed laterally.
(function () {
  var S = 0.14;            // cm -> scene units
  var SHIFT = 3.6;         // mediastinal shift (cm, towards the patient's left)
  var HILUM_R = [-5, 7.5, -2]; // right hilum (cm, mesh frame)
  var CUT = 2.5;           // coronal cut (cm): anterior chest wall removed in front of it
  var cache = {};          // derived geometries, built once per page (shared like Kit's own)

  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function smooth(e0, e1, x) { var t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); }
  function srcGeo(mesh, part) {
    // Kit.meshPart decodes and caches the shared geometry; borrow it without keeping the mesh.
    var me = Kit.meshPart(new THREE.Group(), mesh, part, new THREE.MeshBasicMaterial());
    me.material.dispose();
    return me.geometry;
  }
  function shared(geo) { geo.userData = { kitShared: true }; geo.computeBoundingSphere(); return geo; }
  // Copy of a part with every vertex moved by fn(x, y, z) -> [x, y, z].
  function deformed(key, mesh, part, fn) {
    if (cache[key]) return cache[key];
    var src = srcGeo(mesh, part), geo = new THREE.BufferGeometry();
    var p = src.attributes.position.array, q = new Float32Array(p.length);
    for (var i = 0; i < p.length; i += 3) {
      var r = fn(p[i], p[i + 1], p[i + 2]);
      q[i] = r[0]; q[i + 1] = r[1]; q[i + 2] = r[2];
    }
    geo.setAttribute('position', new THREE.BufferAttribute(q, 3));
    geo.setIndex(src.index);
    geo.computeVertexNormals();
    return (cache[key] = shared(geo));
  }
  // Copy keeping only the triangles whose centroid passes keep(x, y, z), then moved by fn.
  function subset(key, mesh, part, keep, fn) {
    if (cache[key]) return cache[key];
    var src = srcGeo(mesh, part), p = src.attributes.position.array, ix = src.index.array, out = [];
    for (var t = 0; t < ix.length; t += 3) {
      var a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      if (keep((p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3)) out.push(ix[t], ix[t + 1], ix[t + 2]);
    }
    var q = new Float32Array(p.length);
    for (var i = 0; i < p.length; i += 3) { var r = fn(p[i], p[i + 1], p[i + 2]); q[i] = r[0]; q[i + 1] = r[1]; q[i + 2] = r[2]; }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(q, 3));
    geo.setIndex(out);
    geo.computeVertexNormals();
    return (cache[key] = shared(geo));
  }
  function part(g, geo, m) { var me = new THREE.Mesh(geo, m); g.add(me); return me; }

  // Mediastinal shift: none at the thoracic inlet (the trachea is fixed at the larynx),
  // full from the carina down (heart, great vessels, lower trachea).
  function shiftAt(y) { return SHIFT * smooth(21, 9.5, y); }
  function mediastinum(x, y, z) { return [x + shiftAt(y), y, z]; }
  // Right hemithorax over-expanded by the trapped air: wider, with a flattened, depressed dome.
  function rightSide(x) { return smooth(-0.5, -4, x); }
  var FLAT = -5.5;
  function hemidiaphragm(x, y, z) {
    var w = rightSide(x);
    if (y > FLAT) y = FLAT + (y - FLAT) * (1 - 0.82 * w);
    return [x * (1 + 0.05 * w), y, z];
  }
  function pleuralAir(x, y, z) {
    // The right pleural cavity: the shape of the fully expanded lung, pushed out to the wider
    // chest wall and down onto the flattened hemidiaphragm.
    var nx = x * (1 + 0.05 * rightSide(x)), ny = Math.max(y - 4.6 * (1 - smooth(1, 10, y)), -10.5);
    // medial pleura follows the shifted mediastinum; the lateral wall stays with the ribs
    nx += shiftAt(y) * smooth(-7, -1, x) * 0.9;
    return [nx, ny, z * 1.03];
  }
  function collapsedLung(x, y, z) {
    var h = HILUM_R, k = [0.3, 0.42, 0.5];
    return [h[0] + (x - h[0]) * k[0] + SHIFT * 0.55, h[1] + (y - h[1]) * k[1], h[2] + (z - h[2]) * k[2]];
  }
  function compressedLeft(x, y, z) { return [13.2 - (13.2 - x) * (0.78 - 0.14 * smooth(-2, 6, z)), y, z]; }

  function P(x, y, z) { return [x * S, y * S, z * S]; }

  Kit.register({
    id: 'tension',
    meshes: ['thorax', 'chest'],
    center: [0, 0.75, 0],
    zoom: 9.6,
    rot: [0, 0],
    controls: [{ k: 's', label: 'State', def: 'tension', opts: [
      ['normal', 'Normal chest'],
      ['tension', 'Tension pneumothorax (patient’s right)'],
    ] }],
    build: function (g, st) {
      var T = st.s === 'tension';
      var body = new THREE.Group(); body.scale.setScalar(S); g.add(body);

      // Chest wall and spine (real ribs). The anterior chest wall (front of the ribs, costal
      // cartilages, sternum) is cut away at a coronal plane so the view reads like a coronal
      // section / chest film: posterior and lateral ribs frame the lungs and mediastinum.
      var front = function (x, y, z) { return z < CUT; };
      var same = function (x, y, z) { return [x, y, z]; };
      var wide = function (x, y, z) { return [x * 1.05, y, z]; }; // hyperexpanded right hemithorax
      Kit.meshPart(body, 'thorax', 'thoracic_spine', 'bone');
      Kit.meshPart(body, 'thorax', 'thoracic_discs', Kit.tissue('cartilage', { color: 0x8fa3a8 }));
      part(body, subset('rl', 'thorax', 'ribs_left', front, same), Kit.tissue('bone'));
      part(body, subset(T ? 'rrw' : 'rr', 'thorax', 'ribs_right', front, T ? wide : same), Kit.tissue('bone'));

      var lung = Kit.tissue('lung');
      // The diaphragm is cut by clipping planes (smooth edges) at the same coronal plane, so the
      // domes read in profile as on a film; the crura below the dome are trimmed. The planes are
      // kept in the body's frame every frame, so the cut follows the model when it is orbited.
      var cutLocal = [new THREE.Plane(new THREE.Vector3(0, 0, -1), CUT + 1.5), new THREE.Plane(new THREE.Vector3(0, 1, 0), 11)];
      var cutWorld = cutLocal.map(function (pl) { return pl.clone(); });
      var muscle = Kit.tissue('muscle', { color: 0xa8483e, clippingPlanes: cutWorld });
      var heartM = Kit.tissue('myocardium'), art = Kit.tissue('vessel-artery'), vein = Kit.tissue('vessel-vein');
      var pa = Kit.tissue('vessel-vein', { color: 0x4a6fc0 }), airM = Kit.tissue('cartilage', { color: 0xc9d6dc });
      var m = T ? mediastinum : same, k = T ? 't' : 'n';

      part(body, deformed(k + 'aw', 'chest', 'airway', m), airM);
      part(body, deformed(k + 'ht', 'chest', 'heart', m), heartM);
      part(body, deformed(k + 'ao', 'chest', 'aorta', m), art);
      part(body, deformed(k + 'pa', 'chest', 'pulmonary_arteries', m), pa);
      part(body, deformed(k + 'gv', 'chest', 'great_veins', m), vein);
      part(body, deformed(k + 'di', 'chest', 'diaphragm', T ? hemidiaphragm : same), muscle);
      if (!T) {
        part(body, deformed('nlr', 'chest', 'lung_right', same), lung);
        part(body, deformed('nll', 'chest', 'lung_left', same), lung);
      } else {
        part(body, deformed('tlr', 'chest', 'lung_right', collapsedLung), Kit.tissue('lung', { color: 0x9a5a66, roughness: 0.6 }));
        part(body, deformed('tll', 'chest', 'lung_left', compressedLeft), lung);
        // Trapped pleural air: the right pleural cavity, expanded to the new walls.
        part(body, deformed('air', 'chest', 'lung_right', pleuralAir),
          Kit.tissue('air', { color: 0x9fdcff, opacity: 0.3, emissive: 0x2f8fc8, emissiveIntensity: 0.7, depthWrite: false }));
        Kit.helpers.arrow(g, P(-3, 3, 11), P(6.5, 3, 11));
      }

      var tx = T ? shiftAt(13) : 0;
      var L = [
        { t: 'Trachea', p: P(T ? 0.6 : 0, 19.5, 0) },
        { t: 'Heart', p: P(4.5 + (T ? SHIFT : 0), -0.5, 7) },
        { t: 'Left lung', p: P(7.5, 12.5, 5) },
        { t: 'Right hemidiaphragm', p: P(-8.5, T ? -6 : -2, 3) },
      ];
      if (!T) {
        L.push({ t: 'Right lung', p: P(-10, 11, 2) });
      } else {
        L.push(
          { t: 'Collapsed right lung', p: P(-4.5, 8.5, 1) },
          { t: 'Trapped pleural air', p: P(-11, 3, 3) },
          { t: 'Mediastinal shift →', p: P(1.5, 4.5, 11) },
          { t: 'Trachea deviated away', p: P(tx + 1, 12.5, 0) },
          { t: 'Compressed left lung', p: P(11.5, -1, 3) });
      }
      var info = T
        ? '<ul><li>Air enters the pleural space through a <b>one-way valve</b>; intrapleural pressure rises.</li><li>Ipsilateral lung collapses; the <b>mediastinum and trachea shift away</b>; the hemidiaphragm flattens; the contralateral lung is compressed.</li><li>Kinking of the great veins reduces venous return → <b>obstructive shock</b> (hypotension, JVD, tachycardia).</li><li>Exam: absent breath sounds and hyperresonance on the affected side. <b>Clinical diagnosis: do not wait for imaging.</b></li><li>Immediate needle decompression (classically 2nd intercostal space, midclavicular line; ATLS 10th ed. uses the 5th space, anterior axillary line), then chest tube.</li></ul>'
        : '<ul><li>Normal coronal view: trachea midline, mediastinum central, both lungs inflated, right hemidiaphragm slightly higher than left.</li><li>Switch to the tension state to compare.</li></ul>';
      var syncCut = function () {
        body.updateMatrixWorld(true);
        for (var i = 0; i < cutLocal.length; i++) cutWorld[i].copy(cutLocal[i]).applyMatrix4(body.matrixWorld);
      };
      return { labels: L, info: info, update: syncCut };
    },
  });
})();
