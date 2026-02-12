/**
 * Chat Lens Recommender — recommends the right lens when a user's intent
 * shifts from talk → action, without feeling like marketing or clutter.
 *
 * Read-only: no Atlas writes, no DTU mutations.
 *
 * Usage:
 *   import { recommendLenses } from '@/lib/lenses/chat-lens-recommender';
 *   const { recs, debug } = recommendLenses(message, sessionCtx);
 */

import { LENS_MANIFESTS, getLensManifest } from './manifest';
import { getLensStatus, type LensStatusEntry } from './lens-status';
import { getLensById } from '../lens-registry';

// ── Intent Classes ────────────────────────────────────────────────

export type IntentClass =
  | 'CHAT_ONLY'
  | 'IDEATE'
  | 'STRUCTURE'
  | 'PLAN'
  | 'SIMULATE'
  | 'BUILD'
  | 'PUBLISH'
  | 'AUDIT';

// ── Lens Recommender Registry Entry ───────────────────────────────

export interface LensRecommenderEntry {
  lensId: string;
  name: string;
  categories: string[];
  domainTags: string[];
  intentTags: IntentClass[];
  entryCost: 'low' | 'med' | 'high';
  supportsActions: string[];
  requiresLane: 'none' | 'local' | 'global' | 'market';
  recommendedWhen: string[];
  suppressWhen: string[];
}

// ── Lens Recommender Registry ─────────────────────────────────────
// Single source for recommendation scoring. Extends existing manifests
// with recommendation-specific metadata.

