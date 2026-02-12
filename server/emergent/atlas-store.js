/**
 * Concord Global Atlas — DTU Store & Status Machine
 *
 * Atlas DTU CRUD, status transitions, claim indexing,
 * and the promotion pipeline with contradiction gates.
 */

import crypto from "crypto";
import { getEmergentState } from "./store.js";
import {
  ATLAS_STATUS, CLAIM_TYPES, SOURCE_TIERS, EVIDENCE_TIERS,
  DOMAIN_TYPE_SET, EPISTEMIC_CLASS_SET, canTransition,
  computeAtlasScores, explainScores, validateAtlasDtu,
  getThresholds, getEpistemicClass, initAtlasState, getAtlasState,
} from "./atlas-epistemic.js";

// ── Atlas DTU ID generator ───────────────────────────────────────────────

function atlasId() {
  return `atlas_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
}

function claimId() {
  return `c_${crypto.randomBytes(4).toString("hex")}`;
}

// ── Content Hash ─────────────────────────────────────────────────────────

export function contentHash(atlasDtu) {
  const text = [
    atlasDtu.title || "",
    ...(atlasDtu.claims || []).map(c => c.text || ""),
    ...(atlasDtu.tags || []),
  ].join("|").toLowerCase().trim();
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

// ── Create Atlas DTU ─────────────────────────────────────────────────────

/**
 * Create a new Atlas DTU. Enters as DRAFT by default.
 * Hard-fail if domainType or epistemicClass missing.
 */
export function createAtlasDtu(STATE, input) {
  const atlas = getAtlasState(STATE);
  const now = new Date().toISOString();

  // Resolve epistemic class from domain if not explicitly set
  const domainType = input.domainType;
  const epistemicClass = input.epistemicClass || getEpistemicClass(domainType);

  if (!domainType || !DOMAIN_TYPE_SET.has(domainType)) {
    return { ok: false, error: `Invalid domainType: ${domainType}` };
  }
  if (!epistemicClass || !EPISTEMIC_CLASS_SET.has(epistemicClass)) {
    return { ok: false, error: `Invalid epistemicClass: ${epistemicClass}` };
  }

  // Build claims with IDs
  const claims = (input.claims || []).map(c => ({
    claimId: c.claimId || claimId(),
    claimType: c.claimType || "FACT",
    text: c.text || "",
    entities: c.entities || [],
    timeRange: c.timeRange || null,
    numeric: c.numeric || [],
    sources: (c.sources || []).map(s => ({
      sourceId: s.sourceId || `src_${crypto.randomBytes(4).toString("hex")}`,
      title: s.title || "",
      publisher: s.publisher || "",
      url: s.url || "",
      sourceTier: s.sourceTier || "UNCITED",
      retrievedAt: s.retrievedAt || Date.now(),
      quoteAnchors: s.quoteAnchors || [],
    })),
    evidenceTier: c.evidenceTier || "UNCORROBORATED",
    confidence: c.confidence || { factual: 0, structural: 0, overall: 0 },
    dispute: c.dispute || { isDisputed: false, reasons: [] },
  }));

  // Label uncited facts
  for (const claim of claims) {
    if (claim.claimType === "FACT" && claim.sources.length === 0) {
      claim.evidenceTier = "UNCORROBORATED";
    }
  }

  const dtu = {
    id: input.id || atlasId(),
    schemaVersion: "atlas-1.0",
    createdAt: now,
    updatedAt: now,

    title: input.title || "Untitled Atlas DTU",
    tags: input.tags || [],
    domainType,
    epistemicClass,

    status: ATLAS_STATUS.DRAFT,
    author: {
      userId: input.author?.userId || "unknown",
      display: input.author?.display || "",
      isSystem: input.author?.isSystem || false,
    },

    claims,

    interpretations: (input.interpretations || []).map(i => ({
      interpId: i.interpId || `i_${crypto.randomBytes(4).toString("hex")}`,
      school: i.school || "",
      text: i.text || "",
      supportsClaims: i.supportsClaims || [],
      sources: i.sources || [],
      confidence: i.confidence || { structural: 0, overall: 0 },
    })),

    assumptions: (input.assumptions || []).map(a => ({
      assumptionId: a.assumptionId || `a_${crypto.randomBytes(4).toString("hex")}`,
      text: a.text || "",
      appliesTo: a.appliesTo || [epistemicClass],
      sensitivity: a.sensitivity || "MEDIUM",
    })),

    provenance: (input.provenance || []).map(p => ({
      provId: p.provId || `p_${crypto.randomBytes(4).toString("hex")}`,
      type: p.type || "GENERAL",
      text: p.text || "",
      sources: p.sources || [],
    })),

    links: {
      supports: input.links?.supports || [],
      contradicts: input.links?.contradicts || [],
      sameAs: input.links?.sameAs || [],
      about: input.links?.about || [],
    },

    scores: { confidence_factual: 0, credibility_structural: 0, confidence_overall: 0 },

    lineage: {
      origin: input.lineage?.origin || "HUMAN",
      generationDepth: input.lineage?.generationDepth || 0,
      parents: input.lineage?.parents || [],
      runId: input.lineage?.runId || null,
      hash: "",
    },

    audit: {
      events: [{
        ts: Date.now(),
        actor: input.author?.isSystem ? "system" : (input.author?.userId || "unknown"),
        action: "CREATE",
        diff: "Initial creation",
      }],
    },

    // Domain-specific flags
    proofVerified: input.proofVerified || false,
    replicationCount: input.replicationCount || 0,

    // Rights metadata (persisted at DTU level for license resolution)
    license_type: input.license_type || null,
    license_custom: input.license_custom || null,

    // Lane identity (defense in depth — set at creation, never changed directly)
    _lane: input._scope || input._lane || "local",
  };

  // Compute hash
  dtu.lineage.hash = contentHash(dtu);

  // Validate
  const validation = validateAtlasDtu(dtu);
  if (!validation.valid) {
    return { ok: false, error: "Validation failed", errors: validation.errors, warnings: validation.warnings };
  }

  // Compute scores
  const scores = computeAtlasScores(dtu);
  dtu.scores = {
    confidence_factual: scores.confidence_factual,
    credibility_structural: scores.credibility_structural,
    confidence_overall: scores.confidence_overall,
  };

  // Store
  atlas.dtus.set(dtu.id, dtu);

  // Update indices
  indexAtlasDtu(atlas, dtu);

  atlas.metrics.dtusCreated++;

  return {
    ok: true,
    dtu,
    scores,
    validation,
  };
}

// ── Index Management ─────────────────────────────────────────────────────

function indexAtlasDtu(atlas, dtu) {
  // Domain type index
  if (!atlas.byDomainType.has(dtu.domainType)) atlas.byDomainType.set(dtu.domainType, new Set());
  atlas.byDomainType.get(dtu.domainType).add(dtu.id);

  // Epistemic class index
  if (!atlas.byEpistemicClass.has(dtu.epistemicClass)) atlas.byEpistemicClass.set(dtu.epistemicClass, new Set());
  atlas.byEpistemicClass.get(dtu.epistemicClass).add(dtu.id);

  // Status index
  if (!atlas.byStatus.has(dtu.status)) atlas.byStatus.set(dtu.status, new Set());
  atlas.byStatus.get(dtu.status).add(dtu.id);

  // Claims index
  for (const claim of (dtu.claims || [])) {
    atlas.claims.set(`${dtu.id}:${claim.claimId}`, claim);
  }

  // Source index
  for (const claim of (dtu.claims || [])) {
    for (const src of (claim.sources || [])) {
      if (src.url) {
        if (!atlas.sources.has(src.url)) atlas.sources.set(src.url, new Set());
        atlas.sources.get(src.url).add(dtu.id);
      }
    }
  }

  // Entity/about index
  for (const aboutLink of (dtu.links?.about || [])) {
    if (aboutLink.entityId) {
      if (!atlas.about.has(dtu.id)) atlas.about.set(dtu.id, new Set());
      atlas.about.get(dtu.id).add(aboutLink.entityId);
    }
  }

  // Lane index (defense in depth)
  const lane = dtu._lane || "local";
  if (!atlas.byLane) atlas.byLane = new Map();
  if (!atlas.byLane.has(lane)) atlas.byLane.set(lane, new Set());
  atlas.byLane.get(lane).add(dtu.id);
}

// ── Get Atlas DTU ────────────────────────────────────────────────────────

export function getAtlasDtu(STATE, dtuId) {
  const atlas = getAtlasState(STATE);
  const dtu = atlas.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "Atlas DTU not found" };
  return { ok: true, dtu };
}

// ── Search Atlas DTUs ────────────────────────────────────────────────────

export function searchAtlasDtus(STATE, query = {}) {
  const atlas = getAtlasState(STATE);
  let candidates = new Set();
  let filtered = false;

  // Filter by domain type
  if (query.domainType) {
    const set = atlas.byDomainType.get(query.domainType);
    if (set) {
      for (const id of set) candidates.add(id);
      filtered = true;
    }
  }

  // Filter by epistemic class
  if (query.epistemicClass) {
    const set = atlas.byEpistemicClass.get(query.epistemicClass);
    if (filtered) {
      const intersection = new Set();
      for (const id of candidates) {
        if (set?.has(id)) intersection.add(id);
      }
      candidates = intersection;
    } else if (set) {
      for (const id of set) candidates.add(id);
      filtered = true;
    }
  }

  // Filter by status
  if (query.status) {
    const set = atlas.byStatus.get(query.status);
    if (filtered) {
      const intersection = new Set();
      for (const id of candidates) {
        if (set?.has(id)) intersection.add(id);
      }
      candidates = intersection;
    } else if (set) {
      for (const id of set) candidates.add(id);
      filtered = true;
    }
  }

  // Filter by lane (defense in depth — every query can include lane predicate)
  if (query.lane || query._lane) {
    const lane = query.lane || query._lane;
    const laneSet = atlas.byLane?.get(lane);
    if (filtered) {
      const intersection = new Set();
      for (const id of candidates) {
        if (laneSet?.has(id)) intersection.add(id);
      }
      candidates = intersection;
    } else if (laneSet) {
      for (const id of laneSet) candidates.add(id);
      filtered = true;
    }
  }

  // If no filters, start with all
  if (!filtered) {
    for (const id of atlas.dtus.keys()) candidates.add(id);
  }

  // Resolve to DTU objects
  let results = [];
  for (const id of candidates) {
    const dtu = atlas.dtus.get(id);
    if (dtu) results.push(dtu);
  }

  // Filter by min confidence
  if (query.minConfidence !== undefined) {
    results = results.filter(d => d.scores.confidence_overall >= query.minConfidence);
  }

  // Filter by entity
  if (query.entity) {
    results = results.filter(d => {
      const aboutSet = atlas.about.get(d.id);
      return aboutSet?.has(query.entity);
    });
  }

  // Sort by confidence descending
  results.sort((a, b) => b.scores.confidence_overall - a.scores.confidence_overall);

  // Pagination
  const limit = Math.min(query.limit || 50, 200);
  const offset = query.offset || 0;
  const total = results.length;
  results = results.slice(offset, offset + limit);

  return { ok: true, results, total, limit, offset };
}

// ── Promote Atlas DTU (status transition with gates) ─────────────────────

export function promoteAtlasDtu(STATE, dtuId, targetStatus, actor = "system", expectedStatus = null) {
  const atlas = getAtlasState(STATE);
  const dtu = atlas.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "Atlas DTU not found" };

  const currentStatus = dtu.status;

  // ── Idempotency: already at target status → noop success ──────────────
  if (currentStatus === targetStatus) {
    return { ok: true, dtu, transition: { from: currentStatus, to: targetStatus }, noop: true };
  }

  // ── Compare-and-swap: if expectedStatus is given, verify it matches ───
  // Prevents double-promote races (heartbeat + API both try at once)
  if (expectedStatus && currentStatus !== expectedStatus) {
    return {
      ok: false,
      error: `CAS failed: expected status ${expectedStatus}, actual ${currentStatus}`,
      currentStatus,
    };
  }

  if (!canTransition(currentStatus, targetStatus)) {
    return {
      ok: false,
      error: `Cannot transition from ${currentStatus} to ${targetStatus}`,
      allowedTransitions: getStatusTransitions(currentStatus),
    };
  }

  // Run validation gates
  if (targetStatus === ATLAS_STATUS.PROPOSED) {
    const scores = computeAtlasScores(dtu);
    const thresholds = getThresholds(dtu.epistemicClass);
    if (scores.credibility_structural < thresholds.min_structural_for_proposed) {
      return {
        ok: false,
        error: "Structural credibility below threshold for PROPOSED",
        required: thresholds.min_structural_for_proposed,
        actual: scores.credibility_structural,
      };
    }
  }

  if (targetStatus === ATLAS_STATUS.VERIFIED) {
    // Count contradictions
    const contradictions = dtu.links?.contradicts || [];
    const contradictionCount = {
      HIGH: contradictions.filter(c => c.severity === "HIGH").length,
      MEDIUM: contradictions.filter(c => c.severity === "MEDIUM").length,
      LOW: contradictions.filter(c => c.severity === "LOW").length,
    };

    const explanation = explainScores(dtu, contradictionCount);
    if (!explanation.canBeVerified) {
      return {
        ok: false,
        error: "DTU does not meet VERIFIED criteria",
        whyNotVerified: explanation.whyNotVerified,
        scores: {
          confidence_factual: explanation.confidence_factual,
          credibility_structural: explanation.credibility_structural,
          confidence_overall: explanation.confidence_overall,
        },
      };
    }
  }

  // Execute transition
  const oldStatus = dtu.status;
  atlas.byStatus.get(oldStatus)?.delete(dtu.id);
  dtu.status = targetStatus;
  if (!atlas.byStatus.has(targetStatus)) atlas.byStatus.set(targetStatus, new Set());
  atlas.byStatus.get(targetStatus).add(dtu.id);
  dtu.updatedAt = new Date().toISOString();

  // Audit
  dtu.audit.events.push({
    ts: Date.now(),
    actor,
    action: `STATUS_CHANGE`,
    diff: `${oldStatus} → ${targetStatus}`,
  });

  // Update metrics
  if (targetStatus === "VERIFIED") atlas.metrics.dtusVerified++;
  if (targetStatus === "DISPUTED") atlas.metrics.dtusDisputed++;
  if (targetStatus === "QUARANTINED") atlas.metrics.dtusQuarantined++;

  // Log to atlas audit
  atlas.audit.push({
    ts: Date.now(),
    actor,
    dtuId: dtu.id,
    action: "PROMOTE",
    from: oldStatus,
    to: targetStatus,
  });

  return {
    ok: true,
    dtu,
    transition: { from: oldStatus, to: targetStatus },
  };
}

function getStatusTransitions(status) {
  const transitions = {
    DRAFT: ["PROPOSED"],
    PROPOSED: ["VERIFIED", "DISPUTED", "QUARANTINED"],
    VERIFIED: ["DISPUTED", "DEPRECATED", "QUARANTINED"],
    DISPUTED: ["VERIFIED", "QUARANTINED"],
    DEPRECATED: ["QUARANTINED"],
    QUARANTINED: [],
  };
  return transitions[status] || [];
}

// ── Add Link (support/contradict/sameAs/about) ──────────────────────────

export function addAtlasLink(STATE, srcDtuId, dstDtuId, linkType, meta = {}) {
  const atlas = getAtlasState(STATE);
  const srcDtu = atlas.dtus.get(srcDtuId);
  const dstDtu = atlas.dtus.get(dstDtuId);

  if (!srcDtu) return { ok: false, error: `Source DTU not found: ${srcDtuId}` };
  if (!dstDtu) return { ok: false, error: `Target DTU not found: ${dstDtuId}` };

  const validTypes = ["supports", "contradicts", "sameAs", "about"];
  if (!validTypes.includes(linkType)) {
    return { ok: false, error: `Invalid link type: ${linkType}. Must be one of: ${validTypes.join(", ")}` };
  }

  const link = {
    targetDtuId: dstDtuId,
    claimIds: meta.claimIds || [],
    strength: meta.strength || 0.5,
    type: meta.contradictionType || null,
    severity: meta.severity || "MEDIUM",
    createdAt: new Date().toISOString(),
    createdBy: meta.actor || "system",
  };

  if (!srcDtu.links[linkType]) srcDtu.links[linkType] = [];
  srcDtu.links[linkType].push(link);

  // For contradictions, add reverse link
  if (linkType === "contradicts") {
    if (!dstDtu.links.contradicts) dstDtu.links.contradicts = [];
    dstDtu.links.contradicts.push({
      targetDtuId: srcDtuId,
      claimIds: meta.claimIds || [],
      strength: meta.strength || 0.5,
      type: meta.contradictionType || null,
      severity: meta.severity || "MEDIUM",
      createdAt: new Date().toISOString(),
      createdBy: meta.actor || "system",
    });
    atlas.metrics.contradictionsLogged++;

    // Check if this should trigger DISPUTED status
    if (meta.severity === "HIGH" && dstDtu.status === "VERIFIED") {
      // Check if the source DTU has higher confidence
      if (srcDtu.scores.confidence_overall > dstDtu.scores.confidence_overall) {
        promoteAtlasDtu(STATE, dstDtuId, "DISPUTED", meta.actor || "system");
      }
    }
  }

  // Store in global links list
  atlas.links.push({
    srcDtuId,
    dstDtuId,
    linkType,
    ...link,
  });

  // Audit
  srcDtu.audit.events.push({
    ts: Date.now(),
    actor: meta.actor || "system",
    action: `LINK_${linkType.toUpperCase()}`,
    diff: `→ ${dstDtuId}`,
  });

  return { ok: true, link };
}

// ── Score Explanation ────────────────────────────────────────────────────

export function getScoreExplanation(STATE, dtuId) {
  const atlas = getAtlasState(STATE);
  const dtu = atlas.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "Atlas DTU not found" };

  const contradictions = dtu.links?.contradicts || [];
  const contradictionCount = {
    HIGH: contradictions.filter(c => c.severity === "HIGH").length,
    MEDIUM: contradictions.filter(c => c.severity === "MEDIUM").length,
    LOW: contradictions.filter(c => c.severity === "LOW").length,
  };

  const explanation = explainScores(dtu, contradictionCount);
  atlas.metrics.scoreComputations++;

  return { ok: true, dtuId, ...explanation };
}

// ── Recompute Scores ─────────────────────────────────────────────────────

export function recomputeScores(STATE, dtuId) {
  const atlas = getAtlasState(STATE);
  const dtu = atlas.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "Atlas DTU not found" };

  const scores = computeAtlasScores(dtu);
  dtu.scores = {
    confidence_factual: scores.confidence_factual,
    credibility_structural: scores.credibility_structural,
    confidence_overall: scores.confidence_overall,
  };
  dtu.updatedAt = new Date().toISOString();
  atlas.metrics.scoreComputations++;

  return { ok: true, dtuId, scores };
}

// ── Entity Management ────────────────────────────────────────────────────

export function registerEntity(STATE, entityId, label, type = "TOPIC") {
  const atlas = getAtlasState(STATE);
  atlas.entities.set(entityId, { label, type, createdAt: new Date().toISOString() });
  return { ok: true, entityId, label, type };
}

export function getEntity(STATE, entityId) {
  const atlas = getAtlasState(STATE);
  const entity = atlas.entities.get(entityId);
  if (!entity) return { ok: false, error: "Entity not found" };

  // Find all DTUs about this entity
  const dtuIds = [];
  for (const [dtuId, entities] of atlas.about) {
    if (entities.has(entityId)) dtuIds.push(dtuId);
  }
  const dtus = dtuIds.map(id => atlas.dtus.get(id)).filter(Boolean);

  return { ok: true, entity: { entityId, ...entity }, dtus, dtuCount: dtus.length };
}

// ── Contradictions View ──────────────────────────────────────────────────

export function getContradictions(STATE, dtuId) {
  const atlas = getAtlasState(STATE);
  const dtu = atlas.dtus.get(dtuId);
  if (!dtu) return { ok: false, error: "Atlas DTU not found" };

  const contradictions = (dtu.links?.contradicts || []).map(c => {
    const targetDtu = atlas.dtus.get(c.targetDtuId);
    return {
      ...c,
      targetTitle: targetDtu?.title || "Unknown",
      targetConfidence: targetDtu?.scores?.confidence_overall || 0,
      targetStatus: targetDtu?.status || "UNKNOWN",
    };
  });

  return {
    ok: true,
    dtuId,
    dtuTitle: dtu.title,
    contradictions,
    count: contradictions.length,
    bySeverity: {
      HIGH: contradictions.filter(c => c.severity === "HIGH").length,
      MEDIUM: contradictions.filter(c => c.severity === "MEDIUM").length,
      LOW: contradictions.filter(c => c.severity === "LOW").length,
    },
  };
}

// ── Atlas Metrics ────────────────────────────────────────────────────────

export function getAtlasMetrics(STATE) {
  const atlas = getAtlasState(STATE);

  const byDomain = {};
  for (const [domain, ids] of atlas.byDomainType) {
    byDomain[domain] = ids.size;
  }

  const byClass = {};
  for (const [cls, ids] of atlas.byEpistemicClass) {
    byClass[cls] = ids.size;
  }

  const byStatus = {};
  for (const [status, ids] of atlas.byStatus) {
    byStatus[status] = ids.size;
  }

  return {
    ok: true,
    totalDtus: atlas.dtus.size,
    byDomain,
    byClass,
    byStatus,
    totalLinks: atlas.links.length,
    totalEntities: atlas.entities.size,
    totalAuditEvents: atlas.audit.length,
    ...atlas.metrics,
  };
}
