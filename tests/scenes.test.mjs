import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { validateMeta } from '../lib/validateMeta.mjs';

const dir = new URL('../site/scenes/', import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));

test('index.json is a non-empty array of unique ids', () => {
  const ids = readJson('index.json');
  assert.ok(Array.isArray(ids) && ids.length > 0);
  assert.equal(new Set(ids).size, ids.length);
});

test('every id in index.json has a scene script and meta file', () => {
  for (const id of readJson('index.json')) {
    assert.ok(existsSync(new URL(`${id}.js`, dir)), `${id}.js missing`);
    assert.ok(existsSync(new URL(`${id}.meta.json`, dir)), `${id}.meta.json missing`);
  }
});

test('every scene meta passes validateMeta and matches its file name', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.meta.json'));
  assert.ok(files.length > 0);
  for (const f of files) {
    const meta = readJson(f);
    const r = validateMeta(meta);
    assert.deepEqual(r.errors, [], f);
    assert.equal(meta.id, f.replace(/\.meta\.json$/, ''), f);
  }
});

// Loads three.js, the kit and one scene script in a fresh VM context (window === global).
function loadScene(id) {
  const ctx = vm.createContext({ console });
  ctx.window = ctx; ctx.self = ctx;
  for (const f of ['../vendor/three.min.js', '../kit/labels.js', '../kit/kit.js', `${id}.js`]) {
    const p = new URL(f, dir);
    vm.runInContext(readFileSync(p, 'utf8'), ctx, { filename: p.pathname });
  }
  return ctx.Kit.get(id);
}

test('every meta variantControl and variant key exists in the scene controls', () => {
  for (const id of readJson('index.json')) {
    const meta = readJson(`${id}.meta.json`);
    const def = loadScene(id);
    assert.ok(def, `${id}: scene did not register`);
    const ctl = def.controls.find((c) => c.k === meta.variantControl);
    assert.ok(ctl, `${id}: variantControl "${meta.variantControl}" is not a control`);
    assert.ok(ctl.opts, `${id}: variantControl "${meta.variantControl}" has no opts`);
    const keys = ctl.opts.map((o) => o[0]);
    for (const v of meta.variants) assert.ok(keys.includes(v.key), `${id}: variant "${v.key}" not in ${keys}`);
  }
});
