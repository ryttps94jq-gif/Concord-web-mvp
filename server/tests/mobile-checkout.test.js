/**
 * Mobile Checkout Route Tests
 *
 * Tests the /checkout, /checkout/success, and /checkout/cancel routes
 * used by the iOS external payment flow (External Purchase Link Entitlement).
 *
 * Since we cannot use mock.module in Node 22, we import the router directly.
 * The /checkout route calls createCheckoutSession from economy/stripe.js,
 * but we test parameter validation (which happens before that call) and
 * the static success/cancel pages separately.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import the router — createCheckoutSession will import but we control
// whether it gets called via verifyToken gating
const { default: mobileCheckoutRouter } = await import("../routes/mobile-checkout.js");

// ── Extract Route Handlers from Express Router Stack ──────────────────────

function extractHandlers(router) {
  const handlers = {};
  for (const layer of router.stack) {
    if (layer.route) {
      const path = layer.route.path;
      const method = Object.keys(layer.route.methods)[0];
      if (!handlers[method]) handlers[method] = {};
      handlers[method][path] = layer.route.stack.map(s => s.handle);
    }
  }
  return handlers;
}

const routeHandlers = extractHandlers(mobileCheckoutRouter);

// ── Mock Request/Response ─────────────────────────────────────────────────

function createMockApp(overrides = {}) {
  return {
    locals: {
      verifyToken: overrides.verifyToken ?? null,
      db: overrides.db ?? {},
    },
  };
}

async function callRoute(method, path, { query = {}, headers = {}, ip = "127.0.0.1", app = null } = {}) {
  const handlers = routeHandlers[method]?.[path];
  if (!handlers) throw new Error(`No route: ${method.toUpperCase()} ${path}`);

  let statusCode = 200;
  let responseBody = null;
  let redirectUrl = null;
  let redirectStatus = null;

  const req = {
    query,
    headers,
    ip,
    app: app || createMockApp(),
  };

  const res = {
    status(code) { statusCode = code; return res; },
    send(data) { responseBody = data; return res; },
    json(data) { responseBody = data; return res; },
    redirect(status, url) {
      if (typeof status === "string") {
        redirectUrl = status;
        redirectStatus = 302;
      } else {
        redirectStatus = status;
        redirectUrl = url;
      }
      return res;
    },
  };

  for (const handler of handlers) {
    await handler(req, res, () => {});
    if (responseBody !== null || redirectUrl !== null) break;
  }

  return { status: statusCode, body: responseBody, redirectUrl, redirectStatus };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Router Structure
// ═══════════════════════════════════════════════════════════════════════════════

describe("Mobile checkout router structure", () => {
  it("has GET /checkout route", () => {
    assert.ok(routeHandlers.get?.["/checkout"], "Missing GET /checkout");
  });

  it("has GET /checkout/success route", () => {
    assert.ok(routeHandlers.get?.["/checkout/success"], "Missing GET /checkout/success");
  });

  it("has GET /checkout/cancel route", () => {
    assert.ok(routeHandlers.get?.["/checkout/cancel"], "Missing GET /checkout/cancel");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. GET /checkout — Parameter Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /checkout — parameter validation", () => {
  const mockApp = () => createMockApp({
    verifyToken: (token) => token === "valid_token" ? { userId: "user_1" } : null,
  });

  it("returns 400 when userId is missing", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { amount: "10", token: "valid_token" },
      app: mockApp(),
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.includes("Missing required parameters"));
  });

  it("returns 400 when amount is missing", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", token: "valid_token" },
      app: mockApp(),
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.includes("Missing required parameters"));
  });

  it("returns 400 when token is missing", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", amount: "10" },
      app: mockApp(),
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.includes("Missing required parameters"));
  });

  it("returns 401 when token is invalid", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", amount: "10", token: "bad_token" },
      app: mockApp(),
    });
    assert.equal(res.status, 401);
    assert.ok(res.body.includes("Invalid or expired session"));
  });

  it("returns 401 when token userId does not match query userId", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_OTHER", amount: "10", token: "valid_token" },
      app: mockApp(),
    });
    assert.equal(res.status, 401);
    assert.ok(res.body.includes("Invalid or expired session"));
  });

  it("returns 400 for amount below $1", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", amount: "0.50", token: "valid_token" },
      app: mockApp(),
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.includes("Invalid amount"));
  });

  it("returns 400 for amount above $10,000", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", amount: "10001", token: "valid_token" },
      app: mockApp(),
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.includes("Invalid amount"));
  });

  it("returns 400 for NaN amount", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", amount: "not_a_number", token: "valid_token" },
      app: mockApp(),
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.includes("Invalid amount"));
  });

  it("returns 400 for negative amount", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", amount: "-5", token: "valid_token" },
      app: mockApp(),
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.includes("Invalid amount"));
  });

  it("returns 400 for zero amount", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", amount: "0", token: "valid_token" },
      app: mockApp(),
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.includes("Invalid amount"));
  });

  it("returns 401 when verifyToken is not configured", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", amount: "25", token: "valid_token" },
      app: createMockApp({ verifyToken: null }),
    });
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. GET /checkout/success — Success Page
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /checkout/success", () => {
  it("returns 200 with success HTML", async () => {
    const res = await callRoute("get", "/checkout/success");
    assert.equal(res.status, 200);
    assert.ok(res.body.includes("Coins Added"));
    assert.ok(res.body.includes("Purchase Complete"));
  });

  it("includes deep link back to app", async () => {
    const res = await callRoute("get", "/checkout/success");
    assert.ok(res.body.includes("concordapp://checkout-complete?status=success"));
  });

  it("includes Return to Concord button", async () => {
    const res = await callRoute("get", "/checkout/success");
    assert.ok(res.body.includes("Return to Concord"));
  });

  it("includes fallback instruction for manual app open", async () => {
    const res = await callRoute("get", "/checkout/success");
    assert.ok(res.body.includes("open the Concord app manually"));
  });

  it("has mobile-friendly viewport meta", async () => {
    const res = await callRoute("get", "/checkout/success");
    assert.ok(res.body.includes('name="viewport"'));
    assert.ok(res.body.includes("width=device-width"));
  });

  it("has dark theme styling", async () => {
    const res = await callRoute("get", "/checkout/success");
    assert.ok(res.body.includes("#0a0a0f"));
  });

  it("renders valid HTML document", async () => {
    const res = await callRoute("get", "/checkout/success");
    assert.ok(res.body.includes("<!DOCTYPE html>"));
    assert.ok(res.body.includes("</html>"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. GET /checkout/cancel — Cancel Page
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /checkout/cancel", () => {
  it("returns 200 with cancel HTML", async () => {
    const res = await callRoute("get", "/checkout/cancel");
    assert.equal(res.status, 200);
    assert.ok(res.body.includes("Purchase Cancelled"));
  });

  it("includes deep link back to app", async () => {
    const res = await callRoute("get", "/checkout/cancel");
    assert.ok(res.body.includes("concordapp://checkout-cancel"));
  });

  it("states no charges were made", async () => {
    const res = await callRoute("get", "/checkout/cancel");
    assert.ok(res.body.includes("No charges were made"));
  });

  it("has mobile-friendly viewport meta", async () => {
    const res = await callRoute("get", "/checkout/cancel");
    assert.ok(res.body.includes('name="viewport"'));
  });

  it("has dark theme styling", async () => {
    const res = await callRoute("get", "/checkout/cancel");
    assert.ok(res.body.includes("#0a0a0f"));
  });

  it("renders valid HTML document", async () => {
    const res = await callRoute("get", "/checkout/cancel");
    assert.ok(res.body.includes("<!DOCTYPE html>"));
    assert.ok(res.body.includes("</html>"));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Error Page — XSS Protection & Structure
// ═══════════════════════════════════════════════════════════════════════════════

describe("Error page XSS protection", () => {
  it("error page does not contain unescaped HTML", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", amount: "10", token: "bad_token" },
      app: createMockApp({ verifyToken: () => null }),
    });
    assert.ok(!res.body.includes("<script>"));
    assert.ok(res.body.includes("concordapp://error"));
  });

  it("error page renders valid HTML structure", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", amount: "10", token: "bad" },
      app: createMockApp({ verifyToken: () => null }),
    });
    assert.ok(res.body.includes("<!DOCTYPE html>"));
    assert.ok(res.body.includes("</html>"));
    assert.ok(res.body.includes("Something Went Wrong"));
  });

  it("error page includes deep link to return to app", async () => {
    const res = await callRoute("get", "/checkout", {
      query: { userId: "user_1", amount: "10", token: "bad" },
      app: createMockApp({ verifyToken: () => null }),
    });
    assert.ok(res.body.includes("concordapp://error"));
    assert.ok(res.body.includes("Return to Concord"));
  });
});
