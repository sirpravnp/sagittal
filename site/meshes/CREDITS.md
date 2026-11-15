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

Z-Anatomy also lists, among the models it "used as reference/included and adapted",
**"Cranial Nerves and Foramina" by the University of Dundee, Centre for Anatomy and Human
Identification (CAHID)**, licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), and
"Brainder" and "White matter" from the University of Washington (see Z-Anatomy's `License.txt`).
The cranial-nerve curves sagittal uses (see `willis` below) may derive from the Dundee set, so it is
credited here; sagittal cannot tell from the Blender file which objects came from which set.

Used by: every mesh below with credit `zanatomy`: `thorax.js` (sternum, ribs, costal cartilages,
thoracic vertebrae and discs), `airways.js`, `aorta.js`, `chest.js`, `biliary.js`, `groin.js`,
`eye.js`, `upper-limb.js`, `hand.js`, `knee.js`, `willis.js`, `cranium.js`, `endocast.js`,
`portal.js` and `thyroid.js`. Z-Anatomy centre-line coordinates are also embedded in the scene
scripts `heart.js`, `cor.js`, `bil.js`, `plexus.js`, `portal.js` and `thyroid.js` (see below); that
coordinate data stays CC BY-SA 4.0 although the surrounding scene code is MIT.

## rodero-heart

Rodero C, Strocchi M, Marciniak M, et al. *Linking statistical shape models and simulated function
in the healthy adult human heart.* PLoS Comput Biol 17(4): e1008851 (2021). Data: "Virtual cohort of
extreme and average four-chamber heart meshes from statistical shape model", Zenodo,
doi:[10.5281/zenodo.4593739](https://doi.org/10.5281/zenodo.4593739).
Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
Used by: `heart.js` and `heart-blood.js` (scenes `heart` and `cor`); see the wave-B entry below.

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
## cor (coronary arteries on the Rodero heart; scene script `site/scenes/cor.js`)

The `cor` scene draws the Rodero heart above (`heart.js`, CC BY 4.0) with coronary arteries whose
centre lines are **Z-Anatomy** curve objects (see `zanatomy` above, CC BY-SA 4.0 on BodyParts3D,
CC BY-SA 2.1 JP): left main, LAD with diagonal and right-ventricular branches, circumflex with
marginal and posterolateral branches, RCA with right-ventricular and acute marginal branches and
its inferolateral branch. Changes: registered onto the Rodero heart (similarity ICP of the Z-Anatomy
chambers onto the Rodero chamber walls), projected onto the Rodero epicardium, resampled and
embedded as coordinates in `site/scenes/cor.js` (that data is CC BY-SA 4.0). The PDA (which Z-Anatomy
lacks) follows the Rodero posterior interventricular groove; the SA and AV nodal branches are
schematic. Myocardial territories are computed at build time (nearest drawn artery), an
approximation rather than source data. The combined scene is shared under CC BY-SA 4.0.
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
## willis (Z-Anatomy circle of Willis, cranial nerves, brainstem)

`willis.js` is baked from the **zanatomy** source above (CC BY-SA 4.0; BodyParts3D, CC BY-SA 2.1 JP)
(config `tools/meshes/configs/willis.json`, objects listed in `tools/meshes/zanatomy_extract_neuro.txt`,
extracted into the asset cache's `zanatomy-neuro/obj/`): internal carotid, anterior cerebral (with its
orbitofrontal branches), middle cerebral (M1, insular M2, M3, temporal and parietal branches), posterior
communicating, posterior cerebral, basilar, vertebral, superior cerebellar, anterior and posterior inferior
cerebellar and ophthalmic arteries; oculomotor nerves, optic nerves and tracts; pons, midbrain and medulla.
Changes: curve tubes swept and decimated; centred on (0, 161, 0) cm of the Z-Anatomy frame, shared with
`endocast.js` and `cranium.js`. Z-Anatomy's anterior communicating artery and optic chiasm objects are not
used: the `cow` scene draws the ACom between the two A1 segments and the chiasm between the optic nerves
and tracts. No Brainder cortex or white-matter objects are used.
Possible further source: the oculomotor nerves, optic nerves and tracts are hand-drawn curve objects in
Z-Anatomy, consistent with the **University of Dundee CAHID "Cranial Nerves and Foramina"** set
(CC BY 4.0) that Z-Anatomy lists as adapted, so that work is credited for them as well (see `zanatomy`).
Open provenance question: the pons, midbrain and medulla (mirrored `.l`/`.r` halves with equal vertex
counts) look like Z-Anatomy remodels of BodyParts3D, but Z-Anatomy also lists "Brainder" (University of
Washington) as a source, and the local files cannot settle which. Brainder's meshes were published under
CC BY-SA, so the worst case is a missing attribution line, not an incompatible licence.
Used by: `scenes/cow.js`.
## cranium (Z-Anatomy cranial vault, meninges, middle meningeal artery)

`cranium.js` is baked from the **zanatomy** source above (CC BY-SA 4.0; BodyParts3D, CC BY-SA 2.1 JP)
(config `tools/meshes/configs/cranium.json`): frontal, parietal, temporal, occipital and sphenoid bones,
temporalis, epicranial aponeurosis, falx cerebri, superior sagittal sinus and middle meningeal arteries.
Changes: decimated, centred on (0, 161, 0) cm. The `bleed` scene clips them to a coronal slab and adds
section caps; skin, dura, arachnoid, subarachnoid space, pia and brain are drawn in code, fitted to the
section of `endocast.js`.
Used by: `scenes/bleed.js`.
## endocast (cranial cavity computed from the Z-Anatomy skull)

`endocast.js` is derived from the **zanatomy** skull bones above (CC BY-SA 4.0; BodyParts3D, CC BY-SA
2.1 JP): `tools/meshes/make_endocast.py` voxelises the frontal, parietal, temporal, occipital, sphenoid and
ethmoid bones (2 mm), seals small foramina, flood-fills the cranial cavity (closed by a plane through the
foramen magnum) and writes its surface, which `tools/meshes/configs/endocast.json` smooths and decimates.
It stands in for the brain base (cow) and the inner table (bleed); no brain-cortex objects are used.
Used by: `scenes/cow.js`, `scenes/bleed.js`.
## portal (Z-Anatomy abdominal organs for portal hypertension)

`portal.js` is baked from the **zanatomy** source above (CC BY-SA 4.0; BodyParts3D, CC BY-SA 2.1 JP):
`Liver`, `Spleen`, `Stomach`, `Pancreas`, `Duodenum`, `Sigmoid colon` (which in Z-Anatomy spans the
rectum and anal canal; baked as `rectum`), `External anal sphincter.l/.r` and `Umbilicus.l/.r`
(config `tools/meshes/configs/portal.json`; objects extracted into the asset cache's
`zanatomy-vascular/obj/`). Changes: subdivision cages subdivided and Taubin-smoothed, then
decimated; re-centred on [0, 105, 3] cm. The `portal` scene also draws the oesophagus and the portal,
splenic, superior and inferior mesenteric veins, IVC, hepatic vein stubs, azygos, iliac, internal
pudendal and epigastric veins as tubes along **Z-Anatomy** centre lines (same licence); the left
gastric, oesophageal, paraumbilical, rectal and caput medusae veins, intrahepatic branches and the
TIPS stent are procedural. Used by: `scenes/portal.js`.

## thyroid (Z-Anatomy larynx, trachea and great vessels)

`thyroid.js` is baked from the **zanatomy** source above (CC BY-SA 4.0; BodyParts3D, CC BY-SA 2.1 JP):
`Thyroid cartilage`, `Cricoid cartilage`, `Hyoid bone`, `Trachea`, the straight and oblique parts
of `cricothyroid muscle` (both sides), `Ascending aorta`, `Aortic arch`, `Brachiocephalic trunk`,
both common carotid, subclavian and external carotid arteries, both thyrocervical trunks, both
internal jugular and brachiocephalic veins, `Superior vena cava` and `Left pulmonary artery`
(config `tools/meshes/configs/thyroid.json`; objects in the asset cache's `zanatomy-vascular/obj/`).
Changes: decimated, re-centred on [0, 142, 0] cm. Z-Anatomy's thyroid gland (a thin shell over the
thyroid cartilage) and its vagus (no recurrent or external laryngeal branches) are not used: the
`thyroid` scene builds the gland, parathyroids, nerves and thyroid arteries procedurally on this
anatomy, partly along Z-Anatomy centre lines (vagus at the skull base, inferior thyroid artery,
oesophagus, descending aorta). Used by: `scenes/thyroid.js`.
## totalsegmentator

**TotalSegmentator CT dataset v2.0.1**: Wasserthal J, Breit H-C, Meyer MT, et al. *TotalSegmentator:
Robust Segmentation of 104 Anatomic Structures in CT Images.* Radiol Artif Intell 2023;5(5):e230024.
Data: "Dataset with segmentations of 117 important anatomical structures in 1228 CT images", Zenodo,
doi:[10.5281/zenodo.10047292](https://doi.org/10.5281/zenodo.10047292).
Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (the dataset's CT images and masks;
no TotalSegmentator model output, and none of its non-commercial "licensed" tasks, is used).

Subject used: **s1304** (CT polytrauma, male, 67, meta.csv pathology "no_pathology"); only its
`segmentations/*.nii.gz` masks were downloaded (single files read out of the Zenodo archive by HTTP
range requests). Changes made for sagittal: masks meshed with `tools/meshes/ct_to_obj.py` (largest
component, Gaussian blur 1 mm, marching cubes, Taubin smoothing), mapped into the organ library's body
frame by `tools/organs/register.py` (similarity transforms fitted on the vertebrae or, for the brain,
on Z-Anatomy's cranial cavity; each kidney then translated to meet Z-Anatomy's renal artery and
vein, each adrenal moved vertically with its kidney; residuals in `tools/organs/registration.json`), smoothed and decimated by
`tools/meshes/bake.py`.

Used by: `organs/meshes/kidneys.js`, `organs/meshes/adrenals.js`, `organs/meshes/thyroid.js`,
`organs/meshes/brain.js`.

## organ library (organs/, credits `zanatomy`, `rodero-heart`, `totalsegmentator`)

The base organ library in `organs/` (meshes `organs/meshes/<id>.js`, manifests
`organs/manifests/<id>.json`) is built by `tools/organs/build.py` from the sources above:

- **zanatomy** (Z-Anatomy, CC BY-SA 4.0 on BodyParts3D, CC BY-SA 2.1 JP): `aorta`, `coeliac-trunk`,
  `mesenteric-arteries`, `venae-cavae`, `portal-venous`, `liver`, `liver-segments`, `gallbladder`,
  `pancreas`, `oesophagus`, `stomach`, `duodenum`, `small-intestine`, `colon`, `spleen`, `lungs`,
  `airways`, `bladder`, `male-reproductive`. Objects extracted with
  `tools/meshes/extract_blend.py` into the asset cache's `zanatomy-organs/obj/`; vessels, ducts,
  airways, oesophagus, small intestine and urethra are Z-Anatomy centre-line curves swept into tubes,
  and the manifests' centre lines are the same curves' points (dumped by `tools/organs/dump_curves.py`),
  converted to centimetres. Z-Anatomy's kidney, renal pelvis and intrarenal vessels (credited by
  Z-Anatomy to a CC BY-NC model) are not used, nor its ureters and suprarenal glands (they may come
  from the same model; licence unclear).
- **rodero-heart** (CC BY 4.0): `heart` (chamber walls and aortic root of the average heart), mapped
  onto the Z-Anatomy heart by a similarity fit on chamber centroids and valve centres.
- **totalsegmentator** (CC BY 4.0): `kidneys`, `adrenals`, `thyroid`, `brain` (see above).

Landmarks in the manifests are computed from this geometry (curve end points, branch points, mesh
extremes, centroids, nearest points); the rule for each is stated in its `derived` field. All organs
share one frame, so they can be combined; a combined figure that includes a Z-Anatomy organ is
CC BY-SA 4.0.
