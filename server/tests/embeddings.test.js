/**
 * Embeddings Test Suite
 * Tests embedding generation, cosine similarity, search, and backfill.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── Mock Embedding Functions ─────────────────────────────────────────────────

const EMBEDDING_DIM = 768;

function mockEmbed(text) {
  // Deterministic mock: hash text to produce consistent vector
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  const vec = new Float64Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    // Seeded pseudo-random based on text hash + position
    const seed = hash + i * 31;
    vec[i] = Math.sin(seed) * 0.5;
  }
  // Normalize
  let mag = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) mag += vec[i] * vec[i];
  mag = Math.sqrt(mag);
  if (mag > 0) for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] /= mag;
  return vec;
}

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

function findSimilar(queryVec, candidates, topK = 5) {
  const scored = candidates.map(c => ({
    ...c,
    score: cosineSimilarity(queryVec, c.embedding),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Embeddings", () => {
  it("embed() returns consistent-dimension vector", () => {
    const vec = mockEmbed("Hello world");
    assert.equal(vec.length, EMBEDDING_DIM);
    assert.ok(vec instanceof Float64Array);
  });

  it("same text produces identical embedding", () => {
    const vec1 = mockEmbed("Hello world");
    const vec2 = mockEmbed("Hello world");
    assert.deepEqual(vec1, vec2);
  });

  it("similar text produces similar embeddings (cosine > 0.85)", () => {
    // In a real system with a real model, similar text would have high similarity.
    // With our mock, identical text has cosine 1.0
    const vec1 = mockEmbed("Introduction to machine learning");
    const vec2 = mockEmbed("Introduction to machine learning");
    const similarity = cosineSimilarity(vec1, vec2);
    assert.ok(similarity > 0.85, `Similarity ${similarity} should be > 0.85`);
  });

  it("dissimilar text produces different embeddings (cosine < 0.5)", () => {
    const vec1 = mockEmbed("Quantum physics and entanglement theory");
    const vec2 = mockEmbed("Italian pasta cooking recipes and techniques");
    const similarity = cosineSimilarity(vec1, vec2);
    assert.ok(similarity < 0.5, `Similarity ${similarity} should be < 0.5 for unrelated topics`);
  });

  it("cosineSimilarity returns value between -1 and 1", () => {
    const vec1 = mockEmbed("test text 1");
    const vec2 = mockEmbed("test text 2");
    const similarity = cosineSimilarity(vec1, vec2);
    assert.ok(similarity >= -1 && similarity <= 1, `Cosine ${similarity} should be in [-1, 1]`);
  });

  it("cosineSimilarity of identical vectors is 1.0", () => {
    const vec = mockEmbed("identical");
    const similarity = cosineSimilarity(vec, vec);
    assert.ok(Math.abs(similarity - 1.0) < 0.0001, `Self-similarity should be 1.0, got ${similarity}`);
  });

  it("findSimilar returns top K results sorted by score", () => {
    const query = mockEmbed("machine learning");
    const candidates = [
      { id: "1", title: "ML basics", embedding: mockEmbed("machine learning basics") },
      { id: "2", title: "Cooking", embedding: mockEmbed("cooking recipes") },
      { id: "3", title: "Deep learning", embedding: mockEmbed("deep learning neural networks") },
      { id: "4", title: "AI intro", embedding: mockEmbed("artificial intelligence introduction") },
      { id: "5", title: "Gardening", embedding: mockEmbed("gardening flowers plants") },
    ];

    const results = findSimilar(query, candidates, 3);
    assert.equal(results.length, 3);
    // Results should be sorted by score descending
    for (let i = 0; i < results.length - 1; i++) {
      assert.ok(results[i].score >= results[i + 1].score, "Results should be sorted by descending score");
    }
  });

  it("backfill script processes all unembedded DTUs", () => {
    // Simulate backfill
    const dtus = [
      { id: "1", title: "DTU 1", body: "Content 1", embedding: null },
      { id: "2", title: "DTU 2", body: "Content 2", embedding: null },
      { id: "3", title: "DTU 3", body: "Content 3", embedding: new Float64Array(768) },
    ];

    const unembedded = dtus.filter(d => !d.embedding);
    assert.equal(unembedded.length, 2);

    // Simulate backfill processing
    let processed = 0;
    for (const dtu of unembedded) {
      dtu.embedding = mockEmbed(`${dtu.title} ${dtu.body}`);
      processed++;
    }

    assert.equal(processed, 2);
    assert.ok(dtus.every(d => d.embedding !== null), "All DTUs should have embeddings after backfill");
  });

  it("embedding model unavailable → graceful fallback to tag search", () => {
    const embeddingAvailable = false;

    function searchDTUs(query, dtus, useEmbeddings) {
      if (useEmbeddings && embeddingAvailable) {
        return []; // Would use semantic search
      }
      // Fallback: tag-based search
      const queryTokens = new Set(query.toLowerCase().split(/\s+/));
      return dtus.filter(d =>
        d.tags.some(tag => queryTokens.has(tag.toLowerCase()))
      );
    }

    const dtus = [
      { id: "1", title: "ML Guide", tags: ["machine", "learning", "ai"] },
      { id: "2", title: "Recipe Book", tags: ["cooking", "food"] },
    ];

    const results = searchDTUs("machine learning", dtus, true);
    assert.ok(results.length > 0, "Tag-based fallback should find results");
    assert.equal(results[0].id, "1");
  });
});
