/**
 * Atlas DTU Write Guard — Centralized fail-closed gateway for ALL DTU mutations.
 *
 * Invariant A1: Every operation that creates/updates a DTU must pass through
 *   writeGuard.applyWrite(op, payload, ctx)
 *
 * No route/macro should ever:
 *   - write DTUs directly to STATE.dtus
 *   - set status directly
 *   - compute scores ad-hoc
 *
 * If Atlas throws, the write fails.
 */

import {
  SCOPES,
  STRICTNESS_PROFILES,
  VALIDATION_LEVEL,
  AUTO_PROMOTE_THRESHOLDS,
  DUP_THRESH,
  ATLAS_SCHEMA_VERSION,
  getInitialStatus,
  getAutoPromoteConfig,
  getStrictnessProfile,
  canLaneTransition,
} from "./atlas-config.js";
import {
  validateAtlasDtu,
  computeAtlasScores,
  getAtlasState,
  ATLAS_STATUS,
  CLAIM_TYPES,
  getEpistemicClass,
  DOMAIN_TYPE_SET,
  EPISTEMIC_CLASS_SET,
} from "./atlas-epistemic.js";
import { createAtlasDtu, promoteAtlasDtu, recomputeScores, contentHash } from "./atlas-store.js";
import { runAntiGamingScan, findNearDuplicates, detectLineageCycle } from "./atlas-antigaming.js";
import { stampArtifactRights, recordOrigin, validateDerivativeRights } from "./atlas-rights.js";
import {
  assertInvariant,
  assertTyped,
  assertClaimLanes,
  assertNoCitedFactGaps,
  assertNoCycle,
  assertNotDuplicate,
  assertModelAssumptions,
  assertSoft,
} from "./atlas-invariants.js";

// ── Write operations ────────────────────────────────────────────────────────

const WRITE_OPS = Object.freeze({
  CREATE:      "CREATE",
  UPDATE:      "UPDATE",
  PROMOTE:     "PROMOTE",
  INGEST:      "INGEST",         // external ingest (file, API)
  AUTOGEN:     "AUTOGEN",        // autogen pipeline candidate
  IMPORT:      "IMPORT",         // bulk import
});

// ── Audit log for guard decisions ───────────────────────────────────────────

const _guardLog = [];
const MAX_GUARD_LOG = 2000;

function logGuard(op, scope, dtuId, decision, detail) {
  const entry = { ts: Date.now(), op, scope, dtuId, decision, detail };
  if (_guardLog.length >= MAX_GUARD_LOG) _guardLog.shift();
  _guardLog.push(entry);
  return entry;
}

// ── Core: applyWrite ────────────────────────────────────────────────────────

/**
 * Central gateway for all DTU writes.
 *
 * @param {object} STATE    Global state
 * @param {string} op       WRITE_OPS enum value
 * @param {object} payload  DTU data (for CREATE/INGEST/AUTOGEN) or update fields
 * @param {object} ctx      { scope, actor, userId, ... }
 * @returns {{ ok: boolean, dtu?, scores?, validation?, warnings?, error? }}
 */
export function applyWrite(STATE, op, payload, ctx = {}) {
  const scope = ctx.scope || SCOPES.LOCAL;
  const profile = getStrictnessProfile(scope);
  const isHard = profile.validationLevel === VALIDATION_LEVEL.HARD;

  try {
    // Step 0: Enforce typing (A2)
    if (op === WRITE_OPS.CREATE || op === WRITE_OPS.INGEST || op === WRITE_OPS.AUTOGEN || op === WRITE_OPS.IMPORT) {
      return _guardedCreate(STATE, op, payload, ctx, profile, isHard);
    }

    if (op === WRITE_OPS.UPDATE) {
      return _guardedUpdate(STATE, payload, ctx, profile, isHard);
    }

    if (op === WRITE_OPS.PROMOTE) {
      return _guardedPromote(STATE, payload, ctx, profile, isHard);
    }

    return { ok: false, error: `Unknown write op: ${op}` };

  } catch (err) {
    if (err.invariantName) {
      logGuard(op, scope, payload?.id || payload?.dtuId, "BLOCKED", err.message);
      return { ok: false, error: err.message, invariant: err.invariantName, meta: err.invariantMeta };
    }
    throw err; // Re-throw non-invariant errors
  }
}

// ── Internal: Guarded Create ────────────────────────────────────────────────

