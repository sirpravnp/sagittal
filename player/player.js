/* Sagittal figure player. Classic script: sets window.SagittalPlayer. Needs THREE, KitLabels, Kit,
 * SagittalOrgans (organs/organs.js), SagittalUI (player/ui.js, renders the info panel) and the meshes of the listed organs (organs/meshes/<id>.js),
 * loaded before register() (it reads their part bounding boxes).
 *
 *   SagittalPlayer.register(resolved, opts?) -> the SceneDef it registers as Kit scene 'figure'
 *
 * `resolved` is SagittalSpec.validate(spec, SagittalOrgans).resolved (never an invalid spec).
 * opts: { organs (default window.SagittalOrgans), credits (site/meshes/credits.json; default
 * window.SagittalCredits), id (default 'figure'), orientEl (an element on the stage that the
 * player keeps filled with where the viewer stands, e.g. "Posterior view · patient's right on
 * screen right", updated as the user rotates), aspect (stage width / height: a narrow stage
 * steps the camera back), explicitZoom (true: keep view.zoom as given) }.
 *
 * Two views, chosen by control `v`: 'normal' (the listed organs plus `base` structures) and
 * 'variant' (with `variant.edits` applied). Organs are drawn from their baked meshes, except a part
 * one of whose centre lines the variant removes or moves: that part is drawn as tapered tubes
 * along its manifest centre lines, so the one line can go or move without the rest of the part.
 * All geometry is built in body-frame cm inside one group scaled by S; the scene centre is the
 * middle of the structures the spec is about.
 */
