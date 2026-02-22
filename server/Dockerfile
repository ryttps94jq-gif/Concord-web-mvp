# Backend Dockerfile (glibc-based for onnxruntime compatibility)
# Pin to Node 20 LTS for reproducibility
FROM node:20-bookworm-slim AS base

# Install build tools for native modules (better-sqlite3) and runtime deps
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and npm configuration
COPY package*.json ./
COPY .npmrc ./

# Install production deps with retry logic
# The .npmrc contains retry settings for network resilience
RUN npm ci --omit=dev || (sleep 5 && npm ci --omit=dev) || (sleep 10 && npm ci --omit=dev)

# Copy app code
COPY . .

# Run tests before building production image — build fails if any test fails
ENV NODE_ENV=test
ENV CONCORD_NO_LISTEN=true
RUN node --test 'tests/auth.test.js' 'tests/brain-routing.test.js' 'tests/dtu.test.js' 'tests/semantic-cache.test.js' 'tests/embeddings.test.js' 'tests/marketplace.test.js' 'tests/heartbeat.test.js' 'tests/api-endpoints.test.js' || (echo "Tests failed — aborting build" && exit 1)

ENV NODE_ENV=production
ENV PORT=5050
ENV DATA_DIR=/data
ENV STATE_PATH=/data/concord_state.json
ENV npm_config_cache=/data/npm-cache

# Ensure xenova transformers cache dir exists (optional dep; avoids noisy log warnings)
RUN mkdir -p /app/node_modules/@xenova/transformers/.cache && chmod 777 /app/node_modules/@xenova/transformers/.cache

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -g nodejs concord && \
    mkdir -p /data /data/npm-cache && chown -R concord:nodejs /data

USER concord

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5050/health || exit 1

CMD ["node", "server.js"]
