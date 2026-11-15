import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const dir = new URL('../../site/scenes/', import.meta.url);
const ids = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
const metas = ids.map((id) => JSON.parse(readFileSync(new URL(`${id}.meta.json`, dir), 'utf8')));

function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return errors;
}

test('index lists every scene in index.json as a numbered plate linking to the viewer', async ({ page, request }) => {
  const errors = watchErrors(page);
  await page.goto('index.html');
  await expect(page.locator('h1')).toHaveText('Sagittal');
  expect(await page.locator('body').innerText()).not.toContain('nreviewed');
  await expect(page.locator('.desc')).toHaveText('Medical image generation');
  const plates = page.locator('.plate');
  await expect(plates).toHaveCount(ids.length);
  for (let i = 0; i < metas.length; i++) {
    const m = metas[i];
    const plate = plates.nth(i);
    await expect(plate.locator('.fig')).toHaveText(`Fig. ${i + 1}`);
    await expect(plate.locator('a')).toHaveText(m.title);
    await expect(plate.locator('a')).toHaveAttribute('href', `viewer.html?scene=${m.id}`);
    await expect(plate).toContainText(m.topic);
    for (const v of m.variants) await expect(plate).toContainText(v.label);
    // A plate has either a loaded image or the plain text fallback, never a broken image.
    const img = plate.locator('img');
    if (await img.count()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((e) => e.complete && e.naturalWidth > 0)).toBe(true);
    } else {
      await expect(plate.locator('.plate-img.empty')).toContainText(m.title);
    }
  }
  // Every link resolves: the viewer opens that scene.
  for (const m of metas) {
    const res = await request.get(`viewer.html?scene=${m.id}`);
    expect(res.ok()).toBe(true);
  }
  await plates.nth(0).locator('a').click();
  await expect(page).toHaveURL(new RegExp(`viewer\\.html\\?scene=${ids[0]}$`));
  await expect(page.locator('h1')).toHaveText(metas[0].title);
  expect(errors).toEqual([]);
});

test('index lists one deck row per topic', async ({ page }) => {
  await page.goto('index.html');
  const topics = [...new Set(metas.map((m) => m.topic))];
  await expect(page.locator('#deck-list .deck')).toHaveCount(topics.length);
  const slug = (t) => 'sagittal-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  await expect(page.getByRole('link', { name: `${topics[0]} deck`, exact: true })).toHaveAttribute('href', `decks/${slug(topics[0])}.apkg`);
  await expect(page.getByRole('link', { name: 'model credits' })).toHaveAttribute('href', 'credits.html');
  await expect(page.locator('footer')).toContainText('CC BY-SA 4.0');
  await expect(page.locator('footer')).toContainText('Rodero et al. 2021, CC BY 4.0');
});

test('a scene without a thumbnail gets a plain text plate, not a broken image', async ({ page }) => {
  const errors = watchErrors(page);
  await page.route('**/thumbs/manifest.json', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }));
  await page.goto('index.html');
  await expect(page.locator('.plate')).toHaveCount(ids.length);
  await expect(page.locator('.plate img')).toHaveCount(0);
  await expect(page.locator('.plate-img.empty').first()).toContainText(metas[0].title);
  expect(errors).toEqual([]);
});

test('every committed thumbnail exists and is at most 60 KB', async ({ request }) => {
  const manifest = await (await request.get('thumbs/manifest.json')).json();
  for (const [id, t] of Object.entries(manifest)) {
    expect(ids, id).toContain(id);
    const res = await request.get('thumbs/' + t.file);
    expect(res.ok(), t.file).toBe(true);
    expect((await res.body()).length, t.file).toBeLessThanOrEqual(60 * 1024);
  }
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('index has no horizontal scroll at 375 px', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('index.html');
    await expect(page.locator('.plate')).toHaveCount(ids.length);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
    expect(errors).toEqual([]);
  });
});

test('keyboard: skip link and plate links are reachable with a visible focus ring', async ({ page }) => {
  await page.goto('index.html');
  await expect(page.locator('.plate')).toHaveCount(ids.length);
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip')).toBeFocused();
  await page.keyboard.press('Tab');
  const focused = page.locator('.plate a').first();
  await expect(focused).toBeFocused();
  const ring = await page.locator('.plate').first().evaluate((e) => getComputedStyle(e).outlineStyle);
  expect(ring).toBe('solid');
});
