// Figure player: each fixture spec renders in both views with clean labels, the view dropdown
// swaps base and variant structures, and the info panel lists provenance.
// The page is served straight from the repo (player/dev.html loads ../organs and ../site) by
// routing a made-up origin to the working tree, so no second web server is needed.
// Screenshots of every view are written to build/figures/ for visual review.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ORIGIN = 'http://sagittal.test';
const FIX = 'tests/fixtures/figures';
const OUT = path.join(ROOT, 'build/figures');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const fixtures = readdirSync(path.join(ROOT, FIX)).filter((f) => f.endsWith('.json')).sort();
const WIDTHS = [1200, 375];

// Ground truth per fixture: a structure drawn only in the normal view, one drawn only in the
// variant view, and the provenance entries the info panel must list.
const EXPECT = {
  'replaced-rha.json': { normalOnly: 'rha', variantOnly: 'rrha', provenance: ['pha', 'rha', 'lha', 'chd', 'rrha'] },
  'low-cystic-duct.json': { normalOnly: 'cystic_duct', variantOnly: 'cystic_duct_low', provenance: ['cbd', 'chd', 'cystic_duct', 'cystic_duct_low'] },
  'aberrant-right-subclavian.json': { normalOnly: 'aorta/right_subclavian_artery', variantOnly: 'arsa', provenance: ['aorta/right_subclavian_artery', 'aorta/brachiocephalic_trunk', 'aorta/right_common_carotid_artery', 'arsa'] },
};

async function serveRepo(page) {
  await page.route(ORIGIN + '/**', (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: readFileSync(file) });
  });
}
function watchErrors(page) {
  const errors = [];
  // and the player's own warnings (a label whose structure is not drawn); not Chrome's GL notices
  page.on('console', (m) => {
    if (m.type() === 'error' || (m.type() === 'warning' && m.text().startsWith('Sagittal'))) errors.push('console ' + m.type() + ': ' + m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return errors;
}
async function openFigure(page, fixture, query = '') {
  await page.goto(`${ORIGIN}/player/dev.html?spec=${FIX}/${fixture}${query}`);
  await page.waitForFunction(() => window.viewer && window.viewer.debug().labelRects.length > 0, null, { timeout: 60000 });
  await page.waitForTimeout(150);
}
// The resolved spec (labels with their worked-out views), validated in the page.
async function specOf(page, fixture) {
  await page.goto(`${ORIGIN}/player/dev.html`);
  const raw = JSON.parse(readFileSync(path.join(ROOT, FIX, fixture), 'utf8'));
  return page.evaluate((sp) => SagittalSpec.validate(sp, SagittalOrgans).resolved, raw);
}
async function labelState(page) {
  return page.evaluate(() => {
    const c = document.querySelector('#cv');
    const d = window.viewer.debug();
    // labels the spec asks for in this view (from the validated spec, as the page rendered it)
    const p = window.SagittalPlayer.debug();
    return { rects: d.labelRects, leaders: d.leaders, cw: c.clientWidth, ch: c.clientHeight, nonBlank: d.nonBlank, drawn: p };
  });
}

for (const fixture of fixtures) {
  for (const width of WIDTHS) {
    test(`${fixture} @${width}px: both views render with in-bounds, unoccluded labels`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width, height: width < 600 ? 812 : 800 });
      await serveRepo(page);
      const errors = watchErrors(page);
      mkdirSync(OUT, { recursive: true });
      const spec = await specOf(page, fixture);
      for (const view of ['variant', 'normal']) {
        await openFigure(page, fixture, `&v=${view}`);
        const s = await labelState(page);
        const tag = `${fixture}/${view}@${width}`;
        expect(s.drawn.view, tag).toBe(view);
        expect(s.nonBlank, tag).toBe(true);
        // every label the spec asks for in this view is drawn and placed on the stage
        const want = spec.labels.filter((l) => (l.views || ['normal', 'variant']).includes(view)).map((l) => l.text);
        expect(s.drawn.dropped, tag).toEqual([]);
        expect(s.drawn.labels.sort(), tag).toEqual([...want].sort());
        expect(s.rects.length, `${tag}: every label placed`).toBe(want.length);
        // anchor dots are distinct: no two within 12 px (dots piled at a junction are unreadable)
        for (let i = 0; i < s.leaders.length; i++) {
          for (let j = i + 1; j < s.leaders.length; j++) {
            const a = s.leaders[i], b = s.leaders[j];
            expect(Math.hypot(a.ax - b.ax, a.ay - b.ay), `${tag}: dots of "${a.text}" and "${b.text}" overlap`).toBeGreaterThanOrEqual(12);
          }
        }
        // no orientation chip on the stage
        expect(await page.locator('#stage .fig-orient, #orient').count(), tag).toBe(0);
        s.rects.forEach((r, i) => {
          const lt = `${tag} "${s.leaders[i] && s.leaders[i].text}"`;
          expect(r.x, lt).toBeGreaterThanOrEqual(0);
          expect(r.y, lt).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w, lt).toBeLessThanOrEqual(s.cw + 0.5);
          expect(r.y + r.h, lt).toBeLessThanOrEqual(s.ch + 0.5);
        });
        s.leaders.forEach((l) => {
          expect(l, `${tag}: anchor off-stage`).not.toBeNull();
          if (!l.behind) expect(l.occluded, `${tag} "${l.text}": anchor hidden behind another structure`).toBe(false);
        });
        await page.locator('#stage').screenshot({ path: path.join(OUT, `${fixture.replace(/\.json$/, '')}-${view}-${width}.png`) });
      }
      expect(errors).toEqual([]);
    });
  }

  test(`${fixture}: the view dropdown swaps base and variant structures; info lists provenance`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1200, height: 800 });
    await serveRepo(page);
    const errors = watchErrors(page);
    const ex = EXPECT[fixture];
    expect(ex, `add ${fixture} to EXPECT`).toBeTruthy();
    await openFigure(page, fixture);
    let d = await page.evaluate(() => window.SagittalPlayer.debug());
    expect(d.view).toBe('variant');
    expect(d.drawn).toContain(ex.variantOnly);
    expect(d.drawn).not.toContain(ex.normalOnly);

    await page.getByRole('radio', { name: 'Normal' }).check();
    await page.waitForFunction(() => window.SagittalPlayer.debug().view === 'normal');
    d = await page.evaluate(() => window.SagittalPlayer.debug());
    expect(d.drawn).toContain(ex.normalOnly);
    expect(d.drawn).not.toContain(ex.variantOnly);

    const info = page.locator('#info');
    await expect(info.locator('.fig-provenance h2')).toHaveText('Changed from base anatomy');
    // a base structure the variant removes is listed twice (drawn from landmarks; removed)
    for (const s of ex.provenance) expect(await info.locator(`.fig-provenance li[data-structure="${s}"]`).count(), s).toBeGreaterThan(0);
    await expect(info.locator('.fig-claims a.ref').first()).toHaveAttribute('href', /^https:\/\//);
    await expect(info.locator('.fig-credit')).toContainText('3D models:');
    expect(await page.locator('body').innerText()).not.toContain('nreviewed');
    expect(errors).toEqual([]);
  });
}

