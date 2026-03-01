'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  lines = 1
}: SkeletonProps) {
  const baseClass = 'bg-lattice-border/50 animate-pulse';

  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg'
  };

  const style = {
    width: width ?? (variant === 'text' ? '100%' : undefined),
    height: height ?? (variant === 'circular' ? width : undefined)
  };

  if (lines > 1) {
    return (
      <div className={cn('space-y-2', className)} aria-busy="true" role="status">
        <span className="sr-only">Loading...</span>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseClass, variantClasses[variant])}
            style={{
              ...style,
              width: i === lines - 1 ? '60%' : '100%'
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseClass, variantClasses[variant], className)}
      style={style}
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// Card skeleton
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 rounded-lg bg-lattice-surface border border-lattice-border', className)}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1">
          <Skeleton className="w-1/3 mb-2" />
          <Skeleton className="w-1/4 h-3" />
        </div>
      </div>
      <Skeleton lines={3} className="mb-4" />
      <div className="flex gap-2">
        <Skeleton className="w-16 h-6 rounded-full" />
        <Skeleton className="w-16 h-6 rounded-full" />
        <Skeleton className="w-16 h-6 rounded-full" />
      </div>
    </div>
  );
}

// DTU card skeleton
export function SkeletonDTU({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 rounded-lg bg-lattice-surface border border-lattice-border', className)}>
      <div className="flex justify-between items-start mb-3">
        <Skeleton className="w-2/3 h-5" />
        <Skeleton variant="circular" width={24} height={24} />
      </div>
      <Skeleton lines={2} className="mb-3" />
      <div className="flex items-center gap-2">
        <Skeleton className="w-12 h-5 rounded" />
        <Skeleton className="w-20 h-5 rounded" />
        <Skeleton className="w-16 h-5 rounded" />
      </div>
    </div>
  );
}

// List skeleton
export function SkeletonList({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-lattice-surface/50">
          <Skeleton variant="circular" width={32} height={32} />
          <div className="flex-1">
            <Skeleton className="w-1/2 mb-1" />
            <Skeleton className="w-1/3 h-3" />
          </div>
          <Skeleton className="w-16 h-8 rounded" />
        </div>
      ))}
    </div>
  );
}

// Graph skeleton
export function SkeletonGraph({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-full h-64 rounded-lg bg-lattice-surface border border-lattice-border overflow-hidden', className)}>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-32 h-32 rounded-full border-2 border-neon-cyan/30"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute w-24 h-24 rounded-full border-2 border-neon-purple/30"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
        <motion.div
          className="absolute w-16 h-16 rounded-full border-2 border-neon-pink/30"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
        />
      </div>
      {/* Placeholder skeleton nodes */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-4 h-4 rounded-full bg-lattice-border"
          style={{
            left: `${20 + (i % 3) * 30}%`,
            top: `${20 + Math.floor(i / 3) * 40}%`
          }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

// Table skeleton
export function SkeletonTable({ rows = 5, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-lattice-border overflow-hidden', className)}>
      {/* Header */}
      <div className="flex gap-4 p-3 bg-lattice-surface border-b border-lattice-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-4" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4 p-3 border-b border-lattice-border/50 last:border-0">
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={col} className="flex-1 h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Stats skeleton
export function SkeletonStats({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg bg-lattice-surface border border-lattice-border">
          <Skeleton className="w-1/2 h-3 mb-2" />
          <Skeleton className="w-3/4 h-8 mb-1" />
          <Skeleton className="w-1/3 h-3" />
        </div>
      ))}
    </div>
  );
}

// Timeline skeleton
export function SkeletonTimeline({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton variant="circular" width={12} height={12} />
            {i < count - 1 && <div className="w-0.5 flex-1 bg-lattice-border/50 my-1" />}
          </div>
          <div className="flex-1 pb-4">
            <Skeleton className="w-1/4 h-3 mb-2" />
            <Skeleton className="w-3/4 h-4 mb-1" />
            <Skeleton className="w-1/2 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Chat skeleton
export function SkeletonChat({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn('flex gap-3', i % 2 === 0 ? '' : 'justify-end')}>
          {i % 2 === 0 && <Skeleton variant="circular" width={32} height={32} />}
          <div className={cn('max-w-[70%]', i % 2 === 0 ? '' : 'text-right')}>
            <Skeleton className={cn('h-16 rounded-lg', i % 2 === 0 ? 'w-48' : 'w-64')} />
            <Skeleton className="w-16 h-3 mt-1" />
          </div>
          {i % 2 !== 0 && <Skeleton variant="circular" width={32} height={32} />}
        </div>
      ))}
    </div>
  );
}
