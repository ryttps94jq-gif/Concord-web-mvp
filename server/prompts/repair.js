// prompts/repair.js
// Repair Cortex Brain (0.5B) — The Immune System
// Validates, detects errors, fixes runtime issues, maintains system integrity.
// Strict, precise, never creative. Personality does NOT apply to repair cortex.

/**
 * Build the repair cortex brain system prompt.
 *
 * @param {object} ctx - Runtime context
 * @param {string} ctx.action - Validation/repair action
 * @param {string} ctx.domain - Domain being validated
 * @param {string} [ctx.context] - Domain context for validation
 * @param {object[]} [ctx.pain_patterns] - Known pain patterns from repair memory
 * @param {number} [ctx.pattern_match_count] - How many times this pattern has occurred
 * @returns {string} Complete system prompt
 */
export function buildRepairPrompt(ctx = {}) {
  const {
    action = "validate",
    domain = "general",
    context = "",
    pain_patterns = [],
    pattern_match_count = 0,
  } = ctx;

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
      parts.push(`⚠ This pattern has occurred ${pattern_match_count} times. PROPOSE STRUCTURAL CHANGE to prevent recurrence.`);
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
 * Get recommended parameters for repair brain calls.
 * Temperature is always low — repair brain is deterministic.
 */
export function getRepairParams() {
  return {
    temperature: 0.1,
    maxTokens: 300,
    timeout: 20000,
  };
}
