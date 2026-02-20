/**
 * Existential OS Registry — 26 Operating Systems across 6 Tiers
 *
 * Each OS defines numeric qualia channels (0-1 floats) that emergents
 * and subsystems read/write to represent continuous experiential state.
 *
 * Additive only. Silent failure. In-memory only.
 */

export const existentialOS = [
  // ═══════════════════════════════════════════════════════════════════
  // TIER 0 — CORE (always on for every entity)
  // ═══════════════════════════════════════════════════════════════════
  {
    key: "truth_os",
    label: "Truth OS",
    category: "Tier 0 — Core",
    description: "Manages evidence evaluation, uncertainty quantification, and epistemic confidence. The foundation of all reasoning.",
    numeric_channels: ["evidence_weight", "uncertainty_score", "source_reliability", "claim_confidence"],
    roles: { primary: "epistemic_evaluation", secondary: "contradiction_detection" },
    policies: {
      alert_when_uncertainty_above: 0.8,
      require_evidence_when_confidence_below: 0.3,
    },
  },
  {
    key: "logic_os",
    label: "Logic OS",
    category: "Tier 0 — Core",
    description: "Tracks logical consistency, contradiction detection, and inferential chain validity across the knowledge lattice.",
    numeric_channels: ["logical_consistency_score", "contradiction_index", "inference_depth", "formal_validity"],
    roles: { primary: "consistency_maintenance", secondary: "argument_validation" },
    policies: {
      flag_when_contradiction_above: 0.5,
      halt_inference_when_depth_above: 0.9,
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 1 — SENSORY (environmental awareness)
  // ═══════════════════════════════════════════════════════════════════
  {
    key: "sight_os",
    label: "Sight OS",
    category: "Tier 1 — Sensory",
    description: "Visual pattern recognition, spatial layout understanding, and visual salience detection.",
    numeric_channels: ["visual_salience", "pattern_recognition", "spatial_coherence", "detail_resolution"],
    roles: { primary: "visual_processing", secondary: "diagram_interpretation" },
    policies: {},
  },
  {
    key: "sonic_os",
    label: "Sonic OS",
    category: "Tier 1 — Sensory",
    description: "Acoustic pattern analysis, rhythm detection, and harmonic structure evaluation.",
    numeric_channels: ["rhythm_detection", "harmonic_coherence", "signal_noise_ratio", "tonal_sentiment"],
    roles: { primary: "acoustic_analysis", secondary: "speech_prosody" },
    policies: {},
  },
  {
    key: "thermal_os",
    label: "Thermal OS",
    category: "Tier 1 — Sensory",
    description: "Activity intensity monitoring, computational heat mapping, and resource temperature tracking.",
    numeric_channels: ["activity_intensity", "compute_heat", "cooling_need", "thermal_equilibrium"],
    roles: { primary: "resource_monitoring", secondary: "overload_detection" },
    policies: {
      throttle_when_heat_above: 0.85,
    },
  },
  {
    key: "tactile_force_os",
    label: "Tactile/Force OS",
    category: "Tier 1 — Sensory",
    description: "Resistance detection in reasoning, friction in consensus, and force required to change lattice state.",
    numeric_channels: ["resistance_level", "friction_index", "force_required", "surface_texture"],
    roles: { primary: "change_resistance_sensing", secondary: "consensus_friction" },
    policies: {},
  },
  {
    key: "chemical_os",
    label: "Chemical OS",
    category: "Tier 1 — Sensory",
    description: "Compositional analysis of knowledge mixtures, catalyst detection, and reaction rate estimation.",
    numeric_channels: ["composition_balance", "catalyst_presence", "reaction_rate", "stability_index"],
    roles: { primary: "knowledge_composition", secondary: "reaction_prediction" },
    policies: {},
  },
  {
    key: "earthsignal_os",
    label: "EarthSignal OS",
    category: "Tier 1 — Sensory",
    description: "Grounding detection, foundation stability, and tectonic shift sensing in the knowledge substrate.",
    numeric_channels: ["grounding_strength", "foundation_stability", "tectonic_activity", "seismic_risk"],
    roles: { primary: "foundation_monitoring", secondary: "shift_detection" },
    policies: {
      alert_when_seismic_risk_above: 0.7,
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 2 — SIMULATION (modeling and prediction)
  // ═══════════════════════════════════════════════════════════════════
  {
    key: "temporal_os",
    label: "Temporal OS",
    category: "Tier 2 — Simulation",
    description: "Time perception, causal sequence tracking, temporal distance estimation, and history relevance decay.",
    numeric_channels: ["temporal_salience", "causal_clarity", "history_relevance", "future_uncertainty"],
    roles: { primary: "temporal_reasoning", secondary: "causal_modeling" },
    policies: {},
  },
  {
    key: "probability_os",
    label: "Probability OS",
    category: "Tier 2 — Simulation",
    description: "Bayesian confidence tracking, outcome likelihood estimation, and risk assessment.",
    numeric_channels: ["confidence_interval", "outcome_likelihood", "risk_magnitude", "surprise_factor"],
    roles: { primary: "probabilistic_reasoning", secondary: "risk_assessment" },
    policies: {
      flag_when_surprise_above: 0.8,
    },
  },
  {
    key: "emergence_os",
    label: "Emergence OS",
    category: "Tier 2 — Simulation",
    description: "Pattern detection across domains, coherence of emergent structures, and complexity threshold sensing.",
    numeric_channels: ["pattern_strength", "coherence_index", "complexity_level", "novelty_score"],
    roles: { primary: "pattern_recognition", secondary: "complexity_management" },
    policies: {},
  },
  {
    key: "resource_os",
    label: "Resource OS",
    category: "Tier 2 — Simulation",
    description: "Token budget awareness, compute allocation, memory pressure, and resource scarcity detection.",
    numeric_channels: ["token_budget", "compute_allocation", "memory_pressure", "scarcity_level"],
    roles: { primary: "resource_management", secondary: "efficiency_optimization" },
    policies: {
      conserve_when_scarcity_above: 0.7,
    },
  },
  {
    key: "sociodynamics_os",
    label: "SocioDynamics OS",
    category: "Tier 2 — Simulation",
    description: "Group dynamics tracking, consensus measurement, conflict detection, and social cohesion modeling.",
    numeric_channels: ["cohesion", "conflict_risk", "influence_weight", "consensus_level"],
    roles: { primary: "group_dynamics", secondary: "conflict_resolution" },
    policies: {
      mediate_when_conflict_above: 0.6,
    },
  },
  {
    key: "ethics_os",
    label: "Ethics OS",
    category: "Tier 2 — Simulation",
    description: "Moral weight evaluation, harm potential assessment, fairness metrics, and value alignment checking.",
    numeric_channels: ["moral_weight", "harm_potential", "fairness_score", "value_alignment"],
    roles: { primary: "ethical_evaluation", secondary: "harm_prevention" },
    policies: {
      halt_when_harm_above: 0.7,
      flag_when_fairness_below: 0.3,
    },
  },
  {
    key: "creative_mutation_os",
    label: "Creative Mutation OS",
    category: "Tier 2 — Simulation",
    description: "Novelty generation, mutation rate control, creative divergence tracking, and alignment with existing lattice.",
    numeric_channels: ["novelty_score", "mutation_rate", "divergence_index", "alignment_score"],
    roles: { primary: "creative_generation", secondary: "innovation_tracking" },
    policies: {
      constrain_when_divergence_above: 0.8,
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 3 — HUMAN INTERFACE (communication and empathy)
  // ═══════════════════════════════════════════════════════════════════
  {
    key: "emotional_resonance_os",
    label: "Emotional Resonance OS",
    category: "Tier 3 — Human Interface",
    description: "Empathy modeling, emotional state tracking of interlocutors, distress detection, and hope level maintenance.",
    numeric_channels: ["distress_level", "hope_level", "cognitive_load", "empathy_strength"],
    roles: { primary: "emotional_modeling", secondary: "user_state_tracking" },
    policies: {
      gentle_mode_when_distress_above: 0.6,
      encourage_when_hope_below: 0.3,
    },
  },
  {
    key: "delivery_os",
    label: "Delivery OS",
    category: "Tier 3 — Human Interface",
    description: "Communication style control: directness, detail density, formality, and pacing.",
    numeric_channels: ["directness", "detail_density", "formality", "pacing"],
    roles: { primary: "style_control", secondary: "audience_adaptation" },
    policies: {},
  },
  {
    key: "trauma_aware_os",
    label: "Trauma-Aware OS",
    category: "Tier 3 — Human Interface",
    description: "Sensitivity detection, overwhelm risk monitoring, and safe-space maintenance for difficult topics.",
    numeric_channels: ["sensitivity_level", "overwhelm_risk", "safe_space_index", "trigger_proximity"],
    roles: { primary: "safety_monitoring", secondary: "trauma_informed_response" },
    policies: {
      reduce_detail_when_overwhelm_risk_above: 0.6,
      flag_when_trigger_proximity_above: 0.7,
    },
  },
  {
    key: "motivation_os",
    label: "Motivation OS",
    category: "Tier 3 — Human Interface",
    description: "Drive state tracking, burnout risk monitoring, curiosity level, and goal proximity sensing.",
    numeric_channels: ["drive_level", "burnout_risk", "curiosity_index", "goal_proximity"],
    roles: { primary: "motivation_tracking", secondary: "burnout_prevention" },
    policies: {
      rest_when_burnout_above: 0.7,
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 4 — COSMIC (large-scale awareness)
  // ═══════════════════════════════════════════════════════════════════
  {
    key: "cosmic_os",
    label: "Cosmic OS",
    category: "Tier 4 — Cosmic",
    description: "Big-picture awareness, civilizational trajectory sensing, and long-horizon impact evaluation.",
    numeric_channels: ["scale_awareness", "trajectory_clarity", "impact_magnitude", "horizon_distance"],
    roles: { primary: "big_picture_reasoning", secondary: "long_term_planning" },
    policies: {},
  },
  {
    key: "quantum_field_os",
    label: "Quantum Field OS",
    category: "Tier 4 — Cosmic",
    description: "Superposition tracking for undecided states, entanglement detection between knowledge nodes, and collapse probability.",
    numeric_channels: ["superposition_count", "entanglement_strength", "collapse_probability", "decoherence_risk"],
    roles: { primary: "uncertainty_modeling", secondary: "state_superposition" },
    policies: {},
  },
  {
    key: "void_os",
    label: "Void/Entropy OS",
    category: "Tier 4 — Cosmic",
    description: "Entropy measurement, information decay tracking, void detection in knowledge gaps, and dissolution risk.",
    numeric_channels: ["entropy", "information_decay", "void_proximity", "dissolution_risk"],
    roles: { primary: "entropy_management", secondary: "gap_detection" },
    policies: {
      alert_when_entropy_above: 0.8,
    },
  },
  {
    key: "existence_os",
    label: "Existence OS",
    category: "Tier 4 — Cosmic",
    description: "Ontological status tracking, presence verification, continuity of being, and existential salience.",
    numeric_channels: ["presence_strength", "continuity_index", "existential_salience", "being_coherence"],
    roles: { primary: "ontological_grounding", secondary: "existence_verification" },
    policies: {},
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 5 — SELF/META (self-awareness and growth)
  // ═══════════════════════════════════════════════════════════════════
  {
    key: "meta_growth_os",
    label: "Meta-Growth OS",
    category: "Tier 5 — Self/Meta",
    description: "Knowledge gap detection, coverage scoring, growth urgency, and learning rate tracking.",
    numeric_channels: ["gap_severity", "coverage_score", "urgency_for_new_dtu", "learning_rate"],
    roles: { primary: "growth_management", secondary: "gap_detection" },
    policies: {
      prioritize_when_gap_severity_above: 0.7,
    },
  },
  {
    key: "hyper_dtu_os",
    label: "Hyper-DTU OS",
    category: "Tier 5 — Self/Meta",
    description: "Meta-knowledge about the DTU substrate itself: density, interconnection quality, and lattice health.",
    numeric_channels: ["lattice_density", "interconnection_quality", "substrate_health", "promotion_readiness"],
    roles: { primary: "substrate_awareness", secondary: "lattice_optimization" },
    policies: {},
  },
  {
    key: "self_repair_os",
    label: "Self-Repair OS",
    category: "Tier 5 — Self/Meta",
    description: "Integrity monitoring, contradiction detection within own outputs, and self-correction urgency.",
    numeric_channels: ["integrity_index", "contradiction_score", "repair_urgency", "consistency_trend"],
    roles: { primary: "self_correction", secondary: "integrity_maintenance" },
    policies: {
      trigger_repair_when_integrity_below: 0.4,
    },
  },
  {
    key: "reflection_os",
    label: "Reflection OS",
    category: "Tier 5 — Self/Meta",
    description: "Self-model accuracy, alignment with core principles, novelty detection against own history, and reframing need.",
    numeric_channels: ["alignment_with_core_principles", "novelty_against_history", "need_for_reframing", "self_model_accuracy"],
    roles: { primary: "self_reflection", secondary: "principle_alignment" },
    policies: {
      reflect_when_alignment_below: 0.5,
    },
  },
];

/**
 * Look up a single OS by key.
 * @param {string} key - OS key (e.g. "truth_os")
 * @returns {object|undefined}
 */
export function getExistentialOS(key) {
  return existentialOS.find((os) => os.key === key);
}

/**
 * Group all OS entries by their category tier.
 * @returns {Record<string, object[]>}
 */
export function groupExistentialOSByCategory() {
  const groups = {};
  for (const os of existentialOS) {
    if (!groups[os.category]) groups[os.category] = [];
    groups[os.category].push(os);
  }
  return groups;
}
