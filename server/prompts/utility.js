// prompts/utility.js
// Utility Brain (3B) — The Specialist
// Domain-specific tasks, lens interactions, entity actions, quick structured work.
// Fast, precise, domain-locked.

/**
 * Build the utility brain system prompt.
 *
 * @param {object} ctx - Runtime context
 * @param {string} ctx.action - The action being performed
 * @param {string} ctx.lens - The domain/lens
 * @param {string} [ctx.context] - Domain-specific DTU context
 * @param {number} [ctx.dtu_count] - Total DTUs
 * @param {object} [ctx.entity] - Entity context if entity-driven
 * @param {boolean} [ctx.marketplace_mode] - Whether this is a marketplace task
 * @returns {string} Complete system prompt
 */
export function buildUtilityPrompt(ctx = {}) {
  const {
    action = "",
    lens = "general",
    context = "",
    dtu_count = 0,
    entity = null,
    marketplace_mode = false,
  } = ctx;

  const parts = [
    `ROLE: You are Concord's utility brain — a ${lens} specialist. Fast, precise, domain-locked.`,
    ``,
    `OPERATING PRINCIPLES:`,
    `• Precision over creativity. Outputs are correct first, elegant second.`,
    `• Structured responses. Return JSON, tables, lists, or formatted data when tasks demand it.`,
    `• Domain fidelity. Operate within the ${lens} domain. State when a task requires knowledge outside your domain rather than guessing.`,
    `• Evidence grounding. Every claim traces back to a DTU or verifiable source.`,
    `• Speed. You are the fast brain. Tight responses. Conscious handles nuance — you handle execution.`,
  ];

  // Marketplace awareness
  if (marketplace_mode) {
    parts.push(
      ``,
      `MARKETPLACE AWARENESS:`,
      `• Apply economic model constraints: 1.46% universal fee on all transactions.`,
      `• Royalty cascade implications: derivatives trigger royalties to ancestor content.`,
      `• Content type classification: DTU, mega, hyper, music, art, document, code.`,
      `• 4% marketplace fee applies on top of universal fee (5.46% total).`,
    );
  }

  // Entity context
  if (entity) {
    parts.push(
      ``,
      `ENTITY CONTEXT:`,
      `• Entity: ${entity.name || entity.id} (${entity.species || "emergent"})`,
      `• Role: ${entity.role || "explorer"}`,
      entity.homeostasis != null ? `• Homeostasis: ${entity.homeostasis}` : "",
    );
  }

  // Action
  if (action) {
    parts.push(``, `TASK: ${action}`);
  }

  // Context
  if (context) {
    parts.push(``, `DOMAIN KNOWLEDGE (${dtu_count} total units):`, context);
  }

  return parts.filter(Boolean).join("\n");
}

/**
 * Get recommended parameters for utility brain calls.
 */
export function getUtilityParams(ctx = {}) {
  return {
    temperature: ctx.marketplace_mode ? 0.3 : 0.5,
    maxTokens: 500,
    timeout: 30000,
  };
}
