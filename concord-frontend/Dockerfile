# Frontend Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV npm_config_cache=/tmp/npm-cache

# Copy package files and npm configuration
COPY package*.json ./
COPY .npmrc ./

# Install dependencies with retry logic
# The .npmrc contains retry settings for network resilience
RUN npm ci || (sleep 5 && npm ci) || (sleep 10 && npm ci)

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for API and Socket URLs
ARG NEXT_PUBLIC_API_URL=http://localhost:5050
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:5050
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

# Optional CI-only build controls (defaults keep full checks enabled)
ARG CI_SKIP_TYPECHECK=0
ARG CI_SKIP_LINT_IN_BUILD=0
ENV CI_SKIP_TYPECHECK=$CI_SKIP_TYPECHECK
ENV CI_SKIP_LINT_IN_BUILD=$CI_SKIP_LINT_IN_BUILD

# Build Next.js app
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_CACHE_DIR=/data/next-cache
ENV npm_config_cache=/data/npm-cache

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /data/next-cache /data/npm-cache
RUN chown -R nextjs:nodejs /data

# Copy public folder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: 3000, path: '/', timeout: 5000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

CMD ["node", "server.js"]
