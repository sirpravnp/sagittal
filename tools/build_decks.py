#!/usr/bin/env python3
"""Pack rendered card images into Anki .apkg decks, one per topic."""
import argparse
import hashlib
import html
import json
import os
import re
import shutil
from pathlib import Path

import genanki

MODEL_NAME = "Anatomy Visual"

CSS = """.card { font-family: arial; font-size: 18px; text-align: center; }
img { max-width: 100%; height: auto; }
.claims { text-align: left; font-size: 15px; }
.status { font-size: 13px; color: #888; margin-top: 8px; }
.credit { font-size: 11px; color: #888; margin-top: 10px; text-align: left; }"""

# Where the full credits live. CI sets SAGITTAL_CREDITS_URL to the deployed credits page.
CREDITS_REF = "site/meshes/CREDITS.md in the Sagittal repository"
# Used when the site's credits.json is not available (e.g. unit tests with a fake site).
FALLBACK_SOURCES = {
    "zanatomy": {"text": "Z-Anatomy (G. Kervyn, M. Zielinski et al.), after BodyParts3D (DBCLS)",
                 "licence": "CC BY-SA 4.0"},
    "rodero-heart": {"text": "Rodero et al. 2021, average adult heart (doi:10.5281/zenodo.4593739)",
                     "licence": "CC BY 4.0"},
}
MESH_CREDIT_RE = re.compile(r'"credit"\s*:\s*"([a-z0-9-]+)"')


def load_credits(site_dir):
    """site/meshes/credits.json, or a fallback that names every source."""
    if site_dir is not None:
        p = Path(site_dir) / "meshes" / "credits.json"
        if p.is_file():
            return json.loads(p.read_text(encoding="utf-8"))
    return {"sources": FALLBACK_SOURCES, "extra": {},
            "changes": "Models modified: extracted, simplified, re-posed and labelled for Sagittal.",
            "content": "Sagittal card text and images: CC BY-SA 4.0.",
            "procedural": "Model built in code by Sagittal (no third-party mesh)."}


def mesh_credit(site_dir, mesh):
    p = Path(site_dir) / "meshes" / f"{mesh}.js"
    if not p.is_file():
        return None
    m = MESH_CREDIT_RE.search(p.read_text(encoding="utf-8")[-4000:])
    return m.group(1) if m else None


def scene_source_ids(scene_id, site_dir, credits):
    """Credit ids for a scene: its meshes' credit ids plus credits.json extras. None if unknown."""
    if site_dir is None:
        return None
    js = Path(site_dir) / "scenes" / f"{scene_id}.js"
    if not js.is_file():
        return None
    extra = credits.get("extra", {})
    ids = []
    for m in scene_meshes(js.read_text(encoding="utf-8")):
        for c in [mesh_credit(site_dir, m)] + extra.get("mesh:" + m, []):
            if c and c not in ids:
                ids.append(c)
    for c in extra.get("scene:" + scene_id, []):
        if c not in ids:
            ids.append(c)
    return ids


def credit_text(ids, credits, ref=None):
    """One plain-text attribution line (CC BY / BY-SA section 3(a)): sources, licences, changes."""
    src = credits["sources"]
    if ids is None:
        ids = list(src)
    ids = [i for i in ids if i in src]
    ref = ref or os.environ.get("SAGITTAL_CREDITS_URL") or CREDITS_REF
    if ids:
        models = "3D models: " + "; ".join(f"{src[i]['text']}, {src[i]['licence']}" for i in ids) + ". "
        models += credits["changes"] + " "
    else:
        models = credits["procedural"] + " "
    return models + credits["content"] + " Full credits: " + ref


def stable_id(text: str) -> int:
    """Deterministic id in genanki's [1<<30, 1<<31) range."""
    n = int.from_bytes(hashlib.sha1(text.encode("utf-8")).digest()[:8], "big")
    return (1 << 30) + n % (1 << 30)


