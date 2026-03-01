/**
 * Chat Router — Universal Intent-to-Lens Action Router
 *
 * The single routing layer that maps natural language intent to lens actions.
 * Every user utterance flows through three stages:
 *   1. Classify the action type (one of 8)
 *   2. Identify relevant lenses via manifest tags
 *   3. Determine read/write/synthesis and build a route plan
 *
 * Multi-lens chaining: "help me write a farm insurance policy" →
 *   agriculture + insurance + legal + finance lenses all contribute DTUs
 *   to a single CREATE action. The conscious brain synthesizes.
 *
 * Integrates with (does NOT replace):
 *   - chat-lens-recommender.ts (FE-side recommendation display)
 *   - context-engine.js (activation/working set)
 *   - lens-integration.js (DTU enrichment)
 *   - session context accumulator (compounding context)
 *
 * The chat rail's capability set is always exactly equal to
 * the total lens count at that moment — no deployment, no update.
 */

import {
  ACTION_TYPES,
  WRITE_ACTION_TYPES,
  READ_ACTION_TYPES,
  findByTags,
  findByActionType,
  getManifest,
  getAllManifests,
  getManifestStats,
} from "./lens-manifest.js";

export { ACTION_TYPES };

// ── Intent Classification Patterns ───────────────────────────────────────
// Maps natural language to the 8 action types.

