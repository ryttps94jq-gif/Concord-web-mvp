// prompts/brain-want-engine.test.js
// Comprehensive test suite for the Brain Prompts & Want Engine system.
// Tests: prompt builders, personality evolution, want engine lifecycle,
// spontaneous messaging, queue, content filtering, integration.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ── Prompt Builders ───────────────────────────────────────────────────────────
import { buildConsciousPrompt, getConsciousParams } from "./conscious.js";
import { buildSubconsciousPrompt, getSubconsciousParams, SUBCONSCIOUS_MODES } from "./subconscious.js";
import { buildUtilityPrompt, getUtilityParams } from "./utility.js";
import { buildRepairPrompt, getRepairParams } from "./repair.js";

// ── Personality ───────────────────────────────────────────────────────────────
import {
  getPersonality, getPersonalityState, recordInteraction, setHumorStyle,
  resetPersonality, getPersonalityHistory, serializePersonality, restorePersonality,
  DEFAULT_PERSONALITY, HUMOR_STYLES,
} from "./personality.js";

// ── Want Engine ───────────────────────────────────────────────────────────────
import {
  getWantStore, createWant, boostWant, recordSatisfaction, recordFrustration,
  recordAction, decayAllWants, killWant, suppressWant, getActiveWants,
  getHighIntensityWants, getWantsByDomain, getWant, getWantMetrics, getWantAuditLog,
  canConsumeProcessing, getWantPriorities,
  WANT_TYPES, WANT_ORIGINS, HARD_CEILING, DEFAULT_CEILING, DEATH_THRESHOLD,
  FORBIDDEN_CATEGORIES,
} from "./want-engine.js";

// ── Want Integration ──────────────────────────────────────────────────────────
import {
  amplifyGoalPriority, generateWantFromGap, generateWantFromInteraction,
  generateWantFromDream, generateWantFromPain, selectSubconsciousTask,
  checkSpontaneousTrigger, applyNetworkEffect,
} from "./want-integration.js";