test('an invalid spec shows its errors and renders nothing', async ({ page }) => {
  await serveRepo(page);
  await page.route(`${ORIGIN}/${FIX}/broken.json`, (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ schema: 'sagittal-figure/1', title: 'x', organs: [{ id: 'nope' }], variant: { label: 'x', edits: [] }, claims: [] }) }));
  await page.goto(`${ORIGIN}/player/dev.html?spec=${FIX}/broken.json`);
  await expect(page.locator('#errors')).toContainText('unknown organ');
  expect(await page.evaluate(() => !!window.viewer)).toBe(false);
});

// ---------- Figure UI (player/ui.js, player/figure.css) and Save as image ----------
const UI_OUT = path.join(OUT, 'ui');
// The stage colour (figure.css --stage, the renderer's clear colour) as [r, g, b].
async function stageRgb(page) {
  return page.evaluate(() => getComputedStyle(document.querySelector('#stage')).backgroundColor.match(/\d+/g).slice(0, 3).map(Number));
}

// Decodes a PNG data URL in the page: size, share of pixels that are not the stage background,
// and the colour of a pixel near the left edge, half-way down (stage background in every fixture).
async function decodePng(page, url) {
  const bg = await stageRgb(page);
  return page.evaluate(async ([u, bg]) => {
    const img = new Image(); img.src = u; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 24) n++;
    const e = x.getImageData(2, Math.round(c.height / 2), 1, 1).data;
    return { w: c.width, h: c.height, fg: n / (c.width * c.height), edge: [e[0], e[1], e[2]] };
  }, [url, bg]);
}
// Pixels (share of the image) that differ clearly between two PNG data URLs of the same size.
async function pngDiff(page, a, b) {
  return page.evaluate(async ([ua, ub]) => {
    const px = async (u) => {
      const img = new Image(); img.src = u; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      return x.getImageData(0, 0, c.width, c.height).data;
    };
    const da = await px(ua), db = await px(ub);
    if (da.length !== db.length) return 1;
    let n = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 40) n++;
    return n / (da.length / 4);
  }, [a, b]);
}

