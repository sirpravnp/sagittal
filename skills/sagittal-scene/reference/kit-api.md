# Kit API and scene contracts (cheat sheet)

Source of truth: `site/kit/kit.js`, `lib/validateMeta.mjs`, `docs/meshes.md`. If this sheet and
the code disagree, the code wins; fix the sheet.

Loading order in the viewer and the 3D Anki card: `vendor/three.min.js` (r149, classic) ->
`kit/labels.js` -> `kit/kit.js` -> `app.js` -> `scenes/<id>.js` (registers only) -> every
`meshes/<name>.js` the SceneDef lists -> `open()` -> `build()`. So `build()` may use meshes;
code at registration time (the IIFE body outside `build`) must not. No ES modules, no `fetch`,
no `import`: everything must work from `file`-less Anki media.

## SceneDef (`Kit.register(def)`)

```js
(function () {
  var S = 0.36;                                   // cm -> scene units
  function P(x, y, z) { return [x * S, y * S, z * S]; }
  function T(kind, o) { return Kit.tissue(kind, Object.assign({ sheen: 0 }, o || {})); } // one shader program

  Kit.register({
    id: 'bil',                        // [a-z0-9-]+, equals the file name and meta.id
    meshes: ['biliary'],              // literal array of string literals (regex-parsed by build_decks.py)
    center: [-0.15, -0.1, 0],         // scene-unit point placed at the origin (g is moved by -center)
    zoom: 9.5,                        // camera distance, clamped by the viewer to 3..16
    rot: [0.15, -0.38],               // initial [x, y] rotation of the model, radians
    controls: [
      { k: 'p', label: 'Condition', def: 'norm', opts: [['norm', 'Normal anatomy'], ['gb', 'Cholelithiasis']] },
      { k: 'eo', label: 'Show external oblique', type: 'chk', def: true },   // optional extra toggles
    ],
    build: function (g, st) {          // g: fresh THREE.Group per rebuild; st: { p: 'norm', eo: true }
      var body = new THREE.Group(); body.scale.setScalar(S); g.add(body);
      Kit.meshPart(body, 'biliary', 'liver', T('liver', { opacity: 0.17, depthWrite: false }));
      // ... overlays in scene units (P(...)) or in cm inside `body`
      return {
        labels: [{ t: 'Liver', p: P(5.5, 7.5, 2) }],   // p in g's coordinates (scene units)
        info: '<ul><li>...</li></ul>',                // HTML for the info panel, per variant
        update: null,                                 // optional function (seconds) called every frame
      };
    },
  });
})();
```

- Every control change calls `build()` again on a fresh group; old geometry/materials are
  disposed (shared baked geometry is not).
- Cards: `tools/render_cards.mjs` opens `viewer.html?scene=<id>&<variantControl>=<key>&embed=1`
  for each meta variant, all other controls at their `def`. So each variant must be fully
  described by that one control. No variant key `anim`; renders must be deterministic.
- Labels: `{ t, p }`, `p` in the coordinates of `g` before the `center` shift (that is, the same
  space you build in). If you rotate or scale an inner group per variant, transform label
  points through its matrix (`heart.js`: `V3(p).applyMatrix4(H.matrix)` after `H.updateMatrix()`).
  Labels behind the camera are hidden; the layout engine (`kit/labels.js`) moves labels apart
  but cannot fix 20 labels on a 375 px phone.

## Meta (`site/scenes/<id>.meta.json`)

```json
{
  "id": "bil",
  "title": "Biliary tree anatomy",
  "topic": "Gastroenterology",
  "variantControl": "p",
  "variants": [{ "key": "norm", "label": "Normal anatomy" }, { "key": "gb", "label": "Cholelithiasis" }],
  "claims": ["One short, exact, board-relevant fact per string."],
  "sources": ["Author. Title. StatPearls (year). https://www.ncbi.nlm.nih.gov/books/NBK.../"],
  "status": "unreviewed"
}
```

`validateMeta` requires: `id` `[a-z0-9-]+`; non-empty `title`, `topic`, `variantControl`;
non-empty `variants` with string `key` and `label`; non-empty `claims` of non-empty strings;
`sources` an array of strings (may be empty, but fill it); `status` `unreviewed` (or `reviewed`
with `reviewer` and ISO `reviewedOn`, which only a human reviewer sets). Tests also require
`<id>.js` + `<id>.meta.json` for every id in `site/scenes/index.json`.

## Kit (window.Kit)

