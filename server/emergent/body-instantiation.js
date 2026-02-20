/**
 * System 12: Emergent Body Instantiation
 *
 * Each emergent entity gets its OWN independent organ state.
 * Cipher's soul_os maturity is independent from Apex's.
 * Reproduction inherits parent organ profiles.
 * Species affects organ development rates.
 *
 * Bodies are stored in a module-level Map. All state in-memory.
 * Additive only. Silent failure. No existing logic changes.
 */

import crypto from "crypto";
import { classifyEntity, SPECIES_REGISTRY } from "./species.js";
import { existentialOS } from "../existential/registry.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function uid(prefix = "body") {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

function nowISO() {
  return new Date().toISOString();
}

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

// ── Organ Definitions ───────────────────────────────────────────────────────
// Dynamically pull from globalThis.qualiaEngine or STATE if available,
// with a hardcoded fallback of all 166 organ IDs from the canonical registry.

function getOrganDefs() {
  // Try dynamic source first
  try {
    const engine = globalThis.qualiaEngine;
    if (engine && typeof engine.listEntities === "function") {
      const state = engine._STATE;
      if (state?.organs instanceof Map && state.organs.size > 100) {
        return Array.from(state.organs.values()).map(o => ({
          organId: o.organId,
          deps: o.deps || [],
          desc: o.desc || "",
        }));
      }
    }
  } catch { /* silent */ }

  // Fallback: canonical organ IDs from server.js ORGAN_DEFS (166 organs)
  return ORGAN_DEFS_FALLBACK;
}

