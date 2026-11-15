// Scene spec validator (player/spec.js, schema sagittal-figure/1). See docs/spec.md.
// Fixture organs (tests/fixtures/organs/) carry the plan's example ids so these tests do not depend
// on real landmark naming; one test at the end runs against the real organs/organs.js bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadClassic } from './helpers/loadClassic.mjs';

const { SagittalSpec } = loadClassic('player/spec.js');
const norm = (x) => JSON.parse(JSON.stringify(x));

const FIX = 'tests/fixtures/organs/';
const fixtureOrgans = () => {
  const manifests = {};
  for (const f of readdirSync(FIX)) {
    if (f === 'references.json') continue;
    const m = JSON.parse(readFileSync(FIX + f, 'utf8'));
    manifests[m.id] = m;
  }
  return {
    index: Object.values(manifests).map((m) => ({ id: m.id, name: m.name, system: m.system })),
    manifests,
    references: JSON.parse(readFileSync(FIX + 'references.json', 'utf8')),
  };
};
const ORG = fixtureOrgans();

// The plan's example, verbatim apart from the claim text.
const example = () => ({
  schema: 'sagittal-figure/1', title: 'Replaced right hepatic artery', topic: 'Hepatobiliary',
  organs: [{ id: 'liver', parts: { '*': { opacity: 0.35 } } }, { id: 'coeliac' }],
  variant: {
    label: 'Replaced RHA from SMA', edits: [
      { op: 'remove', structure: 'coeliac/right_hepatic_artery' },
      { op: 'route', id: 'rrha', name: 'Replaced right hepatic artery', tissue: 'vessel-artery',
        radius_cm: 0.25, from: { on: 'sma/sma', t: 0.12 },
        via: [{ landmark: 'portal/portal_vein_bifurcation', offset: { dir: 'posterior', cm: 1.0 } }],
        to: { landmark: 'liver/right_lobe_hilum' } }],
  },
  labels: [{ text: 'Replaced right hepatic artery', on: 'rrha', views: ['variant'] }],
  claims: [{ text: 'The right hepatic artery arises from the SMA in some people.', refs: ['hepatic-artery-variants'] }],
  view: { rot: [0.2, -0.4], zoom: 8 },
});

// A cystic duct completed from landmarks in both views, then inserted low in the variant.
const cystic = () => ({
  schema: 'sagittal-figure/1', title: 'Low cystic duct insertion',
  organs: [{ id: 'biliary' }, { id: 'liver', parts: { liver: { opacity: 0.3, color: '#7a2e22' } } }],
  base: [{ op: 'route', id: 'cystic_duct', name: 'Cystic duct', tissue: 'bile-duct', radius_cm: 0.12,
    from: { landmark: 'biliary/gallbladder_neck' }, to: { on: 'biliary/bile_duct', t: 0.1 } }],
  variant: { label: 'Low insertion', edits: [
    { op: 'move_insertion', structure: 'cystic_duct', to: { on: 'biliary/bile_duct', t: 0.7 } }] },
  labels: [{ text: 'Cystic duct', on: 'cystic_duct' }, { text: 'Bile duct', on: 'biliary/bile_duct' }],
  claims: [{ text: 'The cystic duct can join the bile duct low.', refs: ['cystic-duct'] }],
});

