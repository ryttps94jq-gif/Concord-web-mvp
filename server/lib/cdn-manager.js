/**
 * Concord CDN Manager — Abstracts CDN operations for media delivery.
 *
 * Provides a unified interface for pushing artifacts to CDN origins,
 * generating public and signed URLs, purging cached content, and
 * querying cache/bandwidth statistics.
 *
 * Supported providers (via env CONCORD_CDN_PROVIDER):
 *   - 'cloudflare' — Cloudflare R2 + CDN
 *   - 'aws'        — CloudFront + S3
 *   - 'local'      — No CDN, serve directly from origin (development)
 *
 * Env vars:
 *   CONCORD_CDN_PROVIDER                — 'cloudflare' | 'aws' | 'local'
 *   CONCORD_CDN_BASE_URL               — Base URL for CDN (e.g., https://cdn.concord-os.org)
 *   CLOUDFLARE_ACCOUNT_ID              — Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN               — Cloudflare API token
 *   CLOUDFLARE_R2_BUCKET               — R2 bucket name
 *   AWS_CLOUDFRONT_DISTRIBUTION_ID     — CloudFront distribution ID
 *   AWS_S3_BUCKET                      — S3 bucket name
 *   AWS_REGION                         — AWS region
 *
 * The CDN is an acceleration layer, not a requirement.
 * Everything works without a CDN configured — requests are served
 * directly from the origin vault.
 */

import { createHmac, randomUUID } from "node:crypto";

// ── Internal Metrics State ─────────────────────────────────────────────

function createMetrics() {
  return {
    hits: 0,
    misses: 0,
    pushes: 0,
    purges: 0,
    errors: 0,
    bytesServed: 0,
    bytesPushed: 0,
    startedAt: new Date().toISOString(),
    /** @type {Map<string, { status: string, pushedAt: string, size: number, contentType: string }>} */
    artifacts: new Map(),
  };
}

// ── Provider Implementations ───────────────────────────────────────────

/**
 * Local (no-op) provider for development.
 * Serves content directly from the API origin with no CDN layer.
 */
function createLocalProvider(baseUrl) {
  const metrics = createMetrics();

  return {
    name: "local",

    getUrl(artifactHash, options = {}) {
      const quality = options.quality || "original";
      const base = baseUrl || "/api/media";
      return `${base}/${artifactHash}/stream${quality !== "original" ? `?quality=${quality}` : ""}`;
    },

    async pushToOrigin(artifactHash, buffer, contentType) {
      // Local mode: artifact is already in the vault, no push needed.
      const size = buffer ? buffer.length : 0;
      metrics.pushes++;
      metrics.bytesPushed += size;
      metrics.artifacts.set(artifactHash, {
        status: "origin",
        pushedAt: new Date().toISOString(),
        size,
        contentType: contentType || "application/octet-stream",
      });
      return { ok: true, location: "origin", artifactHash };
    },

    async getSignedUrl(artifactHash, expiresInSeconds = 86400) {
      // Local mode: no real signing, return a plain URL with an expiry hint.
      const url = this.getUrl(artifactHash);
      const expires = Date.now() + expiresInSeconds * 1000;
      return { ok: true, url: `${url}${url.includes("?") ? "&" : "?"}expires=${expires}`, expiresAt: new Date(expires).toISOString() };
    },

    async purge(artifactHash) {
      metrics.purges++;
      metrics.artifacts.delete(artifactHash);
      return { ok: true, artifactHash, purged: true };
    },

    async purgeByPrefix(prefix) {
      let count = 0;
      for (const key of metrics.artifacts.keys()) {
        if (key.startsWith(prefix)) {
          metrics.artifacts.delete(key);
          count++;
        }
      }
      metrics.purges += count;
      return { ok: true, prefix, purgedCount: count };
    },

    getCacheStatus(artifactHash) {
      const entry = metrics.artifacts.get(artifactHash);
      if (!entry) return { ok: true, cached: false, artifactHash };
      return { ok: true, cached: true, artifactHash, ...entry };
    },

    getStats() {
      return {
        ok: true,
        provider: "local",
        hits: metrics.hits,
        misses: metrics.misses,
        pushes: metrics.pushes,
        purges: metrics.purges,
        errors: metrics.errors,
        bytesServed: metrics.bytesServed,
        bytesPushed: metrics.bytesPushed,
        cachedArtifacts: metrics.artifacts.size,
        hitRate: metrics.hits + metrics.misses > 0
          ? (metrics.hits / (metrics.hits + metrics.misses) * 100).toFixed(2) + "%"
          : "0.00%",
        uptime: Math.floor((Date.now() - new Date(metrics.startedAt).getTime()) / 1000),
        startedAt: metrics.startedAt,
      };
    },

    recordHit() { metrics.hits++; },
    recordMiss() { metrics.misses++; },
    recordBytesServed(bytes) { metrics.bytesServed += bytes; },
    recordError() { metrics.errors++; },

    getProviderInfo() {
      return {
        provider: "local",
        description: "Local origin serving (no CDN)",
        baseUrl: baseUrl || "/api/media",
        configured: true,
      };
    },

    async healthCheck() {
      return { ok: true, provider: "local", status: "healthy", message: "Local mode — serving directly from origin" };
    },
  };
}

