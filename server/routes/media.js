/**
 * Concord — Media Upload & Transcode Pipeline Routes
 *
 * Provides:
 *   POST /api/media/upload          - Multipart file upload, create media DTU
 *   POST /api/media/upload/url      - Remote URL ingest
 *   GET  /api/media/:id             - Get media DTU with streaming URLs
 *   GET  /api/media/:id/stream      - Stream media content (range requests)
 *   GET  /api/media/:id/thumbnail   - Get thumbnail
 *   GET  /api/media/:id/manifest.m3u8 - HLS manifest
 *   POST /api/media/:id/transcode   - Trigger transcode to different quality
 *   GET  /api/media/feed            - Media feed (for-you, following, trending)
 *   POST /api/media/:id/view        - Record view
 *   POST /api/media/:id/like        - Like/unlike
 *   POST /api/media/:id/comment     - Add comment
 *   GET  /api/media/:id/comments    - Get comments
 *   DELETE /api/media/:id           - Delete media
 */

import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";
import {
  createMediaDTU,
  getMediaDTU,
  updateMediaDTU,
  deleteMediaDTU,
  recordView,
  toggleLike,
  addComment,
  getComments,
  initiateTranscode,
  generateThumbnail,
  generateHLSManifest,
  getMediaFeed,
  getMediaByAuthor,
  getMediaMetrics,
  detectMediaType,
  MEDIA_TYPES,
  QUALITY_PRESETS,
  MAX_FILE_SIZES,
} from "../lib/media-dtu.js";

/**
 * Create the media routes router.
 * Follows the same pattern as film-studio and connective-tissue routes.
 *
 * @param {{ STATE: object }} deps - Dependencies injected from server.js
 * @returns {Router}
 */
