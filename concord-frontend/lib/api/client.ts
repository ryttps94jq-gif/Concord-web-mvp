import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    // Get API key from localStorage (client-side only)
    if (typeof window !== 'undefined') {
      const apiKey = localStorage.getItem('concord_api_key');
      if (apiKey) {
        config.headers['X-API-Key'] = apiKey;
      }

      // Add session ID if available
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
      // Server responded with error
      const status = error.response.status;

      if (status === 401) {
        // Unauthorized - clear credentials and redirect
        if (typeof window !== 'undefined') {
          localStorage.removeItem('concord_api_key');
          window.location.href = '/login';
        }
      }

      if (status === 429) {
        // Rate limited
        console.warn('Rate limited. Please slow down requests.');
      }

      if (status >= 500) {
        // Server error
        console.error('Server error:', error.response.data);
      }
    } else if (error.request) {
      // No response received
      console.error('Network error - no response received');
    }

    return Promise.reject(error);
  }
);

// Typed API helper functions
export const apiHelpers = {
  // DTU operations
  dtu: {
    list: (params?: { tier?: string; limit?: number; offset?: number }) =>
      api.get('/api/dtu', { params }),

    get: (id: string) => api.get(`/api/dtu/${id}`),

    create: (data: { content: string; tier?: string; parentId?: string }) =>
      api.post('/api/dtu', data),

    update: (id: string, data: Partial<{ content: string; tier: string }>) =>
      api.patch(`/api/dtu/${id}`, data),

    delete: (id: string) => api.delete(`/api/dtu/${id}`),

    promote: (id: string, targetTier: string) =>
      api.post(`/api/dtu/${id}/promote`, { tier: targetTier }),

    lineage: (id: string) => api.get(`/api/dtu/${id}/lineage`),
  },

  // Chat operations
  chat: {
    send: (message: string, options?: { model?: string; context?: string[] }) =>
      api.post('/api/chat', { message, ...options }),

    history: (limit?: number) =>
      api.get('/api/chat/history', { params: { limit } }),
  },

  // Lattice operations
  lattice: {
    status: () => api.get('/api/lattice/status'),

    resonance: () => api.get('/api/lattice/resonance'),

    graph: () => api.get('/api/lattice/graph'),

    fractal: () => api.get('/api/lattice/fractal'),
  },

  // Council operations
  council: {
    proposals: () => api.get('/api/council/proposals'),

    submit: (proposal: { type: string; data: unknown }) =>
      api.post('/api/council/propose', proposal),

    vote: (proposalId: string, vote: 'approve' | 'reject') =>
      api.post(`/api/council/vote/${proposalId}`, { vote }),
  },

  // Market operations
  market: {
    listings: (params?: { category?: string; sort?: string }) =>
      api.get('/api/market/listings', { params }),

    get: (id: string) => api.get(`/api/market/listing/${id}`),

    create: (listing: { title: string; description: string; price: number }) =>
      api.post('/api/market/listing', listing),

    purchase: (id: string) => api.post(`/api/market/purchase/${id}`),
  },

  // Economy operations
  economy: {
    status: () => api.get('/api/economy/status'),

    balance: () => api.get('/api/economy/balance'),

    transactions: (params?: { limit?: number; offset?: number }) =>
      api.get('/api/economy/transactions', { params }),
  },

  // Sovereignty operations
  sovereignty: {
    status: () => api.get('/api/sovereignty/status'),

    invariants: () => api.get('/api/sovereignty/invariants'),

    audit: () => api.post('/api/sovereignty/audit'),
  },
};

export default api;
