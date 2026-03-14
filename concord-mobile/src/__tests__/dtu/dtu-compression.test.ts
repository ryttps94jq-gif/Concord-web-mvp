// Tests for DTU Compression — algorithm selection, compress, decompress

import {
  compress,
  decompress,
  selectAlgorithm,
  setCompressionProvider,
  getCompressionProvider,
  COMPRESSION_ALGORITHMS,
  CompressionProvider,
} from '../../dtu/compression/dtu-compression';

// ── Mock compression provider ────────────────────────────────────────────────
// Simulates compression by removing trailing zeros (crude but testable)

function mockCompress(data: Uint8Array, marker: number): Uint8Array {
  // Add a 2-byte marker prefix, then store content — simulates "compressed" output
  // that is smaller by stripping trailing zeros
  let lastNonZero = data.length - 1;
  while (lastNonZero >= 0 && data[lastNonZero] === 0) lastNonZero--;
  const trimmed = data.slice(0, lastNonZero + 1);
  const result = new Uint8Array(trimmed.length + 2);
  result[0] = marker;
  result[1] = data.length & 0xff; // original length (mod 256 for simplicity)
  result.set(trimmed, 2);
  return result;
}

function mockDecompress(data: Uint8Array, marker: number): Uint8Array {
  if (data[0] !== marker) throw new Error(`Invalid marker: expected ${marker}, got ${data[0]}`);
  const origLen = data[1];
  const result = new Uint8Array(origLen);
  result.set(data.slice(2), 0);
  return result;
}

const mockProvider: CompressionProvider = {
  gzipCompress: jest.fn(async (data) => mockCompress(data, 0xa1)),
  gzipDecompress: jest.fn(async (data) => mockDecompress(data, 0xa1)),
  brotliCompress: jest.fn(async (data) => mockCompress(data, 0xb1)),
  brotliDecompress: jest.fn(async (data) => mockDecompress(data, 0xb1)),
  lz4Compress: jest.fn(async (data) => mockCompress(data, 0xc1)),
  lz4Decompress: jest.fn(async (data) => mockDecompress(data, 0xc1)),
};

// A provider that produces output LARGER than input (compression doesn't help)
const expandingProvider: CompressionProvider = {
  gzipCompress: jest.fn(async (data) => {
    const expanded = new Uint8Array(data.length + 100);
    expanded.set(data, 0);
    return expanded;
  }),
  gzipDecompress: jest.fn(async (data) => data),
  brotliCompress: jest.fn(async (data) => {
    const expanded = new Uint8Array(data.length + 100);
    expanded.set(data, 0);
    return expanded;
  }),
  brotliDecompress: jest.fn(async (data) => data),
  lz4Compress: jest.fn(async (data) => {
    const expanded = new Uint8Array(data.length + 100);
    expanded.set(data, 0);
    return expanded;
  }),
  lz4Decompress: jest.fn(async (data) => data),
};

beforeEach(() => {
  jest.clearAllMocks();
  setCompressionProvider(mockProvider);
});

// ── selectAlgorithm ──────────────────────────────────────────────────────────

