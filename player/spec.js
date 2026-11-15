/* Sagittal figure spec validator (schema sagittal-figure/1). Classic script: sets window.SagittalSpec,
 * and module.exports when present. The format is documented for Claude in docs/spec.md.
 *
 *   SagittalSpec.validate(spec, organs) -> { ok, errors: string[], resolved }
 *
 * `organs` is window.SagittalOrgans ({ index, manifests, references }, organs/organs.js). Placement is
 * only ever through library landmarks, centre-line points (t along a named centre line) or one of
 * those plus a bounded offset; raw coordinates are refused anywhere in the spec. When the spec is
 * valid, `resolved` is a copy of it with every waypoint given its point `p` in body-frame cm
 * (+x patient left, +y superior, +z anterior), every routed structure given `points`, every label
 * given explicit `views`, plus `provenance`. When it is not, `resolved` is null.
 */
(function () {
  'use strict';

  var SCHEMA = 'sagittal-figure/1';
  var LIMITS = {
    organs: 12, base: 20, edits: 20, via: 12, labels: 20, claims: 12,
    title: 80, topic: 40, name: 60, label: 60, claim: 300,
    offsetCm: 3, radiusCm: 1.5, zoom: [3, 16],
    turnDeg: 90, hairpinCm: 1.5,   // a routed path may not turn more than turnDeg next to a stretch shorter than hairpinCm
  };
  var DIRS = {
    anterior: [0, 0, 1], posterior: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0],
    superior: [0, 1, 0], inferior: [0, -1, 0],
  };
  var DIR_NAMES = Object.keys(DIRS);
  // Kit.tissue presets that make sense for a routed tube.
  var TISSUES = ['vessel-artery', 'vessel-vein', 'bile-duct', 'bowel', 'pancreas', 'nerve', 'lung', 'air', 'highlight'];
  var OPS = ['remove', 'route', 'branch', 'move_insertion', 'duplicate'];
  var VIEWS = ['normal', 'variant'];
  var ID_RE = /^[a-z][a-z0-9_]*$/;
  var COLOR_RE = /^#[0-9a-fA-F]{6}$/;

  var MSG = {
    raw: 'raw coordinates are not allowed; use a landmark, a centre-line point or an offset',
    waypoint: 'a waypoint must be {"landmark"} or {"on", "t"}, with an optional "offset"',
    branchFrom: 'a branch must start on a centre line ({"on", "t"} with no offset)',
    insertion: 'an insertion must be a centre-line point ({"on", "t"} with no offset)',
    views: 'must be a non-empty list of "normal" and "variant"',
    rot: 'must be two numbers [x, y] in radians',
    noRefs: 'a claim needs at least one reference',
    refsList: 'must be a list of reference ids',
  };

  var KEYS = {
    spec: ['schema', 'title', 'topic', 'organs', 'base', 'variant', 'labels', 'claims', 'view'],
    organ: ['id', 'parts'],
    style: ['opacity', 'color', 'visible'],
    variant: ['label', 'edits'],
    route: ['op', 'id', 'name', 'tissue', 'radius_cm', 'from', 'via', 'to'],
    duplicate: ['op', 'structure', 'id', 'name', 'tissue', 'radius_cm', 'from', 'via', 'to'],
    remove: ['op', 'structure'],
    move_insertion: ['op', 'structure', 'to'],
    label: ['text', 'on', 'views'],
    claim: ['text', 'refs'],
    view: ['rot', 'zoom'],
    offset: ['dir', 'cm'],
  };

  /* ---------- small helpers ---------- */

  function has(o, k) { return o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k); }
  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function show(v) { return v === undefined ? 'nothing' : JSON.stringify(v); }
  function isRaw(v) { return Array.isArray(v) && v.length === 3 && v.every(isNum); }
  function key(base, k) { return base ? base + '.' + k : k; }
  function idx(base, i) { return base + '[' + i + ']'; }
  function q(s) { return '"' + s + '"'; }

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dist(a, b) { var d = sub(a, b); return Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]); }

  // Point at fraction t (0..1) of the polyline's arc length; t = 0 is its first point.
  function pointAt(points, t) {
    var lens = [], total = 0, i;
    for (i = 0; i + 1 < points.length; i++) { lens.push(dist(points[i], points[i + 1])); total += lens[i]; }
    if (!(total > 0)) return points[0].slice();
    var target = t * total;
    for (i = 0; i < lens.length; i++) {
      if (target <= lens[i] || i === lens.length - 1) {
        var f = lens[i] > 0 ? Math.min(1, target / lens[i]) : 0, a = points[i], b = points[i + 1];
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
      }
      target -= lens[i];
    }
    return points[points.length - 1].slice();
  }

  /* ---------- the validator ---------- */

  function validate(spec, organs) {
    if (!organs || !isObj(organs.manifests) || !isObj(organs.references)) {
      throw new TypeError('SagittalSpec.validate: organs must be window.SagittalOrgans');
    }
    var manifests = organs.manifests, references = organs.references;
    var errors = [], seenErr = Object.create(null);
    function err(path, msg) {
      var s = (path || 'spec') + ': ' + msg;
      if (!seenErr[s]) { seenErr[s] = true; errors.push(s); }
    }
    function fail() { return { ok: false, errors: errors, resolved: null }; }

    if (!isObj(spec)) { err('spec', 'must be an object'); return fail(); }
    // Depth guard before serialising: JSON.stringify overflows the stack on very deep input in some
    // engines, which would turn "too deep" into a misleading "not plain JSON". Iterative, so it cannot overflow.
    var stack = [[spec, 0]], visited = 0;
    while (stack.length) {
      var top = stack.pop(), node = top[0], dep = top[1];
      if (dep > 12) { err('spec', 'is nested too deeply'); return fail(); }
      if (++visited > 200000) break;
      if (node && typeof node === 'object') for (var kk in node) if (has(node, kk)) stack.push([node[kk], dep + 1]);
    }
    var R;
    try { R = JSON.parse(JSON.stringify(spec)); } catch (e) { err('spec', 'must be plain JSON'); return fail(); }

    // 1. Raw coordinates anywhere (a real spec is at most a few levels deep).
    var tooDeep = false;
    (function scan(v, path, depth) {
      if (depth > 12) { tooDeep = true; return; }
      if (isRaw(v)) { err(path, MSG.raw); return; }
      if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) scan(v[i], idx(path, i), depth + 1); return; }
      if (isObj(v)) for (var k in v) if (has(v, k)) scan(v[k], key(path, k), depth + 1);
    })(R, '', 0);
    if (tooDeep) { err('spec', 'is nested too deeply'); return fail(); }

    function checkKeys(o, path, allowed) {
      for (var k in o) if (has(o, k) && allowed.indexOf(k) < 0) err(path, 'unknown field ' + q(k));
    }
    function str(v, path, max) {
      if (typeof v !== 'string' || !v.trim() || v.length > max) {
        err(path, 'must be a non-empty string of at most ' + max + ' characters');
        return false;
      }
      return true;
    }
    // Returns the array when usable, else null (after reporting).
    function list(v, path, max, nonEmpty) {
      if (!Array.isArray(v)) { err(path, 'must be a list'); return null; }
      if (v.length > max) { err(path, 'at most ' + max + ' items (got ' + v.length + ')'); return null; }
      if (nonEmpty && v.length === 0) { err(path, 'must not be empty'); return null; }
      return v;
    }

    // Library lookups.
    function lib(organId) { return has(manifests, organId) ? manifests[organId] : null; }
    function split(ref) {
      var i = ref.indexOf('/');
      return i < 0 ? null : { organ: ref.slice(0, i), id: ref.slice(i + 1) };
    }
    function partOf(m, id) {
      for (var i = 0; i < (m.parts || []).length; i++) if (m.parts[i].id === id) return m.parts[i];
      return null;
    }
    // Library structure: { kind: 'centerline'|'part'|'landmark', ... } or { error }.
    function libRef(ref, kinds) {
      var s = split(ref);
      if (!s) return { error: 'unknown structure ' + q(ref) };
      var m = lib(s.organ);
      if (!m) return { error: 'unknown organ ' + q(s.organ) };
      var out = { organ: s.organ, id: s.id };
      if (kinds.indexOf('centerline') >= 0 && has(m.centerlines, s.id)) { out.kind = 'centerline'; out.cl = m.centerlines[s.id]; out.part = partOf(m, s.id); return out; }
      if (kinds.indexOf('part') >= 0 && partOf(m, s.id)) { out.kind = 'part'; out.part = partOf(m, s.id); return out; }
      if (kinds.indexOf('landmark') >= 0 && has(m.landmarks, s.id)) { out.kind = 'landmark'; out.lm = m.landmarks[s.id]; return out; }
      return { error: 'unknown structure ' + q(ref) };
    }

    var listed = Object.create(null);   // organ ids in spec.organs
    var routes = Object.create(null);   // route id -> { name, tissue, radius_cm, points, ends, view }
    var removed = Object.create(null);  // structure ref -> true, for every valid remove edit
    var moved = Object.create(null);    // structure ref -> { end, on, index, path } for every valid move_insertion
    var variantLines = Object.create(null); // structure ref -> its points in the variant view, once moved
    // Every waypoint `on` a line, checked once all removes and moves are known (so edit order does
    // not hide a removal): { path, on, ctx: { view: 'base'|'variant', index, role } }.
    var usages = [];
    var provenance = [];

    // 2. Top level.
    checkKeys(R, 'spec', KEYS.spec);
    if (R.schema !== SCHEMA) err('schema', 'must be ' + q(SCHEMA));
    str(R.title, 'title', LIMITS.title);
    if (has(R, 'topic')) str(R.topic, 'topic', LIMITS.topic);

    // 3. Organs.
    var orgList = list(R.organs, 'organs', LIMITS.organs, true) || [];
    orgList.forEach(function (o, i) {
      var p = idx('organs', i);
      if (!isObj(o)) { err(p, 'must be an object'); return; }
      checkKeys(o, p, KEYS.organ);
      var m = typeof o.id === 'string' ? lib(o.id) : null;
      if (!m) err(key(p, 'id'), 'unknown organ ' + show(o.id));
      else if (listed[o.id]) err(key(p, 'id'), q(o.id) + ' is listed twice');
      else listed[o.id] = true;
      if (!has(o, 'parts')) return;
      if (!isObj(o.parts)) { err(key(p, 'parts'), 'must be an object mapping part ids (or "*") to styles'); return; }
      for (var k in o.parts) {
        if (!has(o.parts, k)) continue;
        var pp = key(key(p, 'parts'), k), st = o.parts[k];
        if (m && k !== '*' && !partOf(m, k)) err(pp, 'unknown part ' + q(o.id + '/' + k));
        if (!isObj(st)) { err(pp, 'must be an object'); continue; }
        checkKeys(st, pp, KEYS.style);
        if (has(st, 'opacity') && !(isNum(st.opacity) && st.opacity >= 0 && st.opacity <= 1)) err(key(pp, 'opacity'), 'must be a number from 0 to 1 (got ' + show(st.opacity) + ')');
        if (has(st, 'color') && !(typeof st.color === 'string' && COLOR_RE.test(st.color))) err(key(pp, 'color'), 'must be a hex colour like "#c23b30" (got ' + show(st.color) + ')');
        if (has(st, 'visible') && typeof st.visible !== 'boolean') err(key(pp, 'visible'), 'must be true or false');
      }
    });

    // Waypoints. ctx = { view: 'base'|'variant', index, role: 'from'|'via'|'to' }.
    // Returns the resolved waypoint ({...wp, p}) or null.
    function waypoint(wp, path, ctx) {
      if (isRaw(wp)) { err(path, MSG.raw); return null; }
      if (!isObj(wp)) { err(path, MSG.waypoint); return null; }
      var isL = has(wp, 'landmark'), isOn = has(wp, 'on');
      if (isL === isOn) { err(path, MSG.waypoint); return null; }
      checkKeys(wp, path, isL ? ['landmark', 'offset'] : ['on', 't', 'offset']);
      var p = null, ok = true;
      if (isL) {
        var lm = typeof wp.landmark === 'string' ? libRef(wp.landmark, ['landmark']) : { error: 'unknown landmark ' + show(wp.landmark) };
        if (lm.error) err(path, /^unknown organ/.test(lm.error) ? lm.error : 'unknown landmark ' + show(wp.landmark));
        else p = lm.lm.p.slice();
      } else {
        var line = typeof wp.on === 'string' ? lineOf(wp.on, ctx) : { error: 'unknown centre line ' + show(wp.on) };
        if (line.error) { err(path, line.error); ok = false; }
        if (!(isNum(wp.t) && wp.t >= 0 && wp.t <= 1)) { err(path, 't must be a number from 0 to 1 (got ' + show(wp.t) + ')'); ok = false; }
        if (!line.error) usages.push({ path: path, on: wp.on, ctx: ctx });
        if (ok && line.points) p = pointAt(line.points, wp.t);
      }
      if (has(wp, 'offset')) {
        var off = wp.offset;
        if (!isObj(off)) { err(path, 'offset must be {"dir", "cm"}'); return null; }
        checkKeys(off, key(path, 'offset'), KEYS.offset);
        var dirOk = typeof off.dir === 'string' && has(DIRS, off.dir);
        var cmOk = isNum(off.cm) && off.cm > 0 && off.cm <= LIMITS.offsetCm;
        if (!dirOk) err(path, 'offset.dir must be one of ' + DIR_NAMES.join(', ') + ' (got ' + show(off.dir) + ')');
        if (!cmOk) err(path, 'offset.cm must be more than 0 and at most ' + LIMITS.offsetCm + ' (got ' + show(off.cm) + ')');
        if (!dirOk || !cmOk) return null;
        if (p) { var d = DIRS[off.dir]; p = [p[0] + d[0] * off.cm, p[1] + d[1] * off.cm, p[2] + d[2] * off.cm]; }
      }
      if (!p) return null;
      var out = JSON.parse(JSON.stringify(wp));
      out.p = p;
      return out;
    }
    // A line a waypoint can sit on: a library centre line or an earlier route. { points } or { error };
    // points is null for a route that itself failed (already reported). In the variant view a line
    // whose insertion was moved by an earlier edit is used with its moved geometry.
    function lineOf(ref, ctx) {
      if (ctx && ctx.view === 'variant' && variantLines[ref]) return { points: variantLines[ref] };
      if (!split(ref)) return has(routes, ref) ? { points: routes[ref].points } : { error: 'unknown structure ' + q(ref) };
      var r = libRef(ref, ['centerline']);
      if (r.error) return { error: /^unknown organ/.test(r.error) ? r.error : 'unknown centre line ' + q(ref) };
      return { points: r.cl.points };
    }
    function landmarksOf(wps) { return wps.filter(function (w) { return w && w.landmark; }).map(function (w) { return w.landmark; }); }
    function linesOf(wps) {
      var out = [];
      wps.forEach(function (w) { if (w && w.on && out.indexOf(w.on) < 0) out.push(w.on); });
      return out;
    }

    // route / branch / duplicate. Returns the resolved edit or null.
    function routeOp(e, path, view, index) {
      var op = e.op;
      checkKeys(e, path, op === 'duplicate' ? KEYS.duplicate : KEYS.route);
      function ctx(role) { return { view: view, index: index, role: role }; }
      var ok = true, src = null, tissue = e.tissue, radius = e.radius_cm;

      if (typeof e.id !== 'string' || !ID_RE.test(e.id)) { err(key(path, 'id'), 'must match [a-z][a-z0-9_]* (got ' + show(e.id) + ')'); ok = false; }
      var dupId = typeof e.id === 'string' && has(routes, e.id);
      if (dupId) { err(key(path, 'id'), q(e.id) + ' is already used'); ok = false; }
      if (!str(e.name, key(path, 'name'), LIMITS.name)) ok = false;

      if (op === 'duplicate') {
        if (typeof e.structure === 'string' && !split(e.structure) && has(routes, e.structure)) {
          src = { ref: e.structure, tissue: routes[e.structure].tissue, radius_cm: routes[e.structure].radius_cm };
        } else {
          var lr = typeof e.structure === 'string' ? libRef(e.structure, ['centerline']) : { error: 'unknown structure ' + show(e.structure) };
          if (lr.error) { if (!isRaw(e.structure)) err(key(path, 'structure'), lr.error); ok = false; }
          else src = { ref: e.structure, tissue: lr.part ? lr.part.tissue : undefined, radius_cm: lr.cl.radius_cm };
        }
        if (src && !has(e, 'tissue')) tissue = src.tissue;
        if (src && !has(e, 'radius_cm')) radius = src.radius_cm;
      }
      var inherited = op === 'duplicate' && !has(e, 'tissue') && tissue !== undefined;
      if (!inherited && (op !== 'duplicate' || src) && TISSUES.indexOf(tissue) < 0) {
        err(key(path, 'tissue'), 'must be one of ' + TISSUES.join(', ') + ' (got ' + show(tissue) + ')'); ok = false;
      }
      if ((op !== 'duplicate' || src) && !(isNum(radius) && radius > 0 && radius <= LIMITS.radiusCm)) {
        err(key(path, 'radius_cm'), 'must be a number more than 0 and at most ' + LIMITS.radiusCm + ' (got ' + show(radius) + ')'); ok = false;
      }

      var from = null;
      if (op === 'branch' && !(isObj(e.from) && has(e.from, 'on') && !has(e.from, 'landmark') && !has(e.from, 'offset'))) {
        if (isRaw(e.from)) err(key(path, 'from'), MSG.raw); else err(key(path, 'from'), MSG.branchFrom);
        ok = false;
      } else {
        from = waypoint(e.from, key(path, 'from'), ctx('from'));
        if (!from) ok = false;
      }
      var via = [];
      if (has(e, 'via')) {
        var vl = list(e.via, key(path, 'via'), LIMITS.via, false);
        if (!vl) ok = false;
        else vl.forEach(function (w, j) { var r = waypoint(w, idx(key(path, 'via'), j), ctx('via')); if (!r) ok = false; via.push(r); });
      }
      var to = waypoint(e.to, key(path, 'to'), ctx('to'));
      if (!to) ok = false;

      var points = ok ? [from.p].concat(via.map(function (w) { return w.p; }), [to.p]) : null;
      if (points) hairpins(points, path);
      if (typeof e.id === 'string' && !dupId) {
        routes[e.id] = {
          name: e.name, tissue: tissue, radius_cm: radius, points: points, view: view,
          ends: { from: from && from.on ? from.on : null, to: to && to.on ? to.on : null },
        };
      }
      var wps = [from].concat(via, [to]);
      provenance.push({
        structure: e.id, name: e.name, op: op, view: view === 'base' ? 'both' : 'variant',
        via: landmarksOf(wps), on: linesOf((src ? [{ on: src.ref }] : []).concat(wps)),
      });
      if (!ok) return null;
      var out = JSON.parse(JSON.stringify(e));
      out.from = from; out.to = to; if (has(e, 'via')) out.via = via;
      out.tissue = tissue; out.radius_cm = radius; out.points = points;
      return out;
    }

    // A tube drawn through its waypoints loops where the path turns sharply next to a short
    // stretch (e.g. a via on a small wiggle of a library line). Real vessels and ducts do not.
    function hairpins(points, path) {
      for (var k = 1; k + 1 < points.length; k++) {
        var a = sub(points[k], points[k - 1]), b = sub(points[k + 1], points[k]);
        var la = dist(points[k], points[k - 1]), lb = dist(points[k + 1], points[k]);
        if (!(la > 1e-6 && lb > 1e-6) || Math.min(la, lb) >= LIMITS.hairpinCm) continue;
        var c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb);
        var turn = Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
        if (turn > LIMITS.turnDeg) {
          err(idx(key(path, 'via'), k - 1), 'the path turns ' + Math.round(turn) + '° here, next to a stretch shorter than ' +
            LIMITS.hairpinCm + ' cm; a vessel or duct does not double back: choose waypoints that give a smooth course');
        }
      }
    }

    // Name of a structure ref (library centre line, part, or route), for provenance.
    function nameOf(ref) {
      if (!split(ref)) return has(routes, ref) ? routes[ref].name : ref;
      var r = libRef(ref, ['centerline', 'part']);
      if (r.error) return ref;
      return r.cl ? r.cl.name : r.part.name;
    }
    // Structure that a remove / move_insertion / label may name. Returns { route } | { lib } | null.
    function structure(ref, path, kinds) {
      if (isRaw(ref)) return null;   // already reported by the raw-coordinate scan
      if (typeof ref !== 'string') { err(path, 'unknown structure ' + show(ref)); return null; }
      if (!split(ref)) {
        if (has(routes, ref)) return { route: routes[ref] };
        err(path, 'unknown structure ' + q(ref)); return null;
      }
      var r = libRef(ref, kinds);
      if (r.error) { err(path, r.error); return null; }
      if (!listed[r.organ]) { err(path, 'organ ' + q(r.organ) + ' is not in organs'); return null; }
      return { lib: r };
    }

    // A rejected edit that names an id still reserves it, so later references to it do not pile up
    // follow-on errors.
    function placeholder(e, view) {
      if (typeof e.id === 'string' && !has(routes, e.id)) routes[e.id] = { name: e.name, points: null, ends: {}, view: view, rejected: true };
    }

    // 4. Base: structures completed from landmarks, drawn in both views.
    if (has(R, 'base')) {
      var baseList = list(R.base, 'base', LIMITS.base, false) || [];
      baseList.forEach(function (e, i) {
        var p = idx('base', i);
        if (!isObj(e)) { err(p, 'must be an object'); return; }
        if (e.op !== 'route' && e.op !== 'branch') {
          err(key(p, 'op'), 'only route and branch are allowed in base (got ' + show(e.op) + ')');
          placeholder(e, 'base');
          return;
        }
        var r = routeOp(e, p, 'base', i);
        if (r) R.base[i] = r;
      });
    }

    // 5. Variant edits.
    var removeEdits = [];                  // [{ path, ref }]
    if (!isObj(R.variant)) err('variant', 'must be an object');
    else {
      checkKeys(R.variant, 'variant', KEYS.variant);
      str(R.variant.label, 'variant.label', LIMITS.label);
      var edits = list(R.variant.edits, 'variant.edits', LIMITS.edits, true) || [];
      edits.forEach(function (e, i) {
        var p = idx('variant.edits', i);
        if (!isObj(e)) { err(p, 'must be an object'); return; }
        if (OPS.indexOf(e.op) < 0) {
          err(key(p, 'op'), 'unknown op ' + show(e.op) + ' (use remove, route, branch, move_insertion or duplicate)');
          placeholder(e, 'variant');
          return;
        }
        if (e.op === 'remove') {
          checkKeys(e, p, KEYS.remove);
          var s = structure(e.structure, key(p, 'structure'), ['centerline', 'part']);
          if (!s) return;
          if (removed[e.structure]) { err(key(p, 'structure'), q(e.structure) + ' is already removed'); return; }
          removed[e.structure] = true;
          removeEdits.push({ path: p, ref: e.structure });
          provenance.push({ structure: e.structure, name: nameOf(e.structure), op: 'remove', view: 'variant', via: [], on: [] });
        } else if (e.op === 'move_insertion') {
          checkKeys(e, p, KEYS.move_insertion);
          var m = structure(e.structure, key(p, 'structure'), ['centerline']);
          var end = null, base = null;
          if (m && m.route && !m.route.rejected) {
            end = m.route.ends.to ? 'to' : m.route.ends.from ? 'from' : null;
            if (!end) err(key(p, 'structure'), q(e.structure) + ' has no insertion on a centre line to move');
            base = m.route.points;
          } else if (m && m.lib) { end = 'start'; base = m.lib.cl.points; }
          if (m && has(moved, e.structure)) { err(key(p, 'structure'), q(e.structure) + ' is already moved'); end = null; }
          var to = null;
          if (!(isObj(e.to) && has(e.to, 'on') && !has(e.to, 'landmark') && !has(e.to, 'offset'))) {
            err(key(p, 'to'), isRaw(e.to) ? MSG.raw : MSG.insertion);
          } else if (e.to.on === e.structure) {
            err(key(p, 'to'), 'a structure cannot insert into itself');
          } else to = waypoint(e.to, key(p, 'to'), { view: 'variant', index: i, role: 'to' });
          if (!end || !to) return;
          moved[e.structure] = { end: end, on: to.on, index: i, path: key(p, 'structure') };
          var out = JSON.parse(JSON.stringify(e));
          out.to = to; out.end = end;
          // Variant-view geometry: the same line with its insertion point replaced by the new one
          // (a route's `to` or `from` end, a library line's first point).
          if (base) {
            out.points = base.map(function (pt) { return pt.slice(); });
            out.points[end === 'to' ? out.points.length - 1 : 0] = to.p.slice();
            variantLines[e.structure] = out.points;
          }
          R.variant.edits[i] = out;
          provenance.push({ structure: e.structure, name: nameOf(e.structure), op: 'move_insertion', view: 'variant', via: [], on: [to.on] });
        } else {
          var r = routeOp(e, p, 'variant', i);
          if (r) R.variant.edits[i] = r;
        }
      });
    }

    // 6. Lines used by waypoints, now that every remove and move is known.
    usages.forEach(function (u) {
      var mv = has(moved, u.on) ? moved[u.on] : null;
      if (u.ctx.view === 'variant') {
        if (removed[u.on]) err(u.path, q(u.on) + ' is removed in the variant view');
        else if (mv && mv.index > u.ctx.index) err(u.path, q(u.on) + ' is moved by a later edit (variant.edits[' + mv.index + ']); move it first');
      } else {
        // A base structure is drawn in both views, so it cannot depend on a line the variant changes.
        // (A base end on a removed line is reported by the remove, below.)
        if (removed[u.on] && u.ctx.role === 'via') err(u.path, q(u.on) + ' is removed in the variant view; a base structure cannot pass through it');
        if (mv) err(u.path, q(u.on) + ' is moved in the variant view; a base structure cannot sit on it');
      }
    });
    for (var mref in moved) if (removed[mref]) err(moved[mref].path, q(mref) + ' is removed in the variant view');

    // 7. Removing a structure that others still branch from: library lines whose manifest `parent`
    // is the removed line, and base structures with an end on it.
    removeEdits.forEach(function (rm) {
      var children = [], s = split(rm.ref);
      var isLine = s && has(manifests, s.organ) && has(manifests[s.organ].centerlines, s.id);
      if (isLine) {
        Object.keys(listed).forEach(function (organId) {
          var cls = manifests[organId].centerlines || {};
          for (var c in cls) {
            if (!has(cls, c) || cls[c].parent !== s.id) continue;
            var ref = organId + '/' + c, mv = moved[ref];
            if (!(mv && mv.end === 'start' && mv.on !== rm.ref)) children.push(ref);
          }
        });
      }
      for (var id in routes) {
        if (routes[id].view !== 'base') continue;
        var ends = { from: routes[id].ends.from, to: routes[id].ends.to }, mv = moved[id];
        if (mv) ends[mv.end] = mv.on;
        if (ends.from === rm.ref || ends.to === rm.ref) children.push(id);
      }
      children.forEach(function (x) {
        if (!removed[x]) err(rm.path, x + ' branches from ' + rm.ref + '; reroute or remove ' + x + ' too');
      });
    });

    // 8. Labels.
    var labelList = has(R, 'labels') ? (list(R.labels, 'labels', LIMITS.labels, false) || []) : [];
    labelList.forEach(function (l, i) {
      var p = idx('labels', i);
      if (!isObj(l)) { err(p, 'must be an object'); return; }
      checkKeys(l, p, KEYS.label);
      str(l.text, key(p, 'text'), LIMITS.label);
      var s = structure(l.on, key(p, 'on'), ['centerline', 'part', 'landmark']);
      if (!s) return;
      var variantOnly = !!(s.route && s.route.view === 'variant');
      var gone = !!removed[l.on];
      if (has(l, 'views')) {
        var v = l.views;
        if (!Array.isArray(v) || !v.length || v.some(function (x, j) { return VIEWS.indexOf(x) < 0 || v.indexOf(x) !== j; })) {
          err(key(p, 'views'), MSG.views); return;
        }
        if (variantOnly && v.indexOf('normal') >= 0) err(p, q(l.on) + ' exists only in the variant view');
        if (gone && v.indexOf('variant') >= 0) err(p, q(l.on) + ' is removed in the variant view');
      } else {
        R.labels[i].views = variantOnly ? ['variant'] : gone ? ['normal'] : VIEWS.slice();
      }
    });
    if (!has(R, 'labels')) R.labels = [];

    // 9. Claims.
    var claimList = list(R.claims, 'claims', LIMITS.claims, true) || [];
    claimList.forEach(function (c, i) {
      var p = idx('claims', i);
      if (!isObj(c)) { err(p, 'must be an object'); return; }
      checkKeys(c, p, KEYS.claim);
      str(c.text, key(p, 'text'), LIMITS.claim);
      if (has(c, 'refs') && !Array.isArray(c.refs)) { err(key(p, 'refs'), MSG.refsList); return; }
      if (!Array.isArray(c.refs) || !c.refs.length) { err(key(p, 'refs'), MSG.noRefs); return; }
      c.refs.forEach(function (r, j) {
        if (typeof r !== 'string' || !has(references, r)) err(idx(key(p, 'refs'), j), 'unknown reference ' + show(r));
      });
    });

    // 10. View.
    if (has(R, 'view')) {
      if (!isObj(R.view)) err('view', 'must be an object');
      else {
        checkKeys(R.view, 'view', KEYS.view);
        if (has(R.view, 'rot') && !(Array.isArray(R.view.rot) && R.view.rot.length === 2 && R.view.rot.every(isNum))) err('view.rot', MSG.rot);
        var z = R.view.zoom;
        if (has(R.view, 'zoom') && !(isNum(z) && z >= LIMITS.zoom[0] && z <= LIMITS.zoom[1])) {
          err('view.zoom', 'must be a number from ' + LIMITS.zoom[0] + ' to ' + LIMITS.zoom[1] + ' (got ' + show(z) + ')');
        }
      }
    }

    if (errors.length) return fail();
    R.provenance = provenance;
    return { ok: true, errors: [], resolved: R };
  }

  var api = {
    validate: validate, SCHEMA: SCHEMA, LIMITS: LIMITS, OPS: OPS, TISSUES: TISSUES,
    DIRECTIONS: DIR_NAMES, VIEWS: VIEWS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SagittalSpec = api;
})();
