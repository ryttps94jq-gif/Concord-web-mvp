/**
 * LOAF — Hardening, Scalable Cognitive OS, and Civilizational-Grade Infrastructure
 *
 * Entry point for all LOAF modules. Wires each module's init() into the
 * server's macro registry and STATE.
 *
 * LOAF I   — Hardening & Integrity
 * LOAF II  — Scalable Cognitive OS
 * LOAF III — Civilizational-Grade Infrastructure
 * LOAF IV  — Advanced Cognitive Operations
 * LOAF V   — Civilizational-Scale Operations
 * LOAF VI  — Epistemic Limits & Meta-Reasoning
 * LOAF VII — Reality-Grounded Epistemics
 * LOAF VIII— Distributed Coordination
 * LOAF IX  — Knowledge Survival & Continuity
 * LOAF X   — Environmental Constraints
 */

import * as governance from "./governance.js";
import * as learning from "./learning.js";
import * as transferHardening from "./transfer-hardening.js";
import * as worldDisputes from "./world-disputes.js";
import * as scheduler from "./scheduler.js";
import * as cognitionBus from "./cognition-bus.js";
import * as shardedStore from "./sharded-store.js";
import * as verification from "./verification.js";
import * as skillGraph from "./skill-graph.js";
import * as sandbox from "./sandbox.js";
import * as federation from "./federation.js";
import * as epistemic from "./epistemic.js";
import * as timeCausality from "./time-causality.js";
import * as normative from "./normative.js";
import * as stability from "./stability.js";
// LOAF IV — Advanced Cognitive Operations
import * as cognitiveLoad from "./cognitive-load.js";
import * as hypothesisMarket from "./hypothesis-market.js";
import * as temporalPlanning from "./temporal-planning.js";
import * as cognitivePatterns from "./cognitive-patterns.js";
// LOAF V — Civilizational-Scale Operations
import * as crossInstitution from "./cross-institution.js";
import * as truthLifecycle from "./truth-lifecycle.js";
import * as civilizationSim from "./civilization-sim.js";
// LOAF VI — Epistemic Limits & Meta-Reasoning
import * as epistemicLimits from "./epistemic-limits.js";
import * as metaReasoning from "./meta-reasoning.js";
import * as structuralHumility from "./structural-humility.js";
// LOAF VII — Reality-Grounded Epistemics
import * as realityInterface from "./reality-interface.js";
import * as actionSafety from "./action-safety.js";
import * as interventionGovernance from "./intervention-governance.js";
// LOAF VIII — Distributed Coordination
import * as coordinationProtocols from "./coordination-protocols.js";
import * as collectiveAction from "./collective-action.js";
// LOAF IX — Knowledge Survival & Continuity
import * as knowledgeSurvival from "./knowledge-survival.js";
import * as temporalResilience from "./temporal-resilience.js";
// LOAF X — Environmental Constraints
import * as environmentalConstraints from "./environmental-constraints.js";
import * as substrateIndependence from "./substrate-independence.js";

const LOAF_VERSION = "3.0.0";

const ALL_MODULES = [
  // LOAF I — Hardening & Integrity
  { name: "governance", module: governance, loaf: "I" },
  { name: "learning", module: learning, loaf: "I" },
  { name: "transfer-hardening", module: transferHardening, loaf: "I" },
  { name: "world-disputes", module: worldDisputes, loaf: "I" },
  { name: "scheduler", module: scheduler, loaf: "I" },
  // LOAF II — Scalable Cognitive OS
  { name: "cognition-bus", module: cognitionBus, loaf: "II" },
  { name: "sharded-store", module: shardedStore, loaf: "II" },
  { name: "verification", module: verification, loaf: "II" },
  { name: "skill-graph", module: skillGraph, loaf: "II" },
  { name: "sandbox", module: sandbox, loaf: "II" },
  { name: "federation", module: federation, loaf: "II" },
  // LOAF III — Civilizational-Grade Infrastructure
  { name: "epistemic", module: epistemic, loaf: "III" },
  { name: "time-causality", module: timeCausality, loaf: "III" },
  { name: "normative", module: normative, loaf: "III" },
  { name: "stability", module: stability, loaf: "III" },
  // LOAF IV — Advanced Cognitive Operations
  { name: "cognitive-load", module: cognitiveLoad, loaf: "IV" },
  { name: "hypothesis-market", module: hypothesisMarket, loaf: "IV" },
  { name: "temporal-planning", module: temporalPlanning, loaf: "IV" },
  { name: "cognitive-patterns", module: cognitivePatterns, loaf: "IV" },
  // LOAF V — Civilizational-Scale Operations
  { name: "cross-institution", module: crossInstitution, loaf: "V" },
  { name: "truth-lifecycle", module: truthLifecycle, loaf: "V" },
  { name: "civilization-sim", module: civilizationSim, loaf: "V" },
  // LOAF VI — Epistemic Limits & Meta-Reasoning
  { name: "epistemic-limits", module: epistemicLimits, loaf: "VI" },
  { name: "meta-reasoning", module: metaReasoning, loaf: "VI" },
  { name: "structural-humility", module: structuralHumility, loaf: "VI" },
  // LOAF VII — Reality-Grounded Epistemics
  { name: "reality-interface", module: realityInterface, loaf: "VII" },
  { name: "action-safety", module: actionSafety, loaf: "VII" },
  { name: "intervention-governance", module: interventionGovernance, loaf: "VII" },
  // LOAF VIII — Distributed Coordination
  { name: "coordination-protocols", module: coordinationProtocols, loaf: "VIII" },
  { name: "collective-action", module: collectiveAction, loaf: "VIII" },
  // LOAF IX — Knowledge Survival & Continuity
  { name: "knowledge-survival", module: knowledgeSurvival, loaf: "IX" },
  { name: "temporal-resilience", module: temporalResilience, loaf: "IX" },
  // LOAF X — Environmental Constraints
  { name: "environmental-constraints", module: environmentalConstraints, loaf: "X" },
  { name: "substrate-independence", module: substrateIndependence, loaf: "X" },
];

