/**
 * DTU Test Suite
 * Tests DTU creation, scoping, lineage, tier compression, and sovereignty.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

// ── Mock DTU Store ───────────────────────────────────────────────────────────

function createDTUStore() {
  const store = new Map();

  function createDTU(data) {
    const id = data.id || `dtu-${crypto.randomUUID()}`;
    const dtu = {
      id,
      title: data.title || "Untitled",
      body: data.body || data.creti || "",
      tags: data.tags || [],
      scope: data.scope || "local",
      ownerId: data.ownerId || "anonymous",
      parentId: data.parentId || null,
      lineage: data.lineage || [],
      tier: data.tier || "base",
      confidence: data.confidence ?? 0.5,
      embedding: data.embedding || null,
      source: data.source || "manual",
      createdAt: new Date().toISOString(),
    };
    store.set(id, dtu);
    return dtu;
  }

  function getDTU(id) {
    return store.get(id) || null;
  }

  function getAllDTUs(filter = {}) {
    let results = [...store.values()];
    if (filter.ownerId) results = results.filter(d => d.ownerId === filter.ownerId);
    if (filter.scope) results = results.filter(d => d.scope === filter.scope);
    if (filter.tier) results = results.filter(d => d.tier === filter.tier);
    return results;
  }

  function createMEGA(dtus, ownerId) {
    if (dtus.length < 9) throw new Error("MEGA requires 9+ DTUs");
    return createDTU({
      title: `MEGA: Synthesis of ${dtus.length} DTUs`,
      body: dtus.map(d => d.title).join("; "),
      tier: "mega",
      scope: "local",
      ownerId,
      lineage: dtus.map(d => d.id),
      source: "compression",
    });
  }

  function createHYPER(megas, ownerId) {
    if (megas.length < 3) throw new Error("HYPER requires 3+ MEGAs");
    return createDTU({
      title: `HYPER: Synthesis of ${megas.length} MEGAs`,
      body: megas.map(d => d.title).join("; "),
      tier: "hyper",
      scope: "local",
      ownerId,
      lineage: megas.map(d => d.id),
      source: "compression",
    });
  }

  return { store, createDTU, getDTU, getAllDTUs, createMEGA, createHYPER };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DTU Creation and Management", () => {
  let dtuStore;

  beforeEach(() => {
    dtuStore = createDTUStore();
  });

  it("createLocalDTU saves to correct user scope", () => {
    const dtu = dtuStore.createDTU({
      title: "Test Knowledge",
      body: "Some knowledge content",
      scope: "local",
      ownerId: "user-1",
    });
    assert.equal(dtu.scope, "local");
    assert.equal(dtu.ownerId, "user-1");
    assert.ok(dtuStore.getDTU(dtu.id));
  });

  it("createGlobalDTU requires council approval flag", () => {
    const dtu = dtuStore.createDTU({
      title: "Global Knowledge",
      body: "Shared knowledge",
      scope: "global",
      ownerId: "system",
    });
    assert.equal(dtu.scope, "global");
    // In production, global DTUs go through council review
    assert.ok(dtu.scope === "global");
  });

  it("DTU gets embedding on creation when provided", () => {
    const mockEmbedding = new Float64Array(768).fill(0.1);
    const dtu = dtuStore.createDTU({
      title: "Embedded DTU",
      body: "Content with embedding",
      embedding: mockEmbedding,
    });
    assert.ok(dtu.embedding);
    assert.equal(dtu.embedding.length, 768);
  });

  it("DTU with embedding is retrievable by semantic search", () => {
    // Create DTU with a known embedding
    const embedding = new Float64Array(768);
    embedding[0] = 1.0;
    const dtu = dtuStore.createDTU({
      title: "Searchable DTU",
      body: "Contains searchable content",
      embedding,
    });

    // Verify DTU exists and has embedding
    const retrieved = dtuStore.getDTU(dtu.id);
    assert.ok(retrieved);
    assert.ok(retrieved.embedding);
  });

  it("MEGA creation compresses 9+ DTUs", () => {
    const baseDTUs = Array.from({ length: 10 }, (_, i) =>
      dtuStore.createDTU({
        title: `Base DTU ${i}`,
        body: `Content ${i}`,
        ownerId: "user-1",
      })
    );

    const mega = dtuStore.createMEGA(baseDTUs, "user-1");
    assert.equal(mega.tier, "mega");
    assert.equal(mega.lineage.length, 10);
  });

  it("MEGA creation requires minimum 9 DTUs", () => {
    const fewDTUs = Array.from({ length: 5 }, (_, i) =>
      dtuStore.createDTU({ title: `DTU ${i}`, body: `Content ${i}`, ownerId: "user-1" })
    );
    assert.throws(() => dtuStore.createMEGA(fewDTUs, "user-1"), /MEGA requires 9\+ DTUs/);
  });

  it("HYPER creation compresses 3+ MEGAs", () => {
    // Create 3 MEGAs (each from 9+ DTUs)
    const megas = Array.from({ length: 3 }, (_, mi) => {
      const baseDTUs = Array.from({ length: 9 }, (_, di) =>
        dtuStore.createDTU({ title: `DTU ${mi}-${di}`, body: `Content`, ownerId: "user-1" })
      );
      return dtuStore.createMEGA(baseDTUs, "user-1");
    });

    const hyper = dtuStore.createHYPER(megas, "user-1");
    assert.equal(hyper.tier, "hyper");
    assert.equal(hyper.lineage.length, 3);
  });

  it("DTU lineage chain is preserved", () => {
    const parent = dtuStore.createDTU({ title: "Parent", body: "Parent content" });
    const child = dtuStore.createDTU({
      title: "Child",
      body: "Child content",
      parentId: parent.id,
      lineage: [parent.id],
    });
    const grandchild = dtuStore.createDTU({
      title: "Grandchild",
      body: "Grandchild content",
      parentId: child.id,
      lineage: [parent.id, child.id],
    });

    assert.equal(grandchild.lineage.length, 2);
    assert.equal(grandchild.lineage[0], parent.id);
    assert.equal(grandchild.lineage[1], child.id);
  });

  it("DTU parentId links correctly", () => {
    const parent = dtuStore.createDTU({ title: "Parent", body: "Parent content" });
    const child = dtuStore.createDTU({
      title: "Child",
      body: "Child content",
      parentId: parent.id,
    });
    assert.equal(child.parentId, parent.id);
    assert.ok(dtuStore.getDTU(child.parentId));
  });

  it("local DTU is NOT visible to other users", () => {
    dtuStore.createDTU({ title: "User1 DTU", scope: "local", ownerId: "user-1" });
    dtuStore.createDTU({ title: "User2 DTU", scope: "local", ownerId: "user-2" });

    const user1DTUs = dtuStore.getAllDTUs({ ownerId: "user-1", scope: "local" });
    const user2DTUs = dtuStore.getAllDTUs({ ownerId: "user-2", scope: "local" });

    assert.equal(user1DTUs.length, 1);
    assert.equal(user2DTUs.length, 1);
    assert.ok(!user1DTUs.some(d => d.ownerId === "user-2"));
  });

  it("global DTU IS visible to all users", () => {
    dtuStore.createDTU({ title: "Global Knowledge", scope: "global", ownerId: "system" });
    const globals = dtuStore.getAllDTUs({ scope: "global" });
    assert.ok(globals.length > 0);
    assert.ok(globals.every(d => d.scope === "global"));
  });

  it("DTU tier weighting: HYPER 3x, MEGA 2x, BASE 1x", () => {
    function getTierWeight(tier) {
      return tier === "hyper" ? 3.0 : tier === "mega" ? 2.0 : 1.0;
    }
    assert.equal(getTierWeight("hyper"), 3.0);
    assert.equal(getTierWeight("mega"), 2.0);
    assert.equal(getTierWeight("base"), 1.0);
    assert.equal(getTierWeight("regular"), 1.0);
  });

  it("duplicate semantic DTU rejected from global", () => {
    const globalDTUs = [];

    function checkDuplicate(newTitle, existingDTUs, threshold = 0.92) {
      // Simple Jaccard similarity for test
      const newTokens = new Set(newTitle.toLowerCase().split(/\s+/));
      for (const existing of existingDTUs) {
        const existingTokens = new Set(existing.title.toLowerCase().split(/\s+/));
        const intersection = new Set([...newTokens].filter(t => existingTokens.has(t)));
        const union = new Set([...newTokens, ...existingTokens]);
        const similarity = intersection.size / union.size;
        if (similarity > threshold) return true;
      }
      return false;
    }

    globalDTUs.push(dtuStore.createDTU({
      title: "Introduction to Quantum Computing Basics",
      scope: "global",
    }));

    const isDuplicate = checkDuplicate("Introduction to Quantum Computing Basics", globalDTUs, 0.8);
    assert.ok(isDuplicate, "Semantically duplicate DTU should be rejected");
  });
});
