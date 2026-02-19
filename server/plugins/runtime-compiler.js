/**
 * Runtime Compiler — Emergent-Generated Plugin Compilation
 *
 * When an emergent agent proposes a plugin, this module:
 *   1. Receives the proposal (description, macros, hooks, intent)
 *   2. Generates a source file from the emergent-gen template
 *   3. Runs the validator with isEmergentGen=true
 *   4. Submits for governance vote (requires council approval)
 *   5. On approval: writes to emergent-gen/ and loads via loader
 *
 * Security constraints for emergent-gen plugins:
 *   - Force-namespaced: all macros under "emergent-gen.<pluginId>.*"
 *   - No filesystem or network access
 *   - No timers (use tick callback instead)
 *   - Writes limited to dtus.tags, dtus.meta only
 *   - Rate limited: 50 macro calls per minute
 *   - Maximum 10 active emergent-gen plugins per instance
 */

import { validatePlugin } from "./validator.js";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_EMERGENT_PLUGINS = 10;
const MACRO_RATE_LIMIT = 50;  // per minute per plugin
const RATE_WINDOW_MS = 60_000;
const MAX_SOURCE_LENGTH = 10_000; // characters — emergent plugins must be small

// ── Rate Limiter ────────────────────────────────────────────────────────────

const _rateBuckets = new Map(); // pluginId → { count, windowStart }

function checkRateLimit(pluginId) {
  const now = Date.now();
  let bucket = _rateBuckets.get(pluginId);

  if (!bucket || (now - bucket.windowStart) >= RATE_WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    _rateBuckets.set(pluginId, bucket);
  }

  bucket.count++;
  return bucket.count <= MACRO_RATE_LIMIT;
}

function getRateLimitStatus(pluginId) {
  const bucket = _rateBuckets.get(pluginId);
  if (!bucket) return { remaining: MACRO_RATE_LIMIT, windowMs: RATE_WINDOW_MS };
  const elapsed = Date.now() - bucket.windowStart;
  if (elapsed >= RATE_WINDOW_MS) return { remaining: MACRO_RATE_LIMIT, windowMs: RATE_WINDOW_MS };
  return { remaining: Math.max(0, MACRO_RATE_LIMIT - bucket.count), windowMs: RATE_WINDOW_MS - elapsed };
}

// ── Proposal Processing ─────────────────────────────────────────────────────

/**
 * Process an emergent's plugin proposal into a loadable module object.
 *
 * Does NOT write to disk — returns an in-memory module that the loader
 * can activate after governance approval.
 *
 * @param {Object} proposal
 * @param {string} proposal.emergentId - Proposing emergent
 * @param {string} proposal.name - Plugin name
 * @param {string} proposal.description - What it does
 * @param {string} proposal.purpose - Why it's needed
 * @param {Object} [proposal.macros] - { actionName: handlerSource }
 * @param {Object} [proposal.hooks] - { hookName: handlerSource }
 * @param {Object} [proposal.intent] - { reads, writes, purpose }
 * @param {Object} opts
 * @param {Map} [opts.loadedPlugins] - Currently loaded plugins
 * @param {number} [opts.emergentPluginCount] - Current emergent-gen count
 * @returns {{ ok, compiledModule?, sourceCode?, validation?, error? }}
 */
