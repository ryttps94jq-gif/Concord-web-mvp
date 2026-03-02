// Concord Mobile — DTU Search
// Full-text search across the local DTU lattice with tokenization,
// relevance scoring, and search index management.

import type { DTU, DTUTypeCode, DTUSearchResult } from '../../utils/types';
import type { DTUStore } from '../store/dtu-store';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SearchOptions {
  limit?: number;
  types?: DTUTypeCode[];
  tags?: string[];
  minScore?: number;
  sortBy?: 'relevance' | 'timestamp' | 'type';
}

export interface SearchIndex {
  /** Maps token -> set of DTU IDs containing that token */
  tokenIndex: Map<string, Set<string>>;
  /** Maps DTU ID -> array of tokens extracted from it */
  dtuTokens: Map<string, string[]>;
  /** Number of DTUs indexed */
  indexedCount: number;
  /** Timestamp of when the index was built */
  builtAt: number;
}

// ── Stop words to filter out ─────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'of', 'and',
  'or', 'for', 'by', 'with', 'from', 'as', 'be', 'was', 'were', 'been',
  'are', 'have', 'has', 'had', 'do', 'does', 'did', 'not', 'but', 'if',
  'so', 'no', 'up', 'out', 'that', 'this', 'then', 'than', 'its',
]);

// ── Tokenization ─────────────────────────────────────────────────────────────

/**
 * Tokenize a text string into normalized, filtered tokens.
 *
 * - Lowercases all characters
 * - Splits on non-alphanumeric boundaries
 * - Removes stop words
 * - Removes tokens shorter than 2 characters
 * - Deduplicates tokens
 */
export function tokenize(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  const raw = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of raw) {
    if (!seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }

  return result;
}

// ── Extract searchable text from a DTU ───────────────────────────────────────

function extractText(dtu: DTU): string {
  const parts: string[] = [];

  // Tags
  parts.push(dtu.tags.join(' '));

  // Content as text
  try {
    const text = new TextDecoder().decode(dtu.content);
    parts.push(text);
  } catch {
    // Content is not valid text — skip
  }

  // ID (sometimes users search by partial ID)
  parts.push(dtu.id);

  // Scope
  parts.push(dtu.meta.scope);

  return parts.join(' ');
}

// ── Build search index ───────────────────────────────────────────────────────

/**
 * Build an inverted search index from all DTUs in the store.
 */
export function buildSearchIndex(store: DTUStore): SearchIndex {
  const tokenIndex = new Map<string, Set<string>>();
  const dtuTokens = new Map<string, string[]>();
  let indexedCount = 0;

  // Iterate through the store using getByType for all known types,
  // or more efficiently, iterate directly. Since DTUStore doesn't expose
  // an iterator, we search for everything with an empty query and high limit,
  // or use getByType for each type. We use getStats to know size, then search.
  //
  // For the index builder, we need access to all DTUs. We'll use a workaround:
  // search for common single-character tokens won't work well. Instead, let's
  // use getByType for all type codes.

  const allTypes: DTUTypeCode[] = [
    0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007,
    0x0008, 0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x000e,
  ] as DTUTypeCode[];

  const seenIds = new Set<string>();

  for (const typeCode of allTypes) {
    const dtus = store.getByType(typeCode);
    for (const dtu of dtus) {
      if (seenIds.has(dtu.id)) continue;
      seenIds.add(dtu.id);

      const text = extractText(dtu);
      const tokens = tokenize(text);
      dtuTokens.set(dtu.id, tokens);

      for (const token of tokens) {
        let idSet = tokenIndex.get(token);
        if (!idSet) {
          idSet = new Set();
          tokenIndex.set(token, idSet);
        }
        idSet.add(dtu.id);
      }

      indexedCount++;
    }
  }

  return {
    tokenIndex,
    dtuTokens,
    indexedCount,
    builtAt: Date.now(),
  };
}

// ── Relevance scoring ────────────────────────────────────────────────────────