| call | does |
|---|---|
| `Kit.meshPart(group, mesh, part, material)` | adds a baked part, returns the `THREE.Mesh`; material is a `THREE.Material` or a tissue kind string. Geometry is shared: clone before editing. Throws if the mesh is not in `meshes:` or the part is unknown. |
| `Kit.meshParts(mesh)` | part names (`[]` if not loaded) |
| `Kit.meshInfo(mesh)` | `{ unit, credit, frame, offset, bbox: { part: [minx,miny,minz,maxx,maxy,maxz] } }` in cm |
| `Kit.tissue(kind, opts)` | new `MeshPhysicalMaterial`; `opts` override anything; `opacity < 1` turns on transparency and off depthWrite |
| `Kit.tissueKinds()` | `myocardium, vessel-artery, vessel-vein, blood-oxy, blood-deoxy, blood-mixed, bone, cartilage, lung, liver, gallbladder, bile-duct, pancreas, bowel, fascia, muscle, fat, uterus-serosa, myometrium, endometrium, fibroid, sclera, cornea, iris, lens, retina, choroid, nerve, air, highlight` |
| `Kit.helpers.arrow(g, a, b, col?)` | emissive arrow from a to b (scene units), default gold `0xffd23f` |
| `Kit.helpers.ring(g, p, r, col?, rot?)` | emissive torus marker |
| `Kit.helpers.dot(g, p, col?, r?)` | emissive sphere marker |
| `Kit.helpers.tube(g, pts, r, mat, n?)` / `seg(g, a, b, r, mat)` | Catmull-Rom tube / straight cylinder |
| `Kit.helpers.ell, add, mat, sector, disk, V` | primitive helpers from the original prototype; prefer real meshes |
| `Kit.BADGE_TEXT` | "Unreviewed: verify against your textbook" |

Rendering: ACES tone mapping, sRGB output, hex colours are sRGB, background `#0f141b`, hemisphere
+ key + rim lights fixed to the camera, a small PMREM studio environment. No shadows, no
post-processing, no transmission.

## Scene-local patterns worth copying (the kit does not have them)

| need | where to copy from |
|---|---|
| tapered swept tube along cm points, flat caps | `heart.js` `vtube()` |
| tube with a radius profile r(t) (dilate, narrow, taper) | `bil.js` `duct()` + `prof()` |
| editable copy of a baked part (deform without touching the shared geometry) | `heart.js` `editable()`, `pinch()` |
| overlay always on top of translucent anatomy | `heart.js` `top()`: `depthTest = false`, `renderOrder = 10` |
| irregular stone / lobulated mass | `bil.js` `stone()`, the Courvoisier mass |
| cutaway with section caps; clip planes that follow the model; magnified inset | `eye.js` |
| coronal section of a procedural organ with layered caps | `fib.js` |
| runtime split of a merged part into components (e.g. single ribs) | `flail.js` |
| centre line read off a baked tube and hard-coded in the scene | `aorta.js` `CL`, `bil.js` `BD` |

## Viewer URLs

- `site/viewer.html?scene=<id>&<k>=<value>` (any control), `&embed=1` hides the page chrome.
- Serve locally: `python3 -m http.server 8000 --directory site`, open
  `http://localhost:8000/viewer.html?scene=<id>`.
- `window.viewer.debug()` gives `labelRects`, `leaders` (per label: anchor dot `ax, ay`, leader end
  `x2, y2`, `len`, `occluded`, `text`, `behind`), `nonBlank`, `rot` (used by the e2e tests) and
  `pick(x, y)` (the opaque surface under a stage pixel, in mesh and label coordinates).
- Labels: `{ t, p, on?, alt?, side?, behind? }`. The kit draws an anchor dot and a leader line
  from it to the chip, and raycasts the anchor whenever the view settles.
  - `on`: the mesh, meshes or group the label names (keep the return value of `Kit.meshPart` or
    your tube helper). The dot goes on the visible, camera-facing surface of that mesh nearest to
    `p`, so it follows the structure as the user rotates and never sits on something in front.
    Prefer this for every vessel, nerve, chamber and ligament label.
  - `alt`: extra candidate points (label coordinates) tried in order when `p` is hidden.
  - `side: 'left'`: the chip goes left of its dot.
  - `behind: true`: the anchor is deliberately hidden (a defect drawn x-ray style through the
    heart). Drawn with a hollow dot and dashed leader; any other hidden anchor fails e2e.
  Surfaces with opacity below 0.7 do not hide anchors.
