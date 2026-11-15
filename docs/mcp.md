# Sagittal MCP server

The MCP server brings Sagittal to any MCP client — claude.ai, ChatGPT, Claude Code, Claude
Desktop — with no skill to install: the student adds one connector and asks for a figure. It is
the same figure as the skill makes (same spec format, validator, player, figure UI and organ
library); the server only packages it for chat.

Stateless: no accounts, no storage, no API keys. `mcp/` holds it:

| file | what |
|---|---|
| `mcp/main.mjs` | entry point: stdio (local clients) or `--http [port]` (remote clients) |
| `mcp/server.mjs` | tools, resources, the instructions every client's model receives |
| `mcp/figure.mjs` | the in-chat view, mesh data, text fallback, figure links |
| `mcp/viewer-boot.js` | the view's bridge to the host (MCP Apps postMessage, or ChatGPT's `window.openai`) |

## Tools

| tool | what it returns |
|---|---|
| `get_figure_format` | the spec format (`docs/spec.md`) and general patterns (`skills/sagittal/reference/patterns.md`) |
| `list_organs` | every base organ: system, parts, centre lines, landmark count; and the library gaps |
| `get_organ` | one organ: parts, centre lines (from, parent, radius, length, t of each landmark and branch along it), landmarks |
| `list_references` | the fixed reference list: id, title, url, covers |
| `validate_figure` | every error in a spec, with its path; or what the figure changes |
| `render_figure` | validates, then shows the interactive figure in the chat; text summary (organs, what changed, claims with references) and a link to the figure as one HTML file |
| `sagittal_meshes` | internal (app-only): the 3D models, for a view whose host dropped `_meta` |

The server instructions carry the skill's rules: never draw from memory or give coordinates (only
landmarks, centre-line points and short axis offsets), cite only listed references for what they
cover, refuse what the base organs cannot support, check both views before showing.

## How the figure reaches the chat

- **The view** (`ui://sagittal/figure.html`, `text/html;profile=mcp-app`) is the figure page
  without a spec: figure CSS, three.js, the kit, every organ manifest and reference, the player
  and figure UI, and `viewer-boot.js` — about **0.9 MB**, no network access needed.
- **`render_figure`** returns `structuredContent` = `{ title, spec, meshes, link }` and
  `_meta["sagittal/meshes"]` = the baked models the figure draws (**0.3–0.5 MB** for the
  example figures; `_meta` is for the view, not the model). The view validates the spec in the
  page and mounts the same `SagittalUI` page that `make-figure` writes to a file.
- If a host does not forward `_meta`, the view calls `sagittal_meshes` through the host.
- **No in-chat views** (older clients): the text result has the summary and a link —
  `GET /figure/<code>` on the server returns the figure as one offline HTML file (the code is the
  compressed spec, so nothing is stored). Over stdio the file is written to
  `$SAGITTAL_FIGURES_DIR` (default `<tmp>/sagittal-figures`) and its path returned.

## Client support

| client | how it shows figures | verified here |
|---|---|---|
| claude.ai, Claude Desktop | MCP Apps view (`_meta.ui.resourceUri`) | protocol tested against a fake MCP Apps host (e2e); not yet tried in claude.ai |
| ChatGPT (developer mode connectors, Apps) | MCP Apps view, or the Apps SDK template `ui://sagittal/figure-chatgpt.html` (`text/html+skybridge`, `openai/outputTemplate`), reading `window.openai.toolOutput` / `toolResponseMetadata` | the `window.openai` path is tested in a browser (e2e); not yet tried in ChatGPT |
| Claude Code | text summary + figure file path (stdio) or link (HTTP); Claude Code does not render MCP Apps | tested over stdio and HTTP with the MCP SDK client |
| any MCP client | tools + text fallback + figure link | tested with the MCP SDK client |

## Connect

Run locally (no hosting needed):

```sh
npm install
npm run mcp:http            # http://127.0.0.1:8788/mcp
```

- **Claude Code** (local, stdio): `claude mcp add sagittal -- node /path/to/sagittal/mcp/main.mjs`
  — or remote: `claude mcp add --transport http sagittal https://<host>/mcp`
- **claude.ai**: Settings → Connectors → Add custom connector → paste `https://<host>/mcp`.
  claude.ai needs a public https address, so this needs hosting (below).
- **ChatGPT**: Settings → Apps & Connectors → Advanced → Developer mode; then Create, paste
  `https://<host>/mcp`, no authentication. Also needs a public https address.

## Hosting (not set up; owner approves)

`fly.toml` and `Dockerfile` mirror CoroSim's: one `shared-cpu-1x` 512 MB machine that sleeps when
idle and wakes on the next request (a second or two). No volume, no secrets. Expected cost: a
few dollars a month at low use (Fly bills only while the machine runs; check Fly's current
pricing). Steps for the owner:

1. `fly launch --no-deploy --copy-config --name <app-name>` (creates the Fly app; needs a Fly account).
2. Set `SAGITTAL_PUBLIC_URL` in `fly.toml` to the app's https address (or a custom domain).
3. `fly deploy --ha=false`, then open `https://<host>/health`.
4. Add `https://<host>/mcp` as a connector in claude.ai and ChatGPT.
