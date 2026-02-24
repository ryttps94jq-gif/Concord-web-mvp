import fs from "fs";
import path from "path";
import crypto from "crypto";
import zlib from "zlib";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const ARTIFACT_ROOT = process.env.ARTIFACT_DIR || path.join(DATA_DIR, "artifacts");
const MAX_ARTIFACT_SIZE = 100 * 1024 * 1024; // 100MB per artifact

const SUPPORTED_TYPES = Object.freeze({
  "audio/wav": { ext: "wav", compressible: true, previewable: true },
  "audio/mpeg": { ext: "mp3", compressible: false, previewable: true },
  "audio/ogg": { ext: "ogg", compressible: false, previewable: true },
  "audio/flac": { ext: "flac", compressible: false, previewable: true },
  "audio/midi": { ext: "mid", compressible: true, previewable: false },
  "image/png": { ext: "png", compressible: false, previewable: true },
  "image/jpeg": { ext: "jpg", compressible: false, previewable: true },
  "image/webp": { ext: "webp", compressible: false, previewable: true },
  "image/svg+xml": { ext: "svg", compressible: true, previewable: true },
  "video/mp4": { ext: "mp4", compressible: false, previewable: true },
  "video/webm": { ext: "webm", compressible: false, previewable: true },
  "application/pdf": { ext: "pdf", compressible: true, previewable: true },
  "text/plain": { ext: "txt", compressible: true, previewable: true },
  "text/markdown": { ext: "md", compressible: true, previewable: true },
  "text/html": { ext: "html", compressible: true, previewable: true },
  "application/javascript": { ext: "js", compressible: true, previewable: true },
  "application/json": { ext: "json", compressible: true, previewable: true },
  "application/zip": { ext: "zip", compressible: false, previewable: false },
  "model/gltf+json": { ext: "gltf", compressible: true, previewable: false },
});

export function isSupportedType(mimeType) {
  return !!SUPPORTED_TYPES[mimeType];
}

export async function storeArtifact(dtuId, buffer, mimeType, filename) {
  if (buffer.length > MAX_ARTIFACT_SIZE) {
    throw new Error(`Artifact exceeds max size: ${buffer.length} > ${MAX_ARTIFACT_SIZE}`);
  }
  const typeInfo = SUPPORTED_TYPES[mimeType];
  if (!typeInfo) throw new Error(`Unsupported artifact type: ${mimeType}`);

  const dtuDir = path.join(ARTIFACT_ROOT, dtuId);
  fs.mkdirSync(dtuDir, { recursive: true });

  const hash = "sha256:" + crypto.createHash("sha256").update(buffer).digest("hex");
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const diskPath = path.join(dtuDir, sanitizedFilename);
  fs.writeFileSync(diskPath, buffer);

  let compressedPath = null;
  if (typeInfo.compressible) {
    const compressed = zlib.gzipSync(buffer);
    if (compressed.length < buffer.length * 0.8) {
      compressedPath = diskPath + ".gz";
      fs.writeFileSync(compressedPath, compressed);
    }
  }

  const thumbnail = generateThumbnail(dtuDir, diskPath, mimeType);
  const preview = generatePreview(dtuDir, diskPath, mimeType);

  return {
    type: mimeType,
    filename: sanitizedFilename,
    diskPath,
    sizeBytes: buffer.length,
    hash,
    compressed: !!compressedPath,
    compressedPath,
    thumbnail,
    preview,
    multipart: false,
    parts: null,
    createdAt: new Date().toISOString(),
    lastAccessedAt: null,
  };
}

export async function storeMultipartArtifact(dtuId, files) {
  const dtuDir = path.join(ARTIFACT_ROOT, dtuId);
  fs.mkdirSync(dtuDir, { recursive: true });

  const parts = [];
  let totalSize = 0;

  for (const file of files) {
    const sanitized = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(dtuDir, sanitized);
    fs.writeFileSync(filePath, file.buffer);
    totalSize += file.buffer.length;
    parts.push({
      filename: sanitized,
      type: file.mimeType,
      diskPath: filePath,
      sizeBytes: file.buffer.length,
    });
  }

  const hash = "sha256:" + crypto.createHash("sha256")
    .update(parts.map(p => p.filename).join("|")).digest("hex");

  return {
    type: "application/x-concord-collection",
    filename: `${dtuId}_collection`,
    diskPath: dtuDir,
    sizeBytes: totalSize,
    hash,
    compressed: false,
    compressedPath: null,
    thumbnail: parts[0]?.diskPath || null,
    preview: null,
    multipart: true,
    parts,
    createdAt: new Date().toISOString(),
    lastAccessedAt: null,
  };
}

