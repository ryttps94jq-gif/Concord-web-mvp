/**
 * Concord Global Atlas — Epistemic Engine
 *
 * Domain-specific validators, scorers, and truth-structure logic.
 * Each domain has its own validation module, weighting model,
 * contradiction handling, and confidence computation.
 *
 * This is the core of Concord's multi-domain epistemic infrastructure.
 */

import { getEmergentState } from "./store.js";

// ── Domain Types (taxonomy — routing key for scoring + validation) ────────

export const DOMAIN_TYPES = Object.freeze({
  // Formal
  FORMAL_MATH:        "formal.math",
  FORMAL_LOGIC:       "formal.logic",
  // Empirical
  EMPIRICAL_PHYSICS:  "empirical.physics",
  EMPIRICAL_BIOLOGY:  "empirical.biology",
  EMPIRICAL_MEDICINE: "empirical.medicine",
  // Historical
  HISTORICAL_WORLD:   "historical.world",
  HISTORICAL_ECONOMIC:"historical.economic",
  // Interpretive
  INTERP_PHILOSOPHY:  "interpretive.philosophy",
  INTERP_LINGUISTICS: "interpretive.linguistics",
  // Model-based
  MODEL_ECONOMICS:    "model.economics",
  MODEL_POLICY:       "model.policy",
  // Arts
  ARTS_VISUAL:        "arts.visual",
  ARTS_MUSIC:         "arts.music",
  ARTS_LITERATURE:    "arts.literature",
  // Design
  DESIGN_ARCHITECTURE:"design.architecture",
  DESIGN_PRODUCT:     "design.product",
  // General (chat-originated, unclassified)
  GENERAL_NOTE:       "general.note",
});

export const DOMAIN_TYPE_SET = new Set(Object.values(DOMAIN_TYPES));

// ── Epistemic Classes (truth structure selectors) ─────────────────────────

export const EPISTEMIC_CLASSES = Object.freeze({
  FORMAL:       "FORMAL",
  EMPIRICAL:    "EMPIRICAL",
  HISTORICAL:   "HISTORICAL",
  INTERPRETIVE: "INTERPRETIVE",
  MODEL:        "MODEL",
  ARTS:         "ARTS",
  DESIGN:       "DESIGN",
  GENERAL:      "GENERAL",
});

export const EPISTEMIC_CLASS_SET = new Set(Object.values(EPISTEMIC_CLASSES));

// Map domainType → epistemicClass
const DOMAIN_TO_CLASS = {
  "formal.math":        "FORMAL",
  "formal.logic":       "FORMAL",
  "empirical.physics":  "EMPIRICAL",
  "empirical.biology":  "EMPIRICAL",
  "empirical.medicine": "EMPIRICAL",
  "historical.world":   "HISTORICAL",
  "historical.economic":"HISTORICAL",
  "interpretive.philosophy":"INTERPRETIVE",
  "interpretive.linguistics":"INTERPRETIVE",
  "model.economics":    "MODEL",
  "model.policy":       "MODEL",
  "arts.visual":        "ARTS",
  "arts.music":         "ARTS",
  "arts.literature":    "ARTS",
  "design.architecture":"DESIGN",
  "design.product":     "DESIGN",
  "general.note":       "GENERAL",
};

export function getEpistemicClass(domainType) {
  return DOMAIN_TO_CLASS[domainType] || null;
}

// ── Claim Types ───────────────────────────────────────────────────────────

export const CLAIM_TYPES = Object.freeze({
  FACT:           "FACT",
  INTERPRETATION: "INTERPRETATION",
  RECEPTION:      "RECEPTION",
  PROVENANCE:     "PROVENANCE",
  SPEC:           "SPEC",
  HYPOTHESIS:     "HYPOTHESIS",
  MODEL_OUTPUT:   "MODEL_OUTPUT",
});

// ── Source Tiers ──────────────────────────────────────────────────────────

export const SOURCE_TIERS = Object.freeze({
  PRIMARY:    "PRIMARY",
  SECONDARY:  "SECONDARY",
  TERTIARY:   "TERTIARY",
  UNCITED:    "UNCITED",
});

// ── Evidence Tiers ───────────────────────────────────────────────────────

