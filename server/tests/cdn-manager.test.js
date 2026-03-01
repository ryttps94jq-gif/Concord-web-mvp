import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createCDNManager } from "../lib/cdn-manager.js";

describe("cdn-manager", () => {
  // ── Local provider ─────────────────────────────────────────────────

  describe("local provider", () => {
    let cdn;

    beforeEach(() => {
      cdn = createCDNManager({ provider: "local" });
    });

    it("creates a local provider by default", () => {
      const info = cdn.getProviderInfo();
      assert.equal(info.provider, "local");
      assert.equal(info.configured, true);
    });

    it("getUrl returns origin-based URL", () => {
      const url = cdn.getUrl("abc123hash");
      assert.ok(url.includes("abc123hash"));
      assert.ok(url.includes("/stream"));
    });

    it("getUrl includes quality parameter when not original", () => {
      const url = cdn.getUrl("abc123hash", { quality: "hd" });
      assert.ok(url.includes("quality=hd"));
    });

    it("getUrl does not include quality param for original", () => {
      const url = cdn.getUrl("abc123hash", { quality: "original" });
      assert.ok(!url.includes("quality="));
    });

    it("pushToOrigin succeeds in local mode", async () => {
      const buffer = Buffer.from("test content");
      const result = await cdn.pushToOrigin(
        "hash123",
        buffer,
        "text/plain"
      );
      assert.equal(result.ok, true);
      assert.equal(result.location, "origin");
    });

    it("getSignedUrl returns URL with expires param", async () => {
      const result = await cdn.getSignedUrl("hash123", 3600);
      assert.equal(result.ok, true);
      assert.ok(result.url.includes("expires="));
      assert.ok(result.expiresAt);
    });

    it("purge succeeds", async () => {
      await cdn.pushToOrigin("purge_me", Buffer.from("data"), "text/plain");
      const result = await cdn.purge("purge_me");
      assert.equal(result.ok, true);
      assert.equal(result.purged, true);
    });

    it("purgeByPrefix removes matching artifacts", async () => {
      await cdn.pushToOrigin("prefix_a1", Buffer.from("a"), "text/plain");
      await cdn.pushToOrigin("prefix_a2", Buffer.from("b"), "text/plain");
      await cdn.pushToOrigin("other_b1", Buffer.from("c"), "text/plain");

      const result = await cdn.purgeByPrefix("prefix_");
      assert.equal(result.ok, true);
      assert.equal(result.purgedCount, 2);
    });

    it("getCacheStatus returns cached=false for unknown artifact", () => {
      const result = cdn.getCacheStatus("nonexistent");
      assert.equal(result.ok, true);
      assert.equal(result.cached, false);
    });

    it("getCacheStatus returns cached=true after push", async () => {
      await cdn.pushToOrigin("cached_art", Buffer.from("d"), "text/plain");
      const result = cdn.getCacheStatus("cached_art");
      assert.equal(result.cached, true);
    });

    it("healthCheck returns healthy for local provider", async () => {
      const result = await cdn.healthCheck();
      assert.equal(result.ok, true);
      assert.equal(result.status, "healthy");
      assert.equal(result.provider, "local");
    });
  });

  // ── Local provider with custom baseUrl ─────────────────────────────

  describe("local provider with custom baseUrl", () => {
    it("uses custom baseUrl in generated URLs", () => {
      const cdn = createCDNManager({
        provider: "local",
        baseUrl: "https://cdn.example.com/media",
      });
      const url = cdn.getUrl("hash456");
      assert.ok(url.startsWith("https://cdn.example.com/media"));
    });
  });

  // ── Stats tracking ─────────────────────────────────────────────────

  describe("stats tracking", () => {
    let cdn;

    beforeEach(() => {
      cdn = createCDNManager({ provider: "local" });
    });

    it("tracks push count", async () => {
      await cdn.pushToOrigin("s1", Buffer.from("a"), "text/plain");
      await cdn.pushToOrigin("s2", Buffer.from("b"), "text/plain");

      const stats = cdn.getStats();
      assert.equal(stats.pushes, 2);
    });

    it("tracks bytes pushed", async () => {
      const buf = Buffer.from("hello world");
      await cdn.pushToOrigin("bh", buf, "text/plain");

      const stats = cdn.getStats();
      assert.equal(stats.bytesPushed, buf.length);
    });

    it("tracks hits and misses", () => {
      cdn.recordHit();
      cdn.recordHit();
      cdn.recordMiss();

      const stats = cdn.getStats();
      assert.equal(stats.hits, 2);
      assert.equal(stats.misses, 1);
    });

    it("calculates hit rate", () => {
      cdn.recordHit();
      cdn.recordHit();
      cdn.recordMiss();

      const stats = cdn.getStats();
      assert.equal(stats.hitRate, "66.67%");
    });

    it("reports 0% hit rate when no hits or misses", () => {
      const stats = cdn.getStats();
      assert.equal(stats.hitRate, "0.00%");
    });

    it("tracks bytes served", () => {
      cdn.recordBytesServed(1024);
      cdn.recordBytesServed(2048);

      const stats = cdn.getStats();
      assert.equal(stats.bytesServed, 3072);
    });

    it("tracks cached artifacts count", async () => {
      await cdn.pushToOrigin("c1", Buffer.from("x"), "text/plain");
      await cdn.pushToOrigin("c2", Buffer.from("y"), "text/plain");

      const stats = cdn.getStats();
      assert.equal(stats.cachedArtifacts, 2);
    });

    it("tracks uptime", () => {
      const stats = cdn.getStats();
      assert.equal(typeof stats.uptime, "number");
      assert.ok(stats.uptime >= 0);
    });
  });

  // ── Cloudflare provider ────────────────────────────────────────────

  describe("cloudflare provider", () => {
    it("creates cloudflare provider when specified", () => {
      const cdn = createCDNManager({
        provider: "cloudflare",
        accountId: "test-account",
        apiToken: "test-token",
        r2Bucket: "test-bucket",
        baseUrl: "https://cdn.example.com",
      });
      const info = cdn.getProviderInfo();
      assert.equal(info.provider, "cloudflare");
      assert.equal(info.configured, true);
    });

    it("reports unconfigured when credentials missing", () => {
      const cdn = createCDNManager({
        provider: "cloudflare",
        // no credentials
      });
      const info = cdn.getProviderInfo();
      assert.equal(info.provider, "cloudflare");
      assert.equal(info.configured, false);
    });

    it("healthCheck reports unconfigured when credentials missing", async () => {
      const cdn = createCDNManager({ provider: "cloudflare" });
      const result = await cdn.healthCheck();
      assert.equal(result.ok, false);
      assert.equal(result.status, "unconfigured");
    });

    it("healthCheck reports healthy when configured", async () => {
      const cdn = createCDNManager({
        provider: "cloudflare",
        accountId: "acct",
        apiToken: "tok",
      });
      const result = await cdn.healthCheck();
      assert.equal(result.ok, true);
      assert.equal(result.status, "healthy");
    });

    it("generates signed URLs with token", async () => {
      const cdn = createCDNManager({
        provider: "cloudflare",
        apiToken: "my-api-token",
        baseUrl: "https://cdn.example.com",
      });
      const result = await cdn.getSignedUrl("artifact123", 3600);
      assert.equal(result.ok, true);
      assert.ok(result.url.includes("token="));
      assert.ok(result.url.includes("expires="));
    });
  });

  // ── AWS provider ───────────────────────────────────────────────────

  describe("aws provider", () => {
    it("creates AWS provider when specified", () => {
      const cdn = createCDNManager({
        provider: "aws",
        distributionId: "EDIST123",
        s3Bucket: "my-bucket",
        region: "us-west-2",
        baseUrl: "https://dxxxxxx.cloudfront.net",
      });
      const info = cdn.getProviderInfo();
      assert.equal(info.provider, "aws");
      assert.equal(info.configured, true);
    });

    it("reports unconfigured when credentials missing", () => {
      const cdn = createCDNManager({ provider: "aws" });
      const info = cdn.getProviderInfo();
      assert.equal(info.provider, "aws");
      assert.equal(info.configured, false);
    });

    it("healthCheck reports unconfigured when credentials missing", async () => {
      const cdn = createCDNManager({ provider: "aws" });
      const result = await cdn.healthCheck();
      assert.equal(result.ok, false);
      assert.equal(result.status, "unconfigured");
    });

    it("pushToOrigin works in simulated mode", async () => {
      const cdn = createCDNManager({
        provider: "aws",
        distributionId: "DIST",
        s3Bucket: "bucket",
      });
      const result = await cdn.pushToOrigin(
        "artHash",
        Buffer.from("data"),
        "application/octet-stream"
      );
      assert.equal(result.ok, true);
    });
  });

  // ── Provider selection ─────────────────────────────────────────────

  describe("provider selection", () => {
    it("defaults to local provider", () => {
      const cdn = createCDNManager();
      const info = cdn.getProviderInfo();
      assert.equal(info.provider, "local");
    });

    it("selects cloudflare provider", () => {
      const cdn = createCDNManager({ provider: "cloudflare" });
      assert.equal(cdn.getProviderInfo().provider, "cloudflare");
    });

    it("selects aws provider", () => {
      const cdn = createCDNManager({ provider: "aws" });
      assert.equal(cdn.getProviderInfo().provider, "aws");
    });

    it("falls back to local for unknown provider", () => {
      const cdn = createCDNManager({ provider: "unknown" });
      assert.equal(cdn.getProviderInfo().provider, "local");
    });
  });

  // ── Error handling ─────────────────────────────────────────────────

  describe("error handling", () => {
    it("pushToOrigin handles null buffer gracefully", async () => {
      const cdn = createCDNManager({ provider: "local" });
      const result = await cdn.pushToOrigin("hash", null, "text/plain");
      assert.equal(result.ok, true);
    });
  });
});
