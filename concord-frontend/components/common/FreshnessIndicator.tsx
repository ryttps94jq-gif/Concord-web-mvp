'use client';

/**
 * FreshnessIndicator — Visual indicator for DTU freshness score.
 *
 * Displays a colored dot/bar with label showing how fresh a DTU is.
 * Fresh (>80%) = green, Warm (50-80%) = cyan, Cooling (20-50%) = amber, Stale (<20%) = red
 *
 * Usage:
 *   <FreshnessIndicator score={0.85} />
 *   <FreshnessIndicator score={0.3} showLabel />
 *   <FreshnessIndicator score={0.1} size="lg" />
 */

import { cn } from '@/lib/utils';

interface FreshnessIndicatorProps {
  /** Freshness score 0.0–1.0 */
  score: number;
  /** Show text label (fresh/warm/cooling/stale) */
  showLabel?: boolean;
  /** Show percentage */
  showPercent?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function freshnessColor(score: number): string {
  if (score >= 0.8) return 'neon-green';
  if (score >= 0.5) return 'neon-cyan';
  if (score >= 0.2) return 'amber-400';
  return 'red-400';
}

function freshnessLabel(score: number): string {
  if (score >= 0.8) return 'fresh';
  if (score >= 0.5) return 'warm';
  if (score >= 0.2) return 'cooling';
  return 'stale';
}

export function FreshnessIndicator({
  score,
  showLabel = false,
  showPercent = false,
  size = 'sm',
  className,
}: FreshnessIndicatorProps) {
  const color = freshnessColor(score);
  const label = freshnessLabel(score);
  const percent = Math.round(score * 100);

  const dotSize = size === 'lg' ? 'w-3 h-3' : size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2';
  const textSize = size === 'lg' ? 'text-sm' : size === 'md' ? 'text-xs' : 'text-[11px]';

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={`Freshness: ${percent}% (${label})`}>
      <span className={cn(dotSize, 'rounded-full', `bg-${color}`)} />
      {showLabel && <span className={cn(textSize, `text-${color}`)}>{label}</span>}
      {showPercent && <span className={cn(textSize, `text-${color}`)}>{percent}%</span>}
    </span>
  );
}

/**
 * FreshnessBar — Horizontal bar showing freshness level.
 */
export function FreshnessBar({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const color = freshnessColor(score);
  const percent = Math.round(score * 100);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 bg-lattice-elevated rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', `bg-${color}`)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={cn('text-[11px] w-8 text-right', `text-${color}`)}>
        {percent}%
      </span>
    </div>
  );
}
