---
name: sagittal-scene
description: Build a new interactive, labelled anatomy scene for the sagittal library (three.js r149 classic script + meta JSON + card images) from a student's description such as "show where a scaphoid fracture cuts off blood supply". Use when asked to add, generate or rebuild a sagittal scene, bake a new anatomical mesh (Z-Anatomy, Rodero heart, or a CT segmentation via tools/meshes/ct_to_obj.py), or render and judge sagittal card images. Not for flowcharts, algorithms or clinical advice.
---

# Build a sagittal scene

sagittal is a static site of interactive anatomy scenes for medical students (Step 2 CK level).
Each scene is a real anatomical mesh (baked from open sources) with procedural teaching
overlays on top, rendered to Anki cards. You are adding one scene to that library.

**The anti-goal decides every trade-off: plausible-but-wrong anatomy is worse than nothing.**
A student will memorise what you draw. If you cannot make a structure correct, leave it out
and say so; never invent a course, a relation or a claim to fill a gap.

The quality bar is the existing cards in `build/cards/` (render them, see
`reference/visual-qa.md`): a student recognises every structure at a glance from the card,
each variant visibly shows its own finding, and nothing looks like a toy.

## Read before writing code

In the repo root (paths below are relative to it):

- `docs/meshes.md`: mesh format, frame, bake config keys, `Kit.meshPart`/`Kit.tissue`, licence rule.
- `site/kit/kit.js` (474 lines): the whole rendering API. Cheat sheet: `reference/kit-api.md`.
- Two finished scenes as models: `site/scenes/bil.js` + `bil.meta.json` (Z-Anatomy organs,
  ducts drawn along a real centre line, stones and masses as overlays) and `site/scenes/heart.js`
  + `heart.meta.json` (CT-derived heart, per-variant view angle, deformed copies of baked parts).
- `site/meshes/CREDITS.md` and the asset cache inventory
  `../sagittal-assets-cache/INVENTORY.md` (or `$SAGITTAL_ASSETS/INVENTORY.md`).

Setup once per checkout:

```sh
python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci     # cards and e2e use the installed Google Chrome
```

## 1. Pin down the concept before choosing anything

Write down, in two or three lines, before touching files:

1. The board-relevant finding (what the student must be able to point at). Example: "scaphoid
   waist fracture; dorsal branches of the radial artery enter the bone at the dorsal ridge,
   distal to the waist, and supply the proximal pole retrograde, so a waist fracture can leave
   the proximal pole avascular (AVN, nonunion)." (Check this against a source before using it.)
2. The structures that must be visible and labelled for that finding to make sense.
3. The variants: one per state worth a card (`normal`, then each lesion). 2 to 6 is typical.
4. Each claim you will make, with a source you can cite (StatPearls, an open textbook). If a
   fact is shaky, drop it or hedge it; do not guess.

If the request is not anatomy (a management algorithm, a lab pathway, a flowchart), stop: that
is a non-goal of the project. Say so instead of building a scene.

## 2. 3D scene or cut section

Every scene is a three.js scene; cards are 2D PNG renders of it. Choose the view, not the tech:

- **Whole-structure 3D** when the point is a course or a spatial relation (duct tree, vessel
  origins, hernia through which ring, shunt between chambers). Models: `bil`, `heart`, `ing`.
- **Cutaway / section inside the 3D scene** when the point is a layer or a wall (FIGO fibroid
  layers, retinal detachment, dissection flap). Clip the real mesh and cap the cut (models:
  `eye` sagittal cutaway with caps and a magnified inset, `fib` coronal section, `aorta` `int`
  histology slab).
- There is no pure 2D/SVG scene type in the kit yet. Do not add one; flag the need instead.

Pick one default view per variant that shows the finding. Rotate the model group per variant
when needed (`heart.js` does `H.rotation.set(0, view, 0)`), and keep the labels on the
visible side.

## 3. Source meshes, in this priority order

Real geometry first; procedural only as a last resort, and say so in the scene header comment,
CREDITS and your report. Details, commands and a worked scaphoid example: `reference/mesh-sourcing.md`.

1. **Already baked** in `site/meshes/*.js` (list with parts and offsets in the reference).
   Reuse when they cover the region: no new file size, already credited.