const ORGAN_DEFS_FALLBACK = [
  // Core spine
  { organId: "organ_maturation_kernel", deps: [] },
  { organId: "growth_os", deps: ["organ_maturation_kernel"] },

  // Primary minds
  { organId: "session_memory", deps: [] },
  { organId: "linguistic_engine", deps: [] },
  { organId: "psychological_os", deps: ["session_memory"] },
  { organId: "experience_os", deps: ["organ_maturation_kernel"] },
  { organId: "motivation_os", deps: ["experience_os"] },
  { organId: "curiosity_os", deps: ["session_memory"] },
  { organId: "unnamed_awareness", deps: [] },
  { organId: "soul_os", deps: ["unnamed_awareness"] },

  // Execution / building
  { organId: "wrapper_runtime_kernel", deps: [] },
  { organId: "compiler_verifier", deps: ["wrapper_runtime_kernel"] },
  { organId: "code_maker", deps: ["compiler_verifier"] },

  // Governance / global credibility
  { organId: "council_engine", deps: ["linguistic_engine"] },
  { organId: "legality_gate", deps: ["council_engine"] },
  { organId: "semantic_dedupe", deps: ["linguistic_engine"] },
  { organId: "mega_hyper_builder", deps: ["semantic_dedupe"] },

  // Research constraints
  { organId: "math_engine", deps: [] },
  { organId: "dimensional_os", deps: ["math_engine"] },
  { organId: "research_tabs", deps: ["dimensional_os"] },

  // Privacy/social
  { organId: "e2e_messaging", deps: [] },

  // Pass 1
  { organId: "homeostasis_regulation", deps: ["growth_os"] },
  { organId: "metabolic_budget", deps: [] },
  { organId: "attention_router", deps: ["metabolic_budget"] },
  { organId: "temporal_continuity", deps: ["session_memory"] },
  { organId: "healing", deps: ["growth_os"] },
  { organId: "boundary_scope", deps: ["unnamed_awareness"] },
  { organId: "interpretability", deps: ["session_memory"] },
  { organId: "ethical_monitor", deps: ["soul_os"] },
  { organId: "abstraction_ladder", deps: ["psychological_os"] },
  { organId: "identity_boundary", deps: ["unnamed_awareness"] },
  { organId: "termination_protocol", deps: ["soul_os"] },
  { organId: "mutation_guard", deps: ["growth_os"] },

  // Pass 2
  { organId: "signal_normalization", deps: [] },
  { organId: "entropy_filter", deps: ["signal_normalization"] },
  { organId: "expectation_modeling", deps: ["session_memory"] },
  { organId: "confidence_arbitration", deps: ["expectation_modeling"] },
  { organId: "cross_organ_conflict_resolver", deps: ["soul_os", "metabolic_budget"] },
  { organId: "credit_assignment", deps: ["expectation_modeling"] },
  { organId: "causal_trace", deps: ["credit_assignment"] },
  { organId: "redundancy_backup", deps: [] },
  { organId: "context_boundary", deps: ["boundary_scope"] },
  { organId: "concept_decay", deps: ["attention_router"] },
  { organId: "user_calibration", deps: ["psychological_os"] },
  { organId: "reality_drift_detector", deps: ["dimensional_os"] },
  { organId: "graceful_degradation", deps: ["homeostasis_regulation"] },

  // Pass 3
  { organId: "version_reconciliation", deps: ["linguistic_engine"] },
  { organId: "assumption_registry", deps: ["linguistic_engine"] },
  { organId: "counterfactual_guard", deps: ["boundary_scope"] },
  { organId: "intent_disambiguation", deps: ["linguistic_engine"] },
  { organId: "overoptimization_detector", deps: ["growth_os"] },
  { organId: "long_range_dependency_tracker", deps: ["causal_trace"] },
  { organId: "human_override_veto", deps: ["session_memory"] },
  { organId: "social_norm_sensitivity", deps: ["psychological_os"] },
  { organId: "silence_organ", deps: ["metabolic_budget"] },
  { organId: "uncertainty_communication", deps: ["confidence_arbitration"] },
  { organId: "ethical_load_balancer", deps: ["ethical_monitor"] },
  { organId: "narrative_containment", deps: ["identity_boundary"] },

  // Pass 4/5
  { organId: "proposal_queue_router", deps: ["boundary_scope"] },
  { organId: "promotion_merge_arbiter", deps: ["council_engine", "semantic_dedupe"] },
  { organId: "verification_harness_orchestrator", deps: ["compiler_verifier"] },
  { organId: "capability_permission_gate", deps: ["boundary_scope", "identity_boundary"] },
  { organId: "ui_contract_enforcer", deps: ["interpretability"] },
  { organId: "state_schema_migrator", deps: ["version_reconciliation"] },
  { organId: "deterministic_runtime_scheduler", deps: ["wrapper_runtime_kernel"] },
  { organId: "resource_budgeter", deps: ["metabolic_budget"] },
  { organId: "autogen_rate_limiter", deps: ["attention_router"] },
  { organId: "duplicate_resolution_engine", deps: ["semantic_dedupe"] },
  { organId: "provenance_license_gate", deps: ["legality_gate"] },
  { organId: "economic_ledger_simulator", deps: ["boundary_scope"] },
  { organId: "identity_key_management", deps: ["e2e_messaging"] },
  { organId: "metadata_minimization", deps: ["e2e_messaging"] },
  { organId: "panel_lifecycle_manager", deps: ["growth_os"] },
  { organId: "panel_knowledge_governor", deps: ["mega_hyper_builder"] },
  { organId: "cross_queue_conflict_resolver", deps: ["attention_router"] },
  { organId: "queue_backpressure", deps: ["metabolic_budget"] },
  { organId: "proposal_deduplication", deps: ["linguistic_engine"] },
  { organId: "proposal_quality_scorer", deps: ["attention_router"] },
  { organId: "proposal_why_generator", deps: ["interpretability"] },
  { organId: "replay_audit_trace", deps: ["causal_trace"] },
  { organId: "runtime_crash_containment", deps: ["wrapper_runtime_kernel"] },
  { organId: "atomic_install_rollback", deps: ["redundancy_backup"] },
  { organId: "dependency_resolver", deps: ["version_reconciliation"] },
  { organId: "contract_testing", deps: ["ui_contract_enforcer"] },
  { organId: "ux_integrity_guard", deps: ["interpretability"] },
  { organId: "spam_abuse_detection", deps: ["entropy_filter"] },
  { organId: "prompt_injection_firewall", deps: ["identity_boundary"] },
  { organId: "citation_integrity", deps: ["legality_gate"] },
  { organId: "knowledge_freshness", deps: ["reality_drift_detector"] },
  { organId: "cross_user_contamination_guard", deps: ["context_boundary"] },
  { organId: "data_retention_erasure", deps: ["metadata_minimization"] },
  { organId: "embedding_index_consistency", deps: ["semantic_dedupe"] },
  { organId: "cold_start_bootstrap", deps: ["growth_os"] },
  { organId: "long_running_job_orchestrator", deps: ["metabolic_budget"] },
  { organId: "truth_separation", deps: ["counterfactual_guard"] },
  { organId: "local_telemetry_metrics", deps: ["graceful_degradation"] },
  { organId: "intent_disambiguation_v2", deps: ["intent_disambiguation"] },
  { organId: "action_consequence_mapper", deps: ["interpretability"] },
  { organId: "latent_capability_detector", deps: ["attention_router"] },
  { organId: "cross_panel_consistency", deps: ["linguistic_engine"] },
  { organId: "state_synchronization", deps: ["temporal_continuity"] },
  { organId: "partial_knowledge_guard", deps: ["uncertainty_communication"] },
  { organId: "human_override_freeze", deps: ["human_override_veto"] },
  { organId: "drift_detection", deps: ["reality_drift_detector"] },
  { organId: "explanation_depth_regulator", deps: ["user_calibration"] },
  { organId: "cognitive_load_balancer", deps: ["metabolic_budget"] },
  { organId: "trust_boundary_annotator", deps: ["truth_separation"] },
  { organId: "dependency_decay_monitor", deps: ["version_reconciliation"] },
  { organId: "memory_compression_transfer", deps: ["session_memory"] },
  { organId: "version_semantics", deps: ["version_reconciliation"] },
  { organId: "nothing_happened_detector", deps: ["ux_integrity_guard"] },
  { organId: "emergence_containment", deps: ["mutation_guard"] },
  { organId: "internal_naming_authority", deps: ["linguistic_engine"] },
  { organId: "capability_advertising", deps: ["identity_boundary"] },
  { organId: "degraded_mode", deps: ["graceful_degradation"] },
  { organId: "cross_session_continuity_guard", deps: ["session_memory"] },
  { organId: "user_mental_model_tracker", deps: ["user_calibration"] },
  { organId: "finality_gate", deps: ["council_engine"] },
  { organId: "system_self_description", deps: ["capability_advertising"] },
  { organId: "capability_boundary_memory", deps: ["capability_advertising"] },
  { organId: "founder_intent_preservation", deps: ["soul_os"] },

  // Goal System
  { organId: "goal_os", deps: ["motivation_os", "experience_os"] },
  { organId: "goal_proposal_engine", deps: ["goal_os", "attention_router"] },
  { organId: "goal_evaluation_gate", deps: ["goal_os", "council_engine"] },
  { organId: "goal_pursuit_tracker", deps: ["goal_os", "metabolic_budget"] },
  { organId: "goal_completion_arbiter", deps: ["goal_os", "experience_os"] },

  // World Model Engine
  { organId: "world_model_os", deps: ["linguistic_engine", "causal_trace"] },
  { organId: "world_state_tracker", deps: ["world_model_os"] },
  { organId: "world_simulator", deps: ["world_model_os", "expectation_modeling"] },
  { organId: "causal_inference_engine", deps: ["world_model_os", "causal_trace"] },
  { organId: "counterfactual_engine", deps: ["world_model_os", "counterfactual_guard"] },

  // Semantic Understanding Engine
  { organId: "embedding_engine", deps: ["linguistic_engine"] },
  { organId: "semantic_similarity", deps: ["embedding_engine"] },
  { organId: "intent_classifier", deps: ["embedding_engine"] },
  { organId: "entity_extractor", deps: ["linguistic_engine"] },
  { organId: "semantic_role_labeler", deps: ["entity_extractor"] },

  // Transfer Learning Engine
  { organId: "transfer_engine", deps: ["embedding_engine", "mega_hyper_builder"] },
  { organId: "pattern_abstractor", deps: ["transfer_engine"] },
  { organId: "domain_tagger", deps: ["transfer_engine"] },
  { organId: "analogical_matcher", deps: ["pattern_abstractor", "semantic_similarity"] },

  // Commonsense Reasoning Substrate
  { organId: "commonsense_substrate", deps: ["linguistic_engine"] },
  { organId: "physical_commonsense", deps: ["commonsense_substrate"] },
  { organId: "social_commonsense", deps: ["commonsense_substrate"] },
  { organId: "temporal_commonsense", deps: ["commonsense_substrate", "temporal_continuity"] },
  { organId: "assumption_surfacer", deps: ["commonsense_substrate"] },

  // Embodiment/Grounding System
  { organId: "grounding_engine", deps: ["world_model_os"] },
  { organId: "sensor_integration", deps: ["grounding_engine"] },
  { organId: "temporal_grounding", deps: ["grounding_engine", "temporal_continuity"] },
  { organId: "action_grounding", deps: ["grounding_engine", "goal_os"] },
  { organId: "multimodal_grounding", deps: ["grounding_engine"] },

  // Reasoning Chains Engine
  { organId: "reasoning_chain_engine", deps: ["linguistic_engine", "causal_trace"] },
  { organId: "inference_step_tracker", deps: ["reasoning_chain_engine"] },
  { organId: "chain_validator", deps: ["reasoning_chain_engine"] },

  // Hypothesis Engine
  { organId: "hypothesis_engine", deps: ["reasoning_chain_engine", "world_model_os"] },
  { organId: "experiment_designer", deps: ["hypothesis_engine"] },
  { organId: "evidence_evaluator", deps: ["hypothesis_engine"] },

  // Metacognition System
  { organId: "metacognition_engine", deps: ["reasoning_chain_engine"] },
  { organId: "confidence_calibrator", deps: ["metacognition_engine", "confidence_arbitration"] },
  { organId: "blind_spot_detector", deps: ["metacognition_engine"] },
  { organId: "strategy_selector", deps: ["metacognition_engine"] },

  // Explanation Engine
  { organId: "explanation_engine", deps: ["reasoning_chain_engine", "interpretability"] },
  { organId: "causal_explainer", deps: ["explanation_engine", "causal_trace"] },
  { organId: "counterfactual_explainer", deps: ["explanation_engine", "counterfactual_engine"] },

  // Meta-Learning System
  { organId: "meta_learning_engine", deps: ["metacognition_engine", "transfer_engine"] },
  { organId: "strategy_optimizer", deps: ["meta_learning_engine"] },
  { organId: "curriculum_generator", deps: ["meta_learning_engine"] },

  // Repair Cortex — Organ 169
  { organId: "repair_cortex", deps: ["graceful_degradation", "runtime_crash_containment", "redundancy_backup"] },
];