export const LENS_RECOMMENDER_REGISTRY: LensRecommenderEntry[] = [
  {
    lensId: 'paper',
    name: 'Paper',
    categories: ['knowledge', 'research'],
    domainTags: ['research', 'academic', 'writing', 'hypothesis', 'evidence', 'citation', 'thesis', 'experiment'],
    intentTags: ['STRUCTURE', 'PLAN', 'AUDIT'],
    entryCost: 'med',
    supportsActions: ['draft', 'audit', 'plan'],
    requiresLane: 'local',
    recommendedWhen: ['research intent detected', 'academic writing mentioned'],
    suppressWhen: ['quick question about research'],
  },
  {
    lensId: 'reasoning',
    name: 'Reasoning',
    categories: ['knowledge', 'logic'],
    domainTags: ['logic', 'argument', 'proof', 'contradiction', 'premise', 'inference', 'debate'],
    intentTags: ['STRUCTURE', 'AUDIT'],
    entryCost: 'med',
    supportsActions: ['audit', 'plan'],
    requiresLane: 'local',
    recommendedWhen: ['logical argument construction', 'contradiction detection needed'],
    suppressWhen: [],
  },
  {
    lensId: 'council',
    name: 'Council',
    categories: ['governance'],
    domainTags: ['governance', 'vote', 'proposal', 'budget', 'policy', 'decision', 'consensus'],
    intentTags: ['PLAN', 'AUDIT', 'PUBLISH'],
    entryCost: 'high',
    supportsActions: ['plan', 'audit', 'publish'],
    requiresLane: 'global',
    recommendedWhen: ['governance decision needed', 'budget planning mentioned'],
    suppressWhen: ['casual governance discussion'],
  },
  {
    lensId: 'agents',
    name: 'Agents',
    categories: ['ai', 'automation'],
    domainTags: ['agent', 'automation', 'workflow', 'bot', 'task', 'pipeline', 'orchestration'],
    intentTags: ['BUILD', 'PLAN'],
    entryCost: 'high',
    supportsActions: ['plan', 'simulate'],
    requiresLane: 'local',
    recommendedWhen: ['automation workflow described', 'agent creation requested'],
    suppressWhen: [],
  },
  {
    lensId: 'sim',
    name: 'Simulation',
    categories: ['science', 'forecasting'],
    domainTags: ['simulation', 'forecast', 'scenario', 'model', 'predict', 'numbers', 'projection', 'what-if', 'monte-carlo'],
    intentTags: ['SIMULATE', 'PLAN'],
    entryCost: 'med',
    supportsActions: ['simulate', 'plan'],
    requiresLane: 'local',
    recommendedWhen: ['numerical simulation requested', 'scenario analysis mentioned'],
    suppressWhen: [],
  },
  {
    lensId: 'code',
    name: 'Code',
    categories: ['core', 'development'],
    domainTags: ['code', 'programming', 'api', 'architecture', 'implementation', 'debug', 'refactor', 'deploy'],
    intentTags: ['BUILD'],
    entryCost: 'low',
    supportsActions: ['plan', 'draft'],
    requiresLane: 'local',
    recommendedWhen: ['code implementation requested', 'architecture discussion'],
    suppressWhen: ['quick code question'],
  },
  {
    lensId: 'law',
    name: 'Law',
    categories: ['legal', 'compliance'],
    domainTags: ['legal', 'law', 'contract', 'compliance', 'license', 'rights', 'regulation', 'liability', 'patent', 'ip'],
    intentTags: ['AUDIT', 'STRUCTURE'],
    entryCost: 'med',
    supportsActions: ['audit', 'draft', 'legal-check'],
    requiresLane: 'local',
    recommendedWhen: ['legal review needed', 'compliance check requested'],
    suppressWhen: [],
  },
  {
    lensId: 'graph',
    name: 'Graph',
    categories: ['knowledge'],
    domainTags: ['knowledge', 'entity', 'relation', 'ontology', 'taxonomy', 'connection', 'mapping'],
    intentTags: ['STRUCTURE', 'AUDIT'],
    entryCost: 'med',
    supportsActions: ['plan', 'audit'],
    requiresLane: 'local',
    recommendedWhen: ['knowledge mapping requested', 'relationship analysis needed'],
    suppressWhen: [],
  },
  {
    lensId: 'whiteboard',
    name: 'Whiteboard',
    categories: ['collaboration', 'visual'],
    domainTags: ['diagram', 'sketch', 'brainstorm', 'visual', 'collaborate', 'board', 'freeform', 'mind-map'],
    intentTags: ['IDEATE', 'STRUCTURE'],
    entryCost: 'low',
    supportsActions: ['draft', 'plan'],
    requiresLane: 'none',
    recommendedWhen: ['visual brainstorming requested', 'diagram creation needed'],
    suppressWhen: [],
  },
  {
    lensId: 'database',
    name: 'Database',
    categories: ['system', 'data'],
    domainTags: ['database', 'query', 'sql', 'schema', 'table', 'data', 'record'],
    intentTags: ['BUILD', 'STRUCTURE'],
    entryCost: 'med',
    supportsActions: ['plan', 'audit'],
    requiresLane: 'local',
    recommendedWhen: ['data structuring needed', 'schema design requested'],
    suppressWhen: [],
  },
  {
    lensId: 'finance',
    name: 'Finance',
    categories: ['finance'],
    domainTags: ['finance', 'budget', 'investment', 'portfolio', 'revenue', 'cost', 'profit', 'expense', 'roi'],
    intentTags: ['SIMULATE', 'PLAN', 'AUDIT'],
    entryCost: 'med',
    supportsActions: ['simulate', 'plan', 'audit'],
    requiresLane: 'local',
    recommendedWhen: ['financial analysis requested', 'budget planning mentioned'],
    suppressWhen: [],
  },
  {
    lensId: 'marketplace',
    name: 'Marketplace',
    categories: ['governance', 'commerce'],
    domainTags: ['marketplace', 'listing', 'sell', 'buy', 'publish', 'distribute', 'license'],
    intentTags: ['PUBLISH'],
    entryCost: 'high',
    supportsActions: ['publish'],
    requiresLane: 'market',
    recommendedWhen: ['user wants to publish or list something'],
    suppressWhen: [],
  },
];

// ── Recommender Registry Lookup ───────────────────────────────────

const _recMap = new Map(LENS_RECOMMENDER_REGISTRY.map(e => [e.lensId, e]));

export function getRecommenderEntry(lensId: string): LensRecommenderEntry | undefined {
  return _recMap.get(lensId);
}

// ── Signal Extraction ─────────────────────────────────────────────

export interface Signals {
  domainSignals: string[];
  intentSignals: IntentClass[];
  frictionSignals: string[];
  confidence: number;
}

