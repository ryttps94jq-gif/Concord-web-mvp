// Concord Mobile — Brain Module Barrel Export

// inference/local-inference
export {
  createLocalInference,
} from './inference/local-inference';
export type {
  InferenceRuntime,
  LocalInference,
} from './inference/local-inference';

// models/model-manager
export {
  createModelManager,
} from './models/model-manager';
export type {
  FileSystem,
  ModelManager,
} from './models/model-manager';

// routing/brain-router
export {
  createBrainRouter,
} from './routing/brain-router';
export type {
  BrainRouter,
} from './routing/brain-router';
