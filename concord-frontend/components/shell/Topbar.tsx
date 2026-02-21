'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { disconnectSocket } from '@/lib/realtime/socket';
import { getLensById } from '@/lib/lens-registry';
import { Search, Bell, User, Command, Menu, LogOut, Settings, Shield } from 'lucide-react';
import { SyncStatusDot } from '@/components/common/OfflineIndicator';
import { useOnlineStatus } from '@/components/common/OfflineIndicator';
import { HeartbeatBar } from '@/components/live/HeartbeatBar';

export function Topbar() {
  const { sidebarCollapsed, setCommandPaletteOpen, activeLens, setSidebarOpen } = useUIStore();
  const { isOnline } = useOnlineStatus();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: _resonance } = useQuery({
    queryKey: ['resonance-quick'],
    queryFn: () => api.get('/api/lattice/resonance').then((r) => r.data).catch(() => null),
    refetchInterval: 30000,
    retry: false,
  });

  // Fetch recent events as notifications from the paginated events endpoint
  const { data: eventsData, refetch: refetchEvents } = useQuery({
    queryKey: ['events-paginated-notifs'],
    queryFn: () => api.get('/api/events/paginated', { params: { limit: 20 } }).then((r) => r.data),
    refetchInterval: 60000,
    retry: false,
  });

  const notificationEvents = eventsData?.events || eventsData?.items || [];
  const notifCount = notificationEvents.length;

  // Look up proper display name and icon from the lens registry
  const lensEntry = activeLens ? getLensById(activeLens) : null;
  const displayName = lensEntry?.name || (activeLens ? activeLens.charAt(0).toUpperCase() + activeLens.slice(1) : 'Dashboard');

  // Close user menu and notification panel on outside click or Escape
  useEffect(() => {
    if (!userMenuOpen && !notificationsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (userMenuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notificationsOpen && notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [userMenuOpen, notificationsOpen]);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Logout even if the API call fails
    }
    disconnectSocket();
    localStorage.removeItem('concord_entered');
    localStorage.removeItem('concord_api_key');
    window.location.href = '/login';
  };

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

        <div className="flex items-center gap-2">
          {lensEntry && (() => {
            const LensIcon = lensEntry.icon;
            return <LensIcon className="w-4 h-4 text-gray-400" />;
          })()}
          <h1 className="text-base lg:text-lg font-semibold truncate max-w-[120px] sm:max-w-none">
            {displayName}
          </h1>
        </div>
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

        {/* Live Heartbeat Bar — DTU counter, emergent status, sovereignty badge */}
        <div className="hidden md:block">
          <HeartbeatBar />
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setUserMenuOpen(false);
              if (!notificationsOpen) refetchEvents();
            }}
            className="relative p-2 rounded-lg hover:bg-lattice-elevated transition-colors"
            aria-label={`Notifications${notifCount > 0 ? ` (${notifCount} recent)` : ''}`}
            aria-expanded={notificationsOpen}
            aria-haspopup="true"
          >
            <Bell className="w-5 h-5 text-gray-400" />
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 lg:w-5 lg:h-5 bg-neon-pink text-white text-[10px] lg:text-xs rounded-full flex items-center justify-center">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-lattice-surface border border-lattice-border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col"
              role="menu"
            >
              <div className="px-4 py-3 border-b border-lattice-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                <button
                  onClick={() => router.push('/lenses/events')}
                  className="text-xs text-neon-cyan hover:text-neon-blue transition-colors"
                >
                  View all
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {notificationEvents.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 text-sm">
                    No recent notifications
                  </div>
                ) : (
                  notificationEvents.slice(0, 10).map((event: { id?: string; type?: string; message?: string; summary?: string; description?: string; created_at?: string; timestamp?: string; scope?: string }, idx: number) => (
                    <button
                      key={event.id || idx}
                      onClick={() => {
                        setNotificationsOpen(false);
                        router.push('/lenses/events');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-lattice-elevated transition-colors border-b border-lattice-border/50 last:border-b-0"
                      role="menuitem"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 w-2 h-2 rounded-full bg-neon-cyan flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-gray-200 truncate">
                            {event.message || event.summary || event.description || event.type || 'System event'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {event.type && <span className="text-gray-400">{event.type}</span>}
                            {(event.created_at || event.timestamp) && (
                              <span className="ml-2">
                                {new Date(event.created_at || event.timestamp || '').toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 lg:p-2 rounded-lg hover:bg-lattice-elevated transition-colors"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center">
              <User className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
            </div>
          </button>

          {userMenuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-48 bg-lattice-surface border border-lattice-border rounded-lg shadow-xl z-50 overflow-hidden"
              role="menu"
            >
              <button
                onClick={() => { setUserMenuOpen(false); router.push('/lenses/resonance'); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-lattice-elevated transition-colors"
                role="menuitem"
              >
                <Shield className="w-4 h-4" />
                System Health
              </button>
              <button
                onClick={() => { setUserMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-lattice-elevated transition-colors"
                role="menuitem"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <div className="border-t border-lattice-border" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                role="menuitem"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