const INTENT_PATTERNS = [
  // QUERY — retrievals, lookups, searches
  {
    type: ACTION_TYPES.QUERY,
    patterns: [
      /\b(what\s+is|what\s+are|show\s+me|find|look\s+up|search\s+for|get|fetch|list|where\s+is|who\s+is|tell\s+me\s+about)\b/i,
      /^(what|where|who|which|how\s+many)\b/i,
    ],
    weight: 1.0,
  },

  // ANALYZE — comparisons, scoring, evaluation
  {
    type: ACTION_TYPES.ANALYZE,
    patterns: [
      /\b(compare|score|evaluate|assess|audit|review|inspect|validate|check|rank|grade|rate|measure|benchmark|diagnose)\b/i,
      /\b(what'?s\s+wrong\s+with|pros?\s+and\s+cons?|strengths?\s+and\s+weakness|difference\s+between|better\s+than)\b/i,
    ],
    weight: 1.0,
  },

  // CREATE — generation, drafting, writing
  {
    type: ACTION_TYPES.CREATE,
    patterns: [
      /\b(write|draft|create|make|build|compose|generate|produce|design|develop|craft|author)\b/i,
      /\b(help\s+me\s+(write|create|make|build|draft)|put\s+together|come\s+up\s+with)\b/i,
    ],
    weight: 1.0,
  },

  // SIMULATE — scenarios, what-ifs, modeling
  {
    type: ACTION_TYPES.SIMULATE,
    patterns: [
      /\b(what\s+happens?\s+if|simulate|forecast|predict|model|scenario|project|run\s+a?\s*test|monte[\s-]carlo|what\s+would)\b/i,
      /\b(test\s+this\s+policy|run\s+a\s+scenario|reality\s+explorer|dual[\s-]path)\b/i,
    ],
    weight: 1.0,
  },

  // TRADE — marketplace operations
  {
    type: ACTION_TYPES.TRADE,
    patterns: [
      /\b(sell|buy|purchase|list\s+on|trade|list\s+for\s+sale|put\s+on\s+marketplace|price|bid|offer)\b/i,
      /\b(marketplace|market|shop|store|listing)\b/i,
    ],
    weight: 0.8,
  },

  // CONNECT — relationships, cross-domain links
  {
    type: ACTION_TYPES.CONNECT,
    patterns: [
      /\b(how\s+does?\s+.{1,30}\s+relate|find\s+connections?|link\s+between|connection\s+between|cross[\s-]reference|bridge|map\s+to)\b/i,
      /\b(relate|connect|link|associate|correlate|overlap\s+between)\b/i,
    ],
    weight: 0.9,
  },

  // TEACH — explanation, pedagogy
  {
    type: ACTION_TYPES.TEACH,
    patterns: [
      /\b(explain|teach\s+me|help\s+me\s+understand|break\s+it\s+down|walk\s+me\s+through|tutorial|guide\s+me|clarify|simplify)\b/i,
      /\b(how\s+do\s+i|how\s+does|how\s+to|what\s+does\s+.{1,20}\s+mean|eli5|in\s+simple\s+terms)\b/i,
    ],
    weight: 0.9,
  },

  // MANAGE — account, profile, system ops
  {
    type: ACTION_TYPES.MANAGE,
    patterns: [
      /\b(show\s+my\s+stats?|check\s+my|update\s+my|my\s+profile|my\s+earnings?|my\s+account|my\s+settings?|configure|dashboard)\b/i,
      /\b(manage|administer|monitor|status\s+of|progress\s+on)\b/i,
    ],
    weight: 0.8,
  },
];

// ── Domain Signal Extraction ─────────────────────────────────────────────
// Extracts domain signals from natural language to find relevant lenses.

const DOMAIN_SIGNAL_PATTERNS = [
  { patterns: [/\b(farm|crop|harvest|livestock|soil|irrigat|agri|seed|pest|fertiliz)/i], tags: ["farming", "crops", "harvest", "soil", "irrigation"] },
  { patterns: [/\b(insurance|policy|claim|premium|coverage|underwr|actuari|deductible)/i], tags: ["policy", "claim", "premium", "coverage", "risk", "underwriting"] },
  { patterns: [/\b(legal|law|contract|compliance|licens|rights?|regulat|litigat|statute)/i], tags: ["legal", "contract", "compliance", "rights", "regulation"] },
  { patterns: [/\b(financ|money|invest|portfolio|budget|revenue|cost|profit|roi|loan|mortgage|tax)/i], tags: ["money", "investment", "budget", "revenue", "cost"] },
  { patterns: [/\b(code|program|api|function|class|module|debug|refactor|deploy|software)/i], tags: ["programming", "api", "debug", "refactor"] },
  { patterns: [/\b(music|song|beat|melody|rhythm|chord|bpm|mix|master|audio|sound)/i], tags: ["audio", "melody", "rhythm", "harmony", "composition"] },
  { patterns: [/\b(medic|health|clinic|patient|diagnos|treat|symptom|prescri)/i], tags: ["medical", "clinical", "patient", "diagnosis", "treatment"] },
  { patterns: [/\b(educ|school|student|course|teach|curriculum|learn|lesson|grade)/i], tags: ["school", "student", "course", "teaching", "learning"] },
  { patterns: [/\b(real\s*estate|property|listing|tenant|mortgage|rental|landlord|lease)/i], tags: ["property", "listing", "tenant", "mortgage", "rental"] },
  { patterns: [/\b(cook|recipe|restaurant|kitchen|food|meal|ingredi|nutrit|diet)/i], tags: ["recipe", "kitchen", "nutrition", "cooking"] },
  { patterns: [/\b(workout|exercise|gym|fitness|train|weight|cardio|stretch)/i], tags: ["training", "workout", "gym", "wellness", "exercise"] },
  { patterns: [/\b(trade|construc|plumb|electric|contractor|hvac|weld|carpent)/i], tags: ["construction", "plumbing", "electrical", "contractor"] },
  { patterns: [/\b(govern|civic|public\s+service|permit|municipal|federal|state\s+law)/i], tags: ["permit", "public", "civic", "policy"] },
  { patterns: [/\b(ship|fleet|warehouse|route|logistics|supply\s*chain|freight)/i], tags: ["shipping", "fleet", "warehouse", "route", "supply-chain"] },
  { patterns: [/\b(manufactur|factory|assembly|quality|production\s+line|bom)/i], tags: ["factory", "assembly", "quality", "production"] },
  { patterns: [/\b(account|bookkeep|invoic|payroll|ledger|debit|credit|reconcil)/i], tags: ["bookkeeping", "invoicing", "tax", "payroll"] },
  { patterns: [/\b(art|paint|draw|illustrat|sketch|canvas|gallery|sculpture)/i], tags: ["artwork", "visual", "illustration", "painting", "drawing"] },
  { patterns: [/\b(graph|node|edge|network|ontology|taxonomy|knowledge\s*graph)/i], tags: ["network", "nodes", "edges", "knowledge", "ontology"] },
  { patterns: [/\b(simulat|sandbox|model|scenario|monte|forecast|predict)/i], tags: ["simulation", "scenario", "monte-carlo"] },
  { patterns: [/\b(research|paper|thesis|hypothesis|evidence|citation|academic)/i], tags: ["research", "academic", "thesis", "citation"] },
  { patterns: [/\b(security|patrol|incident|surveil|investigat|threat)/i], tags: ["patrol", "incident", "surveillance", "investigation", "threat"] },
  { patterns: [/\b(environ|ecology|wildlife|conserv|sustain|climate|green)/i], tags: ["ecology", "wildlife", "conservation", "sustainability", "climate"] },
  { patterns: [/\b(nonprofit|donor|grant|volunteer|charity|impact|ngo)/i], tags: ["donor", "grant", "volunteer", "charity", "impact"] },
  { patterns: [/\b(event|venue|festival|concert|ticket|conference|meetup)/i], tags: ["venue", "festival", "concert", "tickets"] },
  { patterns: [/\b(logic|argument|proof|inference|deduct|reason|fallacy|premise)/i], tags: ["logic", "argument", "proof", "inference", "deduction"] },
  { patterns: [/\b(market|sell|buy|store|shop|listing|merch|ecommerce)/i], tags: ["trade", "listing", "sell", "buy"] },
  { patterns: [/\b(vote|poll|election|ballot|referendum|consensus|proposal)/i], tags: ["poll", "election", "ballot", "consensus"] },
  { patterns: [/\b(quantum|qubit|superposition|entangle)/i], tags: ["qubit", "quantum-computing", "superposition", "entanglement"] },
  { patterns: [/\b(neuro|brain|synap|cognit|neural)/i], tags: ["brain", "neuroscience", "neural", "cognition"] },
  { patterns: [/\b(bio|genetic|dna|cell|organism|protein)/i], tags: ["biology", "genetics", "dna", "cell"] },
  { patterns: [/\b(chem|molecule|element|reaction|compound|catalys)/i], tags: ["chemistry", "molecules", "elements", "reactions"] },
  { patterns: [/\b(physics|mechanic|quantum|relativi|thermodynamic|force)/i], tags: ["simulation", "mechanics", "quantum", "energy"] },
  { patterns: [/\b(math|algebra|geometry|calculus|statistic|probabil)/i], tags: ["calculation", "algebra", "geometry", "statistics"] },
];

// ── Explicit Routing (slash commands) ────────────────────────────────────

const EXPLICIT_ROUTE_PATTERN = /^\/([\w-]+)\s+(.+)/;

// ── Core Router ──────────────────────────────────────────────────────────

/**
 * Route a user message to lens actions.
 *
 * Returns a route plan describing:
 *   - actionType: one of 8 action types
 *   - lenses: ordered list of relevant lenses
 *   - isMultiLens: whether this requires chaining
 *   - requiresConfirmation: whether write actions need user approval
 *   - explicitLens: if user used /lens syntax
 *   - domainSignals: extracted domain tags
 *   - confidence: routing confidence (0-1)
 *
 * @param {string} message - The user message
 * @param {Object} opts
 * @param {Object} opts.sessionContext - Accumulated session context
 * @param {string} opts.userId - For substrate personalization
 * @param {string} opts.currentLens - Currently active lens (if any)
 * @param {Object} opts.STATE - Server state (for substrate retrieval)
 * @returns {RoutePlan}
 */
export function routeMessage(message, opts = {}) {
  const msg = String(message || "").trim();
  if (!msg) return _emptyRoute();

  // ── Step 0: Explicit routing via /lens syntax ──
  const explicit = parseExplicitRoute(msg);
  if (explicit) {
    return buildExplicitRoute(explicit, opts);
  }

  // ── Step 1: Classify action type ──
  const actionResult = classifyActionType(msg);

  // ── Step 2: Extract domain signals ──
  const domainSignals = extractDomainSignals(msg);

  // ── Step 3: Incorporate session context ──
  const sessionSignals = getSessionSignals(opts.sessionContext);
  const allSignals = mergeSignals(domainSignals, sessionSignals);

  // ── Step 4: Find relevant lenses ──
  const lensMatches = findRelevantLenses(allSignals, actionResult.type);

  // ── Step 5: Substrate personalization ──
  const personalized = applySubstratePersonalization(
    lensMatches, opts.userId, opts.STATE
  );

  // ── Step 6: Build route plan ──
  const isMultiLens = personalized.length > 1;
  const requiresConfirmation = WRITE_ACTION_TYPES.has(actionResult.type);

  return {
    ok: true,
    actionType: actionResult.type,
    actionScores: actionResult.scores,
    lenses: personalized.slice(0, 8),
    primaryLens: personalized[0] || null,
    isMultiLens,
    requiresConfirmation,
    explicitLens: null,
    domainSignals: allSignals,
    confidence: computeConfidence(actionResult, personalized, allSignals),
    sessionContextUsed: sessionSignals.length > 0,
    message: isMultiLens
      ? `Drawing from: ${personalized.slice(0, 5).map(l => l.lensId).join(", ")}`
      : personalized.length > 0
        ? `Routing to: ${personalized[0].lensId}`
        : null,
  };
}

// ── Action Type Classification ───────────────────────────────────────────

/**
 * Classify the primary action type of a message.
 * Returns the top type and full scores.
 */
export function classifyActionType(message) {
  const scores = {};
  for (const at of Object.values(ACTION_TYPES)) {
    scores[at] = 0;
  }

  for (const { type, patterns, weight } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        scores[type] = Math.max(scores[type], weight);
      }
    }
  }

  // Find top
  let topType = ACTION_TYPES.QUERY;
  let topScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topType = type;
    }
  }

  // Default to QUERY if nothing matched
  if (topScore === 0) topType = ACTION_TYPES.QUERY;

  return { type: topType, topScore, scores };
}

