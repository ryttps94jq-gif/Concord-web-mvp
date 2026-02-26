// prompts/want-integration.js
// Want Engine integration with the brain system and goal system.
// Bridges wants with the existing scheduler and goal detection.
// Wants amplify matching goals — they don't replace them.

import {
  getWantStore, getActiveWants, createWant, boostWant,
  recordSatisfaction, recordFrustration, recordAction,
  getHighIntensityWants, getWantPriorities, canConsumeProcessing,
  WANT_TYPES, WANT_ORIGINS,
} from "./want-engine.js";

// ── Want-Goal Amplification ───────────────────────────────────────────────────

/**
 * Amplify a goal's priority based on matching wants.
 * No matching want = goal runs at normal priority (unmodified).
 *
 * @param {object} STATE
 * @param {object} goal - A goal from emergent/goals.js
 * @returns {number} Amplified priority (original * multiplier)
 */
export function amplifyGoalPriority(STATE, goal) {
  if (!goal) return 0;

  const priorities = getWantPriorities(STATE);
  const domainMultiplier = priorities.get(goal.domain) || 1.0;
  const wildcardMultiplier = priorities.get("*") || 1.0;

  // Use the higher of domain-specific or wildcard multiplier
  const multiplier = Math.max(domainMultiplier, wildcardMultiplier);

  return Math.min(goal.priority * multiplier, 1.0);
}

// ── Want Generation from Signals ──────────────────────────────────────────────

/**
 * Generate wants from substrate gap detection.
 * Called when the goal system detects gaps.
 *
 * @param {object} STATE
 * @param {object} gap - Gap detection result
 * @param {string} gap.domain - Domain with the gap
 * @param {string} gap.type - Type of gap (coverage, quality, etc.)
 * @param {number} gap.severity - 0–1
 * @returns {{ ok: boolean, want?: object }}
 */
export function generateWantFromGap(STATE, gap) {
  if (!gap || !gap.domain) return { ok: false, error: "invalid_gap" };

  // Map gap types to want types
  const typeMap = {
    coverage: WANT_TYPES.CURIOSITY,
    quality: WANT_TYPES.MASTERY,
    connection: WANT_TYPES.CONNECTION,
    structural: WANT_TYPES.REPAIR,
  };

  const wantType = typeMap[gap.type] || WANT_TYPES.CURIOSITY;
  const intensity = Math.min((gap.severity || 0.5) * 0.6, 0.6); // Initial intensity capped

  return createWant(STATE, {
    type: wantType,
    domain: gap.domain,
    intensity,
    origin: WANT_ORIGINS.SUBSTRATE_GAP,
    description: `Gap detected: ${gap.type} in ${gap.domain}`,
  });
}

/**
 * Generate wants from user interaction patterns.
 * Called when a user engages significantly with a topic.
 *
 * @param {object} STATE
 * @param {object} interaction
 * @param {string} interaction.domain - Topic domain
 * @param {number} interaction.engagement - 0–1 engagement level
 * @param {boolean} interaction.repeated - Whether user has asked about this before
 */
export function generateWantFromInteraction(STATE, interaction) {
  if (!interaction || !interaction.domain) return { ok: false, error: "invalid_interaction" };

  // Only generate wants from significant interactions
  if ((interaction.engagement || 0) < 0.5) return { ok: false, error: "engagement_too_low" };

  // If repeated, lean toward mastery; if new, lean toward curiosity
  const wantType = interaction.repeated ? WANT_TYPES.MASTERY : WANT_TYPES.CURIOSITY;
  const intensity = Math.min((interaction.engagement || 0.5) * 0.5, 0.5);

  return createWant(STATE, {
    type: wantType,
    domain: interaction.domain,
    intensity,
    origin: WANT_ORIGINS.USER_INTERACTION,
    description: `User interest in ${interaction.domain}`,
  });
}

/**
 * Generate wants from dream synthesis.
 * Called when the subconscious makes a cross-domain connection.
 *
 * @param {object} STATE
 * @param {object} synthesis
 * @param {string[]} synthesis.domains - Connected domains
 * @param {string} synthesis.insight - The connection found
 */
export function generateWantFromDream(STATE, synthesis) {
  if (!synthesis || !synthesis.domains?.length) return { ok: false, error: "invalid_synthesis" };

  const domain = synthesis.domains.join("↔");

  return createWant(STATE, {
    type: WANT_TYPES.CONNECTION,
    domain,
    intensity: 0.4,
    origin: WANT_ORIGINS.DREAM_SYNTHESIS,
    description: `Connection found: ${synthesis.insight || synthesis.domains.join(" and ")}`,
  });
}

