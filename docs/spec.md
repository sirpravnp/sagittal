# Figure spec (`sagittal-figure/1`)

You (Claude) write one JSON document per figure. `player/spec.js` validates it
(`SagittalSpec.validate(spec, SagittalOrgans)`); the page renders only a spec with no errors.
A figure of normal anatomy has one view. A figure of a variant has two, chosen with a switch:

- **normal**: the base anatomy (the organs you list, plus any `base` structures);
- **variant**: the same anatomy with your `variant.edits` applied (only when you give `variant`).

You never give coordinates. Every point is a named landmark, a point along a named centre line,
or one of those moved by a short offset. The organs, their parts, landmarks and centre lines are
listed in `reference/organs.md`; the citable sources in the reference list (`organs/references.json`,
listed by id and title under References in `reference/organs.md`). If the anatomy
you need is not there, say so to the student and stop: do not approximate it from memory.

## Names

A library structure is `"<organ>/<id>"`, where `<organ>` is an organ id and `<id>` is one of its
centre lines, parts or landmarks: `"coeliac-trunk/proper_hepatic_artery"`,
`"gallbladder/gallbladder_neck"`, `"gallbladder/bile_duct"`.

A structure you create (`route`, `branch`, `duplicate`) has a bare id with no slash,
lowercase `[a-z][a-z0-9_]*`: `"cystic_duct"`, `"second_cystic_artery"`. Ids are unique across the spec.

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
| `variant` | no | `{ "label", "edits" }`: the variant view; leave it out for normal anatomy |
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
 "via": [{"on": "gallbladder/bile_duct", "t": 0.03}, {"on": "gallbladder/bile_duct", "t": 0.07}],
 "to": {"on": "cbd", "t": 0}}
```

- `id`, `name` (at most 60 characters): required.
- `tissue`: one of `vessel-artery`, `vessel-vein`, `bile-duct`, `bowel`, `pancreas`, `nerve`,
  `lung`, `air`, `highlight`.
- `radius_cm`: more than 0, at most 1.5. Match the library: the common hepatic artery is about 0.25,
  the proper hepatic artery 0.1, the bile duct 0.1.
- `from`, `to`: waypoints. `via`: optional list of up to 12 waypoints the tube passes through,
  in order. The tube runs through `from`, `via...`, `to` in that order.
- The path may not double back: at a `via` point it may not turn more than 90° when either
  stretch next to it is shorter than 1.5 cm (a tube drawn through such points loops). This
  happens most often with a `via` on a small wiggle of a library line; pick points further along.
- An end given as `{"on", "t"}` **inserts** into that line: the structure depends on it (see
  `remove`) and its insertion can be moved (see `move_insertion`).

### `branch`: a new tube off an existing line

Same fields as `route`, but `from` must be `{"on", "t"}` with no offset: the branch leaves that
line at that point.

```json
{"op": "branch", "id": "cystic_artery", "name": "Cystic artery", "tissue": "vessel-artery", "radius_cm": 0.09,
 "from": {"on": "coeliac-trunk/proper_hepatic_artery", "t": 0.2},
 "to": {"landmark": "gallbladder/gallbladder_centroid", "offset": {"dir": "anterior", "cm": 1.2}}}
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
`move_insertion` (worked example 2 moves a library line). A library line's parent is its manifest `parent` field (listed
in `reference/organs.md`): the line it branches from or, for a vein, drains into. Tributaries that
unite to form a vessel count as its children too: the superior mesenteric and splenic veins join at
the portal confluence (the portal vein's start), so removing `portal-venous/portal_vein` is refused
while they remain, and removing one of them is allowed. Your own structures depend on the lines
their `from`/`to` ends sit on.

### `move_insertion` (variant only)

```json
{"op": "move_insertion", "structure": "coeliac-trunk/common_hepatic_artery", "to": {"on": "aorta/abdominal_aorta", "t": 0.44}}
```

Moves where `structure` joins another line to a new point `to`, which must be `{"on", "t"}` with
no offset (it may be a different line: that is how you reroute a branch onto a new parent).

- For a library centre line, the insertion is its first point (its origin).
- For your own structure, the insertion is its `to` end if `to` was `{"on", "t"}`, otherwise its
  `from` end if that was `{"on", "t"}`. A structure with neither end on a line has no insertion
  to move.
- In the variant view the structure keeps its course and only its insertion point changes (the
  first stretch is redrawn straight from the new point). A structure can be moved once.
- So use it for a **short move** (the new point a few cm from the old one at most). For a long move
  (an insertion far along a duct, an origin on a distant trunk) the straight stretch cuts across
  other structures: `remove` the structure and `route` or `branch` a new one along the course you
  want instead (waypoints `on` the line it runs beside, with a small offset).
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
"Gaps" in `reference/organs.md`). Put the **normal** course of such a
structure in `base`, completed from landmarks and centre lines: it is drawn in both views. Then
the variant edits it like any other structure, by its id: `remove` it, `move_insertion` it a short
way, or `branch` from it.

