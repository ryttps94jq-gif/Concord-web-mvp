/**
 * Emergent Agent Governance — Threat Surface Hardening
 *
 * Risk Category 1: Abuse + Security (public launch pain)
 *
 * Problems addressed:
 *   - Cost/DoS via "expensive routes" — any endpoint that triggers LLM work,
 *     heavy retrieval, or bulk ops becomes a DoS magnet when public
 *   - Auth boundary mistakes at the edges — new endpoints added later and
 *     forgotten, or proxy misconfigs that bypass middleware
 *   - Endpoint cost awareness — routes should declare their cost tier so
 *     rate limiting can be proportional
 *
 * Approach:
 *   1. Route Cost Registry — tag every macro/endpoint with a cost tier
 *   2. Tiered Rate Enforcement — cheap ops get generous limits, expensive
 *      ones get tight ones
 *   3. Endpoint Protection Audit — scan registered routes for unprotected ones
 *   4. Cost Budget — per-user cost accounting across all operations
 *   5. Suspicious Pattern Detection — abnormal usage fingerprints
 */

import { getEmergentState } from "./store.js";

// ── Cost Tiers ──────────────────────────────────────────────────────────────

export const COST_TIERS = Object.freeze({
  FREE:      "free",       // health, status, schema — unlimited
  CHEAP:     "cheap",      // reads, queries, metrics — generous limits
  MODERATE:  "moderate",   // writes, proposals, evidence attachment
  EXPENSIVE: "expensive",  // LLM calls, pipeline runs, full scans
  CRITICAL:  "critical",   // admin ops, bulk deletes, weight learning
});

export const ALL_COST_TIERS = Object.freeze(Object.values(COST_TIERS));

// ── Default Rate Limits Per Tier (requests per minute per user) ─────────────

const DEFAULT_TIER_LIMITS = Object.freeze({
  [COST_TIERS.FREE]:      Infinity,
  [COST_TIERS.CHEAP]:     120,
  [COST_TIERS.MODERATE]:  30,
  [COST_TIERS.EXPENSIVE]: 5,
  [COST_TIERS.CRITICAL]:  2,
});

// ── Cost Weights (relative cost units per tier) ─────────────────────────────

const COST_WEIGHTS = Object.freeze({
  [COST_TIERS.FREE]:      0,
  [COST_TIERS.CHEAP]:     1,
  [COST_TIERS.MODERATE]:  5,
  [COST_TIERS.EXPENSIVE]: 25,
  [COST_TIERS.CRITICAL]:  100,
});

// ── Threat Surface Store ────────────────────────────────────────────────────

export function getThreatStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._threatSurface) {
    es._threatSurface = {
      // Route cost registry: macroName -> { tier, description, public }
      routeRegistry: new Map(),

      // Per-user rate tracking: userId -> { tier -> { count, windowStart } }
      userRates: new Map(),

      // Per-user cost budget: userId -> { used, windowStart }
      userCostBudgets: new Map(),

      // Global cost budget
      globalCost: { used: 0, windowStart: Date.now() },

      // Suspicious activity log
      suspiciousActivity: [],

      // Blocked users (temporary)
      blockedUsers: new Map(),   // userId -> { until, reason }

      // Endpoint audit results
      lastAudit: null,

      // Configuration
      config: {
        tierLimits: { ...DEFAULT_TIER_LIMITS },
        costWeights: { ...COST_WEIGHTS },
        perUserCostBudget: 1000,      // cost units per hour
        globalCostBudget: 50000,      // cost units per hour
        windowMs: 60 * 1000,          // 1 minute rate windows
        costWindowMs: 3600 * 1000,    // 1 hour cost windows
        blockDurationMs: 15 * 60 * 1000,  // 15 min temp block
        maxSuspiciousLog: 5000,
      },

      metrics: {
        totalChecks: 0,
        totalBlocked: 0,
        totalSuspicious: 0,
        blocksByTier: {},
        topOffenders: {},   // userId -> blockCount
      },
    };
  }
  return es._threatSurface;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ROUTE COST REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register a macro/endpoint with its cost tier.
 *
 * @param {Object} STATE
 * @param {string} macroName - e.g. "emergent.outcome.learn"
 * @param {string} tier - One of COST_TIERS
 * @param {Object} [opts] - { description, public }
 */
