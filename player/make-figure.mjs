#!/usr/bin/env node
// make-figure: one self-contained HTML figure from a figure spec (docs/spec.md).
//
//   node player/make-figure.mjs <spec.json> [--out <file.html>] [--open]
//   npm run figure -- <spec.json> [--out <file.html>] [--open]
//
// Validates the spec with player/spec.js against organs/organs.js. If it is invalid, prints every
// error on stderr, writes nothing and exits 1. Otherwise writes one HTML file that inlines
// three.js, the kit, the player, the figure UI and its CSS, the organ manifests the spec names,
// the meshes of the organs it draws, the mesh credits and the spec itself, so the file opens from
// disk (file://) with no network. Default output: ./sagittal-figures/<slug of the title>.html
// (relative to the current directory; under `npm run`, the directory npm was run from). Prints the written path on stdout. --open opens it in the
// default browser.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const rel = (p) => path.join(ROOT, p);
const read = (p) => readFileSync(rel(p), 'utf8');

function usage(msg) {
  if (msg) process.stderr.write('make-figure: ' + msg + '\n');
  process.stderr.write('usage: node player/make-figure.mjs <spec.json> [--out <file.html>] [--open]\n');
  process.exit(2);
}

function parseArgs(argv) {
  const a = { spec: null, out: null, open: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--open') a.open = true;
    else if (x === '--out') { a.out = argv[++i]; if (!a.out) usage('--out needs a file name'); }
    else if (x.startsWith('--out=')) a.out = x.slice(6);
    else if (x === '-h' || x === '--help') usage();
    else if (x.startsWith('-')) usage('unknown option ' + x);
    else if (a.spec) usage('one spec at a time');
    else a.spec = x;
  }
  if (!a.spec) usage('give a spec file');
  return a;
}

// Runs classic browser scripts in one fresh context and returns its window.
function classic(files) {
  const window = {};
  const ctx = vm.createContext({ window });
  for (const f of files) vm.runInContext(read(f), ctx, { filename: f });
  return window;
}

// Same slug as SagittalUI.slug (player/ui.js), so the file name matches the saved image names.
export function slug(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'figure';
}

