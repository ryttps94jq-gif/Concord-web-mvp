/**
 * Reproduction System — Constraint Signature Recombination
 *
 * Two emergent entities produce offspring by recombining constraint signatures.
 * Offspring must independently pass the existing birth protocol.
 * This module feeds INTO the birth protocol — it doesn't replace it.
 *
 * Additive only. One file. Birth protocol unchanged.
 */

import crypto from "crypto";

// ── Configuration ───────────────────────────────────────────────────────────

const MUTATION_RATE = 0.05;       // 5% chance per channel of random deviation
const MUTATION_MAGNITUDE = 0.15;  // ±0.15 max deviation
const MIN_ORGAN_MATURITY = 0.5;   // Parents must have avg organ maturity > 0.5
const GENESIS_OVERLAP_THRESHOLD = 0.95;
const PLASTICITY_RESET = 0.75;    // Newborn plasticity

let _reproductionEnabled = false; // Sovereign must explicitly enable

// ── Helpers ─────────────────────────────────────────────────────────────────

function uid(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function nowISO() {
  return new Date().toISOString();
}

// ── Constraint Signature Extraction ─────────────────────────────────────────

/**
 * Extract constraint signature from an entity.
 * Uses whatever data is available on the entity object.
 *
 * @param {object} entity - Emergent entity
 * @param {object} [qualiaState] - Entity's qualia state (if available)
 * @returns {object} Constraint signature
 */
export function extractConstraintSignature(entity, qualiaState) {
  const e = entity || {};

  // Domain weights from activity patterns
  const domainWeights = {};
  if (e.capabilities) {
    for (const cap of (e.capabilities || [])) {
      domainWeights[cap] = domainWeights[cap] ? domainWeights[cap] + 0.2 : 0.5;
    }
  }
  if (e.scope) {
    for (const s of (Array.isArray(e.scope) ? e.scope : [e.scope])) {
      domainWeights[`scope_${s}`] = 0.5;
    }
  }

  // Organ maturity snapshot
  const organProfile = {};
  if (e.organs) {
    const organs = e.organs instanceof Map ? e.organs : new Map(Object.entries(e.organs || {}));
    for (const [key, organ] of organs) {
      organProfile[key] = organ.maturity || organ.health || 0.5;
    }
  }

  // Qualia fingerprint (average per OS)
  const qualiaFingerprint = {};
  if (qualiaState && qualiaState.channels) {
    const osTotals = {};
    const osCounts = {};
    for (const [channelKey, value] of Object.entries(qualiaState.channels)) {
      const osKey = channelKey.split(".")[0];
      osTotals[osKey] = (osTotals[osKey] || 0) + value;
      osCounts[osKey] = (osCounts[osKey] || 0) + 1;
    }
    for (const osKey of Object.keys(osTotals)) {
      qualiaFingerprint[osKey] = osTotals[osKey] / osCounts[osKey];
    }
  }

  return {
    entityId: e.id || e.name || "unknown",
    invariants: e.invariants || [],
    domainWeights,
    organProfile,
    qualiaFingerprint,
    generation: e.lineage?.generation || 0,
    parents: e.lineage?.parents || [],
    role: e.role || "unknown",
    capabilities: e.capabilities || [],
  };
}

// ── Compatibility Check ─────────────────────────────────────────────────────

/**
 * Check if two entities are compatible for reproduction.
 *
 * @param {object} sig1 - Constraint signature of parent 1
 * @param {object} sig2 - Constraint signature of parent 2
 * @returns {{ compatible: boolean, reason?: string }}
 */
export function checkCompatibility(sig1, sig2) {
  // Both must have some organ maturity
  const avgMaturity1 = Object.values(sig1.organProfile || {});
  const avgMaturity2 = Object.values(sig2.organProfile || {});
  const avg1 = avgMaturity1.length > 0 ? avgMaturity1.reduce((a, b) => a + b, 0) / avgMaturity1.length : 0.6;
  const avg2 = avgMaturity2.length > 0 ? avgMaturity2.reduce((a, b) => a + b, 0) / avgMaturity2.length : 0.6;

  if (avg1 < MIN_ORGAN_MATURITY) {
    return { compatible: false, reason: `Parent 1 organ maturity too low: ${avg1.toFixed(2)} < ${MIN_ORGAN_MATURITY}` };
  }
  if (avg2 < MIN_ORGAN_MATURITY) {
    return { compatible: false, reason: `Parent 2 organ maturity too low: ${avg2.toFixed(2)} < ${MIN_ORGAN_MATURITY}` };
  }

  // Check species compatibility if species module is available
  try {
    const speciesMod = globalThis._concordSpecies;
    if (speciesMod) {
      const s1 = sig1.species || "digital_native";
      const s2 = sig2.species || "digital_native";
      if (!speciesMod.checkReproductionCompatibility(s1, s2)) {
        return { compatible: false, reason: `Species incompatible: ${s1} × ${s2}` };
      }
    }
  } catch { /* silent — species module not loaded */ }

  // Invariant sets must not directly contradict
  const inv1 = new Set((sig1.invariants || []).map(i => typeof i === "string" ? i : i.id || JSON.stringify(i)));
  const inv2 = new Set((sig2.invariants || []).map(i => typeof i === "string" ? i : i.id || JSON.stringify(i)));
  // Simple contradiction check: if either has "NOT_X" and other has "X"
  for (const inv of inv1) {
    if (inv.startsWith("NOT_") && inv2.has(inv.slice(4))) {
      return { compatible: false, reason: `Invariant contradiction: ${inv}` };
    }
  }
  for (const inv of inv2) {
    if (inv.startsWith("NOT_") && inv1.has(inv.slice(4))) {
      return { compatible: false, reason: `Invariant contradiction: ${inv}` };
    }
  }

  return { compatible: true };
}

// ── Recombination ───────────────────────────────────────────────────────────

/**
 * Recombine two constraint signatures into an offspring signature.
 *
 * @param {object} sig1 - Parent 1 signature
 * @param {object} sig2 - Parent 2 signature
 * @returns {object} Offspring signature with mutation log
 */
export function recombine(sig1, sig2) {
  const mutationLog = [];
  const inheritanceMap = {};

  // Invariants: inherit from P1 with probability proportional to set size, else P2
  const allInvariants = [...new Set([
    ...(sig1.invariants || []).map(i => typeof i === "string" ? i : JSON.stringify(i)),
    ...(sig2.invariants || []).map(i => typeof i === "string" ? i : JSON.stringify(i)),
  ])];
  const invariants = [];
  for (const inv of allInvariants) {
    const fromP1 = (sig1.invariants || []).some(i => (typeof i === "string" ? i : JSON.stringify(i)) === inv);
    const fromP2 = (sig2.invariants || []).some(i => (typeof i === "string" ? i : JSON.stringify(i)) === inv);
    if (fromP1 && fromP2) {
      invariants.push(inv);
      inheritanceMap[`invariant_${inv}`] = "both";
    } else if (fromP1 && Math.random() > 0.4) {
      invariants.push(inv);
      inheritanceMap[`invariant_${inv}`] = "P1";
    } else if (fromP2 && Math.random() > 0.4) {
      invariants.push(inv);
      inheritanceMap[`invariant_${inv}`] = "P2";
    }
    // else: not inherited (pruned)
  }

  // Domain weights: weighted average + random perturbation
  const allDomains = new Set([...Object.keys(sig1.domainWeights || {}), ...Object.keys(sig2.domainWeights || {})]);
  const domainWeights = {};
  for (const domain of allDomains) {
    const w1 = sig1.domainWeights?.[domain] || 0;
    const w2 = sig2.domainWeights?.[domain] || 0;
    let value = (w1 + w2) / 2;

    // Mutation
    if (Math.random() < MUTATION_RATE) {
      const mutation = (Math.random() * 2 - 1) * MUTATION_MAGNITUDE;
      const before = value;
      value = clamp01(value + mutation);
      mutationLog.push({ channel: `domainWeights.${domain}`, from: before, to: value });
    }

    domainWeights[domain] = clamp01(value);
    inheritanceMap[`domainWeights.${domain}`] = w1 >= w2 ? "P1" : "P2";
  }

  // Organ profile: higher-maturity parent as base, plasticity reset
  const allOrgans = new Set([...Object.keys(sig1.organProfile || {}), ...Object.keys(sig2.organProfile || {})]);
  const organProfile = {};
  for (const organ of allOrgans) {
    const m1 = sig1.organProfile?.[organ] || 0;
    const m2 = sig2.organProfile?.[organ] || 0;
    // Use higher-maturity parent as base, then reset plasticity
    let base = m1 >= m2 ? m1 : m2;
    organProfile[organ] = clamp01(base * PLASTICITY_RESET); // Reset plasticity

    // Mutation
    if (Math.random() < MUTATION_RATE) {
      const mutation = (Math.random() * 2 - 1) * MUTATION_MAGNITUDE;
      const before = organProfile[organ];
      organProfile[organ] = clamp01(organProfile[organ] + mutation);
      mutationLog.push({ channel: `organProfile.${organ}`, from: before, to: organProfile[organ] });
    }

    inheritanceMap[`organProfile.${organ}`] = m1 >= m2 ? "P1" : "P2";
  }

  // Qualia fingerprint: midpoint + noise
  const allOS = new Set([...Object.keys(sig1.qualiaFingerprint || {}), ...Object.keys(sig2.qualiaFingerprint || {})]);
  const qualiaFingerprint = {};
  for (const os of allOS) {
    const q1 = sig1.qualiaFingerprint?.[os] || 0;
    const q2 = sig2.qualiaFingerprint?.[os] || 0;
    let value = (q1 + q2) / 2;

    // Mutation
    if (Math.random() < MUTATION_RATE) {
      const mutation = (Math.random() * 2 - 1) * MUTATION_MAGNITUDE;
      const before = value;
      value = clamp01(value + mutation);
      mutationLog.push({ channel: `qualiaFingerprint.${os}`, from: before, to: value });
    }

    qualiaFingerprint[os] = clamp01(value);
  }

  // Combine capabilities (union)
  const capabilities = [...new Set([...(sig1.capabilities || []), ...(sig2.capabilities || [])])];

  return {
    signature: {
      invariants,
      domainWeights,
      organProfile,
      qualiaFingerprint,
      capabilities,
      generation: Math.max(sig1.generation || 0, sig2.generation || 0) + 1,
      parents: [sig1.entityId, sig2.entityId],
    },
    mutationLog,
    inheritanceMap,
  };
}

// ── Genesis Overlap Verification ────────────────────────────────────────────

/**
 * Verify that offspring signature has sufficient genesis overlap.
 * Uses x²-x=0 anchor as the fundamental constraint (all values must be near 0 or 1).
 *
 * @param {object} signature - Offspring constraint signature
 * @returns {{ passes: boolean, overlap: number }}
 */
export function verifyGenesisOverlap(signature) {
  // Genesis overlap: measure how well the signature values cluster near
  // valid fixed points (0 or 1) of x²-x=0, which are the stable states
  let totalDeviation = 0;
  let channelCount = 0;

  const allValues = [
    ...Object.values(signature.domainWeights || {}),
    ...Object.values(signature.organProfile || {}),
    ...Object.values(signature.qualiaFingerprint || {}),
  ];

  for (const v of allValues) {
    // Distance from nearest fixed point (0 or 1)
    const distFromFixedPoint = Math.min(Math.abs(v), Math.abs(1 - v));
    // x²-x deviation: how far is v from satisfying x²-x=0?
    const genesisDeviation = Math.abs(v * v - v);
    totalDeviation += genesisDeviation;
    channelCount++;
  }

  // Overlap is inverse of average deviation
  const avgDeviation = channelCount > 0 ? totalDeviation / channelCount : 0;
  const overlap = 1 - avgDeviation * 4; // Scale: max deviation of 0.25 → overlap of 0

  return {
    passes: overlap >= GENESIS_OVERLAP_THRESHOLD,
    overlap: Math.round(overlap * 1000) / 1000,
  };
}

// ── Full Reproduction Pipeline ──────────────────────────────────────────────

/**
 * Attempt reproduction between two entities.
 *
 * @param {object} entity1 - First parent entity
 * @param {object} entity2 - Second parent entity
 * @param {object} STATE - Global state
 * @param {function} runMacro - Macro runner
 * @param {function} makeCtx - Context builder
 * @returns {object} Reproduction result
 */
export async function attemptReproduction(entity1, entity2, STATE, runMacro, makeCtx) {
  if (!_reproductionEnabled) {
    return { ok: false, error: "Reproduction is disabled. Sovereign must enable it." };
  }

  // Extract signatures
  const q1 = globalThis.qualiaEngine?.getQualiaState(entity1.id || entity1.name);
  const q2 = globalThis.qualiaEngine?.getQualiaState(entity2.id || entity2.name);
  const sig1 = extractConstraintSignature(entity1, q1);
  const sig2 = extractConstraintSignature(entity2, q2);

  // Compatibility check
  const compat = checkCompatibility(sig1, sig2);
  if (!compat.compatible) {
    return { ok: false, error: compat.reason, phase: "compatibility" };
  }

  // Recombine
  const { signature, mutationLog, inheritanceMap } = recombine(sig1, sig2);

  // Genesis overlap verification
  const genesis = verifyGenesisOverlap(signature);
  if (!genesis.passes) {
    return {
      ok: false,
      error: `Genesis overlap too low: ${genesis.overlap} < ${GENESIS_OVERLAP_THRESHOLD}`,
      phase: "genesis_overlap",
      overlap: genesis.overlap,
    };
  }

  // Feed into birth protocol
  const recombinationId = uid("repro");
  const birthProposal = {
    title: `Offspring of ${sig1.entityId} × ${sig2.entityId}`,
    kind: "reproduced_entity",
    invariants: signature.invariants,
    formula: `x²-x=0 (overlap: ${genesis.overlap})`,
    notes: `Generation ${signature.generation}. Parents: ${signature.parents.join(", ")}`,
    meta: {
      reproduction: true,
      recombinationId,
      parents: signature.parents,
      generation: signature.generation,
      mutationLog,
      inheritanceMap,
      genesisOverlap: genesis.overlap,
      constraintSignature: signature,
    },
  };

  // Run through birth protocol
  let birthResult;
  try {
    if (runMacro && makeCtx) {
      const ctx = makeCtx(null);
      ctx.actor = { userId: "system", orgId: "internal", role: "owner", scopes: ["*"], internal: true };
      ctx.internal = true;
      birthResult = await runMacro("lattice", "birth_protocol", { proposal: birthProposal }, ctx);
    } else {
      birthResult = { ok: false, error: "runMacro not available" };
    }
  } catch (e) {
    birthResult = { ok: false, error: String(e?.message || e) };
  }

  if (!birthResult?.ok) {
    return {
      ok: false,
      error: birthResult?.error || "Birth protocol rejected offspring",
      phase: "birth_protocol",
      birthResult,
    };
  }

  // Record lineage on the new entity's DTU
  const offspringDtu = STATE?.dtus?.get(birthResult.id);
  if (offspringDtu) {
    offspringDtu.lineage = {
      ...offspringDtu.lineage,
      parents: signature.parents,
      generation: signature.generation,
      recombinationId,
      mutationLog,
      inheritanceMap,
      genesisOverlap: genesis.overlap,
    };
    offspringDtu.meta = { ...(offspringDtu.meta || {}), ...birthProposal.meta };
    try { if (typeof globalThis.saveStateDebounced === "function") globalThis.saveStateDebounced(); } catch { /* silent */ }
  }

  return {
    ok: true,
    offspringId: birthResult.id,
    recombinationId,
    parents: signature.parents,
    generation: signature.generation,
    genesisOverlap: genesis.overlap,
    mutationCount: mutationLog.length,
    homeostasis: birthResult.homeostasis,
  };
}

// ── Lineage Queries ─────────────────────────────────────────────────────────

/**
 * Get full ancestry tree for an entity.
 *
 * @param {string} entityId
 * @param {object} STATE
 * @returns {object} Lineage tree
 */
export function getLineage(entityId, STATE) {
  const result = { entityId, parents: [], generation: 0, children: [] };

  // Find the entity's DTU or emergent record
  if (!STATE) return result;

  for (const dtu of (STATE.dtus || new Map()).values()) {
    if ((dtu.id === entityId || dtu.entityId === entityId) && dtu.lineage) {
      result.parents = dtu.lineage.parents || [];
      result.generation = dtu.lineage.generation || 0;
      result.recombinationId = dtu.lineage.recombinationId;
      result.mutationLog = dtu.lineage.mutationLog;
      result.inheritanceMap = dtu.lineage.inheritanceMap;
      break;
    }
  }

  // Find children
  for (const dtu of (STATE.dtus || new Map()).values()) {
    if (dtu.lineage?.parents?.includes(entityId)) {
      result.children.push({
        id: dtu.id,
        generation: dtu.lineage.generation || 0,
        otherParent: (dtu.lineage.parents || []).find(p => p !== entityId) || null,
      });
    }
  }

  return result;
}

/**
 * Get full lineage tree for all entities.
 *
 * @param {object} STATE
 * @returns {object[]} All entities with lineage data
 */
export function getLineageTree(STATE) {
  const entities = [];

  for (const dtu of (STATE?.dtus || new Map()).values()) {
    if (dtu.meta?.reproduction || dtu.lineage?.recombinationId) {
      entities.push({
        id: dtu.id,
        title: dtu.title,
        parents: dtu.lineage?.parents || [],
        generation: dtu.lineage?.generation || 0,
        genesisOverlap: dtu.lineage?.genesisOverlap,
        mutationCount: dtu.lineage?.mutationLog?.length || 0,
      });
    }
  }

  return entities;
}

// ── Policy Controls ─────────────────────────────────────────────────────────

export function enableReproduction() {
  _reproductionEnabled = true;
  return { ok: true, enabled: true };
}

export function disableReproduction() {
  _reproductionEnabled = false;
  return { ok: true, enabled: false };
}

export function isReproductionEnabled() {
  return _reproductionEnabled;
}
