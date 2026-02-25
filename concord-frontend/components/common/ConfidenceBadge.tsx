'use client';

/**
 * ConfidenceBadge — Visual indicator for AI output confidence scores.
 *
 * Shows calibrated confidence level from brain outputs with color-coded badge.
 * High (>75%) = green, Medium (50-75%) = cyan, Low (25-50%) = amber, Very Low (<25%) = red
 *
 * Usage:
 *   <ConfidenceBadge score={0.82} />
 *   <ConfidenceBadge score={0.45} showFactors factors={{ brainBase: 0.7, lengthPenalty: 0.8 }} />
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

interface ConfidenceData {
  score: number;
  label: string;
  factors?: Record<string, number>;
}

interface ConfidenceBadgeProps {
  /** Confidence score 0.0–1.0 */
  score: number;
  /** Confidence label override */
  label?: string;
  /** Detailed factors from estimateConfidence */
  factors?: Record<string, number>;
  /** Show detailed factor breakdown on click */
  showFactors?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  className?: string;
}

function confidenceColor(score: number): string {
  if (score >= 0.75) return 'neon-green';
  if (score >= 0.5) return 'neon-cyan';
  if (score >= 0.25) return 'amber-400';
  return 'red-400';
}

function confidenceLabel(score: number): string {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  if (score >= 0.25) return 'low';
  return 'very low';
}

export function ConfidenceBadge({
  score,
  label,
  factors,
  showFactors = false,
  size = 'sm',
  className,
}: ConfidenceBadgeProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const color = confidenceColor(score);
  const displayLabel = label || confidenceLabel(score);
  const percent = Math.round(score * 100);

  const textSize = size === 'md' ? 'text-xs' : 'text-[11px]';

  return (
    <span className={cn('inline-flex flex-col', className)}>
      <button
        onClick={showFactors ? () => setDetailsOpen(!detailsOpen) : undefined}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border transition-colors',
          `bg-${color}/10 text-${color} border-${color}/30`,
          showFactors && 'cursor-pointer hover:bg-opacity-20',
          textSize
        )}
        title={`AI Confidence: ${percent}% (${displayLabel})`}
      >
        <ShieldCheck className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
        {percent}%
        {showFactors && (
          detailsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {detailsOpen && factors && (
        <div className="mt-1 p-2 bg-lattice-void/80 border border-lattice-border rounded text-[11px] text-gray-400 space-y-0.5">
          {Object.entries(factors).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
              <span className={cn(
                val >= 0.8 ? 'text-neon-green' : val >= 0.5 ? 'text-gray-300' : 'text-amber-400'
              )}>
                {(val * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

/**
 * ConfidenceFromResult — Extract and display confidence from a brain result object.
 */
export function ConfidenceFromResult({
  result,
  className,
}: {
  result: { confidence?: ConfidenceData } | null | undefined;
  className?: string;
}) {
  if (!result?.confidence) return null;

  return (
    <ConfidenceBadge
      score={result.confidence.score}
      label={result.confidence.label}
      factors={result.confidence.factors}
      showFactors
      className={className}
    />
  );
}
