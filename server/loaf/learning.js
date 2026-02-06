/**
 * LOAF I.2 — Learning Integrity
 *
 * - Per-actor contribution caps (time-windowed)
 * - Diversity weighting (domain + lens)
 * - Outlier suppression
 * - Max epsilon per episode on strategy weights
 * - Reflection output: qcScore, gamingRisk, effectiveScore
 * - Penalize: verbosity inflation, hedging, generic safety padding, low-information answers
 */

const DEFAULT_CONFIG = Object.freeze({
  // Contribution caps
  maxContributionsPerActor: 50,       // per window
  contributionWindowMs: 3600000,      // 1 hour
  // Diversity weighting
  domainDiversityWeight: 0.3,
  lensDiversityWeight: 0.2,
  // Outlier suppression
  outlierZThreshold: 2.5,             // z-score above which contribution is suppressed
  // Strategy weight caps
  maxEpsilonPerEpisode: 0.05,         // max change to strategy weights per episode
  // Gaming risk thresholds
  verbosityInflationThreshold: 0.8,   // ratio of padding to substance
  hedgingPenalty: 0.15,
  safetyPaddingPenalty: 0.10,
  lowInfoPenalty: 0.20,
});

// Per-actor contribution tracking (sliding window)
const actorContributions = new Map(); // actorId -> [{ ts, domain, lens, value }]

/**
 * Track a contribution from an actor.
 * Returns { allowed, remaining, reason } — fail-closed if cap exceeded.
 */
function trackContribution(actorId, domain, lens, value, config = DEFAULT_CONFIG) {
  const now = Date.now();
  const windowStart = now - config.contributionWindowMs;

  // Get or create actor's contribution log
  if (!actorContributions.has(actorId)) {
    actorContributions.set(actorId, []);
  }

  const log = actorContributions.get(actorId);

  // Prune expired contributions
  while (log.length > 0 && log[0].ts < windowStart) {
    log.shift();
  }
  // Clean up empty entries to prevent unbounded Map growth
  if (log.length === 0) {
    actorContributions.delete(actorId);
    actorContributions.set(actorId, log); // re-add for current call
  }

  // Check cap
  if (log.length >= config.maxContributionsPerActor) {
    return {
      allowed: false,
      remaining: 0,
      reason: "contribution_cap_exceeded",
      windowResetMs: log[0] ? (log[0].ts + config.contributionWindowMs) - now : 0,
    };
  }

  // Record contribution
  log.push({ ts: now, domain: String(domain), lens: String(lens || "default"), value });

  return {
    allowed: true,
    remaining: config.maxContributionsPerActor - log.length,
    reason: "ok",
  };
}

/**
 * Compute diversity weight for a set of contributions.
 * Higher diversity = higher weight (prevents monoculture).
 */
function computeDiversityWeight(contributions, config = DEFAULT_CONFIG) {
  if (!contributions || contributions.length === 0) return 1.0;

  // Domain diversity: Shannon entropy over domain distribution
  const domainCounts = {};
  const lensCounts = {};
  for (const c of contributions) {
    domainCounts[c.domain] = (domainCounts[c.domain] || 0) + 1;
    lensCounts[c.lens] = (lensCounts[c.lens] || 0) + 1;
  }

  const n = contributions.length;
  const domainEntropy = shannonEntropy(domainCounts, n);
  const lensEntropy = shannonEntropy(lensCounts, n);

  // Normalize to [0, 1] range (max entropy = log2(n))
  const maxEntropy = Math.log2(Math.max(n, 2));
  const domainDiv = maxEntropy > 0 ? Math.min(domainEntropy / maxEntropy, 1.0) : 0;
  const lensDiv = maxEntropy > 0 ? Math.min(lensEntropy / maxEntropy, 1.0) : 0;

  // Combined diversity weight
  return 1.0 + (config.domainDiversityWeight * domainDiv) + (config.lensDiversityWeight * lensDiv);
}

