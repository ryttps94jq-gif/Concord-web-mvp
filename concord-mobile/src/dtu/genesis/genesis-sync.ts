// Concord Mobile — Genesis Seed Sync
// Synchronises the genesis DTU set on first launch from a Concord server.
// The genesis set is a fixed collection of foundational DTUs that every
// node must hold to participate in the lattice.

import {
  DTU_GENESIS_SEED_COUNT,
  DTU_FLAGS,
  DTU_VERSION,
} from '../../utils/constants';
import type { DTU, DTUTypeCode } from '../../utils/types';
import type { DTUStore } from '../store/dtu-store';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GenesisSyncResult {
  success: boolean;
  totalDownloaded: number;
  totalVerified: number;
  failedIds: string[];
  durationMs: number;
}

export interface GenesisVerification {
  valid: boolean;
  count: number;
  missing: string[];
}

interface GenesisManifest {
  version: number;
  count: number;
  dtuIds: string[];
  checksum: string;
}

interface GenesisChunk {
  dtus: GenesisDTO[];
  offset: number;
  total: number;
}

interface GenesisDTO {
  id: string;
  version: number;
  flags: number;
  type: number;
  timestamp: number;
  contentBase64: string;
  contentHash: string;
  tags: string[];
  scope: string;
}

// ── Network fetch abstraction ────────────────────────────────────────────────

export interface FetchFunction {
  (url: string, options?: { method?: string; headers?: Record<string, string> }): Promise<{
    ok: boolean;
    status: number;
    json(): Promise<any>;
  }>;
}

let _fetch: FetchFunction = globalThis.fetch as any;

export function setFetchFunction(fn: FetchFunction): void {
  _fetch = fn;
}

// ── Constants ────────────────────────────────────────────────────────────────

const GENESIS_MANIFEST_PATH = '/api/genesis/manifest';
const GENESIS_CHUNK_PATH = '/api/genesis/chunk';
const CHUNK_SIZE = 100; // DTUs per chunk request
const MAX_RETRIES = 3;

// ── Genesis sync ─────────────────────────────────────────────────────────────

/**
 * Synchronise genesis DTUs from the server into the local store.
 *
 * Steps:
 * 1. Fetch the genesis manifest (list of all genesis DTU IDs)
 * 2. Determine which DTUs are missing locally
 * 3. Download missing DTUs in chunks
 * 4. Store and verify each DTU
 */
export async function syncGenesisDTUs(
  store: DTUStore,
  serverUrl: string
): Promise<GenesisSyncResult> {
  const startTime = Date.now();
  let totalDownloaded = 0;
  let totalVerified = 0;
  const failedIds: string[] = [];

  try {
    // 1. Fetch manifest
    const manifestUrl = `${serverUrl}${GENESIS_MANIFEST_PATH}`;
    const manifestRes = await _fetch(manifestUrl);
    if (!manifestRes.ok) {
      return {
        success: false,
        totalDownloaded: 0,
        totalVerified: 0,
        failedIds: [],
        durationMs: Date.now() - startTime,
      };
    }
    const manifest: GenesisManifest = await manifestRes.json();

    // 2. Find missing DTUs
    const missingIds = manifest.dtuIds.filter((id) => !store.has(id));

    if (missingIds.length === 0) {
      return {
        success: true,
        totalDownloaded: 0,
        totalVerified: manifest.dtuIds.length,
        failedIds: [],
        durationMs: Date.now() - startTime,
      };
    }

    // 3. Download in chunks
    for (let offset = 0; offset < missingIds.length; offset += CHUNK_SIZE) {
      const chunkIds = missingIds.slice(offset, offset + CHUNK_SIZE);
      let chunk: GenesisChunk | null = null;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const chunkUrl = `${serverUrl}${GENESIS_CHUNK_PATH}?offset=${offset}&limit=${CHUNK_SIZE}`;
          const chunkRes = await _fetch(chunkUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (chunkRes.ok) {
            chunk = await chunkRes.json();
            break;
          }
        } catch {
          // Retry
        }
      }

      if (!chunk) {
        failedIds.push(...chunkIds);
        continue;
      }

      // 4. Store each DTU
      for (const dto of chunk.dtus) {
        try {
          const dtu = genesisToDTO(dto);
          if (validateGenesisDTU(dtu)) {
            store.set(dtu.id, dtu);
            totalDownloaded++;
            totalVerified++;
          } else {
            failedIds.push(dto.id);
          }
        } catch {
          failedIds.push(dto.id);
        }
      }
    }

    const success = failedIds.length === 0;

    return {
      success,
      totalDownloaded,
      totalVerified,
      failedIds,
      durationMs: Date.now() - startTime,
    };
  } catch {
    return {
      success: false,
      totalDownloaded,
      totalVerified,
      failedIds,
      durationMs: Date.now() - startTime,
    };
  }
}

// ── Genesis verification ─────────────────────────────────────────────────────

/**
 * Verify that the genesis set is complete in the local store.
 * Fetches the manifest to get the expected list, then checks the store.
 */