const FRICTION_PATTERNS: { pattern: RegExp; weight: number }[] = [
  { pattern: /\b(i need|how do i|how can i|help me)\b/i, weight: 1.0 },
  { pattern: /\b(build|create|make|implement|develop|code)\b/i, weight: 0.9 },
  { pattern: /\b(plan|steps|milestones|roadmap|schedule)\b/i, weight: 0.8 },
  { pattern: /\b(simulate|forecast|predict|model|scenario|what.?if)\b/i, weight: 0.9 },
  { pattern: /\b(legal|license|compliance|rights|contract|patent)\b/i, weight: 0.8 },
  { pattern: /\b(budget|cost|revenue|profit|roi|financial)\b/i, weight: 0.7 },
  { pattern: /\b(publish|submit|release|distribute|list|deploy)\b/i, weight: 0.8 },
  { pattern: /\b(prove|verify|audit|check|validate|contradict)\b/i, weight: 0.7 },
  { pattern: /\b(organize|outline|structure|define|categorize)\b/i, weight: 0.6 },
  { pattern: /\b(turn.?into|convert|transform|make.?this)\b/i, weight: 0.9 },
];

const INTENT_PATTERNS: { pattern: RegExp; intent: IntentClass }[] = [
  // BUILD
  { pattern: /\b(build|code|implement|develop|architect|refactor|deploy|program|debug)\b/i, intent: 'BUILD' },
  // PLAN
  { pattern: /\b(plan|steps|milestones|roadmap|schedule|timeline|execute|strategy)\b/i, intent: 'PLAN' },
  // SIMULATE
  { pattern: /\b(simulate|forecast|predict|model|scenario|what.?if|numbers|project|monte.?carlo)\b/i, intent: 'SIMULATE' },
  // PUBLISH
  { pattern: /\b(publish|submit|release|distribute|list|deploy|launch|ship)\b/i, intent: 'PUBLISH' },
  // AUDIT
  { pattern: /\b(audit|verify|prove|check|validate|compliance|contradict|review|inspect)\b/i, intent: 'AUDIT' },
  // STRUCTURE
  { pattern: /\b(organize|outline|structure|define|categorize|classify|schema|taxonomy)\b/i, intent: 'STRUCTURE' },
  // IDEATE
  { pattern: /\b(brainstorm|ideate|explore|what about|possibilities|options|alternatives|imagine)\b/i, intent: 'IDEATE' },
];

const DOMAIN_KEYWORDS: { pattern: RegExp; tags: string[] }[] = [
  { pattern: /\b(research|paper|thesis|hypothesis|evidence|citation|academic)\b/i, tags: ['research', 'academic'] },
  { pattern: /\b(code|programming|api|function|class|module|repository|git)\b/i, tags: ['code', 'programming'] },
  { pattern: /\b(legal|law|contract|compliance|license|rights|patent|ip)\b/i, tags: ['legal', 'law', 'compliance'] },
  { pattern: /\b(finance|budget|cost|revenue|profit|investment|portfolio)\b/i, tags: ['finance', 'budget'] },
  { pattern: /\b(simulation|forecast|scenario|model|predict)\b/i, tags: ['simulation', 'forecast'] },
  { pattern: /\b(governance|vote|proposal|policy|decision|council)\b/i, tags: ['governance', 'vote'] },
  { pattern: /\b(diagram|sketch|whiteboard|visual|brainstorm|mind.?map)\b/i, tags: ['diagram', 'visual', 'brainstorm'] },
  { pattern: /\b(agent|automation|workflow|bot|orchestrate)\b/i, tags: ['agent', 'automation'] },
  { pattern: /\b(database|query|sql|schema|table|record)\b/i, tags: ['database', 'query'] },
  { pattern: /\b(knowledge|entity|relation|ontology|graph)\b/i, tags: ['knowledge', 'entity'] },
  { pattern: /\b(publish|marketplace|listing|sell|distribute)\b/i, tags: ['marketplace', 'publish'] },
  { pattern: /\b(logic|argument|proof|contradiction|premise|inference)\b/i, tags: ['logic', 'argument'] },
];

