#!/usr/bin/env node
// look-figure: render a figure written by make-figure, both views, to PNGs you can look at.
//
//   node player/look-figure.mjs <figure.html> [--rot x,y] [--zoom z] [--width 1200] [--out <dir>]
//   npm run look -- <figure.html> [...]
//
// Opens the file from disk in headless Chrome (software GL, no network), and for the normal and the
// variant view writes <out>/<name>[-rot<x>_<y>]-<view>.png (the 3D stage with its labels; default
// <out> is a .check/ folder next to the figure, so check images stay out of the student's way). --rot / --zoom start the camera elsewhere (radians about x and y, as in the
// spec's view), to check a relation from another side. Prints, per view: the PNG path, the
// orientation chip ("Right anterior oblique view · patient's right on screen left"), and each label
// with its anchor (stage pixels) and whether the anchor is hidden behind another structure; and
// labels the player dropped. Exit 1 if the page shows errors, throws, warns about a label, or
// renders blank; exit 3 if no browser is installed.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

function usage(msg) {
  if (msg) process.stderr.write('look-figure: ' + msg + '\n');
  process.stderr.write('usage: node player/look-figure.mjs <figure.html> [--rot x,y] [--zoom z] [--width px] [--out dir]\n');
  process.exit(2);
}
const a = { file: null, rot: null, zoom: null, width: 1200, out: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const x = argv[i], v = () => { const y = argv[++i]; if (y == null) usage(x + ' needs a value'); return y; };
  if (x === '--rot') { a.rot = v(); if (!/^-?[\d.]+,-?[\d.]+$/.test(a.rot)) usage('--rot is x,y in radians, e.g. 0.2,-0.5'); }
  else if (x === '--zoom') a.zoom = Number(v());
  else if (x === '--width') a.width = Number(v());
  else if (x === '--out') a.out = v();
  else if (x.startsWith('-')) usage('unknown option ' + x);
  else a.file = x;
}
if (!a.file) usage('give a figure .html written by make-figure');
const base = (process.env.npm_lifecycle_event === 'look' && process.env.INIT_CWD) || process.cwd();
const file = path.resolve(base, a.file);
if (!existsSync(file)) usage('no such file ' + file);
const out = path.resolve(base, a.out || path.join(path.dirname(file), '.check'));
mkdirSync(out, { recursive: true });
const name = path.basename(file, '.html') + (a.rot ? '-rot' + a.rot.replace(/,/g, '_') : '');

let browser;
try { browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS }); }
catch {
  try { browser = await chromium.launch({ args: GL_ARGS }); }
  catch (e) {
    process.stderr.write('look-figure: no browser to render with: install Google Chrome, or run  npx playwright install chromium'
      + ' in the sagittal repo.\n(' + String(e.message || e).split('\n')[0] + ')\n');
    process.exit(3);
  }
}
const context = await browser.newContext({ viewport: { width: a.width, height: a.width < 600 ? 812 : 800 } });
await context.setOffline(true);
await context.route(/^(https?|wss?):/, (r) => r.abort());
const page = await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push('page error: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().startsWith('Sagittal'))) problems.push('console: ' + m.text()); });

let failed = false;
for (const view of ['normal', 'variant']) {
  let q = '?v=' + view;
  if (a.rot) q += '&rot=' + a.rot;
  if (a.zoom) q += '&zoom=' + a.zoom;
  await page.goto(pathToFileURL(file).href + q);
  // Ready: the page shows errors, or the player has built this view and the viewer has placed its
  // labels (all of them, or after 15 s whatever it could place), then two more frames are drawn.
  const ok = await page.waitForFunction(() => !document.getElementById('errors').hidden
    || (window.viewer && window.SagittalPlayer && window.SagittalPlayer.debug() && window.SagittalPlayer.debug().view), null, { timeout: 60000 }).then(() => true, () => false);
  const errText = await page.evaluate(() => { const e = document.getElementById('errors'); return e && !e.hidden ? e.textContent : ''; });
  if (!ok || errText) { process.stdout.write(`${view}: the page shows errors:\n${errText || 'timed out'}\n`); failed = true; break; }
  await page.waitForFunction((v) => { const p = window.SagittalPlayer.debug(); return p.view === v && window.viewer.debug().labelRects.length >= p.labels.length; },
    view, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const s = await page.evaluate(() => {
    const d = window.viewer.debug(), p = window.SagittalPlayer.debug();
    return { nonBlank: d.nonBlank, orientation: p.orientation, dropped: p.dropped,
      labels: d.leaders.map((l) => l && { text: l.text, at: [Math.round(l.ax), Math.round(l.ay)], hidden: !!l.occluded }) };
  });
  const png = path.join(out, `${name}-${view}.png`);
  await page.locator('#stage').screenshot({ path: png });
  process.stdout.write(`${view}: ${png}\n  view: ${s.orientation}\n`);
  for (const l of s.labels) process.stdout.write(l ? `  label "${l.text}" anchor ${l.at.join(',')}${l.hidden ? '  HIDDEN behind another structure' : ''}\n` : '  label off-stage\n');
  if (s.dropped && s.dropped.length) process.stdout.write(`  dropped labels (structure not drawn): ${s.dropped.join('; ')}\n`);
  if (!s.nonBlank) { process.stdout.write('  BLANK render\n'); failed = true; }
}
if (problems.length) { process.stdout.write(problems.join('\n') + '\n'); failed = true; }
await browser.close();
process.exit(failed ? 1 : 0);