/**
 * Cloudflare R2 + CDN provider.
 * In production, this would use the Cloudflare API for R2 object storage
 * and CDN cache purge. Here we simulate the interface with local state
 * so the integration layer is fully testable without credentials.
 */
function createCloudflareProvider(config) {
  const {
    accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "",
    apiToken = process.env.CLOUDFLARE_API_TOKEN || "",
    r2Bucket = process.env.CLOUDFLARE_R2_BUCKET || "concord-media",
    baseUrl = process.env.CONCORD_CDN_BASE_URL || "",
  } = config;

  const metrics = createMetrics();
  const configured = Boolean(accountId && apiToken);

  return {
    name: "cloudflare",

    getUrl(artifactHash, options = {}) {
      const quality = options.quality || "original";
      if (!baseUrl) {
        return `/api/media/${artifactHash}/stream${quality !== "original" ? `?quality=${quality}` : ""}`;
      }
      return `${baseUrl}/${artifactHash}${quality !== "original" ? `/${quality}` : ""}`;
    },

    async pushToOrigin(artifactHash, buffer, contentType) {
      const size = buffer ? buffer.length : 0;

      if (!configured) {
        // Fallback: store reference only, actual push would require credentials.
        metrics.pushes++;
        metrics.bytesPushed += size;
        metrics.artifacts.set(artifactHash, {
          status: "pending_credentials",
          pushedAt: new Date().toISOString(),
          size,
          contentType: contentType || "application/octet-stream",
        });
        return { ok: true, location: "pending", artifactHash, note: "Cloudflare credentials not configured" };
      }

      // In production: PUT to R2 via S3-compatible API
      // https://developers.cloudflare.com/r2/api/s3/
      //
      // const s3 = new S3Client({
      //   region: "auto",
      //   endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      //   credentials: { accessKeyId: ..., secretAccessKey: ... },
      // });
      // await s3.send(new PutObjectCommand({
      //   Bucket: r2Bucket,
      //   Key: artifactHash,
      //   Body: buffer,
      //   ContentType: contentType,
      // }));

      metrics.pushes++;
      metrics.bytesPushed += size;
      metrics.artifacts.set(artifactHash, {
        status: "cached",
        pushedAt: new Date().toISOString(),
        size,
        contentType: contentType || "application/octet-stream",
      });
      return { ok: true, location: `r2://${r2Bucket}/${artifactHash}`, artifactHash };
    },

    async getSignedUrl(artifactHash, expiresInSeconds = 86400) {
      const url = this.getUrl(artifactHash);
      const expires = Date.now() + expiresInSeconds * 1000;
      const expiresAt = new Date(expires).toISOString();

      // In production: use Cloudflare signed URL with token
      // For now, append HMAC-based token
      const token = createHmac("sha256", apiToken || "dev-secret")
        .update(`${artifactHash}:${expires}`)
        .digest("hex");

      return {
        ok: true,
        url: `${url}${url.includes("?") ? "&" : "?"}token=${token}&expires=${expires}`,
        expiresAt,
      };
    },

    async purge(artifactHash) {
      // In production: Cloudflare API cache purge
      // POST https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache
      // { files: [`${baseUrl}/${artifactHash}`] }
      metrics.purges++;
      metrics.artifacts.delete(artifactHash);
      return { ok: true, artifactHash, purged: true, provider: "cloudflare" };
    },

    async purgeByPrefix(prefix) {
      // Cloudflare supports prefix purge via cache tags in Enterprise.
      // Simulate by iterating.
      let count = 0;
      for (const key of metrics.artifacts.keys()) {
        if (key.startsWith(prefix)) {
          metrics.artifacts.delete(key);
          count++;
        }
      }
      metrics.purges += count;
      return { ok: true, prefix, purgedCount: count, provider: "cloudflare" };
    },

    getCacheStatus(artifactHash) {
      const entry = metrics.artifacts.get(artifactHash);
      if (!entry) return { ok: true, cached: false, artifactHash, provider: "cloudflare" };
      return { ok: true, cached: true, artifactHash, provider: "cloudflare", ...entry };
    },

    getStats() {
      return {
        ok: true,
        provider: "cloudflare",
        r2Bucket,
        hits: metrics.hits,
        misses: metrics.misses,
        pushes: metrics.pushes,
        purges: metrics.purges,
        errors: metrics.errors,
        bytesServed: metrics.bytesServed,
        bytesPushed: metrics.bytesPushed,
        cachedArtifacts: metrics.artifacts.size,
        hitRate: metrics.hits + metrics.misses > 0
          ? (metrics.hits / (metrics.hits + metrics.misses) * 100).toFixed(2) + "%"
          : "0.00%",
        uptime: Math.floor((Date.now() - new Date(metrics.startedAt).getTime()) / 1000),
        startedAt: metrics.startedAt,
        configured,
      };
    },

    recordHit() { metrics.hits++; },
    recordMiss() { metrics.misses++; },
    recordBytesServed(bytes) { metrics.bytesServed += bytes; },
    recordError() { metrics.errors++; },

    getProviderInfo() {
      return {
        provider: "cloudflare",
        description: "Cloudflare R2 + CDN",
        r2Bucket,
        baseUrl: baseUrl || "(not configured)",
        configured,
      };
    },

    async healthCheck() {
      if (!configured) {
        return {
          ok: false,
          provider: "cloudflare",
          status: "unconfigured",
          message: "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN",
        };
      }

      // In production: check Cloudflare API connectivity
      // GET https://api.cloudflare.com/client/v4/user/tokens/verify
      return { ok: true, provider: "cloudflare", status: "healthy", r2Bucket };
    },
  };
}

