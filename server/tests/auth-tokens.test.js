/**
 * Auth Token Module Unit Tests
 * Tests: createToken, verifyToken, _TOKEN_BLACKLIST, hashPassword,
 *        verifyPassword, generateApiKey, generateCsrfToken, validateCsrfToken
 *
 * Run: node --test server/tests/auth-tokens.test.js
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import {
  initTokens,
  createToken,
  verifyToken,
  _TOKEN_BLACKLIST,
  hashPassword,
  verifyPassword,
  generateApiKey,
  hashApiKey,
  verifyApiKey,
  generateCsrfToken,
  validateCsrfToken,
  createRefreshToken,
} from "../auth/tokens.js";

const TEST_SECRET = "test-jwt-secret-at-least-32-chars-long!!";

// ── Setup ────────────────────────────────────────────────────────────────────

before(() => {
  initTokens({
    jwt,
    bcrypt,
    db: null, // No DB needed for most token tests
    EFFECTIVE_JWT_SECRET: TEST_SECRET,
    JWT_EXPIRES_IN: "1h",
    BCRYPT_ROUNDS: 4, // Fast rounds for testing
    NODE_ENV: "test",
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createToken / verifyToken
// ═══════════════════════════════════════════════════════════════════════════════

describe("createToken", () => {
  it("returns a string that looks like a JWT (three dot-separated segments)", () => {
    const token = createToken("user-123");
    assert.ok(token, "Token should not be null");
    const parts = token.split(".");
    assert.equal(parts.length, 3, "JWT must have three segments");
  });

  it("embeds the correct userId in the payload", () => {
    const token = createToken("user-abc");
    const decoded = jwt.decode(token);
    assert.equal(decoded.userId, "user-abc");
  });

  it("includes a unique jti claim for revocation support", () => {
    const t1 = createToken("user-1");
    const t2 = createToken("user-1");
    const d1 = jwt.decode(t1);
    const d2 = jwt.decode(t2);
    assert.ok(d1.jti, "Token should contain jti");
    assert.ok(d2.jti, "Token should contain jti");
    assert.notEqual(d1.jti, d2.jti, "Each token must have a unique jti");
  });

  it("includes an iat (issued-at) claim", () => {
    const token = createToken("user-1");
    const decoded = jwt.decode(token);
    assert.ok(typeof decoded.iat === "number", "iat must be a number");
  });

  it("respects the custom expiresIn parameter", () => {
    const token = createToken("user-1", "2s");
    const decoded = jwt.decode(token);
    // exp should be ~2 seconds after iat
    assert.ok(decoded.exp - decoded.iat <= 3, "Expiry should be ~2s from iat");
  });
});

describe("verifyToken", () => {
  it("returns decoded payload for a valid token", () => {
    const token = createToken("user-verify");
    const decoded = verifyToken(token);
    assert.ok(decoded, "Decoded payload must not be null");
    assert.equal(decoded.userId, "user-verify");
  });

  it("returns null for a garbage string", () => {
    const result = verifyToken("not.a.jwt");
    assert.equal(result, null);
  });

  it("returns null for a token signed with a different secret", () => {
    const fakeToken = jwt.sign({ userId: "hacker" }, "wrong-secret", { expiresIn: "1h" });
    const result = verifyToken(fakeToken);
    assert.equal(result, null);
  });

  it("returns null for an expired token", () => {
    // Create a token that expired 10 seconds ago
    const token = jwt.sign(
      { userId: "expired-user", jti: "exp-jti", iat: Math.floor(Date.now() / 1000) - 20 },
      TEST_SECRET,
      { expiresIn: "1s" }
    );
    // Token is already expired
    const result = verifyToken(token);
    assert.equal(result, null, "Expired token must return null");
  });

  it("returns null for a revoked token (blacklisted jti)", () => {
    const token = createToken("user-revoke");
    const decoded = jwt.decode(token);
    _TOKEN_BLACKLIST.revoke(decoded.jti, Date.now() + 86400000, "user-revoke");

    const result = verifyToken(token);
    assert.equal(result, null, "Revoked token must return null");

    // Cleanup
    _TOKEN_BLACKLIST.revoked.delete(decoded.jti);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createRefreshToken
// ═══════════════════════════════════════════════════════════════════════════════

describe("createRefreshToken", () => {
  it("returns a valid JWT with type=refresh and a family claim", () => {
    const token = createRefreshToken("user-rf");
    assert.ok(token);
    const decoded = jwt.decode(token);
    assert.equal(decoded.type, "refresh");
    assert.equal(decoded.userId, "user-rf");
    assert.ok(decoded.family, "Refresh token must contain a family ID");
    assert.ok(decoded.jti, "Refresh token must contain a jti");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// _TOKEN_BLACKLIST
// ═══════════════════════════════════════════════════════════════════════════════

describe("_TOKEN_BLACKLIST", () => {
  beforeEach(() => {
    _TOKEN_BLACKLIST.revoked.clear();
  });

  it("revoke() stores the jti with correct userId", () => {
    _TOKEN_BLACKLIST.revoke("jti-abc", Date.now() + 86400000, "user-42");
    const entry = _TOKEN_BLACKLIST.revoked.get("jti-abc");
    assert.ok(entry, "Entry should exist in the map");
    assert.equal(entry.userId, "user-42", "userId must be stored correctly (bug fix verification)");
    assert.ok(entry.revokedAt > 0, "revokedAt should be set");
    assert.ok(entry.expiresAt > Date.now(), "expiresAt should be in the future");
  });

  it("isRevoked() returns true for revoked tokens", () => {
    _TOKEN_BLACKLIST.revoke("jti-revoked", Date.now() + 86400000, "user-1");
    assert.equal(_TOKEN_BLACKLIST.isRevoked("jti-revoked"), true);
  });

  it("isRevoked() returns false for non-revoked tokens", () => {
    assert.equal(_TOKEN_BLACKLIST.isRevoked("jti-does-not-exist"), false);
  });

  it("revokeAllForUser() marks all tokens for a given user in-memory", () => {
    // Add several tokens, some for user-x and some for user-y
    _TOKEN_BLACKLIST.revoke("jti-1", Date.now() + 86400000, "user-x");
    _TOKEN_BLACKLIST.revoke("jti-2", Date.now() + 86400000, "user-x");
    _TOKEN_BLACKLIST.revoke("jti-3", Date.now() + 86400000, "user-y");

    const beforeRevoke = _TOKEN_BLACKLIST.revoked.get("jti-1").revokedAt;

    // Small delay so revokedAt updates are distinguishable
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }

    _TOKEN_BLACKLIST.revokeAllForUser("user-x");

    // user-x tokens should have updated revokedAt
    const after1 = _TOKEN_BLACKLIST.revoked.get("jti-1").revokedAt;
    assert.ok(after1 >= beforeRevoke, "revokedAt should be updated for user-x tokens");

    // user-y tokens should be unchanged
    const entry3 = _TOKEN_BLACKLIST.revoked.get("jti-3");
    assert.equal(entry3.userId, "user-y");
  });

  it("cleanup() removes entries whose expiresAt is in the past", () => {
    _TOKEN_BLACKLIST.revoke("jti-old", Date.now() - 1000, "user-1"); // already expired
    _TOKEN_BLACKLIST.revoke("jti-fresh", Date.now() + 86400000, "user-2"); // still valid

    _TOKEN_BLACKLIST.cleanup();

    assert.equal(_TOKEN_BLACKLIST.revoked.has("jti-old"), false, "Expired entry should be removed");
    assert.equal(_TOKEN_BLACKLIST.revoked.has("jti-fresh"), true, "Fresh entry should remain");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hashPassword / verifyPassword
// ═══════════════════════════════════════════════════════════════════════════════

describe("hashPassword / verifyPassword", () => {
  it("round-trips correctly: hash then verify returns true", () => {
    const password = "My$ecur3Pa55w0rd!";
    const hash = hashPassword(password);
    assert.ok(hash, "Hash should not be null");
    assert.notEqual(hash, password, "Hash must differ from plaintext");
    assert.equal(verifyPassword(password, hash), true);
  });

  it("rejects wrong password", () => {
    const hash = hashPassword("correctpassword");
    assert.equal(verifyPassword("wrongpassword", hash), false);
  });

  it("produces different hashes for the same password (salt)", () => {
    const h1 = hashPassword("same-pass");
    const h2 = hashPassword("same-pass");
    assert.notEqual(h1, h2, "bcrypt hashes must use unique salts");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateApiKey / hashApiKey / verifyApiKey
// ═══════════════════════════════════════════════════════════════════════════════

describe("generateApiKey", () => {
  it("returns a key prefixed with 'ck_'", () => {
    const key = generateApiKey();
    assert.ok(key.startsWith("ck_"), `Key should start with 'ck_', got: ${key.slice(0, 10)}`);
  });

  it("returns a key of the expected length (ck_ + 64 hex chars = 67)", () => {
    const key = generateApiKey();
    assert.equal(key.length, 3 + 64, "Key should be 67 characters total");
  });

  it("generates unique keys each time", () => {
    const keys = new Set(Array.from({ length: 10 }, () => generateApiKey()));
    assert.equal(keys.size, 10, "All generated keys must be unique");
  });
});

describe("hashApiKey / verifyApiKey", () => {
  it("verifyApiKey returns true for matching key and hash", () => {
    const raw = generateApiKey();
    const hashed = hashApiKey(raw);
    assert.equal(verifyApiKey(raw, hashed), true);
  });

  it("verifyApiKey returns false for wrong key", () => {
    const raw = generateApiKey();
    const hashed = hashApiKey(raw);
    assert.equal(verifyApiKey("ck_wrong", hashed), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateCsrfToken / validateCsrfToken
// ═══════════════════════════════════════════════════════════════════════════════

describe("generateCsrfToken / validateCsrfToken", () => {
  it("round-trips: token validates against itself (double-submit pattern)", () => {
    const token = generateCsrfToken("session-1");
    assert.ok(token, "CSRF token should not be null");
    assert.equal(token.length, 32, "CSRF token should be 32 hex chars");
    // In the double-submit cookie pattern, the same token is sent as both
    // header and cookie, so validating token vs itself must pass.
    assert.equal(validateCsrfToken(token, token), true);
  });

  it("rejects mismatched tokens", () => {
    const token1 = generateCsrfToken("session-1");
    // Generate a different token (different timestamp ensures uniqueness)
    const token2 = "a".repeat(32);
    assert.equal(validateCsrfToken(token1, token2), false);
  });

  it("rejects null or empty tokens", () => {
    assert.equal(validateCsrfToken(null, "something"), false);
    assert.equal(validateCsrfToken("something", null), false);
    assert.equal(validateCsrfToken("", ""), false);
  });

  it("rejects tokens of different lengths (timing-safe comparison)", () => {
    const token = generateCsrfToken("s1");
    assert.equal(validateCsrfToken(token, "short"), false);
  });
});
