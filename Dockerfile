FROM node:22-slim

# Install Python3 for the isolated economics sandbox
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package.json ./

# Install dependencies using npm
RUN npm install

# Copy source code and configuration
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/
COPY dossier.mcp.json ./

# Build TypeScript to dist
RUN npx tsc

# Expose port
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start production server
CMD ["node", "dist/server.js"]