function _guardedCreate(STATE, op, payload, ctx, profile, isHard) {
  const scope = ctx.scope || SCOPES.LOCAL;
  const warnings = [];

  // ── A2: All DTUs must be typed ────────────────────────────────────────
  if (!payload.domainType || !DOMAIN_TYPE_SET.has(payload.domainType)) {
    if (isHard) {
      return { ok: false, error: `Missing or invalid domainType: ${payload.domainType}` };
    }
    warnings.push(`Missing or invalid domainType: ${payload.domainType}`);
  }

  // Resolve epistemicClass from domainType if not provided
  if (!payload.epistemicClass && payload.domainType) {
    payload.epistemicClass = getEpistemicClass(payload.domainType);
  }
  if (!payload.epistemicClass || !EPISTEMIC_CLASS_SET.has(payload.epistemicClass)) {
    if (isHard) {
      return { ok: false, error: `Missing or invalid epistemicClass: ${payload.epistemicClass}` };
    }
    warnings.push(`Missing or invalid epistemicClass: ${payload.epistemicClass}`);
  }

  // ── Set schema version ────────────────────────────────────────────────
  payload.schemaVersion = ATLAS_SCHEMA_VERSION;

  // ── Set scope metadata ────────────────────────────────────────────────
  payload._scope = scope;

  // ── Validate claim types (A2 cont.) ───────────────────────────────────
  if (payload.claims && Array.isArray(payload.claims)) {
    for (const claim of payload.claims) {
      if (!claim.claimType) {
        claim.claimType = CLAIM_TYPES.FACT; // default
      }
    }
  }

  // ── A3: Claim lane separation (hard for global/market, soft for local) ─
  if (scope !== SCOPES.LOCAL && payload.claims) {
    assertClaimLanes(payload, isHard);
  }

  // ── Create via atlas store ────────────────────────────────────────────
  const result = createAtlasDtu(STATE, payload);
  if (!result.ok) {
    logGuard(op, scope, null, "REJECTED", result.error);
    return result;
  }

  const dtu = result.dtu;

  // ── Post-creation assertions ──────────────────────────────────────────
  assertTyped(dtu, isHard);

  // ── Source enforcement for GLOBAL/MARKET ───────────────────────────────
  if (profile.sourceRequiredForFacts) {
    const citedResult = assertNoCitedFactGaps(dtu, false); // soft — we quarantine below
    if (!citedResult.ok) {
      if (isHard && op !== WRITE_OPS.AUTOGEN) {
        // Force to QUARANTINED (or set warning for later)
        dtu.status = scope === SCOPES.LOCAL ? "LOCAL_DRAFT" : "QUARANTINED";
        warnings.push("Uncited FACT claims detected — status forced to QUARANTINED");
        logGuard(op, scope, dtu.id, "QUARANTINED", "uncited facts");
      } else {
        warnings.push("Uncited FACT claims detected");
      }
    }
  }

  // ── Model assumption check ────────────────────────────────────────────
  if (dtu.epistemicClass === "MODEL") {
    assertModelAssumptions(dtu, isHard);
  }

  // ── Anti-gaming (global + marketplace) ────────────────────────────────
  if (profile.antiGamingPolicy === "FULL") {
    // Dedupe check
    if (profile.dedupeRequired) {
      const dupes = findNearDuplicates(STATE, dtu);
      if (dupes.length > 0 && dupes[0].similarity >= DUP_THRESH) {
        dtu._duplicateCandidate = true;
        dtu._sameAsTargets = dupes.map(d => ({ dtuId: d.dtuId, similarity: d.similarity }));
        warnings.push(`Near-duplicate detected (similarity: ${dupes[0].similarity.toFixed(3)})`);
        logGuard(op, scope, dtu.id, "DUPLICATE_CANDIDATE", `similarity=${dupes[0].similarity}`);
      }
    }

    // Cycle check
    if (profile.cycleCheckRequired && dtu.lineage?.parents?.length) {
      const cycleResult = detectLineageCycle(STATE, dtu.id);
      if (cycleResult.hasCycle) {
        dtu.status = "QUARANTINED";
        warnings.push("Lineage cycle detected — QUARANTINED");
        logGuard(op, scope, dtu.id, "QUARANTINED", "lineage cycle");
      }
    }
  }

  // ── Derivative rights check ──────────────────────────────────────────
  if (dtu.lineage?.parents?.length > 0) {
    const derivCheck = validateDerivativeRights(STATE, dtu, ctx.actor || dtu.author?.userId);
    if (!derivCheck.ok) {
      if (isHard) {
        logGuard(op, scope, dtu.id, "BLOCKED", `derivative rights: ${derivCheck.errors.join("; ")}`);
        return { ok: false, error: `Derivative rights violation: ${derivCheck.errors.join("; ")}`, dtu };
      }
      warnings.push(...(derivCheck.errors || []));
    }
    if (derivCheck.warnings) warnings.push(...derivCheck.warnings);
  }

  // ── Rights stamping + proof of origin ──────────────────────────────
  stampArtifactRights(dtu, scope);
  recordOrigin(STATE, dtu);

  // ── Override initial status based on scope ─────────────────────────────
  if (scope === SCOPES.LOCAL && dtu.status === "DRAFT") {
    dtu.status = "LOCAL_DRAFT";
  }
  if (scope === SCOPES.MARKETPLACE && dtu.status === "DRAFT") {
    dtu.status = "LISTING_DRAFT";
  }

  // ── Audit ─────────────────────────────────────────────────────────────
  if (profile.auditPolicy === "MANDATORY") {
    if (!dtu.audit) dtu.audit = { events: [] };
    dtu.audit.events.push({
      ts: Date.now(),
      actor: ctx.actor || ctx.userId || "system",
      action: `WRITE_GUARD_${op}`,
      scope,
      diff: `created via ${op}`,
    });
  }

  logGuard(op, scope, dtu.id, "ALLOWED", `status=${dtu.status}`);

  return {
    ok: true,
    dtu,
    scores: result.scores,
    validation: result.validation,
    warnings: warnings.length > 0 ? warnings : undefined,
    scope,
  };
}

