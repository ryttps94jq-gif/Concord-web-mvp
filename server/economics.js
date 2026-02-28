/**
 * Inverted Economics Tracking for Concord Cognitive Engine
 *
 * Tracks and displays the metrics that prove the inverted economics
 * model — cost per user decreasing over time as the substrate matures.
 *
 * Key insight: as the DTU substrate grows, more queries are answered
 * via cache/retrieval (near-zero cost) rather than full LLM inference.
 */

// ── Configuration ──────────────────────────────────────────────────────────
const CPU_COST_PER_MONTH = 112; // $112/month server cost
const CPU_COST_PER_SECOND = CPU_COST_PER_MONTH / 30 / 24 / 3600;

// ── State ──────────────────────────────────────────────────────────────────

/** @type {{ hourly: { ts: string, queries: number, cacheHits: number, retrievalOnly: number, fullInference: number, inferenceSeconds: number, activeUsers: Set<string> }[] }} */
const economicsData = {
  hourly: [],
  maxHourlyEntries: 720, // 30 days of hourly data
};

/** Track current hour */
let currentHourBucket = null;

/** @type {Function|null} */
let _log = null;

// ── Initialisation ─────────────────────────────────────────────────────────

export function initEconomics({ structuredLog = console.warn } = {}) {
  _log = structuredLog;
  _log("info", "economics_init", { costPerMonth: CPU_COST_PER_MONTH });
}

// ── Recording ──────────────────────────────────────────────────────────────

/**
 * Record a query event for economics tracking.
 *
 * @param {{ type: "cache"|"retrieval"|"inference", inferenceMs?: number, userId?: string }} event
 */
export function recordEconomicsEvent({ type, inferenceMs = 0, userId = "anonymous" }) {
  const bucket = _getCurrentBucket();
  bucket.queries++;

  switch (type) {
    case "cache":
      bucket.cacheHits++;
      break;
    case "retrieval":
      bucket.retrievalOnly++;
      break;
    case "inference":
      bucket.fullInference++;
      bucket.inferenceSeconds += inferenceMs / 1000;
      break;
  }

  bucket.activeUsers.add(userId);
}

// ── Calculations ───────────────────────────────────────────────────────────

/**
 * Calculate economics for a given time period.
 *
 * @param {number} hours - Period to calculate for
 * @returns {object}
 */
export function calculateEconomics(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  const relevantBuckets = economicsData.hourly.filter(b => b.ts >= cutoff);

  let totalQueries = 0, cacheHits = 0, retrievalOnly = 0, fullInference = 0;
  let totalInferenceSeconds = 0;
  const allUsers = new Set();

  for (const bucket of relevantBuckets) {
    totalQueries += bucket.queries;
    cacheHits += bucket.cacheHits;
    retrievalOnly += bucket.retrievalOnly;
    fullInference += bucket.fullInference;
    totalInferenceSeconds += bucket.inferenceSeconds;
    for (const u of bucket.activeUsers) allUsers.add(u);
  }

  const activeUsers = Math.max(allUsers.size, 1);
  const actualComputeCost = totalInferenceSeconds * CPU_COST_PER_SECOND;

  // What it WOULD have cost without caching/retrieval
  const avgInferenceTime = fullInference > 0 ? totalInferenceSeconds / fullInference : 5; // assume 5s default
  const theoreticalCost = totalQueries * avgInferenceTime * CPU_COST_PER_SECOND;

  return {
    period: `${hours}h`,
    totalQueries,
    cacheHits,
    cacheHitRate: totalQueries > 0 ? Math.round((cacheHits / totalQueries) * 1000) / 1000 : 0,
    retrievalOnly,
    retrievalRate: totalQueries > 0 ? Math.round((retrievalOnly / totalQueries) * 1000) / 1000 : 0,
    fullInference,
    inferenceRate: totalQueries > 0 ? Math.round((fullInference / totalQueries) * 1000) / 1000 : 0,
    activeUsers,
    costPerUser: activeUsers > 0 ? Math.round((actualComputeCost / activeUsers) * 10000) / 10000 : 0,
    costWithoutOptimization: activeUsers > 0 ? Math.round((theoreticalCost / activeUsers) * 10000) / 10000 : 0,
    savings: theoreticalCost > 0 ? Math.round((1 - actualComputeCost / theoreticalCost) * 1000) / 1000 : 0,
    actualComputeCost: Math.round(actualComputeCost * 10000) / 10000,
    theoreticalComputeCost: Math.round(theoreticalCost * 10000) / 10000,
  };
}

/**
 * Get cost-per-user trend over N days.
 *
 * @param {number} days
 * @returns {{ date: string, costPerUser: number, cacheHitRate: number, activeUsers: number }[]}
 */