def slugify(topic: str) -> str:
    return "sagittal-" + re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")


def make_model() -> genanki.Model:
    return genanki.Model(
        stable_id("sagittal-model-v2"),
        MODEL_NAME,
        fields=[{"name": n} for n in ("Title", "Front", "Back", "Claims", "Credit")],
        templates=[{
            "name": "Card 1",
            "qfmt": "{{Front}}",
            "afmt": '{{FrontSide}}<hr id="answer">{{Back}}'
                    '<div class="claims">{{Claims}}</div><div class="credit">{{Credit}}</div>',
        }],
        css=CSS,
    )


MODEL_3D_NAME = "Anatomy 3D (experimental)"
TEMPLATE_3D = Path(__file__).resolve().parent / "anki3d_template.html"

CSS_3D = CSS + """
#s3d-stage { position: relative; width: 100%; height: 360px; overflow: hidden; }
#s3d-cv { position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: block; touch-action: none; }
#s3d-labels { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden; }
.lab { position: absolute; left: 0; top: 0; white-space: nowrap; font-size: 12px; background: rgba(15,20,27,.82); border: 1px solid #3a4a5e; border-radius: 4px; padding: 1px 6px; color: #fff; }
.kit-fallback { padding: 24px; text-align: center; color: #888; }
#s3d-fallback .fb-back { display: none; }
#sagittal-back ~ #s3d-fallback .fb-back { display: inline; }
#sagittal-back ~ #s3d-fallback .fb-front { display: none; }"""


def make_model_3d() -> genanki.Model:
    fields = ("Title", "SceneId", "VariantControl", "VariantKey", "Fallback", "Claims", "Credit")
    return genanki.Model(
        stable_id("sagittal-model-3d-v2"),
        MODEL_3D_NAME,
        fields=[{"name": n} for n in fields],
        templates=[{
            "name": "Card 1",
            "qfmt": TEMPLATE_3D.read_text(encoding="utf-8"),
            "afmt": '<div id="sagittal-back"></div>{{FrontSide}}<hr id="answer">{{Claims}}'
                    '<div class="credit">{{Credit}}</div>',
        }],
        css=CSS_3D,
    )


MESHES_RE = re.compile(r"\bmeshes\s*:\s*\[([^\]]*)\]")


def scene_meshes(js: str) -> list:
    """Mesh names a scene script declares in its SceneDef (`meshes: ['thorax', ...]`)."""
    m = MESHES_RE.search(js)
    return re.findall(r"""['"]([a-z0-9-]+)['"]""", m.group(1)) if m else []


