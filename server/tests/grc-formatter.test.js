/**
 * Tests for grc/formatter.js — GRC v1 Formatter
 *
 * Covers: formatGRC, getGRCSystemPrompt, and all internal helpers
 * (tryParseGRC, enrichGRC, buildGRCEnvelope, cleanPayload, inferNextLoop, inferQuestion).
 *
 * Run: node --test tests/grc-formatter.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { formatGRC, getGRCSystemPrompt } from "../grc/formatter.js";

// ── formatGRC ──────────────────────────────────────────────────────────────

describe("formatGRC", () => {
  // -- Freeform text wrapping (no JSON) --

  it("wraps plain text into a GRC envelope with defaults", () => {
    const result = formatGRC("Hello world");
    assert.equal(result.ok, true);
    assert.equal(result.raw, "Hello world");
    assert.ok(result.grc);
    assert.equal(result.grc.toneLock, "Aligned.");
    assert.deepStrictEqual(result.grc.anchor.dtus, ["general-context"]);
    assert.deepStrictEqual(result.grc.anchor.macros, []);
    assert.deepStrictEqual(result.grc.anchor.stateRefs, []);
    assert.equal(result.grc.anchor.mode, "governed-response");
    assert.ok(result.grc.invariants.includes("NoNegativeValence"));
    assert.ok(result.grc.invariants.includes("RealityGateBeforeEffects"));
    assert.ok(result.grc.reality);
    assert.ok(Array.isArray(result.grc.reality.facts));
    assert.ok(Array.isArray(result.grc.reality.assumptions));
    assert.ok(Array.isArray(result.grc.reality.unknowns));
    assert.equal(typeof result.grc.payload, "string");
    assert.ok(result.grc.nextLoop);
    assert.equal(typeof result.grc.question, "string");
    assert.ok(result.validation);
  });

  it("uses provided context for envelope: dtuRefs, macroRefs, stateRefs, mode", () => {
    const ctx = {
      dtuRefs: ["Genesis", "Chicken2 Laws"],
      macroRefs: ["domain.action"],
      stateRefs: ["key1"],
      mode: "custom-mode",
      invariantsApplied: ["CustomInv"],
      realitySnapshot: { facts: ["f"], assumptions: ["a"], unknowns: ["u"] },
    };
    const result = formatGRC("Some answer", ctx);
    assert.equal(result.ok, true);
    assert.deepStrictEqual(result.grc.anchor.dtus, ["Genesis", "Chicken2 Laws"]);
    assert.deepStrictEqual(result.grc.anchor.macros, ["domain.action"]);
    assert.deepStrictEqual(result.grc.anchor.stateRefs, ["key1"]);
    assert.equal(result.grc.anchor.mode, "custom-mode");
    assert.ok(result.grc.invariants.includes("CustomInv"));
    assert.deepStrictEqual(result.grc.reality, ctx.realitySnapshot);
  });

  it("infers nextLoop for DTU context when dtuRefs provided", () => {
    const result = formatGRC("text", { dtuRefs: ["Genesis"] });
    assert.equal(result.grc.nextLoop.name, "DTU Context Deepening");
    assert.ok(result.grc.nextLoop.why.includes("1"));
  });

  it("infers nextLoop for lattice discovery when no dtuRefs", () => {
    const result = formatGRC("text", { dtuRefs: [] });
    assert.equal(result.grc.nextLoop.name, "Lattice Anchor Discovery");
  });

  it("infers question for dtuRefs present", () => {
    const result = formatGRC("text", { dtuRefs: ["G"] });
    assert.ok(result.grc.question.includes("DTU"));
  });

  it("infers question for no dtuRefs", () => {
    const result = formatGRC("text");
    assert.ok(result.grc.question.includes("lattice"));
  });

  it("builds reality.facts referencing DTU count when dtuRefs provided and no snapshot", () => {
    const result = formatGRC("text", { dtuRefs: ["A", "B"] });
    assert.ok(result.grc.reality.facts.some(f => f.includes("2")));
  });

  it("builds reality.facts with no DTU context when no dtuRefs and no snapshot", () => {
    const result = formatGRC("text", { dtuRefs: [] });
    assert.ok(result.grc.reality.facts.some(f => f.includes("No specific DTU")));
  });

  it("deduplicates invariants applied from context", () => {
    const result = formatGRC("text", {
      invariantsApplied: ["NoNegativeValence", "Extra"],
    });
    const inv = result.grc.invariants;
    const dupes = inv.filter(i => i === "NoNegativeValence");
    assert.equal(dupes.length, 1, "No duplicates expected");
    assert.ok(inv.includes("Extra"));
  });

  // -- Structured JSON parsing --

  it("parses structured GRC JSON from raw output", () => {
    const grcObj = {
      toneLock: "Aligned.",
      anchor: { dtus: ["Genesis"], macros: [], mode: "governed-response" },
      invariants: ["NoNegativeValence"],
      reality: { facts: ["f"], assumptions: ["a"], unknowns: ["u"] },
      payload: "The answer.",
      nextLoop: { name: "Loop", why: "Because" },
      question: "What next?",
    };
    const raw = JSON.stringify(grcObj);
    const result = formatGRC(raw);
    assert.equal(result.ok, true);
    assert.equal(result.grc.payload, "The answer.");
    assert.equal(result.grc.toneLock, "Aligned.");
  });

  it("parses GRC JSON inside markdown code fences", () => {
    const grcObj = {
      toneLock: "Confirmed.",
      anchor: { dtus: ["X"], mode: "m" },
      invariants: [],
      reality: { facts: [], assumptions: [], unknowns: [] },
      payload: "Fenced answer.",
      nextLoop: { name: "L", why: "W" },
      question: "Q?",
    };
    const raw = "```json\n" + JSON.stringify(grcObj) + "\n```";
    const result = formatGRC(raw);
    assert.equal(result.ok, true);
    assert.equal(result.grc.payload, "Fenced answer.");
  });

  it("parses GRC JSON with prefix/suffix text", () => {
    const grcObj = {
      toneLock: "Proceeding.",
      anchor: { dtus: ["Y"], mode: "m" },
      invariants: [],
      reality: { facts: [], assumptions: [], unknowns: [] },
      payload: "Embedded answer.",
      nextLoop: { name: "L", why: "W" },
      question: "Q?",
    };
    const raw = "Here is the output: " + JSON.stringify(grcObj) + " Done.";
    const result = formatGRC(raw);
    assert.equal(result.ok, true);
    assert.equal(result.grc.payload, "Embedded answer.");
  });

  it("falls back to envelope for JSON that lacks GRC shape", () => {
    const raw = JSON.stringify({ foo: "bar" });
    const result = formatGRC(raw);
    assert.equal(result.ok, true);
    assert.equal(result.grc.toneLock, "Aligned."); // envelope default
  });

  it("falls back to envelope for invalid JSON", () => {
    const raw = "{broken json}}}}";
    const result = formatGRC(raw);
    assert.equal(result.ok, true);
    assert.equal(result.grc.toneLock, "Aligned.");
  });

  it("falls back to envelope when no JSON boundaries found", () => {
    const raw = "just plain text with no braces";
    const result = formatGRC(raw);
    assert.equal(result.ok, true);
    assert.equal(result.grc.toneLock, "Aligned.");
  });

  it("handles null/undefined raw content via tryParseGRC returning null", () => {
    const result = formatGRC(null);
    assert.equal(result.ok, true);
    assert.equal(result.grc.payload, "");
  });

  it("handles empty string raw content", () => {
    const result = formatGRC("");
    assert.equal(result.ok, true);
    assert.equal(result.grc.payload, "");
  });

  it("handles non-string raw content (number)", () => {
    const result = formatGRC(12345);
    assert.equal(result.ok, true);
  });

  // -- enrichGRC branch coverage --

  it("enriches GRC: adds missing anchor.dtus from context", () => {
    const grcObj = {
      toneLock: "Aligned.",
      anchor: {},
      payload: "p",
      nextLoop: { name: "n", why: "w" },
      question: "q?",
    };
    const raw = JSON.stringify(grcObj);
    const result = formatGRC(raw, { dtuRefs: ["D1"] });
    assert.deepStrictEqual(result.grc.anchor.dtus, ["D1"]);
  });

  it("enriches GRC: adds missing anchor.macros from context", () => {
    const grcObj = {
      toneLock: "Aligned.",
      anchor: { dtus: ["X"], mode: "m" },
      payload: "p",
      nextLoop: { name: "n", why: "w" },
      question: "q?",
    };
    const raw = JSON.stringify(grcObj);
    const result = formatGRC(raw, { macroRefs: ["macro.do"] });
    assert.deepStrictEqual(result.grc.anchor.macros, ["macro.do"]);
  });

  it("enriches GRC: adds missing anchor.mode from context", () => {
    const grcObj = {
      toneLock: "Aligned.",
      anchor: { dtus: ["X"] },
      payload: "p",
      nextLoop: { name: "n", why: "w" },
      question: "q?",
    };
    const raw = JSON.stringify(grcObj);
    const result = formatGRC(raw, { mode: "custom-mode" });
    assert.equal(result.grc.anchor.mode, "custom-mode");
  });

  it("enriches GRC: does NOT overwrite existing anchor fields", () => {
    const grcObj = {
      toneLock: "Aligned.",
      anchor: { dtus: ["Existing"], macros: ["existingMacro"], mode: "existing-mode" },
      payload: "p",
      nextLoop: { name: "n", why: "w" },
      question: "q?",
    };
    const raw = JSON.stringify(grcObj);
    const result = formatGRC(raw, { dtuRefs: ["New"], macroRefs: ["newMacro"], mode: "new-mode" });
    assert.deepStrictEqual(result.grc.anchor.dtus, ["Existing"]);
    assert.deepStrictEqual(result.grc.anchor.macros, ["existingMacro"]);
    assert.equal(result.grc.anchor.mode, "existing-mode");
  });

  it("enriches GRC: sets toneLock default when missing", () => {
    const grcObj = {
      anchor: { dtus: ["X"], mode: "m" },
      payload: "p",
      nextLoop: { name: "n", why: "w" },
      question: "q?",
    };
    const raw = JSON.stringify(grcObj);
    const result = formatGRC(raw);
    assert.equal(result.grc.toneLock, "Aligned.");
  });

  it("enriches GRC: sets reality from context.realitySnapshot", () => {
    const snap = { facts: ["fact1"], assumptions: ["a1"], unknowns: ["u1"] };
    const grcObj = {
      toneLock: "Aligned.",
      anchor: { dtus: ["X"], mode: "m" },
      payload: "p",
      nextLoop: { name: "n", why: "w" },
      question: "q?",
    };
    const raw = JSON.stringify(grcObj);
    const result = formatGRC(raw, { realitySnapshot: snap });
    assert.deepStrictEqual(result.grc.reality, snap);
  });

  it("enriches GRC: sets reality to default when no snapshot", () => {
    const grcObj = {
      toneLock: "Aligned.",
      anchor: { dtus: ["X"], mode: "m" },
      payload: "p",
      nextLoop: { name: "n", why: "w" },
      question: "q?",
    };
    const raw = JSON.stringify(grcObj);
    const result = formatGRC(raw);
    assert.ok(result.grc.reality);
    assert.ok(Array.isArray(result.grc.reality.facts));
  });

  it("enriches GRC: merges invariantsApplied without duplicates", () => {
    const grcObj = {
      toneLock: "Aligned.",
      anchor: { dtus: ["X"], mode: "m" },
      invariants: ["ExistingInv"],
      payload: "p",
      nextLoop: { name: "n", why: "w" },
      question: "q?",
    };
    const raw = JSON.stringify(grcObj);
    const result = formatGRC(raw, { invariantsApplied: ["ExistingInv", "NewInv"] });
    assert.ok(result.grc.invariants.includes("ExistingInv"));
    assert.ok(result.grc.invariants.includes("NewInv"));
    assert.equal(result.grc.invariants.filter(i => i === "ExistingInv").length, 1);
  });

  it("enriches GRC: converts non-array invariants to array", () => {
    const grcObj = {
      toneLock: "Aligned.",
      anchor: { dtus: ["X"], mode: "m" },
      invariants: "not-an-array",
      payload: "p",
      nextLoop: { name: "n", why: "w" },
      question: "q?",
    };
    const raw = JSON.stringify(grcObj);
    const result = formatGRC(raw, { invariantsApplied: ["Inv1"] });
    assert.ok(Array.isArray(result.grc.invariants));
    assert.ok(result.grc.invariants.includes("Inv1"));
  });

  // -- cleanPayload --

  it("cleans forbidden patterns from payload", () => {
    const raw = "As an AI, I think this is great. The answer is 42.";
    const result = formatGRC(raw);
    assert.ok(!result.grc.payload.includes("As an AI"));
  });

  it("collapses multiple newlines in payload", () => {
    const raw = "Line 1\n\n\n\n\nLine 2";
    const result = formatGRC(raw);
    assert.ok(!result.grc.payload.includes("\n\n\n"));
  });

  // -- tryParseGRC: payload + nextLoop path --

  it("recognizes GRC JSON with payload + nextLoop (no toneLock/anchor)", () => {
    const grcObj = {
      payload: "answer",
      nextLoop: { name: "n", why: "w" },
      invariants: [],
      reality: { facts: [], assumptions: [], unknowns: [] },
      anchor: { dtus: [], mode: "m" },
      question: "q?",
    };
    const raw = JSON.stringify(grcObj);
    const result = formatGRC(raw);
    assert.equal(result.grc.payload, "answer");
  });

  it("handles JSON where end brace comes before start brace (malformed)", () => {
    const raw = "} some text {";
    const result = formatGRC(raw);
    // Should fall back to envelope
    assert.equal(result.grc.toneLock, "Aligned.");
  });
});

// ── getGRCSystemPrompt ────────────────────────────────────────────────────

describe("getGRCSystemPrompt", () => {
  it("returns a system prompt string", () => {
    const prompt = getGRCSystemPrompt();
    assert.equal(typeof prompt, "string");
    assert.ok(prompt.includes("GRC"));
    assert.ok(prompt.includes("general-context"));
  });

  it("includes DTU references when provided", () => {
    const prompt = getGRCSystemPrompt({ dtus: ["Genesis", "Chicken2 Laws"] });
    assert.ok(prompt.includes("Genesis"));
    assert.ok(prompt.includes("Chicken2 Laws"));
  });

  it("uses general-context when no dtus provided", () => {
    const prompt = getGRCSystemPrompt({});
    assert.ok(prompt.includes("general-context"));
  });

  it("uses general-context when dtus is empty", () => {
    const prompt = getGRCSystemPrompt({ dtus: [] });
    assert.ok(prompt.includes("general-context"));
  });

  it("defaults when no argument", () => {
    const prompt = getGRCSystemPrompt();
    assert.ok(prompt.includes("general-context"));
    assert.ok(prompt.includes("governed-response"));
  });

  it("includes hard rules in the prompt", () => {
    const prompt = getGRCSystemPrompt();
    assert.ok(prompt.includes("HARD RULES"));
    assert.ok(prompt.includes("NoSaaSMinimizeRegression"));
    assert.ok(prompt.includes("toneLock"));
    assert.ok(prompt.includes("payload"));
    assert.ok(prompt.includes("nextLoop"));
  });
});
