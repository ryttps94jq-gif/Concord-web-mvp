'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { CoreLensNav } from '@/components/common/CoreLensNav';
import {
  isCoreLens,
  getParentCoreLens,
  type CoreLensId,
} from '@/lib/lens-registry';

/**
 * Automatically renders CoreLensNav for any lens in a core workspace.
 * Works for core lenses (chat, board, graph, code, studio) and absorbed sub-lenses.
 */
function CoreLensNavWrapper() {
  const pathname = usePathname();
  const match = pathname.match(/^\/lenses\/([^/]+)/);
  const slug = match?.[1];

  if (!slug) return null;

  if (isCoreLens(slug)) {
    return <CoreLensNav coreLensId={slug as CoreLensId} />;
  }

  const parentId = getParentCoreLens(slug);
  if (parentId) {
    return <CoreLensNav coreLensId={parentId} />;
  }

  return null;
}

/**
 * FE-012 + FE-014: Lens layout with loading isolation, error containment,
 * and automatic CoreLensNav for core workspace lenses.
 */
export default function LensLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CoreLensNavWrapper />
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
    </>
  );
}
