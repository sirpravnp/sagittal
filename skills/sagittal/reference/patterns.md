# Patterns and library notes

Lessons from building and checking figures on this library. Read the section for your region.
Every id below is in `organs.md`; check `t` values against the line lengths there, and always look
at the result (SKILL.md step 6).

## A library line that does not divide where the textbook does

A spec cannot split a library centre line. When one source line covers what the textbook names as
two structures, **hide the library part and redraw the textbook structures as `base` routes that
follow the library points** (`via` points `on` the hidden line), then edit those in the variant.
Hidden lines still serve as waypoints (`on`) and landmarks; only their drawing is hidden.

```json
"organs": [{"id": "coeliac-trunk", "parts": {"proper_hepatic_artery": {"visible": false}}}]
```

Label the redrawn structures (your ids), not the hidden part (a label on a hidden structure is
dropped).

## Hepatic arteries

- `coeliac-trunk/proper_hepatic_artery` is the proper hepatic artery **and** the right hepatic
  artery in one line (it runs on into the right lobe to `proper_hepatic_artery_end`); there is no
  left hepatic artery and no hilar division (Gaps). For any right/left hepatic variant, hide the
  part and redraw in `base`:
  - proper hepatic: `branch` from `coeliac-trunk/common_hepatic_artery` at `t: 1`, along the hidden
    line to about `t: 0.16` (the porta);
  - right hepatic: `branch` from the end of your proper hepatic (`t: 1`), `via` the hidden line at
    about t 0.25, 0.35 ... 0.9, `to` `coeliac-trunk/proper_hepatic_artery_end`;
  - left hepatic: `branch` from the same point, `via` the segment IV and III centroids
    (`liver-segments/...`, offset 1 to 1.5 cm `posterior` so it runs in the hilar plate, not
    through the liver surface), `to` the segment II centroid.
- A **replaced** artery: `remove` the normal one, `branch` the new one from its new parent's line
  near that parent's origin (e.g. the SMA at a small `t`), route it through the cited relations
  (e.g. 1 to 1.5 cm `posterior` to `portal-venous/portal_confluence`, then posterior and to the
  right of `gallbladder/bile_duct_upper_end`), then join the normal intrahepatic course (`via` the
  same hidden-line points) to the same end landmark.
- An **accessory** artery: keep the normal one and add the new `branch` (nothing removed).
- The SMA's part and centre line share the id `superior_mesenteric_artery`; a label on it anchors
  on the line next to any branch you take off it, which keeps the takeoff readable.
- Fade what covers the takeoff: portal venous system about 0.3, aorta about 0.25, liver 0.1. Hide
  the gallbladder sac if it covers the artery's lower course.

## Bile ducts

- The library has only the bile duct (CBD). The cystic duct, common hepatic duct and hepatic ducts
  are Gaps: draw them in `base` from landmarks, never as free shapes.
- The `gallbladder/bile_duct` curve begins with a short hook rising from the gallbladder neck
  before it descends; treat that hook as the cystic duct. Taking the cystic/common hepatic
  junction at about `t: 0.125` of the bile duct works: hide the `bile_duct` part, then in `base`
  - `cbd`: `route` from `{"on": "gallbladder/bile_duct", "t": 0.125}` `via` t 0.2 ... 0.9 to
    `gallbladder/bile_duct_lower_end`;
  - common hepatic duct: `branch` from your `cbd` at `t: 0`, up past `bile_duct_upper_end`
    (offset superior) to the hilum (e.g. `portal-venous/portal_vein_upper_end`, offset right);
  - cystic duct: `route` **from `gallbladder/gallbladder_neck` (no offset)** `via` the hook (bile
    duct t about 0.03 and 0.07) to your `cbd` at `t: 0`. A cystic duct that does not start on the
    gallbladder is wrong.
- The duct reaches the duodenum at `duodenum/major_duodenal_papilla`; end anything at the ampulla
  there, not at the main pancreatic duct's end (about 2 cm away).
- **Low insertion**: `move_insertion` only redraws the first stretch straight from the new point,
  which for a long change cuts across. Better: `remove` the normal cystic duct and `route` a new
  one from the same neck point, running parallel about 0.5 cm `anterior` of the CBD (`via` points
  on the CBD at spaced t with that offset), joining the CBD low (t about 0.7 to 0.8, above the
  duodenum). Show the gallbladder and the duodenum so "low" is readable.

## Aortic arch

- Arch branches in order from the right: `brachiocephalic_trunk` (which divides into the right
  common carotid and right subclavian), `left_common_carotid_artery`, `left_subclavian_artery`.
  Compare their origin landmarks with points on `aorta/aortic_arch` to find each origin's `t`.
- **Aberrant right subclavian**: `remove` `aorta/right_subclavian_artery`; `move_insertion`
  `aorta/right_common_carotid_artery` onto the arch near the old brachiocephalic origin; `remove`
  `aorta/brachiocephalic_trunk`; `branch` the aberrant artery from the arch **distal to the left
  subclavian origin**, rising first (via a point just above the distal arch, left of the
  oesophagus), then behind the oesophagus (`{"on": "oesophagus/oesophagus", "t": ...}` with an offset `posterior`), to its right, to
  `aorta/right_subclavian_artery_end`. Show `oesophagus` and `airways` faded so the
  retro-oesophageal course reads. A view from behind shows it best.

## Courses and waypoints

- A tube may not turn more than 90° at a `via` next to a stretch under 1.5 cm (the validator
  refuses it). Most often this comes from a `via` on a small wiggle of a library line: use points
  further apart.
- Few, well-placed waypoints give smoother vessels than many close ones.
- Radii: match the library (`radius_cm` in organs.md): common hepatic artery about 0.25, proper
  hepatic 0.1 to 0.15, bile duct about 0.1 to 0.13, cystic duct about 0.12.

## Views

`view.rot` is `[x, y]` in radians; `zoom` 3 (close) to 16 (far, default about 7 to 9). The chip
on the stage names the view; examples:

| rot | chip |
|---|---|
| `[0, 0]` | Anterior view · patient's right on screen left |
| `[0, 0.6]` | Right anterior oblique view · patient's right on screen left |
| `[0, -0.6]` | Left anterior oblique view · patient's right on screen left |
| `[0, 1.57]` / `[0, -1.57]` | Right / Left lateral view |
| `[0, 2.5]` | Right posterior oblique view · patient's right on screen right |
| `[0, 3.14]` | Posterior view · patient's right on screen right |
| `[0.5, 0]` / `[-0.5, 0]` | Anterior view, from above / from below |

Choose the view in which the variation is seen directly: a hepatic artery takeoff from the SMA
in a right anterior oblique view from slightly below (about `[-0.25, 0.75]`); a cystic duct
running alongside the CBD from the front left (about `[0.1, -0.5]`); a retro-oesophageal artery
from behind (about `[0.35, 2.7]`). From behind, the patient's right is on screen right: describe
sides from the chip, not from habit.
