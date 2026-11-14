# Anatomy Library, Phase 1 (Premade Library) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an open-source static website of nine reviewed-pending ("unreviewed") interactive anatomy visuals, plus downloadable Anki decks built from them.

**Architecture:** A small classic-script three.js kit (`Kit`) renders scenes. Each scene is a JS file that registers itself plus a JSON metadata file. A static site lists and views them. A Node tool renders card images; a Python tool packs them into `.apkg` decks. No server, no model calls.

**Tech Stack:** three.js r149 (classic `three.min.js`, vendored), vanilla JS, Node 20 (`node:test`, Playwright for browser tests), Python 3 + `genanki` + pytest, GitHub Pages.

**Spec:** `anatomy-visuals-design.md` (see "Approved scope"). Prototype to port: `anatomy3d.html`.

## Global Constraints

- three.js is **r149 loaded as a classic script**, vendored at `site/vendor/three.min.js` (Anki cards cannot use ES modules).
- No API or model calls anywhere in the shipped product; no per-request cost.
- Every visual shows the badge text `Unreviewed: verify against your textbook` while `status` is `"unreviewed"`.
- Content is anatomy only: no flowcharts, algorithms or pathways.
- Anki default card is a **static image** (works on every platform); 3D card is opt-in and labeled experimental.
- Licenses: code MIT, content (scene text and meta) CC BY-SA 4.0.
- **Deviation from the design (my call):** phase 1 scenes are kit-based JS modules with JSON metadata, not declarative JSON specs. The declarative spec and validator are deferred with the MCP phase.

## Review Focus

- WebGL unavailable or fails to initialise: page shows a clear fallback message, not a blank canvas. (Task 4)
- Unknown or missing scene id in the URL: gallery with a "scene not found" notice, not a crash. (Task 4)
- Narrow phone width: labels stay inside the canvas and do not overlap each other. (Tasks 3, 5, 6)
- Touch input: one-finger drag rotates and the page does not scroll while dragging the canvas. (Task 4)
- Anki deck text containing `≥ → <` and `&`: renders correctly and does not break the HTML; media names never collide across decks. (Task 8)
- A scene marked `reviewed` with no reviewer named: rejected by validation. (Task 2)

---

### Task 1: Repository scaffold and licensing

**Files:**
- Create: `package.json`, `.gitignore`, `LICENSE` (MIT), `LICENSE-CONTENT.md` (CC BY-SA 4.0 notice), `README.md`, `tests/smoke.test.mjs`
- Create: `site/vendor/three.min.js` (copy of three@0.149.0 `build/three.min.js`)

**Interfaces:**
- Produces: `npm test` runs `node --test tests/`.

- [ ] **Step 1:** `git init`; write `tests/smoke.test.mjs` asserting `fs.existsSync('site/vendor/three.min.js')` and that its first 2000 bytes contain `REVISION="149"` or `REVISION = "149"`-style text (assert `THREE.REVISION` string `149` appears).
- [ ] **Step 2:** Run `npm test`. Expected: FAIL (file missing).
- [ ] **Step 3:** Download three@0.149.0 `build/three.min.js` from jsDelivr into `site/vendor/`; add package.json (`"type":"module"`, `"scripts":{"test":"node --test tests/"}`), licenses, README stating the unreviewed status and open-source licenses.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `chore: scaffold project and licenses`.

### Task 2: Scene metadata validator

**Files:**
- Create: `lib/validateMeta.mjs`, `tests/validateMeta.test.mjs`

**Interfaces:**
- Produces: `validateMeta(meta: object): { ok: boolean, errors: string[] }`.
- Meta shape: `{ id: string, title: string, topic: string, variantControl: string, variants: {key:string,label:string}[], claims: string[], sources: string[], status: "unreviewed"|"reviewed", reviewer?: string, reviewedOn?: string }`.

