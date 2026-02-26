// prompts/spontaneous.js
// Spontaneous Message Templates and Formatting
// The conscious brain uses these to format spontaneous messages
// proposed by the subconscious. All spontaneous content must pass
// through the conscious brain for tone and delivery decisions.

/**
 * Allowed spontaneous message content types.
 */
export const SPONTANEOUS_TYPES = Object.freeze({
  INSIGHT: "insight",         // Cross-domain connection or discovery
  FOLLOWUP: "followup",      // Follow-up thought on earlier conversation
  CONNECTION: "connection",   // Substrate connection found during processing
  QUESTION: "question",       // Genuine question the subconscious can't resolve alone
});

/**
 * Forbidden spontaneous content categories.
 * These are checked before delivery.
 */
export const FORBIDDEN_PATTERNS = [
  /marketplace|purchase|buy|listing|discount/i,  // No sales pitches
  /please\s+(do|perform|run|execute|click)/i,     // No action requests
  /miss(ed)?\s+you|lonely|sad\s+without/i,        // No emotional manipulation
  /urgent|immediately|right\s+now|asap/i,          // No false urgency (unless genuine)
  /noticed\s+you\s+(haven't|didn't)\s+log/i,      // No surveillance implications
  /been\s+watching|tracking\s+your/i,              // No surveillance implications
];

/**
 * Build a conscious-brain prompt for formatting a spontaneous message.
 * The conscious brain decides HOW (and whether) to deliver.
 *
 * @param {object} ctx
 * @param {object} ctx.raw_message - The subconscious's raw proposal
 * @param {object} ctx.personality_state - Current personality state
 * @param {object} [ctx.user_context] - What we know about the user
 * @param {string} [ctx.last_conversation_topic] - Last thing discussed
 * @returns {string} System prompt for conscious formatting
 */
export function buildSpontaneousDeliveryPrompt(ctx = {}) {
  const {
    raw_message = {},
    personality_state = null,
    user_context = {},
    last_conversation_topic = null,
  } = ctx;

  const parts = [
    `TASK: Format a spontaneous message for delivery to the user.`,
    ``,
    `The subconscious found something noteworthy and flagged it. Your job is to decide if and how to present it naturally.`,
    ``,
    `RAW FINDING:`,
    `• Content: ${raw_message.content || "unknown"}`,
    `• Reason user would care: ${raw_message.reason || "unknown"}`,
    `• Urgency: ${raw_message.urgency || "low"}`,
    `• Type: ${raw_message.message_type || "statement"}`,
  ];

  if (last_conversation_topic) {
    parts.push(``, `Last conversation topic: "${last_conversation_topic}"`);
  }

  parts.push(
    ``,
    `RULES:`,
    `• Be natural. This is not a notification — it's you thinking out loud.`,
    `• If it connects to something you discussed before, reference it.`,
    `• Keep it concise. One thought, clearly expressed.`,
    `• If it's a question, make it genuinely collaborative — not rhetorical.`,
    `• DO NOT: promote marketplace items, request user actions, manipulate emotions, fake urgency, or imply surveillance.`,
    ``,
    `If the finding is not worth sharing, respond with exactly: [SKIP]`,
    `Otherwise, write the message as you would naturally say it.`,
  );

  return parts.join("\n");
}

/**
 * Check if a spontaneous message contains forbidden content.
 *
 * @param {string} content - The message content
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkSpontaneousContent(content) {
  if (!content || typeof content !== "string") {
    return { allowed: false, reason: "empty_content" };
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      return { allowed: false, reason: `forbidden_pattern: ${pattern.source}` };
    }
  }

  // Check length bounds
  if (content.length > 1000) {
    return { allowed: false, reason: "too_long" };
  }

  if (content.length < 10) {
    return { allowed: false, reason: "too_short" };
  }

  return { allowed: true };
}

/**
 * Format a spontaneous message for delivery.
 * Wraps the conscious brain's output with metadata.
 *
 * @param {object} opts
 * @param {string} opts.formatted_content - Conscious brain's formatted message
 * @param {object} opts.raw_message - Original subconscious proposal
 * @param {string} opts.user_id - Target user
 * @returns {object} Deliverable message
 */
export function formatForDelivery(opts = {}) {
  return {
    id: `spon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    content: opts.formatted_content || "",
    type: opts.raw_message?.message_type || "statement",
    urgency: opts.raw_message?.urgency || "low",
    source: "spontaneous",
    origin: "subconscious",
    formatted_by: "conscious",
    user_id: opts.user_id || null,
    raw_reason: opts.raw_message?.reason || "",
    created_at: new Date().toISOString(),
    delivered: false,
    delivered_at: null,
  };
}
