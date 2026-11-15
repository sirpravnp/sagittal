// Base organ library (organs/): manifest shape (schema sagittal-organ/0), mesh files, credits,
// centre lines and landmarks. See organs/README.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { loadClassic } from './helpers/loadClassic.mjs';

const DIR = 'organs/';
const MAX_BYTES = 400 * 1024;
const credits = readFileSync('site/meshes/CREDITS.md', 'utf8');
const index = JSON.parse(readFileSync(DIR + 'index.json', 'utf8'));
const manifestFiles = readdirSync(DIR + 'manifests').filter((f) => f.endsWith('.json'));
const manifests = manifestFiles.map((f) => [f, JSON.parse(readFileSync(DIR + 'manifests/' + f, 'utf8'))]);
const KEYS = ['schema', 'id', 'name', 'system', 'mesh', 'credit', 'parts', 'centerlines', 'landmarks'];
const isPoint = (p) => Array.isArray(p) && p.length === 3 && p.every((v) => typeof v === 'number' && Number.isFinite(v));
const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

test('index lists every manifest once, with name and system', () => {
  assert.ok(index.length > 0);
  assert.deepEqual(index.map((o) => o.id + '.json').sort(), manifestFiles.slice().sort());
  assert.equal(new Set(index.map((o) => o.id)).size, index.length);
  for (const o of index) {
    assert.deepEqual(Object.keys(o).sort(), ['id', 'name', 'system']);
    assert.ok(nonEmpty(o.name) && nonEmpty(o.system), o.id);
  }
});

test('every manifest has exactly the sagittal-organ/0 shape', () => {
  for (const [f, m] of manifests) {
    assert.deepEqual(Object.keys(m).sort(), KEYS.slice().sort(), f);
    assert.equal(m.schema, 'sagittal-organ/0', f);
    assert.equal(m.id + '.json', f);
    for (const k of ['name', 'system', 'mesh', 'credit']) assert.ok(nonEmpty(m[k]), `${f}: ${k}`);
    const entry = index.find((o) => o.id === m.id);
    assert.equal(entry.name, m.name, f);
    assert.equal(entry.system, m.system, f);
    assert.ok(Array.isArray(m.parts) && m.parts.length > 0, f);
    for (const p of m.parts) {
      assert.deepEqual(Object.keys(p).sort(), ['id', 'name', 'tissue'], `${f}: part keys`);
      assert.match(p.id, /^[a-z0-9_]+$/, f);
      assert.ok(nonEmpty(p.name) && nonEmpty(p.tissue), `${f}/${p.id}`);
    }
    assert.equal(typeof m.centerlines, 'object');
    assert.equal(typeof m.landmarks, 'object');
  }
});

test('every manifest mesh exists, is a well-formed baked file under 400 KB, and has the listed parts', () => {
  const kit = readFileSync('site/kit/kit.js', 'utf8');
  for (const [f, m] of manifests) {
    const path = `${DIR}meshes/${m.mesh}.js`;
    assert.ok(existsSync(path), `${f}: missing ${path}`);
    assert.ok(statSync(path).size <= MAX_BYTES, `${path} is over 400 KB`);
    const lib = loadClassic(path).SagittalMeshes[m.mesh];
    assert.ok(lib, `${path} must assign window.SagittalMeshes["${m.mesh}"]`);
    assert.equal(lib.unit, 'cm');
    assert.equal(lib.credit, m.credit, `${f}: credit differs from the mesh file`);
    assert.deepEqual(Array.from(lib.offset), [0, 0, 0], `${f}: organs share one body frame (centre pinned at 0,0,0)`);
    assert.deepEqual(Object.keys(lib.parts).sort(), m.parts.map((p) => p.id).sort(), `${f}: parts`);
    for (const p of m.parts) assert.ok(kit.includes(`'${p.tissue}':`), `${f}/${p.id}: unknown Kit tissue "${p.tissue}"`);
  }
});

test('every credit heading exists in site/meshes/CREDITS.md', () => {
  for (const [f, m] of manifests) {
    assert.match(credits, new RegExp(`^## ${m.credit}\\b`, 'm'), `${f}: credit "${m.credit}" missing from CREDITS.md`);
  }
});

