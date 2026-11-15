# Baked anatomical meshes

Scenes can use real, open anatomical meshes as their base and draw teaching overlays
(arrows, rings, highlights, labels) on top. Meshes are baked offline into small classic
scripts in `site/meshes/`, so they load in the browser and inside Anki cards without
`fetch`, ES modules or a GLTF loader (three.js r149 has no classic-script GLTFLoader).

## The format

`site/meshes/<name>.js` (generated, never hand-edited):

```js
(window.SagittalMeshes = window.SagittalMeshes || {})["thorax"] = {
  parts: {
    sternum: {
      p: "<base64 Float32Array, xyz per vertex>",
      i: "<base64 Uint16Array or Uint32Array, 3 per triangle>",
      it: "u16",                 // or "u32" when a part has more than 65535 vertices
      n: "<base64 Float32Array>",// optional vertex normals; the kit computes them when absent
      bbox: [minx, miny, minz, maxx, maxy, maxz]  // cm, in the mesh frame below
    },
    ...
  },
  unit: "cm",
  credit: "zanatomy",           // a heading in site/meshes/CREDITS.md
  frame: "+x patient left, +y superior, +z anterior; cm",
  offset: [0, 125.49, 0.61],    // the source-frame point (cm) subtracted to centre the mesh
  version: 1
};
```

### Coordinate frame

Every mesh uses one frame, the same one the hand-built scenes already use:

| axis | direction           |
|------|---------------------|
| +x   | patient's **left**  |
| +y   | **superior**        |
| +z   | **anterior**        |

Units are **centimetres**. The baker centres each mesh file on the bounding box of all its
parts (configurable), and records what it subtracted in `offset`. Two meshes baked from the
same source can be registered to each other by shifting one by the difference of their
`offset`s, or bake both with `"center": "none"` and centre them in the scene.

Scenes are drawn at roughly 5 scene units across, so a mesh in centimetres usually needs a
scale: put the parts in a group and scale the group (`s.scale.setScalar(0.12)` fits a
whole adult thorax).

## Using meshes in a scene

```js
Kit.register({
  id: 'tension',
  meshes: ['thorax'],            // the viewer loads site/meshes/thorax.js before build()
  center: [0, 0, 0], zoom: 9, rot: [0.1, 0.6], controls: [...],
  build: function (g, st) {
    var body = new THREE.Group(); body.scale.setScalar(0.12); g.add(body);
    Kit.meshPart(body, 'thorax', 'ribs_left', 'bone');
    Kit.meshPart(body, 'thorax', 'ribs_right', 'bone');
    Kit.meshPart(body, 'thorax', 'sternum', Kit.tissue('bone', { opacity: 0.5 }));
    Kit.meshPart(body, 'thorax', 'costal_cartilage_left', 'cartilage');
    // ...teaching overlays with the old helpers, in scene units:
    Kit.helpers.arrow(g, [2, 0, 0], [0.5, 0, 0]);
    return { labels: [...], info: '...' };
  },
});
```

API (all on `window.Kit`):

- `Kit.meshPart(group, meshName, partName, material) -> THREE.Mesh`
  Adds one part to `group`. `material` is a `THREE.Material` or a tissue kind string
  (`'bone'` when omitted). Geometry is decoded from base64 once per page and shared between
  calls and rebuilds; do not mutate it (clone it first if you must). Throws a clear error if
  the mesh file is not loaded (the scene forgot `meshes: [...]`) or the part does not exist.
- `Kit.meshParts(meshName) -> string[]` part names, or `[]` if the mesh is not loaded.
- `Kit.meshInfo(meshName) -> { unit, credit, frame, offset, bbox: { part: [6 numbers] } }`,
  handy for placing labels and overlays relative to a part.