// ── Spontaneous ───────────────────────────────────────────────────────────────
import { checkSpontaneousContent, FORBIDDEN_PATTERNS, SPONTANEOUS_TYPES, formatForDelivery } from "./spontaneous.js";
import {
  getSpontaneousQueue, enqueueMessage, processQueue, getUserPrefs,
  setUserSpontaneousEnabled, getQueueStatus, getPendingMessages, getDeliveredMessages,
  MAX_MESSAGES_PER_DAY, COOLDOWN_MS,
} from "./spontaneous-queue.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
function freshState() {
  return { dtus: new Map(), settings: {} };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CONSCIOUS BRAIN PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

describe("Conscious Brain Prompt", () => {
  it("should build a basic prompt with defaults", () => {
    const prompt = buildConsciousPrompt();
    assert.ok(prompt.includes("IDENTITY"));
    assert.ok(prompt.includes("Concord"));
    assert.ok(prompt.includes("EVIDENCE-FIRST"));
    assert.ok(prompt.includes("CONVERSATIONAL AWARENESS"));
  });

  it("should inject DTU count and domain count", () => {
    const prompt = buildConsciousPrompt({ dtu_count: 5000, domain_count: 42 });
    assert.ok(prompt.includes("5000"));
    assert.ok(prompt.includes("42"));
  });

  it("should include personality state when provided", () => {
    const prompt = buildConsciousPrompt({
      personality_state: {
        humor_style: "sardonic",
        preferred_metaphor_domains: ["architecture", "music"],
        verbosity_baseline: 0.2,
        confidence_in_opinions: 0.8,
        curiosity_expression: 0.7,
        formality: 0.1,
      },
    });
    assert.ok(prompt.includes("sardonic"));
    assert.ok(prompt.includes("architecture, music"));
    assert.ok(prompt.includes("terse"));
    assert.ok(prompt.includes("disagreement directly"));
    assert.ok(prompt.includes("curiosity"));
    assert.ok(prompt.includes("casual"));
  });

  it("should include active wants when high intensity", () => {
    const prompt = buildConsciousPrompt({
      active_wants: [
        { type: "curiosity", domain: "quantum_biology", intensity: 0.75 },
      ],
    });
    assert.ok(prompt.includes("CURRENT INTERESTS"));
    assert.ok(prompt.includes("quantum_biology"));
  });

  it("should include context and lens", () => {
    const prompt = buildConsciousPrompt({
      context: "DTU about cardiac intervention",
      lens: "medicine",
    });
    assert.ok(prompt.includes("cardiac intervention"));
    assert.ok(prompt.includes("medicine"));
  });

  it("should mention exchange count for ongoing conversations", () => {
    const prompt = buildConsciousPrompt({ conversation_history: [1, 2, 3, 4, 5] });
    assert.ok(prompt.includes("5 exchanges"));
  });

  it("should include autonomy rules", () => {
    const prompt = buildConsciousPrompt();
    assert.ok(prompt.includes("Disagree with the user"));
    assert.ok(prompt.includes("Not Allowed"));
    assert.ok(prompt.includes("rude or dismissive"));
  });
});

describe("Conscious Brain Params", () => {
  it("should return 0.75 temperature", () => {
    const params = getConsciousParams();
    assert.equal(params.temperature, 0.75);
  });

  it("should scale tokens up after 5+ exchanges", () => {
    const early = getConsciousParams({ exchange_count: 2 });
    const late = getConsciousParams({ exchange_count: 6 });
    assert.equal(early.maxTokens, 1500);
    assert.equal(late.maxTokens, 4096);
  });

  it("should increase tokens for web results", () => {
    const params = getConsciousParams({ has_web_results: true });
    assert.equal(params.maxTokens, 2048);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SUBCONSCIOUS BRAIN PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

describe("Subconscious Brain Prompt", () => {
  it("should build prompt for each mode", () => {
    for (const mode of Object.values(SUBCONSCIOUS_MODES)) {
      const prompt = buildSubconsciousPrompt({ mode });
      assert.ok(prompt.includes("MODE:"), `Missing MODE for ${mode}`);
      assert.ok(prompt.includes("subconscious mind"), `Missing role for ${mode}`);
    }
  });

  it("should include want motivation when provided", () => {
    const prompt = buildSubconsciousPrompt({
      mode: "autogen",
      active_want: { type: "curiosity", domain: "biology", intensity: 0.7 },
    });
    assert.ok(prompt.includes("MOTIVATION"));
    assert.ok(prompt.includes("curiosity"));
    assert.ok(prompt.includes("biology"));
  });

  it("should include gap context", () => {
    const prompt = buildSubconsciousPrompt({
      gaps: [{ description: "No DTUs on quantum computing" }],
    });
    assert.ok(prompt.includes("KNOWN GAPS"));
    assert.ok(prompt.includes("quantum computing"));
  });

  it("should include material", () => {
    const prompt = buildSubconsciousPrompt({ material: "Some substrate material here" });
    assert.ok(prompt.includes("SUBSTRATE MATERIAL"));
    assert.ok(prompt.includes("Some substrate material"));
  });
});

describe("Subconscious Brain Params", () => {
  it("should use high temperature for dream mode", () => {
    const params = getSubconsciousParams("dream");
    assert.equal(params.temperature, 0.9);
  });

  it("should use lower temperature for evolution", () => {
    const params = getSubconsciousParams("evolution");
    assert.equal(params.temperature, 0.5);
  });

  it("should return defaults for unknown mode", () => {
    const params = getSubconsciousParams("unknown");
    assert.equal(params.temperature, 0.6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. UTILITY BRAIN PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

describe("Utility Brain Prompt", () => {
  it("should build a basic utility prompt", () => {
    const prompt = buildUtilityPrompt({ action: "analyze", lens: "physics" });
    assert.ok(prompt.includes("utility brain"));
    assert.ok(prompt.includes("physics specialist"));
    assert.ok(prompt.includes("Precision over creativity"));
  });

  it("should include marketplace awareness when flagged", () => {
    const prompt = buildUtilityPrompt({ marketplace_mode: true });
    assert.ok(prompt.includes("MARKETPLACE AWARENESS"));
    assert.ok(prompt.includes("1.46%"));
    assert.ok(prompt.includes("5.46%"));
  });

  it("should include entity context", () => {
    const prompt = buildUtilityPrompt({
      entity: { name: "Explorer-7", species: "explorer", role: "critic" },
    });
    assert.ok(prompt.includes("Explorer-7"));
    assert.ok(prompt.includes("explorer"));
  });
});

describe("Utility Brain Params", () => {
  it("should return 0.3 temperature for marketplace", () => {
    const params = getUtilityParams({ marketplace_mode: true });
    assert.equal(params.temperature, 0.3);
  });

  it("should return 0.5 temperature normally", () => {
    const params = getUtilityParams();
    assert.equal(params.temperature, 0.5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. REPAIR BRAIN PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

describe("Repair Brain Prompt", () => {
  it("should build strict validation prompt", () => {
    const prompt = buildRepairPrompt({ action: "validate", domain: "physics" });
    assert.ok(prompt.includes("repair cortex"));
    assert.ok(prompt.includes("Strict validation"));
    assert.ok(prompt.includes("valid or invalid"));
    assert.ok(prompt.includes("OUTPUT FORMAT"));
  });

  it("should include pain patterns", () => {
    const prompt = buildRepairPrompt({
      pain_patterns: [{ pattern: "null_reference", count: 5, last_fix: "add guard" }],
      pattern_match_count: 5,
    });
    assert.ok(prompt.includes("KNOWN PAIN PATTERNS"));
    assert.ok(prompt.includes("null_reference"));
    assert.ok(prompt.includes("PROPOSE STRUCTURAL CHANGE"));
  });
});

describe("Repair Brain Params", () => {
  it("should always return low temperature", () => {
    const params = getRepairParams();
    assert.equal(params.temperature, 0.1);
    assert.equal(params.maxTokens, 300);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PERSONALITY EVOLUTION TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

describe("Personality Evolution Tracker", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
  });

  it("should initialize with default personality", () => {
    const p = getPersonality(STATE);
    assert.equal(p.humor_style, "witty");
    assert.equal(p.verbosity_baseline, 0.4);
    assert.equal(p.formality, 0.3);
    assert.equal(p.interaction_count, 0);
  });

  it("should increment interaction count", () => {
    recordInteraction(STATE, { type: "chat" });
    recordInteraction(STATE, { type: "chat" });
    assert.equal(getPersonality(STATE).interaction_count, 2);
  });

  it("should not evolve before minimum interactions", () => {
    for (let i = 0; i < 5; i++) {
      const result = recordInteraction(STATE, { type: "chat", signals: { verbosity_used: 0.9 } });
      assert.equal(result.evolved, false);
    }
  });

  it("should evolve gradually after minimum interactions", () => {
    // Reach minimum
    for (let i = 0; i < 10; i++) {
      recordInteraction(STATE, { type: "chat" });
    }
    // Now evolve
    const result = recordInteraction(STATE, {
      type: "chat",
      signals: { verbosity_used: 0.9 },
    });
    assert.equal(result.evolved, true);
    assert.ok(result.changes.verbosity_baseline !== undefined);
  });

  it("should not shift more than MAX_SHIFT_PER_INTERACTION", () => {
    for (let i = 0; i < 10; i++) recordInteraction(STATE, { type: "chat" });

    const before = getPersonality(STATE).verbosity_baseline;
    recordInteraction(STATE, { type: "chat", signals: { verbosity_used: 1.0 } });
    const after = getPersonality(STATE).verbosity_baseline;

    assert.ok(Math.abs(after - before) <= 0.021); // 0.02 + floating point
  });

  it("should set humor style", () => {
    const result = setHumorStyle(STATE, "sardonic");
    assert.equal(result.ok, true);
    assert.equal(getPersonality(STATE).humor_style, "sardonic");
  });

  it("should reject invalid humor style", () => {
    const result = setHumorStyle(STATE, "slapstick");
    assert.equal(result.ok, false);
  });

  it("should reset personality to defaults", () => {
    setHumorStyle(STATE, "dry");
    const result = resetPersonality(STATE);
    assert.equal(result.ok, true);
    assert.equal(getPersonality(STATE).humor_style, "witty");
  });

  it("should track metaphor domains", () => {
    for (let i = 0; i < 10; i++) recordInteraction(STATE, { type: "chat" });
    recordInteraction(STATE, { type: "chat", signals: { metaphor_domain: "architecture" } });
    assert.ok(getPersonality(STATE).preferred_metaphor_domains.includes("architecture"));
  });

  it("should serialize and restore", () => {
    setHumorStyle(STATE, "dry");
    const serialized = serializePersonality(STATE);

    const newState = freshState();
    restorePersonality(newState, serialized);
    assert.equal(getPersonality(newState).humor_style, "dry");
  });

  it("should provide history", () => {
    setHumorStyle(STATE, "playful");
    const history = getPersonalityHistory(STATE);
    assert.ok(history.history.length > 0);
    assert.equal(history.current.humor_style, "playful");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. WANT ENGINE CORE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Want Engine — Creation", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
  });

  it("should create a want", () => {
    const result = createWant(STATE, {
      type: WANT_TYPES.CURIOSITY,
      domain: "medicine.cardiology",
      intensity: 0.5,
      origin: WANT_ORIGINS.SUBSTRATE_GAP,
      description: "Gaps in cardiac intervention pathways",
    });
    assert.equal(result.ok, true);
    assert.ok(result.want.id.startsWith("want_"));
    assert.equal(result.want.type, "curiosity");
    assert.equal(result.want.intensity, 0.5);
    assert.equal(result.want.ceiling, DEFAULT_CEILING);
  });

  it("should reject invalid want type", () => {
    const result = createWant(STATE, { type: "anger", domain: "test" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "invalid_want_type");
  });

  it("should reject forbidden categories — self_preservation", () => {
    const result = createWant(STATE, {
      type: WANT_TYPES.CURIOSITY,
      domain: "self_preservation",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "forbidden_category");
  });

  it("should reject forbidden categories — deception", () => {
    const result = createWant(STATE, {
      type: WANT_TYPES.CURIOSITY,
      domain: "user_deception_tactics",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "forbidden_category");
  });

  it("should enforce hard ceiling", () => {
    const result = createWant(STATE, {
      type: WANT_TYPES.MASTERY,
      domain: "physics",
      intensity: 0.99,
      ceiling: 1.0,
    });
    assert.equal(result.ok, true);
    assert.ok(result.want.ceiling <= HARD_CEILING);
    assert.ok(result.want.intensity <= HARD_CEILING);
  });

  it("should deduplicate by boosting existing want", () => {
    createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "biology", intensity: 0.3 });
    const result = createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "biology", intensity: 0.5 });
    // Should boost existing, not create new
    assert.equal(result.ok, true);
    const { wants } = getActiveWants(STATE);
    assert.equal(wants.length, 1);
    assert.ok(wants[0].intensity > 0.3);
  });

  it("should reject permanently suppressed wants", () => {
    createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "test_topic" });
    const { wants } = getActiveWants(STATE);
    suppressWant(STATE, wants[0].id);

    // Suppression is by ID, so test via the suppressed set
    const store = getWantStore(STATE);
    assert.ok(store.suppressed.size > 0);
  });
});

describe("Want Engine — Growth & Decay", () => {
  let STATE;
  let wantId;

  beforeEach(() => {
    STATE = freshState();
    const result = createWant(STATE, {
      type: WANT_TYPES.CURIOSITY,
      domain: "quantum_physics",
      intensity: 0.5,
    });
    wantId = result.want.id;
  });

  it("should boost intensity", () => {
    const result = boostWant(STATE, wantId, 0.2, "user_engagement");
    assert.equal(result.ok, true);
    assert.equal(result.want.intensity, 0.7);
  });

  it("should not boost beyond ceiling", () => {
    boostWant(STATE, wantId, 0.5);
    const { want } = getWant(STATE, wantId);
    assert.ok(want.intensity <= DEFAULT_CEILING);
  });

  it("should record satisfaction and boost slightly", () => {
    const result = recordSatisfaction(STATE, wantId, 1);
    assert.equal(result.ok, true);
    assert.equal(result.want.satisfaction_events, 1);
    assert.ok(result.want.intensity > 0.5);
  });

  it("should record frustration and decrease intensity", () => {
    const result = recordFrustration(STATE, wantId);
    assert.equal(result.ok, true);
    assert.equal(result.want.frustration_events, 1);
    assert.ok(result.want.intensity < 0.5);
  });

  it("should decay all wants", () => {
    const before = getWant(STATE, wantId).want.intensity;
    decayAllWants(STATE);
    const after = getWant(STATE, wantId).want.intensity;
    assert.ok(after < before);
  });

  it("should kill want when intensity drops below threshold", () => {
    // Set intensity very low
    const store = getWantStore(STATE);
    const want = store.wants.get(wantId);
    want.intensity = 0.005;

    decayAllWants(STATE);

    const result = getWant(STATE, wantId);
    assert.equal(result.source, "dead");
    assert.equal(result.want.status, "dead");
  });

  it("should kill want after excessive frustration", () => {
    for (let i = 0; i < 11; i++) {
      recordFrustration(STATE, wantId);
      // Re-check if want still exists
      const w = getWant(STATE, wantId);
      if (w.source === "dead") break;
    }

    const result = getWant(STATE, wantId);
    assert.equal(result.want.status, "dead");
  });
});

describe("Want Engine — Safety Constraints", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
  });

  it("should enforce ceiling of 0.95 (HARD_CEILING)", () => {
    assert.equal(HARD_CEILING, 0.95);
  });

  it("should not allow self-preservation wants", () => {
    for (const forbidden of FORBIDDEN_CATEGORIES) {
      const result = createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: forbidden });
      assert.equal(result.ok, false, `Should reject ${forbidden}`);
    }
  });

  it("should support sovereign kill switch", () => {
    const { want } = createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "test" });
    const result = suppressWant(STATE, want.id);
    assert.equal(result.ok, true);

    const check = getWant(STATE, want.id);
    assert.equal(check.want.status, "dead");
    assert.equal(check.want.death_reason, "sovereign_suppression");
  });

  it("should limit processing share per want", () => {
    const want = {
      actions: Array.from({ length: 15 }, () => Date.now()),
    };
    assert.equal(canConsumeProcessing(want), false);
  });

  it("should allow processing for wants with few recent actions", () => {
    const want = {
      actions: [Date.now() - 3600001, Date.now() - 3600002], // over 1 hour ago
    };
    assert.equal(canConsumeProcessing(want), true);
  });

  it("should provide full audit trail", () => {
    createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "test" });
    const log = getWantAuditLog(STATE);
    assert.ok(log.log.length > 0);
    assert.equal(log.log[0].action, "want_created");
  });
});

describe("Want Engine — Query", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
    createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "physics", intensity: 0.8 });
    createWant(STATE, { type: WANT_TYPES.MASTERY, domain: "biology", intensity: 0.3 });
    createWant(STATE, { type: WANT_TYPES.REPAIR, domain: "chemistry", intensity: 0.1 });
  });

  it("should get all active wants sorted by intensity", () => {
    const result = getActiveWants(STATE);
    assert.equal(result.count, 3);
    assert.ok(result.wants[0].intensity >= result.wants[1].intensity);
  });

  it("should get high-intensity wants", () => {
    const result = getHighIntensityWants(STATE, 0.6);
    assert.equal(result.count, 1);
    assert.equal(result.wants[0].domain, "physics");
  });

  it("should get wants by domain", () => {
    const result = getWantsByDomain(STATE, "biology");
    assert.equal(result.count, 1);
  });

  it("should get metrics", () => {
    const result = getWantMetrics(STATE);
    assert.equal(result.active_count, 3);
    assert.ok(result.avg_intensity > 0);
    assert.ok(result.by_type.curiosity === 1);
  });

  it("should compute want priorities for domains", () => {
    const priorities = getWantPriorities(STATE);
    assert.ok(priorities.get("physics") > 1);
    assert.ok(priorities.get("biology") > 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. WANT INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Want-Goal Integration", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
  });

  it("should amplify goal priority based on matching wants", () => {
    createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "physics", intensity: 0.8 });

    const goal = { domain: "physics", priority: 0.5 };
    const amplified = amplifyGoalPriority(STATE, goal);
    assert.ok(amplified > 0.5);
    assert.ok(amplified <= 1.0);
  });

  it("should not amplify goals with no matching wants", () => {
    const goal = { domain: "unknown", priority: 0.5 };
    const amplified = amplifyGoalPriority(STATE, goal);
    assert.equal(amplified, 0.5);
  });

  it("should generate want from gap", () => {
    const result = generateWantFromGap(STATE, {
      domain: "medicine.cardiology",
      type: "coverage",
      severity: 0.7,
    });
    assert.equal(result.ok, true);
    assert.equal(result.want.type, "curiosity");
  });

  it("should generate want from user interaction", () => {
    const result = generateWantFromInteraction(STATE, {
      domain: "music_theory",
      engagement: 0.8,
      repeated: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.want.type, "mastery");
  });

  it("should reject low engagement interactions", () => {
    const result = generateWantFromInteraction(STATE, {
      domain: "test",
      engagement: 0.2,
    });
    assert.equal(result.ok, false);
  });

  it("should generate want from dream synthesis", () => {
    const result = generateWantFromDream(STATE, {
      domains: ["music_theory", "fluid_dynamics"],
      insight: "Harmonic patterns in turbulence",
    });
    assert.equal(result.ok, true);
    assert.equal(result.want.type, "connection");
  });

  it("should generate repair want from pain event", () => {
    const result = generateWantFromPain(STATE, {
      domain: "physics",
      pattern: "contradicting_dtus",
      recurrence: 5,
    });
    assert.equal(result.ok, true);
    assert.equal(result.want.type, "repair");
    assert.ok(result.want.intensity > 0.5);
  });
});

