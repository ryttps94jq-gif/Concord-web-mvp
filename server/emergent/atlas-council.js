/**
 * Concord Global Atlas — Council Protocol (Structural Governance)
 *
 * Council enforces schema integrity, labeling, provenance requirements.
 * Council doesn't "decide meaning." Council enforces structural rules.
 * Every council action produces an audit event with actor, diff, reason, evidence.
 */

import crypto from "crypto";
import { getAtlasState } from "./atlas-epistemic.js";
import { promoteAtlasDtu, addAtlasLink, recomputeScores } from "./atlas-store.js";
import { runAntiGamingScan } from "./atlas-antigaming.js";

// ── Council Roles (code-enforced capabilities) ───────────────────────────

const COUNCIL_CAN = Object.freeze({
  ADD_LINK:         "add_link",
  REMOVE_LINK:      "remove_link",
  CHANGE_STATUS:    "change_status",
  REQUEST_SOURCES:  "request_sources",
  APPROVE_MERGE:    "approve_merge",
  RESOLVE_DISPUTE:  "resolve_dispute",
});

const COUNCIL_CANNOT = Object.freeze([
  "delete_dtus_silently",
  "rewrite_interpretations_as_facts",
  "change_scoring_rules",
  "modify_engine_config",
]);

// ── Council Action Types ─────────────────────────────────────────────────

const COUNCIL_ACTIONS = Object.freeze({
  PROMOTE:          "PROMOTE",
  DISPUTE:          "DISPUTE",
  RESOLVE:          "RESOLVE",
  ADD_LINK:         "ADD_LINK",
  REMOVE_LINK:      "REMOVE_LINK",
  REQUEST_SOURCES:  "REQUEST_SOURCES",
  MERGE:            "MERGE",
  QUARANTINE:       "QUARANTINE",
  DEPRECATE:        "DEPRECATE",
});

// ── Council State ────────────────────────────────────────────────────────

function getCouncilState(STATE) {
  const atlas = getAtlasState(STATE);
  if (!atlas._council) {
    atlas._council = {
      queue: [],              // DTUs awaiting council action
      actions: [],            // all council actions (audit trail)
      pendingDisputes: [],    // active disputes
      metrics: {
        totalActions: 0,
        promotions: 0,
        disputes: 0,
        resolutions: 0,
        quarantines: 0,
        merges: 0,
        sourcesRequested: 0,
      },
    };
  }
  return atlas._council;
}

// ── Audit Event Builder ──────────────────────────────────────────────────

