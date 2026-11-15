// Bundles organs/index.json, organs/manifests/*.json and organs/references.json into
// organs/organs.js, a classic script (no fetch/modules) so figures work from file://.
// Also writes the student skill's reference files from the same data:
//   skills/sagittal/reference/organs.md  every organ: parts, centre lines (with parent and origin
//                                        landmark), the t along each line of the landmarks and
//                                        branch origins on it, landmarks, references and gaps
//   skills/sagittal/reference/spec.md    a copy of docs/spec.md
//
//   node tools/build_organs.mjs           write the three files (npm run organs)
//   node tools/build_organs.mjs --check   write nothing; exit 1 listing the files that are stale
// generate() returns { path: content } for tests, without writing.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const at = (p) => path.join(ROOT, p);
export const OUTPUTS = ['organs/organs.js', 'skills/sagittal/reference/organs.md', 'skills/sagittal/reference/spec.md'];

function load() {
  const read = (p) => JSON.parse(readFileSync(at('organs/' + p), 'utf8'));
  const index = read('index.json');
  const manifests = {};
  for (const { id } of index) manifests[id] = read(`manifests/${id}.json`);
  return { index, manifests, references: read('references.json') };
}

// ---------- geometry (same arc-length t as SagittalSpec's pointAt) ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a, b) => Math.hypot(...sub(a, b));
function length(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i], pts[i - 1]); return L; }
// Nearest point of the polyline to p: { t (arc-length fraction), d (cm) }.
function nearestT(pts, p) {
  const total = length(pts);
  let best = { t: 0, d: dist(pts[0], p) }, run = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], ab = sub(pts[i + 1], a), L = Math.hypot(...ab);
    const f = L > 0 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / (L * L))) : 0;
    const q = [a[0] + ab[0] * f, a[1] + ab[1] * f, a[2] + ab[2] * f], d = dist(q, p);
    if (d < best.d) best = { t: total > 0 ? (run + f * L) / total : 0, d };
    run += L;
  }
  return best;
}
function pointAt(pts, t) {
  const total = length(pts);
  let target = t * total;
  for (let i = 0; i + 1 < pts.length; i++) {
    const L = dist(pts[i], pts[i + 1]);
    if (target <= L || i === pts.length - 2) {
      const f = L > 0 ? Math.min(1, target / L) : 0, a = pts[i], b = pts[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
    target -= L;
  }
  return pts[pts.length - 1];
}

// ---------- skill reference ----------
const ON_LINE_CM = 0.5; // a landmark this close to a line is listed as lying on it
const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const xyz = (p) => '(' + p.map((v) => v.toFixed(1)).join(', ') + ')';
const t2 = (t) => t.toFixed(2);

// Per line: the landmarks within ON_LINE_CM of it and the origins of its child lines, by t.
function alongLine(O, organId, lineId, cl) {
  const items = [];
  for (const [oid, m] of Object.entries(O.manifests)) {
    for (const [lid, l] of Object.entries(m.landmarks || {})) {
      const n = nearestT(cl.points, l.p);
      if (n.d <= ON_LINE_CM) items.push({ t: n.t, text: `\`${oid === organId ? '' : oid + '/'}${lid}\`` + (n.d > 0.1 ? ` (${n.d.toFixed(1)} cm off)` : '') });
    }
    for (const [cid, c] of Object.entries(m.centerlines || {})) {
      if (c.parent !== lineId) continue;
      const n = nearestT(cl.points, c.points[0]);
      items.push({ t: n.t, text: `origin of \`${oid === organId ? '' : oid + '/'}${cid}\`` + (n.d > 0.1 ? ` (${n.d.toFixed(1)} cm off)` : '') });
    }
  }
  items.sort((a, b) => a.t - b.t);
  return items;
}

function organMd(O, m) {
  const L = [];
  const cls = Object.entries(m.centerlines || {});
  const lms = Object.entries(m.landmarks || {});
  L.push(`## ${m.id}`, '', `${m.name}. System: ${m.system}. Credit: \`${m.credit}\`.`, '');
  L.push('**Parts** (style with `organs[].parts`, label with `"' + m.id + '/<part>"`)', '');
  L.push('| part | name | tissue |', '|---|---|---|');
  for (const p of m.parts) L.push(`| \`${p.id}\` | ${cell(p.name)} | ${p.tissue} |`);
  L.push('');
  if (cls.length) {
    L.push('**Centre lines** (`{"on": "' + m.id + '/<line>", "t": 0..1}`; t 0 is the `from` end)', '');
    L.push('| line | name | from (t 0) | parent | radius cm | length cm | t 0 → t 1 |', '|---|---|---|---|---|---|---|');
    for (const [id, c] of cls) {
      const a = c.points[0], b = c.points[c.points.length - 1];
      L.push(`| \`${id}\` | ${cell(c.name)} | ${c.from ? '`' + c.from + '`' : '—'} | ${c.parent ? '`' + c.parent + '`' : '—'} | ${c.radius_cm} | ${length(c.points).toFixed(1)} | ${xyz(a)} → ${xyz(b)} |`);
    }
    L.push('');
    L.push(`**Along each line** (t of the landmarks within ${ON_LINE_CM} cm of it and of its branches' origins; points at t 0.25, 0.5, 0.75)`, '');
    L.push('| line | at t | t 0.25 / 0.5 / 0.75 |', '|---|---|---|');
    for (const [id, c] of cls) {
      const items = alongLine(O, m.id, id, c).map((x) => `${t2(x.t)} ${x.text}`).join(' · ') || '—';
      L.push(`| \`${id}\` | ${items} | ${[0.25, 0.5, 0.75].map((t) => xyz(pointAt(c.points, t))).join(' / ')} |`);
    }
    L.push('');
  }
  if (lms.length) {
    L.push('**Landmarks** (`{"landmark": "' + m.id + '/<landmark>"}`)', '');
    L.push('| landmark | name | at |', '|---|---|---|');
    for (const [id, l] of lms) L.push(`| \`${id}\` | ${cell(l.name)} | ${xyz(l.p)} |`);
    L.push('');
  }
  return L.join('\n');
}

function gapsMd() {
  const readme = readFileSync(at('organs/README.md'), 'utf8');
  const m = readme.match(/\n## Gaps[^\n]*\n([\s\S]*?)(?=\n## )/);
  return m ? m[1].trim() : '';
}

function organsMd(O) {
  const L = [
    '<!-- GENERATED by tools/build_organs.mjs (npm run organs) from organs/. Do not edit. -->',
    '# Base organs',
    '',
    'Everything a figure spec can name. A library name is `"<organ>/<id>"`, where `<id>` is a part,',
    'a centre line or a landmark of that organ (ids are unique across the library). Anything not',
    'listed here does not exist: say so to the student instead of drawing it.',
    '',
    '**Coordinates** in the "t 0 → t 1", "t 0.25 / 0.5 / 0.75" and "at" columns are cm in the body frame',
    '(+x patient\'s left, +y superior, +z anterior), rounded to 0.1 cm. They are **for planning only**',
    '(which side, how far, which way a line runs, which offset direction is "behind"). Never write',
    'coordinates in a spec: the validator refuses them. Use the landmark, a `t` on the line, or a short',
    '`offset`.',
    '',
    '**Finding t.** Each organ\'s "Along each line" table gives the `t` at which every landmark lying on a',
    'line, and every branch\'s origin, sits on that line (measured by length, as the validator does).',
    'To start a branch next to an existing one, or "distal to" a landmark, read its `t` there and pick a',
    'value a little beyond it (0.05 to 0.1 further for a short line, less for a long one).',
    '',
    '**Parent**: the line a centre line branches from (or drains into). A line cannot be removed while',
    'a child still hangs off it (see `spec.md`, `remove`). Lines named "(unnamed in source)" have no',
    'textbook identity: do not label them with a textbook name.',
    '',
    '## Contents',
    '',
    '| organ | name | system | parts | centre lines | landmarks |',
    '|---|---|---|---|---|---|',
  ];
  for (const { id } of O.index) {
    const m = O.manifests[id];
    L.push(`| [\`${id}\`](#${id}) | ${cell(m.name)} | ${m.system} | ${m.parts.length} | ${Object.keys(m.centerlines || {}).length} | ${Object.keys(m.landmarks || {}).length} |`);
  }
  L.push('', '## Gaps (not in the base organs: never draw these from memory)', '', gapsMd(), '');
  L.push('## References (cite only these ids in `claims[].refs`)', '',
    'Cite a reference only for what its "covers" line says it covers. If no listed reference covers a',
    'fact (a variant, a prevalence, a relation), leave the fact out and tell the student no listed source',
    'covers it.', '');
  L.push('| id | title | covers |', '|---|---|---|');
  for (const [id, r] of Object.entries(O.references)) L.push(`| \`${id}\` | ${cell(r.title)} | ${cell(r.covers)} |`);
  L.push('');
  for (const { id } of O.index) L.push(organMd(O, O.manifests[id]));
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export function generate() {
  const O = load();
  return {
    'organs/organs.js': '// GENERATED by tools/build_organs.mjs (npm run organs). Do not edit.\n'
      + 'window.SagittalOrgans = ' + JSON.stringify(O) + ';\n',
    'skills/sagittal/reference/organs.md': organsMd(O),
    'skills/sagittal/reference/spec.md': readFileSync(at('docs/spec.md'), 'utf8'),
  };
}

// Files whose content on disk differs from what generate() makes.
export function stale(files = generate()) {
  return Object.keys(files).filter((p) => !existsSync(at(p)) || readFileSync(at(p), 'utf8') !== files[p]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = generate();
  if (process.argv.includes('--check')) {
    const s = stale(files);
    if (s.length) { process.stderr.write('stale (run npm run organs): ' + s.join(', ') + '\n'); process.exit(1); }
  } else {
    for (const [p, c] of Object.entries(files)) { mkdirSync(path.dirname(at(p)), { recursive: true }); writeFileSync(at(p), c); }
  }
}