- [ ] **Step 1:** Tests: valid meta → `ok:true`; missing `claims` or empty `claims` → error mentioning `claims`; `status:"reviewed"` without `reviewer` → error mentioning `reviewer`; `status:"bogus"` → error; `id` with spaces or uppercase → error (ids are `[a-z0-9-]+`).
- [ ] **Step 2:** Run `node --test tests/validateMeta.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `validateMeta` in `lib/validateMeta.mjs` with plain checks, collecting every error.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat: scene metadata validator`.

### Task 3: Label layout (collision avoidance)

**Files:**
- Create: `site/kit/labels.js` (classic script; exports via `window.KitLabels` and `module.exports` when defined), `tests/labels.test.mjs`

**Interfaces:**
- Produces: `layoutLabels(anchors: {x:number,y:number,w:number,h:number}[], bounds: {w:number,h:number}): {x:number,y:number}[]` — returns one position per anchor (top-left corner), same order; no two returned rectangles overlap and all stay inside `bounds` when the total area allows; positions stay as close to the anchor as possible.

- [ ] **Step 1:** Tests: two anchors at the same point → returned rects do not intersect; an anchor beyond the right edge → returned rect is inside bounds; one isolated anchor is returned unchanged; 30 anchors in a 300×500 box → no overlaps (assert pairwise).
- [ ] **Step 2:** Run `node --test tests/labels.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement greedy placement: sort by `y`; for each rect, try the anchor, then nudge vertically in ±`h+2` steps, then clamp to bounds.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat: label collision layout`.

### Task 4: Kit, viewer page, gallery, first scene (heart)

**Files:**
- Create: `site/kit/kit.js`, `site/viewer.html`, `site/index.html`, `site/style.css`, `site/scenes/heart.js`, `site/scenes/heart.meta.json`, `site/scenes/index.json` (array of scene ids), `tests/e2e/viewer.test.mjs`
- Port from: `anatomy3d.html` (helpers `mat, add, ell, seg, tube, arrow, ring, sector, disk, dot`; the `heart` scene; the orbit, zoom and label code)

**Interfaces:**
- Consumes: `KitLabels.layoutLabels` (Task 3), `validateMeta` meta shape (Task 2).
- Produces: `Kit.register(def: SceneDef): void` where `SceneDef = { id: string, center: [number,number,number], zoom: number, rot: [number,number], controls: Control[], build(g: THREE.Group, st: Record<string,any>): { labels: {t:string,p:[number,number,number]}[], info: string, update?(t:number): void } }` and `Control = { k:string, label:string, def:any, type?:'chk', opts?: [string,string][] }`.
- Produces: `Kit.createViewer(opts: { canvas: HTMLCanvasElement, labelsEl: HTMLElement }): { open(id: string, state?: Record<string,any>): boolean, setLabelsVisible(b: boolean): void, debug(): { labelRects: {x:number,y:number,w:number,h:number}[], nonBlank: boolean } }`. `open` returns `false` for an unknown id.
- `viewer.html?scene=<id>` shows the scene, its controls, info, the claims list from the meta file, the badge text from Global Constraints, and a "labels" toggle. `index.html` lists scenes from `scenes/index.json` with title and badge.

- [ ] **Step 1:** Write `tests/e2e/viewer.test.mjs` (Playwright, serving `site/` with a tiny static server): heart scene loads with zero console errors; `debug().nonBlank === true`; page text contains `Unreviewed: verify against your textbook` and at least one meta claim; `?scene=nope` shows `index.html`-style gallery with text `Scene not found`; with WebGL forced off (launch arg `--disable-gpu --disable-webgl`) the page shows text `3D is not available` and no uncaught error; at 375px width all `labelRects` lie inside the canvas and do not overlap; a touch drag (dispatch pointer events) changes the rotation and the document `scrollY` stays 0.
- [ ] **Step 2:** Run `npx playwright test tests/e2e/viewer.test.mjs` (or the equivalent runner configured in `package.json`). Expected: FAIL.
- [ ] **Step 3:** Implement `kit.js` (port helpers; call `layoutLabels` every frame on projected anchors; set `touch-action:none` on the canvas; wrap renderer creation in try/catch to show the fallback message), `viewer.html`, `index.html`, and port the `heart` scene plus its meta (claims drawn from the existing info text; `variantControl: "d"`; status `unreviewed`).
- [ ] **Step 4:** Run the e2e test. Expected: PASS.
- [ ] **Step 5:** Commit `feat: kit, viewer, gallery and heart scene`.

