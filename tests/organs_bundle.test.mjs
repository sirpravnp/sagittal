// Runtime bundle organs/organs.js: classic script exposing window.SagittalOrgans (works from file://).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadClassic } from './helpers/loadClassic.mjs';

const index = JSON.parse(readFileSync('organs/index.json', 'utf8'));
const refs = JSON.parse(readFileSync('organs/references.json', 'utf8'));
// JSON round-trip moves the vm-context objects into this realm so deepEqual compares structure.
// (-0 in a source file serialises as 0; they are numerically identical.)
const norm = (x) => JSON.parse(JSON.stringify(x));
const bundle = () => norm(loadClassic('organs/organs.js').SagittalOrgans);

test('bundle has every organ id from the index', () => {
  const b = bundle();
  assert.deepEqual(b.index, index);
  assert.deepEqual(Object.keys(b.manifests).sort(), index.map((o) => o.id).sort());
});

test('manifests round-trip unchanged (landmarks and centre lines included)', () => {
  const b = bundle();
  for (const { id } of index) {
    const src = norm(JSON.parse(readFileSync(`organs/manifests/${id}.json`, 'utf8')));
    assert.deepEqual(b.manifests[id], src, id);
    assert.deepEqual(b.manifests[id].landmarks, src.landmarks, id);
    assert.deepEqual(b.manifests[id].centerlines, src.centerlines, id);
  }
});

test('references: ids, titles and https urls', () => {
  const b = bundle();
  assert.deepEqual(b.references, refs);
  assert.ok(Object.keys(refs).length >= 25);
  for (const [id, r] of Object.entries(refs)) {
    assert.match(id, /^[a-z0-9-]+$/);
    assert.ok(typeof r.title === 'string' && r.title.trim(), id);
    assert.match(r.url, /^https:\/\/\S+$/, id);
    assert.ok(typeof r.covers === 'string' && r.covers.length > 30, id + ': covers (what the source covers)');
  }
});

test('organs.js is what npm run organs generates (compared in memory; nothing is written)', async () => {
  const { generate } = await import('../tools/build_organs.mjs');
  const a = generate()['organs/organs.js'], b = generate()['organs/organs.js'];
  assert.equal(a, b, 'generation is deterministic');
  assert.equal(readFileSync('organs/organs.js', 'utf8'), a, 'organs/organs.js is stale: run npm run organs');
});
