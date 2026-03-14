// Tests for Model Manager — download, verify, manage quantized models

import { createModelManager } from '../../brain/models/model-manager';
import type { ModelManager, FileSystem } from '../../brain/models/model-manager';

// ── Mock File System ─────────────────────────────────────────────────────────

function createMockFS(): FileSystem & {
  _files: Map<string, string>;
  _downloadCalls: number;
} {
  const files = new Map<string, string>();
  let dlCalls = 0;

  return {
    _files: files,
    exists: jest.fn(async (path: string) => files.has(path) || path === 'models'),
    readFile: jest.fn(async (path: string) => {
      const content = files.get(path);
      if (!content) throw new Error(`File not found: ${path}`);
      return content;
    }),
    writeFile: jest.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    deleteFile: jest.fn(async (path: string) => {
      files.delete(path);
    }),
    mkdir: jest.fn(async () => {}),
    stat: jest.fn(async (path: string) => ({
      size: (files.get(path)?.length || 0) * 1024 * 1024,
      isFile: files.has(path),
    })),
    ls: jest.fn(async () => Array.from(files.keys())),
    downloadFile: jest.fn(async (options) => {
      dlCalls++;
      // Simulate progress callbacks
      if (options.begin) {
        options.begin({ contentLength: 1000 });
      }
      if (options.progress) {
        options.progress({ bytesWritten: 500, contentLength: 1000 });
        options.progress({ bytesWritten: 1000, contentLength: 1000 });
      }
      // Write the "downloaded" file
      files.set(options.toFile, 'model_binary_data');
      return { statusCode: 200, bytesWritten: 1000 };
    }),
    hash: jest.fn(async (_path: string, _algo: string) => 'sha256_mock_hash_abc123'),
    get _downloadCalls() { return dlCalls; },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ModelManager', () => {
  let fs: ReturnType<typeof createMockFS>;
  let manager: ModelManager;

  beforeEach(() => {
    fs = createMockFS();
    manager = createModelManager(fs);
  });

  // ── getAvailableModels ──────────────────────────────────────────────────

  describe('getAvailableModels', () => {
    it('returns the full model catalog', () => {
      const models = manager.getAvailableModels();
      expect(models.length).toBe(4);
    });

    it('includes tiny, small, base, and large models', () => {
      const models = manager.getAvailableModels();
      const ids = models.map(m => m.id);
      expect(ids).toContain('concord-tiny-q4');
      expect(ids).toContain('concord-small-q4');
      expect(ids).toContain('concord-base-q4');
      expect(ids).toContain('concord-large-q4');
    });

    it('all models initially show as not downloaded', () => {
      const models = manager.getAvailableModels();
      expect(models.every(m => !m.downloaded)).toBe(true);
    });

    it('all models have quantization info', () => {
      const models = manager.getAvailableModels();
      expect(models.every(m => m.quantization === 'Q4_K_M')).toBe(true);
    });

    it('all models have parameter counts', () => {
      const models = manager.getAvailableModels();
      expect(models.every(m => m.parameters !== undefined)).toBe(true);
    });

    it('returns copies, not references', () => {
      const models1 = manager.getAvailableModels();
      const models2 = manager.getAvailableModels();
      expect(models1[0]).not.toBe(models2[0]);
      expect(models1[0]).toEqual(models2[0]);
    });

    it('models are progressively sized (tiny < small < base < large)', () => {
      const models = manager.getAvailableModels();
      const sorted = [...models].sort((a, b) => a.sizeMB - b.sizeMB);
      expect(sorted[0].id).toBe('concord-tiny-q4');
      expect(sorted[sorted.length - 1].id).toBe('concord-large-q4');
    });
  });

  // ── getDownloadedModels ─────────────────────────────────────────────────

  describe('getDownloadedModels', () => {
    it('returns empty array when nothing downloaded', () => {
      const downloaded = manager.getDownloadedModels();
      expect(downloaded).toEqual([]);
    });

    it('returns only downloaded models', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      const downloaded = manager.getDownloadedModels();
      expect(downloaded.length).toBe(1);
      expect(downloaded[0].id).toBe('concord-tiny-q4');
    });

    it('reflects downloaded state correctly', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      const downloaded = manager.getDownloadedModels();
      expect(downloaded[0].downloaded).toBe(true);
    });
  });

  // ── downloadModel ───────────────────────────────────────────────────────

  describe('downloadModel', () => {
    it('downloads a model successfully', async () => {
      const result = await manager.downloadModel('concord-tiny-q4', () => {});
      expect(result).toBe(true);
    });

    it('calls onProgress during download', async () => {
      const progressCalls: number[] = [];
      await manager.downloadModel('concord-tiny-q4', (p) => progressCalls.push(p));
      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1]).toBe(1); // Final progress is 1
    });

    it('reports initial progress of 0', async () => {
      const progressCalls: number[] = [];
      await manager.downloadModel('concord-tiny-q4', (p) => progressCalls.push(p));
      expect(progressCalls[0]).toBe(0);
    });

    it('saves model to models directory', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      expect(fs._files.has('models/concord-tiny-q4.gguf')).toBe(true);
    });

    it('saves manifest after download', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      expect(fs._files.has('models/manifest.json')).toBe(true);
    });

    it('computes and stores file hash', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      expect(fs.hash).toHaveBeenCalled();
    });

    it('returns true immediately if already downloaded', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      const progressCalls: number[] = [];
      const result = await manager.downloadModel('concord-tiny-q4', (p) => progressCalls.push(p));
      expect(result).toBe(true);
      expect(progressCalls).toContain(1);
    });

    it('throws for unknown model ID', async () => {
      await expect(
        manager.downloadModel('nonexistent-model', () => {})
      ).rejects.toThrow(/Unknown model ID/);
    });

    it('returns false on download failure', async () => {
      (fs.downloadFile as jest.Mock).mockResolvedValueOnce({ statusCode: 500, bytesWritten: 0 });
      const result = await manager.downloadModel('concord-tiny-q4', () => {});
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      (fs.downloadFile as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      const result = await manager.downloadModel('concord-tiny-q4', () => {});
      expect(result).toBe(false);
    });

    it('updates storage used after download', async () => {
      const beforeStorage = manager.getStorageUsedMB();
      await manager.downloadModel('concord-tiny-q4', () => {});
      const afterStorage = manager.getStorageUsedMB();
      expect(afterStorage).toBeGreaterThan(beforeStorage);
    });
  });

  // ── deleteModel ─────────────────────────────────────────────────────────

  describe('deleteModel', () => {
    it('deletes a downloaded model', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      const result = await manager.deleteModel('concord-tiny-q4');
      expect(result).toBe(true);
    });

    it('removes file from filesystem', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      await manager.deleteModel('concord-tiny-q4');
      expect(fs.deleteFile).toHaveBeenCalledWith('models/concord-tiny-q4.gguf');
    });

    it('updates manifest after deletion', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      await manager.deleteModel('concord-tiny-q4');
      const manifest = JSON.parse(fs._files.get('models/manifest.json')!);
      expect(manifest.models['concord-tiny-q4']).toBeUndefined();
    });

    it('returns false for non-existent model', async () => {
      const result = await manager.deleteModel('nonexistent');
      expect(result).toBe(false);
    });

    it('returns false for model not downloaded', async () => {
      const result = await manager.deleteModel('concord-tiny-q4');
      expect(result).toBe(false);
    });

    it('reduces storage used', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      const before = manager.getStorageUsedMB();
      await manager.deleteModel('concord-tiny-q4');
      const after = manager.getStorageUsedMB();
      expect(after).toBeLessThan(before);
    });

    it('marks model as not downloaded', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      await manager.deleteModel('concord-tiny-q4');
      const downloaded = manager.getDownloadedModels();
      expect(downloaded.find(m => m.id === 'concord-tiny-q4')).toBeUndefined();
    });

    it('storage never goes below zero', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      await manager.deleteModel('concord-tiny-q4');
      await manager.deleteModel('concord-tiny-q4'); // Double delete
      expect(manager.getStorageUsedMB()).toBeGreaterThanOrEqual(0);
    });
  });

  // ── verifyModel ─────────────────────────────────────────────────────────

  describe('verifyModel', () => {
    it('returns true for verified model', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      const valid = await manager.verifyModel('concord-tiny-q4');
      expect(valid).toBe(true);
    });

    it('returns false for non-existent model', async () => {
      const valid = await manager.verifyModel('nonexistent');
      expect(valid).toBe(false);
    });

    it('returns false for non-downloaded model', async () => {
      const valid = await manager.verifyModel('concord-tiny-q4');
      expect(valid).toBe(false);
    });

    it('returns false when file is missing from disk', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      // Remove the file but keep the model state
      (fs.exists as jest.Mock).mockImplementation(async (path: string) => {
        if (path.includes('concord-tiny-q4.gguf')) return false;
        return true;
      });
      const valid = await manager.verifyModel('concord-tiny-q4');
      expect(valid).toBe(false);
    });

    it('returns false when hash does not match', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      (fs.hash as jest.Mock).mockResolvedValueOnce('different_hash');
      const valid = await manager.verifyModel('concord-tiny-q4');
      expect(valid).toBe(false);
    });

    it('uses sha256 algorithm for hash check', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      await manager.verifyModel('concord-tiny-q4');
      expect(fs.hash).toHaveBeenCalledWith(expect.any(String), 'sha256');
    });
  });

  // ── getModelPath ────────────────────────────────────────────────────────

  describe('getModelPath', () => {
    it('returns path for downloaded model', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      const path = manager.getModelPath('concord-tiny-q4');
      expect(path).toBe('models/concord-tiny-q4.gguf');
    });

    it('returns null for non-downloaded model', () => {
      const path = manager.getModelPath('concord-tiny-q4');
      expect(path).toBeNull();
    });

    it('returns null for unknown model', () => {
      const path = manager.getModelPath('unknown');
      expect(path).toBeNull();
    });
  });

  // ── getStorageUsedMB ────────────────────────────────────────────────────

  describe('getStorageUsedMB', () => {
    it('returns 0 when nothing downloaded', () => {
      expect(manager.getStorageUsedMB()).toBe(0);
    });

    it('accumulates storage for multiple downloads', async () => {
      await manager.downloadModel('concord-tiny-q4', () => {});
      await manager.downloadModel('concord-small-q4', () => {});
      const used = manager.getStorageUsedMB();
      expect(used).toBe(150 + 400); // tiny + small
    });
  });
});
