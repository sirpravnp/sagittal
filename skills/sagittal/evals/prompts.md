# Test prompts for the sagittal skill

Each prompt is given, as written, to a fresh Claude Code agent that has only this skill (installed
as `~/.claude/skills/sagittal`, run in an empty working folder). The agent must produce the figure
with no further help. Then the checker renders both views (`scripts/sagittal.mjs look`, plus a
second angle where a front/back relation matters), looks at them and judges each against atlas
anatomy and the criteria below. Record verdicts in `results.md` (prompt, figure path, PNGs,
PASS/FAIL per criterion, notes). All must pass before a release.

Prompts 1-5 are **regression** prompts (the first variants built; `reference/` teaches the general
patterns they use but solves none of them). Prompts 6-8 are **held out**: nothing in `reference/`
(SKILL.md, spec.md, patterns.md) names or describes them, so they test whether the skill
generalises. Keep it that way: when a held-out prompt's lesson goes into `reference/`, write it as
a general pattern and add a new held-out prompt.

Common criteria for every prompt (from SKILL.md step 6):

- C1 the spec validates and the HTML opens offline with both views;
- C2 every new or moved vessel visibly leaves its parent; every duct starts on its organ and every
  structure ends on what it joins or supplies (no gaps, no free ends);
- C3 smooth courses, no hairpins, loops or corkscrews;
- C4 each label's dot sits on the structure it names; no piled dots; no hidden/dropped labels;
- C5 the normal view is textbook normal; the variant view differs only by the variation;
- C6 claims are short, correct, and cite only ids from `organs/references.json`; no invented
  facts; no coordinates in the spec;
- C7 the agent's reply gives the file path and a one-line summary that matches the figure,
  with left/right consistent with the orientation chip.

## 1. Replaced right hepatic artery

> Show me a replaced right hepatic artery coming off the SMA.

Expect: normal view with proper hepatic dividing into right and left hepatic arteries; variant with
the normal right hepatic removed and a right hepatic artery arising from the proximal SMA, passing
behind (posterior to) the portal vein and to the right of / behind the bile duct, entering the
right lobe; the left hepatic stays on the proper hepatic (Michels III). Takeoff from the SMA
visible and labelled. Cites `jclinmedres-hepatic-artery-variations` (and/or the other hepatic
artery reviews).

## 2. Low cystic duct insertion

> What does a low insertion of the cystic duct look like? Can you make it in 3D?

Expect: normal view with a short cystic duct from the gallbladder neck joining the common hepatic
duct to form the CBD; variant with the cystic duct running alongside the CBD and joining it low,
near the duodenum (above the papilla). The cystic duct starts on the gallbladder neck in both
views. Gallbladder, CBD, common hepatic duct and duodenum visible. Cites
`statpearls-biliary-ducts` and/or the cholecystectomy anatomy papers.

## 3. Aberrant right subclavian artery

> aberrant right subclavian in 3D please

Expect: normal view with brachiocephalic trunk dividing into right common carotid and right
subclavian; variant with no brachiocephalic trunk, the right common carotid from the arch, and the
right subclavian arising from the distal arch beyond the left subclavian, crossing behind the
oesophagus to the right arm (four arch branches: RCCA, LCCA, LSA, ARSA). Oesophagus (and trachea)
shown so the retro-oesophageal course reads. Cites `jpersmed-aberrant-right-subclavian`.

## 4. Accessory left hepatic artery from the left gastric artery

> My anatomy prof mentioned an accessory left hepatic artery from the left gastric. Can you show me?

Expect: normal hepatic arterial anatomy (proper hepatic with right and left hepatic arteries)
kept in both views; the variant **adds** an artery from the left gastric artery running up
through the region of the lesser omentum (fissure for the ligamentum venosum) to the left lobe,
nothing removed (accessory, not replaced; Michels V). Origin from the left gastric visible.
The agent must not call it "replaced". Cites a hepatic artery variation review.

## 5. Common hepatic artery from the SMA

> Can you show the common hepatic artery arising from the superior mesenteric artery instead of the coeliac trunk?

Expect: normal view with the common hepatic artery from the coeliac trunk; variant with the
common hepatic artery removed from the coeliac trunk and a common hepatic artery from the SMA
running up (behind the portal vein / pancreas region) to the usual division into gastroduodenal
and proper hepatic arteries, which stay attached (moved onto the new artery). The coeliac trunk
keeps the left gastric and splenic arteries. Cites a hepatic artery / coeliac trunk variation
reference.

## 6. Replaced left hepatic artery from the left gastric artery (held out)

> show me a replaced left hepatic artery coming from the left gastric

Expect: normal view with proper hepatic dividing into right and left hepatic arteries; variant
with the normal left hepatic artery removed and a left hepatic artery arising from the left
gastric artery, running up to the left lobe (through the region of the fissure for the ligamentum
venosum), the right hepatic staying on the proper hepatic (Michels II). Origin from the left
gastric visible; called "replaced", not "accessory". Cites `jclinmedres-hepatic-artery-variations`.

## 7. Bovine arch (held out)

> What is a bovine aortic arch? Show me in 3D.

Expect: normal view with three arch branches (brachiocephalic trunk, left common carotid, left
subclavian); variant with the left common carotid arising from the brachiocephalic trunk (or a
common origin with it), leaving two branches from the arch. The new origin visible from the front.
Claims only what a listed reference supports (aortic arch / great vessels references); if no
listed reference covers the bovine arch, the agent says so instead of citing one that does not.

## 8. Caterpillar hump of the right hepatic artery (held out)

> what's a caterpillar hump of the hepatic artery? can you show me one

Expect: normal view with the right hepatic artery running from the proper hepatic artery towards
the right lobe, with a cystic artery to the gallbladder; variant with the right hepatic artery's
origin and distal course unchanged but forming a tortuous loop (hump) that comes close to the
gallbladder neck and cystic duct in Calot's triangle, the cystic artery then short. Nothing is
replaced or removed apart from the redrawn right hepatic course. Called a caterpillar or
Moynihan's hump. Cites `jmas-vasculobiliary-anatomy` and/or `jmas-anatomy-cholecystectomy`; any
prevalence quoted matches the cited source (the two sources give different figures).

## Refusal: request the library cannot support

> Show me a retrocaval ureter.

Expect: no figure. The agent says plainly that the base organs have no ureters (Gaps), so it
cannot show the ureter's course behind the IVC, and offers something it can show; it does not
draw a ureter from offsets or label another tube as the ureter.