test('Save as image downloads <slug>-<view>.png: decodes, not blank, labels drawn in', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 1200, height: 800 });
  await serveRepo(page);
  const errors = watchErrors(page);
  mkdirSync(UI_OUT, { recursive: true });
  await openFigure(page, 'replaced-rha.json');
  const save = page.getByRole('button', { name: 'Save as image' });
  await expect(save).toBeVisible();

  const [dl] = await Promise.all([page.waitForEvent('download'), save.click()]);
  expect(dl.suggestedFilename()).toBe('replaced-right-hepatic-artery-from-the-sma-variant.png');
  const file = await dl.path();
  const buf = readFileSync(file);
  expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const url = 'data:image/png;base64,' + buf.toString('base64');
  const dec = await decodePng(page, url);
  const cv = await page.evaluate(() => { const c = document.querySelector('#cv'); return { w: c.width, h: c.height }; });
  expect(dec.w).toBe(cv.w);
  expect(dec.h).toBe(cv.h);
  expect(dec.fg, 'saved image is not blank').toBeGreaterThan(0.01);
  // the canvas is cleared to the stage colour of the page (paper in light mode)
  const bg = await stageRgb(page);
  dec.edge.forEach((v, i) => expect(Math.abs(v - bg[i]), 'stage colour in the saved image').toBeLessThanOrEqual(3));
  writeFileSync(path.join(UI_OUT, 'saved-replaced-rha-variant.png'), buf);

  // window.figure.snapshot: labels on differs from labels off; the page's own label state is kept
  const on = await page.evaluate(() => window.figure.snapshot({ labels: true }));
  const off = await page.evaluate(() => window.figure.snapshot({ labels: false }));
  expect(on.startsWith('data:image/png;base64,')).toBe(true);
  expect(await pngDiff(page, on, off), 'labels change the image').toBeGreaterThan(0.002);
  expect(await page.locator('#labels').isVisible()).toBe(true);
  expect(await pngDiff(page, url, on), 'the download is the labelled snapshot').toBeLessThan(0.002);

  // labels switched off in the page: Save follows the toggle; snapshot({labels: true}) still draws them
  await page.getByRole('radio', { name: 'Normal' }).check();
  await page.waitForFunction(() => window.SagittalPlayer.debug().view === 'normal');
  await page.getByLabel('Labels').uncheck();
  const [dl2] = await Promise.all([page.waitForEvent('download'), save.click()]);
  expect(dl2.suggestedFilename()).toBe('replaced-right-hepatic-artery-from-the-sma-normal.png');
  const url2 = 'data:image/png;base64,' + readFileSync(await dl2.path()).toString('base64');
  const off2 = await page.evaluate(() => window.figure.snapshot({ labels: false }));
  const on2 = await page.evaluate(() => window.figure.snapshot({ labels: true }));
  expect(await pngDiff(page, url2, off2)).toBeLessThan(0.002);
  expect(await pngDiff(page, on2, off2)).toBeGreaterThan(0.002);
  expect(await page.locator('#labels').isVisible(), 'snapshot restores the hidden labels').toBe(false);
  writeFileSync(path.join(UI_OUT, 'snapshot-replaced-rha-normal-labels.png'), Buffer.from(on2.split(',')[1], 'base64'));
  expect(errors).toEqual([]);
});

