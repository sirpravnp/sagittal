#!/usr/bin/env python3
"""Pack rendered card images into Anki .apkg decks, one per topic."""
import argparse
import hashlib
import html
import json
import re
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


def status_text(scene: dict) -> str:
    if scene.get("status") == "reviewed":
        return f"Reviewed by {scene.get('reviewer', '')} on {scene.get('reviewedOn', '')}"
    return UNREVIEWED


def build_deck(topic, scenes, cards_dir, out) -> None:
    cards_dir, out = Path(cards_dir), Path(out)
    model = make_model()
    deck = genanki.Deck(stable_id("sagittal-deck-" + topic), f"Sagittal::{topic}")
    media = []
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
    out.parent.mkdir(parents=True, exist_ok=True)
    pkg = genanki.Package(deck)
    pkg.media_files = media
    pkg.write_to_file(str(out))


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--site", required=True)
    ap.add_argument("--cards", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args(argv)
    scenes_dir = Path(args.site) / "scenes"
    ids = json.loads((scenes_dir / "index.json").read_text(encoding="utf-8"))
    by_topic = {}
    for sid in ids:
        meta = json.loads((scenes_dir / f"{sid}.meta.json").read_text(encoding="utf-8"))
        by_topic.setdefault(meta["topic"], []).append(meta)
    out_dir = Path(args.out)
    for topic, scenes in by_topic.items():
        target = out_dir / f"{slugify(topic)}.apkg"
        build_deck(topic, scenes, Path(args.cards), target)
        print(f"{target} ({sum(len(s['variants']) for s in scenes)} cards)")


if __name__ == "__main__":
    main()
