/**
 * LOAF II.4 — Evidence & Verification Markets
 *
 * Every promoted artifact carries:
 *   evidence bundle, counter-evidence, provenance, confidence distribution
 *
 * Plural verifiers:
 *   factual, logical, valence, drift, economic-gaming
 *
 * Councils arbitrate.
 */

const VERIFIER_TYPES = Object.freeze([
  "factual",
  "logical",
  "valence",
  "drift",
  "economic_gaming",
]);

/**
 * Create an evidence bundle for a promoted artifact.
 */
function createEvidenceBundle(artifactId, evidence = [], counterEvidence = [], provenance = {}) {
  return {
    artifactId: String(artifactId),
    evidence: evidence.map(e => ({
      text: String(e.text || e),
      source: e.source || null,
      confidence: Math.max(0, Math.min(1, Number(e.confidence ?? 0.5))),
      verifiedBy: e.verifiedBy || [],
      addedAt: new Date().toISOString(),
    })),
    counterEvidence: counterEvidence.map(e => ({
      text: String(e.text || e),
      source: e.source || null,
      confidence: Math.max(0, Math.min(1, Number(e.confidence ?? 0.5))),
      verifiedBy: e.verifiedBy || [],
      addedAt: new Date().toISOString(),
    })),
    provenance: {
      source_type: provenance.source_type || "unknown",
      source_id: provenance.source_id || "unknown",
      confidence: Math.max(0, Math.min(1, Number(provenance.confidence ?? 0.5))),
      created_at: new Date().toISOString(),
      timestamps: provenance.timestamps || [new Date().toISOString()],
    },
    confidenceDistribution: computeConfidenceDistribution(evidence, counterEvidence),
    verifications: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Compute confidence distribution from evidence and counter-evidence.
 */
function computeConfidenceDistribution(evidence, counterEvidence) {
  const allEvidence = [...(evidence || []), ...(counterEvidence || [])];
  if (allEvidence.length === 0) return { mean: 0.5, median: 0.5, stdDev: 0, min: 0.5, max: 0.5 };

  const confidences = allEvidence.map(e => Number(e.confidence ?? 0.5));
  confidences.sort((a, b) => a - b);

  const mean = confidences.reduce((s, v) => s + v, 0) / confidences.length;
  const median = confidences.length % 2 === 0
    ? (confidences[confidences.length / 2 - 1] + confidences[confidences.length / 2]) / 2
    : confidences[Math.floor(confidences.length / 2)];
  const variance = confidences.reduce((s, v) => s + (v - mean) ** 2, 0) / confidences.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    stdDev,
    min: confidences[0],
    max: confidences[confidences.length - 1],
    count: confidences.length,
  };
}

// Verifier implementations
const verifiers = {
  /**
   * Factual verifier: checks claims against known facts.
   */
  factual(artifact, bundle) {
    const evidenceStrength = bundle.evidence.length > 0
      ? bundle.evidence.reduce((s, e) => s + e.confidence, 0) / bundle.evidence.length
      : 0;
    const counterStrength = bundle.counterEvidence.length > 0
      ? bundle.counterEvidence.reduce((s, e) => s + e.confidence, 0) / bundle.counterEvidence.length
      : 0;

    const score = evidenceStrength - counterStrength * 0.5;
    return {
      type: "factual",
      score: Math.max(0, Math.min(1, score)),
      pass: score >= 0.3,
      details: { evidenceStrength, counterStrength, evidenceCount: bundle.evidence.length },
    };
  },

  /**
   * Logical verifier: checks for internal consistency.
   */
  logical(artifact, bundle) {
    // Check for contradictions within evidence
    let contradictions = 0;
    for (let i = 0; i < bundle.evidence.length; i++) {
      for (let j = i + 1; j < bundle.evidence.length; j++) {
        const a = String(bundle.evidence[i].text).toLowerCase();
        const b = String(bundle.evidence[j].text).toLowerCase();
        // Simple contradiction: one says "not" where other doesn't
        if ((a.includes("not") && !b.includes("not")) || (!a.includes("not") && b.includes("not"))) {
          const wordsA = new Set(a.split(/\s+/));
          const wordsB = new Set(b.split(/\s+/));
          let overlap = 0;
          for (const w of wordsA) if (wordsB.has(w) && w.length > 3) overlap++;
          if (overlap >= 2) contradictions++;
        }
      }
    }

    const score = contradictions === 0 ? 0.9 : Math.max(0.1, 0.9 - contradictions * 0.2);
    return {
      type: "logical",
      score,
      pass: contradictions === 0,
      details: { contradictions },
    };
  },

  /**
   * Valence verifier: ensures no negative valence optimization.
   */
  valence(artifact, bundle) {
    const allText = [
      ...bundle.evidence.map(e => e.text),
      ...bundle.counterEvidence.map(e => e.text),
    ].join(" ").toLowerCase();

    const negativeMarkers = ["harm", "suffering", "exploit", "manipulate", "deceive", "coerce"];
    let negativeScore = 0;
    for (const marker of negativeMarkers) {
      if (allText.includes(marker)) negativeScore += 0.2;
    }

    const score = Math.max(0, 1 - negativeScore);
    return {
      type: "valence",
      score,
      pass: negativeScore < 0.4,
      details: { negativeScore, markersFound: negativeMarkers.filter(m => allText.includes(m)) },
    };
  },

  /**
   * Drift verifier: checks for epistemic or value drift.
   */
  drift(artifact, bundle) {
    // Check if confidence has shifted dramatically
    const dist = bundle.confidenceDistribution;
    const driftScore = dist.stdDev > 0.3 ? dist.stdDev : 0;
    return {
      type: "drift",
      score: Math.max(0, 1 - driftScore),
      pass: driftScore < 0.3,
      details: { stdDev: dist.stdDev, mean: dist.mean, driftScore },
    };
  },

  /**
   * Economic gaming verifier: detect attempts to game the reward system.
   */
  economic_gaming(artifact, bundle) {
    // Check for suspicious patterns: rapid evidence addition, uniform confidence
    const timestamps = bundle.evidence.map(e => new Date(e.addedAt).getTime()).filter(t => !isNaN(t));
    let rapidAdditions = 0;
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - timestamps[i - 1] < 1000) rapidAdditions++; // < 1 second apart
    }

    // Uniform confidence is suspicious
    const confidences = bundle.evidence.map(e => e.confidence);
    const allSame = confidences.length > 2 && confidences.every(c => c === confidences[0]);

    let gamingScore = 0;
    if (rapidAdditions > 2) gamingScore += 0.3;
    if (allSame) gamingScore += 0.3;

    return {
      type: "economic_gaming",
      score: Math.max(0, 1 - gamingScore),
      pass: gamingScore < 0.3,
      details: { rapidAdditions, uniformConfidence: allSame, gamingScore },
    };
  },
};

