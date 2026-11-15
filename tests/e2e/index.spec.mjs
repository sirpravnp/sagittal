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

test('index shows the three example figures as numbered plates (not yet links) and opens without errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('index.html');
  await expect(page.locator('h1')).toHaveText('Sagittal');
  await expect(page.locator('.desc')).toHaveText('Text-to-image for anatomy');
  const plates = page.locator('#examples .plate');
  await expect(plates).toHaveCount(3);
  const want = [
    ['replaced-rha', 'Plate I', 'Replaced right hepatic artery from the SMA'],
    ['low-cystic-duct', 'Plate II', 'Low insertion of the cystic duct'],
    ['aberrant-right-subclavian', 'Plate III', 'Aberrant right subclavian artery'],
  ];
  for (let i = 0; i < want.length; i++) {
    const [slug, no, title] = want[i];
    const plate = plates.nth(i);
    await expect(plate).toHaveAttribute('data-example', slug);
    await expect(plate).toHaveAttribute('data-figure-href', ''); // hook for the interactive figure
    await expect(plate.locator('.fig')).toHaveText(no);
    await expect(plate.locator('.plate-title .t')).toHaveText(title);
    await expect(plate.locator('.ex-line')).not.toBeEmpty();
    await expect(plate.locator('a')).toHaveCount(0);
    const img = plate.locator('img');
    await expect(img).toHaveAttribute('src', `examples/${slug}.webp`);
    expect((await img.getAttribute('alt')).length).toBeGreaterThan(40);
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((e) => e.complete && e.naturalWidth > 0)).toBe(true);
  }
  // the library plate grid is gone from the landing page
  await expect(page.locator('#gallery')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('an example plate links its title once data-figure-href is set', async ({ page }) => {
  await page.route('**/index.html', async (r) => {
    const res = await r.fetch();
    const body = (await res.text()).replace('data-example="low-cystic-duct" data-figure-href=""', 'data-example="low-cystic-duct" data-figure-href="examples/low-cystic-duct.html"');
    await r.fulfill({ response: res, body });
  });
  await page.goto('index.html');
  await expect(page.locator('[data-example="low-cystic-duct"] .plate-title a')).toHaveAttribute('href', 'examples/low-cystic-duct.html');
  await expect(page.locator('[data-example="replaced-rha"] a')).toHaveCount(0);
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
  await expect(page.locator('#deck-list .deck').first()).toBeVisible();
  const heads = await page.locator('h1, h2, h3, h4, h5, h6').allInnerTexts();
  expect(heads.length).toBeGreaterThanOrEqual(7);
  for (const h of heads) expect(h.trim().split(/\s+/).length, `heading "${h}"`).toBeLessThanOrEqual(4);
  for (const t of ['Same subject, two figures', 'How it works', 'Install the skill', 'Examples', 'Anki decks', 'Credits']) {
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
    await expect(page.locator('#examples .plate')).toHaveCount(3);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
    expect(errors).toEqual([]);
  });
});

test('keyboard: the skip link is first and moves focus to the examples', async ({ page }) => {
  await page.goto('index.html');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip')).toBeFocused();
  const ring = await page.locator('.skip').evaluate((e) => getComputedStyle(e).outlineStyle);
  expect(ring).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#examples$/);
  await expect(page.locator('#examples')).toBeFocused();
});