export const EVIDENCE_TIERS = Object.freeze({
  PROVEN:          "PROVEN",
  CORROBORATED:    "CORROBORATED",
  SUPPORTED:       "SUPPORTED",
  WEAK_EVIDENCE:   "WEAK_EVIDENCE",
  UNCORROBORATED:  "UNCORROBORATED",
  DISPUTED:        "DISPUTED",
  CONTRADICTED:    "CONTRADICTED",
});

// ── Atlas DTU Statuses (state machine) ───────────────────────────────────

export const ATLAS_STATUS = Object.freeze({
  DRAFT:        "DRAFT",
  PROPOSED:     "PROPOSED",
  VERIFIED:     "VERIFIED",
  DISPUTED:     "DISPUTED",
  DEPRECATED:   "DEPRECATED",
  QUARANTINED:  "QUARANTINED",
});

// Allowed transitions
const STATUS_TRANSITIONS = {
  DRAFT:       ["PROPOSED"],
  PROPOSED:    ["VERIFIED", "DISPUTED", "QUARANTINED"],
  VERIFIED:    ["DISPUTED", "DEPRECATED", "QUARANTINED"],
  DISPUTED:    ["VERIFIED", "QUARANTINED"],
  DEPRECATED:  ["QUARANTINED"],
  QUARANTINED: [],  // terminal unless admin override
};

export function canTransition(from, to) {
  return (STATUS_TRANSITIONS[from] || []).includes(to);
}

// ── Thresholds (configurable per domain) ─────────────────────────────────

const DEFAULT_THRESHOLDS = {
  min_structural_for_proposed: 0.40,
  min_structural_for_verified: 0.70,
  min_factual_for_verified: 0.60,
  contradiction_tolerance_high: 0,  // zero unresolved HIGH contradictions allowed
};

const DOMAIN_THRESHOLDS = {
  FORMAL: {
    min_structural_for_proposed: 0.50,
    min_structural_for_verified: 0.85,
    min_factual_for_verified: 0.90,
    contradiction_tolerance_high: 0,
  },
  EMPIRICAL: {
    min_structural_for_proposed: 0.45,
    min_structural_for_verified: 0.75,
    min_factual_for_verified: 0.65,
    contradiction_tolerance_high: 0,
  },
  HISTORICAL: {
    min_structural_for_proposed: 0.45,
    min_structural_for_verified: 0.80,
    min_factual_for_verified: 0.70,
    contradiction_tolerance_high: 0,
  },
  INTERPRETIVE: {
    min_structural_for_proposed: 0.40,
    min_structural_for_verified: 0.70,
    min_factual_for_verified: 0.0,  // factual is low-relevance
    contradiction_tolerance_high: 2, // interpretive conflicts expected
  },
  MODEL: {
    min_structural_for_proposed: 0.50,
    min_structural_for_verified: 0.80,
    min_factual_for_verified: 0.50,
    contradiction_tolerance_high: 0,
  },
  ARTS: {
    min_structural_for_proposed: 0.40,
    min_structural_for_verified: 0.70,
    min_factual_for_verified: 0.55,
    contradiction_tolerance_high: 1,
  },
  DESIGN: {
    min_structural_for_proposed: 0.45,
    min_structural_for_verified: 0.75,
    min_factual_for_verified: 0.60,
    contradiction_tolerance_high: 0,
  },
};

export function getThresholds(epistemicClass) {
  return { ...DEFAULT_THRESHOLDS, ...(DOMAIN_THRESHOLDS[epistemicClass] || {}) };
}

// ── Structural Score (universal — all domains) ───────────────────────────

/**
 * Compute credibility_structural for an Atlas DTU.
 * Measures how well-formed/traceable the DTU is.
 */