/**
 * Run all verifiers on an artifact's evidence bundle.
 * Returns aggregated verification result.
 */
function runVerification(artifact, bundle) {
  const results = {};
  let totalScore = 0;
  let passCount = 0;

  for (const type of VERIFIER_TYPES) {
    const verifier = verifiers[type];
    if (verifier) {
      results[type] = verifier(artifact, bundle);
      totalScore += results[type].score;
      if (results[type].pass) passCount++;
    }
  }

  const avgScore = VERIFIER_TYPES.length > 0 ? totalScore / VERIFIER_TYPES.length : 0;
  const allPassed = passCount === VERIFIER_TYPES.length;

  return {
    results,
    aggregateScore: avgScore,
    allPassed,
    passCount,
    totalVerifiers: VERIFIER_TYPES.length,
    recommendation: allPassed ? "promote" : avgScore >= 0.5 ? "review" : "reject",
    verifiedAt: new Date().toISOString(),
  };
}

// Evidence bundle store
const bundles = new Map(); // artifactId -> bundle

function init({ register, STATE, helpers }) {
  STATE.__loaf = STATE.__loaf || {};
  STATE.__loaf.verification = {
    stats: { bundlesCreated: 0, verificationsRun: 0, promoted: 0, rejected: 0, reviews: 0 },
  };

  register("loaf.verification", "status", async (ctx) => {
    const v = ctx.state.__loaf.verification;
    return {
      ok: true,
      bundleCount: bundles.size,
      verifierTypes: VERIFIER_TYPES,
      stats: v.stats,
    };
  }, { public: true });

  register("loaf.verification", "create_bundle", async (ctx, input = {}) => {
    const v = ctx.state.__loaf.verification;
    const bundle = createEvidenceBundle(
      input.artifactId, input.evidence, input.counterEvidence, input.provenance
    );
    bundles.set(bundle.artifactId, bundle);
    v.stats.bundlesCreated++;
    // Cap bundles to prevent unbounded growth
    if (bundles.size > 50000) {
      const oldest = bundles.keys().next().value;
      bundles.delete(oldest);
    }
    return { ok: true, bundle };
  }, { public: false });

  register("loaf.verification", "get_bundle", async (ctx, input = {}) => {
    const bundle = bundles.get(String(input.artifactId || ""));
    return bundle ? { ok: true, bundle } : { ok: false, error: "bundle_not_found" };
  }, { public: true });

  register("loaf.verification", "verify", async (ctx, input = {}) => {
    const v = ctx.state.__loaf.verification;
    const artifactId = String(input.artifactId || "");
    const bundle = bundles.get(artifactId);
    if (!bundle) return { ok: false, error: "bundle_not_found" };

    const result = runVerification(input.artifact || { id: artifactId }, bundle);
    bundle.verifications.push(result);
    bundle.updatedAt = new Date().toISOString();
    v.stats.verificationsRun++;

    if (result.recommendation === "promote") v.stats.promoted++;
    else if (result.recommendation === "reject") v.stats.rejected++;
    else v.stats.reviews++;

    return { ok: true, ...result };
  }, { public: false });

  register("loaf.verification", "add_evidence", async (ctx, input = {}) => {
    const artifactId = String(input.artifactId || "");
    const bundle = bundles.get(artifactId);
    if (!bundle) return { ok: false, error: "bundle_not_found" };

    const newEvidence = {
      text: String(input.text || ""),
      source: input.source || null,
      confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.5))),
      verifiedBy: [],
      addedAt: new Date().toISOString(),
    };

    if (input.isCounter) {
      bundle.counterEvidence.push(newEvidence);
    } else {
      bundle.evidence.push(newEvidence);
    }

    bundle.confidenceDistribution = computeConfidenceDistribution(bundle.evidence, bundle.counterEvidence);
    bundle.updatedAt = new Date().toISOString();

    return { ok: true, bundle };
  }, { public: false });
}

export {
  VERIFIER_TYPES,
  createEvidenceBundle,
  computeConfidenceDistribution,
  runVerification,
  verifiers,
  init,
};
