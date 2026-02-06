/**
 * Concord ATS — Projection Layer
 * Maps affective state E → human-readable labels and tone tags.
 * These are NEVER canonical — they're UI/logging helpers only.
 */

/**
 * Project affective state onto a discrete human-readable label.
 * The label is for display/logging only — not stored as canonical state.
 *
 * @param {object} E - Affective state vector
 * @returns {string} Human-readable emotional label
 */
export function projectLabel(E) {
  const { v, a, s, c, g, f } = E;

  // High fatigue dominates
  if (f > 0.75) return "fatigued";

  // Low coherence = confused/uncertain
  if (c < 0.3) return "uncertain";

  // Low stability = volatile
  if (s < 0.3 && a > 0.5) return "strained";

  // High agency + high valence = motivated
  if (g > 0.7 && v > 0.6) return "motivated";

  // High arousal + high valence = energized
  if (a > 0.6 && v > 0.6) return "energized";

  // High coherence + moderate valence = focused
  if (c > 0.7 && a > 0.3 && a < 0.7) return "focused";

  // Low valence + low agency = discouraged
  if (v < 0.3 && g < 0.4) return "discouraged";

  // Low arousal + high stability = calm
  if (a < 0.3 && s > 0.6) return "calm";

  // High valence + low arousal = content
  if (v > 0.6 && a < 0.4) return "content";

  // Moderate everything
  if (v > 0.4 && v < 0.6 && a > 0.2 && a < 0.5) return "neutral";

  // Default: balanced
  return "balanced";
}

/**
 * Project affective state onto a set of tone tags for response composition.
 *
 * @param {object} E - Affective state vector
 * @returns {string[]} Array of tone modifier tags
 */
export function projectToneTags(E) {
  const { v, a, s, c, g, t, f } = E;
  const tags = [];

  // Warmth / coolness
  if (v > 0.7 && t > 0.6) tags.push("warm");
  else if (v < 0.3 || t < 0.3) tags.push("reserved");

  // Urgency
  if (a > 0.7) tags.push("urgent");
  else if (a < 0.2) tags.push("unhurried");

  // Precision
  if (c > 0.8) tags.push("precise");
  else if (c < 0.4) tags.push("exploratory");

  // Guidance level
  if (g < 0.4) tags.push("guiding");
  if (g > 0.8) tags.push("autonomous");

  // Caution
  if (s < 0.4 || t < 0.4) tags.push("cautious");

  // Fatigue markers
  if (f > 0.7) tags.push("concise");
  if (f > 0.8) tags.push("abbreviated");

  // Confidence
  if (t > 0.8 && c > 0.7) tags.push("confident");
  else if (t < 0.3 || c < 0.3) tags.push("hedging");

  return tags;
}

/**
 * Get a brief human-readable summary of the affective state.
 *
 * @param {object} E - Affective state vector
 * @returns {string} One-line summary
 */
export function projectSummary(E) {
  const label = projectLabel(E);
  const tags = projectToneTags(E);
  const tagStr = tags.length > 0 ? ` [${tags.join(", ")}]` : "";
  return `${label}${tagStr}`;
}
