/**
 * BoundedMap Test Suite
 *
 * Tests the LRU-evicting bounded Map:
 *   - Constructor with maxSize and name
 *   - set() with LRU eviction when over limit
 *   - get() with LRU position refresh
 *   - stats() monitoring method
 *   - Map inheritance (has, delete, clear, size, iteration)
 *   - Edge cases (maxSize=1, key refresh, eviction count)
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { BoundedMap } from "../lib/bounded-map.js";

// ── Constructor ─────────────────────────────────────────────────────────────

describe("BoundedMap constructor", () => {
  it("creates an instance of Map", () => {
    const bm = new BoundedMap();
    assert.ok(bm instanceof Map);
    assert.ok(bm instanceof BoundedMap);
  });

  it("defaults maxSize to 10000", () => {
    const bm = new BoundedMap();
    assert.equal(bm._maxSize, 10000);
  });

  it("defaults name to 'BoundedMap'", () => {
    const bm = new BoundedMap();
    assert.equal(bm._name, "BoundedMap");
  });

  it("accepts custom maxSize and name", () => {
    const bm = new BoundedMap(500, "TestMap");
    assert.equal(bm._maxSize, 500);
    assert.equal(bm._name, "TestMap");
  });

  it("starts with zero size and zero evictions", () => {
    const bm = new BoundedMap(5);
    assert.equal(bm.size, 0);
    assert.equal(bm._evictionCount, 0);
  });
});

// ── set() ───────────────────────────────────────────────────────────────────

describe("BoundedMap set()", () => {
  it("adds entries like a normal Map", () => {
    const bm = new BoundedMap(10);
    bm.set("a", 1);
    bm.set("b", 2);
    assert.equal(bm.size, 2);
  });

  it("returns the BoundedMap instance (chainable)", () => {
    const bm = new BoundedMap(10);
    const result = bm.set("a", 1);
    assert.equal(result, bm);
  });

  it("evicts oldest entry when exceeding maxSize", () => {
    const bm = new BoundedMap(3);
    bm.set("a", 1);
    bm.set("b", 2);
    bm.set("c", 3);
    bm.set("d", 4); // Should evict "a"

    assert.equal(bm.size, 3);
    assert.equal(bm.has("a"), false); // "a" evicted
    assert.ok(bm.has("b"));
    assert.ok(bm.has("c"));
    assert.ok(bm.has("d"));
  });

  it("increments eviction count", () => {
    const bm = new BoundedMap(2);
    bm.set("a", 1);
    bm.set("b", 2);
    bm.set("c", 3); // evicts "a"
    bm.set("d", 4); // evicts "b"

    assert.equal(bm._evictionCount, 2);
  });

  it("refreshes insertion order when key already exists", () => {
    const bm = new BoundedMap(3);
    bm.set("a", 1);
    bm.set("b", 2);
    bm.set("c", 3);

    // Re-set "a" — should move to end, making "b" the oldest
    bm.set("a", 10);
    bm.set("d", 4); // Should evict "b" (now oldest), not "a"

    assert.equal(bm.size, 3);
    assert.equal(bm.has("b"), false); // "b" evicted
    assert.ok(bm.has("a"));
    assert.equal(bm.get("a"), 10); // Updated value
  });

  it("does not evict when at exactly maxSize with existing key", () => {
    const bm = new BoundedMap(3);
    bm.set("a", 1);
    bm.set("b", 2);
    bm.set("c", 3);

    // Re-set existing key — should not evict
    bm.set("b", 20);

    assert.equal(bm.size, 3);
    assert.equal(bm._evictionCount, 0);
    assert.ok(bm.has("a"));
    assert.ok(bm.has("b"));
    assert.ok(bm.has("c"));
  });

  it("handles maxSize=1", () => {
    const bm = new BoundedMap(1);
    bm.set("a", 1);
    assert.equal(bm.size, 1);

    bm.set("b", 2);
    assert.equal(bm.size, 1);
    assert.equal(bm.has("a"), false);
    assert.ok(bm.has("b"));
  });

  it("evicts multiple entries if needed to get under limit", () => {
    // This shouldn't normally happen with single set(), but test the while loop
    const bm = new BoundedMap(5);
    for (let i = 0; i < 5; i++) bm.set(`key${i}`, i);
    assert.equal(bm.size, 5);

    // Now set a new key — only one eviction needed
    bm.set("newkey", 99);
    assert.equal(bm.size, 5);
    assert.equal(bm.has("key0"), false);
  });
});

// ── get() ───────────────────────────────────────────────────────────────────

describe("BoundedMap get()", () => {
  it("returns value for existing key", () => {
    const bm = new BoundedMap(10);
    bm.set("a", 42);
    assert.equal(bm.get("a"), 42);
  });

  it("returns undefined for non-existing key", () => {
    const bm = new BoundedMap(10);
    assert.equal(bm.get("nonexistent"), undefined);
  });

  it("refreshes LRU position on access", () => {
    const bm = new BoundedMap(3);
    bm.set("a", 1);
    bm.set("b", 2);
    bm.set("c", 3);

    // Access "a" to move it to end
    bm.get("a");

    // Now "b" is oldest. Adding new key should evict "b"
    bm.set("d", 4);
    assert.equal(bm.has("b"), false);
    assert.ok(bm.has("a"));
    assert.ok(bm.has("c"));
    assert.ok(bm.has("d"));
  });

  it("does not refresh position for non-existing key", () => {
    const bm = new BoundedMap(3);
    bm.set("a", 1);
    bm.set("b", 2);
    bm.set("c", 3);

    bm.get("nonexistent"); // Should be no-op

    bm.set("d", 4); // Should still evict "a" (oldest)
    assert.equal(bm.has("a"), false);
  });
});

// ── stats() ─────────────────────────────────────────────────────────────────

describe("BoundedMap stats()", () => {
  it("returns correct initial stats", () => {
    const bm = new BoundedMap(100, "MyCache");
    const s = bm.stats();

    assert.equal(s.name, "MyCache");
    assert.equal(s.size, 0);
    assert.equal(s.maxSize, 100);
    assert.equal(s.evictions, 0);
    assert.equal(s.utilization, 0);
  });

  it("reflects current size and evictions", () => {
    const bm = new BoundedMap(3, "SmallCache");
    bm.set("a", 1);
    bm.set("b", 2);
    bm.set("c", 3);
    bm.set("d", 4); // evicts "a"

    const s = bm.stats();
    assert.equal(s.size, 3);
    assert.equal(s.maxSize, 3);
    assert.equal(s.evictions, 1);
    assert.equal(s.utilization, 1); // 3/3 = 1.0
  });

  it("calculates utilization correctly", () => {
    const bm = new BoundedMap(10);
    bm.set("a", 1);
    bm.set("b", 2);
    bm.set("c", 3);

    const s = bm.stats();
    assert.equal(s.utilization, 0.3); // 3/10
  });
});

// ── Map inheritance ─────────────────────────────────────────────────────────

describe("BoundedMap Map inheritance", () => {
  it("has() works correctly", () => {
    const bm = new BoundedMap(10);
    bm.set("x", 1);
    assert.equal(bm.has("x"), true);
    assert.equal(bm.has("y"), false);
  });

  it("delete() works correctly", () => {
    const bm = new BoundedMap(10);
    bm.set("x", 1);
    bm.delete("x");
    assert.equal(bm.has("x"), false);
    assert.equal(bm.size, 0);
  });

  it("clear() works correctly", () => {
    const bm = new BoundedMap(10);
    bm.set("a", 1);
    bm.set("b", 2);
    bm.clear();
    assert.equal(bm.size, 0);
  });

  it("size reflects current entries", () => {
    const bm = new BoundedMap(10);
    assert.equal(bm.size, 0);
    bm.set("a", 1);
    assert.equal(bm.size, 1);
    bm.set("b", 2);
    assert.equal(bm.size, 2);
    bm.delete("a");
    assert.equal(bm.size, 1);
  });

  it("supports for...of iteration", () => {
    const bm = new BoundedMap(10);
    bm.set("a", 1);
    bm.set("b", 2);

    const entries = [];
    for (const [k, v] of bm) {
      entries.push([k, v]);
    }
    assert.equal(entries.length, 2);
  });

  it("supports forEach", () => {
    const bm = new BoundedMap(10);
    bm.set("a", 1);
    bm.set("b", 2);

    const collected = [];
    bm.forEach((v, k) => collected.push(k));
    assert.deepEqual(collected, ["a", "b"]);
  });

  it("supports keys(), values(), entries()", () => {
    const bm = new BoundedMap(10);
    bm.set("x", 10);
    bm.set("y", 20);

    assert.deepEqual([...bm.keys()], ["x", "y"]);
    assert.deepEqual([...bm.values()], [10, 20]);
    assert.deepEqual([...bm.entries()], [["x", 10], ["y", 20]]);
  });

  it("supports spread operator", () => {
    const bm = new BoundedMap(10);
    bm.set("a", 1);
    const arr = [...bm];
    assert.deepEqual(arr, [["a", 1]]);
  });
});

// ── Default export ──────────────────────────────────────────────────────────

describe("BoundedMap default export", () => {
  it("default export is the same class", async () => {
    const mod = await import("../lib/bounded-map.js");
    assert.equal(mod.default, mod.BoundedMap);
  });
});
