// dtus.js — Starter DTUs for the Community Edition
// ------------------------------------------------
// Safe, minimal, no proprietary Concord logic.
// Only data. No engine surfaces. Ready for GitHub open source.

export const dtus = [
  {
    id: "DTU-001",
    meta: { title: "What is a DTU?" },
    tags: ["system", "intro", "concept"],
    content: `
Core:
A Discrete Thought Unit (DTU) is a small, modular container for knowledge.

Reasoning:
Breaking ideas into small pieces allows Concord to reference, remix, and evolve them.

Evidence:
Modular knowledge systems consistently outperform raw text in reuse and clarity.

Testing:
Create a DTU like "How to boil water" and watch Concord reference it.

Impact:
DTUs are the foundation of how Concord stores and grows knowledge.
    `.trim(),
  },

  {
    id: "DTU-002",
    meta: { title: "What is CRETI?" },
    tags: ["creti", "structure", "intro"],
    content: `
Core:
CRETI stands for Core, Reasoning, Evidence, Testing, Impact.

Reasoning:
This structure forces clarity and improves compatibility between DTUs.

Evidence:
Structured thinking enhances learning, reuse, and refinement.

Testing:
Take an idea and rephrase it into CRETI to observe clarity gains.

Impact:
Helps users build DTUs that Concord can use more effectively.
    `.trim(),
  },

  {
    id: "DTU-003",
    meta: { title: "Village Simulation Example" },
    tags: ["example", "worldbuilding", "persona-demo"],
    content: `
Core:
A fictional small village is used for persona demos and autogen examples.

Reasoning:
Personas need a neutral, harmless world to explore reasoning patterns.

Evidence:
Story scaffolding helps users understand system behavior.

Testing:
Ask a persona how the village handles farming or water shortages.

Impact:
Makes Concord feel alive without exposing any real-world logic.
    `.trim(),
  },

  {
    id: "DTU-004",
    meta: { title: "Persona Archetype — The Analyst" },
    tags: ["persona", "logic", "demo"],
    content: `
Core:
A logical, step-by-step persona.

Reasoning:
Demonstrates analytical reasoning and structured problem-solving.

Evidence:
Analysts are common archetypes in thinking tools.

Testing:
Ask: "How should the village allocate food?"

Impact:
Shows structured persona responses without real OS logic.
    `.trim(),
  },

  {
    id: "DTU-005",
    meta: { title: "Persona Archetype — The Idealist" },
    tags: ["persona", "creativity", "demo"],
    content: `
Core:
A visionary persona focused on possibilities and optimism.

Reasoning:
Contrasts with The Analyst to demonstrate multi-perspective reasoning.

Evidence:
Contrasting viewpoints refine ideas more effectively.

Testing:
Ask: "What should the village build next?"

Impact:
Shows balanced persona dynamics.
    `.trim(),
  },

  {
    id: "DTU-006",
    meta: { title: "Village Decision — Build a Well?" },
    tags: ["decision", "creti", "worldbuilding"],
    content: `
Core:
The village debates building a shared water well.

Reasoning:
A well reduces travel time and improves sanitation.

Evidence:
Communities with shared water sources have better health outcomes.

Testing:
Ask personas to give pros and cons.

Impact:
Simple, harmless content for autogen + forge mode.
    `.trim(),
  },

  {
    id: "DTU-007",
    meta: { title: "How Autogen Works (High-Level)" },
    tags: ["autogen", "concept", "system"],
    content: `
Core:
Autogen expands existing DTUs by adding clarifications or variants.

Reasoning:
Shows the user how Concord grows knowledge safely.

Evidence:
Iterative refinement is a common creativity practice.

Testing:
Enable autogen and run a heartbeat.

Impact:
Makes Concord feel alive without revealing internal mechanics.
    `.trim(),
  },

  {
    id: "DTU-008",
    meta: { title: "Forge Mode Example: Idea Breakdown" },
    tags: ["forge", "creti", "demo"],
    content: `
Core:
A generic example idea broken down using CRETI.

Reasoning:
Users need a reference format for their own Forge submissions.

Evidence:
Structured formats improve consistency.

Testing:
Submit a new idea to Forge Mode and compare structures.

Impact:
Teaches users how to think in CRETI.
    `.trim(),
  },
];
