/**
 * Validation Schema Tests
 * Tests: Zod schemas for DTU create/update, user registration/login,
 *        API key creation, pagination. Also tests the validate() middleware factory.
 *
 * Run: node --test server/tests/validation-schemas.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";

import { schemas, validate } from "../validation/schemas.js";

// ═══════════════════════════════════════════════════════════════════════════════
// Precondition: Zod must be available
// ═══════════════════════════════════════════════════════════════════════════════

describe("Schema availability", () => {
  it("schemas object is populated (Zod is installed)", () => {
    assert.ok(schemas.dtuCreate, "dtuCreate schema must be defined");
    assert.ok(schemas.dtuUpdate, "dtuUpdate schema must be defined");
    assert.ok(schemas.userRegister, "userRegister schema must be defined");
    assert.ok(schemas.userLogin, "userLogin schema must be defined");
    assert.ok(schemas.apiKeyCreate, "apiKeyCreate schema must be defined");
    assert.ok(schemas.pagination, "pagination schema must be defined");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// dtuCreate
// ═══════════════════════════════════════════════════════════════════════════════

describe("schemas.dtuCreate", () => {
  it("accepts valid input with only required fields", () => {
    const result = schemas.dtuCreate.safeParse({ title: "Test DTU" });
    assert.ok(result.success, "Should accept minimal valid input");
    assert.equal(result.data.title, "Test DTU");
    assert.equal(result.data.tier, "regular"); // default
    assert.deepEqual(result.data.tags, []); // default
  });

  it("accepts valid input with all optional fields", () => {
    const result = schemas.dtuCreate.safeParse({
      title: "Full DTU",
      content: "Some content here",
      tier: "mega",
      tags: ["tag1", "tag2"],
      creti: "some creti data",
      source: "manual",
    });
    assert.ok(result.success);
    assert.equal(result.data.tier, "mega");
    assert.deepEqual(result.data.tags, ["tag1", "tag2"]);
  });

  it("rejects missing title", () => {
    const result = schemas.dtuCreate.safeParse({});
    assert.equal(result.success, false);
  });

  it("rejects empty title", () => {
    const result = schemas.dtuCreate.safeParse({ title: "" });
    assert.equal(result.success, false);
  });

  it("rejects title exceeding 500 characters", () => {
    const result = schemas.dtuCreate.safeParse({ title: "x".repeat(501) });
    assert.equal(result.success, false);
  });

  it("rejects invalid tier value", () => {
    const result = schemas.dtuCreate.safeParse({ title: "Test", tier: "ultra" });
    assert.equal(result.success, false);
  });

  it("rejects tags array exceeding 40 items", () => {
    const result = schemas.dtuCreate.safeParse({
      title: "Test",
      tags: Array.from({ length: 41 }, (_, i) => `tag-${i}`),
    });
    assert.equal(result.success, false);
  });

  it("rejects individual tag exceeding 50 characters", () => {
    const result = schemas.dtuCreate.safeParse({
      title: "Test",
      tags: ["x".repeat(51)],
    });
    assert.equal(result.success, false);
  });

  it("rejects content exceeding 100000 characters", () => {
    const result = schemas.dtuCreate.safeParse({
      title: "Test",
      content: "x".repeat(100001),
    });
    assert.equal(result.success, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// dtuUpdate
// ═══════════════════════════════════════════════════════════════════════════════

describe("schemas.dtuUpdate", () => {
  const validId = randomUUID();

  it("accepts valid update with just id", () => {
    const result = schemas.dtuUpdate.safeParse({ id: validId });
    assert.ok(result.success);
  });

  it("accepts update with all optional fields", () => {
    const result = schemas.dtuUpdate.safeParse({
      id: validId,
      title: "Updated",
      content: "New content",
      tier: "hyper",
      tags: ["new-tag"],
      creti: "new creti",
    });
    assert.ok(result.success);
  });

  it("rejects missing id", () => {
    const result = schemas.dtuUpdate.safeParse({ title: "Orphan" });
    assert.equal(result.success, false);
  });

  it("rejects non-UUID id", () => {
    const result = schemas.dtuUpdate.safeParse({ id: "not-a-uuid" });
    assert.equal(result.success, false);
  });

  it("rejects invalid tier", () => {
    const result = schemas.dtuUpdate.safeParse({ id: validId, tier: "legendary" });
    assert.equal(result.success, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// userRegister
// ═══════════════════════════════════════════════════════════════════════════════

describe("schemas.userRegister", () => {
  it("accepts valid registration input", () => {
    const result = schemas.userRegister.safeParse({
      username: "testuser_42",
      email: "test@example.com",
      password: "SecurePass123!",
    });
    assert.ok(result.success, `Validation errors: ${JSON.stringify(result.error?.errors)}`);
    assert.equal(result.data.username, "testuser_42");
    assert.equal(result.data.email, "test@example.com");
  });

  it("rejects username shorter than 3 characters", () => {
    const result = schemas.userRegister.safeParse({
      username: "ab",
      email: "a@b.com",
      password: "SecurePass123!",
    });
    assert.equal(result.success, false);
  });

  it("rejects username longer than 50 characters", () => {
    const result = schemas.userRegister.safeParse({
      username: "a".repeat(51),
      email: "a@b.com",
      password: "SecurePass123!",
    });
    assert.equal(result.success, false);
  });

  it("rejects username with special characters (only a-zA-Z0-9_- allowed)", () => {
    const result = schemas.userRegister.safeParse({
      username: "user@name!",
      email: "a@b.com",
      password: "SecurePass123!",
    });
    assert.equal(result.success, false);
  });

  it("accepts username with hyphens and underscores", () => {
    const result = schemas.userRegister.safeParse({
      username: "test-user_42",
      email: "a@b.com",
      password: "SecurePass123!",
    });
    assert.ok(result.success);
  });

  it("rejects invalid email", () => {
    const result = schemas.userRegister.safeParse({
      username: "validuser",
      email: "not-an-email",
      password: "SecurePass123!",
    });
    assert.equal(result.success, false);
  });

  it("rejects password shorter than 12 characters", () => {
    const result = schemas.userRegister.safeParse({
      username: "validuser",
      email: "a@b.com",
      password: "Short1!",
    });
    assert.equal(result.success, false);
  });

  it("rejects password longer than 100 characters", () => {
    const result = schemas.userRegister.safeParse({
      username: "validuser",
      email: "a@b.com",
      password: "A".repeat(101),
    });
    assert.equal(result.success, false);
  });

  it("rejects missing fields", () => {
    assert.equal(schemas.userRegister.safeParse({}).success, false);
    assert.equal(schemas.userRegister.safeParse({ username: "abc" }).success, false);
    assert.equal(schemas.userRegister.safeParse({ email: "a@b.com" }).success, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// userLogin
// ═══════════════════════════════════════════════════════════════════════════════

describe("schemas.userLogin", () => {
  it("accepts login with username and password", () => {
    const result = schemas.userLogin.safeParse({
      username: "testuser",
      password: "mypassword",
    });
    assert.ok(result.success);
  });

  it("accepts login with email and password", () => {
    const result = schemas.userLogin.safeParse({
      email: "test@example.com",
      password: "mypassword",
    });
    assert.ok(result.success);
  });

  it("accepts login with both username and email", () => {
    const result = schemas.userLogin.safeParse({
      username: "testuser",
      email: "test@example.com",
      password: "mypassword",
    });
    assert.ok(result.success);
  });

  it("rejects login with neither username nor email", () => {
    const result = schemas.userLogin.safeParse({
      password: "mypassword",
    });
    assert.equal(result.success, false);
  });

  it("rejects login without password", () => {
    const result = schemas.userLogin.safeParse({
      username: "testuser",
    });
    assert.equal(result.success, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// apiKeyCreate
// ═══════════════════════════════════════════════════════════════════════════════

describe("schemas.apiKeyCreate", () => {
  it("accepts valid API key creation", () => {
    const result = schemas.apiKeyCreate.safeParse({
      name: "My API Key",
      scopes: ["read", "write"],
    });
    assert.ok(result.success);
    assert.equal(result.data.name, "My API Key");
    assert.deepEqual(result.data.scopes, ["read", "write"]);
  });

  it("provides default scopes when not specified", () => {
    const result = schemas.apiKeyCreate.safeParse({ name: "Default Key" });
    assert.ok(result.success);
    assert.deepEqual(result.data.scopes, ["read"]);
  });

  it("rejects empty name", () => {
    const result = schemas.apiKeyCreate.safeParse({ name: "" });
    assert.equal(result.success, false);
  });

  it("rejects name exceeding 100 characters", () => {
    const result = schemas.apiKeyCreate.safeParse({ name: "x".repeat(101) });
    assert.equal(result.success, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// pagination
// ═══════════════════════════════════════════════════════════════════════════════

describe("schemas.pagination", () => {
  it("accepts valid pagination parameters", () => {
    const result = schemas.pagination.safeParse({ limit: 25, offset: 10 });
    assert.ok(result.success);
    assert.equal(result.data.limit, 25);
    assert.equal(result.data.offset, 10);
  });

  it("provides defaults when parameters are omitted", () => {
    const result = schemas.pagination.safeParse({});
    assert.ok(result.success);
    assert.equal(result.data.limit, 50);
    assert.equal(result.data.offset, 0);
  });

  it("coerces string numbers to integers", () => {
    const result = schemas.pagination.safeParse({ limit: "10", offset: "5" });
    assert.ok(result.success);
    assert.equal(result.data.limit, 10);
    assert.equal(result.data.offset, 5);
  });

  it("rejects limit below 1", () => {
    const result = schemas.pagination.safeParse({ limit: 0 });
    assert.equal(result.success, false);
  });

  it("rejects limit above 1000", () => {
    const result = schemas.pagination.safeParse({ limit: 1001 });
    assert.equal(result.success, false);
  });

  it("rejects negative offset", () => {
    const result = schemas.pagination.safeParse({ offset: -1 });
    assert.equal(result.success, false);
  });

  it("accepts optional search query", () => {
    const result = schemas.pagination.safeParse({ q: "search term" });
    assert.ok(result.success);
    assert.equal(result.data.q, "search term");
  });

  it("rejects search query exceeding 500 characters", () => {
    const result = schemas.pagination.safeParse({ q: "x".repeat(501) });
    assert.equal(result.success, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validate() middleware factory
// ═══════════════════════════════════════════════════════════════════════════════

describe("validate() middleware factory", () => {
  /**
   * Creates a mock Express req/res/next triplet for testing middleware.
   */
  function mockExpress(body = {}) {
    const req = { body };
    const res = {
      _status: null,
      _json: null,
      status(code) { this._status = code; return this; },
      json(data) { this._json = data; return this; },
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };
    return { req, res, next, wasNextCalled: () => nextCalled };
  }

  it("calls next() and sets req.validated for valid input", () => {
    const middleware = validate("dtuCreate");
    const { req, res, next, wasNextCalled } = mockExpress({ title: "Valid DTU" });

    middleware(req, res, next);

    assert.ok(wasNextCalled(), "next() should have been called");
    assert.ok(req.validated, "req.validated should be set");
    assert.equal(req.validated.title, "Valid DTU");
  });

  it("returns 400 with error details for invalid input", () => {
    const middleware = validate("dtuCreate");
    const { req, res, next, wasNextCalled } = mockExpress({}); // missing title

    middleware(req, res, next);

    assert.equal(wasNextCalled(), false, "next() should NOT have been called");
    assert.equal(res._status, 400);
    assert.equal(res._json.ok, false);
    assert.equal(res._json.error, "Validation failed");
    assert.ok(Array.isArray(res._json.details), "Should include error details array");
  });

  it("calls next() when schema name does not exist (graceful fallback)", () => {
    const middleware = validate("nonExistentSchema");
    const { req, res, next, wasNextCalled } = mockExpress({ anything: true });

    middleware(req, res, next);

    assert.ok(wasNextCalled(), "next() should be called for unknown schema");
  });

  it("validates userRegister schema through middleware", () => {
    const middleware = validate("userRegister");
    const { req, res, next, wasNextCalled } = mockExpress({
      username: "ab", // too short
      email: "bad-email",
      password: "short",
    });

    middleware(req, res, next);

    assert.equal(wasNextCalled(), false, "next() should NOT be called for invalid input");
    assert.equal(res._status, 400);
  });

  it("sets defaults via schema transformation (pagination)", () => {
    const middleware = validate("pagination");
    const { req, res, next, wasNextCalled } = mockExpress({});

    middleware(req, res, next);

    assert.ok(wasNextCalled());
    assert.equal(req.validated.limit, 50);
    assert.equal(req.validated.offset, 0);
  });
});
