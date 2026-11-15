// Page glue for index.html (gallery) and viewer.html. Classic script, loaded after kit/kit.js.
(function () {
  function getJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
      return r.json();
    });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = function () { reject(new Error('could not load ' + src)); };
      document.body.appendChild(s);
    });
  }

  // Loads site/meshes/<name>.js for every mesh a registered scene lists in `meshes: [...]`.
  // Each file assigns window.SagittalMeshes[name]; already-loaded meshes are skipped.
  function loadMeshes(sceneId) {
    var def = window.Kit && Kit.get(sceneId);
    var names = (def && def.meshes) || [];
    return Promise.all(names.map(function (n) {
      if (window.SagittalMeshes && window.SagittalMeshes[n]) return null;
      return loadScript('meshes/' + encodeURIComponent(n) + '.js');
    }));
  }

  // Attribution line for one scene, from meshes/credits.json (same rule as tools/build_decks.py
  // scene_source_ids/credit_text): the credit ids of the scene's meshes plus listed extras.
  function sceneCredit(sceneId, credits) {
    var def = window.Kit && Kit.get(sceneId);
    var src = credits.sources || {}, extra = credits.extra || {}, ids = [];
    function addId(c) { if (c && src[c] && ids.indexOf(c) < 0) ids.push(c); }
    ((def && def.meshes) || []).forEach(function (m) {
      var info = null;
      try { info = Kit.meshInfo(m); } catch (e) { info = null; }
      addId(info && info.credit);
      (extra['mesh:' + m] || []).forEach(addId);
    });
    (extra['scene:' + sceneId] || []).forEach(addId);
    if (!ids.length) return credits.procedural || '';
    return '3D models: ' + ids.map(function (c) { return src[c].text + ', ' + src[c].licence; }).join('; ') + '. ' + (credits.changes || '');
  }

  // Same rule as tools/render_thumbs.mjs plateVariant(): the first view that is not the normal reference.
  function plateVariant(meta) {
    var v = meta.variants;
    return v.length > 1 && /^norm/i.test(v[0].key) ? v[1] : v[0];
  }

  // Thumbnails are optional: site/thumbs/manifest.json lists the scenes that have one
  // (npm run thumbs). A scene missing from it gets a plain text plate, never a broken image.
  function getThumbs() {
    return getJson('thumbs/manifest.json').catch(function () { return {}; });
  }

  function roman(n) {
    var r = '', t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    t.forEach(function (p) { while (n >= p[0]) { r += p[1]; n -= p[0]; } });
    return r;
  }

  function plate(meta, n, thumb) {
    var li = el('li', 'card plate');
    var fig = el('figure');
    var shown = plateVariant(meta);
    var frame = el('div', 'plate-img');
    function empty() {
      frame.innerHTML = '';
      frame.className = 'plate-img empty';
      frame.appendChild(el('span', 'empty-title', meta.title));
      frame.appendChild(el('span', 'empty-note', 'No preview image yet'));
    }
    if (thumb && thumb.file) {
      var img = el('img');
      img.src = 'thumbs/' + encodeURIComponent(thumb.file);
      img.width = thumb.width || 1440; img.height = thumb.height || 1080;
      img.loading = 'lazy'; img.decoding = 'async';
      img.alt = meta.title + ', ' + shown.label + ' view';
      img.onerror = empty;
      frame.appendChild(img);
    } else {
      empty();
    }
    fig.appendChild(frame);
    var cap = el('figcaption');
    var h = el('p', 'plate-title');
    h.appendChild(el('span', 'fig', 'Plate ' + roman(n)));
    var a = el('a', null, meta.title);
    a.href = 'viewer.html?scene=' + encodeURIComponent(meta.id);
    h.appendChild(a);
    cap.appendChild(h);
    cap.appendChild(el('p', 'topic', meta.topic));
    var views = el('p', 'views');
    views.appendChild(el('span', 'k', meta.variants.length === 1 ? '1 view: ' : meta.variants.length + ' views: '));
    meta.variants.forEach(function (v, i) {
      if (i) views.appendChild(document.createTextNode('; '));
      var s = el(v.key === shown.key && thumb ? 'em' : 'span', null, v.label);
      if (v.key === shown.key && thumb) s.title = 'Pictured';
      views.appendChild(s);
    });
    views.appendChild(document.createTextNode('.'));
    cap.appendChild(views);
    fig.appendChild(cap);
    li.appendChild(fig);
    return li;
  }

  function renderGallery(container, notFoundId) {
    container.innerHTML = '';
    if (notFoundId != null) {
      var nf = el('p', 'notice', 'Scene not found: "' + notFoundId + '". Pick one below.');
      container.appendChild(nf);
    }
    var list = el('ol', 'cards plates');
    container.appendChild(list);
    return Promise.all([getJson('scenes/index.json'), getThumbs()]).then(function (r) {
      var thumbs = r[1] || {};
      return Promise.all(r[0].map(function (id) { return getJson('scenes/' + id + '.meta.json'); })).then(function (metas) {
        renderDecks(metas);
        metas.forEach(function (m, i) { list.appendChild(plate(m, i + 1, thumbs[m.id])); });
        var note = document.getElementById('plates-note');
        if (note) {
          var topics = metas.map(function (m) { return m.topic; }).filter(function (t, i, all) { return all.indexOf(t) === i; });
          note.textContent = metas.length + ' figures from the library, in ' + topics.length + ' topics. Each plate shows one view, set in italics in its caption; open the scene for the rest.';
        }
      });
    });
  }

  // Same slug rule as tools/build_decks.py slugify().
  function deckSlug(topic) {
    return 'sagittal-' + topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function renderDecks(metas) {
    var section = document.getElementById('decks');
    var list = document.getElementById('deck-list');
    if (!section || !list) return;
    list.innerHTML = '';
    var topics = [], counts = {};
    metas.forEach(function (m) {
      if (topics.indexOf(m.topic) < 0) { topics.push(m.topic); counts[m.topic] = 0; }
      counts[m.topic]++;
    });
    topics.forEach(function (t) {
      var slug = deckSlug(t);
      var li = el('li', 'deck');
      li.appendChild(el('span', 'deck-topic', t));
      li.appendChild(el('span', 'deck-n', counts[t] === 1 ? '1 scene' : counts[t] + ' scenes'));
      var a = el('a', 'deck-2d', 'Deck');
      a.href = 'decks/' + slug + '.apkg';
      a.setAttribute('download', '');
      a.setAttribute('aria-label', t + ' deck');
      li.appendChild(a);
      var a3 = el('a', 'deck-3d', '3D deck');
      a3.href = 'decks/' + slug + '-3d.apkg';
      a3.setAttribute('download', '');
      a3.setAttribute('aria-label', t + ' 3D deck (experimental)');
      li.appendChild(a3);
      list.appendChild(li);
    });
    section.hidden = topics.length === 0;
  }

  // GitHub links: <meta name="sagittal-repo"> if set, else inferred from OWNER.github.io/REPO.
  // Unknown (e.g. served locally): the links are hidden rather than pointing somewhere made up.
  function repoUrl() {
    var m = document.querySelector('meta[name="sagittal-repo"]');
    var v = m && m.getAttribute('content');
    if (v) return v.replace(/\/+$/, '');
    var host = location.hostname, gh = host.match(/^([a-z0-9-]+)\.github\.io$/i);
    if (!gh) return null;
    var first = location.pathname.split('/')[1] || '';
    var repo = first && !/\.html?$/.test(first) ? first : host;
    return 'https://github.com/' + gh[1] + '/' + repo;
  }
  function wireRepoLinks() {
    var base = repoUrl();
    var items = document.querySelectorAll('[data-repo-link]');
    for (var i = 0; i < items.length; i++) {
      var a = items[i].querySelector('a');
      if (!base || !a) { items[i].hidden = true; continue; }
      var path = items[i].getAttribute('data-repo-link');
      a.href = base + (path ? '/' + path : '');
    }
  }

  // Example plates (index.html #examples): a plate whose data-figure-href is set links its title
  // to that interactive figure; empty, the plate stays an image with a caption.
  function wireExamples() {
    var items = document.querySelectorAll('[data-figure-href]');
    for (var i = 0; i < items.length; i++) {
      var href = items[i].getAttribute('data-figure-href'), t = items[i].querySelector('.plate-title .t');
      if (!href || !t) continue;
      var a = el('a', null, t.textContent); a.href = href;
      t.textContent = ''; t.appendChild(a);
    }
  }

  // Landing page: example plates, GitHub links and the deck list (from the library's scene metas).
  // A page with a #gallery element also gets the library plate grid.
  function initGallery() {
    wireRepoLinks();
    wireExamples();
    var gallery = document.getElementById('gallery');
    if (gallery) {
      renderGallery(gallery).catch(function (e) { gallery.textContent = 'Could not load the scene list. ' + e.message; });
      return;
    }
    getJson('scenes/index.json').then(function (ids) {
      return Promise.all(ids.map(function (id) { return getJson('scenes/' + id + '.meta.json'); }));
    }).then(renderDecks).catch(function () { /* no deck list */ });
  }

  function initViewer() {
    var params = new URLSearchParams(location.search);
    var id = params.get('scene') || '';
    var state = {};
    params.forEach(function (v, k) { if (k !== 'scene' && k !== 'embed') state[k] = v; });
    if (params.get('embed') === '1') document.body.classList.add('embed');

    function notFound() {
      document.body.classList.add('missing');
      document.title = 'Scene not found · Sagittal';
      document.querySelector('h1').textContent = 'Scene not found';
      return renderGallery(document.getElementById('gallery'), id);
    }

    getJson('scenes/index.json').then(function (ids) {
      if (ids.indexOf(id) < 0) return notFound();
      return Promise.all([getJson('scenes/' + id + '.meta.json'), loadScript('scenes/' + id + '.js')]).then(function (r) {
        // The scene script only registers its SceneDef; build() runs later, in open().
        // Load the baked meshes it declares (meshes: [...]) before opening it.
        return loadMeshes(id).then(function () { return r; });
      }).then(function (r) {
        var meta = r[0];
        document.title = meta.title + ' · Sagittal';
        document.querySelector('h1').textContent = meta.title;
        var fig = document.getElementById('fig');
        if (fig) fig.textContent = 'Plate ' + roman(ids.indexOf(id) + 1);
        var claims = document.getElementById('claims');
        meta.claims.forEach(function (c) { claims.appendChild(el('li', null, c)); });
        if (meta.sources.length) {
          var src = document.getElementById('sources');
          meta.sources.forEach(function (s) { src.appendChild(el('li', null, s)); });
          src.parentNode.hidden = false;
        }
        getJson('meshes/credits.json').then(function (credits) {
          var line = sceneCredit(id, credits), p = document.getElementById('scene-credit');
          if (p && line) { p.textContent = line; p.hidden = false; }
        }).catch(function () { /* the Model credits link still works */ });
        var viewer = Kit.createViewer({
          canvas: document.getElementById('cv'),
          labelsEl: document.getElementById('labels'),
          controlsEl: document.getElementById('controls'),
          infoEl: document.getElementById('info'),
        });
        window.viewer = viewer;
        var toggle = document.getElementById('labels-toggle');
        toggle.onchange = function () { viewer.setLabelsVisible(toggle.checked); };
        if (!viewer.open(id, state)) return notFound();
      });
    }).catch(function (e) {
      document.getElementById('info').textContent = 'Could not load this scene. ' + e.message;
    });
  }

  window.SagittalApp = { initGallery: initGallery, initViewer: initViewer, renderGallery: renderGallery, loadMeshes: loadMeshes };
})();
