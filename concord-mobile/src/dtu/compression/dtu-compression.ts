// Concord Mobile — DTU Compression
// Compression/decompression for DTU content with algorithm selection
// Actual gzip/brotli handled by native modules; this module provides
// the interface, algorithm selection logic, and fallback identity compression.

// ── Algorithm codes ──────────────────────────────────────────────────────────

export const COMPRESSION_ALGORITHMS = {
  NONE: 0,
  GZIP: 1,
  BROTLI: 2,
  LZ4: 3,
} as const;

export type CompressionAlgorithm =
  typeof COMPRESSION_ALGORITHMS[keyof typeof COMPRESSION_ALGORITHMS];

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompressedContent {
  data: Uint8Array;
  algorithm: CompressionAlgorithm;
  originalSize: number;
  compressedSize: number;
  ratio: number; // compressedSize / originalSize (< 1 means smaller)
}

export interface AlgorithmSelection {
  algorithm: CompressionAlgorithm;
  name: string;
  reason: string;
}

/**
 * Native compression provider interface.
 * The actual implementation is injected at runtime via setCompressionProvider().
 * This enables testing with mock compression implementations.
 */
export interface CompressionProvider {
  gzipCompress(data: Uint8Array): Promise<Uint8Array>;
  gzipDecompress(data: Uint8Array): Promise<Uint8Array>;
  brotliCompress(data: Uint8Array): Promise<Uint8Array>;
  brotliDecompress(data: Uint8Array): Promise<Uint8Array>;
  lz4Compress(data: Uint8Array): Promise<Uint8Array>;
  lz4Decompress(data: Uint8Array): Promise<Uint8Array>;
}

// ── Provider management ──────────────────────────────────────────────────────

let _provider: CompressionProvider | null = null;

export function setCompressionProvider(provider: CompressionProvider): void {
  _provider = provider;
}

export function getCompressionProvider(): CompressionProvider | null {
  return _provider;
}

// ── Size thresholds for algorithm selection ──────────────────────────────────

const MIN_SIZE_FOR_COMPRESSION = 64;       // don't compress tiny payloads
const BROTLI_MIN_SIZE = 1024;              // brotli shines for larger content
const LZ4_PREFERRED_MAX_SIZE = 512;        // lz4 for small-to-medium, fast decode
const BROTLI_PREFERRED_MIN_SIZE = 4096;    // brotli preferred for larger text

// Content types that typically compress well
const TEXT_CONTENT_TYPES = new Set([
  'text/plain',
  'text/html',
  'text/css',
  'text/csv',
  'application/json',
  'application/xml',
  'application/javascript',
]);

// Content types that typically do not compress well (already compressed)
const INCOMPRESSIBLE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'audio/mp3',
  'audio/aac',
  'video/mp4',
  'application/zip',
  'application/gzip',
]);

// ── Algorithm selection ──────────────────────────────────────────────────────

/**
 * Select the best compression algorithm for the given content type and size.
 */
export function selectAlgorithm(
  contentType: string,
  size: number
): AlgorithmSelection {
  // Too small to benefit from compression
  if (size < MIN_SIZE_FOR_COMPRESSION) {
    return {
      algorithm: COMPRESSION_ALGORITHMS.NONE,
      name: 'none',
      reason: `Content too small (${size} bytes < ${MIN_SIZE_FOR_COMPRESSION} byte threshold)`,
    };
  }

  // Already compressed content types
  const normalizedType = contentType.toLowerCase().trim();
  if (INCOMPRESSIBLE_CONTENT_TYPES.has(normalizedType)) {
    return {
      algorithm: COMPRESSION_ALGORITHMS.NONE,
      name: 'none',
      reason: `Content type '${normalizedType}' is already compressed`,
    };
  }

  const isText = TEXT_CONTENT_TYPES.has(normalizedType);

  // For text content, prefer brotli for larger payloads
  if (isText && size >= BROTLI_PREFERRED_MIN_SIZE) {
    return {
      algorithm: COMPRESSION_ALGORITHMS.BROTLI,
      name: 'brotli',
      reason: `Text content (${normalizedType}) of ${size} bytes benefits from brotli compression`,
    };
  }

  // For small-to-medium content or when speed matters, use lz4
  if (size <= LZ4_PREFERRED_MAX_SIZE) {
    return {
      algorithm: COMPRESSION_ALGORITHMS.LZ4,
      name: 'lz4',
      reason: `Small content (${size} bytes) uses fast lz4 compression`,
    };
  }

  // Default: gzip (good balance of ratio and speed)
  return {
    algorithm: COMPRESSION_ALGORITHMS.GZIP,
    name: 'gzip',
    reason: `Default gzip compression for ${size} bytes of '${normalizedType}'`,
  };
}

