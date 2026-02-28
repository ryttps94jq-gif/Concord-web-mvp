/**
 * Self-Healing Knowledge System for Concord Cognitive Engine
 *
 * When a user corrects their system or thumbs down a response,
 * the repair propagates through THEIR local substrate only.
 * Their local subconscious reviews similar DTUs in the next dream cycle.
 *
 * Key rule: Corrections NEVER propagate to global. If a user fixes
 * bad knowledge locally, that's their improvement.
 */

import { embed, cosineSimilarity, getEmbedding, embedDTU } from "./embeddings.js";

// ── State ──────────────────────────────────────────────────────────────────

/** @type {{ flagged: number, healed: number, reviewed: number, pendingReviews: { dtuId: string, reason: string, correction?: string, flaggedId: string }[] }} */
const healingState = {
  flagged: 0,
  healed: 0,
  reviewed: 0,
  pendingReviews: [],
};

/** @type {Function|null} */
let _log = null;

// ── Initialisation ─────────────────────────────────────────────────────────

export function initSelfHealing({ structuredLog = console.warn } = {}) {
  _log = structuredLog;
  _log("info", "self_healing_init", {});
}

// ── Core API ───────────────────────────────────────────────────────────────

/**
 * Flag a DTU as problematic and queue similar DTUs for review.
 * Only affects the local substrate.
 *
 * @param {string} dtuId - The flagged DTU
 * @param {{ rating?: number, correction?: string }} feedback
 * @param {{ dtusArray: Function }} deps
 */
export async function flagAndHeal(dtuId, { rating = -1, correction = "" } = {}, { dtusArray } = {}) {
  healingState.flagged++;

  const allDTUs = typeof dtusArray === "function" ? dtusArray() : [];
  const flaggedDtu = allDTUs.find(d => d.id === dtuId);
  if (!flaggedDtu) return { queued: 0, reason: "dtu_not_found" };

  // Mark DTU as flagged
  flaggedDtu.meta = flaggedDtu.meta || {};
  flaggedDtu.meta.flagged = true;
  flaggedDtu.meta.flaggedAt = new Date().toISOString();
  flaggedDtu.meta.flagRating = rating;
  flaggedDtu.meta.flagCorrection = correction;

  // Find semantically similar DTUs in LOCAL substrate
  const flaggedVec = getEmbedding(dtuId);
  if (!flaggedVec) return { queued: 0, reason: "no_embedding" };

  let queued = 0;
  for (const dtu of allDTUs) {
    if (dtu.id === dtuId) continue;
    // Only review local-scope DTUs
    if (dtu.scope && dtu.scope !== "local") continue;

    const vec = getEmbedding(dtu.id);
    if (!vec) continue;

    const sim = cosineSimilarity(flaggedVec, vec);
    if (sim >= 0.85) {
      healingState.pendingReviews.push({
        dtuId: dtu.id,
        reason: "similar-to-flagged",
        correction,
        flaggedId: dtuId,
        similarity: sim,
      });
      queued++;
    }
  }

  if (_log) _log("info", "self_heal_flagged", { dtuId, queued, correction: correction.slice(0, 100) });
  return { queued, flaggedId: dtuId };
}

/**
 * Run dream review cycle — subconscious reviews flagged-similar DTUs.
 * Called during local subconscious dream cycle.
 *
 * @param {{ callBrain: Function, dtusMap: Map }} deps
 * @returns {Promise<{ reviewed: number, updated: number }>}
 */
