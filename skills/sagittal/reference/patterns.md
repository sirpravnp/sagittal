# Patterns and library notes

General ways to express a variation with the spec ops, plus facts about the base library that any
figure in a region needs. None of this is a stored figure: you still build every request from
`organs.md`, check `t` values in its "Along each line" tables, and look at the result (SKILL.md
step 6).

## Library lines that need splitting

A library centre line sometimes covers what the textbook names as two structures. Use the one
method in `spec.md` ("Splitting a library line", worked example 1): hide the part and redraw each
textbook structure in `base` with `via` points `on` the hidden line. The lines this applies to:

- **Bile duct** (`gallbladder/bile_duct`): its first stretch is a short hook up from the
  gallbladder neck, the start of the cystic duct; the cystic/common hepatic junction is at about
  `t` 0.125. Redraw the common bile duct, common hepatic duct and cystic duct exactly as in worked
  example 1. The cystic duct always starts at `gallbladder/gallbladder_neck` with no offset. The
  duct ends at `duodenum/major_duodenal_papilla`; end anything at the ampulla there, not at the
  main pancreatic duct's end (about 2 cm away).
- **Proper hepatic artery** (`coeliac-trunk/proper_hepatic_artery`): it runs on into the right
  lobe as the right hepatic artery, to `proper_hepatic_artery_end`; the porta (where the proper
  hepatic artery divides) is at about `t` 0.16. The library has no left hepatic artery. Redraw:
  - proper hepatic: `branch` from `coeliac-trunk/common_hepatic_artery` at `t: 1`, `via` the
    hidden line to about `t` 0.16;
  - right hepatic: `branch` from the end of your proper hepatic, `via` the hidden line at spaced
    `t` (0.25 ... 0.9), `to` `coeliac-trunk/proper_hepatic_artery_end`;
  - left hepatic (completed from landmarks): `branch` from the same point, `via` the segment IV
    and III centroids (`liver-segments/...`, offset 1 to 1.5 cm `posterior` so it runs in the
    hilar plate rather than across the liver surface), `to` the segment II centroid.

## Expressing a variation

- **New origin a short distance away** (a few cm along the same or a neighbouring trunk):
  `move_insertion` of the structure onto the new line (worked example 2). Its children stay on it.
- **New origin on a distant trunk** (a vessel replaced by one from elsewhere): `remove` the normal
  vessel, then `branch` the new one from the new parent at the point the reference gives (its
  proximal part, a named stretch, or next to one of its branches: read the parent's `t` values in
  its "Along each line" row; a small `t` is close to the parent's own origin). Route it through the relations the
  reference gives, as offsets from the structures named in them, then join the normal distal course
  (`via` points on the library or hidden line) and end at the same end landmark. If the removed
  vessel has children, `move_insertion` them onto the new vessel (`t: 1` for its end) or remove
  them too.
- **Accessory vessel** (an extra one, the normal one still present): keep the normal vessel and
  only add a `branch`. "Accessory" adds; "replaced" removes and adds. Do not mix them up.
- **Insertion far along a duct or vessel** (joins much lower or higher than usual): `move_insertion`
  would draw a straight stretch across other structures. `remove` the structure and `route` a new
  one from the same start, running beside the target line (`via` points `on` it at spaced `t` with
  a 0.5 cm offset to one side) and joining it further along.
- **A trunk that does not form** (its branches arise separately): `move_insertion` each child onto
  the parent line at nearby `t` values (in the right order along the parent; see its "Along each
  line" row), then `remove` the trunk.
- **A branch arising in an unusual place on a long parent**: `branch` from the parent at the `t`
  the reference gives (e.g. "distal to X": a little beyond X's origin `t`); make the first `via`
  lead away from the parent so the takeoff is visible, then follow the cited course.
- **A course behind / in front of / beside a structure**: put `via` points as offsets from that
  structure's landmarks or from points `on` it: `posterior` for behind, `anterior` for in front,
  `right`/`left` for the patient's sides. 1 to 1.5 cm clears a vessel or duct wall.
- **A duplicated structure**: `duplicate` it along a parallel path (offsets of 1 to 2 cm from the
  original's landmarks).

## Keeping an origin and a course visible

- Fade what covers the region: liver 0.1 to 0.2, portal venous system about 0.3, aorta 0.25 to
  0.5, bowel and pancreas 0.4 to 0.5. Hide parts you do not need (`visible: false`), for example a
  gallbladder sac that covers an artery, or library branches that clutter the takeoff.
- Label the parent trunk: a label on a library line that your structure branches from is anchored
  just past the takeoff, so the origin reads.
- Pick the view from which the takeoff faces the camera (next section), and check `look`'s output:
  an origin label marked HIDDEN is behind something.

## Courses and waypoints

- A tube may not turn more than 90° at a `via` next to a stretch under 1.5 cm (the validator
  refuses it). Most often this comes from a `via` on a small wiggle of a library line: use points
  further apart (0.1 or more in `t` on lines under 15 cm).
- Few, well-placed waypoints give smoother vessels than many close ones.
- Radii: match the library (`radius_cm` in organs.md): common hepatic artery about 0.25, proper
  hepatic 0.1 to 0.15, cystic artery about 0.08, bile duct about 0.1 to 0.13, cystic duct about
  0.12.

## Views

`view.rot` is `[x, y]` in radians; `zoom` 3 (close) to 16 (far, about 5 to 9 for one region). The
chip on the stage names the view:

| rot | chip |
|---|---|
| `[0, 0]` | Anterior view · patient's right on screen left |
| `[0, 0.6]` | Right anterior oblique view · patient's right on screen left |
| `[0, -0.6]` | Left anterior oblique view · patient's right on screen left |
| `[0, 1.57]` / `[0, -1.57]` | Right / Left lateral view |
| `[0, 2.5]` | Right posterior oblique view · patient's right on screen right |
| `[0, 3.14]` | Posterior view · patient's right on screen right |
| `[0.5, 0]` / `[-0.5, 0]` | Anterior view, from above / from below |

Choose the view in which the variation is seen directly: the side the new origin faces, and for a
front/back relation an oblique that separates the two structures. Try two or three with
`look --rot` before you settle. From behind, the patient's right is on screen right: describe
sides from the chip, not from habit.
