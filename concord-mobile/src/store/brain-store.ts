// Concord Mobile — Brain Store (Zustand)
// Manages local inference state, model management, and routing decisions

import { create } from 'zustand';
import type { LocalModel, InferenceRequest, InferenceResponse, BrainRoutingDecision } from '../utils/types';

interface BrainStore {
  // Models
  availableModels: LocalModel[];
  activeModelId: string | null;
  isModelLoaded: boolean;
  setAvailableModels: (models: LocalModel[]) => void;
  updateModelProgress: (modelId: string, progress: number) => void;
  markModelDownloaded: (modelId: string, filePath: string, hash: string) => void;
  removeModel: (modelId: string) => void;
  setActiveModel: (modelId: string | null) => void;
  setModelLoaded: (loaded: boolean) => void;

  // Inference
  isInferring: boolean;
  currentRequest: InferenceRequest | null;
  requestQueue: InferenceRequest[];
  lastResponse: InferenceResponse | null;
  totalInferences: number;
  setInferring: (inferring: boolean) => void;
  setCurrentRequest: (request: InferenceRequest | null) => void;
  enqueueRequest: (request: InferenceRequest) => void;
  dequeueRequest: () => InferenceRequest | undefined;
  setLastResponse: (response: InferenceResponse) => void;

  // Routing
  offlineMode: boolean;
  serverAvailable: boolean;
  setOfflineMode: (offline: boolean) => void;
  setServerAvailable: (available: boolean) => void;
  lastRoutingDecision: BrainRoutingDecision | null;
  setLastRoutingDecision: (decision: BrainRoutingDecision) => void;

  // Memory
  memoryUsageMB: number;
  setMemoryUsage: (mb: number) => void;

  reset: () => void;
}

const defaultModels: LocalModel[] = [
  {
    id: 'qwen-0.5b-q4',
    name: 'Qwen 0.5B (4-bit)',
    sizeMB: 350,
    quantization: 'Q4_K_M',
    parameters: '0.5B',
    downloaded: false,
    downloadProgress: 0,
  },
  {
    id: 'qwen-1.5b-q4',
    name: 'Qwen 1.5B (4-bit)',
    sizeMB: 800,
    quantization: 'Q4_K_M',
    parameters: '1.5B',
    downloaded: false,
    downloadProgress: 0,
  },
  {
    id: 'qwen-3b-q4',
    name: 'Qwen 3B (4-bit)',
    sizeMB: 1800,
    quantization: 'Q4_K_M',
    parameters: '3B',
    downloaded: false,
    downloadProgress: 0,
  },
];

export const useBrainStore = create<BrainStore>((set, get) => ({
  availableModels: [...defaultModels],
  activeModelId: null,
  isModelLoaded: false,
  isInferring: false,
  currentRequest: null,
  requestQueue: [],
  lastResponse: null,
  totalInferences: 0,
  offlineMode: false,
  serverAvailable: false,
  lastRoutingDecision: null,
  memoryUsageMB: 0,

  setAvailableModels: (models) => set({ availableModels: models }),

  updateModelProgress: (modelId, progress) => set(state => ({
    availableModels: state.availableModels.map(m =>
      m.id === modelId ? { ...m, downloadProgress: progress } : m
    ),
  })),

  markModelDownloaded: (modelId, filePath, hash) => set(state => ({
    availableModels: state.availableModels.map(m =>
      m.id === modelId
        ? { ...m, downloaded: true, downloadProgress: 1, filePath, hash }
        : m
    ),
  })),

  removeModel: (modelId) => set(state => ({
    availableModels: state.availableModels.map(m =>
      m.id === modelId
        ? { ...m, downloaded: false, downloadProgress: 0, filePath: undefined, hash: undefined }
        : m
    ),
    activeModelId: state.activeModelId === modelId ? null : state.activeModelId,
    isModelLoaded: state.activeModelId === modelId ? false : state.isModelLoaded,
  })),

  setActiveModel: (modelId) => set({ activeModelId: modelId }),
  setModelLoaded: (loaded) => set({ isModelLoaded: loaded }),

  setInferring: (inferring) => set({ isInferring: inferring }),

  setCurrentRequest: (request) => set({ currentRequest: request }),

  enqueueRequest: (request) => set(state => ({
    requestQueue: [...state.requestQueue, request],
  })),

  dequeueRequest: () => {
    const state = get();
    if (state.requestQueue.length === 0) return undefined;
    const [next, ...rest] = state.requestQueue;
    set({ requestQueue: rest });
    return next;
  },

  setLastResponse: (response) => set(state => ({
    lastResponse: response,
    totalInferences: state.totalInferences + 1,
  })),

  setOfflineMode: (offline) => set({ offlineMode: offline }),
  setServerAvailable: (available) => set({ serverAvailable: available }),
  setLastRoutingDecision: (decision) => set({ lastRoutingDecision: decision }),
  setMemoryUsage: (mb) => set({ memoryUsageMB: mb }),

  reset: () => set({
    availableModels: [...defaultModels],
    activeModelId: null,
    isModelLoaded: false,
    isInferring: false,
    currentRequest: null,
    requestQueue: [],
    lastResponse: null,
    totalInferences: 0,
    offlineMode: false,
    serverAvailable: false,
    lastRoutingDecision: null,
    memoryUsageMB: 0,
  }),
}));
