/**
 * Concord API Billing Constants — v1.0
 *
 * Developers pay with Concord Coin for API calls.
 * Same coin, same backing, same ecosystem.
 * API spending is economic activity — same fees, same treasury split.
 *
 * The three-gate auth system validates the API key.
 * The metering layer sits between Gate 1 and Gate 2.
 * The coin deduction uses the existing economy module.
 * The fee split uses the existing treasury logic.
 */

// ── Billing Model ────────────────────────────────────────────────────
export const API_BILLING_MODEL = Object.freeze({
  currency: "concord_coin",
  principle: "API consumers are marketplace participants. "
    + "Their spending is economic activity like any other. "
    + "Same fees. Same treasury split. Same coin.",
});

// ── API Key System ───────────────────────────────────────────────────
export const API_KEY_SYSTEM = Object.freeze({
  registration: {
    requires: "concord_account",
    approval: "automatic",
    keyFormat: "ck_live_xxxxxxxxxxxx",
    testKeyFormat: "ck_test_xxxxxxxxxxxx",
    keysPerAccount: 5,
  },

  auth: {
    method: "bearer_token",
    header: "Authorization: Bearer ck_live_xxxx",
    gateIntegration: true,
  },

  rateLimits: {
    free_tier: {
      requestsPerMinute: 30,
      requestsPerDay: 1000,
      concurrentRequests: 5,
    },
    standard: {
      requestsPerMinute: 300,
      requestsPerDay: 50000,
      concurrentRequests: 25,
    },
    enterprise: {
      requestsPerMinute: 3000,
      requestsPerDay: 1000000,
      concurrentRequests: 100,
    },
    tierDetermination: "account_balance",
    tierThresholds: {
      free_tier: 0,
      standard: 100,
      enterprise: 10000,
    },
  },
});

// ── API Pricing — Per Call Metering ──────────────────────────────────
export const API_PRICING = Object.freeze({
  categories: {
    read: {
      costPerCall: 0.0001,
      examples: [
        "GET /api/dtu/:id",
        "GET /api/search",
        "GET /api/marketplace/listings",
        "GET /api/entity/:id",
        "GET /api/leaderboard",
      ],
    },
    write: {
      costPerCall: 0.001,
      examples: [
        "POST /api/dtu/create",
        "POST /api/artifact/upload",
        "POST /api/marketplace/list",
        "POST /api/derivative/declare",
      ],
    },
    compute: {
      costPerCall: 0.01,
      examples: [
        "POST /api/consolidate",
        "POST /api/meta-derive",
        "POST /api/entity/create",
        "POST /api/brain/conscious/query",
        "POST /api/brain/subconscious/generate",
      ],
    },
    storage: {
      costPerCall: 0.0005,
      costPerMB: 0.001,
      examples: [
        "POST /api/vault/store",
        "GET /api/vault/download",
      ],
    },
    cascade: {
      costPerCall: 0,
      marketplaceFeeApplies: true,
      examples: [
        "POST /api/marketplace/purchase",
        "POST /api/cascade/trigger",
      ],
    },
  },

  freeAllowance: {
    readsPerMonth: 10000,
    writesPerMonth: 100,
    computePerMonth: 10,
  },
});

// ── Developer Dashboard ──────────────────────────────────────────────
export const API_DASHBOARD = Object.freeze({
  views: {
    overview: {
      fields: ["currentBalance", "monthlySpend", "callsThisMonth", "currentTier", "nextTierThreshold"],
    },
    usage: {
      categories: ["reads", "writes", "compute", "storage", "cascade"],
      freeFields: ["freeReadsRemaining", "freeWritesRemaining", "freeComputeRemaining"],
    },
    history: {
      daily: { fields: ["date", "calls", "cost"] },
      endpoints: { fields: ["endpoint", "calls", "cost"] },
    },
    keys: {
      fields: ["keyPrefix", "created", "lastUsed", "callsTotal"],
    },
  },
});

// ── API Billing Response Headers ─────────────────────────────────────
export const API_BILLING_HEADERS = Object.freeze({
  headers: {
    "X-Concord-Cost": "cost_of_this_call",
    "X-Concord-Balance": "remaining_balance",
    "X-Concord-Tier": "current_tier",
    "X-Concord-Rate-Remaining": "calls_remaining_this_minute",
    "X-Concord-Free-Remaining": "free_allowance_remaining",
    "X-Concord-Monthly-Spend": "spend_this_month",
  },
});

// ── Balance Alerts ───────────────────────────────────────────────────
export const API_BALANCE_ALERTS = Object.freeze({
  alerts: {
    low_balance: {
      defaultThreshold: 10,
      webhook: true,
      email: true,
    },
    high_spend: {
      defaultThreshold: 100,
      webhook: true,
      email: true,
    },
    tier_change: {
      webhook: true,
      email: true,
    },
    free_exhausted: {
      webhook: true,
      email: true,
    },
  },
});

// ── Flat Constants ───────────────────────────────────────────────────
export const API_CONSTANTS = Object.freeze({
  // Pricing
  READ_COST: 0.0001,
  WRITE_COST: 0.001,
  COMPUTE_COST: 0.01,
  STORAGE_CALL_COST: 0.0005,
  STORAGE_PER_MB_COST: 0.001,
  CASCADE_COST: 0,

  // Free allowance
  FREE_READS_PER_MONTH: 10000,
  FREE_WRITES_PER_MONTH: 100,
  FREE_COMPUTES_PER_MONTH: 10,

  // Tier thresholds (coin balance)
  TIER_FREE: 0,
  TIER_STANDARD: 100,
  TIER_ENTERPRISE: 10000,

  // Rate limits
  FREE_RPM: 30,
  STANDARD_RPM: 300,
  ENTERPRISE_RPM: 3000,
  FREE_RPD: 1000,
  STANDARD_RPD: 50000,
  ENTERPRISE_RPD: 1000000,

  // Fee split (matches company structure)
  TREASURY_SHARE: 0.75,
  INFRA_SHARE: 0.10,
  PAYROLL_SHARE: 0.10,
  OPS_SHARE: 0.05,

  // Keys
  MAX_KEYS_PER_ACCOUNT: 5,
  KEY_PREFIX_LENGTH: 8,
});
