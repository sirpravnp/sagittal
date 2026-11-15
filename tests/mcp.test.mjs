// The MCP server: every tool's happy and error path, resources, and the HTTP endpoints.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer, INSTRUCTIONS, VIEW_URI, VIEW_MIME, OAI_URI, OAI_MIME } from '../mcp/server.mjs';
import { startHttp } from '../mcp/main.mjs';
import { encodeSpec, decodeSpec, meshData } from '../mcp/figure.mjs';

const fixture = (n) => JSON.parse(readFileSync(new URL(`./fixtures/figures/${n}.json`, import.meta.url), 'utf8'));
const FIXTURES = ['replaced-rha', 'low-cystic-duct', 'aberrant-right-subclavian'];

async function local(env = {}) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = buildServer(env);
  await server.connect(a);
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(b);
  return client;
}
const json = (r) => JSON.parse(r.content[0].text);

let c, figDir;
before(async () => { figDir = mkdtempSync(path.join(tmpdir(), 'sagittal-mcp-')); c = await local({ writeFiles: true, figuresDir: figDir }); });
after(async () => { await c.close(); rmSync(figDir, { recursive: true, force: true }); });

test('instructions carry the skill rules', () => {
  for (const s of ['never draw anatomy from memory', 'never give coordinates', 'cite only reference ids', 'Refuse plainly', 'hairpins']) {
    assert.ok(INSTRUCTIONS.toLowerCase().includes(s.toLowerCase()), s);
  }
});

test('tools list: render_figure links both view templates; sagittal_meshes is app-only', async () => {
  const { tools } = await c.listTools();
  const names = tools.map((t) => t.name);
  assert.deepEqual(names, ['get_figure_format', 'list_organs', 'get_organ', 'list_references', 'validate_figure', 'render_figure', 'sagittal_meshes']);
  const r = tools.find((t) => t.name === 'render_figure');
  assert.equal(r._meta.ui.resourceUri, VIEW_URI);
  assert.equal(r._meta['openai/outputTemplate'], OAI_URI);
  assert.deepEqual(tools.find((t) => t.name === 'sagittal_meshes')._meta.ui.visibility, ['app']);
  for (const t of tools) assert.equal(t.annotations.readOnlyHint, true);
});

test('get_figure_format returns the spec format and patterns', async () => {
  const r = await c.callTool({ name: 'get_figure_format', arguments: {} });
  assert.match(r.content[0].text, /sagittal-figure\/1/);
  assert.match(r.content[0].text, /move_insertion/);
});

test('list_organs lists every organ and the gaps', async () => {
  const r = json(await c.callTool({ name: 'list_organs', arguments: {} }));
  const ids = JSON.parse(readFileSync(new URL('../organs/index.json', import.meta.url), 'utf8')).map((o) => o.id);
  assert.deepEqual(r.organs.map((o) => o.id), ids);
  assert.ok(r.organs.find((o) => o.id === 'coeliac-trunk').centerlines.includes('proper_hepatic_artery'));
  assert.match(r.gaps, /ureter/i);
});

