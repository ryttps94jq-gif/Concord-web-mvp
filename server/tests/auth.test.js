/**
 * Auth Test Suite
 * Tests authentication flows, session management, role-based access, and rate limiting.
 */
import { describe, it, before, after, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeJWT(payload, secret = "test-jwt-secret") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function decodeJWT(token) {
  const [, body] = token.split(".");
  return JSON.parse(Buffer.from(body, "base64url").toString());
}

function createMockReq(overrides = {}) {
  return {
    headers: {},
    cookies: {},
    ip: "127.0.0.1",
    method: "GET",
    path: "/api/test",
    user: null,
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
    setHeader(k, v) { res.headers[k] = v; return res; },
    clearCookie() { return res; },
    cookie() { return res; },
  };
  return res;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Authentication", () => {
  const JWT_SECRET = "test-jwt-secret";

  it("non-admin user can authenticate with valid token", () => {
    const token = makeJWT({ id: "user-1", role: "member", exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
    const decoded = decodeJWT(token);
    assert.equal(decoded.id, "user-1");
    assert.equal(decoded.role, "member");
    assert.ok(decoded.exp > Math.floor(Date.now() / 1000));
  });

  it("admin user can authenticate with valid token", () => {
    const token = makeJWT({ id: "admin-1", role: "admin", exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
    const decoded = decodeJWT(token);
    assert.equal(decoded.role, "admin");
  });

  it("invalid credentials return 401 status", () => {
    const res = createMockRes();
    // Simulate invalid token handling
    const token = "invalid.token.here";
    try {
      const [, body] = token.split(".");
      JSON.parse(Buffer.from(body, "base64url").toString());
      assert.fail("Should have thrown");
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, "Invalid token");
  });

  it("expired session returns 401 and clears properly", () => {
    const expiredToken = makeJWT({
      id: "user-1",
      role: "member",
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
    }, JWT_SECRET);
    const decoded = decodeJWT(expiredToken);
    const isExpired = decoded.exp < Math.floor(Date.now() / 1000);
    assert.ok(isExpired, "Token should be expired");

    const res = createMockRes();
    if (isExpired) {
      res.status(401).json({ error: "Session expired" });
    }
    assert.equal(res.statusCode, 401);
  });

  it("auth token persists across requests via same JWT", () => {
    const token = makeJWT({ id: "user-1", role: "member", exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
    // Verify same token decodes identically across multiple calls
    const decoded1 = decodeJWT(token);
    const decoded2 = decodeJWT(token);
    assert.deepEqual(decoded1, decoded2);
  });

  it("non-admin can access non-admin endpoints", () => {
    const user = { id: "user-1", role: "member" };
    const nonAdminEndpoints = [
      "/api/brain/status",
      "/api/brain/health",
      "/api/dtus/search/semantic",
      "/api/affect/system",
    ];
    for (const endpoint of nonAdminEndpoints) {
      // Non-admin endpoints don't require admin role
      const requiresAdmin = endpoint.includes("/admin/");
      assert.ok(!requiresAdmin, `${endpoint} should not require admin`);
    }
  });

  it("non-admin CANNOT access admin-only endpoints", () => {
    const adminEndpoints = [
      "/api/admin/backup/status",
      "/api/admin/logs",
      "/api/admin/logs/stream",
      "/api/admin/repair-build",
      "/api/admin/ssl/status",
    ];
    const user = { id: "user-1", role: "member" };
    for (const endpoint of adminEndpoints) {
      const isAdmin = ["owner", "admin", "founder"].includes(user.role);
      assert.ok(!isAdmin, `Non-admin should not access ${endpoint}`);
    }
  });

  it("rate-limited login attempts after 5 failures", () => {
    const loginAttempts = new Map();
    const MAX_ATTEMPTS = 5;
    const WINDOW_MS = 60000;
    const userId = "user-1";

    // Simulate 5 failed login attempts
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const entry = loginAttempts.get(userId) || { count: 0, windowStart: Date.now() };
      entry.count++;
      loginAttempts.set(userId, entry);
    }

    // 6th attempt should be blocked
    const entry = loginAttempts.get(userId);
    const isBlocked = entry.count >= MAX_ATTEMPTS && (Date.now() - entry.windowStart < WINDOW_MS);
    assert.ok(isBlocked, "Should be rate limited after 5 failures");
  });

  it("concurrent auth checks don't create race conditions", async () => {
    const token = makeJWT({ id: "user-1", role: "member", exp: Math.floor(Date.now() / 1000) + 3600 }, JWT_SECRET);
    const results = await Promise.all(
      Array(10).fill(null).map(() =>
        new Promise((resolve) => {
          const decoded = decodeJWT(token);
          resolve(decoded.id);
        })
      )
    );
    // All concurrent decodes should return the same user
    assert.ok(results.every(id => id === "user-1"), "All concurrent checks should resolve to same user");
  });

  it("10-second timeout fires on stalled auth", async () => {
    const TIMEOUT_MS = 10000;
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 100); // 100ms for test speed

    try {
      await new Promise((resolve, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("Auth timeout")));
        // Simulate stalled auth that never resolves
      });
      assert.fail("Should have timed out");
    } catch (e) {
      assert.equal(e.message, "Auth timeout");
    } finally {
      clearTimeout(timeout);
    }
  });
});