// ── Domain Signal Extraction ─────────────────────────────────────────────

/**
 * Extract domain tags from natural language.
 */
export function extractDomainSignals(message) {
  const signals = [];

  for (const { patterns, tags } of DOMAIN_SIGNAL_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        signals.push(...tags);
        break; // One match per group is enough
      }
    }
  }

  return [...new Set(signals)];
}

// ── Explicit Route Parsing ───────────────────────────────────────────────

function parseExplicitRoute(message) {
  const match = message.match(EXPLICIT_ROUTE_PATTERN);
  if (!match) return null;

  return {
    lens: match[1].toLowerCase(),
    remainder: match[2].trim(),
  };
}

function buildExplicitRoute(explicit, opts) {
  const manifest = getManifest(explicit.lens);
  const actionResult = classifyActionType(explicit.remainder);

  return {
    ok: true,
    actionType: actionResult.type,
    actionScores: actionResult.scores,
    lenses: manifest ? [{ lensId: explicit.lens, manifest, matchCount: 1, matchRatio: 1, score: 1.0 }] : [],
    primaryLens: manifest ? { lensId: explicit.lens, manifest, matchCount: 1, matchRatio: 1, score: 1.0 } : null,
    isMultiLens: false,
    requiresConfirmation: WRITE_ACTION_TYPES.has(actionResult.type),
    explicitLens: explicit.lens,
    domainSignals: manifest?.domainTags || [],
    confidence: manifest ? 1.0 : 0.0,
    sessionContextUsed: false,
    message: manifest
      ? `Routing to: ${explicit.lens}`
      : `Unknown lens: ${explicit.lens}`,
  };
}

