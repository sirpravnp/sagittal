// Sagittal MCP server: text-to-image for anatomy in any MCP client (claude.ai, ChatGPT, Claude Code…).
// Stateless: no accounts, no storage. Tools read the base organ library and validate/render figure specs.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { library, validate, meshData, meshesFor, viewHtml, encodeSpec, figureFile, summaryText, slug } from './figure.mjs';

export const VERSION = '0.1.0';
export const VIEW_URI = 'ui://sagittal/figure.html';
export const VIEW_MIME = 'text/html;profile=mcp-app';
// ChatGPT's Apps SDK template (it also understands MCP Apps; this keeps older ChatGPT clients working).
export const OAI_URI = 'ui://sagittal/figure-chatgpt.html';
export const OAI_MIME = 'text/html+skybridge';

// The skill's rules (skills/sagittal/SKILL.md), so any client's model follows them.
export const INSTRUCTIONS = [
  'Sagittal is text-to-image for anatomy: a student asks for a structure, a region or an anatomical variant in plain words and you return an accurate, labelled, interactive 3D figure built from real reconstructed anatomy (open CT segmentations and open atlases).',
  'The rule that decides everything: a plausible but wrong picture is worse than none. Never draw anatomy from memory and never give coordinates. Every point in a figure is a library landmark, a point along a library centre line ({"on": "<organ>/<line>", "t": 0..1}), or one of those moved by a short offset along a body axis (≤ 3 cm).',
  'Workflow: (1) call get_figure_format once (the spec format, ops, limits and patterns); (2) list_organs, then get_organ for every organ you need (parts, centre lines with parents and the t of each landmark and branch along them, landmarks); (3) list_references and cite only reference ids whose "covers" line supports the fact; (4) write the spec and call validate_figure until it has no errors; (5) call render_figure, which shows the figure in the chat. Check that every new or moved vessel visibly leaves its parent, ducts start on their organ, courses are smooth (no hairpins), each label sits on its own structure, the normal view is textbook normal and the variant differs only by the variation. If a fact is wrong or you notice a defect, fix the spec before showing it.',
  'Refuse plainly when the base organs cannot support a request (a structure, landmark or reference is missing): say what is missing and offer what you can build. Educational only; never present a figure as clinical advice.',
].join(' ');

const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const SPEC = { type: 'object', description: 'A figure spec (schema "sagittal-figure/1"); see get_figure_format.' };