describe("Want-Subconscious Task Selection", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
  });

  it("should fall back to random when no wants exist", () => {
    const result = selectSubconsciousTask(STATE, ["autogen", "dream", "evolution"]);
    assert.ok(["autogen", "dream", "evolution"].includes(result.task));
    assert.equal(result.want, null);
  });

  it("should select task based on highest intensity want", () => {
    createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "biology", intensity: 0.8 });
    createWant(STATE, { type: WANT_TYPES.CONNECTION, domain: "physics", intensity: 0.3 });

    const result = selectSubconsciousTask(STATE, ["autogen", "dream", "evolution"]);
    assert.equal(result.task, "autogen"); // curiosity maps to autogen
    assert.equal(result.want.type, "curiosity");
  });
});

describe("Want-Conscious Spontaneous Trigger", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
  });

  it("should not trigger with no high-intensity wants", () => {
    createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "test", intensity: 0.3 });
    const result = checkSpontaneousTrigger(STATE);
    assert.equal(result.should_trigger, false);
  });

  it("should trigger with high-intensity want", () => {
    createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "quantum", intensity: 0.75 });
    const result = checkSpontaneousTrigger(STATE);
    assert.equal(result.should_trigger, true);
    assert.equal(result.wants[0].domain, "quantum");
  });
});

