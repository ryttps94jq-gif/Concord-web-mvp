import { registerSchema } from "../artifact-schemas.js";

registerSchema("studio", "generate-pattern", {
  required: ["title", "bpm", "timeSignature", "notes"],
  properties: {
    title: { type: "string", minLength: 5 },
    bpm: { type: "number", min: 40, max: 300 },
    genre: { type: "string" },
    timeSignature: { type: "string" },
    bars: { type: "number", min: 1, max: 64 },
    notes: {
      type: "array",
      minItems: 4,
      items: {
        required: ["pitch", "time", "duration"],
        properties: {
          pitch: { type: "number", min: 0, max: 127 },
          time: { type: "number", min: 0 },
          duration: { type: "number", min: 0.01 },
          velocity: { type: "number", min: 0, max: 1 },
          channel: { type: "number", min: 0, max: 15 },
        },
      },
    },
  },
});

registerSchema("studio", "suggest-chords", {
  required: ["key", "progression"],
  properties: {
    key: { type: "string" },
    genre: { type: "string" },
    progression: {
      type: "array",
      minItems: 2,
      items: {
        required: ["chord", "beats"],
        properties: {
          chord: { type: "string" },
          beats: { type: "number" },
          notes: { type: "array", items: "number" },
          voicing: { type: "string" },
        },
      },
    },
  },
});

registerSchema("studio", "auto-arrange", {
  required: ["title", "sections"],
  properties: {
    title: { type: "string" },
    bpm: { type: "number", min: 40, max: 300 },
    sections: { type: "array", minItems: 2 },
  },
});

registerSchema("music", "generate-lyrics", {
  required: ["title", "lyrics"],
  properties: {
    title: { type: "string" },
    lyrics: { type: "string", minLength: 50 },
    structure: { type: "array" },
  },
});

registerSchema("music", "analyze-structure", {
  required: ["title", "sections"],
  properties: {
    title: { type: "string" },
    sections: { type: "array", minItems: 1 },
  },
});
