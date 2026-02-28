'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState, useCallback } from 'react';
import { GitFork, GitBranch, GitMerge, Layers, Loader2 } from 'lucide-react';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';

interface ForkData {
  parentId: string | null;
  entityId: string;
  entityName: string;
  workspace: string;
  status: 'active' | 'merged' | 'abandoned';
  depth: number;
  children: number;
  lastActivity: string;
}

const SEED_FORKS: {
  title: string;
  data: Record<string, unknown>;
}[] = [];

export default function ForkLensPage() {
  useLensNav('fork');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('fork');
  const [selectedFork, setSelectedFork] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  const { items: forkItems, isLoading, isError: isError, error: error, refetch: refetch, create, update } = useLensData<ForkData>('fork', 'fork', {
    seed: SEED_FORKS,
  });

  const forks = forkItems.map((item) => ({
    id: item.title || item.id,
    _artifactId: item.id,
    parentId: item.data.parentId,
    entityId: item.data.entityId,
    entityName: item.data.entityName,
    workspace: item.data.workspace,
    status: item.data.status,
    depth: item.data.depth,
    children: item.data.children,
    createdAt: item.createdAt,
    lastActivity: item.data.lastActivity,
  }));

  const statusColors = {
    active: 'text-neon-green bg-neon-green/20',
    merged: 'text-neon-blue bg-neon-blue/20',
    abandoned: 'text-gray-500 bg-gray-500/20',
  };

  const handleMerge = useCallback(async () => {
    if (!selectedFork) return;
    const forkItem = forkItems.find((f) => (f.title || f.id) === selectedFork);
    if (!forkItem) return;
    await update(forkItem.id, { data: { ...forkItem.data, status: 'merged' as const } });
  }, [selectedFork, forkItems, update]);

  const handleFork = useCallback(async () => {
    if (!selectedFork) return;
    const parent = forks.find((f) => f.id === selectedFork);
    if (!parent) return;
    await create({
      title: `f-${Date.now().toString(36)}`,
      data: {
        parentId: parent.id,
        entityId: parent.entityId,
        entityName: parent.entityName,
        workspace: `${parent.workspace}-fork-${Date.now().toString(36).slice(-4)}`,
        status: 'active',
        depth: parent.depth + 1,
        children: 0,
        lastActivity: new Date().toISOString(),
      },
    });
  }, [selectedFork, forks, create]);

  const renderTreeNode = (fork: typeof forks[0], level: number = 0) => {
    const children = forks.filter((f) => f.parentId === fork.id);
    const isSelected = selectedFork === fork.id;

    return (
      <div key={fork.id} style={{ marginLeft: `${level * 24}px` }}>
        <button
          onClick={() => setSelectedFork(isSelected ? null : fork.id)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg mb-2 transition-colors ${
            isSelected
              ? 'bg-neon-cyan/20 border border-neon-cyan'
              : 'bg-lattice-deep hover:bg-lattice-surface'
          }`}
        >
          {level > 0 && <GitBranch className="w-4 h-4 text-gray-500" />}
          {level === 0 && <GitFork className="w-4 h-4 text-neon-purple" />}
          <div className="flex-1 text-left">
            <p className="font-medium">{fork.workspace}</p>
            <p className="text-xs text-gray-400">{fork.entityName}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColors[fork.status]}`}>
            {fork.status}
          </span>
          {fork.children > 0 && (
            <span className="text-xs text-gray-500">+{fork.children}</span>
          )}
        </button>
        {children.map((child) => renderTreeNode(child, level + 1))}
      </div>
    );
  };

  const rootForks = forks.filter((f) => f.parentId === null);
  const selectedForkData = forks.find((f) => f.id === selectedFork);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
        <span className="ml-3 text-gray-400">Loading fork tree...</span>
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
          <span className="text-2xl">🌿</span>
          <div>
            <h1 className="text-xl font-bold">Fork Lens</h1>
            <p className="text-sm text-gray-400">
              Visualize entity forks and workspace lineages
            </p>
          </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="fork" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1 rounded ${viewMode === 'tree' ? 'bg-neon-purple/20 text-neon-purple' : 'bg-lattice-surface text-gray-400'}`}
          >
            Tree
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded ${viewMode === 'list' ? 'bg-neon-purple/20 text-neon-purple' : 'bg-lattice-surface text-gray-400'}`}
          >
            List
          </button>
        </div>
      </header>


      {/* AI Actions */}
      <UniversalActions domain="fork" artifactId={forkItems[0]?.id} compact />
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <GitFork className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{forks.length}</p>
          <p className="text-sm text-gray-400">Total Forks</p>
        </div>
        <div className="lens-card">
          <GitBranch className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{forks.filter((f) => f.status === 'active').length}</p>
          <p className="text-sm text-gray-400">Active</p>
        </div>
        <div className="lens-card">
          <GitMerge className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{forks.filter((f) => f.status === 'merged').length}</p>
          <p className="text-sm text-gray-400">Merged</p>
        </div>
        <div className="lens-card">
          <Layers className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{forks.length > 0 ? Math.max(...forks.map((f) => f.depth)) + 1 : 0}</p>
          <p className="text-sm text-gray-400">Max Depth</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fork Tree */}
        <div className="lg:col-span-2 panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <GitFork className="w-4 h-4 text-neon-purple" />
            Fork Tree
          </h2>
          <div className="space-y-1">
            {rootForks.map((fork) => renderTreeNode(fork))}
          </div>
        </div>

        {/* Fork Details */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-neon-cyan" />
            Fork Details
          </h2>
          {selectedForkData ? (
            <div className="space-y-4">
              <div className="lens-card">
                <p className="text-xs text-gray-400">Workspace</p>
                <p className="font-mono">{selectedForkData.workspace}</p>
              </div>
              <div className="lens-card">
                <p className="text-xs text-gray-400">Entity</p>
                <p>{selectedForkData.entityName}</p>
                <p className="text-xs text-gray-500 font-mono">{selectedForkData.entityId}</p>
              </div>
              <div className="lens-card">
                <p className="text-xs text-gray-400">Status</p>
                <span className={`text-sm px-2 py-0.5 rounded ${statusColors[selectedForkData.status]}`}>
                  {selectedForkData.status}
                </span>
              </div>
              <div className="lens-card">
                <p className="text-xs text-gray-400">Depth</p>
                <p className="text-xl font-bold text-neon-purple">{selectedForkData.depth}</p>
              </div>
              <div className="lens-card">
                <p className="text-xs text-gray-400">Created</p>
                <p>{new Date(selectedForkData.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleMerge}
                  disabled={selectedForkData.status === 'merged'}
                  className="btn-neon flex-1 text-sm"
                >
                  <GitMerge className="w-3 h-3 mr-1 inline" />
                  Merge
                </button>
                <button onClick={handleFork} className="btn-neon purple flex-1 text-sm">
                  <GitFork className="w-3 h-3 mr-1 inline" />
                  Fork
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <GitFork className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Select a fork to view details</p>
            </div>
          )}
        </div>

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="fork"
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