export function computeStructuralScore(atlasDtu) {
  const components = [];
  let total = 0;
  let max = 0;

  // 1. Schema completeness (required fields present)
  const schemaScore = scoreSchemaCompleteness(atlasDtu);
  components.push({ name: "schema_completeness", value: schemaScore, weight: 2 });
  total += schemaScore * 2;
  max += 2;

  // 2. Citation presence for FACT claims
  const citationScore = scoreCitationPresence(atlasDtu);
  components.push({ name: "citation_presence", value: citationScore, weight: 3 });
  total += citationScore * 3;
  max += 3;

  // 3. Source tier distribution (primary/secondary)
  const tierScore = scoreSourceTiers(atlasDtu);
  components.push({ name: "source_tier_quality", value: tierScore, weight: 2 });
  total += tierScore * 2;
  max += 2;

  // 4. Assumption disclosure (MODEL)
  if (atlasDtu.epistemicClass === "MODEL") {
    const assumeScore = scoreAssumptionDisclosure(atlasDtu);
    components.push({ name: "assumption_disclosure", value: assumeScore, weight: 2 });
    total += assumeScore * 2;
    max += 2;
  }

  // 5. Provenance completeness (ARTS)
  if (atlasDtu.epistemicClass === "ARTS" || atlasDtu.epistemicClass === "DESIGN") {
    const provScore = scoreProvenanceCompleteness(atlasDtu);
    components.push({ name: "provenance_completeness", value: provScore, weight: 2 });
    total += provScore * 2;
    max += 2;
  }

  // 6. Contradiction links present (even if unresolved)
  const contraScore = (atlasDtu.links?.contradicts?.length > 0) ? 1.0 :
                      (atlasDtu.links?.supports?.length > 0) ? 0.5 : 0.0;
  components.push({ name: "link_awareness", value: contraScore, weight: 1 });
  total += contraScore * 1;
  max += 1;

  // 7. Audit trail presence
  const auditScore = (atlasDtu.audit?.events?.length > 0) ? 1.0 : 0.0;
  components.push({ name: "audit_trail", value: auditScore, weight: 1 });
  total += auditScore * 1;
  max += 1;

  const score = max > 0 ? total / max : 0;
  return { score: Math.round(score * 1000) / 1000, components };
}

function scoreSchemaCompleteness(dtu) {
  let present = 0;
  let required = 6;
  if (dtu.title) present++;
  if (dtu.domainType) present++;
  if (dtu.epistemicClass) present++;
  if (dtu.author?.userId) present++;
  if (dtu.claims?.length > 0) present++;
  if (dtu.tags?.length > 0) present++;
  return present / required;
}

function scoreCitationPresence(dtu) {
  const facts = (dtu.claims || []).filter(c => c.claimType === "FACT");
  if (facts.length === 0) return 1.0; // no facts to cite
  const cited = facts.filter(c => c.sources?.length > 0);
  return cited.length / facts.length;
}

function scoreSourceTiers(dtu) {
  const allSources = [];
  for (const claim of (dtu.claims || [])) {
    for (const src of (claim.sources || [])) {
      allSources.push(src);
    }
  }
  if (allSources.length === 0) return 0;
  const tierWeights = { PRIMARY: 1.0, SECONDARY: 0.7, TERTIARY: 0.4, UNCITED: 0 };
  const sum = allSources.reduce((s, src) => s + (tierWeights[src.sourceTier] || 0), 0);
  return sum / allSources.length;
}

function scoreAssumptionDisclosure(dtu) {
  if (dtu.epistemicClass !== "MODEL") return 1.0;
  const assumptions = dtu.assumptions || [];
  if (assumptions.length === 0) return 0;
  // Check if assumptions have text and sensitivity
  const complete = assumptions.filter(a => a.text && a.sensitivity);
  return complete.length / assumptions.length;
}

function scoreProvenanceCompleteness(dtu) {
  const prov = dtu.provenance || [];
  if (prov.length === 0) return 0;
  const complete = prov.filter(p => p.text && p.sources?.length > 0);
  return complete.length / prov.length;
}

// ── Factual Score (domain-specific) ──────────────────────────────────────

/**
 * Compute confidence_factual for an Atlas DTU.
 * Different logic per epistemic class.
 */
export function computeFactualScore(atlasDtu) {
  const epClass = atlasDtu.epistemicClass;
  switch (epClass) {
    case "FORMAL":       return scoreFormal(atlasDtu);
    case "EMPIRICAL":    return scoreEmpirical(atlasDtu);
    case "HISTORICAL":   return scoreHistorical(atlasDtu);
    case "INTERPRETIVE": return scoreInterpretive(atlasDtu);
    case "MODEL":        return scoreModel(atlasDtu);
    case "ARTS":         return scoreArts(atlasDtu);
    case "DESIGN":       return scoreDesign(atlasDtu);
    default:             return { score: 0, components: [{ name: "unknown_class", value: 0, weight: 1 }] };
  }
}

// ── FORMAL scoring ───────────────────────────────────────────────────────