// ── Internal: Guarded Update ────────────────────────────────────────────────

function _guardedUpdate(STATE, payload, ctx, profile, isHard) {
  const scope = ctx.scope || SCOPES.LOCAL;
  const atlas = getAtlasState(STATE);
  const dtuId = payload.dtuId || payload.id;
  if (!dtuId) return { ok: false, error: "dtuId required for UPDATE" };

  const dtu = atlas.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: `DTU not found: ${dtuId}` };

  const warnings = [];

  // ── Apply field updates ───────────────────────────────────────────────
  const allowedFields = ["title", "tags", "claims", "interpretations", "assumptions", "provenance", "links"];
  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      dtu[field] = payload[field];
    }
  }

  // ── Re-validate after update ──────────────────────────────────────────
  if (isHard) {
    assertTyped(dtu, true);
    if (scope !== SCOPES.LOCAL) {
      assertClaimLanes(dtu, true);
    }
  }

  // ── Recompute scores ──────────────────────────────────────────────────
  const scoreResult = recomputeScores(STATE, dtuId);

  // ── Re-run dedupe if global/market ────────────────────────────────────
  if (profile.dedupeRequired) {
    const dupes = findNearDuplicates(STATE, dtu);
    if (dupes.length > 0 && dupes[0].similarity >= DUP_THRESH) {
      warnings.push(`Near-duplicate detected after update (similarity: ${dupes[0].similarity.toFixed(3)})`);
    }
  }

  dtu.updatedAt = new Date().toISOString();
  dtu.hash = contentHash(dtu);

  // ── Audit ─────────────────────────────────────────────────────────────
  if (profile.auditPolicy === "MANDATORY") {
    if (!dtu.audit) dtu.audit = { events: [] };
    dtu.audit.events.push({
      ts: Date.now(),
      actor: ctx.actor || ctx.userId || "system",
      action: "WRITE_GUARD_UPDATE",
      scope,
      diff: `updated fields: ${allowedFields.filter(f => payload[f] !== undefined).join(", ")}`,
    });
  }

  logGuard("UPDATE", scope, dtu.id, "ALLOWED", `updated`);

  return {
    ok: true,
    dtu,
    scores: scoreResult?.scores,
    warnings: warnings.length > 0 ? warnings : undefined,
    scope,
  };
}

// ── Internal: Guarded Promote (the ONLY path to VERIFIED) ───────────────────

