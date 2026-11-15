# Base organ library

Real reconstructed anatomy for sagittal's text-to-image figures: one baked mesh and one manifest per
organ, all in **one shared body frame**, so any set of organs can be combined in a figure and new
vessels can be routed only through named landmarks and centre lines (see
`docs/superpowers/specs/2026-11-15-sagittal-text-to-image-design.md`).

```
organs/index.json               [{id, name, system}]
organs/manifests/<id>.json      schema sagittal-organ/0 (below)
organs/meshes/<id>.js           baked mesh, same format as site/meshes (window.SagittalMeshes[<id>])
```

## Frame

Centimetres, **+x patient's left, +y superior, +z anterior** (sagittal's frame, `docs/meshes.md`).
The origin is Z-Anatomy's world origin (Blender x, z, -y times 100), so heights are large (the aortic
bifurcation is at y = 103 cm, the carina at y = 137 cm). Every mesh is baked with `"center": [0, 0, 0]`
(`offset` is `[0, 0, 0]`), so mesh vertices, centre lines and landmarks are all in this frame. In a
scene, put the organs in one group, translate it by minus the point of interest and scale it
(e.g. `0.12`), as with any other mesh.

Organs from other sources were mapped into this frame by similarity transforms
(`tools/organs/register.py`, residuals in `tools/organs/registration.json`):

| organ | source | fitted on | residual |
|---|---|---|---|
| heart | Rodero average heart | 4 chamber centroids + aortic and pulmonary valve centres of the Z-Anatomy heart | RMS 0.49 cm (max 0.79) |
| kidneys | TotalSegmentator s1304 | vertebrae T10-L4 (ICP), then each kidney translated so its hilum meets Z-Anatomy's renal artery and renal vein ends | vertebra centroids RMS 0.79 cm; vessel ends 1.0-1.25 cm from the kidney surface |
| adrenals | TotalSegmentator s1304 | same vertebra fit, then the vertical component of the same-side kidney's translation | 0.5 (right) / 1.8 (left) cm above the kidney; >= 1.1 cm clear of aorta and IVC walls |
| thyroid | TotalSegmentator s1304 | vertebrae C3-T3 (ICP) | vertebra centroids RMS 0.22 cm |
| brain | TotalSegmentator s1304 | Z-Anatomy cranial-cavity endocast (ICP) | surface RMS 0.32 cm, p95 0.65 cm |

## Manifest schema (`sagittal-organ/0`)

```json
{"schema": "sagittal-organ/0", "id": "gallbladder", "name": "Gallbladder and bile duct",
 "system": "Hepatobiliary", "mesh": "gallbladder", "credit": "zanatomy",
 "parts": [{"id": "gallbladder", "name": "Gallbladder", "tissue": "gallbladder"}],
 "centerlines": {"bile_duct": {"name": "...", "points": [[x,y,z], ...], "radius_cm": 0.1, "from": "bile_duct_upper_end", "parent": null}},
 "landmarks": {"gallbladder_neck": {"name": "...", "p": [x,y,z], "derived": "baked 'gallbladder' vertex nearest landmark ..."}}}
```

- `parts[].id` is the part name in the mesh file (`Kit.meshPart(group, mesh, part.id, part.tissue)`);
  `tissue` is the closest `Kit.tissue` preset (the kit has no brain, kidney or gland preset: brain uses
  `nerve`, kidneys and spleen `liver`, glands `pancreas`, urinary and genital tubes `bowel`).
