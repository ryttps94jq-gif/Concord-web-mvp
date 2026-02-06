'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import { getSidebarLenses, LENS_CATEGORIES, type LensCategory } from '@/lib/lens-registry';
import { Home, ChevronLeft, ChevronRight, X } from 'lucide-react';

const sidebarLenses = getSidebarLenses();

/** Group lenses by category for visual sections */
const groupedLenses = sidebarLenses.reduce<Record<string, typeof sidebarLenses>>((acc, lens) => {
  const cat = lens.category;
  if (!acc[cat]) acc[cat] = [];
  acc[cat].push(lens);
  return acc;
}, {});

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed, sidebarOpen, setSidebarOpen } = useUIStore();

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  // Close mobile sidebar on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen, setSidebarOpen]);

  const showLabel = !sidebarCollapsed || sidebarOpen;

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        className={`
          fixed left-0 top-0 h-screen bg-lattice-surface border-r border-lattice-border z-50
          transition-all duration-300 flex flex-col
          ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
          ${sidebarOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-lattice-border">
          <Link href="/" className="flex items-center gap-2" aria-label="Go to dashboard">
            <span className="text-2xl" aria-hidden="true">&#x1f9e0;</span>
            {showLabel && (
              <span className="font-bold text-gradient-neon">Concord</span>
            )}
          </Link>

          {/* Desktop collapse button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:block p-1.5 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 no-scrollbar" aria-label="Lens navigation">
          {/* Dashboard link */}
          <div className="mb-2">
            <Link
              href="/"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                pathname === '/'
                  ? 'bg-neon-blue/20 text-neon-blue'
                  : 'text-gray-400 hover:bg-lattice-elevated hover:text-white'
              } ${!showLabel ? 'justify-center' : ''}`}
              title={!showLabel ? 'Dashboard' : undefined}
            >
              <Home className="w-5 h-5 flex-shrink-0" />
              {showLabel && (
                <span className="text-sm font-medium truncate">Dashboard</span>
              )}
            </Link>
          </div>

          {/* Categorized lenses */}
          {Object.entries(groupedLenses).map(([category, lenses]) => (
            <div key={category} className="mb-3">
              {showLabel && (
                <p className={`px-3 py-1 text-xs uppercase tracking-wider ${LENS_CATEGORIES[category as LensCategory]?.color || 'text-gray-500'}`}>
                  {LENS_CATEGORIES[category as LensCategory]?.label || category}
                </p>
              )}
              <div className="space-y-0.5">
                {lenses.map((lens) => {
                  const Icon = lens.icon;
                  const isActive = pathname === lens.path;

                  return (
                    <Link
                      key={lens.id}
                      href={lens.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                        isActive
                          ? 'bg-neon-blue/20 text-neon-blue'
                          : 'text-gray-400 hover:bg-lattice-elevated hover:text-white'
                      } ${!showLabel ? 'justify-center' : ''}`}
                      title={!showLabel ? lens.name : undefined}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      {showLabel && (
                        <span className="text-sm font-medium truncate">{lens.name}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-lattice-border">
          {showLabel ? (
            <div className="text-xs text-gray-500">
              <p>Concord OS v5.0</p>
              <p className="text-neon-green">70% Sovereign</p>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-xs text-neon-green">70%</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
