/**
 * Affect-Enhanced Retrieval for Concord Cognitive Engine
 *
 * The existential and affect system provides emotional context that
 * improves retrieval relevance. A user expressing frustration gets
 * different context than one expressing curiosity.
 *
 * Entity homeostasis influences what the subconscious prioritizes
 * for synthesis.
 */

import { embed, cosineSimilarity, isEmbeddingAvailable, getEmbedding } from "./embeddings.js";

// ── State ──────────────────────────────────────────────────────────────────

/** @type {{ detections: number, avgValence: number, avgArousal: number, byLens: Map<string, { valence: number, arousal: number, count: number }> }} */
const affectStats = {
  detections: 0,
  avgValence: 0,
  avgArousal: 0,
  byLens: new Map(),
};

/** @type {Function|null} */
let _log = null;

// ── Initialisation ─────────────────────────────────────────────────────────

export function initAffectRetrieval({ structuredLog = console.warn } = {}) {
  _log = structuredLog;
  _log("info", "affect_retrieval_init", {});
}

// ── Core API ───────────────────────────────────────────────────────────────

/**
 * Detect affect (emotional state) from a message using lightweight heuristics.
 * Falls back to rule-based detection if utility brain unavailable.
 *
 * @param {string} message
 * @param {string[]} conversationHistory - Recent messages for context
 * @param {{ callBrain?: Function }} deps
 * @returns {Promise<{ valence: number, arousal: number, dominance: number, flow: number, primary: string }>}
 */
export async function detectAffect(message, conversationHistory = [], { callBrain } = {}) {
  // Rule-based affect detection (fast, always available)
  const affect = _ruleBasedAffect(message);

  // Try LLM-enhanced detection if available
  if (callBrain) {
    try {
      const historyStr = conversationHistory.slice(-3).join("\n").slice(0, 500);
      const prompt = `Analyze the emotional state in this message. Return JSON only:
{"valence": -1 to 1, "arousal": 0 to 1, "dominance": 0 to 1, "flow": 0 to 1, "primary": "emotion_name"}

Message: ${message.slice(0, 500)}
Recent context: ${historyStr}`;

      const result = await callBrain("utility", prompt, {
        temperature: 0.2,
        maxTokens: 100,
        timeout: 5000,
      });

      if (result.ok && result.content) {
        try {
          const parsed = JSON.parse(result.content.trim());
          if (typeof parsed.valence === "number") {
            return {
              valence: _clamp(parsed.valence, -1, 1),
              arousal: _clamp(parsed.arousal ?? affect.arousal, 0, 1),
              dominance: _clamp(parsed.dominance ?? affect.dominance, 0, 1),
              flow: _clamp(parsed.flow ?? affect.flow, 0, 1),
              primary: parsed.primary || affect.primary,
            };
          }
        } catch { /* JSON parse failed, use rule-based */ }
      }
    } catch { /* Brain call failed, use rule-based */ }
  }

  return affect;
}

/**
 * Build brain context with affect modulation.
 * Boosts retrieval results based on user emotional state.
 *
 * @param {string} query
 * @param {string|null} lens
 * @param {{ valence: number, arousal: number, dominance: number, flow: number }} affect
 * @param {{ dtusArray: Function, maxDTUs?: number }} opts
 * @returns {Promise<object[]>}
 */
export async function affectAwareBuildContext(query, lens, affect, { dtusArray, maxDTUs = 10 } = {}) {
  if (!isEmbeddingAvailable()) return [];

  const queryVec = await embed(query);
  if (!queryVec) return [];

  const allDTUs = typeof dtusArray === "function" ? dtusArray() : [];

  let pool = allDTUs;
  if (lens) {
    pool = allDTUs.filter(d => {
      if (d.tier === "hyper" || d.tier === "mega") return true;
      return Array.isArray(d.tags) && d.tags.some(t => t.toLowerCase() === lens.toLowerCase());
    });
  }

  const scored = [];
  for (const dtu of pool) {
    const vec = getEmbedding(dtu.id);
    if (!vec) continue;

    const semanticScore = cosineSimilarity(queryVec, vec);
    const tierWeight = dtu.tier === "hyper" ? 3.0 : dtu.tier === "mega" ? 2.0 : 1.0;
    let affectBoost = 1.0;

    if (affect) {
      const tags = Array.isArray(dtu.tags) ? dtu.tags : [];
      const src = String(dtu.source || "");

      // User is confused → boost explanatory DTUs
      if (affect.valence < -0.3 && affect.arousal > 0.5) {
        if (tags.includes("explanation") || tags.includes("tutorial")) {
          affectBoost = 1.5;
        }
      }

      // User is curious/exploring → boost novel connections
      if (affect.valence > 0.3 && affect.arousal > 0.3) {
        if (src.includes("cross-domain") || src.includes("synthesis")) {
          affectBoost = 1.4;
        }
      }

      // User is frustrated → boost direct answers, suppress tangents
      if (affect.valence < -0.5) {
        if (dtu.tier === "hyper" || dtu.tier === "mega") {
          affectBoost = 1.6; // compressed = direct
        }
        if (src.includes("precomputed")) {
          affectBoost = 1.3;
        }
      }

      // User is in flow state → boost deeper DTUs
      if (affect.flow > 0.7) {
        const connectionCount = (dtu.lineage?.parents?.length || 0) + (dtu.lineage?.children?.length || 0);
        if (connectionCount > 5) affectBoost = 1.3;
      }
    }

    scored.push({
      id: dtu.id,
      title: dtu.title,
      tier: dtu.tier,
      tags: dtu.tags,
      semanticScore,
      finalScore: semanticScore * tierWeight * affectBoost,
      summary: dtu.human?.summary || dtu.cretiHuman || "",
    });
  }

  // Track affect stats
  if (affect) {
    _recordAffect(lens, affect);
  }

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored.slice(0, maxDTUs);
}

