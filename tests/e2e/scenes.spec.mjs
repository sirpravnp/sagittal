import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const dir = new URL('../../site/scenes/', import.meta.url);
const readJson = (n) => JSON.parse(readFileSync(new URL(n, dir), 'utf8'));
const ids = readJson('index.json');

const WIDTHS = [1200, 375];
// Longest allowed leader line (px): a label further than this from its anchor reads as floating.
const MAX_LEADER = 90;
const MAX_LEADER_NARROW = 140;

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
        const { rects, leaders, lines, dots, cw, ch, nonBlank } = await page.evaluate(() => {
          const c = document.querySelector('canvas');
          const d = window.viewer.debug();
          const svg = document.querySelector('#labels svg.kit-leaders');
          return {
            rects: d.labelRects, leaders: d.leaders, cw: c.clientWidth, ch: c.clientHeight, nonBlank: d.nonBlank,
            lines: svg ? [...svg.querySelectorAll('line.kit-leader')].filter((l) => l.parentNode.style.display !== 'none').length : 0,
            dots: svg ? [...svg.querySelectorAll('circle.kit-anchor')].filter((l) => l.parentNode.style.display !== 'none').length : 0,
          };
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
        // Every label has an anchor dot on the stage and a leader line that ends on its chip,
        // and its anchor is on a visible surface (or the scene marks it as deliberately behind).
        expect(leaders.length, tag).toBe(rects.length);
        expect(lines, tag).toBe(rects.length);
        expect(dots, tag).toBe(rects.length);
        leaders.forEach((l, i) => {
          expect(l, `${tag}: label ${i} anchor is off-stage`).not.toBeNull();
          const lt = `${tag} "${l.text}"`;
          for (const [x, y] of [[l.ax, l.ay], [l.x2, l.y2]]) {
            expect(x, lt).toBeGreaterThanOrEqual(0); expect(x, lt).toBeLessThanOrEqual(cw + 0.5);
            expect(y, lt).toBeGreaterThanOrEqual(0); expect(y, lt).toBeLessThanOrEqual(ch + 0.5);
          }
          const r = rects[i];
          expect(l.x2 >= r.x - 0.5 && l.x2 <= r.x + r.w + 0.5 && l.y2 >= r.y - 0.5 && l.y2 <= r.y + r.h + 0.5, `${lt}: leader ends on its label`).toBe(true);
          expect(l.len, `${lt}: label is close to its anchor`).toBeLessThanOrEqual(width < 600 ? MAX_LEADER_NARROW : MAX_LEADER);
          if (!l.behind) expect(l.occluded, `${lt}: anchor is hidden behind another structure`).toBe(false);
        });
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