// ── Compress ─────────────────────────────────────────────────────────────────

/**
 * Compress DTU content. If no native provider is available, returns uncompressed
 * with algorithm NONE.
 */
export async function compress(
  content: Uint8Array,
  contentType: string = 'application/octet-stream'
): Promise<CompressedContent> {
  const selection = selectAlgorithm(contentType, content.length);

  // No compression selected
  if (selection.algorithm === COMPRESSION_ALGORITHMS.NONE) {
    return {
      data: content,
      algorithm: COMPRESSION_ALGORITHMS.NONE,
      originalSize: content.length,
      compressedSize: content.length,
      ratio: 1.0,
    };
  }

  const provider = getCompressionProvider();

  // No native provider available — fall back to no compression
  if (!provider) {
    return {
      data: content,
      algorithm: COMPRESSION_ALGORITHMS.NONE,
      originalSize: content.length,
      compressedSize: content.length,
      ratio: 1.0,
    };
  }

  let compressed: Uint8Array;

  switch (selection.algorithm) {
    case COMPRESSION_ALGORITHMS.GZIP:
      compressed = await provider.gzipCompress(content);
      break;
    case COMPRESSION_ALGORITHMS.BROTLI:
      compressed = await provider.brotliCompress(content);
      break;
    case COMPRESSION_ALGORITHMS.LZ4:
      compressed = await provider.lz4Compress(content);
      break;
    default:
      // Should not happen, but handle gracefully
      return {
        data: content,
        algorithm: COMPRESSION_ALGORITHMS.NONE,
        originalSize: content.length,
        compressedSize: content.length,
        ratio: 1.0,
      };
  }

  const ratio = content.length > 0 ? compressed.length / content.length : 1.0;

  // If compression didn't help (ratio >= 1), return original uncompressed
  if (compressed.length >= content.length) {
    return {
      data: content,
      algorithm: COMPRESSION_ALGORITHMS.NONE,
      originalSize: content.length,
      compressedSize: content.length,
      ratio: 1.0,
    };
  }

  return {
    data: compressed,
    algorithm: selection.algorithm,
    originalSize: content.length,
    compressedSize: compressed.length,
    ratio,
  };
}

// ── Decompress ───────────────────────────────────────────────────────────────

/**
 * Decompress DTU content given the algorithm code.
 */
export async function decompress(
  data: Uint8Array,
  algorithm: CompressionAlgorithm
): Promise<Uint8Array> {
  // No compression — return as-is
  if (algorithm === COMPRESSION_ALGORITHMS.NONE) {
    return data;
  }

  const provider = getCompressionProvider();
  if (!provider) {
    throw new Error(
      'CompressionProvider not available. Cannot decompress algorithm ' + algorithm
    );
  }

  switch (algorithm) {
    case COMPRESSION_ALGORITHMS.GZIP:
      return provider.gzipDecompress(data);
    case COMPRESSION_ALGORITHMS.BROTLI:
      return provider.brotliDecompress(data);
    case COMPRESSION_ALGORITHMS.LZ4:
      return provider.lz4Decompress(data);
    default:
      throw new Error(`Unknown compression algorithm: ${algorithm}`);
  }
}