export async function verifyGenesisSet(
  store: DTUStore,
  serverUrl?: string,
  manifestIds?: string[]
): Promise<GenesisVerification> {
  let expectedIds: string[];

  if (manifestIds) {
    expectedIds = manifestIds;
  } else if (serverUrl) {
    try {
      const manifestUrl = `${serverUrl}${GENESIS_MANIFEST_PATH}`;
      const res = await _fetch(manifestUrl);
      if (!res.ok) {
        return { valid: false, count: 0, missing: [] };
      }
      const manifest: GenesisManifest = await res.json();
      expectedIds = manifest.dtuIds;
    } catch {
      return { valid: false, count: 0, missing: [] };
    }
  } else {
    // Without a manifest, check that we have genesis-flagged DTUs
    return verifyGenesisSetLocal(store);
  }

  const missing: string[] = [];
  let count = 0;

  for (const id of expectedIds) {
    if (store.has(id)) {
      count++;
    } else {
      missing.push(id);
    }
  }

  return {
    valid: missing.length === 0,
    count,
    missing,
  };
}

/**
 * Local-only verification: counts genesis-flagged DTUs in the store.
 */
function verifyGenesisSetLocal(store: DTUStore): GenesisVerification {
  // Use getByType to scan for genesis-flagged DTUs
  // Since there's no "getByFlags" we iterate through common types
  const allTypes: DTUTypeCode[] = [
    0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007,
    0x0008, 0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x000e,
  ] as DTUTypeCode[];

  let genesisCount = 0;
  const seen = new Set<string>();

  for (const type of allTypes) {
    const dtus = store.getByType(type);
    for (const dtu of dtus) {
      if (seen.has(dtu.id)) continue;
      seen.add(dtu.id);
      if (dtu.header.flags & DTU_FLAGS.GENESIS) {
        genesisCount++;
      }
    }
  }

  return {
    valid: genesisCount >= DTU_GENESIS_SEED_COUNT,
    count: genesisCount,
    missing: [], // Cannot determine specific missing IDs without manifest
  };
}

// ── Quick completeness check ─────────────────────────────────────────────────

/**
 * Quick check: does the store contain the expected number of genesis DTUs?
 * Uses the known genesis seed count from constants.
 */
export function isGenesisComplete(store: DTUStore): boolean {
  // Quick heuristic: check if store has at least the genesis count
  if (store.size < DTU_GENESIS_SEED_COUNT) {
    return false;
  }

  // Count genesis-flagged DTUs
  const allTypes: DTUTypeCode[] = [
    0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007,
    0x0008, 0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x000e,
  ] as DTUTypeCode[];

  let genesisCount = 0;
  const seen = new Set<string>();

  for (const type of allTypes) {
    const dtus = store.getByType(type);
    for (const dtu of dtus) {
      if (seen.has(dtu.id)) continue;
      seen.add(dtu.id);
      if (dtu.header.flags & DTU_FLAGS.GENESIS) {
        genesisCount++;
      }
    }
  }

  return genesisCount >= DTU_GENESIS_SEED_COUNT;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function genesisToDTO(dto: GenesisDTO): DTU {
  // Decode base64 content
  const contentBytes = base64ToUint8Array(dto.contentBase64);
  const contentHash = hexToUint8Array(dto.contentHash);

  return {
    id: dto.id,
    header: {
      version: dto.version || DTU_VERSION,
      flags: (dto.flags || 0) | DTU_FLAGS.GENESIS,
      type: dto.type as DTUTypeCode,
      timestamp: dto.timestamp,
      contentLength: contentBytes.length,
      contentHash,
    },
    content: contentBytes,
    tags: dto.tags || [],
    meta: {
      scope: (dto.scope as any) || 'global',
      published: true,
      painTagged: false,
      crpiScore: 0,
      relayCount: 0,
      ttl: 0, // Genesis DTUs never expire
    },
    lineage: {
      parentId: null,
      ancestors: [],
      depth: 0,
    },
  };
}

function validateGenesisDTU(dtu: DTU): boolean {
  // Must have genesis flag
  if (!(dtu.header.flags & DTU_FLAGS.GENESIS)) {
    return false;
  }
  // Must have valid version
  if (dtu.header.version !== DTU_VERSION) {
    return false;
  }
  // Must have non-empty content
  if (dtu.content.length === 0) {
    return false;
  }
  // Content length must match header
  if (dtu.header.contentLength !== dtu.content.length) {
    return false;
  }
  return true;
}

// Simple base64/hex helpers (avoid importing the full crypto module for these)
function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(128);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  const length = (base64.length * 3) / 4 - padding;
  const bytes = new Uint8Array(length);
  let j = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const a = lookup[base64.charCodeAt(i)];
    const b = lookup[base64.charCodeAt(i + 1)];
    const c = lookup[base64.charCodeAt(i + 2)];
    const d = lookup[base64.charCodeAt(i + 3)];
    bytes[j++] = (a << 2) | (b >> 4);
    if (j < length) bytes[j++] = ((b & 15) << 4) | (c >> 2);
    if (j < length) bytes[j++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
