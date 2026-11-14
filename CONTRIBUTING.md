# Contributing to sagittal

sagittal is educational only. Every scene is unreviewed until a qualified reviewer signs it off.

## Setup

    npm ci
    npx playwright install chromium   # or have Google Chrome installed
    python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt

## Adding a scene

A scene `<id>` is two files in `site/scenes/`, plus an entry in the index:

- `site/scenes/<id>.js` registers the scene with the shared kit (`site/kit/`). Look at an existing scene such as `heart.js` as a template.
- `site/scenes/<id>.meta.json` holds the metadata.
- Add `<id>` to `site/scenes/index.json`.

Meta fields (validated by `lib/validateMeta.mjs`; see `tests/` for the exact rules):

- `id`: matches the filename.
- `title`, `topic`: topic groups scenes into one Anki deck.
- `variantControl` and `variants` (`key`, `label`): the control that switches views; one card is rendered per variant.
- `claims`: the factual statements the scene teaches, one per line.
- `sources`: references for the claims (may be empty while unreviewed).
- `status`: `unreviewed` for new scenes.
- `reviewer` and `reviewedOn`: set only by a reviewer (see below).

Run the checks before opening a pull request:

    npm test            # unit tests, including meta validation
    npm run test:py     # deck builder tests
    npm run e2e         # browser tests
    npm run cards && npm run decks   # optional: build cards and decks locally

## Reviewing a scene

A reviewer checks every claim against a cited source, then edits the meta file:

1. Add the references to `sources`.
2. Set `status` to `reviewed`.
3. Set `reviewer` (name or handle) and `reviewedOn` (`YYYY-MM-DD`).

Until then the "Unreviewed: verify against your textbook" badge stays on the scene and its cards. Do not set `reviewed` without a real review.

## Medical corrections

Open an issue with the "Medical correction" template: scene id, the claim, and a source.

## Licenses

Code is MIT; scene content is CC BY-SA 4.0. By contributing you agree to those terms.
