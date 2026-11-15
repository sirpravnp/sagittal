# Sagittal MCP server (stateless; no accounts, no storage).
#   docker build -t sagittal-mcp . && docker run -p 8788:8788 -e SAGITTAL_PUBLIC_URL=http://localhost:8788 sagittal-mcp
# Put it behind HTTPS (Fly does this); Claude and ChatGPT connectors require https.
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
# Only what the server reads: the server, the player and figure UI, the organ library,
# three.js and the kit, credits, and the spec/organ references served to the model.
COPY mcp ./mcp
COPY player ./player
COPY organs ./organs
COPY site/vendor ./site/vendor
COPY site/kit ./site/kit
COPY site/meshes/credits.json ./site/meshes/credits.json
COPY skills/sagittal/reference ./skills/sagittal/reference
COPY docs/spec.md ./docs/spec.md
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8788
EXPOSE 8788
HEALTHCHECK CMD wget -qO- http://127.0.0.1:${PORT}/health >/dev/null || exit 1
USER node
CMD ["node", "mcp/main.mjs", "--http"]
