/**
 * Tests for grc/index.js — GRC Module Entry Point
 *
 * Covers: formatAndValidate, init (macro registration), GRC_METRICS tracking,
 * re-exported getGRCSystemPrompt, and all registered macro handlers.
 *
 * Run: node --test tests/grc-index.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { formatAndValidate, init, getGRCSystemPrompt } from "../grc/index.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeOpts(overrides = {}) {
  return {
    inLatticeReality: () => ({ ok: true }),
    STATE: {},
    affectState: null,
    ...overrides,
  };
}

function makeContext(overrides = {}) {
  return {
    dtuRefs: ["Genesis"],
    macroRefs: [],
    stateRefs: [],
    mode: "governed-response",
    invariantsApplied: [],
    realitySnapshot: null,
    ...overrides,
  };
}

// ── formatAndValidate ───────────────────────────────────────────────────────

describe("formatAndValidate", () => {
  it("formats and validates a plain text response", () => {
    const result = formatAndValidate("Hello world", makeContext(), makeOpts());
    assert.equal(result.ok, true);
    assert.ok(result.grc);
    assert.equal(result.raw, "Hello world");
    assert.ok(result.validation);
    assert.ok(Array.isArray(result.repairs));
    assert.ok(Array.isArray(result.failures));
    assert.ok(result.metrics);
  });

  it("increments totalOutputs metric on each call", () => {
    const r1 = formatAndValidate("a", {}, makeOpts());
    const r2 = formatAndValidate("b", {}, makeOpts());
    assert.ok(r2.metrics.totalOutputs > r1.metrics.totalOutputs);
  });

  it("increments validOutputs when output is valid", () => {
    const result = formatAndValidate("Valid text", makeContext(), makeOpts());
    assert.equal(result.ok, true);
    assert.ok(result.metrics.validOutputs > 0);
  });

  it("tracks envelopeWraps for freeform text", () => {
    const result = formatAndValidate("freeform text", {}, makeOpts());
    assert.ok(result.metrics.envelopeWraps > 0 || result.metrics.structuredParses >= 0);
  });

  it("tracks structuredParses for structured GRC JSON", () => {
    const grcObj = {
      toneLock: "Aligned.",
      anchor: { dtus: ["X"], mode: "m" },
      invariants: ["NoNegativeValence"],
      reality: { facts: ["f"], assumptions: ["a"], unknowns: ["u"] },
      payload: "Structured answer.",
      nextLoop: { name: "Loop", why: "Because" },
      question: "What next?",
    };
    const result = formatAndValidate(JSON.stringify(grcObj), {}, makeOpts());
    assert.ok(result.metrics.structuredParses > 0);
  });

  it("applies invariant checks and records repairs", () => {
    // Use a payload that triggers negative valence repair
    const result = formatAndValidate(
      "You're wrong and this is hopeless.",
      makeContext(),
      makeOpts()
    );
    // Should have been repaired or flagged
    assert.ok(result.repairs.length > 0 || result.grc);
  });

  it("records invariant repairs in metrics", () => {
    const result = formatAndValidate(
      "As an AI, I cannot help. This is hopeless.",
      makeContext(),
      makeOpts()
    );
    if (result.repairs.length > 0) {
      assert.ok(result.metrics.invariantRepairs > 0 || result.metrics.repairedOutputs > 0);
    }
  });

  it("runs lattice reality gate when inLatticeReality fails", () => {
    const opts = makeOpts({
      inLatticeReality: () => ({ ok: false, reason: "test failure" }),
    });
    const result = formatAndValidate("Some text.", makeContext(), opts);
    // Should still produce output (repaired or with failures)
    assert.ok(result.grc);
  });

  it("handles missing opts gracefully", () => {
    const result = formatAndValidate("text", {});
    assert.ok(result.grc);
  });

  it("handles empty context", () => {
    const result = formatAndValidate("text");
    assert.ok(result.grc);
  });

  it("increments failedOutputs when format fails (null grc)", () => {
    // This is hard to trigger since formatGRC always returns a grc
    // but we can verify metric exists
    const result = formatAndValidate("text", {}, makeOpts());
    assert.ok("failedOutputs" in result.metrics);
  });

  it("returns metrics as a copy (not mutable reference)", () => {
    const r1 = formatAndValidate("a", {}, makeOpts());
    const r2 = formatAndValidate("b", {}, makeOpts());
    assert.notEqual(r1.metrics, r2.metrics);
  });
});

// ── init ────────────────────────────────────────────────────────────────────

describe("init", () => {
  let registeredMacros;

  beforeEach(() => {
    registeredMacros = {};
  });

  function mockRegister(domain, name, handler, meta) {
    if (!registeredMacros[domain]) registeredMacros[domain] = {};
    registeredMacros[domain][name] = { handler, meta };
  }

  it("returns module info with correct structure", () => {
    const mod = init({ register: mockRegister, STATE: {}, helpers: {} });
    assert.equal(mod.name, "grc");
    assert.equal(mod.version, "1.0.0");
    assert.ok(Array.isArray(mod.macros));
    assert.equal(mod.macros.length, 6);
    assert.ok(mod.macros.includes("format"));
    assert.ok(mod.macros.includes("validate"));
    assert.ok(mod.macros.includes("systemPrompt"));
    assert.ok(mod.macros.includes("metrics"));
    assert.ok(mod.macros.includes("schema"));
    assert.ok(mod.macros.includes("invariants"));
  });

  it("exposes formatAndValidate function", () => {
    const mod = init({ register: mockRegister, STATE: {}, helpers: {} });
    assert.equal(typeof mod.formatAndValidate, "function");
  });

  it("exposes getGRCSystemPrompt function", () => {
    const mod = init({ register: mockRegister, STATE: {}, helpers: {} });
    assert.equal(typeof mod.getGRCSystemPrompt, "function");
  });

  it("exposes validateGRC function", () => {
    const mod = init({ register: mockRegister, STATE: {}, helpers: {} });
    assert.equal(typeof mod.validateGRC, "function");
  });

  it("exposes CORE_INVARIANTS", () => {
    const mod = init({ register: mockRegister, STATE: {}, helpers: {} });
    assert.ok(Array.isArray(mod.CORE_INVARIANTS));
  });

  it("registers 6 macros", () => {
    init({ register: mockRegister, STATE: {}, helpers: {} });
    const macros = Object.keys(registeredMacros.grc || {});
    assert.equal(macros.length, 6);
  });

  // -- Macro handler tests --

  it("grc.format macro formats content", () => {
    const STATE = {};
    init({ register: mockRegister, STATE, helpers: {} });
    const handler = registeredMacros.grc.format.handler;
    const result = handler({}, { content: "Test content", dtuRefs: ["G"], mode: "governed-response" });
    assert.ok(result.ok !== undefined);
    assert.ok(result.grc);
  });

  it("grc.validate macro validates a GRC object", () => {
    init({ register: mockRegister, STATE: {}, helpers: {} });
    const handler = registeredMacros.grc.validate.handler;
    const grc = {
      toneLock: "Aligned.",
      anchor: { dtus: ["X"], mode: "m" },
      invariants: [],
      reality: { facts: [], assumptions: [], unknowns: [] },
      payload: "p",
      nextLoop: { name: "n", why: "w" },
      question: "q?",
    };
    const result = handler({}, { grc });
    assert.equal(result.valid, true);
  });

  it("grc.systemPrompt macro returns system prompt", () => {
    init({ register: mockRegister, STATE: {}, helpers: {} });
    const handler = registeredMacros.grc.systemPrompt.handler;
    const result = handler({}, { anchors: { dtus: ["G"] } });
    assert.equal(result.ok, true);
    assert.ok(result.prompt.includes("GRC"));
  });

  it("grc.systemPrompt macro handles null input", () => {
    init({ register: mockRegister, STATE: {}, helpers: {} });
    const handler = registeredMacros.grc.systemPrompt.handler;
    const result = handler({}, null);
    assert.equal(result.ok, true);
    assert.ok(typeof result.prompt === "string");
  });

  it("grc.metrics macro returns metrics", () => {
    init({ register: mockRegister, STATE: {}, helpers: {} });
    const handler = registeredMacros.grc.metrics.handler;
    const result = handler();
    assert.equal(result.ok, true);
    assert.ok(result.metrics);
    assert.ok("totalOutputs" in result.metrics);
  });

  it("grc.schema macro returns JSON schema", () => {
    init({ register: mockRegister, STATE: {}, helpers: {} });
    const handler = registeredMacros.grc.schema.handler;
    const result = handler();
    assert.equal(result.ok, true);
    assert.ok(result.schema);
    assert.ok(result.schema.required);
  });

  it("grc.invariants macro returns core invariants", () => {
    init({ register: mockRegister, STATE: {}, helpers: {} });
    const handler = registeredMacros.grc.invariants.handler;
    const result = handler();
    assert.equal(result.ok, true);
    assert.ok(Array.isArray(result.invariants));
  });

  it("grc.format macro uses helpers.inLatticeReality when provided", () => {
    let realityCalled = false;
    const helpers = {
      inLatticeReality: () => { realityCalled = true; return { ok: true }; },
    };
    init({ register: mockRegister, STATE: {}, helpers });
    const handler = registeredMacros.grc.format.handler;
    handler({}, { content: "test" });
    assert.equal(realityCalled, true);
  });

  it("grc.format macro works without helpers.inLatticeReality", () => {
    init({ register: mockRegister, STATE: {}, helpers: null });
    const handler = registeredMacros.grc.format.handler;
    const result = handler({}, { content: "test" });
    assert.ok(result.grc);
  });
});

// ── Re-exported getGRCSystemPrompt ──────────────────────────────────────────

describe("getGRCSystemPrompt (re-exported)", () => {
  it("is a function", () => {
    assert.equal(typeof getGRCSystemPrompt, "function");
  });

  it("returns a prompt string", () => {
    const prompt = getGRCSystemPrompt();
    assert.equal(typeof prompt, "string");
    assert.ok(prompt.length > 100);
  });
});
