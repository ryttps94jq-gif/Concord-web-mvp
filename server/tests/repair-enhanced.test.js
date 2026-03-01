import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for Repair Brain Enhanced — Code DTU Integration
 *
 * Tests: pattern matching, diagnosis, repair execution, prediction, knowledge
 */

function makeMockDb() {
  return {
    exec: () => {},
    prepare: (sql) => ({
      run: (...args) => ({ changes: 1 }),
      get: (...args) => {
        if (sql.includes("COUNT")) return { count: 0 };
        return null;
      },
      all: (...args) => [],
    }),
  };
}

describe("repair-enhanced", () => {
  let brain;
  let db;

  beforeEach(async () => {
    db = makeMockDb();
    const mod = await import(`../lib/repair-enhanced.js?t=${Date.now()}`);
    brain = mod.createRepairBrain(db);
  });

  describe("createRepairBrain", () => {
    it("returns a brain with required methods", () => {
      assert.ok(brain);
      assert.equal(typeof brain.registerPattern, "function");
      assert.equal(typeof brain.matchSymptoms, "function");
      assert.equal(typeof brain.diagnose, "function");
      assert.equal(typeof brain.executeRepair, "function");
      assert.equal(typeof brain.recordOutcome, "function");
      assert.equal(typeof brain.predict, "function");
      assert.equal(typeof brain.applyPrevention, "function");
      assert.equal(typeof brain.recordMetric, "function");
      assert.equal(typeof brain.getMetricTrend, "function");
      assert.equal(typeof brain.getKnowledge, "function");
      assert.equal(typeof brain.getHistory, "function");
      assert.equal(typeof brain.getPredictions, "function");
      assert.equal(typeof brain.getStats, "function");
      assert.equal(typeof brain.runHealthCheck, "function");
    });
  });

  describe("registerPattern", () => {
    it("registers a failure pattern", () => {
      const result = brain.registerPattern({
        category: "memory",
        subcategory: "heap",
        name: "heap-overflow",
        signature: "FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed",
        severity: "critical",
        resolution: "Increase --max-old-space-size or fix memory leak",
      });
      assert.ok(result);
      assert.ok(result.id);
    });

    it("validates required fields", () => {
      assert.throws(
        () => brain.registerPattern({}),
        (err) => err.message.toLowerCase().includes("category") || err.message.toLowerCase().includes("required")
      );
    });

    it("validates severity level", () => {
      assert.throws(
        () => brain.registerPattern({
          category: "memory",
          subcategory: "heap",
          name: "test",
          signature: "test",
          severity: "extreme",
        }),
        (err) => err.message.toLowerCase().includes("severity")
      );
    });
  });

  describe("matchSymptoms", () => {
    it("returns matches array", () => {
      const matches = brain.matchSymptoms(["high memory usage", "slow response times"]);
      assert.ok(Array.isArray(matches));
    });

    it("accepts string symptoms by converting to array", () => {
      const matches = brain.matchSymptoms("high memory usage");
      assert.ok(Array.isArray(matches));
    });
  });

  describe("diagnose", () => {
    it("returns a diagnosis object", () => {
      const diagnosis = brain.diagnose("memory_leak", ["heap growing", "gc pressure"]);
      assert.ok(diagnosis);
      assert.ok(diagnosis.issueType);
    });

    it("validates issue type", () => {
      assert.throws(
        () => brain.diagnose("", []),
        (err) => err.message.toLowerCase().includes("issue") || err.message.toLowerCase().includes("type") || err.message.toLowerCase().includes("required")
      );
    });
  });

  describe("executeRepair", () => {
    it("executes a repair from diagnosis", () => {
      const diagnosis = brain.diagnose("slow_query", ["query timeout"]);
      const result = brain.executeRepair(diagnosis);
      assert.ok(result);
      assert.ok(result.repairId || result.repair_id || result.id);
    });
  });

  describe("recordOutcome", () => {
    it("validates repair exists", () => {
      // With mock db returning null for gets, repair lookups fail
      assert.throws(
        () => brain.recordOutcome("nonexistent_repair", true, { note: "Fixed" }),
        (err) => err.code === "NOT_FOUND" || err.name === "NotFoundError" || err.message.includes("not found")
      );
    });
  });

  describe("predict", () => {
    it("returns predictions array", () => {
      const predictions = brain.predict({
        memory_usage: 0.85,
        cpu_usage: 0.70,
        disk_usage: 0.45,
      });
      assert.ok(Array.isArray(predictions));
    });
  });

  describe("recordMetric", () => {
    it("records a system metric", () => {
      const result = brain.recordMetric("memory_usage", 0.75, { node: "primary" });
      assert.ok(result);
    });

    it("validates metric type", () => {
      assert.throws(
        () => brain.recordMetric("", 0.5),
        (err) => err.message.toLowerCase().includes("metric") || err.message.toLowerCase().includes("type") || err.message.toLowerCase().includes("required")
      );
    });
  });

  describe("getMetricTrend", () => {
    it("returns trend data", () => {
      const trend = brain.getMetricTrend("memory_usage", 24);
      assert.ok(trend);
    });
  });

  describe("getKnowledge", () => {
    it("returns knowledge entries", () => {
      const knowledge = brain.getKnowledge("memory");
      assert.ok(Array.isArray(knowledge));
    });
  });

  describe("getHistory", () => {
    it("returns history object with items array", () => {
      const history = brain.getHistory({ limit: 10 });
      assert.ok(history);
      assert.ok(Array.isArray(history.items));
    });
  });

  describe("getPredictions", () => {
    it("returns predictions object with items array", () => {
      const predictions = brain.getPredictions({ minConfidence: 0.5 });
      assert.ok(predictions);
      assert.ok(Array.isArray(predictions.items));
    });
  });

  describe("getStats", () => {
    it("returns comprehensive stats", () => {
      const stats = brain.getStats();
      assert.ok(stats);
      assert.ok(stats.repairs);
      assert.equal(typeof stats.repairs.total, "number");
    });
  });

  describe("runHealthCheck", () => {
    it("returns health check results", () => {
      const health = brain.runHealthCheck();
      assert.ok(health);
      assert.ok("healthy" in health || "status" in health);
    });
  });

  describe("pattern categories", () => {
    it("supports all expected categories", () => {
      const categories = brain.PATTERN_CATEGORIES;
      assert.ok(Array.isArray(categories));
      assert.ok(categories.length >= 4);
    });
  });
});
