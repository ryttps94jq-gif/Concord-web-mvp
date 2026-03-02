// Tests for brain-store.ts

import { useBrainStore } from '../../store/brain-store';
import type { InferenceRequest, InferenceResponse, BrainRoutingDecision } from '../../utils/types';

describe('useBrainStore', () => {
  beforeEach(() => {
    useBrainStore.getState().reset();
  });

  describe('model management', () => {
    test('default models available on init', () => {
      const models = useBrainStore.getState().availableModels;
      expect(models.length).toBe(3);
      expect(models[0].id).toBe('qwen-0.5b-q4');
      expect(models[1].id).toBe('qwen-1.5b-q4');
      expect(models[2].id).toBe('qwen-3b-q4');
    });

    test('updateModelProgress updates download progress', () => {
      useBrainStore.getState().updateModelProgress('qwen-0.5b-q4', 0.5);
      const model = useBrainStore.getState().availableModels.find(m => m.id === 'qwen-0.5b-q4');
      expect(model?.downloadProgress).toBe(0.5);
    });

    test('markModelDownloaded sets downloaded flag and path', () => {
      useBrainStore.getState().markModelDownloaded('qwen-0.5b-q4', '/models/qwen-0.5b.bin', 'abc123');
      const model = useBrainStore.getState().availableModels.find(m => m.id === 'qwen-0.5b-q4');
      expect(model?.downloaded).toBe(true);
      expect(model?.filePath).toBe('/models/qwen-0.5b.bin');
      expect(model?.hash).toBe('abc123');
    });

    test('removeModel clears download state', () => {
      useBrainStore.getState().markModelDownloaded('qwen-0.5b-q4', '/path', 'hash');
      useBrainStore.getState().setActiveModel('qwen-0.5b-q4');
      useBrainStore.getState().setModelLoaded(true);

      useBrainStore.getState().removeModel('qwen-0.5b-q4');

      const model = useBrainStore.getState().availableModels.find(m => m.id === 'qwen-0.5b-q4');
      expect(model?.downloaded).toBe(false);
      expect(model?.filePath).toBeUndefined();
      expect(useBrainStore.getState().activeModelId).toBeNull();
      expect(useBrainStore.getState().isModelLoaded).toBe(false);
    });

    test('removeModel does not affect active model if different', () => {
      useBrainStore.getState().setActiveModel('qwen-1.5b-q4');
      useBrainStore.getState().removeModel('qwen-0.5b-q4');
      expect(useBrainStore.getState().activeModelId).toBe('qwen-1.5b-q4');
    });

    test('setActiveModel updates model selection', () => {
      useBrainStore.getState().setActiveModel('qwen-1.5b-q4');
      expect(useBrainStore.getState().activeModelId).toBe('qwen-1.5b-q4');
    });
  });

  describe('inference queue', () => {
    test('enqueueRequest adds to queue', () => {
      const req: InferenceRequest = {
        id: 'req_1', prompt: 'hello', maxTokens: 100, temperature: 0.7,
      };
      useBrainStore.getState().enqueueRequest(req);
      expect(useBrainStore.getState().requestQueue.length).toBe(1);
    });

    test('dequeueRequest returns FIFO', () => {
      useBrainStore.getState().enqueueRequest({ id: 'req_1', prompt: 'first', maxTokens: 100, temperature: 0.7 });
      useBrainStore.getState().enqueueRequest({ id: 'req_2', prompt: 'second', maxTokens: 100, temperature: 0.7 });

      const first = useBrainStore.getState().dequeueRequest();
      expect(first?.id).toBe('req_1');
      expect(useBrainStore.getState().requestQueue.length).toBe(1);
    });

    test('dequeueRequest returns undefined when empty', () => {
      expect(useBrainStore.getState().dequeueRequest()).toBeUndefined();
    });

    test('setLastResponse updates response and increments count', () => {
      const resp: InferenceResponse = {
        id: 'resp_1', text: 'world', tokensGenerated: 5, durationMs: 1000, model: 'qwen-0.5b', routedTo: 'local',
      };
      useBrainStore.getState().setLastResponse(resp);

      expect(useBrainStore.getState().lastResponse).toEqual(resp);
      expect(useBrainStore.getState().totalInferences).toBe(1);
    });

    test('concurrent requests queued properly', () => {
      for (let i = 0; i < 10; i++) {
        useBrainStore.getState().enqueueRequest({
          id: `req_${i}`, prompt: `query ${i}`, maxTokens: 100, temperature: 0.7,
        });
      }
      expect(useBrainStore.getState().requestQueue.length).toBe(10);

      // Drain queue
      for (let i = 0; i < 10; i++) {
        const req = useBrainStore.getState().dequeueRequest();
        expect(req?.id).toBe(`req_${i}`);
      }
      expect(useBrainStore.getState().requestQueue.length).toBe(0);
    });
  });

  describe('routing', () => {
    test('setOfflineMode updates flag', () => {
      useBrainStore.getState().setOfflineMode(true);
      expect(useBrainStore.getState().offlineMode).toBe(true);
    });

    test('setServerAvailable updates flag', () => {
      useBrainStore.getState().setServerAvailable(true);
      expect(useBrainStore.getState().serverAvailable).toBe(true);
    });

    test('setLastRoutingDecision records decision', () => {
      const decision: BrainRoutingDecision = {
        target: 'local', reason: 'simple query', complexity: 0.2, localCapable: true,
      };
      useBrainStore.getState().setLastRoutingDecision(decision);
      expect(useBrainStore.getState().lastRoutingDecision).toEqual(decision);
    });
  });

  describe('memory', () => {
    test('setMemoryUsage updates value', () => {
      useBrainStore.getState().setMemoryUsage(150);
      expect(useBrainStore.getState().memoryUsageMB).toBe(150);
    });
  });

  describe('reset', () => {
    test('resets to defaults', () => {
      useBrainStore.getState().setActiveModel('qwen-0.5b-q4');
      useBrainStore.getState().setOfflineMode(true);
      useBrainStore.getState().setMemoryUsage(100);

      useBrainStore.getState().reset();

      expect(useBrainStore.getState().activeModelId).toBeNull();
      expect(useBrainStore.getState().offlineMode).toBe(false);
      expect(useBrainStore.getState().memoryUsageMB).toBe(0);
      expect(useBrainStore.getState().availableModels.length).toBe(3);
    });
  });
});
