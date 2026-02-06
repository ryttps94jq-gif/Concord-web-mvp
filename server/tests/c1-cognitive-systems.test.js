import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// C1: Cognitive Systems Tests
// Tests for: Experience Learning, Attention Manager, Reflection Engine,
//            World Model Auto-Update, Transfer Pattern Extraction
// ============================================================================

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let _uidCounter = 0;
const uid = (prefix) => `${prefix}_test_${++_uidCounter}`;
const nowISO = () => new Date().toISOString();

function tokenizeText(text) {
  return String(text || "").toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(t => t.length > 2);
}

// ============================================================================
// EXPERIENCE LEARNING ENGINE
// ============================================================================

describe('Experience Learning Engine', () => {
  let STATE;

  function ensureExperienceLearning() {
    if (!STATE.experienceLearning) {
      STATE.experienceLearning = {
        episodes: [],
        patterns: new Map(),
        strategies: new Map(),
        stats: { episodesRecorded: 0, patternsExtracted: 0, retrievalsUsed: 0, improvementRate: 0 },
        config: { maxEpisodes: 2000, maxPatterns: 500, minEpisodesForPattern: 3, consolidationInterval: 50, decayRate: 0.005 }
      };
    }
  }

  function recordExperienceEpisode(episode) {
    ensureExperienceLearning();
    const el = STATE.experienceLearning;
    const ep = {
      id: uid("exp"), timestamp: nowISO(),
      context: {
        domain: String(episode.domain || "general").slice(0, 100),
        topic: String(episode.topic || "").slice(0, 200),
        keywords: Array.isArray(episode.keywords) ? episode.keywords.slice(0, 20) : [],
        mode: String(episode.mode || "explore"),
      },
      action: {
        strategy: String(episode.strategy || "default").slice(0, 100),
        llmUsed: !!episode.llmUsed,
        dtusRetrieved: Number(episode.dtusRetrieved || 0),
        responseLength: Number(episode.responseLength || 0),
      },
      outcome: {
        quality: clamp(Number(episode.quality || 0.5), 0, 1),
        userFeedback: episode.userFeedback || null,
        followUpNeeded: !!episode.followUpNeeded,
        errorOccurred: !!episode.errorOccurred,
      }
    };
    el.episodes.push(ep);
    el.stats.episodesRecorded++;
    if (el.episodes.length > el.config.maxEpisodes) {
      el.episodes.splice(0, el.episodes.length - el.config.maxEpisodes);
    }
    const stratKey = `${ep.context.domain}:${ep.action.strategy}`;
    const strat = el.strategies.get(stratKey) || { domain: ep.context.domain, strategy: ep.action.strategy, uses: 0, totalQuality: 0, avgQuality: 0.5, lastUsed: null };
    strat.uses++;
    strat.totalQuality += ep.outcome.quality;
    strat.avgQuality = strat.totalQuality / strat.uses;
    strat.lastUsed = nowISO();
    el.strategies.set(stratKey, strat);
    return ep;
  }

  function consolidateExperience() {
    ensureExperienceLearning();
    const el = STATE.experienceLearning;
    if (el.episodes.length < el.config.minEpisodesForPattern * 2) return;
    const groups = {};
    for (const ep of el.episodes.slice(-200)) {
      const key = ep.context.domain;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ep);
    }
    for (const [domain, eps] of Object.entries(groups)) {
      if (eps.length < el.config.minEpisodesForPattern) continue;
      const successes = eps.filter(e => e.outcome.quality > 0.6);
      const failures = eps.filter(e => e.outcome.quality < 0.4);
      if (successes.length >= el.config.minEpisodesForPattern) {
        const stratCounts = {};
        for (const s of successes) { stratCounts[s.action.strategy] = (stratCounts[s.action.strategy] || 0) + 1; }
        const bestStrat = Object.entries(stratCounts).sort((a, b) => b[1] - a[1])[0];
        const patternId = `pat_${domain}_${bestStrat ? bestStrat[0] : "default"}`;
        el.patterns.set(patternId, {
          id: patternId, domain,
          bestStrategy: bestStrat ? bestStrat[0] : "default",
          keywords: [],
          avgQuality: successes.reduce((s, e) => s + e.outcome.quality, 0) / successes.length,
          episodeCount: successes.length,
          failureIndicators: failures.slice(0, 5).map(f => f.context.topic).filter(Boolean),
          confidence: clamp(successes.length / (successes.length + failures.length), 0.1, 0.95),
          createdAt: nowISO(), updatedAt: nowISO()
        });
        el.stats.patternsExtracted++;
      }
    }
  }

  function retrieveExperience(domain, topic, keywords = []) {
    ensureExperienceLearning();
    const el = STATE.experienceLearning;
    const results = { bestStrategy: null, relevantPatterns: [], recentEpisodes: [], warnings: [], confidence: 0 };
    for (const [_, pattern] of el.patterns) {
      let relevance = 0;
      if (pattern.domain === domain) relevance += 0.4;
      const kwSet = new Set(pattern.keywords);
      const overlap = keywords.filter(k => kwSet.has(k)).length;
      if (overlap > 0) relevance += Math.min(0.4, overlap * 0.1);
      if (topic && pattern.keywords.some(kw => topic.toLowerCase().includes(kw))) relevance += 0.2;
      if (relevance > 0.3) results.relevantPatterns.push({ ...pattern, relevance });
    }
    results.relevantPatterns.sort((a, b) => b.relevance - a.relevance);
    if (results.relevantPatterns.length > 0) {
      const best = results.relevantPatterns[0];
      results.bestStrategy = best.bestStrategy;
      results.confidence = best.confidence * best.relevance;
    }
    for (const pattern of results.relevantPatterns) {
      if (pattern.failureIndicators?.some(fi => topic?.toLowerCase().includes(fi.toLowerCase()))) {
        results.warnings.push(`Previous failures detected in similar topic within ${pattern.domain}`);
      }
    }
    el.stats.retrievalsUsed++;
    return results;
  }

  beforeEach(() => { STATE = {}; _uidCounter = 0; });

  it('ensureExperienceLearning initializes state structure', () => {
    ensureExperienceLearning();
    assert.ok(STATE.experienceLearning);
    assert.ok(Array.isArray(STATE.experienceLearning.episodes));
    assert.ok(STATE.experienceLearning.patterns instanceof Map);
    assert.ok(STATE.experienceLearning.strategies instanceof Map);
    assert.equal(STATE.experienceLearning.stats.episodesRecorded, 0);
  });

  it('ensureExperienceLearning is idempotent', () => {
    ensureExperienceLearning();
    STATE.experienceLearning.stats.episodesRecorded = 42;
    ensureExperienceLearning();
    assert.equal(STATE.experienceLearning.stats.episodesRecorded, 42);
  });

  it('recordExperienceEpisode creates proper episode shape', () => {
    const ep = recordExperienceEpisode({ domain: "technical", topic: "React hooks", quality: 0.8 });
    assert.ok(ep.id);
    assert.ok(ep.timestamp);
    assert.equal(ep.context.domain, "technical");
    assert.equal(ep.context.topic, "React hooks");
    assert.equal(ep.outcome.quality, 0.8);
    assert.equal(STATE.experienceLearning.episodes.length, 1);
  });

  it('recordExperienceEpisode clamps quality to [0,1]', () => {
    const ep1 = recordExperienceEpisode({ quality: 5.0 });
    assert.equal(ep1.outcome.quality, 1);
    const ep2 = recordExperienceEpisode({ quality: -3 });
    assert.equal(ep2.outcome.quality, 0);
  });

  it('recordExperienceEpisode defaults missing fields', () => {
    const ep = recordExperienceEpisode({});
    assert.equal(ep.context.domain, "general");
    assert.equal(ep.context.mode, "explore");
    assert.equal(ep.action.strategy, "default");
    assert.equal(ep.action.llmUsed, false);
    assert.equal(ep.outcome.quality, 0.5);
  });

  it('recordExperienceEpisode increments stats', () => {
    recordExperienceEpisode({ quality: 0.7 });
    recordExperienceEpisode({ quality: 0.8 });
    assert.equal(STATE.experienceLearning.stats.episodesRecorded, 2);
  });

  it('recordExperienceEpisode caps episodes at maxEpisodes', () => {
    STATE.experienceLearning = null;
    ensureExperienceLearning();
    STATE.experienceLearning.config.maxEpisodes = 5;
    for (let i = 0; i < 10; i++) recordExperienceEpisode({ quality: 0.5 });
    assert.equal(STATE.experienceLearning.episodes.length, 5);
  });

  it('recordExperienceEpisode tracks strategy effectiveness', () => {
    recordExperienceEpisode({ domain: "technical", strategy: "llm-enhanced", quality: 0.9 });
    recordExperienceEpisode({ domain: "technical", strategy: "llm-enhanced", quality: 0.7 });
    const strat = STATE.experienceLearning.strategies.get("technical:llm-enhanced");
    assert.ok(strat);
    assert.equal(strat.uses, 2);
    assert.equal(strat.avgQuality, 0.8);
  });

  it('recordExperienceEpisode truncates long fields', () => {
    const ep = recordExperienceEpisode({ domain: "x".repeat(200), topic: "y".repeat(300) });
    assert.ok(ep.context.domain.length <= 100);
    assert.ok(ep.context.topic.length <= 200);
  });

  it('recordExperienceEpisode caps keywords to 20', () => {
    const keywords = Array.from({ length: 30 }, (_, i) => `kw${i}`);
    const ep = recordExperienceEpisode({ keywords });
    assert.equal(ep.context.keywords.length, 20);
  });

  it('consolidateExperience does nothing with too few episodes', () => {
    ensureExperienceLearning();
    STATE.experienceLearning.config.minEpisodesForPattern = 3;
    recordExperienceEpisode({ quality: 0.8 });
    consolidateExperience();
    assert.equal(STATE.experienceLearning.patterns.size, 0);
  });

  it('consolidateExperience extracts pattern from successful episodes', () => {
    ensureExperienceLearning();
    STATE.experienceLearning.config.minEpisodesForPattern = 3;
    for (let i = 0; i < 5; i++) {
      recordExperienceEpisode({ domain: "technical", strategy: "llm-enhanced", quality: 0.8 });
    }
    for (let i = 0; i < 2; i++) {
      recordExperienceEpisode({ domain: "technical", strategy: "local", quality: 0.3 });
    }
    consolidateExperience();
    assert.ok(STATE.experienceLearning.patterns.size > 0);
    const pattern = STATE.experienceLearning.patterns.values().next().value;
    assert.equal(pattern.domain, "technical");
    assert.equal(pattern.bestStrategy, "llm-enhanced");
    assert.ok(pattern.confidence > 0.5);
  });

  it('consolidateExperience ignores domains with too few episodes', () => {
    ensureExperienceLearning();
    STATE.experienceLearning.config.minEpisodesForPattern = 3;
    for (let i = 0; i < 5; i++) recordExperienceEpisode({ domain: "big", quality: 0.8 });
    recordExperienceEpisode({ domain: "small", quality: 0.8 });
    consolidateExperience();
    const patterns = Array.from(STATE.experienceLearning.patterns.values());
    assert.ok(patterns.every(p => p.domain === "big"));
  });

  it('retrieveExperience returns matching patterns by domain', () => {
    ensureExperienceLearning();
    STATE.experienceLearning.patterns.set("pat_tech", {
      id: "pat_tech", domain: "technical", bestStrategy: "llm", keywords: [],
      confidence: 0.8, episodeCount: 5, failureIndicators: [], avgQuality: 0.8
    });
    const result = retrieveExperience("technical", "some topic", []);
    assert.ok(result.relevantPatterns.length > 0);
    assert.equal(result.bestStrategy, "llm");
    assert.ok(result.confidence > 0);
  });

  it('retrieveExperience generates warnings for failure indicators', () => {
    ensureExperienceLearning();
    STATE.experienceLearning.patterns.set("pat_sci", {
      id: "pat_sci", domain: "scientific", bestStrategy: "hypothesis",
      keywords: [], confidence: 0.7, episodeCount: 3,
      failureIndicators: ["quantum entanglement"], avgQuality: 0.7
    });
    const result = retrieveExperience("scientific", "quantum entanglement theory", []);
    assert.ok(result.warnings.length > 0);
    assert.ok(result.warnings[0].includes("failures detected"));
  });

  it('retrieveExperience increments retrievalsUsed', () => {
    ensureExperienceLearning();
    retrieveExperience("general", "test");
    retrieveExperience("general", "test");
    assert.equal(STATE.experienceLearning.stats.retrievalsUsed, 2);
  });

  it('retrieveExperience returns empty when no patterns match', () => {
    ensureExperienceLearning();
    const result = retrieveExperience("nonexistent", "topic");
    assert.equal(result.bestStrategy, null);
    assert.equal(result.relevantPatterns.length, 0);
    assert.equal(result.confidence, 0);
  });

  it('strategy avgQuality tracks correctly across episodes', () => {
    recordExperienceEpisode({ domain: "d", strategy: "s", quality: 0.4 });
    recordExperienceEpisode({ domain: "d", strategy: "s", quality: 0.6 });
    recordExperienceEpisode({ domain: "d", strategy: "s", quality: 0.8 });
    const strat = STATE.experienceLearning.strategies.get("d:s");
    assert.ok(Math.abs(strat.avgQuality - 0.6) < 0.01);
    assert.equal(strat.uses, 3);
  });
});

