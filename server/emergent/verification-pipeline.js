/**
 * Emergent Agent Governance — Verifier Pipelines
 *
 * Stage 6: Deterministic verification pipelines.
 *
 * A deterministic pipeline that can run:
 *   - consistency checks
 *   - unit conversions / math checks
 *   - schema validations
 *   - cross-DTU contradiction scans
 *   - citation presence rules
 *
 * Still no LLM needed for the core.
 * Results are stored as evidence (via evidence.js), not as "the model said so."
 *
 * Pipeline architecture:
 *   1. Define a pipeline (ordered list of checks)
 *   2. Run it against a DTU or set of DTUs
 *   3. Each check produces a result (pass/fail/warning)
 *   4. Results are automatically attached as evidence
 */

import { getEmergentState } from "./store.js";
import { attachEvidence, EVIDENCE_TYPES } from "./evidence.js";

// ── Check Types ──────────────────────────────────────────────────────────────

export const CHECK_TYPES = Object.freeze({
  CONSISTENCY:        "consistency",        // internal field consistency
  SCHEMA:             "schema",             // structure validation
  CONTRADICTION_SCAN: "contradiction_scan", // cross-DTU conflict detection
  CITATION:           "citation",           // presence of sources/references
  COMPLETENESS:       "completeness",       // required fields present
  RANGE:              "range",              // numeric values within bounds
  FRESHNESS:          "freshness",          // data staleness check
  CROSS_REFERENCE:    "cross_reference",    // verified against other DTUs
});

export const ALL_CHECK_TYPES = Object.freeze(Object.values(CHECK_TYPES));

// ── Check Results ────────────────────────────────────────────────────────────

export const CHECK_RESULTS = Object.freeze({
  PASS:    "pass",
  FAIL:    "fail",
  WARNING: "warning",
  SKIP:    "skip",     // check not applicable
  ERROR:   "error",    // check itself failed
});

// ── Pipeline Store ───────────────────────────────────────────────────────────

/**
 * Get or initialize the verification pipeline store.
 */
