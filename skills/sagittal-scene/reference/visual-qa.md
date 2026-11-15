# Visual QA: judging card images

Tests prove a scene renders; they cannot tell you it is right. Only looking does. Render the
cards, open every PNG with the image-reading tool, and judge them against the reference cards
below and against the atlas anatomy you know. Write a one-line honest verdict per variant.

## Render

```sh
# your scene only (fast)
node -e "import('./tools/render_cards.mjs').then(m=>m.renderCards({siteDir:'site',outDir:'build/cards-<id>',ids:['<id>']}))"
# the whole library, into build/cards/ (the references below)
npm run cards
```

Files: `<id>__<variant>__front.png` (labels hidden: what the student sees as the question) and
`__back.png` (labels shown), 800x600, background `#0f141b`. Rendering uses the installed
Google Chrome with SwiftShader, so it is slow but deterministic. If you change a rebuild-heavy
detail, render "before" images first so you can compare honestly.

For other angles while iterating, serve `site/` (`python3 -m http.server 8000 --directory site`)
and screenshot `viewer.html?scene=<id>&<k>=<key>&embed=1` with a browser tool, or temporarily
change `rot`/`zoom` and re-render.

## Reference cards (the quality bar)

In `build/cards/` of a checkout where `npm run cards` has run. Open a few before judging yours.

| card | what it shows well | known weakness (do not copy) |
|---|---|---|
| `bil__cbd__back.png` | real liver/gallbladder/duodenum/pancreas, duct tree in one continuous calibre, dilated CBD with a stone, clean labels | cholangitis tint is subtle |
| `bil__norm__front.png` | organs recognisable without any label | |
| `heart__tof__back.png` | all four TOF features visible: overriding purple aorta, thin PA, PS ring, VSD ring, RVH | RVH relies on its label |
| `heart__tga__front.png` | parallel great arteries, colour tells the physiology | |
| `heart__asd__back.png` | view chosen for the lesion (posterior) | unusual view; one label anchors on a small strip |
| `eye__rd__front.png` | sagittal cutaway with section caps, detachment readable without labels, magnified angle inset | |
| `fib__all__back.png` | procedural organ done right: real proportions, layered section, all FIGO types | fibroids read a little disc-like |
| `tension__tension__front.png` | finding obvious at a glance: collapsed lung, air, mediastinal shift, flat hemidiaphragm | heart partly hidden |
| `asp__up__back.png` | real bronchial tree with the dependent segments lit | territories are computed approximations |
| `ing__ind__back.png` | sac follows the cord through both rings, lateral to the inferior epigastric vessels | busy; the sac reads as a yellow tube; translucent wall is a pink wash |
| `aorta__ext__back.png` | real aorta with spiral flap and false lumen | vessel is thin at card size |

## Rubric (every variant, front and back)

Score each line pass / fix. Ship only when every line passes or the report explains why not.

1. **Recognisable.** On the front card, a student names the region and the main structures
   without labels. Nothing looks like a primitive (sphere, cylinder, box) unless that is the
   real shape.
2. **Correct.** Compare with the atlas view: sidedness (patient's left on screen right in an
   anterior view), superior up, relations (in front of / behind / medial / lateral),
   proportions, courses and branch order. Every label sits on the structure it names.
   If unsure about a relation, look it up; if still unsure, remove the element.
3. **The finding shows.** The variant's specific finding is visible on the front card (size,
   contrast, position), not just a generic organ with a different label. Use a ring, arrow,
   highlight, inset or view change when it is small.
4. **Variants differ.** Put the variant cards side by side: each differs from the normal
   variant exactly where the pathology is, and nowhere else.
5. **Readable.** The model fills most of the 800x600 frame; nothing important is cropped;
   translucent layers do not wash everything out; colours follow the tissue presets
   (arteries red, veins blue, bile green, bone ivory, nerves yellow).
6. **Labels.** Back card: no overlaps, inside the frame, short anatomical names, each with an
   obvious target; no orphan labels floating over empty space.
7. **No artefacts.** No z-fighting stripes, black faceted cages (forgot subdivide/smooth),
   inside-out shading, holes, broken transparency sorting, or overlays hidden behind organs.

## Common failures and fixes (seen while building the library)

| symptom | cause | fix |
|---|---|---|
| organ looks faceted or lumpy | Z-Anatomy subdivision cage baked raw | `"subdivide": 1, "smooth": 6-10` |
| everything pink and foggy | too many translucent shells | make context organs more transparent or drop them; keep the subject opaque |
| lesion invisible on the front card | view chosen for the normal anatomy | per-variant view angle, inset, ring/arrow on top (`depthTest: false`) |
| overlay floats beside the organ | placed by eye in scene units | place from mesh bboxes or sampled centre lines in cm |
| overlays drift after a re-bake | bake `center` changed | pin `"center"` in the config |
| a label sits on the far side | anchor on a hidden surface for that view | per-variant anchors on visible surfaces |
| e2e timeout / slow card | many shader variants, big transparent surfaces | one material program (`sheen: 0` wrapper), shared materials, front faces only |
| tube looks like a hose | uniform radius, 12 sides | taper (`vtube`/`duct` profile), 18-24 sides |
