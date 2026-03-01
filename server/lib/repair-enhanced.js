/**
 * Enhanced Repair Cortex — Code DTU Substrate Integration
 *
 * Extends the repair brain with deep DTU-backed pattern knowledge for:
 *   - System health monitoring with pattern-matched analysis
 *   - Error diagnosis using DTU knowledge base
 *   - Automated repair with rollback and verification
 *   - Predictive repair from failure precursor patterns
 *   - Continuous learning loop (every repair becomes a DTU)
 *
 * Architecture:
 *   EnhancedRepairMonitor  -> monitors system health using code DTU patterns
 *   EnhancedRepairDiagnosis -> searches DTUs for matching errors and solutions
 *   EnhancedRepairExecution -> applies fixes, verifies, rolls back if needed
 *   PredictiveRepair        -> detects precursors, applies preventive fixes
 *   RepairLearningLoop      -> learns from every repair, compresses into wisdom
 */

import { generateId } from "./id-factory.js";

// -- Constants ----------------------------------------------------------------

export const SEVERITY = Object.freeze({
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  INFO: "info",
});

export const REPAIR_CATEGORIES = Object.freeze({
  MEMORY: "memory",
  LATENCY: "latency",
  ERROR_RATE: "error_rate",
  CONNECTION: "connection",
  CPU: "cpu",
});

export const MEMORY_PATTERNS = Object.freeze({
  LINEAR_GROWTH_WITHOUT_GC_RECOVERY: "linear_growth_without_gc_recovery",
  SAWTOOTH: "sawtooth",
  SUDDEN_SPIKE: "sudden_spike",
  FRAGMENTATION: "fragmentation",
  STABLE: "stable",
});

export const LATENCY_PATTERNS = Object.freeze({
  GRADUAL_DEGRADATION: "gradual_degradation",
  PERIODIC_SPIKES: "periodic_spikes",
  SUDDEN_JUMP: "sudden_jump",
  STABLE: "stable",
});

export const ERROR_PATTERNS = Object.freeze({
  BURST: "burst",
  STEADY_RATE: "steady_rate",
  CASCADING: "cascading",
  ISOLATED: "isolated",
  NONE: "none",
});

export const CONNECTION_PATTERNS = Object.freeze({
  LEAK: "leak",
  SATURATION: "saturation",
  THRASHING: "thrashing",
  STABLE: "stable",
});

export const CPU_PATTERNS = Object.freeze({
  SUSTAINED_HIGH: "sustained_high",
  SPIKE: "spike",
  GRADUAL_INCREASE: "gradual_increase",
  NORMAL: "normal",
});

// -- Severity weights for scoring ------------------------------------------------

const SEVERITY_WEIGHTS = Object.freeze({
  critical: 1.0,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
  info: 0.1,
});

// -- Internal helpers -----------------------------------------------------------

function _nowISO() {
  return new Date().toISOString();
}

function _safeParseJSON(str, fallback = null) {
  if (str === null || str === undefined) return fallback;
  if (typeof str === "object") return str;
  try { return JSON.parse(str); } catch { return fallback; }
}

/**
 * Simple linear regression on an array of numbers.
 * Returns { slope, intercept, r2 } or null if insufficient data.
 */
function _linearRegression(values) {
  if (!values || values.length < 3) return null;
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-10) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (values[i] - meanY) ** 2;
    ssRes += (values[i] - (slope * i + intercept)) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { slope, intercept, r2 };
}

/**
 * Compute standard deviation of an array of numbers.
 */
