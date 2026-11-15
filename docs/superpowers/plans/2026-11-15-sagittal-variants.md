# Sagittal text-to-image: anatomical variants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student asks Claude Code for an anatomical variant in plain words and gets a correct, labelled, interactive 3D figure (local HTML) with Save as image and Add to Anki, built only from base organs, landmarks and centre lines.

**Architecture:** Base organs (`organs/`, built by the organ-library branch) carry meshes, parts, landmarks and centre lines. Claude writes a declarative **scene spec** (JSON); `player/spec.js` validates it, `player/player.js` renders it with the existing kit as a synthetic `Kit.register` scene, and `player/make-figure.mjs` writes one self-contained HTML file. A student-facing skill (`skills/sagittal/`) drives it. The site is redefined as text-to-image and restyled.

**Tech Stack:** three.js r149 classic scripts, existing `site/kit/kit.js` + `labels.js`, Node 20 (node:test, Playwright with installed Chrome + swiftshader), Python venv (genanki), AnkiConnect.

**Spec:** `docs/superpowers/specs/2026-11-15-sagittal-text-to-image-design.md` (its "Scope of this build" section overrides the rest of it).

## Global Constraints

- Scope: anatomical variants only. No surgery steps, no GitHub push/publish, no MCP, no claude.ai artifact work.
- Target: Claude Code only; figures are local HTML files opened from `file://`. A figure must work offline: no `fetch`, no ES modules, no network, everything inlined.
- Rendering: three.js r149 classic (`site/vendor/three.min.js`), the existing kit; do not change kit behaviour the 16 library scenes depend on (their e2e must still pass).
- No variant catalogue: every variant is built at request time from landmarks and centre lines. Placement only through landmark ids, centre-line points, or a landmark plus a bounded anatomical offset (direction in {anterior, posterior, left, right, superior, inferior}, 0 < cm ≤ 3). No free coordinates anywhere in a spec.
- Citations: claims cite ids from the fixed list `organs/references.json`; unknown ids are a validation error.
- Provenance: the info panel lists every structure changed from base anatomy and the landmarks its path runs through.
- No "Unreviewed" text, badge or status anywhere (site, viewer, figures, cards, decks, validators, tests, docs).
- Figure UI follows the library: labels with anchor dots and leader lines (occlusion-aware), a dropdown for the view (Normal / the variant), per-organ toggles, info panel.
- Anki cards from figures are images: front PNG unlabelled, back PNG labelled + info text.
- Licences: CC0/PD, CC BY, CC BY-SA, MIT, Apache-2.0 only; credits shown in every figure from `site/meshes/credits.json`/CREDITS.
- Mesh budgets: one baked file ≤ 400 KB; a figure's meshes ≤ 1.5 MB inlined.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A malformed or hostile spec (unknown organ/landmark/reference id, offset > 3 cm, free `[x,y,z]` where a landmark is required, unknown op, 200 labels): the validator returns readable errors listing each problem; `make-figure` exits non-zero and writes nothing; the page never half-renders.
2. A rerouted vessel's label anchor ends up hidden behind an organ after the edit: the label uses `on:` the new tube so the kit places it on the visible surface; e2e asserts no unintended `occluded` leaders in both views.
3. Figure opened from `file://` with no network and no server: renders, labels lay out at 1200 and 375 px, Save as image downloads a PNG with labels drawn in.
4. Anki not running / AnkiConnect not installed / CORS refused: the button says so in one line and offers the PNG downloads; the CLI exits with a clear message, no stack trace.
5. Removing a structure that other structures branch from (e.g. remove common hepatic artery while the GDA hangs off it): validator rejects with "X branches from Y; reroute or remove X too".

---

### Task 0: Integrate the organ library (controller task)

Wait for the `organ-library` branch. Review its report (`../sagittal-assets-cache/reports/organ-library.md`) and PNGs, then merge `organ-library` into `phase1-library`. Confirm `organs/index.json`, `organs/manifests/*.json` (schema `sagittal-organ/0`), `organs/meshes/*.js`, and `tests/organs.test.mjs` pass. Record gaps in the ledger; the test-prompt organs (hepatic arteries, coeliac trunk, SMA, portal vein, biliary tree with cystic duct, aortic arch with both subclavians) must exist or Task 8's prompts change.

### Task 1: Remove "unreviewed" everywhere

