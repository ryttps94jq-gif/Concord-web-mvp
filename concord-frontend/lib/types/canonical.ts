/**
 * Canonical DTU Architecture — Frontend Types
 *
 * TypeScript types for the canonical deduplication system,
 * integrity verification, compression pipeline, and usage rights.
 */

// ── Canonical Deduplication ──────────────────────────────────────────

export interface CanonicalInfo {
  contentHash: string;
  canonicalDtuId: string;
  referenceCount: number;
  contentSize: number;
  compressedSize: number;
  compressionRatio: number;
  createdAt: string;
}

export interface CanonicalRegistration {
  isNew: boolean;
  contentHash: string;
  canonicalDtuId: string;
  referenceCount: number;
  originalCreatedAt?: string;
  compression?: CompressionResult;
}

export interface DedupStats {
  totalCanonicals: number;
  totalReferences: number;
  duplicatesPrevented: number;
  totalContentSize: number;
  totalCompressedSize: number;
  avgCompressionRatio: number;
  maxReferences: number;
  storageSaved: number;
  dedupRatio: number;
}

export interface DuplicateEntry {
  contentHash: string;
  canonicalDtuId: string;
  referenceCount: number;
  contentSize: number;
  compressedSize: number;
  compressionRatio: number;
  createdAt: string;
}

// ── Integrity Verification ──────────────────────────────────────────

export interface IntegrityReport {
  dtuId: string;
  contentHash: string;
  isValid: boolean;
  headerChecksum?: string;
  layerChecksums: Record<string, string>;
  signature?: string;
  signedBy?: string;
  signedAt?: string;
  signatureValid: boolean;
  chainValid?: boolean;
  verifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrityVerification {
  ok: boolean;
  dtuId: string;
  isValid: boolean;
  contentHash: string;
  contentMatch: boolean;
  headerMatch: boolean;
  layerResults: Record<string, {
    stored: string;
    current: string;
    match: boolean;
  }>;
  allLayersMatch: boolean;
  signatureValid: boolean;
  verifiedAt: string;
}

export interface ChainVerification {
  ok: boolean;
  rootDtuId: string;
  chainValid: boolean;
  nodesChecked: number;
  invalidCount: number;
  results: Array<{
    dtuId: string;
    isValid: boolean;
    contentHash?: string;
    contentMatch?: boolean;
    signatureValid?: boolean;
    reason?: string;
  }>;
}

export interface IntegrityStats {
  total: number;
  valid: number;
  invalid: number;
}

export type IntegrityStatus = 'verified' | 'unverified' | 'tampered';

// ── Compression ─────────────────────────────────────────────────────

export type CompressionAlgorithm = 'none' | 'gzip' | 'brotli' | 'zstd' | 'deflate';

export interface CompressionResult {
  algorithm: CompressionAlgorithm;
  originalSize: number;
  compressedSize: number;
  ratio: number;
  savings: number;
  savingsPercent: string;
  reason: string;
  compressedBase64?: string;
}

export interface CompressionPipelineStats {
  totalOperations: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  totalSavedBytes: number;
  overallRatio: number;
  overallSavingsPercent: string;
}

export interface CombinedStorageStats {
  pipeline: CompressionPipelineStats;
  dedup: {
    totalCanonicals: number;
    totalReferences: number;
    duplicatesPrevented: number;
    storageSaved: number;
  };
  combined: {
    totalOriginalBytes: number;
    totalStoredBytes: number;
    overallSavingsPercent: string;
  };
}

// ── Usage Rights ────────────────────────────────────────────────────

export type RightsScope = 'local' | 'global' | 'marketplace';

export type LicenseType = 'standard' | 'creative_commons' | 'commercial' | 'exclusive' | 'open';

export interface UsageRights {
  id: string;
  dtuId: string;
  creatorId: string;
  ownerId: string;
  derivativeAllowed: boolean;
  commercialAllowed: boolean;
  attributionRequired: boolean;
  scope: RightsScope;
  license: LicenseType;
  expiration?: string;
  transferable: boolean;
  maxDerivatives: number;
  derivativeCount: number;
  revokedUsers: string[];
  grantedUsers: string[];
  transferHistory: TransferRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface TransferRecord {
  from: string;
  to: string;
  timestamp: string;
}

export interface RightsReport {
  ok: boolean;
  dtuId: string;
  hasRights: boolean;
  report: (UsageRights & {
    licenseInfo: LicenseInfo | null;
    isExpired: boolean;
    derivativesRemaining: number | 'unlimited';
  }) | null;
}

export interface LicenseInfo {
  name: string;
  derivativeAllowed: boolean;
  commercialAllowed: boolean;
  attributionRequired: boolean;
  transferable: boolean;
  description: string;
}

export interface PermissionCheck {
  ok: boolean;
  dtuId: string;
  userId: string;
  action: string;
  allowed: boolean;
  reason: string;
}

export interface TransferResult {
  ok: boolean;
  dtuId: string;
  previousOwner: string;
  newOwner: string;
  transferredAt: string;
}

export interface CommercialRightsCheck {
  ok: boolean;
  dtuId: string;
  allowed: boolean;
  license: string;
  ownerId?: string;
  reason: string;
}

// ── Combined Stats Response ─────────────────────────────────────────

export interface CanonicalStatsResponse {
  ok: boolean;
  dedup: DedupStats;
  integrity: IntegrityStats;
  compression: CompressionPipelineStats;
}
