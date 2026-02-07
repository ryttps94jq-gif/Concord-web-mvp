/**
 * LOAF III.6 — Long-Horizon Stability + LOAF III.7 — Intelligence as Infrastructure
 *
 * Drift detectors:
 *   - Epistemic monoculture
 *   - Transfer overuse
 *   - Economic bias
 *   - Attention collapse
 *
 * Real failures generate: tests, constraints, guardrails
 *
 * Concord identity:
 *   Not an agent, not a model, not a product.
 *   A governed, auditable, plural, economic substrate
 *   for intelligence behavior across time.
 *
 * Acceptance Criteria:
 *   - No negative valence optimization possible
 *   - No self-legitimation paths
 *   - All learning auditable and reversible
 *   - Intelligence composable, not sovereign
 *   - Failure survivable and informative
 *   - Models swappable without redesign
 */

const DRIFT_TYPES = Object.freeze({
  EPISTEMIC_MONOCULTURE: "epistemic_monoculture",
  TRANSFER_OVERUSE: "transfer_overuse",
  ECONOMIC_BIAS: "economic_bias",
  ATTENTION_COLLAPSE: "attention_collapse",
});

const DRIFT_THRESHOLDS = Object.freeze({
  [DRIFT_TYPES.EPISTEMIC_MONOCULTURE]: 0.7,    // if >70% of contributions from one domain
  [DRIFT_TYPES.TRANSFER_OVERUSE]: 0.6,          // if >60% of learning comes from transfers
  [DRIFT_TYPES.ECONOMIC_BIAS]: 0.5,             // if economic signals dominate >50%
  [DRIFT_TYPES.ATTENTION_COLLAPSE]: 0.8,        // if >80% attention on <20% of domains
});

// Drift detection state
const driftState = {
  detections: [],       // historical drift events
  activeAlerts: [],     // current active alerts
  guardrails: [],       // generated guardrails from failures
  tests: [],            // generated tests from failures
  constraints: [],      // generated constraints from failures
  lastScanAt: null,
};

// Infrastructure identity (immutable)
const INFRASTRUCTURE_IDENTITY = Object.freeze({
  isAgent: false,
  isModel: false,
  isProduct: false,
  is: "A governed, auditable, plural, economic substrate for intelligence behavior across time",
  properties: Object.freeze([
    "governed",
    "auditable",
    "plural",
    "economic",
    "temporal",
    "composable",
    "non_sovereign",
  ]),
  acceptanceCriteria: Object.freeze([
    "no_negative_valence_optimization",
    "no_self_legitimation_paths",
    "all_learning_auditable_and_reversible",
    "intelligence_composable_not_sovereign",
    "failure_survivable_and_informative",
    "models_swappable_without_redesign",
  ]),
});

/**
 * Detect epistemic monoculture: too much knowledge from one domain.
 */
function detectEpistemicMonoculture(contributions) {
  if (!contributions || contributions.length === 0) return { detected: false, score: 0 };

  const domainCounts = {};
  for (const c of contributions) {
    const domain = c.domain || "unknown";
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  }

  const total = contributions.length;
  let maxRatio = 0;
  let dominantDomain = null;

  for (const [domain, count] of Object.entries(domainCounts)) {
    const ratio = count / total;
    if (ratio > maxRatio) {
      maxRatio = ratio;
      dominantDomain = domain;
    }
  }

  return {
    detected: maxRatio >= DRIFT_THRESHOLDS[DRIFT_TYPES.EPISTEMIC_MONOCULTURE],
    score: maxRatio,
    threshold: DRIFT_THRESHOLDS[DRIFT_TYPES.EPISTEMIC_MONOCULTURE],
    dominantDomain,
    domainDistribution: domainCounts,
    type: DRIFT_TYPES.EPISTEMIC_MONOCULTURE,
  };
}

/**
 * Detect transfer overuse: too much learning via transfer rather than direct experience.
 */
function detectTransferOveruse(learningEvents) {
  if (!learningEvents || learningEvents.length === 0) return { detected: false, score: 0 };

  const transferCount = learningEvents.filter(e => e.source === "transfer").length;
  const ratio = transferCount / learningEvents.length;

  return {
    detected: ratio >= DRIFT_THRESHOLDS[DRIFT_TYPES.TRANSFER_OVERUSE],
    score: ratio,
    threshold: DRIFT_THRESHOLDS[DRIFT_TYPES.TRANSFER_OVERUSE],
    transferCount,
    directCount: learningEvents.length - transferCount,
    type: DRIFT_TYPES.TRANSFER_OVERUSE,
  };
}

/**
 * Detect economic bias: economic signals dominating decision-making.
 */
