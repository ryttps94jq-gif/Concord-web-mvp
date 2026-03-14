// Tests for Local Inference — on-device inference with timeout, memory limits, queueing

import { createLocalInference } from '../../brain/inference/local-inference';
import type { LocalInference, InferenceRuntime } from '../../brain/inference/local-inference';
import type { InferenceRequest } from '../../utils/types';
import { BRAIN_INFERENCE_TIMEOUT_MS, BRAIN_MAX_MEMORY_MB, BRAIN_MAX_CONTEXT_TOKENS } from '../../utils/constants';

// ── Mock Inference Runtime ───────────────────────────────────────────────────

function createMockRuntime(overrides: Partial<InferenceRuntime> = {}): InferenceRuntime {
  let loaded = false;
  const memoryUsage = 50;

  return {
    loadModel: jest.fn(async (_path: string) => {
      loaded = true;
      return true;
    }),
    unloadModel: jest.fn(async () => {
      loaded = false;
    }),
    isLoaded: jest.fn(() => loaded),
    getModelName: jest.fn(() => 'concord-tiny-q4'),
    generate: jest.fn(async (params) => {
      return {
        text: `Response to: ${params.prompt.substring(0, 20)}`,
        tokensGenerated: 42,
        durationMs: 500,
      };
    }),
    getMemoryUsageMB: jest.fn(() => memoryUsage),
    abort: jest.fn(),
    ...overrides,
  };
}

