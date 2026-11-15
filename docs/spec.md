# Figure spec (`sagittal-figure/1`)

You (Claude) write one JSON document per figure. `player/spec.js` validates it
(`SagittalSpec.validate(spec, SagittalOrgans)`); the page renders only a spec with no errors.
Every figure has exactly two views, chosen in a dropdown:

- **normal**: the base anatomy (the organs you list, plus any `base` structures);
- **variant**: the same anatomy with your `variant.edits` applied.

You never give coordinates. Every point is a named landmark, a point along a named centre line,
or one of those moved by a short offset. The organs, their parts, landmarks and centre lines are
listed in `reference/organs.md`; the citable sources in `organs/references.json`. If the anatomy
you need is not there, say so to the student and stop: do not approximate it from memory.

## Names

A library structure is `"<organ>/<id>"`, where `<organ>` is an organ id and `<id>` is one of its
centre lines, parts or landmarks: `"coeliac-trunk/proper_hepatic_artery"`,
`"gallbladder/gallbladder_neck"`, `"gallbladder/bile_duct"`.

A structure you create (`route`, `branch`, `duplicate`) has a bare id with no slash,
lowercase `[a-z][a-z0-9_]*`: `"cystic_duct"`, `"rrha"`. Ids are unique across the spec.

## Frame

Centimetres, **+x patient's left, +y superior, +z anterior**. So *right* is -x, *inferior* is -y,
*posterior* is -z. Offsets use these words, never numbers for axes.

## Top level

| field | required | what |
|---|---|---|
| `schema` | yes | always `"sagittal-figure/1"` |
| `title` | yes | figure title, at most 80 characters |
| `topic` | no | short subject, at most 40 characters (e.g. `"Hepatobiliary"`) |
| `organs` | yes | 1 to 12 base organs to draw, with optional part styles |
| `base` | no | up to 20 `route`/`branch` ops: structures the library lacks, drawn in **both** views |
| `variant` | yes | `{ "label", "edits" }`: the variant view |
| `labels` | no | up to 20 labels |
| `claims` | yes | 1 to 12 facts for the info panel, each citing references |
| `view` | no | starting camera `{ "rot": [x, y], "zoom" }` |

Any other field is an error.

### `organs`

```json
"organs": [
  {"id": "gallbladder"},
  {"id": "liver", "parts": {"liver": {"opacity": 0.3}}},
  {"id": "portal-venous", "parts": {"*": {"opacity": 0.6, "color": "#3c5fa8"}}}
]
```

- `id`: an organ id from the library, listed once.
- `parts` (optional): part id, or `"*"` for every part, to a style with any of `opacity`
  (0 to 1), `color` (`"#rrggbb"`), `visible` (`true`/`false`).

Waypoints may use landmarks and centre lines of **any** library organ, listed or not. But a
`remove`, a `move_insertion` and a label must name a structure of a **listed** organ (it has to be
drawn to be removed, moved or pointed at).

## Waypoints

A waypoint is one of:

```json
{"landmark": "gallbladder/gallbladder_neck"}
{"on": "gallbladder/bile_duct", "t": 0.6}
{"on": "cystic_duct", "t": 0.5}
```

- `landmark`: a library landmark.
- `on` + `t`: the point a fraction `t` (0 to 1) of the way along a centre line, by length.
  `t = 0` is the line's first point: for a library vessel or duct, its origin (the end at its
  parent; see the line's `from` landmark); for your own structure, its `from` end. `on` may name a
  library centre line or a structure defined **earlier** in the spec (`base` first, then
  `variant.edits` in order).

Either form may add an `offset` to step a short distance along one body axis:

```json
{"landmark": "portal-venous/portal_confluence", "offset": {"dir": "posterior", "cm": 1.0}}
```

