'use client';

/**
 * LensWrapper — Shared loading / error / empty state wrapper for lens content.
 *
 * A lightweight wrapper designed for lens sub-sections and panels that need
 * standard data-state handling. Complements <LensShell> (which wraps entire
 * pages) by providing a composable content-level wrapper:
 *
 *   - Loading: shows a centered spinner with optional text
 *   - Error: shows an error message with optional retry button
 *   - Empty: shows a customizable empty state with optional CTA
 *   - Children: rendered when data is available and not empty
 *
 * Usage:
 *   <LensWrapper
 *     isLoading={isLoading}
 *     isError={isError}
 *     isEmpty={items.length === 0}
 *     onRetry={refetch}
 *     loadingText="Fetching DTUs..."
 *     emptyTitle="No DTUs found"
 *     emptyDescription="Create or ingest content to populate this lens."
 *     emptyAction={{ label: 'Create DTU', onClick: handleCreate }}
 *   >
 *     <MyContent items={items} />
 *   </LensWrapper>
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ds } from '@/lib/design-system';
import { Loading } from '@/components/common/Loading';
import { EmptyState, ErrorState } from '@/components/common/EmptyState';
import { Inbox } from 'lucide-react';

// ---- Types ----------------------------------------------------------------

interface LensWrapperProps {
  /** Whether data is currently being fetched. */
  isLoading?: boolean;
  /** Whether the fetch resulted in an error. */
  isError?: boolean;
  /** Whether the data set is empty (and should show empty state). */
  isEmpty?: boolean;

  /** Error message to display. */
  errorMessage?: string;
  /** Retry callback for the error state. */
  onRetry?: () => void;

  /** Loading spinner text. Default "Loading...". */
  loadingText?: string;
  /** Spinner size. Default "md". */
  loadingSize?: 'sm' | 'md' | 'lg';

  /** Empty state title. Default "Nothing here yet". */
  emptyTitle?: string;
  /** Empty state description. */
  emptyDescription?: string;
  /** Empty state icon override. */
  emptyIcon?: ReactNode;
  /** Empty state primary action. */
  emptyAction?: { label: string; onClick: () => void };
  /** Empty state secondary action. */
  emptySecondaryAction?: { label: string; onClick: () => void };
  /** Empty state variant. Default "default". */
  emptyVariant?: 'default' | 'minimal' | 'illustrated';

  /** Wrap in a panel (bg/border/padding). Default false. */
  panel?: boolean;
  /** Minimum height for loading/error/empty areas. Default "py-12". */
  minHeight?: string;
  /** Additional class names applied to the outer container. */
  className?: string;

  /** Content to render when loaded, no error, and not empty. */
  children: ReactNode;
}

// ---- Component -------------------------------------------------------------

export function LensWrapper({
  isLoading = false,
  isError = false,
  isEmpty = false,
  errorMessage,
  onRetry,
  loadingText = 'Loading...',
  loadingSize = 'md',
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyIcon,
  emptyAction,
  emptySecondaryAction,
  emptyVariant = 'default',
  panel = false,
  minHeight = 'py-12',
  className,
  children,
}: LensWrapperProps) {
  const outer = cn(panel && ds.panel, className);

  // 1. Loading state
  if (isLoading) {
    return (
      <div className={outer}>
        <div className={cn('flex items-center justify-center', minHeight)}>
          <Loading size={loadingSize} text={loadingText} />
        </div>
      </div>
    );
  }

  // 2. Error state
  if (isError) {
    return (
      <div className={outer}>
        <div className={cn('flex items-center justify-center', minHeight)}>
          <ErrorState error={errorMessage} onRetry={onRetry} />
        </div>
      </div>
    );
  }

  // 3. Empty state
  if (isEmpty) {
    return (
      <div className={outer}>
        <div className={cn('flex items-center justify-center', minHeight)}>
          <EmptyState
            icon={emptyIcon ?? <Inbox className="w-8 h-8" />}
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
            secondaryAction={emptySecondaryAction}
            variant={emptyVariant}
          />
        </div>
      </div>
    );
  }

  // 4. Content
  if (panel) {
    return <div className={outer}>{children}</div>;
  }

  // When panel=false, avoid an unnecessary wrapper div if no className
  return className ? <div className={className}>{children}</div> : <>{children}</>;
}
