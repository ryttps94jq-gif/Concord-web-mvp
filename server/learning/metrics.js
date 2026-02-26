// learning/metrics.js
// Learning Metrics — Proving the Substrate Learns
//
// Tracks: retrieval hit rate, DTU utilization, novelty verification,
// response quality feedback, domain coverage, generation quotas.
//
// The retrieval hit rate is the north star metric.
// If it's not trending up, the substrate isn't learning.

import { CLASSIFICATIONS, isPublicDTU, classifyDTU } from "./classification.js";

// ── Constants ─────────────────────────────────────────────────────────────────

// Generation quotas
const DEFAULT_QUOTAS = Object.freeze({
  max_autogen_per_hour: 20,
  max_autogen_per_day: 200,
  novelty_throttle: {
    threshold_low: 0.30,    // Below: cut to 25%
    threshold_mid: 0.40,    // Below: cut to 50%
    threshold_high: 0.70,   // Above: full rate
  },
  evolution_ratio: 0.3,      // 30% of cycles should be evolution/synthesis
  min_evolution_ratio: 0.2,  // Never below 20%
});

// Dedup similarity threshold
const DEDUP_SIMILARITY_THRESHOLD = 0.85;

// Probation period
const PROBATION_DAYS = 7;
const PROBATION_MS = PROBATION_DAYS * 24 * 60 * 60 * 1000;

// Pruning thresholds
const PRUNE_ZERO_CITATION_DAYS = 60;
const REPAIR_ARCHIVE_DAYS = 90;

// ── Metrics Store ─────────────────────────────────────────────────────────────

/**
 * Get or initialize the learning metrics store from STATE.
 */