function scoreFormal(dtu) {
  const components = [];
  let total = 0, max = 0;

  // Proof chain validity
  const proofVerified = dtu.proofVerified === true;
  const proofScore = proofVerified ? 1.0 : 0.2;
  components.push({ name: "proof_verified", value: proofScore, weight: 5 });
  total += proofScore * 5;
  max += 5;

  // Logical consistency (no hard contradictions)
  const contradictions = dtu.links?.contradicts || [];
  const highContra = contradictions.filter(c => c.severity === "HIGH");
  const consistScore = highContra.length > 0 ? 0.0 : 1.0;
  components.push({ name: "logical_consistency", value: consistScore, weight: 4 });
  total += consistScore * 4;
  max += 4;

  // Reproducibility (has examples or formal definitions)
  const claims = dtu.claims || [];
  const hasFormalContent = claims.some(c =>
    c.text?.includes("proof") || c.text?.includes("theorem") ||
    c.text?.includes("∀") || c.text?.includes("∃") || c.text?.includes("⊢")
  );
  const reproScore = hasFormalContent ? 0.8 : 0.3;
  components.push({ name: "formal_content", value: reproScore, weight: 1 });
  total += reproScore * 1;
  max += 1;

  const score = max > 0 ? total / max : 0;
  return { score: Math.round(score * 1000) / 1000, components };
}

// ── EMPIRICAL scoring ────────────────────────────────────────────────────

function scoreEmpirical(dtu) {
  const components = [];
  let total = 0, max = 0;

  // Study tier weight
  const sources = [];
  for (const claim of (dtu.claims || [])) {
    for (const src of (claim.sources || [])) sources.push(src);
  }
  const studyWeights = { PRIMARY: 1.0, SECONDARY: 0.6, TERTIARY: 0.3, UNCITED: 0 };
  const avgStudy = sources.length > 0
    ? sources.reduce((s, src) => s + (studyWeights[src.sourceTier] || 0), 0) / sources.length
    : 0;
  components.push({ name: "study_tier", value: avgStudy, weight: 3 });
  total += avgStudy * 3;
  max += 3;

  // Replication count
  const repCount = dtu.replicationCount || 0;
  const repScore = Math.min(1.0, repCount / 5);
  components.push({ name: "replication", value: repScore, weight: 2 });
  total += repScore * 2;
  max += 2;

  // Sample size proxy (check numeric claims)
  const numericClaims = (dtu.claims || []).filter(c => c.numeric?.length > 0);
  const sampleScore = numericClaims.length > 0 ? 0.7 : 0.2;
  components.push({ name: "sample_data", value: sampleScore, weight: 1 });
  total += sampleScore * 1;
  max += 1;

  // Contradiction penalty
  const contradictions = dtu.links?.contradicts || [];
  const highContra = contradictions.filter(c => c.severity === "HIGH");
  const contraScore = highContra.length > 0 ? 0.2 : 1.0;
  components.push({ name: "contradiction_penalty", value: contraScore, weight: 2 });
  total += contraScore * 2;
  max += 2;

  const score = max > 0 ? total / max : 0;
  return { score: Math.round(score * 1000) / 1000, components };
}

// ── HISTORICAL scoring ───────────────────────────────────────────────────

function scoreHistorical(dtu) {
  const components = [];
  let total = 0, max = 0;

  // Primary sources count
  const allSources = [];
  for (const claim of (dtu.claims || [])) {
    for (const src of (claim.sources || [])) allSources.push(src);
  }
  const primaryCount = allSources.filter(s => s.sourceTier === "PRIMARY").length;
  const primaryScore = Math.min(1.0, primaryCount / 3);
  components.push({ name: "primary_sources", value: primaryScore, weight: 3 });
  total += primaryScore * 3;
  max += 3;

  // Cross-source corroboration (unique publishers)
  const publishers = new Set(allSources.map(s => s.publisher).filter(Boolean));
  const corrobScore = Math.min(1.0, publishers.size / 3);
  components.push({ name: "cross_corroboration", value: corrobScore, weight: 3 });
  total += corrobScore * 3;
  max += 3;

  // Bias notes present (check for interpretations that note bias)
  const biasNotes = (dtu.interpretations || []).filter(i =>
    i.text?.toLowerCase().includes("bias") || i.school?.toLowerCase().includes("perspective")
  );
  const biasScore = biasNotes.length > 0 ? 1.0 : 0.3;
  components.push({ name: "bias_awareness", value: biasScore, weight: 1 });
  total += biasScore * 1;
  max += 1;

  // Contradiction severity
  const contradictions = dtu.links?.contradicts || [];
  const highContra = contradictions.filter(c => c.severity === "HIGH");
  const contraScore = highContra.length === 0 ? 1.0 : Math.max(0, 1.0 - highContra.length * 0.3);
  components.push({ name: "contradiction_severity", value: contraScore, weight: 2 });
  total += contraScore * 2;
  max += 2;

  const score = max > 0 ? total / max : 0;
  return { score: Math.round(score * 1000) / 1000, components };
}

