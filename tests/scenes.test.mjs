import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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