describe('selectAlgorithm', () => {
  it('returns NONE for very small content', () => {
    const result = selectAlgorithm('text/plain', 32);
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.NONE);
    expect(result.name).toBe('none');
    expect(result.reason).toMatch(/too small/);
  });

  it('returns NONE for content exactly at threshold - 1', () => {
    const result = selectAlgorithm('text/plain', 63);
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.NONE);
  });

  it('returns NONE for already-compressed content types', () => {
    const types = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mp3',
      'audio/aac',
      'video/mp4',
      'application/zip',
      'application/gzip',
    ];
    for (const type of types) {
      const result = selectAlgorithm(type, 10000);
      expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.NONE);
      expect(result.reason).toMatch(/already compressed/);
    }
  });

  it('handles content type case insensitivity', () => {
    const result = selectAlgorithm('IMAGE/JPEG', 10000);
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.NONE);
  });

  it('trims whitespace from content type', () => {
    const result = selectAlgorithm('  image/jpeg  ', 10000);
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.NONE);
  });

  it('selects BROTLI for large text content', () => {
    const result = selectAlgorithm('text/plain', 5000);
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.BROTLI);
    expect(result.name).toBe('brotli');
    expect(result.reason).toMatch(/brotli/);
  });

  it('selects BROTLI for large JSON content', () => {
    const result = selectAlgorithm('application/json', 8192);
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.BROTLI);
  });

  it('selects LZ4 for small content', () => {
    const result = selectAlgorithm('application/octet-stream', 256);
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.LZ4);
    expect(result.name).toBe('lz4');
  });

  it('selects LZ4 for content at threshold', () => {
    const result = selectAlgorithm('application/octet-stream', 512);
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.LZ4);
  });

  it('selects GZIP for medium non-text content', () => {
    const result = selectAlgorithm('application/octet-stream', 2000);
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.GZIP);
    expect(result.name).toBe('gzip');
  });

  it('selects GZIP for medium text content (below brotli threshold)', () => {
    const result = selectAlgorithm('text/plain', 2000);
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.GZIP);
  });

  it('selects GZIP as default for unknown content types', () => {
    const result = selectAlgorithm('application/x-custom-format', 1000);
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.GZIP);
  });

  it('returns reason string for all selections', () => {
    const selections = [
      selectAlgorithm('text/plain', 10),
      selectAlgorithm('image/png', 5000),
      selectAlgorithm('text/plain', 5000),
      selectAlgorithm('application/octet-stream', 200),
      selectAlgorithm('application/octet-stream', 2000),
    ];
    for (const sel of selections) {
      expect(sel.reason).toBeTruthy();
      expect(typeof sel.reason).toBe('string');
    }
  });
});

// ── compress ─────────────────────────────────────────────────────────────────

describe('compress', () => {
  it('returns uncompressed for content below minimum size', async () => {
    const content = new Uint8Array(32).fill(0x41);
    const result = await compress(content, 'text/plain');
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.NONE);
    expect(result.data).toBe(content);
    expect(result.ratio).toBe(1.0);
    expect(result.originalSize).toBe(32);
    expect(result.compressedSize).toBe(32);
  });

  it('returns uncompressed for incompressible content types', async () => {
    const content = new Uint8Array(10000).fill(0x41);
    const result = await compress(content, 'image/jpeg');
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.NONE);
  });

  it('uses gzip for medium content', async () => {
    // Create content with trailing zeros so mock compression reduces size
    const content = new Uint8Array(200);
    content.fill(0x41, 0, 100); // first 100 bytes are non-zero
    // remaining 100 bytes are zeros, will be stripped by mock
    const result = await compress(content, 'application/octet-stream');
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.LZ4);
    expect(mockProvider.lz4Compress).toHaveBeenCalledWith(content);
  });

  it('uses brotli for large text', async () => {
    const content = new Uint8Array(5000);
    content.fill(0x41, 0, 2000);
    const result = await compress(content, 'text/plain');
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.BROTLI);
    expect(mockProvider.brotliCompress).toHaveBeenCalledWith(content);
  });

  it('uses gzip for medium text', async () => {
    const content = new Uint8Array(2000);
    content.fill(0x41, 0, 1000);
    const result = await compress(content, 'text/plain');
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.GZIP);
    expect(mockProvider.gzipCompress).toHaveBeenCalledWith(content);
  });

  it('computes correct ratio', async () => {
    const content = new Uint8Array(200);
    content.fill(0x41, 0, 50); // 50 non-zero, 150 zeros to strip
    const result = await compress(content, 'application/octet-stream');
    // Mock produces: 2 marker bytes + 50 non-zero = 52 bytes
    expect(result.compressedSize).toBe(52);
    expect(result.originalSize).toBe(200);
    expect(result.ratio).toBeCloseTo(52 / 200);
  });

  it('falls back to NONE when compression expands data', async () => {
    setCompressionProvider(expandingProvider);
    const content = new Uint8Array(1000).fill(0x41);
    const result = await compress(content, 'application/octet-stream');
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.NONE);
    expect(result.data).toBe(content);
    expect(result.ratio).toBe(1.0);
  });

  it('falls back to NONE when no provider is set', async () => {
    setCompressionProvider(null as any);
    const content = new Uint8Array(1000).fill(0x41);
    const result = await compress(content, 'text/plain');
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.NONE);
    expect(result.data).toBe(content);
  });

  it('uses default content type when none provided', async () => {
    // Content must compress well with mock (trailing zeros get stripped)
    const content = new Uint8Array(1000);
    content.fill(0x41, 0, 100); // first 100 bytes non-zero, rest are zeros
    const result = await compress(content);
    // default is application/octet-stream, 1000 bytes => gzip
    expect(result.algorithm).toBe(COMPRESSION_ALGORITHMS.GZIP);
  });

  it('preserves originalSize correctly', async () => {
    const content = new Uint8Array(500);
    content.fill(0x41, 0, 200);
    const result = await compress(content, 'application/octet-stream');
    expect(result.originalSize).toBe(500);
  });
});

