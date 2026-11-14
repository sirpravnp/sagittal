// Renders each scene variant to 800x600 PNGs (front = labels hidden, back = labels shown).
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const WIDTH = 800;
const HEIGHT = 600;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.txt': 'text/plain',
};

function serve(root) {
  const base = resolve(root);
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = resolve(join(base, path));
    if (file !== base && !file.startsWith(base + sep)) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

export async function renderCards({ siteDir, outDir, ids }) {
  const sceneIds = ids || JSON.parse(readFileSync(join(siteDir, 'scenes/index.json'), 'utf8'));
  mkdirSync(outDir, { recursive: true });
  const server = await serve(siteDir);
  const origin = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel: 'chrome', args: GL_ARGS });
  const results = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })).newPage();
    for (const id of sceneIds) {
      const meta = JSON.parse(readFileSync(join(siteDir, `scenes/${id}.meta.json`), 'utf8'));
      for (const v of meta.variants) {
        const q = `scene=${encodeURIComponent(id)}&${encodeURIComponent(meta.variantControl)}=${encodeURIComponent(v.key)}&embed=1`;
        await page.goto(`${origin}viewer.html?${q}`);
        // The Anki card carries its own Status field, so hide the in-stage badge.
        await page.addStyleTag({ content: '#stage-badge,#hint{display:none !important}' });
        await page.waitForFunction(() => window.viewer && window.viewer.debug().labelRects.length > 0);
        const stage = page.locator('#stage');
        const out = {};
        for (const [side, visible] of [['front', false], ['back', true]]) {
          await page.evaluate(async (vis) => {
            window.viewer.setLabelsVisible(vis);
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          }, visible);
          const name = `${id}__${v.key}__${side}.png`;
          await writeFile(join(outDir, name), await stage.screenshot({ type: 'png' }));
          out[side] = name;
        }
        results.push({ id, variant: v.key, front: out.front, back: out.back });
      }
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const t0 = Date.now();
  const res = await renderCards({ siteDir: join(root, 'site'), outDir: join(root, 'build/cards') });
  console.log(`rendered ${res.length * 2} images (${res.length} variants) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