- `Kit.tissue(kind, opts?) -> THREE.MeshPhysicalMaterial` (a new material per call).
  `opts` overrides any material property (`color`, `opacity`, `emissive`, `clippingPlanes`,
  `side`...). Setting `opacity < 1` makes it transparent automatically.
  Kinds: `myocardium, vessel-artery, vessel-vein, blood-oxy, blood-deoxy, blood-mixed, bone,
  cartilage, lung, liver, gallbladder, bile-duct, pancreas, bowel, fascia, muscle, fat,
  uterus-serosa, myometrium, endometrium, fibroid, sclera, cornea, iris, lens, retina,
  choroid, nerve, air, highlight` (`Kit.tissueKinds()` lists them).
  `fascia`, `cornea`, `lens` and `air` are see-through by default. No preset uses
  transmission (it costs an extra render pass).
- `Kit.helpers.mat(...)` and the other procedural helpers are unchanged.

Loading order: `three.min.js -> kit/labels.js -> kit/kit.js -> app.js`; the viewer then
loads `scenes/<id>.js` (which only registers the SceneDef), then every
`meshes/<name>.js` the SceneDef lists, and only then calls `open()`, which runs `build()`.
So `build()` can always use its meshes, but code that runs at registration time must not.
The experimental 3D Anki card does the same (`_mesh_<name>.js` media files, packed by
`tools/build_decks.py --include-3d`, which reads `meshes: [...]` from the scene script; keep
it a literal array of string literals so the regex finds it).

## Rendering

The kit renders with ACES filmic tone mapping, sRGB output and
`THREE.ColorManagement.legacyMode = false` (hex colours are sRGB, as in CSS). Lighting is a
hemisphere fill, a warm key and a cool rim light that stay fixed relative to the camera, plus a
soft image-based environment: a 128x64 procedural studio texture prefiltered with PMREM (no
external HDR). There are no shadow maps and no post-processing passes. The environment roughly
costs 1.5x per frame on SwiftShader; `Kit.createViewer({ ..., environment: false })` turns it off.

## Baking a mesh

Sources live in the shared asset cache, outside any repo (default
`../sagittal-assets-cache`, or `$SAGITTAL_ASSETS`). See its `INVENTORY.md` for what is
already there, with file paths, triangle counts and licences.

1. Make sure the source files exist in the cache. For Z-Anatomy, objects are pulled out of
   its Blender file with the pure-Python extractor (no Blender needed):

   ```sh
   .venv/bin/python tools/meshes/extract_blend.py \
     <cache>/zanatomy/extracted/Z-Anatomy/Startup.blend \
     --out <cache>/zanatomy/obj --match-file tools/meshes/zanatomy_extract.txt
   ```

   Add a regex line to `tools/meshes/zanatomy_extract.txt` for anything new; `--list
   objects.tsv` writes every object name. Curves (vessels, ducts, nerves, bronchi) are swept
   into tubes. Subdivision modifiers are not applied (see `subdivide`/`smooth` below).

