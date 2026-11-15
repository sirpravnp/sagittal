/* Sagittal figure page. Classic script: sets window.SagittalUI. Needs Kit, SagittalPlayer and
 * player/figure.css; the organ meshes must be loaded before mount() (the player reads them).
 *
 *   SagittalUI.mount({ resolved, root?, credits?, organs?, state? }) -> figure
 *     Builds the page into root (default document.body): running head, title (and the variant's
 *     full name when the title does not carry it),
 *     the 3D stage with the orientation note, the control row (view, organ toggles, labels, Save
 *     as image) and the info panel (claims with their references, "Changed from base anatomy",
 *     credits). Sets window.viewer (the Kit viewer) and window.figure.
 *     credits: site/meshes/credits.json (default window.SagittalCredits); Task 6 passes it in.
 *     The stage's clear colour follows the --stage token of figure.css (paper in light mode, warm
 *     dark in dark mode) and the leaders take their colours from figure.css (leaderStyle 'css').
 *   figure.snapshot({ labels?, footer? }) -> Promise<PNG data URL>
 *     The stage at its device-pixel size: the WebGL canvas, the orientation note, a footer line
 *     (Sagittal · title · view) and, when labels is true (default: the page's Labels
 *     toggle), the anchor dots, leaders and italic captions drawn from viewer.debug() geometry in
 *     the page's computed label styles. The footer goes to the first free corner (bottom right,
 *     bottom left, top right), shortened to "Sagittal" if the full line fits nowhere,
 *     and left out if every corner holds a label, or when footer is false. The page is left as it was.
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
  function uniq(a) { var out = []; a.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); return out; }

  /* ---------- info panel ---------- */
  // "Changed from base anatomy" in plain anatomical language, built from the resolved spec: what
  // the variant adds, removes or moves (first), then what is drawn from landmarks in both views.
  // Each row says where the structure arises, which landmarks it passes and how ("behind",
  // "to the right of", "toward segment IV"), in the library's own names for them.
  var DIRW = { posterior: 'behind', anterior: 'in front of', superior: 'above', inferior: 'below', left: 'to the left of', right: 'to the right of' };
  function provenanceHtml(R, nameOf) {
    var own = {};
    (R.base || []).concat(R.variant.edits || []).forEach(function (e) { if (e.id) own[e.id] = e.name || e.id; });
    // A readable noun phrase for a library structure, landmark or one of the spec's own routes:
    // source notes (after ': ' or in brackets) and "curve" wording dropped, "Centroid of segment
    // IV" said as "segment IV".
    function phrase(ref) {
      var full = ref.indexOf('/') >= 0 ? nameOf(ref) : (own[ref] || ref);
      var t = String(full).split(': ')[0].replace(/\s*\([^()]*\)/g, '').replace(/ curve\b/g, '').replace(/\s+/g, ' ').trim();
      var seg = /^centroid of (segment .+)$/i.exec(t);
      if (seg) return { text: seg[1], toward: true };
      t = t.charAt(0).toLowerCase() + t.slice(1);
      if (!/^the /.test(t)) t = 'the ' + t;
      return { text: t, toward: false, full: full };
    }
    function wpRef(w) { return w.landmark || w.on; }
    // waypoints -> "behind the portal confluence, behind and to the right of the upper end of the
    // bile duct, along the proper hepatic artery"
    function passes(wps, skip) {
      var parts = [], prev = null;
      (wps || []).forEach(function (w) {
        var ref = wpRef(w), ph = phrase(ref), how;
        if (w.on && !w.landmark && !w.offset && skip.indexOf(ph.text) >= 0) return; // "along" itself or its parent line
        if (w.offset) how = DIRW[w.offset.dir] || 'near';
        else if (w.on && !w.landmark) how = 'along';
        else if (w.offset) how = DIRW[w.offset.dir] || 'near';
        else how = ph.toward ? 'toward' : 'through';
        if (prev && prev.ref === ref) {
          if (prev.hows.indexOf(how) < 0) prev.hows.push(how);
          return;
        }
        prev = { ref: ref, ph: ph, hows: [how] };
        parts.push(prev);
      });
      return parts.map(function (p) {
        var h = p.hows;
        // to one side, behind (or in front), then to the other side: it crosses behind (in front of) it
        var across = h.indexOf('to the left of') >= 0 && h.indexOf('to the right of') >= 0;
        if (across && h.indexOf('behind') >= 0) return 'crosses behind ' + p.ph.text;
        if (across && h.indexOf('in front of') >= 0) return 'crosses in front of ' + p.ph.text;
        return h.join(' and ') + ' ' + p.ph.text;
      }).join(', ').replace(/passes crosses/g, 'crosses');
    }
    function endAt(w) {
      if (!w) return '';
      var ph = phrase(wpRef(w));
      if (w.offset) return (DIRW[w.offset.dir] || 'near') + ' ' + ph.text;
      return (ph.toward ? 'toward ' : 'at ') + ph.text;
    }
    function startAt(w) { return w ? (w.on && !w.landmark ? phrase(w.on).text : endAt(w).replace(/^at /, '')) : ''; }
    function editFor(pv) {
      var list = pv.view === 'both' ? (R.base || []) : (R.variant.edits || []);
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if ((e.id || e.structure) === pv.structure && e.op === pv.op) return e;
      }
      return null;
    }
    function sentence(pv) {
      var e = editFor(pv) || {}, out = [];
      var self = phrase(pv.structure).text, fromLine = e.from && e.from.on && !e.from.landmark ? phrase(e.from.on).text : null;
      var alongOnly = fromLine && (e.via || []).length && (e.via || []).every(function (w) { return w.on === e.from.on && !w.landmark; });
      var cap = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
      if (pv.op === 'remove') return pv.view === 'both' ? 'Not drawn.' : 'Not present in the variant.';
      if (pv.op === 'move_insertion') {
        var to = pv.on && pv.on[0] ? phrase(pv.on[0]).text : '';
        return to ? 'Arises from ' + to + ' instead.' : 'Its origin moves.';
      }
      if (pv.op === 'duplicate') out.push('A second ' + phrase(pv.structure).text.replace(/^the /, ''));
      else if (pv.op === 'branch' && e.from) out.push('Arises from ' + startAt(e.from));
      else if (alongOnly) out.push('Runs along ' + fromLine);
      else if (e.from) out.push('Runs from ' + startAt(e.from));
      var via = passes(e.via, [self].concat(fromLine && pv.op !== 'branch' ? [fromLine] : []));
      if (via) out.push(/^crosses /.test(via) ? via : 'passes ' + via);
      var toLine = e.to && e.to.on && !e.to.landmark ? phrase(e.to.on).text : null;
      if (e.to && toLine && toLine !== self && !e.to.offset) out.push('joins ' + toLine);
      else if (e.to && toLine !== self) out.push((pv.op === 'route' && !via && !alongOnly ? 'to ' : 'ends ') + endAt(e.to));
      if (!out.length) return '';
      var lead = pv.view === 'both' ? '' : (pv.op === 'duplicate' ? '' : 'Added. ');
      return lead + cap(out.join('; ').replace(/; (to|ends) /, function (m, w) { return w === 'to' ? ' to ' : '; ends '; })) + '.';
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
    if (vl && R.title.toLowerCase().indexOf(vl.toLowerCase()) < 0) head.appendChild(el('p', 'fig-sub', 'Variant shown: ' + vl));
    fig.appendChild(head);

    var plate = el('figure', 'fig-plate');
    var stage = el('div', 'fig-stage'); stage.id = 'stage';
    var cv = el('canvas'); cv.id = 'cv';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', R.title + ': 3D figure, drag to rotate');
    var labels = el('div'); labels.id = 'labels';
    var orient = el('p', 'fig-orient'); orient.id = 'orient'; orient.setAttribute('aria-live', 'polite');
    var hint = el('p', 'fig-hint');
    hint.appendChild(el('span', 'h-pointer', 'Drag to rotate \u00b7 scroll to zoom'));
    hint.appendChild(el('span', 'h-touch', 'Drag to rotate \u00b7 pinch to zoom'));
    stage.append(cv, orient, labels, hint);

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
    return { fig: fig, stage: stage, cv: cv, labels: labels, orient: orient, view: view, radios: radios, opts: opts, toggle: lt, save: save, info: info };
  }

  function mount(o) {
    o = o || {};
    var R = o.resolved, root = o.root || document.body;
    var D = build(root, R);
    document.title = R.title + ' · Sagittal';
    var aspect = D.stage.clientWidth / (D.stage.clientHeight || 1);
    var def = window.SagittalPlayer.register(R, { credits: o.credits || window.SagittalCredits || null, organs: o.organs, orientEl: D.orient, aspect: aspect });
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

    function viewKey() { return viewer.getState().v || 'variant'; }
    function viewName() { return viewKey() === 'normal' ? 'Normal anatomy' : R.variant.label; }

    function snapshot(so) {
      so = so || {};
      var want = so.labels === undefined ? labelsOn : !!so.labels;
      try {
        // draw a fresh frame (and lay the labels out when they are wanted but hidden)
        viewer.setLabelsVisible(want);
        var url = composite(want, so.footer !== false);
        return Promise.resolve(url);
      } catch (e) {
        return Promise.reject(e);
      } finally {
        if (want !== labelsOn) viewer.setLabelsVisible(labelsOn);
      }
    }

    function composite(withLabels, withFooter) {
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

      // footer line: Sagittal · title · view. Bottom right, else bottom left, else top
      // right: the first corner where it covers no label (and not the orientation note); none, no footer.
      if (withFooter) footer();
      if (withLabels) drawLabels(g, k, stageInk);
      return out.toDataURL('image/png');

      function footer() {
      var fs = 12.5 * k, m = 10 * k, fam = tok('--serif', 'Georgia, serif');
      g.font = 'italic 400 ' + fs + 'px ' + fam;
      var head = 'Sagittal \u00b7 ', tail = ' · ' + viewName(), title = R.title, maxW = W - 2 * m - 10 * k;
      var foot = head + title + tail;
      while (g.measureText(foot).width > maxW && title.length > 8) { title = title.slice(0, -2); foot = head + title.replace(/\s+$/, '') + '…' + tail; }
      var fh = fs * 1.55;
      var busy = (withLabels ? viewer.debug().labelRects.map(function (r) { return [r.x * k, r.y * k, r.w * k, r.h * k]; }) : []);
      if (text) { var orr = D.orient.getBoundingClientRect(); busy.push([(orr.left - sb.left) * k, (orr.top - sb.top) * k, orr.width * k, orr.height * k]); }
      // the full line first; failing that, the short one ("Sagittal")
      var at = null, fw = 0;
      [foot, 'Sagittal'].some(function (t) {
        fw = g.measureText(t).width + 10 * k;
        var spots = [[W - m - fw, H - m - fh], [m, H - m - fh], [W - m - fw, m]];
        for (var si = 0; si < spots.length; si++) {
          var fx = spots[si][0], fy = spots[si][1];
          var hit = busy.some(function (b) { return fx < b[0] + b[2] + 4 * k && fx + fw > b[0] - 4 * k && fy < b[1] + b[3] + 4 * k && fy + fh > b[1] - 4 * k; });
          if (!hit) { at = spots[si]; foot = t; return true; }
        }
        return false;
      });
      if (!at) return;
      g.fillStyle = knock; g.fillRect(at[0], at[1], fw, fh);
      g.fillStyle = mut; g.textBaseline = 'middle'; g.fillText(foot, at[0] + 5 * k, at[1] + fh / 2);
      }

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
