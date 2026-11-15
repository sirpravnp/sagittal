// Figure player: each fixture spec renders in both views with clean labels, the view dropdown
// swaps base and variant structures, and the info panel lists provenance.
// The page is served straight from the repo (player/dev.html loads ../organs and ../site) by
// routing a made-up origin to the working tree, so no second web server is needed.
// Screenshots of every view are written to build/figures/ for visual review.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
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
// variant view, the provenance entries the info panel must list, and the starting orientation cue.
const EXPECT = {
  'replaced-rha.json': { normalOnly: 'rha', variantOnly: 'rrha', provenance: ['pha', 'rha', 'lha', 'chd', 'rrha'], orient: /^Right anterior oblique view/ },
  'low-cystic-duct.json': { normalOnly: 'cystic_duct', variantOnly: 'cystic_duct_low', provenance: ['cbd', 'chd', 'cystic_duct', 'cystic_duct_low'], orient: /^Left anterior oblique view/ },
  'aberrant-right-subclavian.json': { normalOnly: 'aorta/right_subclavian_artery', variantOnly: 'arsa', provenance: ['aorta/right_subclavian_artery', 'aorta/brachiocephalic_trunk', 'aorta/right_common_carotid_artery', 'arsa'], orient: /^(Posterior view|Right posterior oblique view)/ },
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
    return { rects: d.labelRects, leaders: d.leaders, cw: c.clientWidth, ch: c.clientHeight, nonBlank: d.nonBlank, drawn: p,
      orient: document.querySelector('#orient').textContent };
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
        // the orientation cue is shown and agrees with the player
        expect(s.orient, tag).toBe(s.drawn.orientation);
        expect(s.orient, tag).toMatch(EXPECT[fixture].orient);
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

    await page.locator('#kit_c_v').selectOption('normal');
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
