// make-figure output opened straight from disk (file://) with the network blocked: every fixture
// renders both views, labels and credits, and the page makes no request outside itself.
// Screenshots: build/figures/file/<fixture>-<view>.png (for visual review).
import { test, expect } from '@playwright/test';
import { readdirSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { buildFigure } from '../../player/make-figure.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIX = path.join(ROOT, 'tests/fixtures/figures');
const OUT = path.join(ROOT, 'build/figures/file');
const fixtures = readdirSync(FIX).filter((f) => f.endsWith('.json')).sort();

for (const fixture of fixtures) {
  test(`${fixture}: the written file renders from file:// with no network`, async ({ page, context }) => {
    test.slow();
    mkdirSync(OUT, { recursive: true });
    const spec = JSON.parse(readFileSync(path.join(FIX, fixture), 'utf8'));
    const b = buildFigure(spec);
    expect(b.ok).toBe(true);
    const name = fixture.replace(/\.json$/, '');
    const file = path.join(OUT, name + '.html');
    writeFileSync(file, b.html);

    // no network: offline, and any http(s)/ws request is aborted and recorded
    await context.setOffline(true);
    const outside = [];
    await context.route(/^(https?|wss?):/, (r) => { outside.push(r.request().url()); return r.abort(); });
    page.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) outside.push(r.url()); });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && m.text().startsWith('Sagittal'))) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.setViewportSize({ width: 1200, height: 800 });

    for (const view of ['variant', 'normal']) {
      await page.goto(pathToFileURL(file).href + '?v=' + view);
      await page.waitForFunction(() => window.viewer && window.viewer.debug().labelRects.length > 0, null, { timeout: 60000 });
      await page.waitForTimeout(200);
      const s = await page.evaluate(() => ({ nonBlank: window.viewer.debug().nonBlank, view: window.SagittalPlayer.debug().view,
        dropped: window.SagittalPlayer.debug().dropped, errors: !document.getElementById('errors').hidden }));
      expect(s.errors, `${name}/${view}: error box shown`).toBe(false);
      expect(s.view).toBe(view);
      expect(s.nonBlank, `${name}/${view}: render not blank`).toBe(true);
      expect(s.dropped).toEqual([]);
      await expect(page.locator('h1')).toHaveText(spec.title);
      await expect(page.locator('#info .fig-credit')).toContainText('3D models:');
      await page.locator('#stage').screenshot({ path: path.join(OUT, `${name}-${view}.png`) });
    }
    await page.screenshot({ path: path.join(OUT, `${name}-page.png`), fullPage: true });
    expect(outside, 'requests that left the file').toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('look-figure renders both views of a written figure to PNGs and reports its labels', async () => {
  test.slow();
  const { spawnSync } = await import('node:child_process');
  const { existsSync } = await import('node:fs');
  mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, 'look-low-cystic-duct.html');
  writeFileSync(file, buildFigure(JSON.parse(readFileSync(path.join(FIX, 'low-cystic-duct.json'), 'utf8'))).html);
  const env = { ...process.env }; delete env.npm_lifecycle_event;
  const r = spawnSync('node', [path.join(ROOT, 'player/look-figure.mjs'), file, '--rot', '0.2,2.6'], { encoding: 'utf8', env, timeout: 120000 });
  expect(r.status, r.stdout + r.stderr).toBe(0);
  for (const v of ['normal', 'variant']) expect(existsSync(path.join(OUT, `look-low-cystic-duct-rot0.2_2.6-${v}.png`))).toBe(true);
  expect(r.stdout).toMatch(/view: Right posterior oblique view/);
  expect(r.stdout).toMatch(/label "Cystic duct \(low insertion\)" anchor \d+,\d+/);
});
