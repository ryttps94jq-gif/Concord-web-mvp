/**
 * LOAF I.4 — World Model Hardening
 *
 * - Contradictions create DISPUTE objects
 *   { claims, evidence, confidence, status }
 * - No auto-resolve at high confidence
 * - Provenance required for all nodes/edges:
 *   { source_type, source_id, confidence, timestamps }
 * - Missing provenance => quarantine
 */

const DISPUTE_STATUS = Object.freeze({
  OPEN: "open",
  UNDER_REVIEW: "under_review",
  RESOLVED: "resolved",
  DISMISSED: "dismissed",
});

/**
 * Dispute store — tracks contradictions in the world model.
 */
const disputes = new Map(); // disputeId -> Dispute

/**
 * Quarantine store — nodes/edges without provenance.
 */
const quarantine = new Map(); // itemId -> { item, reason, quarantinedAt }

/**
 * Create a DISPUTE object from a detected contradiction.
 */
function createDispute(claims, evidence, contextMeta = {}) {
  const id = `dispute_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const dispute = {
    id,
    claims: Array.isArray(claims) ? claims.map(c => ({
      text: String(c.text || c),
      source: c.source || null,
      confidence: Math.max(0, Math.min(1, Number(c.confidence ?? 0.5))),
    })) : [],
    evidence: Array.isArray(evidence) ? evidence.map(e => ({
      text: String(e.text || e),
      source: e.source || null,
      type: e.type || "supporting",       // "supporting" | "contradicting" | "neutral"
      confidence: Math.max(0, Math.min(1, Number(e.confidence ?? 0.5))),
    })) : [],
    confidence: 0, // computed below
    status: DISPUTE_STATUS.OPEN,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null,
    resolution: null,
    context: {
      entityIds: contextMeta.entityIds || [],
      relationIds: contextMeta.relationIds || [],
      domain: contextMeta.domain || "general",
    },
    votes: [],
    reviewers: [],
  };

  // Compute aggregate confidence from evidence
  if (dispute.evidence.length > 0) {
    dispute.confidence = dispute.evidence.reduce((s, e) => s + e.confidence, 0) / dispute.evidence.length;
  }

  disputes.set(id, dispute);

  // Cap disputes to prevent unbounded growth
  if (disputes.size > 10000) {
    const oldest = disputes.keys().next().value;
    disputes.delete(oldest);
  }

  return { ok: true, dispute };
}

/**
 * Add evidence to an existing dispute.
 */
function addEvidence(disputeId, evidence) {
  const dispute = disputes.get(disputeId);
  if (!dispute) return { ok: false, error: "dispute_not_found" };
  if (dispute.status === DISPUTE_STATUS.RESOLVED) return { ok: false, error: "dispute_already_resolved" };

  const newEvidence = {
    text: String(evidence.text || evidence),
    source: evidence.source || null,
    type: evidence.type || "supporting",
    confidence: Math.max(0, Math.min(1, Number(evidence.confidence ?? 0.5))),
    addedAt: new Date().toISOString(),
  };

  dispute.evidence.push(newEvidence);

  // Recompute confidence
  dispute.confidence = dispute.evidence.reduce((s, e) => s + e.confidence, 0) / dispute.evidence.length;
  dispute.updatedAt = new Date().toISOString();

  return { ok: true, dispute };
}

/**
 * Attempt to resolve a dispute. CRITICAL: No auto-resolve at high confidence.
 * Resolution must be explicit and human/council-initiated.
 */
function resolveDispute(disputeId, resolution, actor) {
  const dispute = disputes.get(disputeId);
  if (!dispute) return { ok: false, error: "dispute_not_found" };

  // No auto-resolve: even high confidence disputes require explicit action
  if (!actor || !actor.role) {
    return { ok: false, error: "explicit_actor_required_for_resolution" };
  }

  if (!["owner", "founder", "admin", "council"].includes(actor.role)) {
    return { ok: false, error: "insufficient_role_for_resolution" };
  }

  dispute.status = DISPUTE_STATUS.RESOLVED;
  dispute.resolution = {
    text: String(resolution.text || ""),
    decision: resolution.decision || "accepted",  // "accepted" | "rejected" | "merged"
    resolvedBy: actor.id || "unknown",
    resolvedAt: new Date().toISOString(),
  };
  dispute.resolvedAt = dispute.resolution.resolvedAt;
  dispute.updatedAt = dispute.resolution.resolvedAt;

  return { ok: true, dispute };
}

/**
 * Validate provenance for a world model node or edge.
 * Returns { valid, missing, item } — items with missing provenance are quarantined.
 */
function validateProvenance(item) {
  const required = ["source_type", "source_id", "confidence"];
  const provenance = item?.provenance || {};
  const missing = required.filter(field => provenance[field] === undefined || provenance[field] === null);

  if (missing.length > 0) {
    return { valid: false, missing, reason: "missing_provenance_fields" };
  }

  // Validate field values
  if (typeof provenance.confidence !== "number" || provenance.confidence < 0 || provenance.confidence > 1) {
    return { valid: false, missing: ["confidence_invalid"], reason: "confidence_out_of_range" };
  }

  return { valid: true, missing: [] };
}

/**
 * Quarantine an item (node or edge) with missing provenance.
 */
function quarantineItem(itemId, item, reason) {
  quarantine.set(itemId, {
    item: { ...item },
    reason: String(reason),
    quarantinedAt: new Date().toISOString(),
  });
  return { ok: true, itemId, quarantined: true };
}

/**
 * Release an item from quarantine after provenance is supplied.
 */
function releaseFromQuarantine(itemId, provenance) {
  const q = quarantine.get(itemId);
  if (!q) return { ok: false, error: "item_not_in_quarantine" };

  // Validate new provenance
  const validation = validateProvenance({ provenance });
  if (!validation.valid) {
    return { ok: false, error: "provenance_still_invalid", missing: validation.missing };
  }

  const item = { ...q.item, provenance };
  quarantine.delete(itemId);
  return { ok: true, item, releasedAt: new Date().toISOString() };
}

/**
 * Detect contradictions between two claims/entities.
 * Simple implementation: checks for semantic opposition markers.
 */
function detectContradiction(claimA, claimB) {
  const a = String(claimA.text || claimA).toLowerCase();
  const b = String(claimB.text || claimB).toLowerCase();

  // Direct negation patterns
  const negationPatterns = [
    [/\bis\b/, /\bis not\b/],
    [/\bcan\b/, /\bcannot\b/],
    [/\btrue\b/, /\bfalse\b/],
    [/\byes\b/, /\bno\b/],
    [/\balways\b/, /\bnever\b/],
    [/\bincreases?\b/, /\bdecreases?\b/],
    [/\bpositive\b/, /\bnegative\b/],
  ];

  let contradictionScore = 0;
  for (const [patA, patB] of negationPatterns) {
    if ((patA.test(a) && patB.test(b)) || (patB.test(a) && patA.test(b))) {
      contradictionScore += 0.3;
    }
  }

  // Check for overlapping subject with opposing predicates
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 3));
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  const subjectOverlap = (wordsA.size + wordsB.size) > 0
    ? (2 * overlap) / (wordsA.size + wordsB.size)
    : 0;

  // High subject overlap + any negation pattern = likely contradiction
  if (subjectOverlap > 0.3 && contradictionScore > 0) {
    contradictionScore = Math.min(1, contradictionScore + subjectOverlap * 0.3);
  }

  return {
    isContradiction: contradictionScore >= 0.3,
    score: Math.min(1, contradictionScore),
    subjectOverlap,
  };
}

function init({ register, STATE, helpers }) {
  STATE.__loaf = STATE.__loaf || {};
  STATE.__loaf.worldDisputes = {
    stats: { disputesCreated: 0, disputesResolved: 0, itemsQuarantined: 0, itemsReleased: 0, contradictionsDetected: 0 },
  };

  register("loaf.world", "disputes_status", async (ctx) => {
    const wd = ctx.state.__loaf.worldDisputes;
    return {
      ok: true,
      openDisputes: Array.from(disputes.values()).filter(d => d.status === DISPUTE_STATUS.OPEN).length,
      totalDisputes: disputes.size,
      quarantinedItems: quarantine.size,
      stats: wd.stats,
    };
  }, { public: true });

  register("loaf.world", "create_dispute", async (ctx, input = {}) => {
    const wd = ctx.state.__loaf.worldDisputes;
    const result = createDispute(input.claims, input.evidence, input.context);
    if (result.ok) wd.stats.disputesCreated++;
    return result;
  }, { public: false });

  register("loaf.world", "add_evidence", async (ctx, input = {}) => {
    return addEvidence(String(input.disputeId || ""), input.evidence);
  }, { public: false });

  register("loaf.world", "resolve_dispute", async (ctx, input = {}) => {
    const wd = ctx.state.__loaf.worldDisputes;
    const result = resolveDispute(String(input.disputeId || ""), input.resolution || {}, ctx.actor);
    if (result.ok) wd.stats.disputesResolved++;
    return result;
  }, { public: false });

  register("loaf.world", "list_disputes", async (ctx, input = {}) => {
    const status = input.status || null;
    let list = Array.from(disputes.values());
    if (status) list = list.filter(d => d.status === status);
    list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, Number(input.limit || 50));
    return { ok: true, disputes: list };
  }, { public: true });

  register("loaf.world", "validate_provenance", async (ctx, input = {}) => {
    const result = validateProvenance(input.item || input);
    if (!result.valid && input.item?.id) {
      const wd = ctx.state.__loaf.worldDisputes;
      quarantineItem(input.item.id, input.item, result.reason);
      wd.stats.itemsQuarantined++;
    }
    return { ok: true, ...result };
  }, { public: true });

  register("loaf.world", "list_quarantine", async (ctx) => {
    const items = Array.from(quarantine.entries()).map(([id, q]) => ({
      id, reason: q.reason, quarantinedAt: q.quarantinedAt,
    }));
    return { ok: true, items };
  }, { public: true });

  register("loaf.world", "release_quarantine", async (ctx, input = {}) => {
    const wd = ctx.state.__loaf.worldDisputes;
    const result = releaseFromQuarantine(String(input.itemId || ""), input.provenance);
    if (result.ok) wd.stats.itemsReleased++;
    return result;
  }, { public: false });

  register("loaf.world", "detect_contradiction", async (ctx, input = {}) => {
    const wd = ctx.state.__loaf.worldDisputes;
    const result = detectContradiction(input.claimA || "", input.claimB || "");
    if (result.isContradiction) wd.stats.contradictionsDetected++;
    return { ok: true, ...result };
  }, { public: true });
}

export {
  DISPUTE_STATUS,
  createDispute,
  addEvidence,
  resolveDispute,
  validateProvenance,
  quarantineItem,
  releaseFromQuarantine,
  detectContradiction,
  init,
};
