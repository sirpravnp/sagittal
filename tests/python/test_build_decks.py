import json
import sqlite3
import struct
import sys
import zlib
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools"))
import build_decks  # noqa: E402


def make_png(path: Path, seed: int = 0) -> None:
    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    raw = b"\x00" + bytes([seed % 256, 0, 0])
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def scene(sid, title, variants, claims, **extra):
    d = {
        "id": sid,
        "title": title,
        "topic": "Test & Topic",
        "variantControl": "d",
        "variants": [{"key": k, "label": l} for k, l in variants],
        "claims": claims,
        "sources": [],
        "status": "unreviewed",
    }
    d.update(extra)
    return d


@pytest.fixture
def scenes():
    return [
        scene("alpha", "Alpha", [("a", "Variant A"), ("b", "Variant B")],
              ["EF ≥ 50% → normal", "P < 0.05 & rising", "<b>bold</b>"]),
        scene("beta", "Beta", [("x", "Variant X")], ["one"],
              status="reviewed", reviewer="Dr Who", reviewedOn="2026-01-02"),
    ]


@pytest.fixture
def cards(tmp_path, scenes):
    d = tmp_path / "cards"
    d.mkdir()
    n = 0
    for s in scenes:
        for v in s["variants"]:
            for side in ("front", "back"):
                n += 1
                make_png(d / f"{s['id']}__{v['key']}__{side}.png", n)
    return d


def read_apkg(path):
    z = zipfile.ZipFile(path)
    db = Path(path).parent / "col.sqlite"
    db.write_bytes(z.read("collection.anki2"))
    con = sqlite3.connect(db)
    notes = con.execute("select guid, flds from notes order by id").fetchall()
    decks = json.loads(con.execute("select decks from col").fetchone()[0])
    con.close()
    media = json.loads(z.read("media"))
    return notes, decks, media


def test_note_count_media_and_escaping(tmp_path, scenes, cards):
    out = tmp_path / "t.apkg"
    build_decks.build_deck("Test & Topic", scenes, cards, out)
    notes, decks, media = read_apkg(out)
    assert len(notes) == 3
    names = list(media.values())
    assert len(names) == len(set(names)) == 6
    assert "alpha__a__front.png" in names and "beta__x__back.png" in names
    flds = [n[1].split("\x1f") for n in notes]
    assert flds[0][0] == "Alpha — Variant A"
    claims = flds[0][3]
    assert "≥" in claims and "→" in claims and "&lt; 0.05 &amp; rising" in claims
    assert "&lt;b&gt;bold&lt;/b&gt;" in claims and claims.startswith("<ul>")
    assert "Variant A — identify the labelled structures" in flds[0][1] or "identify the labelled structures" in flds[0][1]
    assert "alpha__a__front.png" in flds[0][1]
    assert "alpha__a__back.png" in flds[0][2]
    assert any(d["name"] == "Sagittal::Test & Topic" for d in decks.values())


def test_status_values(tmp_path, scenes, cards):
    out = tmp_path / "t.apkg"
    build_decks.build_deck("Test & Topic", scenes, cards, out)
    notes, _, _ = read_apkg(out)
    flds = [n[1].split("\x1f") for n in notes]
    assert flds[0][4] == "Unreviewed: verify against your textbook"
    assert flds[2][4] == "Reviewed by Dr Who on 2026-01-02"


def test_deterministic_guids_and_ids(tmp_path, scenes, cards):
    a, b = tmp_path / "a" / "x.apkg", tmp_path / "b" / "x.apkg"
    a.parent.mkdir(); b.parent.mkdir()
    build_decks.build_deck("T", scenes, cards, a)
    build_decks.build_deck("T", scenes, cards, b)
    na, da, _ = read_apkg(a)
    nb, db_, _ = read_apkg(b)
    assert [n[0] for n in na] == [n[0] for n in nb]
    assert set(da) == set(db_)
    assert build_decks.stable_id("sagittal-deck-T") == build_decks.stable_id("sagittal-deck-T")
    assert (1 << 30) <= build_decks.stable_id("x") < (1 << 31)


def test_missing_image_raises(tmp_path, scenes, cards):
    (cards / "beta__x__back.png").unlink()
    with pytest.raises(FileNotFoundError, match="beta__x__back.png"):
        build_decks.build_deck("T", scenes, cards, tmp_path / "t.apkg")


def test_slug():
    assert build_decks.slugify("Obstetrics & Gynecology") == "sagittal-obstetrics-gynecology"
    assert build_decks.slugify(" Cardiology ") == "sagittal-cardiology"


def test_build_all_cli(tmp_path, scenes, cards):
    site = tmp_path / "site" / "scenes"
    site.mkdir(parents=True)
    (site / "index.json").write_text(json.dumps([s["id"] for s in scenes]))
    for s in scenes:
        s = dict(s, topic="Cardiology")
        (site / f"{s['id']}.meta.json").write_text(json.dumps(s))
    out = tmp_path / "out"
    build_decks.main(["--site", str(tmp_path / "site"), "--cards", str(cards), "--out", str(out)])
    assert [p.name for p in out.glob("*.apkg")] == ["sagittal-cardiology.apkg"]
