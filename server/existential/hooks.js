/**
 * Existential OS — Integration Hooks
 *
 * Functions that existing subsystems call to feed qualia data.
 * Each hook takes data that the subsystem ALREADY produces and
 * translates it into channel updates.
 *
 * NO changes to subsystem logic. The hook is called AT THE END
 * of existing operations as an optional addition.
 *
 * Every hook is wrapped in try/catch with silent failure at the call site:
 *   try { hooks.hookAutogen(emergentId, result); } catch(e) { /* silent * / }
 */

/**
 * Get the qualia engine instance. Returns null if not initialized.
 * @returns {import('./engine.js').QualiaEngine|null}
 */
function getEngine() {
  return globalThis.qualiaEngine || null;
}

/**
 * Safe clamp to [0, 1].
 */
function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

/**
 * Called after autogen pipeline completes a cycle.
 *
 * @param {string} entityId
 * @param {object} pipelineResult - { gapsFound, dtusGenerated, noveltyScore, alignmentScore, ... }
 */
export function hookAutogen(entityId, pipelineResult) {
  const engine = getEngine();
  if (!engine || !entityId) return;

  const r = pipelineResult || {};
  const updates = {};

  // Number of gaps found → gap severity
  if (r.gapsFound !== undefined || r.gaps !== undefined) {
    const gaps = Number(r.gapsFound ?? r.gaps ?? 0);
    updates["meta_growth_os.gap_severity"] = clamp01(gaps / 10);
  }

  // Number of DTUs generated → coverage score
  if (r.dtusGenerated !== undefined || r.created !== undefined || r.count !== undefined) {
    const generated = Number(r.dtusGenerated ?? r.created ?? r.count ?? 0);
    updates["meta_growth_os.coverage_score"] = clamp01(generated / 5);
  }

  // Novelty of generated content
  if (r.noveltyScore !== undefined || r.novelty !== undefined) {
    updates["creative_mutation_os.novelty_score"] = clamp01(r.noveltyScore ?? r.novelty ?? 0);
  }

  // Alignment with existing lattice
  if (r.alignmentScore !== undefined || r.alignment !== undefined) {
    updates["creative_mutation_os.alignment_score"] = clamp01(r.alignmentScore ?? r.alignment ?? 0);
  }

  if (Object.keys(updates).length > 0) {
    engine.batchUpdate(entityId, updates);
  }
}

/**
 * Called when an emergent participates in council governance.
 *
 * @param {string} entityId
 * @param {object} voteData - { agreement, conflict, confidence, majority, ... }
 */
export function hookCouncilVote(entityId, voteData) {
  const engine = getEngine();
  if (!engine || !entityId) return;

  const v = voteData || {};
  const updates = {};

  // Agreement with majority → cohesion
  if (v.agreement !== undefined) {
    updates["sociodynamics_os.cohesion"] = clamp01(v.agreement);
  }

  // Conflict with other voters
  if (v.conflict !== undefined || v.conflictRisk !== undefined) {
    updates["sociodynamics_os.conflict_risk"] = clamp01(v.conflict ?? v.conflictRisk ?? 0);
  }

  // Confidence in own vote → evidence weight
  if (v.confidence !== undefined) {
    updates["truth_os.evidence_weight"] = clamp01(v.confidence);
  }

  if (Object.keys(updates).length > 0) {
    engine.batchUpdate(entityId, updates);
  }
}

/**
 * Called when any DTU is created.
 *
 * @param {string} entityId
 * @param {object} dtu - The created DTU
 */
export function hookDTUCreation(entityId, dtu) {
  const engine = getEngine();
  if (!engine || !entityId) return;

  const d = dtu || {};
  const updates = {};

  // Logical consistency of DTU claims
  if (d.logicalConsistency !== undefined || d.consistency !== undefined) {
    updates["logic_os.logical_consistency_score"] = clamp01(d.logicalConsistency ?? d.consistency ?? 0.5);
  }

  // Contradiction with existing DTUs
  if (d.contradictionIndex !== undefined || d.contradictions !== undefined) {
    updates["logic_os.contradiction_index"] = clamp01(d.contradictionIndex ?? d.contradictions ?? 0);
  }

  // Coverage of new domain area → urgency decreases
  const urgency = engine.getChannel(entityId, "meta_growth_os", "urgency_for_new_dtu");
  if (urgency !== null && urgency > 0) {
    updates["meta_growth_os.urgency_for_new_dtu"] = clamp01(urgency * 0.85); // decay by 15%
  }

  if (Object.keys(updates).length > 0) {
    engine.batchUpdate(entityId, updates);
  }
}

