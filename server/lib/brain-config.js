// lib/brain-config.js
// Four-Brain Cognitive Architecture — Configuration
//
// Each brain has a dedicated Ollama instance, model, temperature profile,
// timeout, priority, and concurrency limit. The repair brain always runs
// at highest priority (0). Conscious (user-facing) beats subconscious (autonomous).

export const BRAIN_CONFIG = Object.freeze({
  conscious: {
    url: process.env.BRAIN_CONSCIOUS_URL || process.env.OLLAMA_HOST || "http://localhost:11434",
    model: process.env.BRAIN_CONSCIOUS_MODEL || "qwen2.5:7b",
    role: "chat, deep reasoning, council deliberation",
    temperature: 0.7,
    timeout: 60000,
    priority: 1,       // CRITICAL — user-facing
    maxConcurrent: 1,  // One conscious thought at a time
    contextWindow: 32768,
    maxTokens: 4096,   // Full output — let it think
  },
  subconscious: {
    url: process.env.BRAIN_SUBCONSCIOUS_URL || "http://localhost:11435",
    model: process.env.BRAIN_SUBCONSCIOUS_MODEL || "qwen2.5:1.5b",
    role: "autogen, dream, evolution, synthesis, birth",
    temperature: 0.85,
    timeout: 45000,
    priority: 2,       // NORMAL — autonomous background
    maxConcurrent: 2,
    contextWindow: 8192,
    maxTokens: 600,
  },
  utility: {
    url: process.env.BRAIN_UTILITY_URL || "http://localhost:11436",
    model: process.env.BRAIN_UTILITY_MODEL || "qwen2.5:3b",
    role: "lens interactions, entity actions, quick domain tasks",
    temperature: 0.3,
    timeout: 30000,
    priority: 3,       // LOW — support tasks
    maxConcurrent: 3,
    contextWindow: 16384,
    maxTokens: 500,
  },
  repair: {
    url: process.env.BRAIN_REPAIR_URL || "http://localhost:11437",
    model: process.env.BRAIN_REPAIR_MODEL || "qwen2.5:0.5b",
    role: "error detection, auto-fix, runtime repair",
    temperature: 0.1,
    timeout: 15000,
    priority: 0,       // HIGHEST — system health
    maxConcurrent: 2,
    contextWindow: 4096,
    maxTokens: 300,
  },
});

/**
 * Map from system/subsystem names to brain assignments.
 * Used by the brain router to determine which brain handles each call.
 */
export const SYSTEM_TO_BRAIN = Object.freeze({
  // Conscious brain — user-facing and sovereign
  chat: "conscious",
  sovereign_decree: "conscious",
  entity_dialogue: "conscious",

  // Subconscious brain — autonomous generation
  autogen: "subconscious",
  autogen_pipeline: "subconscious",
  meta_derivation: "subconscious",
  dream_synthesis: "subconscious",

  // Utility brain — analytical and support tasks
  hlr_engine: "utility",
  agent_system: "utility",
  hypothesis_engine: "utility",
  council_voices: "utility",
  research_jobs: "utility",

  // Repair brain — self-healing
  repair_cortex: "repair",
  repair_diagnosis: "repair",
});

/**
 * Map brain names to LLM queue priority levels.
 */
export const BRAIN_PRIORITY = Object.freeze({
  repair: 0,       // CRITICAL
  conscious: 1,    // HIGH
  subconscious: 2, // NORMAL
  utility: 3,      // LOW
});

/**
 * Get the brain config for a system name.
 * @param {string} systemName - e.g., "chat", "autogen", "repair_cortex"
 * @returns {{ brainName: string, config: object }}
 */
export function getBrainForSystem(systemName) {
  const brainName = SYSTEM_TO_BRAIN[systemName] || "conscious";
  return { brainName, config: BRAIN_CONFIG[brainName] };
}