test('centre lines have at least 2 points, a radius and a valid from; landmarks have a derived note', () => {
  const allLandmarks = new Set();
  for (const [, m] of manifests) for (const k of Object.keys(m.landmarks)) {
    assert.ok(!allLandmarks.has(k), `landmark id ${k} is used by two organs`);
    allLandmarks.add(k);
  }
  const allLines = new Set();
  for (const [f, m] of manifests) {
    for (const [k, c] of Object.entries(m.centerlines)) {
      const tag = `${f}: centre line ${k}`;
      assert.ok(!allLines.has(k), `${tag} is defined twice`);
      allLines.add(k);
      assert.deepEqual(Object.keys(c).sort(), ['from', 'name', 'points', 'radius_cm'], tag);
      assert.ok(nonEmpty(c.name), tag);
      assert.ok(Array.isArray(c.points) && c.points.length >= 2, `${tag}: needs >= 2 points`);
      assert.ok(c.points.every(isPoint), `${tag}: points must be [x,y,z] numbers`);
      assert.ok(typeof c.radius_cm === 'number' && c.radius_cm > 0, tag);
      assert.ok(c.from === null || allLandmarks.has(c.from), `${tag}: from "${c.from}" is not a landmark`);
      if (c.from !== null) {
        const lm = manifests.map(([, mm]) => mm.landmarks[c.from]).find(Boolean);
        const d = Math.hypot(...lm.p.map((v, i) => v - c.points[0][i]));
        assert.ok(d < 0.01, `${tag}: first point must be its from landmark (${d.toFixed(3)} cm away)`);
      }
    }
    for (const [k, l] of Object.entries(m.landmarks)) {
      const tag = `${f}: landmark ${k}`;
      assert.match(k, /^[a-z0-9_]+$/, tag);
      assert.deepEqual(Object.keys(l).sort(), ['derived', 'name', 'p'], tag);
      assert.ok(isPoint(l.p), tag);
      assert.ok(nonEmpty(l.name), tag);
      assert.ok(nonEmpty(l.derived) && l.derived.length > 15, `${tag}: needs a derived note`);
    }
  }
});

test('organs sit in the right relations in the shared frame (+x left, +y superior, +z anterior)', () => {
  const lm = Object.assign({}, ...manifests.map(([, m]) => m.landmarks));
  const P = (k) => { assert.ok(lm[k], `landmark ${k}`); return lm[k].p; };
  // liver to the right, spleen to the left
  assert.ok(P('liver_centroid')[0] < 0 && P('spleen_centroid')[0] > 0);
  // arch branches in order along the arch: brachiocephalic, left common carotid, left subclavian
  const arch = manifests.find(([, m]) => m.id === 'aorta')[1].centerlines.aortic_arch.points;
  const along = (p) => { let best = 0, bd = Infinity; arch.forEach((q, i) => { const d = Math.hypot(...q.map((v, k) => v - p[k])); if (d < bd) { bd = d; best = i; } }); return best; };
  const order = ['brachiocephalic_trunk_origin', 'left_common_carotid_artery_origin', 'left_subclavian_artery_origin'].map((k) => along(P(k)));
  assert.ok(order[0] <= order[1] && order[1] <= order[2], `arch order ${order}`);
  // abdominal aortic branches from top to bottom: coeliac, SMA, renals, IMA, bifurcation
  const ys = ['coeliac_trunk_origin', 'superior_mesenteric_artery_origin', 'left_renal_artery_origin', 'inferior_mesenteric_artery_origin', 'aortic_bifurcation'].map((k) => P(k)[1]);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] < ys[i - 1], `aortic branch heights ${ys}`);
  // kidneys posterior to the pancreas head region and on their own sides; right kidney lower than left
  assert.ok(P('left_renal_hilum')[0] > 0 && P('right_renal_hilum')[0] < 0);
  assert.ok(P('right_kidney_upper_pole')[1] < P('left_kidney_upper_pole')[1]);
  assert.ok(P('left_renal_hilum')[2] < P('pancreas_head_lowest_point')[2]);
  // portal vein posterior to the proper hepatic artery origin and the bile duct
  assert.ok(P('portal_confluence')[2] < P('proper_hepatic_artery_origin')[2]);
  // heart below the arch, brain above the thyroid
  assert.ok(P('cardiac_apex')[1] < P('aortic_arch_start')[1] && P('brain_centroid')[1] > P('thyroid_centroid')[1]);
});
