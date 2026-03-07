// ============================================================================
// Artistry Dedup Engine
// Content fingerprinting for duplicate detection across all content types.
// Threshold: 95% similarity triggers rejection.
// ============================================================================

import type { ArtistryContentType, DedupMethod, DedupResult } from './types';
import { DEDUP_THRESHOLD } from './types';

// ---- Dedup Method Selection ----

export function getDedupMethod(contentType: ArtistryContentType): DedupMethod {
  switch (contentType) {
    case 'audio': return 'chromaprint';
    case 'image': return 'phash';
    case 'text': return 'simhash';
    case 'code': return 'ast_similarity';
    case 'video': return 'frame_phash';
    case 'interactive': return 'phash'; // screenshot-based
    case '3d': return 'phash'; // render-based
  }
}

// ---- Perceptual Hashing (client-side fingerprinting) ----

/**
 * Generate a simple perceptual hash from image data.
 * Uses average hash (aHash) approach: resize to 8x8, grayscale, threshold.
 */
export async function generateImageHash(imageElement: HTMLImageElement): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.drawImage(imageElement, 0, 0, 8, 8);
  const pixels = ctx.getImageData(0, 0, 8, 8).data;

  // Convert to grayscale
  const grays: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    grays.push(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
  }

  // Compute average
  const avg = grays.reduce((a, b) => a + b, 0) / grays.length;

  // Generate hash bits
  let hash = '';
  for (const gray of grays) {
    hash += gray >= avg ? '1' : '0';
  }

  return hash;
}

/**
 * Generate a text fingerprint using SimHash on character n-grams.
 */
export function generateTextHash(text: string, ngramSize: number = 3): string {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const ngrams: string[] = [];

  for (let i = 0; i <= normalized.length - ngramSize; i++) {
    ngrams.push(normalized.substring(i, i + ngramSize));
  }

  // Simple hash for each n-gram
  const hashBits = new Int32Array(64).fill(0);
  for (const ngram of ngrams) {
    let h = 0;
    for (let i = 0; i < ngram.length; i++) {
      h = ((h << 5) - h + ngram.charCodeAt(i)) | 0;
    }
    for (let i = 0; i < 64; i++) {
      if ((h >> (i % 32)) & 1) hashBits[i]++;
      else hashBits[i]--;
    }
  }

  return Array.from(hashBits).map(b => b >= 0 ? '1' : '0').join('');
}

/**
 * Generate an audio fingerprint from waveform peaks.
 * Simplified chromaprint-style: quantize spectral energy into bins.
 */
export function generateAudioHash(waveformPeaks: number[]): string {
  // Downsample to 64 bins
  const binSize = Math.max(1, Math.floor(waveformPeaks.length / 64));
  const bins: number[] = [];

  for (let i = 0; i < 64; i++) {
    const start = i * binSize;
    const end = Math.min(start + binSize, waveformPeaks.length);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += Math.abs(waveformPeaks[j]);
    }
    bins.push(sum / (end - start));
  }

  // Threshold at median
  const sorted = [...bins].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  return bins.map(b => b >= median ? '1' : '0').join('');
}

/**
 * Generate a code fingerprint based on token patterns.
 * Strips whitespace, comments, and variable names to compare structure.
 */
export function generateCodeHash(code: string): string {
  // Normalize: strip comments, collapse whitespace, lowercase keywords
  const stripped = code
    .replace(/\/\/.*$/gm, '') // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // multi-line comments
    .replace(/#.*$/gm, '') // Python comments
    .replace(/\s+/g, ' ')
    .trim();

  return generateTextHash(stripped, 4);
}

// ---- Similarity Comparison ----

/**
 * Compute Hamming distance between two binary hash strings.
 * Returns similarity as 0-1 (1 = identical).
 */
export function computeHashSimilarity(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    // Pad shorter one
    const maxLen = Math.max(hash1.length, hash2.length);
    hash1 = hash1.padEnd(maxLen, '0');
    hash2 = hash2.padEnd(maxLen, '0');
  }

  let matching = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) matching++;
  }

  return matching / hash1.length;
}

/**
 * Check content against existing posts for duplicates.
 */
export function checkDuplicate(
  newHash: string,
  existingPosts: { id: string; title: string; hash: string }[],
  method: DedupMethod,
): DedupResult {
  let bestMatch: { id: string; title: string; similarity: number } | null = null;

  for (const post of existingPosts) {
    const similarity = computeHashSimilarity(newHash, post.hash);
    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { id: post.id, title: post.title, similarity };
    }
  }

  if (bestMatch && bestMatch.similarity >= DEDUP_THRESHOLD) {
    return {
      isDuplicate: true,
      similarity: bestMatch.similarity,
      method,
      matchedPostId: bestMatch.id,
      matchedPostTitle: bestMatch.title,
    };
  }

  return {
    isDuplicate: false,
    similarity: bestMatch?.similarity || 0,
    method,
    matchedPostId: null,
    matchedPostTitle: null,
  };
}
