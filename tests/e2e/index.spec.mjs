import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const dir = new URL('../../site/scenes/', import.meta.url);
const ids = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8'));
const metas = ids.map((id) => JSON.parse(readFileSync(new URL(`${id}.meta.json`, dir), 'utf8')));

function roman(n) {
  let r = '';
  for (const [v, s] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { r += s; n -= v; }
  return r;
}

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
  await expect(page.locator('.desc')).toHaveText('Text-to-image for anatomy');
  const plates = page.locator('.plate');
  await expect(plates).toHaveCount(ids.length);
  for (let i = 0; i < metas.length; i++) {
    const m = metas[i];
    const plate = plates.nth(i);
    await expect(plate.locator('.fig')).toHaveText(`Plate ${roman(i + 1)}`);
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

test('comparison: the generic LLM figure and the Sagittal figure, both loaded, with alt text and captions', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('index.html');
  const figs = page.locator('#compare figure');
  await expect(figs).toHaveCount(2);
  await expect(page.locator('#compare')).toContainText('the hepatobiliary tree');
  for (const [i, src] of [[0, 'compare/generic-llm.webp'], [1, 'compare/sagittal-hepatobiliary.webp']]) {
    const img = figs.nth(i).locator('img');
    await expect(img).toHaveAttribute('src', src);
    expect((await img.getAttribute('alt')).length, src).toBeGreaterThan(40);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((e) => e.complete && e.naturalWidth > 0)).toBe(true);
  }
  // the first caption names the generic figure's errors (the structures involved, not exact wording)
  const cap = (await figs.nth(0).locator('figcaption').innerText()).toLowerCase();
  for (const w of ['liver', 'cystic duct', 'gallbladder', 'pancreas', 'duodenum', 'label']) expect(cap).toContain(w);
  // the second does not claim the skill produced it from that prompt
  const cap2 = (await figs.nth(1).locator('figcaption').innerText()).toLowerCase();
  expect(cap2).toContain('sagittal');
  expect(cap2).not.toMatch(/prompt|skill/);
  expect(errors).toEqual([]);
});

test('every heading is at most four words; no review disclaimer anywhere', async ({ page }) => {
  await page.goto('index.html');
  await expect(page.locator('.plate')).toHaveCount(ids.length);
  const heads = await page.locator('h1, h2, h3, h4, h5, h6').allInnerTexts();
  expect(heads.length).toBeGreaterThanOrEqual(7);
  for (const h of heads) expect(h.trim().split(/\s+/).length, `heading "${h}"`).toBeLessThanOrEqual(4);
  for (const t of ['Same subject, two figures', 'How it works', 'Install the skill', 'The plates', 'Anki decks', 'Credits']) {
    expect(heads.map((h) => h.trim())).toContain(t);
  }
  await expect(page.locator('#install pre')).toContainText('ln -s "$PWD/skills/sagittal" ~/.claude/skills/sagittal');
  await expect(page.locator('#how .steps li')).toHaveCount(3);
  expect(await page.locator('body').innerText()).not.toContain('nreviewed');
  expect(await page.content()).not.toContain('nreviewed');
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
    await expect(page.locator('#compare img')).toHaveCount(2);
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
