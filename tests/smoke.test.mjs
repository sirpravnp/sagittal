import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const THREE_PATH = 'site/vendor/three.min.js';

test('vendored three.js exists', () => {
  assert.ok(fs.existsSync(THREE_PATH), `${THREE_PATH} is missing`);
});

test('vendored three.js is revision 149', () => {
  const src = fs.readFileSync(THREE_PATH, 'utf8');
  // three.min.js declares the revision as a minified constant (const e="149")
  // that is exported as t.REVISION=e.
  assert.match(src, /const \w+="149"/);
  assert.match(src, /\.REVISION=\w+/);
});