2. **Asset cache / Z-Anatomy.** `../sagittal-assets-cache/zanatomy/objects.tsv` lists all 4,569
   mesh and 951 curve objects of Z-Anatomy (BodyParts3D-derived, CC BY-SA). `grep -i` it for
   every structure you need. Extract with `tools/meshes/extract_blend.py` into a NEW folder
   `../sagittal-assets-cache/zanatomy-<topic>/obj` (never modify existing cache folders).
3. **Seed CT segmentation** when Z-Anatomy lacks the structure or a CT-shaped organ matters:
   an open CC BY segmentation (TotalSegmentator dataset) turned into OBJ with
   `tools/meshes/ct_to_obj.py`. Pipeline, licences and frame maths: `reference/seed-ct.md`.
4. **Procedural** (lathe, sweep, deformed primitive) only for what no open source has (the
   choroid, the uterus: Z-Anatomy is a male model). Build it from real dimensions, fit it to the
   real meshes around it, and state in CREDITS that it is procedural.

Overlays (stones, tears, sacs, arrows, rings, highlighted territories) are always procedural,
but they must sit on the real anatomy: place them from mesh coordinates (`Kit.meshInfo`
bboxes, sampled centre lines), never by eye in scene units.

## 4. Licences (hard rules)

- Allowed: CC0/PD, CC BY, CC BY-SA (any version), MIT. `bake.py` refuses anything else.
- Never NC or ND, even when bundled with allowed parts: Z-Anatomy's inner ear (CC BY-NC-SA)
  and kidney (CC BY-NC); brain white-matter / cortical parcellation objects (licence unclear).
- TotalSegmentator: the code and the open tasks' weights are Apache-2.0; the "licensed" tasks
  (`appendicular_bones`, `tissue_types`, `heartchambers_highres`, ...) are free only for
  non-commercial use, so never use their output. The CT dataset on Zenodo is CC BY 4.0.
- Unclear licence = do not use; note it in the cache's `INVENTORY.md` section of your report.
- Every baked mesh has `credit` = a `## <heading>` in `site/meshes/CREDITS.md`. Append a section:
  source, authors, URL/DOI, licence, exactly what you changed, which scene uses it.
- Downloads go under `../sagittal-assets-cache/<source>/`, never into the repo; keep the total
  under 1 GB and record URL, size and licence in your report.

## 5. Bake

Write `tools/meshes/configs/<name>.json` (keys in `docs/meshes.md`), then:

```sh
.venv/bin/python tools/meshes/bake.py tools/meshes/configs/<name>.json
```

Budgets (why: a scene must load inside an Anki card and on software GL):

- One baked file ≤ **400 KB** (~25,000 triangles); one scene's meshes together ≤ **800 KB**.
- Organ of interest 3,000-6,000 tris; supporting organ 1,000-2,500; tube 300-1,200; small part 200-600.
- Z-Anatomy organs are subdivision cages: `"subdivide": 1, "smooth": 6-10`, or they look faceted.
- Pin `"center"` explicitly (e.g. `[-2, 113, 4]`) whenever the scene hard-codes coordinates
  (centre lines, landmarks): a later re-bake with `"bbox"` would silently move them.