/**
 * Called after dream mode synthesis.
 *
 * @param {string} entityId
 * @param {object} dreamResult - { connectionsFound, entropy, coherence, ... }
 */
export function hookDreamSynthesis(entityId, dreamResult) {
  const engine = getEngine();
  if (!engine || !entityId) return;

  const r = dreamResult || {};
  const updates = {};

  // Cross-domain connections found → pattern strength
  if (r.connectionsFound !== undefined || r.connections !== undefined) {
    const connections = Number(r.connectionsFound ?? r.connections ?? 0);
    updates["emergence_os.pattern_strength"] = clamp01(connections / 8);
  }

  // Entropy of synthesis
  if (r.entropy !== undefined) {
    updates["void_os.entropy"] = clamp01(r.entropy);
  }

  // Coherence of output
  if (r.coherence !== undefined || r.coherenceIndex !== undefined) {
    updates["emergence_os.coherence_index"] = clamp01(r.coherence ?? r.coherenceIndex ?? 0);
  }

  if (Object.keys(updates).length > 0) {
    engine.batchUpdate(entityId, updates);
  }
}

/**
 * Called by the reflection engine.
 *
 * @param {string} entityId
 * @param {object} reflectionData - { selfModelAccuracy, novelInsights, needsReframing, ... }
 */
export function hookReflection(entityId, reflectionData) {
  const engine = getEngine();
  if (!engine || !entityId) return;

  const r = reflectionData || {};
  const updates = {};

  if (r.selfModelAccuracy !== undefined || r.alignment !== undefined) {
    updates["reflection_os.alignment_with_core_principles"] = clamp01(r.selfModelAccuracy ?? r.alignment ?? 0);
  }

  if (r.novelInsights !== undefined || r.novelty !== undefined) {
    updates["reflection_os.novelty_against_history"] = clamp01(r.novelInsights ?? r.novelty ?? 0);
  }

  if (r.needsReframing !== undefined || r.reframingNeed !== undefined) {
    updates["reflection_os.need_for_reframing"] = clamp01(r.needsReframing ?? r.reframingNeed ?? 0);
  }

  if (Object.keys(updates).length > 0) {
    engine.batchUpdate(entityId, updates);
  }
}

/**
 * Called by metacognition subsystem.
 *
 * @param {string} entityId
 * @param {object} metacogData - { blindSpotSeverity, calibrationAccuracy, confidenceCalibration, ... }
 */
export function hookMetacognition(entityId, metacogData) {
  const engine = getEngine();
  if (!engine || !entityId) return;

  const m = metacogData || {};
  const updates = {};

  if (m.blindSpotSeverity !== undefined || m.blindSpots !== undefined) {
    updates["meta_growth_os.gap_severity"] = clamp01(m.blindSpotSeverity ?? m.blindSpots ?? 0);
  }

  if (m.calibrationAccuracy !== undefined || m.calibration !== undefined) {
    updates["truth_os.uncertainty_score"] = clamp01(1 - (m.calibrationAccuracy ?? m.calibration ?? 0.5));
  }

  if (m.confidenceCalibration !== undefined) {
    updates["probability_os.confidence_interval"] = clamp01(m.confidenceCalibration);
  }

  if (Object.keys(updates).length > 0) {
    engine.batchUpdate(entityId, updates);
  }
}

/**
 * Called during chat interactions.
 *
 * @param {string} entityId
 * @param {object} chatContext - { userEmotionalState, cognitiveComplexity, deliveryMode, ... }
 */