(function () {
  'use strict';

  var TUBULAR = { 'vessel-artery': 1, 'vessel-vein': 1, 'bile-duct': 1 };
  var THIN_CM = 0.07;         // tubular parts thinner than this are drawn only when the spec names them
  var STAGE = 5.4;            // scene units the region of interest spans at the default zoom
  var MIN_ROI_CM = 9;         // smallest region of interest (cm)
  var ZOOM = 9;
  var ROT = [0.15, 0.3];   // slightly from the patient's right

  /* ---------- small helpers ---------- */
  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  function lenOf(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; }
  function pointAt(pts, t) {
    var total = lenOf(pts);
    if (!(total > 0)) return pts[0].slice();
    var target = t * total;
    for (var i = 1; i < pts.length; i++) {
      var d = dist(pts[i - 1], pts[i]);
      if (target <= d || i === pts.length - 1) {
        var f = d > 0 ? Math.min(1, target / d) : 0, a = pts[i - 1], b = pts[i];
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      }
      target -= d;
    }
    return pts[pts.length - 1].slice();
  }
  // Drops points closer than eps to the previous kept point (zero-length Catmull-Rom spans give NaNs).
  function dedupe(pts, eps) {
    var out = [];
    pts.forEach(function (p) { if (!out.length || dist(out[out.length - 1], p) > eps) out.push(p.slice()); });
    if (out.length === 1 && pts.length > 1 && dist(pts[0], pts[pts.length - 1]) > 0) out.push(pts[pts.length - 1].slice());
    return out;
  }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

  // A moved insertion leaves one long straight stretch between the new insertion point a and the
  // first kept point b of the line. Replace it by a cubic Hermite curve that leaves a towards b and
  // arrives at b along the line's own direction (b -> c), so the line runs on smoothly. The curve
  // still passes through a and b and every original point after them.
  function smoothStart(pts) {
    if (pts.length < 3) return pts;
    var a = pts[0], b = pts[1], c = pts[2], L = dist(a, b);
    if (L < 1) return pts;
    var ta = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), tb = norm([c[0] - b[0], c[1] - b[1], c[2] - b[2]]);
    var n = Math.ceil(L / 0.5), out = [a];
    for (var i = 1; i < n; i++) {
      var s = i / n, s2 = s * s, s3 = s2 * s;
      var h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      out.push([0, 1, 2].map(function (k) { return h00 * a[k] + h10 * L * ta[k] + h01 * b[k] + h11 * L * tb[k]; }));
    }
    return out.concat(pts.slice(1));
  }
  function smoothMoved(pts, end) {
    if (end === 'to') return smoothStart(pts.slice().reverse()).reverse();
    return smoothStart(pts);
  }

  // One shader program for every material (clearcoat, no sheen), as in the library scenes.
  function T(kind, opts) { return Kit.tissue(kind, Object.assign({ sheen: 0 }, opts || {})); }
  // glow: the structure is what this view changes (see build); it glows in its own colour.
  var GLOW = 0.6;
  // The variant's second print colour. What the variant view adds or moves is not tinted from its
  // tissue colour (a clay tint vanishes on red arteries): it is printed pale and hatched in clay,
  // the way an old atlas marks the abnormal vessel, and outlined (see contour()). Pale paper with
  // clay hatching differs in value from every tissue colour (all mid or dark) in both themes.
  var PRINT_PAPER = '#f2e4cc', PRINT_INK = '#a8492a', PRINT_SOLID = 0xe7b48f;
  var hatchTex = null;
  function hatch(repeatAlong) {
    if (!hatchTex) {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var x = c.getContext('2d');
      x.fillStyle = PRINT_PAPER; x.fillRect(0, 0, 64, 64);
      x.strokeStyle = PRINT_INK; x.lineWidth = 9;
      for (var i = -64; i <= 128; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); }
      hatchTex = new THREE.CanvasTexture(c);
      hatchTex.wrapS = hatchTex.wrapT = THREE.RepeatWrapping;
      hatchTex.encoding = THREE.sRGBEncoding;
      hatchTex.anisotropy = 4;
    }
    var t = hatchTex.clone(); t.needsUpdate = true;
    t.repeat.set(Math.max(1, repeatAlong), 3);
    t.userData.kitShared = false;
    return t;
  }
  function styled(kind, st, glow, clay) {
    var o = {};
    if (st && st.color) o.color = st.color;
    if (clay) { o.color = PRINT_SOLID; glow = false; o.emissive = 0x000000; }
    if (st && st.opacity !== undefined && st.opacity < 1) { o.opacity = st.opacity; o.depthWrite = false; }
    if (glow) {
      if (!o.color) { var m = Kit.tissue(kind); o.emissive = m.color.getHex(); m.dispose(); } else o.emissive = o.color;
      o.emissiveIntensity = GLOW;
    }
    return T(kind, o);
  }

  // Tube along cm points with radius r (cm) tapering to r * rEnd, rounded caps (bil.js duct()).
  function duct(g, pts, r, rEnd, material) {
    var V3 = function (p) { return new THREE.Vector3(p[0], p[1], p[2]); };
    var curve = new THREE.CatmullRomCurve3(pts.map(V3), false, 'centripetal');
    var L = lenOf(pts), n = Math.max(12, Math.min(220, Math.round(L / 0.12))), rad = r > 0.4 ? 18 : 12;
    var geo = new THREE.TubeGeometry(curve, n, 1, rad, false);
    var pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
    for (var i = 0; i <= n; i++) {
      var t = i / n, ri = r * (1 + (rEnd - 1) * t);
      curve.getPointAt(t, c);
      for (var j = 0; j <= rad; j++) {
        var k = i * (rad + 1) + j;
        v.fromBufferAttribute(pos, k).sub(c).setLength(ri).add(c);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
    var grp = new THREE.Group();
    var me = new THREE.Mesh(geo, material); grp.add(me);
    // rounded ends; not on see-through tubes, where the caps at segment joins show as balls
    if (!material.transparent) [0, 1].forEach(function (e) {
      var cap = new THREE.Mesh(new THREE.SphereGeometry(r * (e ? rEnd : 1), rad, 8), material);
      cap.position.copy(curve.getPointAt(e)); grp.add(cap);
    });
    g.add(grp);
    return { group: grp, tube: me, geo: geo };
  }
  // An engraved contour round a tube: its geometry pushed out along the normals, back faces only,
  // flat ink in the stage's contrast colour (dark on paper, paper on the dark stage; the page sets
  // it with SagittalPlayer.setContour(css) and on theme change).
  var contourColor = null, contourMats = []; // a THREE.Color, made on first use (load needs no THREE)
  function contour(d, r) {
    var geo = d.geo.clone(), pos = geo.attributes.position, nor = geo.attributes.normal, w = Math.max(0.03, r * 0.2);
    for (var i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + nor.getX(i) * w, pos.getY(i) + nor.getY(i) * w, pos.getZ(i) + nor.getZ(i) * w);
    if (!contourColor) contourColor = new THREE.Color(0x2a1a12);
    var mat = new THREE.MeshBasicMaterial({ color: contourColor.clone(), side: THREE.BackSide });
    contourMats.push(mat);
    var m = new THREE.Mesh(geo, mat);
    m.userData.contour = true;
    d.group.add(m);
  }
  // The variant print on a tube: hatch repeated about every 0.8 cm along it.
  function printTube(d, pts) {
    var mat = d.tube.material;
    mat.map = hatch(lenOf(pts) / 0.8); mat.color.set(0xffffff); mat.needsUpdate = true;
  }

  /* ---------- the organ model: parts, which centre lines draw which part ---------- */
  function bboxOf(organId, partId) {
    var lib = window.SagittalMeshes && window.SagittalMeshes[organId];
    var p = lib && lib.parts[partId];
    return p && p.bbox ? p.bbox : null;
  }
  // Assigns each centre line of a manifest to the tubular part whose bbox holds most of its points
  // (ties: the smallest bbox). Manifests do not record which part a line was swept into.
  function lineParts(m) {
    var out = {};
    var tubParts = (m.parts || []).filter(function (p) { return TUBULAR[p.tissue]; });
    Object.keys(m.centerlines || {}).forEach(function (cid) {
      var cl = m.centerlines[cid], best = null, bestN = 0, bestV = Infinity;
      (m.parts || []).forEach(function (p) {
        var bb = bboxOf(m.mesh, p.id); if (!bb) return;
        var pad = (cl.radius_cm || 0.1) + 0.3, n = 0;
        cl.points.forEach(function (q) {
          if (q[0] >= bb[0] - pad && q[0] <= bb[3] + pad && q[1] >= bb[1] - pad && q[1] <= bb[4] + pad && q[2] >= bb[2] - pad && q[2] <= bb[5] + pad) n++;
        });
        if (!n) return;
        var vol = (bb[3] - bb[0]) * (bb[4] - bb[1]) * (bb[5] - bb[2]);
        // equal coverage: a tubular part wins (a duct inside an organ's bbox belongs to the duct),
        // then the smaller bbox
        var tub = tubParts.indexOf(p) >= 0, bestTub = !!(best && TUBULAR[best.tissue]);
        if (n > bestN || (n === bestN && (tub && !bestTub || (tub === bestTub && vol < bestV)))) { best = p; bestN = n; bestV = vol; }
      });
      if (best && bestN >= Math.ceil(cl.points.length / 2)) out[cid] = best.id;
    });
    return out;
  }

  /* ---------- register ---------- */
  function register(R, opts) {
    opts = opts || {};
    var organs = opts.organs || window.SagittalOrgans;
    var credits = opts.credits || window.SagittalCredits || null;
    var sceneId = opts.id || 'figure';
    var M = organs.manifests;
    var listed = R.organs.map(function (o) { return o.id; });
    var orgStyle = {};
    R.organs.forEach(function (o) { orgStyle[o.id] = o.parts || {}; });
    function partStyle(organId, partId) {
      var p = orgStyle[organId] || {};
      return Object.assign({}, p['*'] || {}, p[partId] || {});
    }
    function libName(ref) {
      var i = ref.indexOf('/'), m = M[ref.slice(0, i)], id = ref.slice(i + 1);
      if (!m) return ref;
      if (has(m.centerlines, id)) return m.centerlines[id].name;
      for (var k = 0; k < (m.parts || []).length; k++) if (m.parts[k].id === id) return m.parts[k].name;
      if (has(m.landmarks, id)) return m.landmarks[id].name;
      return ref;
    }

    // Variant edits by kind.
    var edits = (R.variant && R.variant.edits) || [];
    var removed = {}, moved = {}, variantRoutes = [];
    edits.forEach(function (e) {
      if (e.op === 'remove') removed[e.structure] = true;
      else if (e.op === 'move_insertion') moved[e.structure] = e;
      else variantRoutes.push(e);
    });
    var baseRoutes = R.base || [];
    // Library structures the spec names anywhere: labels, edits, waypoints, explicit part styles.
    var named = {};
    (R.labels || []).forEach(function (l) { named[l.on] = true; });
    edits.forEach(function (e) { if (e.structure) named[e.structure] = true; });
    baseRoutes.concat(variantRoutes, edits).forEach(function (e) {
      [e.from, e.to].concat(e.via || []).forEach(function (w) { if (w && w.on) named[w.on] = true; });
    });
    R.organs.forEach(function (o) { Object.keys(o.parts || {}).forEach(function (k) { if (k !== '*') named[o.id + '/' + k] = true; }); });

    // Per organ: which parts are drawn as tubes, and which lines each such part has. A part is
    // drawn from its baked mesh unless the variant removes or moves one of its lines; then the
    // whole part is drawn as tubes, one per line, so that line alone can go or move.
    var model = {};
    listed.forEach(function (oid) {
      var m = M[oid], lp = lineParts(m), tubeParts = {}, linesOf = {};
      Object.keys(lp).forEach(function (cid) { (linesOf[lp[cid]] = linesOf[lp[cid]] || []).push(cid); });
      (m.parts || []).forEach(function (p) {
        var lines = linesOf[p.id] || [];
        var edited = lines.some(function (c) { return removed[oid + '/' + c] || moved[oid + '/' + c]; });
        if (lines.length && edited) tubeParts[p.id] = lines;
      });
      // Hair-thin tubular parts (every line under THIN_CM, e.g. the pancreatic ducts with their
      // side-branch stubs) are left out unless the spec names the part or one of its lines.
      var thin = {};
      (m.parts || []).forEach(function (p) {
        var lines = linesOf[p.id] || [];
        if (!TUBULAR[p.tissue] || !lines.length) return;
        var r = Math.max.apply(null, lines.map(function (c) { return m.centerlines[c].radius_cm || 0; }));
        var isNamed = named[oid + '/' + p.id] || lines.some(function (c) { return named[oid + '/' + c]; });
        if (r < THIN_CM && !isNamed) thin[p.id] = true;
      });
      model[oid] = { m: m, lineParts: lp, tubeParts: tubeParts, thin: thin };
    });

    // Region of interest: every structure the spec draws or changes, besides whole organs.
    function roi() {
      var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      function addP(p) { for (var k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } }
      function addRef(ref) {
        var i = ref.indexOf('/');
        if (i < 0) return;
        var m = M[ref.slice(0, i)], id = ref.slice(i + 1);
        if (!m) return;
        if (has(m.centerlines, id)) m.centerlines[id].points.forEach(addP);
        else if (has(m.landmarks, id)) addP(m.landmarks[id].p);
        else { var bb = bboxOf(m.mesh, id); if (bb) { addP(bb.slice(0, 3)); addP(bb.slice(3)); } }
      }
      // What changes defines the region; labels only when nothing changes geometry (a labelled
      // library line such as the SMA can be 20 cm long and would shrink the figure).
      baseRoutes.concat(variantRoutes).forEach(function (e) { (e.points || []).forEach(addP); });
      edits.forEach(function (e) { if (e.op === 'remove' || e.op === 'move_insertion') { addRef(e.structure); (e.points || []).forEach(addP); } });
      if (!isFinite(lo[0])) (R.labels || []).forEach(function (l) { addRef(l.on); });
      if (!isFinite(lo[0])) { // nothing but organs: their bboxes
        listed.forEach(function (oid) { (M[oid].parts || []).forEach(function (p) { addRef(oid + '/' + p.id); }); });
      }
      if (!isFinite(lo[0])) { lo = [0, 0, 0]; hi = [0, 0, 0]; }
      var c = [0, 1, 2].map(function (k) { return (lo[k] + hi[k]) / 2; });
      var ext = Math.max(MIN_ROI_CM, hi[0] - lo[0], hi[1] - lo[1], (hi[2] - lo[2]) * 0.8);
      return { c: c, ext: ext };
    }
    var region = roi();
    var S = Math.max(0.06, Math.min(0.45, STAGE / region.ext));
    function sc(p) { return [p[0] * S, p[1] * S, p[2] * S]; }

    var orgKey = {};
    listed.forEach(function (oid) { orgKey[oid] = 'o_' + oid.replace(/[^a-z0-9]/g, '_'); });
    var controls = [R.variant
      ? { k: 'v', label: 'View', def: 'variant', opts: [['normal', 'Normal anatomy'], ['variant', R.variant.label]] }
      : { k: 'v', label: 'View', def: 'normal', opts: [['normal', 'Normal anatomy']] }];
    listed.forEach(function (oid) { controls.push({ k: orgKey[oid], label: M[oid].name, type: 'chk', def: true }); });

    var meshIds = [];
    listed.forEach(function (oid) { var mid = M[oid].mesh; if (meshIds.indexOf(mid) < 0) meshIds.push(mid); });

    var last = { view: null, drawn: [] };

    function build(g, st) {
      var view = st.v === 'normal' ? 'normal' : 'variant';
      var variant = view === 'variant';
      var body = new THREE.Group(); body.scale.setScalar(S); g.add(body);
      var objs = {};    // structure ref or route id -> THREE.Object3D (tube group or mesh)
      var lines = {};   // ref/id -> drawn points (cm), for label anchors
      var drawn = [];
      // What this view changes glows: in the variant, new and moved structures; in the normal
      // view, the structures the variant removes or moves.
      function glows(ref) { return variant ? !!moved[ref] : !!(removed[ref] || moved[ref]); }
      var hot = {}; // ref/id -> drawn as changed by the variant (variant view only): print, contour, clay label
      contourMats = [];

      // 1. Organs.
      listed.forEach(function (oid) {
        if (!st[orgKey[oid]]) return;
        var mo = model[oid], m = mo.m;
        (m.parts || []).forEach(function (p) {
          var ref = oid + '/' + p.id, style = partStyle(oid, p.id);
          if (style.visible === false || mo.thin[p.id]) return;
          if (variant && removed[ref]) return;
          var tubeLines = mo.tubeParts[p.id];
          if (!tubeLines) {
            var g0 = glows(ref); if (variant && g0) hot[ref] = true;
            var mesh = Kit.meshPart(body, m.mesh, p.id, styled(p.tissue, style, g0, variant && g0));
            objs[ref] = mesh; drawn.push(ref);
            return;
          }
          var pg = new THREE.Group(); body.add(pg); objs[ref] = pg; drawn.push(ref);
          var kind = p.tissue;
          tubeLines.forEach(function (cid) {
            var lref = oid + '/' + cid, cl = m.centerlines[cid];
            if (variant && removed[lref]) return;
            var pts = cl.points;
            if (variant && moved[lref] && moved[lref].points) pts = smoothMoved(moved[lref].points, moved[lref].end);
            pts = dedupe(pts, 0.02);
            if (pts.length < 2) return;
            var r = cl.radius_cm || 0.1;
            var g1 = glows(lref) || glows(ref); if (variant && g1) hot[lref] = true;
            var d = duct(pg, pts, r, cl.parent ? 0.85 : 0.9, styled(kind, style, g1, variant && g1));
            if (variant && g1) { printTube(d, pts); contour(d, r); }
            objs[lref] = d.group; lines[lref] = pts; drawn.push(lref);
          });
        });
      });

      // 2. Routed structures: base (both views), then variant-only ones.
      function drawRoute(e, isBase) {
        if (isBase && variant && removed[e.id]) return;
        var pts = e.points;
        if (isBase && variant && moved[e.id] && moved[e.id].points) pts = smoothMoved(moved[e.id].points, moved[e.id].end);
        pts = dedupe(pts, 0.02);
        if (pts.length < 2) return;
        var g2 = isBase ? glows(e.id) : true, h2 = variant && g2;
        if (h2) hot[e.id] = true;
        // a structure the variant adds or moves is drawn a little heavier, printed and outlined
        var d = duct(body, pts, e.radius_cm * (h2 ? 1.12 : 1), 1, styled(e.tissue, null, g2, h2));
        if (h2) { printTube(d, pts); contour(d, e.radius_cm); }
        objs[e.id] = d.group; lines[e.id] = pts; drawn.push(e.id);
      }
      baseRoutes.forEach(function (e) { drawRoute(e, true); });
      if (variant) variantRoutes.forEach(function (e) { drawRoute(e, false); });

      // 3. Labels for this view, anchored on what they name. First find each label's target:
      // a line (points, cm) or a single point, and the object its dot goes on.
      var targets = [], dropped = [];
      (R.labels || []).forEach(function (l) {
        if ((l.views || ['normal', 'variant']).indexOf(view) < 0) return;
        var ref = l.on, slash = ref.indexOf('/'), tg = { l: l, line: null, p: null, on: null };
        if (lines[ref]) { tg.line = lines[ref]; tg.on = objs[ref]; }
        else if (slash >= 0) {
          var oid = ref.slice(0, slash), id = ref.slice(slash + 1), mo = model[oid];
          if (mo && !st[orgKey[oid]]) return; // its organ is switched off: not an error
          var m = mo && mo.m, partRef = m && mo.lineParts[id] ? oid + '/' + mo.lineParts[id] : null;
          // (a centre line wins over a part of the same id, e.g. the SMA: the validator resolves
          // labels the same way)
          if (m && has(m.landmarks, id)) tg.p = m.landmarks[id].p;
          else if (m && has(m.centerlines, id) && partRef && objs[partRef]) {
            // a centre line inside a part drawn from its mesh (e.g. the SMA, the oesophagus)
            tg.line = m.centerlines[id].points; tg.on = objs[partRef];
          } else if (m && objs[ref]) {
            tg.on = objs[ref];
            var bb = bboxOf(m.mesh, id);
            tg.p = bb ? [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2] : region.c;
          }
        }
        if (!tg.line && !tg.p) { dropped.push(l.text); return; }
        targets.push(tg);
      });
      // Each line label is anchored at the point of its own line, inside the figure's region, that
      // is furthest from every other labelled structure and from anchors already chosen, so dots
      // do not pile up at the junction the figure is about.
      // A library line that a spec structure drawn in this view branches from (e.g. the SMA giving
      // off a replaced hepatic artery) is anchored on its stretch just past that takeoff, so its
      // label sits where the figure's point is made.
      var chosen = [];
      targets.forEach(function (tg, i) {
        if (!tg.line) { chosen.push(tg.p); return; }
        var others = [];
        targets.forEach(function (o, j) { if (j !== i) others.push(o.line ? densify(o.line, 0.4) : [o.p]); });
        var cands = densify(tg.line, 0.25), take = takeoff(tg.l.on, view);
        if (take !== null) {
          var near = afterTakeoff(tg.line, take);
          if (near.length) cands = near;
        }
        tg.p = spreadAnchor(cands, others, chosen, region);
        chosen.push(tg.p);
      });
      var labels = targets.map(function (tg) {
        var lab = { t: tg.l.text, p: sc(tg.p) };
        if (tg.on) lab.on = tg.on;
        if (hot[tg.l.on]) lab.cls = 'is-variant';
        return lab;
      });
      if (dropped.length && window.console) {
        console.warn('Sagittal figure: not drawn in the ' + view + ' view, so not labelled: ' + dropped.join('; '));
      }

      last = { view: view, drawn: drawn, labels: labels.map(function (l) { return l.t; }), dropped: dropped,
        changed: labels.filter(function (l) { return l.cls; }).map(function (l) { return l.t; }) };
      return { labels: labels, info: infoHtml(view), update: orientUpdate(g) };
    }

    // t on library line `ref` where a structure drawn in `view` leaves it (a branch's `from`), or null.
    function takeoff(ref, view) {
      if (ref.indexOf('/') < 0) return null;
      var list = baseRoutes.concat(view === 'variant' ? variantRoutes : []);
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (view === 'variant' && removed[e.id]) continue;
        if (e.from && e.from.on === ref) return e.from.t;
      }
      return null;
    }
    // Points of a line from 0.4 to 2.4 cm past fraction t of its length.
    function afterTakeoff(pts, t) {
      var dense = densify(pts, 0.2), total = lenOf(pts), s0 = t * total, acc = 0, out = [];
      for (var i = 1; i < dense.length; i++) {
        acc += dist(dense[i - 1], dense[i]);
        if (acc >= s0 + 0.4 && acc <= s0 + 2.4) out.push(dense[i]);
      }
      return out;
    }

    // The orientation cue follows the model's rotation (the group's parent is the viewer's root).
    function orientUpdate(g) {
      var el = opts.orientEl || null, shown = '';
      return function () {
        var root = g.parent;
        if (!root) return;
        var o = orientation([root.rotation.x, root.rotation.y]);
        last.orientation = o.text;
        if (el && o.text !== shown) { el.textContent = o.text; shown = o.text; }
      };
    }

    /* ---------- info panel (player/ui.js renders it) ---------- */
    function infoHtml() {
      return window.SagittalUI ? window.SagittalUI.infoHtml({ spec: R, references: organs.references || {}, name: libName, credit: creditLine() }) : '';
    }
    function creditLine() {
      if (!credits) return '';
      var src = credits.sources || {}, ids = [];
      listed.forEach(function (oid) { var c = M[oid].credit; if (c && src[c] && ids.indexOf(c) < 0) ids.push(c); });
      if (!ids.length) return '';
      return '3D models: ' + ids.map(function (c) { return src[c].text + ', ' + src[c].licence; }).join('; ') + '. ' + (credits.changes || '');
    }

    var baseZoom = R.view && R.view.zoom ? R.view.zoom : ZOOM;
    var def = {
      id: sceneId,
      meshes: meshIds,
      center: sc(region.c),
      // The spec's view.zoom (or the default) frames a wide stage and is refitted to the stage's
      // aspect; a zoom the page asks for explicitly (opts.explicitZoom, e.g. ?zoom= from
      // look-figure) is kept as given. fitBase: what the page refits from on resize.
      zoom: opts.explicitZoom ? baseZoom : fitZoom(baseZoom, opts.aspect),
      fitBase: opts.explicitZoom ? null : baseZoom,
      rot: R.view && R.view.rot ? R.view.rot.slice() : ROT.slice(),
      controls: controls,
      build: build,
    };
    Kit.register(def);
    api.debug = function () {
      return last.view ? { view: last.view, drawn: last.drawn.slice(), labels: last.labels.slice(), dropped: last.dropped.slice(),
        orientation: last.orientation || orientation(def.rot).text, scale: S, changed: (last.changed || []).slice(), zoom: def.zoom } : null;
    };
    return def;
  }

  // A figure is framed for a wide stage; on a narrow (portrait) one the camera steps back so the
  // region of interest still fits across (opts.aspect = stage width / height). Kit clamps at 16.
  function fitZoom(z, aspect) {
    if (!(aspect > 0) || aspect >= 1.25) return z;
    return Math.min(16, z * Math.min(1.7, Math.pow(1.25 / aspect, 0.85)));
  }

  /* ---------- orientation ---------- */
  // Where the viewer stands relative to the patient, for a model turned by Euler [x, y] (the
  // kit's root rotation; camera on +z). The direction to the camera in body coordinates is
  // Ry(y)^T Rx(x)^T (0,0,1) = (-sin y cos x, sin x, cos y cos x); screen right is (cos y, 0, sin y).
  function orientation(rot) {
    var a = rot[0], b = rot[1];
    var v = [-Math.sin(b) * Math.cos(a), Math.sin(a), Math.cos(b) * Math.cos(a)];
    var side = v[0] > 0 ? 'Left' : 'Right', face = v[2] > 0 ? 'anterior' : 'posterior';
    var ax = Math.abs(v[0]), ay = Math.abs(v[1]), az = Math.abs(v[2]), OBL = 0.38, name;
    if (ay > Math.max(ax, az)) name = v[1] > 0 ? 'Superior view (from above)' : 'Inferior view (from below)';
    else {
      if (ax > OBL && az > OBL) name = side + ' ' + face + ' oblique view';
      else if (az >= ax) name = face === 'anterior' ? 'Anterior view' : 'Posterior view';
      else name = side + ' lateral view';
      if (ay > OBL) name += v[1] > 0 ? ', from above' : ', from below';
    }
    var sx = Math.cos(b), rightOn = sx > 0.3 ? 'left' : sx < -0.3 ? 'right' : null;
    return { name: name, rightOn: rightOn,
      text: name + (rightOn ? ' · patient’s right on screen ' + rightOn : '') };
  }

  // Points every `step` cm along a polyline (keeps the original vertices).
  function densify(pts, step) {
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(dist(a, b) / step));
      for (var k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, a[2] + (b[2] - a[2]) * k / n]);
    }
    return out;
  }
  // The candidate furthest (capped at 3 cm) from the other labelled structures and the anchors
  // already chosen, preferring points inside the region and near its centre on ties.
  function spreadAnchor(cands, others, chosen, region) {
    var half = region.ext * 0.45, c = region.c;
    var inside = cands.filter(function (p) { return Math.abs(p[0] - c[0]) < half && Math.abs(p[1] - c[1]) < half && Math.abs(p[2] - c[2]) < half; });
    if (!inside.length) inside = cands;
    var best = inside[0], bs = -Infinity;
    inside.forEach(function (p) {
      var d = 3;
      others.forEach(function (o) { o.forEach(function (q) { d = Math.min(d, dist(p, q)); }); });
      chosen.forEach(function (q) { d = Math.min(d, dist(p, q)); });
      var s = d - 0.05 * dist(p, c);
      if (s > bs) { bs = s; best = p; }
    });
    return best;
  }

  var api = {
    register: register,
    orientation: orientation,
    fitZoom: fitZoom,
    // What the most recent build of the most recently registered figure drew:
    // { view, drawn: [structure refs and route ids], labels: [texts], dropped: [label texts not
    // drawn], orientation, scale } (null before any build).
    debug: function () { return null; },
    // Contour colour for what the variant marks (a CSS colour); recolours the current figure.
    // The caller redraws (e.g. viewer.setBackground on a theme change).
    setContour: function (css) {
      var c = String(css || '').trim();
      if (!c) return;
      try { contourColor = new THREE.Color(c); } catch (e) { return; }
      contourMats.forEach(function (m) { m.color.copy(contourColor); });
    },
  };
  window.SagittalPlayer = api;
})();
