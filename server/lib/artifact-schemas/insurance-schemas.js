import { registerSchema } from "../artifact-schemas.js";

registerSchema("insurance", "analyze-policy", {
  required: ["title", "policyType", "coverage", "recommendations"],
  properties: {
    title: { type: "string" },
    policyType: { type: "string" },
    coverage: {
      properties: {
        limits: { type: "object" },
        deductibles: { type: "object" },
        exclusions: { type: "array" },
      },
    },
    premium: { type: "number", min: 0 },
    recommendations: { type: "array", minItems: 1 },
  },
});

registerSchema("insurance", "compare-coverage", {
  required: ["title", "policies", "comparison"],
  properties: {
    title: { type: "string" },
    policies: { type: "array", minItems: 2 },
    comparison: { type: "object" },
    recommendation: { type: "string" },
  },
});

registerSchema("insurance", "track-renewal", {
  required: ["title", "policies"],
  properties: {
    title: { type: "string" },
    policies: {
      type: "array",
      minItems: 1,
      items: {
        required: ["name", "renewalDate"],
        properties: {
          name: { type: "string" },
          renewalDate: { type: "string" },
          premium: { type: "number" },
          action: { type: "string" },
        },
      },
    },
  },
});