export function extractSignals(message: string): Signals {
  const domainSignals: string[] = [];
  const frictionSignals: string[] = [];
  let frictionScore = 0;

  // Domain signals
  for (const { pattern, tags } of DOMAIN_KEYWORDS) {
    if (pattern.test(message)) {
      domainSignals.push(...tags);
    }
  }

  // Friction signals
  for (const { pattern, weight } of FRICTION_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      frictionSignals.push(match[0].toLowerCase());
      frictionScore += weight;
    }
  }

  // Intent classification — pick top 1-2
  const intentSignals = classifyIntent(message);

  // Confidence based on friction + intent clarity
  const confidence = Math.min(1, (frictionScore * 0.4) + (intentSignals.length > 0 && intentSignals[0] !== 'CHAT_ONLY' ? 0.4 : 0) + (domainSignals.length > 0 ? 0.2 : 0));

  return {
    domainSignals: [...new Set(domainSignals)],
    intentSignals,
    frictionSignals: [...new Set(frictionSignals)],
    confidence,
  };
}

// ── Intent Classification ─────────────────────────────────────────

export function classifyIntent(message: string): IntentClass[] {
  const scores: Record<IntentClass, number> = {
    CHAT_ONLY: 0,
    IDEATE: 0,
    STRUCTURE: 0,
    PLAN: 0,
    SIMULATE: 0,
    BUILD: 0,
    PUBLISH: 0,
    AUDIT: 0,
  };

  for (const { pattern, intent } of INTENT_PATTERNS) {
    const matches = message.match(new RegExp(pattern, 'gi'));
    if (matches) {
      scores[intent] += matches.length;
    }
  }

  // Sort by score, take top 1-2
  const sorted = (Object.entries(scores) as [IntentClass, number][])
    .filter(([, score]) => score > 0)
    .sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) return ['CHAT_ONLY'];

  const result: IntentClass[] = [sorted[0][0]];
  if (sorted.length > 1 && sorted[1][1] >= sorted[0][1] * 0.5) {
    result.push(sorted[1][0]);
  }

  return result;
}

// ── Session Context ───────────────────────────────────────────────

export interface SessionContext {
  recentMessages: string[];
  lensesUsed: string[];
  recentRecommendations: { lensId: string; turnIndex: number; dismissed: boolean }[];
  currentTurn: number;
  previousIntents: IntentClass[];
}

export function createSessionContext(): SessionContext {
  return {
    recentMessages: [],
    lensesUsed: [],
    recentRecommendations: [],
    currentTurn: 0,
    previousIntents: [],
  };
}

// ── Scoring Model ─────────────────────────────────────────────────

const WEIGHTS = {
  w1: 0.25,  // domainMatch
  w2: 0.25,  // intentMatch
  w3: 0.20,  // actionMatch
  w4: 0.10,  // shadowBoost (user history)
  w5: -0.10, // frictionPenalty
  w6: -0.10, // spamPenalty
};

const SCORE_THRESHOLD = 0.25;

function domainMatch(signals: string[], lensTags: string[]): number {
  if (signals.length === 0 || lensTags.length === 0) return 0;
  const intersection = signals.filter(s => lensTags.includes(s));
  return intersection.length / Math.max(signals.length, 1);
}

function intentMatch(intents: IntentClass[], lensTags: IntentClass[]): number {
  if (intents.length === 0 || lensTags.length === 0) return 0;
  const intersection = intents.filter(i => lensTags.includes(i));
  return intersection.length / intents.length;
}

function actionMatch(requestedActions: string[], lensActions: string[]): number {
  if (requestedActions.length === 0) return 0;
  const intersection = requestedActions.filter(a => lensActions.includes(a));
  return intersection.length / requestedActions.length;
}

function shadowBoost(lensId: string, lensesUsed: string[]): number {
  // Lenses the user has used before get a small boost
  return lensesUsed.includes(lensId) ? 0.5 : 0;
}

function frictionPenalty(entryCost: 'low' | 'med' | 'high'): number {
  switch (entryCost) {
    case 'low': return 0;
    case 'med': return 0.3;
    case 'high': return 0.6;
  }
}

function spamPenalty(lensId: string, recentRecs: SessionContext['recentRecommendations'], currentTurn: number): number {
  const recent = recentRecs.filter(
    r => r.lensId === lensId && currentTurn - r.turnIndex < 5
  );
  return Math.min(1, recent.length * 0.5);
}