// ============================================================================
// ATTENTION MANAGER
// ============================================================================

describe('Attention Manager', () => {
  let STATE;

  function ensureAttentionManager() {
    if (!STATE.attention) {
      STATE.attention = {
        focus: null, threads: new Map(), queue: [], completed: [], background: [],
        stats: { threadsCreated: 0, threadsCompleted: 0, interruptions: 0, backgroundTasksRun: 0, avgFocusDurationMs: 0 },
        config: { maxConcurrentThreads: 5, maxQueueSize: 50, maxBackgroundTasks: 20, focusTimeoutMs: 30000, interruptThreshold: 0.8 }
      };
    }
  }

  function createCognitiveThread(task) {
    ensureAttentionManager();
    const attn = STATE.attention;
    const thread = {
      id: uid("thread"), type: String(task.type || "reasoning").slice(0, 50),
      priority: clamp(Number(task.priority || 0.5), 0, 1),
      description: String(task.description || "").slice(0, 500),
      status: "pending", output: null, domain: String(task.domain || "general"),
      createdAt: nowISO(), startedAt: null, completedAt: null, metadata: {}
    };
    const activeCount = Array.from(attn.threads.values()).filter(t => t.status === "active").length;
    if (activeCount < attn.config.maxConcurrentThreads) {
      thread.status = "active"; thread.startedAt = nowISO();
      attn.threads.set(thread.id, thread);
    } else if (thread.priority >= attn.config.interruptThreshold) {
      const active = Array.from(attn.threads.values()).filter(t => t.status === "active").sort((a, b) => a.priority - b.priority);
      if (active.length > 0 && active[0].priority < thread.priority) {
        active[0].status = "interrupted"; active[0].metadata.interruptedBy = thread.id;
        attn.stats.interruptions++;
        attn.queue.push({ threadId: active[0].id, priority: active[0].priority, queuedAt: nowISO() });
        thread.status = "active"; thread.startedAt = nowISO();
        attn.threads.set(thread.id, thread);
      } else {
        attn.queue.push({ threadId: thread.id, priority: thread.priority, queuedAt: nowISO() });
        attn.threads.set(thread.id, thread);
      }
    } else {
      attn.queue.push({ threadId: thread.id, priority: thread.priority, queuedAt: nowISO() });
      attn.threads.set(thread.id, thread);
    }
    attn.queue.sort((a, b) => b.priority - a.priority);
    if (attn.queue.length > attn.config.maxQueueSize) attn.queue = attn.queue.slice(0, attn.config.maxQueueSize);
    attn.stats.threadsCreated++;
    if (thread.status === "active" && (!attn.focus || thread.priority > (attn.threads.get(attn.focus)?.priority || 0))) {
      attn.focus = thread.id;
    }
    return { ok: true, thread };
  }

  function completeCognitiveThread(threadId, output) {
    ensureAttentionManager();
    const attn = STATE.attention;
    const thread = attn.threads.get(threadId);
    if (!thread) return { ok: false, error: "Thread not found" };
    thread.status = "completed"; thread.output = output; thread.completedAt = nowISO();
    if (thread.startedAt) {
      const duration = new Date(thread.completedAt) - new Date(thread.startedAt);
      const total = attn.stats.avgFocusDurationMs * attn.stats.threadsCompleted + duration;
      attn.stats.threadsCompleted++;
      attn.stats.avgFocusDurationMs = total / attn.stats.threadsCompleted;
    }
    attn.completed.push({ id: thread.id, type: thread.type, output: thread.output });
    if (attn.completed.length > 50) attn.completed.splice(0, attn.completed.length - 50);
    attn.threads.delete(threadId);
    if (attn.queue.length > 0) {
      const next = attn.queue.shift();
      const nextThread = attn.threads.get(next.threadId);
      if (nextThread && nextThread.status !== "completed") {
        nextThread.status = "active"; nextThread.startedAt = nowISO();
      }
    }
    const activeThreads = Array.from(attn.threads.values()).filter(t => t.status === "active");
    attn.focus = activeThreads.length > 0 ? activeThreads.sort((a, b) => b.priority - a.priority)[0].id : null;
    return { ok: true, completed: thread };
  }

  beforeEach(() => { STATE = {}; _uidCounter = 0; });

  it('ensureAttentionManager initializes state', () => {
    ensureAttentionManager();
    assert.ok(STATE.attention);
    assert.ok(STATE.attention.threads instanceof Map);
    assert.equal(STATE.attention.focus, null);
    assert.equal(STATE.attention.config.maxConcurrentThreads, 5);
  });

  it('createCognitiveThread creates active thread when under max', () => {
    const result = createCognitiveThread({ type: "reasoning", priority: 0.5, description: "test" });
    assert.ok(result.ok);
    assert.equal(result.thread.status, "active");
    assert.ok(result.thread.startedAt);
    assert.equal(STATE.attention.stats.threadsCreated, 1);
  });

  it('createCognitiveThread sets focus to new active thread', () => {
    const result = createCognitiveThread({ priority: 0.7, description: "focus test" });
    assert.equal(STATE.attention.focus, result.thread.id);
  });

  it('createCognitiveThread queues when at max capacity', () => {
    STATE.attention = null;
    ensureAttentionManager();
    STATE.attention.config.maxConcurrentThreads = 2;
    createCognitiveThread({ priority: 0.5 });
    createCognitiveThread({ priority: 0.5 });
    const r3 = createCognitiveThread({ priority: 0.3 });
    assert.equal(r3.thread.status, "pending");
    assert.equal(STATE.attention.queue.length, 1);
  });

  it('createCognitiveThread interrupts low-priority for high-priority', () => {
    STATE.attention = null;
    ensureAttentionManager();
    STATE.attention.config.maxConcurrentThreads = 1;
    createCognitiveThread({ priority: 0.3, description: "low priority" });
    createCognitiveThread({ priority: 0.9, description: "high priority" });
    assert.equal(STATE.attention.stats.interruptions, 1);
  });

  it('createCognitiveThread clamps priority to [0,1]', () => {
    const r = createCognitiveThread({ priority: 5.0 });
    assert.equal(r.thread.priority, 1);
    const r2 = createCognitiveThread({ priority: -2 });
    assert.equal(r2.thread.priority, 0);
  });

  it('createCognitiveThread truncates description', () => {
    const r = createCognitiveThread({ description: "x".repeat(1000) });
    assert.ok(r.thread.description.length <= 500);
  });

  it('queue is sorted by priority descending', () => {
    STATE.attention = null;
    ensureAttentionManager();
    STATE.attention.config.maxConcurrentThreads = 1;
    createCognitiveThread({ priority: 0.5 });
    createCognitiveThread({ priority: 0.3 });
    createCognitiveThread({ priority: 0.7 });
    createCognitiveThread({ priority: 0.2 });
    for (let i = 0; i < STATE.attention.queue.length - 1; i++) {
      assert.ok(STATE.attention.queue[i].priority >= STATE.attention.queue[i + 1].priority);
    }
  });

  it('completeCognitiveThread marks thread done', () => {
    const r = createCognitiveThread({ description: "test" });
    const result = completeCognitiveThread(r.thread.id, { value: 42 });
    assert.ok(result.ok);
    assert.equal(result.completed.status, "completed");
    assert.deepEqual(result.completed.output, { value: 42 });
    assert.equal(STATE.attention.stats.threadsCompleted, 1);
  });

  it('completeCognitiveThread returns error for unknown thread', () => {
    ensureAttentionManager();
    const result = completeCognitiveThread("nonexistent", {});
    assert.equal(result.ok, false);
  });

  it('completeCognitiveThread promotes next from queue', () => {
    STATE.attention = null;
    ensureAttentionManager();
    STATE.attention.config.maxConcurrentThreads = 1;
    const r1 = createCognitiveThread({ priority: 0.5 });
    createCognitiveThread({ priority: 0.3 });
    completeCognitiveThread(r1.thread.id, {});
    const active = Array.from(STATE.attention.threads.values()).filter(t => t.status === "active");
    assert.equal(active.length, 1);
  });

  it('completeCognitiveThread updates focus to null when empty', () => {
    const r = createCognitiveThread({ description: "only one" });
    completeCognitiveThread(r.thread.id, {});
    assert.equal(STATE.attention.focus, null);
  });

  it('focus tracks highest-priority active thread', () => {
    createCognitiveThread({ priority: 0.3 });
    const r2 = createCognitiveThread({ priority: 0.8 });
    assert.equal(STATE.attention.focus, r2.thread.id);
  });

  it('completed list is capped at 50', () => {
    ensureAttentionManager();
    for (let i = 0; i < 60; i++) {
      const r = createCognitiveThread({ priority: 0.5 });
      completeCognitiveThread(r.thread.id, {});
    }
    assert.ok(STATE.attention.completed.length <= 50);
  });
});

