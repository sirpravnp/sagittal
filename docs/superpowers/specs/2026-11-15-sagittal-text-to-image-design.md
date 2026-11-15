# Sagittal: text-to-image medical generation (design)

Date: 2026-11-15. Status: draft for approval. Supersedes the "phase 1 premade library" framing of
`anatomy-visuals-design.md` (2026-11-14); the library built in phase 1 stays and is reused.

## Scope of this build (user, 2026-11-15; overrides the sections below where they conflict)

- **Surgery simulation is on hold.** This build does anatomical variants only. The scene format
  keeps room for steps (the `views` list) so surgery can be added later without a format change,
  but no surgery catalogue, step UI or surgery examples are built now.
- **GitHub publishing is on hold.** Nothing is pushed or published. Consequences:
  - There is no public host for the organs and player, so **this build targets Claude Code
    only**: the skill ships with (or points at) the local package, and figures are local HTML
    files. claude.ai support waits for a public host (GitHub + jsDelivr, or the MCP server);
    the claude.ai CDN spike moves to that later phase.
  - The package is still laid out so it can be served from a CDN unchanged later (relative
    paths, versioned folder).
  - The skill is written to be public and open source, but stays in this repo for now.
- **No variant catalogue.** Students create their own variants; we do not author or store
  variants. Every variant is built by Claude at request time from the base organs' landmarks
  and centre lines (the "landmarks" route below becomes the only route). What we ship and
  maintain is only the base anatomy: organ meshes, parts, landmarks, centre lines, and the fixed
  reference list. A student's figure lives only in their own files; nothing is saved by us.
- The three named variants (replaced right hepatic artery, low cystic duct insertion, aberrant
  right subclavian) stop being catalogue entries and become **test prompts**: the skill must
  build each correctly from landmarks alone. The landmark set is therefore designed to be rich
  enough to route common variants (named origins, branch points, and relations such as
  "posterior to portal vein").
- The info panel's provenance note becomes: which structures were changed from the base
  anatomy, and through which landmarks.

## Intent and why

Sagittal is a tool that lets users of LLMs generate accurate medical images from text, without
taking part in the generation themselves. A medical student types "replaced right hepatic artery
off the SMA" or "lap chole, clip the cystic duct" into their own Claude and gets back a correct,
labelled, interactive 3D figure.

Why: a general LLM asked for anatomy invents it. Asked for the hepatobiliary tree, Claude drew a
liver made of dots, a corkscrew cystic duct and a bent-tube duodenum
(`docs/assets/generic-llm-hepatobiliary.png`). A student memorises what they see, so a plausible
but wrong picture is worse than none. Sagittal's answer is to never let the model draw anatomy
from memory: it starts from real reconstructed anatomy (open CT segmentations and open atlases)
and only edits it in checked, constrained ways.

## Users

Medical students (Step 2 CK level first), using Claude on claude.ai (web, desktop, phone) or in
Claude Code. They install one public skill and then only talk.

## Goals

1. Text in, accurate interactive 3D figure out, in the student's own chat, on both claude.ai and
   Claude Code.
