/**
 * Event Scoping — Scoped Not Global, Pull Not Push
 *
 * Three layers of scoping that keep the platform usable:
 *
 *   Layer 1: Event DTUs land in their home lens ONLY (EVENT_SCOPE_MAP)
 *   Layer 2: Users subscribe to lenses they want (UserSubscription)
 *   Layer 3: The News lens is the hub — personalized, CRETI-filtered
 *
 * Core invariants:
 *   - localPush = false  → event DTUs NEVER force into local substrate
 *   - localPull = true   → available when the user requests them
 *   - No algorithm. No engagement optimization. No outrage amplification.
 *   - CRETI thresholds set by users structurally eliminate misinformation
 *   - Cross-lens relevance handled by citation, not flooding
 */

// ── Event Scope Map ──────────────────────────────────────────────────────────
// Every event type has a whitelist of lenses it can populate.
// If you're not on the list you don't get the DTU. Period.

export const EVENT_SCOPE_MAP = Object.freeze({
  // News events — scoped to relevant domain lenses
  "news:politics":    ["news", "governance", "law"],
  "news:science":     ["news", "science", "research"],
  "news:economics":   ["news", "economics", "market"],
  "news:health":      ["news", "healthcare", "bio"],
  "news:tech":        ["news", "technology", "engineering"],
  "news:sports":      ["news", "sports"],
  "news:culture":     ["news", "culture", "arts"],
  "news:environment": ["news", "environment", "science"],
  "news:education":   ["news", "education"],
  "news:legal":       ["news", "law", "legal"],
  "news:energy":      ["news", "energy", "environment"],
  "news:finance":     ["news", "economics", "finance"],

  // Market events — economics domain only
  "market:trade":     ["economics", "market"],
  "market:crypto":    ["economics", "market", "crypto"],
  "market:commodity": ["economics", "market"],
  "market:forex":     ["economics", "market"],

  // Council/governance events — governance domain only
  "council:vote":     ["governance"],
  "council:proposal": ["governance", "law"],
  "council:ruling":   ["governance", "law"],

  // System events — system lens only
  "repair:cycle_complete": ["system"],
  "repair:anomaly":        ["system"],
  "system:heartbeat":      ["system"],
  "system:migration":      ["system"],

  // Cognition events — cognition lens only
  "dream:captured":       ["cognition"],
  "dream:consolidated":   ["cognition"],
  "cognition:synthesis":  ["cognition", "research"],

  // Research events — scoped to research domains
  "research:paper":       ["research", "science"],
  "research:breakthrough": ["research", "science", "news"],
  "research:replication":  ["research", "science"],

  // Health events — healthcare domain
  "health:alert":    ["healthcare", "bio", "news"],
  "health:advisory": ["healthcare", "bio"],
  "health:recall":   ["healthcare", "news"],

  // Weather/environment
  "weather:alert":     ["environment", "news"],
  "weather:forecast":  ["environment"],
  "climate:report":    ["environment", "science", "news"],
});

// ── Scope DTU Flags ──────────────────────────────────────────────────────────
// The two critical flags that define pull-not-push architecture.

export const SCOPE_FLAGS = Object.freeze({
  global: false,       // NEVER global — always scoped to specific lenses
  newsVisible: true,   // Always visible in News lens (the hub)
  localPush: false,    // NEVER pushed to local substrate
  localPull: true,     // Available when user requests
});

// ── User Subscription Model ──────────────────────────────────────────────────
// Users control which lenses feed into their local substrate.

/**
 * Create a default user subscription.
 * New users start with no subscriptions — they opt in to what they want.
 */
