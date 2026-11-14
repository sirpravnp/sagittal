// Page glue for index.html (gallery) and viewer.html. Classic script, loaded after kit/kit.js.
(function () {
  var BADGE = 'Unreviewed: verify against your textbook';

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
  function badge(meta) {
    return meta.status === 'unreviewed' ? el('span', 'badge', BADGE) : null;
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

  function renderGallery(container, notFoundId) {
    container.innerHTML = '';
    if (notFoundId != null) {
      var nf = el('p', 'notice', 'Scene not found: "' + notFoundId + '". Pick one below.');
      container.appendChild(nf);
    }
    var list = el('ul', 'cards');
    container.appendChild(list);
    return getJson('scenes/index.json').then(function (ids) {
      return Promise.all(ids.map(function (id) { return getJson('scenes/' + id + '.meta.json'); }));
    }).then(function (metas) {
      renderDecks(metas);
      metas.forEach(function (m) {
        var li = el('li', 'card');
        var a = el('a', null, m.title);
        a.href = 'viewer.html?scene=' + encodeURIComponent(m.id);
        li.appendChild(a);
        li.appendChild(el('span', 'topic', m.topic));
        var b = badge(m); if (b) li.appendChild(b);
        list.appendChild(li);
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
    var topics = [];
    metas.forEach(function (m) { if (topics.indexOf(m.topic) < 0) topics.push(m.topic); });
    topics.forEach(function (t) {
      var slug = deckSlug(t);
      var li = el('li', 'card');
      var a = el('a', null, t + ' deck');
      a.href = 'decks/' + slug + '.apkg';
      a.setAttribute('download', '');
      li.appendChild(a);
      var a3 = el('a', 'topic', '3D (experimental)');
      a3.href = 'decks/' + slug + '-3d.apkg';
      a3.setAttribute('download', '');
      li.appendChild(a3);
      list.appendChild(li);
    });
    section.hidden = topics.length === 0;
  }

  function initGallery() {
    renderGallery(document.getElementById('gallery')).catch(function (e) {
      document.getElementById('gallery').textContent = 'Could not load the scene list. ' + e.message;
    });
  }

  function initViewer() {
    var params = new URLSearchParams(location.search);
    var id = params.get('scene') || '';
    var state = {};
    params.forEach(function (v, k) { if (k !== 'scene' && k !== 'embed') state[k] = v; });
    if (params.get('embed') === '1') document.body.classList.add('embed');

    function notFound() {
      document.body.classList.add('missing');
      document.title = 'Scene not found · sagittal';
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
        document.title = meta.title + ' · sagittal';
        document.querySelector('h1').textContent = meta.title;
        var b = badge(meta);
        if (b) {
          document.getElementById('badge').appendChild(b);
          // overlay copy inside the stage, shown in embed mode where the header is hidden
          document.getElementById('stage-badge').appendChild(badge(meta));
        }
        var claims = document.getElementById('claims');
        meta.claims.forEach(function (c) { claims.appendChild(el('li', null, c)); });
        if (meta.sources.length) {
          var src = document.getElementById('sources');
          meta.sources.forEach(function (s) { src.appendChild(el('li', null, s)); });
          src.parentNode.hidden = false;
        }
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
