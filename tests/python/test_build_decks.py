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


# ---- Task 9: experimental 3D note type ----
SITE = Path(__file__).resolve().parents[2] / "site"


@pytest.fixture
def site3d(tmp_path, scenes):
    """Fake site dir with the shared libs and a scene script per scene."""
    s = tmp_path / "site3d"
    (s / "vendor").mkdir(parents=True)
    (s / "kit").mkdir()
    (s / "scenes").mkdir()
    (s / "vendor" / "three.min.js").write_text("/*three*/")
    (s / "kit" / "labels.js").write_text("/*labels*/")
    (s / "kit" / "kit.js").write_text("/*kit*/")
    for sc in scenes:
        (s / "scenes" / f"{sc['id']}.js").write_text("/*scene*/")
    return s


def test_3d_media_exactly_once(tmp_path, scenes, cards, site3d):
    out = tmp_path / "t3.apkg"
    build_decks.build_deck("T", scenes, cards, out, include_3d=True, site_dir=site3d)
    notes, _, media = read_apkg(out)
    names = list(media.values())
    assert len(names) == len(set(names))
    for n in ("_three.min.js", "_labels.js", "_kit.js", "_scene_alpha.js", "_scene_beta.js"):
        assert names.count(n) == 1
    assert "alpha__a__back.png" in names


def test_no_3d_media_when_disabled(tmp_path, scenes, cards, site3d):
    out = tmp_path / "t2.apkg"
    build_decks.build_deck("T", scenes, cards, out, include_3d=False, site_dir=site3d)
    notes, _, media = read_apkg(out)
    assert not [n for n in media.values() if n.startswith("_")]
    assert len(notes) == 3


def test_3d_note_count_and_guids(tmp_path, scenes, cards, site3d):
    a, b = tmp_path / "a" / "x.apkg", tmp_path / "b" / "x.apkg"
    a.parent.mkdir(); b.parent.mkdir()
    build_decks.build_deck("T", scenes, cards, a, include_3d=True, site_dir=site3d)
    build_decks.build_deck("T", scenes, cards, b, include_3d=True, site_dir=site3d)
    na, _, _ = read_apkg(a)
    nb, _, _ = read_apkg(b)
    assert len(na) == 6  # 3 image + 3 3D
    assert sorted(n[0] for n in na) == sorted(n[0] for n in nb)
    assert len({n[0] for n in na}) == 6
    import genanki
    assert genanki.guid_for("alpha", "a", "3d") in [n[0] for n in na]
    f3 = [n[1].split("\x1f") for n in na if len(n[1].split("\x1f")) == 7]
    assert len(f3) == 3
    assert f3[0][1:4] == ["alpha", "d", "a"]
    assert '<img src="alpha__a__back.png">' in f3[0][4]


def test_3d_template_safe():
    t = (Path(build_decks.__file__).parent / "anki3d_template.html").read_text(encoding="utf-8")
    assert "{{Fallback}}" in t
    assert "import " not in t and "import(" not in t and 'type="module"' not in t
    for n in ("_three.min.js", "_labels.js", "_kit.js", "_scene_", "onerror", "isConnected"):
        assert n in t
    assert "3D unavailable" in t and "3D OK" in t


def test_3d_model_name_and_id():
    m = build_decks.make_model_3d()
    assert m.name == "Anatomy 3D (experimental)"
    assert m.model_id == build_decks.stable_id("sagittal-model-3d-v1")
    assert [f["name"] for f in m.fields] == ["Title", "SceneId", "VariantControl", "VariantKey", "Fallback", "Claims", "Status"]


def test_cli_include_3d(tmp_path, scenes, cards, site3d):
    site = site3d
    (site / "scenes" / "index.json").write_text(json.dumps([s["id"] for s in scenes]))
    for s in scenes:
        (site / "scenes" / f"{s['id']}.meta.json").write_text(json.dumps(dict(s, topic="Cardiology")))
    out = tmp_path / "out"
    build_decks.main(["--site", str(site), "--cards", str(cards), "--out", str(out), "--include-3d"])
    assert [p.name for p in out.glob("*.apkg")] == ["sagittal-cardiology-3d.apkg"]
    _, _, media = read_apkg(out / "sagittal-cardiology-3d.apkg")
    assert "_kit.js" in media.values()


def test_3d_front_has_title_prompt_and_hides_labels_until_back():
    t = (Path(build_decks.__file__).parent / "anki3d_template.html").read_text(encoding="utf-8")
    assert "{{Title}}" in t
    assert "identify the labelled structures" in t
    assert "setLabelsVisible(" in t and "sagittal-back" in t
    m = build_decks.make_model_3d()
    afmt = m.templates[0]["afmt"]
    assert 'id="sagittal-back"' in afmt
    assert afmt.index('id="sagittal-back"') < afmt.index("{{FrontSide}}")


# ---- baked meshes in the 3D deck ----
def test_scene_meshes_parses_scene_def():
    js = "Kit.register({ id: 'x', meshes: ['thorax', \"heart-ct\"], build: function () {} });"
    assert build_decks.scene_meshes(js) == ["thorax", "heart-ct"]
    assert build_decks.scene_meshes("Kit.register({ id: 'x' })") == []


def test_3d_deck_packs_declared_meshes_once(tmp_path, scenes, cards, site3d):
    (site3d / "meshes").mkdir()
    (site3d / "meshes" / "thorax.js").write_text("/*mesh*/")
    for sc in scenes:
        (site3d / "scenes" / f"{sc['id']}.js").write_text("Kit.register({ id: '%s', meshes: ['thorax'] });" % sc["id"])
    out = tmp_path / "m.apkg"
    build_decks.build_deck("T", scenes, cards, out, include_3d=True, site_dir=site3d)
    _, _, media = read_apkg(out)
    assert list(media.values()).count("_mesh_thorax.js") == 1


def test_3d_deck_missing_mesh_fails(tmp_path, scenes, cards, site3d):
    (site3d / "scenes" / f"{scenes[0]['id']}.js").write_text("Kit.register({ meshes: ['nope'] });")
    with pytest.raises(FileNotFoundError, match="nope"):
        build_decks.build_deck("T", scenes, cards, tmp_path / "x.apkg", include_3d=True, site_dir=site3d)


def test_3d_template_loads_meshes():
    t = (Path(build_decks.__file__).parent / "anki3d_template.html").read_text(encoding="utf-8")
    assert "_mesh_" in t and "def.meshes" in t
