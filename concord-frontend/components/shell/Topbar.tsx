'use client';

import { useUIStore } from '@/store/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Search, Bell, User, Command, Activity, Zap, Menu } from 'lucide-react';
import { SyncStatusDot } from '@/components/common/OfflineIndicator';
import { useOnlineStatus } from '@/components/common/OfflineIndicator';

export function Topbar() {
  const { sidebarCollapsed, setCommandPaletteOpen, activeLens, setSidebarOpen } = useUIStore();
  const { isOnline } = useOnlineStatus();

  const { data: resonance } = useQuery({
    queryKey: ['resonance-quick'],
    queryFn: () => api.get('/api/resonance/quick').then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/api/notifications/count').then((r) => r.data),
  });

  return (
    <header
      role="banner"
      className={`h-14 lg:h-16 bg-lattice-surface border-b border-lattice-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
      }`}
    >
      {/* Left - Mobile menu + Title */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-base lg:text-lg font-semibold capitalize truncate max-w-[120px] sm:max-w-none">
          {activeLens || 'Dashboard'}
        </h1>
      </div>

      {/* Center - Search (hidden on small mobile) */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 lg:px-4 py-2 bg-lattice-deep rounded-lg border border-lattice-border hover:border-neon-blue/50 transition-colors group"
        aria-label="Open command palette"
      >
        <Search className="w-4 h-4 text-gray-400 group-hover:text-neon-blue" />
        <span className="text-sm text-gray-400 hidden md:inline">Search...</span>
        <div className="hidden lg:flex items-center gap-1 ml-4 lg:ml-8">
          <kbd className="px-1.5 py-0.5 text-xs bg-lattice-elevated rounded text-gray-500">
            <Command className="w-3 h-3 inline" />
          </kbd>
          <kbd className="px-1.5 py-0.5 text-xs bg-lattice-elevated rounded text-gray-500">
            K
          </kbd>
        </div>
      </button>

      {/* Right Side */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Mobile search button */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="sm:hidden p-2 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* FE-010: Online/offline status indicator */}
        <div className="flex items-center gap-2 px-2 py-1.5" title={isOnline ? 'Online' : 'Offline — changes saved locally'}>
          <SyncStatusDot status={isOnline ? 'synced' : 'offline'} />
          <span className="hidden md:inline text-xs text-gray-400">{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        {/* Resonance Indicator (hidden on small mobile) */}
        <div className="hidden md:flex items-center gap-2 px-2 lg:px-3 py-1.5 bg-lattice-deep rounded-lg">
          <Activity className="w-4 h-4 text-neon-green" />
          <span className="text-xs lg:text-sm font-mono">
            {((resonance?.coherence || 0) * 100).toFixed(0)}%
          </span>
        </div>

        {/* DTU Count (hidden on mobile) */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-lattice-deep rounded-lg">
          <Zap className="w-4 h-4 text-neon-blue" />
          <span className="text-sm font-mono">{resonance?.dtuCount || 0}</span>
        </div>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg hover:bg-lattice-elevated transition-colors"
          aria-label={`Notifications${(notifications?.count || 0) > 0 ? ` (${notifications?.count} unread)` : ''}`}
        >
          <Bell className="w-5 h-5 text-gray-400" />
          {(notifications?.count || 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 lg:w-5 lg:h-5 bg-neon-pink text-white text-[10px] lg:text-xs rounded-full flex items-center justify-center">
              {notifications?.count > 9 ? '9+' : notifications?.count}
            </span>
          )}
        </button>

        {/* User Menu */}
        <button
          className="flex items-center gap-2 p-1.5 lg:p-2 rounded-lg hover:bg-lattice-elevated transition-colors"
          aria-label="User menu"
        >
          <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center">
            <User className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
          </div>
        </button>
      </div>
    </header>
  );
}
