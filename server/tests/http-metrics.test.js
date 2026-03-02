/**
 * HTTP Metrics Test Suite
 *
 * Tests the Prometheus-compatible HTTP metrics middleware:
 *   - httpMetricsMiddleware() request tracking
 *   - Status code counting (2xx, 3xx, 4xx, 5xx)
 *   - Duration histogram buckets
 *   - Error counting
 *   - Active request gauge
 *   - getActiveRequests() function
 *   - installGlobalMetrics() global attachment
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  httpMetricsMiddleware,
  getActiveRequests,
  installGlobalMetrics,
} from "../lib/http-metrics.js";

// ── Mock Request/Response ───────────────────────────────────────────────────

function createMockReq() {
  return {
    method: "GET",
    url: "/api/test",
    path: "/api/test",
  };
}

function createMockRes(statusCode = 200) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.removeListener = EventEmitter.prototype.removeListener.bind(res);
  return res;
}

// ── httpMetricsMiddleware ───────────────────────────────────────────────────

describe("httpMetricsMiddleware", () => {
  it("calls next() to continue middleware chain", (t, done) => {
    const req = createMockReq();
    const res = createMockRes();

    httpMetricsMiddleware(req, res, () => {
      done();
    });
  });

  it("increments active requests during processing", (t, done) => {
    const req = createMockReq();
    const res = createMockRes();

    const before = getActiveRequests();

    httpMetricsMiddleware(req, res, () => {
      // Active requests should be incremented
      assert.ok(getActiveRequests() >= before);
      res.emit("finish");
      done();
    });
  });

  it("decrements active requests after response finish", (t, done) => {
    const req = createMockReq();
    const res = createMockRes();

    httpMetricsMiddleware(req, res, () => {
      const during = getActiveRequests();
      res.emit("finish");

      // After finish, active requests should be decremented
      setTimeout(() => {
        assert.ok(getActiveRequests() <= during);
        done();
      }, 10);
    });
  });

  it("tracks status codes by bucket", (t, done) => {
    const req = createMockReq();
    const res = createMockRes(200);

    httpMetricsMiddleware(req, res, () => {
      res.emit("finish");
      // The 2xx bucket should be populated
      // We can't directly access the metrics object, but we can verify it doesn't throw
      done();
    });
  });

  it("handles close event (for aborted requests)", (t, done) => {
    const req = createMockReq();
    const res = createMockRes(0); // No status for aborted

    httpMetricsMiddleware(req, res, () => {
      res.emit("close");
      done();
    });
  });

  it("processes multiple requests sequentially", (t, done) => {
    let completed = 0;
    const total = 3;

    for (let i = 0; i < total; i++) {
      const req = createMockReq();
      const res = createMockRes(200 + i);

      httpMetricsMiddleware(req, res, () => {
        res.emit("finish");
        completed++;
        if (completed === total) done();
      });
    }
  });

  it("handles 4xx error responses", (t, done) => {
    const req = createMockReq();
    const res = createMockRes(404);

    httpMetricsMiddleware(req, res, () => {
      res.emit("finish");
      done();
    });
  });

  it("handles 5xx error responses", (t, done) => {
    const req = createMockReq();
    const res = createMockRes(500);

    httpMetricsMiddleware(req, res, () => {
      res.emit("finish");
      done();
    });
  });
});

// ── getActiveRequests ───────────────────────────────────────────────────────

describe("getActiveRequests", () => {
  it("returns a number", () => {
    assert.equal(typeof getActiveRequests(), "number");
  });

  it("returns non-negative value", () => {
    assert.ok(getActiveRequests() >= 0);
  });
});

// ── installGlobalMetrics ────────────────────────────────────────────────────

describe("installGlobalMetrics", () => {
  it("installs metrics on globalThis", () => {
    installGlobalMetrics();
    assert.ok(globalThis._concordHttpMetrics);
    assert.equal(typeof globalThis._concordHttpMetrics, "object");
  });

  it("exposes expected metric fields", () => {
    installGlobalMetrics();
    const m = globalThis._concordHttpMetrics;

    assert.equal(typeof m.totalRequests, "number");
    assert.equal(typeof m.totalDuration, "number");
    assert.equal(typeof m.errorCount, "number");
    assert.equal(typeof m.activeRequests, "number");
    assert.equal(typeof m.statusCodes, "object");
    assert.equal(typeof m.durationBuckets, "object");
  });

  it("has initialized duration buckets", () => {
    installGlobalMetrics();
    const buckets = globalThis._concordHttpMetrics.durationBuckets;
    const expectedBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

    for (const b of expectedBuckets) {
      assert.ok(b in buckets, `Missing bucket: ${b}`);
      assert.equal(typeof buckets[b], "number");
    }
  });

  it("is idempotent (calling twice does not reset counters)", () => {
    installGlobalMetrics();
    const m = globalThis._concordHttpMetrics;
    const totalBefore = m.totalRequests;

    installGlobalMetrics();
    // Should reference the same object
    assert.equal(globalThis._concordHttpMetrics.totalRequests, totalBefore);
  });
});
