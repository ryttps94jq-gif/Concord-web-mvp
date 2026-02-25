'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { useUIStore } from '@/store/ui';
import { Toasts } from '@/components/common/Toasts';
import { OperatorErrorBanner } from '@/components/common/OperatorErrorBanner';
import { SystemStatus } from '@/components/common/SystemStatus';
import { SystemGuidePanel } from '@/components/guidance/SystemGuidePanel';
import { FirstWinWizard } from '@/components/guidance/FirstWinWizard';
import { LensErrorBoundary } from '@/components/common/LensErrorBoundary';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineFallback } from '@/components/pwa/OfflineFallback';
import { QuickCapture, useQuickCapture } from '@/components/capture/QuickCapture';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { sidebarCollapsed, commandPaletteOpen, setCommandPaletteOpen, fullPageMode } = useUIStore();
  const [mounted, setMounted] = useState(false);
  const quickCapture = useQuickCapture();

  useEffect(() => {
    setMounted(true);

    // WebSocket is connected in Providers.tsx — no duplicate connectSocket() here.

    // Register service worker for PWA support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed — offline caching won't work
      });
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  if (!mounted) {
    // Minimal shell during hydration to prevent CLS flash
    return (
      <div className="flex h-screen overflow-hidden bg-lattice-void">
        <div className="flex-1" />
      </div>
    );
  }

  // Full page mode: render children without shell chrome (for landing page, etc.)
  if (fullPageMode) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-lattice-void">
      {/* FE-013: Skip-to-content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-neon-blue focus:text-white focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <OperatorErrorBanner />

        <main
          id="main-content"
          role="main"
          tabIndex={-1}
          className={`flex-1 overflow-auto transition-all duration-300 ${
            sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
          }`}
        >
          <LensErrorBoundary name="Main Content">
            {children}
          </LensErrorBoundary>
        </main>
      </div>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
      <Toasts />
      <SystemStatus />
      <SystemGuidePanel />
      <FirstWinWizard />
      <OfflineFallback />
      <InstallPrompt />
      <QuickCapture isOpen={quickCapture.isOpen} onClose={quickCapture.close} />
    </div>
  );
}
