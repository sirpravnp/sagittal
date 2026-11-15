---
name: sagittal
description: Make an accurate, labelled, interactive 3D figure of an anatomical variant from a plain request, built from real reconstructed anatomy (never drawn from memory). Use when a student asks to see, show, draw or explain an anatomical variant or variation in 3D, e.g. "show me a replaced right hepatic artery", "aberrant right subclavian in 3D", "what does a low cystic duct insertion look like", "accessory left hepatic artery from the left gastric", "common hepatic artery off the SMA". Not for surgery steps, diagnosis, clinical advice or flowcharts.
---

# Sagittal: anatomical variant figures

A medical student asks for a variant in plain words. You build the figure; they only look at it.
The output is one HTML file that opens offline: a 3D stage with a **Normal / Variant** dropdown,
labels with leader lines, claims with references, and Save as image.

**The rule that decides everything: a plausible but wrong picture is worse than none.** The
student memorises what they see. You never draw anatomy from memory and never give coordinates:
every point is a library landmark, a point along a library centre line, or one of those moved by a
short offset (at most 3 cm). Every fact you show cites a reference from the fixed list.

## Setup (once)

From a clone of the sagittal repo (Node 18+):

```sh
npm install                                     # only needed for looking at figures (Playwright)
ln -s "$PWD/skills/sagittal" ~/.claude/skills/sagittal
```

The tools live in the clone, not in this folder. `scripts/sagittal.mjs` finds the clone by
resolving its own symlinked path (the skill folder is `<clone>/skills/sagittal`); set
`SAGITTAL_HOME=/path/to/clone` to override. Below, `S` means
`node ~/.claude/skills/sagittal/scripts/sagittal.mjs` (use this skill's real base directory if it
is installed elsewhere). `S home` prints the clone it uses. Inside the clone, `npm run figure --`
and `npm run look --` do the same as `S figure` and `S look`.

## Workflow

### 1. Read the library (always, before planning)

- `reference/organs.md`: every organ with its parts, centre lines (with `from` landmark, `parent`,
  length, end points) and landmarks, plus the **Gaps** list and the **References** you may cite.
- `reference/spec.md`: the figure spec format, every op, limits, error messages, two worked examples.
- `reference/patterns.md`: how to handle library lines that do not split where the textbook
  splits them, biliary and hepatic-artery notes, and view choice. Read it for any hepatobiliary,
  arch or mesenteric figure.

### 2. Map the request

Write down, before any JSON:

- **The variant in one sentence**, as the cited reference describes it (origin, course, relations,
  ending). If you cannot state it from a listed reference, you cannot show it.
- **Organs** to draw (1 to 12): the structures involved plus the ones that make the relation
  readable (e.g. the portal vein for "behind the portal vein"). Fade organs that cover the
  variant (`opacity` 0.1 to 0.3) or hide parts that are not needed (`visible: false`).
- **Base routes**: normal structures the library lacks or does not divide (cystic duct, common
  hepatic duct, right/left hepatic arteries...), drawn in both views from landmarks and lines.
- **Variant edits**: only the variation (`remove`, `route`, `branch`, `move_insertion`,
  `duplicate`). Removing a line that still has children fails: move or remove the children.
- **Labels**: the structures the student asked about and the landmarks that make the change
  readable (usually 4 to 8). Each label on its own structure.
- **Claims**: 1 to 6 short facts (prevalence, course, clinical relevance), each with reference ids
  from `reference/organs.md` → References. No listed source for a fact → leave the fact out.

### 3. When the library cannot support the request, say so and stop

