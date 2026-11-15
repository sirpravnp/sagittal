# Seed CT segmentations -> sagittal meshes

A CT segmentation is a label volume (one integer per voxel: 0 background, k = structure k) or a
set of binary masks. `tools/meshes/ct_to_obj.py` turns it into OBJ surfaces already in
sagittal's frame; `tools/meshes/bake.py` then decimates and packs them like any other source.

## Sources and licences (checked 2026-11-15; re-check the record before downloading)

| source | what | licence | use? |
|---|---|---|---|
| TotalSegmentator CT dataset v2.0.1, Zenodo [10.5281/zenodo.10047292](https://zenodo.org/records/10047292) (concept DOI [10.5281/zenodo.6802613](https://doi.org/10.5281/zenodo.6802613)) | 1228 CTs with masks of 117 structures, `Totalsegmentator_dataset_v201.zip`, 23.6 GB | **CC BY 4.0** (Zenodo licence field) | yes, CT and masks |
| TotalSegmentator MRI dataset, Zenodo [10.5281/zenodo.11367004](https://zenodo.org/doi/10.5281/zenodo.11367004) | MR images with masks of 50 regions, ~15 GB | **CC BY 4.0** | yes |
| TotalSegmentator software, [github.com/wasserth/TotalSegmentator](https://github.com/wasserth/TotalSegmentator) | segmentation model to run on a CT you may use | code and open tasks (`total`, `total_mr`, `lung_vessels`, `body`, ...) **Apache-2.0** | yes, open tasks only |
| TotalSegmentator "licensed" tasks (`appendicular_bones`, `tissue_types`, `heartchambers_highres`, ...) | | free for non-commercial use only; commercial licence on request | **no** (incompatible with CC BY-SA content) |
| TotalSegmentator `brain_aneurysm` task | | CC BY-NC 4.0 | **no** |
| AbdomenAtlas 1.0/1.1 | abdominal CT masks | CC BY-NC-SA 4.0, plus access terms forbidding redistribution | **no** |
| MedShapeNet | shape collection from many datasets | per-source licences, several unstated | only per shape, with its source's licence verified |
| Rodero et al. 2021 heart (already used), Zenodo [10.5281/zenodo.4593739](https://doi.org/10.5281/zenodo.4593739) | CT-derived average four-chamber tet mesh | CC BY 4.0 | yes (already in the cache) |

Rules:
- The baked mesh inherits the licence of the **CT and masks** it came from. Running an Apache-2.0
  model does not make a scan open: segment only CTs whose own licence is CC BY / CC BY-SA / CC0.
- Never use a mask set or model task with NC/ND terms or unclear licence, however convenient.
- Downloads go to `../sagittal-assets-cache/ct-<source>/` (keep the total under 1 GB: from the
  23.6 GB TotalSegmentator archive take only the subjects you need, e.g. via its small
  subset or by extracting single subjects), with a `README.md` saying URL, DOI, date, licence
  and which subject ids you used.
- Add a CREDITS section, e.g. heading `## totalsegmentator`, citing: Wasserthal J, et al.
  *TotalSegmentator: Robust Segmentation of 104 Anatomic Structures in CT Images.* Radiol Artif
  Intell 2023;5(5):e230024; the dataset DOI; CC BY 4.0; subject ids; and the changes
  (marching cubes, smoothing, decimation, frame conversion).

Dataset layout (TotalSegmentator v2): one folder per subject, `sXXXX/ct.nii.gz` and
`sXXXX/segmentations/<class>.nii.gz` (one binary mask per class), plus `meta.csv` (age, sex,
scanner, pathology notes). Choose subjects with normal anatomy for a normal scene unless the
pathology itself is the point, and read `meta.csv` first.

Running the open model on an open CT instead (needs `pip install TotalSegmentator`, PyTorch,
GPU recommended; not part of this repo's requirements):

```sh
TotalSegmentator -i ct.nii.gz -o seg.nii.gz --ml              # one multi-label volume
TotalSegmentator -i ct.nii.gz -o segdir --roi_subset liver gallbladder   # only some classes
```

For `--ml` output the id-to-class map is `totalsegmentator.map_to_binary.class_map['total']`.

## Frame maths

NIfTI world space (what nibabel's affine gives) is **RAS+ in mm**: +X patient's right,
+Y anterior, +Z superior. DICOM/ITK/3D Slicer model files use **LPS mm**: +X left,
+Y posterior, +Z superior. sagittal is **cm, +x left, +y superior, +z anterior**.

| from | sagittal x | y | z | bake `transform` if the OBJ is still in that frame |
|---|---|---|---|---|
| RAS mm | -X | Z | Y | `{"axes": ["-x", "z", "y"], "scale": 0.1}` |
| LPS mm (Slicer, ITK, Rodero) | X | Z | -Y | `{"axes": ["x", "z", "-y"], "scale": 0.1}` |
| ct_to_obj.py output | x | y | z | `{"axes": ["x", "y", "z"], "scale": 1}` |

`ct_to_obj.py` applies the full voxel-to-world affine (so oblique, flipped and permuted
storage all come out right), then RAS -> sagittal, then fixes triangle winding so normals
face outward. Never reorient by guessing from the array axes: always go through the affine.
Check sidedness after every bake: the patient's left structure must have positive x.

## Pipeline

```sh
CACHE=../sagittal-assets-cache
# 1. inspect: orientation code, voxel size, label ids, volumes in cm^3
.venv/bin/python tools/meshes/ct_to_obj.py --volume seg.nii.gz --list

# 2a. multi-label volume: one --part per output OBJ, ids merged
.venv/bin/python tools/meshes/ct_to_obj.py --volume seg.nii.gz \
  --part liver=5 --part kidneys=2,3 --out $CACHE/ct-totalseg/obj

# 2b. or binary masks (dataset layout)
S=$CACHE/ct-totalseg/s0011/segmentations
.venv/bin/python tools/meshes/ct_to_obj.py --out $CACHE/ct-totalseg/obj \
  --mask liver=$S/liver.nii.gz --mask gallbladder=$S/gallbladder.nii.gz
```

Per part: select voxels -> drop connected components under `--min-voxels` (default 64:
segmentation specks) -> Gaussian blur of the mask (`--sigma-mm`, default 1.0: removes the voxel
staircase; lower it for thin structures, the tool stops if a part vanishes) -> marching cubes at
0.5 -> Taubin smoothing (`--smooth`, default 10) -> pre-decimation to `--max-tris` (default
60,000) -> OBJ with a header (source, labels, orientation, voxel size) and a row in
`index.tsv` (voxels, triangles, bbox in cm). It prints each part's enclosed volume: compare
with known organ volumes (adult liver ~1,500 cm^3) as a sanity check of units.

3. Bake config:

```json
{
  "name": "abdomen-ct",
  "credit": "totalsegmentator",
  "license": "CC BY 4.0",
  "source": "TotalSegmentator CT dataset v2.0.1 (doi:10.5281/zenodo.10047292), subject s0011; tools/meshes/ct_to_obj.py",
  "source_root": "${ASSETS}/ct-totalseg/obj",
  "transform": { "axes": ["x", "y", "z"], "scale": 1 },
  "center": "bbox",
  "parts": {
    "liver": { "files": ["liver.obj"], "budget": 5000 },
    "gallbladder": { "files": ["gallbladder.obj"], "budget": 1500, "smooth": 2 }
  }
}
```

Then `.venv/bin/python tools/meshes/bake.py tools/meshes/configs/abdomen-ct.json` and `npm test`.

## Judging a CT mesh

- Segmentation masks are not anatomy textbooks: check for holes, merged neighbours (e.g. a
  vessel fused to an organ), cut-off ends at the scan boundary, and partial-volume blobs.
  Look at it rendered, from several angles, before building a scene on it.
- One subject is one person: its proportions, situs and variants are real but may not be
  typical. Prefer a normal-anatomy subject and say in the report which one you used.
- CT masks of different subjects do not register to each other or to Z-Anatomy; take all
  structures of one scene from the same subject, or register explicitly on landmarks and
  report the residuals.
- Thin tubular structures (small arteries, ducts, nerves) segment poorly; take them from
  Z-Anatomy curves or draw them along a centre line instead.
