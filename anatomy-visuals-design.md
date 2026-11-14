# Anatomy Visuals for Medical Students: Design

Date: 2026-11-14. Status: draft for approval.

## Intent and why

Medical students studying anatomy-dependent concepts (Step 2 CK and similar) need to see the structure, not just read about it: which layer a fibroid sits in, how blood moves through a VSD, where aspirate lands in a supine patient. Existing options are either fixed atlases (cannot answer "show me exactly this") or heavy imaging viewers (DICOM, not teaching diagrams).

This project gives any student two ways to get an interactive, optionally labeled 2D or 3D visual of an anatomical concept: a curated premade library, and, for students with an MCP-capable AI client, a visual generated from their own description. Both can be pushed into Anki as study cards.

## Users

Any medical student, publicly. First target: Step 2 CK preparation. No account or payment from the student for the premade tier; the generated tier uses the student's own AI subscription.

## Goals

- A student describes a concept in plain words and gets a correct, interactive, labeled visual.
- A premade, reviewed library of high-yield visuals that works with no AI at all.
- Visuals that can become Anki cards, working across desktop and mobile.
- Zero per-request model cost to the project (no API calls from our side).
- One shared set of building blocks (the "kit") so premade and generated visuals look and behave the same.

## Non-goals

- Not a DICOM / medical-imaging viewer (Cornerstone3D and NiiVue already do that).
- Not a flowchart, algorithm or pathway tool. 3D and 2D visuals here depict anatomy and structural concepts only.
- Not a diagnostic or clinical decision tool. Educational only.
- Not photorealistic or surgically precise models.

## Anti-goals (would be failures even if technically working)

- A confident but anatomically wrong visual. Plausible-but-wrong is worse than nothing for a board-prep student.
- Anki cards that break on a student's phone.
- A tool that quietly requires the project owner to pay per use.
- A premade library of unreviewed content presented as authoritative.

## Constraints

- No hosted-API generation. Generation happens in the student's own AI client, via MCP or a skill.
- Anki cards are rendered in a web view. A spike confirmed three.js (r149, classic script, stored once in the media folder) renders on at least one of the user's devices. Cross-device behavior (phone, tablet), flicker on card flip, and sync size are still unverified.
- Newer three.js releases are ES modules and are not a safe fit for Anki; the card path uses r149 as a classic script.
- Medical accuracy needs human review; the project owner is a student and cannot be the only reviewer.

## Approaches considered

1. **Claude skill only.** Simplest. Quality varies, there is no shared reference data, and it is limited to Claude users. Rejected as the whole answer; the skill is still part of the design.
2. **Standalone site calling an LLM API.** Open to everyone, but per-request cost lands on the project. Rejected by the user (no API).
3. **Shared kit with two delivery tiers (chosen).** A premade static library for everyone, plus an MCP server and skill that let a student's own AI compose new scenes from the same kit. Anki export from both. A shareable-link site is optional and later.

User picked option 3 after rejecting option 2 and asking for a premade library for users without MCP and a generated one for users with MCP, plus Anki patching.

## Design

### Components

1. **The kit** (shared): a small JavaScript library on top of three.js (and SVG for 2D). It provides: tissue-colored materials, translucent layer shells with a cutaway clipping plane, tubes and vessels, arrows, markers, a label system with leader lines, orbit and zoom controls, per-scene control panel (dropdown and checkbox toggles) and an info panel. The prototype in `anatomy3d.html` is the starting point for this kit.
2. **Scene spec:** a JSON description of a scene: which kit parts to use, their positions, colors, layers, labels, toggles and the facts shown in the info panel. The kit renders a spec; a spec is validated before rendering. Premade visuals are specs reviewed by a person. Generated visuals are specs written by the student's AI.
3. **Premade library** (tier 1, no AI): a static site listing reviewed specs, viewable in a browser, with a download button for an Anki deck (.apkg) per topic.
4. **MCP server** (tier 2): tools the student's AI calls. Planned tools: `list_primitives` (what the kit can draw), `get_reference` (reviewed facts for a topic, where available), `render_scene` (validate a spec and return an interactive view, shown inline in the chat where the client supports MCP Apps), and `export_anki_card` (turn a spec into a card, 2D by default). Hosted remotely so students add one URL.
5. **Skill:** instructions that teach the AI how to turn a description into a good spec: pick 2D vs 3D, use the kit's parts, label everything, list the claims shown, and flag anything not grounded in reference data.
6. **Anki path:** two card types. The default is a self-contained labeled 2D SVG or static image (works everywhere). 3D cards are an opt-in option, using three.js r149 from the media folder, with a per-device test note. The kit is stored once in media; each card holds only its spec as text.
7. **Optional later:** a site that stores specs and gives shareable links (still no model cost).