### Task 5: Port thoracic scenes (aorta, flail, tension, aspiration)

**Files:**
- Create: `site/scenes/{aorta,flail,tension,asp}.js`, `site/scenes/{aorta,flail,tension,asp}.meta.json`; Modify: `site/scenes/index.json`, `tests/e2e/scenes.test.mjs`
- Port from `anatomy3d.html`.

**Interfaces:**
- Consumes: `Kit.register`, `SceneDef` (Task 4); meta shape (Task 2).

- [ ] **Step 1:** `tests/e2e/scenes.test.mjs`: for every id in `scenes/index.json` and every `variants[].key`, open `viewer.html?scene=<id>&<variantControl>=<key>`; assert zero console errors, `nonBlank`, and non-overlapping in-bounds labels at 1200px and 375px width. Also assert `validateMeta` is `ok` for each meta file.
- [ ] **Step 2:** Run it. Expected: FAIL for the four new ids.
- [ ] **Step 3:** Port the four scenes and write their meta files (variants from each scene's main select). Fix known prototype defects while porting: flail sternum narrower and tinted like bone; flail breathing phase also sets a visible "paradoxical" label state; tension trachea drawn as one tube with a carina fork at its end; aorta labels attached to the right structures. Keep the "confirm against your resource" caveat on the aspiration right-lateral-decubitus variant in its claims.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat: thoracic scenes`.

### Task 6: Port abdomen, pelvis and eye scenes (inguinal, biliary, fibroids, eye)

**Files:**
- Create: `site/scenes/{ing,bil,fib,eye}.js`, `site/scenes/{ing,bil,fib,eye}.meta.json`; Modify: `site/scenes/index.json`
- Port from `anatomy3d.html`.

**Interfaces:**
- Consumes: as in Task 5; the same `tests/e2e/scenes.test.mjs` covers these.

- [ ] **Step 1:** Run `tests/e2e/scenes.test.mjs` with the four new ids listed in `index.json` but no files. Expected: FAIL.
- [ ] **Step 2:** Port the four scenes and metas. Fix known prototype defects: fibroid labels no longer overlap and FIGO 0 is visible (move it clear of the FIGO 1 sphere); eye labels anchored in world coordinates to the structures they name; eye ciliary-body and iris rings no longer clutter the angle (thinner tubes); inguinal scene gets a side-view preset (`rot`) that shows the layers.
- [ ] **Step 3:** Run the test. Expected: PASS.
- [ ] **Step 4:** Commit `feat: abdomen, pelvis and eye scenes`.

### Task 7: Card image renderer

**Files:**
- Create: `tools/render_cards.mjs`, `tests/e2e/render_cards.test.mjs`

**Interfaces:**
- Consumes: viewer URL scheme and `Viewer.setLabelsVisible` (Task 4); meta `variantControl` and `variants` (Task 2).
- Produces: `renderCards(opts: { siteDir: string, outDir: string }): Promise<{ id: string, variant: string, front: string, back: string }[]>` — writes `<outDir>/<id>__<variant>__front.png` (labels hidden) and `..__back.png` (labels shown), 800×600, and returns the file names.

- [ ] **Step 1:** Test: run on a temp dir with the heart scene only; assert 6 variants × 2 files exist, each PNG is 800×600 and the front differs from the back byte-wise.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement with Playwright: for each scene and variant open the viewer with `?scene=&<control>=&embed=1` (embed hides the side panel), screenshot canvas, toggle labels, screenshot again.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit `feat: card image renderer`.

### Task 8: Anki deck builder (2D default)

**Files:**
- Create: `tools/build_decks.py`, `tools/requirements.txt` (`genanki`), `tests/python/test_build_decks.py`

**Interfaces:**
- Consumes: `renderCards` output file names (Task 7); meta files (Task 2).
- Produces: `build_deck(topic: str, scenes: list[dict], cards_dir: pathlib.Path, out: pathlib.Path) -> None` writes one `.apkg`. Note type `Anatomy Visual` with fields `Title, Front, Back, Claims, Status`; one note per scene variant. Media file names are `<id>__<variant>__{front,back}.png`. Note and deck ids are derived deterministically from `topic` and the scene id (hash), so re-importing updates instead of duplicating.

- [ ] **Step 1:** Tests: build from a fixture with two scenes; open the `.apkg` (zip + sqlite) and assert the note count equals total variants, media names present and unique, and `Claims` containing `≥ → < &` round-trips (HTML-escaped where needed); building twice yields identical note guids; `Status` field holds `Unreviewed: verify against your textbook`.
- [ ] **Step 2:** Run `pytest tests/python`. Expected: FAIL.
- [ ] **Step 3:** Implement with `genanki`, HTML-escape claims, one deck per topic; add a CLI `python tools/build_decks.py --site site --cards build/cards --out build/decks`.
- [ ] **Step 4:** Run `pytest tests/python`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: anki deck builder`.

### Task 9: Opt-in 3D Anki note type (experimental)

**Files:**
- Modify: `tools/build_decks.py`, `tests/python/test_build_decks.py`
- Create: `tools/anki3d_template.html`

**Interfaces:**
- Consumes: `build_deck` (Task 8). Produces: `build_deck(..., include_3d: bool = False)`; when true, adds note type `Anatomy 3D (experimental)` with the scene id in a field, and packs `_three.min.js`, `_kit.js` and `_scene_<id>.js` as media (underscore prefix so Anki does not remove them). The template loads `_three.min.js` then `_kit.js` then the scene script, shows a status line, and falls back to the Front image when WebGL fails.

- [ ] **Step 1:** Tests: with `include_3d=True` the apkg media list contains the three `_` files for each scene exactly once; with `False` it contains none; the template text contains the fallback `<img>` and no `import`/`type="module"`.
- [ ] **Step 2:** Run `pytest tests/python`. Expected: FAIL.
- [ ] **Step 3:** Implement; reuse the working spike template (script loaded with `onload`, `isConnected` check, status line).
- [ ] **Step 4:** Run `pytest tests/python`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: experimental 3D anki card type`.

### Task 10: Publish and contribution docs

**Files:**
- Create: `.github/workflows/pages.yml`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/medical-correction.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all prior tasks. Produces: on push to `main`, tests run, `site/` deploys to GitHub Pages, and `build/decks/*.apkg` attach to a Release.

- [ ] **Step 1:** Write the workflow: install Node and Python, run `npm test` and `pytest`, run Playwright, run `render_cards` and `build_decks`, deploy `site/`, upload decks.
- [ ] **Step 2:** `CONTRIBUTING.md`: how to add a scene (file layout, meta fields, how to run tests), how a reviewer marks a scene `reviewed` (set `reviewer` and `reviewedOn`), and that the unreviewed badge stays until then. Issue template for medical corrections asks for the scene id, the claim, and a source.
- [ ] **Step 3:** Update README with the live-site link placeholder, deck download instructions, and the Anki 3D compatibility note (desktop confirmed by the spike; phone/tablet unverified).
- [ ] **Step 4:** Run the whole pipeline locally (`npm test && pytest tests/python && npx playwright test`). Expected: all PASS.
- [ ] **Step 5:** Commit `chore: publish workflow and docs`.

---

## Self-review

- **Spec coverage:** premade library (Tasks 4–6), unreviewed badge and claims (4), Anki 2D default (7–8), 3D opt-in (9), open source and licenses (1, 10), kit shared across scenes (4), reviewer process documented (10). MCP/skill deferred per the approved scope.
- **Types:** `SceneDef`, `Control`, meta shape, `layoutLabels`, `renderCards` and `build_deck` signatures are defined once and reused with the same names.
- **Proportion:** the plan describes interfaces and tests and leaves bodies to the implementer; the prototype supplies the scene code to port.