// ── Lens Resolution ──────────────────────────────────────────────────────

function findRelevantLenses(signals, actionType) {
  if (signals.length === 0) return [];

  // Get tag-matched lenses
  const tagMatches = findByTags(signals);

  // Also get action-type-capable lenses
  const actionMatches = findByActionType(actionType);
  const actionIds = new Set(actionMatches.map(m => m.lensId));

  // Score: tag match + action type support bonus
  const scored = tagMatches.map(m => {
    const actionBonus = actionIds.has(m.lensId) ? 0.2 : 0;
    return {
      ...m,
      score: m.matchRatio + actionBonus,
    };
  });

  // Sort by combined score
  scored.sort((a, b) => b.score - a.score);

  // Filter: only lenses with meaningful match
  return scored.filter(m => m.matchRatio >= 0.1);
}

// ── Substrate Personalization ────────────────────────────────────────────

function applySubstratePersonalization(lensMatches, userId, STATE) {
  if (!userId || !STATE || lensMatches.length === 0) return lensMatches;

  // Check user's DTU history — lenses they've used before get a boost
  try {
    const userDtus = [];
    if (STATE.dtus) {
      for (const dtu of STATE.dtus.values()) {
        if (dtu.createdBy === userId || dtu.source === userId) {
          userDtus.push(dtu);
          if (userDtus.length >= 200) break;
        }
      }
    }

    if (userDtus.length === 0) return lensMatches;

    // Count lens-relevant tags in user's DTUs
    const userTagFreq = new Map();
    for (const dtu of userDtus) {
      for (const tag of (dtu.tags || [])) {
        userTagFreq.set(tag, (userTagFreq.get(tag) || 0) + 1);
      }
    }

    // Boost lenses whose tags overlap with user's history
    return lensMatches.map(m => {
      if (!m.manifest?.domainTags) return m;
      let boost = 0;
      for (const tag of m.manifest.domainTags) {
        if (userTagFreq.has(tag)) {
          boost += Math.min(userTagFreq.get(tag) / 50, 0.15);
        }
      }
      return { ...m, score: m.score + Math.min(boost, 0.3) };
    }).sort((a, b) => b.score - a.score);
  } catch {
    return lensMatches;
  }
}

