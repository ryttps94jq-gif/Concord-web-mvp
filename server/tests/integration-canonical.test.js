/**
 * Integration Test: Canonical DTU Registry
 *
 * Full lifecycle integration test covering:
 * - Create DTU -> register canonical -> verify content hash
 * - Create duplicate DTU -> resolves to same canonical
 * - Verify integrity on created DTU
 * - Compress DTU content -> decompress -> verify roundtrip
 * - Assign rights -> check permissions -> transfer ownership
 * - Full chain: create -> register -> verify -> compress -> assign rights -> query
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { randomUUID } from "crypto";
import { gzipSync, gunzipSync } from "zlib";

// ── Mock DTU Store ───────────────────────────────────────────────────────

function createMockDTUStore() {
  const store = new Map();

  function createDTU(data) {
    const id = data.id || `dtu-${randomUUID()}`;
    const dtu = {
      id,
      title: data.title || "Untitled",
      body: data.body || "",
      tags: data.tags || [],
      scope: data.scope || "local",
      ownerId: data.ownerId || "anonymous",
      parentId: data.parentId || null,
      tier: data.tier || "base",
      createdAt: new Date().toISOString(),
    };
    store.set(id, dtu);
    return dtu;
  }

  function getDTU(id) {
    return store.get(id) || null;
  }

  function updateDTU(id, updates) {
    const dtu = store.get(id);
    if (!dtu) return null;
    Object.assign(dtu, updates, { updatedAt: new Date().toISOString() });
    return dtu;
  }

  function deleteDTU(id) {
    return store.delete(id);
  }

  return { store, createDTU, getDTU, updateDTU, deleteDTU };
}

// ── Mock Canonical Registry ──────────────────────────────────────────────

function createMockCanonicalStore() {
  const registry = new Map();

  function normalizeContent(content) {
    if (content === null || content === undefined) return "";
    let str = typeof content === "object"
      ? JSON.stringify(content, Object.keys(content).sort())
      : String(content);
    return str
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();
  }

  function computeHash(content) {
    const normalized = normalizeContent(content);
    return createHash("sha256").update(normalized, "utf8").digest("hex");
  }

  function register(content, metadata = {}) {
    const contentHash = computeHash(content);
    const normalized = normalizeContent(content);
    const contentSize = Buffer.byteLength(normalized, "utf8");
    const compressedSize = metadata.compressedSize || contentSize;
    const compressionRatio = contentSize > 0 ? compressedSize / contentSize : 1.0;

    const existing = registry.get(contentHash);
    if (existing) {
      existing.referenceCount++;
      return {
        isNew: false,
        contentHash,
        canonicalDtuId: existing.canonicalDtuId,
        referenceCount: existing.referenceCount,
      };
    }

    const dtuId = metadata.dtuId || `dtu-${randomUUID()}`;
    const entry = {
      contentHash,
      canonicalDtuId: dtuId,
      referenceCount: 1,
      contentSize,
      compressedSize,
      compressionRatio,
      createdAt: new Date().toISOString(),
    };
    registry.set(contentHash, entry);

    return {
      isNew: true,
      contentHash,
      canonicalDtuId: dtuId,
      referenceCount: 1,
    };
  }

  function lookupByHash(hash) {
    return registry.get(hash) || null;
  }

  function lookupByDtuId(dtuId) {
    for (const entry of registry.values()) {
      if (entry.canonicalDtuId === dtuId) return entry;
    }
    return null;
  }

  function updateCompression(hash, compressedSize) {
    const entry = registry.get(hash);
    if (!entry) return false;
    entry.compressedSize = compressedSize;
    entry.compressionRatio = entry.contentSize > 0 ? compressedSize / entry.contentSize : 1.0;
    return true;
  }

  function getStats() {
    let totalCanonicals = 0;
    let totalReferences = 0;
    let totalContentSize = 0;
    let totalCompressedSize = 0;

    for (const entry of registry.values()) {
      totalCanonicals++;
      totalReferences += entry.referenceCount;
      totalContentSize += entry.contentSize;
      totalCompressedSize += entry.compressedSize;
    }

    return {
      totalCanonicals,
      totalReferences,
      duplicatesPrevented: totalReferences - totalCanonicals,
      totalContentSize,
      totalCompressedSize,
      avgCompressionRatio: totalCanonicals > 0 ? totalCompressedSize / totalContentSize : 1.0,
    };
  }

  return {
    register,
    lookupByHash,
    lookupByDtuId,
    updateCompression,
    computeHash,
    normalizeContent,
    getStats,
    registry,
  };
}

// ── Mock Rights Manager ──────────────────────────────────────────────────

function createMockRightsManager() {
  const rights = new Map(); // dtuId -> { ownerId, permissions: Map<userId, Set<perm>> }

  function assignRights(dtuId, ownerId) {
    rights.set(dtuId, {
      ownerId,
      permissions: new Map([[ownerId, new Set(["read", "write", "delete", "transfer"])]]),
    });
    return { ok: true, dtuId, ownerId };
  }

  function grantPermission(dtuId, granterId, granteeId, permission) {
    const entry = rights.get(dtuId);
    if (!entry) return { ok: false, error: "DTU not found" };
    if (entry.ownerId !== granterId) return { ok: false, error: "Only owner can grant" };

    if (!entry.permissions.has(granteeId)) {
      entry.permissions.set(granteeId, new Set());
    }
    entry.permissions.get(granteeId).add(permission);
    return { ok: true, dtuId, granteeId, permission };
  }

  function checkPermission(dtuId, userId, permission) {
    const entry = rights.get(dtuId);
    if (!entry) return false;
    const userPerms = entry.permissions.get(userId);
    if (!userPerms) return false;
    return userPerms.has(permission);
  }

  function transferOwnership(dtuId, currentOwnerId, newOwnerId) {
    const entry = rights.get(dtuId);
    if (!entry) return { ok: false, error: "DTU not found" };
    if (entry.ownerId !== currentOwnerId) return { ok: false, error: "Only owner can transfer" };

    entry.ownerId = newOwnerId;
    if (!entry.permissions.has(newOwnerId)) {
      entry.permissions.set(newOwnerId, new Set());
    }
    entry.permissions.get(newOwnerId).add("read");
    entry.permissions.get(newOwnerId).add("write");
    entry.permissions.get(newOwnerId).add("delete");
    entry.permissions.get(newOwnerId).add("transfer");

    return { ok: true, dtuId, newOwnerId };
  }

  function getOwner(dtuId) {
    const entry = rights.get(dtuId);
    return entry ? entry.ownerId : null;
  }

  return { assignRights, grantPermission, checkPermission, transferOwnership, getOwner };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("Integration: Canonical DTU Lifecycle", () => {
  let dtuStore;
  let canonicalStore;
  let rightsManager;

  beforeEach(() => {
    dtuStore = createMockDTUStore();
    canonicalStore = createMockCanonicalStore();
    rightsManager = createMockRightsManager();
  });

  // ── Create DTU -> Register Canonical -> Verify Content Hash ──────

  it("create DTU and register canonical produces correct content hash", () => {
    const dtu = dtuStore.createDTU({
      title: "Quantum Computing Primer",
      body: "Quantum computers use qubits to perform parallel computations.",
      ownerId: "user-1",
    });

    const result = canonicalStore.register(dtu.body, { dtuId: dtu.id });

    assert.ok(result.isNew, "First registration should be new");
    assert.equal(result.canonicalDtuId, dtu.id);
    assert.equal(result.referenceCount, 1);
    assert.ok(result.contentHash.length === 64, "SHA-256 hash should be 64 hex chars");

    // Verify hash manually
    const expectedHash = canonicalStore.computeHash(dtu.body);
    assert.equal(result.contentHash, expectedHash);
  });

  // ── Create Duplicate DTU -> Resolves to Same Canonical ──────

  it("duplicate DTU content resolves to same canonical ID", () => {
    const dtu1 = dtuStore.createDTU({
      title: "First DTU",
      body: "This is the original content.",
      ownerId: "user-1",
    });

    const result1 = canonicalStore.register(dtu1.body, { dtuId: dtu1.id });
    assert.ok(result1.isNew);

    // Create a second DTU with the same content
    const dtu2 = dtuStore.createDTU({
      title: "Duplicate DTU",
      body: "This is the original content.",
      ownerId: "user-2",
    });

    const result2 = canonicalStore.register(dtu2.body, { dtuId: dtu2.id });

    assert.ok(!result2.isNew, "Duplicate should not be new");
    assert.equal(result2.canonicalDtuId, dtu1.id, "Should resolve to first DTU's canonical ID");
    assert.equal(result2.referenceCount, 2, "Reference count should be incremented");
  });

  it("whitespace-normalized duplicates resolve to same canonical", () => {
    const body1 = "Hello   world.\n\nThis is   a test.";
    const body2 = "Hello world.\nThis is a test.";

    const result1 = canonicalStore.register(body1, { dtuId: "dtu-a" });
    const result2 = canonicalStore.register(body2, { dtuId: "dtu-b" });

    assert.equal(result1.contentHash, result2.contentHash, "Normalized content should produce same hash");
    assert.equal(result2.canonicalDtuId, "dtu-a", "Duplicate resolves to first canonical");
  });

  // ── Verify Integrity on Created DTU ──────

  it("verify integrity on a registered DTU", () => {
    const content = "Verifiable content for integrity check.";
    const dtu = dtuStore.createDTU({
      title: "Integrity Test",
      body: content,
      ownerId: "user-1",
    });

    canonicalStore.register(content, { dtuId: dtu.id });

    // Verify by re-computing hash and looking it up
    const hash = canonicalStore.computeHash(content);
    const entry = canonicalStore.lookupByHash(hash);

    assert.ok(entry, "Canonical entry should exist");
    assert.equal(entry.canonicalDtuId, dtu.id);
    assert.equal(entry.referenceCount, 1);

    // Also verify by DTU ID
    const byDtu = canonicalStore.lookupByDtuId(dtu.id);
    assert.ok(byDtu, "Should be findable by DTU ID");
    assert.equal(byDtu.contentHash, hash);
  });

  it("integrity check fails for tampered content", () => {
    const content = "Original untampered content.";
    const dtu = dtuStore.createDTU({
      title: "Tamper Test",
      body: content,
      ownerId: "user-1",
    });

    canonicalStore.register(content, { dtuId: dtu.id });

    // Compute hash of tampered content
    const tamperedHash = canonicalStore.computeHash("Tampered content here.");
    const entry = canonicalStore.lookupByHash(tamperedHash);

    assert.equal(entry, null, "Tampered content should not match any canonical");
  });

  // ── Compress -> Decompress -> Verify Roundtrip ──────

  it("compress DTU content and decompress with verified roundtrip", () => {
    const content = "A".repeat(10000); // Compressible content
    const dtu = dtuStore.createDTU({
      title: "Compression Test",
      body: content,
      ownerId: "user-1",
    });

    const result = canonicalStore.register(content, { dtuId: dtu.id });
    const originalHash = result.contentHash;

    // Compress content
    const compressed = gzipSync(Buffer.from(content, "utf8"));
    const compressedSize = compressed.length;
    const originalSize = Buffer.byteLength(content, "utf8");

    // Verify compression achieved savings
    assert.ok(compressedSize < originalSize, "Compressed size should be smaller");

    // Update compression stats in registry
    canonicalStore.updateCompression(originalHash, compressedSize);

    const entry = canonicalStore.lookupByHash(originalHash);
    assert.equal(entry.compressedSize, compressedSize);
    assert.ok(entry.compressionRatio < 1.0, "Compression ratio should be < 1.0 for savings");

    // Decompress and verify roundtrip
    const decompressed = gunzipSync(compressed).toString("utf8");
    assert.equal(decompressed, content, "Decompressed content should match original");

    // Verify hash is preserved after roundtrip
    const roundtripHash = canonicalStore.computeHash(decompressed);
    assert.equal(roundtripHash, originalHash, "Hash should be preserved after compress/decompress");
  });

  // ── Assign Rights -> Check Permissions -> Transfer Ownership ──────

  it("assign rights and check permissions on DTU", () => {
    const dtu = dtuStore.createDTU({
      title: "Rights Test",
      body: "Content with rights management.",
      ownerId: "user-1",
    });

    // Assign rights to owner
    const assignResult = rightsManager.assignRights(dtu.id, "user-1");
    assert.ok(assignResult.ok);
    assert.equal(assignResult.ownerId, "user-1");

    // Owner should have all permissions
    assert.ok(rightsManager.checkPermission(dtu.id, "user-1", "read"));
    assert.ok(rightsManager.checkPermission(dtu.id, "user-1", "write"));
    assert.ok(rightsManager.checkPermission(dtu.id, "user-1", "delete"));
    assert.ok(rightsManager.checkPermission(dtu.id, "user-1", "transfer"));

    // Non-owner should not have permissions
    assert.ok(!rightsManager.checkPermission(dtu.id, "user-2", "read"));
    assert.ok(!rightsManager.checkPermission(dtu.id, "user-2", "write"));
  });

  it("grant read permission to another user", () => {
    const dtu = dtuStore.createDTU({
      title: "Grant Test",
      body: "Content for sharing.",
      ownerId: "user-1",
    });

    rightsManager.assignRights(dtu.id, "user-1");

    // Grant read permission to user-2
    const grantResult = rightsManager.grantPermission(dtu.id, "user-1", "user-2", "read");
    assert.ok(grantResult.ok);

    // user-2 can now read
    assert.ok(rightsManager.checkPermission(dtu.id, "user-2", "read"));
    // But still cannot write
    assert.ok(!rightsManager.checkPermission(dtu.id, "user-2", "write"));
  });

  it("non-owner cannot grant permissions", () => {
    const dtu = dtuStore.createDTU({
      title: "Permission Denial Test",
      body: "Content.",
      ownerId: "user-1",
    });

    rightsManager.assignRights(dtu.id, "user-1");

    // user-2 tries to grant permissions
    const result = rightsManager.grantPermission(dtu.id, "user-2", "user-3", "read");
    assert.ok(!result.ok);
    assert.equal(result.error, "Only owner can grant");
  });

  it("transfer ownership updates permissions correctly", () => {
    const dtu = dtuStore.createDTU({
      title: "Transfer Test",
      body: "Content to transfer.",
      ownerId: "user-1",
    });

    rightsManager.assignRights(dtu.id, "user-1");

    // Transfer ownership to user-2
    const transferResult = rightsManager.transferOwnership(dtu.id, "user-1", "user-2");
    assert.ok(transferResult.ok);
    assert.equal(transferResult.newOwnerId, "user-2");

    // user-2 should now be the owner
    assert.equal(rightsManager.getOwner(dtu.id), "user-2");

    // user-2 should have full permissions
    assert.ok(rightsManager.checkPermission(dtu.id, "user-2", "read"));
    assert.ok(rightsManager.checkPermission(dtu.id, "user-2", "write"));
    assert.ok(rightsManager.checkPermission(dtu.id, "user-2", "delete"));
    assert.ok(rightsManager.checkPermission(dtu.id, "user-2", "transfer"));
  });

  it("non-owner cannot transfer ownership", () => {
    const dtu = dtuStore.createDTU({
      title: "Unauthorized Transfer",
      body: "Content.",
      ownerId: "user-1",
    });

    rightsManager.assignRights(dtu.id, "user-1");

    const result = rightsManager.transferOwnership(dtu.id, "user-2", "user-3");
    assert.ok(!result.ok);
    assert.equal(result.error, "Only owner can transfer");
  });

  // ── Full Chain: create -> register -> verify -> compress -> rights -> query ──

  it("full lifecycle chain: create → register → verify → compress → rights → query", () => {
    const content = "Complete lifecycle content for integration testing. ".repeat(50);

    // Step 1: Create DTU
    const dtu = dtuStore.createDTU({
      title: "Full Lifecycle DTU",
      body: content,
      ownerId: "user-1",
    });
    assert.ok(dtu.id);

    // Step 2: Register canonical
    const registerResult = canonicalStore.register(content, { dtuId: dtu.id });
    assert.ok(registerResult.isNew);
    assert.equal(registerResult.canonicalDtuId, dtu.id);

    // Step 3: Verify content hash
    const hash = canonicalStore.computeHash(content);
    const entry = canonicalStore.lookupByHash(hash);
    assert.ok(entry);
    assert.equal(entry.canonicalDtuId, dtu.id);

    // Step 4: Compress and verify roundtrip
    const compressed = gzipSync(Buffer.from(content, "utf8"));
    canonicalStore.updateCompression(hash, compressed.length);

    const updatedEntry = canonicalStore.lookupByHash(hash);
    assert.ok(updatedEntry.compressionRatio < 1.0);

    const decompressed = gunzipSync(compressed).toString("utf8");
    assert.equal(decompressed, content);
    assert.equal(canonicalStore.computeHash(decompressed), hash);

    // Step 5: Assign rights
    rightsManager.assignRights(dtu.id, "user-1");
    assert.ok(rightsManager.checkPermission(dtu.id, "user-1", "read"));
    assert.ok(rightsManager.checkPermission(dtu.id, "user-1", "write"));

    // Step 6: Transfer ownership
    rightsManager.transferOwnership(dtu.id, "user-1", "user-2");
    assert.equal(rightsManager.getOwner(dtu.id), "user-2");

    // Step 7: Query stats
    const stats = canonicalStore.getStats();
    assert.equal(stats.totalCanonicals, 1);
    assert.equal(stats.totalReferences, 1);
    assert.equal(stats.duplicatesPrevented, 0);

    // Step 8: Register a duplicate
    canonicalStore.register(content, { dtuId: "dtu-duplicate" });
    const statsAfterDup = canonicalStore.getStats();
    assert.equal(statsAfterDup.totalCanonicals, 1);
    assert.equal(statsAfterDup.totalReferences, 2);
    assert.equal(statsAfterDup.duplicatesPrevented, 1);
  });

  it("content hash determinism across multiple computations", () => {
    const content = "Deterministic hash test content.";

    const hash1 = canonicalStore.computeHash(content);
    const hash2 = canonicalStore.computeHash(content);
    const hash3 = canonicalStore.computeHash(content);

    assert.equal(hash1, hash2);
    assert.equal(hash2, hash3);
  });

  it("different content produces different hashes", () => {
    const hash1 = canonicalStore.computeHash("Content A");
    const hash2 = canonicalStore.computeHash("Content B");

    assert.notEqual(hash1, hash2);
  });
});