**Files:** Modify `lib/validateMeta.mjs`, `tests/validateMeta.test.mjs`, `site/kit/kit.js` (drop `BADGE_TEXT`), `site/app.js`, `site/style.css` (`.badge`), `site/index.html`, all `site/scenes/*.meta.json` (drop `status`), `tools/build_decks.py` (`status_text` and its uses), `tests/python/test_build_decks.py`, `tests/e2e/viewer.spec.mjs`, `tests/e2e/index.spec.mjs`, `skills/sagittal-scene/SKILL.md`, `skills/sagittal-scene/reference/kit-api.md`, `README.md`.

- [ ] Tests first: `validateMeta` accepts a meta with no `status`, and rejects a meta whose `status` is present (any value) with `"status is no longer used"`; deck test asserts no card field contains `nreviewed`; e2e viewer and index assert `body` text does not contain `nreviewed`.
- [ ] Run `npm test`, `npm run test:py` → the new assertions FAIL.
- [ ] Remove the badge, status field and text everywhere listed; `grep -rni nreviewed site lib tools tests skills README.md` returns nothing.
- [ ] `npm test`, `npm run test:py`, `npm run e2e` → PASS. Re-run `npm run cards` and `npm run thumbs` so committed thumbs carry no badge.
- [ ] Commit `chore: remove the unreviewed badge and status`.

### Task 2: Runtime organ bundle and reference list

**Files:** Create `tools/build_organs.mjs`, `organs/references.json`, `organs/organs.js` (generated, committed), `tests/organs_bundle.test.mjs`. Modify `package.json` (`"organs": "node tools/build_organs.mjs"`).

**Interfaces:**
- Produces `window.SagittalOrgans = { index: [...], manifests: { <id>: <manifest> }, references: { <refId>: {title, url} } }` in `organs/organs.js` (classic script; no fetch needed at runtime).
- `organs/references.json`: `{ "<refId>": { "title": "...", "url": "https://..." } }`; ids `[a-z0-9-]+`. Seed with the sources already cited in `site/scenes/*.meta.json` for hepatobiliary, aortic arch and vascular anatomy plus StatPearls pages for: hepatic artery variants (Michels), aberrant right subclavian artery, cystic duct anatomy and variants, coeliac trunk variants. Every entry must be a real page the implementer opened.

- [ ] Test: `build_organs.mjs` output, loaded with `tests/helpers/loadClassic.mjs`, has every id of `organs/index.json`; every manifest's landmarks/centre lines round-trip unchanged; every reference has a title and an `https://` url; `npm run organs` is idempotent (running twice gives identical bytes).
- [ ] Implement; run `npm test` → PASS. Commit.

### Task 3: Scene spec and validator

**Files:** Create `player/spec.js` (classic script, also `module.exports` when present so Node can require it via `loadClassic`), `docs/spec.md` (the format, written for the skill), `tests/spec.test.mjs`.