export function getPipelineStore(STATE) {
  const es = getEmergentState(STATE);
  if (!es._verificationPipelines) {
    es._verificationPipelines = {
      pipelines: new Map(),       // pipelineId -> Pipeline
      runs: [],                   // PipelineRun[] (append-only)
      byDtu: new Map(),           // dtuId -> [run indices]

      metrics: {
        totalPipelines: 0,
        totalRuns: 0,
        totalChecks: 0,
        passCount: 0,
        failCount: 0,
        warningCount: 0,
      },
    };
  }
  return es._verificationPipelines;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PIPELINE DEFINITION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a verification pipeline.
 *
 * @param {Object} STATE - Global server state
 * @param {Object} opts
 * @param {string} opts.name - Pipeline name
 * @param {string} [opts.domain] - Domain this pipeline applies to
 * @param {Object[]} opts.checks - Array of check definitions
 * @param {string} opts.checks[].name - Check name
 * @param {string} opts.checks[].type - One of CHECK_TYPES
 * @param {Object} opts.checks[].config - Check-specific configuration
 * @param {string} [opts.checks[].severity] - "error" | "warning" | "info"
 * @returns {{ ok: boolean, pipeline?: Object }}
 */
export function createPipeline(STATE, opts = {}) {
  const store = getPipelineStore(STATE);

  if (!opts.name || !Array.isArray(opts.checks) || opts.checks.length === 0) {
    return { ok: false, error: "name_and_checks_required" };
  }

  for (let i = 0; i < opts.checks.length; i++) {
    const check = opts.checks[i];
    if (!check.name || !check.type) {
      return { ok: false, error: `check_${i}_missing_name_or_type` };
    }
    if (!ALL_CHECK_TYPES.includes(check.type)) {
      return { ok: false, error: `check_${i}_invalid_type`, allowed: ALL_CHECK_TYPES };
    }
  }

  const pipelineId = `vp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const pipeline = {
    pipelineId,
    name: String(opts.name).slice(0, 200),
    domain: opts.domain || "*",
    checks: opts.checks.map((c, i) => ({
      checkIndex: i,
      name: String(c.name).slice(0, 200),
      type: c.type,
      config: c.config || {},
      severity: c.severity || "warning",
      enabled: true,
    })),
    createdAt: new Date().toISOString(),
    version: 1,
  };

  store.pipelines.set(pipelineId, pipeline);
  store.metrics.totalPipelines++;

  return { ok: true, pipeline };
}

/**
 * Get a pipeline by ID.
 */
export function getPipeline(STATE, pipelineId) {
  const store = getPipelineStore(STATE);
  const pipeline = store.pipelines.get(pipelineId);
  if (!pipeline) return { ok: false, error: "not_found" };
  return { ok: true, pipeline };
}

/**
 * List all pipelines.
 */
export function listPipelines(STATE, filters = {}) {
  const store = getPipelineStore(STATE);
  let results = Array.from(store.pipelines.values());
  if (filters.domain) results = results.filter(p => p.domain === "*" || p.domain === filters.domain);
  return { ok: true, pipelines: results, count: results.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. RUNNING PIPELINES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run a verification pipeline against a DTU.
 *
 * @param {Object} STATE - Global server state
 * @param {string} pipelineId - Pipeline to run
 * @param {string} dtuId - DTU to verify
 * @param {Object} [opts]
 * @param {boolean} [opts.attachEvidence=true] - Whether to attach results as evidence
 * @returns {{ ok: boolean, run?: Object }}
 */
export function runPipeline(STATE, pipelineId, dtuId, opts = {}) {
  const store = getPipelineStore(STATE);
  const pipeline = store.pipelines.get(pipelineId);
  if (!pipeline) return { ok: false, error: "pipeline_not_found" };

  const dtu = STATE.dtus?.get(dtuId);
  if (!dtu) return { ok: false, error: "dtu_not_found" };

  const attachEv = opts.attachEvidence !== false;

  const results = [];
  let passCount = 0;
  let failCount = 0;
  let warningCount = 0;

  for (const check of pipeline.checks) {
    if (!check.enabled) {
      results.push({ ...check, result: CHECK_RESULTS.SKIP, message: "disabled" });
      continue;
    }

    const result = executeCheck(STATE, check, dtu);
    results.push({ ...check, ...result });

    if (result.result === CHECK_RESULTS.PASS) passCount++;
    else if (result.result === CHECK_RESULTS.FAIL) failCount++;
    else if (result.result === CHECK_RESULTS.WARNING) warningCount++;
  }

  const overallResult = failCount > 0 ? CHECK_RESULTS.FAIL
                      : warningCount > 0 ? CHECK_RESULTS.WARNING
                      : CHECK_RESULTS.PASS;

  const run = {
    runId: `vr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    pipelineId,
    pipelineName: pipeline.name,
    dtuId,
    results,
    summary: {
      total: results.length,
      pass: passCount,
      fail: failCount,
      warning: warningCount,
      overallResult,
    },
    timestamp: new Date().toISOString(),
  };

  // Store the run
  const runIndex = store.runs.length;
  store.runs.push(run);

  if (!store.byDtu.has(dtuId)) store.byDtu.set(dtuId, []);
  store.byDtu.get(dtuId).push(runIndex);

  // Update metrics
  store.metrics.totalRuns++;
  store.metrics.totalChecks += results.length;
  store.metrics.passCount += passCount;
  store.metrics.failCount += failCount;
  store.metrics.warningCount += warningCount;

  // Attach results as evidence
  if (attachEv) {
    attachEvidence(STATE, {
      dtuId,
      type: EVIDENCE_TYPES.TEST_RESULT,
      summary: `Verification pipeline "${pipeline.name}": ${overallResult} (${passCount}/${results.length} passed)`,
      direction: overallResult === CHECK_RESULTS.PASS ? "supports" : overallResult === CHECK_RESULTS.FAIL ? "refutes" : "neutral",
      data: {
        result: overallResult,
        pipelineId,
        runId: run.runId,
        pass: passCount,
        fail: failCount,
        warning: warningCount,
      },
      strength: passCount / Math.max(1, results.length),
      sourceId: `pipeline:${pipelineId}`,
    });
  }

  // Cap run history
  if (store.runs.length > 5000) {
    store.runs = store.runs.slice(-2500);
    rebuildRunIndex(store);
  }

  return { ok: true, run };
}