export function hookChat(entityId, chatContext) {
  const engine = getEngine();
  if (!engine || !entityId) return;

  const c = chatContext || {};
  const updates = {};

  // User emotional state
  if (c.distressLevel !== undefined || c.distress !== undefined) {
    updates["emotional_resonance_os.distress_level"] = clamp01(c.distressLevel ?? c.distress ?? 0);
  }
  if (c.hopeLevel !== undefined || c.hope !== undefined) {
    updates["emotional_resonance_os.hope_level"] = clamp01(c.hopeLevel ?? c.hope ?? 0);
  }

  // Cognitive complexity
  if (c.cognitiveComplexity !== undefined || c.complexity !== undefined) {
    updates["emotional_resonance_os.cognitive_load"] = clamp01(c.cognitiveComplexity ?? c.complexity ?? 0);
  }

  // Delivery mode
  if (c.directness !== undefined) {
    updates["delivery_os.directness"] = clamp01(c.directness);
  }
  if (c.detailDensity !== undefined || c.detail !== undefined) {
    updates["delivery_os.detail_density"] = clamp01(c.detailDensity ?? c.detail ?? 0);
  }

  if (Object.keys(updates).length > 0) {
    engine.batchUpdate(entityId, updates);
  }
}

/**
 * Called by the existing ATS when an affect event fires.
 * Bridge between ATS (individual events) and Existential OS (continuous state).
 *
 * @param {string} entityId
 * @param {object} affectEvent - { intensity, polarity, type, ... }
 */
export function hookAffect(entityId, affectEvent) {
  const engine = getEngine();
  if (!engine || !entityId) return;

  const e = affectEvent || {};
  const intensity = clamp01(e.intensity ?? 0);
  const polarity = Math.max(-1, Math.min(1, Number(e.polarity ?? 0)));
  const updates = {};

  // Map polarity to motivation/distress
  if (polarity >= 0) {
    updates["motivation_os.drive_level"] = clamp01(intensity * polarity);
    updates["motivation_os.curiosity_index"] = clamp01(intensity * 0.5);
  } else {
    updates["emotional_resonance_os.distress_level"] = clamp01(intensity * Math.abs(polarity));
  }

  // Map event type to OS category
  const type = String(e.type || "").toUpperCase();
  if (type === "SUCCESS" || type === "GOAL_PROGRESS") {
    updates["motivation_os.goal_proximity"] = clamp01(intensity);
  } else if (type === "ERROR" || type === "TIMEOUT") {
    updates["motivation_os.burnout_risk"] = clamp01(intensity * 0.3);
  } else if (type === "CONFLICT") {
    updates["sociodynamics_os.conflict_risk"] = clamp01(intensity);
  } else if (type === "SAFETY_BLOCK") {
    updates["trauma_aware_os.sensitivity_level"] = clamp01(intensity * 0.5);
  }

  if (Object.keys(updates).length > 0) {
    engine.batchUpdate(entityId, updates);
  }
}

/**
 * Called every time an emergent's periodic tick fires.
 * This is the heartbeat of qualia.
 *
 * @param {string} entityId
 * @param {object} tickData - { timeSinceLastAction, growthRate, selfConsistency, contradictions, ... }
 */
export function hookEmergentTick(entityId, tickData) {
  const engine = getEngine();
  if (!engine || !entityId) return;

  const t = tickData || {};
  const updates = {};

  // Time since last meaningful action → burnout risk
  if (t.timeSinceLastAction !== undefined || t.idleMs !== undefined) {
    const idleMs = Number(t.timeSinceLastAction ?? t.idleMs ?? 0);
    const idleMinutes = idleMs / 60000;
    // Burnout risk increases with idle time (sigmoid-ish curve)
    updates["motivation_os.burnout_risk"] = clamp01(idleMinutes / 60); // 1.0 at 60min idle
  }

  // Knowledge growth rate
  if (t.growthRate !== undefined || t.dtuRate !== undefined) {
    updates["meta_growth_os.coverage_score"] = clamp01(t.growthRate ?? t.dtuRate ?? 0);
  }

  // Self-consistency check
  if (t.selfConsistency !== undefined || t.consistency !== undefined) {
    updates["self_repair_os.integrity_index"] = clamp01(t.selfConsistency ?? t.consistency ?? 0);
  }

  // Contradiction detection
  if (t.contradictions !== undefined || t.contradictionCount !== undefined) {
    const count = Number(t.contradictions ?? t.contradictionCount ?? 0);
    updates["self_repair_os.contradiction_score"] = clamp01(count / 5);
  }

  if (Object.keys(updates).length > 0) {
    engine.batchUpdate(entityId, updates);
  }
}
