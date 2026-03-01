/**
 * Concord CDN URL Signer — Time-limited signed URLs for protected content.
 *
 * Generates and verifies HMAC-SHA256 signed URLs for:
 *   - Purchased media (download links expire after 24h)
 *   - Premium stream access (token expires per session)
 *   - Private / followers-only content
 *   - HLS manifest streaming tokens
 *
 * In production, CloudFront uses RSA-based signed URLs and Cloudflare uses
 * its own token authentication. This module provides a unified HMAC-based
 * interface that works across all providers and requires no external
 * dependencies beyond Node's built-in crypto module.
 *
 * Env vars:
 *   CONCORD_CDN_SIGNING_SECRET — HMAC secret key (auto-generated if not set)
 */

import { createHmac, randomBytes, randomUUID } from "node:crypto";

// ── Constants ──────────────────────────────────────────────────────────

/** Default link expiration: 24 hours */
const DEFAULT_EXPIRY_SECONDS = 86400;

/** Default stream token duration: 4 hours */
const DEFAULT_STREAM_DURATION_SECONDS = 14400;

/** Maximum allowed expiry: 7 days */
const MAX_EXPIRY_SECONDS = 604800;

/** HMAC algorithm used for signing */
const HMAC_ALGORITHM = "sha256";

// ── Factory ────────────────────────────────────────────────────────────

/**
 * Create a URL signer instance.
 *
 * @param {object} [opts]
 * @param {string} [opts.secret] - HMAC signing secret (defaults to env or auto-generated)
 * @param {number} [opts.defaultExpiry] - Default URL expiry in seconds (default: 86400)
 * @param {number} [opts.maxExpiry] - Maximum allowed expiry in seconds (default: 604800)
 * @returns {object} URL signer with sign/verify/generateStreamToken/verifyStreamToken
 */
