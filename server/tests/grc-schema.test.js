/**
 * Tests for grc/schema.js — GRC v1 Schema & Validation
 *
 * Covers: GRC_JSON_SCHEMA, TONE_LOCK_OPENERS, FORBIDDEN_PATTERNS,
 * WORD_LIMITS, validateGRC, countPreambleWords, countClosureWords.
 *
 * Run: node --test tests/grc-schema.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  GRC_JSON_SCHEMA,
  TONE_LOCK_OPENERS,
  FORBIDDEN_PATTERNS,
  WORD_LIMITS,
  validateGRC,
  countPreambleWords,
  countClosureWords,
} from "../grc/schema.js";

// ── Helper: minimal valid GRC output ────────────────────────────────────────

function validGRC(overrides = {}) {
  return {
    toneLock: "Aligned.",
    anchor: { dtus: ["Genesis"], macros: [], stateRefs: [], mode: "governed-response" },
    invariants: ["NoNegativeValence", "RealityGateBeforeEffects"],
    reality: { facts: ["f1"], assumptions: ["a1"], unknowns: ["u1"] },
    payload: "This is a valid payload.",
    nextLoop: { name: "Loop", why: "Because we need to." },
    question: "What should we do next?",
    ...overrides,
  };
}

// ── Exported Constants ─────────────────────────────────────────────────────

describe("GRC_JSON_SCHEMA", () => {
  it("is an object with required fields", () => {
    assert.equal(GRC_JSON_SCHEMA.type, "object");
    assert.ok(Array.isArray(GRC_JSON_SCHEMA.required));
    assert.ok(GRC_JSON_SCHEMA.required.includes("toneLock"));
    assert.ok(GRC_JSON_SCHEMA.required.includes("anchor"));
    assert.ok(GRC_JSON_SCHEMA.required.includes("invariants"));
    assert.ok(GRC_JSON_SCHEMA.required.includes("reality"));
    assert.ok(GRC_JSON_SCHEMA.required.includes("payload"));
    assert.ok(GRC_JSON_SCHEMA.required.includes("nextLoop"));
    assert.ok(GRC_JSON_SCHEMA.required.includes("question"));
  });

  it("defines properties for all required fields", () => {
    for (const field of GRC_JSON_SCHEMA.required) {
      assert.ok(field in GRC_JSON_SCHEMA.properties, `Missing property: ${field}`);
    }
  });
});

describe("TONE_LOCK_OPENERS", () => {
  it("is a non-empty array of strings", () => {
    assert.ok(Array.isArray(TONE_LOCK_OPENERS));
    assert.ok(TONE_LOCK_OPENERS.length >= 4);
    for (const t of TONE_LOCK_OPENERS) {
      assert.equal(typeof t, "string");
    }
  });

  it("contains known openers", () => {
    assert.ok(TONE_LOCK_OPENERS.includes("Acknowledged."));
    assert.ok(TONE_LOCK_OPENERS.includes("Aligned."));
    assert.ok(TONE_LOCK_OPENERS.includes("Grounded."));
  });
});

describe("FORBIDDEN_PATTERNS", () => {
  it("is a non-empty array of RegExp", () => {
    assert.ok(Array.isArray(FORBIDDEN_PATTERNS));
    assert.ok(FORBIDDEN_PATTERNS.length > 0);
    for (const p of FORBIDDEN_PATTERNS) {
      assert.ok(p instanceof RegExp);
    }
  });

  it("matches known forbidden phrases", () => {
    assert.ok(FORBIDDEN_PATTERNS.some(p => p.test("As an AI")));
    assert.ok(FORBIDDEN_PATTERNS.some(p => p.test("I'm just an AI")));
    assert.ok(FORBIDDEN_PATTERNS.some(p => p.test("great question")));
    assert.ok(FORBIDDEN_PATTERNS.some(p => p.test("to summarize:")));
    assert.ok(FORBIDDEN_PATTERNS.some(p => p.test("that's a great point")));
    assert.ok(FORBIDDEN_PATTERNS.some(p => p.test("here's what I think")));
    assert.ok(FORBIDDEN_PATTERNS.some(p => p.test("let me clarify")));
    assert.ok(FORBIDDEN_PATTERNS.some(p => p.test("I don't have the ability")));
  });
});

describe("WORD_LIMITS", () => {
  it("has expected numeric limits", () => {
    assert.equal(WORD_LIMITS.preambleMax, 120);
    assert.equal(WORD_LIMITS.closureMax, 50);
    assert.equal(WORD_LIMITS.toneLockMax, 6);
    assert.equal(WORD_LIMITS.invariantsMin, 0);
    assert.equal(WORD_LIMITS.invariantsMax, 12);
  });
});

// ── validateGRC ─────────────────────────────────────────────────────────────

describe("validateGRC", () => {
  it("validates a correct GRC object", () => {
    const result = validateGRC(validGRC());
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it("returns errors array and warnings array", () => {
    const result = validateGRC(validGRC());
    assert.ok(Array.isArray(result.errors));
    assert.ok(Array.isArray(result.warnings));
  });

  // -- null/non-object --

  it("rejects null", () => {
    const result = validateGRC(null);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("must be an object")));
  });

  it("rejects undefined", () => {
    const result = validateGRC(undefined);
    assert.equal(result.valid, false);
  });

  it("rejects a non-object (string)", () => {
    const result = validateGRC("string");
    assert.equal(result.valid, false);
  });

  // -- Missing required fields --

  it("rejects object missing all required fields", () => {
    const result = validateGRC({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.length >= 7);
  });

  it("rejects object missing only toneLock", () => {
    const obj = validGRC();
    delete obj.toneLock;
    const result = validateGRC(obj);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("toneLock")));
  });

  it("rejects object missing only payload", () => {
    const obj = validGRC();
    delete obj.payload;
    const result = validateGRC(obj);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("payload")));
  });

  // -- Section 0: Tone Lock --

  it("rejects non-string toneLock", () => {
    const result = validateGRC(validGRC({ toneLock: 123 }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("toneLock must be a string")));
  });

  it("rejects toneLock exceeding 60 chars", () => {
    const result = validateGRC(validGRC({ toneLock: "A".repeat(61) }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("60 chars")));
  });

  it("rejects toneLock exceeding 6 words", () => {
    const result = validateGRC(validGRC({ toneLock: "One two three four five six seven" }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("6 words")));
  });

  it("accepts toneLock with exactly 6 words", () => {
    const result = validateGRC(validGRC({ toneLock: "One two three four five six" }));
    assert.equal(result.valid, true);
  });

  // -- Section 1: Anchor --

  it("rejects non-object anchor", () => {
    const result = validateGRC(validGRC({ anchor: "not-an-obj" }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("anchor must be an object")));
  });

  it("rejects null anchor", () => {
    const result = validateGRC(validGRC({ anchor: null }));
    assert.equal(result.valid, false);
  });

  it("rejects anchor with no anchors at all", () => {
    const result = validateGRC(validGRC({ anchor: {} }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("at least 1 anchor")));
  });

  it("rejects anchor with empty arrays and no mode", () => {
    const result = validateGRC(validGRC({ anchor: { dtus: [], macros: [], stateRefs: [], mode: "" } }));
    assert.equal(result.valid, false);
  });

  it("accepts anchor with only dtus", () => {
    const result = validateGRC(validGRC({ anchor: { dtus: ["X"] } }));
    assert.equal(result.valid, true);
  });

  it("accepts anchor with only macros", () => {
    const result = validateGRC(validGRC({ anchor: { macros: ["m"] } }));
    assert.equal(result.valid, true);
  });

  it("accepts anchor with only stateRefs", () => {
    const result = validateGRC(validGRC({ anchor: { stateRefs: ["s"] } }));
    assert.equal(result.valid, true);
  });

  it("accepts anchor with only mode", () => {
    const result = validateGRC(validGRC({ anchor: { mode: "m" } }));
    assert.equal(result.valid, true);
  });

  // -- Section 2: Invariants --

  it("rejects non-array invariants", () => {
    const result = validateGRC(validGRC({ invariants: "str" }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("invariants must be an array")));
  });

  it("rejects invariants exceeding max 12", () => {
    const big = Array.from({ length: 13 }, (_, i) => `Inv${i}`);
    const result = validateGRC(validGRC({ invariants: big }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("max 12")));
  });

  it("rejects invariants with non-string elements", () => {
    const result = validateGRC(validGRC({ invariants: [123, "a"] }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("must be a string")));
  });

  it("accepts empty invariants array", () => {
    const result = validateGRC(validGRC({ invariants: [] }));
    assert.equal(result.valid, true);
  });

  // -- Section 3: Reality --

  it("rejects non-object reality", () => {
    const result = validateGRC(validGRC({ reality: "str" }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("reality must be an object")));
  });

  it("rejects null reality", () => {
    const result = validateGRC(validGRC({ reality: null }));
    assert.equal(result.valid, false);
  });

  it("rejects reality missing facts", () => {
    const result = validateGRC(validGRC({ reality: { assumptions: [], unknowns: [] } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("reality.facts")));
  });

  it("rejects reality missing assumptions", () => {
    const result = validateGRC(validGRC({ reality: { facts: [], unknowns: [] } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("reality.assumptions")));
  });

  it("rejects reality missing unknowns", () => {
    const result = validateGRC(validGRC({ reality: { facts: [], assumptions: [] } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("reality.unknowns")));
  });

  // -- Section 4: Payload --

  it("rejects non-string payload", () => {
    const result = validateGRC(validGRC({ payload: 123 }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("payload must be a string")));
  });

  it("accepts empty string payload", () => {
    const result = validateGRC(validGRC({ payload: "" }));
    assert.equal(result.valid, true);
  });

  // -- Section 5: Next Loop --

  it("rejects non-object nextLoop", () => {
    const result = validateGRC(validGRC({ nextLoop: "str" }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("nextLoop must be an object")));
  });

  it("rejects null nextLoop", () => {
    const result = validateGRC(validGRC({ nextLoop: null }));
    assert.equal(result.valid, false);
  });

  it("rejects nextLoop with missing name", () => {
    const result = validateGRC(validGRC({ nextLoop: { why: "w" } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("nextLoop.name is required")));
  });

  it("rejects nextLoop with empty string name", () => {
    const result = validateGRC(validGRC({ nextLoop: { name: "", why: "w" } }));
    assert.equal(result.valid, false);
  });

  it("rejects nextLoop.name exceeding 80 chars", () => {
    const result = validateGRC(validGRC({ nextLoop: { name: "X".repeat(81), why: "w" } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("80 chars")));
  });

  it("rejects nextLoop with missing why", () => {
    const result = validateGRC(validGRC({ nextLoop: { name: "n" } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("nextLoop.why is required")));
  });

  it("rejects nextLoop with empty string why", () => {
    const result = validateGRC(validGRC({ nextLoop: { name: "n", why: "" } }));
    assert.equal(result.valid, false);
  });

  it("rejects nextLoop.why exceeding 180 chars", () => {
    const result = validateGRC(validGRC({ nextLoop: { name: "n", why: "W".repeat(181) } }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("180 chars")));
  });

  it("rejects non-string nextLoop.name", () => {
    const result = validateGRC(validGRC({ nextLoop: { name: 123, why: "w" } }));
    assert.equal(result.valid, false);
  });

  it("rejects non-string nextLoop.why", () => {
    const result = validateGRC(validGRC({ nextLoop: { name: "n", why: 123 } }));
    assert.equal(result.valid, false);
  });

  // -- Section 6: Question --

  it("rejects non-string question", () => {
    const result = validateGRC(validGRC({ question: 123 }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("question must be a string")));
  });

  it("rejects question exceeding 220 chars", () => {
    const result = validateGRC(validGRC({ question: "Q".repeat(221) }));
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes("220 chars")));
  });

  it("warns when question does not contain '?'", () => {
    const result = validateGRC(validGRC({ question: "No question mark here" }));
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some(w => w.includes("?")));
  });

  // -- Word count warnings --

  it("warns when preamble exceeds 120 words", () => {
    const longFacts = Array.from({ length: 30 }, (_, i) => `This is a fact number ${i} with extra words`);
    const result = validateGRC(validGRC({
      reality: { facts: longFacts, assumptions: longFacts, unknowns: longFacts },
    }));
    assert.ok(result.warnings.some(w => w.includes("Sections 0-3")));
  });

  it("warns when closure exceeds 50 words", () => {
    const longWhy = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const result = validateGRC(validGRC({
      nextLoop: { name: "Loop name with many words here", why: longWhy },
      question: "This question also has many words to push over the limit?",
    }));
    assert.ok(result.warnings.some(w => w.includes("Sections 5-6")));
  });

  // -- Forbidden pattern warnings --

  it("warns when payload contains a forbidden pattern", () => {
    const result = validateGRC(validGRC({ payload: "As an AI, I cannot help." }));
    assert.ok(result.warnings.some(w => w.includes("forbidden pattern")));
  });

  it("no forbidden pattern warning for clean payload", () => {
    const result = validateGRC(validGRC({ payload: "Clean and helpful content." }));
    assert.ok(!result.warnings.some(w => w.includes("forbidden pattern")));
  });
});

// ── countPreambleWords ──────────────────────────────────────────────────────

describe("countPreambleWords", () => {
  it("counts words in toneLock, anchor, invariants, reality", () => {
    const count = countPreambleWords(validGRC());
    assert.ok(count > 0);
    assert.equal(typeof count, "number");
  });

  it("handles missing anchor", () => {
    const count = countPreambleWords({ toneLock: "Aligned.", invariants: [], reality: null });
    assert.equal(typeof count, "number");
  });

  it("handles missing reality", () => {
    const count = countPreambleWords({ toneLock: "Aligned.", anchor: {}, invariants: [] });
    assert.equal(typeof count, "number");
  });

  it("handles null/undefined toneLock", () => {
    const count = countPreambleWords({});
    assert.equal(typeof count, "number");
  });

  it("handles empty strings and arrays", () => {
    const count = countPreambleWords({
      toneLock: "",
      anchor: { dtus: [], macros: [], stateRefs: [], mode: "" },
      invariants: [],
      reality: { facts: [], assumptions: [], unknowns: [] },
    });
    assert.equal(count, 0);
  });
});

// ── countClosureWords ───────────────────────────────────────────────────────

describe("countClosureWords", () => {
  it("counts words in nextLoop and question", () => {
    const count = countClosureWords(validGRC());
    assert.ok(count > 0);
  });

  it("handles missing nextLoop", () => {
    const count = countClosureWords({ question: "Q?" });
    assert.equal(typeof count, "number");
  });

  it("handles missing question", () => {
    const count = countClosureWords({ nextLoop: { name: "n", why: "w" } });
    assert.equal(typeof count, "number");
  });

  it("returns 0 for empty object", () => {
    const count = countClosureWords({});
    assert.equal(count, 0);
  });
});
