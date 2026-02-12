/**
 * Atlas Runtime Invariant Monitor
 *
 * Provides assertInvariant() that:
 *   - logs every assertion (pass and fail)
 *   - increments metrics counters
 *   - throws in hardGate mode (default for GLOBAL + MARKETPLACE writes)
 *   - returns { ok, name, condition } for soft checks (LOCAL)
 *
 * Used in: promote, ingest, autogen ingest, council actions.
 */

// ── Invariant Log ───────────────────────────────────────────────────────────

const _log = [];
const MAX_LOG_SIZE = 5000;

const _metrics = {
  totalAssertions: 0,
  passed: 0,
  failed: 0,
  thrown: 0,
  byName: new Map(),    // name → { pass: n, fail: n }
};

/**
 * Core assertion function.
 *
 * @param {string} name       Human-readable invariant name (e.g. "NO_UNCITED_FACTS")
 * @param {boolean} condition If false, the invariant is violated
 * @param {object} meta       Context: { dtuId, scope, actor, detail }
 * @param {boolean} hardGate  If true, throws on failure (default: true)
 * @returns {{ ok: boolean, name: string }}
 */
export function assertInvariant(name, condition, meta = {}, hardGate = true) {
  _metrics.totalAssertions++;

  // Per-name tracking
  if (!_metrics.byName.has(name)) {
    _metrics.byName.set(name, { pass: 0, fail: 0 });
  }
  const bucket = _metrics.byName.get(name);

  const entry = {
    ts: Date.now(),
    name,
    ok: !!condition,
    meta,
    hardGate,
  };

  if (condition) {
    _metrics.passed++;
    bucket.pass++;
  } else {
    _metrics.failed++;
    bucket.fail++;

    // Always log failures
    if (_log.length >= MAX_LOG_SIZE) _log.shift();
    _log.push(entry);

    if (hardGate) {
      _metrics.thrown++;
      const err = new Error(`Invariant violated: ${name}`);
      err.invariantName = name;
      err.invariantMeta = meta;
      throw err;
    }
  }

  return { ok: !!condition, name };
}

/**
 * Soft assertion — never throws, returns result.
 */
export function assertSoft(name, condition, meta = {}) {
  return assertInvariant(name, condition, meta, false);
}

// ── Named invariant helpers (used throughout Atlas) ─────────────────────────

/**
 * Every DTU must have domainType and epistemicClass set.
 */
export function assertTyped(dtu, hardGate = true) {
  return assertInvariant(
    "ALL_DTUS_TYPED",
    !!(dtu.domainType && dtu.epistemicClass && dtu.schemaVersion),
    { dtuId: dtu.id, domainType: dtu.domainType, epistemicClass: dtu.epistemicClass },
    hardGate
  );
}

/**
 * FACT claims must not be mixed with INTERPRETATION in the same claim slot.
 */
export function assertClaimLanes(dtu, hardGate = true) {
  const claims = dtu.claims || [];
  const factClaims = claims.filter(c => c.claimType === "FACT" || c.claimType === "SPEC" || c.claimType === "PROVENANCE");
  const interpClaims = claims.filter(c => c.claimType === "INTERPRETATION" || c.claimType === "RECEPTION");
  const modelClaims = claims.filter(c => c.claimType === "MODEL_OUTPUT" || c.claimType === "HYPOTHESIS");

  // Check: no claim should appear in multiple lane categories
  const allIds = new Set();
  let duplicate = false;
  for (const c of [...factClaims, ...interpClaims, ...modelClaims]) {
    if (allIds.has(c.claimId)) { duplicate = true; break; }
    allIds.add(c.claimId);
  }

  // Check: INTERPRETATION cannot have evidenceTier of PROVEN/CORROBORATED (factual tiers)
  let interpHasFactualTier = false;
  for (const c of interpClaims) {
    if (c.evidenceTier === "PROVEN" || c.evidenceTier === "CORROBORATED") {
      interpHasFactualTier = true;
      break;
    }
  }

  return assertInvariant(
    "CLAIM_LANES_SEPARATED",
    !duplicate && !interpHasFactualTier,
    { dtuId: dtu.id, duplicate, interpHasFactualTier },
    hardGate
  );
}

