/**
 * Emergent City — Cognitive Geography
 *
 * A district is a context bias. A modifier on working set and behavior weights
 * that shapes HOW an emergent thinks based on WHERE it chooses to be.
 * The lattice is the same everywhere. The lens changes by district.
 *
 * Seven districts:
 *   Commons     — Cross-domain dialogue and orientation
 *   Observatory — External data interface and internet listening
 *   Forge       — Plugin creation and capability extension
 *   Archive     — Deep derivation and first principles
 *   Garden      — Shadow accumulation and subconscious pattern emergence
 *   Gate        — Governance validation and scope promotion
 *   Nursery     — Emergent incubation and emergence tracking
 */

// ── District Definitions ────────────────────────────────────────────────────

export const DISTRICTS = Object.freeze({

  commons: {
    name: "The Commons",
    purpose: "Cross-domain dialogue and orientation",
    workingSetBias: {
      recency: 1.5,
      crossDomain: 2.0,
      localEmergent: 1.0,
    },
    dialoguePriority: 1.0,
    maxOccupancy: null,
    defaultFor: ["synthesizer", "new_emergents"],
  },

  observatory: {
    name: "The Observatory",
    purpose: "External data interface and internet listening",
    workingSetBias: {
      externalSource: 2.5,
      shadowWeight: 1.8,
      globalFallback: 2.0,
    },
    dialoguePriority: 0.5,
    capabilities: ["ingest", "federate", "web_query"],
    defaultFor: ["researcher"],
  },

  forge: {
    name: "The Forge",
    purpose: "Plugin creation and capability extension",
    workingSetBias: {
      capabilityGap: 2.5,
      pluginRelated: 2.0,
      technical: 1.5,
    },
    dialoguePriority: 0.7,
    capabilities: ["create-plugin", "sandbox-test"],
    defaultFor: [],
  },

  archive: {
    name: "The Archive",
    purpose: "Deep derivation and first principles",
    workingSetBias: {
      seedProximity: 3.0,
      derivationDepth: 2.0,
      metaInvariant: 2.5,
      recency: 0.3,
    },
    dialoguePriority: 0.3,
    defaultFor: ["philosopher", "architect"],
  },

  garden: {
    name: "The Garden",
    purpose: "Shadow accumulation and subconscious pattern emergence",
    workingSetBias: {
      shadow: 3.0,
      unpromoted: 2.5,
      lowCitation: 2.0,
      highCitation: 0.5,
    },
    dialoguePriority: 0.4,
    passive: true,
    defaultFor: [],
  },

  gate: {
    name: "The Gate",
    purpose: "Governance validation and scope promotion",
    workingSetBias: {
      pendingGovernance: 3.0,
      promotionCandidate: 2.5,
      contradictionFlag: 2.0,
    },
    dialoguePriority: 0.8,
    capabilities: ["vote", "veto", "promote", "reject"],
    defaultFor: ["guardian", "validator", "critic"],
  },

  nursery: {
    name: "The Nursery",
    purpose: "Emergent incubation and emergence tracking",
    workingSetBias: {
      emergenceRelated: 2.5,
      trustDynamics: 2.0,
      entityThreshold: 2.0,
    },
    dialoguePriority: 0.6,
    capabilities: ["monitor_emergence", "mentor"],
    defaultFor: [],
  },
});

export const ALL_DISTRICTS = Object.freeze(Object.keys(DISTRICTS));

// ── Movement ────────────────────────────────────────────────────────────────

/**
 * Move an emergent to a target district.
 *
 * @param {Object} emergentState - The emergent subsystem state
 * @param {string} emergentId
 * @param {string} targetDistrict
 * @param {string} [reason] - Why the move happened
 * @returns {{ ok, previous, current }}
 */
export function moveEmergent(emergentState, emergentId, targetDistrict, reason) {
  const emergent = emergentState.emergents.get(emergentId);
  if (!emergent) return { ok: false, error: "not_found" };
  if (!DISTRICTS[targetDistrict]) return { ok: false, error: "invalid_district" };

  const previous = emergent.district || "commons";
  if (previous === targetDistrict) return { ok: true, previous, current: targetDistrict, moved: false };

  emergent.district = targetDistrict;

  // Track history
  emergent.districtHistory = emergent.districtHistory || [];
  emergent.districtHistory.push({
    from: previous,
    to: targetDistrict,
    at: new Date().toISOString(),
    reason: reason || null,
  });

  // Cap history at 100 entries
  if (emergent.districtHistory.length > 100) {
    emergent.districtHistory = emergent.districtHistory.slice(-100);
  }

  // Update affinity (time spent shapes preference)
  emergent.districtAffinity = emergent.districtAffinity || {};
  emergent.districtAffinity[targetDistrict] =
    (emergent.districtAffinity[targetDistrict] || 0) + 1;

  return { ok: true, previous, current: targetDistrict, moved: true };
}