### First premade batch

These are the user's chosen first topics, built as stylized models (not real meshes) in the prototype:
congenital heart defects with their 3D anatomy; aortic dissection (aortic and intimal perspectives); flail chest; tension pneumothorax; aspiration sites by patient position; inguinal canal and hernia anatomy; biliary tree anatomy; fibroid types layer by layer (FIGO); eye anatomy.

### Accuracy approach

- Every premade visual carries a "verify against your textbook" note and shows a short list of the claims it makes.
- Premade content is reviewed by a qualified person before release (see open questions).
- Generated visuals show a clear "AI-generated, unreviewed" badge.
- The `get_reference` tool is the place for grounded facts; the AI is told to prefer it over memory for high-stakes anatomy and physiology.

## Decisions by the user

- Public audience; no API; skill or standalone site with MCP.
- Premade library for non-MCP users, generated library for MCP users, and direct Anki patching.
- Three.js is for anatomical visualization only, not flowcharts or pathways.
- The first nine topics above.

## Calls I made (please check)

- Three.js plus SVG as the rendering stack, and a JSON scene spec as the contract between AI and kit.
- 2D SVG/image as the default Anki card, with 3D opt-in, because a three.js card cannot be guaranteed on every device.
- Remote-hosted MCP server rather than a local install.
- The kit starts as the prototype's helper functions, cleaned into a module.
- "Intimal perspective" for aortic dissection built as a wall cross-section (layers and tear), not an inside-the-lumen view.

## Left to the builder

- Exact JSON schema and validation rules for scene specs.
- Hosting choice and deployment for the static library and the MCP server.
- Label-collision handling and mobile touch controls (pinch zoom).
- How the Anki .apkg export is produced and where AnkiConnect is used instead.
- Test plan: per-device Anki card tests; scene-spec fuzzing so malformed generated specs cannot crash the page.

## Approved scope (2026-11-14)

The user approved this design and answered the open questions:

- **Phase 1 only: the premade library.** Ship first. The MCP server, skill and generated tier are deferred, not cancelled; the scene-spec and kit design stay so they can be added later.
- **Ship as "unreviewed".** Every visual carries an "unreviewed, verify against your textbook" badge until a qualified reviewer signs off. Reviewer recruitment is a later task, not a release blocker.
- **Open source.** The code and scenes are open; contributions welcome. Pick a permissive license (my call: MIT for code, CC BY-SA 4.0 for scene content and text; the user can change it).
- **Hosting (my call, not yet confirmed):** a free static host (e.g. GitHub Pages), since no server is needed in phase 1.
- Phase 1 scenes are kit-based JS modules with JSON metadata, not declarative JSON specs (my call; the declarative spec returns with the MCP phase). See the plan for details.
- Phase 1 includes the Anki deck export (.apkg per topic) with 2D cards by default and opt-in 3D cards.

## Open questions for the user (answered above; kept for the record)

1. **Reviewer:** who medically reviews premade content before it is labeled "reviewed"? (A faculty member, a resident, a peer-review group, or nobody yet and ship as "unreviewed" first?)
2. **Hosting and cost:** who hosts the static library and the MCP server, and is a small recurring cost acceptable? (Static hosting can be free; a remote MCP server usually is not.)
3. **Licensing and access:** open source, free-to-use closed, or something else? This affects whether others can contribute scenes and whether we can use open anatomy mesh sets.
