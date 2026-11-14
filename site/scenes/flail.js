// Flail chest, built on the baked Z-Anatomy thorax (real ribs, cartilages, sternum, spine) and
// chest (lungs, heart, great vessels, airway, diaphragm) meshes. The left 4th-7th ribs are each
// broken in two places by splitting the real rib geometry: the piece between the fractures is
// a free-floating segment that moves against the rest of the chest wall while breathing.
// The pulmonary contusion is painted onto the left lung beneath the segment (vertex colours).
(function () {
  var S = 0.12;                  // cm -> scene units
  var Z0 = -1;                   // the chest's breathing axis runs vertically through x = 0, z = Z0 (cm)
  var FLAIL_RIBS = [3, 4, 5, 6]; // 0-based, top to bottom: the 4th-7th ribs
  var FRACT = [-8, 32];          // fracture lines, degrees around the axis (0 = lateral, 90 = anterior)
  var GAP = 2.2;                 // half-width of each fracture gap (degrees)
  var D = Math.PI / 180;
  var cache = null;              // split geometries, built once per page

  function srcGeo(mesh, part) {
    var me = Kit.meshPart(new THREE.Group(), mesh, part, new THREE.MeshBasicMaterial());
    me.material.dispose();
    return me.geometry;
  }
  function shared(geo) { geo.userData = { kitShared: true }; geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo; }
  function angle(x, z) { return Math.atan2(z - Z0, x) / D; }

  // Splits ribs_left into static ribs, the flail segment and the fracture sites, using the
  // connected components of the mesh (one per rib) sorted from top to bottom.
  function split() {
    var src = srcGeo('thorax', 'ribs_left'), p = src.attributes.position.array, ix = src.index.array;
    var n = p.length / 3, par = new Int32Array(n), i, t;
    for (i = 0; i < n; i++) par[i] = i;
    var find = function (a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    for (t = 0; t < ix.length; t += 3) {
      var r0 = find(ix[t]); par[find(ix[t + 1])] = r0; par[find(ix[t + 2])] = r0;
    }
    var comps = {};
    for (i = 0; i < n; i++) {
      var r = find(i); comps[r] = comps[r] || { root: r, n: 0, y: 0 };
      comps[r].n++; comps[r].y += p[i * 3 + 1];
    }
    var ribs = Object.keys(comps).map(function (k) { return comps[k]; })
      .filter(function (c) { return c.n > 40; })
      .sort(function (a, b) { return b.y / b.n - a.y / a.n; });
    var flailRoots = {};
    FLAIL_RIBS.forEach(function (k) { if (ribs[k]) flailRoots[ribs[k].root] = true; });

    var keep = [], seg = [], sites = {}, fc = [0, 0, 0], fn = 0, ext = [1e9, -1e9, 0];
    for (t = 0; t < ix.length; t += 3) {
      var a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      var root = find(ix[t]);
      if (!flailRoots[root]) { keep.push(ix[t], ix[t + 1], ix[t + 2]); continue; }
      var cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3, cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
      var th = angle(cx, cz), gap = -1;
      for (var f = 0; f < FRACT.length; f++) if (Math.abs(th - FRACT[f]) <= GAP) gap = f;
      if (gap >= 0) {
        var key = root + ':' + gap, s = sites[key] = sites[key] || { p: [0, 0, 0], n: 0, fr: gap };
        s.p[0] += cx; s.p[1] += cy; s.p[2] += cz; s.n++;
      } else if (th > FRACT[0] && th < FRACT[1]) {
        seg.push(ix[t], ix[t + 1], ix[t + 2]); fc[0] += cx; fc[1] += cy; fc[2] += cz; fn++;
        ext[0] = Math.min(ext[0], cy); ext[1] = Math.max(ext[1], cy); ext[2] += Math.hypot(cx, cz - Z0);
      } else keep.push(ix[t], ix[t + 1], ix[t + 2]);
    }
    var mk = function (index) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position); g.setIndex(index);
      return shared(g);
    };
    return {
      ribs: mk(keep), flail: mk(seg),
      centre: fc.map(function (v) { return v / Math.max(1, fn); }),
      ymin: ext[0], ymax: ext[1], radius: ext[2] / Math.max(1, fn),
      sites: Object.keys(sites).map(function (k) { var s = sites[k]; return { p: s.p.map(function (v) { return v / s.n; }), fr: s.fr }; }),
    };
  }

  function smooth(e0, e1, x) { var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
  // A private copy of the left lung. userData.w is how much each vertex follows the flail
  // segment (the lung surface right under it), so the lung dents in and bulges out with it.
  // With bruise, a contusion is painted on beneath the segment: dark, mottled, fading out.
  function lungGeo(C, bruise) {
    var src = srcGeo('chest', 'lung_left'), base = src.attributes.position.array, n = base.length / 3;
    var w = new Float32Array(n), i;
    for (i = 0; i < n; i++) {
      var x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2], th = angle(x, z), r = Math.hypot(x, z - Z0);
      w[i] = smooth(FRACT[0] - 7, FRACT[0] + 3, th) * (1 - smooth(FRACT[1] - 3, FRACT[1] + 7, th)) *
        smooth(C.ymin - 4, C.ymin + 1, y) * (1 - smooth(C.ymax - 1, C.ymax + 4, y)) * smooth(C.radius - 8, C.radius - 3, r);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base), 3)); g.setIndex(src.index);
    if (bruise) {
      var col = new Float32Array(n * 3), sig = 5;
      for (i = 0; i < n; i++) {
        var dx = base[i * 3] - bruise[0], dy = (base[i * 3 + 1] - bruise[1]) * 0.8, dz = base[i * 3 + 2] - bruise[2];
        var b = Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * sig * sig));
        b *= 0.8 + 0.2 * Math.sin(base[i * 3] * 1.7 + base[i * 3 + 1] * 2.3) * Math.sin(base[i * 3 + 2] * 1.9 - base[i * 3 + 1]);
        b = Math.min(1, b * 1.5);
        col[i * 3] = 1 - b * 0.5; col[i * 3 + 1] = 1 - b * 0.97; col[i * 3 + 2] = 1 - b * 0.95;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    shared(g);
    g.userData.base = base; g.userData.w = w; g.userData.d = null;
    return g;
  }
  function dentLung(g, out, d) {
    if (g.userData.d === d) return;
    var p = g.attributes.position.array, base = g.userData.base, w = g.userData.w;
    for (var i = 0; i < w.length; i++) {
      p[i * 3] = base[i * 3] + out.x * d * w[i];
      p[i * 3 + 1] = base[i * 3 + 1];
      p[i * 3 + 2] = base[i * 3 + 2] + out.z * d * w[i];
    }
    g.attributes.position.needsUpdate = true;
    g.computeVertexNormals();
    g.userData.d = d;
  }

  function P(v) { return [v[0] * S, v[1] * S, v[2] * S]; }

  Kit.register({
    id: 'flail',
    meshes: ['thorax', 'chest'],
    center: [0.5, 0.3, 0.2],
    zoom: 7.8,
    rot: [-0.12, -0.95],
    controls: [
      { k: 'ph', label: 'Breathing phase', def: 'anim', opts: [['anim', 'Animate'], ['insp', 'Inspiration'], ['exp', 'Expiration']] },
      { k: 'c', label: 'Show pulmonary contusion', def: true, type: 'chk' },
    ],
    build: function (g, st) {
      if (!cache) cache = split();
      var C = cache;
      var mid = (FRACT[0] + FRACT[1]) / 2 * D, out = new THREE.Vector3(Math.cos(mid), 0, Math.sin(mid));
      // Lung tissue just beneath the segment: the centre of the segment, moved 2.5 cm inwards.
      var bruise = [C.centre[0] - out.x * 2.5, C.centre[1], C.centre[2] - out.z * 2.5];
      var lkey = st.c ? 'lungC' : 'lungN';
      if (!cache[lkey]) cache[lkey] = lungGeo(C, st.c ? bruise : null);
      var lgeo = cache[lkey];

      var body = new THREE.Group(); body.scale.setScalar(S); g.add(body);
      // Everything that expands with the chest hangs off `wall`, which scales about the breathing axis.
      var wall = new THREE.Group(); wall.position.z = Z0; body.add(wall);
      var inner = new THREE.Group(); inner.position.z = -Z0; wall.add(inner);
      var flail = new THREE.Group(); body.add(flail);

      Kit.meshPart(inner, 'thorax', 'thoracic_spine', 'bone');
      Kit.meshPart(inner, 'thorax', 'thoracic_discs', Kit.tissue('cartilage', { color: 0x8fa3a8 }));
      Kit.meshPart(inner, 'thorax', 'ribs_right', 'bone');
      inner.add(new THREE.Mesh(C.ribs, Kit.tissue('bone')));
      Kit.meshPart(inner, 'thorax', 'costal_cartilage_left', 'cartilage');
      Kit.meshPart(inner, 'thorax', 'costal_cartilage_right', 'cartilage');
      Kit.meshPart(inner, 'thorax', 'sternum', 'bone');
      flail.add(new THREE.Mesh(C.flail, Kit.tissue('bone', { color: 0xe0c48e, emissive: 0xffa21f, emissiveIntensity: 0.32 })));
      // Fracture sites: a small haematoma at each broken end.
      var hm = Kit.tissue('blood-oxy', { color: 0x7a1414, roughness: 0.5 });
      C.sites.forEach(function (s) {
        var m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), hm);
        m.position.set(s.p[0], s.p[1], s.p[2]); m.scale.set(1, 0.8, 1); inner.add(m);
      });

      var viscera = new THREE.Group(); inner.add(viscera);
      Kit.meshPart(viscera, 'chest', 'lung_right', 'lung');
      viscera.add(new THREE.Mesh(lgeo, Kit.tissue('lung', st.c ? { vertexColors: true } : {})));
      Kit.meshPart(viscera, 'chest', 'heart', 'myocardium');
      Kit.meshPart(viscera, 'chest', 'aorta', 'vessel-artery');
      Kit.meshPart(viscera, 'chest', 'pulmonary_arteries', Kit.tissue('vessel-vein', { color: 0x4a6fc0 }));
      Kit.meshPart(viscera, 'chest', 'great_veins', 'vessel-vein');
      Kit.meshPart(viscera, 'chest', 'airway', Kit.tissue('cartilage', { color: 0xc9d6dc }));
      var dia = Kit.meshPart(body, 'chest', 'diaphragm', Kit.tissue('muscle', { color: 0x8f4a42 }));

      // The breathing phase also sets the label: the segment moves paradoxically.
      var flailText = st.ph === 'insp' ? 'Flail segment: sucked inward (paradoxical)'
        : st.ph === 'exp' ? 'Flail segment: pushed outward (paradoxical)'
        : 'Flail segment (paradoxical motion)';
      var site = C.sites.filter(function (s) { return s.fr === 0; }).sort(function (a, b) { return b.p[1] - a.p[1]; })[1] || C.sites[0];
      var L = [
        { t: flailText, p: P([C.centre[0] + out.x * 3, C.centre[1] + 2, C.centre[2] + out.z * 3]) },
        { t: 'Fracture sites', p: P([site.p[0] + 0.8, site.p[1], site.p[2] - 0.5]) },
        { t: 'Sternum', p: P([0, 13, 9.5]) },
      ];
      if (st.c) L.push({ t: 'Pulmonary contusion', p: P([bruise[0] + out.x * 1.5, bruise[1] - 6.5, bruise[2] + out.z * 1.5 + 1]) });

      var update = function (t) {
        var s = st.ph === 'insp' ? 1 : st.ph === 'exp' ? -1 : Math.sin(t * 1.6);
        wall.scale.set(1 + 0.05 * s, 1 + 0.01 * s, 1 + 0.05 * s);   // the chest wall expands on inspiration
        viscera.scale.y = 1 + 0.02 * s;
        dia.position.y = -1.2 * s;                                 // the diaphragm descends
        flail.position.copy(out).multiplyScalar(-2.0 * s);         // the free segment goes the other way
        dentLung(lgeo, out, Math.round((s > 0 ? -2.6 : -1.1) * s * 50) / 50); // the lung under it follows (stays inside)
      };
      var info = '<ul><li><b>Flail chest</b>: ≥3 adjacent ribs each fractured in ≥2 places, producing a free-floating segment.</li><li><b>Paradoxical motion</b>: the segment moves inward on inspiration and outward on expiration (watch the loose ribs against the rest of the thorax).</li><li>Hypoxia is driven mainly by the underlying <b>pulmonary contusion</b> and pain-limited breathing, not the paradoxical motion itself.</li><li>Management: oxygen, analgesia (including regional blocks), judicious fluids; ventilatory support if failing; rib fixation in selected patients.</li></ul>';
      return { labels: L, info: info, update: update };
    },
  });
})();