**Splitting a library line.** A spec cannot split a library centre line. When one library line
covers what the textbook names as two structures (the bile duct line includes the start of the
cystic duct; the proper hepatic artery line runs on as the right hepatic artery), hide that part
(`"parts": {"<part>": {"visible": false}}`) and redraw each textbook structure in `base` with `via`
points `on` the hidden line, then label and edit your structures. Hidden lines still work as
waypoints. Worked example 1 does this for the bile ducts; use the same method for any line.

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
{"text": "Second cystic artery", "on": "second_cystic_artery", "views": ["variant"]}
```

- `text`: at most 60 characters. `on`: a library centre line, part or landmark of a listed organ,
  or one of your structures.
- `views` (optional): `["normal"]`, `["variant"]` or both. Leave it out and it is worked out: a
  variant-only structure is labelled in `variant`, a removed one in `normal`, others in both.
  Asking for a view the structure is not in is an error.
- At most 20 labels; label what the student asked about, not everything.

## `claims`

```json
{"text": "The cystic artery usually arises from the right hepatic artery in Calot's triangle.", "refs": ["jmas-vasculobiliary-anatomy"]}
```

Each claim is one short fact (at most 300 characters) shown in the info panel, with `refs`: a
list of at least one reference id from the reference list (References in `reference/organs.md`). Unknown ids are refused: never invent a source. If no
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
| turn at a `via` | at most 90° when a stretch next to it is under 1.5 cm |
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
variant.edits[1].via[2]: the path turns 103° here, next to a stretch shorter than 1.5 cm; a vessel or duct does not double back: choose waypoints that give a smooth course
claims[0].refs[0]: unknown reference "michels-1966"
labels: at most 20 items (got 25)
```

Fix each one by changing the spec (look the name up in `reference/organs.md`), then validate
again. Do not work around an error with offsets or coordinates.

## Worked example 1: double cystic artery

Shows the library-line split and duct completion. The library bile duct line starts at the
gallbladder neck and runs up over a short hook before it descends: that hook is the start of the
cystic duct, and the duct junction is taken at the bottom of the hook (bile duct `t` 0.125). So the
`bile_duct` part is hidden and redrawn in `base` as the common bile duct (`cbd`, from that point to
the papilla), the common hepatic duct (`chd`, from the top of `cbd` up to the hilum) and the cystic
duct (from the gallbladder neck, **on the wall, no offset**, along the hook to the top of `cbd`).
The normal cystic artery is a `base` branch of the proper hepatic artery line **past the porta**
(`t` 0.2; the line divides into right and left at about `t` 0.16 and runs on as the right hepatic
artery), so it arises from the right hepatic artery as the claim says; the variant adds a second
one further along. The hepatic artery line is not split here (no left hepatic artery is drawn):
for a cystic artery figure it is not needed, but split it as described above when a figure is
about the hepatic arteries. The gastroduodenal artery is hidden because it crosses the gallbladder in this view and
is not part of the variation. Nothing is removed, so this is an
accessory structure: the variant only adds.

