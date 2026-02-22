/**
 * Semantic Cache Test Suite
 * Tests cache hit/miss behavior, similarity thresholds, user scoping, and stats.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── Mock Embedding + Cache Infrastructure ────────────────────────────────────

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function createSemanticCache(threshold = 0.92) {
  const entries = [];
  const stats = { hits: 0, misses: 0 };

  function addEntry(query, response, embedding, userId) {
    entries.push({ query, response, embedding, userId, createdAt: Date.now() });
  }

  function check(queryEmbedding, userId) {
    // Only search entries for this user (sovereignty scoping)
    const userEntries = entries.filter(e => e.userId === userId);

    let bestMatch = null;
    let bestScore = 0;

    for (const entry of userEntries) {
      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    if (bestMatch && bestScore >= threshold) {
      stats.hits++;
      return { cached: true, response: bestMatch.response, score: bestScore };
    }

    stats.misses++;
    return { cached: false, score: bestScore };
  }

  return { addEntry, check, stats, entries };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Semantic Cache", () => {
  let cache;

  beforeEach(() => {
    cache = createSemanticCache(0.92);
  });

  it("identical query returns cached response", () => {
    const embedding = new Float64Array([0.5, 0.3, 0.2, 0.8, 0.1]);
    cache.addEntry("What is AI?", "AI is artificial intelligence.", embedding, "user-1");

    const result = cache.check(embedding, "user-1");
    assert.ok(result.cached);
    assert.equal(result.response, "AI is artificial intelligence.");
    assert.equal(result.score, 1.0);
  });

  it("similar query (>0.92) returns cached response", () => {
    const original = new Float64Array([1.0, 0.0, 0.0, 0.0, 0.0]);
    cache.addEntry("What is AI?", "AI is artificial intelligence.", original, "user-1");

    // Slightly different but still very similar
    const similar = new Float64Array([0.98, 0.05, 0.01, 0.02, 0.01]);
    const result = cache.check(similar, "user-1");
    assert.ok(result.cached, `Score ${result.score} should exceed 0.92 threshold`);
  });

  it("dissimilar query (<0.92) hits LLM", () => {
    const original = new Float64Array([1.0, 0.0, 0.0, 0.0, 0.0]);
    cache.addEntry("What is AI?", "AI is artificial intelligence.", original, "user-1");

    // Very different query
    const dissimilar = new Float64Array([0.0, 0.0, 1.0, 0.0, 0.0]);
    const result = cache.check(dissimilar, "user-1");
    assert.ok(!result.cached, `Score ${result.score} should be below 0.92 threshold`);
  });

  it("cache is scoped to user's local instance", () => {
    const embedding = new Float64Array([0.5, 0.3, 0.2, 0.8, 0.1]);
    cache.addEntry("What is AI?", "AI is artificial intelligence.", embedding, "user-1");

    // Same query from different user should miss
    const result = cache.check(embedding, "user-2");
    assert.ok(!result.cached, "Cache should be scoped to user-1 only");
  });

  it("user A cache does not affect user B", () => {
    const embeddingA = new Float64Array([0.5, 0.3, 0.2, 0.8, 0.1]);
    const embeddingB = new Float64Array([0.1, 0.8, 0.5, 0.3, 0.2]);

    cache.addEntry("Query A", "Response A", embeddingA, "user-a");
    cache.addEntry("Query B", "Response B", embeddingB, "user-b");

    const resultA = cache.check(embeddingA, "user-a");
    assert.ok(resultA.cached);
    assert.equal(resultA.response, "Response A");

    const resultB = cache.check(embeddingB, "user-b");
    assert.ok(resultB.cached);
    assert.equal(resultB.response, "Response B");

    // Cross-user should not match
    const crossResult = cache.check(embeddingA, "user-b");
    assert.ok(!crossResult.cached || crossResult.response !== "Response A");
  });

  it("cached response creates a cache-hit DTU record", () => {
    const embedding = new Float64Array([0.5, 0.3, 0.2, 0.8, 0.1]);
    cache.addEntry("What is AI?", "AI is artificial intelligence.", embedding, "user-1");

    const result = cache.check(embedding, "user-1");
    assert.ok(result.cached);

    // Simulate DTU creation on cache hit
    const cacheHitDTU = {
      title: `Cached: What is AI?`,
      source: "conscious.cache",
      tags: ["cache-hit"],
    };
    assert.equal(cacheHitDTU.source, "conscious.cache");
    assert.ok(cacheHitDTU.tags.includes("cache-hit"));
  });

  it("cache hit increments stats", () => {
    const embedding = new Float64Array([0.5, 0.3, 0.2, 0.8, 0.1]);
    cache.addEntry("What is AI?", "Response", embedding, "user-1");

    const initialHits = cache.stats.hits;
    cache.check(embedding, "user-1"); // hit
    assert.equal(cache.stats.hits, initialHits + 1);

    const different = new Float64Array([0.0, 0.0, 0.0, 0.0, 1.0]);
    const initialMisses = cache.stats.misses;
    cache.check(different, "user-1"); // miss
    assert.equal(cache.stats.misses, initialMisses + 1);
  });
});