// ── INTERPRETIVE scoring ─────────────────────────────────────────────────

function scoreInterpretive(dtu) {
  const components = [];
  let total = 0, max = 0;

  // Argument structure completeness
  const interps = dtu.interpretations || [];
  const argScore = interps.length > 0 ? Math.min(1.0, interps.length / 2) : 0;
  components.push({ name: "argument_structure", value: argScore, weight: 3 });
  total += argScore * 3;
  max += 3;

  // Citations to recognized works
  const allSources = [];
  for (const claim of (dtu.claims || [])) {
    for (const src of (claim.sources || [])) allSources.push(src);
  }
  for (const interp of interps) {
    for (const src of (interp.sources || [])) allSources.push(src);
  }
  const citScore = Math.min(1.0, allSources.length / 3);
  components.push({ name: "citations", value: citScore, weight: 2 });
  total += citScore * 2;
  max += 2;

  // Counterarguments present
  const hasCounter = interps.some(i =>
    i.text?.toLowerCase().includes("counter") ||
    i.text?.toLowerCase().includes("objection") ||
    i.text?.toLowerCase().includes("however") ||
    i.school?.toLowerCase().includes("opposing")
  );
  const counterScore = hasCounter ? 1.0 : 0.2;
  components.push({ name: "counterarguments", value: counterScore, weight: 2 });
  total += counterScore * 2;
  max += 2;

  const score = max > 0 ? total / max : 0;
  return { score: Math.round(score * 1000) / 1000, components };
}

// ── MODEL scoring ────────────────────────────────────────────────────────

function scoreModel(dtu) {
  const components = [];
  let total = 0, max = 0;

  // Assumptions disclosed
  const assumptions = dtu.assumptions || [];
  const assumeScore = assumptions.length > 0 ? Math.min(1.0, assumptions.length / 3) : 0;
  components.push({ name: "assumptions_disclosed", value: assumeScore, weight: 3 });
  total += assumeScore * 3;
  max += 3;

  // Sensitivity tested
  const hasSensitivity = assumptions.some(a => a.sensitivity === "HIGH" || a.sensitivity === "MEDIUM");
  const sensScore = hasSensitivity ? 0.8 : 0.2;
  components.push({ name: "sensitivity_analysis", value: sensScore, weight: 2 });
  total += sensScore * 2;
  max += 2;

  // Data source traceability
  const allSources = [];
  for (const claim of (dtu.claims || [])) {
    for (const src of (claim.sources || [])) allSources.push(src);
  }
  const traceScore = Math.min(1.0, allSources.length / 2);
  components.push({ name: "data_traceability", value: traceScore, weight: 2 });
  total += traceScore * 2;
  max += 2;

  const score = max > 0 ? total / max : 0;
  return { score: Math.round(score * 1000) / 1000, components };
}

// ── ARTS scoring ─────────────────────────────────────────────────────────

function scoreArts(dtu) {
  const components = [];
  let total = 0, max = 0;

  // Provenance completeness
  const prov = dtu.provenance || [];
  const provScore = prov.length > 0
    ? prov.filter(p => p.sources?.length > 0).length / prov.length
    : 0;
  components.push({ name: "provenance", value: provScore, weight: 3 });
  total += provScore * 3;
  max += 3;

  // Institution catalog sources
  const allSources = [];
  for (const claim of (dtu.claims || [])) {
    for (const src of (claim.sources || [])) allSources.push(src);
  }
  const instSources = allSources.filter(s => s.sourceTier === "PRIMARY");
  const instScore = Math.min(1.0, instSources.length / 2);
  components.push({ name: "institutional_sources", value: instScore, weight: 2 });
  total += instScore * 2;
  max += 2;

  // Quote traceability
  const quotedSources = allSources.filter(s => s.quoteAnchors?.length > 0);
  const quoteScore = allSources.length > 0 ? quotedSources.length / allSources.length : 0;
  components.push({ name: "quote_traceability", value: quoteScore, weight: 1 });
  total += quoteScore * 1;
  max += 1;

  // Interpretation richness (interpretive claims allowed and present)
  const interps = dtu.interpretations || [];
  const interpScore = Math.min(1.0, interps.length / 2);
  components.push({ name: "interpretation_richness", value: interpScore, weight: 1 });
  total += interpScore * 1;
  max += 1;

  const score = max > 0 ? total / max : 0;
  return { score: Math.round(score * 1000) / 1000, components };
}