2. First focus: **manipulating anatomy**: anatomical variants (e.g. replaced hepatic artery,
   aberrant right subclavian, double IVC, low cystic duct insertion) and **surgery simulation**
   as steps (e.g. lap chole: expose Calot's triangle, critical view, clip and cut, remove).
3. Every figure has a **Save as image** button and an **Add to Anki** button (add to an existing
   deck or create a new one).
4. Figures look and behave like the existing library: anchor dots and leader lines on labels,
   a dropdown for variant/step, part toggles, info panel.
5. The skill is public and open source, published in the user's GitHub repo.
6. Zero per-request cost to the project: no API calls, no server needed for this phase.

## Non-goals

- MCP server in this phase. It stays the planned next layer and must be able to reuse the same
  base organs and scene format unchanged.
- Free-form interactive cutting with the mouse; surgery is a fixed sequence of steps.
- DICOM viewing, diagnosis, clinical decision support, photorealism.
- Flowcharts, algorithms, pathways.

## Anti-goals

- A figure with invented anatomy (a course, branch or relation that no source supports).
- A figure that looks like the generic-LLM screenshot: point clouds, toy primitives, labels
  floating off their structures.
- Requiring the student to edit code, run tools or fix the output.
- A per-use cost to the project.

## Constraints

- Rendering is three.js r149 as classic scripts (works in Anki and in the existing kit).
- claude.ai artifacts load scripts only from a short allowlist of CDNs; the exact current list
  must be confirmed by a spike (see Risks). Nothing else external loads there.
- Base organ files are 100-400 KB each; the model must never have to output mesh data.
- Licences: only CC0/PD, CC BY, CC BY-SA, MIT, Apache-2.0 (code). Never NC/ND. Open Anatomy
  atlases are under the "3D Slicer License section B" (brain atlas confirmed); each atlas's
  terms are checked before use, and an atlas with unclear terms is not used.
- The site and skill do not show an "unreviewed" disclaimer (user decision, below).

## Approaches considered

1. **Skill + public package loaded from a CDN (chosen for this phase).** Base organs, the kit and
   a scene "player" are published from the public GitHub repo; jsDelivr serves them. The skill
   teaches Claude to write a small HTML page containing only a scene description; the page
   loads the player. No server, no cost, works wherever the page can load the CDN.
2. **MCP server (chosen as the next phase).** The user prefers MCP as the long-term delivery:
   a hosted server (Fly.io, built like the user's CoroSim server) with tools such as
   `list_base_organs`, `get_organ`, `render_scene`, `export_anki`, rendering in chat as an MCP
   App. It costs hosting and was deferred earlier; it will reuse approach 1's package and scene
   format, so nothing built now is thrown away.
3. **Claude inlines the meshes into the artifact.** Dropped: too much data for the model to
   output reliably.

The user said "let's start on using the skill" for anatomy manipulation, so phase 2 is the skill
on approach 1, with approach 2 next.

## Design

### 1. Base organs

A set of prepared organ models, each a file in the existing `site/meshes/<name>.js` format plus
a **manifest** the model can read without loading geometry:

- parts (id, textbook name, tissue kind),
- named **landmarks** in cm in the sagittal frame (e.g. `cystic_duct_junction`,
  `coeliac_trunk_origin`, `sma_origin`),
- **centre lines** for tubular structures (ducts, vessels) as point lists, with their branch
  points,
- source and licence credit.

Sources in priority order: meshes already baked for the 16 library scenes; Z-Anatomy
(CC BY-SA); TotalSegmentator CT dataset (CC BY 4.0) via `tools/meshes/ct_to_obj.py`; Open
Anatomy atlases where the licence allows. Base organs are prepared by us, never by the student.
First set: whatever the first variant and surgery examples need (hepatobiliary with hepatic
arteries, aortic arch and branches, heart, abdominal veins).

### 2. Scene description (the contract)

A JSON document the model writes; the player validates it and refuses anything invalid with a
readable error. It holds:

- `organs`: which base organs, with per-part visibility, opacity, colour.
- `edits`: constrained operations on base anatomy, each expressed in landmarks or centre-line
  points rather than free coordinates:
  - reroute a vessel/duct (new origin landmark, path through named points),
  - add a branch (from a centre-line point, along a path), remove a branch,
  - duplicate or omit a structure (double IVC, absent gallbladder),
  - move an insertion point along a centre line (low cystic insertion),
  - cut a section (clip plane with capped surface).
- `overlays`: stones, clips, cut marks, retracted tissue, arrows, highlighted territories,
  placed on landmarks.
- `labels`: text plus the structure or landmark it points at.
- `views`: the dropdown entries. For a **variant**: "Normal" plus the variant, on the same base.
  For a **surgery**: one entry per step, each listing the edits/overlays/labels added at that
  step.
- `claims` and `sources`: the facts shown in the info panel, each short and with a reference.

### 3. The player and figure UI

A page served from the package that renders a scene description with the existing kit. It
keeps the library's UI philosophy: anchor dots and leader lines, occlusion-aware anchors, the
dropdown for views, part toggles, info panel with claims and sources. Plus:

- **Save as image**: PNG of the current view with its labels drawn in.
- **Add to Anki**: makes a card per view, front unlabelled, back labelled with the info text.
  Where Anki's AnkiConnect is reachable (Claude Code, local file) it offers a deck picker
  (existing or new) and adds the cards directly; where it is not (claude.ai artifact), it
  downloads an `.apkg` for the student to open, with the deck name they choose.

### 4. Output on each surface

- **claude.ai**: the skill writes an HTML artifact holding the scene description and script tags
  to the player on the CDN.
- **Claude Code**: the skill writes the same HTML to a local file and opens it.

### 5. The skill

`skills/sagittal/` in the public repo, installable on claude.ai (upload) and in Claude Code. It
teaches Claude to: read the organ manifests; map the request to base organs, edits and views;
use only landmarks and centre lines for placement; build variants against normal and surgery as
steps; list every claim with a source; and refuse or say "not available" when no base organ
covers the request, instead of drawing from memory. The current contributor skill
(`skills/sagittal-scene/`) stays for growing the library and the base organ set.

### 6. Site

- Redefine Sagittal on the page as text-to-image medical generation.
- Shorter, punchier headings.
- A comparison section: the generic-LLM hepatobiliary screenshot next to Sagittal's `bil`
  figure, as the example of what Sagittal does.
- A visual identity that moves away from Claude/Anthropic's look (the current serif, warm
  palette and muted red read as Anthropic). Anti-slop still applies: no gradient hero, no
  emoji, no stock "AI" styling.
- "Unreviewed" removed everywhere: badges on site, viewer, cards, decks, and the
  `validateMeta` rule that requires it.
- How to install the skill.

### 7. Accuracy without a disclaimer

The user decided to remove the "unreviewed" disclaimer everywhere. Accuracy then rests on:
real base anatomy; edits only through landmarks and centre lines; claims and sources shown on
every figure; the skill refusing what the base set does not cover; and a test set of variant and
surgery prompts whose figures are checked before each release.

## Decisions by the user (2026-11-15)

- Sagittal is text-to-image medical generation for LLM users, who do not take part in generation.
- Output is an interactive 3D figure with Save as image.
- Figure UI follows the library's (labels, leader lines, dropdown, toggles).
- Shorter, punchier headings; remove the unreviewed disclaimer everywhere.
- Add to Anki: existing deck or new cards.
- Site shows the generic-LLM vs Sagittal hepatobiliary comparison.
- Site identity separates from Claude/Anthropic's UI.
- Skill public, open source, on the user's GitHub.
- First: variants and surgery simulation through the skill; MCP is the preferred later delivery.

## Calls I made (please check)

- jsDelivr from the public GitHub repo as the base organ and player host for this phase.
- A declarative, validated scene description instead of model-written JavaScript, so wrong
  geometry cannot be invented and bad input cannot break the page.
- Edits expressed only through landmarks and centre lines.
- Surgery as fixed steps in the dropdown.
- Anki: AnkiConnect where reachable, `.apkg` download otherwise.
- The existing contributor skill and the 16-scene library stay.

## Variants: catalogue plus landmarks (user decision, 2026-11-15)

- **Catalogue**: variants and surgery steps written by us in advance, each with fixed paths
  (waypoints), edits and cited sources, stored with the organ manifests. Claude picks and
  composes from it.
- **Landmarks**: for a request the catalogue does not cover, Claude may build a new path
  through named landmarks and centre-line points of the base organs (e.g. "SMA origin ->
  posterior to portal vein -> right lobe"). It may not use free coordinates, and every claim
  still cites the fixed reference list.
- My call: the info panel says, as a plain fact, whether each edited structure comes from the
  catalogue or was routed from landmarks, so a student (and we, in testing) can tell which is
  which. This is provenance, not a disclaimer.
- Landmark-routed paths are the main accuracy risk; the prompt test set includes requests
  outside the catalogue so they are checked before each release.

**Finish line for this build** (superseded in part by "No variant catalogue" above: there is
no catalogue, all five are landmark-routed test prompts): replaced right hepatic artery off the
SMA; low cystic duct insertion; aberrant right subclavian artery; plus at least two further
variant requests, all built by the skill from landmarks and passing our check. All in Claude Code, from local files.
(Lap chole moves to the surgery phase.)

## Calls settled after the builder check (mine, please check)

- **Manifests ship inside the skill folder** (small JSON), so Claude can read them on claude.ai
  even if the skill cannot fetch from the CDN while writing. Geometry stays on the CDN for the
  page. A change to the organ set means a new skill release, tagged together with the package.
- **Sources come from a fixed reference list** in the package (`references.json`, curated by
  us). The scene description cites them by id and the player rejects unknown ids, so Claude
  cannot invent a citation.
- **Anki cards are images**: front PNG unlabelled, back PNG labelled plus the info text. No 3D
  cards from student figures (size and reliability); the library's opt-in 3D decks stay.
- **Release check**: every example figure is rendered and visually checked by us before a
  release; there is no clinician sign-off step in this phase. This covers the examples only,
  not every student request (accepted risk, see Risks).
- **The 16 library scenes stay as hand-written scenes.** The new player is a second rendering
  path on the same kit. The hepatobiliary base organ (and any other the examples need) is built
  as a manifest, reusing the meshes and centre lines `bil.js` already uses.

## Risks

- **claude.ai artifact CDN allowlist.** If jsDelivr and unpkg are both blocked inside artifacts,
  approach 1 does not work on claude.ai as designed. First task is a spike: load the kit and a
  base organ inside a real claude.ai artifact. Fallbacks, in order: publish to npm and load via
  an allowed CDN; or bring the MCP phase forward for claude.ai users.
- **No disclaimer.** Figures are not reviewed by a clinician; without the badge, an error is
  presented as fact. Mitigated only by the accuracy measures above.
- **`.apkg` in the browser** needs a SQLite build (sql.js) and a zip writer; size and licence
  to check.

## Left to the builder

- Exact JSON schema and validation messages for the scene description.
- Manifest format, landmark naming scheme, how centre lines are extracted for each base organ.
- Which base organs ship in the first set, within "what the first examples need".
- How Save as image composites DOM labels into the PNG.
- Repository and package layout for the CDN, versioning (tagged releases).
- Visual identity specifics for the site.
- Test plan: spec fuzzing, rendering of every example, e2e on the player, prompt test set.

## Open for the user

- The GitHub account and repository name to publish under (needed for CDN URLs; publishing
  is confirmed with the user before it happens).
