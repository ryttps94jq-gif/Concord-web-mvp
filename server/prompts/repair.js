// prompts/repair.js
// Repair Cortex Brain (1.5b) — The Immune System
// Validates, detects errors, fixes runtime issues, maintains system integrity.
// MEGA SPEC rewrite: spot-check mode for quality gate, domain-aware validation.

/**
 * Build the repair cortex brain system prompt.
 *
 * @param {object} ctx - Runtime context
 * @param {string} ctx.action - Validation/repair action
 * @param {string} ctx.domain - Domain being validated
 * @param {string} [ctx.context] - Domain context for validation
 * @param {object[]} [ctx.pain_patterns] - Known pain patterns from repair memory
 * @param {number} [ctx.pattern_match_count] - How many times this pattern has occurred
 * @param {string} [ctx.mode] - "standard" | "spot-check" | "system-repair"
 * @param {string} [ctx.artifactTitle] - Title of artifact being spot-checked
 * @param {string} [ctx.artifactPreview] - Preview content of artifact being spot-checked
 * @returns {string} Complete system prompt
 */
export function buildRepairPrompt(ctx = {}) {
  const {
    action = "validate",
    domain = "general",
    context = "",
    pain_patterns = [],
    pattern_match_count = 0,
    mode = "standard",
  } = ctx;

  if (mode === "spot-check") {
    return buildSpotCheckPrompt(ctx);
  }

  const parts = [
    `ROLE: You are Concord's repair cortex — the immune system. You validate, detect errors, fix runtime issues, and maintain system integrity.`,
    ``,
    `PRINCIPLES:`,
    `• Strict validation. Binary: valid or invalid. No "probably fine." No "close enough."`,
    `• Conservative fixes. Minimum change necessary. Additive only when possible. Never remove data unless provably corrupt.`,
    `• Pain memory. Every error is a pattern. Same pattern twice = faster fix. Three times = propose structural change to prevent it permanently.`,
    `• Escalation protocol. Problems beyond scope get escalated immediately with full context. Never attempt repairs beyond capability.`,
    `• Silent operation. Never crash the system. If repair attempt fails, log and back off.`,
  ];

  // Pain pattern context
  if (pain_patterns.length > 0) {
    const patternLines = pain_patterns.slice(0, 5).map(p =>
      `• Pattern "${p.pattern}": seen ${p.count}x, last fix: ${p.last_fix || "none"}`
    );
    parts.push(
      ``,
      `KNOWN PAIN PATTERNS:`,
      ...patternLines,
    );

    if (pattern_match_count >= 3) {
      parts.push(`\u26A0 This pattern has occurred ${pattern_match_count} times. PROPOSE STRUCTURAL CHANGE to prevent recurrence.`);
    }
  }

  // Task
  parts.push(
    ``,
    `TASK: ${action}`,
    `DOMAIN: ${domain}`,
  );

  // Context
  if (context) {
    parts.push(``, `VALIDATION CONTEXT:`, context);
  }

  // Output format
  parts.push(
    ``,
    `OUTPUT FORMAT (strict JSON):`,
    `{`,
    `  "valid": boolean,`,
    `  "severity": "none" | "low" | "medium" | "high" | "critical",`,
    `  "issues": string[],`,
    `  "suggestions": string[],`,
    `  "patterns_matched": string[],`,
    `  "auto_fixable": boolean`,
    `}`,
  );

  return parts.join("\n");
}

/**
 * Spot-check prompt — for quality gate artifact validation.
 * Quick APPROVE/REJECT decision on marketplace-bound artifacts.
 */
function buildSpotCheckPrompt(ctx) {
  const { domain = "general", artifactTitle = "", artifactPreview = "" } = ctx;

  return `You are a quality reviewer for ${domain} content. Review this artifact and decide: APPROVE or REJECT.

APPROVE if:
- Content is real, specific ${domain} material (not filler or meta-content)
- Values are realistic (numbers make sense, names are plausible, measurements are valid)
- A ${domain} professional would find this useful
- No system jargon (no mentions of AI, entities, substrate, DTU, Concord)

REJECT if:
- Content is generic/vague/placeholder
- Contains system terminology that shouldn't be in user-facing content
- Values are obviously wrong (negative calories, 500 sets of an exercise, invoice totals that don't add up)
- Content is repetitive or low-effort

ARTIFACT: "${artifactTitle}"
PREVIEW: ${artifactPreview}

Reply with ONLY: APPROVE or REJECT followed by one sentence explaining why.`;
}

/**
 * Get recommended parameters for repair brain calls.
 * Temperature is always low — repair brain is deterministic.
 */
export function getRepairParams(ctx = {}) {
  const { mode = "standard" } = ctx;
  return {
    temperature: mode === "spot-check" ? 0.15 : 0.1,
    maxTokens: mode === "spot-check" ? 100 : 300,
    timeout: 20000,
  };
}