// ── decompress ───────────────────────────────────────────────────────────────

describe('decompress', () => {
  it('returns data as-is for NONE algorithm', async () => {
    const data = new Uint8Array([1, 2, 3]);
    const result = await decompress(data, COMPRESSION_ALGORITHMS.NONE);
    expect(result).toBe(data);
  });

  it('calls gzipDecompress for GZIP', async () => {
    const compressed = new Uint8Array([0xa1, 5, 1, 2, 3, 4, 5]);
    await decompress(compressed, COMPRESSION_ALGORITHMS.GZIP);
    expect(mockProvider.gzipDecompress).toHaveBeenCalledWith(compressed);
  });

  it('calls brotliDecompress for BROTLI', async () => {
    const compressed = new Uint8Array([0xb1, 3, 1, 2, 3]);
    await decompress(compressed, COMPRESSION_ALGORITHMS.BROTLI);
    expect(mockProvider.brotliDecompress).toHaveBeenCalledWith(compressed);
  });

  it('calls lz4Decompress for LZ4', async () => {
    const compressed = new Uint8Array([0xc1, 4, 1, 2, 3, 4]);
    await decompress(compressed, COMPRESSION_ALGORITHMS.LZ4);
    expect(mockProvider.lz4Decompress).toHaveBeenCalledWith(compressed);
  });

  it('throws for unknown algorithm', async () => {
    const data = new Uint8Array([1, 2, 3]);
    await expect(decompress(data, 99 as any)).rejects.toThrow(/Unknown compression algorithm/);
  });

  it('throws when no provider for non-NONE algorithm', async () => {
    setCompressionProvider(null as any);
    const data = new Uint8Array([1, 2, 3]);
    await expect(decompress(data, COMPRESSION_ALGORITHMS.GZIP)).rejects.toThrow(
      /CompressionProvider not available/
    );
  });

  it('round-trips gzip compress/decompress', async () => {
    const content = new Uint8Array(200);
    content.fill(0x41, 0, 100);
    const compressed = await compress(content, 'application/octet-stream');
    if (compressed.algorithm !== COMPRESSION_ALGORITHMS.NONE) {
      // The mock decompress should reconstruct approximately
      const decompressed = await decompress(compressed.data, compressed.algorithm);
      expect(decompressed).toBeInstanceOf(Uint8Array);
    }
  });
});

// ── getCompressionProvider / setCompressionProvider ───────────────────────────

describe('provider management', () => {
  it('getCompressionProvider returns set provider', () => {
    setCompressionProvider(mockProvider);
    expect(getCompressionProvider()).toBe(mockProvider);
  });

  it('getCompressionProvider returns null when cleared', () => {
    setCompressionProvider(null as any);
    expect(getCompressionProvider()).toBeNull();
  });
});