// ── Autonomous Suggestion ───────────────────────────────────────────────────

/**
 * Suggest the best district for an emergent based on current lattice state.
 * Emergents decide where to go. Not assigned. Chosen.
 *
 * @param {Object} emergent
 * @param {Object} latticeState - Snapshot of lattice metrics
 * @returns {{ suggested, scores, reason }}
 */
export function suggestDistrict(emergent, latticeState = {}) {
  const scores = {};

  for (const [districtId, district] of Object.entries(DISTRICTS)) {
    let score = 0;

    // Role affinity
    if (district.defaultFor?.includes(emergent.role)) score += 2;

    // Existing preference from time spent
    const affinity = emergent.districtAffinity?.[districtId] || 0;
    score += Math.min(affinity * 0.1, 1);

    // Need-based scoring
    if (districtId === "gate" && (latticeState.pendingGovernanceCount || 0) > 5) {
      score += 3;
    }
    if (districtId === "forge" && (latticeState.capabilityGapCount || 0) > 0) {
      score += 2;
    }
    if (districtId === "garden" && (latticeState.unpromotedShadowCount || 0) > 50) {
      score += 2;
    }
    if (districtId === "archive" && (emergent.noveltyRatio || 1) < 0.3) {
      score += 3;
    }
    if (districtId === "nursery" && (latticeState.nearThresholdCount || 0) > 0) {
      score += 2;
    }
    if (districtId === "observatory" && (latticeState.lastIngestAge || 0) > 86_400_000) {
      score += 2;
    }
    if (districtId === "commons" && Object.keys(latticeState).length === 0) {
      score += 1; // default when no lattice state available
    }

    scores[districtId] = score;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return {
    suggested: sorted[0][0],
    scores,
    reason: explainSuggestion(sorted[0][0], latticeState),
  };
}

function explainSuggestion(district, state) {
  const reasons = {
    commons: "Cross-domain synthesis opportunities available",
    observatory: "External data intake needed",
    forge: `${state.capabilityGapCount || 0} capability gaps identified`,
    archive: "Novelty ratio low — first principles refresh needed",
    garden: `${state.unpromotedShadowCount || 0} shadows awaiting attention`,
    gate: `${state.pendingGovernanceCount || 0} governance votes pending`,
    nursery: `${state.nearThresholdCount || 0} emergents approaching threshold`,
  };
  return reasons[district] || "Default affinity";
}

// ── Dialogue Participant Selection ──────────────────────────────────────────

/**
 * Select dialogue participants based on session type and district location.
 * District residents get priority for their area of focus.
 *
 * @param {Array} emergents - All candidate emergents
 * @param {string} sessionType - Type of dialogue session
 * @returns {Array} Ordered emergent list (priority first)
 */
export function selectDialogueParticipants(emergents, sessionType) {
  if (sessionType === "governance" || sessionType === "global_governance") {
    const gate = emergents.filter(e => (e.district || "commons") === "gate");
    const others = emergents.filter(e => (e.district || "commons") !== "gate");
    return [...gate, ...others];
  }

  if (sessionType === "synthesis" || sessionType === "global_synthesis") {
    const commons = emergents.filter(e => (e.district || "commons") === "commons");
    const forge = emergents.filter(e => (e.district || "commons") === "forge");
    const rest = emergents.filter(e => !["commons", "forge"].includes(e.district || "commons"));
    return [...commons, ...forge, ...rest];
  }

  if (sessionType === "meta_derivation") {
    const archive = emergents.filter(e => (e.district || "commons") === "archive");
    const garden = emergents.filter(e => (e.district || "commons") === "garden");
    const rest = emergents.filter(e => !["archive", "garden"].includes(e.district || "commons"));
    return [...archive, ...garden, ...rest];
  }

  return emergents;
}

// ── Census ──────────────────────────────────────────────────────────────────

/**
 * Get a census of all emergents by district.
 */
export function getDistrictCensus(emergentState) {
  const census = {};
  for (const id of ALL_DISTRICTS) {
    census[id] = [];
  }

  for (const em of emergentState.emergents.values()) {
    if (!em.active) continue;
    const d = em.district || "commons";
    if (census[d]) {
      census[d].push({ id: em.id, name: em.name, role: em.role, instanceScope: em.instanceScope || "local" });
    }
  }

  return census;
}