// ── DESIGN scoring ───────────────────────────────────────────────────────

function scoreDesign(dtu) {
  const components = [];
  let total = 0, max = 0;

  // Spec documentation sources
  const allSources = [];
  for (const claim of (dtu.claims || [])) {
    for (const src of (claim.sources || [])) allSources.push(src);
  }
  const specClaims = (dtu.claims || []).filter(c => c.claimType === "SPEC");
  const specScore = specClaims.length > 0 ? 0.8 : 0.2;
  components.push({ name: "spec_documentation", value: specScore, weight: 3 });
  total += specScore * 3;
  max += 3;

  // Process transparency
  const processClaims = (dtu.claims || []).filter(c =>
    c.text?.toLowerCase().includes("process") ||
    c.text?.toLowerCase().includes("method") ||
    c.text?.toLowerCase().includes("technique")
  );
  const processScore = processClaims.length > 0 ? 0.7 : 0.2;
  components.push({ name: "process_transparency", value: processScore, weight: 2 });
  total += processScore * 2;
  max += 2;

  // Outcome evidence (tests, reviews)
  const outcomeClaims = (dtu.claims || []).filter(c =>
    c.claimType === "RECEPTION" || c.text?.toLowerCase().includes("test") ||
    c.text?.toLowerCase().includes("review") || c.text?.toLowerCase().includes("performance")
  );
  const outcomeScore = outcomeClaims.length > 0 ? 0.7 : 0.2;
  components.push({ name: "outcome_evidence", value: outcomeScore, weight: 2 });
  total += outcomeScore * 2;
  max += 2;

  const score = max > 0 ? total / max : 0;
  return { score: Math.round(score * 1000) / 1000, components };
}

// ── Combined Confidence Computation ──────────────────────────────────────

/**
 * Compute all scores for an Atlas DTU. Returns factual, structural, overall + breakdown.
 */
export function computeAtlasScores(atlasDtu) {
  const structural = computeStructuralScore(atlasDtu);
  const factual = computeFactualScore(atlasDtu);

  // Overall is a weighted combination, domain-specific
  const epClass = atlasDtu.epistemicClass;
  let factualWeight = 0.5;
  let structuralWeight = 0.5;

  switch (epClass) {
    case "FORMAL":
      factualWeight = 0.7; structuralWeight = 0.3; break;
    case "EMPIRICAL":
      factualWeight = 0.6; structuralWeight = 0.4; break;
    case "HISTORICAL":
      factualWeight = 0.5; structuralWeight = 0.5; break;
    case "INTERPRETIVE":
      factualWeight = 0.2; structuralWeight = 0.8; break;
    case "MODEL":
      factualWeight = 0.4; structuralWeight = 0.6; break;
    case "ARTS":
      factualWeight = 0.4; structuralWeight = 0.6; break;
    case "DESIGN":
      factualWeight = 0.5; structuralWeight = 0.5; break;
  }

  const overall = Math.round((factual.score * factualWeight + structural.score * structuralWeight) * 1000) / 1000;

  return {
    confidence_factual: factual.score,
    credibility_structural: structural.score,
    confidence_overall: overall,
    factualBreakdown: factual.components,
    structuralBreakdown: structural.components,
    weights: { factual: factualWeight, structural: structuralWeight },
  };
}

// ── Explainability Payload ───────────────────────────────────────────────

/**
 * Generate "why is this score X?" and "why not verified?" explanations.
 */
