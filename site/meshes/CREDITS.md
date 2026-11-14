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

## rodero-heart: heart.js, heart-blood.js (wave B, heart scene)

Source: the **average** mesh of Rodero et al. 2021 (above), `average.tar.gz` / `average.vtk` from
Zenodo doi:[10.5281/zenodo.4593739](https://doi.org/10.5281/zenodo.4593739), CC BY 4.0.

Changes made for sagittal: the ASCII VTK tetrahedral mesh was parsed and its boundary faces split by
the per-element region tag: the outer (epicardial) surface per chamber (`wall_lv`, `wall_rv`,
`wall_la`, `wall_ra`, with the vein-inlet and valve-plane tags folded into the neighbouring chamber),
the aortic root (`aorta`), and each closed cavity (endocardium plus valve and
inlet lids) as a blood cast (`cav_lv`, `cav_rv`, `cav_la`, `cav_ra`, orientation flipped to face out
of the blood). Converted from mm (LPS) to cm in sagittal's frame, lightly Taubin-smoothed and
decimated. Both files share one centre so they register.

The heart scene also draws the arch, arch branches, proximal descending aorta, pulmonary trunk and
branches, venae cavae and pulmonary-vein stubs as swept tubes whose centre lines come from
**Z-Anatomy** (see `zanatomy` above, CC BY-SA 4.0), registered to the Rodero heart by a similarity
fit on chamber centroids and valve centres. The combined scene is shared under CC BY-SA 4.0.

Used by: `heart.js`, `heart-blood.js` (scene `heart`).
