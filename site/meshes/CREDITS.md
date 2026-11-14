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

## chest.js (zanatomy): lungs, airway, heart, great vessels, diaphragm

`chest.js` uses the `zanatomy` credit above (Z-Anatomy, CC BY-SA 4.0, on BodyParts3D, CC BY-SA 2.1 JP).
Objects: superior/middle/inferior lobes of the right lung, superior/inferior lobes of the left lung,
trachea, main/intermediate/lobar bronchi, the four heart chambers, ascending aorta, aortic arch,
thoracic aorta, brachiocephalic trunk, common carotid and subclavian arteries, pulmonary trunk and
pulmonary arteries, superior vena cava, brachiocephalic veins, thoracic inferior vena cava, diaphragm.
Diaphragm, brachiocephalic trunk/veins and common carotids were extracted with
`tools/meshes/extract_blend.py` into the asset cache's `zanatomy-chest/obj/` (the existing
`zanatomy/obj/` was left untouched). Changes: merged into parts, organ cages subdivided and smoothed,
decimated, baked in the same frame as `thorax.js` (centre `[0, 125.49, 0.61]` cm, so the two register).
The flail and tension scenes deform copies of these meshes at runtime (collapse, shift, dent).

Used by: `flail` and `tension` scenes (with `thorax.js`).
