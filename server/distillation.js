/**
 * Knowledge Distillation for Concord Cognitive Engine
 *
 * As the substrate matures, progressively shift from inference-heavy
 * to retrieval-heavy responses. Tracks when retrieval alone can answer
 * a query and routes accordingly.
 *
 * Tiered response strategy:
 *   Level 1: Semantic cache (instant)
 *   Level 2: Retrieval sufficient → utility formatting (near-instant)
 *   Level 3: Full conscious reasoning (full inference)
 */

import { embed, cosineSimilarity, isEmbeddingAvailable, getEmbedding } from "./embeddings.js";

// ── State ──────────────────────────────────────────────────────────────────

/** @type {{ byLens: Map<string, { cache: number, retrieval: number, inference: number, total: number }> }} */
const distillationStats = {
  byLens: new Map(),
  milestones: [], // lenses that crossed 50% retrieval-sufficient
};

/** @type {Function|null} */
let _log = null;

// ── Initialisation ─────────────────────────────────────────────────────────

export function initDistillation({ structuredLog = console.warn } = {}) {
  _log = structuredLog;
  _log("info", "distillation_init", {});
}

// ── Core API ───────────────────────────────────────────────────────────────

/**
 * Assess whether retrieval alone can sufficiently answer a query.
 *
 * @param {string} query
 * @param {string|null} lens
 * @param {{ dtusArray: Function }} opts
 * @returns {Promise<{ sufficient: boolean, method?: string, reason?: string, context: object[] }>}
 */
export async function assessRetrievalSufficiency(query, lens, { dtusArray } = {}) {
  if (!isEmbeddingAvailable()) {
    return { sufficient: false, reason: "embeddings_unavailable", context: [] };
  }

  const queryVec = await embed(query);
  if (!queryVec) {
    return { sufficient: false, reason: "embed_failed", context: [] };
  }

  const allDTUs = typeof dtusArray === "function" ? dtusArray() : [];

  // Filter by lens (always include HYPERs and MEGAs)
  let pool = allDTUs;
  if (lens) {
    pool = allDTUs.filter(d => {
      if (d.tier === "hyper" || d.tier === "mega") return true;
      return Array.isArray(d.tags) && d.tags.some(t => t.toLowerCase() === lens.toLowerCase());
    });
  }

  // Score all candidates
  const scored = [];
  for (const dtu of pool) {
    const vec = getEmbedding(dtu.id);
    if (!vec) continue;

    const sim = cosineSimilarity(queryVec, vec);
    const tierWeight = dtu.tier === "hyper" ? 3.0 : dtu.tier === "mega" ? 2.0 : 1.0;
    scored.push({
      id: dtu.id,
      title: dtu.title,
      tier: dtu.tier,
      score: sim * tierWeight,
      rawSimilarity: sim,
      summary: dtu.human?.summary || dtu.cretiHuman || "",
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const context = scored.slice(0, 5);

  if (context.length === 0) {
    return { sufficient: false, reason: "no_context", context: [] };
  }

  const top = context[0];

  // HYPER with high similarity = definitely sufficient
  if (top.tier === "hyper" && top.rawSimilarity > 0.90) {
    return { sufficient: true, method: "hyper-direct", context };
  }

  // MEGA with high similarity = likely sufficient
  if (top.tier === "mega" && top.rawSimilarity > 0.93) {
    return { sufficient: true, method: "mega-direct", context };
  }

  // Multiple related DTUs covering the query
  const relevantCount = context.filter(d => d.rawSimilarity > 0.85).length;
  if (relevantCount >= 3) {
    return { sufficient: true, method: "multi-dtu-synthesis", context };
  }

  return { sufficient: false, reason: "insufficient_coverage", context };
}

/**
 * Record which routing level was used for a query.
 *
 * @param {string|null} lens
 * @param {"cache"|"retrieval"|"inference"} level
 */
export function recordRoutingLevel(lens, level) {
  const key = lens || "_global";
  if (!distillationStats.byLens.has(key)) {
    distillationStats.byLens.set(key, { cache: 0, retrieval: 0, inference: 0, total: 0 });
  }
  const s = distillationStats.byLens.get(key);
  s[level]++;
  s.total++;

  // Check for 50% retrieval-sufficient milestone
  const retrievalRate = (s.cache + s.retrieval) / s.total;
  if (retrievalRate >= 0.5 && s.total >= 20 && !distillationStats.milestones.includes(key)) {
    distillationStats.milestones.push(key);
    if (_log) _log("info", "distillation_milestone", { lens: key, retrievalRate, total: s.total });
  }
}

// ── Monitoring ─────────────────────────────────────────────────────────────

/**
 * Get distillation statistics for monitoring dashboards.
 */
export function getDistillationStats() {
  const byLens = {};
  for (const [k, v] of distillationStats.byLens) {
    byLens[k] = {
      ...v,
      cacheRate: v.total > 0 ? Math.round((v.cache / v.total) * 100) / 100 : 0,
      retrievalRate: v.total > 0 ? Math.round((v.retrieval / v.total) * 100) / 100 : 0,
      inferenceRate: v.total > 0 ? Math.round((v.inference / v.total) * 100) / 100 : 0,
    };
  }

  return {
    byLens,
    milestones: distillationStats.milestones,
  };
}

export default {
  initDistillation,
  assessRetrievalSufficiency,
  recordRoutingLevel,
  getDistillationStats,
};