- `dir`: `anterior`, `posterior`, `left`, `right`, `superior` or `inferior` (patient's sides).
- `cm`: more than 0 and at most 3.

Use offsets for relations ("1 cm behind the portal vein"), not to reach places far from any
landmark. `[x, y, z]` arrays, `p`, `x/y/z` fields or any other coordinates are refused anywhere
in the spec.

## Ops

The same op grammar is used in `base` (only `route` and `branch`) and in `variant.edits` (all five).

### `route`: a new tube

```json
{"op": "route", "id": "cystic_duct", "name": "Cystic duct", "tissue": "bile-duct", "radius_cm": 0.12,
 "from": {"landmark": "gallbladder/gallbladder_neck"},
 "via": [],
 "to": {"on": "gallbladder/bile_duct", "t": 0.05}}
```

- `id`, `name` (at most 60 characters): required.
- `tissue`: one of `vessel-artery`, `vessel-vein`, `bile-duct`, `bowel`, `pancreas`, `nerve`,
  `lung`, `air`, `highlight`.
- `radius_cm`: more than 0, at most 1.5. Match the library: the common hepatic artery is about 0.25,
  the proper hepatic artery 0.1, the bile duct 0.1.
- `from`, `to`: waypoints. `via`: optional list of up to 12 waypoints the tube passes through,
  in order. The tube runs through `from`, `via...`, `to` in that order.
- An end given as `{"on", "t"}` **inserts** into that line: the structure depends on it (see
  `remove`) and its insertion can be moved (see `move_insertion`).

### `branch`: a new tube off an existing line

Same fields as `route`, but `from` must be `{"on", "t"}` with no offset: the branch leaves that
line at that point.

```json
{"op": "branch", "id": "cystic_artery", "name": "Cystic artery", "tissue": "vessel-artery", "radius_cm": 0.06,
 "from": {"on": "rrha", "t": 0.8}, "to": {"landmark": "gallbladder/gallbladder_neck"}}
```

### `remove` (variant only)

```json
{"op": "remove", "structure": "coeliac-trunk/common_hepatic_artery"}
```

Hides a library centre line or part, or one of your `base` structures, in the variant view.
**You cannot remove a structure that something else still branches from or inserts into.** For
example removing the common hepatic artery while the proper hepatic and gastroduodenal arteries
hang off it fails with:

```
variant.edits[0]: coeliac-trunk/proper_hepatic_artery branches from coeliac-trunk/common_hepatic_artery; reroute or remove coeliac-trunk/proper_hepatic_artery too
```

Fix it by removing the child too, or by moving its insertion onto the new parent with
`move_insertion` (worked example 2). A library line's parent is its manifest `parent` field (listed
in `reference/organs.md`); your own structures depend on the lines their `from`/`to` ends sit on.

### `move_insertion` (variant only)

```json
{"op": "move_insertion", "structure": "cystic_duct", "to": {"on": "gallbladder/bile_duct", "t": 0.6}}
```

Moves where `structure` joins another line to a new point `to`, which must be `{"on", "t"}` with
no offset (it may be a different line: that is how you reroute a branch onto a new parent).

- For a library centre line, the insertion is its first point (its origin).
- For your own structure, the insertion is its `to` end if `to` was `{"on", "t"}`, otherwise its
  `from` end if that was `{"on", "t"}`. A structure with neither end on a line has no insertion
  to move.
- In the variant view the structure keeps its course and only its insertion point changes (the
  first stretch is redrawn straight from the new point). A structure can be moved once.
- Edits apply in order: a later variant waypoint `on` a moved structure sits on its moved course,
  and a waypoint `on` it *before* the move is an error ("move it first").

### `duplicate` (variant only)

```json
{"op": "duplicate", "structure": "portal-venous/portal_vein", "id": "portal_vein_2", "name": "Duplicated portal vein",
 "from": {"landmark": "portal-venous/portal_confluence", "offset": {"dir": "left", "cm": 1}},
 "to": {"landmark": "portal-venous/portal_vein_upper_end", "offset": {"dir": "left", "cm": 1}}}
```

