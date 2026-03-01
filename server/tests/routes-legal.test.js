import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import registerLegalRoutes from "../routes/legal.js";

/**
 * Lightweight mock for Express app and request/response.
 * Route tests exercise the handler logic directly without HTTP.
 */
function createMockApp() {
  const routes = {};
  const methods = ["get", "post", "put", "delete", "patch"];

  const app = {};
  for (const method of methods) {
    app[method] = (path, ...handlers) => {
      if (!routes[method]) routes[method] = {};
      routes[method][path] = handlers;
    };
  }

  /**
   * Execute a registered route handler chain.
   */
  app.call = async (method, path, { body, params, query, user, headers } = {}) => {
    const handlers = routes[method]?.[path];
    if (!handlers) throw new Error(`No route registered for ${method.toUpperCase()} ${path}`);

    let statusCode = 200;
    let responseBody = null;
    let sentHeaders = {};

    const req = {
      body: body || {},
      params: params || {},
      query: query || {},
      user: user || null,
      headers: headers || {},
      ip: "127.0.0.1",
    };

    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      json(data) {
        responseBody = data;
        return res;
      },
      set(key, value) {
        sentHeaders[key] = value;
        return res;
      },
      send(data) {
        responseBody = data;
        return res;
      },
    };

    // Execute middleware chain
    for (const handler of handlers) {
      let nextCalled = false;
      await new Promise((resolve, reject) => {
        const next = (err) => {
          nextCalled = true;
          if (err) reject(err);
          else resolve();
        };

        try {
          const result = handler(req, res, next);
          if (result && typeof result.then === "function") {
            result.then(() => {
              if (!nextCalled) resolve();
            }).catch(reject);
          } else if (!nextCalled) {
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      });

      // If the response was sent (json was called), stop the chain
      if (responseBody !== null) break;
    }

    return { status: statusCode, body: responseBody, headers: sentHeaders };
  };

  return app;
}

describe("routes/legal", () => {
  let app;
  let db;

  beforeEach(() => {
    app = createMockApp();
    db = new Database(":memory:");
    registerLegalRoutes(app, {
      db,
      structuredLog: () => {},
      auditLog: () => {},
    });
  });

  // ── DMCA submission ────────────────────────────────────────────────

  describe("POST /api/legal/dmca/submit", () => {
    const validSubmission = {
      claimantName: "John Doe",
      claimantEmail: "john@example.com",
      claimantAddress: "123 Main St",
      copyrightWork: "My Original Song",
      infringingUrl: "https://example.com/stolen",
      dtuId: "dtu_123",
      description: "This is a copy of my work",
      goodFaithStatement: true,
      accuracyStatement: true,
      signature: "John Doe",
    };

    it("creates a DMCA case with valid data", async () => {
      const res = await app.call("post", "/api/legal/dmca/submit", {
        body: validSubmission,
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.caseId.startsWith("dmca_"));
      assert.equal(res.body.status, "pending");
    });

    it("returns 400 for missing claimantName", async () => {
      const res = await app.call("post", "/api/legal/dmca/submit", {
        body: { ...validSubmission, claimantName: "" },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.ok, false);
      assert.ok(res.body.error.includes("claimantName"));
    });

    it("returns 400 for missing claimantEmail", async () => {
      const res = await app.call("post", "/api/legal/dmca/submit", {
        body: { ...validSubmission, claimantEmail: "" },
      });

      assert.equal(res.status, 400);
    });

    it("returns 400 for invalid email format", async () => {
      const res = await app.call("post", "/api/legal/dmca/submit", {
        body: { ...validSubmission, claimantEmail: "not-an-email" },
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes("email"));
    });

    it("returns 400 for missing copyrightWork", async () => {
      const res = await app.call("post", "/api/legal/dmca/submit", {
        body: { ...validSubmission, copyrightWork: "" },
      });

      assert.equal(res.status, 400);
    });

    it("returns 400 for missing description", async () => {
      const res = await app.call("post", "/api/legal/dmca/submit", {
        body: { ...validSubmission, description: "" },
      });

      assert.equal(res.status, 400);
    });

    it("returns 400 for missing signature", async () => {
      const res = await app.call("post", "/api/legal/dmca/submit", {
        body: { ...validSubmission, signature: "" },
      });

      assert.equal(res.status, 400);
    });

    it("returns 400 when goodFaithStatement is false", async () => {
      const res = await app.call("post", "/api/legal/dmca/submit", {
        body: { ...validSubmission, goodFaithStatement: false },
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes("good faith"));
    });

    it("returns 400 when accuracyStatement is false", async () => {
      const res = await app.call("post", "/api/legal/dmca/submit", {
        body: { ...validSubmission, accuracyStatement: false },
      });

      assert.equal(res.status, 400);
    });
  });

  // ── DMCA case lookup ───────────────────────────────────────────────

  describe("GET /api/legal/dmca/:caseId", () => {
    it("retrieves a DMCA case by ID", async () => {
      // First create a case
      const createRes = await app.call("post", "/api/legal/dmca/submit", {
        body: {
          claimantName: "Jane Doe",
          claimantEmail: "jane@example.com",
          copyrightWork: "My Photo",
          description: "Unauthorized use",
          goodFaithStatement: true,
          accuracyStatement: true,
          signature: "Jane Doe",
        },
      });

      const caseId = createRes.body.caseId;
      const res = await app.call("get", "/api/legal/dmca/:caseId", {
        params: { caseId },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.ok(res.body.case);
      assert.equal(res.body.case.status, "pending");
    });

    it("returns 404 for non-existent case", async () => {
      const res = await app.call("get", "/api/legal/dmca/:caseId", {
        params: { caseId: "dmca_nonexistent1234" },
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.ok, false);
    });

    it("returns public-safe subset for non-admin users", async () => {
      const createRes = await app.call("post", "/api/legal/dmca/submit", {
        body: {
          claimantName: "Jane",
          claimantEmail: "jane@example.com",
          copyrightWork: "Work",
          description: "Description",
          goodFaithStatement: true,
          accuracyStatement: true,
          signature: "Jane",
        },
      });

      const res = await app.call("get", "/api/legal/dmca/:caseId", {
        params: { caseId: createRes.body.caseId },
        user: { role: "member" },
      });

      assert.equal(res.body.ok, true);
      // Public format should not include claimantAddress
      assert.equal(res.body.case.claimantAddress, undefined);
    });
  });

  // ── DMCA counter-notification ──────────────────────────────────────

  describe("POST /api/legal/dmca/:caseId/counter", () => {
    let caseId;

    beforeEach(async () => {
      const createRes = await app.call("post", "/api/legal/dmca/submit", {
        body: {
          claimantName: "Claimant",
          claimantEmail: "claimant@example.com",
          copyrightWork: "Work",
          description: "Infringement",
          goodFaithStatement: true,
          accuracyStatement: true,
          signature: "Claimant",
        },
      });
      caseId = createRes.body.caseId;
    });

    it("submits a counter-notification", async () => {
      const res = await app.call("post", "/api/legal/dmca/:caseId/counter", {
        params: { caseId },
        body: {
          respondentName: "Respondent",
          respondentEmail: "resp@example.com",
          counterStatement: "This is fair use",
          consentToJurisdiction: true,
          signature: "Respondent",
        },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.status, "counter_filed");
    });

    it("returns 400 for missing respondentName", async () => {
      const res = await app.call("post", "/api/legal/dmca/:caseId/counter", {
        params: { caseId },
        body: {
          respondentEmail: "resp@example.com",
          counterStatement: "Fair use",
          consentToJurisdiction: true,
          signature: "Sig",
        },
      });

      assert.equal(res.status, 400);
    });

    it("returns 400 without consentToJurisdiction", async () => {
      const res = await app.call("post", "/api/legal/dmca/:caseId/counter", {
        params: { caseId },
        body: {
          respondentName: "Respondent",
          respondentEmail: "resp@example.com",
          counterStatement: "Fair use",
          consentToJurisdiction: false,
          signature: "Sig",
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes("jurisdiction"));
    });

    it("returns 400 for duplicate counter-notification", async () => {
      await app.call("post", "/api/legal/dmca/:caseId/counter", {
        params: { caseId },
        body: {
          respondentName: "Resp",
          respondentEmail: "r@example.com",
          counterStatement: "Fair use",
          consentToJurisdiction: true,
          signature: "Resp",
        },
      });

      const res = await app.call("post", "/api/legal/dmca/:caseId/counter", {
        params: { caseId },
        body: {
          respondentName: "Resp2",
          respondentEmail: "r2@example.com",
          counterStatement: "Also fair use",
          consentToJurisdiction: true,
          signature: "Resp2",
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes("already been filed"));
    });

    it("returns 404 for non-existent case", async () => {
      const res = await app.call("post", "/api/legal/dmca/:caseId/counter", {
        params: { caseId: "dmca_nonexistent" },
        body: {
          respondentName: "Resp",
          respondentEmail: "r@example.com",
          counterStatement: "Fair use",
          consentToJurisdiction: true,
          signature: "Resp",
        },
      });

      assert.equal(res.status, 404);
    });
  });

  // ── Case resolution ────────────────────────────────────────────────

  describe("POST /api/legal/dmca/:caseId/resolve", () => {
    let caseId;

    beforeEach(async () => {
      const createRes = await app.call("post", "/api/legal/dmca/submit", {
        body: {
          claimantName: "Claimant",
          claimantEmail: "c@example.com",
          copyrightWork: "Work",
          description: "Desc",
          goodFaithStatement: true,
          accuracyStatement: true,
          signature: "Claimant",
        },
      });
      caseId = createRes.body.caseId;
    });

    it("resolves a case as upheld", async () => {
      const res = await app.call("post", "/api/legal/dmca/:caseId/resolve", {
        params: { caseId },
        body: { resolution: "upheld", notes: "Clear infringement" },
        user: { id: "admin1", role: "admin" },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.ok, true);
      assert.equal(res.body.status, "resolved");
      assert.equal(res.body.resolution, "upheld");
    });

    it("resolves a case as dismissed", async () => {
      const res = await app.call("post", "/api/legal/dmca/:caseId/resolve", {
        params: { caseId },
        body: { resolution: "dismissed" },
        user: { id: "admin1" },
      });

      assert.equal(res.body.ok, true);
      assert.equal(res.body.resolution, "dismissed");
    });

    it("returns 400 for invalid resolution type", async () => {
      const res = await app.call("post", "/api/legal/dmca/:caseId/resolve", {
        params: { caseId },
        body: { resolution: "nuke_from_orbit" },
        user: { id: "admin1" },
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes("must be one of"));
    });

    it("returns 400 for already resolved case", async () => {
      await app.call("post", "/api/legal/dmca/:caseId/resolve", {
        params: { caseId },
        body: { resolution: "upheld" },
        user: { id: "admin1" },
      });

      const res = await app.call("post", "/api/legal/dmca/:caseId/resolve", {
        params: { caseId },
        body: { resolution: "dismissed" },
        user: { id: "admin2" },
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes("already been resolved"));
    });

    it("returns 404 for non-existent case", async () => {
      const res = await app.call("post", "/api/legal/dmca/:caseId/resolve", {
        params: { caseId: "dmca_ghost" },
        body: { resolution: "upheld" },
        user: { id: "admin1" },
      });

      assert.equal(res.status, 404);
    });
  });

  // ── Status transitions ─────────────────────────────────────────────

  describe("status transitions", () => {
    it("pending -> counter_filed -> resolved", async () => {
      // Create case
      const createRes = await app.call("post", "/api/legal/dmca/submit", {
        body: {
          claimantName: "C",
          claimantEmail: "c@x.com",
          copyrightWork: "W",
          description: "D",
          goodFaithStatement: true,
          accuracyStatement: true,
          signature: "C",
        },
      });
      const caseId = createRes.body.caseId;

      // Verify pending
      const pending = await app.call("get", "/api/legal/dmca/:caseId", {
        params: { caseId },
      });
      assert.equal(pending.body.case.status, "pending");

      // Counter-file
      await app.call("post", "/api/legal/dmca/:caseId/counter", {
        params: { caseId },
        body: {
          respondentName: "R",
          respondentEmail: "r@x.com",
          counterStatement: "Fair use",
          consentToJurisdiction: true,
          signature: "R",
        },
      });

      // Verify counter_filed
      const countered = await app.call("get", "/api/legal/dmca/:caseId", {
        params: { caseId },
      });
      assert.equal(countered.body.case.status, "counter_filed");

      // Resolve
      await app.call("post", "/api/legal/dmca/:caseId/resolve", {
        params: { caseId },
        body: { resolution: "dismissed" },
        user: { id: "admin" },
      });

      // Verify resolved
      const resolved = await app.call("get", "/api/legal/dmca/:caseId", {
        params: { caseId },
      });
      assert.equal(resolved.body.case.status, "resolved");
    });

    it("cannot counter-file on a resolved case", async () => {
      const createRes = await app.call("post", "/api/legal/dmca/submit", {
        body: {
          claimantName: "C",
          claimantEmail: "c@x.com",
          copyrightWork: "W",
          description: "D",
          goodFaithStatement: true,
          accuracyStatement: true,
          signature: "C",
        },
      });
      const caseId = createRes.body.caseId;

      // Resolve immediately
      await app.call("post", "/api/legal/dmca/:caseId/resolve", {
        params: { caseId },
        body: { resolution: "upheld" },
        user: { id: "admin" },
      });

      // Try counter-file
      const res = await app.call("post", "/api/legal/dmca/:caseId/counter", {
        params: { caseId },
        body: {
          respondentName: "R",
          respondentEmail: "r@x.com",
          counterStatement: "Fair use",
          consentToJurisdiction: true,
          signature: "R",
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes("already been resolved"));
    });
  });
});