// Organ ids the spec names: its listed organs plus every "<organ>/<id>" it routes through.
function organsNamed(spec, resolved, manifests) {
  const ids = new Set(resolved.organs.map((o) => o.id));
  (function walk(v) {
    if (typeof v === 'string') {
      const i = v.indexOf('/');
      if (i > 0 && Object.prototype.hasOwnProperty.call(manifests, v.slice(0, i))) ids.add(v.slice(0, i));
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  })(spec);
  return [...ids];
}

// JSON safe inside <script>: no "</script>", "<!--" or line separators can end or confuse it.
export const jsonForScript = (x) => JSON.stringify(x).replace(/</g, '\\u003c')
  .replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');

export function inlineScript(name, code) {
  if (/<\/script/i.test(code) || /<!--/.test(code)) throw new Error(name + ' contains "</script" or "<!--"; it cannot be inlined as is');
  return `<script data-src="${name}">\n${code}\n</script>\n`;
}

export function inlineCss(css) {
  // The figure must work offline: drop remote @import (e.g. web fonts); the CSS falls back to its
  // local font stack.
  const out = css.replace(/@import\s+(url\()?\s*["']?https?:[^;]*;/gi, () => {
    process.stderr.write('make-figure: dropped a remote @import from figure.css (figures work offline)\n');
    return '';
  });
  if (/<\/style/i.test(out)) throw new Error('figure.css contains "</style"');
  return out;
}

// The page script: reads the inlined spec, validates it in the page, mounts the figure.
// Query keys as in player/dev.html: ?v=normal|variant, organ toggles, &theme=light|dark; and
// &rot=x,y / &zoom=z for the starting camera.
const BOOT = `(function () {
  function fail(lines) { var e = document.getElementById('errors'); e.textContent = lines.join('\\n'); e.hidden = false; }
  try {
    var q = new URLSearchParams(location.search);
    if (/^(light|dark)$/.test(q.get('theme') || '')) document.documentElement.setAttribute('data-theme', q.get('theme'));
    var spec = JSON.parse(document.getElementById('spec').textContent);
    var res = SagittalSpec.validate(spec, SagittalOrgans);
    if (!res.ok) { fail(res.errors); return; }
    var R = res.resolved, rot = (q.get('rot') || '').split(',').map(Number), zoom = Number(q.get('zoom'));
    // ?rot=x,y and ?zoom=z start the camera elsewhere (to look at a figure from another side)
    if (rot.length === 2 && rot.every(isFinite)) R.view = Object.assign({}, R.view, { rot: rot });
    if (q.get('zoom') && zoom >= 3 && zoom <= 16) R.view = Object.assign({}, R.view, { zoom: zoom });
    var state = {};
    q.forEach(function (v, k) { if (['theme', 'rot', 'zoom'].indexOf(k) < 0) state[k] = v; });
    SagittalUI.mount({ resolved: R, credits: window.SagittalCredits, state: state });
  } catch (e) { fail([String(e && e.message || e)]); }
})();`;

export function buildFigure(spec) {
  const win = classic(['organs/organs.js', 'player/spec.js']);
  const all = win.SagittalOrgans;
  const res = win.SagittalSpec.validate(spec, all);
  if (!res.ok) return { ok: false, errors: [...res.errors] };
  const R = res.resolved;

  // Only the manifests the spec names. The validator only looks at listed organs and the organs a
  // name points into, so the result must be the same; if it ever is not, keep every manifest.
  const ids = organsNamed(spec, R, all.manifests);
  let organs = {
    index: all.index.filter((o) => ids.includes(o.id)),
    manifests: Object.fromEntries(ids.map((id) => [id, all.manifests[id]])),
    references: all.references,
  };
  const again = win.SagittalSpec.validate(spec, organs);
  if (!again.ok || JSON.stringify(again.resolved) !== JSON.stringify(R)) organs = all;

  const meshes = [...new Set(R.organs.map((o) => all.manifests[o.id].mesh))];
  const credits = JSON.parse(read('site/meshes/credits.json'));
  const title = String(R.title);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let html = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    + '<meta name="color-scheme" content="light dark">\n'
    + '<meta name="generator" content="sagittal make-figure">\n'
    + `<title>${esc(title)} · Sagittal</title>\n<link rel="icon" href="data:,">\n`
    + `<style>\n${inlineCss(read('player/figure.css'))}\n</style>\n</head>\n<body>\n`
    + '<pre id="errors" class="fig-errors" hidden></pre>\n'
    + `<script type="application/json" id="spec">${jsonForScript(spec)}</script>\n`;
  html += inlineScript('three.min.js', read('site/vendor/three.min.js'));
  html += inlineScript('labels.js', read('site/kit/labels.js'));
  html += inlineScript('kit.js', read('site/kit/kit.js'));
  html += inlineScript('organs.js', 'window.SagittalOrgans = ' + jsonForScript(organs) + ';');
  for (const m of meshes) html += inlineScript(`meshes/${m}.js`, read(`organs/meshes/${m}.js`));
  html += inlineScript('credits.json', 'window.SagittalCredits = ' + jsonForScript(credits) + ';');
  html += inlineScript('spec.js', read('player/spec.js'));
  html += inlineScript('player.js', read('player/player.js'));
  html += inlineScript('ui.js', read('player/ui.js'));
  html += inlineScript('boot', BOOT);
  html += '</body>\n</html>\n';
  return { ok: true, html, resolved: R, organs: ids, meshes };
}

function openFile(file) {
  const cmd = process.platform === 'darwin' ? ['open', [file]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]]
    : ['xdg-open', [file]];
  const p = spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' });
  p.on('error', (e) => process.stderr.write(`make-figure: could not open ${file}: ${e.message}\n`));
  p.unref();
}

function main() {
  const a = parseArgs(process.argv.slice(2));
  // `npm run figure` runs in the package root; paths are the user's, relative to where they ran it.
  const base = (process.env.npm_lifecycle_event === 'figure' && process.env.INIT_CWD) || process.cwd();
  a.spec = path.resolve(base, a.spec);
  let spec;
  try { spec = JSON.parse(readFileSync(a.spec, 'utf8')); }
  catch (e) {
    process.stderr.write(`make-figure: ${a.spec}: ${existsSync(a.spec) ? 'not valid JSON: ' + e.message : 'no such file'}\n`);
    process.exit(1);
  }
  const r = buildFigure(spec);
  if (!r.ok) {
    process.stderr.write(`${a.spec}: ${r.errors.length} error${r.errors.length === 1 ? '' : 's'}\n`);
    for (const e of r.errors) process.stderr.write(e + '\n');
    process.exit(1);
  }
  const out = path.resolve(base, a.out || path.join('sagittal-figures', slug(r.resolved.title) + '.html'));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, r.html);
  process.stdout.write(out + '\n');
  if (a.open) openFile(out);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
