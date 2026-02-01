'use client';

import { useUIStore } from '@/store/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Search, Bell, User, Command, Activity, Zap } from 'lucide-react';

export function Topbar() {
  const { sidebarCollapsed, setCommandPaletteOpen, currentLens } = useUIStore();

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
      className={`h-16 bg-lattice-surface border-b border-lattice-border flex items-center justify-between px-6 sticky top-0 z-30 transition-all duration-300 ${
        sidebarCollapsed ? 'ml-16' : 'ml-64'
      }`}
    >
      {/* Current Lens Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold capitalize">
          {currentLens || 'Dashboard'}
        </h1>
      </div>

      {/* Center - Search */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-lattice-deep rounded-lg border border-lattice-border hover:border-neon-blue/50 transition-colors group"
      >
        <Search className="w-4 h-4 text-gray-400 group-hover:text-neon-blue" />
        <span className="text-sm text-gray-400">Search...</span>
        <div className="flex items-center gap-1 ml-8">
          <kbd className="px-1.5 py-0.5 text-xs bg-lattice-elevated rounded text-gray-500">
            <Command className="w-3 h-3 inline" />
          </kbd>
          <kbd className="px-1.5 py-0.5 text-xs bg-lattice-elevated rounded text-gray-500">
            K
          </kbd>
        </div>
      </button>

      {/* Right Side */}
      <div className="flex items-center gap-4">
        {/* Resonance Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-lattice-deep rounded-lg">
          <Activity className="w-4 h-4 text-neon-green" />
          <span className="text-sm font-mono">
            {((resonance?.coherence || 0) * 100).toFixed(0)}%
          </span>
        </div>

        {/* DTU Count */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-lattice-deep rounded-lg">
          <Zap className="w-4 h-4 text-neon-blue" />
          <span className="text-sm font-mono">{resonance?.dtuCount || 0}</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-lattice-elevated transition-colors">
          <Bell className="w-5 h-5 text-gray-400" />
          {(notifications?.count || 0) > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-neon-pink text-white text-xs rounded-full flex items-center justify-center">
              {notifications?.count > 9 ? '9+' : notifications?.count}
            </span>
          )}
        </button>

        {/* User Menu */}
        <button className="flex items-center gap-2 p-2 rounded-lg hover:bg-lattice-elevated transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
        </button>
      </div>
    </header>
  );
}
