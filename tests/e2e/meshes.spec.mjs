import { test, expect } from '@playwright/test';

const TISSUES = ['myocardium', 'vessel-artery', 'vessel-vein', 'blood-oxy', 'blood-deoxy', 'blood-mixed', 'bone',
  'cartilage', 'lung', 'liver', 'gallbladder', 'bile-duct', 'pancreas', 'bowel', 'fascia', 'muscle', 'fat',
  'uterus-serosa', 'myometrium', 'endometrium', 'fibroid', 'sclera', 'cornea', 'iris', 'lens', 'retina', 'choroid',
  'nerve', 'air', 'highlight'];

function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  return errors;
}

async function openHeart(page) {
  await page.goto('viewer.html?scene=heart');
  await page.waitForFunction(() => window.viewer && window.viewer.debug().labelRects.length > 0);
}

test('a scene declaring meshes: [...] gets them loaded, then Kit.meshPart renders the thorax', async ({ page }) => {
  const errors = watchErrors(page);
  await openHeart(page);
  const r = await page.evaluate(async () => {
    // A throwaway scene, registered in the page, exercising the same path a real scene uses.
    Kit.register({
      id: 'mesh-probe', center: [0, 0, 0], zoom: 9, rot: [0, 0], controls: [], meshes: ['thorax'],
      build: function (g) {
        var s = new THREE.Group(); s.scale.setScalar(0.15); g.add(s);
        Kit.meshParts('thorax').forEach(function (p) {
          Kit.meshPart(s, 'thorax', p, p.indexOf('cartilage') >= 0 ? 'cartilage' : 'bone');
        });
        return { labels: [{ t: 'Sternum', p: [0, 0, 1.2] }] };
      },
    });
    const before = !!(window.SagittalMeshes && window.SagittalMeshes.thorax);
    await SagittalApp.loadMeshes('mesh-probe');
    const parts = Kit.meshParts('thorax');
    const g = new THREE.Group();
    const a = Kit.meshPart(g, 'thorax', 'sternum', Kit.tissue('bone'));
    const b = Kit.meshPart(g, 'thorax', 'sternum', 'bone');
    window.viewer.open('mesh-probe', {});
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    return {
      before, parts,
      verts: a.geometry.attributes.position.count,
      tris: a.geometry.index.count / 3,
      hasNormals: !!a.geometry.attributes.normal,
      shared: a.geometry === b.geometry,
      physical: a.material.type,
      radius: a.geometry.boundingSphere.radius,
      nonBlank: window.viewer.debug().nonBlank,
      info: Kit.meshInfo('thorax'),
    };
  });
  expect(r.before).toBe(false);
  expect(r.parts).toContain('sternum');
  expect(r.parts).toContain('ribs_left');
  expect(r.verts).toBeGreaterThan(100);
  expect(r.tris).toBeGreaterThan(100);
  expect(r.hasNormals).toBe(true);
  expect(r.shared).toBe(true);
  expect(r.physical).toBe('MeshPhysicalMaterial');
  expect(r.radius).toBeGreaterThan(5);   // cm: the sternum is ~15 cm long
  expect(r.radius).toBeLessThan(20);
  expect(r.nonBlank).toBe(true);
  expect(r.info.unit).toBe('cm');
  expect(r.info.credit).toBe('zanatomy');
  expect(errors).toEqual([]);
});

test('Kit.meshPart explains a mesh that was not loaded', async ({ page }) => {
  await openHeart(page);
  const msg = await page.evaluate(() => {
    try { Kit.meshPart(new THREE.Group(), 'nope', 'x'); return 'no error'; } catch (e) { return e.message; }
  });
  expect(msg).toContain('meshes: [...]');
});

test('Kit.tissue builds every documented preset; old mat() still works', async ({ page }) => {
  const errors = watchErrors(page);
  await openHeart(page);
  const r = await page.evaluate((kinds) => ({
    kinds: Kit.tissueKinds(),
    types: kinds.map((k) => Kit.tissue(k).type),
    override: (() => { const m = Kit.tissue('bone', { color: 0xff0000, opacity: 0.5 }); return [+m.color.r.toFixed(3), m.color.g, m.color.b, m.transparent, m.opacity]; })(),
    mat: Kit.helpers.mat(0x00ff00, 0.5).type,
  }), TISSUES);
  expect(r.kinds.sort()).toEqual([...TISSUES].sort());
  expect(new Set(r.types)).toEqual(new Set(['MeshPhysicalMaterial']));
  expect(r.override).toEqual([1, 0, 0, true, 0.5]);
  expect(r.mat).toBe('MeshStandardMaterial');
  expect(errors).toEqual([]);
});

test('viewer credits the scene models and links to the credits page', async ({ page, request }) => {
  await openHeart(page);
  const credit = page.locator('#scene-credit');
  await expect(credit).toContainText('Rodero et al. 2021');
  await expect(credit).toContainText('CC BY 4.0');
  await expect(credit).toContainText('Z-Anatomy');
  await expect(credit).toContainText('CC BY-SA 4.0');
  const link = page.getByRole('link', { name: 'Model credits' });
  await expect(link).toHaveAttribute('href', 'credits.html');
  await link.click();
  await expect(page.locator('#credits-text')).toContainText('## zanatomy');
  await expect(page.locator('#credits-text')).toContainText('University of Dundee');
  const res = await request.get('meshes/CREDITS.md');
  expect(res.ok()).toBe(true);
  expect(await res.text()).toContain('CC BY-SA');
});
