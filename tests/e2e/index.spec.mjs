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
  // no captions under the images; one plain note names the generic figure's errors (the
  // structures involved, not exact wording) and does not claim the skill drew the right one
  await expect(page.locator('#compare figcaption')).toHaveCount(0);
  const note = (await page.locator('#compare .cmp-note').innerText()).toLowerCase();
  for (const w of ['liver', 'cystic duct', 'gallbladder', 'pancreas', 'duodenum', 'label', 'sagittal']) expect(note).toContain(w);
  expect(note).not.toMatch(/prompt|skill/);
  expect(errors).toEqual([]);
});

test('every heading is at most four words; no review disclaimer anywhere', async ({ page }) => {
  await page.goto('index.html');
  await expect(page.locator('h1')).toBeVisible();
  const heads = await page.locator('h1, h2, h3, h4, h5, h6').allInnerTexts();
  expect(heads.length).toBeGreaterThanOrEqual(7);
  for (const h of heads) expect(h.trim().split(/\s+/).length, `heading "${h}"`).toBeLessThanOrEqual(4);
  for (const t of ['Same subject, two figures', 'How it works', 'Use Sagittal', 'Examples', 'Credits']) {
    expect(heads.map((h) => h.trim())).toContain(t);
  }
  // use: the connector address, steps for claude.ai, ChatGPT and Claude Code, and the self-host route
  const install = page.locator('#install');
  const cmds = (await install.locator('pre').allInnerTexts()).join('\n');
  expect(cmds).toContain('https://sagittal-mcp.fly.dev/mcp');
  expect(cmds).toContain('claude mcp add --transport http --scope user sagittal https://sagittal-mcp.fly.dev/mcp');
  for (const t of ['claude.ai', 'ChatGPT', 'Claude Code', '~/.claude/skills']) await expect(install).toContainText(t);
  await expect(install.locator('ol > li')).toHaveCount(4);
  await expect(page.locator('#how .steps li')).toHaveCount(3);
  expect(await page.locator('body').innerText()).not.toContain('nreviewed');
  expect(await page.content()).not.toContain('nreviewed');
});

test('copy: text-to-image for anatomy in general, no italic captions', async ({ page }) => {
  await page.goto('index.html');
  await expect(page).toHaveTitle(/text-to-image for anatomy/i);
  await expect(page.locator('.intro')).toHaveText('You get a labelled 3D figure you can turn, compare and save. It is built from real reconstructed anatomy, not drawn from memory, and every fact on it cites a source.');
  // example prompts mix normal anatomy and a variant
  const ask = await page.locator('#how').innerText();
  expect(ask).toContain('the hepatobiliary tree');
  expect(ask).toContain('replaced right hepatic artery');
  await expect(page.locator('figcaption')).toHaveCount(3); // the example plates' titles only
  for (const el of await page.locator('figcaption, .intro, .cmp-note, .sec-note').all()) {
    expect(await el.evaluate((e) => getComputedStyle(e).fontStyle)).toBe('normal');
  }
});

test('first viewport at 1440 px shows a typed request and the figure it produced', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('index.html');
  const ask = page.locator('.masthead .ask-line');
  await expect(ask).toContainText('replaced right hepatic artery');
  const img = page.locator('.masthead .mast-fig img');
  await expect.poll(() => img.evaluate((e) => e.complete && e.naturalWidth > 0)).toBe(true);
  for (const loc of [ask, img]) {
    const b = await loc.boundingBox();
    expect(b.y + b.height, 'inside the first viewport').toBeLessThanOrEqual(900);
  }
  expect((await img.getAttribute('alt')).length).toBeGreaterThan(40);
  // no section counters or eyebrows: section headings carry no generated prefix
  const before = await page.locator('.sec > h2').first().evaluate((e) => getComputedStyle(e, '::before').content);
  expect(['none', 'normal']).toContain(before);
});

test('index has no Anki decks section (on hold) and credits the models', async ({ page }) => {
  await page.goto('index.html');
  await expect(page.locator('#decks')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Anki');
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
