// Concord Mobile — Brain Router
// Routes inference requests between local model and server.
// Simple queries -> local. Complex queries -> server. Offline -> all local.

import type { InferenceRequest, InferenceResponse, BrainRoutingDecision } from '../../utils/types';
import type { LocalInference } from '../inference/local-inference';

// ── Complexity Thresholds ────────────────────────────────────────────────────

const COMPLEXITY_LOCAL_THRESHOLD = 0.4;  // Below this -> local
const SHORT_PROMPT_LENGTH = 200;         // Characters
const MEDIUM_PROMPT_LENGTH = 500;        // Characters
const LONG_PROMPT_LENGTH = 1500;         // Characters

// Domain keywords that indicate complexity needing server
const COMPLEX_DOMAIN_KEYWORDS = [
  'analyze', 'compare', 'contrast', 'evaluate', 'synthesize',
  'research', 'comprehensive', 'detailed analysis', 'in-depth',
  'multi-step', 'reasoning', 'proof', 'theorem', 'algorithm',
  'translate', 'code review', 'debug', 'architecture',
  'legal', 'medical', 'scientific', 'financial',
];

// Special tokens / patterns that indicate higher complexity
const COMPLEX_PATTERNS = [
  /```[\s\S]+```/,         // Code blocks
  /\b(step\s+\d+|first|second|third|finally)\b/i, // Multi-step instructions
  /\b(explain|describe|elaborate)\b.*\b(detail|depth|thorough)/i,
];

// ── Brain Router Interface ───────────────────────────────────────────────────

export interface BrainRouter {
  route(request: InferenceRequest): Promise<BrainRoutingDecision>;
  generate(request: InferenceRequest): Promise<InferenceResponse>;
  isLocalAvailable(): boolean;
  isServerAvailable(): boolean;
  setOfflineMode(offline: boolean): void;
}

// ── Server Client ────────────────────────────────────────────────────────────

interface ServerResponse {
  text: string;
  tokensGenerated: number;
  durationMs: number;
  model: string;
}

async function callServer(serverUrl: string, request: InferenceRequest): Promise<ServerResponse> {
  const response = await fetch(`${serverUrl}/v1/inference`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: request.id,
      prompt: request.prompt,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      systemPrompt: request.systemPrompt,
      context: request.context,
    }),
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createBrainRouter(
  localInference: LocalInference,
  serverUrl: string
): BrainRouter {
  let offlineMode = false;
  let serverAvailable = true;
  let lastServerCheck = 0;
  const SERVER_CHECK_INTERVAL = 60000; // 1 minute

  function estimateComplexity(request: InferenceRequest): number {
    let complexity = 0;
    const prompt = request.prompt;

    // Factor 1: Prompt length (0 - 0.3)
    if (prompt.length <= SHORT_PROMPT_LENGTH) {
      complexity += 0.05;
    } else if (prompt.length <= MEDIUM_PROMPT_LENGTH) {
      complexity += 0.15;
    } else if (prompt.length <= LONG_PROMPT_LENGTH) {
      complexity += 0.25;
    } else {
      complexity += 0.3;
    }

    // Factor 2: Domain keywords (0 - 0.3)
    const lowerPrompt = prompt.toLowerCase();
    let keywordHits = 0;
    for (const keyword of COMPLEX_DOMAIN_KEYWORDS) {
      if (lowerPrompt.includes(keyword)) {
        keywordHits++;
      }
    }
    complexity += Math.min(keywordHits * 0.1, 0.3);

    // Factor 3: Complex patterns (0 - 0.2)
    for (const pattern of COMPLEX_PATTERNS) {
      if (pattern.test(prompt)) {
        complexity += 0.07;
      }
    }
    complexity = Math.min(complexity, 1.0); // interim clamp

    // Factor 4: Max tokens requested (0 - 0.1)
    if (request.maxTokens > 512) {
      complexity += 0.05;
    }
    if (request.maxTokens > 1024) {
      complexity += 0.05;
    }

    // Factor 5: System prompt presence (0 - 0.1)
    if (request.systemPrompt && request.systemPrompt.length > 100) {
      complexity += 0.1;
    }

    return Math.min(complexity, 1.0);
  }

  async function route(request: InferenceRequest): Promise<BrainRoutingDecision> {
    const complexity = estimateComplexity(request);
    const localCapable = localInference.isModelLoaded();

    // Offline mode: always local
    if (offlineMode) {
      return {
        target: 'local',
        reason: localCapable
          ? 'Offline mode: routing to local model'
          : 'Offline mode: local model required but not available',
        complexity,
        localCapable,
      };
    }

    // No local model: always server
    if (!localCapable) {
      return {
        target: 'server',
        reason: 'No local model available',
        complexity,
        localCapable: false,
      };
    }

    // Server unavailable: local
    if (!serverAvailable) {
      return {
        target: 'local',
        reason: 'Server unavailable, falling back to local',
        complexity,
        localCapable: true,
      };
    }

    // Route based on complexity
    if (complexity < COMPLEXITY_LOCAL_THRESHOLD) {
      return {
        target: 'local',
        reason: `Low complexity (${complexity.toFixed(2)}): suitable for local model`,
        complexity,
        localCapable: true,
      };
    }

    return {
      target: 'server',
      reason: `High complexity (${complexity.toFixed(2)}): routing to server`,
      complexity,
      localCapable: true,
    };
  }

  async function generate(request: InferenceRequest): Promise<InferenceResponse> {
    const decision = await route(request);

    if (decision.target === 'local') {
      if (!decision.localCapable) {
        throw new Error('No local model available and in offline mode');
      }
      return localInference.generate(request);
    }

    // Server path
    try {
      const result = await callServer(serverUrl, request);
      serverAvailable = true;
      lastServerCheck = Date.now();

      return {
        id: request.id,
        text: result.text,
        tokensGenerated: result.tokensGenerated,
        durationMs: result.durationMs,
        model: result.model,
        routedTo: 'server',
      };
    } catch {
      serverAvailable = false;
      lastServerCheck = Date.now();

      // Fallback to local if available
      if (localInference.isModelLoaded()) {
        return localInference.generate(request);
      }

      throw new Error('Server unavailable and no local model loaded');
    }
  }

  function isLocalAvailable(): boolean {
    return localInference.isModelLoaded();
  }

  function isServerAvailable(): boolean {
    // Recheck if enough time has passed
    if (!serverAvailable && Date.now() - lastServerCheck > SERVER_CHECK_INTERVAL) {
      serverAvailable = true; // Optimistically assume recovered
    }
    return serverAvailable && !offlineMode;
  }

  function setOfflineMode(offline: boolean): void {
    offlineMode = offline;
  }

  return {
    route,
    generate,
    isLocalAvailable,
    isServerAvailable,
    setOfflineMode,
  };
}