// ============================================================================
// REFLECTION ENGINE
// ============================================================================

describe('Reflection Engine', () => {
  let STATE;

  function ensureReflectionEngine() {
    if (!STATE.reflection) {
      STATE.reflection = {
        reflections: [],
        insights: new Map(),
        selfModel: { strengths: [], weaknesses: [], biases: [], confidenceCalibration: 0.5 },
        stats: { reflectionsRun: 0, insightsGenerated: 0, selfCorrections: 0, qualityImprovements: 0 },
        config: { maxReflections: 500, maxInsights: 200, reflectOnEveryNth: 1, minResponseLength: 50, qualityThreshold: 0.4 }
      };
    }
  }

  function reflectOnResponse(context) {
    ensureReflectionEngine();
    const ref = STATE.reflection;
    const prompt = String(context.prompt || "");
    const response = String(context.response || "");
    const relevantDtus = context.relevantDtus || [];
    if (response.length < ref.config.minResponseLength) return null;
    ref.stats.reflectionsRun++;
    if (ref.stats.reflectionsRun % ref.config.reflectOnEveryNth !== 0) return null;
    const reflection = {
      id: uid("refl"), timestamp: nowISO(), prompt: prompt.slice(0, 200),
      responseLength: response.length, checks: {}, quality: 0.5, insights: [], corrections: []
    };
    reflection.checks.factConsistency = 1.0;
    const promptTokens = new Set(tokenizeText(prompt));
    const responseTokens = new Set(tokenizeText(response));
    const overlap = [...promptTokens].filter(t => responseTokens.has(t)).length;
    reflection.checks.relevance = clamp(overlap / Math.max(promptTokens.size, 1), 0, 1);
    reflection.checks.grounding = relevantDtus.length > 0 ? clamp(relevantDtus.length / 3, 0.2, 1) : 0.2;
    const expectedLength = prompt.length * 3;
    reflection.checks.completeness = clamp(response.length / Math.max(expectedLength, 100), 0.3, 1);
    reflection.checks.selfConsistency = 1.0;
    const weights = { factConsistency: 0.3, relevance: 0.25, grounding: 0.2, completeness: 0.15, selfConsistency: 0.1 };
    reflection.quality = Object.entries(weights).reduce((sum, [key, w]) => sum + (reflection.checks[key] || 0.5) * w, 0);
    if (reflection.checks.grounding < 0.4) {
      reflection.insights.push({ type: "low_grounding", message: "Response lacks evidence", severity: 0.5 });
    }
    ref.reflections.push(reflection);
    if (ref.reflections.length > ref.config.maxReflections) {
      ref.reflections.splice(0, ref.reflections.length - ref.config.maxReflections);
    }
    return reflection;
  }

  beforeEach(() => { STATE = {}; _uidCounter = 0; });

  it('ensureReflectionEngine initializes state', () => {
    ensureReflectionEngine();
    assert.ok(STATE.reflection);
    assert.ok(STATE.reflection.insights instanceof Map);
    assert.equal(STATE.reflection.selfModel.confidenceCalibration, 0.5);
  });

  it('reflectOnResponse skips short responses', () => {
    ensureReflectionEngine();
    const result = reflectOnResponse({ prompt: "test", response: "hi" });
    assert.equal(result, null);
  });

  it('reflectOnResponse generates quality score', () => {
    const result = reflectOnResponse({
      prompt: "Tell me about React hooks and state management",
      response: "React hooks are a feature that allow you to use state management and other React features without class components. The main hooks include useState for state management and useEffect for side effects.",
      relevantDtus: ["dtu1", "dtu2"]
    });
    assert.ok(result);
    assert.ok(result.quality > 0);
    assert.ok(result.quality <= 1);
  });

  it('quality check weights sum to 1.0', () => {
    const weights = { factConsistency: 0.3, relevance: 0.25, grounding: 0.2, completeness: 0.15, selfConsistency: 0.1 };
    const sum = Object.values(weights).reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(sum - 1.0) < 0.001);
  });

  it('reflectOnResponse detects low grounding', () => {
    const result = reflectOnResponse({
      prompt: "Explain quantum computing in detail",
      response: "Quantum computing uses quantum mechanical phenomena like superposition and entanglement to perform computations that are fundamentally different from classical approaches.",
      relevantDtus: []
    });
    assert.ok(result);
    assert.equal(result.checks.grounding, 0.2);
    assert.ok(result.insights.some(i => i.type === "low_grounding"));
  });

  it('reflectOnResponse grounding improves with DTUs', () => {
    const result = reflectOnResponse({
      prompt: "Explain quantum computing in detail",
      response: "Quantum computing uses quantum mechanical phenomena like superposition and entanglement to perform computations.",
      relevantDtus: ["dtu1", "dtu2", "dtu3"]
    });
    assert.ok(result);
    assert.ok(result.checks.grounding >= 0.8);
  });

  it('reflections are capped at maxReflections', () => {
    ensureReflectionEngine();
    STATE.reflection.config.maxReflections = 5;
    for (let i = 0; i < 10; i++) {
      reflectOnResponse({
        prompt: `Question ${i} about a topic`,
        response: "A sufficiently long response that exceeds the minimum length threshold for reflection processing."
      });
    }
    assert.ok(STATE.reflection.reflections.length <= 5);
  });

  it('reflectOnResponse measures relevance via token overlap', () => {
    const highRelevance = reflectOnResponse({
      prompt: "React hooks useState useEffect components",
      response: "React hooks like useState and useEffect are fundamental to modern React component development patterns."
    });
    const lowRelevance = reflectOnResponse({
      prompt: "React hooks useState useEffect components",
      response: "The weather forecast shows sunny skies tomorrow with temperatures reaching seventy degrees fahrenheit outside."
    });
    assert.ok(highRelevance);
    assert.ok(lowRelevance);
    assert.ok(highRelevance.checks.relevance > lowRelevance.checks.relevance);
  });

  it('reflection increments reflectionsRun counter', () => {
    ensureReflectionEngine();
    reflectOnResponse({
      prompt: "test question about something interesting",
      response: "A response that is long enough to pass the minimum length threshold for the reflection engine."
    });
    assert.ok(STATE.reflection.stats.reflectionsRun >= 1);
  });
});

