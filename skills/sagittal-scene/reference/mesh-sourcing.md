# Sourcing meshes

Work down this list and stop at the first source that gives correct geometry for every
structure the finding depends on. Mixing is normal (real organs + procedural overlay).
Paths: the asset cache is `../sagittal-assets-cache/` next to the repo (bake.py also finds it one
level higher for worktrees, or via `$SAGITTAL_ASSETS`). It is shared and read-only: add new
folders, never modify or delete existing ones.

## 1. Already baked (`site/meshes/`)

Check first: free in size and credits. Print the current list with
`for f in site/meshes/*.js; do head -c 300 $f | tail -c 200; echo; done` or load one in node
(see `tests/meshes.test.mjs`); the printed list is authoritative if this table falls behind.
As of wave C (2026-11):

| mesh | KB | credit | offset (cm) | parts |
|---|---|---|---|---|
| `thorax` | 326 | zanatomy | [0, 125.49, 0.61] | sternum, ribs_left/right, costal_cartilage_left/right, thoracic_spine, thoracic_discs |
| `chest` | 282 | zanatomy | [0, 125.49, 0.61] (registers with thorax) | lung_right, lung_left, airway, heart, aorta, pulmonary_arteries, great_veins, diaphragm |
| `airways` | 390 | zanatomy | [0, 140.78, -0.18] | trachea, main/intermediate/lobar bronchi, all 20 segmental bronchi, 5 lobes, thoracic_spine |
| `aorta` | 236 | zanatomy | [-0.06, 123.04, 1.70] | aorta, arch_branches, iliac, visceral_branches, heart |
| `biliary` | 259 | zanatomy | [-2, 113, 4] | liver, gallbladder, pancreas, pancreatic_duct, duodenum, portal_vein, hepatic_artery |
| `groin` (right side) | 385 | zanatomy | [-5, 89, 4] | inguinal_ligament, abdominal wall layers, rectus, inferior epigastric a/v, femoral a/v/n, ductus_deferens, testicular_vessels, testis, hip_bone, pubic_symphysis, pectineus, iliopsoas |
| `eye` (right) | 355 | zanatomy | [-3.06, 159.07, 6.33] | sclera, cornea, iris, lens, retina, vitreous, anterior_chamber, optic_nerve |
| `heart` | 251 | rodero-heart | [-0.4, 0.9, 0.2] | wall_lv, wall_rv, wall_la, wall_ra, aorta (root) |
| `heart-blood` | 179 | rodero-heart | [-0.4, 0.9, 0.2] | cav_lv, cav_rv, cav_la, cav_ra (blood casts) |
| `upper-limb` (right) | 370 | zanatomy | [0, 0, 0] (raw Z-Anatomy frame) | spine, rib1, ribs, clavicle, scapula, humerus, scalenus_anterior, scalenus_medius, serratus_anterior |
| `hand` (right) | 113 | zanatomy | [0, 0, 0] | radius, ulna, carpals, mc1-mc5, and each phalanx (pp1, dp1, pp2, mp2, dp2, ... dp5) |
| `knee` (right) | 196 | zanatomy | [0, 0, 0] | femur, tibia, fibula, patella, acl, pcl, mcl_sup, mcl_deep, lcl, med_meniscus, lat_meniscus |
| `willis` | 321 | zanatomy (+ possibly Dundee CAHID for CN II/III) | [0, 161, 0] | ica_l/r, ophthalmic, aca, aca_branches, m1_l/r, mca_br_l/r, pcom_l/r, pca, basilar, vertebral, sca, aica, pica, cn3_l/r, brainstem, optic_nerves, optic_tracts |
| `cranium` | 328 | zanatomy | [0, 161, 0] (registers with willis) | frontal, parietal_l/r, temporal_l/r, occipital, sphenoid, temporalis_l/r, galea, falx, sss, mma_l/r |
| `endocast` | 94 | zanatomy (computed) | [0, 161, 0] | endocast (cranial cavity) |
| `portal` | 280 | zanatomy | [0, 105, 3] | liver, spleen, stomach, pancreas, duodenum, rectum, anal_sphincter, umbilicus |
| `thyroid` | 273 | zanatomy | [0, 142, 0] | thyroid_cartilage, cricoid, hyoid, trachea, cricothyroid, aorta, brachiocephalic_trunk, carotids, subclavians, external_carotids, thyrocervical, jugular_veins, pulmonary |

Two Z-Anatomy meshes register in the scene by shifting one by the difference of their
`offset`s (both are Blender world coordinates in cm). Rodero meshes are in their own frame.

A scene may list several meshes but their sum must stay ≤ 800 KB, and big meshes cost load
time on every card. If a baked mesh has 3 parts you need and 10 you don't, bake a smaller
mesh of your own from the same sources instead.

## 2. Z-Anatomy (asset cache)

Z-Anatomy (CC BY-SA 4.0, on BodyParts3D CC BY-SA 2.1 JP) is a whole adult **male** body:
bones, muscles, vessels, nerves, organs. Look up every structure you need:

```sh
CACHE=../sagittal-assets-cache
grep -i 'scaphoid\|radial artery' $CACHE/zanatomy/objects.tsv     # name, kind, verts, polys, modifiers
ls $CACHE/zanatomy*/obj/ | grep -i scaphoid                          # already extracted somewhere?
```

Reading `objects.tsv`:
- `mesh` with `subsurf`: coarse cage. Bake with `"subdivide": 1, "smooth": 6-10`.
- `curve(bevel=...)`: vessel, duct, nerve or bronchus as a centre-line curve; the extractor
  sweeps it into a tube (`--sides 24` for a smoother tube). Tubes decimate well; a 1-2 mm tube
  cannot be dilated convincingly, so for a lesion that changes calibre, sample its centre line
  and draw your own tube along it (`bil.js` `BD`).
- Names ending `.i .j .g .s .t` are label anchors or text, not anatomy. `.l/.r` = side.
- Muscles have separate origin/insertion objects (`.ol`, `.el`); use the main body.

Known gaps (draw procedurally or use a CT source): no female pelvic organs; no choroid or
ciliary body; no cystic or common hepatic duct objects; no spermatic cord sheath; no
bronchopulmonary segment volumes; small arterial branches are often missing.

Forbidden objects: anything from "Anatomy of the Inner Ear" (CC BY-NC-SA) and "Kidney" (Lissie
Cowley, CC BY-NC); brain white matter / cortical parcellation (licence unclear).

Extract into your own folder (pure Python, no Blender needed):

```sh
.venv/bin/python tools/meshes/extract_blend.py \
  $CACHE/zanatomy/extracted/Z-Anatomy/Startup.blend \
  --out $CACHE/zanatomy-<topic>/obj --sides 24 \
  --match '^Scaphoid bone\.r$' --match '^Radial artery\.r$' --match '^Radius\.r$'
```

Output files use underscores (`Scaphoid_bone.r.obj`), in Blender world space (metres, +X
patient's left, -Y anterior, +Z up), so the bake config uses `"transform": "zanatomy"`.
`index.tsv` in the output folder lists bbox and triangle counts.

## 3. CT segmentations

See `seed-ct.md`. Use when Z-Anatomy lacks the structure, when a CT-shaped organ (real
patient proportions, a pathology present on a real scan) matters, or when you need a whole
region in one consistent frame.

## 4. Procedural

Only when 1-3 have nothing. Build from real dimensions (state them in a comment with their
source), fit to the neighbouring real meshes by measured coordinates, use `Kit.tissue`
materials, and add a CREDITS section saying "procedural, no third-party model".

## Worked example: scaphoid fracture and its blood supply

1. Baked meshes: nothing covers the wrist.
2. Z-Anatomy: `Scaphoid bone.r`, `Lunate bone.r` (subsurf), `Trapezium bone.r`,
   `Capitate bone.r`, `Radius.r`, `Ulna.r`, `First metacarpal bone.r` (meshes) and
   `Radial artery.r`, `Palmar carpal branch of radial artery.r` (curves) exist. There is no
   object for the dorsal carpal branch or the vessels entering the scaphoid's dorsal ridge.
3. CT: TotalSegmentator's open `total` task has no carpal bones; its `appendicular_bones` task
   (which has a merged `carpal` class) is licensed for non-commercial use only, so it is out.
4. So: bake the right wrist bones and radial artery from Z-Anatomy (subdivide/smooth the
   cages), draw the dorsal ridge branches as short procedural tubes leaving the real radial
   artery at the real dorsal ridge (from the scaphoid mesh), split the scaphoid at its waist
   at runtime for the fracture variant (clip planes or a triangle split, as `flail.js` splits
   ribs), and shade the proximal pole for the AVN variant. Say in the scene header and CREDITS
   which vessels are procedural.

## Bake config template (Z-Anatomy)

```json
{
  "name": "wrist",
  "credit": "zanatomy",
  "license": "CC BY-SA 4.0",
  "source": "Z-Anatomy Startup.blend, extracted with tools/meshes/extract_blend.py --sides 24 into zanatomy-wrist/obj",
  "source_root": "${ASSETS}/zanatomy-wrist/obj",
  "transform": "zanatomy",
  "center": "part:scaphoid",
  "default_budget": 1200,
  "parts": {
    "scaphoid": { "files": ["Scaphoid_bone.r.obj"], "budget": 2000, "subdivide": 1, "smooth": 4 },
    "carpals":  { "files": ["Lunate_bone.r.obj", "Capitate_bone.r.obj", "Trapezium_bone.r.obj"], "budget": 3000, "subdivide": 1, "smooth": 4 },
    "radial_artery": { "files": ["Radial_artery.r.obj"], "budget": 600 }
  }
}
```

After the first bake, read the printed offset and replace `"part:scaphoid"` with that literal
`[x, y, z]` if the scene will hard-code any coordinates.
