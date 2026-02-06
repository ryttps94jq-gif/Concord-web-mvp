import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

/**
 * FE-004: Runtime validation of API base URL.
 * Warns visibly when the app is running against localhost in a non-localhost context,
 * which usually indicates a missing NEXT_PUBLIC_API_URL in production.
 */
if (typeof window !== 'undefined') {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const apiPointsToLocalhost = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');

  if (!isLocalhost && apiPointsToLocalhost) {
    console.warn(
      '[Concord] API base URL points to localhost but app is running on %s. ' +
      'Set NEXT_PUBLIC_API_URL to your production backend. Current value: %s',
      window.location.hostname,
      BASE_URL
    );
  }
}

// Create axios instance with defaults
// SECURITY: withCredentials ensures httpOnly cookies are sent with requests
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // SECURITY: Include cookies in cross-origin requests
});

// Helper to get CSRF token from cookie
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

// Request interceptor for CSRF protection
// SECURITY: API keys and session IDs are now handled via httpOnly cookies only
// This prevents XSS attacks from stealing credentials
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      // SECURITY: Add CSRF token for state-changing requests
      // Credentials are handled by httpOnly cookies (withCredentials: true)
      const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      if (stateChangingMethods.includes(config.method?.toUpperCase() || '')) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;

      // SECURITY: Handle CSRF token expiration
      if (status === 403) {
        const data = error.response.data as { code?: string };
        if (data?.code === 'CSRF_FAILED') {
          // Refresh CSRF token and retry
          try {
            await api.get('/api/auth/csrf-token');
            // Retry original request
            return api.request(error.config!);
          } catch {
            console.error('Failed to refresh CSRF token');
          }
        }
      }

      if (status === 401 && typeof window !== 'undefined') {
        // Redirect to login if not already on login page
        // Session is managed via httpOnly cookies, cleared by server
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      if (status === 429) {
        console.warn('Rate limited. Please slow down requests.');
      }
      if (status >= 500) {
        console.error('Server error:', error.response.data);
      }
    } else if (error.request) {
      console.error('Network error - no response received');
    }
    return Promise.reject(error);
  }
);

