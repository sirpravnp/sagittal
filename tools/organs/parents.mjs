// Writes `parent` (the centre-line id this line branches from, or null) into every centre line of
// organs/manifests/*.json and prints the table. Run after tools/organs/build.py, then `npm run organs`.
//
//   node tools/organs/parents.mjs           write the manifests and print the table
//   node tools/organs/parents.mjs --check   print only; exit 1 if a manifest's parent differs
//
// Rule. A centre line's first point is the end at its parent (organs/README.md). The parent is
// the nearest centre line of the same body `system` to that point, within TOL_CM, ignoring lines
// that start at the same point (siblings from a shared origin). Where tools/organs/organs.json
// names the parent explicitly (the curated value build.py used to orient the line), that value is
// used, and the geometric pick is printed beside it as a check; a line it names as a root (no
// parent) stays null. Centre-line ids are unique across the library, so a bare id is enough.
import { readFileSync, writeFileSync } from 'node:fs';

const TOL_CM = 1.5;
const SIBLING_CM = 0.75;
const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const index = read('organs/index.json');
const manifests = Object.fromEntries(index.map(({ id }) => [id, read(`organs/manifests/${id}.json`)]));
const authored = {};
for (const o of read('tools/organs/organs.json').organs) {
  for (const c of o.centerlines || []) authored[c.id] = c.parent === undefined ? null : c.parent;
}

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const dist = (a, b) => Math.hypot(...sub(a, b));
function lineDist(p, pts) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const ab = sub(pts[i + 1], pts[i]), L = dot(ab, ab);
    const t = L > 0 ? Math.max(0, Math.min(1, dot(sub(p, pts[i]), ab) / L)) : 0;
    best = Math.min(best, dist(p, pts[i].map((v, k) => v + ab[k] * t)));
  }
  return best;
}

const lines = [];
for (const m of Object.values(manifests)) for (const [id, c] of Object.entries(m.centerlines)) lines.push({ organ: m.id, system: m.system, id, c });

function geometric(l) {
  const start = l.c.points[0];
  let best = null, bestD = TOL_CM;
  for (const o of lines) {
    if (o === l || o.system !== l.system) continue;
    if (dist(start, o.c.points[0]) < SIBLING_CM) continue;
    const d = lineDist(start, o.c.points);
    if (d <= bestD) { bestD = d; best = o.id; }
  }
  return { id: best, d: best ? bestD : null };
}

const check = process.argv.includes('--check');
let differs = 0;
const rows = [];
for (const l of lines) {
  const g = geometric(l);
  const a = Object.prototype.hasOwnProperty.call(authored, l.id) ? authored[l.id] : 'auto';
  const parent = a === 'auto' ? g.id : a;
  const note = a === 'auto' ? 'geometric' : a === g.id ? 'authored = geometric' : `authored (geometric: ${g.id ?? 'none'})`;
  rows.push([`${l.organ}/${l.id}`, parent ?? 'null', g.d === null ? '' : g.d.toFixed(2), note]);
  if (l.c.parent !== parent) differs++;
  if (!check) l.c.parent = parent;
}

const w = [0, 1, 2].map((i) => Math.max(...rows.map((r) => r[i].length)));
console.log(['centre line'.padEnd(w[0]), 'parent'.padEnd(w[1]), 'cm'.padStart(w[2] + 1), 'source'].join('  '));
for (const r of rows) console.log([r[0].padEnd(w[0]), r[1].padEnd(w[1]), r[2].padStart(w[2] + 1), r[3]].join('  '));

if (check) {
  if (differs) { console.error(`${differs} centre line(s) differ from the manifests; run node tools/organs/parents.mjs`); process.exit(1); }
} else {
  // Edit the text in place (the manifests are written by Python; re-serialising them from JS would
  // reformat every number). Each centre line object ends with "from" (and "parent", once added).
  for (const m of Object.values(manifests)) {
    const url = new URL(`organs/manifests/${m.id}.json`, root);
    const ids = Object.keys(m.centerlines);
    let i = 0;
    const text = readFileSync(url, 'utf8').replace(
      /("from": (?:"[^"]*"|null))(?:,\n(\s*)"parent": (?:"[^"]*"|null))?(\n(\s*)\})/g,
      (all, from, pIndent, close, cIndent) => {
        const c = m.centerlines[ids[i++]];
        const indent = pIndent || cIndent + ' ';
        return `${from},\n${indent}"parent": ${JSON.stringify(c.parent)}${close}`;
      });
    if (i !== ids.length) throw new Error(`${m.id}: found ${i} centre lines in the text, expected ${ids.length}`);
    writeFileSync(url, text);
  }
}
