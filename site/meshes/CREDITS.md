# Model credits

The 3D anatomy in sagittal's scenes is built on open anatomical meshes, simplified and
re-baked by `tools/meshes/bake.py` (see `docs/meshes.md`). Every file in `site/meshes/`
names one of the sources below in its `credit` field. Baked meshes are adaptations of these
works and are shared under the same licence as their source (CC BY-SA sources stay
CC BY-SA 4.0, like sagittal's other content).

Only CC BY, CC BY-SA or compatible sources are allowed. Non-commercial (NC) or no-derivatives
(ND) parts are never used.

## zanatomy

**Z-Anatomy, the libre 3D atlas of anatomy**, by Gauthier Kervyn (design, 3D, anatomy) and
Marcin Zielinski (Blender add-on), with Lluis Vinent and the Z-Anatomy translators.
<https://github.com/Z-Anatomy/Models-of-human-anatomy> (file `Z-Anatomy.zip`, `Startup.blend`).
Licence: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Z-Anatomy's models are derived from **BodyParts3D**, © The Database Center for Life Science
(DBCLS), original model by Kousaku Okubo,
<https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>.
Licence: [CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).

Changes made for sagittal: selected objects extracted from the Blender file, vessels and ducts
swept from their centre-line curves into tubes, converted to centimetres in sagittal's frame
(+x patient's left, +y superior, +z anterior), merged into parts, decimated to a triangle budget.

Excluded: Z-Anatomy also includes parts under non-commercial licences ("Anatomy of the Inner Ear",
University of Dundee, CC BY-NC-SA 4.0; "Kidney", Lissie Cowley, CC BY-NC 4.0). sagittal does not
use them.

Used by: `thorax.js` (sternum, ribs, costal cartilages, thoracic vertebrae and discs).

## rodero-heart (available, not yet used)

Rodero C, Strocchi M, Marciniak M, et al. *Linking statistical shape models and simulated function
in the healthy adult human heart.* PLoS Comput Biol 17(4): e1008851 (2021). Data: "Virtual cohort of
extreme and average four-chamber heart meshes from statistical shape model", Zenodo,
doi:[10.5281/zenodo.4593739](https://doi.org/10.5281/zenodo.4593739).
Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Add `"credit": "rodero-heart"` to a bake config that uses it.

## zanatomy: biliary.js and groin.js (wave B, abdomen)

Same source and licence as the `zanatomy` entry above (Z-Anatomy, CC BY-SA 4.0, on BodyParts3D,
CC BY-SA 2.1 Japan). Credit id: `zanatomy`.

- `biliary.js`: liver (subdivided and smoothed), gallbladder (subdivided and smoothed), pancreas,
  main and accessory pancreatic ducts, duodenum (subdivided and smoothed), hepatic portal vein,
  common hepatic, proper hepatic and gastroduodenal arteries. The extrahepatic bile duct is not
  baked; `site/scenes/bil.js` draws it as a smooth tube along Z-Anatomy's "Bile duct" centre line
  and adds the common hepatic and hepatic ducts (Z-Anatomy has no objects for them).
- `groin.js` (right side): inguinal ligament, external and internal oblique, transversus abdominis,
  transversalis fascia, rectus abdominis with pyramidalis, inferior epigastric artery and vein,
  external iliac and femoral artery and vein, femoral nerve, ductus deferens, testicular artery and
  vein, testis with epididymis, hip bone, pubic symphysis, pectineus, iliacus with psoas major.
  The hip bone, pubic symphysis, pectineus, iliacus and psoas were extracted into the asset cache's
  `zanatomy-abdomen/obj/` with `tools/meshes/extract_blend.py`.
