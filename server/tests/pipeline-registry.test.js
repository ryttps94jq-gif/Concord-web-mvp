/**
 * Pipeline Registry Test Suite
 *
 * Tests the pipeline registry for autonomous end-to-end pipelines:
 *   - PIPELINE_REGISTRY pre-registered pipelines
 *   - registerPipeline() custom pipeline registration
 *   - detectPipeline() chat intent matching with variable extraction
 *   - resolveInputMapping() $variable resolution with dot-path and templates
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  PIPELINE_REGISTRY,
  registerPipeline,
  detectPipeline,
  resolveInputMapping,
} from "../lib/pipeline-registry.js";

// ── PIPELINE_REGISTRY ───────────────────────────────────────────────────────

describe("PIPELINE_REGISTRY", () => {
  it("is a Map instance", () => {
    assert.ok(PIPELINE_REGISTRY instanceof Map);
  });

  it("contains pre-registered pipelines", () => {
    assert.ok(PIPELINE_REGISTRY.size >= 4);
  });

  it("has chronic-diagnosis pipeline", () => {
    const p = PIPELINE_REGISTRY.get("chronic-diagnosis");
    assert.ok(p);
    assert.equal(p.id, "chronic-diagnosis");
    assert.ok(p.steps.length >= 3);
    assert.equal(p.consentRequired, true);
  });

  it("has start-business pipeline", () => {
    const p = PIPELINE_REGISTRY.get("start-business");
    assert.ok(p);
    assert.equal(p.id, "start-business");
    assert.ok(p.steps.length >= 3);
  });

  it("has move-to-new-city pipeline", () => {
    const p = PIPELINE_REGISTRY.get("move-to-new-city");
    assert.ok(p);
    assert.ok(p.steps.length >= 3);
  });

  it("has new-baby pipeline", () => {
    const p = PIPELINE_REGISTRY.get("new-baby");
    assert.ok(p);
    assert.ok(p.steps.length >= 4);
  });

  it("all pipelines have required fields", () => {
    for (const [id, p] of PIPELINE_REGISTRY) {
      assert.equal(p.id, id, `Pipeline ${id} id mismatch`);
      assert.ok(p.trigger, `Pipeline ${id} missing trigger`);
      assert.ok(Array.isArray(p.steps), `Pipeline ${id} steps not array`);
      assert.ok(p.steps.length > 0, `Pipeline ${id} has no steps`);
      assert.ok(p.description, `Pipeline ${id} missing description`);
    }
  });

  it("all pipeline steps have order, lens, and action", () => {
    for (const [id, p] of PIPELINE_REGISTRY) {
      for (const step of p.steps) {
        assert.ok(typeof step.order === "number", `Pipeline ${id} step missing order`);
        assert.ok(step.lens, `Pipeline ${id} step ${step.order} missing lens`);
        assert.ok(step.action, `Pipeline ${id} step ${step.order} missing action`);
      }
    }
  });

  it("all pipeline triggers have patterns", () => {
    for (const [id, p] of PIPELINE_REGISTRY) {
      if (p.trigger.type === "chat_intent") {
        assert.ok(Array.isArray(p.trigger.patterns), `Pipeline ${id} missing patterns`);
        assert.ok(p.trigger.patterns.length > 0, `Pipeline ${id} has no patterns`);
        for (const pat of p.trigger.patterns) {
          assert.ok(pat instanceof RegExp, `Pipeline ${id} pattern not RegExp`);
        }
      }
    }
  });
});

// ── registerPipeline ────────────────────────────────────────────────────────

describe("registerPipeline", () => {
  it("registers a new pipeline", () => {
    const before = PIPELINE_REGISTRY.size;
    registerPipeline({
      id: "__test_custom_pipeline__",
      trigger: { type: "chat_intent", patterns: [/test custom pipeline/i] },
      steps: [{ order: 1, lens: "test", action: "run" }],
      description: "Custom test pipeline",
    });

    assert.equal(PIPELINE_REGISTRY.has("__test_custom_pipeline__"), true);
    assert.ok(PIPELINE_REGISTRY.size >= before);

    // Cleanup
    PIPELINE_REGISTRY.delete("__test_custom_pipeline__");
  });

  it("overwrites pipeline with same id", () => {
    registerPipeline({
      id: "__test_overwrite__",
      trigger: { type: "chat_intent", patterns: [/test/i] },
      steps: [{ order: 1, lens: "a", action: "b" }],
      description: "v1",
    });
    registerPipeline({
      id: "__test_overwrite__",
      trigger: { type: "chat_intent", patterns: [/test2/i] },
      steps: [{ order: 1, lens: "c", action: "d" }],
      description: "v2",
    });

    const p = PIPELINE_REGISTRY.get("__test_overwrite__");
    assert.equal(p.description, "v2");

    // Cleanup
    PIPELINE_REGISTRY.delete("__test_overwrite__");
  });
});

// ── detectPipeline ──────────────────────────────────────────────────────────

describe("detectPipeline", () => {
  it("returns null for non-matching prompts", () => {
    const result = detectPipeline("what's the weather like today?");
    assert.equal(result, null);
  });

  it("detects chronic-diagnosis pipeline with variable extraction", () => {
    const result = detectPipeline("I was just diagnosed with diabetes");
    assert.ok(result);
    assert.equal(result.pipeline.id, "chronic-diagnosis");
    assert.equal(result.variables.condition, "diabetes");
  });

  it("detects chronic-diagnosis with 'doctor said' pattern", () => {
    const result = detectPipeline("my doctor said i have hypertension");
    assert.ok(result);
    assert.equal(result.pipeline.id, "chronic-diagnosis");
    assert.equal(result.variables.condition, "hypertension");
  });

  it("detects chronic-diagnosis with 'just found out' pattern", () => {
    const result = detectPipeline("just found out i have celiac disease");
    assert.ok(result);
    assert.equal(result.pipeline.id, "chronic-diagnosis");
    assert.equal(result.variables.condition, "celiac disease");
  });

  it("detects start-business pipeline", () => {
    const result = detectPipeline("I'm starting a business selling furniture");
    assert.ok(result);
    assert.equal(result.pipeline.id, "start-business");
  });

  it("detects start-business with 'want to launch' pattern", () => {
    const result = detectPipeline("I want to launch my company");
    assert.ok(result);
    assert.equal(result.pipeline.id, "start-business");
  });

  it("detects move-to-new-city pipeline with city extraction", () => {
    const result = detectPipeline("I'm moving to San Francisco");
    assert.ok(result);
    assert.equal(result.pipeline.id, "move-to-new-city");
    assert.equal(result.variables.city, "San Francisco");
  });

  it("detects move-to-new-city with 'relocating' pattern", () => {
    const result = detectPipeline("We're relocating to Austin, Texas");
    assert.ok(result);
    assert.equal(result.pipeline.id, "move-to-new-city");
    assert.ok(result.variables.city.includes("Austin"));
  });

  it("detects new-baby pipeline", () => {
    const result = detectPipeline("we're having a baby!");
    assert.ok(result);
    assert.equal(result.pipeline.id, "new-baby");
  });

  it("detects new-baby with 'pregnant' pattern", () => {
    const result = detectPipeline("I'm pregnant");
    assert.ok(result);
    assert.equal(result.pipeline.id, "new-baby");
  });

  it("detects new-baby with 'expecting a child' pattern", () => {
    const result = detectPipeline("we're expecting a child soon");
    assert.ok(result);
    assert.equal(result.pipeline.id, "new-baby");
  });

  it("returns the matched pipeline object", () => {
    const result = detectPipeline("diagnosed with arthritis");
    assert.ok(result.pipeline);
    assert.ok(result.pipeline.steps);
    assert.ok(result.pipeline.trigger);
  });

  it("trims extracted variables", () => {
    const result = detectPipeline("diagnosed with  type 2 diabetes  ");
    assert.ok(result);
    // The variable should be trimmed
    assert.ok(!result.variables.condition.startsWith(" "));
    assert.ok(!result.variables.condition.endsWith(" "));
  });

  it("case insensitive matching", () => {
    const result = detectPipeline("I Was DIAGNOSED WITH Cancer");
    assert.ok(result);
    assert.equal(result.pipeline.id, "chronic-diagnosis");
  });
});

// ── resolveInputMapping ─────────────────────────────────────────────────────

describe("resolveInputMapping", () => {
  it("returns empty object for null/undefined mapping", () => {
    assert.deepEqual(resolveInputMapping(null, {}), {});
    assert.deepEqual(resolveInputMapping(undefined, {}), {});
  });

  it("resolves simple $variable references", () => {
    const mapping = { condition: "$condition" };
    const variables = { condition: "diabetes" };
    const result = resolveInputMapping(mapping, variables);
    assert.equal(result.condition, "diabetes");
  });

  it("resolves dot-path references", () => {
    const mapping = { diet: "$carePlan.dietaryGuidelines" };
    const variables = {
      carePlan: { dietaryGuidelines: "low sugar, high fiber" },
    };
    const result = resolveInputMapping(mapping, variables);
    assert.equal(result.diet, "low sugar, high fiber");
  });

  it("resolves deeply nested dot-path references", () => {
    const mapping = { value: "$a.b.c.d" };
    const variables = { a: { b: { c: { d: "deep" } } } };
    const result = resolveInputMapping(mapping, variables);
    assert.equal(result.value, "deep");
  });

  it("returns original string when $variable not found", () => {
    const mapping = { x: "$nonexistent" };
    const variables = {};
    const result = resolveInputMapping(mapping, variables);
    assert.equal(result.x, "$nonexistent");
  });

  it("returns original string when dot-path resolves to undefined", () => {
    const mapping = { x: "$obj.missing.path" };
    const variables = { obj: {} };
    const result = resolveInputMapping(mapping, variables);
    assert.equal(result.x, "$obj.missing.path");
  });

  it("resolves template strings with embedded $variables", () => {
    const mapping = { goal: "management of $condition" };
    const variables = { condition: "diabetes" };
    const result = resolveInputMapping(mapping, variables);
    assert.equal(result.goal, "management of diabetes");
  });

  it("resolves multiple $variables in a template string", () => {
    // Template strings only apply when the value DOESN'T start with $
    // If it starts with $, the first branch treats it as a $variable reference
    const mapping = { desc: "User $name in $city" };
    const variables = { name: "Alice", city: "Portland" };
    const result = resolveInputMapping(mapping, variables);
    assert.equal(result.desc, "User Alice in Portland");
  });

  it("strings starting with $ are treated as variable refs, not templates", () => {
    // "$name in $city" starts with $ so it's treated as a single variable path
    const mapping = { desc: "$name in $city" };
    const variables = { name: "Alice", city: "Portland" };
    const result = resolveInputMapping(mapping, variables);
    // First branch: tries to resolve path "name in $city" which fails
    // Falls back to original value
    assert.equal(result.desc, "$name in $city");
  });

  it("passes through non-variable string values", () => {
    const mapping = { literal: "hello world" };
    const result = resolveInputMapping(mapping, {});
    assert.equal(result.literal, "hello world");
  });

  it("passes through non-string values", () => {
    const mapping = { num: 42, bool: true, arr: [1, 2, 3] };
    const result = resolveInputMapping(mapping, {});
    assert.equal(result.num, 42);
    assert.equal(result.bool, true);
    assert.deepEqual(result.arr, [1, 2, 3]);
  });

  it("skips template replacement for non-string variable values", () => {
    const mapping = { text: "count is $items" };
    const variables = { items: [1, 2, 3] }; // array, not string
    const result = resolveInputMapping(mapping, variables);
    // Non-string variables are not replaced in templates
    assert.equal(result.text, "count is $items");
  });

  it("handles empty mapping", () => {
    assert.deepEqual(resolveInputMapping({}, { a: 1 }), {});
  });
});