/**
 * AWS CloudFront + S3 provider.
 * In production, this would use the AWS SDK for S3 uploads and
 * CloudFront invalidation. Here we simulate the interface.
 */
function createAWSProvider(config) {
  const {
    distributionId = process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID || "",
    s3Bucket = process.env.AWS_S3_BUCKET || "concord-media",
    region = process.env.AWS_REGION || "us-east-1",
    baseUrl = process.env.CONCORD_CDN_BASE_URL || "",
  } = config;

  const metrics = createMetrics();
  const configured = Boolean(distributionId && s3Bucket);

  return {
    name: "aws",

    getUrl(artifactHash, options = {}) {
      const quality = options.quality || "original";
      if (!baseUrl) {
        return `/api/media/${artifactHash}/stream${quality !== "original" ? `?quality=${quality}` : ""}`;
      }
      return `${baseUrl}/${artifactHash}${quality !== "original" ? `/${quality}` : ""}`;
    },

    async pushToOrigin(artifactHash, buffer, contentType) {
      const size = buffer ? buffer.length : 0;

      if (!configured) {
        metrics.pushes++;
        metrics.bytesPushed += size;
        metrics.artifacts.set(artifactHash, {
          status: "pending_credentials",
          pushedAt: new Date().toISOString(),
          size,
          contentType: contentType || "application/octet-stream",
        });
        return { ok: true, location: "pending", artifactHash, note: "AWS credentials not configured" };
      }

      // In production:
      // const s3 = new S3Client({ region });
      // await s3.send(new PutObjectCommand({
      //   Bucket: s3Bucket,
      //   Key: artifactHash,
      //   Body: buffer,
      //   ContentType: contentType,
      //   CacheControl: 'public, max-age=31536000, immutable',
      // }));

      metrics.pushes++;
      metrics.bytesPushed += size;
      metrics.artifacts.set(artifactHash, {
        status: "cached",
        pushedAt: new Date().toISOString(),
        size,
        contentType: contentType || "application/octet-stream",
      });
      return { ok: true, location: `s3://${s3Bucket}/${artifactHash}`, artifactHash };
    },

    async getSignedUrl(artifactHash, expiresInSeconds = 86400) {
      const url = this.getUrl(artifactHash);
      const expires = Date.now() + expiresInSeconds * 1000;
      const expiresAt = new Date(expires).toISOString();

      // In production: use CloudFront signed URLs with RSA key pair
      // const signer = new CloudFrontSigner(keyPairId, privateKey);
      // return signer.getSignedUrl({ url, dateLessThan: expiresAt });

      // Simplified HMAC-based signing for development
      const secret = process.env.CONCORD_CDN_SIGNING_SECRET || "dev-signing-secret";
      const token = createHmac("sha256", secret)
        .update(`${artifactHash}:${expires}`)
        .digest("hex");

      return {
        ok: true,
        url: `${url}${url.includes("?") ? "&" : "?"}token=${token}&expires=${expires}`,
        expiresAt,
      };
    },

    async purge(artifactHash) {
      // In production: CloudFront invalidation
      // const cf = new CloudFrontClient({ region });
      // await cf.send(new CreateInvalidationCommand({
      //   DistributionId: distributionId,
      //   InvalidationBatch: {
      //     CallerReference: Date.now().toString(),
      //     Paths: { Quantity: 1, Items: [`/${artifactHash}`, `/${artifactHash}/*`] },
      //   },
      // }));
      metrics.purges++;
      metrics.artifacts.delete(artifactHash);
      return { ok: true, artifactHash, purged: true, provider: "aws" };
    },

    async purgeByPrefix(prefix) {
      // CloudFront supports wildcard invalidation paths
      let count = 0;
      for (const key of metrics.artifacts.keys()) {
        if (key.startsWith(prefix)) {
          metrics.artifacts.delete(key);
          count++;
        }
      }
      metrics.purges += count;
      return { ok: true, prefix, purgedCount: count, provider: "aws" };
    },

    getCacheStatus(artifactHash) {
      const entry = metrics.artifacts.get(artifactHash);
      if (!entry) return { ok: true, cached: false, artifactHash, provider: "aws" };
      return { ok: true, cached: true, artifactHash, provider: "aws", ...entry };
    },

    getStats() {
      return {
        ok: true,
        provider: "aws",
        distributionId: distributionId || "(not set)",
        s3Bucket,
        region,
        hits: metrics.hits,
        misses: metrics.misses,
        pushes: metrics.pushes,
        purges: metrics.purges,
        errors: metrics.errors,
        bytesServed: metrics.bytesServed,
        bytesPushed: metrics.bytesPushed,
        cachedArtifacts: metrics.artifacts.size,
        hitRate: metrics.hits + metrics.misses > 0
          ? (metrics.hits / (metrics.hits + metrics.misses) * 100).toFixed(2) + "%"
          : "0.00%",
        uptime: Math.floor((Date.now() - new Date(metrics.startedAt).getTime()) / 1000),
        startedAt: metrics.startedAt,
        configured,
      };
    },

    recordHit() { metrics.hits++; },
    recordMiss() { metrics.misses++; },
    recordBytesServed(bytes) { metrics.bytesServed += bytes; },
    recordError() { metrics.errors++; },

    getProviderInfo() {
      return {
        provider: "aws",
        description: "AWS CloudFront + S3",
        distributionId: distributionId || "(not set)",
        s3Bucket,
        region,
        baseUrl: baseUrl || "(not configured)",
        configured,
      };
    },

    async healthCheck() {
      if (!configured) {
        return {
          ok: false,
          provider: "aws",
          status: "unconfigured",
          message: "Missing AWS_CLOUDFRONT_DISTRIBUTION_ID or AWS_S3_BUCKET",
        };
      }

      // In production: check S3 bucket access and CloudFront distribution status
      return { ok: true, provider: "aws", status: "healthy", distributionId, s3Bucket, region };
    },
  };
}

