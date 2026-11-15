// "Changed from base anatomy" in plain language (player/ui.js provenanceHtml): the sentences for
// the three fixture figures, pinned. Each is built only from the resolved spec's ops and
// waypoints: a direction word ("behind", "in front of", "above") only where the waypoint has
// that offset from the named landmark or line; arteries arise from, ducts join; segment
// centroids are only approached ("toward segment IV").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({ window: {} });
for (const f of ['organs/organs.js', 'player/spec.js', 'player/ui.js']) vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
const W = ctx.window, O = W.SagittalOrgans;
// the player's libName(): a library structure or landmark by its manifest name
function nameOf(ref) {
  const i = ref.indexOf('/'), m = O.manifests[ref.slice(0, i)], id = ref.slice(i + 1);
  if (!m) return ref;
  if (m.centerlines && m.centerlines[id]) return m.centerlines[id].name;
  for (const p of m.parts || []) if (p.id === id) return p.name;
  if (m.landmarks && m.landmarks[id]) return m.landmarks[id].name;
  return ref;
}
function rows(fixture) {
  const R = W.SagittalSpec.validate(JSON.parse(readFileSync(`tests/fixtures/figures/${fixture}.json`, 'utf8')), O).resolved;
  const h = W.SagittalUI.infoHtml({ spec: R, references: O.references, name: nameOf });
  const un = (t) => t.replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  return [...h.matchAll(/data-view="([^"]+)"><span class="pv-name">([^<]+)<\/span> <span class="pv-text">([^<]*)</g)].map((m) => [m[1], un(m[2]), un(m[3])]);
}

const GOLD = {
  'replaced-rha': [
    ['variant', 'Right hepatic artery', 'Not present in the variant.'],
    ['variant', 'Replaced right hepatic artery', 'Added. Arises from the superior mesenteric artery; passes behind the portal confluence, behind and to the right of the upper end of the bile duct, along the course of the proper hepatic artery; ends at the intrahepatic end of the proper hepatic artery (right lobe).'],
    ['both', 'Proper hepatic artery', 'Arises from the common hepatic artery.'],
    ['both', 'Right hepatic artery', 'Arises from the proper hepatic artery; passes along the course of the proper hepatic artery; ends at the intrahepatic end of the proper hepatic artery (right lobe).'],
    ['both', 'Left hepatic artery', 'Arises from the proper hepatic artery; passes toward segment IV, toward segment III; ends toward segment II.'],
    ['both', 'Common bile duct', "Follows the base anatomy's bile duct; ends at the lower end of the bile duct."],
    ['both', 'Common hepatic duct', 'Joins the common bile duct; passes above the upper end of the bile duct; ends to the right of the upper end of the portal vein.'],
  ],
  'low-cystic-duct': [
    ['variant', 'Cystic duct', 'Not present in the variant.'],
    ['variant', 'Cystic duct (low insertion)', 'Added. Runs from the gallbladder neck; passes in front of the common bile duct; joins the common bile duct.'],
    ['both', 'Common bile duct', "Follows the base anatomy's bile duct; ends at the lower end of the bile duct."],
    ['both', 'Common hepatic duct', 'Joins the common bile duct; passes above the upper end of the bile duct; ends to the right of the upper end of the portal vein.'],
    ['both', 'Cystic duct', 'Runs from the gallbladder neck; passes along the course of the bile duct; joins the common bile duct.'],
  ],
  'aberrant-right-subclavian': [
    ['variant', 'Right subclavian artery', 'Not present in the variant.'],
    ['variant', 'Right common carotid artery', 'Arises from the arch of aorta instead.'],
    ['variant', 'Brachiocephalic trunk', 'Not present in the variant.'],
    ['variant', 'Aberrant right subclavian artery', 'Added. Arises from the arch of aorta; crosses behind the oesophagus, then passes to the left of the distal end of the right subclavian artery; ends at the distal end of the right subclavian artery.'],
  ],
};

for (const [fixture, want] of Object.entries(GOLD)) {
  test(`provenance sentences: ${fixture}`, () => {
    assert.deepEqual(rows(fixture), want);
  });
}

test('provenance never says "behind" a segment or "arises from" for a duct', () => {
  for (const f of Object.keys(GOLD)) {
    for (const [, name, text] of rows(f)) {
      assert.doesNotMatch(text, /(behind|in front of|above|below) segment/, `${f} ${name}`);
      if (/duct/i.test(name)) assert.doesNotMatch(text, /[Aa]rises from/, `${f} ${name}`);
      assert.doesNotMatch(text, /Centroid of| curve\b/, `${f} ${name}`);
    }
  }
});
