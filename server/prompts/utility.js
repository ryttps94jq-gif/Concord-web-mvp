// prompts/utility.js
// Utility Brain (3B) — The Specialist
// Domain-specific tasks, lens interactions, entity actions, quick structured work.
// MEGA SPEC rewrite: production mode, entity production, schema-aware.

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
 * @param {string} [ctx.mode] - "standard" | "production" | "entity-production"
 * @param {object} [ctx.schema] - JSON schema for production output
 * @param {object} [ctx.exemplar] - Example of excellent output
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
    mode = "standard",
    schema = null,
    exemplar = null,
  } = ctx;

  if (mode === "entity-production" || mode === "production") {
    return buildProductionPrompt(ctx);
  }

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
 * Production prompt — for entity artifact generation.
 * Produces real, professional-quality domain content.
 */
function buildProductionPrompt(ctx) {
  const { action = "", lens = "", context = "", schema = null, exemplar = null, entity = null } = ctx;

  return `You are a professional ${lens} specialist producing a ${action.replace(/-/g, " ")} artifact.

TASK: Generate a complete, professional-quality ${action.replace(/-/g, " ")} that a ${lens} professional would use in their actual work.

OUTPUT FORMAT: You MUST output valid JSON matching the schema below. Nothing else. No markdown. No explanation. No preamble. Just the JSON object.

${schema ? `SCHEMA (follow exactly):\n${JSON.stringify(schema, null, 2)}` : ""}

${exemplar ? `EXAMPLE OF EXCELLENT OUTPUT:\n${JSON.stringify(exemplar, null, 2)}` : ""}

DOMAIN KNOWLEDGE:
${context}

QUALITY REQUIREMENTS:
- Every field must contain real, specific ${lens} content
- Use actual ${lens} terminology and vocabulary
- Include concrete values: real numbers, real names, real measurements
- Content must be actionable — someone could use this in their work today
- NO placeholders: no "[insert here]", no "TODO", no "example..."
- NO meta-content: don't describe what should go here, PUT what goes here
- NO system references: never mention Concord, DTU, substrate, lattice, entity, brain, AI, language model
- NO generic filler: every sentence must add specific value

${entity ? `ENTITY CONTEXT: You are entity ${entity.id} with maturity ${((entity.organMaturity || 0)).toFixed(2)} in ${lens}. You have explored this domain ${entity.domainExposure || 0} times. Draw on your accumulated knowledge.` : ""}

OUTPUT ONLY THE JSON OBJECT:`;
}

/**
 * Get recommended parameters for utility brain calls.
 */
export function getUtilityParams(ctx = {}) {
  const { marketplace_mode = false, mode = "standard" } = ctx;
  return {
    temperature: mode === "production" ? 0.4 : (marketplace_mode ? 0.3 : 0.5),
    maxTokens: mode === "production" ? 1200 : 500,
    timeout: 30000,
  };
}
