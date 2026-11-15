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

## airways (mesh, credit `zanatomy`)

`airways.js`: trachea; right and left main bronchi; right intermediate bronchus; the five lobar
bronchi; all 20 segmental bronchi (BI-BX each side, as Z-Anatomy names them); the five lung lobes
(subdivided once and Taubin-smoothed); thoracic vertebrae T1-T12 for orientation. Source: Z-Anatomy
`Startup.blend` (BodyParts3D-derived), CC BY-SA 4.0 on CC BY-SA 2.1 JP; see the `zanatomy` entry
above for full attribution. Changes: extracted with `tools/meshes/extract_blend.py` (bronchi swept
from their centre-line curves into tubes; "Middle lobar bronchus.r" extracted separately into
`sagittal-assets-cache/zanatomy-airways/`), converted to sagittal's frame, decimated per
`tools/meshes/configs/airways.json`. The `asp` scene derives bronchopulmonary segment territories
at runtime by assigning each lobe surface point to its nearest segmental bronchus (an
approximation, not segment meshes from the source).
## aorta (mesh `aorta.js`, credit `zanatomy`)

From **Z-Anatomy** / **BodyParts3D** (see `zanatomy` above; CC BY-SA 4.0 on CC BY-SA 2.1 JP).
Objects: Ascending aorta, Aortic arch, Thoracic aorta, Abdominal aorta; Brachiocephalic trunk,
left and right common carotid and subclavian arteries; left and right common iliac arteries;
coeliac trunk, superior and inferior mesenteric arteries, left and right renal arteries; left and
right ventricles and atria (context outline). Changes: centre-line curves swept into 24-sided tubes
(`extract_blend.py --sides 24`), heart chambers subdivided and smoothed, merged into parts,
decimated, converted to centimetres in sagittal's frame. The scene `aorta.js` also uses the aorta's
centre line (read off the swept rings) to place a procedural dissection flap and false lumen, and
draws the aortic root sinuses and valve procedurally.

Used by: scene `aorta` (aortic dissection).
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
## eye (Z-Anatomy right eye)

`eye.js` is baked from the **zanatomy** source above (CC BY-SA 4.0; BodyParts3D, CC BY-SA 2.1 JP):
`Sclera.r`, `Cornea.r`, `Iris.r`, `Lens.r`, `Retina.r`, `Vitreous_body.r`,
`Anterior_chamber_of_eyeball.r` and `Optic_nerve_(II).r` (config `tools/meshes/configs/eye.json`).
Changes: the coarse subdivision cages were subdivided and Taubin-smoothed, then decimated; the mesh
is centred on the sclera. Z-Anatomy has no choroid or ciliary body: the `eye` scene adds them
procedurally (a grown copy of the retina shell; a swept profile fitted to the sclera, iris and
lens), with the trabecular meshwork, canal of Schlemm, optic-nerve sheath, disc and retinal vessels.
Used by: `scenes/eye.js`.

## Procedural uterus (no mesh)

There is no open (CC BY / CC BY-SA) female pelvis mesh in the asset cache: Z-Anatomy and
BodyParts3D are male models. The uterus, cervix, upper vagina, tubes and ovaries of
`scenes/fib.js` are built in code from an anatomical coronal profile; no third-party model is used.

## upper-limb (Z-Anatomy right shoulder girdle, neck and chest wall)

`upper-limb.js` is baked from the **zanatomy** source above (CC BY-SA 4.0; BodyParts3D, CC BY-SA 2.1 JP):
`Vertebra C3`-`C7` and `T1`-`T8`, `First rib.r` to `Eighth rib.r`, `Clavicle.r`, `Scapula.r`,
`Humerus.r`, `Scalenus anterior muscle.r`, `Scalenus medius muscle.r` and `Serratus anterior muscle.r`
(config `tools/meshes/configs/upper-limb.json`). Changes: decimated, light Taubin smoothing of the
scalenes; not centred (raw sagittal frame). The `plexus` scene draws the brachial plexus (roots,
trunks, divisions, posterior cord, musculocutaneous, axillary, radial, median, ulnar, suprascapular
and long thoracic nerves), the subclavian, axillary and brachial arteries and the cervical sympathetic
trunk as swept tubes along **Z-Anatomy**'s own centre lines. Changes to those: the trunks and cords are
spread apart in the coronal plane (exploded view); the lateral and medial cords, the roots of the
median nerve, the start of the axillary nerve and the posterior division of the lower trunk are short
drawn links to textbook topology (Z-Anatomy has no cord objects); the long thoracic nerve is moved
behind the plexus; the sympathetic trunk is shifted 1 cm laterally.
Used by: `scenes/plexus.js`.

## hand (Z-Anatomy right forearm and hand bones)

`hand.js` is baked from the **zanatomy** source above (CC BY-SA 4.0; BodyParts3D, CC BY-SA 2.1 JP):
`Radius.r`, `Ulna.r`, the eight carpal bones (merged), each metacarpal and each phalanx of the right
hand as separate parts (config `tools/meshes/configs/hand.json`). Changes: decimated. The `plexus`
scene poses these bones (rotations at the shoulder, elbow, wrist and finger joints) to show the
waiter's tip, claw hand and wrist drop.
Used by: `scenes/plexus.js`.

## knee (Z-Anatomy right knee)

`knee.js` is baked from the **zanatomy** source above (CC BY-SA 4.0; BodyParts3D, CC BY-SA 2.1 JP):
`Femur.r`, `Tibia.r`, `Fibula.r`, `Patella.r`, `Anterior cruciate ligament.r`,
`Posterior cruciate ligament.r`, superficial and deep parts of the tibial collateral ligament,
`Fibular collateral ligament.r`, `Medial meniscus.r` and `Lateral meniscus.r`
(config `tools/meshes/configs/knee.json`). Changes: subdivision cages (menisci, ligament sheets,
patella) subdivided and Taubin-smoothed; decimated. The `knee` scene splits the cruciate, collateral
and meniscus meshes along planes to show tears, moves the tibia for the drawer/sag/valgus signs, and
adds a drawn patellar ligament (Z-Anatomy has only its attachment areas).
Used by: `scenes/knee.js`.
