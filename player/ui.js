/* Sagittal figure page. Classic script: sets window.SagittalUI. Needs Kit, SagittalPlayer and
 * player/figure.css; the organ meshes must be loaded before mount() (the player reads them).
 *
 *   SagittalUI.mount({ resolved, root?, credits?, organs?, state?, plate? }) -> figure
 *     Builds the page into root (default document.body): running head, plate number and title,
 *     the 3D stage with the orientation note, the control row (view, organ toggles, labels, Save
 *     as image) and the info panel (claims with their references, "Changed from base anatomy",
 *     credits). Sets window.viewer (the Kit viewer) and window.figure.
 *     credits: site/meshes/credits.json (default window.SagittalCredits); Task 6 passes it in.
 *     plate: the plate number (default 1), shown as "Plate I".
 *     The stage's clear colour follows the --stage token of figure.css (paper in light mode, warm
 *     dark in dark mode) and the leaders take their colours from figure.css (leaderStyle 'css').
 *   figure.snapshot({ labels? }) -> Promise<PNG data URL>
 *     The stage at its device-pixel size: the WebGL canvas, the orientation note, a footer line
 *     (Sagittal · Plate I · title · view) and, when labels is true (default: the page's Labels
 *     toggle), the anchor dots, leaders and italic captions drawn from viewer.debug() geometry in
 *     the page's computed label styles. The page is left as it was.
 *   figure.save() downloads that image as <slug>-<view>.png.
 *   SagittalUI.infoHtml(ctx) is the info panel markup; the player calls it on every build.
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function slug(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'figure';
  }
  function roman(n) {
    n = Math.max(1, Math.min(3999, Math.floor(n) || 1));
    var r = '', t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    t.forEach(function (p) { while (n >= p[0]) { r += p[1]; n -= p[0]; } });
    return r;
  }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function uniq(a) { var out = []; a.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); return out; }

  /* ---------- info panel ---------- */
  var OPS = { route: 'Drawn as a new path', branch: 'Drawn as a branch', duplicate: 'Duplicated', remove: 'Removed', move_insertion: 'Insertion moved' };

  // ctx: { spec (resolved), references (SagittalOrgans.references), name(ref) -> library name,
  //        credit (credits line, may be empty) }
  function infoHtml(ctx) {
    var R = ctx.spec, refs = ctx.references || {}, nameOf = ctx.name || function (x) { return x; };
    // references numbered in order of first citation
    var cited = [];
    R.claims.forEach(function (c) { c.refs.forEach(function (r) { if (refs[r] && cited.indexOf(r) < 0) cited.push(r); }); });
    var h = '<section class="fig-claims"><h2>Claims</h2><ol>';
    R.claims.forEach(function (c, i) {
      var links = c.refs.filter(function (r) { return refs[r]; }).map(function (r) {
        return '<a class="ref" href="' + esc(refs[r].url) + '" target="_blank" rel="noopener" title="' + esc(refs[r].title) + '">[' + (cited.indexOf(r) + 1) + ']</a>';
      }).join('');
      h += '<li><span class="n">' + (i + 1) + '.</span><span>' + esc(c.text) + (links ? ' ' + links : '') + '</span></li>';
    });
    h += '</ol></section>';
    if (cited.length) {
      h += '<section class="fig-refs"><h2>References</h2><ol>';
      cited.forEach(function (r, i) {
        h += '<li id="ref-' + esc(r) + '"><span class="n">[' + (i + 1) + ']</span><span><a href="' + esc(refs[r].url) + '" target="_blank" rel="noopener">' +
          esc(refs[r].title) + '</a><span class="host">' + esc(host(refs[r].url)) + '</span></span></li>';
      });
      h += '</ol></section>';
    }
    // names of the spec's own structures (route ids), for "on" lists
    var own = {};
    (R.provenance || []).forEach(function (pv) { if (!own[pv.structure]) own[pv.structure] = pv.name || pv.structure; });
    function label(x) { return x.indexOf('/') >= 0 ? nameOf(x) : (own[x] || x); }
    // Library names carry source notes after a colon or in a closing parenthesis
    // ("Portal confluence: union of ..."; "Bile duct (common bile duct)"):
    // the list shows the name, the note stays in the tooltip.
    function shortName(full) { return full.split(': ')[0].replace(/\s*\([^()]*\)\s*$/, ''); }
    function item(full) {
      var short = shortName(full);
      return short === full ? esc(full) : '<span title="' + esc(full) + '">' + esc(short) + '</span>';
    }
    function items(list) { // short names, once each
      var seen = {}, out = [];
      list.forEach(function (x) { var k = shortName(x); if (!seen[k]) { seen[k] = 1; out.push(item(x)); } });
      return out.join(', ');
    }
    h += '<section class="fig-provenance"><h2>Changed from base anatomy</h2><ul>';
    (R.provenance || []).forEach(function (pv) {
      var both = pv.view === 'both';
      var on = uniq((pv.on || []).map(label)), via = uniq((pv.via || []).map(label));
      h += '<li data-structure="' + esc(pv.structure) + '"><div class="pv-head"><span class="pv-name">' + esc(pv.name || pv.structure) + '</span>' +
        '<span class="pv-view' + (both ? '' : ' is-variant') + '">' + (both ? 'Both views' : 'Variant') + '</span></div>' +
        '<p class="pv-op">' + esc(OPS[pv.op] || pv.op) + '</p>';
      if (on.length || via.length) {
        h += '<dl class="pv-via">';
        if (on.length) h += '<dt>On</dt><dd>' + items(on) + '</dd>';
        if (via.length) h += '<dt>Through</dt><dd>' + items(via) + '</dd>';
        h += '</dl>';
      }
      h += '</li>';
    });
    h += '</ul></section>';
    if (ctx.credit) h += '<p class="fig-credit">' + esc(ctx.credit) + '</p>';
    return h;
  }

  /* ---------- page ---------- */
  function build(root, R, plateName) {
    var fig = el('div', 'fig');
    var run = el('p', 'fig-run');
    run.appendChild(el('span', 'fig-mark', 'Sagittal'));
    run.appendChild(el('span', null, (R.topic ? R.topic + ' \u00b7 ' : '') + 'Anatomical variant'));
    fig.appendChild(run);
    var head = el('header', 'fig-head');
    head.appendChild(el('p', 'fig-no', plateName));
    head.appendChild(el('h1', 'fig-title', R.title));
    fig.appendChild(head);

    var plate = el('figure', 'fig-plate');
    var stage = el('div', 'fig-stage'); stage.id = 'stage';
    var cv = el('canvas'); cv.id = 'cv';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', R.title + ': 3D figure, drag to rotate');
    var labels = el('div'); labels.id = 'labels';
    var orient = el('p', 'fig-orient'); orient.id = 'orient'; orient.setAttribute('aria-live', 'polite');
    var hint = el('p', 'fig-hint', 'Drag to rotate · scroll to zoom');
    stage.append(cv, orient, labels, hint);

    var bar = el('div', 'fig-bar');
    var view = el('div', 'fig-view');
    var organs = el('fieldset', 'fig-organs');
    var lg = el('legend', 'fig-k', 'Show'); organs.appendChild(lg);
    var opts = el('div', 'opts'); organs.appendChild(opts);
    var actions = el('div', 'fig-actions');
    actions.appendChild(el('span', 'fig-k', 'Figure'));
    var row = el('div', 'row');
    var lw = el('div', 'chk');
    var lt = el('input'); lt.type = 'checkbox'; lt.id = 'labels-toggle'; lt.checked = true;
    var ll = el('label', null, 'Labels'); ll.htmlFor = 'labels-toggle';
    lw.append(lt, ll);
    var save = el('button', 'fig-btn', 'Save as image'); save.type = 'button';
    row.append(lw, save); actions.appendChild(row);
    bar.append(view, organs, actions);
    plate.append(stage, bar);
    fig.appendChild(plate);

    var info = el('div', 'fig-info'); info.id = 'info';
    fig.appendChild(info);
    root.appendChild(fig);
    return { fig: fig, stage: stage, cv: cv, labels: labels, orient: orient, view: view, opts: opts, toggle: lt, save: save, info: info };
  }

  function mount(o) {
    o = o || {};
    var R = o.resolved, root = o.root || document.body;
    var plateName = 'Plate ' + roman(o.plate || 1);
    var D = build(root, R, plateName);
    document.title = R.title + ' · Sagittal';
    var def = window.SagittalPlayer.register(R, { credits: o.credits || window.SagittalCredits || null, organs: o.organs, orientEl: D.orient });
    var staging = el('div'); // the kit builds its controls here; they are moved into the control row
    function stageColour() { return getComputedStyle(D.stage).backgroundColor; }
    var viewer = window.Kit.createViewer({ canvas: D.cv, labelsEl: D.labels, controlsEl: staging, infoEl: D.info,
      background: stageColour(), leaderStyle: 'css' });
    // the clear colour follows the theme (prefers-color-scheme, or data-theme on <html>)
    function retone() { viewer.setBackground(stageColour()); }
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', retone); else if (mq.addListener) mq.addListener(retone);
    }
    if (window.MutationObserver) new MutationObserver(retone).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    viewer.open(def.id, o.state || {});
    Array.prototype.slice.call(staging.children).forEach(function (c) {
      (c.classList.contains('chk') ? D.opts : D.view).appendChild(c);
    });
    var labelsOn = true;
    D.toggle.onchange = function () { labelsOn = D.toggle.checked; viewer.setLabelsVisible(labelsOn); };

    function viewKey() { return viewer.getState().v || 'variant'; }
    function viewName() { return viewKey() === 'normal' ? 'Normal anatomy' : R.variant.label; }

    function snapshot(so) {
      so = so || {};
      var want = so.labels === undefined ? labelsOn : !!so.labels;
      try {
        // draw a fresh frame (and lay the labels out when they are wanted but hidden)
        viewer.setLabelsVisible(want);
        var url = composite(want);
        return Promise.resolve(url);
      } catch (e) {
        return Promise.reject(e);
      } finally {
        if (want !== labelsOn) viewer.setLabelsVisible(labelsOn);
      }
    }

    function composite(withLabels) {
      var src = D.cv, W = src.width, H = src.height, k = W / (src.clientWidth || W);
      var out = document.createElement('canvas'); out.width = W; out.height = H;
      var g = out.getContext('2d');
      g.drawImage(src, 0, 0, W, H);
      var cs = getComputedStyle(D.stage);
      var tok = function (n, d) { return (cs.getPropertyValue(n) || '').trim() || d; };
      var stageInk = tok('--stage-ink', '#2a251e'), mut = tok('--stage-mut', '#6a6152'), knock = tok('--stage-knock', 'rgba(238,231,216,.92)');
      var sb = D.stage.getBoundingClientRect();
      function fontOf(c) { return c.fontStyle + ' ' + c.fontWeight + ' ' + parseFloat(c.fontSize) * k + 'px ' + c.fontFamily; }

      // orientation note, where it sits on the stage (wrapped as on the page)
      var text = D.orient.textContent;
      if (text) {
        var oc = getComputedStyle(D.orient), r = D.orient.getBoundingClientRect();
        var x = (r.left - sb.left) * k, y = (r.top - sb.top) * k, w = r.width * k, h = r.height * k;
        g.fillStyle = oc.backgroundColor; g.fillRect(x, y, w, h);
        g.font = fontOf(oc);
        g.fillStyle = oc.color; g.textBaseline = 'middle';
        var pl = parseFloat(oc.paddingLeft) * k, pt = parseFloat(oc.paddingTop) * k;
        var lh = (parseFloat(oc.lineHeight) || parseFloat(oc.fontSize) * 1.35) * k;
        wrap(text, w - pl - parseFloat(oc.paddingRight) * k).forEach(function (line, i) {
          g.fillText(line, x + pl, y + pt + lh * (i + 0.5));
        });
      }

      // footer line, bottom right: Sagittal · Plate I · title · view
      var fs = 12.5 * k, m = 10 * k, fam = tok('--serif', 'Georgia, serif');
      g.font = 'italic 400 ' + fs + 'px ' + fam;
      var head = 'Sagittal · ' + plateName + ' · ', tail = ' · ' + viewName(), title = R.title, maxW = W - 2 * m - 10 * k;
      var foot = head + title + tail;
      while (g.measureText(foot).width > maxW && title.length > 8) { title = title.slice(0, -2); foot = head + title.replace(/\s+$/, '') + '…' + tail; }
      var fw = g.measureText(foot).width, fh = fs * 1.55, fx = W - m - fw - 10 * k, fy = H - m - fh;
      g.fillStyle = knock; g.fillRect(fx, fy, fw + 10 * k, fh);
      g.fillStyle = mut; g.textBaseline = 'middle'; g.fillText(foot, fx + 5 * k, fy + fh / 2);

      if (withLabels) drawLabels(g, k, stageInk);
      return out.toDataURL('image/png');

      function wrap(t, maxw) {
        var words = t.split(' '), lines = [], cur = '';
        words.forEach(function (wd) {
          var next = cur ? cur + ' ' + wd : wd;
          if (cur && g.measureText(next).width > maxw + 0.5) { lines.push(cur); cur = wd; } else cur = next;
        });
        if (cur) lines.push(cur);
        return lines;
      }
    }

    // The page's label style (figure.css): a paper halo under a fine ink leader, a small ink dot,
    // and an italic caption on a knocked-out patch of paper. Hidden anchors (drawn x-ray style) get
    // a dashed leader, a hollow dot and a muted caption. Colours and sizes are read from the
    // rendered elements, so the image matches the page in either theme.
    function drawLabels(g, k, fallbackInk) {
      var d = viewer.debug(), rects = d.labelRects, leads = d.leaders;
      function px(v, def) { var n = parseFloat(v); return isFinite(n) ? n : def; }
      function svgStyle(sel, occluded) {
        var e = D.labels.querySelector((occluded ? '.is-occluded ' : '.kit-leaders g:not(.is-occluded) ') + sel) ||
          D.labels.querySelector('.kit-leaders ' + sel);
        return e ? getComputedStyle(e) : null;
      }
      function look(occluded) {
        var h = svgStyle('.kit-halo', occluded), l = svgStyle('.kit-leader', occluded), a = svgStyle('.kit-anchor', occluded);
        var stage = getComputedStyle(D.stage).backgroundColor;
        return {
          halo: h ? h.stroke : stage, haloW: h ? px(h.strokeWidth, 3) : 3,
          line: l ? l.stroke : fallbackInk, lineW: l ? px(l.strokeWidth, 0.9) : 0.9,
          dash: occluded ? [2.5, 2.5] : [],
          dotR: a ? px(a.r, 2.4) : 2.4, dotFill: a ? a.fill : (occluded ? stage : fallbackInk),
          dotStroke: a ? a.stroke : stage, dotW: a ? px(a.strokeWidth, 1.4) : 1.4,
        };
      }
      var L = { false: look(false), true: look(true) };
      g.save();
      g.lineCap = 'round';
      leads.forEach(function (l) {
        if (!l) return;
        var s = L[!!l.occluded];
        g.setLineDash([]);
        g.strokeStyle = s.halo; g.lineWidth = s.haloW * k;
        g.beginPath(); g.moveTo(l.ax * k, l.ay * k); g.lineTo(l.x2 * k, l.y2 * k); g.stroke();
        g.setLineDash(s.dash.map(function (v) { return v * k; }));
        g.strokeStyle = s.line; g.lineWidth = s.lineW * k;
        g.beginPath(); g.moveTo(l.ax * k, l.ay * k); g.lineTo(l.x2 * k, l.y2 * k); g.stroke();
        g.setLineDash([]);
        g.beginPath(); g.arc(l.ax * k, l.ay * k, s.dotR * k, 0, Math.PI * 2);
        g.fillStyle = s.dotFill; g.fill();
        g.strokeStyle = s.dotStroke; g.lineWidth = s.dotW * k; g.stroke();
      });
      g.restore();
      function fontOf(c) { return c.fontStyle + ' ' + c.fontWeight + ' ' + parseFloat(c.fontSize) * k + 'px ' + c.fontFamily; }
      var labs = D.labels.querySelectorAll('.lab');
      rects.forEach(function (r, i) {
        var l = leads[i];
        if (!l) return;
        // the label element with this text (labels are unique per figure)
        var e = null;
        for (var j = 0; j < labs.length; j++) if (labs[j].textContent === l.text) { e = labs[j]; break; }
        var c = e ? getComputedStyle(e) : null;
        var x = r.x * k, y = r.y * k, w = r.w * k, h = r.h * k;
        g.save();
        g.fillStyle = c ? c.backgroundColor : 'rgba(0,0,0,0)'; g.fillRect(x, y, w, h);
        g.font = c ? fontOf(c) : 'italic 400 ' + 14.5 * k + 'px Georgia, serif';
        g.fillStyle = c ? c.color : fallbackInk; g.textBaseline = 'middle';
        var pl = c ? (parseFloat(c.paddingLeft) + parseFloat(c.borderLeftWidth)) * k : 4 * k;
        var pt = c ? parseFloat(c.paddingTop) * k : 0, pb = c ? parseFloat(c.paddingBottom) * k : 0;
        g.fillText(l.text, x + pl, y + pt + (h - pt - pb) / 2 + 0.5 * k);
        g.restore();
      });
    }

    function save() {
      D.save.disabled = true;
      return snapshot().then(function (url) {
        var a = document.createElement('a');
        a.href = url; a.download = slug(R.title) + '-' + viewKey() + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        return a.download;
      }).finally(function () { D.save.disabled = false; });
    }
    D.save.onclick = function () { save(); };

    var figure = { snapshot: snapshot, save: save, viewer: viewer, slug: slug(R.title), view: viewKey, el: D };
    window.viewer = viewer;
    window.figure = figure;
    return figure;
  }

  window.SagittalUI = { mount: mount, infoHtml: infoHtml, slug: slug };
})();
