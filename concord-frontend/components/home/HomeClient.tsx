'use client';

/**
 * HomeClient — Client-side home page logic
 *
 * Takes over from the SSR landing content once JS hydrates.
 * Hides the SSR content and shows either:
 *   - LandingPage (interactive) for new visitors
 *   - DashboardPage for returning users
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ResonanceEmpireGraph } from '@/components/graphs/ResonanceEmpireGraph';
import { DTUEmpireCard } from '@/components/dtu/DTUEmpireCard';
import { LockDashboard } from '@/components/sovereignty/LockDashboard';
import { CoherenceBadge } from '@/components/graphs/CoherenceBadge';
import { LandingPage } from '@/components/landing/LandingPage';
import { useUIStore } from '@/store/ui';

const ENTERED_KEY = 'concord_entered';

export function HomeClient() {
  const [hasEntered, setHasEntered] = useState<boolean | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const setFullPageMode = useUIStore((state) => state.setFullPageMode);

  useEffect(() => {
    // Hide SSR landing content once client takes over
    const ssrEl = document.getElementById('ssr-landing');
    if (ssrEl) ssrEl.style.display = 'none';

    const entered = localStorage.getItem(ENTERED_KEY);
    const isEntered = entered === 'true';
    setHasEntered(isEntered);
    setFullPageMode(!isEntered);

    // If user has entered before, verify they're still authenticated
    if (isEntered) {
      api.get('/api/auth/me')
        .then(() => setAuthChecked(true))
        .catch(() => {
          // Not authenticated — the 401 interceptor will redirect to /login
          setAuthChecked(true);
        });
    }
  }, [setFullPageMode]);

  const handleEnter = () => {
    // Send user to register/login instead of straight to dashboard
    window.location.href = '/register';
  };

  // Still loading from localStorage
  if (hasEntered === null) {
    return null; // SSR content is visible until we know
  }

  // Show landing page for new visitors
  if (!hasEntered) {
    return <LandingPage onEnter={handleEnter} />;
  }

  // Wait for auth check before rendering dashboard
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  // Show dashboard for authenticated returning users
  return <DashboardPage />;
}

function DashboardPage() {
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get('/api/status').then((r) => r.data),
  });

  const { data: dtusData, isLoading: dtusLoading } = useQuery({
    queryKey: ['dtus'],
    queryFn: () => api.get('/api/dtus').then((r) => r.data),
  });

  const { data: eventsData } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/api/events').then((r) => r.data),
  });

  const dtus = dtusData?.dtus || [];
  const events = eventsData?.events || [];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-neon">
            Concord Empire Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            {statusLoading ? (
              <span className="animate-pulse">Loading status...</span>
            ) : (
              <>
                {status?.version || 'v5.0'} | {status?.counts?.dtus || 0} DTUs |{' '}
                {status?.llm?.enabled ? 'LLM Ready' : 'Local Mode'}
              </>
            )}
          </p>
        </div>
        <CoherenceBadge score={events.length} />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total DTUs"
          value={statusLoading ? '...' : status?.counts?.dtus || 0}
          emoji="cube"
          color="blue"
        />
        <MetricCard
          label="Simulations"
          value={statusLoading ? '...' : status?.counts?.simulations || 0}
          emoji="flask"
          color="purple"
        />
        <MetricCard
          label="Events"
          value={statusLoading ? '...' : status?.counts?.events || 0}
          emoji="activity"
          color="pink"
        />
        <MetricCard
          label="Sovereignty"
          value="70%"
          emoji="lock"
          color="green"
          locked
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QueueCard label="Ingest Queue" value={status?.queues?.ingest || 0} color="blue" loading={statusLoading} />
        <QueueCard label="Autocrawl Queue" value={status?.queues?.autocrawl || 0} color="purple" loading={statusLoading} />
        <QueueCard label="Macro Domains" value={status?.macro?.domains?.length || 0} color="cyan" loading={statusLoading} />
        <QueueCard label="Wallets" value={status?.counts?.wallets || 0} color="green" loading={statusLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 panel p-4">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="text-neon-blue">*</span> Resonance Universe
          </h2>
          <div className="h-[400px]">
            <ResonanceEmpireGraph />
          </div>
        </div>
        <div className="panel p-4">
          <LockDashboard />
        </div>
      </div>

      <div className="panel p-4">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span className="text-neon-cyan">*</span> Recent DTUs
        </h2>
        {dtusLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-lattice-surface animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dtus.slice(0, 6).map((dtu: { id: string; tier: 'regular' | 'mega' | 'hyper' | 'shadow'; summary: string; timestamp: string; resonance?: number; tags?: string[] }) => (
              <DTUEmpireCard key={dtu.id} dtu={dtu} />
            ))}
            {dtus.length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-400 mb-2">No DTUs yet</p>
                <p className="text-gray-500 text-sm">Start forging in the Chat or Forge lens</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickAction href="/lenses/chat" label="Chat" icon="message" />
        <QuickAction href="/lenses/graph" label="Graph" icon="share2" />
        <QuickAction href="/lenses/resonance" label="Resonance" icon="activity" />
        <QuickAction href="/lenses/council" label="Council" icon="users" />
      </div>
    </div>
  );
}

function MetricCard({
  label, value, emoji, color, locked,
}: {
  label: string; value: string | number; emoji?: string; icon?: string;
  color: 'blue' | 'purple' | 'pink' | 'green'; locked?: boolean;
}) {
  const colorClasses = {
    blue: 'border-neon-blue/30 text-neon-blue',
    purple: 'border-neon-purple/30 text-neon-purple',
    pink: 'border-neon-pink/30 text-neon-pink',
    green: 'border-sovereignty-locked/30 text-sovereignty-locked',
  };
  const icons: Record<string, React.ReactNode> = {
    cube: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
    flask: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
    activity: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    lock: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  };
  return (
    <div className={`lens-card ${locked ? 'sovereignty-lock lock-70' : ''}`}>
      <div className="flex items-center gap-3">
        <span className={`${colorClasses[color].split(' ')[1]}`}>{emoji && icons[emoji]}</span>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className={`text-2xl font-bold ${colorClasses[color].split(' ')[1]}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function QueueCard({ label, value, color, loading }: { label: string; value: number; color: 'blue' | 'purple' | 'cyan' | 'green'; loading?: boolean }) {
  const colorClasses = { blue: 'text-neon-blue', purple: 'text-neon-purple', cyan: 'text-neon-cyan', green: 'text-neon-green' };
  return (
    <div className="lens-card">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-xl font-bold ${colorClasses[color]}`}>{loading ? <span className="animate-pulse">...</span> : value}</p>
    </div>
  );
}

function QuickAction({ href, label, icon }: { href: string; label: string; icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    message: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
    share2: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>,
    activity: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12" /></svg>,
    users: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  };
  return (
    <a href={href} className="lens-card flex items-center justify-center gap-2 py-4 hover:scale-105 hover:border-neon-cyan/50 transition-all">
      <span className="text-neon-cyan">{icons[icon]}</span>
      <span className="font-medium">{label}</span>
    </a>
  );
}