export function createDefaultSubscription(userId) {
  return {
    userId,
    subscribedLenses: [],
    newsFilters: {
      domains: [],           // empty = see all subscribed domains in News
      minCRETI: 0,           // no quality filter by default
      minConfidence: 0,      // no confidence filter by default
      maxPerHour: 50,        // default rate limit per hour
    },
    localSubstrate: {
      allowEventDTUs: true,
      scopeToSubscribed: true,  // ONLY from subscribed lenses
      autoCompress: true,       // compress old event DTUs automatically
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validate a user subscription object.
 * Returns { ok, errors }.
 */
export function validateSubscription(sub) {
  const errors = [];

  if (!sub.userId) errors.push("missing_user_id");
  if (!Array.isArray(sub.subscribedLenses)) errors.push("subscribedLenses_must_be_array");
  if (sub.newsFilters) {
    if (typeof sub.newsFilters.minCRETI !== "number" || sub.newsFilters.minCRETI < 0 || sub.newsFilters.minCRETI > 100) {
      errors.push("minCRETI_must_be_0_to_100");
    }
    if (typeof sub.newsFilters.minConfidence !== "number" || sub.newsFilters.minConfidence < 0 || sub.newsFilters.minConfidence > 1) {
      errors.push("minConfidence_must_be_0_to_1");
    }
    if (typeof sub.newsFilters.maxPerHour !== "number" || sub.newsFilters.maxPerHour < 1 || sub.newsFilters.maxPerHour > 1000) {
      errors.push("maxPerHour_must_be_1_to_1000");
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Update user subscription preferences.
 * Merges new preferences into existing subscription.
 */
export function updateSubscription(existing, updates) {
  const merged = {
    ...existing,
    subscribedLenses: updates.subscribedLenses ?? existing.subscribedLenses,
    newsFilters: {
      ...existing.newsFilters,
      ...updates.newsFilters,
    },
    localSubstrate: {
      ...existing.localSubstrate,
      ...updates.localSubstrate,
    },
    updatedAt: new Date().toISOString(),
  };
  return merged;
}

// ── Subscription Store ───────────────────────────────────────────────────────

/**
 * In-memory subscription store.
 * Ensures STATE has the subscription infrastructure.
 */
export function ensureSubscriptionState(STATE) {
  if (!STATE._eventScoping) {
    STATE._eventScoping = {
      subscriptions: new Map(),  // userId → subscription
      eventLog: [],              // audit trail of event DTU distributions
      rateLimitCounters: new Map(), // userId → { count, windowStart }
      metrics: {
        eventsProcessed: 0,
        eventsDropped: 0,         // dropped due to no matching scope
        dtusCreated: 0,
        dtusFiltered: 0,          // filtered by user CRETI/confidence
        dtusDelivered: 0,
        dtusRateLimited: 0,
        compressionRuns: 0,
        subscriptionChanges: 0,
      },
    };
  }
  return STATE._eventScoping;
}

/**
 * Get or create a user's subscription.
 */
export function getUserSubscription(STATE, userId) {
  const es = ensureSubscriptionState(STATE);
  if (!es.subscriptions.has(userId)) {
    es.subscriptions.set(userId, createDefaultSubscription(userId));
  }
  return es.subscriptions.get(userId);
}

/**
 * Set a user's subscription.
 */
export function setUserSubscription(STATE, userId, subscription) {
  const es = ensureSubscriptionState(STATE);
  const validation = validateSubscription(subscription);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }
  es.subscriptions.set(userId, subscription);
  es.metrics.subscriptionChanges++;
  return { ok: true, subscription };
}

/**
 * Subscribe a user to one or more lenses.
 */
export function subscribeLenses(STATE, userId, lenses) {
  const sub = getUserSubscription(STATE, userId);
  const newLenses = lenses.filter(l => !sub.subscribedLenses.includes(l));
  sub.subscribedLenses = [...sub.subscribedLenses, ...newLenses];
  sub.updatedAt = new Date().toISOString();
  const es = ensureSubscriptionState(STATE);
  es.metrics.subscriptionChanges++;
  return { ok: true, added: newLenses, total: sub.subscribedLenses.length };
}

/**
 * Unsubscribe a user from one or more lenses.
 */
export function unsubscribeLenses(STATE, userId, lenses) {
  const sub = getUserSubscription(STATE, userId);
  const toRemove = new Set(lenses);
  const removed = sub.subscribedLenses.filter(l => toRemove.has(l));
  sub.subscribedLenses = sub.subscribedLenses.filter(l => !toRemove.has(l));
  sub.updatedAt = new Date().toISOString();
  const es = ensureSubscriptionState(STATE);
  es.metrics.subscriptionChanges++;
  return { ok: true, removed, total: sub.subscribedLenses.length };
}

/**
 * Update a user's news filter preferences.
 */
export function updateNewsFilters(STATE, userId, filters) {
  const sub = getUserSubscription(STATE, userId);
  sub.newsFilters = { ...sub.newsFilters, ...filters };
  sub.updatedAt = new Date().toISOString();
  return { ok: true, newsFilters: sub.newsFilters };
}

// ── Scope Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve which lenses an event should land in.
 * Returns empty array if event type has no scope — meaning no DTU is created.
 */
export function resolveEventScope(eventType) {
  return EVENT_SCOPE_MAP[eventType] || [];
}

/**
 * Check if an event type is known/scoped.
 */
export function isEventTypeScoped(eventType) {
  return eventType in EVENT_SCOPE_MAP;
}

/**
 * Get all known event types.
 */
export function getKnownEventTypes() {
  return Object.keys(EVENT_SCOPE_MAP);
}

/**
 * Get all lenses that can receive events.
 */
export function getEventReceivingLenses() {
  const lenses = new Set();
  for (const targets of Object.values(EVENT_SCOPE_MAP)) {
    for (const lens of targets) lenses.add(lens);
  }
  return [...lenses].sort();
}

// ── Rate Limiting ────────────────────────────────────────────────────────────

const RATE_WINDOW_MS = 3600_000; // 1 hour

/**
 * Check if a user has hit their rate limit for event DTU delivery.
 */
export function checkRateLimit(STATE, userId) {
  const es = ensureSubscriptionState(STATE);
  const sub = getUserSubscription(STATE, userId);
  const maxPerHour = sub.newsFilters?.maxPerHour || 50;

  const counter = es.rateLimitCounters.get(userId);
  const now = Date.now();

  if (!counter || now - counter.windowStart > RATE_WINDOW_MS) {
    // Reset window
    es.rateLimitCounters.set(userId, { count: 0, windowStart: now });
    return { allowed: true, remaining: maxPerHour };
  }

  if (counter.count >= maxPerHour) {
    return { allowed: false, remaining: 0, resetsAt: counter.windowStart + RATE_WINDOW_MS };
  }

  return { allowed: true, remaining: maxPerHour - counter.count };
}

/**
 * Increment the rate limit counter for a user.
 */
export function incrementRateLimit(STATE, userId) {
  const es = ensureSubscriptionState(STATE);
  const counter = es.rateLimitCounters.get(userId);
  if (counter) {
    counter.count++;
  }
}

// ── Metrics ──────────────────────────────────────────────────────────────────

/**
 * Get event scoping metrics.
 */
export function getEventScopingMetrics(STATE) {
  const es = ensureSubscriptionState(STATE);
  return {
    ok: true,
    subscriptionCount: es.subscriptions.size,
    metrics: { ...es.metrics },
    knownEventTypes: Object.keys(EVENT_SCOPE_MAP).length,
    receivingLenses: getEventReceivingLenses().length,
  };
}