**Interfaces:**
- `SagittalSpec.validate(spec, organs) -> { ok, errors: string[], resolved }` where `organs` is `window.SagittalOrgans`. `resolved` is the spec with every waypoint turned into cm coordinates in the body frame plus `provenance: [{ structure, op, via: [landmarkIds] }]`.
- Spec shape (schema `sagittal-figure/1`):
  ```json
  {"schema":"sagittal-figure/1","title":"Replaced right hepatic artery","topic":"Hepatobiliary",
   "organs":[{"id":"liver","parts":{"*":{"opacity":0.35}}},{"id":"coeliac"}],
   "variant":{"label":"Replaced RHA from SMA","edits":[
     {"op":"remove","structure":"coeliac/right_hepatic_artery"},
     {"op":"route","id":"rrha","name":"Replaced right hepatic artery","tissue":"vessel-artery",
      "radius_cm":0.25,"from":{"on":"sma/sma","t":0.12},
      "via":[{"landmark":"portal/portal_vein_bifurcation","offset":{"dir":"posterior","cm":1.0}}],
      "to":{"landmark":"liver/right_lobe_hilum"}}]},
   "labels":[{"text":"Replaced right hepatic artery","on":"rrha","views":["variant"]}],
   "claims":[{"text":"...","refs":["hepatic-artery-variants"]}],
   "view":{"rot":[0.2,-0.4],"zoom":8}}
  ```
  Views are always `normal` (base anatomy) and `variant`. Ops: `remove`, `route` (new tube from a waypoint through `via` to a waypoint), `branch` (`route` whose `from` is a centre-line point of an existing structure), `move_insertion` (move where one centre line joins another to a new `t` along the target), `duplicate` (copy a structure's centre line to a mirrored or offset path given by waypoints). Waypoints: `{landmark}`, `{on: "organ/centreline", t: 0..1}`, either with optional `offset {dir, cm}`.
- [ ] Tests (each from Review Focus 1 and 5 plus happy paths): the example above validates against a fixture manifest set; each invalid case returns the exact error string chosen for it (unknown organ, unknown landmark, unknown centre line, `t` outside 0..1, offset > 3 cm, bad dir, raw `[x,y,z]` anywhere, unknown op, unknown ref id, claim without refs, > 20 labels, remove of a structure others branch from); `resolved.provenance` lists `rrha` via `portal/portal_vein_bifurcation, liver/right_lobe_hilum`.
- [ ] Implement; `npm test` → PASS. Commit.

### Task 4: Player rendering

**Files:** Create `player/player.js`, `player/dev.html` (loads organs from `organs/meshes/` for development), `tests/e2e/player.spec.mjs`, fixture specs `tests/fixtures/figures/*.json` (the three test variants).

**Interfaces:**
- Consumes `SagittalSpec.validate`, `window.SagittalOrgans`, Kit.
- `SagittalPlayer.register(resolvedSpec)` calls `Kit.register({ id: 'figure', meshes: [...organ mesh ids], controls: [{k:'v', label:'View', def:'variant', opts:[['normal','Normal anatomy'],['variant', spec.variant.label]]}, ...one chk per organ], build })`. `build` adds organ parts with `Kit.meshPart`, draws centre-line structures and routed paths as tapered tubes (copy `bil.js` `duct()`), hides removed structures in `variant`, and returns labels with `on:` the tube/mesh, info HTML (claims with linked references, provenance list, credits).
- [ ] e2e: each fixture renders with no console errors, `nonBlank`, labels inside the canvas at 1200 and 375 px, no `occluded` leaders unless `behind`; switching the dropdown to `normal` shows the base structure and hides the routed one; the info panel lists provenance.
- [ ] Implement; open the three fixture figures, render PNGs, and compare against atlas anatomy (Michels type for RHA, ARSA retro-oesophageal course, low cystic insertion on the CBD); iterate until correct. Commit with the PNG paths and verdicts in the report.

### Task 5: Figure UI, Save as image

**Files:** Create `player/figure.css`, `player/ui.js`. Modify `player/player.js` only to call into `ui.js`. Extend `tests/e2e/player.spec.mjs`.

- [ ] UI: title, view dropdown, organ toggles, labels toggle, info panel (claims, references, "Changed from base anatomy" provenance list, credits). Same leader-line labels as the library. Styles use the site's new tokens from Task 9 (define them in `figure.css`; Task 9 copies the same values).
- [ ] **Save as image**: composites the WebGL canvas and the label layer (dots, leaders, chips drawn with 2D canvas from `viewer.debug().leaders`/`labelRects`) into a PNG; filename `<slug>-<view>.png`. `window.figure.snapshot({labels: bool}) -> Promise<dataURL>` is exposed for Task 7.
- [ ] e2e: Save as image triggers a download whose PNG decodes, is not blank, and (labels on) differs from labels off.
- [ ] Commit.

### Task 6: `make-figure` — one self-contained HTML

**Files:** Create `player/make-figure.mjs`, `tests/make_figure.test.mjs`. Modify `package.json` (`"figure": "node player/make-figure.mjs"`).

**Interfaces:** `node player/make-figure.mjs <spec.json> [--out <file.html>] [--open]` → validates with `SagittalSpec` (exit 1, errors on stderr, no file written when invalid); writes one HTML inlining three.min.js, labels.js, kit.js, organs.js (only the needed manifests), the needed `organs/meshes/*.js`, player/ui/spec scripts, figure.css, and the spec as `<script type="application/json" id="spec">`. Default out: `./sagittal-figures/<slug>.html`. `--open` opens it in the default browser.
- [ ] Tests: invalid spec → exit 1 and no file; valid fixture → file exists, contains no `src="http`, no `fetch(`, size ≤ 3 MB; e2e opens the written file via `file://` with network blocked and gets a non-blank render (Review Focus 3).
- [ ] Commit.

### Task 7: Add to Anki

**Files:** Create `player/anki.mjs` (CLI), modify `player/ui.js` (button), create `tests/anki.test.mjs`.

**Interfaces:**
- Button **Add to Anki**: calls AnkiConnect `http://127.0.0.1:8765` (`version`, `deckNames`); shows a deck picker (existing decks + "New deck…"); adds one note per view with front/back images from `figure.snapshot()` via `storeMediaFile` + `addNote` (Basic model; back = labelled image + info text). If AnkiConnect is unreachable or refuses the `null` origin, the button shows one line: "Anki isn't reachable from this page. Ask Claude: 'add this figure to Anki'", and offers both PNGs for download.
- CLI (what the skill uses): `node player/anki.mjs <figure.html> --deck "<name>" [--new]` renders both views headless (Playwright, installed Chrome), takes front/back snapshots, and adds them through AnkiConnect from Node (no CORS). Without AnkiConnect, `--apkg <out>` writes a deck with the venv's genanki (small Python helper in `tools/figure_apkg.py`).
- [ ] Tests: CLI against a stub AnkiConnect server (node http) adds 2 notes with 4 media files to the named deck, creating it when `--new`; unreachable server → exit 2 with the one-line message (Review Focus 4); `--apkg` writes a file genanki can read back with 2 notes.
- [ ] Commit.

### Task 8: The student skill and its test prompts

**Files:** Create `skills/sagittal/SKILL.md`, `skills/sagittal/reference/spec.md` (copy of `docs/spec.md`), `skills/sagittal/reference/organs.md` (generated table of organs, parts, landmarks, centre lines from `organs/` by `tools/build_organs.mjs`), `skills/sagittal/evals/prompts.md`, `skills/sagittal/evals/results.md`.

- [ ] SKILL.md (student-facing, under ~200 lines): when to use; read `reference/organs.md`; map the request to organs, edits, labels, claims; placement only via landmarks/centre lines/bounded offsets; cite only `references.json` ids; if the anatomy needed is not in the base organs, say so and stop; write the spec, run `npm run figure -- <spec> --open`, fix validator errors, then look at the rendered views and correct the anatomy before showing the student; Anki via `node player/anki.mjs`. Install: `ln -s "$PWD/skills/sagittal" ~/.claude/skills/sagittal` from a clone.
- [ ] `evals/prompts.md`: replaced right hepatic artery off the SMA; low cystic duct insertion; aberrant right subclavian artery; plus two more chosen from what the base organs support (e.g. accessory left hepatic artery from the left gastric; common hepatic artery from the SMA).
- [ ] Run each prompt with a fresh subagent that has only the skill (not this plan); collect the figures, render both views, judge each against atlas anatomy; record verdicts in `results.md`. Fix the skill (or landmark set, via the controller) until all five pass.
- [ ] Commit.

### Task 9: Site redefinition and new identity

**Files:** Modify `site/index.html`, `site/style.css`, `site/app.js` (only what the layout needs), `tests/e2e/index.spec.mjs`; add `site/compare/generic-llm.png` (from `docs/assets/generic-llm-hepatobiliary.png`) and `site/compare/sagittal-bil.png` (from `build/cards/bil__norm__back.png`).

- [ ] Copy: Sagittal = text-to-image medical generation for LLM users. Headings short and punchy (≤ 4 words each). Sections: hero (name + one line), comparison (generic LLM vs Sagittal, same prompt "the hepatobiliary tree", short captions naming the errors on the left), how it works (3 short steps), install the skill, plates (the 16 library figures), Anki decks, credits.
- [ ] Identity distinct from Claude/Anthropic: no warm cream, no terracotta/muted-red accent, no Anthropic-style serif. Use a cool clinical palette (graphite/near-white with one ink-blue or cyan accent, AA contrast in light and dark) and a grotesk + mono pairing (e.g. IBM Plex Sans + IBM Plex Mono from Google Fonts). Anti-slop: no gradient hero, no emoji, no glassmorphism, no stock "AI" sparkle iconography, no three-feature-card row.
- [ ] e2e: comparison section shows both images with alt text; every heading ≤ 4 words; no `nreviewed`; layout has no horizontal scroll at 375 px.
- [ ] Re-render thumbs if plate styling changed. Commit.

### Task 10: Docs

**Files:** Modify `README.md`, `docs/meshes.md`, `skills/sagittal-scene/SKILL.md` (point to `organs/` and the new player as the second rendering path).

- [ ] README: what Sagittal is (text-to-image), install the skill in Claude Code, make a figure, Anki, licences, contributor skill. No GitHub URLs yet (publishing on hold).
- [ ] `npm test`, `npm run test:py`, `npm run e2e` → PASS. Commit.