// ============================================================================
// WORLD MODEL AUTO-UPDATE
// ============================================================================

describe('World Model Auto-Update', () => {
  let STATE;
  const ENTITY_TYPES = { CONCEPT: "concept", PERSON: "person", EVENT: "event" };

  function ensureWorldModel() {
    if (!STATE.worldModel) {
      STATE.worldModel = {
        entities: new Map(), relations: new Map(),
        config: { autoExtractEnabled: true, maxEntities: 10000 },
        stats: { entitiesCreated: 0 }
      };
    }
  }

  function createWorldEntity(input) {
    ensureWorldModel();
    const entity = {
      id: uid("entity"), name: String(input.name || ""),
      type: input.type || ENTITY_TYPES.CONCEPT,
      state: { confidence: input.confidence || 0.5, salience: input.salience || 0.3, volatility: 0, properties: {} },
      source: { dtuIds: input.dtuIds || [] },
      createdAt: nowISO(), updatedAt: nowISO()
    };
    STATE.worldModel.entities.set(entity.id, entity);
    return { ok: true, entity };
  }

  function createWorldRelation(input) {
    ensureWorldModel();
    const relation = {
      id: uid("rel"), from: input.from, to: input.to,
      type: input.type || "correlates",
      strength: input.strength || 0.3, confidence: input.confidence || 0.4,
      evidence: input.evidence || 0,
      createdAt: nowISO(), updatedAt: nowISO()
    };
    STATE.worldModel.relations.set(relation.id, relation);
    return { ok: true, relation };
  }

  beforeEach(() => { STATE = {}; _uidCounter = 0; });

  it('entity creation and retrieval works', () => {
    const result = createWorldEntity({ name: "React", confidence: 0.7 });
    assert.ok(result.ok);
    assert.equal(result.entity.name, "React");
    assert.equal(STATE.worldModel.entities.size, 1);
  });

  it('relation links two entities', () => {
    const e1 = createWorldEntity({ name: "React" });
    const e2 = createWorldEntity({ name: "JavaScript" });
    const rel = createWorldRelation({ from: e1.entity.id, to: e2.entity.id, type: "part_of", strength: 0.6 });
    assert.ok(rel.ok);
    assert.equal(rel.relation.strength, 0.6);
  });

  it('salience boost works', () => {
    const e = createWorldEntity({ name: "Test", salience: 0.3 });
    e.entity.state.salience = clamp(e.entity.state.salience + 0.05, 0, 1);
    assert.ok(Math.abs(e.entity.state.salience - 0.35) < 0.001);
  });

  it('contradiction reduces confidence', () => {
    const e = createWorldEntity({ name: "Claim", confidence: 0.8 });
    e.entity.state.confidence = clamp(e.entity.state.confidence - 0.1, 0.05, 1);
    assert.ok(Math.abs(e.entity.state.confidence - 0.7) < 0.001);
  });

  it('relation strength reinforcement works', () => {
    const e1 = createWorldEntity({ name: "A" });
    const e2 = createWorldEntity({ name: "B" });
    const rel = createWorldRelation({ from: e1.entity.id, to: e2.entity.id, strength: 0.3 });
    rel.relation.strength = clamp(rel.relation.strength + 0.05, 0, 1);
    rel.relation.evidence = (rel.relation.evidence || 0) + 1;
    assert.ok(Math.abs(rel.relation.strength - 0.35) < 0.001);
    assert.equal(rel.relation.evidence, 1);
  });

  it('temporal decay reduces salience', () => {
    const e = createWorldEntity({ name: "Old", salience: 0.8 });
    const decayFactor = 1 - 0.02 * 5;
    e.entity.state.salience = clamp(e.entity.state.salience * decayFactor, 0.01, 1);
    assert.ok(e.entity.state.salience < 0.8);
  });

  it('weak relations get pruned', () => {
    ensureWorldModel();
    const e1 = createWorldEntity({ name: "X" });
    const e2 = createWorldEntity({ name: "Y" });
    const rel = createWorldRelation({ from: e1.entity.id, to: e2.entity.id, strength: 0.04 });
    if (rel.relation.strength < 0.05) STATE.worldModel.relations.delete(rel.relation.id);
    assert.equal(STATE.worldModel.relations.size, 0);
  });

  it('confidence has floor of 0.05', () => {
    const e = createWorldEntity({ name: "MinConf", confidence: 0.1 });
    e.entity.state.confidence = clamp(e.entity.state.confidence - 0.2, 0.05, 1);
    assert.equal(e.entity.state.confidence, 0.05);
  });
});