export function getLearningStore(STATE) {
  if (!STATE._learning) {
    STATE._learning = {
      // Retrieval hit rate tracking (hourly buckets)
      retrieval: {
        buckets: [],       // { ts, semantic_cache, retrieval_sufficient, llm_required }
        maxBuckets: 720,   // 30 days of hourly data
      },

      // DTU utilization tracking
      citations: new Map(), // dtuId -> { count, last_cited, positive_signals, negative_signals }

      // Novelty verification
      novelty: {
        daily: [],         // { date, generated, novel, redundant, trivial, rate }
        maxDays: 90,
      },

      // Response quality / helpfulness
      helpfulness: new Map(), // dtuId -> { times_used, positive, negative, score }

      // Generation tracking
      generation: {
        current_hour: null,
        current_hour_count: 0,
        current_day: null,
        current_day_count: 0,
      },

      // Dedup audit results
      dedup: {
        last_run: null,
        last_result: null,
        history: [],        // last 30 runs
      },

      // Pruning history
      pruning: {
        last_run: null,
        history: [],
      },
    };
  }
  return STATE._learning;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. RETRIEVAL HIT RATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record a query event for learning metrics.
 *
 * @param {object} STATE
 * @param {"semantic_cache"|"retrieval_sufficient"|"llm_required"} method
 */
export function recordQueryMethod(STATE, method) {
  const store = getLearningStore(STATE);
  const bucket = getCurrentRetrievalBucket(store);

  switch (method) {
    case "semantic_cache":
      bucket.semantic_cache++;
      break;
    case "retrieval_sufficient":
      bucket.retrieval_sufficient++;
      break;
    case "llm_required":
      bucket.llm_required++;
      break;
  }
  bucket.total++;
}

/**
 * Get retrieval hit rate for a time period.
 *
 * @param {object} STATE
 * @param {number} hours - Period (24, 168, 720)
 * @returns {object} Retrieval hit rate data
 */
export function getRetrievalHitRate(STATE, hours = 24) {
  const store = getLearningStore(STATE);
  const cutoff = Date.now() - hours * 3600000;
  const buckets = store.retrieval.buckets.filter(b => b.ts_epoch > cutoff);

  let total = 0, cache = 0, retrieval = 0, llm = 0;
  for (const b of buckets) {
    total += b.total;
    cache += b.semantic_cache;
    retrieval += b.retrieval_sufficient;
    llm += b.llm_required;
  }

  const hitRate = total > 0 ? Math.round(((cache + retrieval) / total) * 1000) / 1000 : 0;

  return {
    period: `${hours}h`,
    hit_rate: hitRate,
    total_queries: total,
    by_method: {
      semantic_cache: total > 0 ? Math.round((cache / total) * 1000) / 1000 : 0,
      retrieval_sufficient: total > 0 ? Math.round((retrieval / total) * 1000) / 1000 : 0,
      llm_required: total > 0 ? Math.round((llm / total) * 1000) / 1000 : 0,
    },
  };
}

/**
 * Get retrieval hit rate trend.
 */
export function getRetrievalTrend(STATE) {
  const rate24h = getRetrievalHitRate(STATE, 24);
  const rate7d = getRetrievalHitRate(STATE, 168);
  const rate30d = getRetrievalHitRate(STATE, 720);

  // Determine trend
  let trend = "stable";
  if (rate24h.hit_rate > rate7d.hit_rate + 0.02) trend = "increasing";
  else if (rate24h.hit_rate < rate7d.hit_rate - 0.02) trend = "decreasing";

  return {
    last_24h: rate24h.hit_rate,
    last_7d: rate7d.hit_rate,
    last_30d: rate30d.hit_rate,
    trend,
    by_method: rate24h.by_method,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DTU UTILIZATION TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record a DTU citation (it was used in a response).
 *
 * @param {object} STATE
 * @param {string} dtuId
 * @param {boolean} [positive=true] - Was the response positively received?
 */
export function recordCitation(STATE, dtuId, positive = true) {
  const store = getLearningStore(STATE);

  if (!store.citations.has(dtuId)) {
    store.citations.set(dtuId, {
      count: 0,
      last_cited: null,
      first_cited: new Date().toISOString(),
      positive_signals: 0,
      negative_signals: 0,
    });
  }

  const entry = store.citations.get(dtuId);
  entry.count++;
  entry.last_cited = new Date().toISOString();
  if (positive) entry.positive_signals++;
  else entry.negative_signals++;
}

/**
 * Record a negative signal for a DTU (user contradicted the response).
 */
export function recordNegativeSignal(STATE, dtuId) {
  const store = getLearningStore(STATE);
  const entry = store.citations.get(dtuId);
  if (entry) {
    entry.negative_signals++;
  }
}

/**
 * Get DTU utilization stats.
 *
 * @param {object} STATE
 * @param {number} days - Period to measure
 * @returns {object} Utilization data
 */
export function getUtilizationStats(STATE, days = 30) {
  const store = getLearningStore(STATE);
  const dtus = STATE.dtus;
  if (!dtus) return { utilization_rate: 0 };

  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  let publicCount = 0;
  let citedCount = 0;
  let cited1 = 0, cited2to10 = 0, cited10to100 = 0, cited100plus = 0;
  let neverCited7d = 0, neverCited30d = 0;

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  for (const dtu of dtus.values()) {
    if (!isPublicDTU(dtu)) continue;
    publicCount++;

    const citation = store.citations.get(dtu.id);
    if (citation && citation.count > 0) {
      citedCount++;
      if (citation.count === 1) cited1++;
      else if (citation.count <= 10) cited2to10++;
      else if (citation.count <= 100) cited10to100++;
      else cited100plus++;
    } else {
      // Never cited — check age
      const created = dtu.createdAt || dtu.updatedAt || "";
      if (created < sevenDaysAgo) neverCited7d++;
      if (created < thirtyDaysAgo) neverCited30d++;
    }
  }

  return {
    period: `${days}d`,
    dtus_cited_in_responses: citedCount,
    dtus_never_cited: publicCount - citedCount,
    utilization_rate: publicCount > 0 ? Math.round((citedCount / publicCount) * 1000) / 1000 : 0,
    distribution: {
      cited_once: cited1,
      cited_2_to_10: cited2to10,
      cited_10_to_100: cited10to100,
      cited_100_plus: cited100plus,
    },
    dead_weight: {
      never_cited_age_over_7d: neverCited7d,
      never_cited_age_over_30d: neverCited30d,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. NOVELTY VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record a DTU generation event with novelty assessment.
 *
 * @param {object} STATE
 * @param {"novel"|"redundant"|"trivial"} verdict
 */
export function recordGeneration(STATE, verdict) {
  const store = getLearningStore(STATE);
  const today = new Date().toISOString().slice(0, 10);

  let entry = store.novelty.daily.find(d => d.date === today);
  if (!entry) {
    entry = { date: today, generated: 0, novel: 0, redundant: 0, trivial: 0 };
    store.novelty.daily.push(entry);
    if (store.novelty.daily.length > store.novelty.maxDays) {
      store.novelty.daily.shift();
    }
  }

  entry.generated++;
  if (verdict === "novel") entry.novel++;
  else if (verdict === "redundant") entry.redundant++;
  else if (verdict === "trivial") entry.trivial++;
}

/**
 * Get novelty stats for the last 24 hours.
 */
export function getNoveltyStats(STATE) {
  const store = getLearningStore(STATE);
  const today = new Date().toISOString().slice(0, 10);
  const entry = store.novelty.daily.find(d => d.date === today);

  const last24h = entry || { generated: 0, novel: 0, redundant: 0, trivial: 0 };
  const rate = last24h.generated > 0
    ? Math.round((last24h.novel / last24h.generated) * 1000) / 1000
    : 1; // No data = assume novel

  // 30-day trend
  const trend30d = store.novelty.daily.slice(-30).map(d =>
    d.generated > 0 ? Math.round((d.novel / d.generated) * 1000) / 1000 : null
  ).filter(v => v !== null);

  return {
    last_24h: {
      dtus_generated: last24h.generated,
      genuinely_novel: last24h.novel,
      redundant: last24h.redundant,
      trivial: last24h.trivial,
      novelty_rate: rate,
    },
    trend_30d: trend30d,
  };
}

/**
 * Check a candidate DTU for novelty by comparing against existing DTUs.
 * Uses simple text similarity (Jaccard on tokens) as a fast check.
 * For production, this should use cosine similarity on embeddings.
 *
 * @param {object} candidateDTU - The new DTU to check
 * @param {Map} existingDTUs - STATE.dtus
 * @param {object} [opts]
 * @param {number} [opts.threshold=0.85] - Similarity threshold for dedup
 * @param {Function} [opts.cosineSimilarity] - Optional embedding similarity function
 * @returns {{ novel: boolean, most_similar?: object, similarity?: number }}
 */
export function checkNovelty(candidateDTU, existingDTUs, opts = {}) {
  const threshold = opts.threshold || DEDUP_SIMILARITY_THRESHOLD;
  const candidateText = extractText(candidateDTU);
  const candidateTokens = tokenize(candidateText);

  if (candidateTokens.size < 3) {
    return { novel: false, reason: "trivial_content" };
  }

  let maxSimilarity = 0;
  let mostSimilar = null;

  for (const existing of existingDTUs.values()) {
    if (existing.id === candidateDTU.id) continue;
    if (!isPublicDTU(existing)) continue;

    const existingText = extractText(existing);
    const existingTokens = tokenize(existingText);

    const similarity = jaccardSimilarity(candidateTokens, existingTokens);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilar = { id: existing.id, title: existing.title };
    }

    // Early exit for clear duplicate
    if (similarity >= threshold) {
      return {
        novel: false,
        most_similar: mostSimilar,
        similarity: Math.round(maxSimilarity * 1000) / 1000,
        reason: "duplicate",
      };
    }
  }

  return {
    novel: true,
    most_similar: mostSimilar,
    similarity: Math.round(maxSimilarity * 1000) / 1000,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. RESPONSE QUALITY / HELPFULNESS SCORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record response quality signals.
 *
 * @param {object} STATE
 * @param {object} feedback
 * @param {string[]} feedback.dtus_used - DTU IDs used in the response
 * @param {boolean} feedback.user_continued - User continued the conversation
 * @param {boolean} feedback.user_asked_followup - User asked a follow-up
 * @param {boolean} feedback.user_contradicted - User said something was wrong
 */
export function recordResponseQuality(STATE, feedback = {}) {
  const store = getLearningStore(STATE);
  const dtuIds = feedback.dtus_used || [];
  const positive = feedback.user_continued || feedback.user_asked_followup;
  const negative = feedback.user_contradicted;

  for (const dtuId of dtuIds) {
    if (!store.helpfulness.has(dtuId)) {
      store.helpfulness.set(dtuId, {
        times_used: 0,
        positive_signals: 0,
        negative_signals: 0,
        score: 0.5,
      });
    }

    const h = store.helpfulness.get(dtuId);
    h.times_used++;
    if (positive) h.positive_signals++;
    if (negative) h.negative_signals++;

    // Update helpfulness score
    const total = h.positive_signals + h.negative_signals;
    h.score = total > 0
      ? Math.round((h.positive_signals / total) * 100) / 100
      : 0.5;
  }

  // Also record citations
  for (const dtuId of dtuIds) {
    recordCitation(STATE, dtuId, !negative);
  }
}

/**
 * Get helpfulness scores for DTUs.
 */
export function getHelpfulnessScores(STATE, limit = 50) {
  const store = getLearningStore(STATE);
  const entries = Array.from(store.helpfulness.entries())
    .map(([id, h]) => ({ dtu_id: id, ...h }))
    .sort((a, b) => b.score - a.score);

  return {
    top: entries.slice(0, limit),
    bottom: entries.filter(e => e.times_used >= 3).sort((a, b) => a.score - b.score).slice(0, limit),
    total_tracked: entries.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. GENERATION QUOTAS & NOVELTY THROTTLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a generation is allowed under quota limits.
 *
 * @param {object} STATE
 * @returns {{ allowed: boolean, reason?: string, current_rate: number }}
 */
export function checkGenerationQuota(STATE) {
  const store = getLearningStore(STATE);
  const gen = store.generation;
  const quotas = STATE._learningQuotas || DEFAULT_QUOTAS;

  const now = new Date();
  const currentHour = now.toISOString().slice(0, 13);
  const currentDay = now.toISOString().slice(0, 10);

  // Reset hour counter if new hour
  if (gen.current_hour !== currentHour) {
    gen.current_hour = currentHour;
    gen.current_hour_count = 0;
  }

  // Reset day counter if new day
  if (gen.current_day !== currentDay) {
    gen.current_day = currentDay;
    gen.current_day_count = 0;
  }

  // Check hourly limit
  const noveltyRate = getCurrentNoveltyRate(STATE);
  const effectiveHourlyLimit = getEffectiveLimit(quotas.max_autogen_per_hour, noveltyRate, quotas.novelty_throttle);

  if (gen.current_hour_count >= effectiveHourlyLimit) {
    return {
      allowed: false,
      reason: "hourly_limit_reached",
      current_rate: noveltyRate,
      limit: effectiveHourlyLimit,
    };
  }

  // Check daily limit
  const effectiveDailyLimit = getEffectiveLimit(quotas.max_autogen_per_day, noveltyRate, quotas.novelty_throttle);
  if (gen.current_day_count >= effectiveDailyLimit) {
    return {
      allowed: false,
      reason: "daily_limit_reached",
      current_rate: noveltyRate,
      limit: effectiveDailyLimit,
    };
  }

  return {
    allowed: true,
    current_rate: noveltyRate,
    hourly: { used: gen.current_hour_count, limit: effectiveHourlyLimit },
    daily: { used: gen.current_day_count, limit: effectiveDailyLimit },
  };
}

/**
 * Record that a generation occurred (increment counters).
 */
export function recordGenerationUsed(STATE) {
  const store = getLearningStore(STATE);
  const gen = store.generation;

  const now = new Date();
  const currentHour = now.toISOString().slice(0, 13);
  const currentDay = now.toISOString().slice(0, 10);

  if (gen.current_hour !== currentHour) {
    gen.current_hour = currentHour;
    gen.current_hour_count = 0;
  }
  if (gen.current_day !== currentDay) {
    gen.current_day = currentDay;
    gen.current_day_count = 0;
  }

  gen.current_hour_count++;
  gen.current_day_count++;
}

/**
 * Get the effective rate limit based on novelty rate.
 */
function getEffectiveLimit(baseLimit, noveltyRate, throttle) {
  if (noveltyRate < throttle.threshold_low) return Math.ceil(baseLimit * 0.25);
  if (noveltyRate < throttle.threshold_mid) return Math.ceil(baseLimit * 0.5);
  if (noveltyRate >= throttle.threshold_high) return baseLimit;
  return Math.ceil(baseLimit * 0.75); // Between mid and high
}

/**
 * Get the current novelty rate (last 24h).
 */
function getCurrentNoveltyRate(STATE) {
  const stats = getNoveltyStats(STATE);
  return stats.last_24h.novelty_rate;
}

/**
 * Get recommended evolution ratio.
 * If novelty is low, shift more cycles to evolution/synthesis.
 */
export function getRecommendedEvolutionRatio(STATE) {
  const noveltyRate = getCurrentNoveltyRate(STATE);
  const quotas = STATE._learningQuotas || DEFAULT_QUOTAS;

  if (noveltyRate < 0.30) return Math.min(0.6, quotas.evolution_ratio * 2);
  if (noveltyRate < 0.40) return Math.min(0.5, quotas.evolution_ratio * 1.5);
  return Math.max(quotas.min_evolution_ratio, quotas.evolution_ratio);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PROMOTION GATES (Probation System)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a DTU has passed its probation period.
 *
 * @param {object} STATE
 * @param {object} dtu
 * @returns {{ status: "promoted"|"probation"|"demoted", reason: string }}
 */
export function checkProbation(STATE, dtu) {
  if (!dtu || !dtu.createdAt) return { status: "promoted", reason: "no_creation_date" };

  // Seeds are always promoted
  const cls = dtu.classification || classifyDTU(dtu);
  if (cls === "seed") return { status: "promoted", reason: "seed_dtu" };

  // Check age
  const age = Date.now() - new Date(dtu.createdAt).getTime();
  if (age < PROBATION_MS) {
    return { status: "probation", reason: `${Math.floor(age / 86400000)}d of ${PROBATION_DAYS}d probation` };
  }

  // Past probation — check if ever cited
  const store = getLearningStore(STATE);
  const citation = store.citations.get(dtu.id);

  if (!citation || citation.count === 0) {
    return { status: "demoted", reason: "never_cited_after_probation" };
  }

  // Cited at least once — check helpfulness
  const helpfulness = store.helpfulness.get(dtu.id);
  if (helpfulness && helpfulness.negative_signals > helpfulness.positive_signals) {
    return { status: "demoted", reason: "negative_helpfulness" };
  }

  return { status: "promoted", reason: "cited_during_probation" };
}

/**
 * Run probation check on all DTUs and return candidates for reclassification.
 */
export function runProbationAudit(STATE) {
  const results = { promoted: 0, demoted: 0, still_in_probation: 0, candidates: [] };

  for (const dtu of STATE.dtus.values()) {
    if (!isPublicDTU(dtu)) continue;

    const check = checkProbation(STATE, dtu);
    if (check.status === "demoted") {
      results.demoted++;
      results.candidates.push({ id: dtu.id, title: dtu.title, reason: check.reason });
    } else if (check.status === "probation") {
      results.still_in_probation++;
    } else {
      results.promoted++;
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. DOMAIN COVERAGE MAP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute domain coverage statistics.
 *
 * @param {object} STATE
 * @returns {object} Domain coverage data
 */
export function getDomainCoverage(STATE) {
  const store = getLearningStore(STATE);
  const domains = {};

  for (const dtu of STATE.dtus.values()) {
    if (!isPublicDTU(dtu)) continue;

    const tags = Array.isArray(dtu.tags) ? dtu.tags : [];
    const primaryDomain = tags[0] || "untagged";

    if (!domains[primaryDomain]) {
      domains[primaryDomain] = { dtus: 0, utilized: 0, gaps_detected: 0 };
    }

    domains[primaryDomain].dtus++;

    const citation = store.citations.get(dtu.id);
    if (citation && citation.count > 0) {
      domains[primaryDomain].utilized++;
    }
  }

  // Calculate utilization rates
  for (const [name, data] of Object.entries(domains)) {
    data.utilization = data.dtus > 0
      ? Math.round((data.utilized / data.dtus) * 1000) / 1000
      : 0;
  }

  // Concentration index (Herfindahl)
  const totalDTUs = Object.values(domains).reduce((s, d) => s + d.dtus, 0);
  let herfindahl = 0;
  if (totalDTUs > 0) {
    for (const data of Object.values(domains)) {
      const share = data.dtus / totalDTUs;
      herfindahl += share * share;
    }
  }

  // Identify starving vs saturated domains
  const starvingDomains = [];
  const saturatedDomains = [];
  for (const [name, data] of Object.entries(domains)) {
    if (data.dtus < 50 && data.utilization > 0.4) starvingDomains.push(name);
    if (data.dtus > 1000 && data.utilization < 0.15) saturatedDomains.push(name);
  }

  return {
    domains,
    concentration_index: Math.round(herfindahl * 1000) / 1000,
    starving_domains: starvingDomains,
    saturated_domains: saturatedDomains,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. SUBSTRATE PRUNING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run substrate pruning. Reclassifies — never deletes.
 *
 * @param {object} STATE
 * @returns {object} Pruning results
 */
export function runSubstratePruning(STATE) {
  const store = getLearningStore(STATE);
  const now = Date.now();
  const results = {
    scaffold_reclassified: 0,
    deprecated_reclassified: 0,
    repair_archived: 0,
    shadow_archived: 0,
    total_pruned: 0,
  };

  const sixtyDaysAgo = new Date(now - PRUNE_ZERO_CITATION_DAYS * 86400000).toISOString();
  const ninetyDaysAgo = new Date(now - REPAIR_ARCHIVE_DAYS * 86400000).toISOString();

  for (const dtu of STATE.dtus.values()) {
    const cls = dtu.classification || classifyDTU(dtu);

    // Knowledge DTUs with 0 citations in 60 days → scaffold
    if (isPublicDTU(dtu) && cls !== "seed") {
      const citation = store.citations.get(dtu.id);
      const created = dtu.createdAt || "";

      if ((!citation || citation.count === 0) && created < sixtyDaysAgo) {
        dtu.classification = "scaffold";
        dtu._previousClassification = cls;
        dtu._prunedAt = new Date().toISOString();
        results.scaffold_reclassified++;
        results.total_pruned++;
      }

      // DTUs with negative helpfulness → deprecated
      const helpfulness = store.helpfulness.get(dtu.id);
      if (helpfulness && helpfulness.times_used >= 5 &&
          helpfulness.negative_signals > helpfulness.positive_signals * 2) {
        dtu.classification = "deprecated";
        dtu._previousClassification = cls;
        dtu._prunedAt = new Date().toISOString();
        results.deprecated_reclassified++;
        results.total_pruned++;
      }
    }

    // Repair DTUs older than 90 days → archived (deprecated)
    if (cls === "repair") {
      const created = dtu.createdAt || "";
      if (created < ninetyDaysAgo) {
        dtu.classification = "deprecated";
        dtu._previousClassification = "repair";
        dtu._prunedAt = new Date().toISOString();
        results.repair_archived++;
        results.total_pruned++;
      }
    }

    // Shadow DTUs whose parent knowledge DTU was deprecated → deprecated
    if (cls === "shadow" && dtu.meta?.parentDtuId) {
      const parent = STATE.dtus.get(dtu.meta.parentDtuId);
      if (parent && parent.classification === "deprecated") {
        dtu.classification = "deprecated";
        dtu._previousClassification = "shadow";
        dtu._prunedAt = new Date().toISOString();
        results.shadow_archived++;
        results.total_pruned++;
      }
    }
  }

  // Record pruning history
  store.pruning.last_run = new Date().toISOString();
  store.pruning.history.push({
    date: new Date().toISOString(),
    ...results,
  });
  if (store.pruning.history.length > 30) store.pruning.history.shift();

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. LEARNING DASHBOARD — THE FIVE NUMBERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the complete learning dashboard.
 * The five numbers that prove learning.
 *
 * @param {object} STATE
 * @returns {object} Dashboard data
 */
export function getLearningDashboard(STATE) {
  const retrievalTrend = getRetrievalTrend(STATE);
  const noveltyStats = getNoveltyStats(STATE);
  const utilizationStats = getUtilizationStats(STATE);

  return {
    // 1. Retrieval Hit Rate
    retrieval_hit_rate: retrievalTrend,

    // 2. Knowledge DTU Count (from classification)
    // Computed by caller using computeSubstrateStats

    // 3. Novelty Rate
    novelty_rate: noveltyStats.last_24h.novelty_rate,
    novelty_details: noveltyStats,

    // 4. Utilization Rate
    utilization_rate: utilizationStats.utilization_rate,
    utilization_details: utilizationStats,

    // 5. Cost Per Query (from economics.js — caller integrates)
  };
}

/**
 * Run the nightly dedup audit.
 *
 * @param {object} STATE
 * @param {number} [hours=24] - Check DTUs generated in last N hours
 * @returns {object} Dedup audit results
 */
export function runDedupAudit(STATE, hours = 24) {
  const store = getLearningStore(STATE);
  const cutoff = new Date(Date.now() - hours * 3600000).toISOString();

  let checked = 0, novel = 0, redundant = 0, trivial = 0;
  const redundantList = [];

  for (const dtu of STATE.dtus.values()) {
    if (!isPublicDTU(dtu)) continue;
    if ((dtu.createdAt || "") < cutoff) continue;

    checked++;
    const result = checkNovelty(dtu, STATE.dtus);

    if (!result.novel) {
      if (result.reason === "trivial_content") {
        trivial++;
        recordGeneration(STATE, "trivial");
      } else {
        redundant++;
        redundantList.push({
          id: dtu.id,
          title: dtu.title,
          similar_to: result.most_similar,
          similarity: result.similarity,
        });
        recordGeneration(STATE, "redundant");
      }
    } else {
      novel++;
      recordGeneration(STATE, "novel");
    }
  }

  const result = {
    checked,
    novel,
    redundant,
    trivial,
    novelty_rate: checked > 0 ? Math.round((novel / checked) * 1000) / 1000 : 1,
    redundant_dtus: redundantList.slice(0, 20),
    run_at: new Date().toISOString(),
  };

  store.dedup.last_run = result.run_at;
  store.dedup.last_result = result;
  store.dedup.history.push(result);
  if (store.dedup.history.length > 30) store.dedup.history.shift();

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getCurrentRetrievalBucket(store) {
  const hourKey = new Date().toISOString().slice(0, 13);
  const existing = store.retrieval.buckets.find(b => b.hour === hourKey);
  if (existing) return existing;

  const bucket = {
    hour: hourKey,
    ts_epoch: Date.now(),
    total: 0,
    semantic_cache: 0,
    retrieval_sufficient: 0,
    llm_required: 0,
  };
  store.retrieval.buckets.push(bucket);

  if (store.retrieval.buckets.length > store.retrieval.maxBuckets) {
    store.retrieval.buckets.shift();
  }

  return bucket;
}

function extractText(dtu) {
  const parts = [
    dtu.title || "",
    dtu.human?.summary || "",
    dtu.cretiHuman || "",
    dtu.machine?.notes || "",
  ];
  return parts.join(" ").toLowerCase();
}

function tokenize(text) {
  return new Set(
    text.replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length > 2)
  );
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// Re-export for testing
export {
  DEFAULT_QUOTAS, DEDUP_SIMILARITY_THRESHOLD, PROBATION_DAYS,
  PRUNE_ZERO_CITATION_DAYS, REPAIR_ARCHIVE_DAYS,
  jaccardSimilarity, tokenize, extractText,
};