export function getCostPerUserTrend(days = 30) {
  const trend = [];

  for (let d = days - 1; d >= 0; d--) {
    const dayStart = new Date(Date.now() - (d + 1) * 86400_000).toISOString();
    const dayEnd = new Date(Date.now() - d * 86400_000).toISOString();

    const dayBuckets = economicsData.hourly.filter(b => b.ts >= dayStart && b.ts < dayEnd);

    let queries = 0, cache = 0, inference = 0, infSec = 0;
    const users = new Set();

    for (const b of dayBuckets) {
      queries += b.queries;
      cache += b.cacheHits;
      inference += b.fullInference;
      infSec += b.inferenceSeconds;
      for (const u of b.activeUsers) users.add(u);
    }

    const activeUsers = Math.max(users.size, 1);
    const cost = infSec * CPU_COST_PER_SECOND;

    trend.push({
      date: dayStart.split("T")[0],
      costPerUser: Math.round((cost / activeUsers) * 10000) / 10000,
      cacheHitRate: queries > 0 ? Math.round((cache / queries) * 1000) / 1000 : 0,
      activeUsers: users.size,
      totalQueries: queries,
    });
  }

  return trend;
}

/**
 * Project costs at different user scales.
 *
 * @param {number} targetUsers
 * @returns {object}
 */
export function projectCosts(targetUsers = 10000) {
  const current = calculateEconomics(168); // Last 7 days
  const currentUsers = Math.max(current.activeUsers, 1);

  // Key insight: cache hit rate IMPROVES with more users
  // because more diverse queries fill the substrate
  const scaleFactors = [
    { users: currentUsers, cacheRate: current.cacheHitRate, retrievalRate: current.retrievalRate },
    { users: 100, cacheRate: Math.min(0.95, current.cacheHitRate * 1.3), retrievalRate: Math.min(0.95, current.retrievalRate * 1.2) },
    { users: 1000, cacheRate: Math.min(0.95, current.cacheHitRate * 1.6), retrievalRate: Math.min(0.95, current.retrievalRate * 1.5) },
    { users: 10000, cacheRate: Math.min(0.98, current.cacheHitRate * 2.0), retrievalRate: Math.min(0.98, current.retrievalRate * 1.8) },
    { users: 100000, cacheRate: 0.99, retrievalRate: 0.95 },
  ];

  return {
    currentCostPerUser: current.costPerUser,
    projections: scaleFactors.map(sf => {
      const inferenceRate = Math.max(0.01, 1 - sf.cacheRate - sf.retrievalRate);
      const queriesPerUser = current.totalQueries / currentUsers;
      const totalInference = sf.users * queriesPerUser * inferenceRate;
      const avgInfTime = current.fullInference > 0 ? (current.totalQueries * current.inferenceRate * 5) / current.fullInference : 5;
      const cost = totalInference * avgInfTime * CPU_COST_PER_SECOND;

      return {
        users: sf.users,
        projectedCacheRate: sf.cacheRate,
        projectedRetrievalRate: sf.retrievalRate,
        projectedInferenceRate: inferenceRate,
        costPerUser: Math.round((cost / sf.users) * 10000) / 10000,
        monthlyCost: Math.round(cost * 30 * 100) / 100,
      };
    }),
  };
}

// ── Internal Helpers ───────────────────────────────────────────────────────

function _getCurrentBucket() {
  const hourKey = new Date().toISOString().slice(0, 13); // "2026-02-22T16"

  if (currentHourBucket && currentHourBucket.ts.startsWith(hourKey)) {
    return currentHourBucket;
  }

  // New hour — create bucket
  currentHourBucket = {
    ts: new Date().toISOString(),
    queries: 0,
    cacheHits: 0,
    retrievalOnly: 0,
    fullInference: 0,
    inferenceSeconds: 0,
    activeUsers: new Set(),
  };

  economicsData.hourly.push(currentHourBucket);

  // Trim old data
  if (economicsData.hourly.length > economicsData.maxHourlyEntries) {
    economicsData.hourly = economicsData.hourly.slice(-economicsData.maxHourlyEntries);
  }

  return currentHourBucket;
}

// ── Monitoring ─────────────────────────────────────────────────────────────

export function getEconomicsStats() {
  return {
    current: calculateEconomics(24),
    trend: getCostPerUserTrend(30),
    projection: projectCosts(10000),
  };
}

export default {
  initEconomics,
  recordEconomicsEvent,
  calculateEconomics,
  getCostPerUserTrend,
  projectCosts,
  getEconomicsStats,
};
