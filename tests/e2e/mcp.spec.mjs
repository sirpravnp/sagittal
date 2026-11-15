// The MCP server's in-chat view, in a browser with every network request blocked:
//  - inside a fake MCP Apps host (an iframe; ui/initialize, tool-result, tools/call over postMessage),
//    with the meshes in _meta and, separately, fetched back through the app-only sagittal_meshes tool;
//  - as a ChatGPT Apps SDK template (window.openai.toolOutput / toolResponseMetadata).
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer, VIEW_URI } from '../../mcp/server.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = path.join(ROOT, 'build/mcp');
const FIXTURES = ['replaced-rha', 'low-cystic-duct', 'aberrant-right-subclavian'];
const fixture = (n) => JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/figures', n + '.json'), 'utf8'));

async function client() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await buildServer({}).connect(a);
  const c = new Client({ name: 'e2e', version: '1' });
  await c.connect(b);
  return c;
}

// JSON that cannot end the host page's <script> (the view HTML contains </script>).
const js = (x) => JSON.stringify(x).replace(/</g, '\\u003c');

// A minimal MCP Apps host page: frames the view, answers ui/initialize and tools/call, sends the result.
function hostPage(viewHtml, result, meshesResult) {
  return `<!doctype html><html><body style="margin:0">
<iframe id="v" sandbox="allow-scripts allow-same-origin" style="width:1200px;height:2000px;border:0"></iframe>
<script>
  window.__log = [];
  var RESULT = ${js(result)};
  var MESHES = ${js(meshesResult)};
  var f = document.getElementById('v');
  window.addEventListener('message', function (ev) {
    var m = ev.data; if (!m || m.jsonrpc !== '2.0') return;
    window.__log.push(m.method || 'response');
    var reply = function (result) { f.contentWindow.postMessage({ jsonrpc: '2.0', id: m.id, result: result }, '*'); };
    if (m.method === 'ui/initialize') reply({ protocolVersion: m.params.protocolVersion, hostInfo: { name: 'test-host', version: '1' }, hostCapabilities: { serverTools: {} }, hostContext: { theme: 'light' } });
    else if (m.method === 'ui/notifications/initialized') f.contentWindow.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: RESULT }, '*');
    else if (m.method === 'tools/call') reply(MESHES);
    else if (m.method === 'ui/notifications/size-changed') window.__height = m.params.height;
  });
  f.srcdoc = ${js(viewHtml)};
</script></body></html>`;
}

const VIEW_URL = 'http://view.sagittal.test/figure.html';
// Every request is refused, except the one made-up address a test serves the view from.
async function blockNetwork(page, serve) {
  const asked = [];
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (serve && u === VIEW_URL) return route.fulfill({ status: 200, contentType: 'text/html', body: serve });
    asked.push(u);
    return route.abort();
  });
  return asked;
}

for (const n of FIXTURES) {
  test(`MCP Apps host: ${n} renders offline from render_figure`, async ({ page }) => {
    test.slow();
    const c = await client();
    const view = (await c.readResource({ uri: VIEW_URI })).contents[0].text;
    const r = await c.callTool({ name: 'render_figure', arguments: { spec: fixture(n) } });
    await c.close();
    const asked = await blockNetwork(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.setContent(hostPage(view, { content: r.content, structuredContent: r.structuredContent, _meta: r._meta }, null));
    const frame = page.frameLocator('#v');
    await expect(frame.locator('.fig-title')).toBeVisible({ timeout: 60000 });
    const inner = page.frames().find((f) => f !== page.mainFrame());
    await inner.waitForFunction(() => window.viewer && window.viewer.debug().nonBlank, null, { timeout: 60000 });
    await expect(frame.locator('#errors')).toBeHidden();
    const log = await page.evaluate(() => window.__log);
    expect(log[0]).toBe('ui/initialize');
    expect(log).toContain('ui/notifications/initialized');
    expect(log).not.toContain('tools/call'); // the meshes came in _meta
    expect(await page.evaluate(() => window.__height)).toBeGreaterThan(400);
    expect(asked.filter((u) => !u.startsWith('about:') && !u.startsWith('data:'))).toEqual([]);
    expect(errors).toEqual([]);
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, `${n}-mcp-apps.png`), fullPage: true });
  });
}

test('MCP Apps host without _meta: the view fetches the meshes through sagittal_meshes', async ({ page }) => {
  test.slow();
  const c = await client();
  const view = (await c.readResource({ uri: VIEW_URI })).contents[0].text;
  const r = await c.callTool({ name: 'render_figure', arguments: { spec: fixture('low-cystic-duct') } });
  const m = await c.callTool({ name: 'sagittal_meshes', arguments: { names: r.structuredContent.meshes } });
  await c.close();
  await blockNetwork(page);
  await page.setContent(hostPage(view, { content: r.content, structuredContent: r.structuredContent }, m));
  const inner = await (await page.waitForSelector('#v')).contentFrame();
  await inner.waitForFunction(() => window.viewer && window.viewer.debug().nonBlank, null, { timeout: 60000 });
  expect(await page.evaluate(() => window.__log)).toContain('tools/call');
});

test('ChatGPT template: renders from window.openai.toolOutput', async ({ page }) => {
  test.slow();
  const c = await client();
  const view = (await c.readResource({ uri: VIEW_URI })).contents[0].text;
  const r = await c.callTool({ name: 'render_figure', arguments: { spec: fixture('aberrant-right-subclavian') } });
  await c.close();
  const asked = await blockNetwork(page, view);
  await page.addInitScript(([out, meta]) => {
    window.openai = { theme: 'dark', toolOutput: out, toolResponseMetadata: meta, callTool: () => Promise.reject(new Error('not expected')) };
  }, [r.structuredContent, r._meta]);
  await page.goto(VIEW_URL);
  await page.waitForFunction(() => window.viewer && window.viewer.debug().nonBlank, null, { timeout: 60000 });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#errors')).toBeHidden();
  expect(asked).toEqual([]);
});

test('a failed tool result shows its error, not a blank view', async ({ page }) => {
  const c = await client();
  const view = (await c.readResource({ uri: VIEW_URI })).contents[0].text;
  await c.close();
  await blockNetwork(page);
  await page.setContent(hostPage(view, { isError: true, content: [{ type: 'text', text: 'Error: the spec has errors' }] }, null));
  const frame = page.frameLocator('#v');
  await expect(frame.locator('#errors')).toContainText('the spec has errors');
});
