/**
 * FE-005: API endpoint inventory for drift detection.
 *
 * This file provides a verifiable mapping of every API endpoint the frontend
 * calls. Run `validateEndpoints()` in development to detect:
 *   - Endpoints used in client code but not listed here (frontend drift)
 *   - Endpoints listed here that no longer appear in the backend OpenAPI spec (backend drift)
 *
 * Keep in sync with `lib/api/client.ts` and the backend OpenAPI spec.
 */

export interface EndpointEntry {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path pattern (e.g. /api/dtus/:id) */
  path: string;
  /** Which frontend module or lens consumes this */
  usedBy: string[];
  /** Corresponding apiHelpers key (e.g. 'dtus.list') */
  helperKey?: string;
}

export const ENDPOINT_INVENTORY: EndpointEntry[] = [
  // ── System ────────────────────────────────────────────────────
  { method: 'GET', path: '/api/status', usedBy: ['dashboard'], helperKey: 'status.get' },
  { method: 'GET', path: '/api/jobs/status', usedBy: ['admin'], helperKey: 'jobs.status' },
  { method: 'POST', path: '/api/jobs/toggle', usedBy: ['admin'], helperKey: 'jobs.toggle' },

  // ── DTU ───────────────────────────────────────────────────────
  { method: 'GET', path: '/api/dtus', usedBy: ['dashboard', 'graph', 'board'], helperKey: 'dtus.list' },
  { method: 'POST', path: '/api/dtus', usedBy: ['chat', 'forge'], helperKey: 'dtus.create' },
  { method: 'PATCH', path: '/api/dtus/:id', usedBy: ['editor'], helperKey: 'dtus.update' },

  // ── Ingestion ─────────────────────────────────────────────────
  { method: 'POST', path: '/api/ingest', usedBy: ['import'], helperKey: 'ingest.manual' },
  { method: 'POST', path: '/api/ingest/queue', usedBy: ['import'], helperKey: 'ingest.queue' },
  { method: 'POST', path: '/api/autocrawl', usedBy: ['import'], helperKey: 'autocrawl.manual' },
  { method: 'POST', path: '/api/autocrawl/queue', usedBy: ['import'], helperKey: 'autocrawl.queue' },

  // ── Chat ──────────────────────────────────────────────────────
  { method: 'POST', path: '/api/chat', usedBy: ['chat'], helperKey: 'chat.send' },
  { method: 'POST', path: '/api/ask', usedBy: ['chat'], helperKey: 'chat.ask' },
  { method: 'POST', path: '/api/dream', usedBy: ['chat'], helperKey: 'dream.run' },

  // ── Forge ─────────────────────────────────────────────────────
  { method: 'POST', path: '/api/forge/manual', usedBy: ['forge'], helperKey: 'forge.manual' },
  { method: 'POST', path: '/api/forge/hybrid', usedBy: ['forge'], helperKey: 'forge.hybrid' },
  { method: 'POST', path: '/api/forge/auto', usedBy: ['forge'], helperKey: 'forge.auto' },
  { method: 'POST', path: '/api/forge/fromSource', usedBy: ['forge'], helperKey: 'forge.fromSource' },

  // ── Council / Governance ──────────────────────────────────────
  { method: 'POST', path: '/api/council/review-global', usedBy: ['council'], helperKey: 'council.reviewGlobal' },
  { method: 'POST', path: '/api/council/weekly', usedBy: ['council'], helperKey: 'council.weekly' },
  { method: 'POST', path: '/api/council/vote', usedBy: ['council'], helperKey: 'council.vote' },
  { method: 'GET', path: '/api/council/tally/:dtuId', usedBy: ['council'], helperKey: 'council.tally' },
  { method: 'POST', path: '/api/council/credibility', usedBy: ['council'], helperKey: 'council.credibility' },

  // ── Marketplace ───────────────────────────────────────────────
  { method: 'GET', path: '/api/marketplace/listings', usedBy: ['marketplace'], helperKey: 'marketplace.listings' },
  { method: 'GET', path: '/api/marketplace/browse', usedBy: ['marketplace'], helperKey: 'marketplace.browse' },
  { method: 'POST', path: '/api/marketplace/submit', usedBy: ['marketplace'], helperKey: 'marketplace.submit' },
  { method: 'POST', path: '/api/marketplace/install', usedBy: ['marketplace'], helperKey: 'marketplace.install' },
  { method: 'GET', path: '/api/marketplace/installed', usedBy: ['marketplace'], helperKey: 'marketplace.installed' },
  { method: 'POST', path: '/api/marketplace/review', usedBy: ['marketplace'], helperKey: 'marketplace.review' },

  // ── Graph ─────────────────────────────────────────────────────
  { method: 'POST', path: '/api/graph/query', usedBy: ['graph'], helperKey: 'graph.query' },
  { method: 'GET', path: '/api/graph/visual', usedBy: ['graph'], helperKey: 'graph.visual' },
  { method: 'GET', path: '/api/graph/force', usedBy: ['graph', 'fractal'], helperKey: 'graph.force' },

  // ── Auth ──────────────────────────────────────────────────────
  { method: 'POST', path: '/api/auth/login', usedBy: ['login'], helperKey: 'auth.login' },
  { method: 'POST', path: '/api/auth/register', usedBy: ['register'], helperKey: 'auth.register' },
  { method: 'POST', path: '/api/auth/logout', usedBy: ['shell'], helperKey: 'auth.logout' },
  { method: 'GET', path: '/api/auth/me', usedBy: ['shell'], helperKey: 'auth.me' },
  { method: 'GET', path: '/api/auth/csrf-token', usedBy: ['client'], helperKey: 'auth.csrfToken' },

  // ── AI subsystems ─────────────────────────────────────────────
  { method: 'GET', path: '/api/metacognition/status', usedBy: ['metacognition'], helperKey: 'metacognition.status' },
  { method: 'GET', path: '/api/metalearning/status', usedBy: ['metalearning'], helperKey: 'metalearning.status' },
  { method: 'GET', path: '/api/reasoning/chains', usedBy: ['reasoning'], helperKey: 'reasoning.list' },
  { method: 'GET', path: '/api/hypothesis', usedBy: ['hypothesis'], helperKey: 'hypothesis.list' },
  { method: 'GET', path: '/api/inference/status', usedBy: ['inference'], helperKey: 'inference.status' },
  { method: 'GET', path: '/api/agents', usedBy: ['agents'], helperKey: 'agents.list' },
  { method: 'GET', path: '/api/affect/state', usedBy: ['affect'], helperKey: 'affect.state' },
  { method: 'GET', path: '/api/attention/status', usedBy: ['attention'], helperKey: 'attention.status' },
  { method: 'GET', path: '/api/reflection/status', usedBy: ['reflection'], helperKey: 'reflection.status' },
  { method: 'GET', path: '/api/experience/status', usedBy: ['experience'], helperKey: 'experience.status' },
  { method: 'GET', path: '/api/transfer/history', usedBy: ['transfer'], helperKey: 'transfer.history' },
  { method: 'GET', path: '/api/commonsense/facts', usedBy: ['commonsense'], helperKey: 'commonsense.facts' },
  { method: 'GET', path: '/api/grounding/sensors', usedBy: ['grounding'], helperKey: 'grounding.sensors' },
  { method: 'GET', path: '/api/goals', usedBy: ['goals'], helperKey: 'goals.list' },

  // ── Performance / DB ──────────────────────────────────────────
  { method: 'GET', path: '/api/perf/metrics', usedBy: ['admin', 'debug'], helperKey: 'perf.metrics' },
  { method: 'GET', path: '/api/db/status', usedBy: ['database'], helperKey: 'db.status' },
  { method: 'GET', path: '/api/redis/stats', usedBy: ['admin'], helperKey: 'redis.stats' },
  { method: 'GET', path: '/api/backpressure/status', usedBy: ['admin'], helperKey: 'backpressure.status' },

  // ── Topbar / Shell ────────────────────────────────────────────
  { method: 'GET', path: '/api/resonance/quick', usedBy: ['topbar'], helperKey: undefined },
  { method: 'GET', path: '/api/notifications/count', usedBy: ['topbar'], helperKey: undefined },
  { method: 'GET', path: '/api/events', usedBy: ['dashboard'], helperKey: 'events.list' },
];

/**
 * Development helper: returns endpoint paths that appear in the inventory
 * but may have been removed or renamed on the backend.
 */
export function getInventoryPaths(): string[] {
  return ENDPOINT_INVENTORY.map((e) => `${e.method} ${e.path}`);
}

/**
 * Check if a given path+method is accounted for in the inventory.
 */
export function isEndpointKnown(method: string, path: string): boolean {
  const normalized = path.replace(/\/[a-f0-9-]{8,}(?=\/|$)/g, '/:id');
  return ENDPOINT_INVENTORY.some(
    (e) => e.method === method.toUpperCase() && e.path === normalized
  );
}