function buildAuditEvent(action, actor, dtuId, details = {}) {
  return {
    eventId: `council_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
    ts: Date.now(),
    timestamp: new Date().toISOString(),
    actor: actor || "council",
    action,
    dtuId,
    beforeState: details.before || null,
    afterState: details.after || null,
    reason: details.reason || "",
    evidenceRefs: details.evidenceRefs || [],
    diff: details.diff || "",
  };
}

// ── Council: Resolve (status + links + evidence attach) ──────────────────

/**
 * Council resolves a DTU's status, adds/removes links, attaches evidence.
 * All changes are audited with full diff.
 */
export function councilResolve(STATE, input) {
  const atlas = getAtlasState(STATE);
  const council = getCouncilState(STATE);

  const { dtuId, targetStatus, links, reason, evidenceRefs, actor } = input;

  const dtu = atlas.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "DTU not found" };

  const beforeState = {
    status: dtu.status,
    linkCount: (dtu.links?.supports?.length || 0) + (dtu.links?.contradicts?.length || 0),
  };

  const results = [];

  // Anti-gaming check before promotion
  if (targetStatus === "VERIFIED" || targetStatus === "PROPOSED") {
    const antiGaming = runAntiGamingScan(STATE, dtuId, dtu.author?.userId);
    if (antiGaming.shouldQuarantine) {
      // Force quarantine instead
      promoteAtlasDtu(STATE, dtuId, "QUARANTINED", actor || "council");
      const event = buildAuditEvent(COUNCIL_ACTIONS.QUARANTINE, actor, dtuId, {
        before: beforeState,
        after: { status: "QUARANTINED" },
        reason: "Anti-gaming scan triggered quarantine",
        evidenceRefs: [{ type: "anti_gaming_scan", data: antiGaming.summary }],
      });
      council.actions.push(event);
      council.metrics.quarantines++;
      council.metrics.totalActions++;

      return { ok: true, action: "QUARANTINED", reason: antiGaming.summary, event };
    }
  }

  // Change status if requested
  if (targetStatus && targetStatus !== dtu.status) {
    const promoteResult = promoteAtlasDtu(STATE, dtuId, targetStatus, actor || "council");
    if (promoteResult.ok) {
      results.push({ type: "status_change", from: beforeState.status, to: targetStatus });
    } else {
      results.push({ type: "status_change_failed", error: promoteResult.error, details: promoteResult });
    }
  }

  // Add links if requested
  if (links?.add?.length > 0) {
    for (const link of links.add) {
      const linkResult = addAtlasLink(STATE, dtuId, link.targetDtuId, link.type, {
        claimIds: link.claimIds,
        strength: link.strength,
        contradictionType: link.contradictionType,
        severity: link.severity,
        actor: actor || "council",
      });
      results.push({ type: "link_added", ...link, ok: linkResult.ok });
    }
  }

  // Remove links if requested
  if (links?.remove?.length > 0) {
    for (const removeSpec of links.remove) {
      const linkArray = dtu.links?.[removeSpec.type];
      if (linkArray) {
        const idx = linkArray.findIndex(l => l.targetDtuId === removeSpec.targetDtuId);
        if (idx >= 0) {
          linkArray.splice(idx, 1);
          results.push({ type: "link_removed", ...removeSpec });
        }
      }
    }
  }

  // Recompute scores after changes
  recomputeScores(STATE, dtuId);

  const afterState = {
    status: dtu.status,
    linkCount: (dtu.links?.supports?.length || 0) + (dtu.links?.contradicts?.length || 0),
  };

  // Build audit event
  const event = buildAuditEvent(
    targetStatus ? COUNCIL_ACTIONS.RESOLVE : COUNCIL_ACTIONS.ADD_LINK,
    actor,
    dtuId,
    {
      before: beforeState,
      after: afterState,
      reason: reason || "Council resolution",
      evidenceRefs: evidenceRefs || [],
      diff: JSON.stringify(results),
    }
  );

  council.actions.push(event);
  council.metrics.totalActions++;
  if (targetStatus === "VERIFIED") council.metrics.promotions++;
  if (targetStatus === "DISPUTED") council.metrics.disputes++;

  // Add to DTU audit trail
  dtu.audit.events.push({
    ts: Date.now(),
    actor: actor || "council",
    action: event.action,
    diff: event.diff,
  });

  // Qualia hook: council resolution completed
  try { globalThis.qualiaHooks?.hookCouncilVote(actor || "council", { agreement: targetStatus === "VERIFIED" ? 0.8 : 0.4, conflict: targetStatus === "DISPUTED" ? 0.7 : 0.2, confidence: 0.6 }); } catch { /* silent */ }

  return {
    ok: true,
    dtuId,
    results,
    event,
    currentStatus: dtu.status,
    currentScores: dtu.scores,
  };
}

// ── Council: Queue Management ────────────────────────────────────────────

/**
 * Get DTUs needing council action.
 * Priority: PROPOSED (need verification), DISPUTED (need resolution).
 */
export function getCouncilQueue(STATE, options = {}) {
  const atlas = getAtlasState(STATE);
  const _council = getCouncilState(STATE);

  const queue = [];

  // PROPOSED DTUs needing verification
  const proposed = atlas.byStatus.get("PROPOSED");
  if (proposed) {
    for (const id of proposed) {
      const dtu = atlas.dtus.get(id);
      if (dtu) {
        queue.push({
          dtuId: id,
          title: dtu.title,
          status: "PROPOSED",
          domainType: dtu.domainType,
          epistemicClass: dtu.epistemicClass,
          scores: dtu.scores,
          priority: dtu.scores.confidence_overall, // higher confidence = more ready
          action: "VERIFY",
          createdAt: dtu.createdAt,
        });
      }
    }
  }

  // DISPUTED DTUs needing resolution
  const disputed = atlas.byStatus.get("DISPUTED");
  if (disputed) {
    for (const id of disputed) {
      const dtu = atlas.dtus.get(id);
      if (dtu) {
        const contradictions = dtu.links?.contradicts?.length || 0;
        queue.push({
          dtuId: id,
          title: dtu.title,
          status: "DISPUTED",
          domainType: dtu.domainType,
          epistemicClass: dtu.epistemicClass,
          scores: dtu.scores,
          priority: 1 + contradictions * 0.1, // disputed = higher priority
          action: "RESOLVE",
          contradictionCount: contradictions,
          createdAt: dtu.createdAt,
        });
      }
    }
  }

  // Sort by priority descending
  queue.sort((a, b) => b.priority - a.priority);

  // Apply filters
  const limit = options.limit || 50;
  const domainFilter = options.domainType;
  let filtered = queue;
  if (domainFilter) {
    filtered = filtered.filter(q => q.domainType === domainFilter);
  }

  return {
    ok: true,
    queue: filtered.slice(0, limit),
    total: filtered.length,
    breakdown: {
      proposed: queue.filter(q => q.status === "PROPOSED").length,
      disputed: queue.filter(q => q.status === "DISPUTED").length,
    },
  };
}

// ── Council: Request Sources ─────────────────────────────────────────────

export function councilRequestSources(STATE, dtuId, claimIds, reason, actor) {
  const atlas = getAtlasState(STATE);
  const council = getCouncilState(STATE);
  const dtu = atlas.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "DTU not found" };

  // Set NeedsSources flag on specified claims
  for (const claim of (dtu.claims || [])) {
    if (claimIds.length === 0 || claimIds.includes(claim.claimId)) {
      claim._needsSources = true;
      claim._sourcesRequestedAt = new Date().toISOString();
      claim._sourcesRequestedBy = actor || "council";
      claim._sourcesRequestReason = reason || "Council requires citations for this claim";
    }
  }

  const event = buildAuditEvent(COUNCIL_ACTIONS.REQUEST_SOURCES, actor, dtuId, {
    reason,
    diff: `Sources requested for claims: ${claimIds.length > 0 ? claimIds.join(", ") : "all"}`,
  });

  council.actions.push(event);
  council.metrics.sourcesRequested++;
  council.metrics.totalActions++;

  dtu.audit.events.push({
    ts: Date.now(),
    actor: actor || "council",
    action: "REQUEST_SOURCES",
    diff: event.diff,
  });

  return { ok: true, dtuId, event, claimsAffected: claimIds.length || dtu.claims?.length || 0 };
}

// ── Council: Merge DTUs ──────────────────────────────────────────────────

export function councilMerge(STATE, sourceDtuId, targetDtuId, reason, actor) {
  const atlas = getAtlasState(STATE);
  const council = getCouncilState(STATE);

  const sourceDtu = atlas.dtus.get(sourceDtuId);
  const targetDtu = atlas.dtus.get(targetDtuId);
  if (!sourceDtu) return { ok: false, error: "Source DTU not found" };
  if (!targetDtu) return { ok: false, error: "Target DTU not found" };

  // Add sameAs link
  addAtlasLink(STATE, sourceDtuId, targetDtuId, "sameAs", {
    actor: actor || "council",
    strength: 0.95,
  });

  // Deprecate source (it's now merged into target)
  promoteAtlasDtu(STATE, sourceDtuId, "DEPRECATED", actor || "council");

  // Transfer unique claims from source to target
  const targetClaimTexts = new Set((targetDtu.claims || []).map(c => (c.text || "").toLowerCase().trim()));
  let transferred = 0;

  for (const claim of (sourceDtu.claims || [])) {
    const normalized = (claim.text || "").toLowerCase().trim();
    if (!targetClaimTexts.has(normalized)) {
      targetDtu.claims = targetDtu.claims || [];
      targetDtu.claims.push({
        ...claim,
        claimId: `c_merged_${crypto.randomBytes(4).toString("hex")}`,
        _mergedFrom: sourceDtuId,
      });
      transferred++;
    }
  }

  // Recompute target scores
  recomputeScores(STATE, targetDtuId);

  const event = buildAuditEvent(COUNCIL_ACTIONS.MERGE, actor, sourceDtuId, {
    before: { sourceStatus: sourceDtu.status },
    after: { sourceStatus: "DEPRECATED", targetId: targetDtuId },
    reason: reason || "Council-approved merge",
    diff: `Merged ${sourceDtuId} into ${targetDtuId}, transferred ${transferred} claims`,
  });

  council.actions.push(event);
  council.metrics.merges++;
  council.metrics.totalActions++;

  return {
    ok: true,
    sourceDtuId,
    targetDtuId,
    transferred,
    event,
  };
}

// ── Council Action Log (Audit) ───────────────────────────────────────────

export function getCouncilActions(STATE, options = {}) {
  const council = getCouncilState(STATE);
  let actions = council.actions;

  // Filter by DTU
  if (options.dtuId) {
    actions = actions.filter(a => a.dtuId === options.dtuId);
  }

  // Filter by action type
  if (options.actionType) {
    actions = actions.filter(a => a.action === options.actionType);
  }

  // Sort by timestamp descending
  actions.sort((a, b) => b.ts - a.ts);

  // Pagination
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  return {
    ok: true,
    actions: actions.slice(offset, offset + limit),
    total: actions.length,
  };
}

// ── Council Metrics ──────────────────────────────────────────────────────

export function getCouncilMetrics(STATE) {
  const council = getCouncilState(STATE);
  const queue = getCouncilQueue(STATE);

  return {
    ok: true,
    ...council.metrics,
    queueSize: queue.total,
    queueBreakdown: queue.breakdown,
    capabilities: Object.values(COUNCIL_CAN),
    restrictions: COUNCIL_CANNOT,
  };
}