- Meshes from one source frame register when baked with the same `center`
  (`chest.json` reuses thorax's offset). Across sources, fit a similarity transform on
  shared landmarks and report the residuals (`heart` did this: < 1 cm).

## 6. Write the scene and meta

Two files plus one index entry. Exact contracts in `reference/kit-api.md`.

- `site/scenes/<id>.js`: an IIFE that calls `Kit.register({ id, meshes: ['<name>', ...],
  center, zoom, rot, controls, build })`. Keep `meshes:` a literal array of string literals
  (the Anki 3D packer finds it with a regex). `build(g, st)` returns `{ labels, info }`.
- `site/scenes/<id>.meta.json`: `id, title, topic, variantControl, variants[{key,label}],
  claims[], sources[], status: "unreviewed"`. It must pass `lib/validateMeta.mjs`. Variant keys
  and labels must equal the `opts` of the control named by `variantControl`. No `reviewed`
  status: only a human reviewer sets that.
- Append `<id>` to the end of `site/scenes/index.json`.
- `topic` becomes an Anki deck: reuse Cardiology, Gastroenterology, Obstetrics & Gynecology,
  Ophthalmology, Pulmonology, Surgery, Trauma where they fit (or e.g. Orthopedics, Neurology).

Frame and scale: mesh coordinates are **cm, +x patient's left, +y superior, +z anterior**. The
camera looks down -z, so the default view is anterior with the patient's left on screen right
(the atlas convention). Put baked parts in a group scaled to ~5 scene units across
(`S = 0.12` whole thorax, `0.3` heart, `0.36` liver region) and write a `P(x,y,z)` helper that
converts cm to scene units for labels and overlays.

Do not edit `site/kit/kit.js`, `site/app.js`, `site/viewer.html`, `tools/meshes/bake.py` or
other scenes. If the kit lacks something, implement it inside your scene file (other scenes
did: tapered tubes, editable clones, section caps, per-frame clip planes) and say so.

## 7. Labels and claims

- Every structure the finding depends on gets a label naming it as a textbook would
  ("Proximal pole of scaphoid", not "bone 2"). Each lesion variant adds a label for its finding.
- Anchor each label on a surface that is visible in that variant's view, in scene units
  (transform through the model group's matrix if you rotated it).
- About 8 to 14 labels; the layout engine must place them without overlap and inside the
  canvas at 1200 px and at 375 px (e2e checks both). Fewer, better labels beat a crowded card.
- `info` (HTML per variant) and `meta.claims` say the same facts; claims are short, exact,
  board-relevant, one fact each. Put real references in `sources` (title + URL).
- The "Unreviewed: verify against your textbook" badge stays; never claim a review.

## 8. Render the cards and LOOK at them

```sh
node -e "import('./tools/render_cards.mjs').then(m=>m.renderCards({siteDir:'site',outDir:'build/cards-<id>',ids:['<id>']}))"
```

This writes `build/cards-<id>/<id>__<variant>__front.png` (no labels) and `__back.png`
(labels), 800x600. Open every PNG with the image-reading tool. Also open two or three
reference cards (`build/cards/bil__cbd__back.png`, `heart__tof__back.png`, `eye__rd__front.png`;
run `npm run cards` first if `build/cards/` is empty). Judge with the rubric in
`reference/visual-qa.md`: compare against the atlas view you know (Netter/Gray's-style
anterior, lateral or sectional view), check sidedness, relations and proportions, and that the
front card alone shows the finding. Iterate (view angle, opacity, overlay size, labels) until it
passes. Expect several rounds; the existing scenes each took many.

## 9. Performance (software GL is the floor)

Cards and e2e render on SwiftShader. Each variant should be ready in a few seconds.

- Every distinct `MeshPhysicalMaterial` feature set compiles its own shader: wrap
  `Kit.tissue` so all materials share one program, e.g. `T(kind, o) = Kit.tissue(kind,
  Object.assign({ sheen: 0 }, o))` (see `bil.js`). Share material instances across parts.
- Large see-through shells cost per pixel: `side: THREE.FrontSide`, no sheen or clearcoat,
  `depthWrite: false`. Do not stack many full-screen transparent layers.
- Do not add per-frame work unless the variant animates; never mutate shared baked geometry
  (clone it, as `heart.js`'s `editable()` does). Every variant must render deterministically.

## 10. Test

```sh
npm test                       # meta, mesh format/size/credits, labels
npm run test:py                # bake, decks, ct_to_obj
npx playwright test -g <id>    # your scene at 1200 and 375 px: no console errors, non-blank, labels OK
npm run e2e                    # once in full before you finish
```

If port 4173 is taken (another worktree running e2e), copy `playwright.config.mjs` to
`build/pw.config.mjs` with another port and run `npx playwright test -c build/pw.config.mjs`;
do not commit the copy.

## Pre-ship checklist

- [ ] Concept, finding and claims written down; every claim exact and sourced, nothing guessed.
- [ ] Meshes sourced in priority order; anything procedural is named as such.
- [ ] No NC/ND/unclear parts; CREDITS section appended; `credit` heading matches.
- [ ] Each baked file ≤ 400 KB, scene total ≤ 800 KB; organs smoothed; `center` pinned if coordinates are hard-coded.
- [ ] Frame correct: patient's left is +x (screen right in anterior view), superior +y, anterior +z. Sidedness checked on the card.
- [ ] Meta passes validation; variant keys/labels equal the control's `opts`; id appended to `index.json`; `status: "unreviewed"`.
- [ ] Every variant's front card shows its finding without labels; back card labels name the structures, no overlap.
- [ ] Cards compared against the reference cards and atlas anatomy; honest verdict per variant written down.
- [ ] `npm test`, `npm run test:py`, e2e for the scene (and full e2e once) pass.
- [ ] Report lists sources, downloads, sizes, card paths, and every anatomical uncertainty.
