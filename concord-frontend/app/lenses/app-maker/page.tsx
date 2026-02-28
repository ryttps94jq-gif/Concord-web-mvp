'use client';

import { useState, useEffect } from 'react';
import { Boxes, Plus, CheckCircle, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import { apiHelpers } from '@/lib/api/client';
import { useUIStore } from '@/store/ui';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';

interface AppEntry {
  id: string;
  name: string;
  status: string;
  author: string;
  version: string;
  createdAt: string;
}

export default function AppMakerLens() {
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('app-maker');
  const setActiveLens = useUIStore((s) => s.setActiveLens);
  setActiveLens('app-maker');

  const [apps, setApps] = useState<AppEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      const resp = await apiHelpers.apps.list();
      setApps(resp.data?.apps || []);
    } catch { /* silent */ }
    setLoading(false);
  };

  const createApp = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiHelpers.apps.create({
        name: newName.trim(),
        primitives: {
          artifacts: { types: [], schema: {} },
          execution: { macros: [] },
          governance: { council_gated: false },
        },
        ui: { lens: 'custom', layout: 'dashboard', panels: [] },
      });
      setNewName('');
      await loadApps();
    } catch { /* silent */ }
    setCreating(false);
  };

  const promoteApp = async (id: string) => {
    try {
      await apiHelpers.apps.promote(id);
      await loadApps();
    } catch { /* silent */ }
  };

  const validateApp = async (id: string) => {
    try {
      const resp = await apiHelpers.apps.validate(id);
      const data = resp.data;
      if (data.valid) {
        alert('App is valid — all invariants pass.');
      } else {
        alert(`Violations:\n${(data.violations || []).join('\n')}`);
      }
    } catch { /* silent */ }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'text-gray-400';
      case 'published': return 'text-blue-400';
      case 'marketplace': return 'text-yellow-400';
      case 'global': return 'text-green-400';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Boxes className="w-6 h-6 text-neon-cyan" />
        <h1 className="text-xl font-bold">App Maker</h1>
      </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="app-maker" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-400">
        Compose apps from existing primitives. Artifact + Execution + Governance + Custom UI.
      </p>

      {/* Create App */}
      <div className="panel p-4 flex items-center gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New app name..."
          className="flex-1 bg-lattice-deep border border-lattice-edge rounded px-3 py-2 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && createApp()}
        />
        <button
          onClick={createApp}
          disabled={creating || !newName.trim()}
          className="bg-neon-cyan/10 border border-neon-cyan/30 rounded px-4 py-2 text-sm text-neon-cyan hover:bg-neon-cyan/20 disabled:opacity-50 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create
        </button>
      </div>

      {/* App List */}
      <div className="panel p-4">
        <h3 className="text-sm font-semibold mb-3">Your Apps</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : apps.length === 0 ? (
          <p className="text-sm text-gray-500">No apps yet. Create your first one above.</p>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => (
              <div key={app.id} className="bg-lattice-deep rounded p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{app.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${statusColor(app.status)} bg-opacity-20`}>
                      {app.status}
                    </span>
                    <span className="text-xs text-gray-500">v{app.version}</span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">{app.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => validateApp(app.id)}
                    className="text-xs text-gray-400 hover:text-neon-cyan flex items-center gap-1"
                    title="Validate"
                  >
                    <CheckCircle className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => promoteApp(app.id)}
                    className="text-xs text-gray-400 hover:text-green-400 flex items-center gap-1"
                    title="Promote"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invariant Reminder */}
      <div className="text-xs text-gray-500 text-center">
        All fields map to Identity, Artifact, Execution, Governance, Memory, or Economy primitives. No new core objects.

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="app-maker"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}
      </div>
    </div>
  );
}
