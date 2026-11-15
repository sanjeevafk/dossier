# syntax=docker/dockerfile:1
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tailwind.config.js ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY public/ ./public/
RUN pnpm run build:css && pnpm exec tsc && pnpm run build:assets
RUN pnpm prune --prod

FROM node:22-slim
# Python3 + numpy for the isolated economics sandbox
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip curl ca-certificates \
    && pip install --no-cache-dir --break-system-packages numpy \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PORT=3000 NODE_ENV=production NODE_OPTIONS="--max-old-space-size=256"
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node package.json dossier.mcp.json ./
COPY --chown=node:node scripts/ ./scripts/
COPY --chown=node:node src/data/ ./src/data/
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
