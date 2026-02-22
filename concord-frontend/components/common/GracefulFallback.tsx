'use client';

/**
 * GracefulFallback — Shows helpful messages instead of crashes when
 * any brain goes offline. Non-AI features always work.
 */

import { ReactNode } from 'react';
import { useBrainHealth } from '@/hooks/useBrainHealth';

interface FallbackProps {
  /** Feature name to display in the fallback message */
  feature: string;
  /** Which brain is required for this feature */
  brainRequired: 'conscious' | 'utility' | 'subconscious' | 'none';
  children: ReactNode;
}

export function GracefulFallback({ feature, brainRequired, children }: FallbackProps) {
  const { brainStatus, isLoading } = useBrainHealth();

  if (brainRequired === 'none') return <>{children}</>;

  // While loading, show children optimistically
  if (isLoading) return <>{children}</>;

  const brain = brainStatus[brainRequired];

  if (!brain || !brain.online) {
    return (
      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <p className="text-yellow-400 text-sm font-medium">
          {feature} temporarily unavailable
        </p>
        <p className="text-gray-400 text-xs mt-1">
          AI features are reconnecting. Your data is safe.
          Non-AI features continue to work normally.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export default GracefulFallback;
