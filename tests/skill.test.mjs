// The student skill (skills/sagittal): reference files in sync with the library, ids it names
// exist, the wrapper script finds the repo through the install symlink.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, symlinkSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadClassic } from './helpers/loadClassic.mjs';

const ROOT = process.cwd();
const SKILL = path.join(ROOT, 'skills/sagittal');
const read = (p) => readFileSync(path.join(SKILL, p), 'utf8');
const organs = () => JSON.parse(JSON.stringify(loadClassic('organs/organs.js').SagittalOrgans));

test('reference/spec.md is docs/spec.md', () => {
  assert.equal(read('reference/spec.md'), readFileSync('docs/spec.md', 'utf8'),
    'skills/sagittal/reference/spec.md is stale: run npm run organs');
});

test('reference/organs.md is what npm run organs generates', () => {
  const before = read('reference/organs.md');
  execFileSync('node', ['tools/build_organs.mjs'], { stdio: 'pipe' });
  assert.equal(before, read('reference/organs.md'), 'organs.md was stale: run npm run organs and commit it');
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
  const text = ['SKILL.md', 'reference/patterns.md'].map(read).join('\n');
  const names = [...text.matchAll(/["`]([a-z][a-z-]*)\/([a-z][a-z0-9_]*)["`]/g)]
    .filter((m) => O.manifests[m[1]]);
  assert.ok(names.length > 10);
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
  assert.equal((p.match(/^## \d\. /gm) || []).length, 5);
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