// ── Session Context Integration ──────────────────────────────────────────

function getSessionSignals(sessionContext) {
  if (!sessionContext) return [];

  const signals = [];

  // From accumulated domain signals
  if (sessionContext.domainSignals) {
    signals.push(...sessionContext.domainSignals);
  }

  // From recently active lenses
  if (sessionContext.activeLenses) {
    for (const lensId of sessionContext.activeLenses) {
      const manifest = getManifest(lensId);
      if (manifest?.domainTags) {
        signals.push(...manifest.domainTags.slice(0, 3));
      }
    }
  }

  return [...new Set(signals)];
}

function mergeSignals(primary, session) {
  // Primary signals get full weight, session signals provide background
  const merged = [...primary];
  for (const s of session) {
    if (!merged.includes(s)) merged.push(s);
  }
  return merged.slice(0, 30);
}

// ── Confidence Scoring ───────────────────────────────────────────────────

function computeConfidence(actionResult, lensMatches, signals) {
  let confidence = 0;

  // Action type classified clearly
  if (actionResult.topScore >= 1.0) confidence += 0.35;
  else if (actionResult.topScore >= 0.5) confidence += 0.2;

  // At least one lens matched
  if (lensMatches.length > 0) confidence += 0.3;

  // Domain signals extracted
  if (signals.length >= 3) confidence += 0.2;
  else if (signals.length >= 1) confidence += 0.1;

  // Strong primary lens match
  if (lensMatches[0]?.matchRatio >= 0.4) confidence += 0.15;

  return Math.min(1.0, confidence);
}