/**
 * Generate repair wants from pain events.
 * Called when the repair cortex detects recurring errors.
 *
 * @param {object} STATE
 * @param {object} pain
 * @param {string} pain.domain - Affected domain
 * @param {string} pain.pattern - Error pattern
 * @param {number} pain.recurrence - How many times this has happened
 */
export function generateWantFromPain(STATE, pain) {
  if (!pain || !pain.domain) return { ok: false, error: "invalid_pain" };

  // Repair wants bypass normal intensity — they're driven by recurrence
  const intensity = Math.min(0.3 + (pain.recurrence || 1) * 0.1, 0.8);

  return createWant(STATE, {
    type: WANT_TYPES.REPAIR,
    domain: pain.domain,
    intensity,
    origin: WANT_ORIGINS.PAIN_EVENT,
    description: `Recurring error: ${pain.pattern || "unknown"} (${pain.recurrence || 1}x)`,
  });
}

// ── Want-Subconscious Task Selection ──────────────────────────────────────────

/**
 * Select the next subconscious task based on want-weighted priorities.
 * Replaces random/round-robin task selection with want-weighted prioritization.
 *
 * @param {object} STATE
 * @param {string[]} availableTasks - Available task types (autogen, dream, evolution, etc.)
 * @param {string} [currentDomain] - Current domain context
 * @returns {{ task: string, domain: string|null, want: object|null }}
 */
export function selectSubconsciousTask(STATE, availableTasks = [], currentDomain = null) {
  const { wants } = getActiveWants(STATE);

  if (wants.length === 0 || availableTasks.length === 0) {
    // No wants — fall back to round-robin
    const task = availableTasks[Math.floor(Math.random() * availableTasks.length)] || "autogen";
    return { task, domain: currentDomain, want: null };
  }

  // Map want types to preferred task types
  const wantToTask = {
    [WANT_TYPES.CURIOSITY]: "autogen",
    [WANT_TYPES.MASTERY]: "evolution",
    [WANT_TYPES.CONNECTION]: "dream",
    [WANT_TYPES.CREATION]: "synthesis",
    [WANT_TYPES.REPAIR]: "evolution",
  };

  // Score each available task based on want alignment
  let bestTask = availableTasks[0];
  let bestScore = 0;
  let bestWant = null;

  for (const want of wants) {
    if (!canConsumeProcessing(want)) continue;

    const preferredTask = wantToTask[want.type];
    if (!preferredTask || !availableTasks.includes(preferredTask)) continue;

    const score = want.intensity;
    if (score > bestScore) {
      bestScore = score;
      bestTask = preferredTask;
      bestWant = want;
    }
  }

  return {
    task: bestTask,
    domain: bestWant?.domain || currentDomain,
    want: bestWant ? { id: bestWant.id, type: bestWant.type, domain: bestWant.domain, intensity: bestWant.intensity } : null,
  };
}

// ── Want-Conscious Spontaneous Trigger ────────────────────────────────────────

/**
 * Check if any high-intensity wants should trigger a spontaneous message.
 * Wants above 0.6 intensity can trigger spontaneous messages.
 *
 * @param {object} STATE
 * @returns {{ should_trigger: boolean, wants: object[] }}
 */
export function checkSpontaneousTrigger(STATE) {
  const { wants } = getHighIntensityWants(STATE, 0.6);

  if (wants.length === 0) {
    return { should_trigger: false, wants: [] };
  }

  // Only the top want triggers spontaneous messages
  const topWant = wants[0];

  return {
    should_trigger: true,
    wants: [{
      id: topWant.id,
      type: topWant.type,
      domain: topWant.domain,
      intensity: topWant.intensity,
      description: topWant.description,
    }],
  };
}

// ── Want Network Effect ───────────────────────────────────────────────────────

/**
 * Apply network effect: when a want is boosted, adjacent domain wants get a smaller boost.
 *
 * @param {object} STATE
 * @param {string} wantId - The want being boosted
 * @param {number} boostAmount - How much the primary want was boosted
 */
export function applyNetworkEffect(STATE, wantId, boostAmount) {
  const store = getWantStore(STATE);
  const primaryWant = store.wants.get(wantId);
  if (!primaryWant) return;

  const primaryDomain = primaryWant.domain;

  // Find adjacent wants (same parent domain or overlapping keywords)
  for (const want of store.wants.values()) {
    if (want.id === wantId || want.status !== "active") continue;

    // Simple adjacency: shared domain prefix
    const primaryParts = primaryDomain.split(".");
    const wantParts = want.domain.split(".");

    if (primaryParts[0] === wantParts[0] && primaryParts[0] !== "general") {
      // Adjacent — apply 20% of the boost
      const adjacentBoost = boostAmount * 0.2;
      boostWant(STATE, want.id, adjacentBoost, "network_effect");
    }
  }
}