export function retrieveArtifact(dtuId, artifactRef) {
  if (!artifactRef?.diskPath) return null;
  artifactRef.lastAccessedAt = new Date().toISOString();

  if (!fs.existsSync(artifactRef.diskPath)) {
    if (artifactRef.compressedPath && fs.existsSync(artifactRef.compressedPath)) {
      return zlib.gunzipSync(fs.readFileSync(artifactRef.compressedPath));
    }
    return null;
  }
  return fs.readFileSync(artifactRef.diskPath);
}

export function retrieveArtifactStream(artifactRef) {
  if (!artifactRef?.diskPath || !fs.existsSync(artifactRef.diskPath)) return null;
  artifactRef.lastAccessedAt = new Date().toISOString();
  return fs.createReadStream(artifactRef.diskPath);
}

export function deleteArtifact(dtuId) {
  const dtuDir = path.join(ARTIFACT_ROOT, dtuId);
  if (fs.existsSync(dtuDir)) {
    fs.rmSync(dtuDir, { recursive: true, force: true });
  }
}

export function getArtifactDiskUsage() {
  let total = 0;
  if (!fs.existsSync(ARTIFACT_ROOT)) return 0;
  const walk = (dir) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else try { total += fs.statSync(full).size; } catch {}
      }
    } catch {}
  };
  walk(ARTIFACT_ROOT);
  return total;
}

export function inferDomainFromType(mimeType) {
  if (mimeType.startsWith("audio/")) return "music";
  if (mimeType.startsWith("image/")) return "art";
  if (mimeType.startsWith("video/")) return "studio";
  if (mimeType.includes("pdf") || mimeType.includes("document")) return "legal";
  if (mimeType.includes("spreadsheet")) return "finance";
  if (mimeType.startsWith("text/")) return "creative";
  return "general";
}

export function inferKindFromType(mimeType) {
  if (mimeType.startsWith("audio/")) return "music_composition";
  if (mimeType.startsWith("image/")) return "artwork";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("pdf")) return "document";
  if (mimeType.startsWith("text/")) return "text_content";
  if (mimeType.includes("json") || mimeType.includes("javascript")) return "code_module";
  return "binary_artifact";
}

function generateThumbnail(dtuDir, filePath, mimeType) {
  if (mimeType.startsWith("image/")) return filePath;
  if (mimeType.startsWith("audio/")) {
    try {
      const buffer = fs.readFileSync(filePath);
      const peaks = extractWaveformPeaks(buffer, 200);
      const waveformPath = path.join(dtuDir, "waveform.json");
      fs.writeFileSync(waveformPath, JSON.stringify(peaks));
      return waveformPath;
    } catch { return null; }
  }
  if (mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/javascript") {
    try {
      const text = fs.readFileSync(filePath, "utf-8").slice(0, 500);
      const previewPath = path.join(dtuDir, "text_preview.txt");
      fs.writeFileSync(previewPath, text);
      return previewPath;
    } catch { return null; }
  }
  return null;
}

function generatePreview(dtuDir, filePath, mimeType) {
  if (mimeType.startsWith("audio/")) return filePath;
  return null;
}

function extractWaveformPeaks(buffer, numPoints) {
  const peaks = [];
  const step = Math.max(1, Math.floor(buffer.length / numPoints));
  for (let i = 0; i < numPoints; i++) {
    const offset = Math.min(i * step + 44, buffer.length - 2);
    if (offset < 0 || offset >= buffer.length - 1) { peaks.push(0); continue; }
    try {
      const val = Math.abs(buffer.readInt16LE(offset));
      peaks.push(val / 32768);
    } catch { peaks.push(0); }
  }
  return peaks;
}
