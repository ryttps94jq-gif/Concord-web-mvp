import fs from "fs";
import path from "path";
import crypto from "crypto";
import zlib from "zlib";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const ARTIFACT_ROOT = process.env.ARTIFACT_DIR || path.join(DATA_DIR, "artifacts");
const MAX_ARTIFACT_SIZE = 100 * 1024 * 1024; // 100MB per artifact
const GZIP_LEVEL = 6; // balanced speed/ratio

// ---- LRU Preview Cache (200 items, 5 min TTL) ----
const PREVIEW_CACHE_MAX = 200;
const PREVIEW_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const _previewCache = new Map(); // key → { data, ts }

function previewCacheGet(key) {
  const entry = _previewCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > PREVIEW_CACHE_TTL) {
    _previewCache.delete(key);
    return null;
  }
  // LRU: move to end
  _previewCache.delete(key);
  _previewCache.set(key, entry);
  return entry.data;
}

function previewCacheSet(key, data) {
  if (_previewCache.size >= PREVIEW_CACHE_MAX) {
    // Evict oldest (first key)
    const oldest = _previewCache.keys().next().value;
    _previewCache.delete(oldest);
  }
  _previewCache.set(key, { data, ts: Date.now() });
}

export function previewCacheStats() {
  return { size: _previewCache.size, max: PREVIEW_CACHE_MAX, ttlMs: PREVIEW_CACHE_TTL };
}

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
  "text/csv": { ext: "csv", compressible: true, previewable: true },
  "text/calendar": { ext: "ics", compressible: true, previewable: false },
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

  // Always compress compressible types at level 6
  let compressedPath = null;
  if (typeInfo.compressible) {
    const compressed = zlib.gzipSync(buffer, { level: GZIP_LEVEL });
    compressedPath = diskPath + ".gz";
    fs.writeFileSync(compressedPath, compressed);
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

/**
 * Read artifact bytes — tries compressed first, falls back to raw.
 * Backwards compatible: works whether artifact was stored before or after compression.
 */
export function retrieveArtifact(dtuId, artifactRef) {
  if (!artifactRef?.diskPath) return null;
  artifactRef.lastAccessedAt = new Date().toISOString();

  // Prefer compressed path (decompress on read)
  if (artifactRef.compressedPath && fs.existsSync(artifactRef.compressedPath)) {
    return zlib.gunzipSync(fs.readFileSync(artifactRef.compressedPath));
  }
  // Fallback: raw file (pre-compression artifacts)
  if (fs.existsSync(artifactRef.diskPath)) {
    return fs.readFileSync(artifactRef.diskPath);
  }
  return null;
}

/**
 * Read artifact bytes with LRU preview cache.
 * Used for preview/thumbnail endpoints that get hit repeatedly.
 */
export function retrieveArtifactCached(dtuId, artifactRef) {
  if (!artifactRef?.diskPath) return null;
  const cacheKey = `${dtuId}:${artifactRef.filename || path.basename(artifactRef.diskPath)}`;

  const cached = previewCacheGet(cacheKey);
  if (cached) return cached;

  const data = retrieveArtifact(dtuId, artifactRef);
  if (data) previewCacheSet(cacheKey, data);
  return data;
}

export function retrieveArtifactStream(artifactRef) {
  if (!artifactRef?.diskPath) return null;
  artifactRef.lastAccessedAt = new Date().toISOString();

  // Prefer compressed — create a decompress stream
  if (artifactRef.compressedPath && fs.existsSync(artifactRef.compressedPath)) {
    return fs.createReadStream(artifactRef.compressedPath).pipe(zlib.createGunzip());
  }
  // Fallback to raw
  if (fs.existsSync(artifactRef.diskPath)) {
    return fs.createReadStream(artifactRef.diskPath);
  }
  return null;
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

// ---- MEGA Compression Cascade ----
// When DTUs consolidate into a MEGA, keep only top 3 exemplar files.
// Compress the rest into a single archive. Frees disk but retains access.

/**
 * Compress source DTU artifacts after MEGA consolidation.
 * Keeps topN exemplar files uncompressed, archives the rest.
 *
 * @param {string} megaId - The MEGA DTU id
 * @param {string[]} sourceDtuIds - Source DTU ids being consolidated
 * @param {object} STATE - Server state (needs STATE.dtus)
 * @param {number} [topN=3] - Number of exemplar files to keep
 * @returns {{ archived: number, keptExemplars: number, savedBytes: number }}
 */
export function megaCompressionCascade(megaId, sourceDtuIds, STATE, topN = 3) {
  let archived = 0;
  let savedBytes = 0;
  const exemplars = [];

  // Rank source artifacts by quality/size
  const ranked = sourceDtuIds
    .map(id => {
      const dtu = STATE.dtus?.get(id);
      if (!dtu?.artifact) return null;
      return {
        id,
        artifact: dtu.artifact,
        score: (dtu.qualityTier === "verified" ? 3 : dtu.qualityTier === "reviewed" ? 2 : 1),
        size: dtu.artifact.sizeBytes || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.size - a.size);

  // Keep top N as exemplars
  for (let i = 0; i < ranked.length; i++) {
    if (i < topN) {
      exemplars.push(ranked[i].id);
      continue;
    }

    // Archive the rest: ensure compressed, remove raw file
    const art = ranked[i].artifact;
    if (!art.compressed && art.diskPath && fs.existsSync(art.diskPath)) {
      try {
        const raw = fs.readFileSync(art.diskPath);
        const compressed = zlib.gzipSync(raw, { level: GZIP_LEVEL });
        const gzPath = art.diskPath + ".gz";
        fs.writeFileSync(gzPath, compressed);
        art.compressedPath = gzPath;
        art.compressed = true;
        // Remove raw file to save disk
        fs.unlinkSync(art.diskPath);
        savedBytes += raw.length - compressed.length;
        archived++;
      } catch {
        // If compression fails, leave as-is
      }
    }
  }

  return { archived, keptExemplars: exemplars.length, savedBytes };
}

// ---- Shadow Vault ----
// Entity-produced artifacts pass quality gate but get tagged "shadow_vault"
// instead of "marketplace_ready". Only top 2% surface to users.

/**
 * Apply shadow vault logic to an entity-produced artifact after quality tier assignment.
 * 98% of entity artifacts go to shadow_vault; 2% surface as marketplace_ready.
 *
 * @param {object} artifact - The artifact/DTU object
 * @param {object} tier - The quality tier result { status, score, ... }
 * @returns {object} Modified tier with shadow_vault applied if needed
 */
export function applyShadowVault(artifact, tier) {
  if (tier.status !== "marketplace_ready") return tier;

  const createdBy = artifact.meta?.createdBy || artifact.createdBy || "";
  if (!createdBy.startsWith("entity")) return tier;

  // Shadow 98% of entity production
  if (Math.random() > 0.02) {
    return { ...tier, status: "shadow_vault" };
  }
  return tier;
}

/**
 * Unshadow the top N artifacts in a domain from the shadow vault.
 * Used by admin to curate marketplace visibility.
 *
 * @param {string} domain - Domain to unshadow from
 * @param {number} count - Number of artifacts to unshadow
 * @param {object} STATE - Server state
 * @returns {{ unshadowed: string[] }}
 */
export function unshadowTopArtifacts(domain, count, STATE) {
  const candidates = [];

  for (const [id, dtu] of STATE.dtus || []) {
    if (dtu.domain !== domain) continue;
    if (dtu.qualityTier !== "shadow_vault" && dtu.status !== "shadow_vault") continue;
    candidates.push({
      id,
      dtu,
      score: dtu.qualityScore || dtu.validationScore || 0,
      maturity: dtu.entityMaturity || 0,
    });
  }

  // Sort by quality score descending, then entity maturity
  candidates.sort((a, b) => b.score - a.score || b.maturity - a.maturity);
  const toUnshadow = candidates.slice(0, count);

  const unshadowed = [];
  for (const c of toUnshadow) {
    if (c.dtu.qualityTier) c.dtu.qualityTier = "marketplace_ready";
    if (c.dtu.status === "shadow_vault") c.dtu.status = "marketplace_ready";
    unshadowed.push(c.id);
  }

  return { unshadowed };
}

// ---- Migration: Compress Existing Artifacts ----

/**
 * One-time migration: compress all existing uncompressed compressible artifacts.
 * Safe to run multiple times — skips already-compressed files.
 *
 * @returns {{ migrated: number, skipped: number, errors: number, savedBytes: number }}
 */
export function migrateArtifactsToCompressed() {
  const stats = { migrated: 0, skipped: 0, errors: 0, savedBytes: 0 };
  if (!fs.existsSync(ARTIFACT_ROOT)) return stats;

  const walk = (dir) => {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        // Skip already-compressed files, thumbnails, previews, metadata
        if (entry.name.endsWith(".gz") || entry.name === "waveform.json" ||
            entry.name === "text_preview.txt") {
          stats.skipped++;
          continue;
        }
        // Check if a .gz version already exists
        if (fs.existsSync(full + ".gz")) {
          stats.skipped++;
          continue;
        }
        // Check if this file type is compressible
        const ext = path.extname(entry.name).slice(1);
        const isCompressible = Object.values(SUPPORTED_TYPES).some(
          t => t.ext === ext && t.compressible
        );
        if (!isCompressible) {
          stats.skipped++;
          continue;
        }
        try {
          const raw = fs.readFileSync(full);
          const compressed = zlib.gzipSync(raw, { level: GZIP_LEVEL });
          fs.writeFileSync(full + ".gz", compressed);
          stats.savedBytes += raw.length - compressed.length;
          stats.migrated++;
        } catch {
          stats.errors++;
        }
      }
    } catch {
      stats.errors++;
    }
  };

  walk(ARTIFACT_ROOT);
  return stats;
}