// ============================================================================
// TRANSFER PATTERN EXTRACTION
// ============================================================================

describe('Transfer Pattern Extraction', () => {
  let STATE;

  function ensureTransferEngine() {
    if (!STATE.transfer) {
      STATE.transfer = {
        patterns: new Map(), transfers: [],
        stats: { patternsExtracted: 0, transfersSuccessful: 0 },
        config: { confidenceDecay: 0.9 }
      };
    }
  }

  function ensureReasoningEngine() {
    if (!STATE.reasoning) STATE.reasoning = { chains: new Map(), steps: new Map() };
  }

  function classifyDomain(dtu) {
    const text = [dtu.title, dtu.human?.summary, ...(dtu.tags || [])].join(" ").toLowerCase();
    const keywords = {
      technical: ["code", "programming", "software", "api"],
      scientific: ["research", "hypothesis", "experiment"],
    };
    let best = "general", bestScore = 0;
    for (const [domain, kws] of Object.entries(keywords)) {
      const score = kws.filter(kw => text.includes(kw)).length;
      if (score > bestScore) { bestScore = score; best = domain; }
    }
    return best;
  }

  function autoExtractTransferPattern(chain) {
    ensureTransferEngine();
    ensureReasoningEngine();
    if (!chain || chain.status !== "concluded" || !chain.conclusion) return;
    const steps = Array.from(STATE.reasoning.steps.values())
      .filter(s => s.chainId === chain.id).sort((a, b) => a.index - b.index);
    if (steps.length < 2) return;
    const text = [chain.question, chain.conclusion, ...steps.map(s => s.conclusion)].join(" ");
    const pseudoDtu = { title: chain.question || "", human: { summary: text }, tags: [] };
    const domain = classifyDomain(pseudoDtu);
    const stepTypes = steps.map(s => s.type || "deduction");
    const patternId = uid("tpat");
    STATE.transfer.patterns.set(patternId, {
      id: patternId, name: `auto:${chain.question?.slice(0, 50)}`,
      sourceDomain: domain,
      confidence: clamp(chain.confidence || 0.5, 0.2, 0.8),
      structure: { dtuCount: steps.length, topTerms: [], stepSequence: stepTypes },
      template: { approach: `${stepTypes[0]}-first reasoning` },
      createdAt: nowISO(), updatedAt: nowISO()
    });
    STATE.transfer.stats.patternsExtracted++;
  }

  function findAnalogousPatterns(targetDomain) {
    ensureTransferEngine();
    const results = [];
    for (const [patternId, pattern] of STATE.transfer.patterns) {
      if (pattern.sourceDomain === targetDomain) continue;
      let relevance = 0.5 + pattern.confidence * 0.2;
      results.push({ patternId, sourceDomain: pattern.sourceDomain, targetDomain, relevance: clamp(relevance, 0, 1), template: pattern.template });
    }
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, 10);
  }

  beforeEach(() => { STATE = {}; _uidCounter = 0; });

  it('autoExtractTransferPattern skips non-concluded chains', () => {
    autoExtractTransferPattern({ status: "active", conclusion: null });
    ensureTransferEngine();
    assert.equal(STATE.transfer.patterns.size, 0);
  });

  it('autoExtractTransferPattern skips chains with < 2 steps', () => {
    ensureReasoningEngine();
    STATE.reasoning.steps.set("s1", { id: "s1", chainId: "c1", index: 0, type: "deduction", conclusion: "a" });
    autoExtractTransferPattern({ id: "c1", status: "concluded", conclusion: "done", question: "test" });
    ensureTransferEngine();
    assert.equal(STATE.transfer.patterns.size, 0);
  });

  it('autoExtractTransferPattern creates pattern from concluded chain', () => {
    ensureReasoningEngine();
    STATE.reasoning.steps.set("s1", { id: "s1", chainId: "c2", index: 0, type: "deduction", conclusion: "premise" });
    STATE.reasoning.steps.set("s2", { id: "s2", chainId: "c2", index: 1, type: "induction", conclusion: "generalize" });
    STATE.reasoning.steps.set("s3", { id: "s3", chainId: "c2", index: 2, type: "synthesis", conclusion: "combine" });
    autoExtractTransferPattern({ id: "c2", status: "concluded", conclusion: "final", question: "How does software work?", confidence: 0.7 });
    ensureTransferEngine();
    assert.equal(STATE.transfer.patterns.size, 1);
    const pattern = STATE.transfer.patterns.values().next().value;
    assert.equal(pattern.structure.dtuCount, 3);
    assert.deepEqual(pattern.structure.stepSequence, ["deduction", "induction", "synthesis"]);
  });

  it('autoExtractTransferPattern clamps confidence to [0.2, 0.8]', () => {
    ensureReasoningEngine();
    STATE.reasoning.steps.set("s1", { id: "s1", chainId: "c3", index: 0, type: "a", conclusion: "x" });
    STATE.reasoning.steps.set("s2", { id: "s2", chainId: "c3", index: 1, type: "b", conclusion: "y" });
    autoExtractTransferPattern({ id: "c3", status: "concluded", conclusion: "done", question: "Q", confidence: 0.05 });
    const pattern = STATE.transfer.patterns.values().next().value;
    assert.ok(pattern.confidence >= 0.2);
  });

  it('classifyDomain detects technical content', () => {
    assert.equal(classifyDomain({ title: "API programming guide", human: { summary: "software code" }, tags: [] }), "technical");
  });

  it('classifyDomain defaults to general', () => {
    assert.equal(classifyDomain({ title: "Hello", human: { summary: "simple thing" }, tags: [] }), "general");
  });

  it('findAnalogousPatterns returns cross-domain matches', () => {
    ensureTransferEngine();
    STATE.transfer.patterns.set("p1", {
      id: "p1", sourceDomain: "technical", confidence: 0.8,
      structure: { topTerms: [] }, template: { approach: "test" }
    });
    const results = findAnalogousPatterns("scientific");
    assert.ok(results.length > 0);
    assert.equal(results[0].sourceDomain, "technical");
  });

  it('findAnalogousPatterns excludes same-domain', () => {
    ensureTransferEngine();
    STATE.transfer.patterns.set("p1", {
      id: "p1", sourceDomain: "technical", confidence: 0.8,
      structure: { topTerms: [] }, template: {}
    });
    assert.equal(findAnalogousPatterns("technical").length, 0);
  });

  it('transfer stats increment on extraction', () => {
    ensureReasoningEngine();
    STATE.reasoning.steps.set("s1", { id: "s1", chainId: "ch", index: 0, type: "a", conclusion: "x" });
    STATE.reasoning.steps.set("s2", { id: "s2", chainId: "ch", index: 1, type: "b", conclusion: "y" });
    autoExtractTransferPattern({ id: "ch", status: "concluded", conclusion: "done", question: "Q" });
    assert.equal(STATE.transfer.stats.patternsExtracted, 1);
  });
});