export async function runDreamReview({ callBrain, dtusMap } = {}) {
  if (!callBrain || !dtusMap || healingState.pendingReviews.length === 0) {
    return { reviewed: 0, updated: 0 };
  }

  const batch = healingState.pendingReviews.splice(0, 5); // Process 5 at a time
  let reviewed = 0, updated = 0;

  for (const review of batch) {
    const dtu = dtusMap.get(review.dtuId);
    if (!dtu) continue;

    const content = dtu.cretiHuman || dtu.human?.summary || dtu.machine?.notes || "";
    const prompt = `A related knowledge unit was flagged as incorrect.
Flagged correction: ${review.correction || "No specific correction provided"}
Similarity to flagged: ${Math.round((review.similarity || 0) * 100)}%

Review this DTU and determine if it needs updating:
Title: ${dtu.title}
Content: ${content.slice(0, 500)}

Return JSON only: {"needsUpdate": true/false, "updatedContent": "..." or null, "reason": "..."}`;

    try {
      const result = await callBrain("subconscious", prompt, {
        temperature: 0.3,
        maxTokens: 400,
        timeout: 15000,
      });

      reviewed++;

      if (result.ok && result.content) {
        try {
          const parsed = JSON.parse(result.content.trim());
          if (parsed.needsUpdate && parsed.updatedContent) {
            dtu.human = dtu.human || {};
            dtu.human.summary = parsed.updatedContent;
            dtu.meta = dtu.meta || {};
            dtu.meta.healedFrom = review.flaggedId;
            dtu.meta.healReason = parsed.reason;
            dtu.meta.healedAt = new Date().toISOString();
            dtu.updatedAt = new Date().toISOString();

            // Re-embed the updated DTU
            embedDTU(dtu).catch(() => {});

            updated++;
          }
        } catch { /* JSON parse failed */ }
      }
    } catch (e) {
      if (_log) _log("warn", "dream_review_error", { dtuId: review.dtuId, error: String(e?.message || e) });
    }
  }

  healingState.reviewed += reviewed;
  healingState.healed += updated;

  if (_log) _log("info", "dream_review_complete", { reviewed, updated, pendingRemaining: healingState.pendingReviews.length });
  return { reviewed, updated };
}

// ── Temporal Freshness ─────────────────────────────────────────────────────

/**
 * Assess freshness of high-value DTUs in local substrate.
 * Returns stale DTUs that should be refreshed.
 *
 * @param {{ dtusArray: Function }} deps
 * @param {{ lens?: string, maxAgeDays?: number }} opts
 * @returns {object[]}
 */
export function assessFreshness({ dtusArray } = {}, { lens = null, maxAgeDays = 7 } = {}) {
  const allDTUs = typeof dtusArray === "function" ? dtusArray() : [];
  const now = Date.now();

  return allDTUs.filter(dtu => {
    // Only check local scope
    if (dtu.scope && dtu.scope !== "local") return false;
    // Only check high-value DTUs (MEGA/HYPER or frequently accessed)
    const isHighValue = dtu.tier === "mega" || dtu.tier === "hyper" || (dtu.stats?.uses || 0) > 5;
    if (!isHighValue) return false;
    // Lens filter
    if (lens && Array.isArray(dtu.tags) && !dtu.tags.some(t => t.toLowerCase() === lens.toLowerCase())) return false;
    // Age check
    const createdAt = dtu.createdAt ? new Date(dtu.createdAt).getTime() : now;
    const ageMs = now - createdAt;
    const ageDays = ageMs / 86400_000;
    return ageDays > maxAgeDays;
  }).map(dtu => ({
    id: dtu.id,
    title: dtu.title,
    tier: dtu.tier,
    ageDays: Math.round((now - new Date(dtu.createdAt).getTime()) / 86400_000),
    uses: dtu.stats?.uses || 0,
    tags: dtu.tags,
  }));
}

// ── Skill Acquisition ──────────────────────────────────────────────────────

/**
 * Track local weaknesses — queries where retrieval scored low or user was dissatisfied.
 *
 * @type {{ weakQueries: { query: string, lens: string|null, score: number, ts: string }[] }}
 */
const skillState = {
  weakQueries: [],
  maxWeakQueries: 2000,
};

/**
 * Record a weak query (low retrieval score or thumbs down).
 *
 * @param {string} query
 * @param {string|null} lens
 * @param {number} retrievalScore
 */
