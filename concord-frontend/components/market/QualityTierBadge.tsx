'use client';

/**
 * QualityTierBadge — Shows the quality tier of a marketplace artifact.
 * Tier 1 (Verified): Entity-verified, quality-gate approved
 * Tier 2 (Reviewed): Spot-check passed
 * Tier 3 (Pending): Awaiting review
 * Rejected (Draft): Failed quality gate
 */

import { cn } from '@/lib/utils';

interface QualityTierBadgeProps {
  tier: number | string;
  className?: string;
}

const TIER_CONFIG: Record<string | number, { label: string; color: string; icon: string }> = {
  1: { label: 'Verified', color: 'text-neon-green border-neon-green/30 bg-neon-green/10', icon: '\u2605' },
  2: { label: 'Reviewed', color: 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10', icon: '\u2713' },
  3: { label: 'Pending', color: 'text-zinc-400 border-zinc-600 bg-zinc-800', icon: '\u25CB' },
  rejected: { label: 'Draft', color: 'text-red-400 border-red-600/30 bg-red-900/10', icon: '\u2717' },
};

export function QualityTierBadge({ tier, className }: QualityTierBadgeProps) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG[3];

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium',
      config.color,
      className
    )}>
      {config.icon} {config.label}
    </span>
  );
}

export default QualityTierBadge;
