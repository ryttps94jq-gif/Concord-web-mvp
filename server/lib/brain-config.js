// lib/brain-config.js
// Four-Brain Cognitive Architecture — Configuration
//
// Each brain has a dedicated Ollama instance, model, temperature profile,
// timeout, priority, and concurrency limit. The repair brain always runs
// at highest priority (0). Conscious (user-facing) beats subconscious (autonomous).

export const BRAIN_CONFIG = Object.freeze({
  conscious: {
    url: process.env.BRAIN_CONSCIOUS_URL || process.env.OLLAMA_HOST || "http://ollama-conscious:11434",
    model: process.env.BRAIN_CONSCIOUS_MODEL || "qwen2.5:7b",
    role: "chat, deep reasoning, council deliberation",
    temperature: 0.7,
    timeout: 45000,    // GPU inference is faster — tighten to fail fast on real errors
    priority: 1,       // CRITICAL — user-facing
    maxConcurrent: 3,  // GPU can handle parallel conscious thoughts
    contextWindow: 32768,
    maxTokens: 4096,   // Full output — let it think
  },
  subconscious: {
    url: process.env.BRAIN_SUBCONSCIOUS_URL || "http://ollama-subconscious:11434",
    model: process.env.BRAIN_SUBCONSCIOUS_MODEL || "qwen2.5:1.5b",
    role: "autogen, dream, evolution, synthesis, birth",
    temperature: 0.85,
    timeout: 30000,    // GPU: faster inference, tighter timeout
    priority: 2,       // NORMAL — autonomous background
    maxConcurrent: 4,  // GPU: autogen + dreams + evolution + entity teaching
    contextWindow: 8192,
    maxTokens: 1200,   // GPU: 7B brain can generate longer, more coherent DTUs
  },
  utility: {
    url: process.env.BRAIN_UTILITY_URL || "http://ollama-utility:11434",
    model: process.env.BRAIN_UTILITY_MODEL || "qwen2.5:3b",
    role: "lens interactions, entity actions, quick domain tasks",
    temperature: 0.3,
    timeout: 20000,    // GPU: fast 3B model, tight timeout
    priority: 3,       // LOW — support tasks
    maxConcurrent: 6,  // GPU: entities spam lens/action calls, needs most parallelism
    contextWindow: 16384,
    maxTokens: 800,    // GPU: more complete outputs for entity actions
  },
  repair: {
    url: process.env.BRAIN_REPAIR_URL || "http://ollama-repair:11434",
    model: process.env.BRAIN_REPAIR_MODEL || "qwen2.5:0.5b",
    role: "error detection, auto-fix, runtime repair",
    temperature: 0.1,
    timeout: 10000,    // GPU: 1.5B repair brain is fast
    priority: 0,       // HIGHEST — system health
    maxConcurrent: 2,  // Stays same — repair is low-frequency
    contextWindow: 4096,
    maxTokens: 500,    // GPU: 1.5B can actually articulate error analysis now
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
