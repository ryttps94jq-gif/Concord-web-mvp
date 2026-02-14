/**
 * Storage adapter for durable blob/file storage.
 *
 * Provides a uniform interface for file operations.
 * v1: LocalVolumeAdapter (filesystem-backed, Docker volume)
 * Future: S3Adapter, GCSAdapter, etc.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

/**
 * @typedef {Object} PutResult
 * @property {string} uri - Storage URI (e.g., "local:///artifacts/abc123/v1/file.wav")
 * @property {string} sha256 - SHA-256 hash of the stored content
 * @property {number} size - Size in bytes
 */

/**
 * StorageAdapter interface.
 * All adapters must implement: putStream, getStream, delete, exists
 */
export class StorageAdapter {
  /** @param {string} storagePath @param {Readable|Buffer} data @param {string} contentType @returns {Promise<PutResult>} */
  async put(storagePath, data, contentType) {
    throw new Error("Not implemented");
  }

  /** @param {string} uri @returns {Promise<{stream: Readable, contentType: string, size: number}>} */
  async get(uri) {
    throw new Error("Not implemented");
  }

  /** @param {string} uri @returns {Promise<boolean>} */
  async remove(uri) {
    throw new Error("Not implemented");
  }

  /** @param {string} uri @returns {Promise<boolean>} */
  async exists(uri) {
    throw new Error("Not implemented");
  }
}

/**
 * Local filesystem adapter backed by a directory (typically a Docker volume mount).
 */
export class LocalVolumeAdapter extends StorageAdapter {
  constructor(basePath) {
    super();
    this.basePath = basePath;
    fs.mkdirSync(basePath, { recursive: true });
  }

  _uriToFilePath(uri) {
    // uri format: "local:///artifacts/abc/v1/file.wav"
    const stripped = uri.replace(/^local:\/\//, "");
    return path.join(this.basePath, stripped);
  }

  _filePathToUri(filePath) {
    const relative = path.relative(this.basePath, filePath);
    return `local:///${relative.replace(/\\/g, "/")}`;
  }

  async put(storagePath, data, contentType = "application/octet-stream") {
    const fullPath = path.join(this.basePath, storagePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    const hash = crypto.createHash("sha256");
    let size = 0;

    if (Buffer.isBuffer(data)) {
      hash.update(data);
      size = data.length;
      fs.writeFileSync(fullPath, data);
    } else if (data instanceof Readable) {
      const chunks = [];
      for await (const chunk of data) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        hash.update(buf);
        size += buf.length;
        chunks.push(buf);
      }
      fs.writeFileSync(fullPath, Buffer.concat(chunks));
    } else if (typeof data === "string") {
      // Base64 encoded string
      const buf = Buffer.from(data, "base64");
      hash.update(buf);
      size = buf.length;
      fs.writeFileSync(fullPath, buf);
    } else {
      throw new Error("Data must be a Buffer, Readable stream, or base64 string");
    }

    return {
      uri: this._filePathToUri(fullPath),
      sha256: hash.digest("hex"),
      size,
    };
  }

  async get(uri) {
    const filePath = this._uriToFilePath(uri);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${uri}`);
    }

    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".flac": "audio/flac",
      ".ogg": "audio/ogg",
      ".aac": "audio/aac",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".json": "application/json",
      ".txt": "text/plain",
      ".zip": "application/zip",
    };

    return {
      stream: fs.createReadStream(filePath),
      contentType: mimeMap[ext] || "application/octet-stream",
      size: stats.size,
    };
  }

  async remove(uri) {
    const filePath = this._uriToFilePath(uri);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  async exists(uri) {
    const filePath = this._uriToFilePath(uri);
    return fs.existsSync(filePath);
  }
}

/**
 * Create and return the default storage adapter based on environment.
 */
export function createStorageAdapter() {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const artifactsDir = path.join(dataDir, "artifacts");
  return new LocalVolumeAdapter(artifactsDir);
}