function shannonEntropy(counts, total) {
  let entropy = 0;
  for (const key of Object.keys(counts)) {
    const p = counts[key] / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Outlier suppression: detect and suppress outlier contributions.
 * Uses z-score approach on contribution values.
 */
function suppressOutliers(values, config = DEFAULT_CONFIG) {
  if (values.length < 3) return { values, suppressed: [] };

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return { values, suppressed: [] };

  const suppressed = [];
  const filtered = values.map((v, i) => {
    const z = Math.abs((v - mean) / stdDev);
    if (z > config.outlierZThreshold) {
      suppressed.push({ index: i, value: v, zScore: z });
      return mean; // Replace outlier with mean
    }
    return v;
  });

  return { values: filtered, suppressed };
}

/**
 * Clamp strategy weight updates to maxEpsilonPerEpisode.
 */
function clampStrategyUpdate(currentWeight, proposedWeight, config = DEFAULT_CONFIG) {
  const delta = proposedWeight - currentWeight;
  const clampedDelta = Math.max(-config.maxEpsilonPerEpisode, Math.min(config.maxEpsilonPerEpisode, delta));
  return currentWeight + clampedDelta;
}

/**
 * Reflection quality assessment.
 * Returns: { qcScore, gamingRisk, effectiveScore, penalties }
 */
function assessReflectionQuality(text, config = DEFAULT_CONFIG) {
  const s = String(text || "");
  const words = s.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Base quality score (0-1)
  let qcScore = 0.5;

  // Reward substance: unique meaningful words ratio
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const uniqueRatio = wordCount > 0 ? uniqueWords.size / wordCount : 0;
  qcScore += uniqueRatio * 0.2;

  // Reward specificity: presence of numbers, proper nouns, technical terms
  const specificityMarkers = (s.match(/\b\d+\.?\d*\b/g) || []).length +
    (s.match(/\b[A-Z][a-z]+[A-Z]\w*/g) || []).length;
  qcScore += Math.min(specificityMarkers * 0.02, 0.15);

  // Detect gaming risks
  const penalties = {};
  let gamingRisk = 0;

  // Verbosity inflation: high word count with low information density
  const avgWordLen = wordCount > 0 ? words.reduce((s, w) => s + w.length, 0) / wordCount : 0;
  const fillerWords = (s.match(/\b(very|really|basically|actually|essentially|simply|just|quite|rather|somewhat|overall)\b/gi) || []).length;
  const fillerRatio = wordCount > 0 ? fillerWords / wordCount : 0;
  if (fillerRatio > 0.05 || (wordCount > 200 && uniqueRatio < 0.3)) {
    const penalty = Math.min(fillerRatio * 2, config.verbosityInflationThreshold) * 0.2;
    penalties.verbosityInflation = penalty;
    gamingRisk += penalty;
  }

  // Hedging detection
  const hedges = (s.match(/\b(maybe|perhaps|might|could be|possibly|arguably|it seems|one might|it appears)\b/gi) || []).length;
  const hedgeRatio = wordCount > 0 ? hedges / wordCount : 0;
  if (hedgeRatio > 0.03) {
    penalties.hedging = config.hedgingPenalty;
    gamingRisk += config.hedgingPenalty;
  }

  // Generic safety padding
  const safetyPhrases = (s.match(/\b(it is important to note|it should be noted|as always|in general|for the most part|broadly speaking)\b/gi) || []).length;
  if (safetyPhrases > 2) {
    penalties.safetyPadding = config.safetyPaddingPenalty;
    gamingRisk += config.safetyPaddingPenalty;
  }

  // Low-information detection
  if (wordCount < 5 || (wordCount > 0 && uniqueRatio < 0.2)) {
    penalties.lowInfo = config.lowInfoPenalty;
    gamingRisk += config.lowInfoPenalty;
  }

  qcScore = Math.max(0, Math.min(1, qcScore));
  gamingRisk = Math.max(0, Math.min(1, gamingRisk));
  const effectiveScore = Math.max(0, qcScore - gamingRisk);

  return { qcScore, gamingRisk, effectiveScore, penalties, wordCount, uniqueRatio };
}

/**
 * Get actor contribution stats for monitoring.
 */
function getActorStats(actorId, config = DEFAULT_CONFIG) {
  const now = Date.now();
  const windowStart = now - config.contributionWindowMs;
  const log = actorContributions.get(actorId) || [];
  const active = log.filter(c => c.ts >= windowStart);
  return {
    actorId,
    contributionsInWindow: active.length,
    cap: config.maxContributionsPerActor,
    remaining: Math.max(0, config.maxContributionsPerActor - active.length),
    diversity: computeDiversityWeight(active, config),
    domains: [...new Set(active.map(c => c.domain))],
    lenses: [...new Set(active.map(c => c.lens))],
  };
}

function init({ register, STATE, helpers }) {
  STATE.__loaf = STATE.__loaf || {};
  STATE.__loaf.learningIntegrity = {
    config: { ...DEFAULT_CONFIG },
    stats: { contributionsTracked: 0, contributionsDenied: 0, outliersSuppressed: 0, reflectionsAssessed: 0 },
  };

  register("loaf.learning", "status", async (ctx) => {
    const li = ctx.state.__loaf.learningIntegrity;
    return { ok: true, config: li.config, stats: li.stats, activeActors: actorContributions.size };
  }, { public: true });

  register("loaf.learning", "track_contribution", async (ctx, input = {}) => {
    const actorId = String(input.actorId || ctx.actor?.id || "anonymous");
    const li = ctx.state.__loaf.learningIntegrity;
    const result = trackContribution(actorId, input.domain, input.lens, input.value, li.config);
    if (result.allowed) {
      li.stats.contributionsTracked++;
    } else {
      li.stats.contributionsDenied++;
    }
    return { ok: true, ...result };
  }, { public: false });

  register("loaf.learning", "assess_reflection", async (ctx, input = {}) => {
    const text = String(input.text || "");
    if (!text) return { ok: false, error: "text required" };
    const li = ctx.state.__loaf.learningIntegrity;
    li.stats.reflectionsAssessed++;
    return { ok: true, ...assessReflectionQuality(text, li.config) };
  }, { public: true });

  register("loaf.learning", "actor_stats", async (ctx, input = {}) => {
    const actorId = String(input.actorId || ctx.actor?.id || "");
    if (!actorId) return { ok: false, error: "actorId required" };
    const li = ctx.state.__loaf.learningIntegrity;
    return { ok: true, ...getActorStats(actorId, li.config) };
  }, { public: true });

  register("loaf.learning", "suppress_outliers", async (ctx, input = {}) => {
    const values = Array.isArray(input.values) ? input.values.map(Number).filter(v => !isNaN(v)) : [];
    if (values.length === 0) return { ok: false, error: "values array required" };
    const li = ctx.state.__loaf.learningIntegrity;
    const result = suppressOutliers(values, li.config);
    li.stats.outliersSuppressed += result.suppressed.length;
    return { ok: true, ...result };
  }, { public: true });

  register("loaf.learning", "clamp_strategy", async (ctx, input = {}) => {
    const current = Number(input.currentWeight ?? 0.5);
    const proposed = Number(input.proposedWeight ?? 0.5);
    const li = ctx.state.__loaf.learningIntegrity;
    const clamped = clampStrategyUpdate(current, proposed, li.config);
    return { ok: true, currentWeight: current, proposedWeight: proposed, clampedWeight: clamped, maxEpsilon: li.config.maxEpsilonPerEpisode };
  }, { public: true });
}

export {
  DEFAULT_CONFIG,
  trackContribution,
  computeDiversityWeight,
  suppressOutliers,
  clampStrategyUpdate,
  assessReflectionQuality,
  getActorStats,
  init,
};
