/**
 * LOAF III.1 — Epistemic Layer Split + LOAF III.2 — Reality Kernel (Quantitative Core)
 *
 * Epistemic Layer Split:
 *   Hard Kernel (math, physics, invariants; near-zero decay)
 *   Soft Beliefs (normal decay)
 *   Speculative Space (explicitly labeled)
 *   Hard kernel is contradiction-intolerant.
 *
 * Reality Kernel:
 *   Enforce: unit correctness, dimensional analysis, invariant preservation, mathematical consistency
 *   Violations: block promotion, auto-open dispute
 */

const EPISTEMIC_LAYERS = Object.freeze({
  HARD_KERNEL: "hard_kernel",     // math, physics, invariants — near-zero decay
  SOFT_BELIEF: "soft_belief",     // normal knowledge with decay
  SPECULATIVE: "speculative",     // explicitly labeled speculation
});

const LAYER_CONFIG = Object.freeze({
  [EPISTEMIC_LAYERS.HARD_KERNEL]: {
    decayRate: 0.0001,            // near-zero decay
    contradictionTolerance: 0,     // zero tolerance for contradictions
    promotionThreshold: 0.95,      // very high confidence needed
    label: "Hard Kernel (invariant)",
  },
  [EPISTEMIC_LAYERS.SOFT_BELIEF]: {
    decayRate: 0.01,              // normal decay
    contradictionTolerance: 0.3,   // some tolerance
    promotionThreshold: 0.6,
    label: "Soft Belief",
  },
  [EPISTEMIC_LAYERS.SPECULATIVE]: {
    decayRate: 0.05,              // faster decay
    contradictionTolerance: 0.8,   // high tolerance (speculation is inherently uncertain)
    promotionThreshold: 0.3,
    label: "Speculative",
  },
});

// Epistemic items store
const epistemicItems = new Map(); // itemId -> { layer, content, confidence, decayedConfidence, ... }

/**
 * Classify a knowledge item into an epistemic layer.
 */
function classifyLayer(item) {
  const text = String(item.text || item.content || "").toLowerCase();
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const confidence = Number(item.confidence ?? 0.5);

  // Hard kernel markers
  const hardKernelPatterns = [
    /\b(theorem|axiom|law|invariant|conservation|equation|identity)\b/,
    /\b(mathematical|physics|constant|fundamental)\b/,
    /\b(always|never|must|impossible|necessary|sufficient)\b/,
    /[=≡≠<>≤≥∀∃∫∑∏]/,
  ];

  // Speculative markers
  const speculativePatterns = [
    /\b(hypothes[ie]s|specul|might|perhaps|possibly|could be|uncertain)\b/,
    /\b(conjecture|assume|suppose|guess|estimate|approximate)\b/,
    /\b(preliminary|tentative|proposed|suggested|potential)\b/,
  ];

  const isHardKernel = hardKernelPatterns.some(p => p.test(text)) ||
    tags.some(t => ["math", "physics", "invariant", "axiom", "law", "theorem"].includes(t));

  const isSpeculative = speculativePatterns.some(p => p.test(text)) ||
    tags.some(t => ["hypothesis", "speculative", "conjecture", "tentative"].includes(t));

  if (isHardKernel && confidence >= 0.8) return EPISTEMIC_LAYERS.HARD_KERNEL;
  if (isSpeculative || confidence < 0.4) return EPISTEMIC_LAYERS.SPECULATIVE;
  return EPISTEMIC_LAYERS.SOFT_BELIEF;
}

/**
 * Add an item to the epistemic store with layer classification.
 */
