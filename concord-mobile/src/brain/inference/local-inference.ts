// Concord Mobile — Local Inference Engine
// On-device inference with quantized models via native runtime.
// Timeout: 30s, Memory limit: 200MB, Concurrent requests queued.

import {
  BRAIN_INFERENCE_TIMEOUT_MS,
  BRAIN_MAX_MEMORY_MB,
  BRAIN_MAX_CONTEXT_TOKENS,
} from '../../utils/constants';
import type { InferenceRequest, InferenceResponse } from '../../utils/types';

// ── Inference Runtime Interface ──────────────────────────────────────────────

export interface InferenceRuntime {
  loadModel(path: string): Promise<boolean>;
  unloadModel(): Promise<void>;
  isLoaded(): boolean;
  getModelName(): string;
  generate(params: {
    prompt: string;
    maxTokens: number;
    temperature: number;
    systemPrompt?: string;
    stopSequences?: string[];
  }): Promise<{
    text: string;
    tokensGenerated: number;
    durationMs: number;
  }>;
  getMemoryUsageMB(): number;
  abort(): void;
}

// ── Local Inference Interface ────────────────────────────────────────────────

export interface LocalInference {
  loadModel(modelPath: string): Promise<boolean>;
  unloadModel(): Promise<void>;
  isModelLoaded(): boolean;
  generate(request: InferenceRequest): Promise<InferenceResponse>;
  getMemoryUsageMB(): number;
  abort(): void;
}

// ── Queue Entry ──────────────────────────────────────────────────────────────

interface QueueEntry {
  request: InferenceRequest;
  resolve: (response: InferenceResponse) => void;
  reject: (error: Error) => void;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createLocalInference(runtime: InferenceRuntime): LocalInference {
  let modelLoaded = false;
  let isGenerating = false;
  let aborted = false;
  const queue: QueueEntry[] = [];

  async function loadModel(modelPath: string): Promise<boolean> {
    // Check memory before loading
    const currentMemory = runtime.getMemoryUsageMB();
    if (currentMemory > BRAIN_MAX_MEMORY_MB) {
      // Try to free memory by unloading current model
      if (modelLoaded) {
        await runtime.unloadModel();
        modelLoaded = false;
      }
    }

    try {
      const success = await runtime.loadModel(modelPath);
      if (success) {
        modelLoaded = true;
      }
      return success;
    } catch {
      modelLoaded = false;
      return false;
    }
  }

  async function unloadModel(): Promise<void> {
    if (modelLoaded) {
      await runtime.unloadModel();
      modelLoaded = false;
    }
  }

  function isModelLoaded(): boolean {
    return modelLoaded && runtime.isLoaded();
  }

  async function processQueue(): Promise<void> {
    if (isGenerating || queue.length === 0) return;

    isGenerating = true;
    const entry = queue.shift()!;

    try {
      const response = await executeGenerate(entry.request);
      entry.resolve(response);
    } catch (err) {
      entry.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      isGenerating = false;
      // Process next in queue
      if (queue.length > 0) {
        processQueue();
      }
    }
  }

  async function executeGenerate(request: InferenceRequest): Promise<InferenceResponse> {
    if (!modelLoaded || !runtime.isLoaded()) {
      throw new Error('No model loaded');
    }

    // Check memory limit
    const memUsage = runtime.getMemoryUsageMB();
    if (memUsage > BRAIN_MAX_MEMORY_MB) {
      throw new Error(`Memory usage ${memUsage}MB exceeds limit ${BRAIN_MAX_MEMORY_MB}MB`);
    }

    // Clamp max tokens to context limit
    const maxTokens = Math.min(request.maxTokens, BRAIN_MAX_CONTEXT_TOKENS);

    aborted = false;

    // Build prompt with context
    let fullPrompt = request.prompt;
    if (request.context && request.context.length > 0) {
      fullPrompt = request.context.join('\n') + '\n' + request.prompt;
    }

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Inference timed out after ${BRAIN_INFERENCE_TIMEOUT_MS}ms`));
        runtime.abort();
      }, BRAIN_INFERENCE_TIMEOUT_MS);
    });

    // Execute inference with timeout
    const generatePromise = runtime.generate({
      prompt: fullPrompt,
      maxTokens,
      temperature: request.temperature,
      systemPrompt: request.systemPrompt,
    });

    const result = await Promise.race([generatePromise, timeoutPromise]);

    if (aborted) {
      throw new Error('Inference aborted');
    }

    return {
      id: request.id,
      text: result.text,
      tokensGenerated: result.tokensGenerated,
      durationMs: result.durationMs,
      model: runtime.getModelName(),
      routedTo: 'local',
    };
  }

  function generate(request: InferenceRequest): Promise<InferenceResponse> {
    return new Promise<InferenceResponse>((resolve, reject) => {
      queue.push({ request, resolve, reject });
      processQueue();
    });
  }

  function getMemoryUsageMB(): number {
    return runtime.getMemoryUsageMB();
  }

  function abort(): void {
    aborted = true;
    runtime.abort();
    // Reject all queued requests
    while (queue.length > 0) {
      const entry = queue.shift()!;
      entry.reject(new Error('Inference aborted'));
    }
  }

  return {
    loadModel,
    unloadModel,
    isModelLoaded,
    generate,
    getMemoryUsageMB,
    abort,
  };
}