export function recordWeakQuery(query, lens, retrievalScore) {
  skillState.weakQueries.push({
    query: String(query).slice(0, 500),
    lens,
    score: retrievalScore,
    ts: new Date().toISOString(),
  });

  if (skillState.weakQueries.length > skillState.maxWeakQueries) {
    skillState.weakQueries = skillState.weakQueries.slice(-skillState.maxWeakQueries);
  }
}

/**
 * Detect knowledge gaps from weak queries.
 * Returns lenses sorted by gap severity.
 *
 * @param {number} hoursBack
 * @returns {object[]}
 */
export function detectKnowledgeGaps(hoursBack = 72) {
  const cutoff = new Date(Date.now() - hoursBack * 3600_000).toISOString();
  const recent = skillState.weakQueries.filter(q => q.ts >= cutoff);

  if (recent.length === 0) return [];

  const byLens = {};
  for (const q of recent) {
    const key = q.lens || "_general";
    if (!byLens[key]) byLens[key] = [];
    byLens[key].push(q);
  }

  return Object.entries(byLens)
    .map(([lens, queries]) => ({
      lens,
      gapCount: queries.length,
      avgRetrievalScore: queries.reduce((s, q) => s + q.score, 0) / queries.length,
      sampleQueries: queries.slice(0, 5).map(q => q.query),
    }))
    .sort((a, b) => a.avgRetrievalScore - b.avgRetrievalScore);
}

/**
 * Run skill-building cycle: generate knowledge to fill detected gaps.
 *
 * @param {{ callBrain: Function, createDTU: Function }} deps
 * @returns {Promise<{ generated: number, gaps: number }>}
 */
export async function runSkillBuilding({ callBrain, createDTU } = {}) {
  if (!callBrain || !createDTU) return { generated: 0, gaps: 0, reason: "missing_deps" };

  const gaps = detectKnowledgeGaps(72);
  if (gaps.length === 0) return { generated: 0, gaps: 0 };

  let generated = 0;

  for (const gap of gaps.slice(0, 3)) { // Process top 3 gaps
    const prompt = `The system has been weak in answering questions about: ${gap.sampleQueries.slice(0, 3).join(", ")}
Affected domain: ${gap.lens}
Average retrieval score: ${Math.round(gap.avgRetrievalScore * 100)}%

Generate a comprehensive knowledge unit that would help answer these types of questions. Be specific and factual.`;

    try {
      const result = await callBrain("subconscious", prompt, {
        temperature: 0.5,
        maxTokens: 600,
        timeout: 20000,
      });

      if (result.ok && result.content) {
        await createDTU({
          title: `Skill: ${gap.lens} gap-fill`,
          creti: result.content,
          tags: [gap.lens === "_general" ? null : gap.lens, "skill-building", "gap-fill"].filter(Boolean),
          source: "subconscious.skill-acquisition",
          meta: { addressesWeakness: gap.sampleQueries[0], gapSeverity: gap.avgRetrievalScore },
        });
        generated++;
      }
    } catch (e) {
      if (_log) _log("warn", "skill_build_error", { lens: gap.lens, error: String(e?.message || e) });
    }
  }

  if (_log) _log("info", "skill_building_complete", { generated, gaps: gaps.length });
  return { generated, gaps: gaps.length };
}

// ── Monitoring ─────────────────────────────────────────────────────────────

export function getSelfHealingStats() {
  return {
    flagged: healingState.flagged,
    healed: healingState.healed,
    reviewed: healingState.reviewed,
    pendingReviews: healingState.pendingReviews.length,
    weakQueries: skillState.weakQueries.length,
    knowledgeGaps: detectKnowledgeGaps(72),
  };
}

export default {
  initSelfHealing,
  flagAndHeal,
  runDreamReview,
  assessFreshness,
  recordWeakQuery,
  detectKnowledgeGaps,
  runSkillBuilding,
  getSelfHealingStats,
};
