import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  initCanonicalRegistry,
  createCanonicalStore,
} from "../lib/canonical-registry.js";

describe("canonical-registry", () => {
  let db;
  let store;

  beforeEach(() => {
    db = new Database(":memory:");
    initCanonicalRegistry(db);
    store = createCanonicalStore(db, null);
  });

  // ── initCanonicalRegistry ──────────────────────────────────────────

  describe("initCanonicalRegistry", () => {
    it("creates canonical_registry table", () => {
      const freshDb = new Database(":memory:");
      const result = initCanonicalRegistry(freshDb);
      assert.equal(result, true);

      const tables = freshDb
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='canonical_registry'"
        )
        .all();
      assert.equal(tables.length, 1);
    });

    it("returns false when db is null", () => {
      const result = initCanonicalRegistry(null);
      assert.equal(result, false);
    });

    it("is idempotent — safe to call multiple times", () => {
      const freshDb = new Database(":memory:");
      assert.equal(initCanonicalRegistry(freshDb), true);
      assert.equal(initCanonicalRegistry(freshDb), true);
    });
  });

  // ── computeHash ────────────────────────────────────────────────────

  describe("computeHash", () => {
    it("returns a 64-char hex SHA-256 hash", () => {
      const hash = store.computeHash("hello world");
      assert.equal(typeof hash, "string");
      assert.equal(hash.length, 64);
      assert.match(hash, /^[a-f0-9]{64}$/);
    });

    it("produces deterministic output for the same content", () => {
      const h1 = store.computeHash("test content");
      const h2 = store.computeHash("test content");
      assert.equal(h1, h2);
    });

    it("produces different hashes for different content", () => {
      const h1 = store.computeHash("content A");
      const h2 = store.computeHash("content B");
      assert.notEqual(h1, h2);
    });

    it("normalizes whitespace before hashing", () => {
      const h1 = store.computeHash("hello   world");
      const h2 = store.computeHash("hello world");
      assert.equal(h1, h2);
    });

    it("handles object content by sorting keys", () => {
      const h1 = store.computeHash({ b: 2, a: 1 });
      const h2 = store.computeHash({ a: 1, b: 2 });
      assert.equal(h1, h2);
    });
  });

  // ── normalizeContent ───────────────────────────────────────────────

  describe("normalizeContent", () => {
    it("returns empty string for null", () => {
      assert.equal(store.normalizeContent(null), "");
    });

    it("returns empty string for undefined", () => {
      assert.equal(store.normalizeContent(undefined), "");
    });

    it("collapses horizontal whitespace", () => {
      const result = store.normalizeContent("hello    world");
      assert.equal(result, "hello world");
    });

    it("normalizes Windows line endings", () => {
      const result = store.normalizeContent("line1\r\nline2");
      assert.equal(result, "line1\nline2");
    });

    it("normalizes old Mac line endings", () => {
      const result = store.normalizeContent("line1\rline2");
      assert.equal(result, "line1\nline2");
    });

    it("trims leading and trailing whitespace", () => {
      const result = store.normalizeContent("  hello  ");
      assert.equal(result, "hello");
    });

    it("handles Unicode content", () => {
      const result = store.normalizeContent("  \u00E9\u00E8\u00EA  ");
      assert.equal(result, "\u00E9\u00E8\u00EA");
    });

    it("handles content with null bytes", () => {
      const result = store.normalizeContent("hello\0world");
      assert.equal(typeof result, "string");
      assert.ok(result.length > 0);
    });
  });

  // ── register ───────────────────────────────────────────────────────

  describe("register", () => {
    it("registers new content and returns isNew=true", () => {
      const result = store.register("brand new content", {
        dtuId: "dtu_test1",
      });
      assert.equal(result.isNew, true);
      assert.equal(result.canonicalDtuId, "dtu_test1");
      assert.equal(result.referenceCount, 1);
      assert.ok(result.contentHash);
    });

    it("returns isNew=false for duplicate content", () => {
      const first = store.register("duplicate me", { dtuId: "dtu_first" });
      const second = store.register("duplicate me", { dtuId: "dtu_second" });

      assert.equal(first.isNew, true);
      assert.equal(second.isNew, false);
      assert.equal(second.canonicalDtuId, "dtu_first");
      assert.equal(second.referenceCount, 2);
    });

    it("generates a dtuId if not provided", () => {
      const result = store.register("auto id content", {});
      assert.ok(result.canonicalDtuId);
      assert.ok(result.canonicalDtuId.startsWith("dtu_"));
    });

    it("registers empty content", () => {
      const result = store.register("", {});
      assert.equal(result.isNew, true);
      assert.ok(result.contentHash);
    });

    it("handles very large content", () => {
      const large = "x".repeat(100_000);
      const result = store.register(large, {});
      assert.equal(result.isNew, true);
      assert.ok(result.contentHash);
    });

    it("handles object content", () => {
      const result = store.register({ key: "value", nested: { a: 1 } }, {});
      assert.equal(result.isNew, true);
      assert.ok(result.contentHash);
    });
  });

  // ── lookupByHash ───────────────────────────────────────────────────

  describe("lookupByHash", () => {
    it("returns entry for a known hash", () => {
      const reg = store.register("lookup test", { dtuId: "dtu_lookup" });
      const entry = store.lookupByHash(reg.contentHash);
      assert.ok(entry);
      assert.equal(entry.canonicalDtuId, "dtu_lookup");
      assert.equal(entry.referenceCount, 1);
      assert.ok(entry.createdAt);
    });

    it("returns null for an unknown hash", () => {
      const entry = store.lookupByHash("0".repeat(64));
      assert.equal(entry, null);
    });
  });

  // ── addReference / removeReference ─────────────────────────────────

  describe("addReference / removeReference", () => {
    it("increments reference count", () => {
      const reg = store.register("ref content", { dtuId: "dtu_ref" });
      const added = store.addReference(reg.contentHash);
      assert.equal(added, true);

      const entry = store.lookupByHash(reg.contentHash);
      assert.equal(entry.referenceCount, 2);
    });

    it("decrements reference count", () => {
      const reg = store.register("ref content", { dtuId: "dtu_ref2" });
      store.addReference(reg.contentHash);
      const removed = store.removeReference(reg.contentHash);
      assert.equal(removed, true);

      const entry = store.lookupByHash(reg.contentHash);
      assert.equal(entry.referenceCount, 1);
    });

    it("does not decrement below 0", () => {
      const reg = store.register("singleton", { dtuId: "dtu_single" });
      store.removeReference(reg.contentHash);
      const entry = store.lookupByHash(reg.contentHash);
      assert.equal(entry.referenceCount, 0);

      // Try to remove again — should not go negative
      store.removeReference(reg.contentHash);
      const entry2 = store.lookupByHash(reg.contentHash);
      assert.equal(entry2.referenceCount, 0);
    });

    it("returns false for unknown hash", () => {
      assert.equal(store.addReference("nonexistent_hash"), false);
      assert.equal(store.removeReference("nonexistent_hash"), false);
    });
  });

  // ── getStats ───────────────────────────────────────────────────────

  describe("getStats", () => {
    it("returns zeroes when no content registered", () => {
      const stats = store.getStats();
      assert.equal(stats.totalCanonicals, 0);
      assert.equal(stats.totalReferences, 0);
      assert.equal(stats.duplicatesPrevented, 0);
    });

    it("tracks canonicals and duplicates", () => {
      store.register("content A", { dtuId: "dtu_a" });
      store.register("content B", { dtuId: "dtu_b" });
      store.register("content A", { dtuId: "dtu_a_dup" }); // duplicate

      const stats = store.getStats();
      assert.equal(stats.totalCanonicals, 2);
      assert.equal(stats.totalReferences, 3);
      assert.equal(stats.duplicatesPrevented, 1);
      assert.equal(stats.maxReferences, 2);
    });

    it("reports dedupRatio correctly", () => {
      store.register("only one", { dtuId: "dtu_only" });
      const stats = store.getStats();
      assert.equal(stats.dedupRatio, 1.0);
    });
  });

  // ── lookupByDtuId ──────────────────────────────────────────────────

  describe("lookupByDtuId", () => {
    it("returns entry for a known DTU ID", () => {
      store.register("dtu id test", { dtuId: "dtu_byid" });
      const entry = store.lookupByDtuId("dtu_byid");
      assert.ok(entry);
      assert.equal(entry.canonicalDtuId, "dtu_byid");
    });

    it("returns null for unknown DTU ID", () => {
      const entry = store.lookupByDtuId("dtu_nonexistent");
      assert.equal(entry, null);
    });
  });

  // ── updateCompression ──────────────────────────────────────────────

  describe("updateCompression", () => {
    it("updates compressed size and ratio", () => {
      const reg = store.register("compressible content here", {
        dtuId: "dtu_comp",
      });
      const updated = store.updateCompression(reg.contentHash, 10);
      assert.equal(updated, true);

      const entry = store.lookupByHash(reg.contentHash);
      assert.equal(entry.compressedSize, 10);
      assert.ok(entry.compressionRatio < 1);
    });

    it("returns false for unknown hash", () => {
      assert.equal(store.updateCompression("nonexistent", 10), false);
    });
  });

  // ── deleteEntry ────────────────────────────────────────────────────

  describe("deleteEntry", () => {
    it("removes a canonical entry", () => {
      const reg = store.register("delete me", { dtuId: "dtu_del" });
      const deleted = store.deleteEntry(reg.contentHash);
      assert.equal(deleted, true);
      assert.equal(store.lookupByHash(reg.contentHash), null);
    });

    it("returns false for non-existent entry", () => {
      assert.equal(store.deleteEntry("nope"), false);
    });
  });

  // ── No DB fallback ─────────────────────────────────────────────────

  describe("no database fallback", () => {
    it("register returns a result even without db", () => {
      const noDB = createCanonicalStore(null, null);
      const result = noDB.register("some content", { dtuId: "dtu_nodb" });
      assert.ok(result.contentHash);
      assert.equal(result.isNew, true);
    });

    it("lookupByHash returns null without db", () => {
      const noDB = createCanonicalStore(null, null);
      assert.equal(noDB.lookupByHash("abc"), null);
    });

    it("getStats returns zeroes without db", () => {
      const noDB = createCanonicalStore(null, null);
      const stats = noDB.getStats();
      assert.equal(stats.totalCanonicals, 0);
    });
  });
});