export function explainScores(atlasDtu, contradictionCount = { HIGH: 0, MEDIUM: 0, LOW: 0 }) {
  const scores = computeAtlasScores(atlasDtu);
  const thresholds = getThresholds(atlasDtu.epistemicClass);
  const reasons = [];

  // Check structural threshold for proposed
  if (scores.credibility_structural < thresholds.min_structural_for_proposed) {
    reasons.push({
      gate: "structural_for_proposed",
      required: thresholds.min_structural_for_proposed,
      actual: scores.credibility_structural,
      message: `Structural credibility ${scores.credibility_structural} below ${thresholds.min_structural_for_proposed} threshold for PROPOSED`,
    });
  }

  // Check structural threshold for verified
  if (scores.credibility_structural < thresholds.min_structural_for_verified) {
    reasons.push({
      gate: "structural_for_verified",
      required: thresholds.min_structural_for_verified,
      actual: scores.credibility_structural,
      message: `Structural credibility ${scores.credibility_structural} below ${thresholds.min_structural_for_verified} threshold for VERIFIED`,
    });
  }

  // Check factual threshold for verified
  if (scores.confidence_factual < thresholds.min_factual_for_verified) {
    reasons.push({
      gate: "factual_for_verified",
      required: thresholds.min_factual_for_verified,
      actual: scores.confidence_factual,
      message: `Factual confidence ${scores.confidence_factual} below ${thresholds.min_factual_for_verified} threshold for VERIFIED`,
    });
  }

  // Check contradiction gate
  if (contradictionCount.HIGH > thresholds.contradiction_tolerance_high) {
    reasons.push({
      gate: "contradiction_gate",
      maxAllowed: thresholds.contradiction_tolerance_high,
      actual: contradictionCount.HIGH,
      message: `${contradictionCount.HIGH} unresolved HIGH contradictions exceeds tolerance of ${thresholds.contradiction_tolerance_high}`,
    });
  }

  return {
    ...scores,
    whyNotVerified: reasons,
    canBeProposed: scores.credibility_structural >= thresholds.min_structural_for_proposed,
    canBeVerified: reasons.length === 0,
    thresholds,
  };
}

// ── Domain Validator Dispatchers ─────────────────────────────────────────

/**
 * Validate an Atlas DTU against its domain-specific rules.
 * Returns { valid, errors[], warnings[] }
 */
