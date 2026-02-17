/**
 * Integration Tests: Middleware Chain
 *
 * Tests the middleware stack in isolation by creating a minimal Express app
 * that applies the same middleware patterns used in server.js:
 *   - express.json() with size limit
 *   - express.urlencoded()
 *   - CORS (via cors package)
 *   - Request ID generation
 *   - Security headers (via helmet)
 *   - 404 handler (JSON, not HTML)
 *   - Health endpoint
 *
 * Uses Node.js built-in http module for requests (no external test deps).
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Make an HTTP request and return { status, headers, body }.
 * @param {object} options - http.request options
 * @param {string|Buffer} [body] - optional request body
 * @returns {Promise<{status: number, headers: object, body: string}>}
 */
function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: data })
      );
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Build a minimal Express app that mirrors server.js middleware
// ---------------------------------------------------------------------------

async function buildTestApp() {
  const app = express();

  // 1. Security headers (helmet) -------------------------------------------------
  // Dynamically import helmet - it may or may not be available
  let helmetMiddleware = null;
  try {
    // helmet is available in server/node_modules
    const helmetMod = await import("helmet");
    const helmet = helmetMod.default;
    helmetMiddleware = helmet({
      contentSecurityPolicy: false, // simplified for tests
      crossOriginEmbedderPolicy: false,
    });
  } catch {
    // helmet not available - add manual security headers
    helmetMiddleware = (_req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      next();
    };
  }
  app.use(helmetMiddleware);

  // 2. Body parsing (same limits as server.js) ------------------------------------
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // 3. CORS (mirrors server.js corsOptions) ----------------------------------------
  const corsOptions = {
    origin: (_origin, callback) => callback(null, true), // allow all for tests
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "X-Requested-With",
      "X-Session-ID",
      "X-CSRF-Token",
      "X-XSRF-Token",
      "X-Request-ID",
    ],
  };
  app.use(cors(corsOptions));

  // 4. Request ID generation (same pattern as server.js) --------------------------
  app.use((req, res, next) => {
    req.id =
      req.headers["x-request-id"] ||
      `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
    res.setHeader("X-Request-ID", req.id);
    next();
  });

  // ---------- Test routes --------------------------------------------------------

  // Health endpoint (mirrors /health in server.js)
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "healthy",
      version: "test",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: { server: true },
    });
  });

  // Echo route — returns the parsed body so tests can verify parsing
  app.post("/echo", (req, res) => {
    res.json({ ok: true, received: req.body });
  });

  // Route that requires JSON content-type
  app.post("/json-only", (req, res) => {
    const ct = req.headers["content-type"] || "";
    if (!ct.includes("application/json")) {
      return res.status(415).json({ ok: false, error: "Unsupported Media Type" });
    }
    res.json({ ok: true, received: req.body });
  });

  // ---------- 404 catch-all (JSON, not HTML) -------------------------------------
  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: "Not found" });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("Middleware Chain Integration", () => {
  let server;
  let port;
  /** @returns {object} Default request options pointing at the test server */
  const opts = (overrides = {}) => ({
    hostname: "127.0.0.1",
    port,
    ...overrides,
  });

  before(async () => {
    const app = await buildTestApp();
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(() => {
    return new Promise((resolve) => {
      if (server) server.close(resolve);
      else resolve();
    });
  });

  // ---- 1. JSON parsing ---------------------------------------------------------
  it("parses a JSON body correctly", async () => {
    const payload = JSON.stringify({ greeting: "hello", count: 42 });
    const res = await makeRequest(
      opts({
        method: "POST",
        path: "/echo",
        headers: { "Content-Type": "application/json" },
      }),
      payload
    );
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.deepStrictEqual(body.received, { greeting: "hello", count: 42 });
  });

  // ---- 2. Large payload rejection -----------------------------------------------
  it("rejects payloads exceeding the size limit with 413", async () => {
    // Create a payload just over 10 MB
    const largePayload = JSON.stringify({ data: "x".repeat(11 * 1024 * 1024) });
    const res = await makeRequest(
      opts({
        method: "POST",
        path: "/echo",
        headers: { "Content-Type": "application/json" },
      }),
      largePayload
    );
    assert.equal(res.status, 413);
  });

  // ---- 3. URL-encoded parsing ---------------------------------------------------
  it("parses URL-encoded form data correctly", async () => {
    const formData = "name=concord&version=5";
    const res = await makeRequest(
      opts({
        method: "POST",
        path: "/echo",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(formData),
        },
      }),
      formData
    );
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, true);
    assert.equal(body.received.name, "concord");
    assert.equal(body.received.version, "5");
  });

  // ---- 4. CORS headers on normal GET --------------------------------------------
  it("includes CORS Access-Control headers on responses", async () => {
    const res = await makeRequest(
      opts({
        method: "GET",
        path: "/health",
        headers: { Origin: "https://example.com" },
      })
    );
    assert.equal(res.status, 200);
    // cors package sets access-control-allow-origin
    assert.ok(
      res.headers["access-control-allow-origin"],
      "Expected Access-Control-Allow-Origin header"
    );
  });

  // ---- 5. CORS preflight --------------------------------------------------------
  it("handles OPTIONS preflight with correct headers and 204", async () => {
    const res = await makeRequest(
      opts({
        method: "OPTIONS",
        path: "/echo",
        headers: {
          Origin: "https://example.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      })
    );
    assert.equal(res.status, 204);
    assert.ok(
      res.headers["access-control-allow-origin"],
      "Expected Access-Control-Allow-Origin on preflight"
    );
    assert.ok(
      res.headers["access-control-allow-methods"],
      "Expected Access-Control-Allow-Methods on preflight"
    );
    assert.ok(
      res.headers["access-control-allow-headers"],
      "Expected Access-Control-Allow-Headers on preflight"
    );
  });

  // ---- 6. Request ID generation -------------------------------------------------
  it("assigns an X-Request-ID header to every response", async () => {
    const res = await makeRequest(opts({ method: "GET", path: "/health" }));
    assert.equal(res.status, 200);
    const rid = res.headers["x-request-id"];
    assert.ok(rid, "Expected X-Request-ID header");
    assert.ok(rid.startsWith("req_"), `Request ID should start with req_, got: ${rid}`);
  });

  it("echoes a client-provided X-Request-ID", async () => {
    const customId = "custom-request-id-12345";
    const res = await makeRequest(
      opts({
        method: "GET",
        path: "/health",
        headers: { "X-Request-ID": customId },
      })
    );
    assert.equal(res.headers["x-request-id"], customId);
  });

  // ---- 7. 404 handling (JSON, not HTML) -----------------------------------------
  it("returns JSON 404 for unknown routes, not HTML", async () => {
    const res = await makeRequest(
      opts({ method: "GET", path: "/this/route/does/not/exist" })
    );
    assert.equal(res.status, 404);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, false);
    assert.ok(body.error, "404 response should include an error field");
    // Must not be HTML
    assert.ok(
      !res.body.trim().startsWith("<!DOCTYPE") && !res.body.trim().startsWith("<html"),
      "404 response must not be HTML"
    );
  });

  // ---- 8. Security headers ------------------------------------------------------
  it("includes security headers (X-Content-Type-Options, X-Frame-Options)", async () => {
    const res = await makeRequest(opts({ method: "GET", path: "/health" }));
    assert.equal(res.status, 200);
    // helmet sets x-content-type-options: nosniff
    assert.equal(
      res.headers["x-content-type-options"],
      "nosniff",
      "Expected X-Content-Type-Options: nosniff"
    );
    // helmet sets x-frame-options (SAMEORIGIN or DENY depending on version)
    const xfo = res.headers["x-frame-options"];
    assert.ok(xfo, "Expected X-Frame-Options header");
    assert.ok(
      xfo === "SAMEORIGIN" || xfo === "DENY",
      `X-Frame-Options should be SAMEORIGIN or DENY, got: ${xfo}`
    );
  });

  // ---- 9. Content-Type enforcement -----------------------------------------------
  it("rejects non-JSON POST to a JSON-only endpoint with 415", async () => {
    const res = await makeRequest(
      opts({
        method: "POST",
        path: "/json-only",
        headers: { "Content-Type": "text/plain" },
      }),
      "this is plain text"
    );
    assert.equal(res.status, 415);
    const body = JSON.parse(res.body);
    assert.equal(body.ok, false);
  });

  // ---- 10. Health endpoint -------------------------------------------------------
  it("GET /health returns 200 with JSON status", async () => {
    const res = await makeRequest(opts({ method: "GET", path: "/health" }));
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "healthy");
    assert.ok(body.timestamp, "Health response should include a timestamp");
    assert.ok(body.checks, "Health response should include checks");
    assert.equal(body.checks.server, true);
  });

  // ---- Bonus: unique request IDs per request ------------------------------------
  it("generates unique request IDs for each request", async () => {
    const res1 = await makeRequest(opts({ method: "GET", path: "/health" }));
    const res2 = await makeRequest(opts({ method: "GET", path: "/health" }));
    const id1 = res1.headers["x-request-id"];
    const id2 = res2.headers["x-request-id"];
    assert.ok(id1, "First request should have X-Request-ID");
    assert.ok(id2, "Second request should have X-Request-ID");
    assert.notEqual(id1, id2, "Each request should get a unique request ID");
  });
});
