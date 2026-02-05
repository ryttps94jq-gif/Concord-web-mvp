# Backend Dockerfile (glibc-based for onnxruntime compatibility)
FROM node:20-bookworm-slim

# Install runtime deps for native modules
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install production deps
RUN npm ci --omit=dev

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
