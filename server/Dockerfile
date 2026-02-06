# Backend Dockerfile (glibc-based for onnxruntime compatibility)
FROM node:20-bookworm-slim

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

ENV NODE_ENV=production
ENV PORT=5050

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -m -u 1001 -g nodejs concord && \
    mkdir -p /data && chown -R concord:nodejs /data

USER concord

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5050/api/status || exit 1

CMD ["node", "server.js"]