/**
 * No uncited FACT claims (unless local scope).
 */
export function assertNoCitedFactGaps(dtu, hardGate = true) {
  const factClaims = (dtu.claims || []).filter(c => c.claimType === "FACT" || c.claimType === "SPEC");
  const uncited = factClaims.filter(c => !c.sources || c.sources.length === 0);
  return assertInvariant(
    "NO_UNCITED_FACTS",
    uncited.length === 0,
    { dtuId: dtu.id, uncitedCount: uncited.length, uncitedIds: uncited.map(c => c.claimId) },
    hardGate
  );
}

/**
 * Status can only be set to VERIFIED through the promote gate.
 */
export function assertPromoteGateOnly(actor, hardGate = true) {
  const allowed = actor === "atlas.status.promote" || actor === "auto_promote_gate";
  return assertInvariant(
    "VERIFIED_ONLY_VIA_PROMOTE",
    allowed,
    { actor },
    hardGate
  );
}

/**
 * No lineage cycle in parentage chain.
 */
export function assertNoCycle(hasCycle, dtuId, hardGate = true) {
  return assertInvariant(
    "NO_LINEAGE_CYCLE",
    !hasCycle,
    { dtuId },
    hardGate
  );
}

/**
 * Deduplicate check passed (similarity below threshold).
 */
export function assertNotDuplicate(similarity, threshold, dtuId, hardGate = true) {
  return assertInvariant(
    "NOT_DUPLICATE",
    similarity < threshold,
    { dtuId, similarity, threshold },
    hardGate
  );
}

/**
 * MODEL DTUs must declare at least one assumption.
 */
export function assertModelAssumptions(dtu, hardGate = true) {
  if (dtu.epistemicClass !== "MODEL") return { ok: true, name: "MODEL_HAS_ASSUMPTIONS" };
  const hasAssumptions = (dtu.assumptions || []).length > 0;
  return assertInvariant(
    "MODEL_HAS_ASSUMPTIONS",
    hasAssumptions,
    { dtuId: dtu.id },
    hardGate
  );
}

/**
 * INTERPRETATION cannot raise factual confidence.
 */
export function assertInterpretationNoFactualBoost(linkType, srcDtu, targetDtu, hardGate = true) {
  if (linkType !== "supports") return { ok: true, name: "INTERP_NO_FACTUAL_BOOST" };
  const srcIsInterp = srcDtu.epistemicClass === "INTERPRETIVE" ||
    (srcDtu.claims || []).every(c => c.claimType === "INTERPRETATION" || c.claimType === "RECEPTION");
  if (!srcIsInterp) return { ok: true, name: "INTERP_NO_FACTUAL_BOOST" };

  // An interpretation supporting a factual DTU must not boost its factual confidence
  const targetHasFacts = (targetDtu.claims || []).some(c => c.claimType === "FACT" || c.claimType === "SPEC");
  return assertInvariant(
    "INTERP_NO_FACTUAL_BOOST",
    !targetHasFacts,
    { srcDtuId: srcDtu.id, targetDtuId: targetDtu.id },
    hardGate
  );
}

// ── Metrics + Log Access ────────────────────────────────────────────────────

export function getInvariantMetrics() {
  const byName = {};
  for (const [name, counts] of _metrics.byName) {
    byName[name] = { ...counts };
  }
  return {
    totalAssertions: _metrics.totalAssertions,
    passed: _metrics.passed,
    failed: _metrics.failed,
    thrown: _metrics.thrown,
    byName,
  };
}

export function getInvariantLog(limit = 100) {
  return _log.slice(-limit);
}

export function resetInvariantMetrics() {
  _metrics.totalAssertions = 0;
  _metrics.passed = 0;
  _metrics.failed = 0;
  _metrics.thrown = 0;
  _metrics.byName.clear();
  _log.length = 0;
}
