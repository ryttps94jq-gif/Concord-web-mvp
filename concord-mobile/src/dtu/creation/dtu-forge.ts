// Concord Mobile — DTU Forge
// Creates fully-formed DTU objects from various input sources

import {
  DTU_VERSION,
  DTU_FLAGS,
  DTU_TYPES,
  DEFAULT_DTU_TTL,
  PRIORITY_DTU_TTL,
  EMERGENCY_DTU_TTL,
} from '../../utils/constants';
import type {
  DTU,
  DTUHeader,
  DTULineage,
  DTUMeta,
  DTUTypeCode,
  GeoGrid,
  SensorReading,
  Transaction,
  ThreatMatch,
} from '../../utils/types';
import { generateId, sha256, encodeUTF8 } from '../../utils/crypto';

// ── Options for generic DTU creation ─────────────────────────────────────────

export interface CreateDTUOptions {
  type: DTUTypeCode;
  content: Uint8Array;
  tags: string[];
  scope: DTUMeta['scope'];
  lineage?: DTULineage;
  painTagged?: boolean;
  priority?: boolean;
  encrypted?: boolean;
  compressed?: boolean;
  signed?: boolean;
  genesis?: boolean;
  relay?: boolean;
  creatorKey?: string;
  geoGrid?: GeoGrid;
}

// ── Core forge function ──────────────────────────────────────────────────────

/**
 * Create a complete DTU from the given options.
 *
 * 1. Generates a unique ID with `dtu` prefix
 * 2. Computes SHA-256 hash of content
 * 3. Builds binary header
 * 4. Assembles DTU object
 */
export async function createDTU(opts: CreateDTUOptions): Promise<DTU> {
  const id = generateId('dtu');
  const contentHash = await sha256(opts.content);
  const timestamp = Date.now();

  // Build flags
  let flags = 0;
  if (opts.encrypted) flags |= DTU_FLAGS.ENCRYPTED;
  if (opts.compressed) flags |= DTU_FLAGS.COMPRESSED;
  if (opts.signed) flags |= DTU_FLAGS.SIGNED;
  if (opts.painTagged) flags |= DTU_FLAGS.PAIN_TAGGED;
  if (opts.priority) flags |= DTU_FLAGS.PRIORITY;
  if (opts.genesis) flags |= DTU_FLAGS.GENESIS;
  if (opts.relay) flags |= DTU_FLAGS.RELAY;

  const header: DTUHeader = {
    version: DTU_VERSION,
    flags,
    type: opts.type,
    timestamp,
    contentLength: opts.content.length,
    contentHash,
  };

  // Determine TTL based on type and priority
  let ttl = DEFAULT_DTU_TTL;
  if (opts.priority) ttl = PRIORITY_DTU_TTL;
  if (opts.type === DTU_TYPES.EMERGENCY_ALERT) ttl = EMERGENCY_DTU_TTL;

  const meta: DTUMeta = {
    creatorKey: opts.creatorKey,
    scope: opts.scope,
    published: false,
    painTagged: opts.painTagged ?? false,
    crpiScore: 0,
    relayCount: 0,
    ttl,
    geoGrid: opts.geoGrid,
  };

  const lineage: DTULineage = opts.lineage ?? {
    parentId: null,
    ancestors: [],
    depth: 0,
  };

  const dtu: DTU = {
    id,
    header,
    content: opts.content,
    tags: opts.tags,
    meta,
    lineage,
  };

  return dtu;
}

// ── Specialized forge: Foundation Sense DTU ──────────────────────────────────

/**
 * Create a Foundation Sense DTU from a sensor reading.
 */
export async function createFoundationDTU(
  sensorReading: SensorReading,
  geoGrid?: GeoGrid
): Promise<DTU> {
  const content = encodeUTF8(JSON.stringify(sensorReading));

  return createDTU({
    type: DTU_TYPES.FOUNDATION_SENSE,
    content,
    tags: ['foundation', 'sensor', sensorReading.sensor],
    scope: 'local',
    geoGrid: geoGrid ?? sensorReading.geoGrid,
  });
}

// ── Specialized forge: Transaction DTU ───────────────────────────────────────

/**
 * Create an Economy Transaction DTU.
 */
export async function createTransactionDTU(transaction: Transaction): Promise<DTU> {
  const content = encodeUTF8(
    JSON.stringify({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      fromKey: transaction.fromKey,
      toKey: transaction.toKey,
      timestamp: transaction.timestamp,
      balanceHash: transaction.balanceHash,
      status: transaction.status,
    })
  );

  return createDTU({
    type: DTU_TYPES.ECONOMY_TRANSACTION,
    content,
    tags: ['economy', 'transaction', transaction.type],
    scope: 'global',
    signed: true,
    priority: true,
    creatorKey: transaction.fromKey,
  });
}

// ── Specialized forge: Threat DTU ────────────────────────────────────────────

/**
 * Create a Shield Threat DTU from a threat match.
 */
export async function createThreatDTU(
  threat: ThreatMatch,
  sourceDtuId: string
): Promise<DTU> {
  const content = encodeUTF8(
    JSON.stringify({
      signatureId: threat.signatureId,
      severity: threat.severity,
      category: threat.category,
      matchLocation: threat.matchLocation,
      confidence: threat.confidence,
      sourceDtuId,
    })
  );

  return createDTU({
    type: DTU_TYPES.SHIELD_THREAT,
    content,
    tags: ['shield', 'threat', threat.category, `severity:${threat.severity}`],
    scope: 'regional',
    painTagged: threat.severity >= 7,
    priority: threat.severity >= 9,
    lineage: {
      parentId: sourceDtuId,
      ancestors: [sourceDtuId],
      depth: 1,
    },
  });
}
