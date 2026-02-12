/**
 * Atlas Scope-Aware Retrieval
 *
 * Enforces retrieval policies that label results by source scope.
 * Local content cannot "borrow" global confidence.
 * Global content retains its confidence + dispute indicators.
 *
 * RetrievalPolicy options:
 *   LOCAL_ONLY | GLOBAL_ONLY | LOCAL_THEN_GLOBAL | GLOBAL_THEN_LOCAL
 *   LOCAL_PLUS_GLOBAL | LOCAL_PLUS_GLOBAL_MARKET
 *
 * Default for normal user chat: LOCAL_THEN_GLOBAL
 */

import {
  SCOPES,
  RETRIEVAL_POLICY,
  DEFAULT_RETRIEVAL_POLICY,
} from "./atlas-config.js";
import { getAtlasState } from "./atlas-epistemic.js";
import { getDtuScope } from "./atlas-scope-router.js";

// ── Core Retrieval ──────────────────────────────────────────────────────────

/**
 * Retrieve DTUs matching a text query, filtered and labeled by scope policy.
 *
 * @param {object} STATE
 * @param {string} policy    RETRIEVAL_POLICY enum value
 * @param {string} queryText Free-text search query
 * @param {object} opts      { limit, minConfidence, domainType, epistemicClass, status }
 * @returns {{ ok, results: LabeledDtu[], total, policy, scopes }}
 */
export function retrieve(STATE, policy, queryText, opts = {}) {
  policy = policy || DEFAULT_RETRIEVAL_POLICY;
  const atlas = getAtlasState(STATE);
  const limit = Math.min(opts.limit || 20, 200);

  // Determine which scopes to search
  const scopeOrder = _getScopeOrder(policy);
  const allResults = [];

  for (const scope of scopeOrder) {
    const scopeResults = _searchScope(STATE, atlas, scope, queryText, opts);
    allResults.push(...scopeResults);

    // For "THEN" policies, stop early if we have enough
    if (policy === RETRIEVAL_POLICY.LOCAL_THEN_GLOBAL ||
        policy === RETRIEVAL_POLICY.GLOBAL_THEN_LOCAL) {
      if (allResults.length >= limit) break;
    }
  }

  // Sort by relevance (confidence * scope weight)
  allResults.sort((a, b) => (b._relevanceScore || 0) - (a._relevanceScore || 0));

  const limited = allResults.slice(0, limit);

  return {
    ok: true,
    results: limited,
    total: allResults.length,
    returned: limited.length,
    policy,
    scopes: scopeOrder,
  };
}

// ── Scope Order Resolution ──────────────────────────────────────────────────

function _getScopeOrder(policy) {
  switch (policy) {
    case RETRIEVAL_POLICY.LOCAL_ONLY:
      return [SCOPES.LOCAL];
    case RETRIEVAL_POLICY.GLOBAL_ONLY:
      return [SCOPES.GLOBAL];
    case RETRIEVAL_POLICY.LOCAL_THEN_GLOBAL:
      return [SCOPES.LOCAL, SCOPES.GLOBAL];
    case RETRIEVAL_POLICY.GLOBAL_THEN_LOCAL:
      return [SCOPES.GLOBAL, SCOPES.LOCAL];
    case RETRIEVAL_POLICY.LOCAL_PLUS_GLOBAL:
      return [SCOPES.LOCAL, SCOPES.GLOBAL];
    case RETRIEVAL_POLICY.LOCAL_PLUS_GLOBAL_MARKET:
      return [SCOPES.LOCAL, SCOPES.GLOBAL, SCOPES.MARKETPLACE];
    default:
      return [SCOPES.LOCAL, SCOPES.GLOBAL];
  }
}

// ── Per-Scope Search ────────────────────────────────────────────────────────

