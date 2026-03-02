// Concord Mobile — Model Manager
// Downloads and manages quantized models for on-device inference.
// Progressive: start small, offer larger models as optional upgrades.

import {
  BRAIN_DEFAULT_MODEL_SIZE_MB,
} from '../../utils/constants';
import type { LocalModel } from '../../utils/types';

// ── File System Interface ────────────────────────────────────────────────────

export interface FileSystem {
  exists(path: string): Promise<boolean>;
  readFile(path: string, encoding?: string): Promise<string>;
  writeFile(path: string, content: string, encoding?: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  stat(path: string): Promise<{ size: number; isFile: boolean }>;
  ls(path: string): Promise<string[]>;
  downloadFile(options: {
    fromUrl: string;
    toFile: string;
    progressInterval?: number;
    begin?: (res: { contentLength: number }) => void;
    progress?: (res: { bytesWritten: number; contentLength: number }) => void;
  }): Promise<{ statusCode: number; bytesWritten: number }>;
  hash(path: string, algorithm: string): Promise<string>;
}

// ── Model Catalog ────────────────────────────────────────────────────────────

const MODEL_CATALOG: LocalModel[] = [
  {
    id: 'concord-tiny-q4',
    name: 'Concord Tiny (4-bit)',
    sizeMB: 150,
    quantization: 'Q4_K_M',
    parameters: '0.5B',
    downloaded: false,
    downloadProgress: 0,
  },
  {
    id: 'concord-small-q4',
    name: 'Concord Small (4-bit)',
    sizeMB: 400,
    quantization: 'Q4_K_M',
    parameters: '1B',
    downloaded: false,
    downloadProgress: 0,
  },
  {
    id: 'concord-base-q4',
    name: 'Concord Base (4-bit)',
    sizeMB: BRAIN_DEFAULT_MODEL_SIZE_MB,
    quantization: 'Q4_K_M',
    parameters: '1.5B',
    downloaded: false,
    downloadProgress: 0,
  },
  {
    id: 'concord-large-q4',
    name: 'Concord Large (4-bit)',
    sizeMB: 1600,
    quantization: 'Q4_K_M',
    parameters: '3B',
    downloaded: false,
    downloadProgress: 0,
  },
];

const MODEL_BASE_URL = 'https://models.concordcognitive.org/v1/';
const MODELS_DIR = 'models';
const MANIFEST_FILE = 'manifest.json';

// ── Model Manager Interface ──────────────────────────────────────────────────

export interface ModelManager {
  getAvailableModels(): LocalModel[];
  getDownloadedModels(): LocalModel[];
  downloadModel(modelId: string, onProgress: (progress: number) => void): Promise<boolean>;
  deleteModel(modelId: string): Promise<boolean>;
  verifyModel(modelId: string): Promise<boolean>;
  getModelPath(modelId: string): string | null;
  getStorageUsedMB(): number;
}

// ── Internal State ───────────────────────────────────────────────────────────

interface ModelManifest {
  models: Record<string, {
    downloaded: boolean;
    filePath: string;
    hash: string;
    downloadedAt: number;
  }>;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createModelManager(fs: FileSystem): ModelManager {
  const models: Map<string, LocalModel> = new Map();
  let manifest: ModelManifest = { models: {} };
  let initialized = false;
  let storageUsedMB = 0;

  // Initialize catalog
  for (const model of MODEL_CATALOG) {
    models.set(model.id, { ...model });
  }

  async function ensureInitialized(): Promise<void> {
    if (initialized) return;

    // Ensure models directory exists
    const modelsDir = MODELS_DIR;
    const dirExists = await fs.exists(modelsDir);
    if (!dirExists) {
      await fs.mkdir(modelsDir);
    }

    // Load manifest
    const manifestPath = `${modelsDir}/${MANIFEST_FILE}`;
    const manifestExists = await fs.exists(manifestPath);
    if (manifestExists) {
      try {
        const content = await fs.readFile(manifestPath, 'utf8');
        manifest = JSON.parse(content);
      } catch {
        manifest = { models: {} };
      }
    }

    // Sync manifest with model state
    for (const [modelId, info] of Object.entries(manifest.models)) {
      const model = models.get(modelId);
      if (model && info.downloaded) {
        const fileExists = await fs.exists(info.filePath);
        if (fileExists) {
          model.downloaded = true;
          model.downloadProgress = 1;
          model.filePath = info.filePath;
          model.hash = info.hash;
          storageUsedMB += model.sizeMB;
        } else {
          // File missing, mark as not downloaded
          model.downloaded = false;
          model.downloadProgress = 0;
          delete manifest.models[modelId];
        }
      }
    }

    initialized = true;
  }

  async function saveManifest(): Promise<void> {
    const manifestPath = `${MODELS_DIR}/${MANIFEST_FILE}`;
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  function getAvailableModels(): LocalModel[] {
    return Array.from(models.values()).map(m => ({ ...m }));
  }

  function getDownloadedModels(): LocalModel[] {
    return Array.from(models.values())
      .filter(m => m.downloaded)
      .map(m => ({ ...m }));
  }

  async function downloadModel(
    modelId: string,
    onProgress: (progress: number) => void
  ): Promise<boolean> {
    await ensureInitialized();

    const model = models.get(modelId);
    if (!model) {
      throw new Error(`Unknown model ID: ${modelId}`);
    }

    if (model.downloaded) {
      onProgress(1);
      return true;
    }

    const url = `${MODEL_BASE_URL}${modelId}.gguf`;
    const filePath = `${MODELS_DIR}/${modelId}.gguf`;

    try {
      model.downloadProgress = 0;
      onProgress(0);

      const result = await fs.downloadFile({
        fromUrl: url,
        toFile: filePath,
        progressInterval: 250,
        begin: () => {
          // Download started
        },
        progress: (res) => {
          const progress = res.contentLength > 0
            ? res.bytesWritten / res.contentLength
            : 0;
          model.downloadProgress = progress;
          onProgress(progress);
        },
      });

      if (result.statusCode !== 200) {
        model.downloadProgress = 0;
        return false;
      }

      // Get file hash for verification
      const fileHash = await fs.hash(filePath, 'sha256');

      // Update model state
      model.downloaded = true;
      model.downloadProgress = 1;
      model.filePath = filePath;
      model.hash = fileHash;
      storageUsedMB += model.sizeMB;

      // Update manifest
      manifest.models[modelId] = {
        downloaded: true,
        filePath,
        hash: fileHash,
        downloadedAt: Date.now(),
      };
      await saveManifest();

      onProgress(1);
      return true;
    } catch {
      model.downloadProgress = 0;
      return false;
    }
  }

  async function deleteModel(modelId: string): Promise<boolean> {
    await ensureInitialized();

    const model = models.get(modelId);
    if (!model) {
      return false;
    }

    if (!model.downloaded || !model.filePath) {
      return false;
    }

    try {
      await fs.deleteFile(model.filePath);

      storageUsedMB -= model.sizeMB;
      if (storageUsedMB < 0) storageUsedMB = 0;

      model.downloaded = false;
      model.downloadProgress = 0;
      model.filePath = undefined;
      model.hash = undefined;

      delete manifest.models[modelId];
      await saveManifest();

      return true;
    } catch {
      return false;
    }
  }

  async function verifyModel(modelId: string): Promise<boolean> {
    await ensureInitialized();

    const model = models.get(modelId);
    if (!model || !model.downloaded || !model.filePath) {
      return false;
    }

    try {
      const fileExists = await fs.exists(model.filePath);
      if (!fileExists) {
        model.downloaded = false;
        model.downloadProgress = 0;
        return false;
      }

      const currentHash = await fs.hash(model.filePath, 'sha256');
      const expectedHash = manifest.models[modelId]?.hash || model.hash;

      if (!expectedHash) {
        return false;
      }

      return currentHash === expectedHash;
    } catch {
      return false;
    }
  }

  function getModelPath(modelId: string): string | null {
    const model = models.get(modelId);
    if (!model || !model.downloaded || !model.filePath) {
      return null;
    }
    return model.filePath;
  }

  function getStorageUsedMB(): number {
    return storageUsedMB;
  }

  return {
    getAvailableModels,
    getDownloadedModels,
    downloadModel,
    deleteModel,
    verifyModel,
    getModelPath,
    getStorageUsedMB,
  };
}
