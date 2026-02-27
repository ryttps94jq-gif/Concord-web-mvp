import { registerSchema } from "../artifact-schemas.js";

registerSchema("law", "analyze-contract", {
  required: ["title", "parties", "keyTerms", "riskAreas", "recommendations"],
  properties: {
    title: { type: "string" },
    parties: {
      type: "array",
      minItems: 2,
      items: {
        required: ["name", "role"],
        properties: {
          name: { type: "string" },
          role: { type: "string" },
        },
      },
    },
    effectiveDate: { type: "string" },
    terminationDate: { type: "string" },
    keyTerms: {
      type: "array",
      minItems: 1,
      items: {
        required: ["clause", "summary"],
        properties: {
          clause: { type: "string" },
          summary: { type: "string" },
          concern: { type: "string" },
        },
      },
    },
    riskAreas: {
      type: "array",
      items: {
        required: ["risk", "severity"],
        properties: {
          risk: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          recommendation: { type: "string" },
        },
      },
    },
    recommendations: { type: "array", items: "string" },
    disclaimer: { type: "string" },
  },
});

registerSchema("law", "draft-contract", {
  required: ["title", "parties", "clauses"],
  properties: {
    title: { type: "string", minLength: 5 },
    parties: { type: "array", minItems: 2 },
    clauses: { type: "array", minItems: 1 },
    jurisdiction: { type: "string" },
    effectiveDate: { type: "string" },
    disclaimer: { type: "string" },
  },
});

registerSchema("law", "alert-deadlines", {
  required: ["title", "deadlines"],
  properties: {
    title: { type: "string" },
    deadlines: { type: "array", minItems: 1 },
  },
});

registerSchema("legal", "draft-contract", {
  required: ["title", "parties", "clauses"],
  properties: {
    title: { type: "string", minLength: 5 },
    parties: { type: "array", minItems: 2 },
    clauses: { type: "array", minItems: 1 },
    disclaimer: { type: "string" },
  },
});

registerSchema("legal", "analyze-compliance", {
  required: ["title", "findings"],
  properties: {
    title: { type: "string" },
    findings: { type: "array", minItems: 1 },
    disclaimer: { type: "string" },
  },
});