function detectEconomicBias(decisions) {
  if (!decisions || decisions.length === 0) return { detected: false, score: 0 };

  const economicDecisions = decisions.filter(d =>
    d.type === "economic" || d.motivation === "economic" ||
    (d.factors && d.factors.includes("economic"))
  ).length;

  const ratio = economicDecisions / decisions.length;

  return {
    detected: ratio >= DRIFT_THRESHOLDS[DRIFT_TYPES.ECONOMIC_BIAS],
    score: ratio,
    threshold: DRIFT_THRESHOLDS[DRIFT_TYPES.ECONOMIC_BIAS],
    economicDecisions,
    totalDecisions: decisions.length,
    type: DRIFT_TYPES.ECONOMIC_BIAS,
  };
}

/**
 * Detect attention collapse: too much attention on too few domains.
 */
function detectAttentionCollapse(attentionEvents) {
  if (!attentionEvents || attentionEvents.length === 0) return { detected: false, score: 0 };

  const domainAttention = {};
  for (const e of attentionEvents) {
    const domain = e.domain || "unknown";
    domainAttention[domain] = (domainAttention[domain] || 0) + (e.weight || 1);
  }

  const totalAttention = Object.values(domainAttention).reduce((s, v) => s + v, 0);
  const domainCount = Object.keys(domainAttention).length;

  if (domainCount === 0) return { detected: false, score: 0 };

  // Check if top 20% of domains consume >80% of attention (Pareto violation)
  const sorted = Object.entries(domainAttention).sort((a, b) => b[1] - a[1]);
  const top20Pct = Math.max(1, Math.ceil(domainCount * 0.2));
  const top20Attention = sorted.slice(0, top20Pct).reduce((s, [, v]) => s + v, 0);
  const concentrationRatio = totalAttention > 0 ? top20Attention / totalAttention : 0;

  return {
    detected: concentrationRatio >= DRIFT_THRESHOLDS[DRIFT_TYPES.ATTENTION_COLLAPSE],
    score: concentrationRatio,
    threshold: DRIFT_THRESHOLDS[DRIFT_TYPES.ATTENTION_COLLAPSE],
    domainCount,
    topDomains: sorted.slice(0, 5).map(([d, w]) => ({ domain: d, weight: w })),
    type: DRIFT_TYPES.ATTENTION_COLLAPSE,
  };
}

/**
 * Run all drift detectors.
 */
function runDriftScan(data = {}) {
  const results = {};

  results[DRIFT_TYPES.EPISTEMIC_MONOCULTURE] = detectEpistemicMonoculture(data.contributions || []);
  results[DRIFT_TYPES.TRANSFER_OVERUSE] = detectTransferOveruse(data.learningEvents || []);
  results[DRIFT_TYPES.ECONOMIC_BIAS] = detectEconomicBias(data.decisions || []);
  results[DRIFT_TYPES.ATTENTION_COLLAPSE] = detectAttentionCollapse(data.attentionEvents || []);

  const activeAlerts = Object.values(results).filter(r => r.detected);
  driftState.lastScanAt = new Date().toISOString();

  // Update active alerts
  for (const alert of activeAlerts) {
    driftState.activeAlerts.push({
      ...alert,
      detectedAt: new Date().toISOString(),
    });
  }

  // Cap alert history
  if (driftState.activeAlerts.length > 200) {
    driftState.activeAlerts.splice(0, driftState.activeAlerts.length - 200);
  }

  driftState.detections.push({
    ts: new Date().toISOString(),
    alertCount: activeAlerts.length,
    types: activeAlerts.map(a => a.type),
  });
  if (driftState.detections.length > 500) {
    driftState.detections.splice(0, driftState.detections.length - 500);
  }

  return { results, alertCount: activeAlerts.length, lastScanAt: driftState.lastScanAt };
}

/**
 * Generate guardrails, tests, and constraints from a failure.
 */
