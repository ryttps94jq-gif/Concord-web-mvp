/**
 * LOAF I.3 — Transfer Learning Hardening
 *
 * - Track negative-transfer events
 * - Cooldown failed transfers
 * - Similarity threshold for proposal
 * - Higher threshold for auto-apply
 */

const DEFAULT_CONFIG = Object.freeze({
  similarityThresholdProposal: 0.4,     // minimum similarity to propose a transfer
  similarityThresholdAutoApply: 0.75,    // minimum similarity for auto-apply
  cooldownMs: 600000,                    // 10 minute cooldown after failure
  maxNegativeTransfers: 5,               // max consecutive negatives before hard block
  negativeTransferDecayMs: 3600000,      // 1 hour decay window for negative events
});

// Track negative transfer events
const negativeTransfers = new Map(); // `${sourceDomain}->${targetDomain}` -> [{ ts, reason, severity }]
// Cooldown map
const cooldowns = new Map(); // `${sourceDomain}->${targetDomain}` -> { until, reason }

/**
 * Record a negative transfer event.
 */
function recordNegativeTransfer(sourceDomain, targetDomain, reason, severity = 1.0) {
  const key = `${sourceDomain}->${targetDomain}`;
  if (!negativeTransfers.has(key)) {
    negativeTransfers.set(key, []);
  }

  const events = negativeTransfers.get(key);
  events.push({
    ts: Date.now(),
    reason: String(reason),
    severity: Math.max(0, Math.min(1, severity)),
  });

  // Trim old events
  const cutoff = Date.now() - DEFAULT_CONFIG.negativeTransferDecayMs;
  while (events.length > 0 && events[0].ts < cutoff) {
    events.shift();
  }

  // Cap total domain pairs tracked to prevent unbounded growth
  if (negativeTransfers.size > 10000) {
    const oldest = negativeTransfers.keys().next().value;
    negativeTransfers.delete(oldest);
  }

  return { recorded: true, key, totalEvents: events.length };
}

/**
 * Apply cooldown to a failed transfer pair.
 */
function applyCooldown(sourceDomain, targetDomain, reason, config = DEFAULT_CONFIG) {
  const key = `${sourceDomain}->${targetDomain}`;
  cooldowns.set(key, {
    until: Date.now() + config.cooldownMs,
    reason: String(reason),
    appliedAt: new Date().toISOString(),
  });
  return { cooledDown: true, key, durationMs: config.cooldownMs };
}

/**
 * Check if a transfer pair is currently on cooldown.
 */
function isOnCooldown(sourceDomain, targetDomain) {
  const key = `${sourceDomain}->${targetDomain}`;
  const cd = cooldowns.get(key);
  if (!cd) return { onCooldown: false };
  if (Date.now() >= cd.until) {
    cooldowns.delete(key);
    return { onCooldown: false };
  }
  return { onCooldown: true, remainingMs: cd.until - Date.now(), reason: cd.reason };
}

/**
 * Check if a transfer pair has too many negative events (hard block).
 */
function isHardBlocked(sourceDomain, targetDomain, config = DEFAULT_CONFIG) {
  const key = `${sourceDomain}->${targetDomain}`;
  const events = negativeTransfers.get(key) || [];
  const cutoff = Date.now() - config.negativeTransferDecayMs;
  const recentEvents = events.filter(e => e.ts >= cutoff);
  return {
    blocked: recentEvents.length >= config.maxNegativeTransfers,
    recentNegatives: recentEvents.length,
    threshold: config.maxNegativeTransfers,
  };
}

/**
 * Compute similarity score between two domain representations.
 * Uses simple Jaccard on feature sets.
 */