```json
{
  "schema": "sagittal-figure/1",
  "title": "Double cystic artery",
  "topic": "Hepatobiliary",
  "organs": [
    {"id": "gallbladder", "parts": {"bile_duct": {"visible": false}, "gallbladder": {"opacity": 0.6}}},
    {"id": "coeliac-trunk", "parts": {"gastroduodenal_artery": {"visible": false}}},
    {"id": "liver", "parts": {"liver": {"opacity": 0.15}}},
    {"id": "duodenum", "parts": {"*": {"opacity": 0.4}}}
  ],
  "base": [
    {"op": "route", "id": "cbd", "name": "Common bile duct", "tissue": "bile-duct", "radius_cm": 0.13, "from": {"on": "gallbladder/bile_duct", "t": 0.125}, "via": [{"on": "gallbladder/bile_duct", "t": 0.3}, {"on": "gallbladder/bile_duct", "t": 0.5}, {"on": "gallbladder/bile_duct", "t": 0.7}, {"on": "gallbladder/bile_duct", "t": 0.9}], "to": {"landmark": "duodenum/major_duodenal_papilla"}},
    {"op": "branch", "id": "chd", "name": "Common hepatic duct", "tissue": "bile-duct", "radius_cm": 0.12, "from": {"on": "cbd", "t": 0}, "via": [{"landmark": "gallbladder/bile_duct_upper_end", "offset": {"dir": "superior", "cm": 1.5}}], "to": {"landmark": "portal-venous/portal_vein_upper_end", "offset": {"dir": "right", "cm": 1.5}}},
    {"op": "route", "id": "cystic_duct", "name": "Cystic duct", "tissue": "bile-duct", "radius_cm": 0.12, "from": {"landmark": "gallbladder/gallbladder_neck"}, "via": [{"on": "gallbladder/bile_duct", "t": 0.03}, {"on": "gallbladder/bile_duct", "t": 0.07}], "to": {"on": "cbd", "t": 0}},
    {"op": "branch", "id": "cystic_artery", "name": "Cystic artery", "tissue": "vessel-artery", "radius_cm": 0.09, "from": {"on": "coeliac-trunk/proper_hepatic_artery", "t": 0.2}, "to": {"landmark": "gallbladder/gallbladder_centroid", "offset": {"dir": "posterior", "cm": 1.2}}}
  ],
  "variant": {"label": "Double cystic artery", "edits": [
    {"op": "branch", "id": "second_cystic_artery", "name": "Second cystic artery", "tissue": "vessel-artery", "radius_cm": 0.08, "from": {"on": "coeliac-trunk/proper_hepatic_artery", "t": 0.28}, "to": {"landmark": "gallbladder/gallbladder_centroid", "offset": {"dir": "anterior", "cm": 1.2}}}
  ]},
  "labels": [
    {"text": "Cystic artery", "on": "cystic_artery"},
    {"text": "Second cystic artery", "on": "second_cystic_artery"},
    {"text": "Cystic duct", "on": "cystic_duct"},
    {"text": "Common bile duct", "on": "cbd"},
    {"text": "Common hepatic duct", "on": "chd"},
    {"text": "Gallbladder (fundus)", "on": "gallbladder/gallbladder_fundus"}
  ],
  "claims": [
    {"text": "The cystic artery is usually a single branch of the right hepatic artery, given off in Calot's triangle.", "refs": ["jmas-vasculobiliary-anatomy"]},
    {"text": "A second cystic artery, also from the right hepatic artery, was found in 2.6% of patients in one laparoscopic series.", "refs": ["jmas-vasculobiliary-anatomy"]}
  ],
  "view": {"rot": [0.1, -0.5], "zoom": 6}
}
```

## Worked example 2: common hepatic artery from the aorta

A library line gets a new origin a short distance away, so `move_insertion` is enough: the common
hepatic artery keeps its course, and its first stretch now starts on the aorta between the coeliac
trunk (aorta `t` 0.40) and the superior mesenteric artery (`t` 0.47); these `t` values are in the
aorta's "Along each line" row in `reference/organs.md`. Its children (proper hepatic and
gastroduodenal arteries) stay on it. A right lateral view shows the separate origin.

```json
{
  "schema": "sagittal-figure/1",
  "title": "Common hepatic artery from the aorta",
  "topic": "Hepatobiliary",
  "organs": [
    {"id": "aorta", "parts": {"aorta": {"opacity": 0.3}}},
    {"id": "coeliac-trunk"},
    {"id": "mesenteric-arteries"},
    {"id": "liver", "parts": {"liver": {"opacity": 0.15}}}
  ],
  "variant": {"label": "Common hepatic artery from the aorta", "edits": [
    {"op": "move_insertion", "structure": "coeliac-trunk/common_hepatic_artery", "to": {"on": "aorta/abdominal_aorta", "t": 0.44}}
  ]},
  "labels": [
    {"text": "Common hepatic artery", "on": "coeliac-trunk/common_hepatic_artery"},
    {"text": "Coeliac trunk", "on": "coeliac-trunk/coeliac_trunk"},
    {"text": "Superior mesenteric artery", "on": "mesenteric-arteries/superior_mesenteric_artery"},
    {"text": "Abdominal aorta", "on": "aorta/abdominal_aorta"}
  ],
  "claims": [
    {"text": "The common hepatic artery can arise directly from the aorta (Hiatt type VI), not from the coeliac trunk.", "refs": ["jclinmedres-hepatic-artery-variations"]}
  ],
  "view": {"rot": [-0.2, 1.4], "zoom": 5}
}
```

Here the coeliac trunk keeps its left gastric and splenic branches in both views.

After validating, render both views and look at them: a valid spec can still route a vessel
through the wrong place. Correct the waypoints until the figure matches the anatomy you cite.
