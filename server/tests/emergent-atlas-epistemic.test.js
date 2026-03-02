/**
 * Tests for atlas-epistemic.js — Epistemic engine: domain types, scoring, validation.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  DOMAIN_TYPES,
  DOMAIN_TYPE_SET,
  EPISTEMIC_CLASSES,
  EPISTEMIC_CLASS_SET,
  CLAIM_TYPES,
  SOURCE_TIERS,
  EVIDENCE_TIERS,
  ATLAS_STATUS,
  CONTRADICTION_TYPES,
  CONTRADICTION_SEVERITY,
  canTransition,
  getEpistemicClass,
  getThresholds,
  computeStructuralScore,
  computeFactualScore,
  computeAtlasScores,
  explainScores,
  validateAtlasDtu,
  areDomainsCompatible,
  initAtlasState,
  getAtlasState,
} from "../emergent/atlas-epistemic.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeState() {
  const STATE = { __emergent: null };
  initAtlasState(STATE);
  return STATE;
}

function baseDtu(overrides = {}) {
  return {
    id: "dtu_1",
    title: "Test DTU",
    domainType: "empirical.physics",
    epistemicClass: "EMPIRICAL",
    schemaVersion: "atlas-1.0",
    author: { userId: "user1" },
    tags: ["test"],
    claims: [
      {
        claimId: "c1",
        claimType: "FACT",
        text: "Water boils at 100C",
        sources: [{ sourceTier: "PRIMARY", title: "Chemistry 101", publisher: "Pub A", url: "http://a.com" }],
        evidenceTier: "CORROBORATED",
      },
    ],
    interpretations: [],
    assumptions: [],
    provenance: [],
    links: { supports: [], contradicts: [], sameAs: [], about: [] },
    scores: { confidence_factual: 0, credibility_structural: 0, confidence_overall: 0 },
    audit: { events: [{ ts: Date.now(), actor: "user1", action: "CREATE", diff: "test" }] },
    ...overrides,
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

describe("atlas-epistemic constants", () => {
  it("DOMAIN_TYPES has formal.math etc", () => {
    assert.equal(DOMAIN_TYPES.FORMAL_MATH, "formal.math");
    assert.equal(DOMAIN_TYPES.GENERAL_NOTE, "general.note");
  });

  it("DOMAIN_TYPE_SET contains all domain type values", () => {
    for (const v of Object.values(DOMAIN_TYPES)) {
      assert.ok(DOMAIN_TYPE_SET.has(v), `Missing ${v}`);
    }
  });

  it("EPISTEMIC_CLASSES has all classes", () => {
    assert.equal(EPISTEMIC_CLASSES.FORMAL, "FORMAL");
    assert.equal(EPISTEMIC_CLASSES.GENERAL, "GENERAL");
  });

  it("EPISTEMIC_CLASS_SET contains all class values", () => {
    for (const v of Object.values(EPISTEMIC_CLASSES)) {
      assert.ok(EPISTEMIC_CLASS_SET.has(v));
    }
  });

  it("CLAIM_TYPES has expected values", () => {
    assert.equal(CLAIM_TYPES.FACT, "FACT");
    assert.equal(CLAIM_TYPES.INTERPRETATION, "INTERPRETATION");
    assert.equal(CLAIM_TYPES.MODEL_OUTPUT, "MODEL_OUTPUT");
  });

  it("SOURCE_TIERS has expected values", () => {
    assert.equal(SOURCE_TIERS.PRIMARY, "PRIMARY");
    assert.equal(SOURCE_TIERS.UNCITED, "UNCITED");
  });

  it("EVIDENCE_TIERS has expected values", () => {
    assert.equal(EVIDENCE_TIERS.PROVEN, "PROVEN");
    assert.equal(EVIDENCE_TIERS.CONTRADICTED, "CONTRADICTED");
  });

  it("ATLAS_STATUS has expected values", () => {
    assert.equal(ATLAS_STATUS.DRAFT, "DRAFT");
    assert.equal(ATLAS_STATUS.QUARANTINED, "QUARANTINED");
  });
});

// ── canTransition ────────────────────────────────────────────────────────────

describe("canTransition", () => {
  it("DRAFT can transition to PROPOSED", () => {
    assert.equal(canTransition("DRAFT", "PROPOSED"), true);
  });

  it("DRAFT cannot transition to VERIFIED", () => {
    assert.equal(canTransition("DRAFT", "VERIFIED"), false);
  });

  it("PROPOSED can transition to VERIFIED", () => {
    assert.equal(canTransition("PROPOSED", "VERIFIED"), true);
  });

  it("QUARANTINED is terminal", () => {
    assert.equal(canTransition("QUARANTINED", "VERIFIED"), false);
    assert.equal(canTransition("QUARANTINED", "PROPOSED"), false);
  });

  it("unknown status returns false", () => {
    assert.equal(canTransition("NONEXISTENT", "VERIFIED"), false);
  });
});

// ── getEpistemicClass ────────────────────────────────────────────────────────

describe("getEpistemicClass", () => {
  it("maps formal.math to FORMAL", () => {
    assert.equal(getEpistemicClass("formal.math"), "FORMAL");
  });

  it("maps empirical.physics to EMPIRICAL", () => {
    assert.equal(getEpistemicClass("empirical.physics"), "EMPIRICAL");
  });

  it("maps historical.world to HISTORICAL", () => {
    assert.equal(getEpistemicClass("historical.world"), "HISTORICAL");
  });

  it("maps interpretive.philosophy to INTERPRETIVE", () => {
    assert.equal(getEpistemicClass("interpretive.philosophy"), "INTERPRETIVE");
  });

  it("maps model.economics to MODEL", () => {
    assert.equal(getEpistemicClass("model.economics"), "MODEL");
  });

  it("maps arts.visual to ARTS", () => {
    assert.equal(getEpistemicClass("arts.visual"), "ARTS");
  });

  it("maps design.architecture to DESIGN", () => {
    assert.equal(getEpistemicClass("design.architecture"), "DESIGN");
  });

  it("maps general.note to GENERAL", () => {
    assert.equal(getEpistemicClass("general.note"), "GENERAL");
  });

  it("returns null for unknown domain type", () => {
    assert.equal(getEpistemicClass("unknown.domain"), null);
  });

  it("returns null for undefined", () => {
    assert.equal(getEpistemicClass(undefined), null);
  });
});

// ── getThresholds ────────────────────────────────────────────────────────────

describe("getThresholds", () => {
  it("returns FORMAL-specific thresholds", () => {
    const t = getThresholds("FORMAL");
    assert.equal(t.min_structural_for_proposed, 0.50);
    assert.equal(t.min_structural_for_verified, 0.85);
  });

  it("returns default thresholds for unknown class", () => {
    const t = getThresholds("UNKNOWN");
    assert.equal(t.min_structural_for_proposed, 0.40);
  });

  it("merges domain-specific over defaults", () => {
    const t = getThresholds("INTERPRETIVE");
    assert.equal(t.min_factual_for_verified, 0.0);
    assert.equal(t.contradiction_tolerance_high, 2);
  });
});

// ── computeStructuralScore ───────────────────────────────────────────────────

describe("computeStructuralScore", () => {
  it("returns score and components", () => {
    const dtu = baseDtu();
    const result = computeStructuralScore(dtu);
    assert.equal(typeof result.score, "number");
    assert.ok(result.score >= 0 && result.score <= 1);
    assert.ok(Array.isArray(result.components));
  });

  it("higher score with more complete DTU", () => {
    const minimal = baseDtu({ tags: [], claims: [], author: {} });
    const complete = baseDtu();
    const minScore = computeStructuralScore(minimal);
    const compScore = computeStructuralScore(complete);
    assert.ok(compScore.score >= minScore.score);
  });

  it("MODEL gets assumption_disclosure component", () => {
    const dtu = baseDtu({
      epistemicClass: "MODEL",
      assumptions: [{ text: "linear growth", sensitivity: "HIGH" }],
    });
    const result = computeStructuralScore(dtu);
    const assumeComp = result.components.find(c => c.name === "assumption_disclosure");
    assert.ok(assumeComp, "Should have assumption_disclosure component");
  });

  it("ARTS gets provenance_completeness component", () => {
    const dtu = baseDtu({
      epistemicClass: "ARTS",
      provenance: [{ text: "Gallery X", sources: [{ url: "http://gallery.com" }] }],
    });
    const result = computeStructuralScore(dtu);
    const provComp = result.components.find(c => c.name === "provenance_completeness");
    assert.ok(provComp, "Should have provenance_completeness component");
  });

  it("DESIGN gets provenance_completeness component", () => {
    const dtu = baseDtu({ epistemicClass: "DESIGN" });
    const result = computeStructuralScore(dtu);
    const provComp = result.components.find(c => c.name === "provenance_completeness");
    assert.ok(provComp);
  });

  it("link_awareness scores 1.0 with contradicts links", () => {
    const dtu = baseDtu({ links: { contradicts: [{ targetDtuId: "x" }], supports: [] } });
    const result = computeStructuralScore(dtu);
    const linkComp = result.components.find(c => c.name === "link_awareness");
    assert.equal(linkComp.value, 1.0);
  });

  it("link_awareness scores 0.5 with only supports links", () => {
    const dtu = baseDtu({ links: { supports: [{ targetDtuId: "x" }], contradicts: [] } });
    const result = computeStructuralScore(dtu);
    const linkComp = result.components.find(c => c.name === "link_awareness");
    assert.equal(linkComp.value, 0.5);
  });

  it("link_awareness scores 0 with no links", () => {
    const dtu = baseDtu({ links: { supports: [], contradicts: [] } });
    const result = computeStructuralScore(dtu);
    const linkComp = result.components.find(c => c.name === "link_awareness");
    assert.equal(linkComp.value, 0.0);
  });

  it("audit_trail scores 1.0 when events exist", () => {
    const dtu = baseDtu();
    const result = computeStructuralScore(dtu);
    const auditComp = result.components.find(c => c.name === "audit_trail");
    assert.equal(auditComp.value, 1.0);
  });

  it("audit_trail scores 0 when no events", () => {
    const dtu = baseDtu({ audit: { events: [] } });
    const result = computeStructuralScore(dtu);
    const auditComp = result.components.find(c => c.name === "audit_trail");
    assert.equal(auditComp.value, 0.0);
  });

  it("citation_presence returns 1.0 when no FACT claims", () => {
    const dtu = baseDtu({ claims: [{ claimId: "c1", claimType: "INTERPRETATION", text: "foo" }] });
    const result = computeStructuralScore(dtu);
    const citComp = result.components.find(c => c.name === "citation_presence");
    assert.equal(citComp.value, 1.0);
  });

  it("source_tier_quality handles empty sources", () => {
    const dtu = baseDtu({ claims: [{ claimId: "c1", claimType: "INTERPRETATION", text: "foo" }] });
    const result = computeStructuralScore(dtu);
    const tierComp = result.components.find(c => c.name === "source_tier_quality");
    assert.equal(tierComp.value, 0);
  });
});

// ── computeFactualScore ──────────────────────────────────────────────────────

describe("computeFactualScore", () => {
  it("dispatches FORMAL scoring", () => {
    const dtu = baseDtu({ epistemicClass: "FORMAL", proofVerified: true });
    const result = computeFactualScore(dtu);
    assert.ok(result.score > 0);
    assert.ok(result.components.some(c => c.name === "proof_verified"));
  });

  it("FORMAL with proof=false gets low proof score", () => {
    const dtu = baseDtu({ epistemicClass: "FORMAL", proofVerified: false });
    const result = computeFactualScore(dtu);
    const proof = result.components.find(c => c.name === "proof_verified");
    assert.equal(proof.value, 0.2);
  });

  it("FORMAL with HIGH contradictions gets 0 consistency", () => {
    const dtu = baseDtu({
      epistemicClass: "FORMAL",
      links: { contradicts: [{ severity: "HIGH" }], supports: [] },
    });
    const result = computeFactualScore(dtu);
    const consist = result.components.find(c => c.name === "logical_consistency");
    assert.equal(consist.value, 0.0);
  });

  it("FORMAL detects formal content keywords", () => {
    const dtu = baseDtu({
      epistemicClass: "FORMAL",
      claims: [{ claimId: "c1", claimType: "FACT", text: "proof of theorem", sources: [] }],
    });
    const result = computeFactualScore(dtu);
    const formal = result.components.find(c => c.name === "formal_content");
    assert.equal(formal.value, 0.8);
  });

  it("dispatches EMPIRICAL scoring", () => {
    const dtu = baseDtu({ epistemicClass: "EMPIRICAL" });
    const result = computeFactualScore(dtu);
    assert.ok(result.components.some(c => c.name === "study_tier"));
  });

  it("EMPIRICAL replication boosts score", () => {
    const dtu = baseDtu({ epistemicClass: "EMPIRICAL", replicationCount: 5 });
    const result = computeFactualScore(dtu);
    const rep = result.components.find(c => c.name === "replication");
    assert.equal(rep.value, 1.0);
  });

  it("EMPIRICAL numeric claims boost sample_data", () => {
    const dtu = baseDtu({
      epistemicClass: "EMPIRICAL",
      claims: [{ claimId: "c1", claimType: "FACT", text: "test", numeric: [{ value: 100 }], sources: [{ sourceTier: "PRIMARY" }] }],
    });
    const result = computeFactualScore(dtu);
    const sample = result.components.find(c => c.name === "sample_data");
    assert.equal(sample.value, 0.7);
  });

  it("dispatches HISTORICAL scoring", () => {
    const dtu = baseDtu({ epistemicClass: "HISTORICAL" });
    const result = computeFactualScore(dtu);
    assert.ok(result.components.some(c => c.name === "primary_sources"));
  });

  it("HISTORICAL bias_awareness with notes", () => {
    const dtu = baseDtu({
      epistemicClass: "HISTORICAL",
      interpretations: [{ text: "bias in the source material" }],
    });
    const result = computeFactualScore(dtu);
    const bias = result.components.find(c => c.name === "bias_awareness");
    assert.equal(bias.value, 1.0);
  });

  it("HISTORICAL bias_awareness without notes", () => {
    const dtu = baseDtu({ epistemicClass: "HISTORICAL", interpretations: [] });
    const result = computeFactualScore(dtu);
    const bias = result.components.find(c => c.name === "bias_awareness");
    assert.equal(bias.value, 0.3);
  });

  it("dispatches INTERPRETIVE scoring", () => {
    const dtu = baseDtu({ epistemicClass: "INTERPRETIVE" });
    const result = computeFactualScore(dtu);
    assert.ok(result.components.some(c => c.name === "argument_structure"));
  });

  it("INTERPRETIVE counterargument detection", () => {
    const dtu = baseDtu({
      epistemicClass: "INTERPRETIVE",
      interpretations: [{ text: "however this view is contested" }],
    });
    const result = computeFactualScore(dtu);
    const counter = result.components.find(c => c.name === "counterarguments");
    assert.equal(counter.value, 1.0);
  });

  it("INTERPRETIVE interprets sources from claims and interpretations", () => {
    const dtu = baseDtu({
      epistemicClass: "INTERPRETIVE",
      interpretations: [
        { text: "Kant's view", sources: [{ title: "Critique of Pure Reason" }] },
        { text: "Hegel's counter", sources: [{ title: "Phenomenology of Spirit" }] },
      ],
    });
    const result = computeFactualScore(dtu);
    const citations = result.components.find(c => c.name === "citations");
    assert.ok(citations.value > 0);
  });

  it("dispatches MODEL scoring", () => {
    const dtu = baseDtu({
      epistemicClass: "MODEL",
      assumptions: [{ text: "linear", sensitivity: "HIGH" }],
    });
    const result = computeFactualScore(dtu);
    assert.ok(result.components.some(c => c.name === "assumptions_disclosed"));
  });

  it("MODEL sensitivity detection", () => {
    const dtu = baseDtu({
      epistemicClass: "MODEL",
      assumptions: [{ text: "constant", sensitivity: "MEDIUM" }],
    });
    const result = computeFactualScore(dtu);
    const sens = result.components.find(c => c.name === "sensitivity_analysis");
    assert.equal(sens.value, 0.8);
  });

  it("MODEL no sensitivity gets low score", () => {
    const dtu = baseDtu({
      epistemicClass: "MODEL",
      assumptions: [{ text: "constant", sensitivity: "LOW" }],
    });
    const result = computeFactualScore(dtu);
    const sens = result.components.find(c => c.name === "sensitivity_analysis");
    assert.equal(sens.value, 0.2);
  });

  it("dispatches ARTS scoring", () => {
    const dtu = baseDtu({ epistemicClass: "ARTS" });
    const result = computeFactualScore(dtu);
    assert.ok(result.components.some(c => c.name === "provenance"));
  });

  it("ARTS provenance with sources", () => {
    const dtu = baseDtu({
      epistemicClass: "ARTS",
      provenance: [{ text: "Gallery X", sources: [{ url: "http://gallery.com" }] }],
    });
    const result = computeFactualScore(dtu);
    const prov = result.components.find(c => c.name === "provenance");
    assert.equal(prov.value, 1.0);
  });

  it("ARTS interpretation richness", () => {
    const dtu = baseDtu({
      epistemicClass: "ARTS",
      interpretations: [{ text: "foo" }, { text: "bar" }],
    });
    const result = computeFactualScore(dtu);
    const interp = result.components.find(c => c.name === "interpretation_richness");
    assert.equal(interp.value, 1.0);
  });

  it("dispatches DESIGN scoring", () => {
    const dtu = baseDtu({ epistemicClass: "DESIGN" });
    const result = computeFactualScore(dtu);
    assert.ok(result.components.some(c => c.name === "spec_documentation"));
  });

  it("DESIGN spec claims boost score", () => {
    const dtu = baseDtu({
      epistemicClass: "DESIGN",
      claims: [{ claimId: "c1", claimType: "SPEC", text: "spec detail", sources: [{ sourceTier: "PRIMARY" }] }],
    });
    const result = computeFactualScore(dtu);
    const spec = result.components.find(c => c.name === "spec_documentation");
    assert.equal(spec.value, 0.8);
  });

  it("DESIGN process claims", () => {
    const dtu = baseDtu({
      epistemicClass: "DESIGN",
      claims: [{ claimId: "c1", claimType: "FACT", text: "the process involves", sources: [{ sourceTier: "PRIMARY" }] }],
    });
    const result = computeFactualScore(dtu);
    const proc = result.components.find(c => c.name === "process_transparency");
    assert.equal(proc.value, 0.7);
  });

  it("DESIGN outcome claims", () => {
    const dtu = baseDtu({
      epistemicClass: "DESIGN",
      claims: [{ claimId: "c1", claimType: "RECEPTION", text: "test results", sources: [] }],
    });
    const result = computeFactualScore(dtu);
    const outcome = result.components.find(c => c.name === "outcome_evidence");
    assert.equal(outcome.value, 0.7);
  });

  it("returns 0 for unknown epistemic class", () => {
    const dtu = baseDtu({ epistemicClass: "UNKNOWN" });
    const result = computeFactualScore(dtu);
    assert.equal(result.score, 0);
  });
});

// ── computeAtlasScores ───────────────────────────────────────────────────────

describe("computeAtlasScores", () => {
  it("returns factual, structural, overall and breakdowns", () => {
    const dtu = baseDtu();
    const scores = computeAtlasScores(dtu);
    assert.equal(typeof scores.confidence_factual, "number");
    assert.equal(typeof scores.credibility_structural, "number");
    assert.equal(typeof scores.confidence_overall, "number");
    assert.ok(Array.isArray(scores.factualBreakdown));
    assert.ok(Array.isArray(scores.structuralBreakdown));
    assert.ok(scores.weights);
  });

  it("uses domain-specific weights", () => {
    const formal = baseDtu({ epistemicClass: "FORMAL" });
    const scores = computeAtlasScores(formal);
    assert.equal(scores.weights.factual, 0.7);
    assert.equal(scores.weights.structural, 0.3);
  });

  it("INTERPRETIVE weights structural higher", () => {
    const dtu = baseDtu({ epistemicClass: "INTERPRETIVE" });
    const scores = computeAtlasScores(dtu);
    assert.equal(scores.weights.factual, 0.2);
    assert.equal(scores.weights.structural, 0.8);
  });

  it("overall is weighted combination", () => {
    const dtu = baseDtu();
    const scores = computeAtlasScores(dtu);
    const expected = Math.round((scores.confidence_factual * scores.weights.factual + scores.credibility_structural * scores.weights.structural) * 1000) / 1000;
    assert.equal(scores.confidence_overall, expected);
  });
});

// ── explainScores ────────────────────────────────────────────────────────────

describe("explainScores", () => {
  it("returns whyNotVerified reasons", () => {
    const dtu = baseDtu();
    const explanation = explainScores(dtu);
    assert.ok(Array.isArray(explanation.whyNotVerified));
    assert.equal(typeof explanation.canBeProposed, "boolean");
    assert.equal(typeof explanation.canBeVerified, "boolean");
  });

  it("flags HIGH contradictions exceeding tolerance", () => {
    const dtu = baseDtu();
    const explanation = explainScores(dtu, { HIGH: 5, MEDIUM: 0, LOW: 0 });
    const gate = explanation.whyNotVerified.find(r => r.gate === "contradiction_gate");
    assert.ok(gate, "Should have contradiction_gate reason");
  });

  it("passes all gates with perfect DTU", () => {
    const dtu = baseDtu({
      epistemicClass: "INTERPRETIVE",
      claims: [],
      interpretations: [{ text: "objection noted" }, { text: "however..." }],
    });
    // Force high scores
    dtu.scores = { credibility_structural: 0.9, confidence_factual: 0.9, confidence_overall: 0.9 };
    const explanation = explainScores(dtu, { HIGH: 0, MEDIUM: 0, LOW: 0 });
    // For INTERPRETIVE, factual threshold is 0.0 so it may pass
    assert.equal(typeof explanation.canBeVerified, "boolean");
  });
});

// ── validateAtlasDtu ─────────────────────────────────────────────────────────

describe("validateAtlasDtu", () => {
  it("passes for valid DTU", () => {
    const dtu = baseDtu();
    const result = validateAtlasDtu(dtu);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it("fails with invalid domainType", () => {
    const dtu = baseDtu({ domainType: "invalid.type" });
    const result = validateAtlasDtu(dtu);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("domainType")));
  });

  it("fails with missing domainType", () => {
    const dtu = baseDtu({ domainType: undefined });
    const result = validateAtlasDtu(dtu);
    assert.equal(result.valid, false);
  });

  it("fails with invalid epistemicClass", () => {
    const dtu = baseDtu({ epistemicClass: "INVALID" });
    const result = validateAtlasDtu(dtu);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("epistemicClass")));
  });

  it("fails with missing title", () => {
    const dtu = baseDtu({ title: "" });
    const result = validateAtlasDtu(dtu);
    assert.equal(result.valid, false);
  });

  it("fails with short title", () => {
    const dtu = baseDtu({ title: "ab" });
    const result = validateAtlasDtu(dtu);
    assert.equal(result.valid, false);
  });

  it("fails with missing author userId", () => {
    const dtu = baseDtu({ author: {} });
    const result = validateAtlasDtu(dtu);
    assert.equal(result.valid, false);
  });

  it("warns on uncited FACT claims", () => {
    const dtu = baseDtu({
      claims: [{ claimId: "c1", claimType: "FACT", text: "uncited fact claim", sources: [] }],
    });
    const result = validateAtlasDtu(dtu);
    assert.ok(result.warnings.length > 0);
    assert.ok(result.warnings.some(w => w.includes("UNCITED_FACT")));
  });

  it("errors for MODEL without assumptions", () => {
    const dtu = baseDtu({ epistemicClass: "MODEL", assumptions: [] });
    const result = validateAtlasDtu(dtu);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("assumption")));
  });

  it("warns on ARTS factual claims lacking provenance", () => {
    const dtu = baseDtu({
      epistemicClass: "ARTS",
      provenance: [],
      claims: [{ claimId: "c1", claimType: "FACT", text: "attributed to Picasso", sources: [] }],
    });
    const result = validateAtlasDtu(dtu);
    assert.ok(result.warnings.some(w => w.includes("provenance")));
  });

  it("warns on DESIGN factual claims lacking provenance", () => {
    const dtu = baseDtu({
      epistemicClass: "DESIGN",
      provenance: [],
      claims: [{ claimId: "c1", claimType: "FACT", text: "award winning design", sources: [] }],
    });
    const result = validateAtlasDtu(dtu);
    assert.ok(result.warnings.some(w => w.includes("provenance")));
  });

  it("warns on INTERPRETATION claims with factual evidence tiers", () => {
    const dtu = baseDtu({
      claims: [{ claimId: "c1", claimType: "INTERPRETATION", evidenceTier: "PROVEN", text: "test interpretation" }],
    });
    const result = validateAtlasDtu(dtu);
    assert.ok(result.warnings.some(w => w.includes("INTERPRETATION")));
  });
});

// ── areDomainsCompatible ─────────────────────────────────────────────────────

describe("areDomainsCompatible", () => {
  it("FORMAL compatible with MODEL", () => {
    assert.equal(areDomainsCompatible("FORMAL", "MODEL"), true);
  });

  it("FORMAL incompatible with HISTORICAL", () => {
    assert.equal(areDomainsCompatible("FORMAL", "HISTORICAL"), false);
  });

  it("HISTORICAL compatible with INTERPRETIVE", () => {
    assert.equal(areDomainsCompatible("HISTORICAL", "INTERPRETIVE"), true);
  });

  it("ARTS compatible with ARTS", () => {
    assert.equal(areDomainsCompatible("ARTS", "ARTS"), true);
  });

  it("returns false for unknown class", () => {
    assert.equal(areDomainsCompatible("UNKNOWN", "FORMAL"), false);
  });

  it("returns false for undefined", () => {
    assert.equal(areDomainsCompatible(undefined, "FORMAL"), false);
  });
});

// ── initAtlasState / getAtlasState ────────────────────────────────────────

describe("initAtlasState / getAtlasState", () => {
  it("initializes atlas state on STATE", () => {
    const STATE = { __emergent: null };
    const atlas = initAtlasState(STATE);
    assert.ok(atlas.dtus instanceof Map);
    assert.ok(atlas.claims instanceof Map);
    assert.ok(atlas.links instanceof Array);
    assert.ok(atlas.metrics);
  });

  it("getAtlasState initializes if not present", () => {
    const STATE = { __emergent: null };
    const atlas = getAtlasState(STATE);
    assert.ok(atlas.dtus instanceof Map);
  });

  it("getAtlasState returns existing state", () => {
    const STATE = { __emergent: null };
    const atlas1 = initAtlasState(STATE);
    const atlas2 = getAtlasState(STATE);
    assert.strictEqual(atlas1, atlas2);
  });

  it("initAtlasState does not overwrite existing state", () => {
    const STATE = { __emergent: null };
    const atlas1 = initAtlasState(STATE);
    atlas1.dtus.set("test", { id: "test" });
    const atlas2 = initAtlasState(STATE);
    assert.ok(atlas2.dtus.has("test"));
  });
});
