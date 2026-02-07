'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { GitFork, GitBranch, GitMerge, Layers } from 'lucide-react';

interface Fork {
  id: string;
  parentId: string | null;
  entityId: string;
  entityName: string;
  workspace: string;
  status: 'active' | 'merged' | 'abandoned';
  depth: number;
  children: number;
  createdAt: string;
  lastActivity: string;
}

export default function ForkLensPage() {
  useLensNav('fork');
  const [selectedFork, setSelectedFork] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  // Mock fork data (would come from ENTITY_HOME scans)
  const forks: Fork[] = [
    { id: 'f-root', parentId: null, entityId: 'e-004', entityName: 'Architect Zero', workspace: 'core', status: 'active', depth: 0, children: 3, createdAt: '2026-01-10', lastActivity: new Date().toISOString() },
    { id: 'f-001', parentId: 'f-root', entityId: 'e-001', entityName: 'Alpha Worker', workspace: 'main', status: 'active', depth: 1, children: 2, createdAt: '2026-01-15', lastActivity: new Date().toISOString() },
    { id: 'f-002', parentId: 'f-root', entityId: 'e-002', entityName: 'Research Prime', workspace: 'research-lab', status: 'active', depth: 1, children: 4, createdAt: '2026-01-20', lastActivity: new Date().toISOString() },
    { id: 'f-003', parentId: 'f-root', entityId: 'e-003', entityName: 'Guardian One', workspace: 'security', status: 'merged', depth: 1, children: 0, createdAt: '2026-01-22', lastActivity: '2026-01-30' },
    { id: 'f-004', parentId: 'f-001', entityId: 'e-001', entityName: 'Alpha Worker', workspace: 'main-exp-1', status: 'active', depth: 2, children: 0, createdAt: '2026-01-25', lastActivity: new Date().toISOString() },
    { id: 'f-005', parentId: 'f-002', entityId: 'e-002', entityName: 'Research Prime', workspace: 'quantum-exp', status: 'active', depth: 2, children: 1, createdAt: '2026-01-28', lastActivity: new Date().toISOString() },
  ];

  const statusColors = {
    active: 'text-neon-green bg-neon-green/20',
    merged: 'text-neon-blue bg-neon-blue/20',
    abandoned: 'text-gray-500 bg-gray-500/20',
  };

  const renderTreeNode = (fork: Fork, level: number = 0) => {
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
          {level > 0 && (
            <GitBranch className="w-4 h-4 text-gray-500" />
          )}
          {level === 0 && (
            <GitFork className="w-4 h-4 text-neon-purple" />
          )}
          <div className="flex-1 text-left">
            <p className="font-medium">{fork.workspace}</p>
            <p className="text-xs text-gray-400">{fork.entityName}</p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColors[fork.status]}`}>
            {fork.status}
          </span>
          {fork.children > 0 && (
            <span className="text-xs text-gray-500">
              +{fork.children}
            </span>
          )}
        </button>
        {children.map((child) => renderTreeNode(child, level + 1))}
      </div>
    );
  };

  const rootForks = forks.filter((f) => f.parentId === null);
  const selectedForkData = forks.find((f) => f.id === selectedFork);

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
          <p className="text-2xl font-bold">{Math.max(...forks.map((f) => f.depth)) + 1}</p>
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
                <p>{selectedForkData.createdAt}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-neon flex-1 text-sm">
                  <GitMerge className="w-3 h-3 mr-1 inline" />
                  Merge
                </button>
                <button className="btn-neon purple flex-1 text-sm">
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
      </div>
    </div>
  );
}