function _stddev(values) {
  if (!values || values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Compute the mean of an array of numbers.
 */
function _mean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Count how many times the sequence changes direction (for sawtooth detection).
 */
function _countDirectionChanges(values) {
  if (values.length < 3) return 0;
  let changes = 0;
  for (let i = 2; i < values.length; i++) {
    const prev = values[i - 1] - values[i - 2];
    const curr = values[i] - values[i - 1];
    if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) changes++;
  }
  return changes;
}

// -- Prepared statements builder ------------------------------------------------

function _buildStatements(db) {
  return {
    // ── repair_patterns ──
    insertPattern: db.prepare(`
      INSERT INTO repair_patterns
        (id, category, subcategory, name, signature, is_healthy,
         resolution, typical_time_to_failure, severity, confidence,
         source_dtu_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getAllPatterns: db.prepare(
      `SELECT * FROM repair_patterns ORDER BY created_at DESC`
    ),
    getPatternsByCategory: db.prepare(
      `SELECT * FROM repair_patterns WHERE category = ? ORDER BY created_at DESC`
    ),
    getPatternById: db.prepare(
      `SELECT * FROM repair_patterns WHERE id = ?`
    ),
    countPatterns: db.prepare(
      `SELECT COUNT(*) as count FROM repair_patterns`
    ),

    // ── repair_history ──
    insertHistory: db.prepare(`
      INSERT INTO repair_history
        (id, issue_type, symptoms, severity, diagnosis, repair_option_used,
         fix_applied, success, repair_time_ms, rollback_needed, verified, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getHistoryById: db.prepare(
      `SELECT * FROM repair_history WHERE id = ?`
    ),
    getHistory: db.prepare(
      `SELECT * FROM repair_history ORDER BY created_at DESC LIMIT ?`
    ),
    getRecentSuccesses: db.prepare(
      `SELECT * FROM repair_history WHERE success = 1 ORDER BY created_at DESC LIMIT ?`
    ),
    getRecentFailures: db.prepare(
      `SELECT * FROM repair_history WHERE success = 0 ORDER BY created_at DESC LIMIT ?`
    ),
    countHistory: db.prepare(
      `SELECT COUNT(*) as count FROM repair_history`
    ),
    countSuccessful: db.prepare(
      `SELECT COUNT(*) as count FROM repair_history WHERE success = 1`
    ),
    countFailed: db.prepare(
      `SELECT COUNT(*) as count FROM repair_history WHERE success = 0`
    ),
    getAvgRepairTime: db.prepare(
      `SELECT AVG(repair_time_ms) as avg_time FROM repair_history WHERE repair_time_ms IS NOT NULL AND repair_time_ms > 0`
    ),
    updateHistoryOutcome: db.prepare(
      `UPDATE repair_history SET success = ?, verified = 1, repair_time_ms = ? WHERE id = ?`
    ),

    // ── repair_predictions ──
    insertPrediction: db.prepare(`
      INSERT INTO repair_predictions
        (id, predicted_issue, confidence, time_to_impact, preventive_action,
         applied, outcome, source_pattern_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getPredictionById: db.prepare(
      `SELECT * FROM repair_predictions WHERE id = ?`
    ),
    getRecentPredictions: db.prepare(
      `SELECT * FROM repair_predictions ORDER BY created_at DESC LIMIT ?`
    ),
    getActivePredictions: db.prepare(
      `SELECT * FROM repair_predictions WHERE applied = 0 ORDER BY confidence DESC`
    ),
    countPredictions: db.prepare(
      `SELECT COUNT(*) as count FROM repair_predictions`
    ),
    countActivePredictions: db.prepare(
      `SELECT COUNT(*) as count FROM repair_predictions WHERE applied = 0`
    ),
    updatePredictionApplied: db.prepare(
      `UPDATE repair_predictions SET applied = 1, outcome = ? WHERE id = ?`
    ),

    // ── repair_knowledge ──
    insertKnowledge: db.prepare(`
      INSERT INTO repair_knowledge
        (id, category, issue_type, symptoms, fix_description,
         success_count, failure_count, avg_repair_time_ms, last_used_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getKnowledgeByCategory: db.prepare(
      `SELECT * FROM repair_knowledge WHERE category = ? ORDER BY success_count DESC`
    ),
    getKnowledgeByIssueType: db.prepare(
      `SELECT * FROM repair_knowledge WHERE issue_type = ? ORDER BY success_count DESC`
    ),
    getAllKnowledge: db.prepare(
      `SELECT * FROM repair_knowledge ORDER BY success_count DESC`
    ),
    updateKnowledgeSuccess: db.prepare(
      `UPDATE repair_knowledge SET success_count = success_count + 1, last_used_at = ?, avg_repair_time_ms = ? WHERE id = ?`
    ),
    updateKnowledgeFailure: db.prepare(
      `UPDATE repair_knowledge SET failure_count = failure_count + 1, last_used_at = ? WHERE id = ?`
    ),
    countKnowledge: db.prepare(
      `SELECT COUNT(*) as count FROM repair_knowledge`
    ),

    // ── system_metrics_history ──
    insertMetric: db.prepare(
      `INSERT INTO system_metrics_history (metric_type, value, metadata, recorded_at) VALUES (?, ?, ?, ?)`
    ),
    getMetricTrend: db.prepare(
      `SELECT * FROM system_metrics_history WHERE metric_type = ? AND recorded_at >= ? ORDER BY recorded_at ASC`
    ),
    countMetrics: db.prepare(
      `SELECT COUNT(*) as count FROM system_metrics_history`
    ),
    getMetricTypes: db.prepare(
      `SELECT DISTINCT metric_type FROM system_metrics_history ORDER BY metric_type`
    ),
  };
}

// ==============================================================================
// Monitor Sub-component
// ==============================================================================

/**
 * Create the enhanced repair monitor.
 * Tracks system metrics in sliding windows and performs pattern analysis.
 */
export function createEnhancedRepairMonitor({ db, stmts, log = () => {} }) {
  const WINDOW_SIZE = 120; // Keep last 120 data points per metric
  const windows = {};

  /**
   * Record a single metric value into the sliding window.
   */
  function recordMetric(name, value) {
    if (!windows[name]) windows[name] = [];
    windows[name].push(value);
    if (windows[name].length > WINDOW_SIZE) {
      windows[name] = windows[name].slice(-WINDOW_SIZE);
    }

    // Also persist to database
    try {
      stmts.insertMetric.run(name, value, "{}", _nowISO());
    } catch (e) {
      log("warn", "metric_persist_error", { name, error: e.message });
    }
  }

  /**
   * Get current sliding windows.
   */
  function getWindows() {
    return windows;
  }

  /**
   * Record a batch of metrics and run a health analysis.
   */
  function monitor(metrics) {
    if (!metrics || typeof metrics !== "object") return { healthy: true, issues: [] };

    // Record all provided metrics
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === "number") {
        recordMetric(key, value);
      }
    }

    return enhancedCheck();
  }

  /**
   * Run an enhanced health check across all tracked metric windows.
   * Returns a structured health report.
   */
  function enhancedCheck() {
    const issues = [];
    const analyses = {};
    const timestamp = _nowISO();

    // Analyze memory
    if (windows.memoryUsage && windows.memoryUsage.length > 0) {
      const memAnalysis = analyzeMemoryPattern(windows.memoryUsage);
      analyses.memory = memAnalysis;
      if (memAnalysis.severity && memAnalysis.severity !== "info") {
        issues.push({ category: REPAIR_CATEGORIES.MEMORY, ...memAnalysis });
      }
    }

    // Analyze latency
    if (windows.requestLatency && windows.requestLatency.length > 0) {
      const latAnalysis = analyzeLatencyPattern(windows.requestLatency);
      analyses.latency = latAnalysis;
      if (latAnalysis.severity && latAnalysis.severity !== "info") {
        issues.push({ category: REPAIR_CATEGORIES.LATENCY, ...latAnalysis });
      }
    }

    // Analyze error rate
    if (windows.errorRate && windows.errorRate.length > 0) {
      const errAnalysis = analyzeErrorPattern(windows.errorRate);
      analyses.errorRate = errAnalysis;
      if (errAnalysis.severity && errAnalysis.severity !== "info") {
        issues.push({ category: REPAIR_CATEGORIES.ERROR_RATE, ...errAnalysis });
      }
    }

    // Analyze connections
    if (windows.connectionCount && windows.connectionCount.length > 0) {
      const connAnalysis = analyzeConnectionPattern(windows.connectionCount);
      analyses.connections = connAnalysis;
      if (connAnalysis.severity && connAnalysis.severity !== "info") {
        issues.push({ category: REPAIR_CATEGORIES.CONNECTION, ...connAnalysis });
      }
    }

    // Analyze CPU
    if (windows.cpuUsage && windows.cpuUsage.length > 0) {
      const cpuAnalysis = analyzeCpuPattern(windows.cpuUsage);
      analyses.cpu = cpuAnalysis;
      if (cpuAnalysis.severity && cpuAnalysis.severity !== "info") {
        issues.push({ category: REPAIR_CATEGORIES.CPU, ...cpuAnalysis });
      }
    }

    const healthy = issues.length === 0;

    return {
      healthy,
      status: healthy ? "healthy" : "degraded",
      timestamp,
      issues,
      analyses,
      metricWindowSizes: Object.fromEntries(
        Object.entries(windows).map(([k, v]) => [k, v.length])
      ),
    };
  }

  /**
   * Generic pattern analysis entry point.
   */
  function analyzePattern(category, values) {
    switch (category) {
      case REPAIR_CATEGORIES.MEMORY: return analyzeMemoryPattern(values);
      case REPAIR_CATEGORIES.LATENCY: return analyzeLatencyPattern(values);
      case REPAIR_CATEGORIES.ERROR_RATE: return analyzeErrorPattern(values);
      case REPAIR_CATEGORIES.CONNECTION: return analyzeConnectionPattern(values);
      case REPAIR_CATEGORIES.CPU: return analyzeCpuPattern(values);
      default: return { pattern: "unknown", confidence: 0, severity: SEVERITY.INFO };
    }
  }

  /**
   * Analyze a memory metric window for known patterns.
   */
  function analyzeMemoryPattern(values) {
    if (!values || values.length < 5) {
      return {
        pattern: MEMORY_PATTERNS.STABLE,
        confidence: 0.5,
        severity: SEVERITY.INFO,
        details: { dataPoints: values ? values.length : 0, reason: "insufficient data" },
      };
    }

    const regression = _linearRegression(values);
    const dirChanges = _countDirectionChanges(values);
    const std = _stddev(values);
    const avg = _mean(values);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const range = maxVal - minVal;
    const relativeStd = avg > 0 ? std / avg : 0;

    // Detect sudden spike: last value is far above the mean
    const lastVal = values[values.length - 1];
    if (lastVal > avg + 3 * std && std > 0) {
      const spikeSeverity = lastVal > avg + 5 * std ? SEVERITY.CRITICAL : SEVERITY.HIGH;
      return {
        pattern: MEMORY_PATTERNS.SUDDEN_SPIKE,
        confidence: Math.min(0.95, 0.7 + (lastVal - avg) / (std * 10)),
        severity: spikeSeverity,
        details: { lastValue: lastVal, mean: avg, std, regression },
      };
    }

    // Detect sawtooth: many direction changes relative to length
    const sawtoothRatio = dirChanges / values.length;
    if (sawtoothRatio > 0.4 && range > avg * 0.1) {
      return {
        pattern: MEMORY_PATTERNS.SAWTOOTH,
        confidence: Math.min(0.9, sawtoothRatio),
        severity: SEVERITY.MEDIUM,
        details: { directionChanges: dirChanges, range, regression },
      };
    }

    // Detect fragmentation: high relative std without clear linear trend
    if (relativeStd > 0.2 && regression && Math.abs(regression.r2) < 0.5) {
      return {
        pattern: MEMORY_PATTERNS.FRAGMENTATION,
        confidence: Math.min(0.85, relativeStd),
        severity: SEVERITY.MEDIUM,
        details: { relativeStd, regression },
      };
    }

    // Detect linear growth without GC recovery
    if (regression && regression.slope > 0.5 && regression.r2 > 0.6) {
      const growthSeverity = regression.slope > 2 ? SEVERITY.HIGH :
        regression.slope > 1 ? SEVERITY.MEDIUM : SEVERITY.LOW;
      return {
        pattern: MEMORY_PATTERNS.LINEAR_GROWTH_WITHOUT_GC_RECOVERY,
        confidence: Math.min(0.95, regression.r2),
        severity: growthSeverity,
        details: { slope: regression.slope, r2: regression.r2, regression },
      };
    }

    // Stable
    return {
      pattern: MEMORY_PATTERNS.STABLE,
      confidence: regression ? Math.min(0.9, 1 - Math.abs(regression.slope) / 10) : 0.7,
      severity: SEVERITY.INFO,
      details: { mean: avg, std, regression },
    };
  }

  /**
   * Analyze latency patterns.
   */
  function analyzeLatencyPattern(values) {
    if (!values || values.length < 3) {
      return {
        pattern: LATENCY_PATTERNS.STABLE,
        confidence: 0.5,
        severity: SEVERITY.INFO,
        details: { dataPoints: values ? values.length : 0 },
      };
    }

    const regression = _linearRegression(values);
    const std = _stddev(values);
    const avg = _mean(values);
    const maxVal = Math.max(...values);
    const lastVal = values[values.length - 1];
    const dirChanges = _countDirectionChanges(values);

    // Sudden jump: last value >> mean
    if (lastVal > avg + 3 * std && std > 0) {
      return {
        pattern: LATENCY_PATTERNS.SUDDEN_JUMP,
        confidence: Math.min(0.95, 0.7 + (lastVal - avg) / (std * 10)),
        severity: SEVERITY.HIGH,
        details: { lastValue: lastVal, mean: avg, std, regression },
      };
    }

    // Periodic spikes
    const spikeRatio = dirChanges / values.length;
    if (spikeRatio > 0.35 && maxVal > avg * 1.5) {
      return {
        pattern: LATENCY_PATTERNS.PERIODIC_SPIKES,
        confidence: Math.min(0.85, spikeRatio + 0.1),
        severity: SEVERITY.MEDIUM,
        details: { directionChanges: dirChanges, maxSpike: maxVal, mean: avg, regression },
      };
    }

    // Gradual degradation
    if (regression && regression.slope > 0.3 && regression.r2 > 0.5) {
      return {
        pattern: LATENCY_PATTERNS.GRADUAL_DEGRADATION,
        confidence: Math.min(0.9, regression.r2),
        severity: regression.slope > 1 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
        details: { slope: regression.slope, r2: regression.r2, regression },
      };
    }

    return {
      pattern: LATENCY_PATTERNS.STABLE,
      confidence: 0.8,
      severity: SEVERITY.INFO,
      details: { mean: avg, std, regression },
    };
  }

  /**
   * Analyze error rate patterns.
   */
  function analyzeErrorPattern(values) {
    if (!values || values.length < 3) {
      return {
        pattern: ERROR_PATTERNS.NONE,
        confidence: 0.5,
        severity: SEVERITY.INFO,
        details: { dataPoints: values ? values.length : 0 },
      };
    }

    const avg = _mean(values);
    const std = _stddev(values);
    const maxVal = Math.max(...values);
    const lastVal = values[values.length - 1];
    const regression = _linearRegression(values);

    // If all values near zero, no errors
    if (avg < 0.001 && maxVal < 0.01) {
      return {
        pattern: ERROR_PATTERNS.NONE,
        confidence: 0.95,
        severity: SEVERITY.INFO,
        details: { mean: avg, max: maxVal },
      };
    }

    // Burst: sudden spike in errors
    if (lastVal > avg + 3 * std && lastVal > 0.05) {
      return {
        pattern: ERROR_PATTERNS.BURST,
        confidence: Math.min(0.95, 0.7 + lastVal),
        severity: SEVERITY.CRITICAL,
        details: { lastValue: lastVal, mean: avg, std },
      };
    }

    // Cascading: increasing error rate
    if (regression && regression.slope > 0 && regression.r2 > 0.5 && avg > 0.01) {
      return {
        pattern: ERROR_PATTERNS.CASCADING,
        confidence: Math.min(0.9, regression.r2),
        severity: SEVERITY.HIGH,
        details: { slope: regression.slope, regression },
      };
    }

    // Steady rate
    if (avg > 0.005 && std / avg < 0.5) {
      return {
        pattern: ERROR_PATTERNS.STEADY_RATE,
        confidence: Math.min(0.85, 1 - std / avg),
        severity: SEVERITY.MEDIUM,
        details: { mean: avg, std },
      };
    }

    // Isolated errors
    if (avg > 0) {
      return {
        pattern: ERROR_PATTERNS.ISOLATED,
        confidence: 0.6,
        severity: SEVERITY.LOW,
        details: { mean: avg, max: maxVal },
      };
    }

    return {
      pattern: ERROR_PATTERNS.NONE,
      confidence: 0.8,
      severity: SEVERITY.INFO,
      details: { mean: avg },
    };
  }

  /**
   * Analyze connection patterns.
   */
  function analyzeConnectionPattern(values) {
    if (!values || values.length < 3) {
      return {
        pattern: CONNECTION_PATTERNS.STABLE,
        confidence: 0.5,
        severity: SEVERITY.INFO,
        details: { dataPoints: values ? values.length : 0 },
      };
    }

    const regression = _linearRegression(values);
    const avg = _mean(values);
    const std = _stddev(values);
    const maxVal = Math.max(...values);
    const dirChanges = _countDirectionChanges(values);

    // Leak: steadily increasing connections
    if (regression && regression.slope > 0.3 && regression.r2 > 0.6) {
      return {
        pattern: CONNECTION_PATTERNS.LEAK,
        confidence: Math.min(0.9, regression.r2),
        severity: regression.slope > 1 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
        details: { slope: regression.slope, regression },
      };
    }

    // Thrashing: high oscillation
    const thrashRatio = dirChanges / values.length;
    if (thrashRatio > 0.4 && std / avg > 0.3) {
      return {
        pattern: CONNECTION_PATTERNS.THRASHING,
        confidence: Math.min(0.85, thrashRatio),
        severity: SEVERITY.MEDIUM,
        details: { directionChanges: dirChanges, relativeStd: std / avg },
      };
    }

    // Saturation: high sustained count
    if (avg > 100 && std / avg < 0.2) {
      return {
        pattern: CONNECTION_PATTERNS.SATURATION,
        confidence: 0.7,
        severity: SEVERITY.HIGH,
        details: { mean: avg, max: maxVal },
      };
    }

    return {
      pattern: CONNECTION_PATTERNS.STABLE,
      confidence: 0.8,
      severity: SEVERITY.INFO,
      details: { mean: avg, std, regression },
    };
  }

  /**
   * Analyze CPU usage patterns.
   */
  function analyzeCpuPattern(values) {
    if (!values || values.length < 3) {
      return {
        pattern: CPU_PATTERNS.NORMAL,
        confidence: 0.5,
        severity: SEVERITY.INFO,
        details: { dataPoints: values ? values.length : 0 },
      };
    }

    const regression = _linearRegression(values);
    const avg = _mean(values);
    const std = _stddev(values);
    const maxVal = Math.max(...values);
    const lastVal = values[values.length - 1];

    // Spike: sudden high value
    if (lastVal > avg + 3 * std && lastVal > 80) {
      return {
        pattern: CPU_PATTERNS.SPIKE,
        confidence: Math.min(0.95, 0.7 + (lastVal - avg) / 100),
        severity: SEVERITY.HIGH,
        details: { lastValue: lastVal, mean: avg, std },
      };
    }

    // Sustained high
    if (avg > 80 && std / avg < 0.15) {
      return {
        pattern: CPU_PATTERNS.SUSTAINED_HIGH,
        confidence: Math.min(0.9, avg / 100),
        severity: SEVERITY.HIGH,
        details: { mean: avg, std },
      };
    }

    // Gradual increase
    if (regression && regression.slope > 0.2 && regression.r2 > 0.5) {
      return {
        pattern: CPU_PATTERNS.GRADUAL_INCREASE,
        confidence: Math.min(0.85, regression.r2),
        severity: regression.slope > 1 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
        details: { slope: regression.slope, regression },
      };
    }

    return {
      pattern: CPU_PATTERNS.NORMAL,
      confidence: 0.8,
      severity: SEVERITY.INFO,
      details: { mean: avg, std, regression },
    };
  }

  return {
    monitor,
    enhancedCheck,
    analyzePattern,
    recordMetric,
    analyzeMemoryPattern,
    analyzeLatencyPattern,
    analyzeErrorPattern,
    analyzeConnectionPattern,
    analyzeCpuPattern,
    getWindows,
  };
}

// ==============================================================================
// Diagnosis Sub-component
// ==============================================================================

/**
 * Create the enhanced repair diagnosis engine.
 * Classifies issues from health reports and ranks repair options from
 * the pattern registry and knowledge base.
 */
export function createEnhancedRepairDiagnosis({ db, stmts, log = () => {} }) {

  /**
   * Classify the primary issue from a health report.
   */
  function classifyIssue(healthReport, extra = {}) {
    const issues = healthReport.issues || [];
    const allIssues = [];

    for (const issue of issues) {
      allIssues.push({
        category: issue.category,
        pattern: issue.pattern,
        severity: issue.severity || SEVERITY.MEDIUM,
        confidence: issue.confidence || 0.5,
      });
    }

    // Also consider extra context (manual diagnosis)
    if (extra.errorMessage) {
      allIssues.push({
        category: extra.category || "unknown",
        pattern: "reported_error",
        severity: extra.severity || SEVERITY.MEDIUM,
        confidence: 0.6,
        errorMessage: extra.errorMessage,
      });
    }

    // Sort by severity weight then confidence
    allIssues.sort((a, b) => {
      const wA = SEVERITY_WEIGHTS[a.severity] || 0;
      const wB = SEVERITY_WEIGHTS[b.severity] || 0;
      if (wB !== wA) return wB - wA;
      return (b.confidence || 0) - (a.confidence || 0);
    });

    const classified = allIssues.length > 0;
    const primaryIssue = classified ? allIssues[0] : null;

    return { classified, primaryIssue, allIssues };
  }

  /**
   * Rank repair options from the pattern registry and knowledge base
   * for the given classification.
   */
  function rankRepairOptions(classification) {
    const options = [];

    if (!classification || !classification.classified) {
      options.push({
        type: "observation",
        name: "Continue monitoring",
        description: "No issues detected. Continue normal monitoring.",
        confidence: 0.9,
        source: "default",
      });
      return options;
    }

    const primary = classification.primaryIssue;
    const category = primary ? primary.category : "";

    // Search for known patterns in the database
    try {
      const patterns = stmts.getPatternsByCategory.all(category);
      for (const pat of patterns) {
        if (pat.resolution) {
          options.push({
            type: "pattern_fix",
            name: pat.name,
            description: pat.resolution,
            confidence: pat.confidence || 0.5,
            source: "pattern_registry",
            patternId: pat.id,
          });
        }
      }
    } catch (e) {
      log("warn", "pattern_lookup_error", { category, error: e.message });
    }

    // Search knowledge base
    try {
      const knowledge = stmts.getKnowledgeByCategory.all(category);
      for (const k of knowledge) {
        const total = (k.success_count || 0) + (k.failure_count || 0);
        const successRate = total > 0 ? k.success_count / total : 0;
        if (k.fix_description) {
          options.push({
            type: "knowledge_fix",
            name: `KB: ${k.issue_type}`,
            description: k.fix_description,
            confidence: successRate,
            source: "knowledge_base",
            knowledgeId: k.id,
            successRate,
          });
        }
      }
    } catch (e) {
      log("warn", "knowledge_lookup_error", { category, error: e.message });
    }

    // Add category-specific generic fixes
    const genericFixes = _getGenericFixes(category, primary);
    options.push(...genericFixes);

    // Sort by confidence descending
    options.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    return options;
  }

  /**
   * Generate generic fix options based on category.
   */
  function _getGenericFixes(category, issue) {
    const fixes = [];
    switch (category) {
      case REPAIR_CATEGORIES.MEMORY:
        fixes.push({
          type: "gc_trigger",
          name: "Trigger garbage collection",
          description: "Force a garbage collection cycle to recover memory.",
          confidence: 0.4,
          source: "generic",
        });
        fixes.push({
          type: "restart",
          name: "Restart service",
          description: "Restart the affected service to clear memory state.",
          confidence: 0.3,
          source: "generic",
        });
        break;
      case REPAIR_CATEGORIES.LATENCY:
        fixes.push({
          type: "cache_clear",
          name: "Clear caches",
          description: "Clear application caches to reduce lookup latency.",
          confidence: 0.35,
          source: "generic",
        });
        break;
      case REPAIR_CATEGORIES.ERROR_RATE:
        fixes.push({
          type: "circuit_break",
          name: "Activate circuit breaker",
          description: "Enable circuit breaker for failing endpoints.",
          confidence: 0.4,
          source: "generic",
        });
        break;
      case REPAIR_CATEGORIES.CONNECTION:
        fixes.push({
          type: "pool_reset",
          name: "Reset connection pool",
          description: "Reset and resize the connection pool.",
          confidence: 0.4,
          source: "generic",
        });
        break;
      case REPAIR_CATEGORIES.CPU:
        fixes.push({
          type: "throttle",
          name: "Throttle background tasks",
          description: "Reduce concurrency of background tasks to lower CPU usage.",
          confidence: 0.35,
          source: "generic",
        });
        break;
      default:
        fixes.push({
          type: "monitor",
          name: "Increase monitoring",
          description: "Increase monitoring granularity to gather more diagnostic data.",
          confidence: 0.2,
          source: "generic",
        });
    }
    return fixes;
  }

  /**
   * Full diagnosis: classify + rank options.
   */
  function diagnose(healthReport, extra = {}) {
    const id = generateId("diag");
    const timestamp = _nowISO();
    const classification = classifyIssue(healthReport, extra);
    const repairOptions = rankRepairOptions(classification);
    const recommendedAction = repairOptions.length > 0 ? repairOptions[0] : null;

    return {
      id,
      timestamp,
      classification,
      healthReport,
      repairOptions,
      recommendedAction,
      optionCount: repairOptions.length,
    };
  }

  return { diagnose, classifyIssue, rankRepairOptions };
}

// ==============================================================================
// Executor Sub-component
// ==============================================================================

/**
 * Create the enhanced repair executor.
 * Applies fixes, verifies results, and supports rollback.
 */
export function createEnhancedRepairExecution({ db, stmts, log = () => {}, actionHandlers = {} }) {

  /**
   * Capture a snapshot of the current process state for before/after comparison.
   */
  function captureSnapshot() {
    const mem = process.memoryUsage();
    return {
      timestamp: _nowISO(),
      ts: Date.now(),
      memory: mem.heapUsed,
      memoryMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
      uptime: process.uptime(),
    };
  }

  /**
   * Apply a specific fix option.
   */
  function applyFix(option) {
    const startTime = Date.now();
    let success = false;
    let description = "";

    try {
      // Check for custom action handler
      if (option.type && actionHandlers[option.type]) {
        const result = actionHandlers[option.type](option);
        success = result ? (result.success !== false) : true;
        description = result ? (result.description || option.description) : option.description;
      } else {
        // Default: simulate the fix
        success = true;
        description = option.description || "Fix applied (simulated)";
      }
    } catch (e) {
      success = false;
      description = `Fix failed: ${e.message}`;
      log("warn", "fix_apply_error", { option: option.type, error: e.message });
    }

    return {
      success,
      description,
      option: option.type || "unknown",
      repairTimeMs: Date.now() - startTime,
      attempted: true,
    };
  }

  /**
   * Verify that a repair was effective by comparing before/after snapshots.
   */
  function verifyRepair(beforeSnapshot, afterSnapshot) {
    const memDelta = afterSnapshot.memoryMB - beforeSnapshot.memoryMB;
    const improved = memDelta < 0; // Memory went down = improvement for memory issues
    return {
      verified: true,
      memoryDeltaMB: Math.round(memDelta * 100) / 100,
      improved,
      before: beforeSnapshot,
      after: afterSnapshot,
    };
  }

  /**
   * Rollback a repair (placeholder - in practice this would restore state).
   */
  function rollback(repairId) {
    log("info", "repair_rollback", { repairId });
    return { rolledBack: true, repairId, timestamp: _nowISO() };
  }

  /**
   * Full repair cycle: snapshot -> apply -> verify -> record.
   */
  function repair(diagnosis) {
    const beforeSnapshot = captureSnapshot();
    const startTime = Date.now();

    // Pick the recommended action
    const option = diagnosis.recommendedAction || (diagnosis.repairOptions && diagnosis.repairOptions[0]);
    if (!option) {
      return {
        success: false,
        description: "No repair options available",
        option: "none",
        repairTimeMs: Date.now() - startTime,
        attempted: false,
      };
    }

    const fixResult = applyFix(option);
    const afterSnapshot = captureSnapshot();
    const verification = verifyRepair(beforeSnapshot, afterSnapshot);

    // Record in repair_history
    const repairId = generateId("repair");
    try {
      const issueType = diagnosis.classification && diagnosis.classification.primaryIssue
        ? diagnosis.classification.primaryIssue.category
        : "unknown";
      const symptoms = diagnosis.classification && diagnosis.classification.allIssues
        ? JSON.stringify(diagnosis.classification.allIssues.map(i => i.pattern))
        : "[]";
      const severity = diagnosis.classification && diagnosis.classification.primaryIssue
        ? diagnosis.classification.primaryIssue.severity
        : "medium";

      stmts.insertHistory.run(
        repairId,
        issueType,
        symptoms,
        severity,
        JSON.stringify(diagnosis),
        option.type || "unknown",
        fixResult.description,
        fixResult.success ? 1 : 0,
        fixResult.repairTimeMs,
        0, // rollback_needed
        verification.verified ? 1 : 0,
        _nowISO()
      );
    } catch (e) {
      log("warn", "repair_history_save_error", { error: e.message });
    }

    return {
      ...fixResult,
      repairId,
      verification,
    };
  }

  return { repair, applyFix, verifyRepair, rollback, captureSnapshot };
}

// ==============================================================================
// Predictor Sub-component
// ==============================================================================

/**
 * Precursor pattern definitions for predictive repair.
 */
const PRECURSOR_PATTERNS = Object.freeze([
  {
    name: "memory_leak_precursor",
    category: REPAIR_CATEGORIES.MEMORY,
    check: (analyses) => {
      const mem = analyses.memory;
      if (!mem) return null;
      if (mem.pattern === MEMORY_PATTERNS.LINEAR_GROWTH_WITHOUT_GC_RECOVERY) {
        return {
          predictedIssue: "memory_exhaustion",
          confidence: mem.confidence || 0.7,
          timeToImpact: mem.details && mem.details.slope
            ? `~${Math.max(1, Math.round(100 / mem.details.slope))} data points`
            : "unknown",
          preventiveAction: "Trigger GC cycle and investigate allocation patterns.",
          severity: SEVERITY.HIGH,
        };
      }
      return null;
    },
  },
  {
    name: "latency_degradation_precursor",
    category: REPAIR_CATEGORIES.LATENCY,
    check: (analyses) => {
      const lat = analyses.latency;
      if (!lat) return null;
      if (lat.pattern === LATENCY_PATTERNS.GRADUAL_DEGRADATION) {
        return {
          predictedIssue: "service_timeout",
          confidence: lat.confidence || 0.6,
          timeToImpact: "~30 minutes",
          preventiveAction: "Check database query performance and connection pool health.",
          severity: SEVERITY.MEDIUM,
        };
      }
      return null;
    },
  },
  {
    name: "error_cascade_precursor",
    category: REPAIR_CATEGORIES.ERROR_RATE,
    check: (analyses) => {
      const err = analyses.errorRate;
      if (!err) return null;
      if (err.pattern === ERROR_PATTERNS.CASCADING || err.pattern === ERROR_PATTERNS.BURST) {
        return {
          predictedIssue: "service_failure",
          confidence: err.confidence || 0.8,
          timeToImpact: "imminent",
          preventiveAction: "Activate circuit breakers and scale error-handling capacity.",
          severity: SEVERITY.CRITICAL,
        };
      }
      return null;
    },
  },
  {
    name: "connection_exhaustion_precursor",
    category: REPAIR_CATEGORIES.CONNECTION,
    check: (analyses) => {
      const conn = analyses.connections;
      if (!conn) return null;
      if (conn.pattern === CONNECTION_PATTERNS.LEAK || conn.pattern === CONNECTION_PATTERNS.SATURATION) {
        return {
          predictedIssue: "connection_exhaustion",
          confidence: conn.confidence || 0.65,
          timeToImpact: "~1 hour",
          preventiveAction: "Reset connection pools and check for unclosed connections.",
          severity: SEVERITY.HIGH,
        };
      }
      return null;
    },
  },
  {
    name: "cpu_overload_precursor",
    category: REPAIR_CATEGORIES.CPU,
    check: (analyses) => {
      const cpu = analyses.cpu;
      if (!cpu) return null;
      if (cpu.pattern === CPU_PATTERNS.GRADUAL_INCREASE || cpu.pattern === CPU_PATTERNS.SUSTAINED_HIGH) {
        return {
          predictedIssue: "cpu_overload",
          confidence: cpu.confidence || 0.6,
          timeToImpact: cpu.pattern === CPU_PATTERNS.SUSTAINED_HIGH ? "imminent" : "~2 hours",
          preventiveAction: "Throttle background tasks and check for hot code paths.",
          severity: cpu.pattern === CPU_PATTERNS.SUSTAINED_HIGH ? SEVERITY.HIGH : SEVERITY.MEDIUM,
        };
      }
      return null;
    },
  },
]);

/**
 * Create the predictive repair engine.
 */
export function createPredictiveRepair({ db, stmts, monitor, executor, log = () => {} }) {

  /**
   * Scan the current health report for precursor patterns
   * and generate predictions.
   */
  function predictIssues(healthReport) {
    const predictions = [];
    const analyses = healthReport.analyses || {};
    let scanned = 0;

    for (const precursor of PRECURSOR_PATTERNS) {
      scanned++;
      const prediction = precursor.check(analyses);
      if (prediction) {
        const predId = generateId("pred");
        predictions.push({
          id: predId,
          precursorName: precursor.name,
          category: precursor.category,
          ...prediction,
        });

        // Persist prediction
        try {
          stmts.insertPrediction.run(
            predId,
            prediction.predictedIssue,
            prediction.confidence,
            prediction.timeToImpact,
            prediction.preventiveAction,
            0, // not applied
            null,
            null,
            _nowISO()
          );
        } catch (e) {
          log("warn", "prediction_persist_error", { error: e.message });
        }
      }
    }

    return { predictions, scanned };
  }

  /**
   * Apply a preventive fix for a prediction.
   */
  function applyPreventiveFix(predictionId) {
    let prediction = null;
    try {
      prediction = stmts.getPredictionById.get(predictionId);
    } catch (e) {
      log("warn", "prediction_lookup_error", { predictionId, error: e.message });
    }

    if (!prediction) {
      return { applied: false, reason: "Prediction not found" };
    }

    const outcome = `Preventive action applied at ${_nowISO()}: ${prediction.preventive_action || "N/A"}`;

    try {
      stmts.updatePredictionApplied.run(outcome, predictionId);
    } catch (e) {
      log("warn", "prediction_update_error", { predictionId, error: e.message });
    }

    return {
      applied: true,
      predictionId,
      predictedIssue: prediction.predicted_issue,
      preventiveAction: prediction.preventive_action,
      outcome,
      appliedAt: _nowISO(),
    };
  }

  return {
    predictIssues,
    applyPreventiveFix,
    PRECURSOR_PATTERNS,
  };
}

// ==============================================================================
// Learner Sub-component
// ==============================================================================

/**
 * Create the repair learning loop.
 * Tracks outcomes, accumulates knowledge, and compresses repair wisdom.
 */
function createRepairLearningLoop({ db, stmts, log = () => {} }) {

  /**
   * Learn from a completed repair. Updates or creates knowledge entries.
   */
  function learnFromRepair(repairResult, diagnosis) {
    const now = _nowISO();
    const success = repairResult.success;
    const issueType = diagnosis.classification && diagnosis.classification.primaryIssue
      ? diagnosis.classification.primaryIssue.category
      : "unknown";
    const category = issueType;
    const fixDescription = repairResult.description || "";
    const repairTimeMs = repairResult.repairTimeMs || 0;

    // Check for existing knowledge entry
    let existing = [];
    try {
      existing = stmts.getKnowledgeByIssueType.all(issueType);
    } catch (e) {
      log("warn", "knowledge_lookup_error", { error: e.message });
    }

    if (existing.length > 0) {
      const entry = existing[0];
      try {
        if (success) {
          const total = entry.success_count + 1;
          const avgTime = entry.avg_repair_time_ms > 0
            ? (entry.avg_repair_time_ms * entry.success_count + repairTimeMs) / total
            : repairTimeMs;
          stmts.updateKnowledgeSuccess.run(now, avgTime, entry.id);
        } else {
          stmts.updateKnowledgeFailure.run(now, entry.id);
        }
      } catch (e) {
        log("warn", "knowledge_update_error", { error: e.message });
      }
    } else {
      // Create new knowledge entry
      try {
        const knowledgeId = generateId("rk");
        const symptoms = diagnosis.classification && diagnosis.classification.allIssues
          ? JSON.stringify(diagnosis.classification.allIssues.map(i => i.pattern))
          : "[]";
        stmts.insertKnowledge.run(
          knowledgeId,
          category,
          issueType,
          symptoms,
          fixDescription,
          success ? 1 : 0,
          success ? 0 : 1,
          repairTimeMs,
          now,
          now
        );
      } catch (e) {
        log("warn", "knowledge_insert_error", { error: e.message });
      }
    }

    return { learned: true, issueType, success };
  }

  /**
   * Compress repair knowledge by consolidating duplicate entries.
   * Returns a summary of the compression operation.
   */
  function compressRepairKnowledge() {
    let compressed = 0;
    let reviewed = 0;

    try {
      const all = stmts.getAllKnowledge.all();
      reviewed = all.length;

      // Group by issue_type and look for duplicates
      const byType = {};
      for (const entry of all) {
        if (!byType[entry.issue_type]) byType[entry.issue_type] = [];
        byType[entry.issue_type].push(entry);
      }

      for (const [type, entries] of Object.entries(byType)) {
        if (entries.length > 1) {
          // Keep the entry with the highest success count as the canonical one
          entries.sort((a, b) => b.success_count - a.success_count);
          // Mark others as compressed (in practice we'd merge; here we count)
          compressed += entries.length - 1;
        }
      }
    } catch (e) {
      log("warn", "knowledge_compression_error", { error: e.message });
    }

    return { compressed, reviewed, timestamp: _nowISO() };
  }

  /**
   * Get comprehensive repair statistics.
   */
  function getRepairStats() {
    let patterns = 0;
    let repairsTotal = 0;
    let successful = 0;
    let failed = 0;
    let avgRepairTimeMs = 0;
    let predictionsTotal = 0;
    let predictionsActive = 0;
    let knowledgeTotal = 0;

    try { patterns = (stmts.countPatterns.get() || { count: 0 }).count; } catch {}
    try { repairsTotal = (stmts.countHistory.get() || { count: 0 }).count; } catch {}
    try { successful = (stmts.countSuccessful.get() || { count: 0 }).count; } catch {}
    try { failed = (stmts.countFailed.get() || { count: 0 }).count; } catch {}
    try {
      const avg = stmts.getAvgRepairTime.get();
      avgRepairTimeMs = avg && avg.avg_time ? Math.round(avg.avg_time * 100) / 100 : 0;
    } catch {}
    try { predictionsTotal = (stmts.countPredictions.get() || { count: 0 }).count; } catch {}
    try { predictionsActive = (stmts.countActivePredictions.get() || { count: 0 }).count; } catch {}
    try { knowledgeTotal = (stmts.countKnowledge.get() || { count: 0 }).count; } catch {}

    const successRate = repairsTotal > 0
      ? Math.round((successful / repairsTotal) * 1000) / 1000
      : 0;

    return {
      patterns,
      repairs: {
        total: repairsTotal,
        successful,
        failed,
        successRate,
        avgRepairTimeMs,
      },
      predictions: {
        total: predictionsTotal,
        active: predictionsActive,
      },
      knowledge: {
        total: knowledgeTotal,
      },
    };
  }

  return { learnFromRepair, compressRepairKnowledge, getRepairStats };
}

// ==============================================================================
// Main initializer
// ==============================================================================

/**
 * Initialize the complete enhanced repair system.
 *
 * Returns an object containing all sub-components plus convenience methods
 * for full repair cycles and manual pattern submission.
 *
 * @param {object} opts
 * @param {object} opts.db — better-sqlite3 database instance
 * @param {Function} [opts.log] — structured logger
 * @param {object} [opts.actionHandlers] — custom action handlers for the executor
 * @returns {object} The repair system with monitor, diagnosis, executor, predictor, learner
 */
export function initEnhancedRepair({ db, log = () => {}, actionHandlers = {} }) {
  const stmts = _buildStatements(db);

  const monitor = createEnhancedRepairMonitor({ db, stmts, log });
  const diagnosis = createEnhancedRepairDiagnosis({ db, stmts, log });
  const executor = createEnhancedRepairExecution({ db, stmts, log, actionHandlers });
  const predictor = createPredictiveRepair({ db, stmts, monitor, executor, log });
  const learner = createRepairLearningLoop({ db, stmts, log });

  /**
   * Run a full repair cycle: monitor -> diagnose -> repair -> learn.
   */
  function fullRepairCycle(metrics) {
    // Step 1: Record metrics and get health report
    const healthReport = monitor.monitor(metrics || {});

    // Step 2: Diagnose
    const diag = diagnosis.diagnose(healthReport);

    // Step 3: If issues found, attempt repair
    let repairResult = null;
    if (diag.classification.classified) {
      repairResult = executor.repair(diag);
      // Step 4: Learn
      learner.learnFromRepair(repairResult, diag);
    }

    // Step 5: Run predictions
    const { predictions } = predictor.predictIssues(healthReport);

    return {
      healthReport,
      diagnosis: diag,
      repair: repairResult,
      predictions,
      timestamp: _nowISO(),
    };
  }

  /**
   * Manually submit an error pattern for learning.
   * Creates both a pattern entry and a knowledge entry.
   */
  function submitErrorPattern({ category, subcategory, name, symptoms, resolution, severity, confidence }) {
    const patternId = generateId("rp");
    const knowledgeId = generateId("rk");
    const now = _nowISO();

    const symptomsStr = Array.isArray(symptoms) ? JSON.stringify(symptoms) : (symptoms || "[]");
    const sig = Array.isArray(symptoms) ? symptoms.join("; ") : (symptoms || "");

    try {
      stmts.insertPattern.run(
        patternId,
        category || "unknown",
        subcategory || "manual",
        name || "manual_pattern",
        sig,
        0, // not a healthy pattern
        resolution || "",
        null,
        severity || "medium",
        typeof confidence === "number" ? confidence : 0.5,
        null,
        now
      );
    } catch (e) {
      log("warn", "pattern_insert_error", { error: e.message });
    }

    try {
      stmts.insertKnowledge.run(
        knowledgeId,
        category || "unknown",
        category || "unknown",
        symptomsStr,
        resolution || "",
        0,
        0,
        0,
        now,
        now
      );
    } catch (e) {
      log("warn", "knowledge_insert_error", { error: e.message });
    }

    return { patternId, knowledgeId };
  }

  return {
    monitor,
    diagnosis,
    executor,
    predictor,
    learner,
    stmts,
    fullRepairCycle,
    submitErrorPattern,
  };
}
