// Coronary artery territories and STEMI localisation on a real, CT-derived heart.
// Base anatomy: Rodero et al. 2021 average adult heart (meshes/heart.js, CC BY 4.0), drawn opaque.
// Coronary arteries: Z-Anatomy (CC BY-SA 4.0) curve centre lines for the left main, LAD with its
// diagonal and right-ventricular branches, circumflex with its marginal/posterolateral branches,
// RCA with its right-ventricular and acute marginal branches, and the RCA's inferolateral
// (posterolateral) branch. They were registered onto the Rodero heart (similarity ICP of the
// Z-Anatomy chambers onto the Rodero chamber walls, mean surface residual 0.6-1.0 cm) and then
// projected onto the Rodero epicardium (CL below: mesh frame, cm, +x patient left, +y superior,
// +z anterior). Z-Anatomy has no posterior descending artery, so the PDA follows the Rodero
// posterior interventricular groove from the crux to the apex; the SA and AV nodal branches are
// short schematic paths on the right atrial wall / at the crux. Territories are computed on the
// myocardium at build time: each wall vertex belongs to the artery whose drawn centre line is
// nearest (a Voronoi partition of the epicardium, which reproduces the textbook LAD / LCx / RCA map).
(function () {
  var S = 0.3; // cm -> scene units
  var VIS = 1.6; // vessels drawn a little thicker than life so they read at card size
  // [radius at origin, radius at tip] (cm) and centre line (cm, mesh frame)
  var CL = {
    lm: { r: [0.21, 0.19], p: [[-0.29, 4.22, 0.4], [0.05, 4.25, 0.38], [0.36, 4.09, 0.42], [0.65, 3.89, 0.46], [0.92, 3.69, 0.5], [1.21, 3.49, 0.52]] },
    lad: { r: [0.19, 0.05], p: [[0.84, 3.12, 0.19], [1.64, 3.07, 0.67], [2.07, 3.03, 0.82], [2.42, 2.92, 0.91], [2.72, 2.71, 1.17], [2.92, 2.49, 1.5], [3.1, 2.25, 1.84], [3.24, 1.99, 2.18], [3.35, 1.69, 2.49], [3.44, 1.36, 2.78], [3.52, 1, 3.05], [3.58, 0.61, 3.28], [3.62, 0.22, 3.49], [3.65, -0.2, 3.68], [3.65, -0.62, 3.84], [3.63, -1.04, 3.98], [3.62, -1.47, 4.11], [3.61, -1.9, 4.21], [3.6, -2.34, 4.25], [3.6, -2.77, 4.24], [3.65, -3.19, 4.17], [3.7, -3.6, 4.08], [3.71, -4.01, 4], [3.7, -4.41, 3.88], [3.69, -4.81, 3.71], [3.71, -5.2, 3.47], [3.73, -5.56, 3.13], [3.72, -5.86, 2.68]] },
    d1: { r: [0.09, 0.03], p: [[3.73, -3.59, 4.08], [4.04, -3.75, 4.11], [4.25, -4.03, 4.07], [4.36, -4.41, 3.96], [4.38, -4.82, 3.8], [4.33, -5.22, 3.56], [4.2, -5.57, 3.22], [4.02, -5.86, 2.82]] },
    d2: { r: [0.11, 0.03], p: [[3.62, -1.04, 3.98], [3.82, -1.3, 3.93], [4.03, -1.59, 3.96], [4.21, -1.94, 4], [4.36, -2.31, 4.02], [4.5, -2.69, 4.03], [4.65, -3.05, 3.99], [4.85, -3.37, 3.9], [5.09, -3.65, 3.76], [5.34, -3.91, 3.57], [5.57, -4.18, 3.33], [5.75, -4.46, 3.03], [5.86, -4.73, 2.69]] },
    d3: { r: [0.06, 0.03], p: [[3.71, -3.59, 4.05], [4.68, -3.92, 3.85], [5.06, -4.25, 3.72], [5.13, -4.58, 3.6], [5.17, -4.93, 3.42], [5.17, -5.28, 3.19]] },
    ladrv1: { r: [0.09, 0.03], p: [[3.61, -1.47, 4.1], [3.36, -1.59, 4.43], [3.09, -1.81, 4.68], [2.83, -2.11, 4.84], [2.59, -2.43, 4.97], [2.36, -2.79, 5.06], [2.14, -3.16, 5.1], [1.93, -3.53, 5.08]] },
    ladrv2: { r: [0.09, 0.03], p: [[3.59, 0.21, 3.48], [3.4, 0.17, 3.79], [3.2, 0.01, 4.09], [2.98, -0.2, 4.38], [2.72, -0.38, 4.63], [2.41, -0.54, 4.84], [2.07, -0.68, 5.01]] },
    lcx: { r: [0.19, 0.03], p: [[0.84, 3.12, 0.19], [1.55, 2.85, 0.17], [1.91, 2.81, -0.01], [2.11, 2.84, -0.31], [2.31, 2.84, -0.65], [2.48, 2.8, -1.02], [2.61, 2.72, -1.41], [2.67, 2.58, -1.8], [2.66, 2.39, -2.15], [2.62, 2.16, -2.49], [2.57, 1.93, -2.83], [2.57, 1.68, -3.17], [2.61, 1.42, -3.5], [2.71, 1.16, -3.82], [2.89, 0.86, -4.09], [3.17, 0.52, -4.25], [3.49, 0.19, -4.28], [3.83, -0.13, -4.18], [4.15, -0.43, -4], [4.44, -0.71, -3.78], [4.71, -0.99, -3.54], [4.96, -1.24, -3.28], [5.2, -1.47, -2.97], [5.41, -1.68, -2.64], [5.61, -1.89, -2.3], [5.77, -2.13, -1.97], [5.9, -2.4, -1.66], [6, -2.7, -1.36], [6.07, -3.01, -1.06], [6.12, -3.3, -0.74], [6.17, -3.57, -0.4], [6.22, -3.78, -0.01], [6.27, -3.95, 0.41], [6.31, -4.09, 0.85]] },
    cx1: { r: [0.05, 0.02], p: [[6.23, -3.8, -0.02], [6.2, -4.05, 0.23], [6.2, -4.25, 0.55], [6.22, -4.4, 0.93]] },
    cx2: { r: [0.05, 0.03], p: [[6.06, -3.01, -1.06], [5.98, -3.34, -0.99], [5.91, -3.67, -0.84], [5.86, -4, -0.63]] },
    cx3: { r: [0.06, 0.03], p: [[4.13, -0.44, -3.96], [4.47, -0.34, -3.63], [4.76, -0.31, -3.31], [5.02, -0.36, -3.01], [5.26, -0.5, -2.72], [5.46, -0.67, -2.42], [5.64, -0.86, -2.11], [5.79, -1.04, -1.79], [5.94, -1.21, -1.47]] },
    cx4: { r: [0.06, 0.03], p: [[4.94, -1.25, -3.27], [4.86, -1.58, -3.28], [4.87, -1.92, -3.18], [4.92, -2.25, -3.02], [4.96, -2.57, -2.85], [4.99, -2.89, -2.66]] },
    cx5: { r: [0.05, 0.03], p: [[3.81, -0.15, -4.15], [3.79, -0.55, -4.19], [3.78, -0.89, -4.19], [3.78, -1.19, -4.15], [3.83, -1.5, -4.06], [3.92, -1.8, -3.93], [4.03, -2.11, -3.77]] },
    rca: { r: [0.21, 0.05], p: [[-2, 3.78, 2.82], [-1.78, 3.64, 2.88], [-1.66, 3.45, 3.18], [-1.64, 3.23, 3.59], [-1.65, 2.96, 3.92], [-1.69, 2.65, 4.14], [-1.78, 2.32, 4.33], [-1.9, 1.93, 4.49], [-2.06, 1.52, 4.57], [-2.26, 1.14, 4.61], [-2.5, 0.78, 4.61], [-2.76, 0.43, 4.59], [-3.03, 0.07, 4.54], [-3.28, -0.3, 4.48], [-3.51, -0.69, 4.41], [-3.73, -1.08, 4.3], [-3.94, -1.45, 4.14], [-4.15, -1.78, 3.9], [-4.34, -2.08, 3.6], [-4.49, -2.36, 3.26], [-4.58, -2.63, 2.9], [-4.63, -2.89, 2.53], [-4.62, -3.12, 2.14], [-4.56, -3.31, 1.74], [-4.45, -3.45, 1.35], [-4.3, -3.58, 0.98], [-4.08, -3.73, 0.68], [-3.8, -3.88, 0.43], [-3.48, -4.02, 0.21], [-3.14, -4.09, -0.02], [-2.82, -4.09, -0.29], [-2.54, -4, -0.58], [-2.3, -3.84, -0.87], [-2.09, -3.61, -1.13], [-1.9, -3.34, -1.35], [-1.71, -3.05, -1.5], [-1.45, -2.82, -1.71], [-1.14, -2.7, -2.14], [-0.89, -2.68, -2.64], [-0.67, -2.69, -3.06], [-0.42, -2.69, -3.4], [-0.14, -2.68, -3.7]] },
    rca1: { r: [0.11, 0.03], p: [[-4.61, -2.89, 2.52], [-4.48, -3.09, 2.75], [-4.33, -3.38, 2.8], [-4.17, -3.69, 2.69], [-3.95, -3.97, 2.52], [-3.68, -4.22, 2.38], [-3.34, -4.44, 2.31], [-2.97, -4.63, 2.28], [-2.58, -4.81, 2.26], [-2.2, -4.98, 2.24], [-1.81, -5.14, 2.26], [-1.44, -5.29, 2.32], [-1.08, -5.43, 2.4], [-0.71, -5.57, 2.45], [-0.35, -5.7, 2.42], [0.03, -5.83, 2.33], [0.43, -5.96, 2.21], [0.86, -6.08, 2.13], [1.33, -6.17, 2.1], [1.82, -6.21, 2.12], [2.34, -6.17, 2.16], [2.82, -6.02, 2.23], [3.26, -5.78, 2.31]] },
    rca2: { r: [0.05, 0.03], p: [[1.82, -6.24, 2.11], [2.39, -6.14, 2.09], [2.83, -5.99, 2.06], [3.17, -5.9, 2.05], [3.47, -5.94, 2.06], [3.79, -6.04, 2.07]] },
    rca3: { r: [0.08, 0.03], p: [[-0.36, -5.73, 2.44], [-0.1, -5.82, 2.86], [0.21, -5.89, 3.18], [0.57, -5.92, 3.45], [0.96, -5.9, 3.71], [1.39, -5.8, 3.95], [1.81, -5.64, 4.16]] },
    rca4: { r: [0.14, 0.03], p: [[-4.15, -1.79, 3.92], [-3.78, -2.05, 4.27], [-3.44, -2.3, 4.52], [-3.09, -2.52, 4.7], [-2.72, -2.72, 4.84], [-2.34, -2.91, 4.96], [-1.95, -3.09, 5.03], [-1.55, -3.27, 5.08], [-1.13, -3.42, 5.11], [-0.72, -3.54, 5.12], [-0.3, -3.64, 5.13], [0.11, -3.75, 5.11], [0.5, -3.9, 5.08], [0.88, -4.08, 5.02], [1.23, -4.28, 4.94], [1.58, -4.5, 4.85]] },
    rca5: { r: [0.07, 0.03], p: [[-0.72, -3.54, 5.12], [-0.28, -3.86, 5.05], [0.07, -4.14, 4.97], [0.38, -4.4, 4.88], [0.67, -4.68, 4.77]] },
    rca6: { r: [0.07, 0.03], p: [[0.51, -3.89, 5.1], [0.98, -3.72, 5.13], [1.4, -3.55, 5.14], [1.79, -3.38, 5.12]] },
    rca7: { r: [0.08, 0.03], p: [[-1.55, -3.28, 5.08], [-1.46, -3.63, 4.95], [-1.3, -3.91, 4.84], [-1.07, -4.15, 4.76], [-0.81, -4.37, 4.68], [-0.55, -4.58, 4.6]] },
    rca8: { r: [0.06, 0.03], p: [[-3.07, -2.51, 4.65], [-2.85, -3.01, 4.6], [-2.64, -3.4, 4.55], [-2.4, -3.71, 4.5]] },
    rca9: { r: [0.11, 0.03], p: [[-2.2, 1.11, 4.55], [-2.03, 0.73, 4.8], [-1.81, 0.42, 5.01], [-1.55, 0.15, 5.16], [-1.28, -0.12, 5.28], [-1.01, -0.4, 5.36], [-0.76, -0.69, 5.43], [-0.49, -0.96, 5.48], [-0.19, -1.2, 5.49], [0.14, -1.4, 5.46], [0.49, -1.58, 5.42]] },
    rca10: { r: [0.08, 0.03], p: [[-0.77, -0.69, 5.47], [-0.41, -0.72, 5.5], [-0.02, -0.82, 5.5], [0.37, -0.96, 5.46], [0.75, -1.14, 5.41], [1.12, -1.33, 5.35], [1.48, -1.53, 5.28]] },
    rca11: { r: [0.07, 0.03], p: [[-0.19, -1.21, 5.53], [0.44, -0.92, 5.45], [0.87, -0.87, 5.38], [1.19, -0.96, 5.32], [1.51, -1.07, 5.24]] },
    rca12: { r: [0.11, 0.03], p: [[-1.59, 2.61, 4.06], [-1.25, 2.4, 4.45], [-0.9, 2.23, 4.67], [-0.56, 2.08, 4.8], [-0.24, 1.89, 4.9], [0.06, 1.66, 4.97], [0.34, 1.4, 5.02], [0.63, 1.13, 5.05]] },
    rca13: { r: [0.06, 0.03], p: [[-0.23, 1.9, 4.91], [0.15, 2.02, 4.84], [0.49, 2.11, 4.78], [0.81, 2.16, 4.7], [1.13, 2.19, 4.62]] },
    pl: { r: [0.07, 0.03], p: [[-0.16, -2.69, -3.71], [0.17, -2.93, -3.72], [0.52, -3.15, -3.71], [0.87, -3.34, -3.68], [1.23, -3.51, -3.62], [1.57, -3.67, -3.51], [1.9, -3.83, -3.36], [2.22, -3.98, -3.18], [2.55, -4.12, -2.99], [2.89, -4.23, -2.8], [3.24, -4.32, -2.6], [3.58, -4.42, -2.38], [3.9, -4.52, -2.13], [4.19, -4.62, -1.87], [4.46, -4.72, -1.58], [4.69, -4.81, -1.29], [4.92, -4.86, -1.01], [5.16, -4.85, -0.75], [5.42, -4.75, -0.51], [5.67, -4.6, -0.28], [5.91, -4.42, -0.03]] },
    pl1: { r: [0.06, 0.03], p: [[1.9, -3.83, -3.37], [2.13, -3.54, -3.61], [2.39, -3.3, -3.76]] },
    pl2: { r: [0.04, 0.03], p: [[5.16, -4.87, -0.75], [5.42, -4.95, -0.28], [5.65, -4.91, 0.09], [5.87, -4.8, 0.42]] },
    pl4: { r: [0.06, 0.03], p: [[4.47, -4.73, -1.59], [4.45, -4.89, -1.39], [4.47, -5.07, -1.12], [4.51, -5.24, -0.81], [4.58, -5.4, -0.51], [4.66, -5.53, -0.2]] },
    pl3: { r: [0.05, 0.03], p: [[4.47, -4.73, -1.59], [4.69, -4.47, -1.66], [4.95, -4.22, -1.64], [5.23, -3.98, -1.55], [5.5, -3.73, -1.43]] },
    pl5: { r: [0.05, 0.03], p: [[2.54, -4.12, -2.98], [2.53, -4.36, -2.68], [2.55, -4.55, -2.41], [2.56, -4.74, -2.13], [2.57, -4.92, -1.84]] },
    pl6: { r: [0.05, 0.03], p: [[3.58, -4.41, -2.38], [3.79, -4.14, -2.55], [4.05, -3.91, -2.62], [4.35, -3.7, -2.6], [4.64, -3.49, -2.56]] },
    pl7: { r: [0.06, 0.03], p: [[0.52, -3.15, -3.71], [0.84, -3.07, -3.86], [1.16, -2.98, -4], [1.48, -2.86, -4.11], [1.78, -2.68, -4.22], [2.06, -2.46, -4.33]] },
    pda: { r: [0.11, 0.04], p: [[-1.49, -2.79, -1.62], [-1.2, -3, -1.43], [-0.92, -3.24, -1.32], [-0.61, -3.51, -1.27], [-0.3, -3.8, -1.14], [-0.02, -4.04, -0.94], [0.25, -4.25, -0.7], [0.52, -4.47, -0.45], [0.79, -4.68, -0.18], [1.06, -4.87, 0.09], [1.32, -5.05, 0.37], [1.61, -5.23, 0.63], [1.89, -5.41, 0.91], [2.16, -5.57, 1.2], [2.42, -5.72, 1.51]] },
  };
  // system of each branch: L = LAD, C = circumflex, R = RCA, M = left main
  function sys(k) {
    if (k === 'lm') return 'M';
    if (k === 'lad' || /^(d\d|ladrv)/.test(k)) return 'L';
    if (k === 'lcx' || /^cx/.test(k)) return 'C';
    return 'R';
  }
  // occlusion sites (index into the parent centre line) for each variant
  var OCC = { lad: ['lad', 3], lcx: ['lcx', 3], rca: ['rca', 2] };
  // great-vessel stumps for orientation (same centre lines as the heart scene)
  var AO_ASC = [[-1.74, 3.3, 0.3], [-1.92, 4.5, 0.94], [-2.3, 5.5, 0.95], [-2.2, 6.5, 1.0], [-2.0, 7.7, 0.9], [-1.6, 8.8, 0.0], [-1.2, 9.3, -1.2], [-1.0, 9.1, -2.6], [-1.0, 8.5, -3.8], [-1.0, 7.4, -4.8]];
  var PT = [[0.75, 2.95, 2.3], [0.45, 4.35, 2.8], [0.3, 5.2, 1.8], [0.12, 5.65, 0.4], [0.0, 5.65, -0.7]];
  var LPA = [[0.0, 5.65, -0.7], [1.2, 6.0, -2.1], [2.3, 5.8, -3.5], [3.3, 5.1, -4.7], [4.1, 4.3, -5.3]];
  var RPA = [[0.0, 5.65, -0.7], [-1.2, 5.3, -1.9], [-2.6, 5.0, -2.3], [-4.0, 4.7, -2.4], [-5.4, 4.3, -2.6]];
  var SVC = [[-4.3, 8.0, 0.8], [-4.3, 6.8, 0.6], [-4.2, 5.0, 0.0], [-4.0, 3.5, -0.8]];
  var IVC = [[-3.7, -4.3, -2.3], [-4.1, -3.1, -2.3], [-4.6, -1.8, -2.6]];

  function V3(p) { return new THREE.Vector3(p[0], p[1], p[2]); }

  // Swept tube with radius tapering r0 -> r1 (cm); optional flat caps.
  function vtube(parent, pts, r0, r1, m, rs, caps) {
    var curve = new THREE.CatmullRomCurve3(pts.map(V3), false, 'centripetal');
    var n = Math.max(8, Math.round(curve.getLength() / 0.25)); rs = rs || 10;
    var fr = curve.computeFrenetFrames(n, false), pos = [], idx = [], i, j;
    for (i = 0; i <= n; i++) {
      var t = i / n, c = curve.getPointAt(t), r = r0 + (r1 - r0) * t;
      for (j = 0; j < rs; j++) {
        var a = j / rs * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
        pos.push(c.x + r * (cs * fr.normals[i].x + sn * fr.binormals[i].x),
          c.y + r * (cs * fr.normals[i].y + sn * fr.binormals[i].y),
          c.z + r * (cs * fr.normals[i].z + sn * fr.binormals[i].z));
      }
    }
    for (i = 0; i < n; i++) for (j = 0; j < rs; j++) {
      var a0 = i * rs + j, a1 = i * rs + (j + 1) % rs;
      idx.push(a0, a0 + rs, a1, a1, a0 + rs, a1 + rs);
    }
    if (caps) [0, n].forEach(function (ri) {
      var c = curve.getPointAt(ri / n), ci = pos.length / 3;
      pos.push(c.x, c.y, c.z);
      for (j = 0; j < rs; j++) {
        var q0 = ri * rs + j, q1 = ri * rs + (j + 1) % rs;
        if (ri === 0) idx.push(ci, q0, q1); else idx.push(ci, q1, q0);
      }
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    var me = new THREE.Mesh(geo, m); parent.add(me); return me;
  }
  function sstep(e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }

  Kit.register({
    id: 'cor',
    meshes: ['heart'],
    center: [0, 0, 0],
    zoom: 9.4,
    rot: [0.1, 0],
    controls: [{ k: 'v', label: 'Coronary', def: 'norm', opts: [
      ['norm', 'Normal coronary anatomy (right-dominant)'],
      ['lad', 'LAD occlusion (anterior STEMI)'],
      ['lcx', 'Circumflex occlusion (lateral STEMI)'],
      ['rca', 'RCA occlusion (inferior STEMI)'],
    ] }],
    build: function (g, st) {
      var v = st.v;
      // Every material shares one shader set-up (clearcoat, no sheen): each extra feature
      // combination costs a shader compile, which is slow on software GL.
      function T(kind, o) { return Kit.tissue(kind, Object.assign({ sheen: 0, clearcoat: 0.3, side: THREE.FrontSide }, o || {})); }
      var VIEW = { // [x tilt, y turn] of the heart for each variant
        norm: [-0.35, 0.2], lad: [0.12, -0.1], lcx: [0.1, -1.5], rca: [-1.22, -0.22],
      }[v];
      var H = new THREE.Group(); H.scale.setScalar(S); H.rotation.set(VIEW[0], VIEW[1], 0, 'YXZ'); g.add(H);
      // centre the heart (cm) so every view orbits the ventricles
      var CEN = [0.6, -0.6, 0.4];
      H.position.set(0, 0, 0); H.updateMatrix();
      var off = V3(CEN).applyMatrix4(H.matrix).negate(); H.position.copy(off); H.updateMatrix();
      function P(p) { return V3(p).applyMatrix4(H.matrix).toArray(); }
      function top(o) { o.traverse(function (x) { x.renderOrder = 10; if (x.material) { x.material.depthTest = false; x.material.transparent = true; } }); return o; }

      var occ = OCC[v], bad = occ ? (v === 'lad' ? 'L' : v === 'lcx' ? 'C' : 'R') : null;
      var occP = occ ? CL[occ[0]].p[occ[1]] : null;

      // ---- vessel point cloud with system tags (for territories) ----
      var vp = [], vs = [];
      Object.keys(CL).forEach(function (k) {
        var s = sys(k); if (s === 'M') return;
        CL[k].p.forEach(function (p) { vp.push(p[0], p[1], p[2]); vs.push(s); });
      });
      var nv = vs.length;

      // ---- myocardium with per-vertex territory shading ----
      var red = new THREE.Color(0xa65a4c), inf = new THREE.Color(0xcfa565), tmp = new THREE.Color();
      function wall(part) {
        var me = Kit.meshPart(H, 'heart', part, T('myocardium', { color: 0xffffff, vertexColors: true }));
        var geo = me.geometry.clone(); geo.userData = {};
        var pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3);
        for (var i = 0; i < n; i++) {
          var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), w = 0;
          if (bad) {
            var dIn = 1e9, dOut = 1e9;
            for (var j = 0; j < nv; j++) {
              var dx = vp[3 * j] - x, dy = vp[3 * j + 1] - y, dz = vp[3 * j + 2] - z, d = dx * dx + dy * dy + dz * dz;
              if (vs[j] === bad) { if (d < dIn) dIn = d; } else if (d < dOut) dOut = d;
            }
            w = sstep(-0.35, 0.35, Math.sqrt(dOut) - Math.sqrt(dIn));
          }
          tmp.copy(red).lerp(inf, w);
          col[3 * i] = tmp.r; col[3 * i + 1] = tmp.g; col[3 * i + 2] = tmp.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        me.geometry = geo; return me;
      }
      wall('wall_lv'); wall('wall_rv');
      var atr = T('myocardium', { color: 0xb26a5a });
      Kit.meshPart(H, 'heart', 'wall_la', atr);
      Kit.meshPart(H, 'heart', 'wall_ra', atr);

      // ---- great vessels (orientation) ----
      var aoM = T('vessel-artery', { color: 0xc4574a }), paM = T('vessel-artery', { color: 0x8a6fb0 }), vM = T('vessel-vein');
      vtube(H, AO_ASC, 1.75, 1.05, aoM, 18, true);
      vtube(H, PT, 1.3, 1.1, paM, 16);
      vtube(H, LPA, 0.85, 0.7, paM, 12, true);
      vtube(H, RPA, 0.85, 0.7, paM, 12, true);
      vtube(H, SVC, 1.0, 1.0, vM, 14, true);
      vtube(H, IVC, 1.05, 1.05, vM, 14, true);

      // ---- coronary arteries ----
      var art = T('vessel-artery', { color: 0xf03a2a, clearcoat: 0.6, emissive: 0x5a0a04 });
      var dead = T('vessel-artery', { color: 0x3a2230, roughness: 0.6 });
      function branch(k) {
        var c = CL[k], pts = c.p, r0 = c.r[0] * VIS, r1 = Math.max(0.035, c.r[1]) * VIS;
        var down = bad && sys(k) === bad;
        if (down && occ[0] === k) { // split at the occlusion: patent proximal stump, dark distal vessel
          var i = occ[1], L = pts.length - 1, rm = r0 + (r1 - r0) * i / L;
          vtube(H, pts.slice(0, i + 1), r0, rm, art);
          vtube(H, pts.slice(i), rm, r1, dead);
        } else vtube(H, pts, r0, r1, down ? dead : art);
      }
      Object.keys(CL).forEach(branch);
      // SA nodal branch: from the proximal RCA, back over the right atrium to the SVC-RA junction (sinus node)
      var SAN = [CL.rca.p[3], [-2.6, 4.3, 2.2], [-3.5, 4.4, 1.1], [-4.1, 4.0, 0.0], [-4.3, 3.6, -0.7]];
      // AV nodal branch: from the RCA at the crux, up into the septum toward the AV node
      var crux = CL.pda.p[0];
      var AVN = [crux, [crux[0] - 0.1, crux[1] + 0.7, crux[2] + 0.35], [crux[0] - 0.2, crux[1] + 1.3, crux[2] + 0.8]];
      var rDown = bad === 'R';
      vtube(H, SAN, 0.08 * VIS, 0.05 * VIS, rDown ? dead : art);
      vtube(H, AVN, 0.07 * VIS, 0.05 * VIS, rDown ? dead : art);

      var hl = 0xffd23f;
      if (occ) { // thrombus and marker ring at the occlusion
        var cp = CL[occ[0]].p, a = cp[occ[1] - 1], b = cp[occ[1] + 1];
        var th = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), T('vessel-artery', { color: 0x2a0606, roughness: 0.7 }));
        th.position.copy(V3(occP)); th.scale.set(1, 1, 1.5); th.lookAt(V3(b)); H.add(th);
        var rg = Kit.helpers.ring(g, P(occP), 0.2, hl);
        rg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V3(b).sub(V3(a)).normalize().transformDirection(H.matrix));
        top(rg);
      }

      var L = [], info = '';
      function lab(t, p) { L.push({ t: t, p: P(p) }); }
      if (v === 'norm') {
        lab('Left main', CL.lm.p[3]);
        lab('LAD (anterior interventricular)', CL.lad.p[13]);
        lab('Diagonal', CL.d2.p[7]);
        lab('Circumflex (LCx)', CL.lcx.p[5]);
        lab('RCA (right AV groove)', CL.rca.p[9]);
        lab('Acute marginal', CL.rca1.p[5]);
        lab('PDA (from RCA = right-dominant)', CL.pda.p[8]);
        info = '<ul><li><b>Left main</b> → <b>LAD</b> (anterior interventricular groove: diagonals to the anterolateral LV, septal perforators to the anterior 2/3 of the septum, apex) and <b>circumflex</b> (left AV groove: obtuse marginals to the lateral wall).</li>' +
          '<li><b>RCA</b> runs in the right AV groove: SA nodal branch (~60%), acute marginal to the RV free wall, then at the crux the AV nodal branch and, in right dominance, the <b>PDA</b> (inferior wall, posterior 1/3 of the septum).</li>' +
          '<li><b>Dominance</b> = which artery gives the PDA: right ~70-80%, left (LCx) ~10%, co-dominant the rest.</li></ul>';
      } else if (v === 'lad') {
        lab('Proximal LAD occlusion', CL.lad.p[3]);
        lab('Anterior wall + apex', [4.6, -2.6, 3.1]);
        lab('Anterior septum (septal perforators)', CL.lad.p[17]);
        lab('Diagonal (no flow)', CL.d2.p[8]);
        lab('Circumflex (patent)', CL.lcx.p[7]);
        lab('RCA (patent)', CL.rca.p[7]);
        info = '<ul><li><b>Anterior / anteroseptal STEMI: ST elevation V1-V4</b> (V1-V2 septal, V3-V4 anterior; add I, aVL, V5-V6 if diagonals are involved: anterolateral).</li>' +
          '<li>The LAD is the most commonly occluded coronary artery and supplies the anterior LV, apex and anterior 2/3 of the septum.</li>' +
          '<li>Proximal LAD occlusion can cause new RBBB / LAFB (septal conduction tissue), cardiogenic shock, LV apical aneurysm and mural thrombus.</li>' +
          '<li>Treatment: emergent PCI (door-to-balloon ≤ 90 min) or fibrinolysis if PCI is not available within 120 min.</li></ul>';
      } else if (v === 'lcx') {
        lab('Circumflex occlusion', CL.lcx.p[3]);
        lab('Lateral wall', [6.4, -1.4, 1.0]);
        lab('Obtuse marginal (no flow)', CL.lcx.p[22]);
        lab('LAD (patent)', CL.lad.p[12]);
        lab('Left atrium', [1.6, 3.4, -2.6]);
        info = '<ul><li><b>Lateral STEMI: ST elevation I, aVL, V5-V6.</b></li>' +
          '<li>The circumflex runs in the left AV groove and supplies the lateral (and, via posterolateral branches, posterior) LV.</li>' +
          '<li>Often electrically quiet: a posterior extension shows as <b>ST depression V1-V3</b> with tall R waves; confirm with V7-V9.</li>' +
          '<li>The anterolateral papillary muscle has a dual supply (LAD diagonals + LCx marginals), so it rarely ruptures.</li></ul>';
      } else if (v === 'rca') {
        lab('Proximal RCA occlusion', CL.rca.p[2]);
        lab('Inferior wall', [2.2, -5.2, -1.2]);
        lab('RV infarct', [-2.4, -4.1, 2.6]);
        lab('PDA (no flow)', CL.pda.p[9]);
        lab('AV nodal branch (crux)', crux);
        lab('RCA (no flow)', CL.rca.p[30]);
        info = '<ul><li><b>Inferior STEMI: ST elevation II, III, aVF</b> (III > II suggests RCA rather than LCx); reciprocal ST depression in I and aVL.</li>' +
          '<li><b>RV infarct</b> (proximal RCA, before the RV branches): ST elevation in V4R, hypotension, raised JVP, clear lungs. Preload dependent: give fluids, avoid nitrates.</li>' +
          '<li><b>Bradycardia and heart block:</b> the AV nodal artery comes from the RCA in ~80-90% (right dominance), the SA nodal artery in ~60%. Inferior MI AV block is usually at the AV node and often transient (atropine; pacing if unstable).</li>' +
          '<li>The posteromedial papillary muscle has a single supply (PDA), so it can rupture 3-5 days after an inferior MI → acute mitral regurgitation.</li></ul>';
      }
      return { labels: L, info: info };
    },
  });
})();
