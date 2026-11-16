/* Sagittal figure page. Classic script: sets window.SagittalUI. Needs Kit, SagittalPlayer and
 * player/figure.css; the organ meshes must be loaded before mount() (the player reads them).
 *
 *   SagittalUI.mount({ resolved, root?, credits?, organs?, state? }) -> figure
 *     Builds the page into root (default document.body): running head, title (and the variant's
 *     full name when the title does not carry it),
 *     the 3D stage, the control row (view, organ toggles, labels, Save
 *     as image) and the info panel (claims with their references, "Changed from base anatomy",
 *     credits). Sets window.viewer (the Kit viewer) and window.figure.
 *     credits: site/meshes/credits.json (default window.SagittalCredits); Task 6 passes it in.
 *     The stage's clear colour follows the --stage token of figure.css (paper in light mode, warm
 *     dark in dark mode) and the leaders take their colours from figure.css (leaderStyle 'css').
 *   figure.snapshot({ labels? }) -> Promise<PNG data URL>
 *     The stage at its device-pixel size: the WebGL canvas and, when labels is true (default:
 *     the page's Labels toggle), the anchor dots, leaders and labels drawn from viewer.debug()
 *     geometry in the page's computed label styles. No caption or footer. The page is left as it was.
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
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }

  /* ---------- info panel ---------- */
  // "Changed from base anatomy" in plain anatomical language, built from the resolved spec: what
  // the variant adds, removes or moves (first), then what is drawn from landmarks in both views.
  // Each row says where the structure arises, which landmarks it passes and how ("behind",
  // "to the right of", "toward segment IV"), in the library's own names for them.
  var DIRW = { posterior: 'behind', anterior: 'in front of', superior: 'above', inferior: 'below', left: 'to the left of', right: 'to the right of' };
  function provenanceHtml(R, nameOf) {
    var own = {}, kindOwn = {};
    (R.base || []).concat((R.variant && R.variant.edits) || []).forEach(function (e) { if (e.id) { own[e.id] = e.name || e.id; kindOwn[e.id] = e.tissue || ''; } });
    function fullName(ref) { return ref.indexOf('/') >= 0 ? nameOf(ref) : (own[ref] || ref); }
    // A readable noun phrase. Structures: source notes (after ': ', in brackets) and "curve"
    // dropped. Landmarks keep a closing location note ("(right lobe)"); "Centroid of segment IV"
    // is said as segment IV (and only ever approached: "toward segment IV").
    function phrase(ref, landmark) {
      var t = String(fullName(ref)).split(': ')[0], tail = '';
      // a short closing note on a landmark is a location ("(right lobe)"); a long one is a source note
      if (landmark) { var m = /\s*(\(([^()]*)\))\s*$/.exec(t); if (m && m[2].split(/\s+/).length <= 3 && !/[;,]/.test(m[2])) { tail = ' ' + m[1]; t = t.slice(0, m.index); } }
      t = t.replace(/\s*\([^()]*\)/g, '').replace(/ curve\b/g, '').replace(/\s+/g, ' ').trim();
      var seg = /^centroid of (segment .+)$/i.exec(t);
      if (seg) return { text: seg[1], toward: true };
      t = t.charAt(0).toLowerCase() + t.slice(1);
      if (!/^the /.test(t)) t = 'the ' + t;
      return { text: t + tail, toward: false };
    }
    // artery, vein or duct: decides "arises from" (artery), "drains into" (vein), "joins" (duct)
    function kind(ref, tissue) {
      var t = tissue || kindOwn[ref] || '', n = fullName(ref);
      if (/artery/.test(t) || (!t && /arter|aorta|trunk/i.test(n))) return 'artery';
      if (/vein/.test(t) || (!t && /vein/i.test(n))) return 'vein';
      return 'duct';
    }
    // via waypoints -> "behind the portal confluence, behind and to the right of …, along the
    // course of the proper hepatic artery". A direction word is used only where the waypoint has
    // that offset from the named landmark or line; landmark centroids are only approached.
    function route(wps, skipLines) {
      var parts = [], prev = null;
      (wps || []).forEach(function (w) {
        var ref = w.landmark || w.on, isLine = !w.landmark, ph = phrase(ref, !isLine), how;
        if (ph.toward) how = 'toward';
        else if (w.offset) how = DIRW[w.offset.dir];
        else if (isLine) { if (skipLines.indexOf(ref) >= 0) return; how = 'along the course of'; }
        else how = 'through';
        if (prev && prev.ref === ref) { if (prev.hows.indexOf(how) < 0) prev.hows.push(how); return; }
        prev = { ref: ref, ph: ph, hows: [how] };
        parts.push(prev);
      });
      return parts.map(function (p) {
        var h = p.hows;
        // to one side, behind (in front of), then to the other side of the same thing: it crosses
        var across = h.indexOf('to the left of') >= 0 && h.indexOf('to the right of') >= 0;
        if (across && h.indexOf('behind') >= 0) return 'crosses behind ' + p.ph.text;
        if (across && h.indexOf('in front of') >= 0) return 'crosses in front of ' + p.ph.text;
        return h.join(' and ') + ' ' + p.ph.text;
      });
    }
    function editFor(pv) {
      var list = pv.view === 'both' ? (R.base || []) : ((R.variant && R.variant.edits) || []);
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if ((e.id || e.structure) === pv.structure && e.op === pv.op) return e;
      }
      return null;
    }
    function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
    function sentence(pv) {
      var e = editFor(pv) || {}, k = kind(pv.structure, e.tissue);
      var join = k === 'artery' ? 'arises from' : k === 'vein' ? 'drains into' : 'joins';
      if (pv.op === 'remove') return pv.view === 'both' ? 'Not drawn.' : 'Not present in the variant.';
      if (pv.op === 'move_insertion') {
        var to = pv.on && pv.on[0] ? phrase(pv.on[0]).text : '';
        return to ? cap(join) + ' ' + to + ' instead.' : 'Its origin moves.';
      }
      var self = phrase(pv.structure).text, out = [], skip = [];
      var fromLine = e.from && e.from.on && !e.from.landmark ? e.from.on : null;
      // a route drawn on one library line from start to end follows that line
      var follows = pv.op !== 'branch' && fromLine && (e.via || []).length && (e.via || []).every(function (w) { return w.on === fromLine && !w.landmark && !w.offset; });
      if (pv.op === 'duplicate') out.push('A second ' + self.replace(/^the /, ''));
      else if (pv.op === 'branch' && fromLine) out.push(cap(join) + ' ' + phrase(fromLine).text);
      else if (follows) { out.push("Follows the base anatomy's " + phrase(fromLine).text.replace(/^the /, '')); skip.push(fromLine); }
      else if (e.from && e.from.landmark) out.push('Runs from ' + phrase(e.from.landmark, true).text);
      else if (fromLine) { out.push('Runs from ' + phrase(fromLine).text); skip.push(fromLine); }
      (e.via || []).forEach(function (w) { if (w.on && !w.landmark && phrase(w.on).text === self) skip.push(w.on); });
      var via = route(e.via, skip);
      if (via.length) {
        out.push(via.map(function (v, i) {
          if (/^crosses /.test(v)) return v;
          return (i === 0 ? 'passes ' : /^crosses /.test(via[i - 1]) ? 'then passes ' : '') + v;
        }).join(', '));
      }
      if (e.to) {
        if (e.to.landmark) {
          var tp = phrase(e.to.landmark, true);
          out.push('ends ' + (tp.toward ? 'toward ' : e.to.offset ? DIRW[e.to.offset.dir] + ' ' : 'at ') + tp.text);
        } else if (e.to.on && skip.indexOf(e.to.on) < 0 && phrase(e.to.on).text !== self) {
          var lt = phrase(e.to.on).text;
          out.push(e.to.offset ? 'ends ' + DIRW[e.to.offset.dir] + ' ' + lt : (k === 'artery' ? 'ends on ' : join + ' ') + lt);
        }
      }
      if (!out.length) return '';
      var lead = pv.view === 'both' || pv.op === 'duplicate' ? '' : 'Added. ';
      return lead + cap(out.join('; ')) + '.';
    }
    var groups = [
      { key: 'variant', title: 'In the variant', list: (R.provenance || []).filter(function (pv) { return pv.view !== 'both'; }) },
      { key: 'both', title: 'In both views, drawn from landmarks', list: (R.provenance || []).filter(function (pv) { return pv.view === 'both'; }) },
    ];
    var h = '<section class="fig-provenance"><h2>Changed from base anatomy</h2>';
    groups.forEach(function (g) {
      if (!g.list.length) return;
      h += '<h3 class="pv-group pv-' + g.key + '">' + g.title + '</h3><ul class="pv-list pv-' + g.key + '">';
      g.list.forEach(function (pv) {
        h += '<li data-structure="' + esc(pv.structure) + '" data-view="' + esc(pv.view) + '"><span class="pv-name">' + esc(pv.name || pv.structure) + '</span> ' +
          '<span class="pv-text">' + esc(sentence(pv)) + '</span></li>';
      });
      h += '</ul>';
    });
    return h + '</section>';
  }

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
    h += provenanceHtml(R, nameOf);
    if (ctx.credit) h += '<p class="fig-credit">' + esc(ctx.credit) + '</p>';
    return h;
  }

  /* ---------- page ---------- */
  function build(root, R) {
    var fig = el('div', 'fig');
    var run = el('p', 'fig-run');
    run.appendChild(el('span', 'fig-mark', 'Sagittal'));
    if (R.topic) run.appendChild(el('span', null, R.topic));
    fig.appendChild(run);
    var head = el('header', 'fig-head');
    head.appendChild(el('h1', 'fig-title', R.title));
    // the variant's full name, unless the title already says it
    var vl = R.variant && R.variant.label;
    if (vl && R.title.toLowerCase().indexOf(vl.toLowerCase()) < 0) head.appendChild(el('p', 'fig-sub', 'Variant: ' + vl));
    fig.appendChild(head);

    var plate = el('figure', 'fig-plate');
    var stage = el('div', 'fig-stage'); stage.id = 'stage';
    var cv = el('canvas'); cv.id = 'cv';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', R.title + ': 3D figure, drag to rotate');
    var labels = el('div'); labels.id = 'labels';
    var hint = el('p', 'fig-hint');
    hint.appendChild(el('span', 'h-pointer', 'Drag to rotate, scroll to zoom'));
    hint.appendChild(el('span', 'h-touch', 'Drag to rotate, pinch to zoom'));
    stage.append(cv, labels, hint);

    var bar = el('div', 'fig-bar');
    var view = el('div', 'fig-view');
    // Normal / Variant: a two-option radio group (the kit's own select stays, hidden, and is driven
    // from here so the kit's state and URL handling are unchanged)
    view.appendChild(el('span', 'fig-k', 'View')).id = 'fig-view-k';
    var seg = el('div', 'fig-seg'); seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-labelledby', 'fig-view-k');
    var radios = {};
    [['normal', 'Normal'], ['variant', 'Variant']].forEach(function (o) {
      var r = el('input'); r.type = 'radio'; r.name = 'fig-v'; r.id = 'fig-v-' + o[0]; r.value = o[0];
      var l = el('label', null, o[1]); l.htmlFor = r.id;
      var w = el('span', 'seg'); w.append(r, l); seg.appendChild(w); radios[o[0]] = r;
    });
    view.appendChild(seg);
    if (!R.variant) view.hidden = true; // normal anatomy only: nothing to switch
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
    return { fig: fig, stage: stage, cv: cv, labels: labels, view: view, radios: radios, opts: opts, toggle: lt, save: save, info: info };
  }

  function mount(o) {
    o = o || {};
    var R = o.resolved, root = o.root || document.body;
    var D = build(root, R);
    document.title = R.title + ' · Sagittal';
    var aspect = D.stage.clientWidth / (D.stage.clientHeight || 1);
    var def = window.SagittalPlayer.register(R, { credits: o.credits || window.SagittalCredits || null, organs: o.organs, aspect: aspect,
      explicitZoom: /[?&]zoom=/.test(location.search) });
    var staging = el('div'); // the kit builds its controls here; they are moved into the control row
    function stageColour() { return getComputedStyle(D.stage).backgroundColor; }
    var viewer = window.Kit.createViewer({ canvas: D.cv, labelsEl: D.labels, controlsEl: staging, infoEl: D.info,
      background: stageColour(), leaderStyle: 'css' });
    // the clear colour follows the theme (prefers-color-scheme, or data-theme on <html>)
    function contourColour() { return getComputedStyle(D.stage).getPropertyValue('--stage-contour'); }
    function retone() { window.SagittalPlayer.setContour(contourColour()); viewer.setBackground(stageColour()); }
    window.SagittalPlayer.setContour(contourColour());
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', retone); else if (mq.addListener) mq.addListener(retone);
    }
    if (window.MutationObserver) new MutationObserver(retone).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    viewer.open(def.id, o.state || {});
    // refit the default framing when the stage changes shape (phone rotated, window resized)
    if (def.fitBase && window.ResizeObserver) {
      var lastZoom = def.zoom;
      new ResizeObserver(function () {
        var z = window.SagittalPlayer.fitZoom(def.fitBase, D.stage.clientWidth / (D.stage.clientHeight || 1));
        if (Math.abs(z - lastZoom) > 0.01) { lastZoom = z; viewer.setZoom(z); }
      }).observe(D.stage);
    }
    Array.prototype.slice.call(staging.children).forEach(function (c) {
      if (c.classList.contains('chk')) { D.opts.appendChild(c); return; }
      c.hidden = true; D.view.appendChild(c); // the kit's select: driven by the radio group
    });
    var sel = D.view.querySelector('select');
    function syncRadios() { var v = viewer.getState().v === 'normal' ? 'normal' : 'variant'; D.radios[v].checked = true; }
    syncRadios();
    Object.keys(D.radios).forEach(function (k) {
      D.radios[k].onchange = function () {
        if (!D.radios[k].checked || !sel) return;
        sel.value = k; sel.dispatchEvent(new Event('change'));
      };
    });
    var labelsOn = true;
    D.toggle.onchange = function () { labelsOn = D.toggle.checked; viewer.setLabelsVisible(labelsOn); };

    function viewKey() { return viewer.getState().v || (R.variant ? 'variant' : 'normal'); }

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
      var stageInk = tok('--stage-ink', '#2a251e');
      if (withLabels) drawLabels(g, k, stageInk);
      return out.toDataURL('image/png');
    }

    // The page's label style (figure.css): a paper halo under a fine ink leader, a small ink dot,
    // and an italic caption on a knocked-out patch of paper. Hidden anchors (drawn x-ray style) get
    // a dashed leader, a hollow dot and a muted caption. Colours and sizes are read from the
    // rendered elements, so the image matches the page in either theme.
    function drawLabels(g, k, fallbackInk) {
      var d = viewer.debug(), rects = d.labelRects, leads = d.leaders;
      function px(v, def) { var n = parseFloat(v); return isFinite(n) ? n : def; }
      // the label elements and leader groups are created in the same order (kit rebuild)
      var labs = Array.prototype.slice.call(D.labels.querySelectorAll('.lab'));
      var groups = Array.prototype.slice.call(D.labels.querySelectorAll('.kit-leaders > g'));
      var stage = getComputedStyle(D.stage).backgroundColor;
      function idxOf(text) { for (var j = 0; j < labs.length; j++) if (labs[j].textContent === text) return j; return -1; }
      function look(j) {
        var gEl = groups[j], q = function (c) { var e = gEl && gEl.querySelector(c); return e ? getComputedStyle(e) : null; };
        var h = q('.kit-halo'), l = q('.kit-leader'), a = q('.kit-anchor');
        var dash = l && l.strokeDasharray && l.strokeDasharray !== 'none' ? l.strokeDasharray.split(/[\s,]+/).map(function (v) { return px(v, 0); }) : [];
        return {
          halo: h ? h.stroke : stage, haloW: h ? px(h.strokeWidth, 3) : 3,
          line: l ? l.stroke : fallbackInk, lineW: l ? px(l.strokeWidth, 0.9) : 0.9, dash: dash,
          dotR: a ? px(a.r, 2.4) : 2.4, dotFill: a ? a.fill : fallbackInk,
          dotStroke: a ? a.stroke : stage, dotW: a ? px(a.strokeWidth, 1.4) : 1.4,
        };
      }
      g.save();
      g.lineCap = 'round';
      leads.forEach(function (l) {
        if (!l) return;
        var s = look(idxOf(l.text));
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