function _guardedPromote(STATE, payload, ctx, profile, isHard) {
  const scope = ctx.scope || SCOPES.GLOBAL;
  const atlas = getAtlasState(STATE);
  const { dtuId, targetStatus } = payload;
  if (!dtuId) return { ok: false, error: "dtuId required for PROMOTE" };

  const dtu = atlas.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: `DTU not found: ${dtuId}` };

  // ── Validate transition is allowed in this lane ───────────────────────
  if (!canLaneTransition(scope, dtu.status, targetStatus)) {
    return {
      ok: false,
      error: `Transition ${dtu.status} → ${targetStatus} not allowed in ${scope} lane`,
    };
  }

  // ── For VERIFIED: run the full AutoPromoteGate ────────────────────────
  if (targetStatus === "VERIFIED" || targetStatus === "LOCAL_VERIFIED" || targetStatus === "LISTED") {
    const gateResult = runAutoPromoteGate(STATE, dtu, scope);
    if (!gateResult.pass) {
      logGuard("PROMOTE", scope, dtu.id, "GATE_FAILED", gateResult.reason);
      return {
        ok: false,
        error: `Auto-promote gate failed: ${gateResult.reason}`,
        gateResult,
        suggestedStatus: gateResult.suggestedStatus,
      };
    }
  }

  // ── Anti-gaming pre-check ─────────────────────────────────────────────
  if (profile.antiGamingPolicy === "FULL" &&
      (targetStatus === "VERIFIED" || targetStatus === "PROPOSED" || targetStatus === "LISTED")) {
    const scan = runAntiGamingScan(STATE, dtu.id, ctx.actor || "system");
    if (scan.shouldQuarantine) {
      logGuard("PROMOTE", scope, dtu.id, "QUARANTINED", "anti-gaming");
      return {
        ok: false,
        error: "Anti-gaming scan triggered quarantine",
        antiGaming: scan,
        suggestedStatus: "QUARANTINED",
      };
    }
  }

  // ── Delegate to atlas-store promote ───────────────────────────────────
  const result = promoteAtlasDtu(STATE, dtuId, targetStatus, ctx.actor || "atlas.status.promote");

  if (result.ok) {
    logGuard("PROMOTE", scope, dtu.id, "PROMOTED", `${result.transition.from} → ${result.transition.to}`);
  }

  return result;
}

// ── AutoPromoteGate (C1 from spec) ──────────────────────────────────────────

/**
 * Rule-based gate. Returns { pass: boolean, reason: string, suggestedStatus: string }.
 * A DTU passes ONLY if ALL conditions are met.
 */
export function runAutoPromoteGate(STATE, dtu, scope = SCOPES.GLOBAL) {
  const atlas = getAtlasState(STATE);
  const eClass = dtu.epistemicClass;
  const config = getAutoPromoteConfig(eClass);
  const checks = [];

  // 1. Structural score
  const structural = dtu.scores?.credibility_structural || 0;
  checks.push({
    name: "structural_score",
    pass: structural >= config.min_structural,
    actual: structural,
    required: config.min_structural,
  });

  // 2. Factual score (if relevant)
  if (config.min_factual > 0) {
    const factual = dtu.scores?.confidence_factual || 0;
    checks.push({
      name: "factual_score",
      pass: factual >= config.min_factual,
      actual: factual,
      required: config.min_factual,
    });
  }

  // 3. HIGH contradictions = 0
  const contras = (dtu.links?.contradicts || []).filter(l => l.severity === "HIGH");
  checks.push({
    name: "no_high_contradictions",
    pass: contras.length <= (config.maxHighContra || 0),
    actual: contras.length,
    required: config.maxHighContra || 0,
  });

  // 4. Uncited facts = 0
  if (!config.uncitedFactsOk) {
    const factClaims = (dtu.claims || []).filter(c => c.claimType === "FACT" || c.claimType === "SPEC");
    const uncited = factClaims.filter(c => !c.sources || c.sources.length === 0);
    checks.push({
      name: "no_uncited_facts",
      pass: uncited.length === 0,
      actual: uncited.length,
      required: 0,
    });
  }

  // 5. Unique sources
  if (config.uniqueSources > 0) {
    const allSources = new Set();
    for (const claim of (dtu.claims || [])) {
      for (const src of (claim.sources || [])) {
        const canonical = (src.url || src.publisher || "").toLowerCase().replace(/\/$/, "");
        if (canonical) allSources.add(canonical);
      }
    }
    checks.push({
      name: "unique_sources",
      pass: allSources.size >= config.uniqueSources,
      actual: allSources.size,
      required: config.uniqueSources,
    });
  }

  // 6. Proof verified (FORMAL only)
  if (config.proofVerified) {
    checks.push({
      name: "proof_verified",
      pass: dtu.proofVerified === true,
      actual: dtu.proofVerified,
      required: true,
    });
  }

  // 7. Dedupe check
  const dupes = findNearDuplicates(STATE, dtu);
  const maxSim = dupes.length > 0 ? dupes[0].similarity : 0;
  checks.push({
    name: "dedupe",
    pass: maxSim < (config.dedupeThreshold || DUP_THRESH),
    actual: maxSim,
    required: config.dedupeThreshold || DUP_THRESH,
  });

  // 8. Anti-gaming not flagged
  const scan = runAntiGamingScan(STATE, dtu.id, "auto_promote_gate");
  checks.push({
    name: "antigaming_clean",
    pass: !scan.shouldQuarantine,
    actual: scan.shouldQuarantine,
    required: false,
  });

  // 9. No lineage cycle
  const cycleCheck = detectLineageCycle(STATE, dtu.id);
  checks.push({
    name: "no_lineage_cycle",
    pass: !cycleCheck.hasCycle,
    actual: cycleCheck.hasCycle,
    required: false,
  });

  // 10. MODEL: assumptions declared + sensitivity test
  if (config.requireAssumptions) {
    checks.push({
      name: "model_assumptions",
      pass: (dtu.assumptions || []).length > 0,
      actual: (dtu.assumptions || []).length,
      required: 1,
    });
  }
  if (config.requireSensitivity) {
    const hasSensitivity = (dtu.assumptions || []).some(a => a.sensitivity) || dtu._sensitivityTestReason;
    checks.push({
      name: "model_sensitivity",
      pass: !!hasSensitivity,
      actual: !!hasSensitivity,
      required: true,
    });
  }

  // ── Aggregate ─────────────────────────────────────────────────────────
  const failedChecks = checks.filter(c => !c.pass);
  const pass = failedChecks.length === 0;

  let suggestedStatus = pass ? (config.label || "VERIFIED") : "PROPOSED";
  if (!pass && scan.shouldQuarantine) suggestedStatus = "QUARANTINED";
  if (!pass && contras.length > 0) suggestedStatus = "DISPUTED";

  return {
    pass,
    checks,
    failedChecks,
    reason: pass ? "All gates passed" : failedChecks.map(c => `${c.name}: got ${c.actual}, need ${c.required}`).join("; "),
    label: config.label || "VERIFIED",
    suggestedStatus,
  };
}

