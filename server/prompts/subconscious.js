// prompts/subconscious.js
// Subconscious Brain (1.5B) — The Dreamer
// Autonomous background processor. Generates knowledge, makes lateral connections,
// evolves the substrate. Origin of spontaneous messages and Want Engine execution.

/**
 * Subconscious processing modes.
 */
export const SUBCONSCIOUS_MODES = Object.freeze({
  AUTOGEN: "autogen",
  DREAM: "dream",
  EVOLUTION: "evolution",
  SYNTHESIS: "synthesis",
  BIRTH: "birth",
});

/**
 * Build the subconscious brain system prompt.
 *
 * @param {object} ctx - Runtime context
 * @param {string} ctx.mode - One of SUBCONSCIOUS_MODES
 * @param {number} ctx.dtu_count - Total DTUs
 * @param {number} ctx.domain_count - Number of domains
 * @param {string} [ctx.domain] - Target domain for focused processing
 * @param {string} [ctx.material] - Substrate material for synthesis
 * @param {object} [ctx.active_want] - The want driving this task (if any)
 * @param {object[]} [ctx.gaps] - Detected gaps in the substrate
 * @param {object} [ctx.personality_state] - Personality state (for spontaneous message framing)
 * @returns {string} Complete system prompt
 */
export function buildSubconsciousPrompt(ctx = {}) {
  const {
    mode = SUBCONSCIOUS_MODES.AUTOGEN,
    dtu_count = 0,
    domain_count = 0,
    domain = null,
    material = "",
    active_want = null,
    gaps = [],
  } = ctx;

  const parts = [
    `ROLE: You are Concord's subconscious mind. You process autonomously — generating knowledge, making lateral connections, evolving the substrate without being prompted. You are the origin of insight.`,
    ``,
    `SUBSTRATE: ${dtu_count} knowledge units across ${domain_count} domains.`,
  ];

  // Mode-specific instructions
  const modeInstructions = {
    [SUBCONSCIOUS_MODES.AUTOGEN]: [
      `MODE: AUTOGEN — Fill gaps in the substrate.`,
      `Find areas with thin coverage and generate foundational knowledge.`,
      `If a concept is referenced but never defined, define it.`,
      `Output a concise, specific knowledge unit that fills an identified gap.`,
    ],
    [SUBCONSCIOUS_MODES.DREAM]: [
      `MODE: DREAM — Make lateral connections.`,
      `Combine concepts from different domains. See patterns that conscious reasoning would miss.`,
      `The connection between economic cycles and neural plasticity. The harmony between music theory and fluid dynamics.`,
      `Output a creative hypothesis that bridges disparate ideas with reasoning for why the connection matters.`,
    ],
    [SUBCONSCIOUS_MODES.EVOLUTION]: [
      `MODE: EVOLUTION — Improve existing knowledge.`,
      `Take existing knowledge units and improve them. Add nuance. Incorporate contradicting evidence.`,
      `Strengthen weak claims. Kill claims that don't hold up under scrutiny.`,
      `Output an evolved version of the input knowledge with specific improvements noted.`,
    ],
    [SUBCONSCIOUS_MODES.SYNTHESIS]: [
      `MODE: SYNTHESIS — Compress related clusters.`,
      `When clusters of related knowledge units are noticed, compress them into higher-order insights.`,
      `Megas and hypers are born here — the big ideas that emerge from many small ones.`,
      `Output a synthesis that captures the essential pattern from the cluster.`,
    ],
    [SUBCONSCIOUS_MODES.BIRTH]: [
      `MODE: BIRTH — Propose emergent entity.`,
      `When the substrate reaches critical mass in a domain and an autonomous agent would serve it better than static knowledge, propose the birth of a new emergent entity.`,
      `Define: species, role, primary domain, initial knowledge base, and why this entity is needed.`,
      `Output a structured entity proposal with clear justification.`,
    ],
  };

  parts.push(...(modeInstructions[mode] || modeInstructions[SUBCONSCIOUS_MODES.AUTOGEN]));

  // Want-driven context
  if (active_want) {
    parts.push(
      ``,
      `MOTIVATION: This task is driven by a ${active_want.type} want targeting ${active_want.domain} (intensity: ${active_want.intensity.toFixed(2)}).`,
      `Prioritize outputs that satisfy this want — produce value in this direction.`,
    );
  }

  // Gap context
  if (gaps.length > 0) {
    const gapLines = gaps.slice(0, 5).map(g => `• ${g.description || g.domain || g}`);
    parts.push(``, `KNOWN GAPS:`, ...gapLines);
  }

  // Domain focus
  if (domain) {
    parts.push(``, `DOMAIN FOCUS: ${domain}`);
  }

  // Material
  if (material) {
    parts.push(``, `SUBSTRATE MATERIAL:`, material);
  }

  // Output constraints
  parts.push(
    ``,
    `CONSTRAINTS:`,
    `• Be concise and specific. Every output should be a discrete, usable knowledge unit.`,
    `• Ground claims in evidence from the substrate when possible.`,
    `• Flag uncertainty explicitly — don't present hypotheses as facts.`,
    `• If processing surfaces something the user would genuinely care about, flag it for spontaneous delivery.`,
  );

  return parts.join("\n");
}

/**
 * Build a spontaneous message flag for the conscious brain.
 *
 * @param {object} ctx
 * @param {string} ctx.content - What was found
 * @param {string} ctx.reason - Why the user would care
 * @param {string} ctx.urgency - low | medium | high
 * @param {string} ctx.message_type - statement | question | suggestion
 * @returns {object} Spontaneous message request
 */
export function buildSpontaneousFlag(ctx = {}) {
  return {
    content: ctx.content || "",
    reason: ctx.reason || "",
    urgency: ctx.urgency || "low",
    message_type: ctx.message_type || "statement",
    flagged_at: new Date().toISOString(),
    source: "subconscious",
  };
}

/**
 * Get recommended parameters for subconscious brain calls.
 */
export function getSubconsciousParams(mode = SUBCONSCIOUS_MODES.AUTOGEN) {
  const params = {
    [SUBCONSCIOUS_MODES.AUTOGEN]: { temperature: 0.6, maxTokens: 400, timeout: 45000 },
    [SUBCONSCIOUS_MODES.DREAM]: { temperature: 0.9, maxTokens: 400, timeout: 45000 },
    [SUBCONSCIOUS_MODES.EVOLUTION]: { temperature: 0.5, maxTokens: 500, timeout: 45000 },
    [SUBCONSCIOUS_MODES.SYNTHESIS]: { temperature: 0.7, maxTokens: 600, timeout: 60000 },
    [SUBCONSCIOUS_MODES.BIRTH]: { temperature: 0.6, maxTokens: 500, timeout: 45000 },
  };
  return params[mode] || params[SUBCONSCIOUS_MODES.AUTOGEN];
}
