'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { Shield, Check, X, AlertTriangle, Lock, Eye, Zap, Loader2, Layers, ChevronDown } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface Invariant {
  id: string;
  name: string;
  description: string;
  status: 'enforced' | 'warning' | 'violated';
  category: 'ethos' | 'structural' | 'capability';
  frozen: boolean;
}

// Seed data — auto-created in backend on first load if empty
const SEED_INVARIANTS: { title: string; data: Record<string, unknown> }[] = [];

export default function InvariantLensPage() {
  useLensNav('invariant');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('invariant');
  const [testAction, setTestAction] = useState('');
  const [testResult, setTestResult] = useState<{ passed: boolean; message: string } | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);

  // Fetch invariants from backend via useLensData with auto-seeding
  const { items: invariantItems, isLoading, isError, error, refetch } = useLensData<Invariant>('invariant', 'invariant', {
    seed: SEED_INVARIANTS,
  });

  // Map fetched items to the Invariant display shape
  const invariants: Invariant[] = invariantItems.map((item) => {
    const d = item.data as unknown as Invariant;
    return {
      id: item.id,
      name: d.name ?? item.title,
      description: d.description ?? '',
      status: d.status ?? 'enforced',
      category: d.category ?? 'ethos',
      frozen: d.frozen ?? true,
    };
  });

  // Wire Action Invariant Tester to real backend via apiHelpers.lens.run
  const testMut = useMutation({
    mutationFn: async (text: string) => {
      // Use a stable invariant ID — 'test' is the virtual runner ID for invariant checking
      const { data } = await apiHelpers.lens.run('invariant', 'test', {
        action: 'check',
        params: { text },
      });
      return data as { ok: boolean; passed: boolean; message: string; violations?: string[] };
    },
    onError: (err) => console.error('testMut failed:', err instanceof Error ? err.message : err),
  });

  const handleTestAction = useCallback(async () => {
    if (!testAction.trim()) return;

    // Clear previous result immediately
    setTestResult(null);

    try {
      const result = await testMut.mutateAsync(testAction);
      setTestResult({
        passed: result.passed,
        message: result.message || (result.passed ? 'Action passes all invariant checks' : 'Action was blocked'),
      });
    } catch {
      // Fallback: local check if the backend endpoint is not yet deployed
      const lowerAction = testAction.toLowerCase();
      const violations = invariants.filter((inv) => {
        if (inv.name === 'NO_TELEMETRY' && lowerAction.includes('track')) return true;
        if (inv.name === 'NO_ADS' && lowerAction.includes('advertise')) return true;
        if (inv.name === 'NO_RESALE' && lowerAction.includes('sell data')) return true;
        if (inv.name === 'NO_DARK_PATTERNS' && lowerAction.includes('manipulate')) return true;
        return false;
      });

      if (violations.length > 0) {
        setTestResult({
          passed: false,
          message: `Blocked by: ${violations.map((v) => v.name).join(', ')}`,
        });
      } else {
        setTestResult({
          passed: true,
          message: 'Action passes all invariant checks',
        });
      }
    }
  }, [testAction, testMut, invariants]);

  const enforcedCount = invariants.filter((i) => i.status === 'enforced').length;
  const isTesting = testMut.isPending;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-neon-green" />
        <span className="ml-3 text-gray-400">Loading invariants...</span>
      </div>
    );
  }


  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <h1 className="text-xl font-bold">Invariant Lens</h1>
            <p className="text-sm text-gray-400">
              Interactive ethos enforcer and capability tester
            </p>
          </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="invariant" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
        </div>
        <div className="sovereignty-lock lock-70 px-4 py-2 rounded-lg">
          <span className="text-lg font-bold text-sovereignty-locked">
            {enforcedCount}/{invariants.length}
          </span>
          <span className="text-sm ml-2 text-gray-400">Enforced</span>
        </div>
      </header>


      {/* AI Actions */}
      <UniversalActions domain="invariant" artifactId={invariantItems[0]?.id} compact />
      {/* Action Tester */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-neon-purple" />
          Action Invariant Tester
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={testAction}
            onChange={(e) => setTestAction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTestAction()}
            placeholder="e.g., 'track user behavior' or 'process locally'"
            className="input-lattice flex-1"
          />
          <button
            onClick={handleTestAction}
            className="btn-neon purple"
            disabled={isTesting || !testAction.trim()}
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
          </button>
        </div>
        {testResult && (
          <div
            className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
              testResult.passed
                ? 'bg-neon-green/20 text-neon-green'
                : 'bg-neon-pink/20 text-neon-pink'
            }`}
          >
            {testResult.passed ? (
              <Check className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* Invariant Categories */}
      {(['ethos', 'structural', 'capability'] as const).map((category) => (
        <div key={category} className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2 capitalize">
            {category === 'ethos' && <Shield className="w-4 h-4 text-neon-green" />}
            {category === 'structural' && <Lock className="w-4 h-4 text-neon-blue" />}
            {category === 'capability' && <Eye className="w-4 h-4 text-neon-purple" />}
            {category} Invariants
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {invariants
              .filter((inv) => inv.category === category)
              .map((inv) => (
                <div
                  key={inv.id}
                  className="lens-card flex items-start gap-3"
                >
                  <span
                    className={`mt-1 ${
                      inv.status === 'enforced'
                        ? 'text-neon-green'
                        : inv.status === 'warning'
                        ? 'text-yellow-500'
                        : 'text-neon-pink'
                    }`}
                  >
                    {inv.status === 'enforced' ? (
                      <Check className="w-5 h-5" />
                    ) : inv.status === 'warning' ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <X className="w-5 h-5" />
                    )}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-bold">{inv.name}</p>
                      {inv.frozen && (
                        <Lock className="w-3 h-3 text-gray-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{inv.description}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}

      {/* Frozen Notice */}
      <div className="panel p-4 border-l-4 border-sovereignty-locked">
        <h3 className="font-semibold text-sovereignty-locked mb-2 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Sovereignty Lock Active
        </h3>
        <p className="text-sm text-gray-400">
          All invariants are frozen at 70% sovereignty lock. They cannot be disabled
          or modified without full council approval and structural verification.
        </p>

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="invariant"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}
      </div>

      {/* Lens Features */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowFeatures(!showFeatures)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Lens Features & Capabilities
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFeatures ? 'rotate-180' : ''}`} />
        </button>
        {showFeatures && (
          <div className="px-4 pb-4">
            <LensFeaturePanel lensId="invariant" />
          </div>
        )}
      </div>
    </div>
  );
}
