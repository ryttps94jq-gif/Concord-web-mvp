'use client';

import { Suspense } from 'react';

/**
 * FE-012 + FE-014: Lens layout with loading isolation and error containment.
 *
 * Every lens page is wrapped in a Suspense boundary for load isolation
 * and the existing error.tsx provides per-lens error recovery.
 */
export default function LensLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading lens...</p>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
