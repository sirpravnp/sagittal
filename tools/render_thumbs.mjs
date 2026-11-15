// Renders one small WebP plate image per scene into site/thumbs/, plus site/thumbs/manifest.json.
// The landing page shows an image only for ids listed in the manifest, so a scene added without
// re-running this step gets a plain text plate instead of a broken image (and no 404).
//
//   npm run thumbs                 # every scene in site/scenes/index.json
//   node tools/render_thumbs.mjs heart eye   # only these ids (merged into the manifest)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, GL_ARGS } from './render_cards.mjs';

export const THUMB_W = 720;
export const THUMB_H = 540;
export const THUMB_SCALE = 2; // rendered at 2x so plates stay sharp on high-density screens
export const MAX_BYTES = 60 * 1024;

// The plate shows the first pathological view: variant 0 unless it is the normal reference,
// in which case variant 1 (a "Tension pneumothorax" plate should not show a normal chest).
export function plateVariant(meta) {
  const v = meta.variants;
  if (v.length > 1 && /^norm/i.test(v[0].key)) return v[1];
  return v[0];
}

export async function renderThumbs({ siteDir, outDir, ids }) {
  const allIds = JSON.parse(readFileSync(join(siteDir, 'scenes/index.json'), 'utf8'));
  const sceneIds = ids && ids.length ? ids : allIds;
  mkdirSync(outDir, { recursive: true });
  const manifestPath = join(outDir, 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const server = await serve(siteDir);
  const origin = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ ...(process.env.CI ? {} : { channel: 'chrome' }), args: GL_ARGS });
  const results = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: THUMB_W, height: THUMB_H }, deviceScaleFactor: THUMB_SCALE });
    const page = await ctx.newPage();
    const enc = await ctx.newPage();
    await enc.goto(origin + 'scenes/index.json'); // any same-origin page will do for the canvas encoder
    for (const id of sceneIds) {
      const meta = JSON.parse(readFileSync(join(siteDir, `scenes/${id}.meta.json`), 'utf8'));
      const v = plateVariant(meta);
      const q = `scene=${encodeURIComponent(id)}&${encodeURIComponent(meta.variantControl)}=${encodeURIComponent(v.key)}&embed=1`;
      await page.goto(`${origin}viewer.html?${q}`);
      await page.addStyleTag({ content: '#hint{display:none !important}' });
      await page.waitForFunction(() => window.viewer && window.viewer.debug().labelRects.length > 0);
      await page.evaluate(async () => {
        window.viewer.setLabelsVisible(false);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      });
      const png = await page.locator('#stage').screenshot({ type: 'png' });
      // Encode to WebP in the browser (no native image dependency); step quality down to fit the budget.
      const webp = await enc.evaluate(async ({ b64, max }) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        let out = '';
        for (const quality of [0.82, 0.74, 0.66, 0.58, 0.5, 0.4]) {
          out = c.toDataURL('image/webp', quality);
          if (out.length * 0.75 <= max) break;
        }
        return out;
      }, { b64: png.toString('base64'), max: MAX_BYTES });
      if (!webp.startsWith('data:image/webp')) throw new Error('this browser cannot encode WebP');
      const buf = Buffer.from(webp.split(',')[1], 'base64');
      const file = `${id}.webp`;
      writeFileSync(join(outDir, file), buf);
      manifest[id] = { file, variant: v.key, width: THUMB_W * THUMB_SCALE, height: THUMB_H * THUMB_SCALE };
      results.push({ id, file, variant: v.key, bytes: buf.length });
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  // Drop entries for scenes that are no longer in the index; keep the file order stable.
  const clean = {};
  for (const id of allIds) if (manifest[id]) clean[id] = manifest[id];
  writeFileSync(manifestPath, JSON.stringify(clean, null, 2) + '\n');
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const t0 = Date.now();
  const res = await renderThumbs({ siteDir: join(root, 'site'), outDir: join(root, 'site/thumbs'), ids: process.argv.slice(2) });
  for (const r of res) console.log(`${r.file}  ${r.variant}  ${(r.bytes / 1024).toFixed(1)} KB`);
  console.log(`rendered ${res.length} thumbnails in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
