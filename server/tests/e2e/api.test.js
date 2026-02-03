/**
 * Concord v4.0 E2E API Tests
 * Tests all major API endpoints for the 9 waves of features
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.TEST_URL || 'http://localhost:5050';

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  return { status: res.status, data: await res.json() };
}

describe('Concord v4.0 E2E Tests', () => {

  describe('Core System', () => {
    it('GET /api/status returns system info', async () => {
      const { status, data } = await api('GET', '/api/status');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.version.includes('4.0'));
      assert.ok(data.macroDomains.length > 50);
    });

    it('GET /api/dtus returns DTU list', async () => {
      const { status, data } = await api('GET', '/api/dtus');
      assert.strictEqual(status, 200);
      assert.ok(Array.isArray(data.dtus) || data.ok);
    });
  });

  describe('Wave 1: Plugin Marketplace', () => {
    it('GET /api/marketplace/browse returns listings', async () => {
      const { status, data } = await api('GET', '/api/marketplace/browse');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.categories));
    });

    it('GET /api/marketplace/installed returns installed plugins', async () => {
      const { status, data } = await api('GET', '/api/marketplace/installed');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
    });

    it('POST /api/marketplace/submit creates plugin listing', async () => {
      const { status, data } = await api('POST', '/api/marketplace/submit', {
        name: 'test-plugin',
        githubUrl: 'https://github.com/test/test-plugin',
        description: 'Test plugin for E2E',
        category: 'productivity'
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.listing.id);
    });
  });

  describe('Wave 2: Graph Queries', () => {
    it('POST /api/graph/query executes DSL query', async () => {
      const { status, data } = await api('POST', '/api/graph/query', {
        dsl: 'DTUs linked to tag:test'
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.results));
    });

    it('GET /api/graph/visual returns graph data', async () => {
      const { status, data } = await api('GET', '/api/graph/visual?limit=10');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.nodes));
      assert.ok(Array.isArray(data.edges));
    });

    it('GET /api/graph/force returns force-directed graph', async () => {
      const { status, data } = await api('GET', '/api/graph/force?maxNodes=20');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.nodes));
      assert.ok(Array.isArray(data.links));
    });
  });

  describe('Wave 3: Dynamic Schemas', () => {
    it('GET /api/schema returns schema list', async () => {
      const { status, data } = await api('GET', '/api/schema');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.schemas));
    });

    it('POST /api/schema creates new schema', async () => {
      const { status, data } = await api('POST', '/api/schema', {
        name: 'TestSchema',
        kind: 'test',
        fields: [
          { name: 'title', type: 'string', required: true },
          { name: 'score', type: 'number', required: false }
        ]
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.schema.id);
    });

    it('POST /api/schema/validate validates data', async () => {
      const { status, data } = await api('POST', '/api/schema/validate', {
        schemaName: 'Hypothesis',
        data: { claim: 'Test claim', confidence: 0.8, testable: true }
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.valid, true);
    });
  });

  describe('Wave 4: Auto-Tagging & Visuals', () => {
    it('POST /api/autotag/analyze suggests tags', async () => {
      const { status, data } = await api('POST', '/api/autotag/analyze', {
        content: 'This is about philosophy and ethics in artificial intelligence systems'
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.suggestedTags));
      assert.ok(data.suggestedTags.length > 0);
    });

    it('GET /api/visual/moodboard returns hierarchy', async () => {
      const { status, data } = await api('GET', '/api/visual/moodboard?maxNodes=50');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.hierarchy);
    });

    it('GET /api/visual/timeline returns events', async () => {
      const { status, data } = await api('GET', '/api/visual/timeline?limit=20');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.events));
    });
  });

  describe('Wave 5: Collaboration', () => {
    let sessionId;

    it('GET /api/collab/sessions lists sessions', async () => {
      const { status, data } = await api('GET', '/api/collab/sessions');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.sessions));
    });

    it('GET /api/whiteboards lists whiteboards', async () => {
      const { status, data } = await api('GET', '/api/whiteboards');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.whiteboards));
    });

    it('POST /api/whiteboard creates whiteboard', async () => {
      const { status, data } = await api('POST', '/api/whiteboard', {
        title: 'Test Whiteboard',
        linkedDtus: []
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.whiteboard.id);
    });
  });

  describe('Wave 6: PWA & Mobile', () => {
    it('GET /manifest.json returns PWA manifest', async () => {
      const { status, data } = await api('GET', '/manifest.json');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.name, 'Concord Cognitive Engine');
      assert.ok(Array.isArray(data.icons));
    });

    it('GET /api/pwa/sw-config returns service worker config', async () => {
      const { status, data } = await api('GET', '/api/pwa/sw-config');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.config);
    });

    it('GET /api/mobile/shortcuts returns shortcuts', async () => {
      const { status, data } = await api('GET', '/api/mobile/shortcuts');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.shortcuts));
    });
  });

  describe('Wave 7: Scalability', () => {
    it('GET /api/perf/metrics returns performance data', async () => {
      const { status, data } = await api('GET', '/api/perf/metrics');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.memory);
      assert.ok(typeof data.uptime === 'number');
    });

    it('GET /api/backpressure/status returns status', async () => {
      const { status, data } = await api('GET', '/api/backpressure/status');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.level);
    });

    it('GET /api/shard/route returns shard routing', async () => {
      const { status, data } = await api('GET', '/api/shard/route?userId=test123');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.shardId);
    });

    it('GET /api/governor/check returns rate limit status', async () => {
      const { status, data } = await api('GET', '/api/governor/check?userId=test&action=query');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.allowed, true);
    });
  });

  describe('Wave 8: Integrations', () => {
    it('GET /api/webhooks lists webhooks', async () => {
      const { status, data } = await api('GET', '/api/webhooks');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.webhooks));
    });

    it('POST /api/webhooks creates webhook', async () => {
      const { status, data } = await api('POST', '/api/webhooks', {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        events: ['dtu.created', 'dtu.updated']
      });
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.webhook.id);
    });

    it('GET /api/automations lists automations', async () => {
      const { status, data } = await api('GET', '/api/automations');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.automations));
    });

    it('GET /api/integrations lists available integrations', async () => {
      const { status, data } = await api('GET', '/api/integrations');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.integrations));
      assert.ok(data.integrations.length >= 4);
    });

    it('GET /api/vscode/search searches code DTUs', async () => {
      const { status, data } = await api('GET', '/api/vscode/search?q=test');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.results));
    });
  });

  describe('Wave 9: Database Integrations', () => {
    it('GET /api/db/status returns database status', async () => {
      const { status, data } = await api('GET', '/api/db/status');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.mode);
      assert.ok('postgres' in data);
      assert.ok('redis' in data);
    });

    it('GET /api/redis/stats returns cache stats', async () => {
      const { status, data } = await api('GET', '/api/redis/stats');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
    });
  });

  describe('Admin & Governance', () => {
    it('GET /api/admin/dashboard returns dashboard data', async () => {
      const { status, data } = await api('GET', '/api/admin/dashboard');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(data.system);
      assert.ok(data.dtus);
    });

    it('GET /api/admin/metrics returns metrics', async () => {
      const { status, data } = await api('GET', '/api/admin/metrics');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
    });

    it('GET /api/personas lists personas', async () => {
      const { status, data } = await api('GET', '/api/personas');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.personas));
    });

    it('GET /api/plugins lists plugins', async () => {
      const { status, data } = await api('GET', '/api/plugins');
      assert.strictEqual(status, 200);
      assert.strictEqual(data.ok, true);
      assert.ok(Array.isArray(data.plugins));
    });
  });

});

console.log('E2E tests loaded. Run with: npm run test:e2e');
