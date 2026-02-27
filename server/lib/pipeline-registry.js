// server/lib/pipeline-registry.js
// Autonomous End-to-End Pipelines — One sentence, five documents.
// Life event detection → cross-domain artifact chain.

const PIPELINE_REGISTRY = new Map();

function registerPipeline(pipeline) {
  PIPELINE_REGISTRY.set(pipeline.id, pipeline);
}

// ---- Pre-defined life event pipelines ----

registerPipeline({
  id: "chronic-diagnosis",
  trigger: {
    type: "chat_intent",
    patterns: [
      /diagnosed with (.+)/i,
      /doctor said i have (.+)/i,
      /just found out i have (.+)/i,
    ],
    extractVariable: "condition",
  },
  steps: [
    { order: 1, lens: "healthcare", action: "build-care-plan", inputMapping: { condition: "$condition" }, outputKey: "carePlan" },
    { order: 2, lens: "food", action: "generate-meal-plan", inputMapping: { dietaryRestrictions: "$carePlan.dietaryGuidelines", condition: "$condition" }, outputKey: "mealPlan" },
    { order: 3, lens: "fitness", action: "generate-program", inputMapping: { goal: "management of $condition", restrictions: "$carePlan.physicalRestrictions" }, outputKey: "fitnessPlan" },
    { order: 4, lens: "insurance", action: "check-coverage", inputMapping: { condition: "$condition", treatments: "$carePlan.interventions" }, outputKey: "coverageReport" },
    { order: 5, lens: "accounting", action: "estimate-costs", inputMapping: { treatments: "$carePlan.interventions", coverage: "$coverageReport.coveredItems" }, outputKey: "costEstimate" },
  ],
  consentRequired: true,
  description: "Comprehensive health management package",
});

registerPipeline({
  id: "start-business",
  trigger: {
    type: "chat_intent",
    patterns: [
      /starting a (business|company|startup)/i,
      /want to (start|launch|open) (a |my )(business|company|shop|store)/i,
    ],
    extractVariable: "businessType",
  },
  steps: [
    { order: 1, lens: "law", action: "generate-formation-docs", inputMapping: { businessType: "$businessType" }, outputKey: "legalDocs" },
    { order: 2, lens: "accounting", action: "generate-chart-of-accounts", inputMapping: { businessType: "$businessType", entity: "$legalDocs.entityType" }, outputKey: "accounting" },
    { order: 3, lens: "finance", action: "generate-projections", inputMapping: { businessType: "$businessType" }, outputKey: "projections" },
    { order: 4, lens: "insurance", action: "recommend-coverage", inputMapping: { businessType: "$businessType", entityType: "$legalDocs.entityType" }, outputKey: "insurance" },
  ],
  consentRequired: true,
  description: "Business formation package",
});

registerPipeline({
  id: "move-to-new-city",
  trigger: {
    type: "chat_intent",
    patterns: [
      /moving to (.+)/i,
      /relocating to (.+)/i,
    ],
    extractVariable: "city",
  },
  steps: [
    { order: 1, lens: "realestate", action: "market-analysis", inputMapping: { location: "$city" }, outputKey: "housing" },
    { order: 2, lens: "finance", action: "generate-budget", inputMapping: { location: "$city", housingCosts: "$housing.medianRent" }, outputKey: "budget" },
    { order: 3, lens: "household", action: "generate-checklist", inputMapping: { moveType: "relocation", destination: "$city" }, outputKey: "checklist" },
    { order: 4, lens: "insurance", action: "review-policies", inputMapping: { newState: "$city" }, outputKey: "insurance" },
  ],
  consentRequired: true,
  description: "Relocation planning package",
});

registerPipeline({
  id: "new-baby",
  trigger: {
    type: "chat_intent",
    patterns: [
      /having a baby/i,
      /pregnant/i,
      /expecting a child/i,
    ],
  },
  steps: [
    { order: 1, lens: "healthcare", action: "build-care-plan", inputMapping: { context: "prenatal care" }, outputKey: "prenatalPlan" },
    { order: 2, lens: "food", action: "generate-meal-plan", inputMapping: { dietaryRestrictions: "pregnancy nutrition" }, outputKey: "mealPlan" },
    { order: 3, lens: "finance", action: "generate-budget", inputMapping: { context: "new baby expenses" }, outputKey: "budget" },
    { order: 4, lens: "insurance", action: "check-coverage", inputMapping: { context: "maternity coverage" }, outputKey: "coverage" },
    { order: 5, lens: "legal", action: "analyze-contract", inputMapping: { context: "parental leave rights" }, outputKey: "rights" },
  ],
  consentRequired: true,
  description: "New parent preparation package",
});

/**
 * Detect if a chat prompt matches any pipeline trigger.
 * @param {string} prompt
 * @returns {{ pipeline: object, variables: object } | null}
 */
function detectPipeline(prompt) {
  for (const [, pipeline] of PIPELINE_REGISTRY) {
    if (pipeline.trigger.type === "chat_intent") {
      for (const pattern of pipeline.trigger.patterns) {
        const match = prompt.match(pattern);
        if (match) {
          const variables = {};
          if (pipeline.trigger.extractVariable && match[1]) {
            variables[pipeline.trigger.extractVariable] = match[1].trim();
          }
          return { pipeline, variables };
        }
      }
    }
  }
  return null;
}

/**
 * Resolve $variable references in input mappings.
 * Supports dot-path: "$carePlan.dietaryGuidelines"
 */
function resolveInputMapping(mapping, variables) {
  if (!mapping) return {};
  const resolved = {};

  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value === "string" && value.startsWith("$")) {
      const path = value.slice(1).split(".");
      let current = variables;
      for (const part of path) {
        current = current?.[part];
      }
      resolved[key] = current || value;
    } else if (typeof value === "string" && value.includes("$")) {
      // Template string: "management of $condition"
      let result = value;
      for (const [varName, varValue] of Object.entries(variables)) {
        if (typeof varValue === "string") {
          result = result.replace(`$${varName}`, varValue);
        }
      }
      resolved[key] = result;
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

export {
  PIPELINE_REGISTRY,
  registerPipeline,
  detectPipeline,
  resolveInputMapping,
};