const run = (spec, organs = ORG) => norm(SagittalSpec.validate(spec, organs));
const close = (a, b) => assert.ok(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9),
  `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
// Each invalid case must report exactly its own error (plus nothing else).
const only = (spec, error) => {
  const r = run(spec);
  assert.equal(r.ok, false);
  assert.equal(r.resolved, null);
  assert.deepEqual(r.errors, [error]);
};

/* ---------- happy paths ---------- */

test('the plan example validates against the fixture organs', () => {
  const r = run(example());
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test('resolved turns every waypoint into body-frame cm (t by arc length, offsets on axes)', () => {
  const { resolved } = run(example());
  const rrha = resolved.variant.edits[1];
  close(rrha.from.p, [0, 91.8, 0]);          // 12% down the 10 cm SMA line
  close(rrha.via[0].p, [-2, 98, 2]);         // bifurcation [-2,98,3], 1 cm posterior = -z
  close(rrha.to.p, [-6, 100, 4]);
  assert.equal(rrha.points.length, 3);
  close(rrha.points[1], [-2, 98, 2]);
  assert.equal(resolved.schema, 'sagittal-figure/1');
  assert.deepEqual(resolved.labels[0].views, ['variant']);
});

test('every offset direction maps to the right axis', () => {
  const dirs = { anterior: [0, 0, 1], posterior: [0, 0, -1], left: [1, 0, 0], right: [-1, 0, 0],
    superior: [0, 1, 0], inferior: [0, -1, 0] };
  for (const [dir, d] of Object.entries(dirs)) {
    const s = example();
    s.variant.edits[1].via[0].offset = { dir, cm: 2 };
    const { resolved } = run(s);
    close(resolved.variant.edits[1].via[0].p, [-2 + 2 * d[0], 98 + 2 * d[1], 3 + 2 * d[2]]);
  }
});

test('provenance lists rrha via its landmarks, and the removal', () => {
  const { resolved } = run(example());
  assert.deepEqual(resolved.provenance, [
    { structure: 'coeliac/right_hepatic_artery', name: 'Right hepatic artery', op: 'remove', view: 'variant', via: [], on: [] },
    { structure: 'rrha', name: 'Replaced right hepatic artery', op: 'route', view: 'variant',
      via: ['portal/portal_vein_bifurcation', 'liver/right_lobe_hilum'], on: ['sma/sma'] },
  ]);
});

test('base routes appear in both views; a variant may move their insertion', () => {
  const r = run(cystic());
  assert.deepEqual(r.errors, []);
  const { resolved } = r;
  close(resolved.base[0].to.p, [-3, 96, 5]);
  close(resolved.base[0].points[0], [-7, 96, 7]);
  const mv = resolved.variant.edits[0];
  close(mv.to.p, [-3, 90, 5]);
  assert.equal(mv.end, 'to');
  close(mv.points[0], [-7, 96, 7]);
  close(mv.points[1], [-3, 90, 5]);
  assert.deepEqual(resolved.labels.map((l) => l.views), [['normal', 'variant'], ['normal', 'variant']]);
  assert.deepEqual(resolved.provenance, [
    { structure: 'cystic_duct', name: 'Cystic duct', op: 'route', view: 'both',
      via: ['biliary/gallbladder_neck'], on: ['biliary/bile_duct'] },
    { structure: 'cystic_duct', name: 'Cystic duct', op: 'move_insertion', view: 'variant', via: [], on: ['biliary/bile_duct'] },
  ]);
});

test('branch, duplicate and move_insertion of a library centre line resolve', () => {
  const s = example();
  s.organs.push({ id: 'portal' });
  s.variant.edits.push(
    { op: 'branch', id: 'cystic_artery', name: 'Cystic artery', tissue: 'vessel-artery', radius_cm: 0.06,
      from: { on: 'rrha', t: 0.5 }, to: { landmark: 'biliary/gallbladder_neck' } },
    { op: 'duplicate', structure: 'portal/portal_vein', id: 'portal_dup', name: 'Duplicated portal vein',
      from: { landmark: 'portal/portal_confluence', offset: { dir: 'left', cm: 1 } },
      to: { landmark: 'portal/portal_vein_bifurcation', offset: { dir: 'left', cm: 1 } } },
    { op: 'move_insertion', structure: 'coeliac/left_hepatic_artery', to: { on: 'coeliac/gastroduodenal_artery', t: 0.4 } });
  const r = run(s);
  assert.deepEqual(r.errors, []);
  const [, , br, dup, mv] = r.resolved.variant.edits;
  assert.equal(br.points.length, 2);
  assert.equal(dup.radius_cm, 0.3);         // inherited from the duplicated centre line
  assert.equal(dup.tissue, 'vessel-vein');  // inherited from the part with the same id
  close(dup.points[0], [-1, 90, 3]);
  close(mv.to.p, [-4, 93, 2]);
  assert.equal(mv.end, 'start');
});

/* ---------- invalid specs: one exact error each (Review Focus 1 and 5) ---------- */

test('unknown organ', () => {
  const s = example(); s.organs[0].id = 'kidneyz';
  only(s, 'organs[0].id: unknown organ "kidneyz"');
  const w = example(); w.variant.edits[1].from.on = 'nope/sma';
  only(w, 'variant.edits[1].from: unknown organ "nope"');
});

test('unknown landmark', () => {
  const s = example(); s.variant.edits[1].via[0].landmark = 'portal/foo';
  only(s, 'variant.edits[1].via[0]: unknown landmark "portal/foo"');
});

test('unknown centre line', () => {
  const s = example(); s.variant.edits[1].from.on = 'sma/superior_mesenteric';
  only(s, 'variant.edits[1].from: unknown centre line "sma/superior_mesenteric"');
});

test('t outside 0..1', () => {
  const s = example(); s.variant.edits[1].from.t = 1.4;
  only(s, 'variant.edits[1].from: t must be a number from 0 to 1 (got 1.4)');
  const m = example(); delete m.variant.edits[1].from.t;
  only(m, 'variant.edits[1].from: t must be a number from 0 to 1 (got nothing)');
});

test('offset over 3 cm (and not above 0)', () => {
  const s = example(); s.variant.edits[1].via[0].offset.cm = 4;
  only(s, 'variant.edits[1].via[0]: offset.cm must be more than 0 and at most 3 (got 4)');
  const z = example(); z.variant.edits[1].via[0].offset.cm = 0;
  only(z, 'variant.edits[1].via[0]: offset.cm must be more than 0 and at most 3 (got 0)');
});

test('bad offset direction', () => {
  const s = example(); s.variant.edits[1].via[0].offset.dir = 'up';
  only(s, 'variant.edits[1].via[0]: offset.dir must be one of anterior, posterior, left, right, superior, inferior (got "up")');
});

test('raw [x,y,z] anywhere is rejected', () => {
  const s = example(); s.variant.edits[1].via[0] = [-2, 98, 2];
  only(s, 'variant.edits[1].via[0]: raw coordinates are not allowed; use a landmark, a centre-line point or an offset');
  const t = example(); t.variant.edits[1].to = { landmark: 'liver/right_lobe_hilum', p: [1, 2, 3] };
  const r = run(t);
  assert.deepEqual(r.errors, [
    'variant.edits[1].to.p: raw coordinates are not allowed; use a landmark, a centre-line point or an offset',
    'variant.edits[1].to: unknown field "p"',
  ]);
  const u = example(); u.variant.edits[1].via.push([[0, 1, 2], [3, 4, 5]]);
  assert.deepEqual(run(u).errors, [
    'variant.edits[1].via[1][0]: raw coordinates are not allowed; use a landmark, a centre-line point or an offset',
    'variant.edits[1].via[1][1]: raw coordinates are not allowed; use a landmark, a centre-line point or an offset',
    'variant.edits[1].via[1]: a waypoint must be {"landmark"} or {"on", "t"}, with an optional "offset"',
  ]);
});

test('unknown op', () => {
  const s = example(); s.variant.edits[0].op = 'teleport';
  only(s, 'variant.edits[0].op: unknown op "teleport" (use remove, route, branch, move_insertion or duplicate)');
});

test('base takes route and branch only', () => {
  const s = cystic(); s.base[0].op = 'remove';
  only(s, 'base[0].op: only route and branch are allowed in base (got "remove")');
});

test('unknown reference id', () => {
  const s = example(); s.claims[0].refs = ['michels-1966'];
  only(s, 'claims[0].refs[0]: unknown reference "michels-1966"');
});

test('claim without refs', () => {
  const s = example(); s.claims[0].refs = [];
  only(s, 'claims[0].refs: a claim needs at least one reference');
  const m = example(); delete m.claims[0].refs;
  only(m, 'claims[0].refs: a claim needs at least one reference');
});

test('more than 20 labels', () => {
  const s = example();
  s.labels = Array.from({ length: 200 }, () => ({ text: 'Liver', on: 'liver/liver' }));
  only(s, 'labels: at most 20 items (got 200)');
});

test('removing a structure others branch from', () => {
  const s = example(); s.variant.edits[0].structure = 'coeliac/common_hepatic_artery';
  const r = run(s);
  assert.deepEqual(r.errors, [
    'variant.edits[0]: coeliac/gastroduodenal_artery branches from coeliac/common_hepatic_artery; reroute or remove coeliac/gastroduodenal_artery too',
    'variant.edits[0]: coeliac/proper_hepatic_artery branches from coeliac/common_hepatic_artery; reroute or remove coeliac/proper_hepatic_artery too',
  ]);
  // Removing the children too, or moving their insertion elsewhere, is fine.
  s.variant.edits.push({ op: 'remove', structure: 'coeliac/gastroduodenal_artery' },
    { op: 'move_insertion', structure: 'coeliac/proper_hepatic_artery', to: { on: 'sma/sma', t: 0.1 } });
  assert.deepEqual(run(s).errors, []);
  // A base route counts as a branch too.
  const c = cystic(); c.variant.edits = [{ op: 'remove', structure: 'biliary/bile_duct' }];
  only(c, 'variant.edits[0]: cystic_duct branches from biliary/bile_duct; reroute or remove cystic_duct too');
});

test('the remaining error strings', () => {
  const cases = [
    [(s) => { s.schema = 'sagittal-figure/0'; }, 'schema: must be "sagittal-figure/1"'],
    [(s) => { s.extra = 1; }, 'spec: unknown field "extra"'],
    [(s) => { delete s.title; }, 'title: must be a non-empty string of at most 80 characters'],
    [(s) => { s.organs = []; }, ['organs: must not be empty', 'variant.edits[0].structure: organ "coeliac" is not in organs']],
    [(s) => { s.organs.push({ id: 'liver' }); }, 'organs[2].id: "liver" is listed twice'],
    [(s) => { s.organs[0].parts = { lobe: {} }; }, 'organs[0].parts.lobe: unknown part "liver/lobe"'],
    [(s) => { s.organs[0].parts['*'].opacity = 2; }, 'organs[0].parts.*.opacity: must be a number from 0 to 1 (got 2)'],
    [(s) => { s.organs[0].parts['*'].color = 'red'; }, 'organs[0].parts.*.color: must be a hex colour like "#c23b30" (got "red")'],
    [(s) => { s.organs[0].parts['*'].visible = 'no'; }, 'organs[0].parts.*.visible: must be true or false'],
    [(s) => { s.variant.edits[1].from = { landmark: 'liver/right_lobe_hilum', on: 'sma/sma', t: 0.1 }; },
      'variant.edits[1].from: a waypoint must be {"landmark"} or {"on", "t"}, with an optional "offset"'],
    [(s) => { s.variant.edits[1].from = { on: 'ghost', t: 0.1 }; }, 'variant.edits[1].from: unknown structure "ghost"'],
    [(s) => { s.variant.edits[1].id = 'RRHA'; s.labels[0].on = 'RRHA'; }, 'variant.edits[1].id: must match [a-z][a-z0-9_]* (got "RRHA")'],
    [(s) => { s.variant.edits.push({ ...s.variant.edits[1] }); }, 'variant.edits[2].id: "rrha" is already used'],
    [(s) => { s.variant.edits[1].tissue = 'steel'; },
      'variant.edits[1].tissue: must be one of vessel-artery, vessel-vein, bile-duct, bowel, pancreas, nerve, lung, air, highlight (got "steel")'],
    [(s) => { s.variant.edits[1].radius_cm = 2; }, 'variant.edits[1].radius_cm: must be a number more than 0 and at most 1.5 (got 2)'],
    [(s) => { s.variant.edits[1].name = ''; }, 'variant.edits[1].name: must be a non-empty string of at most 60 characters'],
    [(s) => { s.variant.edits[1].via = Array.from({ length: 13 }, () => ({ landmark: 'liver/right_lobe_hilum' })); },
      'variant.edits[1].via: at most 12 items (got 13)'],
    [(s) => { s.variant.edits[1].op = 'branch'; s.variant.edits[1].from = { landmark: 'sma/sma_origin' }; },
      'variant.edits[1].from: a branch must start on a centre line ({"on", "t"} with no offset)'],
    [(s) => { s.variant.edits[0].structure = 'coeliac/hepatic'; }, 'variant.edits[0].structure: unknown structure "coeliac/hepatic"'],
    [(s) => { s.variant.edits[0].structure = 'portal/portal_vein'; }, 'variant.edits[0].structure: organ "portal" is not in organs'],
    [(s) => { s.variant.edits.push({ op: 'remove', structure: 'coeliac/right_hepatic_artery' }); },
      'variant.edits[2].structure: "coeliac/right_hepatic_artery" is already removed'],
    [(s) => { s.variant.edits[1].from = { on: 'coeliac/right_hepatic_artery', t: 0.5 }; },
      'variant.edits[1].from: "coeliac/right_hepatic_artery" is removed in the variant view'],
    [(s) => { s.variant.edits[1].from = { landmark: 'sma/sma_origin' };
      s.variant.edits.push({ op: 'move_insertion', structure: 'rrha', to: { on: 'sma/sma', t: 0.5 } }); },
      'variant.edits[2].structure: "rrha" has no insertion on a centre line to move'],
    [(s) => { s.variant.edits.push({ op: 'move_insertion', structure: 'coeliac/left_hepatic_artery', to: { landmark: 'sma/sma_origin' } }); },
      'variant.edits[2].to: an insertion must be a centre-line point ({"on", "t"} with no offset)'],
    [(s) => { s.variant.edits.push({ op: 'move_insertion', structure: 'coeliac/left_hepatic_artery', to: { on: 'coeliac/left_hepatic_artery', t: 0.5 } }); },
      'variant.edits[2].to: a structure cannot insert into itself'],
    [(s) => { s.variant.edits = []; }, ['variant.edits: must not be empty', 'labels[0].on: unknown structure "rrha"']],
    [(s) => { s.labels[0].on = 'coeliac/nothing'; }, 'labels[0].on: unknown structure "coeliac/nothing"'],
    [(s) => { s.labels[0].views = ['normal', 'variant']; }, 'labels[0]: "rrha" exists only in the variant view'],
    [(s) => { s.labels.push({ text: 'RHA', on: 'coeliac/right_hepatic_artery', views: ['variant'] }); },
      'labels[1]: "coeliac/right_hepatic_artery" is removed in the variant view'],
    [(s) => { s.labels[0].views = ['after']; }, 'labels[0].views: must be a non-empty list of "normal" and "variant"'],
    [(s) => { s.claims = []; }, 'claims: must not be empty'],
    [(s) => { s.view.zoom = 50; }, 'view.zoom: must be a number from 3 to 16 (got 50)'],
    [(s) => { s.view.rot = [0.2]; }, 'view.rot: must be two numbers [x, y] in radians'],
  ];
  for (const [mutate, error] of cases) {
    const s = example(); mutate(s);
    if (Array.isArray(error)) assert.deepEqual(run(s).errors, error);
    else only(s, error);
  }
});

test('hostile input: not an object, prototype keys, many problems at once', () => {
  assert.deepEqual(run(null).errors, ['spec: must be an object']);
  assert.deepEqual(run([]).errors, ['spec: must be an object']);
  let deep = {}; const d = example(); d.topic = deep;
  for (let i = 0; i < 5000; i++) { deep.x = {}; deep = deep.x; }
  assert.deepEqual(run(d).errors, ['spec: is nested too deeply']);
  const s = example();
  s.organs[1].id = '__proto__';
  s.variant.edits[1].to.landmark = 'liver/constructor';
  const errs = run(s).errors;
  assert.ok(errs.includes('organs[1].id: unknown organ "__proto__"'), errs.join('\n'));
  assert.ok(errs.includes('variant.edits[1].to: unknown landmark "liver/constructor"'), errs.join('\n'));
  const many = example();
  many.variant.edits[1].via[0].landmark = 'portal/foo';
  many.claims[0].refs = ['nope'];
  many.labels = Array.from({ length: 21 }, () => ({ text: 'Liver', on: 'liver/liver' }));
  assert.equal(run(many).errors.length, 3);
});

test('validate does not modify the spec it is given', () => {
  const s = example(); const before = JSON.stringify(s);
  run(s);
  assert.equal(JSON.stringify(s), before);
});

/* ---------- real organ bundle ---------- */

test('real organs: cystic duct from the gallbladder neck to the bile duct, moved low', () => {
  const real = loadClassic('organs/organs.js').SagittalOrgans;
  const spec = {
    schema: 'sagittal-figure/1', title: 'Low cystic duct insertion', topic: 'Hepatobiliary',
    organs: [{ id: 'gallbladder' }, { id: 'liver', parts: { liver: { opacity: 0.3 } } }, { id: 'coeliac-trunk' }],
    base: [{ op: 'route', id: 'cystic_duct', name: 'Cystic duct', tissue: 'bile-duct', radius_cm: 0.1,
      from: { landmark: 'gallbladder/gallbladder_neck' }, to: { on: 'gallbladder/bile_duct', t: 0.08 } }],
    variant: { label: 'Low cystic duct insertion', edits: [
      { op: 'move_insertion', structure: 'cystic_duct', to: { on: 'gallbladder/bile_duct', t: 0.6 } }] },
    labels: [{ text: 'Cystic duct', on: 'cystic_duct' }, { text: 'Proper hepatic artery', on: 'coeliac-trunk/proper_hepatic_artery' }],
    claims: [{ text: 'The cystic duct may join the bile duct low, near the duodenum.', refs: ['statpearls-biliary-ducts'] }],
  };
  const r = run(spec, real);
  assert.deepEqual(r.errors, []);
  const bd = real.manifests.gallbladder.centerlines.bile_duct.points;
  close(r.resolved.base[0].points[0], real.manifests.gallbladder.landmarks.gallbladder_neck.p);
  // the low insertion lies below the default one (+y is superior)
  assert.ok(r.resolved.variant.edits[0].to.p[1] < r.resolved.base[0].to.p[1]);
  assert.ok(r.resolved.variant.edits[0].to.p[1] > bd[bd.length - 1][1]);
  // and on real data, removing the common hepatic artery is refused while its branches stay
  const bad = norm(spec);
  bad.variant.edits = [{ op: 'remove', structure: 'coeliac-trunk/common_hepatic_artery' }];
  assert.deepEqual(run(bad, real).errors, [
    'variant.edits[0]: coeliac-trunk/proper_hepatic_artery branches from coeliac-trunk/common_hepatic_artery; reroute or remove coeliac-trunk/proper_hepatic_artery too',
    'variant.edits[0]: coeliac-trunk/gastroduodenal_artery branches from coeliac-trunk/common_hepatic_artery; reroute or remove coeliac-trunk/gastroduodenal_artery too',
  ]);
});

test('docs/spec.md worked examples validate against the real organs', () => {
  const real = loadClassic('organs/organs.js').SagittalOrgans;
  const md = readFileSync('docs/spec.md', 'utf8');
  const blocks = md.split(/^## Worked example/m).slice(1).map((s) => s.match(/```json\n([\s\S]*?)```/)[1]);
  assert.equal(blocks.length, 2);
  for (const b of blocks) assert.deepEqual(run(JSON.parse(b), real).errors, []);
});
