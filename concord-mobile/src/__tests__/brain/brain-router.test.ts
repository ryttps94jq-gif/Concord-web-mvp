// Tests for Brain Router — routes queries between local model and server

import { createBrainRouter } from '../../brain/routing/brain-router';
import type { BrainRouter } from '../../brain/routing/brain-router';
import type { LocalInference } from '../../brain/inference/local-inference';
import type { InferenceRequest, InferenceResponse } from '../../utils/types';

// ── Mock Local Inference ─────────────────────────────────────────────────────

function createMockLocalInference(modelLoaded: boolean = true): LocalInference {
  return {
    loadModel: jest.fn(async () => true),
    unloadModel: jest.fn(async () => {}),
    isModelLoaded: jest.fn(() => modelLoaded),
    generate: jest.fn(async (request: InferenceRequest): Promise<InferenceResponse> => ({
      id: request.id,
      text: 'Local response',
      tokensGenerated: 20,
      durationMs: 200,
      model: 'concord-tiny-q4',
      routedTo: 'local',
    })),
    getMemoryUsageMB: jest.fn(() => 100),
    abort: jest.fn(),
  };
}

// ── Mock Fetch ───────────────────────────────────────────────────────────────

const mockFetchSuccess = jest.fn(async () => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => ({
    text: 'Server response',
    tokensGenerated: 100,
    durationMs: 1000,
    model: 'concord-large-server',
  }),
}));

const mockFetchFailure = jest.fn(async () => {
  throw new Error('Network error');
});