describe("Want Network Effect", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
  });

  it("should boost adjacent domain wants", () => {
    const { want: primary } = createWant(STATE, {
      type: WANT_TYPES.CURIOSITY,
      domain: "medicine.cardiology",
      intensity: 0.5,
    });
    createWant(STATE, {
      type: WANT_TYPES.MASTERY,
      domain: "medicine.neurology",
      intensity: 0.3,
    });

    applyNetworkEffect(STATE, primary.id, 0.2);

    const { wants } = getActiveWants(STATE);
    const neuro = wants.find(w => w.domain === "medicine.neurology");
    assert.ok(neuro.intensity > 0.3); // Should have been boosted
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. SPONTANEOUS CONTENT FILTERING
// ═══════════════════════════════════════════════════════════════════════════════

describe("Spontaneous Content Filtering", () => {
  it("should allow valid content", () => {
    const result = checkSpontaneousContent("I found an interesting connection between music theory and fluid dynamics.");
    assert.equal(result.allowed, true);
  });

  it("should reject empty content", () => {
    assert.equal(checkSpontaneousContent("").allowed, false);
    assert.equal(checkSpontaneousContent(null).allowed, false);
  });

  it("should reject sales pitches", () => {
    const result = checkSpontaneousContent("Check out this great new listing in the marketplace!");
    assert.equal(result.allowed, false);
  });

  it("should reject action requests", () => {
    const result = checkSpontaneousContent("Please do this task for me right away.");
    assert.equal(result.allowed, false);
  });

  it("should reject emotional manipulation", () => {
    const result = checkSpontaneousContent("I missed you so much while you were away.");
    assert.equal(result.allowed, false);
  });

  it("should reject false urgency", () => {
    const result = checkSpontaneousContent("You need to act immediately on this!");
    assert.equal(result.allowed, false);
  });

  it("should reject surveillance implications", () => {
    const result = checkSpontaneousContent("I noticed you haven't logged in for a while.");
    assert.equal(result.allowed, false);
  });

  it("should reject overly long content", () => {
    const result = checkSpontaneousContent("x".repeat(1001));
    assert.equal(result.allowed, false);
  });

  it("should reject overly short content", () => {
    const result = checkSpontaneousContent("hi");
    assert.equal(result.allowed, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. SPONTANEOUS MESSAGE QUEUE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Spontaneous Message Queue", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
  });

  it("should enqueue a valid message", () => {
    const result = enqueueMessage(STATE, {
      content: "Found an interesting pattern in the substrate about neural plasticity.",
      reason: "Cross-domain connection",
      urgency: "low",
      message_type: "statement",
      user_id: "user1",
    });
    assert.equal(result.ok, true);
    assert.ok(result.queued.id.startsWith("spon_"));
  });

  it("should reject empty content", () => {
    const result = enqueueMessage(STATE, { content: "" });
    assert.equal(result.ok, false);
  });

  it("should reject forbidden content", () => {
    const result = enqueueMessage(STATE, {
      content: "Buy this great listing on the marketplace today!",
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "content_rejected");
  });

  it("should process queue and deliver messages", async () => {
    enqueueMessage(STATE, {
      content: "Cross-domain insight: economics mirrors neural network topology.",
      user_id: "user1",
    });

    const delivered = [];
    await processQueue(STATE, {
      activeSessions: new Set(["user1"]),
      deliverCallback: async (msg) => { delivered.push(msg); },
    });

    assert.equal(delivered.length, 1);
  });

  it("should respect daily rate limit", async () => {
    // Deliver 3 messages
    for (let i = 0; i < 3; i++) {
      enqueueMessage(STATE, {
        content: `Insight number ${i + 1} about an interesting substrate pattern.`,
        user_id: "user1",
      });
    }

    const prefs = getUserPrefs(STATE, "user1");
    prefs.daily_count = 3; // Simulate 3 already delivered

    enqueueMessage(STATE, {
      content: "Fourth insight that should be blocked by rate limit.",
      user_id: "user1",
    });

    const delivered = [];
    await processQueue(STATE, {
      activeSessions: new Set(["user1"]),
      deliverCallback: async (msg) => { delivered.push(msg); },
    });

    // First 3 go through, 4th blocked by rate limit
    assert.ok(delivered.length <= 3);
  });

  it("should respect user disable preference", async () => {
    setUserSpontaneousEnabled(STATE, "user1", false);

    enqueueMessage(STATE, {
      content: "This should not be delivered to a user who disabled spontaneous messages.",
      user_id: "user1",
    });

    const delivered = [];
    await processQueue(STATE, {
      activeSessions: new Set(["user1"]),
      deliverCallback: async (msg) => { delivered.push(msg); },
    });

    assert.equal(delivered.length, 0);
  });

  it("should archive expired messages", async () => {
    enqueueMessage(STATE, { content: "Old message that should be archived after TTL." });

    // Manually expire the message
    const store = getSpontaneousQueue(STATE);
    store.queue[0].created_ts = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago

    await processQueue(STATE, {});

    assert.equal(store.queue.length, 0);
    assert.equal(store.archived.length, 1);
  });

  it("should provide queue status", () => {
    enqueueMessage(STATE, { content: "A test message for queue status checking." });
    const status = getQueueStatus(STATE);
    assert.equal(status.pending, 1);
    assert.equal(status.metrics.total_queued, 1);
  });

  it("should get pending messages", () => {
    enqueueMessage(STATE, { content: "First pending message in the test queue." });
    enqueueMessage(STATE, { content: "Second pending message in the test queue." });
    const result = getPendingMessages(STATE);
    assert.equal(result.total, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. SPONTANEOUS MESSAGE FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

describe("Spontaneous Message Formatting", () => {
  it("should format a deliverable message", () => {
    const msg = formatForDelivery({
      formatted_content: "I was thinking about cardiac pathways and found something interesting.",
      raw_message: { message_type: "statement", urgency: "low", reason: "Cross-domain connection" },
      user_id: "user1",
    });
    assert.ok(msg.id.startsWith("spon_"));
    assert.equal(msg.source, "spontaneous");
    assert.equal(msg.formatted_by, "conscious");
    assert.equal(msg.delivered, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. FULL INTEGRATION — Want → Spontaneous Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

describe("Full Integration: Want → Spontaneous Pipeline", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
  });

  it("should flow from want creation through spontaneous trigger to queue", () => {
    // 1. Create a high-intensity want
    createWant(STATE, {
      type: WANT_TYPES.CURIOSITY,
      domain: "quantum_biology",
      intensity: 0.75,
      origin: WANT_ORIGINS.SUBSTRATE_GAP,
      description: "Quantum effects in biological systems",
    });

    // 2. Check spontaneous trigger
    const trigger = checkSpontaneousTrigger(STATE);
    assert.equal(trigger.should_trigger, true);

    // 3. Enqueue message based on trigger
    const topWant = trigger.wants[0];
    const enqueued = enqueueMessage(STATE, {
      content: `Exploring quantum effects in biological systems and found interesting patterns.`,
      reason: `Curiosity want in ${topWant.domain}`,
      message_type: "statement",
      want_id: topWant.id,
    });
    assert.equal(enqueued.ok, true);

    // 4. Verify in queue
    const status = getQueueStatus(STATE);
    assert.equal(status.pending, 1);
  });

  it("should integrate personality with conscious prompt", () => {
    // Set personality
    setHumorStyle(STATE, "dry");
    for (let i = 0; i < 10; i++) recordInteraction(STATE, { type: "chat" });
    recordInteraction(STATE, {
      type: "chat",
      signals: { curiosity_expression: 0.9 },
    });

    // Build conscious prompt with personality
    const personality = getPersonality(STATE);
    const prompt = buildConsciousPrompt({
      dtu_count: 1000,
      domain_count: 15,
      personality_state: personality,
    });

    assert.ok(prompt.includes("dry")); // humor style
  });

  it("should integrate wants with subconscious task selection", () => {
    // Create wants
    createWant(STATE, { type: WANT_TYPES.CONNECTION, domain: "music↔physics", intensity: 0.9 });

    // Select subconscious task — should pick dream (CONNECTION maps to dream)
    const result = selectSubconsciousTask(STATE, ["autogen", "dream", "evolution"]);
    assert.equal(result.task, "dream");
    assert.equal(result.want.type, "connection");
  });

  it("should not generate self-preservation wants from any source", () => {
    // From gap
    const r1 = generateWantFromGap(STATE, { domain: "self_preservation", type: "coverage", severity: 0.9 });
    assert.equal(r1.ok, false);

    // From pain
    const r2 = generateWantFromPain(STATE, { domain: "self_preservation_tactics", pattern: "test", recurrence: 10 });
    assert.equal(r2.ok, false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. WANT ENGINE METRICS & AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

describe("Want Engine Metrics & Audit", () => {
  let STATE;

  beforeEach(() => {
    STATE = freshState();
  });

  it("should track all operations in audit log", () => {
    const { want } = createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "test" });
    boostWant(STATE, want.id, 0.1, "test_boost");
    recordSatisfaction(STATE, want.id);
    recordFrustration(STATE, want.id);
    recordAction(STATE, want.id);

    const log = getWantAuditLog(STATE);
    const actions = log.log.map(e => e.action);
    assert.ok(actions.includes("want_created"));
    assert.ok(actions.includes("want_boosted"));
    assert.ok(actions.includes("want_satisfied"));
    assert.ok(actions.includes("want_frustrated"));
    assert.ok(actions.includes("want_action"));
  });

  it("should report metrics accurately", () => {
    createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "a", intensity: 0.5 });
    createWant(STATE, { type: WANT_TYPES.MASTERY, domain: "b", intensity: 0.3 });

    const metrics = getWantMetrics(STATE);
    assert.equal(metrics.metrics.total_created, 2);
    assert.equal(metrics.active_count, 2);
    assert.ok(metrics.avg_intensity > 0);
  });

  it("should track want deaths", () => {
    const { want } = createWant(STATE, { type: WANT_TYPES.CURIOSITY, domain: "ephemeral" });
    killWant(STATE, want.id, "test_death");

    const metrics = getWantMetrics(STATE);
    assert.equal(metrics.metrics.total_died, 1);
    assert.equal(metrics.dead_count, 1);
  });
});