A second copy of a centre-line structure along a path you give with waypoints (as for `route`).
`tissue` and `radius_cm` are taken from the original unless you give them.

## `base` vs `variant`

The library lacks some structures the student will expect (for example the cystic duct, the
common hepatic duct, the right and left hepatic ducts, named right and left hepatic arteries; see
"Gaps" in `organs/README.md` and `reference/organs.md`). Put the **normal** course of such a
structure in `base`, completed from landmarks and centre lines: it is drawn in both views. Then
the variant edits it like any other structure, by its id: `move_insertion` to make the cystic
duct insert low, `remove` to take it away.

A `base` structure is drawn the same in both views, so it may not sit on (`on`) a line the
variant moves, nor pass (`via`) through a line the variant removes; an end on a removed line is
refused like any other branch.

Put only the **variation** in `variant.edits`. Everything in `variant.edits` appears only in the
variant view; everything removed there still shows in the normal view.

The info panel lists, under "Changed from base anatomy", every `base` structure (marked as drawn
from landmarks, in both views) and every variant edit, with the landmarks and centre lines it was
built through (`resolved.provenance`).

## `labels`

```json
{"text": "Cystic duct", "on": "cystic_duct"}
{"text": "Replaced right hepatic artery", "on": "rrha", "views": ["variant"]}
```

- `text`: at most 60 characters. `on`: a library centre line, part or landmark of a listed organ,
  or one of your structures.
- `views` (optional): `["normal"]`, `["variant"]` or both. Leave it out and it is worked out: a
  variant-only structure is labelled in `variant`, a removed one in `normal`, others in both.
  Asking for a view the structure is not in is an error.
- At most 20 labels; label what the student asked about, not everything.

## `claims`

```json
{"text": "The cystic duct may join the bile duct low, near the duodenum.", "refs": ["statpearls-biliary-ducts"]}
```

Each claim is one short fact (at most 300 characters) shown in the info panel, with `refs`: a
list of at least one reference id from `organs/references.json`. Unknown ids are refused: never invent a source. If no
listed reference supports a fact, leave the fact out.

## `view`

`{"rot": [x, y], "zoom": z}`: starting rotation in radians about x and y, and camera distance
from 3 (close) to 16 (far). Optional.

## Limits

| what | limit |
|---|---|
| organs | 1 to 12 |
| base ops | up to 20 |
| variant edits | 1 to 20 |
| via waypoints per op | up to 12 |
| offset | more than 0, at most 3 cm |
| `t` | 0 to 1 |
| `radius_cm` | more than 0, at most 1.5 |
| labels | up to 20, text up to 60 characters |
| claims | 1 to 12, text up to 300 characters, at least one reference each |
| title / topic / names | 80 / 40 / 60 characters |
| zoom | 3 to 16 |

## Errors

The validator lists every problem it finds, each starting with the path of the offending field:

```
variant.edits[1].via[0]: unknown landmark "portal-venous/foo"
variant.edits[1].from: t must be a number from 0 to 1 (got 1.4)
variant.edits[1].via[0]: offset.cm must be more than 0 and at most 3 (got 4)
variant.edits[1].via[0]: raw coordinates are not allowed; use a landmark, a centre-line point or an offset
claims[0].refs[0]: unknown reference "michels-1966"
labels: at most 20 items (got 25)
```

Fix each one by changing the spec (look the name up in `reference/organs.md`), then validate
again. Do not work around an error with offsets or coordinates.

## Worked example 1: low cystic duct insertion

The library has the gallbladder and the common bile duct but no cystic duct, so the normal
cystic duct goes in `base` (from the gallbladder neck to the top of the bile duct) and the
variant moves its insertion down the bile duct.

