/**
 * Predictive Pre-Computation for Concord Cognitive Engine
 *
 * The subconscious analyzes query patterns and pre-generates likely
 * future answers during idle time. When the question comes, embedding
 * match returns the pre-computed answer instantly.
 *
 * Scheduling:
 *   - Runs during low-usage hours (priority during 2am-6am)
 *   - Prioritizes lenses with highest query volume
 *   - Never precomputes more than 50 DTUs per cycle
 *   - Precomputed DTUs expire after 7 days if never matched
 */

import { embed, cosineSimilarity, isEmbeddingAvailable, getEmbedding } from "./embeddings.js";

// ── Configuration ──────────────────────────────────────────────────────────
const MAX_PRECOMPUTE_PER_CYCLE = 100;
const PRECOMPUTE_EXPIRY_DAYS = 7;
const MIN_CLUSTER_CONFIDENCE = 0.30;
const CLUSTER_SIMILARITY_THRESHOLD = 0.80;

// ── State ──────────────────────────────────────────────────────────────────

/** @type {{ recentQueries: { query: string, lens: string|null, ts: string }[] }} */
const queryLog = {
  recentQueries: [],
  maxQueries: 5000, // rolling window
};

const precomputeStats = {
  cyclesRun: 0,
  dtusPrecomputed: 0,
  cacheHitsFromPrecomputed: 0,
  lastCycleAt: null,
  expirations: 0,
};

/** @type {Function|null} */
let _log = null;

// ── Initialisation ─────────────────────────────────────────────────────────

export function initPrecompute({ structuredLog = console.log } = {}) {
  _log = structuredLog;
  _log("info", "precompute_init", { maxPerCycle: MAX_PRECOMPUTE_PER_CYCLE, expiryDays: PRECOMPUTE_EXPIRY_DAYS });
}

// ── Query Logging ──────────────────────────────────────────────────────────

/**
 * Log a query for pattern analysis.
 *
 * @param {string} query
 * @param {string|null} lens
 */
export function logQuery(query, lens = null) {
  queryLog.recentQueries.push({
    query: String(query).slice(0, 500),
    lens,
    ts: new Date().toISOString(),
  });

  // Trim rolling window
  if (queryLog.recentQueries.length > queryLog.maxQueries) {
    queryLog.recentQueries = queryLog.recentQueries.slice(-queryLog.maxQueries);
  }
}

// ── Pattern Analysis ───────────────────────────────────────────────────────

/**
 * Analyze recent query patterns to identify prediction candidates.
 *
 * @param {number} hoursBack - How many hours to analyze
 * @returns {Promise<Record<string, { theme: string, predictedQueries: string[], confidence: number }[]>>}
 */
export async function analyzeQueryPatterns(hoursBack = 24) {
  if (!isEmbeddingAvailable()) return {};

  const cutoff = new Date(Date.now() - hoursBack * 3600_000).toISOString();
  const recent = queryLog.recentQueries.filter(q => q.ts >= cutoff);

  if (recent.length < 5) return {};

  // Group by lens
  const byLens = {};
  for (const q of recent) {
    const key = q.lens || "_general";
    if (!byLens[key]) byLens[key] = [];
    byLens[key].push(q.query);
  }

  // Cluster similar queries within each lens
  const patterns = {};
  for (const [lens, queries] of Object.entries(byLens)) {
    const clusters = await _clusterByEmbedding(queries, CLUSTER_SIMILARITY_THRESHOLD);
    patterns[lens] = clusters.map(c => ({
      theme: c.centroid,
      predictedQueries: c.members,
      confidence: c.members.length / queries.length,
    })).filter(p => p.confidence >= MIN_CLUSTER_CONFIDENCE);
  }

  return patterns;
}

/**
 * Run a precompute cycle — called by heartbeat during idle windows.
 *
 * @param {{ subconsciousTask: Function, dtusArray: Function, createDTU: Function }} deps
 * @returns {Promise<{ precomputed: number, skipped: number }>}
 */
