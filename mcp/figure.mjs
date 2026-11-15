// Figure helpers for the MCP server: the in-chat view, mesh data, the text fallback, share links.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildFigure, inlineScript, inlineCss, jsonForScript, slug } from '../player/make-figure.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

// One shared, read-only copy of the organ library and the validator.
let lib = null;
export function library() {
  if (lib) return lib;
  const window = {};
  const ctx = vm.createContext({ window });
  for (const f of ['organs/organs.js', 'player/spec.js']) vm.runInContext(read(f), ctx, { filename: f });
  lib = { organs: window.SagittalOrgans, spec: window.SagittalSpec, organsMd: read('skills/sagittal/reference/organs.md'),
    specMd: read('docs/spec.md'), patternsMd: read('skills/sagittal/reference/patterns.md') };
  return lib;
}

export function validate(spec) {
  const { organs, spec: S } = library();
  const r = S.validate(spec, organs);
  return { ok: r.ok, errors: [...r.errors], resolved: r.ok ? r.resolved : null };
}

// ---------------------------------------------------------------- meshes
const meshCache = new Map();
/** One baked mesh as data (organs/meshes/<name>.js is `(window.SagittalMeshes …)["name"] = {json};`). */
export function meshData(name) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`unknown mesh "${name}"`);
  if (meshCache.has(name)) return meshCache.get(name);
  let src;
  try { src = read(`organs/meshes/${name}.js`); } catch { throw new Error(`unknown mesh "${name}"`); }
  const i = src.indexOf('] = {');
  const j = src.lastIndexOf('};');
  if (i < 0 || j < 0) throw new Error(`mesh "${name}" is not in the expected format`);
  const data = JSON.parse(src.slice(i + 4, j + 1));
  meshCache.set(name, data);
  return data;
}
export const meshesFor = (resolved) => [...new Set(resolved.organs.map((o) => library().organs.manifests[o.id].mesh))];

// ---------------------------------------------------------------- the in-chat view
let viewCache = null;
/** The figure page without a spec: the same CSS, three.js, kit, player and UI as a make-figure file,
 *  every organ manifest and reference, and viewer-boot.js, which waits for the tool result. */
export function viewHtml() {
  if (viewCache) return viewCache;
  const { organs } = library();
  const credits = JSON.parse(read('site/meshes/credits.json'));
  let html = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + '<meta name="color-scheme" content="light dark">\n<title>Sagittal figure</title>\n'
    + `<style>\n${inlineCss(read('player/figure.css'))}\n`
    + '.fig-waiting{font:inherit;opacity:.7;padding:24px}\n</style>\n</head>\n<body>\n'
    + '<pre id="errors" class="fig-errors" hidden></pre>\n<p id="waiting" class="fig-waiting">Drawing the figure…</p>\n';
  html += inlineScript('three.min.js', read('site/vendor/three.min.js'));
  html += inlineScript('labels.js', read('site/kit/labels.js'));
  html += inlineScript('kit.js', read('site/kit/kit.js'));
  html += inlineScript('organs.js', 'window.SagittalOrgans = ' + jsonForScript(organs) + ';');
  html += inlineScript('credits.json', 'window.SagittalCredits = ' + jsonForScript(credits) + ';');
  html += inlineScript('spec.js', read('player/spec.js'));
  html += inlineScript('player.js', read('player/player.js'));
  html += inlineScript('ui.js', read('player/ui.js'));
  html += inlineScript('viewer-boot.js', read('mcp/viewer-boot.js'));
  html += '</body>\n</html>\n';
  viewCache = html;
  return html;
}

// ---------------------------------------------------------------- share links (HTTP mode)
const b64u = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function encodeSpec(spec) { return b64u(deflateRawSync(Buffer.from(JSON.stringify(spec)))); }
export function decodeSpec(s) {
  if (!/^[A-Za-z0-9_-]{1,20000}$/.test(s)) throw new Error('bad figure link');
  const json = inflateRawSync(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'), { maxOutputLength: 1e6 }).toString('utf8');
  return JSON.parse(json);
}

/** The whole figure as one offline HTML file (same as make-figure). */
export function figureFile(spec) { return buildFigure(spec); }

// ---------------------------------------------------------------- text fallback
const OPS = { remove: 'removed', route: 'added', branch: 'added', move_insertion: 'insertion moved', duplicate: 'duplicated' };
export function summaryText(resolved, link) {
  const { organs } = library();
  const L = [];
  L.push(`Figure: ${resolved.title}${resolved.variant && resolved.variant.label ? ` — Normal / ${resolved.variant.label}` : ''}`);
  L.push('Organs: ' + resolved.organs.map((o) => organs.manifests[o.id].name).join(', ') + '.');
  const variant = (resolved.provenance || []).filter((p) => p.view === 'variant');
  const both = (resolved.provenance || []).filter((p) => p.view !== 'variant');
  if (variant.length) L.push('In the variant: ' + variant.map((p) => `${p.name} (${OPS[p.op] || p.op})`).join('; ') + '.');
  if (both.length) L.push('Drawn from landmarks in both views: ' + both.map((p) => p.name).join(', ') + '.');
  L.push('Claims:');
  (resolved.claims || []).forEach((c, i) => {
    L.push(`${i + 1}. ${c.text} [${c.refs.map((r) => (organs.references[r] && organs.references[r].title) || r).join('; ')}]`);
  });
  if (link) L.push(`Open or download the interactive figure: ${link}`);
  return L.join('\n');
}

export { slug };