/**
 * Compute a relevance score for a DTU given the search tokens.
 *
 * Scoring:
 * - +3 for each token found in tags (exact match)
 * - +2 for each token found as prefix of a tag
 * - +1 for each token found in content text
 * - +0.5 for each token found in ID
 * - Bonus: pain-tagged DTUs get +1
 * - Bonus: priority DTUs get +0.5
 */
export function computeRelevance(tokens: string[], dtu: DTU): number {
  if (tokens.length === 0) return 0;

  let score = 0;
  const tagsLower = dtu.tags.map((t) => t.toLowerCase());

  let contentText = '';
  try {
    contentText = new TextDecoder().decode(dtu.content).toLowerCase();
  } catch {
    // Not text content
  }

  const idLower = dtu.id.toLowerCase();

  for (const token of tokens) {
    // Exact tag match
    if (tagsLower.includes(token)) {
      score += 3;
    }
    // Prefix tag match (if no exact match)
    else if (tagsLower.some((tag) => tag.startsWith(token))) {
      score += 2;
    }

    // Content match
    if (contentText.includes(token)) {
      score += 1;
    }

    // ID match
    if (idLower.includes(token)) {
      score += 0.5;
    }
  }

  // Bonuses
  if (dtu.meta.painTagged) {
    score += 1;
  }
  if (dtu.header.flags & 0x10) {
    // PRIORITY flag
    score += 0.5;
  }

  return score;
}

// ── Main search function ─────────────────────────────────────────────────────

/**
 * Search DTUs in the store using full-text matching with relevance scoring.
 */
export function searchDTUs(
  store: DTUStore,
  query: string,
  options: SearchOptions = {}
): DTUSearchResult[] {
  const {
    limit = 50,
    types,
    tags,
    minScore = 0,
    sortBy = 'relevance',
  } = options;

  if (!query || query.trim().length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    // If all tokens were stop words, try raw split as fallback
    const rawTokens = query.toLowerCase().trim().split(/\s+/).filter((t) => t.length >= 1);
    if (rawTokens.length === 0) return [];
    return searchWithTokens(store, rawTokens, { limit, types, tags, minScore, sortBy });
  }

  return searchWithTokens(store, queryTokens, { limit, types, tags, minScore, sortBy });
}

function searchWithTokens(
  store: DTUStore,
  tokens: string[],
  options: Required<Pick<SearchOptions, 'limit' | 'minScore' | 'sortBy'>> & Pick<SearchOptions, 'types' | 'tags'>
): DTUSearchResult[] {
  const results: DTUSearchResult[] = [];
  const seenIds = new Set<string>();

  // Determine which type codes to search
  const typesToSearch: DTUTypeCode[] = options.types ?? [
    0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007,
    0x0008, 0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x000e,
  ] as DTUTypeCode[];

  const tagFilter = options.tags
    ? new Set(options.tags.map((t) => t.toLowerCase()))
    : null;

  for (const typeCode of typesToSearch) {
    const dtus = store.getByType(typeCode);
    for (const dtu of dtus) {
      if (seenIds.has(dtu.id)) continue;
      seenIds.add(dtu.id);

      // Tag filter
      if (tagFilter) {
        const hasTag = dtu.tags.some((t) => tagFilter.has(t.toLowerCase()));
        if (!hasTag) continue;
      }

      const score = computeRelevance(tokens, dtu);

      if (score > options.minScore) {
        let snippet = '';
        try {
          const text = new TextDecoder().decode(dtu.content);
          snippet = text.substring(0, 120);
        } catch {
          snippet = '[binary content]';
        }

        results.push({
          id: dtu.id,
          type: dtu.header.type,
          timestamp: dtu.header.timestamp,
          tags: dtu.tags,
          score,
          snippet,
        });
      }
    }
  }

  // Sort
  switch (options.sortBy) {
    case 'timestamp':
      results.sort((a, b) => b.timestamp - a.timestamp);
      break;
    case 'type':
      results.sort((a, b) => a.type - b.type || b.score - a.score);
      break;
    case 'relevance':
    default:
      results.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
      break;
  }

  return results.slice(0, options.limit);
}