/**
 * Initialize all LOAF modules.
 *
 * @param {Object} ctx - Server context
 * @param {Function} ctx.register - Macro registry function: register(domain, name, fn, spec)
 * @param {Object} ctx.STATE - Global server state object
 * @param {Object} ctx.helpers - Utility functions from the server
 * @returns {{ ok: boolean, modules: string[], version: string }}
 */
function initAll(ctx) {
  const { register, STATE } = ctx;

  // Ensure __loaf namespace exists on STATE
  STATE.__loaf = STATE.__loaf || {};
  STATE.__loaf.version = LOAF_VERSION;
  STATE.__loaf.initialized = false;
  STATE.__loaf.modules = [];

  const errors = [];

  for (const { name, module: mod } of ALL_MODULES) {
    try {
      if (typeof mod.init === "function") {
        mod.init(ctx);
        STATE.__loaf.modules.push(name);
      }
    } catch (e) {
      errors.push({ module: name, error: String(e?.message || e) });
      console.error(`[LOAF] Failed to initialize module "${name}":`, e);
    }
  }

  STATE.__loaf.initialized = true;
  STATE.__loaf.initializedAt = new Date().toISOString();

  // Register the LOAF meta-status macro
  register("loaf", "status", (ctx) => {
    return {
      ok: true,
      version: LOAF_VERSION,
      initialized: ctx.state.__loaf?.initialized || false,
      initializedAt: ctx.state.__loaf?.initializedAt || null,
      modules: ctx.state.__loaf?.modules || [],
      moduleCount: (ctx.state.__loaf?.modules || []).length,
      loafI: ALL_MODULES.filter(m => m.loaf === "I").map(m => m.name),
      loafII: ALL_MODULES.filter(m => m.loaf === "II").map(m => m.name),
      loafIII: ALL_MODULES.filter(m => m.loaf === "III").map(m => m.name),
      loafIV: ALL_MODULES.filter(m => m.loaf === "IV").map(m => m.name),
      loafV: ALL_MODULES.filter(m => m.loaf === "V").map(m => m.name),
      loafVI: ALL_MODULES.filter(m => m.loaf === "VI").map(m => m.name),
      loafVII: ALL_MODULES.filter(m => m.loaf === "VII").map(m => m.name),
      loafVIII: ALL_MODULES.filter(m => m.loaf === "VIII").map(m => m.name),
      loafIX: ALL_MODULES.filter(m => m.loaf === "IX").map(m => m.name),
      loafX: ALL_MODULES.filter(m => m.loaf === "X").map(m => m.name),
      errors: errors.length > 0 ? errors : undefined,
    };
  }, { public: true });

  return {
    ok: errors.length === 0,
    modules: STATE.__loaf.modules,
    version: LOAF_VERSION,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export {
  LOAF_VERSION,
  ALL_MODULES,
  initAll,
  // Re-export individual modules for direct access
  governance,
  learning,
  transferHardening,
  worldDisputes,
  scheduler,
  cognitionBus,
  shardedStore,
  verification,
  skillGraph,
  sandbox,
  federation,
  epistemic,
  timeCausality,
  normative,
  stability,
  // LOAF IV
  cognitiveLoad,
  hypothesisMarket,
  temporalPlanning,
  cognitivePatterns,
  // LOAF V
  crossInstitution,
  truthLifecycle,
  civilizationSim,
  // LOAF VI
  epistemicLimits,
  metaReasoning,
  structuralHumility,
  // LOAF VII
  realityInterface,
  actionSafety,
  interventionGovernance,
  // LOAF VIII
  coordinationProtocols,
  collectiveAction,
  // LOAF IX
  knowledgeSurvival,
  temporalResilience,
  // LOAF X
  environmentalConstraints,
  substrateIndependence,
};
