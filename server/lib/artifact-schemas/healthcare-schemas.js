import { registerSchema } from "../artifact-schemas.js";

registerSchema("healthcare", "build-care-plan", {
  required: ["title", "patientContext", "goals", "interventions"],
  properties: {
    title: { type: "string", minLength: 5 },
    patientContext: {
      properties: {
        conditions: { type: "array", items: "string", vocabulary: "medical_conditions" },
        currentMedications: { type: "array" },
        allergies: { type: "array" },
      },
    },
    goals: {
      type: "array",
      minItems: 1,
      items: {
        required: ["goal", "targetDate", "measurable"],
        properties: {
          goal: { type: "string" },
          targetDate: { type: "string" },
          measurable: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
    interventions: {
      type: "array",
      minItems: 1,
      items: {
        required: ["intervention", "frequency", "responsibleParty"],
        properties: {
          intervention: { type: "string" },
          frequency: { type: "string" },
          responsibleParty: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    followUp: {
      properties: {
        nextAppointment: { type: "string" },
        monitoringSchedule: { type: "string" },
      },
    },
    disclaimer: { type: "string" },
  },
});

registerSchema("healthcare", "check-interactions", {
  required: ["title", "medications", "interactions"],
  properties: {
    title: { type: "string" },
    medications: { type: "array", minItems: 2 },
    interactions: { type: "array" },
    disclaimer: { type: "string" },
  },
});

registerSchema("healthcare", "generateSummary", {
  required: ["title", "summary"],
  properties: {
    title: { type: "string" },
    summary: { type: "string", minLength: 20 },
    disclaimer: { type: "string" },
  },
});
