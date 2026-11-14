#!/usr/bin/env python3
"""Pack rendered card images into Anki .apkg decks, one per topic."""
import argparse
import hashlib
import html
import json
import re
import shutil
from pathlib import Path

import genanki

MODEL_NAME = "Anatomy Visual"
UNREVIEWED = "Unreviewed: verify against your textbook"

CSS = """.card { font-family: arial; font-size: 18px; text-align: center; }
img { max-width: 100%; height: auto; }
.claims { text-align: left; font-size: 15px; }
.status { font-size: 13px; color: #888; margin-top: 8px; }"""


def stable_id(text: str) -> int:
    """Deterministic id in genanki's [1<<30, 1<<31) range."""
    n = int.from_bytes(hashlib.sha1(text.encode("utf-8")).digest()[:8], "big")
    return (1 << 30) + n % (1 << 30)


def slugify(topic: str) -> str:
    return "sagittal-" + re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-")


def make_model() -> genanki.Model:
    return genanki.Model(
        stable_id("sagittal-model-v1"),
        MODEL_NAME,
        fields=[{"name": n} for n in ("Title", "Front", "Back", "Claims", "Status")],
        templates=[{
            "name": "Card 1",
            "qfmt": "{{Front}}",
            "afmt": '{{FrontSide}}<hr id="answer">{{Back}}'
                    '<div class="claims">{{Claims}}</div><div class="status">{{Status}}</div>',
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
.kit-fallback { padding: 24px; text-align: center; color: #888; }"""


def make_model_3d() -> genanki.Model:
    fields = ("Title", "SceneId", "VariantControl", "VariantKey", "Fallback", "Claims", "Status")
    return genanki.Model(
        stable_id("sagittal-model-3d-v1"),
        MODEL_3D_NAME,
        fields=[{"name": n} for n in fields],
        templates=[{
            "name": "Card 1",
            "qfmt": TEMPLATE_3D.read_text(encoding="utf-8"),
            "afmt": '<div id="sagittal-back"></div>{{FrontSide}}<hr id="answer">{{Claims}}'
                    '<div class="status">{{Status}}</div>',
        }],
        css=CSS_3D,
    )


def status_text(scene: dict) -> str:
    if scene.get("status") == "reviewed":
        return f"Reviewed by {scene.get('reviewer', '')} on {scene.get('reviewedOn', '')}"
    return UNREVIEWED


def build_deck(topic, scenes, cards_dir, out, include_3d=False, site_dir=None) -> None:
    cards_dir, out = Path(cards_dir), Path(out)
    model = make_model()
    deck = genanki.Deck(stable_id("sagittal-deck-" + topic), f"Sagittal::{topic}")
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
        for src, name in libs + [(site_dir / "scenes" / f"{sc['id']}.js", f"_scene_{sc['id']}.js")
                                 for sc in scenes]:
            dst = stage / name
            shutil.copyfile(src, dst)
            staged.append(str(dst))
    for scene in scenes:
        claims = "<ul>" + "".join(f"<li>{html.escape(c)}</li>" for c in scene["claims"]) + "</ul>"
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
                fields=[html.escape(title), front, back, claims, html.escape(status_text(scene))],
                guid=genanki.guid_for(scene["id"], v["key"]),
            ))
            if include_3d:
                fallback = f'<img src="{names["back"]}">'
                deck.add_note(genanki.Note(
                    model=model3d,
                    fields=[html.escape(title), scene["id"], scene.get("variantControl", ""),
                            v["key"], fallback, claims, html.escape(status_text(scene))],
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
