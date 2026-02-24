/**
 * System: Promotion Pipeline
 *
 * Content lifecycle: personal → published → marketplace → global.
 * Council gates at published, sovereign gate at global.
 * Works for apps, DTU collections, macros, wrappers — any promotable item.
 *
 * All state in module-level structures. Silent failure. Additive only.
 */

import crypto from "crypto";

// ── Helpers ─────────────────────────────────────────────────────────────────

function uid(prefix = "promo") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}
function nowISO() { return new Date().toISOString(); }
function getSTATE() { return globalThis._concordSTATE || null; }

// ── Constants ───────────────────────────────────────────────────────────────

const PROMOTION_STAGES = {
  personal: {
    next: "published",
    gate: "author_only",
    requirements: ["valid_schema"],
  },
  published: {
    next: "marketplace",
    gate: "council_review",
    requirements: ["min_5_uses", "no_violations", "description_complete"],
  },
  marketplace: {
    next: "global",
    gate: "sovereign_approval",
    requirements: ["min_50_uses", "positive_trust_score", "council_unanimous"],
  },
  global: {
    next: null,
    gate: null,
    requirements: [],
  },
};

// ── Module State ────────────────────────────────────────────────────────────

const _proposals = new Map();
const _history = [];

// ── Requirement Checks ──────────────────────────────────────────────────────

function getItem(itemId, itemType, STATE) {
  if (itemType === "app") {
    // Check app-maker module
    try {
      const apps = globalThis._concordApps;
      if (apps instanceof Map) return apps.get(itemId);
    } catch { /* fallback */ }
  }
  if (itemType === "dtu" && STATE?.dtus instanceof Map) {
    return STATE.dtus.get(itemId);
  }
  return null;
}

function checkRequirement(req, item) {
  switch (req) {
    case "valid_schema":
      return item._lastValidation?.valid !== false;
    case "min_5_uses":
      return (item._useCount || 0) >= 5;
    case "min_50_uses":
      return (item._useCount || 0) >= 50;
    case "no_violations":
      return (item._lastValidation?.violations?.length || 0) === 0;
    case "description_complete":
      return !!(item.name && (item.human?.summary || item.description));
    case "positive_trust_score":
      return (item._trustScore || 0) > 0;
    case "council_unanimous":
      return item._councilVote === "unanimous";
    default:
      return true;
  }
}

// ── Promotion Request ───────────────────────────────────────────────────────

export function requestPromotion(itemId, itemType, requesterId) {
  const STATE = getSTATE();
  const item = getItem(itemId, itemType, STATE);
  if (!item) return { ok: false, error: "Item not found" };

  const currentStage = item._promotionStage || "personal";
  const stageConfig = PROMOTION_STAGES[currentStage];
  if (!stageConfig?.next) return { ok: false, error: "Already at max stage" };

  // Check requirements
  const unmet = [];
  for (const req of stageConfig.requirements) {
    if (!checkRequirement(req, item)) unmet.push(req);
  }
  if (unmet.length > 0) return { ok: false, error: "Unmet requirements", unmet };

  // Create proposal
  const proposal = {
    id: uid("promo"),
    itemId,
    itemType,
    from: currentStage,
    to: stageConfig.next,
    gate: stageConfig.gate,
    requesterId,
    status: "pending",
    createdAt: nowISO(),
    votes: [],
    resolvedAt: null,
    resolution: null,
  };

  // Auto-approve author_only gate
  if (stageConfig.gate === "author_only" && requesterId === item.author) {
    proposal.status = "approved";
    proposal.resolvedAt = nowISO();
    proposal.resolution = "auto_approved_author";
    item._promotionStage = stageConfig.next;
    item._promotedAt = nowISO();
  }

  // Queue for council_review
  if (stageConfig.gate === "council_review") {
    proposal.status = "pending_council";
  }

  // Queue for sovereign_approval
  if (stageConfig.gate === "sovereign_approval") {
    proposal.status = "pending_sovereign";
  }

  _proposals.set(proposal.id, proposal);
  _history.push({ action: "requested", proposalId: proposal.id, timestamp: nowISO() });

  return { ok: true, proposal };
}

// ── Approval / Rejection ────────────────────────────────────────────────────

export function approvePromotion(proposalId, approverId = "sovereign") {
  const proposal = _proposals.get(proposalId);
  if (!proposal) return { ok: false, error: "Proposal not found" };
  if (proposal.status === "approved") return { ok: false, error: "Already approved" };
  if (proposal.status === "rejected") return { ok: false, error: "Already rejected" };

  proposal.status = "approved";
  proposal.resolvedAt = nowISO();
  proposal.resolution = `approved_by_${approverId}`;

  // Apply promotion
  const STATE = getSTATE();
  const item = getItem(proposal.itemId, proposal.itemType, STATE);
  if (item) {
    item._promotionStage = proposal.to;
    item._promotedAt = nowISO();
  }

  _history.push({ action: "approved", proposalId, approverId, timestamp: nowISO() });

  if (typeof globalThis.realtimeEmit === "function") {
    globalThis.realtimeEmit("promotion:approved", {
      proposalId,
      itemId: proposal.itemId,
      itemType: proposal.itemType,
      stage: proposal.to,
    });
  }

  return { ok: true, proposalId, stage: proposal.to };
}

export function rejectPromotion(proposalId, reason, rejecterId = "sovereign") {
  const proposal = _proposals.get(proposalId);
  if (!proposal) return { ok: false, error: "Proposal not found" };
  if (proposal.status === "approved") return { ok: false, error: "Already approved" };
  if (proposal.status === "rejected") return { ok: false, error: "Already rejected" };

  proposal.status = "rejected";
  proposal.resolvedAt = nowISO();
  proposal.resolution = `rejected_by_${rejecterId}: ${reason || "no reason"}`;

  _history.push({ action: "rejected", proposalId, rejecterId, reason, timestamp: nowISO() });

  return { ok: true, proposalId, rejected: true, reason };
}

// ── Query Helpers ───────────────────────────────────────────────────────────

export function getQueue() {
  const pending = [];
  for (const p of _proposals.values()) {
    if (p.status.startsWith("pending")) pending.push(p);
  }
  return { ok: true, queue: pending };
}

export function getPromotionHistory(limit = 50) {
  return {
    ok: true,
    history: _history.slice(-limit),
  };
}

export function getProposal(id) {
  const p = _proposals.get(id);
  if (!p) return { ok: false, error: "Proposal not found" };
  return { ok: true, proposal: p };
}

// ── Sovereign Command Handler ───────────────────────────────────────────────

export function handlePromotionCommand(parts) {
  const sub = parts[0]?.toLowerCase();

  switch (sub) {
    case "promote": {
      const [, itemId, itemType] = parts;
      return requestPromotion(itemId, itemType || "app", "sovereign");
    }
    case "promotion-queue":
      return getQueue();
    case "promotion-approve":
      return approvePromotion(parts[1], "sovereign");
    case "promotion-reject":
      return rejectPromotion(parts[1], parts.slice(2).join(" "), "sovereign");
    case "promotion-history":
      return getPromotionHistory(parseInt(parts[1] || "50", 10));
    default:
      return { ok: false, error: `Unknown promotion command: ${sub}` };
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

export function init({ STATE, helpers } = {}) {
  return { ok: true };
}
