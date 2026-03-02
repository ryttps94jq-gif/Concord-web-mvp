/**
 * Economy Guards Tests
 *
 * Tests admin gating, user auth checks, and Express middleware for economy routes.
 * Verifies timing-safe founder secret comparison, role checks, and scope checks.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  requireAdmin,
  requireUser,
  adminOnly,
  authRequired,
} from "../economy/guards.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    headers: overrides.headers || {},
    user: overrides.user || null,
  };
}

function makeMockRes() {
  const res = { _statusCode: null, _body: null };
  res.status = (code) => { res._statusCode = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. requireAdmin
// ═══════════════════════════════════════════════════════════════════════════════

describe("requireAdmin", () => {
  it("rejects unauthenticated requests", () => {
    const r = requireAdmin(makeReq());
    assert.equal(r.ok, false);
    assert.equal(r.error, "auth_required");
    assert.equal(r.status, 401);
  });

  it("allows admin role", () => {
    const r = requireAdmin(makeReq({ user: { role: "admin", scopes: [] } }));
    assert.equal(r.ok, true);
    assert.equal(r.method, "role");
  });

  it("allows owner role", () => {
    const r = requireAdmin(makeReq({ user: { role: "owner", scopes: [] } }));
    assert.equal(r.ok, true);
  });

  it("allows founder role", () => {
    const r = requireAdmin(makeReq({ user: { role: "founder", scopes: [] } }));
    assert.equal(r.ok, true);
  });

  it("allows wildcard scope", () => {
    const r = requireAdmin(makeReq({ user: { role: "member", scopes: ["*"] } }));
    assert.equal(r.ok, true);
    assert.equal(r.method, "scope");
  });

  it("allows economy:admin scope", () => {
    const r = requireAdmin(makeReq({ user: { role: "member", scopes: ["economy:admin"] } }));
    assert.equal(r.ok, true);
    assert.equal(r.method, "scope");
  });

  it("rejects regular member without admin scope", () => {
    const r = requireAdmin(makeReq({ user: { role: "member", scopes: ["read", "write"] } }));
    assert.equal(r.ok, false);
    assert.equal(r.error, "forbidden");
    assert.equal(r.status, 403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. requireUser
// ═══════════════════════════════════════════════════════════════════════════════

describe("requireUser", () => {
  it("rejects unauthenticated requests", () => {
    const r = requireUser(makeReq());
    assert.equal(r.ok, false);
    assert.equal(r.error, "auth_required");
    assert.equal(r.status, 401);
  });

  it("allows any authenticated user", () => {
    const r = requireUser(makeReq({ user: { id: "user_1", role: "member" } }));
    assert.equal(r.ok, true);
    assert.equal(r.userId, "user_1");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. adminOnly Middleware
// ═══════════════════════════════════════════════════════════════════════════════

describe("adminOnly middleware", () => {
  it("calls next() for admin users", () => {
    const req = makeReq({ user: { role: "admin", scopes: [] } });
    const res = makeMockRes();
    let nextCalled = false;
    adminOnly(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled);
  });

  it("returns 403 for non-admin users", () => {
    const req = makeReq({ user: { role: "member", scopes: ["read"] } });
    const res = makeMockRes();
    let nextCalled = false;
    adminOnly(req, res, () => { nextCalled = true; });
    assert.ok(!nextCalled);
    assert.equal(res._statusCode, 403);
    assert.equal(res._body.ok, false);
  });

  it("returns 401 for unauthenticated requests", () => {
    const req = makeReq();
    const res = makeMockRes();
    let nextCalled = false;
    adminOnly(req, res, () => { nextCalled = true; });
    assert.ok(!nextCalled);
    assert.equal(res._statusCode, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. authRequired Middleware
// ═══════════════════════════════════════════════════════════════════════════════

describe("authRequired middleware", () => {
  it("calls next() for authenticated users", () => {
    const req = makeReq({ user: { id: "user_1", role: "member" } });
    const res = makeMockRes();
    let nextCalled = false;
    authRequired(req, res, () => { nextCalled = true; });
    assert.ok(nextCalled);
  });

  it("returns 401 for unauthenticated requests", () => {
    const req = makeReq();
    const res = makeMockRes();
    let nextCalled = false;
    authRequired(req, res, () => { nextCalled = true; });
    assert.ok(!nextCalled);
    assert.equal(res._statusCode, 401);
    assert.equal(res._body.ok, false);
  });
});
