# sagittal

sagittal is an open-source static website of interactive three.js anatomy
visuals for medical students. Phase 1 is a premade library of scenes served as
plain static files, with no server.

**Review status:** every visual is currently marked "Unreviewed: verify
against your textbook". Do not treat any scene as authoritative.

**Educational use only.** sagittal is not clinical advice and must not be used
for diagnosis or treatment decisions.

**Live site:** `https://<your-github-user>.github.io/sagittal/` (placeholder:
replace with the real URL once the repository is published).

## Run locally

    npm ci
    python3 -m http.server 8000 --directory site

Open http://localhost:8000/. The "Download Anki decks" links on the gallery
point at `decks/`, which only exists on the deployed site (CI copies the built
decks there), so they 404 when serving `site/` locally.

## Build cards and Anki decks

    python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt
    npm run cards       # PNGs into build/cards (needs Google Chrome locally)
    npm run decks       # 2D decks into build/decks/sagittal-<topic>.apkg
    npm run decks:3d    # experimental 3D decks, sagittal-<topic>-3d.apkg

Decks are downloadable from the live site and attached to GitHub Releases for
`v*` tags.

**Anki 3D compatibility:** the 3D deck is experimental. Interactive 3D cards
were confirmed working on Anki desktop by an early spike with a test card.
Phone and tablet clients (AnkiMobile, AnkiDroid) are unverified. The default
2D decks use static images and work everywhere.

## Development

    npm test            # unit tests
    npm run test:py     # Python deck tests
    npm run e2e         # Playwright browser tests

See `CONTRIBUTING.md` for adding scenes and the review process.

## Licenses

- Code: MIT (see `LICENSE`).
- Scene content (text, metadata, claims): CC BY-SA 4.0 (see `LICENSE-CONTENT.md`).