function _searchScope(STATE, atlas, scope, queryText, opts) {
  const results = [];
  const queryLower = (queryText || "").toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1);

  for (const [dtuId, dtu] of atlas.dtus) {
    // Filter by scope
    const dtuScope = getDtuScope(STATE, dtuId);
    if (dtuScope !== scope) continue;

    // Filter by status if specified
    if (opts.status && dtu.status !== opts.status) continue;

    // Filter by domain
    if (opts.domainType && dtu.domainType !== opts.domainType) continue;
    if (opts.epistemicClass && dtu.epistemicClass !== opts.epistemicClass) continue;

    // Filter by min confidence
    if (opts.minConfidence && (dtu.scores?.confidence_overall || 0) < opts.minConfidence) continue;

    // Text matching
    let relevance = 0;
    if (queryWords.length > 0) {
      const titleLower = (dtu.title || "").toLowerCase();
      const tagsLower = (dtu.tags || []).map(t => t.toLowerCase());
      const claimTexts = (dtu.claims || []).map(c => (c.text || "").toLowerCase());

      for (const word of queryWords) {
        if (titleLower.includes(word)) relevance += 3;
        if (tagsLower.some(t => t.includes(word))) relevance += 2;
        if (claimTexts.some(t => t.includes(word))) relevance += 1;
      }

      if (relevance === 0) continue; // No match
    } else {
      relevance = 1; // No query = return all
    }

    // Build labeled result
    const labeled = _labelResult(dtu, scope, relevance);
    results.push(labeled);
  }

  return results;
}

// ── Result Labeling ─────────────────────────────────────────────────────────

function _labelResult(dtu, scope, relevance) {
  const confidence = dtu.scores?.confidence_overall || 0;

  // Scope weight: global > marketplace > local for relevance ranking
  const scopeWeight = scope === SCOPES.GLOBAL ? 1.2 :
                      scope === SCOPES.MARKETPLACE ? 1.1 : 1.0;

  return {
    id: dtu.id,
    title: dtu.title,
    domainType: dtu.domainType,
    epistemicClass: dtu.epistemicClass,
    status: dtu.status,
    tags: dtu.tags || [],
    claims: (dtu.claims || []).map(c => ({
      claimId: c.claimId,
      claimType: c.claimType,
      text: c.text,
      evidenceTier: c.evidenceTier,
    })),
    scores: {
      confidence_factual: dtu.scores?.confidence_factual || 0,
      credibility_structural: dtu.scores?.credibility_structural || 0,
      confidence_overall: confidence,
    },

    // ── Scope labeling (required by spec) ─────────────────────────────
    _sourceScope: scope,
    _scopeLabel: scope === SCOPES.LOCAL ? "Local knowledge" :
                 scope === SCOPES.GLOBAL ? "Global Atlas" :
                 "Marketplace listing",

    // Global content retains confidence + dispute indicators
    _disputeIndicator: dtu.status === "DISPUTED",
    _isVerified: dtu.status === "VERIFIED",

    // Local confidence is explicitly branded as local
    _confidenceBranding: scope === SCOPES.LOCAL
      ? `Local confidence: ${confidence.toFixed(2)} (not Global verification)`
      : `Global confidence: ${confidence.toFixed(2)}`,

    // Relevance score for sorting
    _relevanceScore: relevance * scopeWeight * (1 + confidence * 0.5),

    // Author info
    author: dtu.author?.display || dtu.author?.userId || "Unknown",
    createdAt: dtu.createdAt,
  };
}

// ── Convenience: Chat retrieval (default policy) ────────────────────────────

/**
 * Default retrieval for chat context. Uses LOCAL_THEN_GLOBAL policy.
 */
export function retrieveForChat(STATE, queryText, opts = {}) {
  return retrieve(STATE, DEFAULT_RETRIEVAL_POLICY, queryText, {
    limit: 10,
    ...opts,
  });
}

/**
 * Retrieve only from a specific scope.
 */
export function retrieveFromScope(STATE, scope, queryText, opts = {}) {
  const policyMap = {
    [SCOPES.LOCAL]: RETRIEVAL_POLICY.LOCAL_ONLY,
    [SCOPES.GLOBAL]: RETRIEVAL_POLICY.GLOBAL_ONLY,
  };
  return retrieve(STATE, policyMap[scope] || RETRIEVAL_POLICY.LOCAL_ONLY, queryText, opts);
}

/**
 * Retrieve with full scope labels for UI display.
 */
export function retrieveLabeled(STATE, policy, queryText, opts = {}) {
  const result = retrieve(STATE, policy, queryText, opts);
  if (!result.ok) return result;

  // Group by scope for UI rendering
  const grouped = {};
  for (const r of result.results) {
    const scope = r._sourceScope;
    if (!grouped[scope]) grouped[scope] = [];
    grouped[scope].push(r);
  }

  return {
    ...result,
    grouped,
  };
}