export function createURLSigner(opts = {}) {
  const secret = opts.secret
    || process.env.CONCORD_CDN_SIGNING_SECRET
    || randomBytes(32).toString("hex");

  const defaultExpiry = opts.defaultExpiry || DEFAULT_EXPIRY_SECONDS;
  const maxExpiry = opts.maxExpiry || MAX_EXPIRY_SECONDS;

  /**
   * Compute HMAC signature for a message.
   *
   * @param {string} message - The data to sign
   * @returns {string} Hex-encoded HMAC signature
   */
  function computeSignature(message) {
    return createHmac(HMAC_ALGORITHM, secret)
      .update(message)
      .digest("hex");
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   *
   * @param {string} a
   * @param {string} b
   * @returns {boolean}
   */
  function safeCompare(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  return {
    /**
     * Sign a URL with a time-limited HMAC token.
     *
     * The signed URL includes:
     *   - `expires` — Unix timestamp (ms) when the URL expires
     *   - `sig`     — HMAC-SHA256 signature of `url:expires`
     *
     * @param {string} url - The URL to sign
     * @param {number} [expiresInSeconds] - Seconds until expiration
     * @returns {{ ok: boolean, signedUrl: string, expiresAt: string, signature: string }}
     */
    sign(url, expiresInSeconds = defaultExpiry) {
      // Clamp expiry to maximum
      const expiry = Math.min(expiresInSeconds, maxExpiry);
      const expiresMs = Date.now() + expiry * 1000;
      const expiresAt = new Date(expiresMs).toISOString();

      // Strip existing query params that we manage
      const cleanUrl = stripSignatureParams(url);

      // Compute signature over the canonical URL and expiry
      const message = `${cleanUrl}:${expiresMs}`;
      const signature = computeSignature(message);

      // Append signature params to URL
      const separator = cleanUrl.includes("?") ? "&" : "?";
      const signedUrl = `${cleanUrl}${separator}expires=${expiresMs}&sig=${signature}`;

      return { ok: true, signedUrl, expiresAt, signature };
    },

    /**
     * Verify a signed URL — checks both signature validity and expiration.
     *
     * @param {string} signedUrl - The signed URL to verify
     * @returns {{ ok: boolean, valid: boolean, reason?: string, url?: string, expiresAt?: string }}
     */
    verify(signedUrl) {
      try {
        const parsed = new URL(signedUrl, "http://placeholder");
        const expires = parsed.searchParams.get("expires");
        const sig = parsed.searchParams.get("sig");

        if (!expires || !sig) {
          return { ok: true, valid: false, reason: "Missing expires or sig parameter" };
        }

        const expiresMs = parseInt(expires, 10);
        if (isNaN(expiresMs)) {
          return { ok: true, valid: false, reason: "Invalid expires parameter" };
        }

        // Check expiration
        if (Date.now() > expiresMs) {
          return {
            ok: true,
            valid: false,
            reason: "URL has expired",
            expiresAt: new Date(expiresMs).toISOString(),
          };
        }

        // Reconstruct the original URL (without signature params)
        const cleanUrl = stripSignatureParams(signedUrl);

        // Verify signature
        const message = `${cleanUrl}:${expiresMs}`;
        const expectedSig = computeSignature(message);

        if (!safeCompare(sig, expectedSig)) {
          return { ok: true, valid: false, reason: "Invalid signature" };
        }

        return {
          ok: true,
          valid: true,
          url: cleanUrl,
          expiresAt: new Date(expiresMs).toISOString(),
        };
      } catch (err) {
        return { ok: false, valid: false, reason: `Verification error: ${err.message}` };
      }
    },

    /**
     * Generate a streaming token for HLS manifest access.
     *
     * Streaming tokens are compact tokens that encode the artifact hash,
     * user ID, and expiration. They are used as query parameters in HLS
     * manifest URLs so that segment URLs can be validated without
     * re-signing every segment request.
     *
     * @param {string} artifactHash - Content-addressed artifact hash
     * @param {string} userId - Authenticated user ID
     * @param {number} [duration] - Token duration in seconds (default: 4h)
     * @returns {{ ok: boolean, token: string, expiresAt: string }}
     */
    generateStreamToken(artifactHash, userId, duration = DEFAULT_STREAM_DURATION_SECONDS) {
      const clampedDuration = Math.min(duration, maxExpiry);
      const expiresMs = Date.now() + clampedDuration * 1000;
      const expiresAt = new Date(expiresMs).toISOString();
      const tokenId = randomUUID().replace(/-/g, "").slice(0, 12);

      // Payload: artifactHash, userId, expires, tokenId
      const payload = `${artifactHash}:${userId}:${expiresMs}:${tokenId}`;
      const signature = computeSignature(payload);

      // Encode as a compact token: base64url(payload + "." + sig)
      const tokenData = `${payload}.${signature}`;
      const token = Buffer.from(tokenData).toString("base64url");

      return { ok: true, token, expiresAt, tokenId };
    },

    /**
     * Verify a streaming token.
     *
     * @param {string} token - The streaming token to verify
     * @returns {{ ok: boolean, valid: boolean, artifactHash?: string, userId?: string, expiresAt?: string, reason?: string }}
     */
    verifyStreamToken(token) {
      try {
        // Decode the base64url token
        const decoded = Buffer.from(token, "base64url").toString("utf8");
        const dotIndex = decoded.lastIndexOf(".");
        if (dotIndex === -1) {
          return { ok: true, valid: false, reason: "Malformed token" };
        }

        const payload = decoded.slice(0, dotIndex);
        const signature = decoded.slice(dotIndex + 1);

        // Verify signature
        const expectedSig = computeSignature(payload);
        if (!safeCompare(signature, expectedSig)) {
          return { ok: true, valid: false, reason: "Invalid token signature" };
        }

        // Parse payload
        const parts = payload.split(":");
        if (parts.length < 4) {
          return { ok: true, valid: false, reason: "Invalid token payload" };
        }

        const [artifactHash, userId, expiresStr, tokenId] = parts;
        const expiresMs = parseInt(expiresStr, 10);

        if (isNaN(expiresMs)) {
          return { ok: true, valid: false, reason: "Invalid expiration in token" };
        }

        // Check expiration
        if (Date.now() > expiresMs) {
          return {
            ok: true,
            valid: false,
            reason: "Token has expired",
            artifactHash,
            userId,
            expiresAt: new Date(expiresMs).toISOString(),
          };
        }

        return {
          ok: true,
          valid: true,
          artifactHash,
          userId,
          tokenId,
          expiresAt: new Date(expiresMs).toISOString(),
        };
      } catch (err) {
        return { ok: false, valid: false, reason: `Token verification error: ${err.message}` };
      }
    },

    /**
     * Get signer metadata (does not expose the secret).
     *
     * @returns {{ algorithm: string, defaultExpiry: number, maxExpiry: number }}
     */
    getInfo() {
      return {
        algorithm: HMAC_ALGORITHM,
        defaultExpiry,
        maxExpiry,
        secretConfigured: Boolean(opts.secret || process.env.CONCORD_CDN_SIGNING_SECRET),
      };
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Strip signature-related query parameters from a URL.
 * This produces the canonical URL used for signature computation.
 *
 * @param {string} url
 * @returns {string} URL without expires, sig, and token parameters
 */
function stripSignatureParams(url) {
  try {
    // Handle both full URLs and relative paths
    const isAbsolute = url.startsWith("http://") || url.startsWith("https://");
    const parsed = new URL(url, "http://placeholder");

    parsed.searchParams.delete("expires");
    parsed.searchParams.delete("sig");
    parsed.searchParams.delete("token");

    if (isAbsolute) {
      return parsed.toString();
    }

    // Reconstruct relative URL
    const search = parsed.searchParams.toString();
    return parsed.pathname + (search ? `?${search}` : "");
  } catch {
    // If URL parsing fails, return as-is with best-effort stripping
    return url
      .replace(/[?&]expires=\d+/g, "")
      .replace(/[?&]sig=[a-f0-9]+/g, "")
      .replace(/[?&]token=[A-Za-z0-9_-]+/g, "")
      .replace(/\?$/, "");
  }
}
