/**
 * Model Optimizer for Concord Cognitive Engine (GPU Mode)
 *
 * On GPU, the optimizer is INVERTED from CPU behavior:
 * - CPU mode: mature lenses DOWNGRADE to save compute
 * - GPU mode: all lenses keep their assigned model (GPU can handle it)
 *             immature lenses get MORE reasoning power, not less
 *
 * Maturity levels (GPU):
 *   < 0.3 → 14b (needs deep reasoning — use the biggest model)
 *   < 0.6 → 7b  (developing substrate)
 *   < 0.8 → 7b  (strong retrieval, maintain quality)
 *   >= 0.8 → 7b (mature — GPU can handle full quality, no downgrade)
 */

import { getEmbedding } from "./embeddings.js";

// ── State ──────────────────────────────────────────────────────────────────

/** @type {Map<string, { dtuCount: number, megaCount: number, hyperCount: number, cacheHits: number, totalQueries: number, retrievalSufficient: number, avgTopSimilarity: number, avgSatisfaction: number }>} */
const lensStats = new Map();

/** @type {Map<string, string>} lens → currently assigned model */
const lensModels = new Map();

/** @type {Function|null} */
let _log = null;

// ── Initialisation ─────────────────────────────────────────────────────────

export function initModelOptimizer({ structuredLog = console.log } = {}) {
  _log = structuredLog;
  _log("info", "model_optimizer_init", {});
}

// ── Core API ───────────────────────────────────────────────────────────────

/**
 * Assess the maturity level of a specific lens.
 *
 * @param {string} lens
 * @param {{ dtusArray: Function }} opts
 * @returns {object}
 */
export function assessLensMaturity(lens, { dtusArray } = {}) {
  const stats = _getLensStats(lens, dtusArray);

  const maturity = calculateMaturity(stats);
  const recommended = recommendModel(stats);

  return {
    lens,
    totalDTUs: stats.dtuCount,
    megaCount: stats.megaCount,
    hyperCount: stats.hyperCount,
    cacheHitRate: stats.totalQueries > 0 ? stats.cacheHits / stats.totalQueries : 0,
    retrievalSufficiencyRate: stats.totalQueries > 0 ? stats.retrievalSufficient / stats.totalQueries : 0,
    avgTopSimilarity: stats.avgTopSimilarity,
    avgSatisfaction: stats.avgSatisfaction,
    maturityScore: maturity,
    recommendedModel: recommended,
    currentModel: lensModels.get(lens) || "7b",
  };
}

/**
 * Assess all lenses and return maturity report.
 *
 * @param {{ dtusArray: Function }} opts
 * @returns {object[]}
 */
export function assessAllLenses({ dtusArray } = {}) {
  const allDTUs = typeof dtusArray === "function" ? dtusArray() : [];

  // Extract unique lenses from DTU tags
  const lenses = new Set();
  for (const dtu of allDTUs) {
    if (Array.isArray(dtu.tags)) {
      for (const t of dtu.tags) {
        lenses.add(t.toLowerCase());
      }
    }
  }

  const results = [];
  for (const lens of lenses) {
    const assessment = assessLensMaturity(lens, { dtusArray });
    if (assessment.totalDTUs >= 5) { // Only report lenses with meaningful content
      results.push(assessment);
    }
  }

  return results.sort((a, b) => b.maturityScore - a.maturityScore);
}

/**
 * Record a query event for a lens (for stats tracking).
 *
 * @param {string|null} lens
 * @param {{ cacheHit?: boolean, retrievalSufficient?: boolean, topSimilarity?: number, satisfaction?: number }} event
 */