// ── Autogen ingestion entry point ───────────────────────────────────────────

/**
 * F1: Autogen outputs go through this instead of writing directly.
 * Calls applyWrite with AUTOGEN op and global scope.
 */
export function ingestAutogenCandidate(STATE, candidate, ctx = {}) {
  return applyWrite(STATE, WRITE_OPS.AUTOGEN, candidate, {
    ...ctx,
    scope: ctx.scope || SCOPES.GLOBAL,
    actor: ctx.actor || "autogen_v2",
  });
}

// ── Legacy DTU write interception ───────────────────────────────────────────

/**
 * Wraps the legacy STATE.dtus.set() pattern to route through Atlas.
 * Used by the monolith's existing DTU creation macros/routes.
 * Falls back to direct write for non-Atlas DTUs (e.g., skill DTUs, genesis anchors).
 */
export function guardedDtuWrite(STATE, dtu, ctx = {}) {
  // Skip Atlas guard for system DTUs, skill DTUs, and non-knowledge DTUs
  if (dtu.kind === "skill" || dtu._system || dtu.id?.startsWith("genesis_")) {
    STATE.dtus.set(dtu.id, dtu);
    return { ok: true, dtu, bypassed: true };
  }

  // If DTU already has Atlas schema version, update it
  if (dtu.schemaVersion?.startsWith("atlas-")) {
    return applyWrite(STATE, WRITE_OPS.UPDATE, { ...dtu, dtuId: dtu.id }, ctx);
  }

  // For new DTUs from legacy paths: create through Atlas if they have enough structure
  if (dtu.domainType || dtu.epistemicClass || (dtu.claims && dtu.claims.length > 0)) {
    return applyWrite(STATE, WRITE_OPS.CREATE, dtu, ctx);
  }

  // Fallback: direct write for DTUs without Atlas metadata
  STATE.dtus.set(dtu.id, dtu);
  return { ok: true, dtu, bypassed: true, reason: "no Atlas metadata" };
}

// ── Metrics + Log ───────────────────────────────────────────────────────────

export function getWriteGuardLog(limit = 100) {
  return _guardLog.slice(-limit);
}

export function getWriteGuardMetrics() {
  const byDecision = {};
  for (const entry of _guardLog) {
    byDecision[entry.decision] = (byDecision[entry.decision] || 0) + 1;
  }
  return {
    totalEntries: _guardLog.length,
    byDecision,
  };
}

export { WRITE_OPS };
