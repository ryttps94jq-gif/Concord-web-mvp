// ============================================================================
// Royalty Cascade — System Invariant
//
// Rule: 30% of net revenue to the original creator. Halves at every level.
// This is NOT configurable. It is the same for every creator, every artifact.
//
// Universal constraints are fair. Special terms are political.
// Concord doesn't do political.
// ============================================================================

import type { LineageEdge, RoyaltyDistribution, RoyaltyCascadeResult } from './types';

// ---- System Constants (Invariants) ----

/** Base royalty rate for direct ancestors. */
const BASE_ROYALTY_RATE = 0.30; // 30%

/** Rate halves at each derivative depth. */
const HALVING_FACTOR = 0.5;

/** Below this floor, ancestor royalties cease. */
const ROYALTY_FLOOR = 0.01; // 1%

/** Platform fee rate. < 10% always. */
const PLATFORM_FEE_RATE = 0.09; // 9%

// ---- Cascade Computation ----

interface AncestorInfo {
  userId: string;
  userName: string;
  artifactId: string;
  artifactTitle: string;
  depth: number;
}

/**
 * Compute the royalty cascade for a sale.
 *
 * @param salePrice - Gross sale price
 * @param sellerId - The seller (direct creator) who made the sale
 * @param lineage - Ordered lineage edges from direct parent to root ancestor
 * @param ancestorLookup - Map of artifactId -> { userId, userName, artifactTitle }
 * @returns Complete royalty distribution breakdown
 *
 * Example with real numbers:
 * - Artist A publishes a beat
 * - Producer B buys Create ($25), remixes, publishes at $10
 * - Listener C buys B's remix for $10
 *
 *   salePrice = $10
 *   lineage = [{ derivativeArtifactId: B, sourceArtifactId: A, depth: 1 }]
 *
 *   $10.00 sale
 *   -$0.90 platform fee (9%)
 *   $9.10 net
 *   -$2.73 to Artist A (30% of net)
 *   =$6.37 to Producer B (remainder)
 */
export function computeRoyaltyCascade(
  salePrice: number,
  _sellerId: string,
  lineage: LineageEdge[],
  ancestorLookup: Map<string, AncestorInfo>,
): RoyaltyCascadeResult {
  // Step 1: Platform fee
  const platformFee = Math.round(salePrice * PLATFORM_FEE_RATE * 100) / 100;
  const netRevenue = Math.round((salePrice - platformFee) * 100) / 100;

  // Step 2: Compute ancestor royalties
  const distributions: RoyaltyDistribution[] = [];
  let totalAncestorRoyalties = 0;

  // Sort lineage by depth (closest ancestor first)
  const sortedLineage = [...lineage].sort((a, b) => a.depth - b.depth);

  for (const edge of sortedLineage) {
    const rate = BASE_ROYALTY_RATE * Math.pow(HALVING_FACTOR, edge.depth - 1);

    // Below floor — stop cascading
    if (rate < ROYALTY_FLOOR) break;

    const ancestor = ancestorLookup.get(edge.sourceArtifactId);
    if (!ancestor) continue;

    const amount = Math.round(netRevenue * rate * 100) / 100;
    totalAncestorRoyalties += amount;

    distributions.push({
      recipientId: ancestor.userId,
      recipientName: ancestor.userName,
      artifactId: ancestor.artifactId,
      artifactTitle: ancestor.artifactTitle,
      depth: edge.depth,
      rate,
      amount,
    });
  }

  // Step 3: Creator keeps the remainder
  const creatorNet = Math.round((netRevenue - totalAncestorRoyalties) * 100) / 100;

  return {
    grossRevenue: salePrice,
    platformFee,
    platformFeeRate: PLATFORM_FEE_RATE,
    netRevenue,
    distributions,
    creatorNet,
  };
}

/**
 * Build lineage chain by traversing parent references.
 * Returns ordered edges from direct parent to root ancestor.
 */
export function buildLineageChain(
  artifactId: string,
  getParent: (id: string) => { parentId: string; licenseId: string } | null,
  maxDepth: number = 10,
): LineageEdge[] {
  const edges: LineageEdge[] = [];
  let currentId = artifactId;
  let depth = 1;

  while (depth <= maxDepth) {
    const parent = getParent(currentId);
    if (!parent) break;

    edges.push({
      derivativeArtifactId: currentId,
      sourceArtifactId: parent.parentId,
      licenseId: parent.licenseId,
      depth,
    });

    currentId = parent.parentId;
    depth++;
  }

  return edges;
}

/**
 * Preview what a creator would earn if they published a derivative at a given price.
 * Used in the remix disclosure UI before publish.
 */
export function previewRoyaltyObligations(
  proposedPrice: number,
  lineage: LineageEdge[],
  ancestorLookup: Map<string, AncestorInfo>,
): {
  breakdown: RoyaltyCascadeResult;
  obligations: { name: string; title: string; rate: string; amount: string }[];
} {
  const breakdown = computeRoyaltyCascade(proposedPrice, '', lineage, ancestorLookup);

  const obligations = breakdown.distributions.map(d => ({
    name: d.recipientName,
    title: d.artifactTitle,
    rate: `${(d.rate * 100).toFixed(1)}%`,
    amount: `$${d.amount.toFixed(2)}`,
  }));

  return { breakdown, obligations };
}

// ---- Exported Constants ----

export const ROYALTY_CONSTANTS = {
  BASE_RATE: BASE_ROYALTY_RATE,
  HALVING_FACTOR,
  ROYALTY_FLOOR,
  PLATFORM_FEE_RATE,
} as const;