// ── Factory ────────────────────────────────────────────────────────────

/**
 * Create a CDN manager instance.
 *
 * Reads CONCORD_CDN_PROVIDER from env (or opts.provider) and instantiates
 * the appropriate provider. Defaults to 'local' when nothing is set.
 *
 * @param {object} [opts]
 * @param {string} [opts.provider] - Override CONCORD_CDN_PROVIDER
 * @param {string} [opts.baseUrl]  - Override CONCORD_CDN_BASE_URL
 * @param {string} [opts.accountId] - Cloudflare account ID
 * @param {string} [opts.apiToken]  - Cloudflare API token
 * @param {string} [opts.r2Bucket]  - Cloudflare R2 bucket
 * @param {string} [opts.distributionId] - AWS CloudFront distribution ID
 * @param {string} [opts.s3Bucket]  - AWS S3 bucket
 * @param {string} [opts.region]    - AWS region
 * @returns {object} CDN manager with unified interface
 */
export function createCDNManager(opts = {}) {
  const provider = opts.provider || process.env.CONCORD_CDN_PROVIDER || "local";
  const baseUrl = opts.baseUrl || process.env.CONCORD_CDN_BASE_URL || "";

  let impl;

  switch (provider) {
    case "cloudflare":
      impl = createCloudflareProvider({
        accountId: opts.accountId,
        apiToken: opts.apiToken,
        r2Bucket: opts.r2Bucket,
        baseUrl,
      });
      break;

    case "aws":
      impl = createAWSProvider({
        distributionId: opts.distributionId,
        s3Bucket: opts.s3Bucket,
        region: opts.region,
        baseUrl,
      });
      break;

    case "local":
    default:
      impl = createLocalProvider(baseUrl || null);
      break;
  }

  // Public interface — wraps the provider implementation with error handling
  return {
    /**
     * Get the public CDN URL for an artifact.
     *
     * @param {string} artifactHash - Content-addressed artifact hash
     * @param {object} [options]
     * @param {string} [options.quality] - 'original' | 'hd' | 'sd' | 'thumbnail'
     * @returns {string} The CDN URL (or origin URL if no CDN)
     */
    getUrl(artifactHash, options = {}) {
      return impl.getUrl(artifactHash, options);
    },

    /**
     * Upload/push an artifact buffer to the CDN origin storage.
     *
     * @param {string} artifactHash - Content-addressed artifact hash
     * @param {Buffer} buffer - File contents
     * @param {string} contentType - MIME type
     * @returns {Promise<{ ok: boolean, location?: string, error?: string }>}
     */
    async pushToOrigin(artifactHash, buffer, contentType) {
      try {
        return await impl.pushToOrigin(artifactHash, buffer, contentType);
      } catch (err) {
        impl.recordError();
        return { ok: false, error: err.message, artifactHash };
      }
    },

    /**
     * Generate a time-limited signed URL for an artifact.
     *
     * @param {string} artifactHash - Content-addressed artifact hash
     * @param {number} [expiresInSeconds=86400] - URL lifetime in seconds (default 24h)
     * @returns {Promise<{ ok: boolean, url?: string, expiresAt?: string, error?: string }>}
     */
    async getSignedUrl(artifactHash, expiresInSeconds = 86400) {
      try {
        return await impl.getSignedUrl(artifactHash, expiresInSeconds);
      } catch (err) {
        impl.recordError();
        return { ok: false, error: err.message, artifactHash };
      }
    },

    /**
     * Purge a specific artifact from CDN cache.
     *
     * @param {string} artifactHash
     * @returns {Promise<{ ok: boolean, purged?: boolean, error?: string }>}
     */
    async purge(artifactHash) {
      try {
        return await impl.purge(artifactHash);
      } catch (err) {
        impl.recordError();
        return { ok: false, error: err.message, artifactHash };
      }
    },

    /**
     * Purge all artifacts matching a prefix from CDN cache.
     *
     * @param {string} prefix
     * @returns {Promise<{ ok: boolean, purgedCount?: number, error?: string }>}
     */
    async purgeByPrefix(prefix) {
      try {
        return await impl.purgeByPrefix(prefix);
      } catch (err) {
        impl.recordError();
        return { ok: false, error: err.message, prefix };
      }
    },

    /**
     * Get CDN cache status for a specific artifact.
     *
     * @param {string} artifactHash
     * @returns {{ ok: boolean, cached: boolean }}
     */
    getCacheStatus(artifactHash) {
      return impl.getCacheStatus(artifactHash);
    },

    /**
     * Get aggregated CDN bandwidth/usage statistics.
     *
     * @returns {{ ok: boolean, provider: string, hits: number, misses: number, ... }}
     */
    getStats() {
      return impl.getStats();
    },

    /**
     * Record a CDN cache hit (called from middleware).
     */
    recordHit() {
      impl.recordHit();
    },

    /**
     * Record a CDN cache miss (called from middleware).
     */
    recordMiss() {
      impl.recordMiss();
    },

    /**
     * Record bytes served through CDN.
     * @param {number} bytes
     */
    recordBytesServed(bytes) {
      impl.recordBytesServed(bytes);
    },

    /**
     * Get provider metadata.
     *
     * @returns {{ provider: string, description: string, configured: boolean }}
     */
    getProviderInfo() {
      return impl.getProviderInfo();
    },

    /**
     * Health check — verifies CDN provider is reachable and configured.
     *
     * @returns {Promise<{ ok: boolean, provider: string, status: string }>}
     */
    async healthCheck() {
      try {
        return await impl.healthCheck();
      } catch (err) {
        return { ok: false, provider: impl.name, status: "error", message: err.message };
      }
    },
  };
}
