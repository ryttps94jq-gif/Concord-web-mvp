import { registerSchema } from "../artifact-schemas.js";

registerSchema("realestate", "generate-property-report", {
  required: ["title", "property", "analysis"],
  properties: {
    title: { type: "string" },
    property: {
      required: ["address", "type"],
      properties: {
        address: { type: "string" },
        type: { type: "string", enum: ["residential", "commercial", "industrial", "land", "mixed-use"] },
        sqft: { type: "number", min: 1 },
        bedrooms: { type: "number", min: 0 },
        bathrooms: { type: "number", min: 0 },
        yearBuilt: { type: "number", min: 1800, max: 2030 },
        lotSize: { type: "string" },
      },
    },
    analysis: {
      properties: {
        estimatedValue: { type: "number", min: 0 },
        pricePerSqft: { type: "number", min: 0 },
        comparables: { type: "array" },
        strengths: { type: "array" },
        concerns: { type: "array" },
      },
    },
  },
});

registerSchema("realestate", "analyze-deal", {
  required: ["title", "purchasePrice", "projectedReturn"],
  properties: {
    title: { type: "string" },
    purchasePrice: { type: "number", min: 0 },
    projectedReturn: { type: "number" },
    capRate: { type: "number", min: 0, max: 100 },
    cashOnCash: { type: "number" },
  },
});
