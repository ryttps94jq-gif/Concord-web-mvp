import axios, { AxiosInstance, AxiosError } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

// Create axios instance with defaults
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for API key
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const apiKey = localStorage.getItem('concord_api_key');
      if (apiKey) {
        config.headers['X-API-Key'] = apiKey;
      }
      const sessionId = localStorage.getItem('concord_session_id');
      if (sessionId) {
        config.headers['X-Session-ID'] = sessionId;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      if (status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('concord_api_key');
        window.location.href = '/login';
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
  },

  // Forge (manual DTU creation)
  forge: {
    create: (data: { title?: string; content: string; tags?: string[]; source?: string }) =>
      api.post('/api/forge', data),
  },

  // Simulations
  simulations: {
    list: () => api.get('/api/simulations'),

    whatIf: (data: { title?: string; prompt?: string; assumptions?: string[] }) =>
      api.post('/api/simulations/whatif', data),
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
    debate: (data: {
      dtuA?: string | { id: string; content?: string };
      dtuB?: string | { id: string; content?: string };
      topic?: string;
    }) => api.post('/api/council/debate', data),
  },

  // Swarm
  swarm: {
    run: (prompt: string, count: number = 6) =>
      api.post('/api/swarm/run', { prompt, count }),
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
};

export default api;
