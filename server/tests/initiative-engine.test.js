import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for Conversational Initiative Engine (Living Chat)
 *
 * Tests: triggers, rate limiting, style learning, double text, backoff
 */

function makeMockDb() {
  // Track stored data to simulate basic persistence
  const data = {};
  return {
    exec: () => {},
    prepare: (sql) => ({
      run: (...args) => ({ changes: 1 }),
      get: (...args) => {
        // Return appropriate defaults based on query type
        if (sql.includes("COUNT")) return { count: 0 };
        if (sql.includes("initiative_settings")) {
          return { user_id: args[0], max_per_day: 3, max_per_week: 10, quiet_start: "22:00", quiet_end: "08:00", allow_double_text: 1, channels_json: '{"inApp":true}', disabled: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        }
        if (sql.includes("initiative_backoff")) {
          return { user_id: args[0], ignored_count: 0, last_initiative_at: null, backoff_until: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        }
        if (sql.includes("user_style_profile")) {
          return null; // No style profile initially
        }
        if (sql.includes("initiatives") && sql.includes("SUM")) {
          return { count: 0 };
        }
        return null;
      },
      all: (...args) => [],
    }),
    _data: data,
  };
}

describe("initiative-engine", () => {
  let engine;
  let db;

  beforeEach(async () => {
    db = makeMockDb();
    const mod = await import("../lib/initiative-engine.js");
    engine = mod.createInitiativeEngine(db);
  });

  describe("createInitiativeEngine", () => {
    it("returns an engine with required methods", () => {
      assert.ok(engine);
      assert.equal(typeof engine.getSettings, "function");
      assert.equal(typeof engine.updateSettings, "function");
      assert.equal(typeof engine.evaluateTrigger, "function");
      assert.equal(typeof engine.createInitiative, "function");
      assert.equal(typeof engine.deliverInitiative, "function");
      assert.equal(typeof engine.markRead, "function");
      assert.equal(typeof engine.markResponded, "function");
      assert.equal(typeof engine.dismissInitiative, "function");
      assert.equal(typeof engine.getHistory, "function");
      assert.equal(typeof engine.getPending, "function");
      assert.equal(typeof engine.generateDoubleText, "function");
      assert.equal(typeof engine.learnStyle, "function");
      assert.equal(typeof engine.getStyleProfile, "function");
      assert.equal(typeof engine.adaptMessage, "function");
      assert.equal(typeof engine.checkRateLimits, "function");
      assert.equal(typeof engine.getBackoff, "function");
      assert.equal(typeof engine.getStats, "function");
    });
  });

  describe("getSettings", () => {
    it("returns settings for user", () => {
      const settings = engine.getSettings("user1");
      assert.ok(settings);
      // Settings should have max_per_day
      assert.ok("max_per_day" in settings || "maxPerDay" in settings);
    });
  });

  describe("evaluateTrigger", () => {
    it("rejects invalid trigger type", () => {
      assert.throws(
        () => engine.evaluateTrigger("user1", "invalid_trigger", {}),
        (err) => err.message.includes("trigger") || err.message.includes("Trigger") || err.message.includes("Invalid")
      );
    });
  });

  describe("createInitiative", () => {
    it("validates empty message", () => {
      assert.throws(
        () => engine.createInitiative("user1", "check_in", ""),
        (err) => err.message.includes("message") || err.message.includes("Message") || err.message.includes("required")
      );
    });
  });

  describe("checkRateLimits", () => {
    it("returns rate limit status", () => {
      const result = engine.checkRateLimits("user1");
      assert.ok(result);
      assert.equal(typeof result.allowed, "boolean");
    });
  });

  describe("getBackoff", () => {
    it("returns backoff state for user", () => {
      const result = engine.getBackoff("user1");
      assert.ok(result);
      assert.ok("ignoredCount" in result || "ignored_count" in result);
    });
  });

  describe("learnStyle", () => {
    it("learns from a user message", () => {
      const result = engine.learnStyle("user1", "Hey! What's up? I was wondering about the project.");
      assert.ok(result);
    });

    it("validates empty message", () => {
      assert.throws(
        () => engine.learnStyle("user1", ""),
        (err) => err.message.includes("message") || err.message.includes("Message") || err.message.includes("required")
      );
    });
  });

  describe("getStyleProfile", () => {
    it("returns style profile for user", () => {
      const profile = engine.getStyleProfile("user1");
      assert.ok(profile);
    });
  });

  describe("adaptMessage", () => {
    it("adapts a message", () => {
      const result = engine.adaptMessage("user1", "I found something interesting.");
      assert.ok(result);
      // May return string or object with adapted message
      if (typeof result === "object") {
        assert.ok(result.adapted || result.original || result.message);
      } else {
        assert.equal(typeof result, "string");
      }
    });
  });

  describe("getHistory", () => {
    it("returns history", () => {
      const history = engine.getHistory("user1", { limit: 10 });
      assert.ok(history);
      // May be array or object with initiatives array
      if (Array.isArray(history)) {
        assert.ok(true);
      } else {
        assert.ok(Array.isArray(history.initiatives));
      }
    });
  });

  describe("getPending", () => {
    it("returns pending initiatives", () => {
      const pending = engine.getPending("user1");
      assert.ok(pending);
      if (Array.isArray(pending)) {
        assert.ok(true);
      } else {
        assert.ok(Array.isArray(pending.initiatives));
      }
    });
  });

  describe("getStats", () => {
    it("returns statistics", () => {
      const stats = engine.getStats();
      assert.ok(stats);
      assert.equal(typeof stats.total, "number");
    });
  });

  describe("trigger types", () => {
    it("supports expected trigger types", () => {
      const types = engine.TRIGGER_TYPES;
      assert.ok(Array.isArray(types));
      assert.ok(types.length >= 7);
      assert.ok(types.includes("check_in"));
    });
  });
});
