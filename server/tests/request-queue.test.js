/**
 * Comprehensive tests for server/requestQueue.js
 * Covers: PRIORITIES, BrainQueue (constructor, setCallFn, enqueue, _drain, getStats),
 *         queues map, getQueueStats
 */
import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { BrainQueue, queues, PRIORITIES, getQueueStats } from "../requestQueue.js";

describe("requestQueue", () => {
  // ── PRIORITIES constant ──────────────────────────────────────
  describe("PRIORITIES", () => {
    it("defines all expected priority levels", () => {
      assert.equal(PRIORITIES.GOVERNANCE, 1);
      assert.equal(PRIORITIES.RETURNING_USER_CHAT, 2);
      assert.equal(PRIORITIES.NEW_USER_CHAT, 3);
      assert.equal(PRIORITIES.UTILITY_INTERACTIVE, 4);
      assert.equal(PRIORITIES.UTILITY_BACKGROUND, 5);
      assert.equal(PRIORITIES.ENTITY_EXPLORE, 6);
      assert.equal(PRIORITIES.PRECOMPUTE, 7);
      assert.equal(PRIORITIES.HEARTBEAT, 8);
      assert.equal(PRIORITIES.BACKFILL, 9);
    });

    it("has lower numbers for higher priority", () => {
      assert.ok(PRIORITIES.GOVERNANCE < PRIORITIES.BACKFILL);
      assert.ok(PRIORITIES.RETURNING_USER_CHAT < PRIORITIES.HEARTBEAT);
    });
  });

  // ── BrainQueue constructor ───────────────────────────────────
  describe("BrainQueue constructor", () => {
    it("initializes with defaults", () => {
      const q = new BrainQueue("test_brain");
      assert.equal(q.brain, "test_brain");
      assert.equal(q.concurrency, 1);
      assert.equal(q.active, 0);
      assert.deepStrictEqual(q.queue, []);
      assert.equal(q._callBrainDirect, null);
    });

    it("accepts custom concurrency", () => {
      const q = new BrainQueue("test", 5);
      assert.equal(q.concurrency, 5);
    });
  });

  // ── setCallFn ────────────────────────────────────────────────
  describe("setCallFn()", () => {
    it("stores the call function", () => {
      const q = new BrainQueue("test");
      const fn = mock.fn();
      q.setCallFn(fn);
      assert.equal(q._callBrainDirect, fn);
    });
  });

  // ── enqueue + _drain ─────────────────────────────────────────
  describe("enqueue()", () => {
    it("resolves with brain result on success", async () => {
      const q = new BrainQueue("conscious", 1);
      const callFn = mock.fn(async (brain, prompt, opts) => ({ ok: true, content: "response" }));
      q.setCallFn(callFn);

      const result = await q.enqueue("hello", {}, 5);
      assert.deepStrictEqual(result, { ok: true, content: "response" });
      assert.equal(callFn.mock.calls.length, 1);
      assert.equal(callFn.mock.calls[0].arguments[0], "conscious");
      assert.equal(callFn.mock.calls[0].arguments[1], "hello");
    });

    it("rejects when no call function is set", async () => {
      const q = new BrainQueue("conscious");
      await assert.rejects(
        () => q.enqueue("hello"),
        (err) => {
          assert.ok(err.message.includes("No call function set"));
          assert.ok(err.message.includes("conscious"));
          return true;
        }
      );
    });

    it("rejects when brain call throws", async () => {
      const q = new BrainQueue("utility");
      q.setCallFn(mock.fn(async () => { throw new Error("timeout"); }));

      await assert.rejects(
        () => q.enqueue("test"),
        { message: "timeout" }
      );
    });

    it("processes entries in priority order", async () => {
      const order = [];
      const q = new BrainQueue("test", 1);

      // Block the first call so subsequent ones queue up
      let unblock;
      const blocker = new Promise(resolve => { unblock = resolve; });

      q.setCallFn(mock.fn(async (brain, prompt) => {
        if (prompt === "blocker") {
          await blocker;
        }
        order.push(prompt);
        return { ok: true };
      }));

      // First call blocks the queue
      const p1 = q.enqueue("blocker", {}, 5);

      // Queue up tasks with different priorities
      const p3 = q.enqueue("low-priority", {}, 9);
      const p2 = q.enqueue("high-priority", {}, 1);

      // Release the blocker
      unblock();
      await Promise.all([p1, p2, p3]);

      assert.equal(order[0], "blocker");
      assert.equal(order[1], "high-priority");
      assert.equal(order[2], "low-priority");
    });

    it("inserts at end when all existing entries have equal or lower priority number", async () => {
      const q = new BrainQueue("test", 1);
      let unblock;
      const blocker = new Promise(resolve => { unblock = resolve; });

      const order = [];
      q.setCallFn(mock.fn(async (brain, prompt) => {
        if (prompt === "block") await blocker;
        order.push(prompt);
        return { ok: true };
      }));

      const p0 = q.enqueue("block", {}, 1);
      const p1 = q.enqueue("a", {}, 3);
      const p2 = q.enqueue("b", {}, 5);
      const p3 = q.enqueue("c", {}, 5); // same priority, appended after b

      unblock();
      await Promise.all([p0, p1, p2, p3]);

      assert.deepStrictEqual(order, ["block", "a", "b", "c"]);
    });

    it("respects concurrency limit", async () => {
      const q = new BrainQueue("test", 2);
      let concurrent = 0;
      let maxConcurrent = 0;

      q.setCallFn(mock.fn(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(r => { setTimeout(r, 10); });
        concurrent--;
        return { ok: true };
      }));

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(q.enqueue(`task-${i}`, {}, 5));
      }
      await Promise.all(promises);

      assert.ok(maxConcurrent <= 2, `max concurrent was ${maxConcurrent}, expected <= 2`);
    });

    it("uses default priority of 5", async () => {
      const q = new BrainQueue("test", 1);
      q.setCallFn(mock.fn(async () => ({ ok: true })));

      // Should not throw; default priority works
      await q.enqueue("test");
    });
  });

  // ── getStats() ───────────────────────────────────────────────
  describe("getStats()", () => {
    it("returns zeros for empty queue", () => {
      const q = new BrainQueue("test");
      const stats = q.getStats();
      assert.equal(stats.active, 0);
      assert.equal(stats.queued, 0);
      assert.equal(stats.avgWait, 0);
    });

    it("reflects pending entries", async () => {
      const q = new BrainQueue("test", 1);
      let unblock;
      const blocker = new Promise(resolve => { unblock = resolve; });

      q.setCallFn(mock.fn(async (brain, prompt) => {
        if (prompt === "block") await blocker;
        return { ok: true };
      }));

      // Start blocking task
      const p1 = q.enqueue("block", {}, 5);
      // Queue up more
      const p2 = q.enqueue("waiting1", {}, 5);
      const p3 = q.enqueue("waiting2", {}, 5);

      // Give async time to start processing
      await new Promise(r => { setTimeout(r, 5); });

      const stats = q.getStats();
      assert.equal(stats.active, 1);
      assert.equal(stats.queued, 2);
      assert.ok(stats.avgWait >= 0);

      unblock();
      await Promise.all([p1, p2, p3]);
    });
  });

  // ── Pre-built queues ─────────────────────────────────────────
  describe("queues map", () => {
    it("contains conscious, subconscious, utility queues", () => {
      assert.ok(queues.conscious instanceof BrainQueue);
      assert.ok(queues.subconscious instanceof BrainQueue);
      assert.ok(queues.utility instanceof BrainQueue);
    });

    it("conscious has concurrency 2", () => {
      assert.equal(queues.conscious.concurrency, 2);
    });

    it("subconscious has concurrency 3", () => {
      assert.equal(queues.subconscious.concurrency, 3);
    });

    it("utility has concurrency 4", () => {
      assert.equal(queues.utility.concurrency, 4);
    });
  });

  // ── getQueueStats() ──────────────────────────────────────────
  describe("getQueueStats()", () => {
    it("returns stats for all three queues", () => {
      const stats = getQueueStats();
      assert.ok("conscious" in stats);
      assert.ok("subconscious" in stats);
      assert.ok("utility" in stats);

      for (const name of ["conscious", "subconscious", "utility"]) {
        assert.equal(typeof stats[name].active, "number");
        assert.equal(typeof stats[name].queued, "number");
        assert.equal(typeof stats[name].avgWait, "number");
      }
    });
  });
});
