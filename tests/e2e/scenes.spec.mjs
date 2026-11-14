import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const dir = new URL('../../site/scenes/', import.meta.url);
const readJson = (n) => JSON.parse(readFileSync(new URL(n, dir), 'utf8'));
const ids = readJson('index.json');

const WIDTHS = [1200, 375];

for (const id of ids) {
  const meta = readJson(`${id}.meta.json`);
  for (const width of WIDTHS) {
    test(`${id} @${width}px: every variant renders with clean, in-bounds labels`, async ({ page }) => {
      test.slow(); // several variants on software GL
      await page.setViewportSize({ width, height: width < 600 ? 812 : 800 });
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

      for (const v of meta.variants) {
        const key = v.key;
        await page.goto(`viewer.html?scene=${id}&${meta.variantControl}=${key}`);
        await page.waitForFunction(() => window.viewer && window.viewer.debug().labelRects.length > 0);
        await page.waitForTimeout(100);
        const { rects, cw, ch, nonBlank } = await page.evaluate(() => {
          const c = document.querySelector('canvas');
          const d = window.viewer.debug();
          return { rects: d.labelRects, cw: c.clientWidth, ch: c.clientHeight, nonBlank: d.nonBlank };
        });
        const tag = `${id}/${key}@${width}`;
        expect(nonBlank, tag).toBe(true);
        expect(rects.length, tag).toBeGreaterThan(0);
        for (const r of rects) {
          expect(r.x, tag).toBeGreaterThanOrEqual(0);
          expect(r.y, tag).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w, tag).toBeLessThanOrEqual(cw + 0.5);
          expect(r.y + r.h, tag).toBeLessThanOrEqual(ch + 0.5);
        }
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i], b = rects[j];
            const overlap = a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
            expect(overlap, `${tag}: label ${i} overlaps ${j}`).toBe(false);
          }
        }
      }
      expect(errors).toEqual([]);
    });
  }
}