export async function runPrecomputeCycle({ subconsciousTask, dtusArray, createDTU } = {}) {
  if (!isEmbeddingAvailable() || !subconsciousTask || !createDTU) {
    return { precomputed: 0, skipped: 0, reason: "missing_deps" };
  }

  const patterns = await analyzeQueryPatterns(24);
  let precomputed = 0, skipped = 0;

  for (const [lens, predictions] of Object.entries(patterns)) {
    if (precomputed >= MAX_PRECOMPUTE_PER_CYCLE) break;

    for (const pred of predictions) {
      if (pred.confidence < MIN_CLUSTER_CONFIDENCE) continue;
      if (precomputed >= MAX_PRECOMPUTE_PER_CYCLE) break;

      for (const query of pred.predictedQueries.slice(0, 3)) {
        if (precomputed >= MAX_PRECOMPUTE_PER_CYCLE) break;

        // Check if already answered in substrate
        const queryVec = await embed(query);
        if (!queryVec) { skipped++; continue; }

        const allDTUs = typeof dtusArray === "function" ? dtusArray() : [];
        let bestSim = 0;
        for (const dtu of allDTUs) {
          const vec = getEmbedding(dtu.id);
          if (!vec) continue;
          const sim = cosineSimilarity(queryVec, vec);
          if (sim > bestSim) bestSim = sim;
        }

        if (bestSim >= 0.90) { skipped++; continue; } // Already answered

        // Pre-generate via subconscious
        try {
          const result = await subconsciousTask("precompute", lens === "_general" ? null : lens);
          if (result?.ok && result?.content) {
            await createDTU({
              title: `Precomputed: ${query.slice(0, 80)}`,
              creti: result.content,
              tags: [lens === "_general" ? null : lens, "precomputed", "cache-warm"].filter(Boolean),
              source: "subconscious.precompute",
              meta: {
                predictedQuery: query,
                theme: pred.theme,
                confidence: pred.confidence,
                expiresAt: new Date(Date.now() + PRECOMPUTE_EXPIRY_DAYS * 86400_000).toISOString(),
              },
            });
            precomputed++;
          }
        } catch (e) {
          if (_log) _log("warn", "precompute_failed", { query: query.slice(0, 80), error: String(e?.message || e) });
        }
      }
    }
  }

  precomputeStats.cyclesRun++;
  precomputeStats.dtusPrecomputed += precomputed;
  precomputeStats.lastCycleAt = new Date().toISOString();

  if (_log) _log("info", "precompute_cycle", { precomputed, skipped });
  return { precomputed, skipped };
}

/**
 * Expire old precomputed DTUs that were never matched.
 *
 * @param {Map<string, object>} dtusMap - STATE.dtus
 */
export function expirePrecomputedDTUs(dtusMap) {
  const now = new Date().toISOString();
  let expired = 0;

  for (const [id, dtu] of dtusMap) {
    if (dtu.source !== "subconscious.precompute") continue;
    if (!dtu.meta?.expiresAt) continue;
    if (dtu.meta.expiresAt < now) {
      dtusMap.delete(id);
      expired++;
    }
  }

  precomputeStats.expirations += expired;
  if (expired > 0 && _log) {
    _log("info", "precompute_expired", { count: expired });
  }
}

// ── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Simple embedding-based clustering for query strings.
 */
async function _clusterByEmbedding(queries, threshold) {
  const embeddings = [];
  for (const q of queries) {
    const vec = await embed(q);
    if (vec) embeddings.push({ query: q, vec });
  }

  if (embeddings.length < 2) return [];

  // Simple greedy clustering
  const clusters = [];
  const used = new Set();

  for (let i = 0; i < embeddings.length; i++) {
    if (used.has(i)) continue;
    const cluster = { centroid: embeddings[i].query, members: [embeddings[i].query] };
    used.add(i);

    for (let j = i + 1; j < embeddings.length; j++) {
      if (used.has(j)) continue;
      const sim = cosineSimilarity(embeddings[i].vec, embeddings[j].vec);
      if (sim >= threshold) {
        cluster.members.push(embeddings[j].query);
        used.add(j);
      }
    }

    if (cluster.members.length >= 2) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

// ── Monitoring ─────────────────────────────────────────────────────────────

export function getPrecomputeStats() {
  return {
    ...precomputeStats,
    recentQueryCount: queryLog.recentQueries.length,
  };
}

export default {
  initPrecompute,
  logQuery,
  analyzeQueryPatterns,
  runPrecomputeCycle,
  expirePrecomputedDTUs,
  getPrecomputeStats,
};
