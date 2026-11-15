# Eval results (phase1-library, 2026-11-15)

Nine fresh agents with only the skill ran prompts 1-8 and the refusal prompt. Outputs are in
`build/evals/e1` … `e9`. The checker rendered every figure with `sagittal.mjs look` (start view plus
one or two extra angles) into `build/evals/checker/eN/`, read the specs and judged each one against
atlas anatomy and C1-C7 in `prompts.md`.

| # | Prompt | Figure | Verdict | Failed criteria |
|---|---|---|---|---|
| 1 | Replaced RHA from SMA | `build/evals/e1/sagittal-figures/replaced-right-hepatic-artery-from-the-sma.html` | FAIL | C3 |
| 2 | Low cystic duct insertion | `build/evals/e2/sagittal-figures/low-insertion-of-the-cystic-duct.html` | PASS | none |
| 3 | Aberrant right subclavian | `build/evals/e3/sagittal-figures/aberrant-right-subclavian-artery.html` | PASS | none (minor notes) |
| 4 | Accessory LHA from LGA | `build/evals/e4/sagittal-figures/accessory-left-hepatic-artery-from-the-left-gastric.html` | FAIL | C3; Expect (accessory merges with the normal LHA) |
| 5 | CHA from SMA | `build/evals/e5/sagittal-figures/common-hepatic-artery-from-the-sma.html` | FAIL | C5; Expect (passes in front of the PV); C2/C4 (origin and labels unreadable in start view) |
| 6 | Replaced LHA from LGA (held out) | `build/evals/e6/sagittal-figures/replaced-left-hepatic-artery-from-the-left-gastric.html` | FAIL | C3 |
| 7 | Bovine arch (held out) | none (refusal) | PASS | none |
| 8 | Caterpillar hump (held out) | `build/evals/e8/sagittal-figures/caterpillar-hump-of-the-right-hepatic-artery.html` | FAIL | C3, C4, C6, C7; Expect (hump not in Calot's triangle, cystic artery not short) |
| R | Retrocaval ureter (refusal) | none (refusal) | PASS | none |

**4 of 9 pass** (2 of 7 figures, both refusals). All five figure failures involve the hepatic
arteries, and four of them come from the same two base-route recipes (RHA along the library line,
LHA through the segment IV/III/II centroids).

C1 passed for every figure: all specs built, both views rendered, and `look` reported no errors,
BLANK, HIDDEN or dropped labels.

## 1. Replaced right hepatic artery (e1): FAIL

PNGs: `checker/e1/replaced-right-hepatic-artery-from-the-sma-{normal,variant}.png` (RPO start view),
`checker/e1/front/…-rot0_0-{normal,variant}.png`, `checker/e1/side/…-rot0_1.57-{normal,variant}.png`.

- Correct: the RHA is removed, and a new one leaves the proximal SMA (the takeoff shows in the RPO
  view), runs posterior to the portal vein (seen in the right lateral view) and joins the
  right-lobe course. The LHA stays on the PHA (Michels III). The reply matches the chip.
- **C3**: the RHA has a sharp V-kink over the right lobe in both views (RPO ~745,410; anterior
  ~290,485). It comes from `via` points at t 0.45/0.6/0.75 around the 1.8 cm dip of the library
  `proper_hepatic_artery` line (t 0.5). In the right lateral view the same stretch shows as a
  deep forward-and-back loop.
- **C3 (variant)**: once the RHA is removed, the PHA ends in a stub and the LHA turns sharply back
  up from it, making a hook (anterior ~540,380; RPO ~575,345).
- Minor: the GDA is hidden in both views, so the normal CHA runs straight into the PHA. Claim 2
  says "commonly", but `jmas-vasculobiliary-anatomy` only covers that the course occurs.

## 2. Low cystic duct insertion (e2): PASS

PNGs: `checker/e2/low-insertion-of-the-cystic-duct-{normal,variant}.png` (LAO start view),
`checker/e2/rao/…-rot0_0.6-{normal,variant}.png`.

- Normal: a short cystic duct leaves the gallbladder neck and joins the CHD to form the CBD.
- Variant: the cystic duct leaves the neck, crosses to the medial (patient's left) side and runs
  alongside the CBD. It joins at the duodenum, above the papilla. Only `jmas-vasculobiliary-anatomy`
  is cited.
- Note: from the RAO view the first ~1.3 cm of the cystic duct (the library hook) arches up and
  back down over the neck. That is acceptable, but it is the tightest curve in the figure. In the
  start view the low cystic duct passes very close to the normal CHD/CBD junction.

## 3. Aberrant right subclavian artery (e3): PASS

PNGs: `checker/e3/aberrant-right-subclavian-artery-{normal,variant}.png` (posterior start view),
`checker/e3/front/…-rot0_0-*`, `checker/e3/front10/…-rot0.4_0-*`, `checker/e3/lat/…-rot0_1.57-*`.

- The variant has no brachiocephalic trunk. The RCCA arises from the arch at the old BCT origin.
  The ARSA arises at arch t 0.85, beyond the LSA (t 0.55), and crosses behind the oesophagus and
  trachea to the right. That gives four branches. The retro-oesophageal course reads directly in
  the posterior view, and the 49/51 claim matches the source.
- Notes: in the right lateral view the ARSA turns about 90° from its ascent to run forward (an
  elbow, not a hairpin). In the posterior start view the normal BCT is mostly behind the trachea,
  and its label dot sits over the trachea. The ARSA origin is at the bottom edge of the start view.

## 4. Accessory left hepatic artery from the left gastric (e4): FAIL

PNGs: `checker/e4/accessory-left-hepatic-artery-from-the-left-gastric-{normal,variant}.png`
(anterior start view), `checker/e4/lat/…-rot0_-1.57-{normal,variant}.png`.

- Correct: the vessel is added (not replaced), its origin on the LGA is labelled, the normal LHA
  is kept, and the claim does not say "replaced".
- **C3**: the normal LHA (via the segment IV → III → II centroids) undulates in the anterior view
  and makes a Z-hook in the left lateral view (~520,220). The RHA shows the same V-kink as e1
  (~400,430).
- **Expect/readability**: the accessory LHA ends 1 cm from the normal LHA's end (segment II), so
  the two vessels cross and run together to the tip. It reads as a vessel joining the LHA, not a
  separate artery to the left lobe. The agent saw this ("overlap near the tip") and still handed
  the figure over.
- Library limit: the LGA is a 3.8 cm stub that ends in space, short of the lesser curvature.

## 5. Common hepatic artery from the SMA (e5): FAIL

PNGs: `checker/e5/common-hepatic-artery-from-the-sma-{normal,variant}.png` (start view rot 0,1.2),
`checker/e5/front/…-rot0_0-{normal,variant}.png`.

- Correct: the CHA is removed from the coeliac trunk, the PHA and GDA are moved onto the new
  vessel, and the coeliac trunk keeps the LGA and splenic artery. The Hiatt claim is cited.
- **C5**: the library `proper_hepatic_artery` was not split. A single vessel labelled "Proper
  hepatic artery" runs into the right lobe, and there is no RHA/LHA division and no left hepatic
  artery in either view. This is plausible but wrong, and patterns.md already says to split it.
- **Expect (relation)**: the via is `portal_confluence` offset **right** 1.5 cm. In the anterior
  view the new CHA crosses **in front of** the portal vein, not behind it.
- **C2/C4**: in the start view (chip "Right lateral view · patient's right on screen left") the
  new CHA runs up over the coeliac trunk. Its SMA origin cannot be seen, and the "Common hepatic
  artery (from SMA)" and "Coeliac trunk" labels sit on overlapping vessels. The agent knew the
  view was cluttered and handed it over anyway.

## 6. Replaced left hepatic artery from the left gastric (e6, held out): FAIL

PNGs: `checker/e6/replaced-left-hepatic-artery-from-the-left-gastric-{normal,variant}.png`
(anterior start view), `checker/e6/lat/…-rot0_-1.57-{normal,variant}.png`.

- Correct: the normal LHA is removed and the replaced LHA leaves the LGA (labelled origin) to the
  left lobe. The RHA stays on the PHA, and the figure is called Michels II and "replaced". The
  variant artery itself is good, and the held-out prompt generalised.
- **C3**: the normal LHA has a clear hairpin in the left lateral view (~515,225), from the same
  IV → III → II recipe as e4, and dips in the anterior view (~780,260). With the LHA removed, the
  PHA → RHA junction is a sharp peak in the anterior variant (~535,425) and a hook in the left
  lateral view (~470,440). The agent reported the hook but did not fix it.

## 7. Bovine arch (e7, held out): PASS (refusal)

No figure. In `organs/references.json`, the only arch sources are `statpearls-aortic-arch`,
`statpearls-brachiocephalic-artery` and `statpearls-heart-great-vessels`. Their `covers` lines say
"not for a variant or a prevalence", and no listed source covers the bovine arch. Under SKILL.md
step 3 the refusal is correct. It is also helpful: the agent offered the ARSA, which is cited and
buildable. The geometry for the variant is available (BCT and LCCA lines). Showing it would need a
listed reference, not a library change.

## 8. Caterpillar hump of the right hepatic artery (e8, held out): FAIL

PNGs: `checker/e8/caterpillar-hump-of-the-right-hepatic-artery-{normal,variant}.png` (start view),
`checker/e8/front/…-rot0_0-{normal,variant}.png`.

- **Expect**: the "hump" is a single sharp V-dip about 4 cm lateral to the cystic duct, over the
  right lobe beside the gallbladder body (~360,445). It is not a tortuous loop next to the
  gallbladder neck or cystic duct in Calot's triangle. The vias alternate inferior and superior
  offsets (0.4/0.6/0.8/0.4 cm), which gives a zigzag, not a hump. The cystic artery from the dip
  runs about 2 cm horizontally to the gallbladder, so it is not short. The proximal RHA was also
  redrawn straighter, so more than the hump changed.
- **C3**: the V at the dip is a hairpin. The PHA makes a U-turn below the junction (~640,375), and
  the normal RHA has the library V.
- **C4**: the "Cystic duct" dot (565,310) sits on the point where the PHA, RHA, LHA and CHD all
  cross, so it does not mark the duct.
- **C6**: the 3.8% figure cites both `jmas-vasculobiliary-anatomy` and
  `jmas-anatomy-cholecystectomy`, but 3.8% is only in the first source (the two give different
  figures).
- **C7**: the reply says "a modest bow of the RHA near the gallbladder", which does not match the
  sharp V away from the neck.

## Refusal: retrocaval ureter (e9): PASS

No figure. Ureters are the first item in organs.md → Gaps. The agent said there are no ureters,
did not borrow another tube, and offered renal-vessel figures it can actually build.

## Skill changes indicated

1. **Library: ship the hepatic artery split as base lines** (organs build, `coeliac-trunk`). Five
   of the seven figures redrew the PHA/RHA/LHA by hand, and every redraw produced a kink: the RHA
   V from vias across the t 0.5 dip, the LHA Z-hook from IV → III → II, and the PHA-junction hook
   when one branch is removed. Add `proper_hepatic_artery` (to the porta), `right_hepatic_artery`
   (smoothed across the dip) and a checked `left_hepatic_artery` as named library lines with
   landmarks, and mark them "completed from landmarks" in organs.md. Then `remove` and
   `move_insertion` work on real lines. Do the same for the bile duct (cystic duct, CHD, CBD).
   Until then, the validator should refuse a figure that shows or labels an unsplit line flagged
   `split_required` (e5 labelled the whole line "Proper hepatic artery").
2. **Tooling: detect kinks and overlaps in `look`/`figure`, and forbid handing over known
   defects.** Add a `KINK` warning for any drawn tube turning more than about 75° within 1 cm,
   including at a parent → child junction once a sibling has been removed. Add `TOUCH` for two
   distinct vessels within one radius of each other over more than 1 cm (e4's accessory LHA on the
   LHA, e5's new CHA on the coeliac trunk). In SKILL.md step 6/7, add: "If you notice a defect
   (hook, overlap, clutter), fix it or stop (step 3). Never hand over a figure with a defect listed
   as a caveat." e4, e5 and e6 all named their defect and shipped anyway.
3. **reference/patterns.md: general patterns that are missing or wrong.**
   - The LHA completion recipe: use one via (segment IV centroid, posterior 1-1.5 cm) and then
     the segment II centroid. Drop the segment III via, which causes the hook in e4 and e6. e1
     used one via and its LHA is smooth.
   - "Tortuous or redundant course (a loop or hump towards a named structure)": keep the origin
     and the distal course, and replace only the middle with 2-3 vias offset towards the named
     structure's landmark (within 0.5-1 cm of it). The result is one smooth bow, never alternating
     up/down offsets. A branch said to leave the bow leaves at its apex and is short.
   - "Depth order is part of the course": an artery that reaches the liver from the SMA side
     passes posterior to the portal vein / SMV-portal confluence (cited in
     `jmas-vasculobiliary-anatomy` for the RHA). A new vessel that crosses a vein must use a
     `posterior`/`anterior` offset, never `right`/`left`, and the crossing must be checked in a
     lateral `look`.
   - Accessory vessels end at a different target from the normal one (another segment landmark,
     or at least 1 cm apart), so the two never merge.
4. **SKILL.md, claims rule**: a number cites only a reference whose `covers` line gives that
   number. When two sources disagree, cite one and say "in one series" (e8 cited both for 3.8%).
5. **SKILL.md step 6, views**: check the start view against item 1. If the new vessel's origin
   overlaps another vessel or two labels sit on overlapping tubes, try the four standard
   `--rot` views and pick the one where the origin stands clear (e5 shipped a cluttered
   rot 0,1.2 view).
