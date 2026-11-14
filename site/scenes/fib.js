// Uterine fibroids by FIGO type on a procedural uterus (coronal cutaway, front half removed).
// There is no open female pelvis mesh (Z-Anatomy and BodyParts3D are male), so the uterus is
// built here from an anatomical coronal profile (cm): body 5 cm, cervix 3 cm, fundal width
// 5 cm, AP depth about 3.6 cm, myometrium 1.2-1.5 cm, endometrium about 3 mm.
(function () {
  var h = Kit.helpers, V = h.V;
  var S = 0.5; // scene units per cm

  // Right half of the coronal profile of the outer uterine surface [x, y] (cm), cervix to fundus.
  // y = 0 is the internal os; the external os is at y = -3.
  var OUT = [[0.0, -2.96], [0.3, -3.02], [0.62, -3.08], [0.95, -3.02], [1.18, -2.85], [1.28, -2.5], [1.3, -2.0], [1.27, -1.4],
    [1.2, -0.8], [1.15, -0.3], [1.2, 0.2], [1.42, 0.7], [1.72, 1.3], [2.02, 1.95], [2.27, 2.6], [2.44, 3.3], [2.5, 3.85],
    [2.43, 4.3], [2.22, 4.7], [1.85, 5.02], [1.3, 5.25], [0.65, 5.36], [0.0, 5.39]];
  // Cavity (triangular in the coronal plane) continuing as the fusiform cervical canal.
  var CAV = [[0.17, -3.06], [0.14, -2.6], [0.21, -1.7], [0.16, -0.8], [0.07, 0.0], [0.3, 0.8], [0.7, 1.9], [1.1, 2.9],
    [1.38, 3.6], [1.53, 3.93], [1.26, 3.98], [0.7, 3.9], [0.0, 3.86]];
  // Pick a point on a half profile at height y (linear interpolation of x).
  function xAt(half, y) {
    for (var i = 0; i < half.length - 1; i++) {
      var a = half[i], b = half[i + 1];
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
    }
    return 0;
  }
  // Full outline from a right half (bottom to top, ending on the midline): right side up, left side down.
  function mirror(half) {
    var r = half.slice(), l = [];
    for (var i = half.length - 2; i >= 0; i--) if (half[i][0] > 1e-6) l.push([-half[i][0], half[i][1]]);
    return r.concat(l);
  }
  // Offsets a closed polygon along its vertex normals by d (d > 0 grows a counter-clockwise polygon).
  function offset(poly, d, yMin) {
    var n = poly.length, out = [];
    var area = 0;
    for (var i = 0; i < n; i++) { var p = poly[i], q = poly[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
    var sgn = area > 0 ? 1 : -1;
    for (i = 0; i < n; i++) {
      var a = poly[(i + n - 1) % n], b = poly[i], c = poly[(i + 1) % n];
      var tx = c[0] - a[0], ty = c[1] - a[1], L = Math.hypot(tx, ty) || 1;
      var x = b[0] + sgn * d * ty / L, y = b[1] - sgn * d * tx / L;
      out.push([x, yMin === undefined ? y : Math.max(yMin, y)]);
    }
    return out;
  }
  function smooth(e0, e1, x) { var t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
  // Anteroposterior flattening: the body is about 0.72 as deep as it is wide, the cervix round.
  function fz(y) { return 0.95 - 0.23 * smooth(-0.6, 0.8, y); }

  // Flat cap (a filled outline) in the cut plane z = off (towards the viewer).
  function capGeo(poly, off) {
    var pts = poly.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var faces = THREE.ShapeUtils.triangulateShape(pts, []), v = [], nn = [];
    var uv = [];
    faces.forEach(function (f) { f.forEach(function (k) { v.push(pts[k].x, pts[k].y, off); nn.push(0, 0, 1); uv.push(pts[k].x * 0.35, pts[k].y * 0.35); }); });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }
  // Lathe of a right-half profile around the long axis, flattened front to back.
  function body(half, segs) {
    var g = new THREE.LatheGeometry(half.map(function (p) { return new THREE.Vector2(Math.max(p[0], 1e-4), p[1]); }), segs || 72);
    var p = g.attributes.position;
    for (var i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * fz(p.getY(i)));
    g.computeVertexNormals();
    return g;
  }
  // Tube with a varying radius along a curve.
  function vtube(curve, rad, n, m) {
    var frames = curve.computeFrenetFrames(n, false), pos = [], idx = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, c = curve.getPointAt(t), r = rad(t), N = frames.normals[i], B = frames.binormals[i];
      for (var j = 0; j <= m; j++) {
        var a = j / m * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        pos.push(c.x + r * (ca * N.x + sa * B.x), c.y + r * (ca * N.y + sa * B.y), c.z + r * (ca * N.z + sa * B.z));
      }
    }
    for (i = 0; i < n; i++) for (j = 0; j < m; j++) {
      var a0 = i * (m + 1) + j, b0 = a0 + m + 1;
      idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  function curve(pts) { return new THREE.CatmullRomCurve3(pts.map(function (p) { return V(p[0], p[1], p[2]); })); }

  // Whorled cut surface of a leiomyoma (interlacing smooth-muscle bundles), painted once.
  var whorlTex = null;
  function whorl() {
    if (whorlTex) return whorlTex;
    var cv = document.createElement('canvas'); cv.width = cv.height = 256;
    var x = cv.getContext('2d');
    x.fillStyle = '#e9dacb'; x.fillRect(0, 0, 256, 256);
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var k = 0; k < 3; k++) {
      var cx = 128 + (rnd() - 0.5) * 70, cy = 128 + (rnd() - 0.5) * 70;
      for (var r = 6; r < 190; r += 4.5) {
        x.beginPath();
        var ph = rnd() * 6.28, amp = 2 + r * 0.06;
        for (var a = 0; a <= 6.3; a += 0.05) {
          var rr = r + amp * Math.sin(4 * a + ph + r * 0.05) + 2 * Math.sin(9 * a + ph);
          var px = cx + rr * Math.cos(a + r * 0.012), py = cy + rr * Math.sin(a + r * 0.012);
          if (a === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.strokeStyle = 'rgba(' + (135 + k * 12) + ',98,92,' + (0.28 + rnd() * 0.3) + ')';
        x.lineWidth = 1.2 + rnd() * 2; x.stroke();
      }
    }
    // Pseudocapsule: compressed myometrium round the edge of the cut surface.
    x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2);
    x.strokeStyle = 'rgba(170,110,100,0.75)'; x.lineWidth = 7; x.stroke();
    whorlTex = new THREE.CanvasTexture(cv);
    whorlTex.encoding = THREE.sRGBEncoding;
    return whorlTex;
  }
  // Interlacing smooth-muscle bundles for the cut myometrium (multiplies the tissue colour).
  var fibreTex = null;
  function fibres() {
    if (fibreTex) return fibreTex;
    var cv = document.createElement('canvas'); cv.width = cv.height = 256;
    var x = cv.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
    var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 260; i++) {
      var px = rnd() * 256, py = rnd() * 256, a = rnd() * Math.PI, L = 20 + rnd() * 50, bend = (rnd() - 0.5) * 0.8;
      x.beginPath(); x.moveTo(px, py);
      x.quadraticCurveTo(px + Math.cos(a + bend) * L / 2, py + Math.sin(a + bend) * L / 2, px + Math.cos(a) * L, py + Math.sin(a) * L);
      x.strokeStyle = rnd() < 0.5 ? 'rgba(90,40,40,0.13)' : 'rgba(255,235,230,0.18)';
      x.lineWidth = 1 + rnd() * 2.5; x.stroke();
    }
    fibreTex = new THREE.CanvasTexture(cv);
    fibreTex.encoding = THREE.sRGBEncoding;
    fibreTex.wrapS = fibreTex.wrapT = THREE.MirroredRepeatWrapping;
    return fibreTex;
  }
  // Slightly lumpy sphere for a fibroid surface.
  function lump(r, seed) {
    var g = new THREE.SphereGeometry(r, 40, 28), p = g.attributes.position, v = V(0, 0, 0);
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      var u = v.clone().normalize();
      var k = 1 + 0.035 * Math.sin(5 * u.x + seed) * Math.sin(4 * u.y + 2 * seed) + 0.025 * Math.sin(7 * u.z + 3 * seed);
      v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  }

  Kit.register({
    id: 'fib',
    center: [0, 0.6, 0],
    zoom: 8.5,
    rot: [0.2, 0.45],
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
      var U = new THREE.Group(); U.scale.setScalar(S); g.add(U); U.updateMatrix();
      // The front half (z > 0) is cut away; the plane follows the model when it is turned.
      var cut = new THREE.Plane(V(0, 0, -1), 0), wcut = cut.clone(), clip = [wcut];
      function T(kind, o) { return Kit.tissue(kind, o || {}); }
      function C(kind, o) { return Kit.tissue(kind, Object.assign({ clippingPlanes: clip }, o || {})); }
      function add(geo, mat, grp) { var m = new THREE.Mesh(geo, mat); (grp || U).add(m); return m; }

      var outer = mirror(OUT);
      var serosaIn = offset(outer, -0.08);
      var cav = mirror(CAV);
      var endoOut = offset(cav, 0.28, -3.0);
      // Cervical stroma (paler, fibrous) below the isthmus: the right run of the inner outline,
      // a straight top edge, then the left run.
      var xc = xAt(OUT, -0.25) - 0.08, k0 = 0;
      while (serosaIn[k0][1] < -0.25) k0++;
      var k1 = serosaIn.length - 1;
      while (serosaIn[k1][1] < -0.25) k1--;
      var cervix = serosaIn.slice(0, k0).concat([[xc, -0.25], [-xc, -0.25]], serosaIn.slice(k1 + 1));

      // Posterior half in 3D: serosa outside, myometrium beneath it, endometrial slab inside.
      if (st.sr) add(body(OUT), C('uterus-serosa'));
      else if (st.my) add(body(OUT.map(function (p) { return [Math.max(0, p[0] - 0.08), p[1] - (p[0] < 0.7 ? 0.08 : 0)]; })), C('myometrium'));
      else if (st.en) {
        var sh = new THREE.Shape(endoOut.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
        var eg = new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.12, bevelSegments: 4, curveSegments: 12 });
        eg.translate(0, 0, -0.25);
        add(eg, C('endometrium'));
      }
      // Section (caps) on the cut, painted back to front.
      if (st.sr) add(capGeo(outer, 0.002), T('uterus-serosa', { color: 0xe7a7a2 }));
      if (st.my) {
        add(capGeo(serosaIn, 0.004), T('myometrium', { color: 0x8f4846, clearcoat: 0.15, map: fibres() }));
        add(capGeo(cervix, 0.005), T('myometrium', { color: 0xc99089, clearcoat: 0.15, map: fibres() }));
      }
      if (st.en) {
        add(capGeo(endoOut, 0.006), T('endometrium', { color: 0xd06a74 }));
        add(capGeo(cav, 0.007), T('endometrium', { color: 0x6a1e2c, roughness: 0.35 }));
      }
      // Upper vagina with the fornices around the cervix (sectioned too).
      var VAG = [[1.26, -1.75], [1.62, -1.95], [1.86, -2.5], [1.82, -3.2], [1.7, -3.9], [1.4, -3.9], [1.52, -3.2], [1.55, -2.55], [1.4, -2.12], [1.22, -1.98]];
      var vg = new THREE.LatheGeometry(VAG.concat([VAG[0]]).map(function (p) { return new THREE.Vector2(p[0], p[1]); }), 64);
      var vp = vg.attributes.position;
      for (var i = 0; i < vp.count; i++) vp.setZ(i, vp.getZ(i) * 0.8);
      vg.computeVertexNormals();
      add(vg, C('uterus-serosa', { color: 0xc98884 }));
      var vagCapMat = T('endometrium', { color: 0xcf8a86 });
      add(capGeo(VAG, 0.003), vagCapMat);
      add(capGeo(VAG.map(function (p) { return [-p[0], p[1]]; }), 0.003), vagCapMat.clone());

      // Adnexa (not cut): tubes with fimbriae, ovaries, ovarian ligaments.
      var lbl = [];
      [1, -1].forEach(function (s) {
        var tube = curve([[s * 2.05, 4.3, -0.1], [s * 2.9, 4.42, -0.15], [s * 3.7, 4.65, -0.3], [s * 4.55, 4.75, -0.55], [s * 5.15, 4.3, -0.85], [s * 5.2, 3.6, -1.15]]);
        add(vtube(tube, function (t) { return 0.17 + 0.2 * smooth(0.25, 0.8, t) + 0.22 * smooth(0.85, 1, t); }, 80, 16), T('uterus-serosa', { color: 0xe39b97 }));
        var end = tube.getPointAt(1), dir = tube.getTangentAt(1);
        for (var f = 0; f < 11; f++) {
          var a = f / 11 * Math.PI * 2;
          var r0 = V(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4);
          var p0 = end.clone().add(r0), p1 = p0.clone().add(dir.clone().multiplyScalar(0.35)).add(r0.clone().multiplyScalar(0.6));
          var p2 = p1.clone().add(V(-s * 0.25 * Math.cos(a), -0.45 - 0.15 * Math.sin(3 * a), 0.12 * Math.sin(a)));
          add(vtube(new THREE.CatmullRomCurve3([p0, p1, p2]), function (t) { return 0.085 * (1 - 0.6 * t); }, 10, 6), T('uterus-serosa', { color: 0xeba6a2 }));
        }
        var ov = add(lump(1, s > 0 ? 2 : 5), T('fat', { color: 0xd6b2a6, roughness: 0.6, clearcoat: 0.3, sheen: 0.4, sheenColor: 0xfff0e8 }));
        ov.scale.set(1.5, 0.78, 0.68); ov.position.set(s * 4.15, 2.95, -1.2); ov.rotation.z = s * 0.35;
        add(vtube(curve([[s * 1.95, 3.75, -0.35], [s * 2.6, 3.45, -0.7], [s * 3.0, 3.2, -1.05]]), function () { return 0.12; }, 12, 8), T('uterus-serosa', { color: 0xd8a0a0 }));
        if (s > 0) lbl.push({ t: 'Fallopian tube', p: [S * 3.7, S * 4.95, S * -0.3] }, { t: 'Ovary', p: [S * 4.7, S * 2.6, S * -1.0] });
      });

      // Fibroids: [FIGO, group, x, y, radius, stalk end or null] in cm on the coronal section.
      var F = [
        ['0', 'sub', 0.05, 2.45, 0.55, [-0.2, 3.85]],
        ['1', 'sub', 1.02, 3.05, 0.5, null],
        ['2', 'sub', -0.75, 1.45, 0.55, null],
        ['3', 'int', 0.92, 0.78, 0.36, null],
        ['4', 'int', -0.75, 4.62, 0.3, null],
        ['5', 'ser', 1.76, 1.98, 0.6, null],
        ['6', 'ser', -2.4, 2.1, 0.6, null],
        ['7', 'ser', 1.55, 6.35, 0.55, [0.95, 5.15]],
      ];
      var tex = whorl();
      F.forEach(function (f, k) {
        if (!(st.sh === 'all' || st.sh === f[1])) return;
        var r = f[4];
        var m = add(lump(r, k + 1), C('fibroid'));
        m.position.set(f[2], f[3], 0);
        var cp = add(new THREE.CircleGeometry(r * 0.985, 48), T('fibroid', { map: tex, color: 0xffffff, clearcoat: 0.2 }));
        cp.position.set(f[2], f[3], 0.011);
        if (f[5]) {
          var a = V(f[5][0], f[5][1], 0), b = V(f[2], f[3], 0);
          var mid = a.clone().lerp(b, 0.5).add(V(0.1, 0, -0.1));
          add(vtube(new THREE.CatmullRomCurve3([a, mid, b]), function (t) { return 0.15 - 0.04 * Math.sin(Math.PI * t); }, 16, 10), C('fibroid', { color: 0xd8b8ae }));
        }
        lbl.push({ t: 'FIGO ' + f[0], p: [S * (f[2] + (f[2] < 0 ? -r * 0.7 : r * 0.7)), S * (f[3] + r * 0.55), S * 0.02] });
      });
      lbl.push({ t: 'Cervix', p: [S * 0.85, S * -1.6, S * 0.02] });
      if (st.en) lbl.push({ t: 'Endometrium', p: [S * -1.12, S * 3.3, S * 0.02] });
      if (st.my) lbl.push({ t: 'Myometrium', p: [S * -1.75, S * 2.05, S * 0.02] });
      if (st.sr) lbl.push({ t: 'Serosa', p: [S * -2.0, S * 4.75, S * 0.02] });

      var defs = '<li>FIGO 0: pedunculated, intracavitary. FIGO 1: submucosal, &lt;50% intramural. FIGO 2: submucosal, ≥50% intramural.</li><li>FIGO 3: intramural, touches the endometrium. FIGO 4: intramural, no contact. FIGO 5: subserosal, ≥50% intramural. FIGO 6: subserosal, &lt;50% intramural. FIGO 7: pedunculated subserosal.</li>';
      var infos = {
        all: '<ul><li>FIGO classification by position relative to the endometrial cavity and serosa: <b>0-2 submucosal, 3-4 intramural, 5-7 subserosal</b> (8 = other, e.g. cervical).</li>' + defs + '<li>Coronal cutaway (front half removed) showing the layers: serosa (outer), myometrium, endometrium lining the triangular cavity. Fibroids show their whorled cut surface. Toggle layers to look inside.</li></ul>',
        sub: '<ul><li><b>Submucosal</b> fibroids distort the cavity: heavy menstrual bleeding, anemia, infertility, recurrent pregnancy loss.</li><li>Hysteroscopic resection is an option for types 0-2 (as selected).</li>' + defs + '</ul>',
        int: '<ul><li><b>Intramural</b> fibroids enlarge the uterus: bulk symptoms, heavy or prolonged bleeding, pain.</li><li>Type 3 touches the endometrium and can behave like a submucosal lesion.</li>' + defs + '</ul>',
        ser: '<ul><li><b>Subserosal</b> fibroids bulge outward: pelvic pressure, urinary frequency (bladder), constipation; less often abnormal bleeding.</li><li>A pedunculated one (FIGO 7) can <b>torse</b>, causing acute pain. Red degeneration is more common in pregnancy.</li>' + defs + '</ul>',
      };
      return {
        labels: lbl,
        info: infos[st.sh],
        update: function () { U.updateWorldMatrix(true, false); wcut.copy(cut).applyMatrix4(U.matrixWorld); },
      };
    },
  });
})();
