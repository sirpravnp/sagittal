import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMeta } from '../lib/validateMeta.mjs';

const valid = () => ({
  id: 'heart-chambers',
  title: 'Heart Chambers',
  topic: 'cardiac',
  variantControl: 'Layer',
  variants: [{ key: 'a', label: 'A' }],
  claims: ['The heart has four chambers.'],
  sources: [],
});

test('valid meta passes', () => {
  const r = validateMeta(valid());
  assert.deepEqual(r, { ok: true, errors: [] });
});

test('missing claims fails', () => {
  const m = valid(); delete m.claims;
  const r = validateMeta(m);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('claims')));
});

test('empty claims fails', () => {
  const r = validateMeta({ ...valid(), claims: [] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('claims')));
});

test('a meta with no status passes', () => {
  assert.equal('status' in valid(), false);
  assert.equal(validateMeta(valid()).ok, true);
});

test('any status value is rejected', () => {
  for (const status of ['unreviewed', 'reviewed', 'bogus', '', null]) {
    const r = validateMeta({ ...valid(), status });
    assert.equal(r.ok, false, String(status));
    assert.ok(r.errors.includes('status is no longer used'), String(status));
  }
});

test('bad ids fail', () => {
  for (const id of ['has space', 'Upper', '', 'a_b']) {
    const r = validateMeta({ ...valid(), id });
    assert.equal(r.ok, false, id);
    assert.ok(r.errors.some(e => e.includes('id')));
  }
});

test('type checks on other fields', () => {
  assert.equal(validateMeta({ ...valid(), variants: [] }).ok, false);
  assert.equal(validateMeta({ ...valid(), variants: [{ key: 'a' }] }).ok, false);
  assert.equal(validateMeta({ ...valid(), variantControl: '' }).ok, false);
  assert.equal(validateMeta({ ...valid(), sources: [1] }).ok, false);
  assert.equal(validateMeta({ ...valid(), title: '' }).ok, false);
  assert.equal(validateMeta({ ...valid(), topic: 5 }).ok, false);
  assert.equal(validateMeta(null).ok, false);
});

test('collects every error', () => {
  const r = validateMeta({});
  assert.ok(r.errors.length >= 6);
});
