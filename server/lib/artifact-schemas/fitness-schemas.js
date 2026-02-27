import { registerSchema } from "../artifact-schemas.js";

registerSchema("fitness", "generate-program", {
  required: ["title", "goal", "durationWeeks", "daysPerWeek", "weeks"],
  properties: {
    title: { type: "string", minLength: 5 },
    goal: { type: "string", enum: ["strength", "hypertrophy", "endurance", "weight_loss", "athletic_performance", "general_fitness", "rehabilitation"] },
    durationWeeks: { type: "number", min: 1, max: 52 },
    daysPerWeek: { type: "number", min: 1, max: 7 },
    experienceLevel: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    weeks: {
      type: "array",
      minItems: 1,
      items: {
        required: ["weekNumber", "days"],
        properties: {
          weekNumber: { type: "number" },
          focus: { type: "string" },
          days: {
            type: "array",
            items: {
              required: ["dayNumber", "name", "exercises"],
              properties: {
                dayNumber: { type: "number" },
                name: { type: "string" },
                warmup: { type: "string" },
                exercises: {
                  type: "array",
                  minItems: 3,
                  items: {
                    required: ["name", "sets", "reps"],
                    properties: {
                      name: { type: "string", vocabulary: "exercises" },
                      sets: { type: "number", min: 1, max: 20 },
                      reps: { type: "string" },
                      rest: { type: "string" },
                      notes: { type: "string" },
                    },
                  },
                },
                cooldown: { type: "string" },
                estimatedDuration: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
});

registerSchema("fitness", "suggest-workout", {
  required: ["title", "exercises"],
  properties: {
    title: { type: "string" },
    exercises: { type: "array", minItems: 3 },
    estimatedDuration: { type: "string" },
  },
});

registerSchema("fitness", "build-program", {
  required: ["title", "goal", "weeks"],
  properties: {
    title: { type: "string", minLength: 5 },
    goal: { type: "string" },
    weeks: { type: "array", minItems: 1 },
  },
});

registerSchema("fitness", "analyze-trends", {
  required: ["title", "trends"],
  properties: {
    title: { type: "string" },
    trends: { type: "array", minItems: 1 },
  },
});