// Typed API helper functions matching actual backend endpoints
export const apiHelpers = {
  // System status
  status: {
    get: () => api.get('/api/status'),
  },

  // Jobs management
  jobs: {
    status: () => api.get('/api/jobs/status'),
    toggle: (job: string, enabled: boolean) =>
      api.post('/api/jobs/toggle', { job, enabled }),
  },

  // DTU operations (note: endpoint is /api/dtus - plural)
  dtus: {
    list: () => api.get('/api/dtus'),

    create: (data: {
      title?: string;
      content: string;
      tags?: string[];
      source?: string;
      parents?: string[];
      isGlobal?: boolean;
      meta?: Record<string, unknown>;
      declaredSourceType?: string;
    }) => api.post('/api/dtus', data),

    update: (id: string, patch: Record<string, unknown>) =>
      api.patch(`/api/dtus/${id}`, patch),
  },

  // Ingest operations
  ingest: {
    manual: (data: {
      text: string;
      title?: string;
      tags?: string[];
      makeGlobal?: boolean;
      declaredSourceType?: string;
    }) => api.post('/api/ingest', data),

    queue: (data: {
      text: string;
      title?: string;
      tags?: string[];
      makeGlobal?: boolean;
      declaredSourceType?: string;
    }) => api.post('/api/ingest/queue', data),
  },

  // Autocrawl operations
  autocrawl: {
    manual: (data: {
      url: string;
      makeGlobal?: boolean;
      declaredSourceType?: string;
      tags?: string[];
    }) => api.post('/api/autocrawl', data),

    queue: (data: {
      url: string;
      makeGlobal?: boolean;
      declaredSourceType?: string;
      tags?: string[];
    }) => api.post('/api/autocrawl/queue', data),
  },

  // Chat operations
  chat: {
    send: (message: string, mode: string = 'overview') =>
      api.post('/api/chat', { message, mode }),

    ask: (message: string, mode: string = 'overview') =>
      api.post('/api/ask', { message, mode }),

    feedback: (data: { sessionId: string; rating: 'up' | 'down' | number; messageIndex?: number; comment?: string }) =>
      api.post('/api/chat/feedback', data),
  },

  // Cognitive status (combined)
  cognitive: {
    status: () => api.get('/api/cognitive/status'),
  },

  // Dream mode (synthesis)
  dream: {
    run: (data?: { seed?: string }) => api.post('/api/dream', data || {}),
  },

  // Reseed DTUs
  reseed: {
    run: (force: boolean = false) => api.post('/api/reseed', { force }),
  },

  // Forge (DTU creation modes)
  forge: {
    manual: (data: { title?: string; content: string; tags?: string[]; source?: string }) =>
      api.post('/api/forge/manual', data),
    hybrid: (data: { title?: string; content: string; tags?: string[]; source?: string }) =>
      api.post('/api/forge/hybrid', data),
    auto: (data: { prompt: string; tags?: string[] }) =>
      api.post('/api/forge/auto', data),
    fromSource: (data: { url?: string; text?: string; tags?: string[] }) =>
      api.post('/api/forge/fromSource', data),
  },

  // Simulations (worldmodel)
  simulations: {
    list: () => api.get('/api/worldmodel/simulations'),
    get: (simId: string) => api.get(`/api/worldmodel/simulations/${simId}`),
    run: (data: { prompt?: string }) => api.post('/api/worldmodel/simulate', data),
  },

  // Personas
  personas: {
    list: () => api.get('/api/personas'),

    speak: (personaId: string, text: string) =>
      api.post(`/api/personas/${personaId}/speak`, { text }),

    animate: (personaId: string, kind: string = 'talk') =>
      api.post(`/api/personas/${personaId}/animate`, { kind }),
  },

  // Council
  council: {
    reviewGlobal: () => api.post('/api/council/review-global', {}),
    weekly: () => api.post('/api/council/weekly', {}),
    vote: (data: { dtuId: string; vote: 'approve' | 'reject'; reason?: string }) =>
      api.post('/api/council/vote', data),
    tally: (dtuId: string) => api.get(`/api/council/tally/${dtuId}`),
    credibility: (data: { dtuId: string }) =>
      api.post('/api/council/credibility', data),
  },

  // Swarm
  swarm: {
    run: (prompt: string, count: number = 6) =>
      api.post('/api/swarm', { prompt, count }),
  },

  // Credits (wallet system)
  credits: {
    getWallet: (walletId: string) =>
      api.post('/api/credits/wallet', { walletId }),

    earn: (walletId: string, amount: number, reason: string = 'quest') =>
      api.post('/api/credits/earn', { walletId, amount, reason }),

    spend: (walletId: string, amount: number, reason: string = 'spend') =>
      api.post('/api/credits/spend', { walletId, amount, reason }),
  },

  // Note: Marketplace is defined in v4.0 APIs section below

  // Global feed
  global: {
    feed: () => api.get('/api/global/feed'),
  },

  // Macros
  macros: {
    run: (recipeName: string, ctx?: Record<string, unknown>) =>
      api.post('/api/macros/run', { recipeName, ctx }),
  },

  // Events
  events: {
    list: () => api.get('/api/events'),
  },

  // v4.0 APIs

  // Plugin Marketplace
  marketplace: {
    listings: () => api.get('/api/marketplace/listings'),
    browse: (params?: { search?: string; category?: string; page?: number }) =>
      api.get('/api/marketplace/browse', { params }),
    submit: (data: { name: string; githubUrl: string; description?: string; category?: string }) =>
      api.post('/api/marketplace/submit', data),
    install: (data: { pluginId?: string; fromGithub?: boolean; githubUrl?: string }) =>
      api.post('/api/marketplace/install', data),
    installed: () => api.get('/api/marketplace/installed'),
    review: (data: { pluginId: string; rating: number; comment?: string }) =>
      api.post('/api/marketplace/review', data),
  },

  // Graph Queries
  graph: {
    query: (dsl: string) => api.post('/api/graph/query', { dsl }),
    visual: (params?: { tier?: string; limit?: number }) =>
      api.get('/api/graph/visual', { params }),
    force: (params?: { centerNode?: string; depth?: number; maxNodes?: number }) =>
      api.get('/api/graph/force', { params }),
  },

  // Schema System
  schema: {
    list: () => api.get('/api/schema'),
    create: (data: { name: string; kind: string; fields: any[] }) =>
      api.post('/api/schema', data),
    validate: (data: { schemaName: string; data: any }) =>
      api.post('/api/schema/validate', data),
    apply: (data: { schemaName: string; dtuId: string; data: any }) =>
      api.post('/api/schema/apply', data),
  },

  // Auto-Tagging
  autotag: {
    analyze: (data: { dtuId?: string; content?: string }) =>
      api.post('/api/autotag/analyze', data),
    apply: (data: { dtuId: string; tags?: string[]; domain?: string }) =>
      api.post('/api/autotag/apply', data),
    batch: (data: { tier?: string; limit?: number; dryRun?: boolean }) =>
      api.post('/api/autotag/batch', data),
  },

  // Visual
  visual: {
    moodboard: (params?: { tags?: string; tier?: string; maxNodes?: number }) =>
      api.get('/api/visual/moodboard', { params }),
    sunburst: (params?: { maxDepth?: number; maxNodes?: number }) =>
      api.get('/api/visual/sunburst', { params }),
    timeline: (params?: { startDate?: string; endDate?: string; limit?: number }) =>
      api.get('/api/visual/timeline', { params }),
  },

  // Collaboration
  collab: {
    sessions: () => api.get('/api/collab/sessions'),
    createSession: (data: { dtuId: string; mode?: string }) =>
      api.post('/api/collab/session', data),
    join: (data: { sessionId: string; userId?: string }) =>
      api.post('/api/collab/join', data),
    edit: (data: { sessionId: string; path: string; value: any }) =>
      api.post('/api/collab/edit', data),
    merge: (sessionId: string) => api.post('/api/collab/merge', { sessionId }),
  },

  // Whiteboard
  whiteboard: {
    list: () => api.get('/api/whiteboards'),
    get: (id: string) => api.get(`/api/whiteboard/${id}`),
    create: (data: { title: string; linkedDtus?: string[] }) =>
      api.post('/api/whiteboard', data),
    update: (id: string, data: { elements?: any[]; linkedDtus?: string[] }) =>
      api.put(`/api/whiteboard/${id}`, data),
  },

  // Webhooks & Automations
  webhooks: {
    list: () => api.get('/api/webhooks'),
    create: (data: { name: string; url: string; events: string[] }) =>
      api.post('/api/webhooks', data),
    delete: (id: string) => api.delete(`/api/webhooks/${id}`),
    toggle: (id: string, enabled: boolean) =>
      api.post(`/api/webhooks/${id}/toggle`, { enabled }),
  },

  automations: {
    list: () => api.get('/api/automations'),
    create: (data: { name: string; trigger: any; actions: any[] }) =>
      api.post('/api/automations', data),
    run: (id: string, triggerData?: any) =>
      api.post(`/api/automations/${id}/run`, triggerData || {}),
    delete: (id: string) => api.delete(`/api/automations/${id}`),
  },

  // Integrations
  integrations: {
    list: () => api.get('/api/integrations'),
    obsidianExport: (data: { dtuIds?: string[]; includeLineage?: boolean }) =>
      api.post('/api/obsidian/export', data),
    obsidianImport: (files: any[]) => api.post('/api/obsidian/import', { files }),
    notionImport: (pages: any[]) => api.post('/api/notion/import', { pages }),
  },

  // Database & Performance
  db: {
    status: () => api.get('/api/db/status'),
    migrate: () => api.post('/api/db/migrate', {}),
    sync: (batchSize?: number) => api.post('/api/db/sync', { batchSize }),
  },

  redis: {
    stats: () => api.get('/api/redis/stats'),
  },

  perf: {
    metrics: () => api.get('/api/perf/metrics'),
    gc: () => api.post('/api/perf/gc', {}),
  },

  backpressure: {
    status: () => api.get('/api/backpressure/status'),
  },

  // PWA & Mobile
  pwa: {
    manifest: () => api.get('/manifest.json'),
    swConfig: () => api.get('/api/pwa/sw-config'),
  },

  mobile: {
    shortcuts: () => api.get('/api/mobile/shortcuts'),
    dtu: (id: string) => api.get(`/api/mobile/dtu/${id}`),
  },

  // =============================================
  // NEW: Backend systems previously not connected
  // =============================================

  // Affect Translation Spine (ATS)
  affect: {
    state: (sessionId?: string) =>
      api.get('/api/affect/state', { params: { sessionId } }),
    emit: (sessionId: string, event: { type: string; intensity: number; polarity: number; payload?: any }) =>
      api.post('/api/affect/event', { sessionId, ...event }),
    policy: (sessionId?: string) =>
      api.get('/api/affect/policy', { params: { sessionId } }),
    reset: (sessionId: string, mode?: string) =>
      api.post('/api/affect/reset', { sessionId, mode }),
    events: (sessionId: string) =>
      api.get('/api/affect/events', { params: { sessionId } }),
    health: () => api.get('/api/affect/health'),
  },

  // Goals system
  goals: {
    list: () => api.get('/api/goals'),
    get: (goalId: string) => api.get(`/api/goals/${goalId}`),
    create: (data: { title: string; description?: string; targetDate?: string; priority?: string }) =>
      api.post('/api/goals', data),
    progress: (goalId: string, data: { progress: number; note?: string }) =>
      api.post(`/api/goals/${goalId}/progress`, data),
    complete: (goalId: string) => api.post(`/api/goals/${goalId}/complete`, {}),
    activate: (goalId: string) => api.post(`/api/goals/${goalId}/activate`, {}),
    abandon: (goalId: string) => api.post(`/api/goals/${goalId}/abandon`, {}),
    status: () => api.get('/api/goals/status'),
    autoPropose: () => api.post('/api/goals/auto-propose', {}),
    config: () => api.get('/api/goals/config'),
  },

  // Metacognition
  metacognition: {
    status: () => api.get('/api/metacognition/status'),
    blindspots: () => api.get('/api/metacognition/blindspots'),
    calibration: () => api.get('/api/metacognition/calibration'),
    introspection: () => api.get('/api/metacognition/introspection-status'),
    predict: (data: { claim: string; confidence: number; domain?: string }) =>
      api.post('/api/metacognition/predict', data),
    resolve: (predictionId: string, outcome: boolean) =>
      api.post(`/api/metacognition/predictions/${predictionId}/resolve`, { outcome }),
    assess: (data: { domain: string }) =>
      api.post('/api/metacognition/assess', data),
    introspect: (data: { focus?: string }) =>
      api.post('/api/metacognition/introspect', data),
    strategy: (data: { strategy: string; params?: any }) =>
      api.post('/api/metacognition/strategy', data),
  },

  // Meta-learning
  metalearning: {
    status: () => api.get('/api/metalearning/status'),
    strategies: () => api.get('/api/metalearning/strategies'),
    bestStrategy: () => api.get('/api/metalearning/strategies/best'),
    createStrategy: (data: { name: string; type: string; params?: any }) =>
      api.post('/api/metalearning/strategies', data),
    adaptStrategy: (strategyId: string) =>
      api.post(`/api/metalearning/strategies/${strategyId}/adapt`, {}),
    recordOutcome: (strategyId: string, data: { success: boolean; metrics?: any }) =>
      api.post(`/api/metalearning/strategies/${strategyId}/outcome`, data),
    curriculum: (data: { topic: string }) =>
      api.post('/api/metalearning/curriculum', data),
  },

  // Reasoning chains
  reasoning: {
    create: (data: { premise: string; type?: string }) =>
      api.post('/api/reasoning/chains', data),
    addStep: (chainId: string, data: { content: string; type?: string }) =>
      api.post(`/api/reasoning/chains/${chainId}/steps`, data),
    conclude: (chainId: string) =>
      api.post(`/api/reasoning/chains/${chainId}/conclude`, {}),
    validate: (stepId: string) =>
      api.post(`/api/reasoning/steps/${stepId}/validate`, {}),
    list: () => api.get('/api/reasoning/chains'),
    trace: (chainId: string) => api.get(`/api/reasoning/chains/${chainId}/trace`),
    status: () => api.get('/api/reasoning/status'),
  },

  // Hypothesis testing
  hypothesis: {
    list: () => api.get('/api/hypothesis'),
    get: (hypothesisId: string) => api.get(`/api/hypothesis/${hypothesisId}`),
    create: (data: { statement: string; domain?: string; evidence?: string[] }) =>
      api.post('/api/hypothesis', data),
    evaluate: (hypothesisId: string) =>
      api.post(`/api/hypothesis/${hypothesisId}/evaluate`, {}),
    addEvidence: (hypothesisId: string, data: { evidence: string; supports: boolean }) =>
      api.post(`/api/hypothesis/${hypothesisId}/evidence`, data),
    experiment: (hypothesisId: string, data: { design?: string }) =>
      api.post(`/api/hypothesis/${hypothesisId}/experiment`, data),
    status: () => api.get('/api/hypothesis/status'),
  },

  // Inference engine
  inference: {
    status: () => api.get('/api/inference/status'),
    facts: (data: { facts: string[] }) =>
      api.post('/api/inference/facts', data),
    rules: (data: { rules: any[] }) =>
      api.post('/api/inference/rules', data),
    query: (data: { query: string }) =>
      api.post('/api/inference/query', data),
    syllogism: (data: { major: string; minor: string }) =>
      api.post('/api/inference/syllogism', data),
    forwardChain: (data: { facts?: string[] }) =>
      api.post('/api/inference/forward-chain', data),
  },

  // Agent system
  agents: {
    list: () => api.get('/api/agents'),
    get: (id: string) => api.get(`/api/agents/${id}`),
    create: (data: { name: string; type?: string; config?: any }) =>
      api.post('/api/agents', data),
    enable: (id: string) => api.post(`/api/agents/${id}/enable`, {}),
    tick: (id: string) => api.post(`/api/agents/${id}/tick`, {}),
  },

  // Transfer learning
  transfer: {
    history: () => api.get('/api/transfer/history'),
    analogies: (data: { source: string; target?: string }) =>
      api.post('/api/transfer/analogies', data),
    apply: (data: { patternId: string; targetDomain: string }) =>
      api.post('/api/transfer/apply', data),
    classifyDomain: (data: { content: string }) =>
      api.post('/api/transfer/classify-domain', data),
    extractPattern: (data: { dtuId: string }) =>
      api.post('/api/transfer/extract-pattern', data),
  },

  // Spaced repetition (SRS)
  srs: {
    due: () => api.get('/api/srs/due'),
    add: (dtuId: string) => api.post(`/api/srs/${dtuId}/add`, {}),
    review: (dtuId: string, data: { quality: number }) =>
      api.post(`/api/srs/${dtuId}/review`, data),
  },

  // Commonsense knowledge
  commonsense: {
    facts: () => api.get('/api/commonsense/facts'),
    addFact: (data: { subject: string; relation: string; object: string }) =>
      api.post('/api/commonsense/facts', data),
    query: (data: { query: string }) =>
      api.post('/api/commonsense/query', data),
    surface: (dtuId: string) =>
      api.post(`/api/commonsense/surface/${dtuId}`, {}),
    assumptions: (dtuId: string) =>
      api.get(`/api/commonsense/assumptions/${dtuId}`),
    status: () => api.get('/api/commonsense/status'),
  },

  // Explanation generation
  explanation: {
    recent: () => api.get('/api/explanation/recent'),
    status: () => api.get('/api/explanation/status'),
    generate: (data: { topic: string; depth?: string }) =>
      api.post('/api/explanation', data),
    forDtu: (dtuId: string) =>
      api.post(`/api/explanation/dtu/${dtuId}`, {}),
  },

  // Voice & multimodal
  voice: {
    transcribe: (data: FormData) =>
      api.post('/api/voice/transcribe', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    ingest: (data: FormData) =>
      api.post('/api/voice/ingest', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    tts: (data: { text: string; voice?: string }) =>
      api.post('/api/voice/tts', data, { responseType: 'blob' }),
  },

  // Daily notes & reminders
  daily: {
    get: () => api.get('/api/daily'),
    list: () => api.get('/api/daily/list'),
    digest: () => api.post('/api/digest', {}),
    getDigest: () => api.get('/api/digest'),
    createReminder: (data: { title: string; dueAt: string; dtuId?: string }) =>
      api.post('/api/reminders', data),
    dueReminders: () => api.get('/api/reminders/due'),
    completeReminder: (id: string) =>
      api.post(`/api/reminders/${id}/complete`, {}),
  },

  // Temporal reasoning
  temporal: {
    validate: (data: { claims: any[] }) =>
      api.post('/api/temporal/validate', data),
    recency: (data: { dtuIds: string[] }) =>
      api.post('/api/temporal/recency', data),
    frame: (data: { name: string; start: string; end: string }) =>
      api.post('/api/temporal/frame', data),
    frames: () => api.get('/api/temporal/frames'),
    sim: (data: { scenario: string; timespan?: string }) =>
      api.post('/api/temporal/sim', data),
  },

  // Grounding (embodied cognition)
  grounding: {
    sensors: () => api.get('/api/grounding/sensors'),
    readings: () => api.get('/api/grounding/readings'),
    addReading: (data: { sensorId: string; value: number; unit: string }) =>
      api.post('/api/grounding/readings', data),
    context: () => api.get('/api/grounding/context'),
    status: () => api.get('/api/grounding/status'),
    ground: (dtuId: string) =>
      api.post(`/api/grounding/ground/${dtuId}`, {}),
    actions: { pending: () => api.get('/api/grounding/actions/pending') },
  },

  // World model (expanded - existing simulations covers basic)
  worldmodel: {
    status: () => api.get('/api/worldmodel/status'),
    entities: () => api.get('/api/worldmodel/entities'),
    createEntity: (data: { name: string; type: string; properties?: any }) =>
      api.post('/api/worldmodel/entities', data),
    getEntity: (entityId: string) => api.get(`/api/worldmodel/entities/${entityId}`),
    updateEntity: (entityId: string, data: any) =>
      api.put(`/api/worldmodel/entities/${entityId}`, data),
    relations: () => api.get('/api/worldmodel/relations'),
    createRelation: (data: { from: string; to: string; type: string }) =>
      api.post('/api/worldmodel/relations', data),
    counterfactual: (data: { scenario: string; changes: any }) =>
      api.post('/api/worldmodel/counterfactual', data),
  },

  // Sovereignty (expanded)
  sovereignty: {
    status: () => api.get('/api/sovereignty/status'),
    audit: () => api.post('/api/sovereignty/audit', {}),
  },

  // Experience Learning
  experience: {
    status: () => api.get('/api/experience/status'),
    retrieve: (data: { domain?: string; topic?: string; keywords?: string[] }) =>
      api.post('/api/experience/retrieve', data),
    patterns: () => api.get('/api/experience/patterns'),
    consolidate: () => api.post('/api/experience/consolidate', {}),
    strategies: () => api.get('/api/experience/strategies'),
    recent: (limit?: number) => api.get('/api/experience/recent', { params: { limit } }),
  },

  // Attention Management
  attention: {
    status: () => api.get('/api/attention/status'),
    createThread: (data: { type?: string; priority?: number; description?: string; domain?: string }) =>
      api.post('/api/attention/thread', data),
    completeThread: (data: { threadId: string; output?: any }) =>
      api.post('/api/attention/thread/complete', data),
    threads: () => api.get('/api/attention/threads'),
    queue: () => api.get('/api/attention/queue'),
    addBackground: (data: { type?: string; handler?: string; priority?: number }) =>
      api.post('/api/attention/background', data),
  },

  // Reflection Engine
  reflection: {
    status: () => api.get('/api/reflection/status'),
    recent: (limit?: number) => api.get('/api/reflection/recent', { params: { limit } }),
    selfModel: () => api.get('/api/reflection/self-model'),
    insights: () => api.get('/api/reflection/insights'),
    reflect: (data: { prompt: string; response: string; mode?: string; domain?: string }) =>
      api.post('/api/reflection/reflect', data),
  },

  // Auth - uses httpOnly cookies (token also returned for non-browser clients)
  auth: {
    login: (data: { username?: string; email?: string; password: string }) =>
      api.post('/api/auth/login', data),

    register: (data: { username: string; email: string; password: string }) =>
      api.post('/api/auth/register', data),

    logout: () => api.post('/api/auth/logout', {}),

    me: () => api.get('/api/auth/me'),

    // Get CSRF token (called automatically on page load)
    csrfToken: () => api.get('/api/auth/csrf-token'),

    // API key management (for programmatic access)
    apiKeys: {
      list: () => api.get('/api/auth/api-keys'),
      create: (data: { name: string; scopes: string[] }) =>
        api.post('/api/auth/api-keys', data),
      delete: (id: string) => api.delete(`/api/auth/api-keys/${id}`),
    },

    // Audit log (admin only)
    auditLog: (params?: { limit?: number; offset?: number; category?: string; action?: string }) =>
      api.get('/api/auth/audit-log', { params }),
  },
};

// Initialize CSRF token on page load (browser only)
if (typeof window !== 'undefined') {
  // Fetch CSRF token when the module loads
  api.get('/api/auth/csrf-token').catch(() => {
    // Silent fail - token will be fetched on first state-changing request
  });
}

export default api;