/**
 * Run all applicable pipelines against a DTU.
 *
 * @param {Object} STATE - Global server state
 * @param {string} dtuId - DTU to verify
 * @param {Object} [opts] - { domain }
 * @returns {{ ok: boolean, runs: Object[] }}
 */
export function verifyDtu(STATE, dtuId, opts = {}) {
  const store = getPipelineStore(STATE);
  const dtu = STATE.dtus?.get(dtuId);
  if (!dtu) return { ok: false, error: "dtu_not_found" };

  const domain = opts.domain || (dtu.tags?.[0]) || "*";
  const runs = [];

  for (const pipeline of store.pipelines.values()) {
    if (pipeline.domain !== "*" && pipeline.domain !== domain) continue;

    const result = runPipeline(STATE, pipeline.pipelineId, dtuId, opts);
    if (result.ok) runs.push(result.run);
  }

  return { ok: true, runs, count: runs.length };
}

/**
 * Get verification history for a DTU.
 */
export function getVerificationHistory(STATE, dtuId) {
  const store = getPipelineStore(STATE);
  const indices = store.byDtu.get(dtuId) || [];
  const runs = indices.map(i => store.runs[i]).filter(Boolean);
  return { ok: true, runs, count: runs.length };
}

/**
 * Get verification pipeline metrics.
 */