export function validateAtlasDtu(atlasDtu) {
  const errors = [];
  const warnings = [];

  // Universal validations
  if (!atlasDtu.domainType || !DOMAIN_TYPE_SET.has(atlasDtu.domainType)) {
    errors.push(`Invalid domainType: ${atlasDtu.domainType}`);
  }
  if (!atlasDtu.epistemicClass || !EPISTEMIC_CLASS_SET.has(atlasDtu.epistemicClass)) {
    errors.push(`Invalid epistemicClass: ${atlasDtu.epistemicClass}`);
  }
  if (!atlasDtu.title || atlasDtu.title.length < 3) {
    errors.push("Title is required and must be at least 3 characters");
  }
  if (!atlasDtu.author?.userId) {
    errors.push("Author userId is required");
  }

  // FACT claims MUST have sources or be auto-labeled UNCITED_FACT
  for (const claim of (atlasDtu.claims || [])) {
    if (claim.claimType === "FACT" && (!claim.sources || claim.sources.length === 0)) {
      warnings.push(`FACT claim "${(claim.text || "").slice(0, 60)}" has no sources — will be labeled UNCITED_FACT`);
    }
  }

  // MODEL outputs MUST declare assumptions
  if (atlasDtu.epistemicClass === "MODEL") {
    if (!atlasDtu.assumptions || atlasDtu.assumptions.length === 0) {
      errors.push("MODEL DTUs must declare at least one assumption");
    }
  }

  // ARTS attribution/price/date/award claims MUST have provenance
  if (atlasDtu.epistemicClass === "ARTS" || atlasDtu.epistemicClass === "DESIGN") {
    const artsFacts = (atlasDtu.claims || []).filter(c =>
      c.claimType === "FACT" && (
        c.text?.toLowerCase().includes("attributed") ||
        c.text?.toLowerCase().includes("price") ||
        c.text?.toLowerCase().includes("award") ||
        c.text?.toLowerCase().includes("date")
      )
    );
    for (const af of artsFacts) {
      if ((!af.sources || af.sources.length === 0) && (!atlasDtu.provenance || atlasDtu.provenance.length === 0)) {
        warnings.push(`Arts factual claim about attribution/price/date/award lacks provenance: "${(af.text || "").slice(0, 60)}"`);
      }
    }
  }

  // INTERPRETATION never upgrades to factual truth
  const interpClaims = (atlasDtu.claims || []).filter(c => c.claimType === "INTERPRETATION");
  if (interpClaims.some(c => c.evidenceTier === "PROVEN" || c.evidenceTier === "CORROBORATED")) {
    warnings.push("INTERPRETATION claims should not have factual evidence tiers (PROVEN/CORROBORATED)");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Contradiction Type Classification ────────────────────────────────────

export const CONTRADICTION_TYPES = Object.freeze({
  NUMERIC:              "NUMERIC",
  DATE:                 "DATE",
  CAUSAL:               "CAUSAL",
  ATTRIBUTION:          "ATTRIBUTION",
  DEFINITIONAL:         "DEFINITIONAL",
  MODEL_ASSUMPTION:     "MODEL_ASSUMPTION",
  INTERPRETATION_CONFLICT: "INTERPRETATION_CONFLICT",
  PROVENANCE_CHAIN:     "PROVENANCE_CHAIN",
});

export const CONTRADICTION_SEVERITY = Object.freeze({
  LOW:    "LOW",
  MEDIUM: "MEDIUM",
  HIGH:   "HIGH",
});

// ── Domain Compatibility Matrix (for autogen mixing rules) ───────────────

const DOMAIN_COMPATIBILITY = {
  FORMAL:       { FORMAL: true, MODEL: true, EMPIRICAL: false, HISTORICAL: false, INTERPRETIVE: false, ARTS: false, DESIGN: false },
  EMPIRICAL:    { FORMAL: false, MODEL: true, EMPIRICAL: true, HISTORICAL: false, INTERPRETIVE: false, ARTS: false, DESIGN: true },
  HISTORICAL:   { FORMAL: false, MODEL: true, EMPIRICAL: false, HISTORICAL: true, INTERPRETIVE: true, ARTS: true, DESIGN: false },
  INTERPRETIVE: { FORMAL: false, MODEL: false, EMPIRICAL: false, HISTORICAL: true, INTERPRETIVE: true, ARTS: true, DESIGN: false },
  MODEL:        { FORMAL: true, MODEL: true, EMPIRICAL: true, HISTORICAL: true, INTERPRETIVE: false, ARTS: false, DESIGN: true },
  ARTS:         { FORMAL: false, MODEL: false, EMPIRICAL: false, HISTORICAL: true, INTERPRETIVE: true, ARTS: true, DESIGN: true },
  DESIGN:       { FORMAL: false, MODEL: true, EMPIRICAL: true, HISTORICAL: false, INTERPRETIVE: false, ARTS: true, DESIGN: true },
};

/**
 * Check if two epistemic classes can be mixed in autogen synthesis.
 */
export function areDomainsCompatible(classA, classB) {
  return DOMAIN_COMPATIBILITY[classA]?.[classB] === true;
}

// ── Atlas State Initialization ───────────────────────────────────────────

export function initAtlasState(STATE) {
  const es = getEmergentState(STATE);
  if (!es._atlas) {
    es._atlas = {
      dtus: new Map(),            // id → Atlas DTU object
      claims: new Map(),          // dtuId:claimId → claim object
      sources: new Map(),         // canonicalUrl → Set<dtuId>
      links: [],                  // all inter-DTU links
      entities: new Map(),        // entityId → { label, type }
      about: new Map(),           // dtuId → Set<entityId>
      audit: [],                  // all audit events
      autogenRuns: new Map(),     // runId → run object
      autogenOutputs: [],         // output records

      // Indices
      byDomainType: new Map(),    // domainType → Set<dtuId>
      byEpistemicClass: new Map(),// epistemicClass → Set<dtuId>
      byStatus: new Map(),        // status → Set<dtuId>
      byConfidence: [],           // sorted by confidence_overall desc

      // Counters
      metrics: {
        dtusCreated: 0,
        dtusVerified: 0,
        dtusDisputed: 0,
        dtusQuarantined: 0,
        contradictionsLogged: 0,
        autogenRuns: 0,
        validationsPassed: 0,
        validationsFailed: 0,
        scoreComputations: 0,
      },
    };
  }
  return es._atlas;
}

export function getAtlasState(STATE) {
  const es = getEmergentState(STATE);
  return es._atlas || initAtlasState(STATE);
}