function computeSimilarity(featuresA, featuresB) {
  if (!featuresA || !featuresB) return 0;

  const setA = new Set(Array.isArray(featuresA) ? featuresA : Object.keys(featuresA));
  const setB = new Set(Array.isArray(featuresB) ? featuresB : Object.keys(featuresB));

  if (setA.size === 0 && setB.size === 0) return 1;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Evaluate whether a transfer should be proposed, auto-applied, or blocked.
 * Returns: { decision: "blocked"|"cooldown"|"propose"|"auto_apply", similarity, reason }
 */
function evaluateTransfer(sourceDomain, targetDomain, featuresA, featuresB, config = DEFAULT_CONFIG) {
  // Check hard block first
  const block = isHardBlocked(sourceDomain, targetDomain, config);
  if (block.blocked) {
    return { decision: "blocked", similarity: 0, reason: "too_many_negative_transfers", ...block };
  }

  // Check cooldown
  const cd = isOnCooldown(sourceDomain, targetDomain);
  if (cd.onCooldown) {
    return { decision: "cooldown", similarity: 0, reason: "on_cooldown", ...cd };
  }

  // Compute similarity
  const similarity = computeSimilarity(featuresA, featuresB);

  if (similarity >= config.similarityThresholdAutoApply) {
    return { decision: "auto_apply", similarity, reason: "high_similarity" };
  }

  if (similarity >= config.similarityThresholdProposal) {
    return { decision: "propose", similarity, reason: "sufficient_similarity" };
  }

  return { decision: "blocked", similarity, reason: "insufficient_similarity" };
}

/**
 * Get transfer health report for a domain pair.
 */
function getTransferHealth(sourceDomain, targetDomain, config = DEFAULT_CONFIG) {
  const key = `${sourceDomain}->${targetDomain}`;
  const events = negativeTransfers.get(key) || [];
  const cutoff = Date.now() - config.negativeTransferDecayMs;
  const recentEvents = events.filter(e => e.ts >= cutoff);
  const cd = isOnCooldown(sourceDomain, targetDomain);
  const block = isHardBlocked(sourceDomain, targetDomain, config);

  return {
    key,
    recentNegatives: recentEvents.length,
    totalHistorical: events.length,
    onCooldown: cd.onCooldown,
    cooldownRemainingMs: cd.remainingMs || 0,
    hardBlocked: block.blocked,
    avgSeverity: recentEvents.length > 0
      ? recentEvents.reduce((s, e) => s + e.severity, 0) / recentEvents.length
      : 0,
  };
}

function init({ register, STATE, helpers }) {
  STATE.__loaf = STATE.__loaf || {};
  STATE.__loaf.transferHardening = {
    config: { ...DEFAULT_CONFIG },
    stats: { evaluations: 0, proposals: 0, autoApplied: 0, blocked: 0, negativeRecorded: 0, cooldownsApplied: 0 },
  };

  register("loaf.transfer", "status", async (ctx) => {
    const th = ctx.state.__loaf.transferHardening;
    return {
      ok: true,
      config: th.config,
      stats: th.stats,
      activeCooldowns: cooldowns.size,
      trackedPairs: negativeTransfers.size,
    };
  }, { public: true });

  register("loaf.transfer", "evaluate", async (ctx, input = {}) => {
    const th = ctx.state.__loaf.transferHardening;
    th.stats.evaluations++;
    const result = evaluateTransfer(
      String(input.sourceDomain || ""),
      String(input.targetDomain || ""),
      input.featuresA,
      input.featuresB,
      th.config
    );
    if (result.decision === "propose") th.stats.proposals++;
    else if (result.decision === "auto_apply") th.stats.autoApplied++;
    else if (result.decision === "blocked" || result.decision === "cooldown") th.stats.blocked++;
    return { ok: true, ...result };
  }, { public: true });

  register("loaf.transfer", "record_negative", async (ctx, input = {}) => {
    const th = ctx.state.__loaf.transferHardening;
    const result = recordNegativeTransfer(
      String(input.sourceDomain || ""),
      String(input.targetDomain || ""),
      input.reason,
      input.severity
    );
    th.stats.negativeRecorded++;

    // Auto-cooldown on negative transfer
    if (result.totalEvents >= 2) {
      applyCooldown(input.sourceDomain, input.targetDomain, "auto_cooldown_after_negatives", th.config);
      th.stats.cooldownsApplied++;
    }

    return { ok: true, ...result };
  }, { public: false });

  register("loaf.transfer", "health", async (ctx, input = {}) => {
    const th = ctx.state.__loaf.transferHardening;
    return { ok: true, ...getTransferHealth(input.sourceDomain, input.targetDomain, th.config) };
  }, { public: true });
}

export {
  DEFAULT_CONFIG,
  recordNegativeTransfer,
  applyCooldown,
  isOnCooldown,
  isHardBlocked,
  computeSimilarity,
  evaluateTransfer,
  getTransferHealth,
  init,
};