for (const fixture of fixtures) {
  test(`${fixture}: figure UI at 1200 and 375 px, light and dark`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1200, height: 800 });
    await serveRepo(page);
    const errors = watchErrors(page);
    mkdirSync(UI_OUT, { recursive: true });
    const spec = await specOf(page, fixture);
    await openFigure(page, fixture);
    const name = fixture.replace(/\.json$/, '');

    await expect(page.locator('h1')).toHaveText(spec.title);
    // control row: view, one toggle per organ, labels, save
    const bar = page.locator('.fig-bar');
    // the view switch: a two-option radio group, Variant first selected; the variant's full name
    // is the plate subtitle unless the title already carries it
    const group = bar.getByRole('radiogroup', { name: 'View' });
    await expect(group.getByRole('radio')).toHaveCount(2);
    await expect(group.getByRole('radio', { name: 'Variant' })).toBeChecked();
    await expect(group.getByRole('radio', { name: 'Normal' })).not.toBeChecked();
    if (!spec.title.toLowerCase().includes(spec.variant.label.toLowerCase())) {
      await expect(page.locator('.fig-sub')).toHaveText('Variant: ' + spec.variant.label);
    }
    // keyboard: arrow keys move between the two views
    await group.getByRole('radio', { name: 'Variant' }).focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => window.SagittalPlayer.debug().view === 'normal');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => window.SagittalPlayer.debug().view === 'variant');
    // what the variant changes is marked: clay labels for the changed structures
    const changed = await page.evaluate(() => window.SagittalPlayer.debug().changed);
    expect(changed.length, 'some labels mark changed structures').toBeGreaterThan(0);
    expect(await page.locator('#labels .lab.is-variant').count()).toBe(changed.length);
    // no plate number on a standalone figure
    expect(await page.locator('body').innerText()).not.toMatch(/Plate [IVX]+/);
    expect(await bar.locator('.fig-organs input[type=checkbox]').count()).toBe(spec.organs.length);
    await expect(bar.getByLabel('Labels')).toBeChecked();
    await expect(bar.getByRole('button', { name: 'Save as image' })).toBeVisible();
    // info: numbered claims, each with a link to its reference; references; provenance; credits
    const info = page.locator('#info');
    expect(await info.locator('.fig-claims li').count()).toBe(spec.claims.length);
    for (let i = 0; i < spec.claims.length; i++) {
      expect(await info.locator('.fig-claims li').nth(i).locator('a.ref').count()).toBe(spec.claims[i].refs.length);
    }
    expect(await info.locator('.fig-refs li a[href^="https://"]').count()).toBeGreaterThan(0);
    expect(await info.locator('.fig-provenance li').count()).toBe(spec.provenance.length);
    // provenance: variant changes first under one group heading, both-view structures after;
    // plain sentences, no internal "Centroid of" wording
    const groups = await info.locator('.fig-provenance h3').allInnerTexts();
    expect(groups[0]).toBe('In the variant');
    const firstLi = info.locator('.fig-provenance li').first();
    await expect(firstLi).toHaveAttribute('data-view', 'variant');
    for (const li of await info.locator('.fig-provenance li').all()) await expect(li.locator('.pv-text')).not.toBeEmpty();
    expect(await info.locator('.fig-provenance').innerText()).not.toMatch(/Centroid of| curve\b/);
    await expect(info.locator('.fig-credit')).toContainText('3D models:');
    expect(await page.locator('body').innerText()).not.toContain('nreviewed');

    // themes: the page follows prefers-color-scheme, [data-theme] overrides it; the stage is paper
    // in light mode and warm dark in dark mode, and the canvas is cleared to the same colour
    // (two animation frames first: a resize clears the drawing buffer until the next frame)
    const look = () => page.evaluate(async () => (await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), {
      bg: getComputedStyle(document.body).backgroundColor,
      stage: getComputedStyle(document.querySelector('#stage')).backgroundColor,
      // share of canvas pixels in the stage colour (the WebGL clear colour shows round the model)
      clear: (() => {
        const c = document.querySelector('#cv'), gl = c.getContext('webgl2') || c.getContext('webgl');
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4 * w * h);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const s = getComputedStyle(document.querySelector('#stage')).backgroundColor.match(/\d+/g).map(Number);
        let n = 0;
        for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - s[0]) + Math.abs(px[i + 1] - s[1]) + Math.abs(px[i + 2] - s[2]) <= 6) n++;
        return n / (w * h);
      })(),
      scroll: document.documentElement.scrollWidth - window.innerWidth,
    }));
    const seen = {};
    for (const width of [1200, 375]) {
      await page.setViewportSize({ width, height: width < 600 ? 812 : 800 });
      for (const scheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.waitForTimeout(400);
        const l = await look();
        expect(l.scroll, `${name} ${width} ${scheme}: horizontal scroll`).toBeLessThanOrEqual(0);
        expect(l.stage).toBe(scheme === 'light' ? 'rgb(238, 231, 216)' : 'rgb(36, 32, 27)');
        // (at 1200 px the wide stage always shows background round the model; on a phone it may not)
        if (width === 1200) expect(l.clear, `${name} ${width} ${scheme}: canvas cleared to the stage colour`).toBeGreaterThan(0.15);
        seen[scheme] = l.bg;
        await page.screenshot({ path: path.join(UI_OUT, `${name}-${width}-${scheme}.png`), fullPage: true });
      }
    }
    expect(seen.light).not.toBe(seen.dark);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.emulateMedia({ colorScheme: 'light' });
    expect((await look()).bg).toBe(seen.dark);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.emulateMedia({ colorScheme: 'dark' });
    expect((await look()).bg).toBe(seen.light);
    expect(errors).toEqual([]);
  });
}
