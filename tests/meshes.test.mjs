import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { loadClassic } from './helpers/loadClassic.mjs';

const DIR = 'site/meshes/';
const MAX_BYTES = 400 * 1024;
const credits = readFileSync(DIR + 'CREDITS.md', 'utf8');
const meshFiles = readdirSync(DIR).filter((f) => f.endsWith('.js'));

// Decodes one part the same way Kit.meshPart does (base64 -> typed arrays).
function decode(part) {
  const pb = Buffer.from(part.p, 'base64');
  const ib = Buffer.from(part.i, 'base64');
  const pos = new Float32Array(pb.buffer.slice(pb.byteOffset, pb.byteOffset + pb.length));
  const idx = part.it === 'u32'
    ? new Uint32Array(ib.buffer.slice(ib.byteOffset, ib.byteOffset + ib.length))
    : new Uint16Array(ib.buffer.slice(ib.byteOffset, ib.byteOffset + ib.length));
  return { pos, idx, nVerts: pos.length / 3, nTris: idx.length / 3 };
}

function bounds(pos) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pos[i + k]); hi[k] = Math.max(hi[k], pos[i + k]); }
  }
  return { lo, hi };
}

test('every baked mesh is a well-formed classic script with a credits entry and stays small', () => {
  assert.ok(meshFiles.length > 0);
  for (const f of meshFiles) {
    const name = f.replace(/\.js$/, '');
    assert.ok(statSync(DIR + f).size <= MAX_BYTES, `${f} is over 400 KB`);
    const lib = loadClassic(DIR + f).SagittalMeshes[name];
    assert.ok(lib, `${f} must assign window.SagittalMeshes["${name}"]`);
    assert.equal(lib.unit, 'cm', f);
    assert.match(credits, new RegExp(`^## ${lib.credit}\\b`, 'm'), `${f}: credit "${lib.credit}" missing from CREDITS.md`);
    assert.ok(Object.keys(lib.parts).length > 0, f);
    for (const [pn, part] of Object.entries(lib.parts)) {
      const tag = `${name}/${pn}`;
      assert.ok(part.it === 'u16' || part.it === 'u32', tag);
      const { pos, idx, nVerts, nTris } = decode(part);
      assert.ok(Number.isInteger(nVerts) && nVerts > 0, tag);
      assert.ok(Number.isInteger(nTris) && nTris > 0, tag);
      assert.ok(part.it === 'u32' || nVerts <= 65535, tag);
      let max = 0;
      for (const i of idx) if (i > max) max = i;
      assert.ok(max < nVerts, `${tag}: index out of range`);
      for (const v of pos) assert.ok(Number.isFinite(v), `${tag}: non-finite position`);
      if (part.n) assert.equal(Buffer.from(part.n, 'base64').length, pos.length * 4, tag);
      const b = bounds(pos);
      part.bbox.slice(0, 3).forEach((v, k) => assert.ok(Math.abs(v - b.lo[k]) < 0.01, `${tag}: bbox min`));
      part.bbox.slice(3).forEach((v, k) => assert.ok(Math.abs(v - b.hi[k]) < 0.01, `${tag}: bbox max`));
    }
  }
});

test('thorax proof bake: expected parts, counts and anatomical bounds (cm, +x left, +y up, +z anterior)', () => {
  const lib = loadClassic(DIR + 'thorax.js').SagittalMeshes.thorax;
  assert.equal(lib.credit, 'zanatomy');
  assert.deepEqual(Object.keys(lib.parts).sort(), [
    'costal_cartilage_left', 'costal_cartilage_right', 'ribs_left', 'ribs_right',
    'sternum', 'thoracic_discs', 'thoracic_spine',
  ]);
  const d = Object.fromEntries(Object.entries(lib.parts).map(([k, p]) => [k, { ...decode(p), ...bounds(decode(p).pos) }]));
  // budgets from tools/meshes/configs/thorax.json
  assert.ok(d.ribs_left.nTris <= 5200 && d.ribs_left.nTris > 4000);
  assert.ok(d.sternum.nTris <= 1600 && d.sternum.nTris > 1000);
  assert.ok(d.thoracic_spine.nTris <= 5200 && d.thoracic_spine.nTris > 4000);
  const total = Object.values(d).reduce((s, p) => s + p.nTris, 0);
  assert.ok(total < 25000, `total ${total} triangles`);
  // patient's left ribs at +x, right at -x
  assert.ok(d.ribs_left.lo[0] > 0 && d.ribs_right.hi[0] < 0);
  // sternum anterior (+z) of the spine
  assert.ok(d.sternum.lo[2] > d.thoracic_spine.hi[2]);
  // adult thorax: ~25-35 cm wide, ~30-45 cm tall (T1 to the 12th rib)
  const lo = [0, 1, 2].map((k) => Math.min(...Object.values(d).map((p) => p.lo[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...Object.values(d).map((p) => p.hi[k])));
  const size = hi.map((h, k) => h - lo[k]);
  assert.ok(size[0] > 25 && size[0] < 35, `width ${size[0]}`);
  assert.ok(size[1] > 30 && size[1] < 45, `height ${size[1]}`);
  // centred on the combined bounding box
  [0, 1, 2].forEach((k) => assert.ok(Math.abs(lo[k] + hi[k]) < 0.5, `axis ${k} not centred`));
  assert.equal(lib.offset.length, 3);
});