```json
{
  "schema": "sagittal-figure/1",
  "title": "Low cystic duct insertion",
  "topic": "Hepatobiliary",
  "organs": [
    {"id": "gallbladder"},
    {"id": "liver", "parts": {"liver": {"opacity": 0.3}}},
    {"id": "duodenum", "parts": {"*": {"opacity": 0.5}}}
  ],
  "base": [
    {"op": "route", "id": "cystic_duct", "name": "Cystic duct", "tissue": "bile-duct", "radius_cm": 0.12,
     "from": {"landmark": "gallbladder/gallbladder_neck"},
     "to": {"on": "gallbladder/bile_duct", "t": 0.05}}
  ],
  "variant": {"label": "Low cystic duct insertion", "edits": [
    {"op": "move_insertion", "structure": "cystic_duct", "to": {"on": "gallbladder/bile_duct", "t": 0.6}}
  ]},
  "labels": [
    {"text": "Gallbladder", "on": "gallbladder/gallbladder"},
    {"text": "Cystic duct", "on": "cystic_duct"},
    {"text": "Common bile duct", "on": "gallbladder/bile_duct"}
  ],
  "claims": [
    {"text": "The cystic duct may run alongside the bile duct and join it low, near the duodenum.", "refs": ["statpearls-biliary-ducts"]},
    {"text": "A long parallel cystic duct matters at cholecystectomy because it can be mistaken for the bile duct.", "refs": ["jmas-anatomy-cholecystectomy"]}
  ],
  "view": {"rot": [0.1, -0.5], "zoom": 8}
}
```

## Worked example 2: common hepatic artery from the SMA

The variation replaces a library structure. Removing the common hepatic artery alone is refused,
because the proper hepatic and gastroduodenal arteries branch from it, so both are moved onto the
new artery's end (`t: 1`), which lies at the library's common hepatic artery division.

```json
{
  "schema": "sagittal-figure/1",
  "title": "Common hepatic artery from the SMA",
  "topic": "Hepatobiliary",
  "organs": [
    {"id": "aorta"},
    {"id": "coeliac-trunk"},
    {"id": "mesenteric-arteries"},
    {"id": "portal-venous", "parts": {"*": {"opacity": 0.6}}},
    {"id": "liver", "parts": {"liver": {"opacity": 0.25}}}
  ],
  "variant": {"label": "Common hepatic artery from the SMA", "edits": [
    {"op": "remove", "structure": "coeliac-trunk/common_hepatic_artery"},
    {"op": "route", "id": "cha_from_sma", "name": "Common hepatic artery (from SMA)", "tissue": "vessel-artery", "radius_cm": 0.25,
     "from": {"on": "mesenteric-arteries/superior_mesenteric_artery", "t": 0.04},
     "via": [{"landmark": "portal-venous/portal_confluence", "offset": {"dir": "posterior", "cm": 1}}],
     "to": {"landmark": "coeliac-trunk/common_hepatic_artery_division"}},
    {"op": "move_insertion", "structure": "coeliac-trunk/proper_hepatic_artery", "to": {"on": "cha_from_sma", "t": 1}},
    {"op": "move_insertion", "structure": "coeliac-trunk/gastroduodenal_artery", "to": {"on": "cha_from_sma", "t": 1}}
  ]},
  "labels": [
    {"text": "Common hepatic artery", "on": "coeliac-trunk/common_hepatic_artery"},
    {"text": "Common hepatic artery from SMA", "on": "cha_from_sma"},
    {"text": "Superior mesenteric artery", "on": "mesenteric-arteries/superior_mesenteric_artery"},
    {"text": "Portal vein", "on": "portal-venous/portal_vein"}
  ],
  "claims": [
    {"text": "In a minority of people the common hepatic artery arises from the superior mesenteric artery instead of the coeliac trunk.", "refs": ["jclinmedres-hepatic-artery-variations", "statpearls-celiac-trunk"]}
  ],
  "view": {"rot": [0.2, -0.4], "zoom": 8}
}
```

Here the first label is shown only in the normal view (its structure is removed in the variant)
and the second only in the variant view; both are worked out because `views` is left out.

After validating, render both views and look at them: a valid spec can still route a vessel
through the wrong place. Correct the waypoints until the figure matches the anatomy you cite.