export function getVerificationMetrics(STATE) {
  const store = getPipelineStore(STATE);
  return { ok: true, metrics: { ...store.metrics } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CHECK IMPLEMENTATIONS (deterministic, no LLM)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Execute a single check against a DTU.
 */
function executeCheck(STATE, check, dtu) {
  try {
    switch (check.type) {
      case CHECK_TYPES.CONSISTENCY:
        return checkConsistency(dtu, check.config);
      case CHECK_TYPES.SCHEMA:
        return checkSchema(dtu, check.config);
      case CHECK_TYPES.CONTRADICTION_SCAN:
        return checkContradictions(STATE, dtu, check.config);
      case CHECK_TYPES.CITATION:
        return checkCitations(dtu, check.config);
      case CHECK_TYPES.COMPLETENESS:
        return checkCompleteness(dtu, check.config);
      case CHECK_TYPES.RANGE:
        return checkRange(dtu, check.config);
      case CHECK_TYPES.FRESHNESS:
        return checkFreshness(dtu, check.config);
      case CHECK_TYPES.CROSS_REFERENCE:
        return checkCrossReference(STATE, dtu, check.config);
      default:
        return { result: CHECK_RESULTS.SKIP, message: `unknown check type: ${check.type}` };
    }
  } catch (err) {
    return { result: CHECK_RESULTS.ERROR, message: err.message };
  }
}

/**
 * Consistency check: ensure internal fields don't contradict each other.
 */
function checkConsistency(dtu, config) {
  const issues = [];

  // resonance, coherence, stability should be in [0, 1]
  for (const field of ["resonance", "coherence", "stability"]) {
    const val = dtu[field];
    if (val !== undefined && (typeof val !== "number" || val < 0 || val > 1)) {
      issues.push(`${field} out of range: ${val}`);
    }
  }

  // title should exist and be non-empty
  if (!dtu.title || dtu.title.trim().length === 0) {
    issues.push("title is empty");
  }

  // content should exist for non-shadow DTUs
  if (dtu.tier !== "shadow" && (!dtu.content || dtu.content.trim().length === 0)) {
    issues.push("content is empty for non-shadow DTU");
  }

  // timestamp should be valid
  if (dtu.timestamp && isNaN(Date.parse(dtu.timestamp))) {
    issues.push("invalid timestamp");
  }

  return issues.length === 0
    ? { result: CHECK_RESULTS.PASS, message: "all consistency checks passed" }
    : { result: CHECK_RESULTS.FAIL, message: issues.join("; "), details: issues };
}

/**
 * Schema check: ensure DTU matches expected structure.
 */
function checkSchema(dtu, config) {
  const requiredFields = config.requiredFields || ["id", "title", "content", "tier"];
  const missing = requiredFields.filter(f => dtu[f] === undefined || dtu[f] === null);

  if (missing.length > 0) {
    return { result: CHECK_RESULTS.FAIL, message: `missing required fields: ${missing.join(", ")}`, details: missing };
  }

  // Type checks
  const typeIssues = [];
  if (config.typeChecks) {
    for (const [field, expectedType] of Object.entries(config.typeChecks)) {
      if (dtu[field] !== undefined && typeof dtu[field] !== expectedType) {
        typeIssues.push(`${field}: expected ${expectedType}, got ${typeof dtu[field]}`);
      }
    }
  }

  if (typeIssues.length > 0) {
    return { result: CHECK_RESULTS.WARNING, message: typeIssues.join("; "), details: typeIssues };
  }

  return { result: CHECK_RESULTS.PASS, message: "schema valid" };
}

/**
 * Contradiction scan: check if this DTU contradicts others.
 */
function checkContradictions(STATE, dtu, config) {
  const es = getEmergentState(STATE);
  const edgeStore = es._edges;

  if (!edgeStore) {
    return { result: CHECK_RESULTS.SKIP, message: "edge store not initialized" };
  }

  // Look for "contradicts" edges pointing at or from this DTU
  const contradictions = [];

  const targetEdges = edgeStore.byTarget?.get(dtu.id);
  if (targetEdges) {
    for (const eid of targetEdges) {
      const edge = edgeStore.edges?.get(eid);
      if (edge && edge.edgeType === "contradicts") {
        contradictions.push({ edgeId: eid, source: edge.sourceId, type: "incoming" });
      }
    }
  }

  const sourceEdges = edgeStore.bySource?.get(dtu.id);
  if (sourceEdges) {
    for (const eid of sourceEdges) {
      const edge = edgeStore.edges?.get(eid);
      if (edge && edge.edgeType === "contradicts") {
        contradictions.push({ edgeId: eid, target: edge.targetId, type: "outgoing" });
      }
    }
  }

  if (contradictions.length > 0) {
    return {
      result: CHECK_RESULTS.FAIL,
      message: `${contradictions.length} contradiction(s) found`,
      details: contradictions,
    };
  }

  return { result: CHECK_RESULTS.PASS, message: "no contradictions found" };
}

/**
 * Citation check: ensure claims have sources.
 */
function checkCitations(dtu, config) {
  const content = dtu.content || "";
  const meta = dtu.meta || {};

  // Check for explicit citations in meta
  const hasCitations = meta.sources || meta.citations || meta.references;

  // Check for URL patterns in content
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls = content.match(urlPattern) || [];

  // Check for citation-like patterns
  const citationPattern = /\[\d+\]|\((?:et al\.|ibid\.|see |cf\. )/gi;
  const citations = content.match(citationPattern) || [];

  const minCitations = config.minCitations || 0;
  const totalEvidence = (hasCitations ? 1 : 0) + urls.length + citations.length;

  if (minCitations > 0 && totalEvidence < minCitations) {
    return {
      result: CHECK_RESULTS.WARNING,
      message: `insufficient citations: found ${totalEvidence}, expected at least ${minCitations}`,
      details: { urls: urls.length, citations: citations.length, hasMeta: !!hasCitations },
    };
  }

  return {
    result: CHECK_RESULTS.PASS,
    message: `${totalEvidence} citation(s) found`,
    details: { urls: urls.length, citations: citations.length, hasMeta: !!hasCitations },
  };
}

/**
 * Completeness check: ensure all expected fields are filled.
 */
function checkCompleteness(dtu, config) {
  const expected = config.expectedFields || ["title", "content", "summary", "tags"];
  const incomplete = [];

  for (const field of expected) {
    const val = dtu[field];
    if (val === undefined || val === null) {
      incomplete.push(`${field}: missing`);
    } else if (typeof val === "string" && val.trim().length === 0) {
      incomplete.push(`${field}: empty`);
    } else if (Array.isArray(val) && val.length === 0) {
      incomplete.push(`${field}: empty array`);
    }
  }

  if (incomplete.length > 0) {
    return { result: CHECK_RESULTS.WARNING, message: incomplete.join("; "), details: incomplete };
  }
  return { result: CHECK_RESULTS.PASS, message: "all expected fields present" };
}

/**
 * Range check: ensure numeric fields are within expected bounds.
 */
function checkRange(dtu, config) {
  const ranges = config.ranges || {
    resonance: { min: 0, max: 1 },
    coherence: { min: 0, max: 1 },
    stability: { min: 0, max: 1 },
  };

  const violations = [];
  for (const [field, bounds] of Object.entries(ranges)) {
    const val = dtu[field];
    if (val === undefined) continue;
    if (typeof val !== "number") {
      violations.push(`${field}: not a number (${typeof val})`);
      continue;
    }
    if (bounds.min !== undefined && val < bounds.min) {
      violations.push(`${field}: ${val} < min ${bounds.min}`);
    }
    if (bounds.max !== undefined && val > bounds.max) {
      violations.push(`${field}: ${val} > max ${bounds.max}`);
    }
  }

  if (violations.length > 0) {
    return { result: CHECK_RESULTS.FAIL, message: violations.join("; "), details: violations };
  }
  return { result: CHECK_RESULTS.PASS, message: "all values within range" };
}

/**
 * Freshness check: ensure DTU is not stale.
 */
function checkFreshness(dtu, config) {
  const maxAgeMs = config.maxAgeMs || 30 * 24 * 3600 * 1000; // default 30 days
  const timestamp = dtu.updatedAt || dtu.timestamp;
  if (!timestamp) {
    return { result: CHECK_RESULTS.WARNING, message: "no timestamp available" };
  }

  const age = Date.now() - new Date(timestamp).getTime();
  if (age > maxAgeMs) {
    const ageDays = Math.round(age / (24 * 3600 * 1000));
    return { result: CHECK_RESULTS.WARNING, message: `DTU is ${ageDays} days old (limit: ${Math.round(maxAgeMs / (24 * 3600 * 1000))})` };
  }

  return { result: CHECK_RESULTS.PASS, message: "DTU is fresh" };
}

/**
 * Cross-reference check: verify DTU claims against related DTUs.
 */
function checkCrossReference(STATE, dtu, config) {
  // Check if the DTU has supporting edges from other DTUs
  const es = getEmergentState(STATE);
  const edgeStore = es._edges;

  if (!edgeStore) {
    return { result: CHECK_RESULTS.SKIP, message: "edge store not initialized" };
  }

  const targetEdges = edgeStore.byTarget?.get(dtu.id);
  if (!targetEdges || targetEdges.size === 0) {
    return { result: CHECK_RESULTS.WARNING, message: "no cross-references found" };
  }

  let supportCount = 0;
  for (const eid of targetEdges) {
    const edge = edgeStore.edges?.get(eid);
    if (edge && edge.edgeType === "supports") supportCount++;
  }

  const minSupports = config.minSupports || 1;
  if (supportCount < minSupports) {
    return {
      result: CHECK_RESULTS.WARNING,
      message: `only ${supportCount} supporting reference(s), expected at least ${minSupports}`,
    };
  }

  return { result: CHECK_RESULTS.PASS, message: `${supportCount} supporting reference(s)` };
}

/**
 * Rebuild the byDtu index after compaction.
 */
function rebuildRunIndex(store) {
  store.byDtu.clear();
  for (let i = 0; i < store.runs.length; i++) {
    const run = store.runs[i];
    if (!store.byDtu.has(run.dtuId)) store.byDtu.set(run.dtuId, []);
    store.byDtu.get(run.dtuId).push(i);
  }
}
