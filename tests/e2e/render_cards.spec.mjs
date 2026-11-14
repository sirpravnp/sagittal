import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCards } from '../../tools/render_cards.mjs';

const siteDir = fileURLToPath(new URL('../../site', import.meta.url));
const heartMeta = JSON.parse(readFileSync(join(siteDir, 'scenes/heart.meta.json'), 'utf8'));

// PNG IHDR: width at byte 16, height at byte 20 (big-endian).
function pngSize(file) {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('renders front/back 800x600 PNGs for every heart variant', async () => {
  test.setTimeout(180000);
  const outDir = mkdtempSync(join(tmpdir(), 'sagittal-cards-'));
  try {
    const res = await renderCards({ siteDir, outDir, ids: ['heart'] });
    expect(res).toHaveLength(heartMeta.variants.length);
    expect(res).toHaveLength(6);
    for (const r of res) {
      expect(r.id).toBe('heart');
      expect(r.front).toBe(`heart__${r.variant}__front.png`);
      expect(r.back).toBe(`heart__${r.variant}__back.png`);
      for (const f of [r.front, r.back]) {
        expect(existsSync(join(outDir, f))).toBe(true);
        expect(pngSize(join(outDir, f))).toEqual([800, 600]);
      }
      const front = readFileSync(join(outDir, r.front));
      const back = readFileSync(join(outDir, r.back));
      expect(front.equals(back)).toBe(false);
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