function makeRequest(overrides: Partial<InferenceRequest> = {}): InferenceRequest {
  return {
    id: 'req_001',
    prompt: 'Hello',
    maxTokens: 256,
    temperature: 0.7,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BrainRouter', () => {
  let localInference: LocalInference;
  let router: BrainRouter;

  beforeEach(() => {
    localInference = createMockLocalInference(true);
    (global as any).fetch = mockFetchSuccess;
    router = createBrainRouter(localInference, 'https://api.concord.test');
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  // ── route: Simple queries → local ──────────────────────────────────────

  describe('route - simple queries to local', () => {
    it('routes short simple prompt to local', async () => {
      const decision = await router.route(makeRequest({ prompt: 'Hi there' }));
      expect(decision.target).toBe('local');
      expect(decision.complexity).toBeLessThan(0.4);
    });

    it('routes basic question to local', async () => {
      const decision = await router.route(makeRequest({ prompt: 'What time is it?' }));
      expect(decision.target).toBe('local');
    });

    it('reports low complexity for short prompts', async () => {
      const decision = await router.route(makeRequest({ prompt: 'Hello' }));
      expect(decision.complexity).toBeLessThan(0.2);
    });

    it('reports local as capable when model loaded', async () => {
      const decision = await router.route(makeRequest());
      expect(decision.localCapable).toBe(true);
    });
  });

  // ── route: Complex queries → server ────────────────────────────────────

  describe('route - complex queries to server', () => {
    it('routes long complex prompt to server', async () => {
      const longPrompt = 'Please analyze and compare the following two approaches in detail. ' +
        'I need a comprehensive evaluation of their strengths and weaknesses. ' +
        'Please provide step-by-step reasoning with scientific evidence. '.repeat(10);
      const decision = await router.route(makeRequest({ prompt: longPrompt }));
      expect(decision.target).toBe('server');
    });

    it('detects complexity from domain keywords', async () => {
      const decision = await router.route(makeRequest({
        prompt: 'Please analyze and evaluate this comprehensive scientific research in detail',
      }));
      expect(decision.complexity).toBeGreaterThan(0.3);
    });

    it('detects code blocks as complex', async () => {
      const decision = await router.route(makeRequest({
        prompt: 'Review this code:\n```\nfunction sort(arr) { return arr.sort(); }\n```\nProvide detailed analysis and debugging suggestions',
      }));
      expect(decision.complexity).toBeGreaterThan(0.1);
    });

    it('factors in high maxTokens', async () => {
      const decision = await router.route(makeRequest({
        prompt: 'Write a detailed comprehensive analysis of the financial implications',
        maxTokens: 2048,
      }));
      expect(decision.complexity).toBeGreaterThan(0.3);
    });

    it('factors in long system prompt', async () => {
      const decision = await router.route(makeRequest({
        prompt: 'Analyze this research paper and provide comprehensive evaluation',
        systemPrompt: 'You are an expert researcher. Provide detailed scientific analysis with citations and multi-step reasoning. Always include comprehensive methodology review.',
      }));
      expect(decision.complexity).toBeGreaterThan(0.3);
    });

    it('provides reason string', async () => {
      const decision = await router.route(makeRequest({
        prompt: 'Analyze and evaluate this comprehensive research in depth with detailed reasoning',
      }));
      expect(decision.reason).toBeDefined();
      expect(decision.reason.length).toBeGreaterThan(0);
    });
  });

  // ── route: Offline → all local ─────────────────────────────────────────

  describe('route - offline mode', () => {
    it('routes everything to local in offline mode', async () => {
      router.setOfflineMode(true);
      const longPrompt = 'Please analyze and compare in comprehensive detail with scientific reasoning. '.repeat(10);
      const decision = await router.route(makeRequest({ prompt: longPrompt }));
      expect(decision.target).toBe('local');
    });

    it('includes offline reason', async () => {
      router.setOfflineMode(true);
      const decision = await router.route(makeRequest());
      expect(decision.reason).toContain('Offline');
    });

    it('still reports local capability accurately', async () => {
      router.setOfflineMode(true);
      const decision = await router.route(makeRequest());
      expect(decision.localCapable).toBe(true);
    });

    it('reports local not capable when no model loaded', async () => {
      localInference = createMockLocalInference(false);
      router = createBrainRouter(localInference, 'https://api.concord.test');
      router.setOfflineMode(true);
      const decision = await router.route(makeRequest());
      expect(decision.target).toBe('local');
      expect(decision.localCapable).toBe(false);
    });
  });

  // ── route: No local model → server ─────────────────────────────────────

  describe('route - no local model', () => {
    it('routes to server when no local model available', async () => {
      localInference = createMockLocalInference(false);
      router = createBrainRouter(localInference, 'https://api.concord.test');
      const decision = await router.route(makeRequest());
      expect(decision.target).toBe('server');
      expect(decision.localCapable).toBe(false);
    });

    it('provides reason about no local model', async () => {
      localInference = createMockLocalInference(false);
      router = createBrainRouter(localInference, 'https://api.concord.test');
      const decision = await router.route(makeRequest());
      expect(decision.reason).toContain('No local model');
    });
  });

  // ── generate ────────────────────────────────────────────────────────────

  describe('generate', () => {
    it('generates local response for simple query', async () => {
      const response = await router.generate(makeRequest({ prompt: 'Hi' }));
      expect(response.routedTo).toBe('local');
      expect(response.text).toBe('Local response');
    });

    it('generates server response for complex query', async () => {
      const longPrompt = 'Analyze and compare these approaches with comprehensive reasoning and detailed scientific evidence. '.repeat(10);
      const response = await router.generate(makeRequest({ prompt: longPrompt }));
      expect(response.routedTo).toBe('server');
      expect(response.text).toBe('Server response');
    });

    it('falls back to local when server fails', async () => {
      (global as any).fetch = mockFetchFailure;
      const longPrompt = 'Analyze and compare these approaches with comprehensive reasoning and detailed scientific evidence. '.repeat(10);
      const response = await router.generate(makeRequest({ prompt: longPrompt }));
      // Should fall back to local
      expect(response.routedTo).toBe('local');
    });

    it('throws when server fails and no local model', async () => {
      localInference = createMockLocalInference(false);
      router = createBrainRouter(localInference, 'https://api.concord.test');
      (global as any).fetch = mockFetchFailure;
      await expect(router.generate(makeRequest())).rejects.toThrow(/unavailable/);
    });

    it('throws in offline mode with no local model', async () => {
      localInference = createMockLocalInference(false);
      router = createBrainRouter(localInference, 'https://api.concord.test');
      router.setOfflineMode(true);
      await expect(router.generate(makeRequest())).rejects.toThrow(/offline/);
    });

    it('uses local for all requests in offline mode', async () => {
      router.setOfflineMode(true);
      const response = await router.generate(makeRequest());
      expect(localInference.generate).toHaveBeenCalled();
      expect(response.routedTo).toBe('local');
    });

    it('server response includes model name', async () => {
      const longPrompt = 'Analyze and compare these approaches with comprehensive reasoning and detailed scientific evidence. '.repeat(10);
      const response = await router.generate(makeRequest({ prompt: longPrompt }));
      expect(response.model).toBe('concord-large-server');
    });
  });

  // ── isLocalAvailable / isServerAvailable ────────────────────────────────

  describe('availability checks', () => {
    it('isLocalAvailable returns true when model loaded', () => {
      expect(router.isLocalAvailable()).toBe(true);
    });

    it('isLocalAvailable returns false when no model', () => {
      localInference = createMockLocalInference(false);
      router = createBrainRouter(localInference, 'https://api.concord.test');
      expect(router.isLocalAvailable()).toBe(false);
    });

    it('isServerAvailable returns true initially', () => {
      expect(router.isServerAvailable()).toBe(true);
    });

    it('isServerAvailable returns false in offline mode', () => {
      router.setOfflineMode(true);
      expect(router.isServerAvailable()).toBe(false);
    });

    it('isServerAvailable returns false after server failure', async () => {
      (global as any).fetch = mockFetchFailure;
      const longPrompt = 'Analyze and compare these approaches with comprehensive reasoning and detailed scientific evidence. '.repeat(10);
      try {
        await router.generate(makeRequest({ prompt: longPrompt }));
      } catch {
        // expected
      }
      // After failure, server should be marked unavailable
      expect(router.isServerAvailable()).toBe(false);
    });
  });

  // ── setOfflineMode ──────────────────────────────────────────────────────

  describe('setOfflineMode', () => {
    it('enables offline mode', () => {
      router.setOfflineMode(true);
      expect(router.isServerAvailable()).toBe(false);
    });

    it('disables offline mode', () => {
      router.setOfflineMode(true);
      router.setOfflineMode(false);
      expect(router.isServerAvailable()).toBe(true);
    });
  });

  // ── Complexity estimation ──────────────────────────────────────────────

  describe('complexity estimation', () => {
    it('complexity is between 0 and 1', async () => {
      const decision = await router.route(makeRequest());
      expect(decision.complexity).toBeGreaterThanOrEqual(0);
      expect(decision.complexity).toBeLessThanOrEqual(1);
    });

    it('very short prompt has very low complexity', async () => {
      const decision = await router.route(makeRequest({ prompt: 'Hi' }));
      expect(decision.complexity).toBeLessThan(0.2);
    });

    it('prompt with multiple domain keywords has higher complexity', async () => {
      const decision = await router.route(makeRequest({
        prompt: 'Analyze and compare this scientific research. Evaluate the algorithm and provide comprehensive detailed analysis. Debug the architecture.',
      }));
      expect(decision.complexity).toBeGreaterThan(0.4);
    });

    it('complexity capped at 1.0', async () => {
      const decision = await router.route(makeRequest({
        prompt: 'Analyze compare evaluate synthesize research comprehensive detailed analysis in-depth multi-step reasoning proof theorem algorithm translate code review debug architecture legal medical scientific financial. '.repeat(5),
        maxTokens: 4096,
        systemPrompt: 'You are a comprehensive expert in all fields providing detailed multi-step analysis with scientific rigor and legal precision. '.repeat(3),
      }));
      expect(decision.complexity).toBeLessThanOrEqual(1.0);
    });
  });
});