/**
 * Determine entity exploration strategy based on homeostasis.
 *
 * @param {{ homeostasis?: { curiosity?: number, anxiety?: number, satisfaction?: number } }} entity
 * @returns {{ strategy: string, targetLens?: string, reason: string }}
 */
export function entityAffectStrategy(entity) {
  const h = entity?.homeostasis || {};

  if ((h.curiosity ?? 0.5) < 0.3) {
    return { strategy: "explore_unfamiliar", reason: "Low curiosity — seek novelty" };
  }

  if ((h.anxiety ?? 0.0) > 0.7) {
    return { strategy: "consolidate_familiar", reason: "High anxiety — strengthen known territory" };
  }

  if ((h.satisfaction ?? 0.5) > 0.7) {
    return { strategy: "cross_pollinate", reason: "High satisfaction — share knowledge" };
  }

  return { strategy: "explore_balanced", reason: "Balanced — normal exploration" };
}

/**
 * Determine what the subconscious should prioritize based on system-wide affect.
 *
 * @param {{ dtusArray?: Function, sessions?: Map }} deps
 * @returns {string} Task type: "precompute", "synthesis", "autogen", "dream"
 */
export function affectDrivenScheduler({ avgFrustration = 0, avgCuriosity = 0, newUserRate = 0, gapCount = 0 } = {}) {
  // High user frustration → prioritize precomputing answers
  if (avgFrustration > 0.5) return "precompute";

  // High novelty seeking → prioritize cross-domain synthesis
  if (avgCuriosity > 0.6) return "synthesis";

  // Many new users → prioritize foundational DTU generation
  if (newUserRate > 0.3) return "autogen";

  // Knowledge gaps → prioritize gap-filling dreams
  if (gapCount > 20) return "dream";

  // Default balanced rotation
  const tasks = ["autogen", "dream", "evolution", "synthesis"];
  return tasks[Math.floor(Math.random() * tasks.length)];
}

/**
 * Get system-wide affect state (aggregate sentiment across users).
 *
 * @returns {object}
 */
export function getSystemAffectState() {
  let totalValence = 0, totalArousal = 0, count = 0;

  for (const [, v] of affectStats.byLens) {
    totalValence += v.valence * v.count;
    totalArousal += v.arousal * v.count;
    count += v.count;
  }

  return {
    avgValence: count > 0 ? totalValence / count : 0,
    avgArousal: count > 0 ? totalArousal / count : 0,
    avgFrustration: count > 0 ? Math.max(0, -(totalValence / count)) : 0,
    avgCuriosity: count > 0 ? Math.max(0, totalArousal / count) : 0,
    totalDetections: affectStats.detections,
    byLens: Object.fromEntries(affectStats.byLens),
  };
}

// ── Internal Helpers ───────────────────────────────────────────────────────

function _clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function _recordAffect(lens, affect) {
  affectStats.detections++;
  affectStats.avgValence = (affectStats.avgValence * (affectStats.detections - 1) + affect.valence) / affectStats.detections;
  affectStats.avgArousal = (affectStats.avgArousal * (affectStats.detections - 1) + affect.arousal) / affectStats.detections;

  const key = lens || "_global";
  if (!affectStats.byLens.has(key)) {
    affectStats.byLens.set(key, { valence: 0, arousal: 0, count: 0 });
  }
  const s = affectStats.byLens.get(key);
  s.count++;
  s.valence = (s.valence * (s.count - 1) + affect.valence) / s.count;
  s.arousal = (s.arousal * (s.count - 1) + affect.arousal) / s.count;
}

/**
 * Rule-based affect detection (fast, no LLM required).
 */
function _ruleBasedAffect(message) {
  const lower = message.toLowerCase();

  // Frustration signals
  const frustrated = /\b(frustrated|annoyed|angry|hate|broken|stupid|terrible|useless|sucks|why won't|doesn't work|not working|can't believe)\b/.test(lower);
  const confused = /\b(confused|don't understand|what does|how does|i'm lost|makes no sense|explain|help me)\b/.test(lower);
  const curious = /\b(interesting|curious|wonder|fascinating|tell me more|explore|what if|how about|could we)\b/.test(lower);
  const satisfied = /\b(great|perfect|thanks|awesome|excellent|love it|works|nice|wonderful)\b/.test(lower);
  const questioning = /\?/.test(message);

  let valence = 0, arousal = 0.5, dominance = 0.5, flow = 0.5;
  let primary = "neutral";

  if (frustrated) {
    valence = -0.7; arousal = 0.8; dominance = 0.3; flow = 0.1;
    primary = "frustration";
  } else if (confused) {
    valence = -0.3; arousal = 0.6; dominance = 0.3; flow = 0.2;
    primary = "confusion";
  } else if (curious) {
    valence = 0.5; arousal = 0.6; dominance = 0.6; flow = 0.6;
    primary = "curiosity";
  } else if (satisfied) {
    valence = 0.7; arousal = 0.4; dominance = 0.7; flow = 0.7;
    primary = "satisfaction";
  } else if (questioning) {
    valence = 0.1; arousal = 0.5; dominance = 0.5; flow = 0.4;
    primary = "inquiry";
  }

  return { valence, arousal, dominance, flow, primary };
}

export default {
  initAffectRetrieval,
  detectAffect,
  affectAwareBuildContext,
  entityAffectStrategy,
  affectDrivenScheduler,
  getSystemAffectState,
};
