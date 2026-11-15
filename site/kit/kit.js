// sagittal rendering kit. Classic script: assigns window.Kit.
// Needs window.THREE (vendor/three.min.js) and window.KitLabels (kit/labels.js) loaded first.
(function () {
  var THREE = window.THREE;
  var BG_RGB = [0x0f, 0x14, 0x1b]; // #0f141b, the clear colour, written to the framebuffer as-is
  // Labels sit LABEL_GAP px beside an anchor dot and are joined to it by a leader line.
  var LABEL_GAP = 16, DOT_R = 3.5;
  // Occlusion test (see occlusion() below): surfaces at least this opaque hide what is behind them,
  // and an anchor this close (world units) behind the first surface still counts as on it.
  var OCC_MIN_OPACITY = 0.7, OCC_TOL = 0.3, SURF_TOL = 0.04;
  var SVGNS = 'http://www.w3.org/2000/svg';
  // Modern colour workflow: hex colours are sRGB, lighting runs in linear space, output is sRGB.
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
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

  /* ---------- tissue materials ---------- */
  // MeshPhysicalMaterial presets. Kit.tissue(kind, opts?) returns a NEW material each call;
  // opts override any material property (color, opacity, emissive, side, clippingPlanes...).
  // No transmission (it costs an extra render pass): see-through tissues use opacity instead.
  var TISSUE = {
    'myocardium':    { color: 0x9e2f2a, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.45, sheen: 0.4, sheenColor: 0xd46a5f, sheenRoughness: 0.6 },
    'vessel-artery': { color: 0xc23b30, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3 },
    'vessel-vein':   { color: 0x3c5fa8, roughness: 0.4, clearcoat: 0.55, clearcoatRoughness: 0.32 },
    'blood-oxy':     { color: 0xd8403a, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 },
    'blood-deoxy':   { color: 0x3a6fd8, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 },
    'blood-mixed':   { color: 0x9553c9, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 },
    'bone':          { color: 0xc9b48c, roughness: 0.68, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.15, sheenColor: 0xfff1d6 },
    'cartilage':     { color: 0x9fb4b8, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.3, sheenColor: 0xe8f4ff },
    'lung':          { color: 0xd9a0a0, roughness: 0.8, sheen: 0.7, sheenColor: 0xffd6d6, sheenRoughness: 0.5 },
    'liver':         { color: 0x7a2e22, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.3 },
    'gallbladder':   { color: 0x5f7a3a, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2 },
    'bile-duct':     { color: 0x7f9a3c, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3 },
    'pancreas':      { color: 0xd9b07a, roughness: 0.65, clearcoat: 0.3, clearcoatRoughness: 0.5, sheen: 0.3, sheenColor: 0xffe3b8 },
    'bowel':         { color: 0xd88f7c, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.3, sheenColor: 0xffc8b8 },
    'fascia':        { color: 0xe8e4dc, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4, sheen: 0.6, sheenColor: 0xffffff, opacity: 0.55 },
    'muscle':        { color: 0x9b3a33, roughness: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.5, sheen: 0.5, sheenColor: 0xc8605a, sheenRoughness: 0.5 },
    'fat':           { color: 0xf0cf6e, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35 },
    'uterus-serosa': { color: 0xd88a8a, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.3, sheenColor: 0xffd0d0 },
    'myometrium':    { color: 0xb5524f, roughness: 0.6, sheen: 0.4, sheenColor: 0xd98080 },
    'endometrium':   { color: 0xc9606e, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 },
    'fibroid':       { color: 0xe0cdbf, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.3, sheenColor: 0xffffff },
    'sclera':        { color: 0xf2efe8, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.2 },
    'cornea':        { color: 0xdfefff, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, opacity: 0.25 },
    'iris':          { color: 0x5b7aa0, roughness: 0.6, sheen: 0.3, sheenColor: 0xa8c4e0 },
    'lens':          { color: 0xf3f0de, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1, opacity: 0.45 },
    'retina':        { color: 0xd97a5a, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 },
    'choroid':       { color: 0x5a2a2a, roughness: 0.6 },
    'nerve':         { color: 0xf0d77a, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: 0xfff1b8 },
    'air':           { color: 0xbfe3ff, roughness: 0.2, opacity: 0.18 },
    'highlight':     { color: 0xffd23f, roughness: 0.4, emissive: 0xffd23f, emissiveIntensity: 0.55 },
  };
  var COLOR_KEYS = ['color', 'emissive', 'sheenColor', 'specularColor', 'attenuationColor'];
  function tissue(kind, opts) {
    var base = TISSUE[kind];
    if (!base) throw new Error('Kit.tissue: unknown kind "' + kind + '" (known: ' + Object.keys(TISSUE).join(', ') + ')');
    var p = Object.assign({ metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.7 }, base, opts || {});
    var o = p.opacity === undefined ? 1 : p.opacity;
    if (p.transparent === undefined) p.transparent = o < 1;
    if (p.depthWrite === undefined) p.depthWrite = o >= 0.95;
    COLOR_KEYS.forEach(function (k) { if (p[k] !== undefined && !(p[k] && p[k].isColor)) p[k] = new THREE.Color(p[k]); });
    var m = new THREE.MeshPhysicalMaterial(p);
    m.userData.tissue = kind;
    return m;
  }

  /* ---------- baked anatomical meshes (site/meshes/<name>.js) ---------- */
  // Each mesh script sets window.SagittalMeshes[name] = { parts: { part: { p, i, it, n?, bbox } }, unit: 'cm', ... }.
  // Geometries are decoded once and shared; disposeTree() leaves them alone (userData.kitShared).
  var meshCache = {};
  function meshLib(name) {
    var lib = window.SagittalMeshes && window.SagittalMeshes[name];
    if (!lib) throw new Error('Kit: mesh "' + name + '" is not loaded. List it in the scene\'s meshes: [...] so the page loads meshes/' + name + '.js');
    return lib;
  }
  function b64bytes(s) {
    var bin = atob(s), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function meshGeometry(name, part) {
    var key = name + '/' + part;
    if (meshCache[key]) return meshCache[key];
    var lib = meshLib(name), pd = lib.parts[part];
    if (!pd) throw new Error('Kit: mesh "' + name + '" has no part "' + part + '" (parts: ' + Object.keys(lib.parts).join(', ') + ')');
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b64bytes(pd.p).buffer), 3));
    var ib = b64bytes(pd.i).buffer;
    geo.setIndex(new THREE.BufferAttribute(pd.it === 'u32' ? new Uint32Array(ib) : new Uint16Array(ib), 1));
    if (pd.n) geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(b64bytes(pd.n).buffer), 3));
    else geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    geo.userData = { kitShared: true, mesh: name, part: part };
    meshCache[key] = geo;
    return geo;
  }
  // Adds one part of a baked mesh to group g and returns the THREE.Mesh.
  // material: a THREE.Material or a tissue kind string (default 'bone').
  function meshPart(g, name, part, material) {
    if (typeof material === 'string') material = tissue(material);
    if (!material) material = tissue('bone');
    var me = new THREE.Mesh(meshGeometry(name, part), material);
    me.name = name + '/' + part;
    g.add(me);
    return me;
  }
  function meshParts(name) {
    var lib = window.SagittalMeshes && window.SagittalMeshes[name];
    return lib ? Object.keys(lib.parts) : [];
  }
  function meshInfo(name) {
    var lib = meshLib(name), bb = {};
    Object.keys(lib.parts).forEach(function (k) { bb[k] = lib.parts[k].bbox ? lib.parts[k].bbox.slice() : null; });
    return { unit: lib.unit, credit: lib.credit, frame: lib.frame, offset: (lib.offset || [0, 0, 0]).slice(), bbox: bb };
  }

  /* ---------- lighting environment ---------- */
  // A small procedural studio, painted into a 128x64 equirectangular texture (gradient sky/floor plus
  // three soft boxes) and prefiltered with PMREM. The tiny source keeps PMREM cheap on software GL.
  // No external HDR files; built once per viewer.
  var ENV_W = 128, ENV_H = 64;
  var ENV_BOXES = [ // direction (towards the light), angular radius (rad), linear rgb
    { d: [0.38, 0.62, 0.68], r: 0.42, c: [1.0, 0.95, 0.88] }, // key, upper front right
    { d: [-0.62, 0.3, -0.72], r: 0.3, c: [0.75, 0.84, 1.0] },  // rim, behind left
    { d: [-0.66, -0.1, 0.74], r: 0.35, c: [0.45, 0.45, 0.45] }, // low fill, front left
  ];
  function envPixels() {
    var data = new Uint8Array(ENV_W * ENV_H * 4), i, x, y;
    // three.js equirect lookup: u = atan2(z, x) / 2pi + 0.5, v = asin(y) / pi + 0.5 (row 0 is v = 0).
    for (y = 0; y < ENV_H; y++) {
      var lat = ((y + 0.5) / ENV_H - 0.5) * Math.PI;
      var dy = Math.sin(lat), cl = Math.cos(lat);
      for (x = 0; x < ENV_W; x++) {
        var th = ((x + 0.5) / ENV_W - 0.5) * Math.PI * 2;
        var dx = Math.cos(th) * cl, dz = Math.sin(th) * cl;
        var r, g, b, t;
        if (dy > 0) { t = Math.pow(dy, 0.8); r = 0.11 + 0.62 * t; g = 0.12 + 0.66 * t; b = 0.14 + 0.72 * t; }
        else { t = Math.min(1, -dy * 1.6); r = 0.11 - 0.1 * t; g = 0.12 - 0.11 * t; b = 0.14 - 0.12 * t; }
        for (var k = 0; k < ENV_BOXES.length; k++) {
          var bx = ENV_BOXES[k], L = Math.hypot(bx.d[0], bx.d[1], bx.d[2]);
          var cos = (dx * bx.d[0] + dy * bx.d[1] + dz * bx.d[2]) / L;
          var w = Math.max(0, Math.min(1, (cos - Math.cos(bx.r)) / (1 - Math.cos(bx.r)) * 3));
          r += w * bx.c[0]; g += w * bx.c[1]; b += w * bx.c[2];
        }
        i = (y * ENV_W + x) * 4;
        data[i] = Math.min(255, r * 255); data[i + 1] = Math.min(255, g * 255); data[i + 2] = Math.min(255, b * 255); data[i + 3] = 255;
      }
    }
    return data;
  }
  function buildEnvironment(renderer) {
    var src = new THREE.DataTexture(envPixels(), ENV_W, ENV_H, THREE.RGBAFormat);
    src.mapping = THREE.EquirectangularReflectionMapping;
    src.magFilter = THREE.LinearFilter; src.minFilter = THREE.LinearFilter;
    src.flipY = false; src.needsUpdate = true;
    var pm = new THREE.PMREMGenerator(renderer);
    var tex = pm.fromEquirectangular(src).texture;
    pm.dispose(); src.dispose();
    return tex;
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
      if (o.geometry && !(o.geometry.userData && o.geometry.userData.kitShared)) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose(); });
    });
  }

  /* ---------- viewer ---------- */
  // opts: { canvas, labelsEl, controlsEl?, infoEl?, environment? (default true) }
  // Options a page may opt into (the library viewer, cards and Anki templates use none of them):
  //   background: a CSS colour ('#f2ecdf') for the stage instead of BG_RGB; viewer.setBackground()
  //     changes it later (e.g. on a theme switch).
  //   leaderStyle: 'css' leaves the leader, halo and anchor dot colours to the page's stylesheet
  //     (classes kit-halo, kit-leader, kit-anchor; .is-occluded on the leader group and the label)
  //     instead of the built-in inline colours for a dark stage.
  function createViewer(opts) {
    var canvas = opts.canvas, labelsEl = opts.labelsEl;
    var cssLeaders = opts.leaderStyle === 'css';
    var bgRGB = BG_RGB.slice();
    var controlsEl = opts.controlsEl || null, infoEl = opts.infoEl || null;
    var renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.localClippingEnabled = true;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
    } catch (e) {
      renderer = null;
    }

    var scene = new THREE.Scene();
    // Colour(hex) decodes sRGB to linear; three re-encodes the clear colour for the sRGB output,
    // so the canvas background stays exactly #0f141b (tone mapping does not touch the clear colour).
    scene.background = new THREE.Color((BG_RGB[0] << 16) | (BG_RGB[1] << 8) | BG_RGB[2]);
    function setBackground(css) {
      var m = /^#?([0-9a-f]{6})$/i.exec(String(css || '').trim());
      if (!m) {
        var rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(String(css || '').trim());
        if (!rgb) return false;
        m = [0, [rgb[1], rgb[2], rgb[3]].map(function (n) { return ('0' + (+n).toString(16)).slice(-2); }).join('')];
      }
      var n = parseInt(m[1], 16);
      bgRGB = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      scene.background = new THREE.Color(n);
      if (renderer && cur) frame(true);
      return true;
    }
    if (opts.background) setBackground(opts.background);
    var cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100); cam.position.set(0, 0, 9);
    // Lights stay with the camera rig (not children of root), so the model is lit from the viewer's
    // side whichever way it is turned: soft sky/ground fill, warm key, cool rim; plus the PMREM studio.
    scene.add(new THREE.HemisphereLight(0xf2f5ff, 0x30363f, 0.35));
    var dl = new THREE.DirectionalLight(0xfff1e2, 2.0); dl.position.set(5, 6, 4); scene.add(dl);
    var rim = new THREE.DirectionalLight(0xbcd4ff, 1.1); rim.position.set(-5, 3, -6); scene.add(rim);
    // opts.environment === false skips the PMREM studio (about 1.5x cheaper per frame on software GL).
    if (renderer && opts.environment !== false) {
      try { scene.environment = buildEnvironment(renderer); } catch (e) { scene.environment = null; }
    }
    var root = new THREE.Group(); scene.add(root);

    var cur = null, st = {}, labels = [], labEls = [], labSizes = [], update = null;
    var labelsOn = true, rects = [], running = false;
    var leadSvg = null, leadEls = [], leads = [], occ = [], anchorIdx = [], onPts = [], occDirty = true, occMeshes = null, dragging = false;
    var raycaster = new THREE.Raycaster(), tmpDir = new THREE.Vector3();
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
      // Leader lines and anchor dots: one SVG under the label chips. Inline styles, so the same
      // markup works in the viewer, the card renderer and the Anki 3D template (no page CSS needed).
      leadSvg = document.createElementNS(SVGNS, 'svg');
      leadSvg.setAttribute('class', 'kit-leaders');
      leadSvg.setAttribute('aria-hidden', 'true');
      leadSvg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none';
      labelsEl.appendChild(leadSvg);
      leadEls = [];
      labels.forEach(function (l) {
        var lg = document.createElementNS(SVGNS, 'g');
        var halo = document.createElementNS(SVGNS, 'line');
        halo.setAttribute('class', 'kit-halo');
        var ln = document.createElementNS(SVGNS, 'line');
        ln.setAttribute('class', 'kit-leader');
        var dt = document.createElementNS(SVGNS, 'circle');
        dt.setAttribute('class', 'kit-anchor');
        dt.setAttribute('r', String(DOT_R));
        if (!cssLeaders) {
          halo.setAttribute('stroke', 'rgba(15,20,27,0.75)'); halo.setAttribute('stroke-width', '3.5'); halo.setAttribute('stroke-linecap', 'round');
          ln.setAttribute('stroke', '#f2f5fa'); ln.setAttribute('stroke-width', '1.4'); ln.setAttribute('stroke-linecap', 'round');
          dt.setAttribute('fill', '#f2f5fa');
          dt.setAttribute('stroke', 'rgba(15,20,27,0.9)'); dt.setAttribute('stroke-width', '1.5');
        }
        lg.appendChild(halo); lg.appendChild(ln); lg.appendChild(dt);
        leadSvg.appendChild(lg);
        leadEls.push({ g: lg, halo: halo, line: ln, dot: dt });
        var e = document.createElement('div'); e.className = 'lab'; e.textContent = l.t;
        labelsEl.appendChild(e); labEls.push(e);
      });
      labSizes = labEls.map(function () { return null; });
      occ = labels.map(function () { return false; });
      anchorIdx = labels.map(function () { return 0; });
      onPts = labels.map(function () { return null; });
      occDirty = true; occMeshes = null;
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

    // A label is { t, p, alt?, on?, side?, behind? }.
    // alt: further anchor points on the same structure (scene coordinates, like p); when p is hidden
    //   in the current view the first visible one is used.
    // on: the mesh (or meshes) the label names; the dot goes on the visible surface of that mesh,
    //   at the vertex nearest to p that the camera sees (p itself may be inside, e.g. a centre line).
    //   alt is ignored when on is given.
    // side: 'left' puts the chip left of its dot (default right).
    // behind: the anchor is deliberately hidden (a structure drawn x-ray style); drawn dashed.
    function anchorPoint(i) {
      var l = labels[i], k = anchorIdx[i] || 0;
      if (k < 0 && onPts[i]) return onPts[i];
      return k > 0 && l.alt && l.alt[k - 1] ? l.alt[k - 1] : l.p;
    }
    function labelWorld(p, out) {
      out.set(p[0] - cur.center[0], p[1] - cur.center[1], p[2] - cur.center[2]);
      return root.localToWorld(out);
    }

    // Surfaces that can hide an anchor: visible, mostly opaque, depth-tested meshes.
    function occluders() {
      var list = [];
      root.traverseVisible(function (o) {
        if (!o.isMesh || !o.geometry) return;
        var ms = Array.isArray(o.material) ? o.material : [o.material];
        var m = ms[0];
        if (!m || m.visible === false || m.depthTest === false || m.colorWrite === false) return;
        if (m.transparent && m.opacity < OCC_MIN_OPACITY) return;
        list.push(o);
      });
      return list;
    }

    function clippedAway(hit) {
      var m = hit.object.material;
      m = Array.isArray(m) ? m[0] : m;
      var planes = m && m.clippingPlanes;
      if (!planes || !planes.length) return false;
      for (var i = 0; i < planes.length; i++) if (planes[i].distanceToPoint(hit.point) < 0) return true;
      return false;
    }

    // An anchor is hidden when the first opaque surface on the ray from the camera belongs to an
    // object that the ray has already left again before reaching the anchor (the anchor is not on
    // or inside that object) and that surface lies more than OCC_TOL in front of the anchor.
    // Cost: one raycast per label, run only when the view settles (not while dragging).
    function occlusion() {
      if (!occMeshes) occMeshes = occluders();
      root.updateMatrixWorld(true);
      var camPos = cam.position;
      // Count both faces (entry and exit) whatever side the material renders, so parity works.
      var sides = occMeshes.map(function (o) { var m = Array.isArray(o.material) ? o.material[0] : o.material; var sd = m.side; m.side = THREE.DoubleSide; return [m, sd]; });
      try { return occlusionRays(camPos); } finally { sides.forEach(function (ms) { ms[0].side = ms[1]; }); }
    }
    function hiddenPoint(p, camPos) {
      labelWorld(p, tmp);
      var dist = tmp.distanceTo(camPos);
      if (dist <= OCC_TOL) return false;
      tmpDir.copy(tmp).sub(camPos).normalize();
      raycaster.set(camPos, tmpDir);
      raycaster.near = 0; raycaster.far = dist + OCC_TOL;
      var hits = raycaster.intersectObjects(occMeshes, false).filter(function (hh) { return !clippedAway(hh); });
      if (!hits.length || hits[0].distance >= dist - OCC_TOL) return false;
      var first = hits[0].object, n = 0;
      for (var i = 0; i < hits.length && hits[i].distance < dist; i++) if (hits[i].object === first) n++;
      return n % 2 === 0; // even: the ray entered and left the first object before the anchor
    }
    // A point on a mesh surface is visible when it is itself the first opaque hit from the camera.
    function surfaceVisible(p, camPos) {
      labelWorld(p, tmp);
      var dist = tmp.distanceTo(camPos);
      tmpDir.copy(tmp).sub(camPos).normalize();
      raycaster.set(camPos, tmpDir);
      raycaster.near = 0; raycaster.far = dist + OCC_TOL;
      var hits = raycaster.intersectObjects(occMeshes, false).filter(function (hh) { return !clippedAway(hh); });
      return !hits.length || hits[0].distance >= dist - SURF_TOL;
    }
    var ON_SAMPLES = 400, ON_TRIES = 48, vtx = new THREE.Vector3();
    // Vertices of the label's `on` mesh(es) in label coordinates, nearest to p first.
    function onCandidates(l) {
      var objs = [], out = [], c = cur.center;
      (Array.isArray(l.on) ? l.on : [l.on]).forEach(function (o) {
        if (o) o.traverseVisible(function (m) { if (m.isMesh) objs.push(m); }); // a mesh, or every mesh in a group
      });
      var camPos = cam.position, nm = new THREE.Matrix3(), nv = new THREE.Vector3(), wv = new THREE.Vector3();
      objs.forEach(function (o) {
        if (!o.geometry || !o.geometry.attributes.position) return;
        o.updateWorldMatrix(true, false);
        nm.getNormalMatrix(o.matrixWorld);
        var pos = o.geometry.attributes.position, nrm = o.geometry.attributes.normal;
        var mt = Array.isArray(o.material) ? o.material[0] : o.material, planes = (mt && mt.clippingPlanes) || [];
        // sample through the index when there is one: only vertices of drawn triangles
        var ix = o.geometry.index, cnt = ix ? ix.count : pos.count;
        var step = Math.max(1, Math.floor(cnt / ON_SAMPLES));
        for (var jj = 0; jj < cnt; jj += step) {
          var j = ix ? ix.getX(jj) : jj;
          vtx.fromBufferAttribute(pos, j); o.localToWorld(vtx);
          var cut = false;
          for (var q = 0; q < planes.length; q++) if (planes[q].distanceToPoint(vtx) < 0) cut = true;
          if (cut) continue; // clipped away: not drawn
          wv.copy(vtx).project(cam);
          if (wv.x < -0.94 || wv.x > 0.94 || wv.y < -0.94 || wv.y > 0.94 || wv.z > 1) continue; // off the stage
          if (nrm) { // only points that face the camera (not grazing silhouettes)
            nv.fromBufferAttribute(nrm, j).applyMatrix3(nm).normalize();
            wv.copy(camPos).sub(vtx).normalize();
            var f = nv.dot(wv);
            if (Math.abs(f) < 0.2) continue; // abs: double-sided parts may have inward normals
          }
          root.worldToLocal(vtx);
          out.push([vtx.x + c[0], vtx.y + c[1], vtx.z + c[2]]);
        }
      });
      var d2 = function (q) { return (q[0] - l.p[0]) * (q[0] - l.p[0]) + (q[1] - l.p[1]) * (q[1] - l.p[1]) + (q[2] - l.p[2]) * (q[2] - l.p[2]); };
      out.sort(function (a, b) { return d2(a) - d2(b); });
      // the nearest ON_TRIES / 2, then an even spread over the rest (the visible stretch may be far)
      var head = out.slice(0, ON_TRIES / 2), rest = out.slice(ON_TRIES / 2), k = Math.max(1, rest.length / (ON_TRIES / 2));
      for (var r = 0; r < rest.length; r += k) head.push(rest[Math.floor(r)]);
      return head;
    }
    // Sets anchorIdx (0 = p, k = alt[k-1], -1 = onPts[i]) to the first visible candidate;
    // returns hidden flags.
    function occlusionRays(camPos) {
      return labels.map(function (l, i) {
        var cands = l.on ? [] : [l.p].concat(l.alt || []);
        for (var k = 0; k < cands.length; k++) {
          if (!hiddenPoint(cands[k], camPos)) { anchorIdx[i] = k; return false; }
        }
        if (l.on) {
          var on = onCandidates(l);
          // try the nearest vertices first, then a spread of farther ones
          for (var t = 0; t < on.length; t++) {
            if (surfaceVisible(on[t], camPos)) { anchorIdx[i] = -1; onPts[i] = on[t]; return false; }
          }
        }
        anchorIdx[i] = 0;
        return true;
      });
    }

    function placeLabels() {
      rects = []; leads = [];
      if (!labelsOn || !labEls.length) return;
      var s = size();
      var anchors = [], idx = [], dots = [], obst = [];
      root.updateMatrixWorld(true);
      if (occDirty && !dragging) {
        try { occ = occlusion(); } catch (err) { occ = labels.map(function () { return false; }); }
        occDirty = false;
      }
      labels.forEach(function (l, i) {
        labelWorld(anchorPoint(i), tmp); tmp.project(cam);
        var e = labEls[i], le = leadEls[i];
        var dx = (tmp.x * 0.5 + 0.5) * s.w, dy = (-tmp.y * 0.5 + 0.5) * s.h;
        var inStage = dx >= 0 && dy >= 0 && dx <= s.w && dy <= s.h;
        // behind the camera, or off the stage (e.g. a narrow phone): a label with nothing to point
        // at is hidden rather than pinned to the edge
        if (tmp.z > 1 || !inStage) { e.style.display = 'none'; le.g.style.display = 'none'; return; }
        e.style.display = 'block'; le.g.style.display = '';
        if (!labSizes[i]) labSizes[i] = { w: e.offsetWidth, h: e.offsetHeight };
        var sz = labSizes[i];
        var rx = dx + LABEL_GAP, lx = dx - LABEL_GAP - sz.w, left = l.side === 'left';
        anchors.push({ x: left ? lx : rx, lx: left ? rx : lx, y: dy - sz.h / 2, w: sz.w, h: sz.h });
        dots.push({ x: dx, y: dy });
        obst.push({ x: dx - DOT_R - 1, y: dy - DOT_R - 1, w: 2 * DOT_R + 2, h: 2 * DOT_R + 2 });
        idx.push(i);
      });
      var pos = window.KitLabels.layoutLabels(anchors, { w: s.w, h: s.h }, obst);
      pos.forEach(function (p, k) {
        var i = idx[k], e = labEls[i], le = leadEls[i], a = anchors[k], d = dots[k];
        e.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)';
        var hidden = !!occ[i];
        if (cssLeaders) {
          e.classList.toggle('is-occluded', hidden); le.g.classList.toggle('is-occluded', hidden);
        } else {
          e.style.opacity = hidden ? '0.7' : '';
          e.style.borderStyle = hidden ? 'dashed' : '';
        }
        rects.push({ x: p.x, y: p.y, w: a.w, h: a.h });
        // leader: from the anchor dot to the nearest point of the label chip
        var ex = Math.max(p.x, Math.min(d.x, p.x + a.w)), ey = Math.max(p.y, Math.min(d.y, p.y + a.h));
        [le.halo, le.line].forEach(function (ln) {
          ln.setAttribute('x1', d.x.toFixed(1)); ln.setAttribute('y1', d.y.toFixed(1));
          ln.setAttribute('x2', ex.toFixed(1)); ln.setAttribute('y2', ey.toFixed(1));
        });
        le.dot.setAttribute('cx', d.x.toFixed(1)); le.dot.setAttribute('cy', d.y.toFixed(1));
        if (!cssLeaders) {
          le.line.setAttribute('stroke-dasharray', hidden ? '3 3' : '');
          le.dot.setAttribute('fill', hidden ? 'rgba(15,20,27,0.9)' : '#f2f5fa');
          le.dot.setAttribute('stroke', hidden ? '#f2f5fa' : 'rgba(15,20,27,0.9)');
        }
        leads.push({ ax: d.x, ay: d.y, x2: ex, y2: ey, len: Math.hypot(ex - d.x, ey - d.y), occluded: hidden, label: i });
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
      if (window.ResizeObserver) new ResizeObserver(function () { resize(); occDirty = true; if (cur) frame(true); }).observe(canvas);
      window.addEventListener('resize', resize);

      // Orbit (one pointer) and pinch / wheel zoom.
      var pts = {}, pinch0 = 0, zoom0 = 0, wheelT = 0;
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
        dragging = true;
      });
      function up(e) {
        delete pts[e.pointerId];
        if (!count()) { canvas.classList.remove('dragging'); dragging = false; occDirty = true; }
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
        clearTimeout(wheelT);
        wheelT = setTimeout(function () { occDirty = true; }, 150);
      }, { passive: false });
    }

    function open(id, state) {
      var def = scenes[id];
      if (!def) return false;
      cur = def;
      st = initialState(def, state);
      root.rotation.set(def.rot[0], def.rot[1], 0);
      cam.position.z = def.zoom;
      occDirty = true;
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
      var br = bgRGB[0], bgg = bgRGB[1], bb = bgRGB[2];
      for (var i = 0; i < px.length; i += 4) {
        if (Math.abs(px[i] - br) + Math.abs(px[i + 1] - bgg) + Math.abs(px[i + 2] - bb) > 24) return true;
      }
      return false;
    }

    return {
      available: !!renderer,
      open: open,
      setLabelsVisible: setLabelsVisible,
      setBackground: setBackground,
      getState: function () { return Object.assign({}, st); },
      debug: function () {
        return {
          labelRects: rects.map(function (r) { return { x: r.x, y: r.y, w: r.w, h: r.h }; }),
          // per placed label (same order as labelRects): anchor dot, leader end on the chip, length,
          // and whether the anchor is hidden behind another surface; null when the anchor is off-stage
          leaders: leads.map(function (d) { return d && { ax: d.ax, ay: d.ay, x2: d.x2, y2: d.y2, len: d.len, occluded: d.occluded, text: labels[d.label].t, behind: !!labels[d.label].behind }; }),
          // computed lazily: rendering + readPixels is costly on software GL
          get nonBlank() { return nonBlank(); },
          rot: [root.rotation.x, root.rotation.y],
          // Authoring aid: the surfaces under stage pixel (x, y), nearest first (up to 4, including
          // see-through ones). Each: mesh name, opacity, the hit in that mesh's own frame (e.g. mesh cm
          // for a baked part) and in scene label coordinates (what a label's p takes). The first entry
          // with opaque: true is what hides anchors behind it.
          pick: function (x, y) {
            if (!cur) return [];
            var s = size(), list = [];
            root.updateMatrixWorld(true);
            root.traverseVisible(function (o) { if (o.isMesh && o.geometry) list.push(o); });
            var occl = occluders();
            raycaster.setFromCamera(new THREE.Vector2(x / s.w * 2 - 1, -(y / s.h) * 2 + 1), cam);
            raycaster.near = 0; raycaster.far = Infinity;
            var r2 = function (v) { return [v.x, v.y, v.z].map(function (n) { return Math.round(n * 100) / 100; }); };
            return raycaster.intersectObjects(list, false).filter(function (hh) { return !clippedAway(hh); }).slice(0, 4).map(function (hit) {
              var m = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
              var sc = root.worldToLocal(hit.point.clone()).add(new THREE.Vector3(cur.center[0], cur.center[1], cur.center[2]));
              return { object: hit.object.name || hit.object.type, tissue: m.userData.tissue || null,
                color: m.color ? '#' + m.color.getHexString() : null, opacity: m.opacity, opaque: occl.indexOf(hit.object) >= 0,
                local: r2(hit.object.worldToLocal(hit.point.clone())), scene: r2(sc) };
            });
          },
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
    tissue: tissue,
    tissueKinds: function () { return Object.keys(TISSUE); },
    meshPart: meshPart,
    meshParts: meshParts,
    meshInfo: meshInfo,
  };
})();
