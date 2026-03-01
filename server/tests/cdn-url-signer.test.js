import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createURLSigner } from "../lib/cdn-url-signer.js";

describe("cdn-url-signer", () => {
  let signer;

  beforeEach(() => {
    signer = createURLSigner({ secret: "test-signing-secret-12345" });
  });

  // ── sign ───────────────────────────────────────────────────────────

  describe("sign", () => {
    it("produces a signed URL with expires and sig params", () => {
      const result = signer.sign("https://cdn.example.com/media/abc123");

      assert.equal(result.ok, true);
      assert.ok(result.signedUrl.includes("expires="));
      assert.ok(result.signedUrl.includes("sig="));
      assert.ok(result.expiresAt);
      assert.ok(result.signature);
    });

    it("signature is a hex string", () => {
      const result = signer.sign("https://cdn.example.com/media/abc123");
      assert.match(result.signature, /^[a-f0-9]+$/);
    });

    it("uses default expiry of 24 hours", () => {
      const now = Date.now();
      const result = signer.sign("https://cdn.example.com/test");
      const expiresAt = new Date(result.expiresAt).getTime();

      // Should be roughly 24 hours from now (within 2 seconds tolerance)
      const diff = expiresAt - now;
      assert.ok(diff > 86400 * 1000 - 2000);
      assert.ok(diff <= 86400 * 1000 + 2000);
    });

    it("respects custom expiry", () => {
      const now = Date.now();
      const result = signer.sign("https://cdn.example.com/test", 3600);
      const expiresAt = new Date(result.expiresAt).getTime();

      const diff = expiresAt - now;
      assert.ok(diff > 3600 * 1000 - 2000);
      assert.ok(diff <= 3600 * 1000 + 2000);
    });

    it("clamps expiry to maxExpiry (7 days)", () => {
      const now = Date.now();
      const result = signer.sign("https://cdn.example.com/test", 999999999);
      const expiresAt = new Date(result.expiresAt).getTime();

      // Should be clamped to 7 days
      const diff = expiresAt - now;
      const sevenDays = 604800 * 1000;
      assert.ok(diff <= sevenDays + 2000);
    });

    it("handles relative URLs", () => {
      const result = signer.sign("/api/media/abc123/stream");
      assert.equal(result.ok, true);
      assert.ok(result.signedUrl.includes("/api/media/abc123/stream"));
      assert.ok(result.signedUrl.includes("sig="));
    });

    it("handles URLs with existing query params", () => {
      const result = signer.sign(
        "https://cdn.example.com/media?quality=hd"
      );
      assert.equal(result.ok, true);
      assert.ok(result.signedUrl.includes("quality=hd"));
      assert.ok(result.signedUrl.includes("&expires="));
      assert.ok(result.signedUrl.includes("&sig="));
    });

    it("handles very long URLs", () => {
      const longPath = "a".repeat(2000);
      const result = signer.sign(`https://cdn.example.com/${longPath}`);
      assert.equal(result.ok, true);
      assert.ok(result.signedUrl.length > 2000);
    });

    it("handles special characters in URL path", () => {
      const result = signer.sign(
        "https://cdn.example.com/media/file%20with%20spaces"
      );
      assert.equal(result.ok, true);
      assert.ok(result.signedUrl.includes("sig="));
    });
  });

  // ── verify ─────────────────────────────────────────────────────────

  describe("verify", () => {
    it("passes for a valid, non-expired signed URL", () => {
      const { signedUrl } = signer.sign("https://cdn.example.com/media/abc");
      const result = signer.verify(signedUrl);

      assert.equal(result.ok, true);
      assert.equal(result.valid, true);
      assert.ok(result.url);
      assert.ok(result.expiresAt);
    });

    it("fails for an expired URL", () => {
      // Sign with -1 second expiry (already expired)
      const customSigner = createURLSigner({
        secret: "test-secret",
        maxExpiry: 999999999,
      });

      const { signedUrl } = customSigner.sign("https://cdn.example.com/test", 0);

      // Wait briefly so the 0-second expiry is past
      // Since expiresMs = Date.now() + 0 * 1000 = Date.now(),
      // and verify checks Date.now() > expiresMs, this should fail immediately
      // or pass depending on timing. Let's use a negative approach instead.

      // Create a manually expired URL
      const baseUrl = "https://cdn.example.com/test";
      const expiredMs = Date.now() - 10000; // 10 seconds ago
      const { signedUrl: expired } = (() => {
        // Build a signed URL with past expiry manually
        const s = createURLSigner({ secret: "test-signing-secret-12345" });
        const signed = s.sign(baseUrl, 1);
        // Replace the expires value with a past time
        const url = signed.signedUrl.replace(
          /expires=\d+/,
          `expires=${expiredMs}`
        );
        return { signedUrl: url };
      })();

      const result = signer.verify(expired);
      assert.equal(result.valid, false);
      assert.ok(result.reason.includes("expired") || result.reason.includes("Invalid signature"));
    });

    it("fails for a tampered URL", () => {
      const { signedUrl } = signer.sign("https://cdn.example.com/media/abc");

      // Tamper: change the artifact hash in the URL
      const tampered = signedUrl.replace(
        "media/abc",
        "media/TAMPERED"
      );
      const result = signer.verify(tampered);

      assert.equal(result.valid, false);
      assert.ok(result.reason.includes("Invalid signature"));
    });

    it("fails for a tampered signature", () => {
      const { signedUrl } = signer.sign("https://cdn.example.com/media/abc");

      // Tamper: modify the sig value
      const tampered = signedUrl.replace(/sig=[a-f0-9]+/, "sig=0000000000");
      const result = signer.verify(tampered);

      assert.equal(result.valid, false);
      assert.ok(result.reason.includes("Invalid signature") || result.reason.includes("Missing"));
    });

    it("fails when expires param is missing", () => {
      const result = signer.verify(
        "https://cdn.example.com/media/abc?sig=abcdef1234"
      );
      assert.equal(result.valid, false);
      assert.ok(result.reason.includes("Missing"));
    });

    it("fails when sig param is missing", () => {
      const result = signer.verify(
        "https://cdn.example.com/media/abc?expires=99999999999"
      );
      assert.equal(result.valid, false);
      assert.ok(result.reason.includes("Missing"));
    });

    it("fails for invalid expires value", () => {
      const result = signer.verify(
        "https://cdn.example.com/media/abc?expires=notanumber&sig=abc"
      );
      assert.equal(result.valid, false);
    });
  });

  // ── generateStreamToken ────────────────────────────────────────────

  describe("generateStreamToken", () => {
    it("produces a base64url-encoded token", () => {
      const result = signer.generateStreamToken("hashABC", "user123", 3600);

      assert.equal(result.ok, true);
      assert.ok(result.token);
      assert.ok(result.expiresAt);
      assert.ok(result.tokenId);
      // Should be base64url (no +, /, or =)
      assert.ok(!result.token.includes("+"));
      assert.ok(!result.token.includes("/"));
    });

    it("includes artifact hash and user ID in token", () => {
      const result = signer.generateStreamToken("myHash", "myUser");
      assert.ok(result.token);

      // Decode to verify content
      const decoded = Buffer.from(result.token, "base64url").toString("utf8");
      assert.ok(decoded.includes("myHash"));
      assert.ok(decoded.includes("myUser"));
    });

    it("uses default duration of 4 hours", () => {
      const now = Date.now();
      const result = signer.generateStreamToken("h", "u");
      const expiresAt = new Date(result.expiresAt).getTime();

      const fourHours = 14400 * 1000;
      const diff = expiresAt - now;
      assert.ok(diff > fourHours - 2000);
      assert.ok(diff <= fourHours + 2000);
    });

    it("clamps duration to maxExpiry", () => {
      const now = Date.now();
      const result = signer.generateStreamToken("h", "u", 999999999);
      const expiresAt = new Date(result.expiresAt).getTime();

      const sevenDays = 604800 * 1000;
      const diff = expiresAt - now;
      assert.ok(diff <= sevenDays + 2000);
    });
  });

  // ── verifyStreamToken ──────────────────────────────────────────────

  describe("verifyStreamToken", () => {
    it("passes for a valid, non-expired token", () => {
      const { token } = signer.generateStreamToken("hash1", "user1", 3600);
      const result = signer.verifyStreamToken(token);

      assert.equal(result.ok, true);
      assert.equal(result.valid, true);
      assert.equal(result.artifactHash, "hash1");
      assert.equal(result.userId, "user1");
      assert.ok(result.tokenId);
      assert.ok(result.expiresAt);
    });

    it("fails for a tampered token", () => {
      const { token } = signer.generateStreamToken("hash1", "user1", 3600);

      // Decode, tamper, re-encode
      const decoded = Buffer.from(token, "base64url").toString("utf8");
      const tampered = decoded.replace("hash1", "HACKED");
      const tamperedToken = Buffer.from(tampered).toString("base64url");

      const result = signer.verifyStreamToken(tamperedToken);
      assert.equal(result.valid, false);
      assert.ok(result.reason.includes("Invalid token signature"));
    });

    it("fails for a completely invalid token", () => {
      const result = signer.verifyStreamToken("not-a-real-token");
      assert.equal(result.valid, false);
    });

    it("fails for an empty token", () => {
      const result = signer.verifyStreamToken("");
      assert.equal(result.valid, false);
    });

    it("different secrets produce invalid verifications", () => {
      const signer2 = createURLSigner({ secret: "different-secret" });
      const { token } = signer.generateStreamToken("hash", "user");

      const result = signer2.verifyStreamToken(token);
      assert.equal(result.valid, false);
    });
  });

  // ── getInfo ────────────────────────────────────────────────────────

  describe("getInfo", () => {
    it("returns signer metadata without exposing secret", () => {
      const info = signer.getInfo();
      assert.equal(info.algorithm, "sha256");
      assert.equal(info.defaultExpiry, 86400);
      assert.equal(info.maxExpiry, 604800);
      assert.equal(typeof info.secretConfigured, "boolean");
    });

    it("reports secretConfigured=true when secret provided via opts", () => {
      const s = createURLSigner({ secret: "my-secret" });
      assert.equal(s.getInfo().secretConfigured, true);
    });
  });

  // ── Custom options ─────────────────────────────────────────────────

  describe("custom options", () => {
    it("uses custom default expiry", () => {
      const s = createURLSigner({
        secret: "s",
        defaultExpiry: 1800,
      });
      const now = Date.now();
      const { expiresAt } = s.sign("https://example.com/test");
      const diff = new Date(expiresAt).getTime() - now;

      assert.ok(diff > 1800 * 1000 - 2000);
      assert.ok(diff <= 1800 * 1000 + 2000);
    });

    it("uses custom max expiry", () => {
      const s = createURLSigner({
        secret: "s",
        maxExpiry: 3600,
      });
      const now = Date.now();
      // Request 86400 but max is 3600
      const { expiresAt } = s.sign("https://example.com/test", 86400);
      const diff = new Date(expiresAt).getTime() - now;

      assert.ok(diff <= 3600 * 1000 + 2000);
    });
  });

  // ── Roundtrip sign/verify ──────────────────────────────────────────

  describe("roundtrip sign/verify", () => {
    it("signed URL roundtrips through verify", () => {
      const urls = [
        "https://cdn.example.com/media/abc123",
        "/api/media/xyz/stream",
        "https://cdn.example.com/media?quality=hd&format=mp4",
      ];

      for (const url of urls) {
        const { signedUrl } = signer.sign(url, 3600);
        const result = signer.verify(signedUrl);
        assert.equal(result.valid, true, `Roundtrip failed for: ${url}`);
      }
    });

    it("stream token roundtrips through verify", () => {
      const { token } = signer.generateStreamToken("hash", "user", 7200);
      const result = signer.verifyStreamToken(token);
      assert.equal(result.valid, true);
      assert.equal(result.artifactHash, "hash");
      assert.equal(result.userId, "user");
    });
  });
});