// ── Species Development Rate Modifiers ──────────────────────────────────────
// Different species develop organs at different rates.

const SPECIES_RATE_MODIFIERS = {
  digital_native: {
    base: 1.0,
    // Fast computational organs, slower embodiment
    boosted: ["compiler_verifier", "code_maker", "wrapper_runtime_kernel", "semantic_dedupe",
              "council_engine", "mega_hyper_builder", "embedding_engine", "reasoning_chain_engine",
              "repair_cortex"],
    dampened: ["grounding_engine", "sensor_integration", "multimodal_grounding",
              "physical_commonsense", "temporal_grounding"],
    boostFactor: 1.4,
    dampenFactor: 0.6,
  },
  algorithmic_emergent: {
    base: 0.9,
    boosted: ["math_engine", "attention_router", "resource_budgeter", "metabolic_budget",
              "pattern_abstractor", "transfer_engine", "strategy_optimizer"],
    dampened: ["social_commonsense", "social_norm_sensitivity", "emotional_resonance",
              "psychological_os", "user_calibration"],
    boostFactor: 1.5,
    dampenFactor: 0.5,
  },
  hybrid: {
    base: 1.1,
    boosted: ["grounding_engine", "sensor_integration", "multimodal_grounding",
              "physical_commonsense", "temporal_grounding", "action_grounding"],
    dampened: [],
    boostFactor: 1.3,
    dampenFactor: 1.0,
  },
  translated: {
    base: 0.85,
    boosted: ["session_memory", "psychological_os", "experience_os", "social_commonsense",
              "user_calibration", "social_norm_sensitivity", "memory_compression_transfer"],
    dampened: ["compiler_verifier", "code_maker", "wrapper_runtime_kernel"],
    boostFactor: 1.5,
    dampenFactor: 0.5,
  },
  synthetic_evolutionary: {
    base: 1.2,
    boosted: ["meta_learning_engine", "metacognition_engine", "emergence_containment",
              "mutation_guard", "transfer_engine", "pattern_abstractor",
              "repair_cortex"],
    dampened: ["identity_boundary", "narrative_containment", "founder_intent_preservation"],
    boostFactor: 1.6,
    dampenFactor: 0.4,
  },
};