2. Write `tools/meshes/configs/<name>.json`:

   ```json
   {
     "name": "thorax",
     "credit": "zanatomy",
     "license": "CC BY-SA 4.0",
     "source": "Z-Anatomy Startup.blend, extracted with tools/meshes/extract_blend.py",
     "source_root": "${ASSETS}/zanatomy/obj",
     "transform": "zanatomy",
     "center": "bbox",
     "default_budget": 2000,
     "parts": {
       "sternum": { "files": ["Manubrium_of_sternum.obj", "Body_of_sternum.obj"], "budget": 1600 },
       "ribs_left": { "files": ["*_rib.l.obj"], "exclude": ["Costal_cartilage_*"], "budget": 5200 },
       "costal_cartilage_left": { "files": ["Costal_cartilage_of_*_rib.l.obj"], "budget": 1300,
                                  "subdivide": 1, "smooth": 6 }
     }
   }
   ```

   | key | meaning |
   |-----|---------|
   | `name` | output file `site/meshes/<name>.js`; `[a-z0-9-]+` |
   | `credit` | heading in `site/meshes/CREDITS.md` (add one for a new source) |
   | `license` | must be one of CC0, CC BY, CC BY-SA (any version), PD, MIT; anything else fails the bake |
   | `source_root` | directory the `files` patterns resolve against; `${ASSETS}` is the cache root |
   | `transform` | `"zanatomy"` (metres, Blender +X left, -Y anterior, +Z up) or `{"axes": ["x","z","-y"], "scale": 100}`: which source axis (with sign) becomes sagittal x, y, z, and the factor to centimetres |
   | `center` | `"bbox"` (default), `"none"`, `"part:<name>"`, or `[x, y, z]` in cm after the transform |
   | `default_budget` / `budget` | target triangles per part after decimation |
   | `files` / `exclude` | glob patterns (OBJ, PLY, STL, legacy ASCII VTK); all files in a part are merged |
   | `subdivide`, `smooth` | per part: midpoint subdivision passes, then Taubin smoothing iterations (for coarse subdivision-surface cages such as Z-Anatomy's organs) |
   | `weld` | vertex weld tolerance in source units (default 1e-4) |
   | `normals` | `true` to store normals (bigger file; normally the kit computes them) |
   | `decimate` | `"auto"` (quadric via fast-simplification, else clustering), `"quadric"`, `"cluster"` |
   | `max_bytes` | size cap, default 400 KB |

3. Bake: `.venv/bin/python tools/meshes/bake.py tools/meshes/configs/<name>.json`
   (prints input -> output triangles per part and the file size). Then run `npm test`:
   `tests/meshes.test.mjs` checks every file in `site/meshes/` (format, indices in range,
   bbox, size, a CREDITS entry).

Python setup: `python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt`
(numpy, fast-simplification 0.1.9, the newest that runs on Python 3.9; nibabel, scipy and scikit-image for `ct_to_obj.py`).

### Triangle budgets

A baked file must stay under **400 KB**. Each triangle costs about 16 bytes after base64
(roughly 0.5 vertices x 12 bytes plus 3 x 2-byte indices, times 4/3), so a file holds about
**25,000 triangles**. Rules of thumb:

| part | budget |
|------|--------|
| organ the scene is about (heart, liver, uterus, eyeball shell) | 3,000-6,000 |
| bone group (all left ribs, a spine segment) | 4,000-5,500 |
| supporting organ, muscle sheet | 1,000-2,500 |
| vessel or duct tube | 300-1,200 |
| small part (valve leaflet, lens, papillary muscle) | 200-600 |

Prefer fewer, merged parts unless a scene needs to colour or hide one structure on its own.
Loading cost on software GL is dominated by pixels, not triangles, so budgets are about file
size first.

### From a CT segmentation

`tools/meshes/ct_to_obj.py` turns a NIfTI label volume (`--volume seg.nii.gz --part liver=5`) or
binary masks (`--mask liver=liver.nii.gz`) into OBJs already in sagittal's frame (cm, +x left,
+y superior, +z anterior; bake with `"transform": {"axes": ["x", "y", "z"], "scale": 1}`).
`--list` prints a volume's orientation, voxel size and labels. Open sources and their licences
(TotalSegmentator's CT dataset is CC BY 4.0; its non-commercial model tasks are not allowed),
the frame maths and the full pipeline are in `skills/sagittal-scene/reference/seed-ct.md`.

The whole scene-building workflow (sourcing order, contracts, card review, checklist) is the
Claude Code skill `skills/sagittal-scene/SKILL.md`.

## Licence rule

- Only **CC BY, CC BY-SA, CC0/public domain or compatible** sources.
- **Never** use non-commercial (NC) or no-derivatives (ND) parts, even when they ship in the
  same download as allowed ones (Z-Anatomy bundles a CC BY-NC-SA inner ear and a CC BY-NC
  kidney: do not extract them).
- If a part's licence is unclear, do not bake it; note it in the cache `INVENTORY.md`.
- Every mesh needs a `credit` whose heading exists in `site/meshes/CREDITS.md`, with full
  attribution, licence and what was changed. The bake refuses other licences and the unit
  test refuses a missing CREDITS entry.
- Baked meshes from CC BY-SA sources are CC BY-SA 4.0, like the rest of sagittal's content.
