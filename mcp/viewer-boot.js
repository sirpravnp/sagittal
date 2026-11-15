/* Sagittal in-chat figure view (MCP App). Classic script, inlined last in the view HTML.
 *
 * The host loads this page once per render_figure call and hands it the tool result:
 *   - MCP Apps hosts (Claude, others): JSON-RPC over postMessage. The page sends ui/initialize,
 *     then ui/notifications/initialized; the host sends ui/notifications/tool-result with the
 *     CallToolResult. structuredContent carries { title, spec }, _meta["sagittal/meshes"] the meshes.
 *   - ChatGPT (Apps SDK): window.openai.toolOutput is structuredContent and
 *     window.openai.toolResponseMetadata is _meta; both may arrive after load (openai:set_globals).
 * If a host does not forward _meta, the page asks the server for the meshes with the app-only tool
 * sagittal_meshes (MCP Apps: tools/call through the host; ChatGPT: window.openai.callTool).
 * The figure itself is the same player/ui.js page that make-figure writes to a file.
 */
(function () {
  'use strict';
  var PROTOCOL = '2026-01-26';
  var shown = false, seq = 0, pending = {}, mcpApps = false;

  function fail(lines) {
    var e = document.getElementById('errors');
    e.textContent = [].concat(lines).join('\n');
    e.hidden = false;
    var w = document.getElementById('waiting'); if (w) w.hidden = true;
    notifySize();
  }

  // ---------------------------------------------------------------- MCP Apps bridge (postMessage JSON-RPC)
  function post(msg) { try { window.parent.postMessage(msg, '*'); } catch (e) { /* not framed */ } }
  function request(method, params) {
    var id = 'sagittal-' + (++seq);
    post({ jsonrpc: '2.0', id: id, method: method, params: params || {} });
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      setTimeout(function () { if (pending[id]) { delete pending[id]; reject(new Error(method + ': no answer from the host')); } }, 20000);
    });
  }
  function notify(method, params) { post({ jsonrpc: '2.0', method: method, params: params || {} }); }
  var lastH = 0;
  function notifySize() {
    if (!mcpApps) return;
    var h = Math.ceil(document.documentElement.scrollHeight);
    if (Math.abs(h - lastH) > 1) { lastH = h; notify('ui/notifications/size-changed', { height: h }); }
  }
  function applyTheme(ctx) {
    var t = ctx && ctx.theme;
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  }

  window.addEventListener('message', function (ev) {
    var m = ev.data;
    if (!m || m.jsonrpc !== '2.0') return;
    if (m.id != null && pending[m.id] && !m.method) {
      var p = pending[m.id]; delete pending[m.id];
      if (m.error) p.reject(new Error(m.error.message || 'host error')); else p.resolve(m.result);
      return;
    }
    if (m.method === 'ui/notifications/tool-result') { onResult(m.params || {}); return; }
    if (m.method === 'ui/notifications/host-context-changed') { applyTheme(m.params); return; }
    if (m.id != null && m.method) post({ jsonrpc: '2.0', id: m.id, result: {} }); // ui/resource-teardown, ping
  });

  // ---------------------------------------------------------------- the figure
  function installMeshes(meshes) {
    window.SagittalMeshes = window.SagittalMeshes || {};
    Object.keys(meshes || {}).forEach(function (k) { window.SagittalMeshes[k] = meshes[k]; });
  }
  function missingMeshes(names) {
    return (names || []).filter(function (n) { return !(window.SagittalMeshes && window.SagittalMeshes[n]); });
  }
  function fetchMeshes(names) {
    var args = { names: names };
    var call = window.openai && window.openai.callTool
      ? window.openai.callTool('sagittal_meshes', args)
      : request('tools/call', { name: 'sagittal_meshes', arguments: args });
    return Promise.resolve(call).then(function (r) {
      var meta = (r && (r._meta || r.meta)) || {};
      var sc = (r && (r.structuredContent || r.result && r.result.structuredContent)) || {};
      installMeshes(meta['sagittal/meshes'] || sc.meshes);
    });
  }

  function show(structured, meta) {
    if (shown || !structured || !structured.spec) return;
    shown = true;
    installMeshes(meta && meta['sagittal/meshes']);
    var need = missingMeshes(structured.meshes);
    (need.length ? fetchMeshes(need) : Promise.resolve()).then(function () {
      var still = missingMeshes(structured.meshes);
      if (still.length) throw new Error('could not load the models: ' + still.join(', '));
      var res = window.SagittalSpec.validate(structured.spec, window.SagittalOrgans);
      if (!res.ok) { fail(res.errors); return; }
      var w = document.getElementById('waiting'); if (w) w.hidden = true;
      window.SagittalUI.mount({ resolved: res.resolved, credits: window.SagittalCredits, state: {} });
      if (window.ResizeObserver) new ResizeObserver(notifySize).observe(document.body);
      notifySize();
    }).catch(function (e) { shown = false; fail([String(e && e.message || e)]); });
  }
  function onResult(r) {
    if (r.isError) { fail(((r.content || [])[0] || {}).text || 'The figure could not be made.'); return; }
    show(r.structuredContent, r._meta);
  }

  // ---------------------------------------------------------------- start
  if (window.openai) {
    applyTheme({ theme: window.openai.theme });
    var tryOpenAi = function () { if (window.openai.toolOutput) show(window.openai.toolOutput, window.openai.toolResponseMetadata); };
    window.addEventListener('openai:set_globals', tryOpenAi);
    tryOpenAi();
    return;
  }
  if (window.parent && window.parent !== window) {
    request('ui/initialize', {
      appInfo: { name: 'Sagittal figure', version: '1.0.0' },
      appCapabilities: {},
      protocolVersion: PROTOCOL,
    }).then(function (init) {
      mcpApps = true;
      applyTheme(init && init.hostContext);
      notify('ui/notifications/initialized', {});
      notifySize();
    }).catch(function (e) { fail('This view needs a host that supports MCP Apps (' + e.message + ').'); });
  }
  // Tests and local previews: window.__SAGITTAL_RESULT__ = { structuredContent, _meta }
  if (window.__SAGITTAL_RESULT__) onResult(window.__SAGITTAL_RESULT__);
})();
