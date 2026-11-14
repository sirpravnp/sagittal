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
  status: 'unreviewed',
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

test('reviewed without reviewer fails', () => {
  const r = validateMeta({ ...valid(), status: 'reviewed', reviewedOn: '2026-01-02' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('reviewer')));
});

test('reviewed without reviewedOn or with bad date fails', () => {
  const base = { ...valid(), status: 'reviewed', reviewer: 'Dr X' };
  assert.ok(validateMeta(base).errors.some(e => e.includes('reviewedOn')));
  assert.ok(validateMeta({ ...base, reviewedOn: '01/02/2026' }).errors.some(e => e.includes('reviewedOn')));
  assert.equal(validateMeta({ ...base, reviewedOn: '2026-01-02' }).ok, true);
});

test('bogus status fails', () => {
  const r = validateMeta({ ...valid(), status: 'bogus' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('status')));
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