export const TOOLS = [
  {
    name: 'get_figure_format', title: 'Figure spec format', readOnly: true,
    description: 'The figure spec format (every field and op, waypoint forms, offsets, limits, error messages, worked examples) and general patterns. Read once before writing a spec.',
    inputSchema: obj({}),
    run: () => { const { specMd, patternsMd } = library(); return { text: specMd + '\n\n---\n\n' + patternsMd }; },
  },
  {
    name: 'list_organs', title: 'List base organs', readOnly: true,
    description: 'The base organ library: every organ with its system, parts and centre lines. Use get_organ for landmarks and positions along lines. Also lists the library gaps (structures it does not have).',
    inputSchema: obj({}),
    run: () => {
      const { organs, organsMd } = library();
      const gaps = (organsMd.match(/\n## Gaps[^\n]*\n([\s\S]*?)(?=\n## )/) || [])[1] || '';
      return {
        organs: organs.index.map(({ id, name, system }) => {
          const m = organs.manifests[id];
          return { id, name, system, parts: m.parts.map((p) => p.id), centerlines: Object.keys(m.centerlines || {}), landmarks: Object.keys(m.landmarks || {}).length };
        }),
        gaps: gaps.trim(),
      };
    },
  },
  {
    name: 'get_organ', title: 'Get one organ', readOnly: true,
    description: 'One organ: parts, centre lines (from landmark, parent, radius, length, the t of every landmark and branch origin along each line) and landmarks, as a markdown reference plus the raw lists.',
    inputSchema: obj({ id: { type: 'string', description: 'Organ id from list_organs, e.g. "coeliac-trunk".' } }, ['id']),
    run: ({ id }) => {
      const { organs, organsMd } = library();
      const m = typeof id === 'string' && Object.prototype.hasOwnProperty.call(organs.manifests, id) ? organs.manifests[id] : null;
      if (!m) throw new Error(`unknown organ "${id}"; call list_organs for the ids`);
      const start = organsMd.indexOf(`\n## ${id}\n`);
      const next = start < 0 ? -1 : organsMd.indexOf('\n## ', start + 4);
      const reference = start < 0 ? '' : organsMd.slice(start + 1, next < 0 ? undefined : next).trim();
      return {
        id, name: m.name, system: m.system, credit: m.credit, reference,
        parts: m.parts,
        centerlines: Object.fromEntries(Object.entries(m.centerlines || {}).map(([k, c]) => [k, { name: c.name, from: c.from, parent: c.parent ?? null, radius_cm: c.radius_cm, points: c.points.length }])),
        landmarks: Object.fromEntries(Object.entries(m.landmarks || {}).map(([k, l]) => [k, l.name])),
      };
    },
  },
  {
    name: 'list_references', title: 'List references', readOnly: true,
    description: 'The fixed reference list. Claims may cite only these ids, and each only for what its "covers" line says it covers.',
    inputSchema: obj({}),
    run: () => ({ references: Object.entries(library().organs.references).map(([id, r]) => ({ id, title: r.title, url: r.url, covers: r.covers })) }),
  },
  {
    name: 'validate_figure', title: 'Check a figure spec', readOnly: true,
    description: 'Validates a figure spec against the base organs and the reference list. Returns every error with its path; fix them all, then call render_figure.',
    inputSchema: obj({ spec: SPEC }, ['spec']),
    run: ({ spec }) => {
      const r = validate(spec);
      return r.ok ? { ok: true, errors: [], title: r.resolved.title, organs: r.resolved.organs.map((o) => o.id), changed: r.resolved.provenance } : { ok: false, errors: r.errors };
    },
  },
  {
    name: 'render_figure', title: 'Show the figure', readOnly: true, view: true,
    description: 'Validates the spec and shows the interactive 3D figure in the chat (Normal / Variant switch, labels, claims with references, Save as image). Returns a text summary too; clients without in-chat views get a link to the figure file (or its path on this machine).',
    inputSchema: obj({ spec: SPEC }, ['spec']),
    run: ({ spec }, env) => {
      const r = validate(spec);
      if (!r.ok) throw new Error('the spec has errors; fix them (validate_figure lists them):\n' + r.errors.join('\n'));
      const R = r.resolved, meshes = meshesFor(R);
      let link = null;
      if (env.publicUrl) link = `${env.publicUrl.replace(/\/$/, '')}/figure/${encodeSpec(spec)}`;
      else if (env.writeFiles) {
        const f = figureFile(spec);
        const dir = env.figuresDir || path.join(tmpdir(), 'sagittal-figures');
        mkdirSync(dir, { recursive: true });
        link = path.join(dir, slug(R.title) + '.html');
        writeFileSync(link, f.html);
      }
      return {
        text: summaryText(R, link),
        structured: { title: R.title, spec, meshes, link },
        meta: { 'sagittal/meshes': Object.fromEntries(meshes.map((n) => [n, meshData(n)])) },
      };
    },
  },
  {
    name: 'sagittal_meshes', title: 'Figure models (internal)', readOnly: true, appOnly: true,
    description: 'Internal: the 3D models a figure view needs. Called by the figure view itself; do not call it.',
    inputSchema: obj({ names: { type: 'array', items: { type: 'string' }, maxItems: 24 } }, ['names']),
    run: ({ names }) => {
      if (!Array.isArray(names) || !names.length) throw new Error('names must be a non-empty list of mesh names');
      const meshes = Object.fromEntries(names.map((n) => [n, meshData(String(n))]));
      return { text: `${names.length} model(s)`, structured: { names }, meta: { 'sagittal/meshes': meshes } };
    },
  },
];

function toolMeta(t) {
  if (t.view) return { ui: { resourceUri: VIEW_URI }, 'ui/resourceUri': VIEW_URI, 'openai/outputTemplate': OAI_URI, 'openai/widgetAccessible': true, 'openai/toolInvocation/invoking': 'Drawing the figure…', 'openai/toolInvocation/invoked': 'Figure ready' };
  if (t.appOnly) return { ui: { visibility: ['app'] } };
  return undefined;
}

/** env: { publicUrl?: string (HTTP mode, for figure links), writeFiles?: boolean (stdio), figuresDir?: string } */
export function buildServer(env = {}) {
  const server = new Server({ name: 'sagittal', version: VERSION }, { capabilities: { tools: {}, resources: {} }, instructions: INSTRUCTIONS });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => {
      const meta = toolMeta(t);
      return {
        name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema,
        annotations: { title: t.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        ...(meta ? { _meta: meta } : {}),
      };
    }),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = TOOLS.find((t) => t.name === req.params.name);
    const args = req.params.arguments ?? {};
    try {
      if (!tool) throw new Error(`unknown tool ${req.params.name}`);
      const out = tool.run(args, env);
      if (out && out.structured) {
        return { content: [{ type: 'text', text: out.text }], structuredContent: out.structured, ...(out.meta ? { _meta: out.meta } : {}) };
      }
      if (out && typeof out.text === 'string' && Object.keys(out).length === 1) return { content: [{ type: 'text', text: out.text }] };
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }], structuredContent: out };
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: `Error: ${e.message}` }] };
    }
  });
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: VIEW_URI, name: 'Sagittal figure', description: 'The interactive 3D figure, shown in the chat.', mimeType: VIEW_MIME },
      { uri: OAI_URI, name: 'Sagittal figure (ChatGPT)', description: 'The same figure view as a ChatGPT Apps SDK template.', mimeType: OAI_MIME },
      { uri: 'sagittal://figure-format', name: 'Figure spec format', mimeType: 'text/markdown' },
      { uri: 'sagittal://organs', name: 'Base organ reference', mimeType: 'text/markdown' },
    ],
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const uri = req.params.uri;
    if (uri === VIEW_URI) return { contents: [{ uri, mimeType: VIEW_MIME, text: viewHtml() }] };
    if (uri === OAI_URI) return { contents: [{ uri, mimeType: OAI_MIME, text: viewHtml() }] };
    if (uri === 'sagittal://figure-format') return { contents: [{ uri, mimeType: 'text/markdown', text: library().specMd }] };
    if (uri === 'sagittal://organs') return { contents: [{ uri, mimeType: 'text/markdown', text: library().organsMd }] };
    throw new Error(`unknown resource ${uri}`);
  });
  return server;
}
