// sagittal rendering kit. Classic script: assigns window.Kit.
// Needs window.THREE (vendor/three.min.js) and window.KitLabels (kit/labels.js) loaded first.
(function () {
  var THREE = window.THREE;
  var BG = 0x0f141b;
  var LABEL_OFFSET_X = 8;
  var FALLBACK_TEXT = '3D is not available in this browser (WebGL could not start). The notes and claims for this scene are still shown.';

  /* ---------- geometry helpers (ported from the prototype) ---------- */
  function V(x, y, z) { return new THREE.Vector3(x, y, z); }
  function mat(c, o, x) {
    if (o === undefined) o = 1;
    return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0, transparent: o < 1, opacity: o, side: THREE.DoubleSide, depthWrite: o >= 0.95 }, x || {}));
  }
  function add(g, geo, m, p, s) {
    p = p || [0, 0, 0]; s = s || [1, 1, 1];
    var me = new THREE.Mesh(geo, m); me.position.set(p[0], p[1], p[2]); me.scale.set(s[0], s[1], s[2]); g.add(me); return me;
  }
  function ell(g, c, o, p, s, x) { return add(g, new THREE.SphereGeometry(1, 32, 24), mat(c, o, x), p, s); }
  function seg(g, a, b, r, m) {
    a = V(a[0], a[1], a[2]); b = V(b[0], b[1], b[2]);
    var d = b.clone().sub(a), L = d.length();
    var me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 14, 1), m);
    me.position.copy(a).add(b).multiplyScalar(0.5); me.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); g.add(me); return me;
  }
  function tube(g, pts, r, m, n) {
    var c = new THREE.CatmullRomCurve3(pts.map(function (p) { return V(p[0], p[1], p[2]); }));
    var me = new THREE.Mesh(new THREE.TubeGeometry(c, n || 48, r, 12, false), m); g.add(me); return me;
  }
  function arrow(g, a, b, col) {
    if (col === undefined) col = 0xffd23f;
    a = V(a[0], a[1], a[2]); b = V(b[0], b[1], b[2]);
    var d = b.clone().sub(a), L = d.length(), gr = new THREE.Group();
    var m = mat(col, 1, { emissive: col, emissiveIntensity: 0.6 });
    var sh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, L - 0.22, 10), m); sh.position.y = (L - 0.22) / 2;
    var hd = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 12), m); hd.position.y = L - 0.11;
    gr.add(sh, hd); gr.position.copy(a); gr.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); g.add(gr); return gr;
  }
  function ring(g, p, r, col, rot) {
    if (col === undefined) col = 0xffd23f; rot = rot || [0, 0, 0];
    var me = add(g, new THREE.TorusGeometry(r, 0.05, 10, 36), mat(col, 1, { emissive: col, emissiveIntensity: 0.6 }), p);
    me.rotation.set(rot[0], rot[1], rot[2]); return me;
  }
  function sector(r0, r1, a0, a1, depth) {
    var s = new THREE.Shape(); s.absarc(0, 0, r1, a0, a1, false); s.absarc(0, 0, r0, a1, a0, true);
    var g = new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: false, curveSegments: 48 }); g.translate(0, 0, -depth / 2); return g;
  }
  function disk(r, depth) {
    var s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false);
    var g = new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: false, curveSegments: 48 }); g.translate(0, 0, -depth / 2); return g;
  }
  function dot(g, p, col, r) {
    if (col === undefined) col = 0xffd23f;
    return add(g, new THREE.SphereGeometry(r || 0.1, 16, 12), mat(col, 1, { emissive: col, emissiveIntensity: 0.7 }), p);
  }

  /* ---------- scene registry ---------- */
  var scenes = {};
  function register(def) {
    if (!def || typeof def.id !== 'string' || typeof def.build !== 'function') throw new Error('Kit.register: scene needs id and build()');
    scenes[def.id] = def;
  }

  // Normalises a raw state (e.g. from URL query strings) against a scene's controls.
  function initialState(def, given) {
    var st = {};
    given = given || {};
    def.controls.forEach(function (c) {
      var v = Object.prototype.hasOwnProperty.call(given, c.k) ? given[c.k] : c.def;
      if (c.type === 'chk') {
        st[c.k] = v === true || v === 'true' || v === '1' || v === 'on';
      } else if (c.opts) {
        var ok = c.opts.some(function (o) { return o[0] === v; });
        st[c.k] = ok ? v : c.def;
      } else {
        st[c.k] = v;
      }
    });
    return st;
  }

  function disposeTree(obj) {
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose(); });
    });
  }

  /* ---------- viewer ---------- */
  // opts: { canvas, labelsEl, controlsEl?, infoEl? }
  function createViewer(opts) {
    var canvas = opts.canvas, labelsEl = opts.labelsEl;
    var controlsEl = opts.controlsEl || null, infoEl = opts.infoEl || null;
    var renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.localClippingEnabled = true;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    } catch (e) {
      renderer = null;
    }

    var scene = new THREE.Scene(); scene.background = new THREE.Color(BG);
    var cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100); cam.position.set(0, 0, 9);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.0));
    var dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(3, 5, 7); scene.add(dl);
    var root = new THREE.Group(); scene.add(root);

    var cur = null, st = {}, labels = [], labEls = [], labSizes = [], update = null;
    var labelsOn = true, rects = [], running = false;
    var clock = new THREE.Clock();
    var tmp = new THREE.Vector3();

    canvas.style.touchAction = 'none';

    if (!renderer) {
      var fb = document.createElement('div');
      fb.className = 'kit-fallback';
      fb.setAttribute('role', 'status');
      fb.textContent = FALLBACK_TEXT;
      canvas.style.display = 'none';
      labelsEl.style.display = 'none';
      if (canvas.parentNode) canvas.parentNode.insertBefore(fb, canvas);
    }

    function size() { return { w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 }; }

    function resize() {
      if (!renderer) return;
      var s = size();
      renderer.setSize(s.w, s.h, false);
      cam.aspect = s.w / s.h; cam.updateProjectionMatrix();
    }

    function rebuild() {
      while (root.children.length) { var ch = root.children[0]; root.remove(ch); disposeTree(ch); }
      labelsEl.innerHTML = ''; labEls = []; labSizes = []; rects = [];
      var g = new THREE.Group(); root.add(g);
      var r = cur.build(g, st) || {};
      g.position.set(-cur.center[0], -cur.center[1], -cur.center[2]);
      labels = r.labels || []; update = r.update || null;
      labels.forEach(function (l) {
        var e = document.createElement('div'); e.className = 'lab'; e.textContent = l.t;
        labelsEl.appendChild(e); labEls.push(e);
      });
      labSizes = labEls.map(function () { return null; });
      if (infoEl) infoEl.innerHTML = r.info || '';
      if (renderer) frame(true);
    }

    function buildControls() {
      if (!controlsEl) return;
      controlsEl.innerHTML = '';
      cur.controls.forEach(function (c) {
        var w = document.createElement('div');
        var id = 'kit_c_' + c.k;
        var l = document.createElement('label'); l.htmlFor = id; l.textContent = c.label;
        if (c.type === 'chk') {
          w.className = 'chk';
          var i = document.createElement('input'); i.type = 'checkbox'; i.id = id; i.checked = !!st[c.k];
          i.onchange = function () { st[c.k] = i.checked; rebuild(); };
          w.append(i, l);
        } else {
          w.className = 'ctl';
          var s = document.createElement('select'); s.id = id;
          c.opts.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
          s.value = st[c.k];
          s.onchange = function () { st[c.k] = s.value; rebuild(); };
          w.append(l, s);
        }
        controlsEl.appendChild(w);
      });
    }

    function placeLabels() {
      rects = [];
      if (!labelsOn || !labEls.length) return;
      var s = size();
      var anchors = [], idx = [];
      root.updateMatrixWorld(true);
      labels.forEach(function (l, i) {
        tmp.set(l.p[0] - cur.center[0], l.p[1] - cur.center[1], l.p[2] - cur.center[2]);
        root.localToWorld(tmp); tmp.project(cam);
        var e = labEls[i];
        if (tmp.z > 1) { e.style.display = 'none'; return; }
        e.style.display = 'block';
        if (!labSizes[i]) labSizes[i] = { w: e.offsetWidth, h: e.offsetHeight };
        var sz = labSizes[i];
        anchors.push({ x: (tmp.x * 0.5 + 0.5) * s.w + LABEL_OFFSET_X, y: (-tmp.y * 0.5 + 0.5) * s.h - sz.h / 2, w: sz.w, h: sz.h });
        idx.push(i);
      });
      var pos = window.KitLabels.layoutLabels(anchors, { w: s.w, h: s.h });
      pos.forEach(function (p, k) {
        var e = labEls[idx[k]];
        e.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)';
        rects.push({ x: p.x, y: p.y, w: anchors[k].w, h: anchors[k].h });
      });
    }

    function frame(once) {
      if (!cur) return;
      if (!canvas.isConnected) return; // card replaced (e.g. Anki flip): stop the loop
      if (update) update(clock.getElapsedTime());
      placeLabels();
      renderer.render(scene, cam);
      if (once !== true) requestAnimationFrame(frame);
    }

    if (renderer) {
      if (window.ResizeObserver) new ResizeObserver(function () { resize(); if (cur) frame(true); }).observe(canvas);
      window.addEventListener('resize', resize);

      // Orbit (one pointer) and pinch / wheel zoom.
      var pts = {}, pinch0 = 0, zoom0 = 0;
      function clampZoom(z) { return Math.max(3, Math.min(16, z)); }
      function count() { return Object.keys(pts).length; }
      function pinchDist() {
        var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]];
        return Math.hypot(a.x - b.x, a.y - b.y) || 1;
      }
      canvas.addEventListener('pointerdown', function (e) {
        pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
        if (count() === 2) { pinch0 = pinchDist(); zoom0 = cam.position.z; }
        canvas.classList.add('dragging');
      });
      function up(e) {
        delete pts[e.pointerId];
        if (!count()) canvas.classList.remove('dragging');
      }
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('pointermove', function (e) {
        var p = pts[e.pointerId];
        if (!p) return;
        var n = count();
        if (n === 1) {
          root.rotation.y += (e.clientX - p.x) * 0.008;
          root.rotation.x = Math.max(-1.5, Math.min(1.5, root.rotation.x + (e.clientY - p.y) * 0.008));
        }
        p.x = e.clientX; p.y = e.clientY;
        if (n === 2) cam.position.z = clampZoom(zoom0 * pinch0 / pinchDist());
      });
      canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        cam.position.z = clampZoom(cam.position.z * (1 + e.deltaY * 0.001));
      }, { passive: false });
    }

    function open(id, state) {
      var def = scenes[id];
      if (!def) return false;
      cur = def;
      st = initialState(def, state);
      root.rotation.set(def.rot[0], def.rot[1], 0);
      cam.position.z = def.zoom;
      buildControls();
      resize();
      rebuild();
      if (renderer && !running) { running = true; requestAnimationFrame(frame); }
      return true;
    }

    function setLabelsVisible(b) {
      labelsOn = !!b;
      labelsEl.style.display = labelsOn && renderer ? '' : 'none';
      if (renderer && cur) frame(true);
    }

    function nonBlank() {
      if (!renderer || !cur) return false;
      renderer.render(scene, cam);
      var gl = renderer.getContext();
      var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      var px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      var bg = new THREE.Color(BG), br = bg.r * 255, bgg = bg.g * 255, bb = bg.b * 255;
      for (var i = 0; i < px.length; i += 4) {
        if (Math.abs(px[i] - br) + Math.abs(px[i + 1] - bgg) + Math.abs(px[i + 2] - bb) > 24) return true;
      }
      return false;
    }

    return {
      available: !!renderer,
      open: open,
      setLabelsVisible: setLabelsVisible,
      getState: function () { return Object.assign({}, st); },
      debug: function () {
        return {
          labelRects: rects.map(function (r) { return { x: r.x, y: r.y, w: r.w, h: r.h }; }),
          // computed lazily: rendering + readPixels is costly on software GL
          get nonBlank() { return nonBlank(); },
          rot: [root.rotation.x, root.rotation.y],
        };
      },
    };
  }

  window.Kit = {
    register: register,
    createViewer: createViewer,
    get: function (id) { return scenes[id] || null; },
    ids: function () { return Object.keys(scenes); },
    initialState: initialState,
    helpers: { V: V, mat: mat, add: add, ell: ell, seg: seg, tube: tube, arrow: arrow, ring: ring, sector: sector, disk: disk, dot: dot },
    BADGE_TEXT: 'Unreviewed: verify against your textbook',
  };
})();