- `centerlines`: Z-Anatomy curve objects taken point for point (the evaluated curve that is swept
  into the tube in the mesh), thinned so consecutive points are at least 0.25 cm apart (1 cm for the
  2 m small intestine); no point is invented or moved. `radius_cm` is the mean swept radius. A branch
  runs **from its parent**: its first point is the end nearest the parent's centre line, and `from`
  names the landmark at that point (`<id>_origin` for arteries, ducts and airways, `<id>_junction` for
  veins, `<id>_start` for a segment continuing the previous one). Root lines name a landmark or null.
  `parent` is the id of the centre line this one branches from (or drains into), or null for a root
  line; ids are unique across the library, so it may name a line in another organ (the coeliac
  trunk's parent is `abdominal_aorta`). It is the curated parent from `tools/organs/organs.json`
  where that names one, else the nearest centre line of the same system to the first point
  (within 1.5 cm, ignoring lines that start at the same point); `tools/organs/parents.mjs` writes it
  and prints the table. The figure validator refuses to remove a line while a child still hangs off it.
  Splines of a multi-spline source object that the source does not name are called
  "... (unnamed in source)": do not give them a textbook name.
- `landmarks`: ids are unique across the whole library (a variant may route from any organ's landmark).
  Every landmark is computed from the source geometry by a rule in `tools/organs/organs.json`; the
  `derived` field states the rule and any gap (e.g. "lies 1.17 cm from that line"). Mesh landmarks
  use the baked vertices, so they lie on the rendered surface.

## Organs

| id | system | source | notes |
|---|---|---|---|
| brain | Nervous | TotalSegmentator | one CT surface (cerebrum, cerebellum, brainstem); no gyri or parts |
| heart | Cardiovascular | Rodero | chamber walls, aortic root; valve-centre landmarks |
| aorta | Cardiovascular | Z-Anatomy | aorta, arch branches, renal, common/external/internal iliac arteries |
| coeliac-trunk | Cardiovascular | Z-Anatomy | coeliac trunk, common and proper hepatic, gastroduodenal, left gastric, splenic arteries |
| mesenteric-arteries | Cardiovascular | Z-Anatomy | SMA and its source branches, ileocolic, right and middle colic, inferior pancreaticoduodenal; IMA, left colic, sigmoid, superior rectal |
| venae-cavae | Cardiovascular | Z-Anatomy | IVC, SVC, brachiocephalic, hepatic (2 stubs), renal and iliac veins |
| portal-venous | Cardiovascular | Z-Anatomy | portal vein, splenic vein, SMV, IMV |
| liver, liver-segments | Hepatobiliary | Z-Anatomy | whole liver; Couinaud segments I-VIII as separate parts |
| gallbladder | Hepatobiliary | Z-Anatomy | gallbladder and the bile duct (CBD) |
| pancreas | Gastrointestinal | Z-Anatomy | pancreas, main and accessory pancreatic ducts |
| oesophagus, stomach, duodenum, small-intestine, colon | Gastrointestinal | Z-Anatomy | colon: ascending, transverse, descending, sigmoid with rectum and anal canal, appendix |
| spleen | Lymphoid | Z-Anatomy | |
| lungs, airways | Respiratory | Z-Anatomy | five lobes; trachea, main, intermediate and lobar bronchi |
| thyroid | Endocrine | TotalSegmentator | |
| adrenals | Endocrine | TotalSegmentator | |
| kidneys | Urinary | TotalSegmentator | |
| bladder | Urinary | Z-Anatomy | bladder with the (male) urethra |
| male-reproductive | Reproductive | Z-Anatomy | prostate, seminal glands, testes, epididymides, ductus deferens, ejaculatory ducts, penis |

Credits: `site/meshes/CREDITS.md` (`zanatomy`, `rodero-heart`, `totalsegmentator`, and the "organ
library" section). Any figure that includes a Z-Anatomy organ is CC BY-SA 4.0.

## Gaps (not in any source used; do not draw them from memory)

- **Ureters**: Z-Anatomy's ureter curves are not used (they may come from the CC BY-NC kidney model
  Z-Anatomy credits; licence unclear), and TotalSegmentator's open `total` task and dataset have no
  ureter class (s1304 has none). Z-Anatomy's suprarenal glands are excluded for the same reason
  (adrenals come from TotalSegmentator).
- **Cystic duct, common hepatic duct, right and left hepatic ducts**: Z-Anatomy has only the bile
  duct (CBD); TotalSegmentator has no biliary classes. `bile_duct_upper_end` marks where the CBD
  begins, i.e. where the cystic and common hepatic ducts would join.
- **Right and left hepatic arteries, cystic artery, right gastric artery**: Z-Anatomy's "Proper
  hepatic artery" runs on into the right lobe (with two short unnamed branches); there is no left
  hepatic branch, and no point where the proper hepatic artery is defined to end.
- Hepatic veins: two short unnamed stubs only (no right / middle / left hepatic vein).
- Caecum: no separate object (Z-Anatomy's ascending colon may include it; not verified). Rectum and
  anal canal are inside the "Sigmoid colon" object. Jejunum and ileum are one tube without a boundary.
- Female reproductive organs: none (Z-Anatomy is a male model; TotalSegmentator has no uterus or ovary).
- Trachea centre line: the trachea is a mesh in the source (landmarks: `carina`, `trachea_upper_end`).
- Pancreatic duct side branches (< 0.7 cm) are in the mesh but have no centre lines; in the source the
  accessory duct does not reach the main duct (1.8 cm gap).
- Brain: no lobes, gyri or deep structures (Z-Anatomy's cortex objects have an unclear licence; the
  Open Anatomy brain atlas was not used because its licence text was not reviewed).
- Not built yet but available in Z-Anatomy: pulmonary trunk and arteries, pulmonary veins, azygos
  system, gonadal vessels, diaphragm, segmental bronchi.

## Rebuild

From the repo root, with the asset cache at `$SAGITTAL_ASSETS`
(`/Users/.../sagittal-assets-cache`; worktrees must set it, the default path lookup misses it):

```sh
export SAGITTAL_ASSETS=/path/to/sagittal-assets-cache
B=$SAGITTAL_ASSETS/zanatomy/extracted/Z-Anatomy/Startup.blend
# 1. Z-Anatomy objects and curves (pure Python, no Blender)
.venv/bin/python tools/meshes/extract_blend.py $B --out $SAGITTAL_ASSETS/zanatomy-organs/obj \
  --sides 16 --match-file tools/organs/zanatomy_organs.txt
.venv/bin/python tools/organs/dump_curves.py $B --match '.' --out $SAGITTAL_ASSETS/zanatomy-organs/all_curves.json
# 2. CT organs (TotalSegmentator s1304 masks in ct-totalseg/raw, see its README.md)
S=$SAGITTAL_ASSETS/ct-totalseg/raw/s1304/segmentations
.venv/bin/python tools/meshes/ct_to_obj.py --out $SAGITTAL_ASSETS/ct-totalseg/obj \
  --mask kidney_left=$S/kidney_left.nii.gz --mask kidney_right=$S/kidney_right.nii.gz \
  --mask thyroid_gland=$S/thyroid_gland.nii.gz --mask brain=$S/brain.nii.gz \
  --mask adrenal_gland_left=$S/adrenal_gland_left.nii.gz --mask adrenal_gland_right=$S/adrenal_gland_right.nii.gz \
  $(for v in C3 C4 C5 C6 C7 T1 T2 T3 T10 T11 T12 L1 L2 L3 L4; do echo --mask vertebrae_$v=$S/vertebrae_$v.nii.gz; done)
# 3. register non-Z-Anatomy organs into the body frame (writes tools/organs/registration.json)
.venv/bin/python tools/organs/register.py
# 4. bake configs (tools/meshes/configs/organ-<id>.json), meshes, manifests, index
.venv/bin/python tools/organs/build.py
# 5. centre-line parents (writes "parent" into the manifests), then the runtime bundle
node tools/organs/parents.mjs && npm run organs
npm test && npm run test:py
```

To add or change an organ, edit `tools/organs/organs.json` (parts, centre lines with `curve`,
`spline`, `parent`; landmark rules: `curve_end`, `line_point`, `curve_ends_meet`, `mesh_extreme`,
`mesh_centroid`, `registered_centroid`, `mesh_nearest`, `mesh_farthest`, `mesh_contact`, `hilum_lid`,
`registration`) and rerun step 4. `mesh_centroid` takes the volume centroid about the part's vertex mean
(not the frame origin, which is 1-1.6 m away) and refuses a centroid outside the part unless the rule
says why in `outside` (the horseshoe thyroid). The heart chamber centroids are `registered_centroid`:
the centroid of the closed Rodero cavity (blood pool) surface mapped by the heart registration, because
the baked chamber walls are open at the valve rings (until Task 0b they were 12-48 cm outside the heart). `tests/organs.test.mjs` checks every manifest.
