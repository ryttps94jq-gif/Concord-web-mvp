// server/lib/pipeline-executor.js
// Executes multi-step cross-domain pipelines.
// Each step runs a lens action and passes output to the next step.

import { PIPELINE_REGISTRY, resolveInputMapping } from "./pipeline-registry.js";

/**
 * Execute a pipeline end-to-end.
 * @param {string} pipelineId
 * @param {object} variables - Extracted trigger variables
 * @param {string} userId
 * @param {string} sessionId
 * @param {object} deps - { runMacro, realtimeEmit, STATE, generateId, nowISO }
 * @returns {object} execution record
 */
async function executePipeline(pipelineId, variables, userId, sessionId, deps) {
  const { runMacro, realtimeEmit, STATE, generateId, nowISO } = deps;
  const pipeline = PIPELINE_REGISTRY.get(pipelineId);
  if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`);

  const execution = {
    id: generateId(),
    pipelineId,
    userId,
    sessionId,
    status: "running",
    variables: { ...variables },
    steps: [],
    startedAt: nowISO(),
  };

  // Store execution for tracking
  if (!STATE._pipelineExecutions) STATE._pipelineExecutions = new Map();
  STATE._pipelineExecutions.set(execution.id, execution);

  realtimeEmit("pipeline:started", {
    userId,
    pipelineId,
    executionId: execution.id,
    description: pipeline.description,
    stepCount: pipeline.steps.length,
  });

  for (const step of pipeline.steps) {
    const stepExecution = {
      order: step.order,
      lens: step.lens,
      action: step.action,
      status: "running",
      startedAt: nowISO(),
    };

    realtimeEmit("pipeline:step_started", {
      userId,
      pipelineId,
      executionId: execution.id,
      step: step.order,
      totalSteps: pipeline.steps.length,
      lens: step.lens,
      action: step.action,
    });

    try {
      const resolvedInput = resolveInputMapping(step.inputMapping, execution.variables);
      const result = await runMacro(
        step.lens,
        step.action,
        { ...resolvedInput, userId, sessionId },
        { userId, sessionId, pipelineExecution: execution.id }
      );

      if (result && result.ok !== false) {
        stepExecution.status = "completed";
        stepExecution.dtuId = result.dtuId;
        stepExecution.completedAt = nowISO();

        if (step.outputKey) {
          execution.variables[step.outputKey] = result.artifact || result;
        }

        // Tag DTU with pipeline trail
        if (result.dtuId && STATE.dtus) {
          const dtu = STATE.dtus.get(result.dtuId);
          if (dtu) {
            dtu.meta = dtu.meta || {};
            dtu.meta.pipelineId = pipelineId;
            dtu.meta.pipelineStep = step.order;
            dtu.meta.pipelineExecution = execution.id;
          }
        }
      } else {
        stepExecution.status = "failed";
        stepExecution.error = result?.error || "Action returned no result";
      }
    } catch (err) {
      stepExecution.status = "failed";
      stepExecution.error = err.message;
    }

    execution.steps.push(stepExecution);

    realtimeEmit("pipeline:step_completed", {
      userId,
      pipelineId,
      executionId: execution.id,
      step: step.order,
      status: stepExecution.status,
      dtuId: stepExecution.dtuId,
    });

    if (stepExecution.status === "failed") break;
  }

  execution.status = execution.steps.every(s => s.status === "completed")
    ? "completed" : "partial";
  execution.completedAt = nowISO();

  realtimeEmit("pipeline:completed", {
    userId,
    pipelineId,
    executionId: execution.id,
    status: execution.status,
    artifactCount: execution.steps.filter(s => s.dtuId).length,
    dtuIds: execution.steps.map(s => s.dtuId).filter(Boolean),
  });

  return execution;
}

export { executePipeline };
