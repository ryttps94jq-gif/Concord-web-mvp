import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { updateClockOffset } from '../offline/db';
import { useUIStore } from '@/store/ui';

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

// ---- Idempotency Key Generation (Category 2: Concurrency) ----
function generateIdempotencyKey(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `idem_${timestamp}_${random}`;
}

// Request interceptor for CSRF protection + idempotency
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
        // ---- Idempotency Key (Category 2: Concurrency) ----
        // Auto-generate for state-changing requests that don't already have one
        if (!config.headers['Idempotency-Key']) {
          config.headers['Idempotency-Key'] = generateIdempotencyKey();
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling + clock sync + observability
api.interceptors.response.use(
  (response) => {
    // ---- Clock Normalization (Category 4: Offline Sync) ----
    const serverDate = response.headers['date'];
    if (serverDate) {
      updateClockOffset(serverDate);
    }

    // ---- Observability (Category 5) ----
    // Track if server replayed an idempotent response
    if (response.headers['x-idempotent-replayed'] === 'true') {
      console.debug('[API] Idempotent replay detected for:', response.config?.url);
    }

    if (response.config?.url?.includes('/api/status')) {
      const auth = (response.data as { infrastructure?: { auth?: { mode?: string; usesJwt?: boolean; usesApiKey?: boolean } } })?.infrastructure?.auth;
      if (auth) {
        useUIStore.getState().setAuthPosture({
          mode: (auth.mode as 'public' | 'apikey' | 'jwt' | 'hybrid') || 'unknown',
          usesJwt: Boolean(auth.usesJwt),
          usesApiKey: Boolean(auth.usesApiKey),
        });
      }
    }

    return response;
  },
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
      // ---- Version Conflict Detection (Category 2: Concurrency) ----
      if (status === 409) {
        const data = error.response.data as { code?: string; currentVersion?: number };
        if (data?.code === 'VERSION_CONFLICT') {
          console.warn('[API] Version conflict detected. Current server version:', data.currentVersion);
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

    if (typeof window !== 'undefined') {
      const data = error.response?.data as { error?: string; reason?: string; code?: string } | undefined;
      const requestId = (error.response?.headers?.['x-request-id'] as string | undefined) ||
        (error.response?.headers?.['X-Request-ID'] as string | undefined);
      const reason = data?.reason || data?.error || (error.response?.status === 401 ? 'Login required' : error.message);
      useUIStore.getState().addRequestError({
        path: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        status: error.response?.status,
        code: data?.code,
        requestId,
        message: data?.error || error.message,
        reason,
      });

      if (error.response?.status === 401 && data?.code === 'AUTH_REQUIRED' && reason.toLowerCase().includes('api key')) {
        useUIStore.getState().addToast({ type: 'warning', message: 'API key missing. Add x-api-key or switch AUTH_MODE.' });
      }
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
    create: (data: { name: string; kind: string; fields: unknown[] }) =>
      api.post('/api/schema', data),
    validate: (data: { schemaName: string; data: unknown }) =>
      api.post('/api/schema/validate', data),
    apply: (data: { schemaName: string; dtuId: string; data: unknown }) =>
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

  // Whiteboard
  whiteboard: {
    list: () => api.get('/api/whiteboards'),
    get: (id: string) => api.get(`/api/whiteboard/${id}`),
    create: (data: { title: string; linkedDtus?: string[] }) =>
      api.post('/api/whiteboard', data),
    update: (id: string, data: { elements?: unknown[]; linkedDtus?: string[] }) =>
      api.put(`/api/whiteboard/${id}`, data),
  },

  // Automations
  automations: {
    list: () => api.get('/api/automations'),
    create: (data: { name: string; trigger: unknown; actions: unknown[] }) =>
      api.post('/api/automations', data),
    run: (id: string, triggerData?: unknown) =>
      api.post(`/api/automations/${id}/run`, triggerData || {}),
    delete: (id: string) => api.delete(`/api/automations/${id}`),
  },

  // Integrations
  integrations: {
    list: () => api.get('/api/integrations'),
    obsidianExport: (data: { dtuIds?: string[]; includeLineage?: boolean }) =>
      api.post('/api/obsidian/export', data),
    obsidianImport: (files: unknown[]) => api.post('/api/obsidian/import', { files }),
    notionImport: (pages: unknown[]) => api.post('/api/notion/import', { pages }),
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
    emit: (sessionId: string, event: { type: string; intensity: number; polarity: number; payload?: unknown }) =>
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
    strategy: (data: { strategy: string; params?: Record<string, unknown> }) =>
      api.post('/api/metacognition/strategy', data),
  },

  // Meta-learning
  metalearning: {
    status: () => api.get('/api/metalearning/status'),
    strategies: () => api.get('/api/metalearning/strategies'),
    bestStrategy: () => api.get('/api/metalearning/strategies/best'),
    createStrategy: (data: { name: string; type: string; params?: Record<string, unknown> }) =>
      api.post('/api/metalearning/strategies', data),
    adaptStrategy: (strategyId: string) =>
      api.post(`/api/metalearning/strategies/${strategyId}/adapt`, {}),
    recordOutcome: (strategyId: string, data: { success: boolean; metrics?: Record<string, unknown> }) =>
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
    rules: (data: { rules: unknown[] }) =>
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
    create: (data: { name: string; type?: string; config?: Record<string, unknown> }) =>
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
    validate: (data: { claims: unknown[] }) =>
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
    createEntity: (data: { name: string; type: string; properties?: Record<string, unknown> }) =>
      api.post('/api/worldmodel/entities', data),
    getEntity: (entityId: string) => api.get(`/api/worldmodel/entities/${entityId}`),
    updateEntity: (entityId: string, data: Record<string, unknown>) =>
      api.put(`/api/worldmodel/entities/${entityId}`, data),
    relations: () => api.get('/api/worldmodel/relations'),
    createRelation: (data: { from: string; to: string; type: string }) =>
      api.post('/api/worldmodel/relations', data),
    counterfactual: (data: { scenario: string; changes: Record<string, unknown> }) =>
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
    completeThread: (data: { threadId: string; output?: unknown }) =>
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

  // =============================================
  // ARTISTRY GLOBAL: Music Production & Art Platform
  // =============================================

  artistry: {
    // Assets (Phase 1)
    assets: {
      list: (params?: { type?: string; genre?: string; search?: string; ownerId?: string; sort?: string; limit?: number; offset?: number }) =>
        api.get('/api/artistry/assets', { params }),
      get: (id: string) => api.get(`/api/artistry/assets/${id}`),
      create: (data: { type: string; title?: string; description?: string; tags?: string[]; genre?: string; bpm?: number; key?: string; ownerId?: string; metadata?: Record<string, unknown> }) =>
        api.post('/api/artistry/assets', data),
      update: (id: string, data: Record<string, unknown>) =>
        api.patch(`/api/artistry/assets/${id}`, data),
      delete: (id: string) => api.delete(`/api/artistry/assets/${id}`),
    },

    blobs: {
      upload: (data: { data: string; mimeType?: string; filename?: string }) =>
        api.post('/api/artistry/blobs', data),
      get: (id: string) => api.get(`/api/artistry/blobs/${id}`),
    },

    genres: () => api.get('/api/artistry/genres'),
    assetTypes: () => api.get('/api/artistry/asset-types'),
    stats: () => api.get('/api/artistry/stats'),

    // Studio / DAW (Phase 2-6)
    studio: {
      projects: {
        list: (params?: { ownerId?: string }) =>
          api.get('/api/artistry/studio/projects', { params }),
        get: (id: string) => api.get(`/api/artistry/studio/projects/${id}`),
        create: (data: { title?: string; bpm?: number; key?: string; scale?: string; genre?: string; ownerId?: string }) =>
          api.post('/api/artistry/studio/projects', data),
        update: (id: string, data: Record<string, unknown>) =>
          api.patch(`/api/artistry/studio/projects/${id}`, data),
      },
      tracks: {
        add: (projectId: string, data: { name?: string; type?: string; instrumentId?: string; color?: string }) =>
          api.post(`/api/artistry/studio/projects/${projectId}/tracks`, data),
        update: (projectId: string, trackId: string, data: Record<string, unknown>) =>
          api.patch(`/api/artistry/studio/projects/${projectId}/tracks/${trackId}`, data),
        delete: (projectId: string, trackId: string) =>
          api.delete(`/api/artistry/studio/projects/${projectId}/tracks/${trackId}`),
        addEffect: (projectId: string, trackId: string, data: { effectId: string; params?: Record<string, unknown> }) =>
          api.post(`/api/artistry/studio/projects/${projectId}/tracks/${trackId}/effects`, data),
        addClip: (projectId: string, trackId: string, data: { name?: string; startBar?: number; lengthBars?: number; assetId?: string; midiNotes?: unknown[] }) =>
          api.post(`/api/artistry/studio/projects/${projectId}/tracks/${trackId}/clips`, data),
      },
      instruments: () => api.get('/api/artistry/studio/instruments'),
      effects: () => api.get('/api/artistry/studio/effects'),
      vocal: {
        analyze: (data: { projectId: string; trackId: string }) =>
          api.post('/api/artistry/studio/vocal/analyze', data),
        process: (data: { projectId: string; trackId: string; corrections?: string[] }) =>
          api.post('/api/artistry/studio/vocal/process', data),
      },
      master: (data: { projectId: string; preset?: string; targetLufs?: number; format?: string }) =>
        api.post('/api/artistry/studio/master', data),
    },

    // Distribution (Phase 7)
    distribution: {
      releases: {
        list: (params?: { ownerId?: string; genre?: string; search?: string; sort?: string }) =>
          api.get('/api/artistry/distribution/releases', { params }),
        get: (id: string) => api.get(`/api/artistry/distribution/releases/${id}`),
        create: (data: { title?: string; artistName?: string; trackIds?: string[]; genre?: string; ownerId?: string }) =>
          api.post('/api/artistry/distribution/releases', data),
      },
      stream: (data: { assetId: string; userId?: string; duration?: number }) =>
        api.post('/api/artistry/distribution/stream', data),
      streams: (assetId: string) => api.get(`/api/artistry/distribution/streams/${assetId}`),
      follow: (data: { followerId: string; followedId: string }) =>
        api.post('/api/artistry/distribution/follow', data),
      unfollow: (data: { followerId: string; followedId: string }) =>
        api.post('/api/artistry/distribution/unfollow', data),
      followers: (userId: string) => api.get(`/api/artistry/distribution/followers/${userId}`),
      following: (userId: string) => api.get(`/api/artistry/distribution/following/${userId}`),
      feed: (userId: string) => api.get(`/api/artistry/distribution/feed/${userId}`),
      embeds: {
        create: (data: { assetId?: string; releaseId?: string; style?: string }) =>
          api.post('/api/artistry/distribution/embeds', data),
        get: (id: string) => api.get(`/api/artistry/distribution/embeds/${id}`),
      },
    },

    // Marketplace (Phase 8)
    marketplace: {
      beats: {
        list: (params?: { genre?: string; bpmMin?: number; bpmMax?: number; key?: string; search?: string; sort?: string }) =>
          api.get('/api/artistry/marketplace/beats', { params }),
        create: (data: { title?: string; assetId?: string; bpm?: number; key?: string; genre?: string; tags?: string[]; licenses?: string[]; ownerId?: string }) =>
          api.post('/api/artistry/marketplace/beats', data),
      },
      stems: {
        list: () => api.get('/api/artistry/marketplace/stems'),
        create: (data: { title?: string; assetIds?: string[]; genre?: string; price?: number; ownerId?: string }) =>
          api.post('/api/artistry/marketplace/stems', data),
      },
      samples: {
        list: () => api.get('/api/artistry/marketplace/samples'),
        create: (data: { title?: string; assetIds?: string[]; sampleCount?: number; genre?: string; price?: number; ownerId?: string }) =>
          api.post('/api/artistry/marketplace/samples', data),
      },
      art: {
        list: () => api.get('/api/artistry/marketplace/art'),
        create: (data: { title?: string; assetId?: string; artType?: string; style?: string; price?: number; ownerId?: string }) =>
          api.post('/api/artistry/marketplace/art', data),
      },
      splits: {
        create: (data: { assetId?: string; releaseId?: string; participants: { userId: string; name?: string; role?: string; percentage: number }[] }) =>
          api.post('/api/artistry/marketplace/splits', data),
        get: (id: string) => api.get(`/api/artistry/marketplace/splits/${id}`),
      },
      licenses: () => api.get('/api/artistry/marketplace/licenses'),
      purchase: (data: { buyerId: string; listingId: string; listingType?: string; licenseType?: string }) =>
        api.post('/api/artistry/marketplace/purchase', data),
    },

    // Collaboration (Phase 9)
    collab: {
      sessions: {
        list: (params?: { userId?: string }) =>
          api.get('/api/artistry/collab/sessions', { params }),
        create: (data: { projectId: string; hostId?: string; maxParticipants?: number; mode?: string }) =>
          api.post('/api/artistry/collab/sessions', data),
        join: (sessionId: string, data: { userId: string }) =>
          api.post(`/api/artistry/collab/sessions/${sessionId}/join`, data),
        leave: (sessionId: string, data: { userId: string }) =>
          api.post(`/api/artistry/collab/sessions/${sessionId}/leave`, data),
        action: (sessionId: string, data: { userId: string; action: string; data?: unknown }) =>
          api.post(`/api/artistry/collab/sessions/${sessionId}/action`, data),
        chat: (sessionId: string, data: { userId: string; message: string }) =>
          api.post(`/api/artistry/collab/sessions/${sessionId}/chat`, data),
      },
      remix: {
        list: (params?: { originalAssetId?: string; remixerId?: string }) =>
          api.get('/api/artistry/collab/remixes', { params }),
        create: (data: { originalAssetId?: string; remixerId?: string; title?: string; genre?: string }) =>
          api.post('/api/artistry/collab/remix', data),
      },
      share: {
        list: (params?: { userId?: string }) =>
          api.get('/api/artistry/collab/shared', { params }),
        create: (data: { projectId: string; ownerId?: string; sharedWithIds?: string[]; permissions?: Record<string, boolean> }) =>
          api.post('/api/artistry/collab/share', data),
      },
    },

    // AI Production Assistant (Phase 10)
    ai: {
      analyzeProject: (data: { projectId: string }) =>
        api.post('/api/artistry/ai/analyze-project', data),
      suggestChords: (data: { key?: string; scale?: string; genre?: string; currentChords?: string[] }) =>
        api.post('/api/artistry/ai/suggest-chords', data),
      suggestMelody: (data: { key?: string; scale?: string; bpm?: number; bars?: number; style?: string }) =>
        api.post('/api/artistry/ai/suggest-melody', data),
      suggestDrums: (data: { bpm?: number; genre?: string; bars?: number; swing?: number }) =>
        api.post('/api/artistry/ai/suggest-drums', data),
      genreCoach: (data: { userId?: string; genre: string }) =>
        api.post('/api/artistry/ai/genre-coach', data),
      learning: {
        start: (data: { userId?: string; topic?: string; level?: string }) =>
          api.post('/api/artistry/ai/learning/start', data),
        completeLesson: (data: { pathId: string; moduleId: string; lesson: string }) =>
          api.post('/api/artistry/ai/learning/complete-lesson', data),
        get: (pathId: string) => api.get(`/api/artistry/ai/learning/${pathId}`),
      },
      session: (data: { userId?: string; projectId?: string; question?: string }) =>
        api.post('/api/artistry/ai/session', data),
    },
  },

  // ---- Generic Lens Artifact API ----
  lens: {
    list: (domain: string, params?: { type?: string; search?: string; tags?: string; status?: string; limit?: number; offset?: number }) =>
      api.get(`/api/lens/${domain}`, { params }),
    get: (domain: string, id: string) =>
      api.get(`/api/lens/${domain}/${id}`),
    create: (domain: string, data: { type: string; title?: string; data?: Record<string, unknown>; meta?: Record<string, unknown> }) =>
      api.post(`/api/lens/${domain}`, data),
    update: (domain: string, id: string, data: { title?: string; data?: Record<string, unknown>; meta?: Record<string, unknown> }) =>
      api.put(`/api/lens/${domain}/${id}`, data),
    delete: (domain: string, id: string) =>
      api.delete(`/api/lens/${domain}/${id}`),
    run: (domain: string, id: string, data: { action: string; params?: Record<string, unknown> }) =>
      api.post(`/api/lens/${domain}/${id}/run`, data),
    export: (domain: string, id: string, format?: string) =>
      api.get(`/api/lens/${domain}/${id}/export`, { params: { format: format || 'json' } }),
    bulkCreate: (domain: string, data: { type: string; items: Array<{ title?: string; data?: Record<string, unknown>; meta?: Record<string, unknown> }> }) =>
      api.post(`/api/lens/${domain}/bulk`, data),
  },

  // ---- Autogen Pipeline (v5.3.0+) ----
  pipeline: {
    run: (data?: { variant?: string; seed?: string; dryRun?: boolean }) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'pipeline.run', input: data }),
    metrics: () =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'pipeline.metrics', input: {} }),
    selectIntent: (data?: { variant?: string }) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'pipeline.selectIntent', input: data }),
    dream: (seed?: string) => api.post('/api/dream', { seed }),
    autogen: () => api.post('/api/autogen', {}),
    evolution: (data?: { threshold?: number; minCluster?: number }) =>
      api.post('/api/evolution', data),
    synthesize: (data?: { megaIds?: string[] }) =>
      api.post('/api/synthesize', data),
  },

  // ---- Empirical Gates (v5.4.0+) ----
  empirical: {
    info: () =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'empirical.info', input: {} }),
    math: (expression: string) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'empirical.math', input: { expression } }),
    parseUnits: (expr: string) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'empirical.parseUnits', input: { expr } }),
    convertUnits: (data: { value: number; from: string; to: string }) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'empirical.convertUnits', input: data }),
    checkUnits: (data: { lhs: string; rhs: string }) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'empirical.checkUnits', input: data }),
    constants: () =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'empirical.constants', input: {} }),
    scanText: (text: string | string[]) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'empirical.scanText', input: { text } }),
  },

  // ---- Capability Bridge (v5.5.0+) ----
  bridge: {
    info: () =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'bridge.info', input: {} }),
    beacon: () =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'bridge.beacon', input: {} }),
    dedupGate: (candidate: { title: string; tags?: string[]; claims?: string[] }) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'bridge.dedupGate', input: { candidate } }),
    dedupScan: (data?: { threshold?: number; windowSize?: number }) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'bridge.dedupScan', input: data }),
    lensScope: (artifact: Record<string, unknown>, operation: string) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'bridge.lensScope', input: { artifact, operation } }),
    lensValidate: (artifact: Record<string, unknown>) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'bridge.lensValidate', input: { artifact } }),
    strategyHints: (domain?: string) =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'bridge.strategyHints', input: { domain } }),
    heartbeatTick: () =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'bridge.heartbeatTick', input: {} }),
  },

  // ---- Scope Operations (v5.2.0+) ----
  scope: {
    metrics: () => api.get('/api/scope/metrics'),
    dtus: (scope: string) => api.get(`/api/scope/dtus/${scope}`),
    promote: (data: { dtuId: string; targetScope: string; reason?: string }) =>
      api.post('/api/scope/promote', data),
    validateGlobal: (data: { dtuId: string }) =>
      api.post('/api/scope/validate-global', data),
    overrides: () => api.get('/api/scope/overrides'),
  },

  // ---- Emergent Schema & System ----
  emergent: {
    schema: () =>
      api.post('/api/macros/run', { domain: 'emergent', name: 'schema', input: {} }),
    status: () => api.get('/api/emergent/status'),
    latticeBeacon: () => api.get('/api/lattice/beacon'),
    resonance: () => api.get('/api/lattice/resonance'),
  },

  // ═══════════════════════════════════════════════════════════════════
  // ATLAS GLOBAL + PLATFORM v2
  // ═══════════════════════════════════════════════════════════════════

  atlas: {
    createDtu: (data: Record<string, unknown>) => api.post('/api/atlas/dtu', data),
    getDtu: (id: string) => api.get(`/api/atlas/dtu/${id}`),
    promoteDtu: (id: string, targetStatus: string, actor?: string) =>
      api.post(`/api/atlas/dtu/${id}/promote`, { targetStatus, actor }),
    addLink: (id: string, data: Record<string, unknown>) =>
      api.post(`/api/atlas/dtu/${id}/link`, data),
    search: (params: Record<string, unknown>) => api.get('/api/atlas/search', { params }),
    getEntity: (id: string) => api.get(`/api/atlas/entity/${id}`),
    registerEntity: (data: Record<string, unknown>) => api.post('/api/atlas/entity', data),
    getContradictions: (id: string) => api.get(`/api/atlas/contradictions/${id}`),
    explainScore: (id: string) => api.get(`/api/atlas/score-explain/${id}`),
    recomputeScores: (id: string) => api.post(`/api/atlas/dtu/${id}/recompute-scores`),
    metrics: () => api.get('/api/atlas/metrics'),
    domains: () => api.get('/api/atlas/domains'),
    // Anti-gaming
    antiGamingScan: (id: string) => api.get(`/api/atlas/antigaming/scan/${id}`),
    antiGamingMetrics: () => api.get('/api/atlas/antigaming/metrics'),
    // Autogen v2
    autogenRun: (data: Record<string, unknown>) => api.post('/api/atlas/autogen/run', data),
    autogenGetRun: (runId: string) => api.get(`/api/atlas/autogen/run/${runId}`),
    autogenAccept: (dtuId: string) => api.post(`/api/atlas/autogen/accept/${dtuId}`),
    autogenMerge: (dtuId: string, targetDtuId: string) =>
      api.post(`/api/atlas/autogen/merge/${dtuId}`, { targetDtuId }),
    autogenPropagate: (dtuId: string, maxHops?: number) =>
      api.post(`/api/atlas/autogen/propagate/${dtuId}`, { maxHops }),
    autogenMetrics: () => api.get('/api/atlas/autogen/metrics'),
    // Council
    councilResolve: (data: Record<string, unknown>) => api.post('/api/atlas/council/resolve', data),
    councilQueue: (params?: Record<string, unknown>) => api.get('/api/atlas/council/queue', { params }),
    councilRequestSources: (data: Record<string, unknown>) =>
      api.post('/api/atlas/council/request-sources', data),
    councilMerge: (data: Record<string, unknown>) => api.post('/api/atlas/council/merge', data),
    councilActions: (params?: Record<string, unknown>) => api.get('/api/atlas/council/actions', { params }),
    councilMetrics: () => api.get('/api/atlas/council/metrics'),
    // Chat Loose Mode
    chatRetrieve: (query: string, opts?: { limit?: number; policy?: string; minConfidence?: number }) =>
      api.post('/api/atlas/chat/retrieve', { query, ...opts }),
    chatSave: (content: Record<string, unknown>, ctx?: { actor?: string; sessionId?: string }) =>
      api.post('/api/atlas/chat/save', { content, ctx }),
    chatPublish: (content: Record<string, unknown>, ctx?: { actor?: string; sessionId?: string }) =>
      api.post('/api/atlas/chat/publish', { content, ctx }),
    chatList: (content: Record<string, unknown>, opts?: Record<string, unknown>, ctx?: Record<string, unknown>) =>
      api.post('/api/atlas/chat/list', { content, opts, ctx }),
    chatExchange: (sessionId: string, exchange: { query: string; contextCount?: number; hasGlobalRefs?: boolean; hasLocalRefs?: boolean }) =>
      api.post('/api/atlas/chat/exchange', { sessionId, exchange }),
    chatSession: (sessionId: string) => api.get(`/api/atlas/chat/session/${sessionId}`),
    chatMetrics: () => api.get('/api/atlas/chat/metrics'),
    // Rights & Citations
    rightsCheck: (userId: string, artifactId: string, action: string) =>
      api.post('/api/atlas/rights/check', { userId, artifactId, action }),
    rightsCitation: (artifactId: string) => api.get(`/api/atlas/rights/citation/${artifactId}`),
    rightsOrigin: (artifactId: string) => api.get(`/api/atlas/rights/origin/${artifactId}`),
    rightsVerify: (artifactId: string) => api.get(`/api/atlas/rights/verify/${artifactId}`),
    rightsTransfer: (artifactId: string, fromUserId: string, toUserId: string, action: string) =>
      api.post('/api/atlas/rights/transfer', { artifactId, fromUserId, toUserId, action }),
    rightsHash: (artifactId: string) => api.get(`/api/atlas/rights/hash/${artifactId}`),
    rightsMetrics: () => api.get('/api/atlas/rights/metrics'),
  },

  social: {
    upsertProfile: (data: Record<string, unknown>) => api.post('/api/social/profile', data),
    getProfile: (userId: string) => api.get(`/api/social/profile/${userId}`),
    listProfiles: (params?: Record<string, unknown>) => api.get('/api/social/profiles', { params }),
    follow: (followedId: string) => api.post('/api/social/follow', { followedId }),
    unfollow: (followedId: string) => api.post('/api/social/unfollow', { followedId }),
    getFollowers: (userId: string) => api.get(`/api/social/followers/${userId}`),
    getFollowing: (userId: string) => api.get(`/api/social/following/${userId}`),
    getFeed: (params?: Record<string, unknown>) => api.get('/api/social/feed', { params }),
    getTrending: (limit?: number) => api.get('/api/social/trending', { params: { limit } }),
    discover: (userId: string) => api.get(`/api/social/discover/${userId}`),
    publishDtu: (dtuId: string) => api.post(`/api/social/publish/${dtuId}`),
    unpublishDtu: (dtuId: string) => api.post(`/api/social/unpublish/${dtuId}`),
    cite: (citedDtuId: string, citingDtuId: string) =>
      api.post('/api/social/cite', { citedDtuId, citingDtuId }),
    getCitedBy: (dtuId: string) => api.get(`/api/social/cited-by/${dtuId}`),
    metrics: () => api.get('/api/social/metrics'),
  },

  collab: {
    createWorkspace: (data: Record<string, unknown>) => api.post('/api/collab/workspace', data),
    getWorkspace: (id: string) => api.get(`/api/collab/workspace/${id}`),
    listWorkspaces: () => api.get('/api/collab/workspaces'),
    addMember: (workspaceId: string, userId: string, role?: string) =>
      api.post(`/api/collab/workspace/${workspaceId}/member`, { userId, role }),
    removeMember: (workspaceId: string, userId: string) =>
      api.delete(`/api/collab/workspace/${workspaceId}/member/${userId}`),
    addDtu: (workspaceId: string, dtuId: string) =>
      api.post(`/api/collab/workspace/${workspaceId}/dtu`, { dtuId }),
    addComment: (dtuId: string, text: string, parentCommentId?: string) =>
      api.post('/api/collab/comment', { dtuId, text, parentCommentId }),
    getComments: (dtuId: string, tree?: boolean) =>
      api.get(`/api/collab/comments/${dtuId}`, { params: { tree } }),
    editComment: (id: string, text: string) => api.put(`/api/collab/comment/${id}`, { text }),
    resolveComment: (id: string) => api.post(`/api/collab/comment/${id}/resolve`),
    proposeRevision: (dtuId: string, changes: Record<string, unknown>, reason?: string) =>
      api.post('/api/collab/revision', { dtuId, changes, reason }),
    getRevisions: (dtuId: string) => api.get(`/api/collab/revisions/${dtuId}`),
    voteRevision: (id: string, vote: 'approve' | 'reject') =>
      api.post(`/api/collab/revision/${id}/vote`, { vote }),
    applyRevision: (id: string) => api.post(`/api/collab/revision/${id}/apply`),
    startEditSession: (dtuId: string) => api.post(`/api/collab/edit-session/${dtuId}/start`),
    recordEdit: (dtuId: string, field: string, oldValue: unknown, newValue: unknown) =>
      api.post(`/api/collab/edit-session/${dtuId}/edit`, { field, oldValue, newValue }),
    endEditSession: (dtuId: string) => api.post(`/api/collab/edit-session/${dtuId}/end`),
    metrics: () => api.get('/api/collab/metrics'),
  },

  rbac: {
    createOrg: (data: Record<string, unknown>) => api.post('/api/rbac/org', data),
    getOrg: (orgId: string) => api.get(`/api/rbac/org/${orgId}`),
    assignRole: (orgId: string, userId: string, role: string) =>
      api.post('/api/rbac/role', { orgId, userId, role }),
    revokeRole: (orgId: string, userId: string) =>
      api.delete('/api/rbac/role', { data: { orgId, userId } }),
    getRole: (orgId: string, userId: string) => api.get(`/api/rbac/role/${orgId}/${userId}`),
    getMembers: (orgId: string) => api.get(`/api/rbac/members/${orgId}`),
    getPermissions: (orgId: string, userId: string) =>
      api.get(`/api/rbac/permissions/${orgId}/${userId}`),
    checkPermission: (orgId: string, userId: string, permission: string) =>
      api.post('/api/rbac/check-permission', { orgId, userId, permission }),
    assignOrgLens: (orgId: string, lensId: string) =>
      api.post('/api/rbac/org-lens', { orgId, lensId }),
    getOrgLenses: (orgId: string) => api.get(`/api/rbac/org-lenses/${orgId}`),
    exportAudit: (orgId: string, params?: Record<string, unknown>) =>
      api.get(`/api/rbac/audit-export/${orgId}`, { params }),
    metrics: () => api.get('/api/rbac/metrics'),
  },

  analytics: {
    dashboard: () => api.get('/api/analytics/dashboard'),
    personal: (userId: string) => api.get(`/api/analytics/personal/${userId}`),
    growth: (period?: string) => api.get('/api/analytics/growth', { params: { period } }),
    citations: (limit?: number) => api.get('/api/analytics/citations', { params: { limit } }),
    marketplace: () => api.get('/api/analytics/marketplace'),
    density: () => api.get('/api/analytics/density'),
    atlasDomains: () => api.get('/api/analytics/atlas-domains'),
  },

  webhooks: {
    register: (data: Record<string, unknown>) => api.post('/api/webhooks', data),
    list: () => api.get('/api/webhooks'),
    get: (id: string) => api.get(`/api/webhooks/${id}`),
    delete: (id: string) => api.delete(`/api/webhooks/${id}`),
    deactivate: (id: string) => api.post(`/api/webhooks/${id}/deactivate`),
    deliveries: (id: string) => api.get(`/api/webhooks/${id}/deliveries`),
    metrics: () => api.get('/api/webhooks-metrics'),
  },

  compliance: {
    tagRegion: (resourceId: string, region: string) =>
      api.post('/api/compliance/region-tag', { resourceId, region }),
    getRegion: (resourceId: string) => api.get(`/api/compliance/region/${resourceId}`),
    setExportControls: (resourceId: string, controls: Record<string, unknown>) =>
      api.post('/api/compliance/export-controls', { resourceId, ...controls }),
    checkExport: (resourceId: string, format?: string) =>
      api.post('/api/compliance/check-export', { resourceId, format }),
    exportData: (resourceId: string, format?: string) =>
      api.post('/api/compliance/export', { resourceId, format }),
    createPartition: (orgId: string, config?: Record<string, unknown>) =>
      api.post('/api/compliance/partition', { orgId, ...config }),
    getPartition: (orgId: string) => api.get(`/api/compliance/partition/${orgId}`),
    setRetention: (orgId: string, policy: Record<string, unknown>) =>
      api.post('/api/compliance/retention', { orgId, ...policy }),
    getRetention: (orgId: string) => api.get(`/api/compliance/retention/${orgId}`),
    getLog: (params?: Record<string, unknown>) => api.get('/api/compliance/log', { params }),
    status: () => api.get('/api/compliance/status'),
  },

  onboarding: {
    start: () => api.post('/api/onboarding/start'),
    progress: (userId: string) => api.get(`/api/onboarding/progress/${userId}`),
    completeStep: (stepId: string, metadata?: Record<string, unknown>) =>
      api.post('/api/onboarding/complete-step', { stepId, metadata }),
    skip: () => api.post('/api/onboarding/skip'),
    hints: (userId: string) => api.get(`/api/onboarding/hints/${userId}`),
    metrics: () => api.get('/api/onboarding/metrics'),
  },

  efficiency: {
    dashboard: () => api.get('/api/efficiency/dashboard'),
    history: (period?: string) => api.get('/api/efficiency/history', { params: { period } }),
    recordReuse: (operation: string, details?: Record<string, unknown>) =>
      api.post('/api/efficiency/record-reuse', { operation, details }),
    recordLlmCall: (operation: string, details?: Record<string, unknown>) =>
      api.post('/api/efficiency/record-llm-call', { operation, details }),
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