export function registerRouteCost(STATE, macroName, tier, opts = {}) {
  const store = getThreatStore(STATE);
  if (!ALL_COST_TIERS.includes(tier)) {
    return { ok: false, error: "invalid_cost_tier", allowed: ALL_COST_TIERS };
  }
  store.routeRegistry.set(macroName, {
    tier,
    description: opts.description || "",
    public: !!opts.public,
    registeredAt: new Date().toISOString(),
  });
  return { ok: true };
}

/**
 * Bulk-register route costs from a map.
 */
export function registerRouteCosts(STATE, costMap) {
  const store = getThreatStore(STATE);
  let count = 0;
  for (const [macroName, tier] of Object.entries(costMap)) {
    if (ALL_COST_TIERS.includes(tier)) {
      store.routeRegistry.set(macroName, {
        tier,
        description: "",
        public: false,
        registeredAt: new Date().toISOString(),
      });
      count++;
    }
  }
  return { ok: true, registered: count };
}

/**
 * Get the cost tier for a route.
 */
export function getRouteCost(STATE, macroName) {
  const store = getThreatStore(STATE);
  const entry = store.routeRegistry.get(macroName);
  return entry ? entry.tier : COST_TIERS.MODERATE; // default: moderate
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. TIERED RATE ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a request should be allowed based on tiered rate limits.
 *
 * @param {Object} STATE
 * @param {string} userId - User making the request
 * @param {string} macroName - The route being accessed
 * @returns {{ allowed: boolean, tier: string, remaining: number, reason?: string }}
 */
export function checkRateLimit(STATE, userId, macroName) {
  const store = getThreatStore(STATE);
  store.metrics.totalChecks++;

  // Check if user is temporarily blocked
  const block = store.blockedUsers.get(userId);
  if (block && Date.now() < block.until) {
    store.metrics.totalBlocked++;
    return {
      allowed: false,
      tier: "blocked",
      remaining: 0,
      reason: `temporarily_blocked: ${block.reason}`,
      blockedUntil: new Date(block.until).toISOString(),
    };
  } else if (block) {
    store.blockedUsers.delete(userId);
  }

  const tier = getRouteCost(STATE, macroName);
  const limit = store.config.tierLimits[tier];

  if (limit === Infinity) {
    return { allowed: true, tier, remaining: Infinity };
  }

  // Get or create user rate entry
  if (!store.userRates.has(userId)) {
    store.userRates.set(userId, {});
  }
  const userRates = store.userRates.get(userId);
  const now = Date.now();

  if (!userRates[tier] || now - userRates[tier].windowStart > store.config.windowMs) {
    userRates[tier] = { count: 0, windowStart: now };
  }

  userRates[tier].count++;
  const remaining = Math.max(0, limit - userRates[tier].count);

  if (userRates[tier].count > limit) {
    store.metrics.totalBlocked++;
    store.metrics.blocksByTier[tier] = (store.metrics.blocksByTier[tier] || 0) + 1;

    recordSuspicious(store, userId, "rate_limit_exceeded", {
      tier, macroName, count: userRates[tier].count, limit,
    });

    return {
      allowed: false,
      tier,
      remaining: 0,
      reason: `rate_limit_exceeded: ${tier} tier allows ${limit}/min`,
      retryAfterMs: store.config.windowMs - (now - userRates[tier].windowStart),
    };
  }

  return { allowed: true, tier, remaining };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. COST BUDGET ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check and deduct from per-user cost budget.
 *
 * @param {Object} STATE
 * @param {string} userId
 * @param {string} macroName
 * @returns {{ allowed: boolean, costUsed: number, costRemaining: number }}
 */
export function checkCostBudget(STATE, userId, macroName) {
  const store = getThreatStore(STATE);
  const tier = getRouteCost(STATE, macroName);
  const cost = store.config.costWeights[tier] || 0;

  if (cost === 0) return { allowed: true, costUsed: 0, costRemaining: Infinity };

  const now = Date.now();

  // Per-user budget
  if (!store.userCostBudgets.has(userId)) {
    store.userCostBudgets.set(userId, { used: 0, windowStart: now });
  }
  const userBudget = store.userCostBudgets.get(userId);
  if (now - userBudget.windowStart > store.config.costWindowMs) {
    userBudget.used = 0;
    userBudget.windowStart = now;
  }

  // Global budget
  if (now - store.globalCost.windowStart > store.config.costWindowMs) {
    store.globalCost.used = 0;
    store.globalCost.windowStart = now;
  }

  const userRemaining = store.config.perUserCostBudget - userBudget.used;
  const globalRemaining = store.config.globalCostBudget - store.globalCost.used;

  if (cost > userRemaining) {
    recordSuspicious(store, userId, "user_cost_budget_exhausted", {
      tier, macroName, used: userBudget.used, limit: store.config.perUserCostBudget,
    });
    return {
      allowed: false,
      costUsed: userBudget.used,
      costRemaining: userRemaining,
      reason: "user_cost_budget_exhausted",
    };
  }

  if (cost > globalRemaining) {
    return {
      allowed: false,
      costUsed: store.globalCost.used,
      costRemaining: globalRemaining,
      reason: "global_cost_budget_exhausted",
    };
  }

  // Deduct
  userBudget.used += cost;
  store.globalCost.used += cost;

  return {
    allowed: true,
    costUsed: userBudget.used,
    costRemaining: store.config.perUserCostBudget - userBudget.used,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ENDPOINT PROTECTION AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Audit all registered routes for security issues.
 * Returns unprotected endpoints, mis-tiered routes, and policy violations.
 *
 * @param {Object} STATE
 * @returns {{ ok: boolean, issues: Object[], score: number }}
 */
export function auditEndpoints(STATE) {
  const store = getThreatStore(STATE);
  const issues = [];

  // Check for unregistered routes (no cost tier)
  // We can't see all HTTP routes from here, but we can audit the macro registry
  const registry = store.routeRegistry;

  // Check for expensive public routes
  for (const [name, entry] of registry) {
    if (entry.public && (entry.tier === COST_TIERS.EXPENSIVE || entry.tier === COST_TIERS.CRITICAL)) {
      issues.push({
        severity: "high",
        type: "expensive_public_route",
        route: name,
        tier: entry.tier,
        message: `Public route "${name}" has ${entry.tier} cost tier — vulnerable to abuse`,
        recommendation: "Add stricter rate limits or require authentication",
      });
    }
  }

  // Check for routes without cost classification
  const unclassified = [];
  for (const [name] of registry) {
    if (!registry.get(name).tier) {
      unclassified.push(name);
    }
  }
  if (unclassified.length > 0) {
    issues.push({
      severity: "medium",
      type: "unclassified_routes",
      routes: unclassified,
      message: `${unclassified.length} routes have no cost tier classification`,
      recommendation: "Classify all routes with registerRouteCost()",
    });
  }

  // Compute security score (0-100)
  const totalRoutes = registry.size || 1;
  const highIssues = issues.filter(i => i.severity === "high").length;
  const medIssues = issues.filter(i => i.severity === "medium").length;
  const score = Math.max(0, 100 - (highIssues * 15) - (medIssues * 5));

  store.lastAudit = {
    timestamp: new Date().toISOString(),
    totalRoutes,
    issues: issues.length,
    score,
  };

  return { ok: true, issues, score, totalRoutes };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SUSPICIOUS PATTERN DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze user activity for suspicious patterns.
 *
 * @param {Object} STATE
 * @param {string} userId
 * @returns {{ ok: boolean, suspicious: boolean, patterns: Object[] }}
 */
export function analyzeUserActivity(STATE, userId) {
  const store = getThreatStore(STATE);
  const patterns = [];

  // Check rate violations in recent history
  const userActivity = store.suspiciousActivity.filter(
    a => a.userId === userId && Date.now() - new Date(a.timestamp).getTime() < 3600 * 1000
  );

  const rateLimitHits = userActivity.filter(a => a.type === "rate_limit_exceeded");
  const budgetExhausts = userActivity.filter(a => a.type === "user_cost_budget_exhausted");

  if (rateLimitHits.length >= 10) {
    patterns.push({
      type: "persistent_rate_abuse",
      severity: "high",
      count: rateLimitHits.length,
      message: `${rateLimitHits.length} rate limit violations in the last hour`,
    });
  }

  if (budgetExhausts.length >= 3) {
    patterns.push({
      type: "budget_exhaustion_pattern",
      severity: "high",
      count: budgetExhausts.length,
      message: `Repeatedly exhausting cost budget — possible resource abuse`,
    });
  }

  // Check for tier escalation (many cheap then suddenly expensive)
  const userRates = store.userRates.get(userId);
  if (userRates) {
    const cheapCount = userRates[COST_TIERS.CHEAP]?.count || 0;
    const expensiveCount = userRates[COST_TIERS.EXPENSIVE]?.count || 0;
    if (cheapCount > 50 && expensiveCount > 3) {
      patterns.push({
        type: "reconnaissance_pattern",
        severity: "medium",
        message: "High volume of cheap requests followed by expensive ones — possible probing",
        data: { cheapCount, expensiveCount },
      });
    }
  }

  const suspicious = patterns.some(p => p.severity === "high");

  // Auto-block on severe patterns
  if (patterns.filter(p => p.severity === "high").length >= 2) {
    blockUser(store, userId, "auto_blocked_suspicious_patterns");
  }

  return { ok: true, suspicious, patterns, userId };
}

/**
 * Temporarily block a user.
 */
export function blockUser(storeOrState, userId, reason) {
  const store = storeOrState.blockedUsers ? storeOrState : getThreatStore(storeOrState);
  const actualStore = store.blockedUsers ? store : getThreatStore(store);
  actualStore.blockedUsers.set(userId, {
    until: Date.now() + actualStore.config.blockDurationMs,
    reason: reason || "manual_block",
    blockedAt: new Date().toISOString(),
  });

  actualStore.metrics.topOffenders[userId] = (actualStore.metrics.topOffenders[userId] || 0) + 1;
  return { ok: true };
}

/**
 * Unblock a user.
 */
export function unblockUser(STATE, userId) {
  const store = getThreatStore(STATE);
  store.blockedUsers.delete(userId);
  return { ok: true };
}

/**
 * Update rate limit configuration.
 */
export function updateThreatConfig(STATE, overrides = {}) {
  const store = getThreatStore(STATE);
  for (const [key, value] of Object.entries(overrides)) {
    if (key in store.config && typeof value === typeof store.config[key]) {
      store.config[key] = value;
    }
  }
  return { ok: true, config: { ...store.config } };
}

/**
 * Get threat surface metrics.
 */
export function getThreatMetrics(STATE) {
  const store = getThreatStore(STATE);
  return {
    ok: true,
    metrics: { ...store.metrics },
    registeredRoutes: store.routeRegistry.size,
    blockedUsers: store.blockedUsers.size,
    suspiciousEvents: store.suspiciousActivity.length,
    lastAudit: store.lastAudit,
    config: { ...store.config },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function recordSuspicious(store, userId, type, data) {
  store.suspiciousActivity.push({
    userId,
    type,
    data,
    timestamp: new Date().toISOString(),
  });
  store.metrics.totalSuspicious++;

  if (store.suspiciousActivity.length > store.config.maxSuspiciousLog) {
    store.suspiciousActivity = store.suspiciousActivity.slice(-Math.floor(store.config.maxSuspiciousLog / 2));
  }
}