function addEpistemicItem(item) {
  const id = item.id || `epist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const layer = item.layer || classifyLayer(item);
  const confidence = Math.max(0, Math.min(1, Number(item.confidence ?? 0.5)));

  const entry = {
    id,
    layer,
    content: String(item.text || item.content || ""),
    confidence,
    decayedConfidence: confidence,
    tags: Array.isArray(item.tags) ? item.tags : [],
    provenance: item.provenance || null,
    createdAt: new Date().toISOString(),
    lastDecayAt: Date.now(),
    metadata: item.metadata || {},
  };

  epistemicItems.set(id, entry);

  // Cap items to prevent unbounded growth
  if (epistemicItems.size > 50000) {
    const oldest = epistemicItems.keys().next().value;
    epistemicItems.delete(oldest);
  }

  return { ok: true, item: entry };
}

/**
 * Apply decay to all epistemic items based on their layer config.
 */
function applyDecay(dtMs = 60000) {
  let decayed = 0;
  // Guard against negative or non-numeric time deltas
  const safeDtMs = Math.max(0, Number(dtMs) || 0);
  for (const [id, item] of epistemicItems) {
    const config = LAYER_CONFIG[item.layer];
    if (!config) continue;

    const decayFactor = Math.exp(-config.decayRate * (safeDtMs / 60000));
    const newConfidence = item.confidence * decayFactor;

    if (Math.abs(newConfidence - item.decayedConfidence) > 0.001) {
      item.decayedConfidence = newConfidence;
      item.lastDecayAt = Date.now();
      decayed++;
    }
  }
  return { decayed, total: epistemicItems.size };
}

/**
 * Check if adding a claim would contradict the hard kernel.
 * Hard kernel is contradiction-intolerant.
 */
function checkHardKernelContradiction(newClaim) {
  const hardKernelItems = Array.from(epistemicItems.values())
    .filter(item => item.layer === EPISTEMIC_LAYERS.HARD_KERNEL);

  const contradictions = [];
  const newText = String(newClaim.text || newClaim.content || "").toLowerCase();

  for (const item of hardKernelItems) {
    const existingText = item.content.toLowerCase();

    // Simple contradiction detection for hard kernel
    // Check for direct negation with overlapping subject
    const wordsNew = new Set(newText.split(/\s+/).filter(w => w.length > 3));
    const wordsExisting = new Set(existingText.split(/\s+/).filter(w => w.length > 3));

    let overlap = 0;
    for (const w of wordsNew) if (wordsExisting.has(w)) overlap++;

    const overlapRatio = (wordsNew.size + wordsExisting.size) > 0
      ? (2 * overlap) / (wordsNew.size + wordsExisting.size)
      : 0;

    // Check for negation markers
    const hasNegation =
      (newText.includes("not") && !existingText.includes("not")) ||
      (!newText.includes("not") && existingText.includes("not")) ||
      (newText.includes("false") && existingText.includes("true")) ||
      (newText.includes("true") && existingText.includes("false"));

    if (overlapRatio > 0.3 && hasNegation) {
      contradictions.push({
        existingItem: item.id,
        existingContent: item.content.slice(0, 200),
        overlapRatio,
        severity: "hard_kernel_violation",
      });
    }
  }

  return {
    hasContradiction: contradictions.length > 0,
    contradictions,
    blockPromotion: contradictions.length > 0,
  };
}

// ===== REALITY KERNEL (Quantitative Core) =====

const DIMENSION_TYPES = Object.freeze({
  LENGTH: "length",
  MASS: "mass",
  TIME: "time",
  TEMPERATURE: "temperature",
  CURRENT: "current",
  AMOUNT: "amount",
  LUMINOSITY: "luminosity",
  DIMENSIONLESS: "dimensionless",
});

/**
 * Check unit correctness for a quantitative claim.
 */
function checkUnitCorrectness(quantity) {
  if (!quantity || !quantity.value || !quantity.unit) {
    return { valid: false, reason: "missing_value_or_unit" };
  }

  const value = Number(quantity.value);
  if (isNaN(value) || !isFinite(value)) {
    return { valid: false, reason: "invalid_numeric_value" };
  }

  // Basic unit validation
  const knownUnits = new Set([
    "m", "kg", "s", "A", "K", "mol", "cd",
    "m/s", "m/s^2", "N", "J", "W", "Pa", "Hz",
    "C", "V", "F", "Ω", "H", "T", "lm", "lx",
    "km", "cm", "mm", "g", "mg", "ms", "μs",
    "%", "ratio", "count", "dimensionless",
  ]);

  const unitValid = knownUnits.has(quantity.unit) || quantity.unit.startsWith("custom:");

  return {
    valid: unitValid,
    value,
    unit: quantity.unit,
    reason: unitValid ? "ok" : "unknown_unit",
  };
}

/**
 * Check dimensional analysis consistency between two quantities.
 */
function checkDimensionalConsistency(quantityA, quantityB, operation) {
  const unitA = String(quantityA?.unit || "");
  const unitB = String(quantityB?.unit || "");

  if (operation === "add" || operation === "subtract") {
    // Addition/subtraction requires same dimensions
    if (unitA !== unitB) {
      return { consistent: false, reason: `cannot ${operation} ${unitA} and ${unitB}` };
    }
    return { consistent: true, resultUnit: unitA };
  }

  if (operation === "multiply") {
    if (unitA === "dimensionless") return { consistent: true, resultUnit: unitB };
    if (unitB === "dimensionless") return { consistent: true, resultUnit: unitA };
    return { consistent: true, resultUnit: `${unitA}·${unitB}` };
  }

  if (operation === "divide") {
    if (unitB === "dimensionless") return { consistent: true, resultUnit: unitA };
    if (unitA === unitB) return { consistent: true, resultUnit: "dimensionless" };
    return { consistent: true, resultUnit: `${unitA}/${unitB}` };
  }

  return { consistent: false, reason: `unknown operation: ${operation}` };
}

/**
 * Check mathematical consistency of a set of invariants.
 */
function checkMathematicalConsistency(invariants) {
  if (!Array.isArray(invariants) || invariants.length === 0) {
    return { consistent: true, violations: [] };
  }

  const violations = [];

  for (const inv of invariants) {
    const text = String(inv.text || inv).toLowerCase();

    // Check for obviously inconsistent invariants
    // e.g., "x > 0" and "x < 0" or "x = 0" and "x ≠ 0"
    for (const other of invariants) {
      if (inv === other) continue;
      const otherText = String(other.text || other).toLowerCase();

      // Simple inconsistency detection
      if (text.includes("> 0") && otherText.includes("< 0") ||
          text.includes("< 0") && otherText.includes("> 0")) {
        // Check if same variable
        const varMatch = text.match(/(\w+)\s*[<>]/);
        const otherVarMatch = otherText.match(/(\w+)\s*[<>]/);
        if (varMatch && otherVarMatch && varMatch[1] === otherVarMatch[1]) {
          violations.push({
            invariantA: String(inv.text || inv).slice(0, 100),
            invariantB: String(other.text || other).slice(0, 100),
            reason: "contradictory_bounds",
          });
        }
      }
    }
  }

  return {
    consistent: violations.length === 0,
    violations,
  };
}

/**
 * Reality check: run all quantitative validations on a claim.
 * Violations block promotion and auto-open disputes.
 */
function realityCheck(claim) {
  const violations = [];

  // Check units if quantities present
  if (claim.quantities) {
    for (const q of (Array.isArray(claim.quantities) ? claim.quantities : [claim.quantities])) {
      const unitCheck = checkUnitCorrectness(q);
      if (!unitCheck.valid) {
        violations.push({ type: "unit_error", details: unitCheck });
      }
    }
  }

  // Check invariants
  if (claim.invariants) {
    const consistencyCheck = checkMathematicalConsistency(claim.invariants);
    if (!consistencyCheck.consistent) {
      violations.push({ type: "invariant_violation", details: consistencyCheck });
    }
  }

  // Check hard kernel contradiction
  const contradiction = checkHardKernelContradiction(claim);
  if (contradiction.hasContradiction) {
    violations.push({ type: "hard_kernel_contradiction", details: contradiction });
  }

  return {
    pass: violations.length === 0,
    violations,
    blockPromotion: violations.length > 0,
    autoOpenDispute: violations.some(v => v.type === "hard_kernel_contradiction"),
  };
}

function init({ register, STATE, helpers }) {
  STATE.__loaf = STATE.__loaf || {};
  STATE.__loaf.epistemic = {
    stats: {
      itemsClassified: 0, hardKernelItems: 0, softBeliefItems: 0, speculativeItems: 0,
      decayRuns: 0, contradictionsBlocked: 0, realityChecks: 0, realityViolations: 0,
    },
  };

  register("loaf.epistemic", "status", async (ctx) => {
    const e = ctx.state.__loaf.epistemic;
    return {
      ok: true,
      layers: LAYER_CONFIG,
      totalItems: epistemicItems.size,
      byLayer: {
        hard_kernel: Array.from(epistemicItems.values()).filter(i => i.layer === EPISTEMIC_LAYERS.HARD_KERNEL).length,
        soft_belief: Array.from(epistemicItems.values()).filter(i => i.layer === EPISTEMIC_LAYERS.SOFT_BELIEF).length,
        speculative: Array.from(epistemicItems.values()).filter(i => i.layer === EPISTEMIC_LAYERS.SPECULATIVE).length,
      },
      stats: e.stats,
    };
  }, { public: true });

  register("loaf.epistemic", "classify", async (ctx, input = {}) => {
    const e = ctx.state.__loaf.epistemic;
    const layer = classifyLayer(input);
    e.stats.itemsClassified++;
    return { ok: true, layer, config: LAYER_CONFIG[layer] };
  }, { public: true });

  register("loaf.epistemic", "add_item", async (ctx, input = {}) => {
    const e = ctx.state.__loaf.epistemic;
    const result = addEpistemicItem(input);
    if (result.ok) {
      const layer = result.item.layer;
      if (layer === EPISTEMIC_LAYERS.HARD_KERNEL) e.stats.hardKernelItems++;
      else if (layer === EPISTEMIC_LAYERS.SOFT_BELIEF) e.stats.softBeliefItems++;
      else e.stats.speculativeItems++;
    }
    return result;
  }, { public: false });

  register("loaf.epistemic", "decay", async (ctx, input = {}) => {
    const e = ctx.state.__loaf.epistemic;
    const dtMs = Number(input.dtMs || 60000);
    e.stats.decayRuns++;
    return { ok: true, ...applyDecay(dtMs) };
  }, { public: false });

  register("loaf.epistemic", "check_contradiction", async (ctx, input = {}) => {
    const e = ctx.state.__loaf.epistemic;
    const result = checkHardKernelContradiction(input);
    if (result.hasContradiction) e.stats.contradictionsBlocked++;
    return { ok: true, ...result };
  }, { public: true });

  register("loaf.epistemic", "reality_check", async (ctx, input = {}) => {
    const e = ctx.state.__loaf.epistemic;
    e.stats.realityChecks++;
    const result = realityCheck(input);
    if (!result.pass) e.stats.realityViolations++;
    return { ok: true, ...result };
  }, { public: true });

  register("loaf.epistemic", "check_units", async (ctx, input = {}) => {
    return { ok: true, ...checkUnitCorrectness(input) };
  }, { public: true });

  register("loaf.epistemic", "check_dimensions", async (ctx, input = {}) => {
    return { ok: true, ...checkDimensionalConsistency(input.quantityA, input.quantityB, input.operation) };
  }, { public: true });

  register("loaf.epistemic", "list_items", async (ctx, input = {}) => {
    const layer = input.layer || null;
    let items = Array.from(epistemicItems.values());
    if (layer) items = items.filter(i => i.layer === layer);
    items = items.slice(0, Number(input.limit || 100));
    return { ok: true, items };
  }, { public: true });
}

export {
  EPISTEMIC_LAYERS,
  LAYER_CONFIG,
  DIMENSION_TYPES,
  classifyLayer,
  addEpistemicItem,
  applyDecay,
  checkHardKernelContradiction,
  checkUnitCorrectness,
  checkDimensionalConsistency,
  checkMathematicalConsistency,
  realityCheck,
  init,
};