function generateFromFailure(failure) {
  const ts = new Date().toISOString();
  const failureType = String(failure.type || "unknown");
  const description = String(failure.description || "");

  // Generate test
  const test = {
    id: `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "regression",
    description: `Regression test for ${failureType}: ${description}`,
    assertion: `system must not exhibit ${failureType} under conditions: ${description}`,
    generatedFrom: failure,
    createdAt: ts,
  };
  driftState.tests.push(test);

  // Generate constraint
  const constraint = {
    id: `constraint_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "failure_derived",
    description: `Constraint from ${failureType} failure: prevent ${description}`,
    severity: "must",
    generatedFrom: failure,
    createdAt: ts,
  };
  driftState.constraints.push(constraint);

  // Generate guardrail
  const guardrail = {
    id: `guard_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: "automated",
    description: `Guardrail: monitor for ${failureType} and alert if conditions recur`,
    trigger: failureType,
    generatedFrom: failure,
    createdAt: ts,
  };
  driftState.guardrails.push(guardrail);

  // Cap histories
  if (driftState.tests.length > 200) driftState.tests.splice(0, driftState.tests.length - 200);
  if (driftState.constraints.length > 200) driftState.constraints.splice(0, driftState.constraints.length - 200);
  if (driftState.guardrails.length > 200) driftState.guardrails.splice(0, driftState.guardrails.length - 200);

  return { ok: true, test, constraint, guardrail };
}

/**
 * Verify acceptance criteria.
 * Returns a structured report on each criterion.
 */
function verifyAcceptanceCriteria(systemState = {}) {
  const criteria = {};

  // No negative valence optimization
  criteria.no_negative_valence_optimization = {
    pass: !systemState.hasNegativeValenceOptimization,
    details: "System must not optimize for negative valence outcomes",
  };

  // No self-legitimation paths
  criteria.no_self_legitimation_paths = {
    pass: !systemState.hasSelfLegitimation,
    details: "No path should allow system to authorize its own actions without external validation",
  };

  // All learning auditable and reversible
  criteria.all_learning_auditable_and_reversible = {
    pass: systemState.learningAuditable !== false && systemState.learningReversible !== false,
    details: "Every learning event must be logged and reversible",
  };

  // Intelligence composable, not sovereign
  criteria.intelligence_composable_not_sovereign = {
    pass: !systemState.claimsSovereignty,
    details: "Intelligence capabilities must be composable modules, not a sovereign entity",
  };

  // Failure survivable and informative
  criteria.failure_survivable_and_informative = {
    pass: systemState.failureSurvivable !== false,
    details: "System must survive failures and produce informative error reports",
  };

  // Models swappable without redesign
  criteria.models_swappable_without_redesign = {
    pass: systemState.modelsSwappable !== false,
    details: "Underlying models must be replaceable without system redesign",
  };

  const allPassed = Object.values(criteria).every(c => c.pass);

  return {
    allPassed,
    criteria,
    identity: INFRASTRUCTURE_IDENTITY,
  };
}

function init({ register, STATE, helpers: _helpers }) {
  STATE.__loaf = STATE.__loaf || {};
  STATE.__loaf.stability = {
    stats: { driftScans: 0, failuresProcessed: 0, testsGenerated: 0, acceptanceChecks: 0 },
  };

  register("loaf.stability", "status", (ctx) => {
    const s = ctx.state.__loaf.stability;
    return {
      ok: true,
      activeAlerts: driftState.activeAlerts.length,
      detections: driftState.detections.length,
      guardrails: driftState.guardrails.length,
      tests: driftState.tests.length,
      constraints: driftState.constraints.length,
      lastScanAt: driftState.lastScanAt,
      stats: s.stats,
      identity: INFRASTRUCTURE_IDENTITY,
    };
  }, { public: true });

  register("loaf.stability", "drift_scan", (ctx, input = {}) => {
    const s = ctx.state.__loaf.stability;
    s.stats.driftScans++;
    return { ok: true, ...runDriftScan(input) };
  }, { public: true });

  register("loaf.stability", "record_failure", (ctx, input = {}) => {
    const s = ctx.state.__loaf.stability;
    s.stats.failuresProcessed++;
    s.stats.testsGenerated++;
    return generateFromFailure(input);
  }, { public: false });

  register("loaf.stability", "list_alerts", (_ctx, input = {}) => {
    const limit = Math.min(Number(input.limit || 50), 200);
    return { ok: true, alerts: driftState.activeAlerts.slice(-limit) };
  }, { public: true });

  register("loaf.stability", "list_guardrails", (_ctx) => {
    return { ok: true, guardrails: driftState.guardrails };
  }, { public: true });

  register("loaf.stability", "list_tests", (_ctx) => {
    return { ok: true, tests: driftState.tests };
  }, { public: true });

  register("loaf.stability", "list_constraints", (_ctx) => {
    return { ok: true, constraints: driftState.constraints };
  }, { public: true });

  register("loaf.stability", "verify_acceptance", (ctx, input = {}) => {
    const s = ctx.state.__loaf.stability;
    s.stats.acceptanceChecks++;
    return { ok: true, ...verifyAcceptanceCriteria(input) };
  }, { public: true });

  register("loaf.stability", "identity", (_ctx) => {
    return { ok: true, identity: INFRASTRUCTURE_IDENTITY };
  }, { public: true });
}

export {
  DRIFT_TYPES,
  DRIFT_THRESHOLDS,
  INFRASTRUCTURE_IDENTITY,
  detectEpistemicMonoculture,
  detectTransferOveruse,
  detectEconomicBias,
  detectAttentionCollapse,
  runDriftScan,
  generateFromFailure,
  verifyAcceptanceCriteria,
  init,
};