function makeRequest(overrides: Partial<InferenceRequest> = {}): InferenceRequest {
  return {
    id: 'req_001',
    prompt: 'What is the meaning of life?',
    maxTokens: 256,
    temperature: 0.7,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LocalInference', () => {
  let runtime: InferenceRuntime;
  let inference: LocalInference;

  beforeEach(() => {
    jest.useFakeTimers();
    runtime = createMockRuntime();
    inference = createLocalInference(runtime);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── loadModel ───────────────────────────────────────────────────────────

  describe('loadModel', () => {
    it('loads a model successfully', async () => {
      const result = await inference.loadModel('/path/to/model.gguf');
      expect(result).toBe(true);
      expect(runtime.loadModel).toHaveBeenCalledWith('/path/to/model.gguf');
    });

    it('reports model as loaded after success', async () => {
      await inference.loadModel('/path/to/model.gguf');
      expect(inference.isModelLoaded()).toBe(true);
    });

    it('returns false on load failure', async () => {
      (runtime.loadModel as jest.Mock).mockRejectedValueOnce(new Error('Load failed'));
      const result = await inference.loadModel('/bad/path');
      expect(result).toBe(false);
    });

    it('reports model as not loaded after failure', async () => {
      (runtime.loadModel as jest.Mock).mockRejectedValueOnce(new Error('Load failed'));
      await inference.loadModel('/bad/path');
      expect(inference.isModelLoaded()).toBe(false);
    });

    it('unloads existing model if memory exceeds limit', async () => {
      // First load
      await inference.loadModel('/path/to/model1.gguf');
      // Set memory above limit
      (runtime.getMemoryUsageMB as jest.Mock).mockReturnValue(BRAIN_MAX_MEMORY_MB + 50);
      // Second load should trigger unload first
      await inference.loadModel('/path/to/model2.gguf');
      expect(runtime.unloadModel).toHaveBeenCalled();
    });
  });

  // ── unloadModel ─────────────────────────────────────────────────────────

  describe('unloadModel', () => {
    it('unloads the current model', async () => {
      await inference.loadModel('/path/to/model.gguf');
      await inference.unloadModel();
      expect(runtime.unloadModel).toHaveBeenCalled();
    });

    it('reports model as not loaded after unload', async () => {
      await inference.loadModel('/path/to/model.gguf');
      await inference.unloadModel();
      expect(inference.isModelLoaded()).toBe(false);
    });

    it('is safe to call when no model loaded', async () => {
      await expect(inference.unloadModel()).resolves.not.toThrow();
    });
  });

  // ── isModelLoaded ───────────────────────────────────────────────────────

  describe('isModelLoaded', () => {
    it('returns false initially', () => {
      expect(inference.isModelLoaded()).toBe(false);
    });

    it('returns true after loading', async () => {
      await inference.loadModel('/path/to/model.gguf');
      expect(inference.isModelLoaded()).toBe(true);
    });

    it('delegates to runtime.isLoaded()', async () => {
      await inference.loadModel('/path/to/model.gguf');
      inference.isModelLoaded();
      expect(runtime.isLoaded).toHaveBeenCalled();
    });
  });

  // ── generate ────────────────────────────────────────────────────────────

  describe('generate', () => {
    beforeEach(async () => {
      await inference.loadModel('/path/to/model.gguf');
    });

    it('generates a response', async () => {
      const promise = inference.generate(makeRequest());
      jest.advanceTimersByTime(100);
      const response = await promise;
      expect(response).toBeDefined();
      expect(response.text).toBeDefined();
      expect(typeof response.text).toBe('string');
    });

    it('returns correct response structure', async () => {
      const promise = inference.generate(makeRequest({ id: 'test_id' }));
      jest.advanceTimersByTime(100);
      const response = await promise;
      expect(response.id).toBe('test_id');
      expect(response.routedTo).toBe('local');
      expect(response.model).toBe('concord-tiny-q4');
      expect(typeof response.tokensGenerated).toBe('number');
      expect(typeof response.durationMs).toBe('number');
    });

    it('throws when no model loaded', async () => {
      await inference.unloadModel();
      const promise = inference.generate(makeRequest());
      jest.advanceTimersByTime(BRAIN_INFERENCE_TIMEOUT_MS + 100);
      await expect(promise).rejects.toThrow(/No model loaded/);
    });

    it('throws when memory exceeds limit', async () => {
      (runtime.getMemoryUsageMB as jest.Mock).mockReturnValue(BRAIN_MAX_MEMORY_MB + 50);
      const promise = inference.generate(makeRequest());
      jest.advanceTimersByTime(100);
      await expect(promise).rejects.toThrow(/Memory usage.*exceeds limit/);
    });

    it('clamps maxTokens to BRAIN_MAX_CONTEXT_TOKENS', async () => {
      const promise = inference.generate(makeRequest({ maxTokens: 10000 }));
      jest.advanceTimersByTime(100);
      await promise;
      expect(runtime.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: BRAIN_MAX_CONTEXT_TOKENS,
        })
      );
    });

    it('passes system prompt to runtime', async () => {
      const promise = inference.generate(makeRequest({ systemPrompt: 'Be helpful' }));
      jest.advanceTimersByTime(100);
      await promise;
      expect(runtime.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: 'Be helpful',
        })
      );
    });

    it('includes context in prompt', async () => {
      const promise = inference.generate(makeRequest({
        prompt: 'question',
        context: ['context line 1', 'context line 2'],
      }));
      jest.advanceTimersByTime(100);
      await promise;
      expect(runtime.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('context line 1'),
        })
      );
    });

    it('times out after BRAIN_INFERENCE_TIMEOUT_MS', async () => {
      // Make the runtime never resolve
      (runtime.generate as jest.Mock).mockReturnValue(new Promise(() => {}));
      const promise = inference.generate(makeRequest());
      jest.advanceTimersByTime(BRAIN_INFERENCE_TIMEOUT_MS + 100);
      await expect(promise).rejects.toThrow(/timed out/);
    });

    it('calls runtime.abort() on timeout', async () => {
      (runtime.generate as jest.Mock).mockReturnValue(new Promise(() => {}));
      const promise = inference.generate(makeRequest());
      jest.advanceTimersByTime(BRAIN_INFERENCE_TIMEOUT_MS + 100);
      try { await promise; } catch { /* expected */ }
      expect(runtime.abort).toHaveBeenCalled();
    });

    // Concurrent request queuing
    it('queues concurrent requests', async () => {
      // Make first generation take time
      let resolveFirst: (v: any) => void;
      (runtime.generate as jest.Mock)
        .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
        .mockImplementation(async () => ({
          text: 'second response',
          tokensGenerated: 10,
          durationMs: 100,
        }));

      const promise1 = inference.generate(makeRequest({ id: 'req_1' }));
      const promise2 = inference.generate(makeRequest({ id: 'req_2' }));

      // Resolve first
      resolveFirst!({ text: 'first response', tokensGenerated: 10, durationMs: 100 });
      jest.advanceTimersByTime(100);

      const result1 = await promise1;
      expect(result1.id).toBe('req_1');

      jest.advanceTimersByTime(100);
      const result2 = await promise2;
      expect(result2.id).toBe('req_2');
    });

    it('processes queue in order', async () => {
      const order: string[] = [];
      (runtime.generate as jest.Mock).mockImplementation(async (params) => {
        order.push(params.prompt);
        return { text: 'ok', tokensGenerated: 1, durationMs: 10 };
      });

      const p1 = inference.generate(makeRequest({ id: 'r1', prompt: 'first' }));
      const p2 = inference.generate(makeRequest({ id: 'r2', prompt: 'second' }));
      const p3 = inference.generate(makeRequest({ id: 'r3', prompt: 'third' }));

      jest.advanceTimersByTime(100);
      await Promise.all([p1, p2, p3]);

      expect(order[0]).toContain('first');
    });
  });

  // ── getMemoryUsageMB ────────────────────────────────────────────────────

  describe('getMemoryUsageMB', () => {
    it('returns runtime memory usage', () => {
      const usage = inference.getMemoryUsageMB();
      expect(typeof usage).toBe('number');
      expect(runtime.getMemoryUsageMB).toHaveBeenCalled();
    });
  });

  // ── abort ───────────────────────────────────────────────────────────────

  describe('abort', () => {
    it('calls runtime.abort()', () => {
      inference.abort();
      expect(runtime.abort).toHaveBeenCalled();
    });

    it('rejects all queued requests', async () => {
      await inference.loadModel('/path/to/model.gguf');

      // Block the first generation
      (runtime.generate as jest.Mock).mockReturnValue(new Promise(() => {}));

      void inference.generate(makeRequest({ id: 'r1' }));
      const p2 = inference.generate(makeRequest({ id: 'r2' }));

      // Abort all
      inference.abort();
      jest.advanceTimersByTime(BRAIN_INFERENCE_TIMEOUT_MS + 100);

      // p2 should be rejected (it was queued)
      await expect(p2).rejects.toThrow(/aborted/);
    });

    it('is safe to call when idle', () => {
      expect(() => inference.abort()).not.toThrow();
    });
  });
});