def build_deck(topic, scenes, cards_dir, out, include_3d=False, site_dir=None) -> None:
    cards_dir, out = Path(cards_dir), Path(out)
    model = make_model()
    credits = load_credits(site_dir)
    credit_by_scene = {sc["id"]: credit_text(scene_source_ids(sc["id"], site_dir, credits), credits)
                       for sc in scenes}
    description = ("Sagittal anatomy cards.<br>" + "<br>".join(
                       html.escape(f"{sc['title']}: {credit_by_scene[sc['id']]}") for sc in scenes))
    deck = genanki.Deck(stable_id("sagittal-deck-" + topic), f"Sagittal::{topic}", description=description)
    media = []
    model3d = make_model_3d() if include_3d else None
    if include_3d:
        if site_dir is None:
            raise ValueError("include_3d requires site_dir")
        site_dir = Path(site_dir)
        libs = [(site_dir / "vendor" / "three.min.js", "_three.min.js"),
                (site_dir / "kit" / "labels.js", "_labels.js"),
                (site_dir / "kit" / "kit.js", "_kit.js")]
        for src, _ in libs:
            if not src.is_file():
                raise FileNotFoundError(f"Missing 3D asset: {src}")
        for scene in scenes:
            if not (site_dir / "scenes" / f"{scene['id']}.js").is_file():
                raise FileNotFoundError(f"Missing scene script: {scene['id']}.js")
        # Anki keeps only media files whose names start with an underscore;
        # stage copies under the packed names, each exactly once per deck.
        stage = out.parent / f".{out.stem}-3d-media"
        stage.mkdir(parents=True, exist_ok=True)
        staged = []
        meshes = []
        for sc in scenes:
            for m in scene_meshes((site_dir / "scenes" / f"{sc['id']}.js").read_text(encoding="utf-8")):
                if m not in meshes:
                    meshes.append(m)
        for m in meshes:
            if not (site_dir / "meshes" / f"{m}.js").is_file():
                raise FileNotFoundError(f"Missing mesh script: meshes/{m}.js")
        for src, name in libs + [(site_dir / "scenes" / f"{sc['id']}.js", f"_scene_{sc['id']}.js")
                                 for sc in scenes] + [(site_dir / "meshes" / f"{m}.js", f"_mesh_{m}.js")
                                                      for m in meshes]:
            dst = stage / name
            shutil.copyfile(src, dst)
            staged.append(str(dst))
    for scene in scenes:
        claims = "<ul>" + "".join(f"<li>{html.escape(c)}</li>" for c in scene["claims"]) + "</ul>"
        credit = html.escape(credit_by_scene[scene["id"]])
        for v in scene["variants"]:
            names = {}
            for side in ("front", "back"):
                name = f"{scene['id']}__{v['key']}__{side}.png"
                path = cards_dir / name
                if not path.is_file():
                    raise FileNotFoundError(f"Missing card image: {path}")
                names[side] = name
                media.append(str(path))
            title = f"{scene['title']} — {v['label']}"
            front = (f"<div>{html.escape(title)}</div>"
                     f'<img src="{names["front"]}">'
                     f"<div>{html.escape(v['label'])} — identify the labelled structures</div>")
            back = f'<img src="{names["back"]}">'
            deck.add_note(genanki.Note(
                model=model,
                fields=[html.escape(title), front, back, claims, credit],
                guid=genanki.guid_for(scene["id"], v["key"]),
            ))
            if include_3d:
                # Shown when WebGL fails: the unlabelled image on the front, the labelled one on the back
                # (CSS in CSS_3D and the template script pick by the #sagittal-back marker).
                fallback = (f'<img class="fb-front" src="{names["front"]}">'
                            f'<img class="fb-back" src="{names["back"]}">')
                deck.add_note(genanki.Note(
                    model=model3d,
                    fields=[html.escape(title), scene["id"], scene.get("variantControl", ""),
                            v["key"], fallback, claims, credit],
                    guid=genanki.guid_for(scene["id"], v["key"], "3d"),
                ))
    out.parent.mkdir(parents=True, exist_ok=True)
    pkg = genanki.Package(deck)
    pkg.media_files = media + (staged if include_3d else [])
    pkg.write_to_file(str(out))
    if include_3d:
        shutil.rmtree(stage, ignore_errors=True)


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--site", required=True)
    ap.add_argument("--cards", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--include-3d", action="store_true",
                    help="also add the experimental 3D note type (runs the scene in Anki)")
    args = ap.parse_args(argv)
    scenes_dir = Path(args.site) / "scenes"
    ids = json.loads((scenes_dir / "index.json").read_text(encoding="utf-8"))
    by_topic = {}
    for sid in ids:
        meta = json.loads((scenes_dir / f"{sid}.meta.json").read_text(encoding="utf-8"))
        by_topic.setdefault(meta["topic"], []).append(meta)
    out_dir = Path(args.out)
    for topic, scenes in by_topic.items():
        suffix = "-3d" if args.include_3d else ""
        target = out_dir / f"{slugify(topic)}{suffix}.apkg"
        build_deck(topic, scenes, Path(args.cards), target,
                   include_3d=args.include_3d, site_dir=args.site)
        print(f"{target} ({sum(len(s['variants']) for s in scenes)} cards)")


if __name__ == "__main__":
    main()
