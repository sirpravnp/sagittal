# Contributing to sagittal

sagittal is educational only and is not clinical advice.

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
- `sources`: references for the claims (may be empty).

Run the checks before opening a pull request:

    npm test            # unit tests, including meta validation
    npm run test:py     # deck builder tests
    npm run e2e         # browser tests
    npm run cards && npm run decks   # optional: build cards and decks locally

## Medical corrections

Open an issue with the "Medical correction" template: scene id, the claim, and a source.

## Licenses

Code is MIT; scene content is CC BY-SA 4.0. By contributing you agree to those terms.
