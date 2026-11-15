// make-figure (player/make-figure.mjs): one self-contained HTML file per valid spec, nothing for an
// invalid one. The e2e (tests/e2e/make_figure.spec.mjs) opens the written files from file://.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, statSync, rmSync, realpathSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildFigure, slug } from '../player/make-figure.mjs';
import { loadClassic } from './helpers/loadClassic.mjs';

const ROOT = process.cwd();
const TOOL = path.join(ROOT, 'player/make-figure.mjs');
const FIX = 'tests/fixtures/figures/';
const fixtures = readdirSync(FIX).filter((f) => f.endsWith('.json')).sort();
const spec = (f) => JSON.parse(readFileSync(FIX + f, 'utf8'));
const tmp = () => realpathSync(mkdtempSync(path.join(tmpdir(), 'sagittal-fig-')));
const run = (args, cwd = ROOT) => spawnSync('node', [TOOL, ...args], { cwd, encoding: 'utf8' });

// Everything the file loads from outside itself: src/href attributes, CSS url()/@import.
function externalRefs(html) {
  const out = [];
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*["']?\s*((?:https?:)?\/\/[^"'\s>]+)/gi)) out.push(m[1]);
  for (const m of html.matchAll(/@import\s+(?:url\()?\s*["']?((?:https?:)?\/\/[^"')\s;]+)/gi)) out.push(m[1]);
  for (const m of html.matchAll(/url\(\s*["']?((?:https?:)?\/\/[^"')\s]+)/gi)) out.push(m[1]);
  return out;
}
// The HTML minus the vendored three.js block (three's own FileLoader mentions fetch; it is never
// called by the figure, and the e2e checks that no request leaves the page).
const withoutThree = (html) => html.replace(/<script data-src="three\.min\.js">[\s\S]*?<\/script>/, '');

test('an invalid spec: exit 1, every error on stderr, no file written', () => {
  const d = tmp();
  const bad = path.join(d, 'bad.json'), out = path.join(d, 'bad.html');
  writeFileSync(bad, JSON.stringify({ schema: 'sagittal-figure/1', title: 'x', organs: [{ id: 'nope' }], variant: { label: 'x', edits: [] }, claims: [] }));
  const r = run([bad, '--out', out]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /organs\[0\]\.id: unknown organ "nope"/);
  assert.match(r.stderr, /claims: must not be empty/);
  assert.equal(r.stdout, '');
  assert.equal(existsSync(out), false);
  rmSync(d, { recursive: true });
});

test('a file that is not JSON, or missing: exit 1, no file', () => {
  const d = tmp();
  writeFileSync(path.join(d, 'x.json'), '{nope');
  let r = run([path.join(d, 'x.json'), '--out', path.join(d, 'x.html')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not valid JSON/);
  r = run([path.join(d, 'missing.json'), '--out', path.join(d, 'x.html')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no such file/);
  assert.equal(existsSync(path.join(d, 'x.html')), false);
  rmSync(d, { recursive: true });
});

test('default output is ./sagittal-figures/<slug>.html in the current directory', () => {
  const d = tmp();
  const r = run([path.join(ROOT, FIX, 'replaced-rha.json')], d);
  assert.equal(r.status, 0, r.stderr);
  const want = path.join(d, 'sagittal-figures', 'replaced-right-hepatic-artery-from-the-sma.html');
  assert.equal(r.stdout.trim(), path.resolve(want));
  assert.ok(existsSync(want));
  rmSync(d, { recursive: true });
});

test('slug matches the figure UI (saved images use the same name)', () => {
  assert.equal(slug('Replaced right hepatic artery from the SMA'), 'replaced-right-hepatic-artery-from-the-sma');
  assert.equal(slug('Aberrant right subclavian (lusoria) — Café'), 'aberrant-right-subclavian-lusoria-cafe');
  assert.equal(slug('***'), 'figure');
});

for (const f of fixtures) {
  test(`${f}: one self-contained file, at most 3 MB`, () => {
    const d = tmp();
    const out = path.join(d, 'fig.html');
    execFileSync('node', [TOOL, FIX + f, '--out', out], { stdio: 'pipe' });
    const html = readFileSync(out, 'utf8');
    assert.ok(statSync(out).size <= 3 * 1024 * 1024, `size ${statSync(out).size}`);
    assert.ok(!html.includes('src="http'), 'no src="http');
    assert.deepEqual(externalRefs(html), [], 'no external src/href/url()/@import');
    assert.ok(!withoutThree(html).includes('fetch('), 'no fetch( outside three.js');
    assert.ok(html.startsWith('<!doctype html>'));

    // the spec, as written, in its own JSON script
    const m = html.match(/<script type="application\/json" id="spec">([\s\S]*?)<\/script>/);
    assert.ok(m, 'spec script');
    assert.deepEqual(JSON.parse(m[1]), spec(f));

    // figure.css and the UI/player scripts as they are now; credits inlined for the credit line
    assert.ok(html.includes(readFileSync('player/figure.css', 'utf8')), 'figure.css inlined');
    for (const s of ['player/ui.js', 'player/player.js', 'player/spec.js', 'site/kit/kit.js', 'site/kit/labels.js']) {
      assert.ok(html.includes(readFileSync(s, 'utf8')), s + ' inlined');
    }
    assert.match(html, /window\.SagittalCredits = \{"about"/);

    // meshes: exactly those of the listed organs
    const b = buildFigure(spec(f));
    const meshes = [...html.matchAll(/<script data-src="meshes\/([\w-]+)\.js">/g)].map((x) => x[1]);
    assert.deepEqual(meshes.sort(), [...b.meshes].sort());
    assert.deepEqual(b.meshes.sort(), [...new Set(spec(f).organs.map((o) => o.id))].sort());
    rmSync(d, { recursive: true });
  });
}

test('organs.js is cut down to the organs the spec names, including those it only routes through', () => {
  const b = buildFigure(spec('replaced-rha.json'));
  // liver-segments is not drawn, but the left hepatic artery is routed through its landmarks
  assert.ok(b.organs.includes('liver-segments'));
  assert.ok(!b.organs.includes('heart'));
  const m = b.html.match(/<script data-src="organs\.js">\nwindow\.SagittalOrgans = ([\s\S]*?);\n<\/script>/);
  const organs = JSON.parse(m[1]);
  assert.deepEqual(Object.keys(organs.manifests).sort(), [...b.organs].sort());
  assert.deepEqual(organs.index.map((o) => o.id).sort(), [...b.organs].sort());
  // every reference stays, so the info panel can resolve any claim
  assert.deepEqual(organs.references, JSON.parse(readFileSync('organs/references.json', 'utf8')));
});

test('text that could close a script is escaped in the inlined spec', () => {
  const s = spec('low-cystic-duct.json');
  s.title = 'Low cystic duct </script><script>alert(1)</script>';
  const b = buildFigure(s);
  assert.ok(b.ok);
  const m = b.html.match(/<script type="application\/json" id="spec">([\s\S]*?)<\/script>/);
  assert.equal(JSON.parse(m[1]).title, s.title);
  assert.ok(!b.html.includes('</script><script>alert'));
  assert.ok(b.html.includes('<title>Low cystic duct &lt;/script&gt;'));
});

test('a figure with the 12 largest organs still fits in 3 MB', () => {
  const O = JSON.parse(JSON.stringify(loadClassic('organs/organs.js').SagittalOrgans));
  const size = (id) => statSync(`organs/meshes/${O.manifests[id].mesh}.js`).size;
  const ids = Object.keys(O.manifests).sort((a, b) => size(b) - size(a)).slice(0, 12);
  const s = { schema: 'sagittal-figure/1', title: 'Largest figure', organs: ids.map((id) => ({ id })),
    variant: { label: 'v', edits: [{ op: 'branch', id: 'x', name: 'x', tissue: 'vessel-artery', radius_cm: 0.2,
      from: { on: 'aorta/abdominal_aorta', t: 0.5 }, to: { landmark: 'aorta/aortic_bifurcation', offset: { dir: 'right', cm: 2 } } }] },
    claims: [{ text: 'x', refs: [Object.keys(O.references)[0]] }] };
  const b = buildFigure(s);
  assert.ok(b.ok, JSON.stringify(b.errors));
  assert.equal(b.meshes.length, 12);
  const bytes = Buffer.byteLength(b.html);
  assert.ok(bytes <= 3 * 1024 * 1024, `largest figure is ${bytes} bytes`);
  console.log('largest figure:', bytes, 'bytes');
});
