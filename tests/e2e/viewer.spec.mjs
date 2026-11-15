import { test, expect, chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const sceneIds = JSON.parse(readFileSync(new URL('../../site/scenes/index.json', import.meta.url), 'utf8'));
const heartMeta = JSON.parse(readFileSync(new URL('../../site/scenes/heart.meta.json', import.meta.url), 'utf8'));

// Collects console errors and uncaught page errors.
function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return errors;
}

async function openHeart(page, query = '') {
  await page.goto('viewer.html?scene=heart' + query);
  await page.waitForFunction(() => window.viewer && window.viewer.debug().labelRects.length > 0);
}

test('heart scene loads cleanly and renders', async ({ page }) => {
  const errors = watchErrors(page);
  await openHeart(page);
  await expect(page.locator('h1')).toHaveText(heartMeta.title);
  const nonBlank = await page.evaluate(() => window.viewer.debug().nonBlank);
  expect(nonBlank).toBe(true);
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('nreviewed');
  expect(text).toContain(heartMeta.claims[0]);
  // controls rendered from the scene definition
  await expect(page.locator('select')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('query params set initial control state', async ({ page }) => {
  const errors = watchErrors(page);
  await openHeart(page, '&d=tof');
  await expect(page.locator('select')).toHaveValue('tof');
  await expect(page.locator('#labels')).toContainText('Overriding aorta');
  expect(errors).toEqual([]);
});

test('labels toggle hides labels', async ({ page }) => {
  await openHeart(page);
  await page.getByLabel('Labels').uncheck();
  await expect(page.locator('#labels')).toBeHidden();
  await page.getByLabel('Labels').check();
  await expect(page.locator('#labels')).toBeVisible();
});

test('embed=1 hides the side panel', async ({ page }) => {
  await openHeart(page, '&embed=1');
  await expect(page.locator('aside')).toBeHidden();
  expect(await page.locator('body').innerText()).not.toContain('nreviewed');
});

test('unknown scene shows the gallery with "Scene not found"', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('viewer.html?scene=nope');
  await expect(page.locator('body')).toContainText('Scene not found');
  await expect(page.locator('.card')).toHaveCount(sceneIds.length);
  await expect(page.locator('.card', { hasText: heartMeta.title })).toHaveCount(1);
  expect(errors).toEqual([]);
});

// The landing page no longer lists the library; the viewer's own scene list (shown for an unknown
// scene) still links every scene.
test('gallery lists scenes with title and link', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('viewer.html?scene=nope');
  const card = page.locator('.card', { hasText: heartMeta.title });
  expect(await page.locator('body').innerText()).not.toContain('nreviewed');
  await expect(card.locator('a')).toHaveAttribute('href', 'viewer.html?scene=heart');
  expect(errors).toEqual([]);
});

test('WebGL off shows fallback text without uncaught errors', async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu', '--disable-webgl', '--disable-3d-apis'] });
  try {
    const page = await browser.newPage({ baseURL: test.info().project.use.baseURL });
    const uncaught = [];
    page.on('pageerror', (e) => uncaught.push(e.message));
    await page.goto('viewer.html?scene=heart');
    await expect(page.locator('body')).toContainText('3D is not available');
    await expect(page.locator('body')).toContainText(heartMeta.claims[0]);
    expect(uncaught).toEqual([]);
  } finally {
    await browser.close();
  }
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  test('labels lie inside the canvas and do not overlap', async ({ page }) => {
    test.slow(); // six variants, software GL
    for (const d of heartMeta.variants.map((v) => v.key)) {
      await openHeart(page, '&d=' + d);
      await page.waitForTimeout(100);
      const { rects, cw, ch } = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        return { rects: window.viewer.debug().labelRects, cw: c.clientWidth, ch: c.clientHeight };
      });
      expect(rects.length, d).toBeGreaterThan(0);
      for (const r of rects) {
        expect(r.x, d).toBeGreaterThanOrEqual(0);
        expect(r.y, d).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w, d).toBeLessThanOrEqual(cw + 0.5);
        expect(r.y + r.h, d).toBeLessThanOrEqual(ch + 0.5);
      }
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          const overlap = a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
          expect(overlap, `${d}: label ${i} overlaps ${j}`).toBe(false);
        }
      }
    }
  });

  test('touch drag rotates the model without scrolling the page', async ({ page }) => {
    await openHeart(page);
    const before = await page.evaluate(() => window.viewer.debug().rot);
    const box = await page.locator('canvas').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
    await touch('touchStart', cx, cy);
    for (let i = 1; i <= 10; i++) await touch('touchMove', cx + i * 8, cy - i * 12);
    await touch('touchEnd');
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => window.viewer.debug().rot);
    expect(after[1]).not.toBeCloseTo(before[1], 3);
    expect(after[0]).not.toBeCloseTo(before[0], 3);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