// ── Multi-Lens Chain Builder ─────────────────────────────────────────────

/**
 * Build a multi-lens execution chain from a route plan.
 *
 * For each lens in the chain, determines:
 *   - What context to pull (DTU retrieval scope)
 *   - What action to invoke
 *   - How results feed the next lens
 *
 * The chain is transparent: the user sees which lenses contributed.
 *
 * @param {RoutePlan} route - From routeMessage()
 * @param {Object} STATE - Server state
 * @returns {LensChain}
 */
export function buildLensChain(route, STATE) {
  if (!route.ok || !route.lenses || route.lenses.length === 0) {
    return { ok: false, steps: [], message: "No lenses matched" };
  }

  const steps = route.lenses.slice(0, 5).map((lens, index) => {
    const manifest = lens.manifest || getManifest(lens.lensId);
    const actionType = route.actionType;

    // Map action type to a concrete lens action
    const concreteAction = pickConcreteAction(manifest, actionType);

    return {
      order: index,
      lensId: lens.lensId,
      action: concreteAction,
      actionType,
      role: index === 0 ? "primary" : "contributor",
      matchScore: lens.score,
      domainTags: manifest?.domainTags || [],
    };
  });

  return {
    ok: true,
    steps,
    primaryLens: steps[0]?.lensId || null,
    contributingLenses: steps.slice(1).map(s => s.lensId),
    actionType: route.actionType,
    attribution: steps.map(s => s.lensId),
    message: steps.length > 1
      ? `Drawing from: ${steps.map(s => capitalize(s.lensId)).join(", ")}`
      : `Using: ${capitalize(steps[0]?.lensId || "unknown")}`,
  };
}

/**
 * Pick the best concrete action for a lens given an action type.
 */
function pickConcreteAction(manifest, actionType) {
  if (!manifest?.actions) return "analyze";

  // Direct type-to-action mapping
  const typeToPreferred = {
    QUERY: ["query", "search", "find", "get", "list", "browse"],
    ANALYZE: ["analyze", "compare", "score", "evaluate", "audit", "review"],
    CREATE: ["generate", "create", "draft", "write", "compose", "build"],
    SIMULATE: ["simulate", "forecast", "predict", "model", "test"],
    TRADE: ["list", "sell", "buy", "purchase", "trade"],
    CONNECT: ["connect", "link", "map", "relate", "bridge"],
    TEACH: ["explain", "teach", "suggest", "tutor"],
    MANAGE: ["manage", "configure", "update", "export", "status"],
  };

  const preferred = typeToPreferred[actionType] || ["analyze"];

  for (const action of preferred) {
    if (manifest.actions.includes(action)) return action;
  }

  // Fallback: use first available action
  return manifest.actions[0] || "analyze";
}

// ── Growth Hook: Resonance Signal ────────────────────────────────────────

/**
 * When a chat interaction crosses 2+ lenses, emit a resonance signal
 * for the meta-derivation engine to investigate.
 *
 * @param {RoutePlan} route - The route plan
 * @param {Object} STATE - Server state
 * @returns {{ signaled: boolean, domains: string[] }}
 */
