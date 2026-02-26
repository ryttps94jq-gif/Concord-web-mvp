// lib/brain-router.js
// Four-Brain Cognitive Architecture — Router
//
// Routes LLM calls to the correct brain based on system name.
// Provides preloadBrains() to warm all models after Ollama health check.
// Integrates with the LLM priority queue for proper scheduling.

import { BRAIN_CONFIG, SYSTEM_TO_BRAIN, BRAIN_PRIORITY } from "./brain-config.js";

/**
 * Preload and warm all brain models.
 * Call AFTER Ollama health check confirms instances are ready.
 *
 * @param {Function} structuredLog - Logging function
 * @returns {Promise<{ loaded: string[], failed: string[] }>}
 */
export async function preloadBrains(structuredLog = () => {}) {
  const loaded = [];
  const failed = [];

  // De-duplicate: group brains by URL so we don't pull the same model twice
  const seen = new Set();

  for (const [name, config] of Object.entries(BRAIN_CONFIG)) {
    const key = `${config.url}::${config.model}`;
    if (seen.has(key)) {
      loaded.push(name);
      continue;
    }
    seen.add(key);

    try {
      // Pull model if not present (idempotent)
      const pullRes = await fetch(`${config.url}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: config.model, stream: false }),
        signal: AbortSignal.timeout(300000), // 5 min for large model pulls
      });

      if (!pullRes.ok) {
        structuredLog("warn", "brain_pull_failed", { brain: name, model: config.model, status: pullRes.status });
        failed.push(name);
        continue;
      }

      // Warm: send minimal request to load model into memory
      const warmRes = await fetch(`${config.url}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          prompt: "ping",
          stream: false,
          options: { num_predict: 1 },
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (warmRes.ok) {
        loaded.push(name);
        structuredLog("info", "brain_preloaded", { brain: name, model: config.model });
      } else {
        failed.push(name);
        structuredLog("warn", "brain_warm_failed", { brain: name, model: config.model });
      }
    } catch (err) {
      failed.push(name);
      structuredLog("warn", "brain_preload_error", { brain: name, model: config.model, error: err.message });
    }
  }

  return { loaded, failed };
}

/**
 * Get the LLM queue priority for a brain call.
 *
 * @param {string} brainName - "conscious", "subconscious", "utility", "repair"
 * @returns {number} Priority level (0=highest, 3=lowest)
 */
export function getBrainPriority(brainName) {
  return BRAIN_PRIORITY[brainName] ?? 2;
}

/**
 * Resolve which brain should handle a system call.
 *
 * @param {string} systemName - e.g., "chat", "autogen_pipeline", "repair_cortex"
 * @returns {string} Brain name
 */
export function resolveBrain(systemName) {
  return SYSTEM_TO_BRAIN[systemName] || "conscious";
}