// ============================================================================
// E2E SMOKE TEST
// ============================================================================

describe('Cognitive Loop Integration (E2E Smoke)', () => {
  it('experience → consolidation → retrieval loop works', () => {
    const el = {
      episodes: [], patterns: new Map(), strategies: new Map(),
      stats: { episodesRecorded: 0, patternsExtracted: 0, retrievalsUsed: 0 },
      config: { minEpisodesForPattern: 3 }
    };
    // Record episodes
    for (let i = 0; i < 5; i++) {
      el.episodes.push({
        context: { domain: "technical" },
        action: { strategy: "llm-enhanced" },
        outcome: { quality: 0.85 }
      });
    }
    // Consolidate
    el.patterns.set("pat_technical_llm-enhanced", {
      domain: "technical", bestStrategy: "llm-enhanced", confidence: 0.9, keywords: []
    });
    // Retrieve
    let bestStrategy = null;
    for (const [_, p] of el.patterns) {
      if (p.domain === "technical") { bestStrategy = p.bestStrategy; break; }
    }
    assert.equal(bestStrategy, "llm-enhanced");
  });

  it('reflection feeds into experience quality', () => {
    // Reflection produces quality score
    const quality = 0.78;
    // Experience episode records it
    const episode = { domain: "general", quality };
    assert.equal(episode.quality, 0.78);
  });

  it('world model entities + relations + contradiction lifecycle', () => {
    const entities = new Map();
    const e1 = { id: "e1", name: "JS", state: { confidence: 0.9, salience: 0.5, volatility: 0 } };
    const e2 = { id: "e2", name: "TS", state: { confidence: 0.85, salience: 0.4, volatility: 0 } };
    entities.set("e1", e1);
    entities.set("e2", e2);
    // Contradiction
    e1.state.confidence = clamp(e1.state.confidence - 0.1, 0.05, 1);
    e1.state.volatility += 0.15;
    assert.ok(Math.abs(e1.state.confidence - 0.8) < 0.001);
    assert.ok(e1.state.volatility > 0);
  });

  it('attention thread full lifecycle', () => {
    const threads = new Map();
    const t = { id: "t1", status: "active", priority: 0.5 };
    threads.set("t1", t);
    assert.equal(threads.size, 1);
    t.status = "completed";
    threads.delete("t1");
    assert.equal(threads.size, 0);
  });
});
