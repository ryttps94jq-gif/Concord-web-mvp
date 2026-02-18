/**
 * Atlas Scoped Heartbeat Ticks
 *
 * Separate tick loops per lane — no cross-scope contamination.
 *
 *   Local heartbeat:  aggressive optimization, shadow/linguistic learning
 *   Global heartbeat: conservative, score recompute, contradiction updates, dedupe merges
 *   Market heartbeat: listing integrity, royalty accounting, fraud patterns
 *
 * Invariant: A local tick can't write to global or market tables. Only produce submissions.
 */

import {
  SCOPES,
  DUP_THRESH,
} from "./atlas-config.js";
import { getAtlasState } from "./atlas-epistemic.js";
import { recomputeScores, promoteAtlasDtu } from "./atlas-store.js";
import { findNearDuplicates } from "./atlas-antigaming.js";
import { getDtuScope } from "./atlas-scope-router.js";
import { runAutoPromoteGate } from "./atlas-write-guard.js";

// ── Tick State ──────────────────────────────────────────────────────────────

const _tickState = {
  local:  { lastRun: 0, runCount: 0, errors: 0 },
  global: { lastRun: 0, runCount: 0, errors: 0, recomputed: 0, contradictionsUpdated: 0, deduped: 0 },
  market: { lastRun: 0, runCount: 0, errors: 0, integrityScans: 0, fraudChecks: 0 },
};

// ── Per-lane mutex: prevents overlapping ticks ──────────────────────────────
// If a lane tick is running, the next tick skips.
// Tick failures don't wedge the system (always cleared in finally).
const _locks = { local: false, global: false, market: false };

// ── Local Heartbeat ─────────────────────────────────────────────────────────

/**
 * Runs aggressive optimization on local DTUs.
 * Can generate lots of local DTUs, update linguistic learning.
 * NEVER writes to global or market.
 */
export function tickLocal(STATE) {
  if (_locks.local) return { skipped: true, reason: "previous tick still running" };
  _locks.local = true;

  const ts = Date.now();
  _tickState.local.lastRun = ts;
  _tickState.local.runCount++;

  const atlas = getAtlasState(STATE);
  const results = { recomputed: 0, hintsGenerated: 0 };

  try {
    // Recompute scores for recently-updated local DTUs
    for (const [dtuId, dtu] of atlas.dtus) {
      const scope = getDtuScope(STATE, dtuId);
      if (scope !== SCOPES.LOCAL) continue;

      // Only recompute if updated in the last tick interval
      const updatedAt = dtu.updatedAt ? new Date(dtu.updatedAt).getTime() : 0;
      if (ts - updatedAt < 600000) { // 10 minutes
        recomputeScores(STATE, dtuId);
        results.recomputed++;
      }
    }

  } catch {
    _tickState.local.errors++;
  } finally {
    _locks.local = false;
  }

  return results;
}

// ── Global Heartbeat ────────────────────────────────────────────────────────

/**
 * Conservative maintenance on global Atlas DTUs.
 * Rate-limited. Handles:
 *   - Score recomputation for stale DTUs
 *   - Contradiction consistency checks
 *   - Dedupe merge candidates
 *   - Auto-promote eligible PROPOSED DTUs
 */
export function tickGlobal(STATE) {
  if (_locks.global) return { skipped: true, reason: "previous tick still running" };
  _locks.global = true;

  const ts = Date.now();
  _tickState.global.lastRun = ts;
  _tickState.global.runCount++;

  const atlas = getAtlasState(STATE);
  const results = {
    recomputed: 0,
    contradictionsUpdated: 0,
    dedupeCandidates: 0,
    autoPromoted: 0,
    autoDisputed: 0,
  };

  try {
    const globalDtus = [];
    for (const [dtuId, dtu] of atlas.dtus) {
      const scope = getDtuScope(STATE, dtuId);
      if (scope === SCOPES.GLOBAL) globalDtus.push(dtu);
    }

    // ── Phase 1: Recompute stale scores (max 50 per tick) ───────────────
    let recomputeCount = 0;
    for (const dtu of globalDtus) {
      if (recomputeCount >= 50) break;
      const age = ts - (dtu.updatedAt ? new Date(dtu.updatedAt).getTime() : 0);
      if (age > 3600000) { // >1 hour stale
        recomputeScores(STATE, dtu.id);
        results.recomputed++;
        recomputeCount++;
      }
    }
    _tickState.global.recomputed += results.recomputed;

    // ── Phase 2: Contradiction consistency ──────────────────────────────
    // Check if any VERIFIED DTU now has HIGH contradictions
    for (const dtu of globalDtus) {
      if (dtu.status !== "VERIFIED") continue;
      const highContras = (dtu.links?.contradicts || []).filter(l => l.severity === "HIGH");
      if (highContras.length > 0) {
        // Auto-dispute: VERIFIED with HIGH contradiction → DISPUTED (via CAS)
        const disputeRes = promoteAtlasDtu(STATE, dtu.id, "DISPUTED", "heartbeat_contradiction_check", "VERIFIED");
        if (disputeRes.ok && !disputeRes.noop) results.autoDisputed++;
      }
    }
    _tickState.global.contradictionsUpdated += results.contradictionsUpdated;

    // ── Phase 3: Dedupe candidates (max 20 per tick) ────────────────────
    let dedupeCount = 0;
    for (const dtu of globalDtus) {
      if (dedupeCount >= 20) break;
      if (dtu.status === "QUARANTINED" || dtu.status === "DEPRECATED") continue;
      const dupes = findNearDuplicates(STATE, dtu);
      if (dupes.length > 0 && dupes[0].similarity >= DUP_THRESH) {
        results.dedupeCandidates++;
        dedupeCount++;
        // Flag but don't auto-quarantine — leave for council
        if (!dtu._duplicateCandidateIds) dtu._duplicateCandidateIds = [];
        for (const d of dupes) {
          if (!dtu._duplicateCandidateIds.includes(d.dtuId)) {
            dtu._duplicateCandidateIds.push(d.dtuId);
          }
        }
      }
    }
    _tickState.global.deduped += results.dedupeCandidates;

    // ── Phase 4: Auto-promote eligible PROPOSED DTUs (max 10 per tick) ──
    let promoteCount = 0;
    for (const dtu of globalDtus) {
      if (promoteCount >= 10) break;
      if (dtu.status !== "PROPOSED") continue;

      const gate = runAutoPromoteGate(STATE, dtu, SCOPES.GLOBAL);
      if (gate.pass) {
        // CAS: only promote if still PROPOSED (prevents double-promote)
        const res = promoteAtlasDtu(STATE, dtu.id, gate.label || "VERIFIED", "auto_promote_gate", "PROPOSED");
        if (res.ok && !res.noop) {
          results.autoPromoted++;
          promoteCount++;
        }
      }
    }

  } catch {
    _tickState.global.errors++;
  } finally {
    _locks.global = false;
  }

  return results;
}

