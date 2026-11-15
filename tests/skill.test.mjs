// The student skill (skills/sagittal): reference files in sync with the library, ids it names
// exist, the wrapper script finds the repo through the install symlink.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, symlinkSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadClassic } from './helpers/loadClassic.mjs';
import { generate, stale } from '../tools/build_organs.mjs';

const ROOT = process.cwd();
const SKILL = path.join(ROOT, 'skills/sagittal');
const read = (p) => readFileSync(path.join(SKILL, p), 'utf8');
const organs = () => JSON.parse(JSON.stringify(loadClassic('organs/organs.js').SagittalOrgans));

// Compared in memory: npm test never rewrites tracked files.
test('generated files (organs.js, reference/organs.md, reference/spec.md) are up to date', () => {
  const files = generate();
  assert.equal(files['skills/sagittal/reference/spec.md'], readFileSync('docs/spec.md', 'utf8'));
  assert.deepEqual(stale(files), [], 'stale generated files: run npm run organs and commit them');
});

test('build_organs --check passes on this tree (it writes nothing; exit 1 lists stale files)', () => {
  const r = spawnSync('node', ['tools/build_organs.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('organs.md gives the t of landmarks and branch origins along each line', () => {
  const md = read('reference/organs.md');
  const row = md.split('\n').find((l) => l.startsWith('| `aortic_arch` | 0.00'));
  assert.ok(row, 'aortic_arch along-line row');
  const t = (what) => Number(row.match(new RegExp('(\\d\\.\\d\\d) origin of `' + what + '`'))[1]);
  // arch branches in order along the arch
  assert.ok(t('brachiocephalic_trunk') < t('left_common_carotid_artery'));
  assert.ok(t('left_common_carotid_artery') < t('left_subclavian_artery'));
  // and the t given is where the validator puts it: pointAt(t) lies near the child's origin
  const O = organs(), arch = O.manifests.aorta.centerlines.aortic_arch.points;
  const { SagittalSpec } = loadClassic('player/spec.js');
  const spec = { schema: 'sagittal-figure/1', title: 't check', organs: [{ id: 'aorta' }],
    variant: { label: 'v', edits: [{ op: 'branch', id: 'b', name: 'b', tissue: 'vessel-artery', radius_cm: 0.2,
      from: { on: 'aorta/aortic_arch', t: t('left_subclavian_artery') }, to: { landmark: 'aorta/left_subclavian_artery_end' } }] },
    claims: [{ text: 'x', refs: [Object.keys(O.references)[0]] }] };
  const r = JSON.parse(JSON.stringify(SagittalSpec.validate(spec, O)));
  assert.ok(r.ok, JSON.stringify(r.errors));
  const p0 = JSON.stringify(r.resolved).match(/"points":\[\[([-\d.e]+),([-\d.e]+),([-\d.e]+)\]/).slice(1).map(Number);
  const o = O.manifests.aorta.centerlines.left_subclavian_artery.points[0];
  assert.ok(Math.hypot(p0[0] - o[0], p0[1] - o[1], p0[2] - o[2]) < 1.0, `branch start ${p0} vs LSA origin ${o}`);
  assert.ok(arch.length > 2);
});

test('organs.md lists every organ, part, centre line (with parent), landmark and reference', () => {
  const md = read('reference/organs.md');
  const O = organs();
  for (const { id } of O.index) {
    const m = O.manifests[id];
    assert.ok(md.includes(`\n## ${id}\n`), id);
    const sec = md.split(`\n## ${id}\n`)[1].split('\n## ')[0];
    for (const p of m.parts) assert.ok(sec.includes(`| \`${p.id}\` |`), `${id} part ${p.id}`);
    for (const [c, cl] of Object.entries(m.centerlines)) {
      const row = sec.split('\n').find((l) => l.startsWith(`| \`${c}\` | `) && l.split('|').length > 8);
      assert.ok(row, `${id} line ${c}`);
      assert.ok(row.includes(cl.parent ? `\`${cl.parent}\`` : '—'), `${id} line ${c} parent`);
    }
    for (const [l, lm] of Object.entries(m.landmarks)) {
      assert.ok(sec.includes(`| \`${l}\` | ${lm.name.replace(/\|/g, '\\|')} |`), `${id} landmark ${l}`);
    }
  }
  for (const r of Object.keys(O.references)) assert.ok(md.includes(`| \`${r}\` |`), 'reference ' + r);
  assert.match(md, /## Gaps[\s\S]*Ureters/);
});

test('SKILL.md: frontmatter, under 200 lines, its files exist, no Anki', () => {
  const s = read('SKILL.md');
  const fm = s.match(/^---\nname: sagittal\ndescription: (.+)\n---\n/);
  assert.ok(fm, 'frontmatter with name and description');
  assert.ok(fm[1].length <= 1024);
  assert.match(fm[1], /replaced right hepatic artery/);
  assert.match(fm[1], /aberrant right subclavian/);
  assert.ok(s.split('\n').length <= 200, `${s.split('\n').length} lines`);
  assert.ok(!/anki/i.test(s), 'Anki is on hold');
  assert.ok(s.includes('ln -s "$PWD/skills/sagittal" ~/.claude/skills/sagittal'));
  for (const f of ['reference/organs.md', 'reference/spec.md', 'reference/patterns.md', 'scripts/sagittal.mjs']) {
    assert.ok(s.includes(f), 'SKILL.md mentions ' + f);
    assert.ok(existsSync(path.join(SKILL, f)), f);
  }
});

test('every library name the skill writes as `organ/id` exists', () => {
  const O = organs();
  const text = ['SKILL.md', 'reference/patterns.md', 'reference/spec.md'].map(read).join('\n');
  const names = [...text.matchAll(/["`]([a-z][a-z-]*)\/([a-z][a-z0-9_]*)["`]/g)]
    .filter((m) => O.manifests[m[1]] && !(m[1] === 'portal-venous' && m[2] === 'foo')); // spec.md's unknown-landmark error example
  assert.ok(names.length > 10, String(names.length));
  for (const [, org, id] of names) {
    const m = O.manifests[org];
    const ok = (m.centerlines[id] || m.landmarks[id] || m.parts.some((p) => p.id === id));
    assert.ok(ok, `${org}/${id}`);
  }
  // every organ named as "<organ>/..." is an organ id
  for (const m of text.matchAll(/`([a-z-]+)\/\.\.\.`/g)) assert.ok(O.manifests[m[1]], m[1]);
});

test('evals/prompts.md has the three named variants and two more', () => {
  const p = read('evals/prompts.md');
  for (const v of [/replaced right hepatic artery/i, /low (insertion of the )?cystic duct/i, /aberrant right subclavian/i,
    /accessory left hepatic artery/i, /common hepatic artery arising from the superior mesenteric/i]) assert.match(p, v);
  assert.equal((p.match(/^## \d\. /gm) || []).length, 8);
  assert.match(p, /retrocaval ureter/i);
  // held-out prompts are not described anywhere the skill reader sees
  const ref = ['SKILL.md', 'reference/spec.md', 'reference/patterns.md'].map(read).join('\n').toLowerCase();
  for (const h of ['bovine', 'hepatomesenteric', 'replaced left hepatic', 'michels ii']) assert.ok(!ref.includes(h), 'reference/ mentions held-out ' + h);
});

test('scripts/sagittal.mjs finds the repo through the install symlink and builds a figure', () => {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), 'sagittal-skill-')));
  const skills = path.join(d, 'home/.claude/skills');
  mkdirSync(skills, { recursive: true });
  symlinkSync(SKILL, path.join(skills, 'sagittal'));
  const script = path.join(skills, 'sagittal/scripts/sagittal.mjs');
  const env = { ...process.env };
  delete env.SAGITTAL_HOME; delete env.npm_lifecycle_event;
  const work = path.join(d, 'work');
  mkdirSync(work);

  let r = spawnSync('node', [script, 'home'], { cwd: work, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), realpathSync(ROOT));

  r = spawnSync('node', [script, 'figure', path.join(ROOT, 'tests/fixtures/figures/low-cystic-duct.json')], { cwd: work, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(path.join(work, 'sagittal-figures/low-insertion-of-the-cystic-duct.html')), r.stdout);

  r = spawnSync('node', [script, 'home'], { cwd: work, env: { ...env, SAGITTAL_HOME: path.join(d, 'nowhere') }, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no sagittal repo at .*SAGITTAL_HOME/s);
  rmSync(d, { recursive: true });
});

test('the worked examples in docs/spec.md validate against the library', () => {
  const md = readFileSync('docs/spec.md', 'utf8');
  const blocks = [...md.matchAll(/## Worked example \d[^\n]*\n[\s\S]*?```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
  assert.equal(blocks.length, 2);
  const { SagittalSpec } = loadClassic('player/spec.js');
  const O = organs();
  for (const b of blocks) {
    const r = SagittalSpec.validate(b, O);
    assert.ok(r.ok, b.title + ': ' + JSON.stringify(r.errors));
  }
});

test('spec.md and patterns.md do not name or solve the regression eval variants', () => {
  const ref = [read('reference/spec.md'), read('reference/patterns.md')].join('\n').toLowerCase();
  for (const v of ['replaced right hepatic', 'low cystic', 'low insertion', 'aberrant right subclavian',
    'retro-oesophageal', 'accessory left hepatic', 'common hepatic artery from the sma', 'superior_mesenteric_artery", "t"']) {
    assert.ok(!ref.includes(v), 'reference names eval variant: ' + v);
  }
});

test('scripts/sagittal.mjs honours a valid SAGITTAL_HOME', () => {
  const d = realpathSync(mkdtempSync(path.join(tmpdir(), 'sagittal-home-')));
  const env = { ...process.env, SAGITTAL_HOME: ROOT };
  delete env.npm_lifecycle_event;
  // a copied (not symlinked) skill only finds the repo through SAGITTAL_HOME
  const copy = path.join(d, 'sagittal/scripts');
  mkdirSync(copy, { recursive: true });
  writeFileSync(path.join(copy, 'sagittal.mjs'), readFileSync(path.join(SKILL, 'scripts/sagittal.mjs')));
  const r = spawnSync('node', [path.join(copy, 'sagittal.mjs'), 'home'], { cwd: d, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), path.resolve(ROOT));
  const r2 = spawnSync('node', [path.join(copy, 'sagittal.mjs'), 'home'], { cwd: d, env: { ...env, SAGITTAL_HOME: '' }, encoding: 'utf8' });
  assert.equal(r2.status, 2);
  rmSync(d, { recursive: true });
});
