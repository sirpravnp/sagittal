// Portosystemic anastomoses in portal hypertension, on real Z-Anatomy organs (site/meshes/portal.js):
// liver, spleen, stomach, pancreas, duodenum, rectum with anal canal, external anal sphincter and
// umbilicus. The portal vein, splenic, superior and inferior mesenteric veins, IVC, hepatic vein
// stubs, azygos, iliac, internal pudendal and epigastric veins and the oesophagus are tubes along
// Z-Anatomy centre lines (sampled below). The left gastric, oesophageal, paraumbilical, rectal and
// caput medusae veins, the intrahepatic portal and hepatic vein branches and the TIPS stent are
// procedural, placed on that anatomy. Coordinates: mesh frame, cm, +x patient left, +y superior,
// +z anterior (Z-Anatomy world minus [0, 105, 3]).
(function () {
  var S = 0.1; // cm -> scene units

  function T(kind, opts) {
    var o = Object.assign({ sheen: 0 }, opts || {});
    if (kind === 'highlight' && o.clearcoat === undefined) o.clearcoat = 0.2;
    return Kit.tissue(kind, o);
  }
  function V3(p) { return new THREE.Vector3(p[0], p[1], p[2]); }
  function mx(pts) { return pts.map(function (p) { return [-p[0], p[1], p[2]]; }); }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // ---- Z-Anatomy centre lines (cm, mesh frame) ----
  var PV = [[-0.39, 9.79, 0.05], [-0.53, 10.86, 0.03], [-0.66, 11.95, 0.05], [-0.72, 13.41, 0.05], [-0.74, 14.87, 0.05]];
  var SPV = [[9.99, 10.55, -2.74], [9.06, 10.87, -2.27], [8.09, 11.11, -1.85], [7.64, 11.05, -1.73], [6.87, 10.79, -2.19],
    [5.74, 10.31, -2.29], [4.71, 10.14, -1.62], [3.93, 9.96, -1.28], [2.91, 9.78, -0.64], [2.11, 9.67, 0.09], [0.27, 9.78, 0.62], [-0.39, 9.79, 0.05]];
  var SMV = [[-4.82, -6.32, -1.34], [-3.32, -5.33, -0.56], [-2.64, -4.51, -0.22], [-1.53, -2.45, 0.27], [-1.18, -0.51, 1.48],
    [-1.22, 1.2, 2.07], [-1.23, 3.48, 2.09], [-0.87, 4.95, 1.46], [-0.14, 6.83, 0.21], [-0.3, 9.16, 0.04], [-0.39, 9.79, 0.05]];
  var IMV = [[0.54, -7.59, -1.52], [0.8, -6.39, -0.75], [1.56, -4.24, 0.08], [1.87, -2.72, 0.36], [2.0, -1.21, 0.55],
    [2.79, 2.44, -0.24], [3.21, 5.75, -0.76], [3.05, 8.32, -0.64], [2.78, 9.47, -0.44], [2.3, 9.72, -0.05]];
  var IVC = [[-0.86, -1.88, -0.49], [-0.98, 2.46, -0.39], [-1.02, 5.38, -0.47], [-0.99, 7.93, -0.77], [-0.93, 10.19, -1.17],
    [-0.95, 12.21, -1.55], [-0.94, 15.85, -2.12], [-1.26, 18.31, -1.87], [-1.49, 19.42, -1.49], [-1.46, 21.27, -0.82]];
  var CIV = [[-0.86, -1.88, -0.49], [0.23, -4.12, -0.55], [1.12, -5.66, -1.1], [1.8, -6.93, -1.79]];
  var IIV = [[1.8, -6.93, -1.79], [2.39, -7.95, -2.76], [2.66, -9.32, -3.7], [2.63, -10.79, -4.33]];
  var AZY = [[-0.99, 10.17, -2.78], [-0.96, 12.93, -3.78], [-1.11, 16.05, -4.49], [-1.28, 17.91, -5.05], [-1.36, 19.75, -5.75],
    [-1.21, 21.7, -6.02], [-1.37, 22.92, -6.19], [-1.16, 25.15, -6.44]];
  var OES = [[1.27, 14.86, -1.55], [1.16, 14.99, -1.62], [0.79, 15.52, -1.91], [0.51, 16.13, -2.23], [0.23, 17.15, -2.72],
    [0.05, 18.85, -3.53], [0.1, 20.51, -4.26], [0.13, 22.27, -4.91], [0.16, 24.44, -5.57], [0.17, 25.69, -5.8]];
  var HV_L = [[-1.49, 19.42, -1.49], [0.01, 18.89, -0.6], [2.0, 18.4, 0.0], [4.5, 17.4, 0.6]];  // Z-Anatomy stub, extended
  var HV_M = [[-1.49, 19.42, -1.49], [-1.78, 18.53, 0.64], [-2.2, 17.0, 2.6], [-2.5, 15.0, 4.0]];
  var HV_R = [[-1.49, 19.42, -1.49], [-3.5, 19.0, -1.6], [-6.0, 17.8, -1.2], [-8.0, 16.0, -0.5]];
  var SEPI = [[-4.18, -19.63, 1.66], [-4.53, -18.91, 2.76], [-4.05, -16.86, 3.86], [-3.86, -15.24, 4.62], [-3.59, -13.61, 5.4],
    [-3.56, -11.59, 6.18], [-3.54, -9.87, 6.83], [-3.26, -8.52, 7.2], [-3.72, -7.32, 7.32], [-3.33, -5.06, 7.65], [-3.27, -4.3, 7.64]];
  var IEPI = [[-4.58, -14.37, -0.63], [-3.72, -12.64, 1.34], [-2.89, -11.16, 3.02], [-2.83, -8.94, 4.44], [-2.83, -6.4, 4.91],
    [-2.82, -3.8, 5.36], [-2.77, -2.1, 5.85], [-2.56, -0.32, 5.72], [-2.34, 1.47, 5.85], [-2.18, 3.99, 6.49], [-1.94, 5.48, 6.42]];
  var SEPS = [[-1.94, 5.48, 6.42], [-1.79, 7.15, 6.67], [-1.65, 10.47, 7.25], [-1.51, 12.25, 7.38], [-1.47, 15.55, 7.61], [-1.43, 17.77, 7.36]];
  var IPUD = [[-3.75, -23.63, -6.28], [-4.57, -22.94, -7.43], [-5.13, -21.16, -8.4], [-4.53, -19.51, -8.42], [-4.4, -17.54, -8.0],
    [-4.06, -15.89, -7.12], [-3.6, -13.4, -5.9], [-2.63, -10.79, -4.33]];

  // ---- procedural veins on that anatomy ----
  var RPV = [[-0.74, 14.87, 0.05], [-2.0, 15.3, 0.2], [-3.6, 15.4, 0.0], [-5.2, 15.1, 0.9], [-6.8, 14.6, 1.8]];
  var RPV_P = [[-3.6, 15.4, 0.0], [-5.0, 15.9, -1.6], [-6.6, 15.8, -2.8]];
  var LPV = [[-0.74, 14.87, 0.05], [0.5, 15.3, 0.6], [1.6, 15.0, 1.6], [1.6, 13.9, 3.0]];         // to the umbilical part
  var LPV2 = [[1.6, 15.0, 1.6], [3.6, 15.6, 1.2], [5.6, 15.4, 0.8]];
  var TERES = [[1.6, 13.9, 3.0], [1.3, 12.6, 4.3], [0.9, 10.6, 6.1], [0.6, 7.0, 7.6], [0.25, 2.0, 8.4], [0.0, -2.6, 8.6]];
  var LGV = [[-0.5, 10.7, 0.05], [0.4, 11.3, 0.55], [1.3, 12.0, 1.05], [1.95, 12.75, 1.6], [2.05, 13.8, 0.8], [1.75, 14.6, -0.6], [1.55, 15.2, -1.15]];
  var TIPS = [[-2.4, 15.35, 0.15], [-3.0, 16.6, -0.3], [-3.6, 17.8, -1.0], [-4.1, 18.85, -1.5]];
  var SRV = [[0.54, -7.59, -1.52], [0.6, -9.5, -3.6], [0.5, -11.6, -8.8], [0.35, -13.6, -10.0], [0.3, -15.2, -10.4]]; // superior rectal
  var UMB = [0.0, -3.2, 8.75];
  var HEP_PV = [-0.74, 14.87, 0.05];

  // Rectum: ellipse per level, fitted to the Z-Anatomy mesh slices (y, cx, cz, rx, rz).
  var RECT = [[-24, -0.05, -7.7, 1.25, 1.0], [-22, -0.1, -7.8, 1.7, 1.6], [-20, -0.25, -8.1, 2.15, 1.9], [-18, 0.3, -8.55, 2.6, 1.65],
    [-16, 0.3, -7.7, 2.8, 2.4], [-14, 0.4, -7.45, 3.0, 2.15], [-12.5, 0.3, -7.05, 2.1, 1.45]];
  function rectAt(y, th, out) { // point on the rectal wall at height y, angle th (0 = anterior, +pi/2 = left)
    var i = 0; while (i < RECT.length - 2 && y > RECT[i + 1][0]) i++;
    var a = RECT[i], b = RECT[i + 1], t = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0])));
    var cx = a[1] + (b[1] - a[1]) * t, cz = a[2] + (b[2] - a[2]) * t, rx = a[3] + (b[3] - a[3]) * t, rz = a[4] + (b[4] - a[4]) * t;
    return [cx + Math.sin(th) * (rx + out), y, cz + Math.cos(th) * (rz + out)];
  }
  var oesCurve = new THREE.CatmullRomCurve3(OES.map(V3), false, 'centripetal');
  function oesAt(y, th, rad) { // point on a cylinder of radius rad around the oesophagus at height y
    var best = 0, bd = 1e9, c = new THREE.Vector3();
    for (var k = 0; k <= 60; k++) { oesCurve.getPointAt(k / 60, c); var d = Math.abs(c.y - y); if (d < bd) { bd = d; best = k / 60; } }
    oesCurve.getPointAt(best, c);
    return [c.x + Math.sin(th) * rad, y, c.z + Math.cos(th) * rad];
  }
  // Tortuous copy of a path: resampled, with smooth deterministic sideways wobble.
  function wiggle(pts, amp, waves, seed) {
    var c = new THREE.CatmullRomCurve3(pts.map(V3), false, 'centripetal'), n = Math.max(16, Math.round(waves * 6)), out = [];
    var tg = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(), p = new THREE.Vector3();
    for (var i = 0; i <= n; i++) {
      var t = i / n; c.getPointAt(t, p); c.getTangentAt(t, tg);
      side.set(0, 0, 1).cross(tg); if (side.lengthSq() < 1e-4) side.set(1, 0, 0).cross(tg); side.normalize();
      up.crossVectors(tg, side).normalize();
      var e = Math.sin(Math.PI * t), ph = seed * 1.7;
      p.addScaledVector(side, amp * e * Math.sin(t * waves * Math.PI * 2 + ph)).addScaledVector(up, amp * 0.5 * e * Math.cos(t * waves * Math.PI * 2 * 0.7 + ph));
      out.push([p.x, p.y, p.z]);
    }
    return out;
  }

  // Swept tube (radius r0 -> r1) with rounded ends; returns the curve (cm).
  function vtube(parent, pts, r0, r1, m, seg) {
    var curve = new THREE.CatmullRomCurve3(pts.map(V3), false, 'centripetal');
    var n = seg || Math.max(20, pts.length * 8), rs = 10;
    var geo = new THREE.TubeGeometry(curve, n, 1, rs, false);
    var pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (var i = 0; i <= n; i++) {
      var t = i / n, r = r0 + (r1 - r0) * t;
      curve.getPointAt(t, c);
      for (var j = 0; j <= rs; j++) {
        var k = i * (rs + 1) + j;
        v.fromBufferAttribute(pos, k).sub(c).setLength(r).add(c);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
    parent.add(new THREE.Mesh(geo, m));
    [[0, r0], [1, r1]].forEach(function (e) {
      var cap = new THREE.Mesh(new THREE.SphereGeometry(e[1], 10, 8), m);
      cap.position.copy(curve.getPointAt(e[0])); parent.add(cap);
    });
    return curve;
  }
  // Flow arrow along a curve (cm curve, drawn in scene units on g), t0 -> t1.
  function flow(g, curve, t0, t1, col, k) {
    k = k || 1; // frame zoom: keep arrows the same size on screen
    var a = curve.getPointAt(t0).multiplyScalar(S), b = curve.getPointAt(t1).multiplyScalar(S);
    var lift = new THREE.Vector3(0, 0, 0.09 / k); // float the arrow just in front of the vessel
    a.add(lift); b.add(lift);
    col = col === undefined ? 0xffd23f : col;
    var d = b.clone().sub(a), L = d.length(), gr = new THREE.Group(), hl = Math.min(0.13 / k, L * 0.45);
    var m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.5 });
    var sh = new THREE.Mesh(new THREE.CylinderGeometry(0.02 / k, 0.02 / k, L - hl, 8), m); sh.position.y = (L - hl) / 2;
    var hd = new THREE.Mesh(new THREE.ConeGeometry(0.058 / k, hl, 12), m); hd.position.y = L - hl / 2;
    gr.add(sh, hd); gr.position.copy(a); gr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(gr);
  }

  // Per-variant framing (cm centre, zoom factor, extra yaw): the whole circulation for the normal
  // view, then each anastomotic territory close up.
  var FRAMES = {
    norm: { c: [0, 0.8, 0], s: 1, yaw: 0 },
    eso: { c: [0.6, 15.6, -1.5], s: 2.05, yaw: -0.25 },
    caput: { c: [0, 1.5, 3], s: 1.45, yaw: 0.35 },
    rect: { c: [0.2, -16.0, -5], s: 2.1, yaw: -0.3 },
    tips: { c: [-1.6, 15.2, 0], s: 2.1, yaw: 0 },
  };

  Kit.register({
    id: 'portal',
    meshes: ['portal'],
    center: [0, 0, 0],
    zoom: 7.6,
    rot: [0.06, -0.12],
    controls: [{ k: 'v', label: 'Condition', def: 'norm', opts: [
      ['norm', 'Normal portal circulation'],
      ['eso', 'Esophageal varices'],
      ['caput', 'Caput medusae'],
      ['rect', 'Anorectal varices'],
      ['tips', 'TIPS'],
    ] }],
    build: function (g, st) {
      var v = st.v, htn = v !== 'norm';
      var F = FRAMES[v];
      var fr = new THREE.Group(); g.add(fr);
      fr.scale.setScalar(F.s); fr.rotation.y = F.yaw;
      fr.updateMatrix();
      var off = new THREE.Vector3(F.c[0] * S, F.c[1] * S, F.c[2] * S).applyMatrix4(fr.matrix);
      fr.position.copy(off).negate(); fr.updateMatrix();
      function P(x, y, z) { return new THREE.Vector3(x * S, y * S, z * S).applyMatrix4(fr.matrix).toArray(); }
      var b = new THREE.Group(); b.scale.setScalar(S); fr.add(b);
      var gg = g; g = { add: function (o) { fr.add(o); } };
      function flw(cu, t0, t1, col) { flow(g, cu, t0, t1, col, F.s); }

      // --- materials ---
      var portalM = T('vessel-vein', { color: 0x7a55c8 });                 // portal system: violet
      var sysM = T('vessel-vein');                                          // systemic veins: blue
      var varixM = T('vessel-vein', { color: 0xa23fd6, emissive: 0x5a0f80, emissiveIntensity: 0.55 });
      var thinM = T('vessel-vein', { color: 0x8a72c0 });

      // --- real organs ---
      Kit.meshPart(b, 'portal', 'liver', T('liver', { opacity: 0.3, depthWrite: false }));
      var spl = Kit.meshPart(b, 'portal', 'spleen', T('liver', { color: 0x7d3446, opacity: 0.85, depthWrite: false }));
      if (htn) { // splenomegaly, scaled about the spleen's centre
        var sc = new THREE.Vector3(); spl.geometry.boundingBox.getCenter(sc);
        spl.scale.setScalar(1.35); spl.position.copy(sc).multiplyScalar(-0.35);
      }
      Kit.meshPart(b, 'portal', 'stomach', T('bowel', { color: 0xd99a86, opacity: v === 'eso' ? 0.3 : 0.45, depthWrite: false }));
      Kit.meshPart(b, 'portal', 'pancreas', T('pancreas', { opacity: 0.35, depthWrite: false }));
      Kit.meshPart(b, 'portal', 'duodenum', T('bowel', { opacity: 0.3, depthWrite: false }));
      Kit.meshPart(b, 'portal', 'rectum', T('bowel', { color: 0xcf8f80, opacity: v === 'rect' ? 0.5 : 0.6, depthWrite: false }));
      Kit.meshPart(b, 'portal', 'anal_sphincter', T('muscle', { opacity: 0.7, depthWrite: false }));
      Kit.meshPart(b, 'portal', 'umbilicus', T('fat', { color: 0xe0b48a }));
      vtube(b, OES, 0.85, 0.85, T('bowel', { color: 0xd4a08e, opacity: v === 'eso' ? 0.35 : 0.7, depthWrite: false }));

      // --- portal venous system ---
      var pvR = htn ? 0.78 : 0.6;
      var pv = vtube(b, PV, pvR, pvR, portalM);
      var spv = vtube(b, SPV, htn ? 0.5 : 0.4, htn ? 0.55 : 0.42, portalM);
      var smv = vtube(b, SMV, 0.38, htn ? 0.52 : 0.45, portalM);
      var imv = vtube(b, IMV, 0.22, 0.28, portalM);
      vtube(b, RPV, 0.45, 0.22, portalM); vtube(b, RPV_P, 0.3, 0.2, portalM);
      vtube(b, LPV, 0.4, 0.3, portalM); vtube(b, LPV2, 0.25, 0.16, portalM);

      // --- systemic veins ---
      var ivc = vtube(b, IVC, 0.95, 1.05, sysM);
      vtube(b, CIV, 0.8, 0.7, sysM); vtube(b, mx(CIV).map(function (p, i) { return i === 0 ? CIV[0] : p; }), 0.8, 0.7, sysM);
      vtube(b, IIV, 0.6, 0.5, sysM); vtube(b, mx(IIV), 0.6, 0.5, sysM);
      vtube(b, HV_L, 0.5, 0.25, sysM); vtube(b, HV_M, 0.5, 0.25, sysM); var hvr = vtube(b, HV_R, 0.55, 0.28, sysM);
      var azy = vtube(b, AZY, 0.32, 0.4, sysM);

      // --- anastomotic territories ---
      // 1. Left gastric (coronary) vein -> oesophageal veins -> azygos
      var eso = v === 'eso';
      var lgv = vtube(b, LGV, eso ? 0.42 : 0.17, eso ? 0.42 : 0.15, eso ? varixM : thinM);
      var nCol = eso ? 7 : 3;
      for (var k = 0; k < nCol; k++) {
        var th = -0.9 + k * (eso ? 0.45 : 0.9), col = [];
        for (var yy = 15.0; yy <= 20.4; yy += 0.45) col.push(oesAt(yy, th + (eso ? 0.25 * Math.sin(yy * 2.1 + k) : 0), eso ? 1.05 : 0.9));
        if (eso) col = wiggle(col, 0.22, 4 + (k % 3), k);
        col.push(oesAt(21.2, th, 1.0), lerp(oesAt(21.6, th, 1.0), [-1.25, 21.6, -6.0], 0.6), [-1.22, 21.9, -6.0]);
        vtube(b, col, eso ? 0.3 : 0.06, eso ? 0.12 : 0.05, eso ? varixM : thinM);
      }

      // 2. Paraumbilical veins along the ligamentum teres -> superficial / epigastric veins
      var caput = v === 'caput';
      var teres = (v === 'norm' || caput) && vtube(b, TERES, caput ? 0.36 : 0.13, caput ? 0.4 : 0.11, caput ? varixM : T('fascia', { color: 0xd8cbb4, opacity: 1 }));
      // epigastric veins (systemic): drawn, dilated, only for caput medusae
      if (caput) [1, -1].forEach(function (s) {
        var f = s > 0 ? function (p) { return p; } : mx;
        vtube(b, wiggle(f(SEPI), 0.25, 6, s + 2), 0.26, 0.24, sysM);
        vtube(b, f(IEPI), 0.26, 0.3, sysM);
        vtube(b, f(SEPS), 0.22, 0.2, sysM);
      });
      if (caput) {
        // dilated tortuous superficial veins radiating from the umbilicus
        for (var r = 0; r < 7; r++) {
          var a = (r / 7) * Math.PI * 2 + 0.4, len = 5.5 + 1.2 * ((r * 5) % 3);
          var path = [];
          for (var q = 0; q <= 6; q++) {
            var d = 0.9 + len * q / 6, px = Math.cos(a) * d * 1.1, py = UMB[1] + Math.sin(a) * d;
            path.push([px, py, 9.0 - 0.055 * px * px - 0.01 * (py - UMB[1]) * (py - UMB[1])]);
          }
          vtube(b, wiggle(path, 0.3, 2 + (r % 2), r), 0.26, 0.14, varixM);
        }
        // a faint skin surface for the abdominal wall
        var sk = new THREE.PlaneGeometry(22, 26, 22, 26), sp = sk.attributes.position;
        for (var i = 0; i < sp.count; i++) {
          var x = sp.getX(i), y = sp.getY(i) + UMB[1];
          sp.setXYZ(i, x, y, 9.45 - 0.055 * x * x - 0.01 * (y - UMB[1]) * (y - UMB[1]));
        }
        sk.computeVertexNormals();
        b.add(new THREE.Mesh(sk, T('fat', { color: 0xe8c4a8, opacity: 0.16, depthWrite: false })));
      }

      // 3. Superior rectal (portal) <-> middle and inferior rectal (systemic) veins
      var rect = v === 'rect';
      var srv = vtube(b, SRV, rect ? 0.4 : 0.22, rect ? 0.45 : 0.22, portalM);
      vtube(b, IPUD, 0.3, 0.45, sysM); vtube(b, mx(IPUD), 0.3, 0.45, sysM);
      [1, -1].forEach(function (s) {
        var th = s * 2.3;
        var down = [SRV[SRV.length - 1]];
        for (var yy = -16; yy >= -21.5; yy -= 1.1) down.push(rectAt(yy, th, 0.25));
        vtube(b, rect ? wiggle(down, 0.25, 3, s + 5) : down, rect ? 0.4 : 0.14, rect ? 0.35 : 0.1, rect ? varixM : portalM);
        // middle rectal vein -> internal iliac
        var mid = [rectAt(-18, s * 1.6, 0.2), [s * 3.0, -15.5, -7.4], [s * 3.0, -12.6, -5.6], [s * 2.63, -10.79, -4.33]];
        vtube(b, rect ? wiggle(mid, 0.2, 2, s + 7) : mid, rect ? 0.32 : 0.12, rect ? 0.32 : 0.15, rect ? varixM : sysM);
        // inferior rectal vein -> internal pudendal
        var inf = [rectAt(-23.2, s * 1.7, 0.2), [s * 2.6, -23.7, -7.6], [s * 4.3, -23.2, -7.2]];
        vtube(b, inf, rect ? 0.3 : 0.11, rect ? 0.3 : 0.13, rect ? varixM : sysM);
      });
      if (rect) {
        // submucosal varices encircling the anorectal junction
        for (var c = 0; c < 6; c++) {
          var t0 = c / 6 * Math.PI * 2 + 0.3, col2 = [];
          for (var yy2 = -23.2; yy2 <= -19.0; yy2 += 0.5) col2.push(rectAt(yy2, t0 + 0.12 * Math.sin(yy2 * 1.9 + c), 0.12));
          vtube(b, wiggle(col2, 0.15, 2, c + 11), 0.26, 0.2, varixM);
        }
      }

      // 4. TIPS: stent from the right portal vein to the right hepatic vein through the liver
      if (v === 'tips') {
        var stent = vtube(b, TIPS, 0.52, 0.52, T('bone', { color: 0xb8c0c8, roughness: 0.25, metalness: 0.85, envMapIntensity: 1.2 }));
        var wire = new THREE.Mesh(new THREE.TubeGeometry(stent, 24, 0.6, 8, false), new THREE.MeshBasicMaterial({ color: 0x2b3440, wireframe: true }));
        b.add(wire);
        flw(stent, 0.05, 0.9);
        flw(hvr, 0.75, 0.15);
      }

      // --- flow arrows (scene units) ---
      if (!htn || v === 'tips') { flw(pv, 0.1, 0.95); }
      flw(spv, 0.25, 0.75); flw(smv, 0.45, 0.9);
      if (htn && v !== 'tips') flw(pv, 0.95, 0.35, 0xff6a3d); // high resistance: portal flow backs up
      if (eso) { flw(lgv, 0.05, 0.95); flw(new THREE.CatmullRomCurve3([oesAt(16, 0.6, 1.9), oesAt(20.5, 0.6, 1.9)].map(V3)), 0, 1); flw(azy, 0.55, 0.95); }
      if (caput) { flw(teres, 0.1, 0.9); flw(new THREE.CatmullRomCurve3([[2.2, -4.2, 9.2], [5.6, -7.6, 7.8]].map(V3)), 0, 1); flw(new THREE.CatmullRomCurve3([[-2.2, -1.6, 9.2], [-5.4, 2.2, 7.6]].map(V3)), 0, 1); }
      if (rect) { flw(srv, 0.1, 0.9); flw(new THREE.CatmullRomCurve3([[3.4, -20.5, -6.4], [3.4, -13.5, -4.8]].map(V3)), 0, 1); }
      if (!htn) flw(ivc, 0.4, 0.9, 0x7fb2ff);

      // --- labels ---
      var A = 'norm eso caput rect tips';
      var L = [
        { t: 'Liver', p: P(-8.5, 12.0, 4.0), in: 'norm eso caput tips' },
        { t: htn ? 'Portal vein (dilated, >13 mm)' : 'Portal vein', p: P(-0.6, 12.5, 0.6), in: 'norm eso caput tips' },
        { t: 'Splenic vein', p: P(6.0, 10.4, -1.8), in: 'norm eso caput tips' },
        { t: htn ? 'Splenomegaly' : 'Spleen', p: P(10.6, 12.5, -2.0), in: 'norm eso caput tips' },
        { t: 'Superior mesenteric vein', p: P(-1.4, 0.5, 1.8), in: 'norm' },
        { t: 'Inferior mesenteric vein', p: P(2.0, -1.5, 0.5), in: 'norm' },
        { t: 'Inferior mesenteric vein', p: P(1.2, -5.0, -0.2), in: 'rect' },
        { t: 'Stomach', p: P(7.5, 15.5, 3.0), in: 'norm eso caput' },
        { t: 'Oesophagus', p: P(0.95, 22.5, -4.9), in: 'norm eso' },
        { t: 'Inferior vena cava', p: P(-1.9, 7.0, -0.6), in: 'norm caput tips' },
        { t: 'Azygos vein', p: P(-1.6, 24.5, -6.3), in: 'norm eso' },
        { t: 'Left gastric (coronary) vein', p: P(2.0, 12.6, 1.7), in: 'norm eso' },
        { t: 'Ligamentum teres', p: P(0.6, 6.0, 7.8), in: 'norm' },
        { t: 'Superior rectal vein', p: P(0.6, -10.0, -4.0), in: 'norm rect' },
        { t: 'Rectum', p: P(2.6, -16.0, -6.0), in: 'norm rect' },
        { t: 'Hepatic veins', p: P(2.6, 18.2, 0.3), in: 'norm tips' },
        { t: 'Umbilicus', p: P(0.8, -3.6, 9.2), in: 'norm caput' },
        { t: 'Oesophageal varices', p: P(1.2, 18.0, -2.0), in: 'eso' },
        { t: 'Recanalised paraumbilical vein', p: P(0.7, 7.0, 7.9), in: 'caput' },
        { t: 'Caput medusae', p: P(4.6, -6.2, 8.4), in: 'caput' },
        { t: 'Superficial epigastric veins', p: P(-3.6, -13.0, 5.6), in: 'caput' },
        { t: 'Inferior epigastric veins', p: P(2.8, -10.0, 4.0), in: 'caput' },
        { t: 'Anorectal varices', p: P(2.0, -21.0, -7.0), in: 'rect' },
        { t: 'Middle rectal vein → internal iliac', p: P(3.0, -14.0, -6.5), in: 'rect' },
        { t: 'Inferior rectal vein → internal pudendal', p: P(-3.0, -23.6, -7.6), in: 'rect' },
        { t: 'Internal iliac vein', p: P(-2.66, -9.3, -3.7), in: 'rect' },
        { t: 'Internal pudendal vein', p: P(-4.5, -18.5, -8.2), in: 'rect' },
        { t: 'TIPS stent (portal → hepatic vein)', p: P(-3.3, 17.2, -0.7), in: 'tips' },
        { t: 'Right hepatic vein', p: P(-6.5, 17.6, -1.1), in: 'tips' },
        { t: 'Right portal vein', p: P(-4.5, 15.1, 0.5), in: 'tips' },
      ].filter(function (l) { return l.in.split(' ').indexOf(v) >= 0; })
        .map(function (l) { return { t: l.t, p: l.p }; });

      var infos = {
        norm: '<ul><li><b>Portal vein</b> = splenic vein + superior mesenteric vein (behind the pancreatic neck); the inferior mesenteric vein joins the splenic vein. It carries gut and spleen blood to the liver (about 75% of hepatic inflow) and drains through the hepatic veins to the IVC.</li><li>Where portal and systemic (caval) veins meet, normally tiny anastomoses open up in portal hypertension: <b>left gastric → oesophageal → azygos</b>; <b>paraumbilical → superficial and inferior epigastric</b>; <b>superior rectal → middle and inferior rectal</b>; and retroperitoneal veins.</li></ul>',
        eso: '<ul><li><b>Oesophageal varices</b>: portal hypertension (cirrhosis: portal pressure gradient > 10 mmHg; bleeding risk > 12) reverses flow up the <b>left gastric (coronary) vein</b> into submucosal oesophageal veins that drain to the <b>azygos</b>.</li><li>Rupture → massive haematemesis. Acute bleed: resuscitate, <b>octreotide</b>, IV antibiotics (ceftriaxone), <b>endoscopic band ligation</b> within 12 h; balloon tamponade or <b>TIPS</b> if it fails.</li><li>Prevention: non-selective beta-blocker (propranolol, nadolol, carvedilol) or banding.</li></ul>',
        caput: '<ul><li><b>Caput medusae</b>: the <b>paraumbilical veins</b> in the ligamentum teres reopen and carry portal blood to the umbilicus, where dilated <b>superficial epigastric</b> (and deep inferior/superior epigastric) veins radiate outward.</li><li>Flow runs <b>away from the umbilicus</b> (portal hypertension); in IVC obstruction, flank veins fill from below instead.</li><li>Cruveilhier-Baumgarten murmur: venous hum over a recanalised paraumbilical vein.</li></ul>',
        rect: '<ul><li><b>Anorectal varices</b>: the <b>superior rectal vein</b> (portal, via the IMV) connects with the <b>middle rectal</b> (→ internal iliac) and <b>inferior rectal</b> (→ internal pudendal) veins (systemic).</li><li>Distinct from haemorrhoids, which are vascular cushions and are <b>not</b> more common in portal hypertension.</li><li>Can bleed (bright red blood per rectum); managed like other ectopic varices.</li></ul>',
        tips: '<ul><li><b>TIPS</b> (transjugular intrahepatic portosystemic shunt): via the internal jugular vein, a covered stent is placed through the liver from a <b>hepatic vein</b> (usually the right) to a <b>portal vein branch</b>, decompressing the portal system.</li><li>Indications: variceal bleeding not controlled by endoscopy and drugs, refractory ascites.</li><li>Risks: <b>hepatic encephalopathy</b> (ammonia bypasses the liver), worsening liver failure, stent stenosis or thrombosis, heart failure (more venous return).</li></ul>',
      };
      return { labels: L, info: infos[v] };
    },
  });
})();