export function recordQueryEvent(lens, { cacheHit = false, retrievalSufficient = false, topSimilarity = 0, satisfaction = null } = {}) {
  const key = lens || "_global";
  if (!lensStats.has(key)) {
    lensStats.set(key, {
      dtuCount: 0,
      megaCount: 0,
      hyperCount: 0,
      cacheHits: 0,
      totalQueries: 0,
      retrievalSufficient: 0,
      avgTopSimilarity: 0,
      avgSatisfaction: 0.5,
      _satisfactionSum: 0,
      _satisfactionCount: 0,
    });
  }

  const s = lensStats.get(key);
  s.totalQueries++;
  if (cacheHit) s.cacheHits++;
  if (retrievalSufficient) s.retrievalSufficient++;
  s.avgTopSimilarity = (s.avgTopSimilarity * (s.totalQueries - 1) + topSimilarity) / s.totalQueries;

  if (satisfaction !== null) {
    s._satisfactionSum += satisfaction;
    s._satisfactionCount++;
    s.avgSatisfaction = s._satisfactionSum / s._satisfactionCount;
  }
}

/**
 * Get the recommended model for a lens (used by routing logic).
 *
 * @param {string|null} lens
 * @returns {string} Model size recommendation: "14b", "7b" (GPU mode — no downgrades)
 */
export function getRecommendedModel(lens) {
  const stats = lensStats.get(lens || "_global");
  if (!stats) return "7b";
  return recommendModel(stats).model;
}

// ── Internal Helpers ───────────────────────────────────────────────────────

function _getLensStats(lens, dtusArray) {
  const base = lensStats.get(lens) || {
    dtuCount: 0,
    megaCount: 0,
    hyperCount: 0,
    cacheHits: 0,
    totalQueries: 0,
    retrievalSufficient: 0,
    avgTopSimilarity: 0,
    avgSatisfaction: 0.5,
  };

  // Enrich with live DTU counts
  if (typeof dtusArray === "function") {
    const allDTUs = dtusArray();
    const lensDTUs = allDTUs.filter(d => Array.isArray(d.tags) && d.tags.some(t => t.toLowerCase() === lens?.toLowerCase()));
    base.dtuCount = lensDTUs.length;
    base.megaCount = lensDTUs.filter(d => d.tier === "mega").length;
    base.hyperCount = lensDTUs.filter(d => d.tier === "hyper").length;
  }

  return base;
}

/**
 * Calculate overall maturity score (0–1) for a lens.
 */
function calculateMaturity(stats) {
  let score = 0;

  // Has HYPER DTUs (dense knowledge kernel)
  if (stats.hyperCount > 0) score += 0.2;

  // Has 10+ MEGA DTUs (consolidated clusters)
  if (stats.megaCount >= 10) score += 0.2;

  // Cache hit rate (capped at 0.5 contribution)
  const cacheRate = stats.totalQueries > 0 ? stats.cacheHits / stats.totalQueries : 0;
  score += Math.min(cacheRate, 0.5) * 0.4;

  // Retrieval sufficiency rate (capped at 0.5 contribution)
  const retrievalRate = stats.totalQueries > 0 ? stats.retrievalSufficient / stats.totalQueries : 0;
  score += Math.min(retrievalRate, 0.5) * 0.4;

  return Math.min(score, 1.0);
}

/**
 * Recommend a model size based on lens maturity.
 * GPU mode: no downgrades — immature lenses get MORE power.
 */
function recommendModel(stats) {
  const maturity = calculateMaturity(stats);

  if (maturity < 0.3) return { model: "14b", reason: "Low substrate — needs deep reasoning (GPU)" };
  if (maturity < 0.6) return { model: "7b", reason: "Developing substrate — full quality (GPU)" };
  if (maturity < 0.8) return { model: "7b", reason: "Strong retrieval — maintain quality (GPU)" };
  return { model: "7b", reason: "Mature substrate — GPU handles full quality, no downgrade" };
}

// ── Monitoring ─────────────────────────────────────────────────────────────

export function getModelOptimizerStats() {
  const byLens = {};
  for (const [k, v] of lensStats) {
    byLens[k] = {
      ...v,
      maturity: calculateMaturity(v),
      recommendedModel: recommendModel(v),
      currentModel: lensModels.get(k) || "7b",
    };
  }

  return { byLens };
}

export default {
  initModelOptimizer,
  assessLensMaturity,
  assessAllLenses,
  recordQueryEvent,
  getRecommendedModel,
  getModelOptimizerStats,
};