function deriveRequestedActions(intents: IntentClass[]): string[] {
  const actions: string[] = [];
  for (const intent of intents) {
    switch (intent) {
      case 'PLAN': actions.push('plan'); break;
      case 'SIMULATE': actions.push('simulate'); break;
      case 'BUILD': actions.push('draft', 'plan'); break;
      case 'PUBLISH': actions.push('publish'); break;
      case 'AUDIT': actions.push('audit', 'legal-check'); break;
      case 'STRUCTURE': actions.push('draft', 'plan'); break;
      case 'IDEATE': actions.push('draft'); break;
    }
  }
  return [...new Set(actions)];
}

export interface ScoredLens {
  lensId: string;
  name: string;
  score: number;
  reason: string;
}

export function scoreLenses(signals: Signals, ctx: SessionContext): ScoredLens[] {
  const requestedActions = deriveRequestedActions(signals.intentSignals);
  const results: ScoredLens[] = [];

  for (const entry of LENS_RECOMMENDER_REGISTRY) {
    const dm = domainMatch(signals.domainSignals, entry.domainTags);
    const im = intentMatch(signals.intentSignals, entry.intentTags);
    const am = actionMatch(requestedActions, entry.supportsActions);
    const sb = shadowBoost(entry.lensId, ctx.lensesUsed);
    const fp = frictionPenalty(entry.entryCost);
    const sp = spamPenalty(entry.lensId, ctx.recentRecommendations, ctx.currentTurn);

    const score =
      WEIGHTS.w1 * dm +
      WEIGHTS.w2 * im +
      WEIGHTS.w3 * am +
      WEIGHTS.w4 * sb +
      WEIGHTS.w5 * fp +
      WEIGHTS.w6 * sp;

    if (score >= SCORE_THRESHOLD) {
      results.push({
        lensId: entry.lensId,
        name: entry.name,
        score,
        reason: generateReason(entry, signals),
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 3);
}

function generateReason(entry: LensRecommenderEntry, signals: Signals): string {
  const matchedDomains = signals.domainSignals.filter(s => entry.domainTags.includes(s));
  const matchedIntents = signals.intentSignals.filter(i => entry.intentTags.includes(i));

  if (matchedIntents.length > 0 && matchedDomains.length > 0) {
    return `${matchedIntents[0].toLowerCase()} with ${matchedDomains[0]}`;
  }
  if (matchedIntents.length > 0) {
    return `supports ${matchedIntents[0].toLowerCase()} workflows`;
  }
  if (matchedDomains.length > 0) {
    return `matches ${matchedDomains[0]} domain`;
  }
  return `relevant to your request`;
}

// ── Recommendation Triggers (anti-spam) ───────────────────────────

export interface TriggerResult {
  shouldRecommend: boolean;
  triggerReason: string | null;
}

export function checkTriggers(signals: Signals, ctx: SessionContext): TriggerResult {
  // Suppression: max 1 recommendation per 3 user messages
  const recentRecTurns = ctx.recentRecommendations.filter(
    r => ctx.currentTurn - r.turnIndex < 3
  );
  if (recentRecTurns.length > 0) {
    return { shouldRecommend: false, triggerReason: null };
  }

  // Suppression: if user dismissed twice, suppress for 10 turns
  const dismissCount = ctx.recentRecommendations.filter(r => r.dismissed).length;
  if (dismissCount >= 2) {
    const lastDismiss = ctx.recentRecommendations
      .filter(r => r.dismissed)
      .sort((a, b) => b.turnIndex - a.turnIndex)[0];
    if (lastDismiss && ctx.currentTurn - lastDismiss.turnIndex < 10) {
      return { shouldRecommend: false, triggerReason: null };
    }
  }

  // Trigger 1: Intent shift
  if (ctx.previousIntents.length > 0) {
    const prevIntent = ctx.previousIntents[ctx.previousIntents.length - 1];
    const currentIntent = signals.intentSignals[0];
    const actionIntents: IntentClass[] = ['PLAN', 'SIMULATE', 'BUILD', 'PUBLISH', 'AUDIT'];

    if (
      (prevIntent === 'IDEATE' || prevIntent === 'CHAT_ONLY') &&
      actionIntents.includes(currentIntent)
    ) {
      return { shouldRecommend: true, triggerReason: 'intent_shift' };
    }
  }

  // Trigger 2: Explicit ask
  if (signals.frictionSignals.length > 0 && signals.confidence >= 0.5) {
    return { shouldRecommend: true, triggerReason: 'explicit_ask' };
  }

  // Trigger 3: High friction detected (complex request)
  if (signals.confidence >= 0.7) {
    return { shouldRecommend: true, triggerReason: 'high_friction' };
  }

  // Trigger 4: Repeated topic — 3+ turns on same domain without progress
  if (ctx.recentMessages.length >= 3) {
    const recentDomains = ctx.recentMessages.slice(-3).map(m => {
      const s = extractSignals(m);
      return s.domainSignals;
    });
    const commonDomains = recentDomains[0]?.filter(
      d => recentDomains[1]?.includes(d) && recentDomains[2]?.includes(d)
    );
    if (commonDomains && commonDomains.length > 0) {
      return { shouldRecommend: true, triggerReason: 'repeated_topic' };
    }
  }

  return { shouldRecommend: false, triggerReason: null };
}

// ── Recommendation Output ─────────────────────────────────────────

export interface LensRecommendation {
  lensId: string;
  name: string;
  reason: string;
  score: number;
  taskSeed?: {
    title: string;
    summary: string;
    suggestedActions: string[];
  };
}

export interface RecommendationResult {
  recs: LensRecommendation[];
  debug?: {
    signals: Signals;
    trigger: TriggerResult;
    scoredLenses: ScoredLens[];
    turnIndex: number;
  };
}

// ── Task Seed Generation ──────────────────────────────────────────

function generateTaskSeed(lensId: string, message: string, signals: Signals): LensRecommendation['taskSeed'] {
  const title = message.length > 60 ? message.slice(0, 57) + '...' : message;
  const actions = deriveRequestedActions(signals.intentSignals);
  return {
    title,
    summary: `Based on chat context: ${signals.domainSignals.slice(0, 3).join(', ')} discussion`,
    suggestedActions: actions.slice(0, 3),
  };
}

// ── Main Entry Point ──────────────────────────────────────────────

export function recommendLenses(
  message: string,
  sessionCtx: SessionContext
): RecommendationResult {
  // 1. Extract signals (read-only)
  const signals = extractSignals(message);

  // 2. Check triggers (anti-spam)
  const trigger = checkTriggers(signals, sessionCtx);

  if (!trigger.shouldRecommend) {
    return { recs: [], debug: { signals, trigger, scoredLenses: [], turnIndex: sessionCtx.currentTurn } };
  }

  // 3. Score lenses
  const scoredLenses = scoreLenses(signals, sessionCtx);

  // 4. Build recommendations — max 1 unless user asks "what lens should I use?"
  const askingForSuggestions = /what\s+lens|which\s+lens|suggest\s+a?\s*lens/i.test(message);
  const maxRecs = askingForSuggestions ? 3 : 1;

  const recs: LensRecommendation[] = scoredLenses.slice(0, maxRecs).map(sl => ({
    lensId: sl.lensId,
    name: sl.name,
    reason: sl.reason,
    score: sl.score,
    taskSeed: generateTaskSeed(sl.lensId, message, signals),
  }));

  return {
    recs,
    debug: {
      signals,
      trigger,
      scoredLenses,
      turnIndex: sessionCtx.currentTurn,
    },
  };
}

// ── Telemetry (local-only, per-session) ───────────────────────────

export interface SessionTelemetry {
  recommendationsShown: number;
  openedLens: { lensId: string; turnIndex: number }[];
  dismissed: { lensId: string; turnIndex: number }[];
  timeToAction: number[];
}

export function createSessionTelemetry(): SessionTelemetry {
  return {
    recommendationsShown: 0,
    openedLens: [],
    dismissed: [],
    timeToAction: [],
  };
}

export function recordRecommendationShown(telemetry: SessionTelemetry): void {
  telemetry.recommendationsShown++;
}

export function recordLensOpened(telemetry: SessionTelemetry, lensId: string, turnIndex: number): void {
  telemetry.openedLens.push({ lensId, turnIndex });
}

export function recordDismissal(telemetry: SessionTelemetry, lensId: string, turnIndex: number): void {
  telemetry.dismissed.push({ lensId, turnIndex });
}

export function recordTimeToAction(telemetry: SessionTelemetry, ms: number): void {
  telemetry.timeToAction.push(ms);
}