// ── Marketplace Heartbeat ───────────────────────────────────────────────────

/**
 * Marketplace integrity maintenance.
 * Handles listing integrity scans, fraud detection, royalty accounting.
 */
export function tickMarketplace(STATE) {
  if (_locks.market) return { skipped: true, reason: "previous tick still running" };
  _locks.market = true;

  const ts = Date.now();
  _tickState.market.lastRun = ts;
  _tickState.market.runCount++;

  const atlas = getAtlasState(STATE);
  const results = {
    integrityScans: 0,
    fraudDetected: 0,
    delistedCount: 0,
  };

  try {
    const marketDtus = [];
    for (const [dtuId, dtu] of atlas.dtus) {
      const scope = getDtuScope(STATE, dtuId);
      if (scope === SCOPES.MARKETPLACE) marketDtus.push(dtu);
    }

    // ── Phase 1: Listing integrity (max 30 per tick) ────────────────────
    let scanCount = 0;
    for (const dtu of marketDtus) {
      if (scanCount >= 30) break;
      if (dtu.status === "QUARANTINED" || dtu.status === "DELISTED") continue;

      // Check provenance still valid
      const hasProvenance = (dtu.provenance || []).length > 0;
      const hasLicense = dtu._license || dtu.marketplace?.licenseTerms;

      if (!hasProvenance && !hasLicense) {
        // Flag for review
        if (!dtu._integrityWarnings) dtu._integrityWarnings = [];
        dtu._integrityWarnings.push({
          ts,
          type: "MISSING_METADATA",
          detail: "Missing provenance or license for marketplace listing",
        });
      }

      results.integrityScans++;
      scanCount++;
    }
    _tickState.market.integrityScans += results.integrityScans;

    // ── Phase 2: Fraud pattern detection ────────────────────────────────
    // Check for duplicate listings by same author with minor variations
    const byAuthor = new Map();
    for (const dtu of marketDtus) {
      if (dtu.status === "QUARANTINED" || dtu.status === "DELISTED") continue;
      const authorId = dtu.author?.userId || "unknown";
      if (!byAuthor.has(authorId)) byAuthor.set(authorId, []);
      byAuthor.get(authorId).push(dtu);
    }

    for (const [_authorId, dtus] of byAuthor) {
      if (dtus.length < 2) continue;
      // Check each pair for high similarity (potential duplicate listing fraud)
      for (let i = 0; i < dtus.length - 1 && i < 5; i++) {
        for (let j = i + 1; j < dtus.length && j < 5; j++) {
          const dupes = findNearDuplicates(STATE, dtus[i]);
          const match = dupes.find(d => d.dtuId === dtus[j].id);
          if (match && match.similarity >= 0.80) {
            results.fraudDetected++;
            dtus[j]._fraudFlag = {
              ts,
              type: "DUPLICATE_LISTING",
              similarTo: dtus[i].id,
              similarity: match.similarity,
            };
          }
        }
      }
    }
    _tickState.market.fraudChecks += results.fraudDetected;

  } catch {
    _tickState.market.errors++;
  } finally {
    _locks.market = false;
  }

  return results;
}

// ── Unified tick dispatcher ─────────────────────────────────────────────────

/**
 * Run heartbeat for a specific scope.
 * concord.tick(scope) from the spec.
 */
export function tick(STATE, scope) {
  if (scope === SCOPES.LOCAL) return tickLocal(STATE);
  if (scope === SCOPES.GLOBAL) return tickGlobal(STATE);
  if (scope === SCOPES.MARKETPLACE) return tickMarketplace(STATE);
  return { error: `Unknown scope: ${scope}` };
}

/**
 * Run all heartbeats. Called by the main setInterval.
 */
export function tickAll(STATE) {
  return {
    local: tickLocal(STATE),
    global: tickGlobal(STATE),
    marketplace: tickMarketplace(STATE),
  };
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export function getHeartbeatMetrics() {
  return {
    ok: true,
    local: { ..._tickState.local },
    global: { ..._tickState.global },
    marketplace: { ..._tickState.market },
  };
}

