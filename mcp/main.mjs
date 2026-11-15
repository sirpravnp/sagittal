#!/usr/bin/env node
// Sagittal MCP server.
//   Local (Claude Code, Claude Desktop, any stdio client):   node mcp/main.mjs
//     figures are also written as offline HTML files to $SAGITTAL_FIGURES_DIR (default <tmp>/sagittal-figures)
//   Hosted (claude.ai, ChatGPT and other remote clients):    node mcp/main.mjs --http [port]
//     PORT, HOST            listen address (HOST=0.0.0.0 in a container)
//     SAGITTAL_PUBLIC_URL   public base, e.g. https://mcp.example.org; figure links point here
// Stateless: no accounts and nothing stored. POST /mcp (and POST /) speak Streamable HTTP;
// GET /figure/<code> returns the figure as one HTML file; GET /health says it is up.
import { createServer } from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildServer, VERSION } from './server.mjs';
import { decodeSpec, figureFile } from './figure.mjs';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, mcp-session-id, mcp-protocol-version, authorization',
  'access-control-expose-headers': 'mcp-session-id',
};

async function readJson(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 1_000_000) throw Object.assign(new Error('request body too large'), { code: 413 }); chunks.push(c); }
  const s = Buffer.concat(chunks).toString('utf8');
  try { return s ? JSON.parse(s) : undefined; } catch { throw Object.assign(new Error('invalid JSON'), { code: 400 }); }
}

export function startHttp({ port = 8788, host = '127.0.0.1', publicUrl } = {}) {
  const send = (res, code, body, headers = {}) => {
    res.writeHead(code, { 'content-type': 'application/json', ...CORS, ...headers });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  const http = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const base = publicUrl || `http://${req.headers.host ?? `localhost:${port}`}`;
      if (req.method === 'OPTIONS') return send(res, 204, '');
      if (url.pathname === '/health' || (url.pathname === '/' && req.method === 'GET')) {
        return send(res, 200, { name: 'sagittal', version: VERSION, mcp: base.replace(/\/$/, '') + '/mcp' });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/figure/')) {
        let spec;
        try { spec = decodeSpec(url.pathname.slice('/figure/'.length).replace(/\.html$/, '')); } catch { return send(res, 400, { error: 'bad figure link' }); }
        const f = figureFile(spec);
        if (!f.ok) return send(res, 422, { error: 'invalid figure', errors: f.errors });
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=86400', ...CORS });
        return res.end(f.html);
      }
      if (url.pathname === '/mcp' || url.pathname === '/mcp/' || (url.pathname === '/' && req.method === 'POST')) {
        if (req.method !== 'POST') { res.writeHead(405, { ...CORS, allow: 'POST' }); return res.end(); }
        const body = await readJson(req);
        const server = buildServer({ publicUrl: base });
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.on('close', () => { void transport.close(); void server.close(); });
        await server.connect(transport);
        return await transport.handleRequest(req, res, body);
      }
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      if (!res.headersSent) send(res, e.code || 500, { error: e.message });
    }
  });
  return new Promise((resolve) => http.listen(port, host, () => resolve(http)));
}

async function main() {
  const env = process.env;
  const i = process.argv.indexOf('--http');
  if (i >= 0) {
    const port = Number(process.argv[i + 1]) || Number(env.PORT) || 8788;
    const host = env.HOST || '127.0.0.1';
    const srv = await startHttp({ port, host, publicUrl: env.SAGITTAL_PUBLIC_URL });
    console.error(`Sagittal MCP on http://${host}:${srv.address().port}/mcp`);
    const stop = () => srv.close(() => process.exit(0));
    process.on('SIGTERM', stop); process.on('SIGINT', stop);
  } else {
    await buildServer({ writeFiles: true, figuresDir: env.SAGITTAL_FIGURES_DIR }).connect(new StdioServerTransport());
    console.error('Sagittal MCP ready on stdio');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