export function compileEmergentPlugin(proposal, opts = {}) {
  if (!proposal?.emergentId || !proposal?.name) {
    return { ok: false, error: "emergentId_and_name_required" };
  }

  const { loadedPlugins, emergentPluginCount = 0 } = opts;

  // Cap check
  if (emergentPluginCount >= MAX_EMERGENT_PLUGINS) {
    return { ok: false, error: `max_emergent_plugins_reached: limit is ${MAX_EMERGENT_PLUGINS}` };
  }

  // Generate a safe plugin ID
  const safeName = proposal.name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const pluginId = `emergent-gen.${safeName}`;

  // Build intent
  const intent = {
    reads: proposal.intent?.reads || [],
    writes: proposal.intent?.writes || [],
    purpose: proposal.purpose || proposal.description || "No purpose stated",
  };

  // Build macro handlers (from handler source strings or function references)
  const macros = {};
  if (proposal.macros) {
    for (const [actionName, handler] of Object.entries(proposal.macros)) {
      const namespacedKey = `emergent-gen.${safeName}.${actionName}`;
      if (typeof handler === "function") {
        // Wrap with rate limiting
        macros[namespacedKey] = (_ctx, input = {}) => {
          if (!checkRateLimit(pluginId)) {
            return { ok: false, error: "rate_limit_exceeded", pluginId };
          }
          return handler(_ctx, input);
        };
      }
      // String source handlers are not supported for security — must be functions
    }
  }

  // Build hooks (read-only only for emergent-gen)
  const hooks = {};
  if (proposal.hooks) {
    const ALLOWED_HOOKS = ["dtu:afterCreate", "dtu:afterUpdate", "dtu:afterDelete"];
    for (const [hookName, handler] of Object.entries(proposal.hooks)) {
      if (!ALLOWED_HOOKS.includes(hookName)) continue; // silently skip disallowed hooks
      if (typeof handler === "function") {
        hooks[hookName] = handler;
      }
    }
  }

  // Compile the module object
  const compiledModule = {
    id: pluginId,
    name: proposal.name,
    version: "0.1.0",
    description: proposal.description || "",
    author: `emergent:${proposal.emergentId}`,
    license: "Concord-Emergent-License",
    intent,
    macros,
    hooks,
    _emergentGen: true,
    _emergentId: proposal.emergentId,
    _proposedAt: new Date().toISOString(),
    init(ctx) {
      ctx.log("info", `Emergent-gen plugin '${pluginId}' initialized (by ${proposal.emergentId})`);
      return { ok: true };
    },
    destroy() {
      _rateBuckets.delete(pluginId);
    },
    tick: proposal.tick && typeof proposal.tick === "function" ? (ctx) => {
      if (!checkRateLimit(pluginId)) return;
      proposal.tick(ctx);
    } : undefined,
  };

  // Generate source representation for pattern validation
  const sourceCode = generateSourceRepresentation(proposal);
  if (sourceCode.length > MAX_SOURCE_LENGTH) {
    return { ok: false, error: `source_too_large: ${sourceCode.length} chars (max ${MAX_SOURCE_LENGTH})` };
  }

  // Run validation
  const validation = validatePlugin(compiledModule, {
    loadedPlugins,
    isEmergentGen: true,
    sourceCode,
  });

  if (!validation.valid) {
    return { ok: false, error: "validation_failed", validation };
  }

  return {
    ok: true,
    compiledModule,
    sourceCode,
    validation,
    pluginId,
    emergentId: proposal.emergentId,
    requiresGovernance: true,
  };
}

/**
 * Generate a source-code-like representation for pattern scanning.
 * This doesn't produce runnable code — it's for the prohibited-pattern gate.
 */
function generateSourceRepresentation(proposal) {
  const parts = [];
  parts.push(`// Emergent-gen plugin: ${proposal.name}`);
  parts.push(`// By: ${proposal.emergentId}`);
  parts.push(`// Purpose: ${proposal.purpose || "unspecified"}`);

  if (proposal.macros) {
    for (const [name, handler] of Object.entries(proposal.macros)) {
      if (typeof handler === "function") {
        parts.push(`// macro: ${name}`);
        parts.push(handler.toString());
      } else if (typeof handler === "string") {
        parts.push(`// macro source: ${name}`);
        parts.push(handler);
      }
    }
  }

  if (proposal.hooks) {
    for (const [name, handler] of Object.entries(proposal.hooks)) {
      if (typeof handler === "function") {
        parts.push(`// hook: ${name}`);
        parts.push(handler.toString());
      }
    }
  }

  return parts.join("\n");
}

// ── Governance Integration ──────────────────────────────────────────────────

/**
 * Create a governance proposal for an emergent-gen plugin.
 * The actual governance vote is handled by governance.js via macro.
 *
 * @param {Object} compiled - Result from compileEmergentPlugin
 * @param {Object} STATE
 * @returns {{ ok, proposalId, proposal }}
 */
export function createPluginGovernanceProposal(compiled) {
  if (!compiled?.ok || !compiled.compiledModule) {
    return { ok: false, error: "compiled_module_required" };
  }

  const proposal = {
    type: "plugin_activation",
    pluginId: compiled.pluginId,
    emergentId: compiled.emergentId,
    name: compiled.compiledModule.name,
    description: compiled.compiledModule.description,
    intent: compiled.compiledModule.intent,
    macroCount: Object.keys(compiled.compiledModule.macros).length,
    hookCount: Object.keys(compiled.compiledModule.hooks).length,
    validationGates: compiled.validation.gates.map(g => ({ name: g.name, passed: g.passed })),
    proposedAt: new Date().toISOString(),
  };

  return { ok: true, proposal };
}

export {
  MAX_EMERGENT_PLUGINS,
  MACRO_RATE_LIMIT,
  checkRateLimit,
  getRateLimitStatus,
};
