import { registerSchema } from "../artifact-schemas.js";

registerSchema("education", "generate-curriculum", {
  required: ["title", "subject", "units"],
  properties: {
    title: { type: "string", minLength: 5 },
    subject: { type: "string" },
    gradeLevel: { type: "string" },
    duration: { type: "string" },
    units: {
      type: "array",
      minItems: 1,
      items: {
        required: ["title", "objectives", "lessons"],
        properties: {
          title: { type: "string" },
          objectives: { type: "array", minItems: 1 },
          lessons: { type: "array", minItems: 1 },
          assessment: { type: "string" },
        },
      },
    },
    standards: { type: "array" },
  },
});

registerSchema("education", "generate-lesson-plan", {
  required: ["title", "objective", "activities"],
  properties: {
    title: { type: "string", minLength: 5 },
    objective: { type: "string" },
    duration: { type: "string" },
    materials: { type: "array" },
    activities: {
      type: "array",
      minItems: 2,
      items: {
        required: ["name", "duration"],
        properties: {
          name: { type: "string" },
          duration: { type: "string" },
          description: { type: "string" },
          type: { type: "string" },
        },
      },
    },
    assessment: { type: "string" },
    differentiation: { type: "object" },
  },
});

registerSchema("education", "generate-assessment", {
  required: ["title", "questions"],
  properties: {
    title: { type: "string" },
    questions: { type: "array", minItems: 3 },
    rubric: { type: "object" },
  },
});