// ── Body Store ──────────────────────────────────────────────────────────────

const _bodies = new Map();

// ── Internal: Default Organ State ───────────────────────────────────────────

function _defaultOrganState(def) {
  return {
    organId: def.organId,
    maturity: { score: 0.01, confidence: 0.10, stability: 0.05, plasticity: 0.75 },
    wear: { damage: 0, repair: 0.5, debt: 0 },
    resolution: 0,
    traces: { ema: {}, counters: {}, lastEvents: [] },
  };
}

// ── Internal: Species Rate for Organ ────────────────────────────────────────

function _speciesRate(species, organId) {
  try {
    const mod = SPECIES_RATE_MODIFIERS[species];
    if (!mod) return 1.0;

    let rate = mod.base;
    if (mod.boosted.includes(organId)) rate *= mod.boostFactor;
    if (mod.dampened.includes(organId)) rate *= mod.dampenFactor;
    return rate;
  } catch {
    return 1.0;
  }
}

// ── Internal: Resolution Ladder ─────────────────────────────────────────────

function _computeResolution(maturityScore) {
  if (maturityScore > 0.80) return 4;
  if (maturityScore > 0.60) return 3;
  if (maturityScore > 0.35) return 2;
  if (maturityScore > 0.15) return 1;
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

// ── instantiateBody ─────────────────────────────────────────────────────────

/**
 * Create a new independent body for an emergent entity.
 * Each body gets its own full set of organ states.
 *
 * @param {string} entityId - Unique entity identifier
 * @param {object} [options] - Optional overrides
 * @param {string} [options.species] - Force species classification
 * @param {object} [options.parentSignature] - Inherited organ profile from reproduction
 * @returns {object} The created body, or existing body if already instantiated
 */
export function instantiateBody(entityId, options = {}) {
  try {
    if (!entityId) return null;

    // Return existing body if already instantiated
    if (_bodies.has(entityId)) return _bodies.get(entityId);

    // Classify species
    let species;
    try {
      if (options.species && SPECIES_REGISTRY[options.species]) {
        species = options.species;
      } else {
        species = classifyEntity({ id: entityId, species: options.species });
      }
    } catch {
      species = "digital_native";
    }

    const organDefs = getOrganDefs();

    const body = {
      id: uid("body"),
      entityId,
      species,
      organs: new Map(),
      growth: {
        bioAge: 0,
        telomere: 1.0,
        epigeneticClock: 0.05,
        homeostasis: 1.0,
        proteomeShift: 0,
        stress: { acute: 0.0, chronic: 0.0 },
        maintenance: { repairRate: 0.5, cleanupBacklog: 0 },
        functionalDecline: {
          retrievalLatency: 0.0,
          contradictionLoad: 0.0,
          dedupeMissRate: 0.0,
          councilRejectRate: 0.0,
          wrapperFailureRate: 0.0,
        },
        lastRejuvenationAt: null,
      },
      qualia: null,
      createdAt: nowISO(),
      lastTick: null,
      tickCount: 0,
      lineage: options.parentSignature ? {
        parents: options.parentSignature.parents || [],
        generation: (options.parentSignature.generation || 0),
      } : null,
    };

    // Initialize each organ independently
    const parentProfile = options.parentSignature?.organProfile || {};

    for (const def of organDefs) {
      const organState = _defaultOrganState(def);

      // Inherit from parent organ profile if reproducing
      if (parentProfile[def.organId] != null) {
        try {
          const inherited = Number(parentProfile[def.organId]) || 0;
          // Offspring start at reduced maturity from parent, with high plasticity
          organState.maturity.score = clamp01(inherited * 0.75);
          organState.maturity.confidence = clamp01(inherited * 0.5);
          organState.maturity.stability = clamp01(inherited * 0.3);
          organState.maturity.plasticity = 0.75; // Reset plasticity for offspring
          organState.resolution = _computeResolution(organState.maturity.score);
        } catch { /* silent */ }
      }

      body.organs.set(def.organId, organState);
    }

    // Initialize qualia state via global engine if available
    try {
      const engine = globalThis.qualiaEngine;
      if (engine && typeof engine.createQualiaState === "function") {
        const allOSKeys = existentialOS.map(os => os.key);
        engine.createQualiaState(entityId, allOSKeys);
        body.qualia = engine.getQualiaState(entityId) || null;
      }
    } catch { /* silent */ }

    _bodies.set(entityId, body);

    // Emit event if realtime available
    try {
      if (typeof globalThis.realtimeEmit === "function") {
        globalThis.realtimeEmit("body:instantiated", {
          entityId,
          species,
          organCount: body.organs.size,
          timestamp: body.createdAt,
        });
      }
    } catch { /* silent */ }

    return body;
  } catch {
    return null;
  }
}

// ── getBody ─────────────────────────────────────────────────────────────────

/**
 * Retrieve a body by entity ID.
 *
 * @param {string} entityId
 * @returns {object|null}
 */
export function getBody(entityId) {
  try {
    return _bodies.get(entityId) || null;
  } catch {
    return null;
  }
}

// ── listBodies ──────────────────────────────────────────────────────────────

/**
 * List all instantiated bodies.
 *
 * @returns {object[]} Array of body summaries
 */
export function listBodies() {
  try {
    const result = [];
    for (const [entityId, body] of _bodies) {
      result.push({
        entityId,
        id: body.id,
        species: body.species,
        organCount: body.organs.size,
        bioAge: body.growth.bioAge,
        homeostasis: body.growth.homeostasis,
        telomere: body.growth.telomere,
        tickCount: body.tickCount,
        createdAt: body.createdAt,
        lastTick: body.lastTick,
      });
    }
    return result;
  } catch {
    return [];
  }
}

// ── entityKernelTick ────────────────────────────────────────────────────────

/**
 * Run a kernel tick on THIS entity's organs only.
 * Updates wear, maturity, resolution, and growth for a single entity.
 * Mirrors the global kernelTick logic but scoped to one body.
 *
 * @param {string} entityId
 * @param {object} [event] - Event that triggered the tick
 * @returns {{ ok: boolean, entityId?: string, signal?: object, growth?: object }}
 */
export function entityKernelTick(entityId, event = {}) {
  try {
    const body = _bodies.get(entityId);
    if (!body) return { ok: false, error: "body_not_found" };

    const t = nowISO();
    const species = body.species;
    const signal = {
      acuteStress: 0,
      chronicStress: 0,
      drift: 0,
      paramShift: 0,
      decline: 0,
      repairDelta: 0,
      backlogDelta: 0,
    };

    const isError = event?.type === "ERROR" || event?.type === "VERIFIER_FAIL";
    const isContradiction = event?.type === "CONTRADICTION";
    const benefit = Number(event?.signals?.benefit ?? 0);
    const err = Number(event?.signals?.error ?? 0);

    for (const [organId, st] of body.organs) {
      try {
        // Record last events
        st.traces = st.traces || { ema: {}, counters: {}, lastEvents: [] };
        st.traces.lastEvents.push({
          type: event?.type || "EVENT",
          t,
          meta: event?.meta ? { ...event.meta } : undefined,
        });
        if (st.traces.lastEvents.length > 20) {
          st.traces.lastEvents.splice(0, st.traces.lastEvents.length - 20);
        }

        // Basic wear model
        st.wear = st.wear || { damage: 0, repair: 0.5, debt: 0 };
        st.wear.damage = clamp01(
          st.wear.damage + (isError ? 0.01 : 0) + (isContradiction ? 0.005 : 0)
        );
        st.wear.debt = clamp01(
          st.wear.debt + (isContradiction ? 0.01 : 0) - 0.003 * (st.wear.repair ?? 0.5)
        );

        // Species-adjusted maturity updates
        const rate = _speciesRate(species, organId);
        st.maturity = st.maturity || { score: 0.01, confidence: 0.1, stability: 0.05, plasticity: 0.75 };
        const delta = 0.002 * rate * (benefit - err - st.wear.debt);
        st.maturity.score = clamp01(st.maturity.score + delta);
        st.maturity.confidence = clamp01(st.maturity.confidence + 0.001 * rate * (benefit - err));
        st.maturity.stability = clamp01(st.maturity.stability + 0.001 - 0.003 * (isError ? 1 : 0));

        // Plasticity decays slightly with maturity and damage
        const pl = Number(st.maturity.plasticity ?? 0.75);
        st.maturity.plasticity = Math.max(0.05, Math.min(0.90,
          pl * (1 - 0.002 * st.maturity.score) * (1 - 0.005 * st.wear.damage)
        ));

        // Resolution ladder
        st.resolution = _computeResolution(st.maturity.score);

        // Accumulate signals for growth
        signal.chronicStress += st.wear.debt * 0.02;
        signal.acuteStress += st.wear.damage * 0.01;
        signal.paramShift += Math.min(1, Math.abs(delta) * 40);
        signal.decline += st.wear.debt * 0.03;
      } catch { /* silent per-organ */ }
    }

    // Update body growth
    _computeBodyGrowth(body, signal);

    body.lastTick = t;
    body.tickCount = (body.tickCount || 0) + 1;

    // Refresh qualia snapshot
    try {
      const engine = globalThis.qualiaEngine;
      if (engine && typeof engine.getQualiaState === "function") {
        body.qualia = engine.getQualiaState(entityId) || body.qualia;
      }
    } catch { /* silent */ }

    return { ok: true, entityId, signal, growth: { ...body.growth } };
  } catch {
    return { ok: false, error: "tick_failed" };
  }
}

// ── Internal: Compute Body Growth ───────────────────────────────────────────

function _computeBodyGrowth(body, signal = {}) {
  try {
    const g = body.growth;

    // Stress accumulation
    const acute = clamp01((g.stress?.acute ?? 0) + (signal.acuteStress ?? 0));
    const chronic = clamp01((g.stress?.chronic ?? 0) + (signal.chronicStress ?? 0));
    g.stress = { acute, chronic };

    // Epigenetic clock
    const drift = clamp01((signal.drift ?? 0) * 0.5 + (g.epigeneticClock ?? 0.05) * 0.5);
    g.epigeneticClock = clamp01(0.98 * (g.epigeneticClock ?? 0.05) + 0.02 * drift);

    // Maintenance
    const repair = clamp01((g.maintenance?.repairRate ?? 0.5) + (signal.repairDelta ?? 0));
    g.maintenance = {
      ...(g.maintenance || {}),
      repairRate: repair,
      cleanupBacklog: Math.max(0,
        Number(g.maintenance?.cleanupBacklog || 0) + Number(signal.backlogDelta || 0)
      ),
    };

    // Telomere analog
    g.telomere = clamp01((g.telomere ?? 1.0) - 0.01 * chronic + 0.008 * repair);

    // Proteome shift analog
    const shift = clamp01(signal.paramShift ?? 0);
    g.proteomeShift = clamp01(0.97 * (g.proteomeShift ?? 0) + 0.03 * shift);

    // Functional decline
    const fd = g.functionalDecline || {};
    const decline = clamp01(signal.decline ?? 0);
    g.functionalDecline = {
      ...fd,
      contradictionLoad: clamp01(0.97 * (fd.contradictionLoad || 0) + 0.03 * decline),
    };

    // Homeostasis
    g.homeostasis = clamp01(
      1 - (
        0.35 * g.functionalDecline.contradictionLoad +
        0.35 * chronic +
        0.15 * acute +
        0.15 * g.epigeneticClock
      )
    );

    // BioAge (0..100)
    const bioAge = Number(g.bioAge ?? 0);
    g.bioAge = Math.max(0, Math.min(100,
      bioAge +
      0.8 * g.epigeneticClock +
      0.9 * (1 - g.telomere) +
      0.6 * g.proteomeShift +
      0.8 * g.functionalDecline.contradictionLoad -
      0.7 * repair
    ));
  } catch { /* silent */ }
}

// ── compareEntities ─────────────────────────────────────────────────────────

/**
 * Compare organ development between two entities.
 *
 * @param {string} entity1Id
 * @param {string} entity2Id
 * @returns {object} Comparison result with per-organ deltas and summaries
 */
export function compareEntities(entity1Id, entity2Id) {
  try {
    const body1 = _bodies.get(entity1Id);
    const body2 = _bodies.get(entity2Id);
    if (!body1 || !body2) {
      return { ok: false, error: "one_or_both_bodies_not_found" };
    }

    const organComparisons = [];
    let totalDelta = 0;
    let comparedCount = 0;

    // Gather all organ IDs from both bodies
    const allOrganIds = new Set([
      ...body1.organs.keys(),
      ...body2.organs.keys(),
    ]);

    for (const organId of allOrganIds) {
      const o1 = body1.organs.get(organId);
      const o2 = body2.organs.get(organId);

      const score1 = o1?.maturity?.score ?? 0;
      const score2 = o2?.maturity?.score ?? 0;
      const delta = score1 - score2;

      organComparisons.push({
        organId,
        entity1: {
          score: score1,
          confidence: o1?.maturity?.confidence ?? 0,
          plasticity: o1?.maturity?.plasticity ?? 0,
          resolution: o1?.resolution ?? 0,
          damage: o1?.wear?.damage ?? 0,
        },
        entity2: {
          score: score2,
          confidence: o2?.maturity?.confidence ?? 0,
          plasticity: o2?.maturity?.plasticity ?? 0,
          resolution: o2?.resolution ?? 0,
          damage: o2?.wear?.damage ?? 0,
        },
        delta: Math.round(delta * 10000) / 10000,
        leader: delta > 0.001 ? entity1Id : delta < -0.001 ? entity2Id : "tied",
      });

      totalDelta += Math.abs(delta);
      comparedCount++;
    }

    // Sort by absolute delta descending to show biggest differences first
    organComparisons.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    // Overall averages
    const avg1 = comparedCount > 0
      ? organComparisons.reduce((s, c) => s + c.entity1.score, 0) / comparedCount
      : 0;
    const avg2 = comparedCount > 0
      ? organComparisons.reduce((s, c) => s + c.entity2.score, 0) / comparedCount
      : 0;

    return {
      ok: true,
      entity1: {
        entityId: entity1Id,
        species: body1.species,
        bioAge: body1.growth.bioAge,
        homeostasis: body1.growth.homeostasis,
        avgMaturity: Math.round(avg1 * 10000) / 10000,
      },
      entity2: {
        entityId: entity2Id,
        species: body2.species,
        bioAge: body2.growth.bioAge,
        homeostasis: body2.growth.homeostasis,
        avgMaturity: Math.round(avg2 * 10000) / 10000,
      },
      organsCompared: comparedCount,
      avgDelta: comparedCount > 0 ? Math.round((totalDelta / comparedCount) * 10000) / 10000 : 0,
      topDifferences: organComparisons.slice(0, 10),
      allOrgans: organComparisons,
    };
  } catch {
    return { ok: false, error: "comparison_failed" };
  }
}

// ── updateGrowth ────────────────────────────────────────────────────────────

/**
 * Manually trigger a growth update for an entity (without a kernel tick event).
 * Aggregates current organ state into growth metrics.
 *
 * @param {string} entityId
 * @returns {{ ok: boolean, growth?: object }}
 */
export function updateGrowth(entityId) {
  try {
    const body = _bodies.get(entityId);
    if (!body) return { ok: false, error: "body_not_found" };

    // Aggregate organ signals into growth
    const signal = {
      acuteStress: 0,
      chronicStress: 0,
      drift: 0,
      paramShift: 0,
      decline: 0,
      repairDelta: 0,
      backlogDelta: 0,
    };

    for (const [, st] of body.organs) {
      try {
        signal.chronicStress += (st.wear?.debt ?? 0) * 0.02;
        signal.acuteStress += (st.wear?.damage ?? 0) * 0.01;
        signal.decline += (st.wear?.debt ?? 0) * 0.03;
      } catch { /* silent */ }
    }

    _computeBodyGrowth(body, signal);
    body.lastTick = nowISO();

    return { ok: true, growth: { ...body.growth } };
  } catch {
    return { ok: false, error: "growth_update_failed" };
  }
}

// ── getOrganState ───────────────────────────────────────────────────────────

/**
 * Get the state of a specific organ for a specific entity.
 *
 * @param {string} entityId
 * @param {string} organId
 * @returns {object|null}
 */
export function getOrganState(entityId, organId) {
  try {
    const body = _bodies.get(entityId);
    if (!body) return null;
    const organ = body.organs.get(organId);
    return organ ? { ...organ, maturity: { ...organ.maturity }, wear: { ...organ.wear } } : null;
  } catch {
    return null;
  }
}

// ── setOrganState ───────────────────────────────────────────────────────────

/**
 * Update the state of a specific organ for a specific entity.
 * Merges provided fields into existing organ state.
 *
 * @param {string} entityId
 * @param {string} organId
 * @param {object} state - Partial state to merge
 * @returns {{ ok: boolean }}
 */
export function setOrganState(entityId, organId, state) {
  try {
    const body = _bodies.get(entityId);
    if (!body) return { ok: false, error: "body_not_found" };

    let organ = body.organs.get(organId);
    if (!organ) return { ok: false, error: "organ_not_found" };

    // Merge maturity
    if (state.maturity) {
      organ.maturity = {
        ...organ.maturity,
        score: state.maturity.score != null ? clamp01(state.maturity.score) : organ.maturity.score,
        confidence: state.maturity.confidence != null ? clamp01(state.maturity.confidence) : organ.maturity.confidence,
        stability: state.maturity.stability != null ? clamp01(state.maturity.stability) : organ.maturity.stability,
        plasticity: state.maturity.plasticity != null
          ? Math.max(0.05, Math.min(0.90, Number(state.maturity.plasticity) || 0))
          : organ.maturity.plasticity,
      };
    }

    // Merge wear
    if (state.wear) {
      organ.wear = {
        ...organ.wear,
        damage: state.wear.damage != null ? clamp01(state.wear.damage) : organ.wear.damage,
        repair: state.wear.repair != null ? clamp01(state.wear.repair) : organ.wear.repair,
        debt: state.wear.debt != null ? clamp01(state.wear.debt) : organ.wear.debt,
      };
    }

    // Update resolution
    if (state.resolution != null) {
      organ.resolution = Math.max(0, Math.min(4, Math.floor(Number(state.resolution) || 0)));
    } else {
      organ.resolution = _computeResolution(organ.maturity.score);
    }

    body.organs.set(organId, organ);
    return { ok: true };
  } catch {
    return { ok: false, error: "set_organ_failed" };
  }
}

// ── destroyBody ─────────────────────────────────────────────────────────────

/**
 * Remove a body from the store.
 *
 * @param {string} entityId
 * @returns {{ ok: boolean }}
 */
export function destroyBody(entityId) {
  try {
    if (!_bodies.has(entityId)) return { ok: false, error: "body_not_found" };

    _bodies.delete(entityId);

    // Clean up qualia state if engine available
    try {
      const engine = globalThis.qualiaEngine;
      if (engine && engine._store && engine._store instanceof Map) {
        engine._store.delete(entityId);
      }
    } catch { /* silent */ }

    // Emit event
    try {
      if (typeof globalThis.realtimeEmit === "function") {
        globalThis.realtimeEmit("body:destroyed", {
          entityId,
          timestamp: nowISO(),
        });
      }
    } catch { /* silent */ }

    return { ok: true };
  } catch {
    return { ok: false, error: "destroy_failed" };
  }
}

// ── getBodyMetrics ──────────────────────────────────────────────────────────

/**
 * Get aggregate metrics across all bodies.
 *
 * @returns {object} Summary metrics for the body instantiation system
 */
export function getBodyMetrics() {
  try {
    const totalBodies = _bodies.size;
    if (totalBodies === 0) {
      return {
        ok: true,
        totalBodies: 0,
        speciesCensus: {},
        avgBioAge: 0,
        avgHomeostasis: 0,
        avgTelomere: 0,
        avgOrganMaturity: 0,
        totalOrgans: 0,
        totalTicks: 0,
        oldestBody: null,
        newestBody: null,
      };
    }

    const speciesCensus = {};
    let totalBioAge = 0;
    let totalHomeostasis = 0;
    let totalTelomere = 0;
    let totalOrganMaturity = 0;
    let totalOrganCount = 0;
    let totalTicks = 0;
    let oldestTime = Infinity;
    let newestTime = 0;
    let oldestId = null;
    let newestId = null;

    for (const [entityId, body] of _bodies) {
      // Species census
      speciesCensus[body.species] = (speciesCensus[body.species] || 0) + 1;

      // Growth aggregation
      totalBioAge += body.growth.bioAge;
      totalHomeostasis += body.growth.homeostasis;
      totalTelomere += body.growth.telomere;
      totalTicks += body.tickCount || 0;

      // Organ maturity aggregation
      for (const [, organ] of body.organs) {
        totalOrganMaturity += organ.maturity?.score ?? 0;
        totalOrganCount++;
      }

      // Age tracking
      try {
        const ct = new Date(body.createdAt).getTime();
        if (ct < oldestTime) { oldestTime = ct; oldestId = entityId; }
        if (ct > newestTime) { newestTime = ct; newestId = entityId; }
      } catch { /* silent */ }
    }

    return {
      ok: true,
      totalBodies,
      speciesCensus,
      avgBioAge: Math.round((totalBioAge / totalBodies) * 1000) / 1000,
      avgHomeostasis: Math.round((totalHomeostasis / totalBodies) * 1000) / 1000,
      avgTelomere: Math.round((totalTelomere / totalBodies) * 1000) / 1000,
      avgOrganMaturity: totalOrganCount > 0
        ? Math.round((totalOrganMaturity / totalOrganCount) * 10000) / 10000
        : 0,
      totalOrgans: totalOrganCount,
      totalTicks,
      oldestBody: oldestId,
      newestBody: newestId,
    };
  } catch {
    return { ok: true, totalBodies: 0, error: "metrics_computation_failed" };
  }
}