export function emitResonanceSignal(route, STATE) {
  if (!route.ok || !route.isMultiLens || route.lenses.length < 2) {
    return { signaled: false };
  }

  const domains = route.lenses.slice(0, 5).map(l => l.lensId);

  // Create a resonance signal DTU (shadow-tier)
  try {
    if (STATE?.dtus) {
      const signalId = `resonance_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const signalDtu = {
        id: signalId,
        title: `Cross-domain signal: ${domains.join(" × ")}`,
        tier: "shadow",
        tags: [
          "resonance-signal", "cross-domain", "auto-detected",
          ...domains.map(d => `domain:${d}`),
        ],
        meta: {
          hidden: true,
          resonanceSignal: true,
          actionType: route.actionType,
          lensChain: domains,
          confidence: route.confidence,
          detectedAt: new Date().toISOString(),
        },
        scope: "local",
        source: "chat-router",
        createdAt: new Date().toISOString(),
      };

      STATE.dtus.set(signalId, signalDtu);
    }
  } catch {
    // Resonance signals are supplementary — never block the chat path
  }

  return { signaled: true, domains };
}

// ── DTU Forging from Chat ────────────────────────────────────────────────

/**
 * Determine whether a chat response should be offered for DTU forging.
 * Casual exchange → shadow DTU (auto). Forge-worthy → offer promotion.
 *
 * @param {RoutePlan} route - Route plan
 * @param {Object} response - Chat response object
 * @returns {{ shouldOfferForge: boolean, reason: string }}
 */
export function shouldOfferForge(route, response) {
  if (!route.ok) return { shouldOfferForge: false, reason: "no_route" };

  // Write actions that produced output are forge candidates
  if (WRITE_ACTION_TYPES.has(route.actionType)) {
    return { shouldOfferForge: true, reason: "write_action_output" };
  }

  // Multi-lens synthesis is forge-worthy
  if (route.isMultiLens && route.lenses.length >= 3) {
    return { shouldOfferForge: true, reason: "multi_lens_synthesis" };
  }

  // High-confidence analysis
  if (route.actionType === ACTION_TYPES.ANALYZE && route.confidence >= 0.7) {
    return { shouldOfferForge: true, reason: "high_confidence_analysis" };
  }

  return { shouldOfferForge: false, reason: "casual_exchange" };
}

// ── Emergent Routing ─────────────────────────────────────────────────────

/**
 * Route a message to a specific emergent if requested.
 * "Ask the legal emergent to review this"
 *
 * @param {string} message - User message
 * @param {Object} STATE - Server state
 * @returns {{ routed: boolean, emergentId?, domain? }}
 */
export function detectEmergentRoute(message, STATE) {
  const match = message.match(
    /\b(?:ask|tell|have|get)\s+(?:the\s+)?(\w+)\s+(?:emergent|entity|agent)\b/i
  );
  if (!match) return { routed: false };

  const domain = match[1].toLowerCase();

  // Find matching emergent
  try {
    const es = STATE?.__emergent;
    if (es?.entities) {
      for (const [id, entity] of es.entities) {
        const entityDomain = entity.domain || entity.species || "";
        if (entityDomain.toLowerCase().includes(domain)) {
          return {
            routed: true,
            emergentId: id,
            domain: entityDomain,
            entityName: entity.name || id,
          };
        }
      }
    }
  } catch {
    // Silent
  }

  return { routed: false, domain };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function _emptyRoute() {
  return {
    ok: false,
    actionType: ACTION_TYPES.QUERY,
    actionScores: {},
    lenses: [],
    primaryLens: null,
    isMultiLens: false,
    requiresConfirmation: false,
    explicitLens: null,
    domainSignals: [],
    confidence: 0,
    sessionContextUsed: false,
    message: null,
  };
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

// ── Metrics ──────────────────────────────────────────────────────────────

const _metrics = {
  routeCount: 0,
  multiLensCount: 0,
  explicitRouteCount: 0,
  confirmationRequired: 0,
  resonanceSignals: 0,
  forgeOffers: 0,
  emergentRoutes: 0,
  actionTypeDistribution: {},
};

export function recordRouteMetric(route) {
  _metrics.routeCount++;
  if (route.isMultiLens) _metrics.multiLensCount++;
  if (route.explicitLens) _metrics.explicitRouteCount++;
  if (route.requiresConfirmation) _metrics.confirmationRequired++;

  const at = route.actionType || "QUERY";
  _metrics.actionTypeDistribution[at] = (_metrics.actionTypeDistribution[at] || 0) + 1;
}

export function getRouterMetrics() {
  return {
    ok: true,
    version: "1.0.0",
    ...getManifestStats(),
    routing: { ..._metrics },
  };
}
