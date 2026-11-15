// Circle of Willis, inferior view of the brain base: real Z-Anatomy arteries, CN II/III, chiasm,
// pituitary and brainstem (site/meshes/willis.js) over a translucent cranial-cavity endocast
// computed from the Z-Anatomy skull (site/meshes/endocast.js; no brain-cortex objects are used),
// with the high-yield lesions drawn on top.
(function () {
  var V = Kit.helpers.V;
  var S = 0.55; // cm -> scene units

  function geoOf(mesh, part) {
    var m = Kit.meshPart(new THREE.Group(), mesh, part, Kit.tissue('bone'));
    m.material.dispose();
    return m.geometry;
  }
  // Vertex of a mesh part nearest a hint point (mesh frame, cm).
  function near(part, hint) {
    var p = geoOf('willis', part).attributes.position, best = null, bd = Infinity, v = V(0, 0, 0), h = V(hint[0], hint[1], hint[2]);
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      var d = v.distanceToSquared(h);
      if (d < bd) { bd = d; best = v.clone(); }
    }
    return best;
  }
  var LOW_Y = -4.6, ICA_Y = -2.3, FRONT_Z = 3.4; // clip levels (mesh frame, cm)
  // Perpendicular radius of a vessel part around axis point c with direction dir.
  function radiusAt(part, c, dir) {
    var p = geoOf('willis', part).attributes.position, v = V(0, 0, 0), s = 0, n = 0;
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).sub(c);
      if (v.length() > 0.35) continue;
      s += v.sub(dir.clone().multiplyScalar(v.dot(dir))).length(); n++;
    }
    return n ? s / n : 0.12;
  }
  // The two ends of a drawn ACom: nearest pair of left/right ACA vertices below the A2s.
  function acomEnds() {
    var p = geoOf('willis', 'aca').attributes.position, Lp = [], Rp = [], v, i, j;
    for (i = 0; i < p.count; i++) {
      v = V(0, 0, 0).fromBufferAttribute(p, i);
      if (v.y > 0.25) continue;
      (v.x > 0 ? Lp : Rp).push(v);
    }
    var best = Infinity, a = null, b = null;
    for (i = 0; i < Lp.length; i++) for (j = 0; j < Rp.length; j++) {
      var d = Lp[i].distanceToSquared(Rp[j]);
      if (d < best) { best = d; a = Lp[i]; b = Rp[j]; }
    }
    return [axisAt('aca', a, 0.14), axisAt('aca', b, 0.14)];
  }
  // Optic chiasm, drawn as an X of two flattened bundles joining the Z-Anatomy optic nerves to
  // the optic tracts (Z-Anatomy's own chiasm object is a coarse block).
  function chiasm(G, mat) {
    [1, -1].forEach(function (sx) {
      var c = new THREE.CatmullRomCurve3([V(0.66 * sx, -0.19, 2.2), V(0.3 * sx, -0.1, 1.85), V(-0.2 * sx, 0.04, 1.5), V(-0.58 * sx, 0.2, 1.22)]);
      var geo = new THREE.TubeGeometry(c, 24, 0.2, 14, false);
      geo.scale(1, 0.62, 1);
      G.add(new THREE.Mesh(geo, mat));
    });
    var body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
    body.position.set(0, -0.04, 1.7); body.scale.set(0.5, 0.13, 0.36); G.add(body);
  }
  // Cap for the cut brainstem: convex hull of the part's vertices near the plane y = yc.
  function hullCapGeo(part, yc) {
    var p = geoOf('willis', part).attributes.position, pts = [];
    for (var i = 0; i < p.count; i++) if (Math.abs(p.getY(i) - yc) < 0.12) pts.push([p.getX(i), p.getZ(i)]);
    pts.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [];
    pts.forEach(function (q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    pts.slice().reverse().forEach(function (q) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
    var hull = lo.slice(0, -1).concat(up.slice(0, -1));
    var shape = new THREE.Shape(hull.map(function (q) { return new THREE.Vector2(q[0], q[1]); }));
    var geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2); geo.translate(0, yc, 0); // shape (x, z) -> plane y = yc
    return geo;
  }
  function ss(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  // Left MCA cortical territory on the endocast (mesh frame, cm), after the standard territory
  // maps: the lateral convexity (lateral of a parasagittal ACA strip, in front of the occipital
  // PCA zone), and on the base the lateral orbitofrontal surface, the temporal pole and the
  // lateral temporal lobe (the medial and inferior temporal surface is PCA). Posterior fossa excluded.
  function mcaTerritory(x, y, z) {
    if (x <= 0 || (z < -1.8 && y < -1.6)) return 0;
    var w = ss(2.2, 2.9, x) * ss(-6.4, -5.2, z);
    if (y < -0.4 && z < 2.6) w = Math.min(w, Math.max(ss(3.3, 4.0, x), ss(0.3, 1.1, z)));
    return w;
  }
  // Mean of the vertices of a part that lie within r of a point: a point on the vessel axis.
  function axisAt(part, q, r) {
    var p = geoOf('willis', part).attributes.position, s = V(0, 0, 0), n = 0, v = V(0, 0, 0);
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (v.distanceTo(q) < r) { s.add(v); n++; }
    }
    return n ? s.multiplyScalar(1 / n) : q.clone();
  }
  // A saccular (berry) aneurysm: a slightly lobulated dome on a short neck, from base b towards dir.
  function aneurysm(G, b, dir, R) {
    dir = dir.clone().normalize();
    var geo = new THREE.SphereGeometry(1, 28, 20), p = geo.attributes.position, v = V(0, 0, 0);
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      var k = 1 + 0.07 * Math.sin(3 * v.x + 1.3) * Math.cos(2.5 * v.z) + 0.1 * Math.max(0, v.y) * Math.max(0, v.x); // daughter bleb
      p.setXYZ(i, v.x * k, v.y * k * 1.08, v.z * k);
    }
    geo.computeVertexNormals();
    var mat = Kit.tissue('vessel-artery', { color: 0xe0584a, emissive: 0x5a0d08, emissiveIntensity: 0.35, clearcoat: 0.9 });
    var dome = new THREE.Mesh(geo, mat);
    dome.scale.setScalar(R);
    dome.position.copy(b).add(dir.clone().multiplyScalar(R * 1.15));
    dome.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
    G.add(dome);
    var neck = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.45, R * 0.55, R * 0.9, 18), mat.clone());
    neck.position.copy(b).add(dir.clone().multiplyScalar(R * 0.3));
    neck.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
    G.add(neck);
    return dome.position.clone();
  }

  Kit.register({
    id: 'cow',
    meshes: ['willis', 'endocast'],
    center: [0, 0.5, 0],
    zoom: 9,
    rot: [0.12, 0],
    controls: [{ k: 'v', label: 'Lesion', def: 'norm', opts: [
      ['norm', 'Normal circle of Willis'],
      ['acom', 'ACom aneurysm'],
      ['pcom', 'PCom aneurysm (CN III palsy)'],
      ['mca', 'MCA occlusion (stroke)'],
    ] }],
    build: function (g, st) {
      var v = st.v;
      // Model group: mesh frame (+x left, +y up, +z anterior, cm) turned so that we look up at
      // the brain base: anterior at the top of the screen, patient's left on the screen right.
      var M = new THREE.Group(); M.scale.setScalar(S); M.rotation.x = -Math.PI / 2; g.add(M); M.updateMatrix();
      var planes = [];
      function P(nx, ny, nz, c) { var p = new THREE.Plane(V(nx, ny, nz), c); var w = p.clone(); planes.push([p, w]); return w; }
      // Clip the vessels that run far below the base (towards the viewer) and the cortical
      // branches that climb over the convexity (they would cross the view).
      var low = P(0, 1, 0, -LOW_Y), icaLow = P(0, 1, 0, -ICA_Y), up2 = P(0, -1, 0, 2.2), front = P(0, 0, -1, FRONT_Z), chiBack = P(0, 0, 1, -2.12);
      // Flat caps where a clip plane cuts a tube (keep side: sign * coord[axis] + c >= 0).
      function capCuts(part, axis, sign, c, mat) {
        var cutAt = -c / sign, p = geoOf('willis', part).attributes.position, cl = { l: [], r: [] }, v;
        for (var i = 0; i < p.count; i++) {
          v = V(0, 0, 0).fromBufferAttribute(p, i);
          if (Math.abs(v.getComponent(axis) - cutAt) < 0.1) cl[v.x > 0 ? 'l' : 'r'].push(v);
        }
        ['l', 'r'].forEach(function (k) {
          var a = cl[k];
          if (a.length < 3) return;
          var cen = V(0, 0, 0); a.forEach(function (q) { cen.add(q); }); cen.multiplyScalar(1 / a.length);
          cen.setComponent(axis, cutAt);
          var r = 0; a.forEach(function (q) { var d = q.clone().sub(cen); d.setComponent(axis, 0); r += d.length(); }); r /= a.length;
          var n = V(0, 0, 0); n.setComponent(axis, -sign);
          var m = new THREE.Mesh(new THREE.CircleGeometry(r * 1.04, 20), mat);
          m.position.copy(cen); m.quaternion.setFromUnitVectors(V(0, 0, 1), n); M.add(m);
        });
      }
      function hullCap(part, yc, mat) { M.add(new THREE.Mesh(hullCapGeo(part, yc), mat)); }
      var LUMEN = { color: 0x6e1410, roughness: 0.7, clearcoat: 0 };
      var NOCLIP = new THREE.Plane(V(0, 1, 0), 1e5);
      function three(list) { list = list.slice(); while (list.length < 3) list.push(NOCLIP); return list; }
      var ART = { color: 0xb3261e, clearcoat: 0.45 };
      var AM = {}; // part -> drawn meshes, so labels can sit on each artery's visible surface
      function art(part, opts, clip) {
        var me = Kit.meshPart(M, 'willis', part, Kit.tissue('vessel-artery', Object.assign({ clippingPlanes: three(clip || [low]) }, ART, opts || {})));
        (AM[part] = AM[part] || []).push(me);
        return me;
      }
      var dead = { color: 0x7b6a70, roughness: 0.6, clearcoat: 0.2 }; // no flow distal to the clot

      // Context: the cranial cavity (endocast) as a soft backdrop behind the vessels; in the MCA
      // stroke the left MCA territory is tinted on it.
      var endoGeo = geoOf('endocast', 'endocast');
      // Opaque (so it is drawn first, under everything) with a colour pre-mixed towards the background.
      var endoMat = { color: 0x5f5554, transparent: false, opacity: 1, side: THREE.FrontSide, depthTest: false, depthWrite: false, clearcoat: 0, sheen: 0, roughness: 0.8, envMapIntensity: 0.4 };
      if (v === 'mca') {
        endoGeo = endoGeo.clone(); endoGeo.userData = {};
        var ep = endoGeo.attributes.position, col = new Float32Array(ep.count * 3);
        for (var i = 0; i < ep.count; i++) {
          var w = mcaTerritory(ep.getX(i), ep.getY(i), ep.getZ(i));
          col[3 * i] = 1 + 1.6 * w; col[3 * i + 1] = 1 - 0.55 * w; col[3 * i + 2] = 1 - 0.6 * w;
        }
        endoGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        endoMat.vertexColors = true;
      }
      var endo = new THREE.Mesh(endoGeo, Kit.tissue('fascia', endoMat));
      endo.renderOrder = -1; M.add(endo);

      Kit.meshPart(M, 'willis', 'brainstem', Kit.tissue('fat', { color: 0xb88e80, roughness: 0.75, clearcoat: 0.1, clippingPlanes: three([low]) }));
      hullCap('brainstem', LOW_Y, Kit.tissue('fat', { color: 0x8a5f55, roughness: 0.85, clearcoat: 0 }));
      var nerve = { color: 0xf1e6c8, clippingPlanes: three([front]) };
      // Optic nerves in front of the chiasm (their decussating segment is replaced by the drawn chiasm).
      Kit.meshPart(M, 'willis', 'optic_nerves', Kit.tissue('nerve', { color: 0xf1e6c8, clippingPlanes: three([front, chiBack]) }));
      Kit.meshPart(M, 'willis', 'optic_tracts', Kit.tissue('nerve', { color: 0xf1e6c8 }));
      var hot = { color: 0xffb02e, emissive: 0xff6a00, emissiveIntensity: 0.55, clippingPlanes: three([front]) };
      chiasm(M, Kit.tissue('nerve', v === 'acom' ? hot : { color: 0xf1e6c8 }));
      Kit.meshPart(M, 'willis', 'cn3_l', Kit.tissue('nerve', { clippingPlanes: three([front]) }));
      Kit.meshPart(M, 'willis', 'cn3_r', Kit.tissue('nerve', v === 'pcom' ? hot : { clippingPlanes: three([front]) }));
      capCuts('optic_nerves', 2, -1, FRONT_Z, Kit.tissue('nerve', { color: 0xe6d6b0 }));
      art('ica_l', {}, [icaLow]); art('ica_r', {}, [icaLow]);
      capCuts('ica_l', 1, 1, -ICA_Y, Kit.tissue('vessel-artery', LUMEN));
      capCuts('ica_r', 1, 1, -ICA_Y, Kit.tissue('vessel-artery', LUMEN));
      art('ophthalmic', {}, [front]);
      art('aca'); art('aca_branches');
      art('m1_r'); art('mca_br_r', {}, [low, up2]);
      art('pcom_l'); art('pcom_r');
      art('pca', {}, [low, up2]);
      art('basilar'); art('vertebral'); art('sca'); art('aica'); art('pica');
      capCuts('vertebral', 1, 1, -LOW_Y, Kit.tissue('vessel-artery', LUMEN));

      // ACom: Z-Anatomy's ACom object sits apart from its ACAs, so it is drawn here between the
      // nearest points of the two A1 segments (below the A2s that climb into the fissure).
      var ac = acomEnds();
      var acomMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([ac[0], ac[0].clone().lerp(ac[1], 0.5).add(V(0, -0.03, 0.05)), ac[1]]), 12, 0.08, 10, false),
        Kit.tissue('vessel-artery', ART));
      M.add(acomMesh);
      var acomMid = ac[0].clone().lerp(ac[1], 0.5);

      var m1a = near('m1_l', [1.2, 0, 2.3]), m1b = near('m1_l', [3.9, 0.5, 2.0]);
      var clot = null;
      if (v === 'mca') {
        // Embolus lodged in the proximal left M1: red proximal to it, grey (no flow) beyond.
        var c0 = axisAt('m1_l', m1a.clone().lerp(m1b, 0.3), 0.3);
        var c1 = axisAt('m1_l', m1a.clone().lerp(m1b, 0.48), 0.3);
        var cut = c0.clone().lerp(c1, 0.5), dir = c1.clone().sub(c0).normalize();
        var keepProx = P(-dir.x, -dir.y, -dir.z, dir.dot(cut)), keepDist = P(dir.x, dir.y, dir.z, -dir.dot(cut));
        art('m1_l', {}, [low, keepProx]);
        art('m1_l', dead, [low, keepDist]);
        art('mca_br_l', dead, [low, up2]);
        var rad = radiusAt('m1_l', cut, dir);
        var cl = new THREE.Mesh(new THREE.CapsuleGeometry(rad * 1.3, 0.45, 6, 16), Kit.tissue('blood-oxy', { color: 0x2e0609, roughness: 0.8, clearcoat: 0.2 }));
        cl.position.copy(cut); cl.quaternion.setFromUnitVectors(V(0, 1, 0), dir); M.add(cl);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(rad * 2.6, 0.035, 8, 32), Kit.tissue('highlight', { emissiveIntensity: 0.8 }));
        ring.position.copy(cut); ring.quaternion.setFromUnitVectors(V(0, 0, 1), dir); M.add(ring);
        clot = cut;
      } else {
        art('m1_l'); art('mca_br_l', {}, [low, up2]);
      }

      var sac = null;
      if (v === 'acom') {
        // ACom aneurysm pointing down and back towards the optic chiasm.
        // A large one (about 1.2 cm) reaching the front of the chiasm.
        var ch = V(0, -0.25, 2.0), toCh = ch.clone().sub(acomMid);
        sac = aneurysm(M, acomMid, toCh, Math.min(0.62, toCh.length() / 2.1));
      } else if (v === 'pcom') {
        // Right ICA-PCom junction aneurysm pointing back, out and down onto CN III.
        var j = near('pcom_r', [-1.3, -0.4, 2.2]);
        var n3 = near('cn3_r', [j.x - 0.3, j.y - 0.5, j.z - 0.7]);
        sac = aneurysm(M, j, n3.clone().sub(j), Math.max(0.3, n3.distanceTo(j) * 0.45));
      }

      function W(p) { return (p.isVector3 ? p : V(p[0], p[1], p[2])).clone().applyMatrix4(M.matrix).toArray(); }
      var L = [
        { t: 'Internal carotid', p: W(near('ica_r', [-1.4, -1.0, 2.0])) },
        { t: 'ACA (A1)', p: W(near('aca', [0.9, 0, 3])) },
        { t: v === 'mca' ? 'Right MCA' : 'MCA (M1)', p: W(near('m1_r', [-3, 0.4, 2.2])) },
        { t: 'PCA', p: W(near('pca', [-3.4, -0.6, -1.4])), on: AM.pca }, // lateral to the optic tract
        { t: 'Basilar', p: W(near('basilar', [0, -2, 0.6])) },
        { t: 'Vertebral', p: W(near('vertebral', [1.0, -4, -1.5])) },
        { t: 'SCA', p: W(near('sca', [2.6, -1, -1.6])), on: AM.sca },
        { t: 'PICA', p: W(near('pica', [3, -4, -4])), on: AM.pica },
      ];
      if (v !== 'acom') L.push({ t: 'ACom', p: W(acomMid) });
      if (v !== 'pcom') L.push({ t: 'PCom', p: W(near('pcom_r', [-0.8, -0.5, 1.2])), on: AM.pcom_r });
      if (v === 'norm') {
        L.push({ t: 'AICA', p: W(near('aica', [2.6, -3, -1])) });
        L.push({ t: 'CN III', p: W(near('cn3_l', [1.5, -0.6, 1])) });
        L.push({ t: 'Optic chiasm', p: W(V(0.3, -0.1, 1.45)) });
      }
      if (v === 'acom') {
        L.push({ t: 'ACom aneurysm', p: W(sac) });
        L.push({ t: 'Chiasm compressed', p: W(V(0.3, -0.1, 1.45)) });
      }
      if (v === 'pcom') {
        L.push({ t: 'PCom aneurysm', p: W(sac) });
        L.push({ t: 'CN III compressed', p: W(near('cn3_r', [-1.4, -1.2, 0.6])) });
      }
      if (v === 'mca') {
        L.push({ t: 'Clot in left M1', p: W(clot) });
        L.push({ t: 'Left MCA territory', p: W(V(4.6, -3.4, 0.5)) });
      }
      var infos = {
        norm: '<ul><li>Seen from below (front at the top; patient\'s left on the right). Anterior circulation: <b>internal carotids</b> → ACA and MCA; posterior: <b>vertebrals</b> → basilar → PCAs.</li><li>The <b>ACom</b> joins the two ACAs; each <b>PCom</b> joins the ICA to the PCA, closing the ring.</li><li>Basilar branches: SCA (top), AICA, and PICA from the vertebral. CN III exits between the PCA and SCA and runs beside the PCom.</li></ul>',
        acom: '<ul><li><b>ACom aneurysm</b>: the most common site of a saccular (berry) aneurysm.</li><li>Rupture → subarachnoid hemorrhage ("worst headache of my life").</li><li>Unruptured, it can press on the <b>optic chiasm</b> just below → <b>bitemporal hemianopia</b>.</li></ul>',
        pcom: '<ul><li><b>PCom aneurysm</b> (at the ICA-PCom junction) compresses <b>CN III</b>, which runs beside it.</li><li>The parasympathetic pupillary fibres lie on the outside of the nerve, so the pupil is hit first: <b>dilated, unreactive pupil</b>, then ptosis and an eye that is <b>down and out</b>.</li><li>A painful pupil-involving CN III palsy needs urgent vascular imaging; diabetic (ischemic) CN III palsy typically spares the pupil.</li></ul>',
        mca: '<ul><li><b>Left MCA occlusion</b> (clot in M1): the MCA territory (lateral convexity: face/arm motor and sensory cortex, Broca and Wernicke areas) is shaded; it continues up over the side of the hemisphere.</li><li><b>Contralateral (right) face and arm weakness and sensory loss</b> (leg relatively spared), right homonymous hemianopia, gaze toward the lesion.</li><li><b>Aphasia</b> when the dominant (usually left) hemisphere is hit; hemineglect with a non-dominant (right) lesion.</li></ul>',
      };
      return {
        labels: L,
        info: infos[v],
        update: function () {
          M.updateWorldMatrix(true, false);
          planes.forEach(function (p) { p[1].copy(p[0]).applyMatrix4(M.matrixWorld); });
        },
      };
    },
  });
})();