export default function createMediaRouter({ STATE }) {
  const router = Router();

  // ── Upload ────────────────────────────────────────────────────────────

  /**
   * POST /upload — Accept multipart file upload and create a media DTU.
   *
   * Since multer may not be installed, we accept JSON-based uploads with
   * base64-encoded data or file metadata. In production, this would use
   * multer for proper multipart handling.
   *
   * Body (JSON):
   *   - title: string (required)
   *   - description: string
   *   - mediaType: 'audio' | 'video' | 'image' | 'document' | 'stream'
   *   - mimeType: string
   *   - fileSize: number (bytes)
   *   - originalFilename: string
   *   - duration: number (seconds, for audio/video)
   *   - resolution: { width, height } (for video/image)
   *   - codec: string
   *   - bitrate: number
   *   - tags: string[]
   *   - privacy: 'public' | 'private' | 'followers-only'
   *   - tier: string
   *   - data: string (base64-encoded file data, optional)
   */
  router.post("/upload", asyncHandler(async (req, res) => {
    const authorId = req.user?.id || req.body.authorId;
    if (!authorId) throw new ValidationError("authorId is required");

    const {
      title,
      description,
      mediaType,
      mimeType,
      fileSize = 0,
      originalFilename,
      duration,
      resolution,
      codec,
      bitrate,
      tags,
      privacy,
      tier,
    } = req.body;

    if (!title) throw new ValidationError("title is required");

    // Auto-detect media type from MIME if not specified
    const resolvedMediaType = mediaType || (mimeType ? detectMediaType(mimeType) : null);
    if (!resolvedMediaType) {
      throw new ValidationError("mediaType or mimeType is required");
    }

    const result = createMediaDTU(STATE, {
      authorId,
      title,
      description,
      mediaType: resolvedMediaType,
      mimeType,
      fileSize,
      originalFilename,
      duration,
      resolution,
      codec,
      bitrate,
      tags,
      privacy,
      tier,
    });

    if (!result.ok) {
      throw new ValidationError(result.error);
    }

    // Auto-generate thumbnail
    generateThumbnail(STATE, result.mediaDTU.id);

    // Auto-initiate transcode for audio/video
    if (resolvedMediaType === "audio" || resolvedMediaType === "video") {
      const defaultQualities = resolvedMediaType === "audio"
        ? ["medium", "high"]
        : ["720p", "1080p"];

      for (const quality of defaultQualities) {
        initiateTranscode(STATE, result.mediaDTU.id, quality);
      }
    }

    res.status(201).json({
      ok: true,
      mediaDTU: result.mediaDTU,
    });
  }));

  // ── Upload via URL ────────────────────────────────────────────────────

  /**
   * POST /upload/url — Ingest media from a remote URL.
   *
   * Body:
   *   - url: string (required) — URL of the media to ingest
   *   - title: string (required)
   *   - description: string
   *   - mediaType: string
   *   - tags: string[]
   *   - privacy: string
   */
  router.post("/upload/url", asyncHandler(async (req, res) => {
    const authorId = req.user?.id || req.body.authorId;
    if (!authorId) throw new ValidationError("authorId is required");

    const { url, title, description, mediaType, tags, privacy, tier } = req.body;

    if (!url) throw new ValidationError("url is required");
    if (!title) throw new ValidationError("title is required");

    // In production, we would fetch the URL, determine MIME type, file size, etc.
    // Here we create the media DTU with the URL as a storage reference.
    const resolvedMediaType = mediaType || "video";

    const result = createMediaDTU(STATE, {
      authorId,
      title,
      description,
      mediaType: resolvedMediaType,
      mimeType: resolvedMediaType === "video" ? "video/mp4" : `${resolvedMediaType}/unknown`,
      originalFilename: url.split("/").pop() || "remote-media",
      tags,
      privacy,
      tier,
    });

    if (!result.ok) {
      throw new ValidationError(result.error);
    }

    // Update storage ref to point to the remote URL
    result.mediaDTU.storageRef.remoteUrl = url;
    result.mediaDTU.storageRef.ingestStatus = "pending";

    // Generate thumbnail
    generateThumbnail(STATE, result.mediaDTU.id);

    res.status(201).json({
      ok: true,
      mediaDTU: result.mediaDTU,
      ingestStatus: "pending",
    });
  }));

  // ── Get Media DTU ─────────────────────────────────────────────────────

  /**
   * GET /:id — Get a media DTU with streaming URLs and engagement data.
   */
  router.get("/:id", asyncHandler(async (req, res) => {
    const result = getMediaDTU(STATE, req.params.id);
    if (!result.ok) throw new NotFoundError("Media", req.params.id);

    const mediaDTU = result.mediaDTU;
    const userId = req.user?.id || req.query.userId;

    // Build streaming URLs
    const streamingUrls = {
      stream: `/api/media/${mediaDTU.id}/stream`,
      thumbnail: mediaDTU.thumbnail ? `/api/media/${mediaDTU.id}/thumbnail` : null,
    };

    if (mediaDTU.mediaType === "video" || mediaDTU.mediaType === "stream") {
      streamingUrls.hlsManifest = `/api/media/${mediaDTU.id}/manifest.m3u8`;
    }

    // Check if user has liked
    const media = STATE._media;
    const liked = userId && media ? (media.likes.get(mediaDTU.id) || new Set()).has(userId) : false;

    res.json({
      ok: true,
      mediaDTU,
      streamingUrls,
      liked,
      availableQualities: mediaDTU.transcodeVariants
        .filter(v => v.ready)
        .map(v => v.quality),
    });
  }));

  // ── Stream ────────────────────────────────────────────────────────────

  /**
   * GET /:id/stream — Stream media content with range request support.
   *
   * In production, this would serve actual file bytes.
   * Here we return metadata about the stream and simulate range support.
   */
  router.get("/:id/stream", asyncHandler(async (req, res) => {
    const result = getMediaDTU(STATE, req.params.id);
    if (!result.ok) throw new NotFoundError("Media", req.params.id);

    const mediaDTU = result.mediaDTU;
    const quality = req.query.quality || "original";

    // In production: serve actual file bytes with range support
    // Here we return stream metadata
    const fileSize = mediaDTU.fileSize || 1024 * 1024; // 1MB default
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.status(206).json({
        ok: true,
        streaming: true,
        mediaId: mediaDTU.id,
        quality,
        range: { start, end, total: fileSize },
        chunkSize,
        contentType: mediaDTU.mimeType,
        note: "In production, this returns actual binary data with Content-Range headers",
      });
    } else {
      res.json({
        ok: true,
        streaming: true,
        mediaId: mediaDTU.id,
        quality,
        fileSize,
        contentType: mediaDTU.mimeType,
        duration: mediaDTU.duration,
        note: "In production, this returns actual binary data",
      });
    }
  }));

  // ── Thumbnail ─────────────────────────────────────────────────────────

  /**
   * GET /:id/thumbnail — Get thumbnail for a media DTU.
   */
  router.get("/:id/thumbnail", asyncHandler(async (req, res) => {
    const result = getMediaDTU(STATE, req.params.id);
    if (!result.ok) throw new NotFoundError("Media", req.params.id);

    const mediaDTU = result.mediaDTU;
    if (!mediaDTU.thumbnail) {
      // Generate on the fly
      generateThumbnail(STATE, mediaDTU.id);
    }

    // In production, serve the actual image file
    res.json({
      ok: true,
      mediaId: mediaDTU.id,
      thumbnail: mediaDTU.thumbnail,
      note: "In production, this returns an actual image with proper Content-Type",
    });
  }));

  // ── HLS Manifest ─────────────────────────────────────────────────────

  /**
   * GET /:id/manifest.m3u8 — Get HLS master playlist.
   */
  router.get("/:id/manifest.m3u8", asyncHandler(async (req, res) => {
    const result = generateHLSManifest(STATE, req.params.id);

    if (!result.ok) {
      // Fall back to media not found or not a video
      const mediaResult = getMediaDTU(STATE, req.params.id);
      if (!mediaResult.ok) throw new NotFoundError("Media", req.params.id);
      throw new ValidationError(result.error);
    }

    res.set("Content-Type", result.contentType);
    res.send(result.manifest);
  }));

  // ── Transcode ─────────────────────────────────────────────────────────

  /**
   * POST /:id/transcode — Trigger transcode to a specific quality preset.
   *
   * Body:
   *   - quality: string (e.g., '720p', '1080p', 'high', 'medium')
   */
  router.post("/:id/transcode", asyncHandler(async (req, res) => {
    const { quality } = req.body;
    if (!quality) throw new ValidationError("quality is required");

    const result = initiateTranscode(STATE, req.params.id, quality);
    if (!result.ok) {
      if (result.error === "Media not found") throw new NotFoundError("Media", req.params.id);
      throw new ValidationError(result.error);
    }

    res.status(202).json({
      ok: true,
      job: result.job,
    });
  }));

  // ── Media Feed ────────────────────────────────────────────────────────

  /**
   * GET /feed — Get media feed.
   *
   * Query params:
   *   - tab: 'for-you' | 'following' | 'trending' (default: 'for-you')
   *   - mediaType: filter by type
   *   - limit: number (default: 20)
   *   - offset: number (default: 0)
   */
  router.get("/feed", asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.query.userId || "anonymous";
    const { tab, mediaType, limit, offset } = req.query;

    const result = getMediaFeed(STATE, userId, {
      tab,
      mediaType,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
    });

    res.json(result);
  }));

  // ── Views ─────────────────────────────────────────────────────────────

  /**
   * POST /:id/view — Record a view on media.
   */
  router.post("/:id/view", asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.body.userId || `anon-${req.ip}`;

    const result = recordView(STATE, req.params.id, userId);
    if (!result.ok) {
      if (result.error === "Media not found") throw new NotFoundError("Media", req.params.id);
      throw new ValidationError(result.error);
    }

    res.json(result);
  }));

  // ── Likes ─────────────────────────────────────────────────────────────

  /**
   * POST /:id/like — Toggle like on media.
   */
  router.post("/:id/like", asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.body.userId;
    if (!userId) throw new ValidationError("userId is required");

    const result = toggleLike(STATE, req.params.id, userId);
    if (!result.ok) {
      if (result.error === "Media not found") throw new NotFoundError("Media", req.params.id);
      throw new ValidationError(result.error);
    }

    res.json(result);
  }));

  // ── Comments ──────────────────────────────────────────────────────────

  /**
   * POST /:id/comment — Add a comment.
   *
   * Body:
   *   - text: string (required)
   */
  router.post("/:id/comment", asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.body.userId;
    if (!userId) throw new ValidationError("userId is required");

    const { text } = req.body;
    if (!text) throw new ValidationError("Comment text is required");

    const result = addComment(STATE, req.params.id, userId, text);
    if (!result.ok) {
      if (result.error === "Media not found") throw new NotFoundError("Media", req.params.id);
      throw new ValidationError(result.error);
    }

    res.status(201).json(result);
  }));

  /**
   * GET /:id/comments — Get comments on media.
   *
   * Query params:
   *   - limit: number (default: 50)
   *   - offset: number (default: 0)
   */
  router.get("/:id/comments", asyncHandler(async (req, res) => {
    const { limit, offset } = req.query;

    const result = getComments(STATE, req.params.id, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });

    if (!result.ok) {
      if (result.error === "Media not found") throw new NotFoundError("Media", req.params.id);
      throw new ValidationError(result.error);
    }

    res.json(result);
  }));

  // ── Delete ────────────────────────────────────────────────────────────

  /**
   * DELETE /:id — Delete a media DTU.
   */
  router.delete("/:id", asyncHandler(async (req, res) => {
    const authorId = req.user?.id || req.body.authorId;
    if (!authorId) throw new ValidationError("authorId is required");

    const result = deleteMediaDTU(STATE, req.params.id, authorId);
    if (!result.ok) {
      if (result.error === "Media not found") throw new NotFoundError("Media", req.params.id);
      throw new ValidationError(result.error);
    }

    res.json(result);
  }));

  // ── Author Media ──────────────────────────────────────────────────────

  /**
   * GET /author/:authorId — Get all media by a specific author.
   */
  router.get("/author/:authorId", asyncHandler(async (req, res) => {
    const viewerId = req.user?.id || req.query.viewerId;
    const { limit, offset } = req.query;

    const result = getMediaByAuthor(STATE, req.params.authorId, {
      viewerId,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
    });

    res.json(result);
  }));

  // ── Metrics ───────────────────────────────────────────────────────────

  /**
   * GET /metrics — Get media system metrics.
   */
  router.get("/metrics", asyncHandler(async (_req, res) => {
    const result = getMediaMetrics(STATE);
    res.json(result);
  }));

  // ── Constants ─────────────────────────────────────────────────────────

  /**
   * GET /constants — Get media system constants.
   */
  router.get("/constants", (_req, res) => {
    res.json({
      mediaTypes: MEDIA_TYPES,
      qualityPresets: QUALITY_PRESETS,
      maxFileSizes: MAX_FILE_SIZES,
    });
  });

  return router;
}