If a structure, landmark or source the variant needs is missing (see Gaps; e.g. ureters, female
pelvic organs, hepatic veins, pulmonary arteries, named hepatic ducts' own geometry), tell the
student plainly: which structure or landmark is missing, and what Sagittal can show instead (a
nearby variant the library does support). Do not approximate with offsets from distant landmarks,
do not borrow an unrelated line, do not label an "(unnamed in source)" line with a textbook name.
The same if no listed reference supports the variant: say that no reference in the list covers it.

### 4. Place everything through landmarks and centre lines

- Start a branch `on` its parent line (`{"on": "<organ>/<line>", "t": ...}`, no offset). Pick `t`
  from the line's length in organs.md: `t` is a fraction of length from the `from` end.
- End a structure on its target: a landmark in the organ it supplies or drains, or `on` the line
  it joins. A duct starts on its organ (the cystic duct starts at `gallbladder/gallbladder_neck`,
  with no offset, never in mid-air).
- Express relations as offsets from the structure they are relative to: "behind the portal vein"
  = `{"landmark": "portal-venous/portal_confluence", "offset": {"dir": "posterior", "cm": 1.2}}`.
  Offsets are for 0.5 to 2 cm relations, not for reaching places far from any landmark.
- Follow a library course by putting `via` points `on` that line at spaced `t` values (0.1 apart or
  more), not on its small wiggles.
- Anything at the ampulla ends at `duodenum/major_duodenal_papilla`, not at the pancreatic duct's
  end (that end is about 2 cm from the bile duct).
- Use the coordinates in organs.md to plan (which side is right, which way is posterior, how far
  apart two points are), never in the spec.

### 5. Write the spec and build

Write the spec to `./sagittal-figures/<short-name>.json` (create the folder), then:

```sh
S figure sagittal-figures/<short-name>.json
```

It validates the spec and writes `./sagittal-figures/<slug-of-title>.html` (path printed on
stdout). If it prints errors (exit 1, nothing written), fix each one in the spec (each starts with
the path of the field; spec.md → Errors explains them) and run it again. Never work around an error
with offsets or by dropping the structure the student asked for.

### 6. Look at both views and correct the anatomy (before the student sees anything)

A valid spec can still be wrong anatomy. Render it:

```sh
S look sagittal-figures/<slug>.html                 # the starting view
S look sagittal-figures/<slug>.html --rot 0.2,2.6   # from behind, to check posterior relations
```

It writes `<slug>-normal.png` and `<slug>-variant.png` next to the figure and prints the
orientation chip text, each label's anchor, labels hidden behind another structure, and dropped
labels. **Open both PNGs and look at them** (Read the image files). Check every item:

1. **Origins visible.** Each new or moved vessel visibly leaves its parent (e.g. the replaced
   artery's takeoff from the SMA, the ARSA from the distal arch past the left subclavian). If an
   organ covers it, fade or hide that organ, or change the view.
2. **Ducts attached.** The cystic duct leaves the gallbladder neck; every duct and vessel ends on
   the structure it joins or supplies, with no gap and no free-floating end.
3. **No hairpins or loops.** Courses are smooth; no tube doubles back, corkscrews or kinks at a
   `via`. Move or drop the offending waypoint.
4. **Relations as cited.** "Behind", "to the right of", "parallel to" are true in the picture
   (check from a second angle with `--rot` when the relation is front/back).
5. **Labels on their own structure.** Every dot sits on the structure its text names; no two dots
   piled together; nothing listed as HIDDEN or dropped unless you meant it.
6. **Orientation read correctly.** Read the chip ("Right anterior oblique view · patient's right
   on screen left") and check that left/right in what you describe matches it. Choose `view.rot`
   so the variant reads at a glance (see patterns.md → Views).
7. **Normal vs variant.** The normal view shows textbook normal anatomy; the variant view differs
   only by the variation.

Fix the spec, rebuild, look again until every item passes. If you cannot make it correct with the
library, tell the student what is missing (step 3) instead of showing it.

### 7. Hand it over

Open it for the student (`S figure <spec> --open`, or open the HTML) and reply with the file path
and one line on what it shows, e.g. *"`sagittal-figures/replaced-right-hepatic-artery.html`: the
right hepatic artery arises from the SMA and runs behind the portal vein to the right lobe; switch
Normal/Variant in the dropdown."* Add a sentence on the clinical point only if it is in a claim.
Do not show the student the spec, the validator or the PNG checks unless they ask.

## Rules

- Variants only: one normal and one variant view per figure. No surgery steps.
- Never give coordinates, never invent a landmark, line or reference id; ids must exist in
  `reference/organs.md`.
- Claims: short, factual, each citing listed reference ids; no fact without a listed source.
- Names: label library structures with their textbook name; do not give an "(unnamed in source)"
  line a textbook name.
- The figure is the student's: it lives only in their `sagittal-figures/` folder.
