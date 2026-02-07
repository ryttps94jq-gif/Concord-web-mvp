'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Cloud, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type SyncStatus = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
  pendingChanges?: number;
  lastSynced?: Date;
  onSync?: () => void;
}

export function OfflineIndicator({
  className,
  showDetails = true,
  pendingChanges = 0,
  lastSynced,
  onSync
}: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when back online
      if (pendingChanges > 0) {
        setSyncStatus('syncing');
        onSync?.();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingChanges, onSync]);

  // Update sync status based on props
  useEffect(() => {
    if (!isOnline) {
      setSyncStatus('offline');
    } else if (pendingChanges > 0) {
      setSyncStatus('pending');
    } else {
      setSyncStatus('synced');
    }
  }, [isOnline, pendingChanges]);

  const statusConfig = {
    synced: {
      icon: <Check className="w-4 h-4" />,
      label: 'All changes saved',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30'
    },
    syncing: {
      icon: <RefreshCw className="w-4 h-4 animate-spin" />,
      label: 'Syncing...',
      color: 'text-neon-cyan',
      bgColor: 'bg-neon-cyan/10',
      borderColor: 'border-neon-cyan/30'
    },
    pending: {
      icon: <Cloud className="w-4 h-4" />,
      label: `${pendingChanges} pending`,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30'
    },
    offline: {
      icon: <WifiOff className="w-4 h-4" />,
      label: 'Offline',
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/30'
    },
    error: {
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'Sync error',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30'
    }
  };

  const config = statusConfig[syncStatus];

  const formatLastSynced = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn('relative', className)}>
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors',
          config.bgColor,
          config.borderColor,
          config.color
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {config.icon}
        <span className="text-sm font-medium">{config.label}</span>
      </motion.button>

      <AnimatePresence>
        {isExpanded && showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full mt-2 right-0 w-64 p-4 bg-lattice-surface border border-lattice-border rounded-lg shadow-xl z-50"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                'p-2 rounded-full',
                isOnline ? 'bg-green-500/20' : 'bg-gray-500/20'
              )}>
                {isOnline ? (
                  <Wifi className="w-5 h-5 text-green-400" />
                ) : (
                  <WifiOff className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {isOnline ? 'Connected' : 'Offline'}
                </p>
                <p className="text-xs text-gray-400">
                  {isOnline ? 'Real-time sync active' : 'Changes saved locally'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Pending changes</span>
                <span className={cn(
                  'font-medium',
                  pendingChanges > 0 ? 'text-yellow-400' : 'text-green-400'
                )}>
                  {pendingChanges}
                </span>
              </div>

              {lastSynced && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Last synced</span>
                  <span className="text-gray-300">{formatLastSynced(lastSynced)}</span>
                </div>
              )}

              {pendingChanges > 0 && isOnline && (
                <button
                  onClick={() => {
                    setSyncStatus('syncing');
                    onSync?.();
                  }}
                  className="w-full mt-2 px-3 py-2 bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 rounded-lg hover:bg-neon-cyan/30 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sync now
                </button>
              )}
            </div>

            {!isOnline && (
              <div className="mt-4 p-3 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                <p className="text-xs text-gray-400">
                  Your changes are being saved locally and will sync automatically when you're back online.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Minimal status dot for compact UI
export function SyncStatusDot({ status }: { status: SyncStatus }) {
  const colors = {
    synced: 'bg-green-400',
    syncing: 'bg-neon-cyan animate-pulse',
    pending: 'bg-yellow-400',
    offline: 'bg-gray-400',
    error: 'bg-red-400'
  };

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={cn('w-2 h-2 rounded-full', colors[status])}
    />
  );
}

// Toast notification for connection changes
export function ConnectionToast({ isOnline }: { isOnline: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50',
        isOnline
          ? 'bg-green-500/20 border border-green-500/30'
          : 'bg-gray-500/20 border border-gray-500/30'
      )}
    >
      {isOnline ? (
        <>
          <Wifi className="w-5 h-5 text-green-400" />
          <span className="text-green-400">Back online - syncing changes</span>
        </>
      ) : (
        <>
          <WifiOff className="w-5 h-5 text-gray-400" />
          <span className="text-gray-400">You're offline - changes saved locally</span>
        </>
      )}
    </motion.div>
  );
}

// Hook for monitoring connection status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Trigger reconnection logic
        setWasOffline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}