test('get_organ: happy path and unknown id', async () => {
  const r = json(await c.callTool({ name: 'get_organ', arguments: { id: 'coeliac-trunk' } }));
  assert.equal(r.id, 'coeliac-trunk');
  assert.match(r.reference, /^## coeliac-trunk/);
  assert.match(r.reference, /Along each line/);
  assert.ok(r.centerlines.proper_hepatic_artery.parent);
  assert.ok(Object.keys(r.landmarks).length > 3);
  for (const bad of ['nope', '__proto__', 'constructor']) {
    const e = await c.callTool({ name: 'get_organ', arguments: { id: bad } });
    assert.equal(e.isError, true);
    assert.match(e.content[0].text, /unknown organ/);
  }
});

test('list_references gives id, title, url and covers', async () => {
  const r = json(await c.callTool({ name: 'list_references', arguments: {} }));
  assert.ok(r.references.length >= 20);
  for (const x of r.references) { assert.ok(x.id && x.title && x.covers); assert.match(x.url, /^https:\/\//); }
});

test('validate_figure: valid fixtures and an invalid spec', async () => {
  for (const n of FIXTURES) {
    const r = json(await c.callTool({ name: 'validate_figure', arguments: { spec: fixture(n) } }));
    assert.equal(r.ok, true, n);
    assert.ok(r.changed.length > 0);
  }
  const bad = fixture('replaced-rha');
  bad.variant.edits[0].from = { landmark: 'liver/not_a_landmark' };
  const r = json(await c.callTool({ name: 'validate_figure', arguments: { spec: bad } }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 1);
  const raw = json(await c.callTool({ name: 'validate_figure', arguments: { spec: { schema: 'sagittal-figure/1', organs: [[1, 2, 3]] } } }));
  assert.equal(raw.ok, false);
});

test('render_figure on the fixtures: view data, meshes, text fallback and an offline file', async () => {
  for (const n of FIXTURES) {
    const spec = fixture(n);
    const r = await c.callTool({ name: 'render_figure', arguments: { spec } });
    assert.ok(!r.isError, n);
    assert.match(r.content[0].text, /^Figure: /);
    assert.match(r.content[0].text, /Claims:\n1\. /);
    assert.deepEqual(r.structuredContent.spec, spec);
    assert.ok(r.structuredContent.meshes.length > 0);
    for (const m of r.structuredContent.meshes) assert.ok(r._meta['sagittal/meshes'][m].parts, m);
    // stdio mode writes the same single-file figure make-figure writes, and links to it
    assert.ok(existsSync(r.structuredContent.link), r.structuredContent.link);
    const html = readFileSync(r.structuredContent.link, 'utf8');
    assert.doesNotMatch(html, /<script[^>]+src=["']?https?:/i);
    assert.match(r.content[0].text, new RegExp(r.structuredContent.link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('render_figure refuses an invalid spec with every error', async () => {
  const r = await c.callTool({ name: 'render_figure', arguments: { spec: { schema: 'nope' } } });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /the spec has errors/);
  assert.match(r.content[0].text, /schema:/);
});

test('sagittal_meshes: happy path and bad names', async () => {
  const r = await c.callTool({ name: 'sagittal_meshes', arguments: { names: ['liver'] } });
  assert.ok(r._meta['sagittal/meshes'].liver.parts.liver);
  for (const names of [[], ['../package'], ['nope']]) {
    const e = await c.callTool({ name: 'sagittal_meshes', arguments: { names } });
    assert.equal(e.isError, true, JSON.stringify(names));
  }
});

test('resources: the view (MCP Apps and ChatGPT) is one offline HTML page under 1 MB', async () => {
  const { resources } = await c.listResources();
  assert.ok(resources.find((r) => r.uri === VIEW_URI && r.mimeType === VIEW_MIME));
  assert.ok(resources.find((r) => r.uri === OAI_URI && r.mimeType === OAI_MIME));
  for (const [uri, mime] of [[VIEW_URI, VIEW_MIME], [OAI_URI, OAI_MIME]]) {
    const v = (await c.readResource({ uri })).contents[0];
    assert.equal(v.mimeType, mime);
    assert.ok(v.text.length < 1_000_000, `view is ${v.text.length} bytes`);
    assert.doesNotMatch(v.text, /<script[^>]*\ssrc=/i);
    assert.doesNotMatch(v.text, /<link[^>]+href=["']?https?:/i);
    assert.match(v.text, /viewer-boot\.js/);
  }
  await assert.rejects(c.readResource({ uri: 'ui://sagittal/nope.html' }));
});

test('figure links round-trip and reject garbage', () => {
  const spec = fixture('low-cystic-duct');
  const code = encodeSpec(spec);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeSpec(code), spec);
  assert.throws(() => decodeSpec('not base64!'));
  assert.throws(() => meshData('../package'));
});

test('HTTP: health, MCP over Streamable HTTP, figure links', async () => {
  const srv = await startHttp({ port: 0 });
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const h = await (await fetch(base + '/health')).json();
    assert.equal(h.name, 'sagittal');
    const client = new Client({ name: 'http', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp')));
    const r = await client.callTool({ name: 'render_figure', arguments: { spec: fixture('aberrant-right-subclavian') } });
    assert.ok(r.structuredContent.link.startsWith(base + '/figure/'));
    const page = await fetch(r.structuredContent.link);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>Aberrant right subclavian artery · Sagittal<\/title>/);
    await client.close();
    assert.equal((await fetch(base + '/figure/@@@')).status, 400);
    assert.equal((await fetch(base + '/nope')).status, 404);
    assert.equal((await fetch(base + '/mcp')).status, 405);
  } finally { srv.close(); }
});

test('stdio: the entry point serves the tools and writes figure files', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sagittal-stdio-'));
  const client = new Client({ name: 'stdio', version: '1' });
  await client.connect(new StdioClientTransport({
    command: process.execPath, args: [new URL('../mcp/main.mjs', import.meta.url).pathname],
    env: { ...process.env, SAGITTAL_FIGURES_DIR: dir }, stderr: 'ignore',
  }));
  try {
    const r = await client.callTool({ name: 'render_figure', arguments: { spec: fixture('low-cystic-duct') } });
    assert.equal(path.dirname(r.structuredContent.link), dir);
    assert.ok(existsSync(r.structuredContent.link));
  } finally { await client.close(); rmSync(dir, { recursive: true, force: true }); }
});
