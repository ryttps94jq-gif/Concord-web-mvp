/**
 * Pipeline Executor Test Suite
 *
 * Tests the multi-step cross-domain pipeline executor:
 *   - executePipeline() end-to-end execution
 *   - Step-by-step execution with variable passing
 *   - Failure handling (step failure breaks pipeline)
 *   - DTU tagging with pipeline trail
 *   - Realtime event emission at each lifecycle stage
 *   - Pipeline execution tracking in STATE
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { executePipeline } from "../lib/pipeline-executor.js";
import { PIPELINE_REGISTRY, registerPipeline } from "../lib/pipeline-registry.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function createDeps(overrides = {}) {
  const events = [];
  const macroResults = {};

  return {
    events,
    macroResults,
    deps: {
      runMacro: overrides.runMacro || (async (lens, action, input) => {
        const key = `${lens}.${action}`;
        if (macroResults[key]) return macroResults[key];
        return { ok: true, dtuId: `dtu_${lens}_${action}`, artifact: { data: `result_${action}` } };
      }),
      realtimeEmit: (event, data) => events.push({ event, data }),
      STATE: {
        dtus: new Map(),
        _pipelineExecutions: new Map(),
      },
      generateId: () => `exec_${Date.now()}_test`,
      nowISO: () => "2024-01-01T00:00:00.000Z",
      ...overrides,
    },
  };
}

// Register a test pipeline
const TEST_PIPELINE_ID = "__test_pipeline_executor__";

describe("executePipeline", () => {
  beforeEach(() => {
    // Register a simple test pipeline
    PIPELINE_REGISTRY.set(TEST_PIPELINE_ID, {
      id: TEST_PIPELINE_ID,
      description: "Test pipeline",
      steps: [
        { order: 1, lens: "healthcare", action: "build-care-plan", inputMapping: { condition: "$condition" }, outputKey: "carePlan" },
        { order: 2, lens: "food", action: "generate-meal-plan", inputMapping: { diet: "$carePlan" }, outputKey: "mealPlan" },
        { order: 3, lens: "fitness", action: "generate-program", inputMapping: { goal: "$condition" }, outputKey: "fitnessPlan" },
      ],
      consentRequired: true,
    });
  });

  it("throws for unknown pipeline", async () => {
    const { deps } = createDeps();
    await assert.rejects(
      () => executePipeline("nonexistent", {}, "u1", "s1", deps),
      { message: /Pipeline not found/ },
    );
  });

  it("executes all steps successfully", async () => {
    const { deps, events } = createDeps();

    const execution = await executePipeline(
      TEST_PIPELINE_ID,
      { condition: "diabetes" },
      "user1",
      "session1",
      deps,
    );

    assert.equal(execution.status, "completed");
    assert.equal(execution.steps.length, 3);
    assert.ok(execution.steps.every(s => s.status === "completed"));
    assert.equal(execution.pipelineId, TEST_PIPELINE_ID);
    assert.equal(execution.userId, "user1");
    assert.equal(execution.sessionId, "session1");
  });

  it("stores execution in STATE._pipelineExecutions", async () => {
    const { deps } = createDeps();

    const execution = await executePipeline(
      TEST_PIPELINE_ID,
      { condition: "test" },
      "u1",
      "s1",
      deps,
    );

    assert.equal(deps.STATE._pipelineExecutions.has(execution.id), true);
  });

  it("initializes _pipelineExecutions if missing", async () => {
    const { deps } = createDeps();
    delete deps.STATE._pipelineExecutions;

    const execution = await executePipeline(
      TEST_PIPELINE_ID,
      {},
      "u1",
      "s1",
      deps,
    );

    assert.ok(deps.STATE._pipelineExecutions instanceof Map);
    assert.equal(deps.STATE._pipelineExecutions.has(execution.id), true);
  });

  it("emits pipeline lifecycle events", async () => {
    const { deps, events } = createDeps();

    await executePipeline(TEST_PIPELINE_ID, {}, "u1", "s1", deps);

    const eventTypes = events.map(e => e.event);
    assert.ok(eventTypes.includes("pipeline:started"));
    assert.ok(eventTypes.includes("pipeline:completed"));
    assert.ok(eventTypes.filter(e => e === "pipeline:step_started").length === 3);
    assert.ok(eventTypes.filter(e => e === "pipeline:step_completed").length === 3);
  });

  it("pipeline:started event includes correct data", async () => {
    const { deps, events } = createDeps();

    await executePipeline(TEST_PIPELINE_ID, {}, "u1", "s1", deps);

    const startEvent = events.find(e => e.event === "pipeline:started");
    assert.equal(startEvent.data.userId, "u1");
    assert.equal(startEvent.data.pipelineId, TEST_PIPELINE_ID);
    assert.equal(startEvent.data.stepCount, 3);
    assert.equal(startEvent.data.description, "Test pipeline");
  });

  it("pipeline:completed event includes artifact counts", async () => {
    const { deps, events } = createDeps();

    await executePipeline(TEST_PIPELINE_ID, {}, "u1", "s1", deps);

    const endEvent = events.find(e => e.event === "pipeline:completed");
    assert.equal(endEvent.data.status, "completed");
    assert.equal(endEvent.data.artifactCount, 3);
    assert.ok(Array.isArray(endEvent.data.dtuIds));
  });

  it("passes output variables between steps", async () => {
    const callLog = [];
    const { deps } = createDeps({
      runMacro: async (lens, action, input) => {
        callLog.push({ lens, action, input });
        return { ok: true, dtuId: `dtu_${action}`, artifact: { data: `${action}_result` } };
      },
    });

    await executePipeline(
      TEST_PIPELINE_ID,
      { condition: "diabetes" },
      "u1",
      "s1",
      deps,
    );

    // Step 2 should receive the carePlan from step 1
    assert.ok(callLog[1].input.diet);
  });

  it("tags DTUs with pipeline metadata", async () => {
    const { deps } = createDeps();
    // Pre-populate DTUs so the tagging logic finds them
    deps.STATE.dtus.set("dtu_healthcare_build-care-plan", { id: "dtu_healthcare_build-care-plan" });

    await executePipeline(TEST_PIPELINE_ID, {}, "u1", "s1", deps);

    const dtu = deps.STATE.dtus.get("dtu_healthcare_build-care-plan");
    assert.ok(dtu.meta);
    assert.equal(dtu.meta.pipelineId, TEST_PIPELINE_ID);
    assert.equal(dtu.meta.pipelineStep, 1);
  });

  it("stops on step failure and marks status as partial", async () => {
    const { deps } = createDeps({
      runMacro: async (lens, action) => {
        if (action === "generate-meal-plan") {
          throw new Error("Meal plan generation failed");
        }
        return { ok: true, dtuId: `dtu_${action}`, artifact: {} };
      },
    });

    const execution = await executePipeline(TEST_PIPELINE_ID, {}, "u1", "s1", deps);

    assert.equal(execution.status, "partial");
    assert.equal(execution.steps.length, 2); // stopped after step 2
    assert.equal(execution.steps[0].status, "completed");
    assert.equal(execution.steps[1].status, "failed");
    assert.ok(execution.steps[1].error.includes("Meal plan generation failed"));
  });

  it("handles runMacro returning ok:false", async () => {
    const { deps } = createDeps({
      runMacro: async (lens, action) => {
        if (lens === "food") return { ok: false, error: "service_unavailable" };
        return { ok: true, dtuId: `dtu_${action}`, artifact: {} };
      },
    });

    const execution = await executePipeline(TEST_PIPELINE_ID, {}, "u1", "s1", deps);

    assert.equal(execution.status, "partial");
    const failedStep = execution.steps.find(s => s.status === "failed");
    assert.ok(failedStep);
    assert.equal(failedStep.error, "service_unavailable");
  });

  it("handles runMacro returning null result", async () => {
    const { deps } = createDeps({
      runMacro: async () => null,
    });

    const execution = await executePipeline(TEST_PIPELINE_ID, {}, "u1", "s1", deps);

    // null result should be treated as failure
    assert.equal(execution.steps[0].status, "failed");
    assert.equal(execution.status, "partial");
  });

  it("records completedAt timestamp", async () => {
    const { deps } = createDeps();

    const execution = await executePipeline(TEST_PIPELINE_ID, {}, "u1", "s1", deps);

    assert.ok(execution.completedAt);
    assert.ok(execution.startedAt);
  });

  it("records step timestamps", async () => {
    const { deps } = createDeps();

    const execution = await executePipeline(TEST_PIPELINE_ID, {}, "u1", "s1", deps);

    for (const step of execution.steps) {
      assert.ok(step.startedAt);
      if (step.status === "completed") {
        assert.ok(step.completedAt);
        assert.ok(step.dtuId);
      }
    }
  });

  it("preserves initial variables in execution record", async () => {
    const { deps } = createDeps();

    const execution = await executePipeline(
      TEST_PIPELINE_ID,
      { condition: "asthma", severity: "moderate" },
      "u1",
      "s1",
      deps,
    );

    assert.equal(execution.variables.condition, "asthma");
    assert.equal(execution.variables.severity, "moderate");
  });
});
