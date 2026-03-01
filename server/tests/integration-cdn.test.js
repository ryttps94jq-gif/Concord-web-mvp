/**
 * Integration Test: CDN System
 *
 * Tests CDN integration including:
 * - Local provider serving
 * - URL signing -> verification roundtrip
 * - Expired URL rejection
 * - Cache header generation
 * - Stream token lifecycle
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createCDNManager } from "../lib/cdn-manager.js";
import { createURLSigner } from "../lib/cdn-url-signer.js";

// ── Tests ────────────────────────────────────────────────────────────────

describe("Integration: CDN System", () => {
  // ── Local Provider Serving ──────

  describe("Local Provider Serving", () => {
    let cdn;

    beforeEach(() => {
      cdn = createCDNManager({ provider: "local" });
    });

    it("creates local CDN manager with correct provider info", () => {
      const info = cdn.getProviderInfo();
      assert.equal(info.provider, "local");
      assert.equal(info.description, "Local origin serving (no CDN)");
      assert.ok(info.configured);
    });

    it("generates local URL for artifact", () => {
      const url = cdn.getUrl("abc123hash");
      assert.ok(url.includes("abc123hash"));
      assert.ok(url.includes("/stream") || url.includes("/api/media"));
    });

    it("generates URL with quality parameter", () => {
      const url = cdn.getUrl("abc123hash", { quality: "hd" });
      assert.ok(url.includes("quality=hd"));
    });

    it("pushes artifact to local origin", async () => {
      const buffer = Buffer.from("test content");
      const result = await cdn.pushToOrigin("hash123", buffer, "video/mp4");

      assert.ok(result.ok);
      assert.equal(result.location, "origin");
      assert.equal(result.artifactHash, "hash123");
    });

    it("gets signed URL for artifact", async () => {
      const result = await cdn.getSignedUrl("hash123", 3600);

      assert.ok(result.ok);
      assert.ok(result.url.includes("hash123"));
      assert.ok(result.url.includes("expires="));
      assert.ok(result.expiresAt);
    });

    it("purges artifact from cache", async () => {
      await cdn.pushToOrigin("purge-hash", Buffer.from("content"), "text/plain");
      const result = await cdn.purge("purge-hash");

      assert.ok(result.ok);
      assert.ok(result.purged);
      assert.equal(result.artifactHash, "purge-hash");
    });

    it("purges artifacts by prefix", async () => {
      await cdn.pushToOrigin("prefix-a-1", Buffer.from("1"), "text/plain");
      await cdn.pushToOrigin("prefix-a-2", Buffer.from("2"), "text/plain");
      await cdn.pushToOrigin("prefix-b-1", Buffer.from("3"), "text/plain");

      const result = await cdn.purgeByPrefix("prefix-a");

      assert.ok(result.ok);
      assert.equal(result.purgedCount, 2);
    });

    it("gets cache status for artifact", async () => {
      const uncached = cdn.getCacheStatus("nonexistent");
      assert.ok(uncached.ok);
      assert.ok(!uncached.cached);

      await cdn.pushToOrigin("cached-hash", Buffer.from("data"), "text/plain");

      const cached = cdn.getCacheStatus("cached-hash");
      assert.ok(cached.ok);
      assert.ok(cached.cached);
    });

    it("tracks CDN stats correctly", async () => {
      await cdn.pushToOrigin("stat-hash", Buffer.alloc(1024), "video/mp4");

      cdn.recordHit();
      cdn.recordHit();
      cdn.recordMiss();
      cdn.recordBytesServed(5000);

      const stats = cdn.getStats();
      assert.equal(stats.provider, "local");
      assert.equal(stats.hits, 2);
      assert.equal(stats.misses, 1);
      assert.equal(stats.pushes, 1);
      assert.equal(stats.bytesServed, 5000);
      assert.equal(stats.bytesPushed, 1024);
      assert.equal(stats.cachedArtifacts, 1);
      assert.ok(stats.hitRate.includes("66.67"));
    });

    it("health check returns healthy for local provider", async () => {
      const health = await cdn.healthCheck();
      assert.ok(health.ok);
      assert.equal(health.provider, "local");
      assert.equal(health.status, "healthy");
    });
  });

  // ── URL Signing -> Verification Roundtrip ──────

  describe("URL Signing -> Verification Roundtrip", () => {
    let signer;

    beforeEach(() => {
      signer = createURLSigner({ secret: "test-signing-secret-12345" });
    });

    it("signs and verifies a URL successfully", () => {
      const originalUrl = "/api/media/abc123/stream";

      const signed = signer.sign(originalUrl, 3600);
      assert.ok(signed.ok);
      assert.ok(signed.signedUrl.includes("sig="));
      assert.ok(signed.signedUrl.includes("expires="));
      assert.ok(signed.expiresAt);
      assert.ok(signed.signature);

      const verified = signer.verify(signed.signedUrl);
      assert.ok(verified.ok);
      assert.ok(verified.valid);
      assert.equal(verified.url, originalUrl);
    });

    it("signs and verifies a full HTTPS URL", () => {
      const originalUrl = "https://cdn.concord-os.org/abc123/stream";

      const signed = signer.sign(originalUrl, 3600);
      assert.ok(signed.ok);

      const verified = signer.verify(signed.signedUrl);
      assert.ok(verified.ok);
      assert.ok(verified.valid);
    });

    it("signs and verifies URL with existing query parameters", () => {
      const originalUrl = "/api/media/abc123/stream?quality=hd";

      const signed = signer.sign(originalUrl, 3600);
      assert.ok(signed.ok);
      assert.ok(signed.signedUrl.includes("quality=hd"));

      const verified = signer.verify(signed.signedUrl);
      assert.ok(verified.ok);
      assert.ok(verified.valid);
    });

    it("default expiry is 24 hours", () => {
      const signed = signer.sign("/api/media/abc123/stream");
      assert.ok(signed.ok);

      const expiresAt = new Date(signed.expiresAt);
      const now = new Date();
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Should expire roughly 24 hours from now
      assert.ok(diffHours > 23 && diffHours < 25);
    });

    it("clamps expiry to maximum (7 days)", () => {
      const signed = signer.sign("/api/media/abc123/stream", 30 * 24 * 3600); // 30 days
      assert.ok(signed.ok);

      const expiresAt = new Date(signed.expiresAt);
      const now = new Date();
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      // Should be clamped to ~7 days
      assert.ok(diffDays <= 7.1);
    });

    it("verification returns metadata about the signer", () => {
      const info = signer.getInfo();
      assert.equal(info.algorithm, "sha256");
      assert.equal(info.defaultExpiry, 86400);
      assert.equal(info.maxExpiry, 604800);
      assert.ok(info.secretConfigured);
    });
  });

  // ── Expired URL Rejection ──────

  describe("Expired URL Rejection", () => {
    let signer;

    beforeEach(() => {
      signer = createURLSigner({ secret: "test-signing-secret-12345" });
    });

    it("rejects expired signed URL", async () => {
      // Sign with 1 second expiry and wait for it to expire
      const signed = signer.sign("/api/media/abc123/stream", 1);
      assert.ok(signed.ok);

      // Wait for the URL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const verified = signer.verify(signed.signedUrl);
      assert.ok(verified.ok);
      assert.ok(!verified.valid);
      assert.equal(verified.reason, "URL has expired");
    });

    it("rejects URL with tampered signature", () => {
      const signed = signer.sign("/api/media/abc123/stream", 3600);
      assert.ok(signed.ok);

      // Tamper with the signature
      const tamperedUrl = signed.signedUrl.replace(/sig=[a-f0-9]+/, "sig=0000000000000000");

      const verified = signer.verify(tamperedUrl);
      assert.ok(verified.ok);
      assert.ok(!verified.valid);
      assert.equal(verified.reason, "Invalid signature");
    });

    it("rejects URL with missing signature parameters", () => {
      const verified = signer.verify("/api/media/abc123/stream");
      assert.ok(verified.ok);
      assert.ok(!verified.valid);
      assert.equal(verified.reason, "Missing expires or sig parameter");
    });

    it("rejects URL with invalid expires parameter", () => {
      const verified = signer.verify("/api/media/abc123/stream?expires=notanumber&sig=abc123");
      assert.ok(verified.ok);
      assert.ok(!verified.valid);
      assert.equal(verified.reason, "Invalid expires parameter");
    });

    it("URL signed with different secret is rejected", () => {
      const signer1 = createURLSigner({ secret: "secret-one" });
      const signer2 = createURLSigner({ secret: "secret-two" });

      const signed = signer1.sign("/api/media/abc123/stream", 3600);
      const verified = signer2.verify(signed.signedUrl);

      assert.ok(!verified.valid);
      assert.equal(verified.reason, "Invalid signature");
    });
  });

  // ── Cache Header Generation ──────

  describe("Cache Header Generation", () => {
    it("CDN stats reflect cache behavior", () => {
      const cdn = createCDNManager({ provider: "local" });

      // Simulate cache hits and misses
      cdn.recordHit();
      cdn.recordHit();
      cdn.recordHit();
      cdn.recordMiss();

      const stats = cdn.getStats();

      // Hit rate should be 75%
      assert.equal(stats.hitRate, "75.00%");
      assert.equal(stats.hits, 3);
      assert.equal(stats.misses, 1);
    });

    it("CDN stats show 0% hit rate with no requests", () => {
      const cdn = createCDNManager({ provider: "local" });
      const stats = cdn.getStats();

      assert.equal(stats.hitRate, "0.00%");
    });

    it("bytes served tracking works correctly", () => {
      const cdn = createCDNManager({ provider: "local" });

      cdn.recordBytesServed(1024);
      cdn.recordBytesServed(2048);
      cdn.recordBytesServed(512);

      const stats = cdn.getStats();
      assert.equal(stats.bytesServed, 3584);
    });
  });

  // ── Stream Token Lifecycle ──────

  describe("Stream Token Lifecycle", () => {
    let signer;

    beforeEach(() => {
      signer = createURLSigner({ secret: "test-stream-secret-12345" });
    });

    it("generates stream token with correct data", () => {
      const result = signer.generateStreamToken("artifact-hash-123", "user-42", 14400);

      assert.ok(result.ok);
      assert.ok(result.token);
      assert.ok(result.expiresAt);
      assert.ok(result.tokenId);

      // Token should be base64url encoded
      assert.match(result.token, /^[A-Za-z0-9_-]+$/);
    });

    it("verifies valid stream token", () => {
      const { token } = signer.generateStreamToken("artifact-hash-123", "user-42");

      const verified = signer.verifyStreamToken(token);

      assert.ok(verified.ok);
      assert.ok(verified.valid);
      assert.equal(verified.artifactHash, "artifact-hash-123");
      assert.equal(verified.userId, "user-42");
      assert.ok(verified.expiresAt);
      assert.ok(verified.tokenId);
    });

    it("rejects expired stream token", async () => {
      // Generate a token with a very short duration, then wait for it to expire
      const { token } = signer.generateStreamToken("artifact-hash-123", "user-42", 1);

      // Wait for the token to expire (just over 1 second)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const verified = signer.verifyStreamToken(token);

      assert.ok(verified.ok);
      assert.ok(!verified.valid);
      assert.equal(verified.reason, "Token has expired");
      assert.equal(verified.artifactHash, "artifact-hash-123");
      assert.equal(verified.userId, "user-42");
    });

    it("rejects tampered stream token", () => {
      const { token } = signer.generateStreamToken("artifact-hash-123", "user-42");

      // Tamper with the token by modifying a few characters
      const tamperedToken = token.slice(0, -5) + "XXXXX";

      const verified = signer.verifyStreamToken(tamperedToken);

      assert.ok(!verified.valid);
    });

    it("rejects malformed stream token", () => {
      const verified = signer.verifyStreamToken("not-a-valid-token");
      assert.ok(!verified.valid);
    });

    it("stream token signed with different secret is rejected", () => {
      const signer1 = createURLSigner({ secret: "secret-one" });
      const signer2 = createURLSigner({ secret: "secret-two" });

      const { token } = signer1.generateStreamToken("artifact-123", "user-1");
      const verified = signer2.verifyStreamToken(token);

      assert.ok(!verified.valid);
      assert.equal(verified.reason, "Invalid token signature");
    });

    it("stream token duration is clamped to max expiry", () => {
      const signer = createURLSigner({
        secret: "test-secret",
        maxExpiry: 3600, // 1 hour max
      });

      const result = signer.generateStreamToken("artifact-123", "user-1", 86400); // Request 24h
      assert.ok(result.ok);

      const expiresAt = new Date(result.expiresAt);
      const now = new Date();
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Should be clamped to ~1 hour
      assert.ok(diffHours <= 1.1);
    });

    it("generates unique token IDs", () => {
      const tokens = [];
      for (let i = 0; i < 20; i++) {
        const { tokenId } = signer.generateStreamToken(`artifact-${i}`, "user-1");
        tokens.push(tokenId);
      }

      const unique = new Set(tokens);
      assert.equal(unique.size, 20, "All token IDs should be unique");
    });
  });

  // ── CDN Provider Variants ──────

  describe("CDN Provider Variants", () => {
    it("creates cloudflare provider", () => {
      const cdn = createCDNManager({
        provider: "cloudflare",
        accountId: "test-account",
        apiToken: "test-token",
        r2Bucket: "test-bucket",
        baseUrl: "https://cdn.example.com",
      });

      const info = cdn.getProviderInfo();
      assert.equal(info.provider, "cloudflare");
      assert.ok(info.configured);
    });

    it("creates AWS provider", () => {
      const cdn = createCDNManager({
        provider: "aws",
        distributionId: "EDIST123",
        s3Bucket: "test-bucket",
        region: "us-east-1",
        baseUrl: "https://cdn.example.com",
      });

      const info = cdn.getProviderInfo();
      assert.equal(info.provider, "aws");
      assert.ok(info.configured);
    });

    it("defaults to local provider when no provider specified", () => {
      const cdn = createCDNManager({});
      const info = cdn.getProviderInfo();
      assert.equal(info.provider, "local");
    });

    it("unconfigured cloudflare health check reports not ok", async () => {
      const cdn = createCDNManager({
        provider: "cloudflare",
        // No credentials
      });

      const health = await cdn.healthCheck();
      assert.ok(!health.ok);
      assert.equal(health.status, "unconfigured");
    });

    it("unconfigured AWS health check reports not ok", async () => {
      const cdn = createCDNManager({
        provider: "aws",
        // No credentials
      });

      const health = await cdn.healthCheck();
      assert.ok(!health.ok);
      assert.equal(health.status, "unconfigured");
    });
  });
});
