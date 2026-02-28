'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState } from 'react';
import { FractalEmpireExplorer } from '@/components/graphs/FractalEmpireExplorer';
import { Layers, ZoomIn, ZoomOut, RotateCcw, Maximize } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';

export default function FractalLensPage() {
  useLensNav('fractal');

  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('fractal');

  const { data: fractalData, isLoading, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['fractal-structure'],
    queryFn: () => apiHelpers.emergent.latticeBeacon().then((r) => r.data),
  });

  const { data: nodeDetail, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['fractal-node', selectedNode],
    queryFn: () => apiHelpers.guidance.inspect('fractal', selectedNode!).then((r) => r.data),
    enabled: !!selectedNode,
  });


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError || isError2) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message} onRetry={() => { refetch(); refetch2(); }} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌀</span>
          <div>
            <h1 className="text-xl font-bold">Fractal Lens</h1>
            <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
            <p className="text-sm text-gray-400">
              Infinite zoom into DTU sub-structures
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.1, z - 0.2))}
            className="btn-neon p-2"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm font-mono px-2">{(zoomLevel * 100).toFixed(0)}%</span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(5, z + 0.2))}
            className="btn-neon p-2"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoomLevel(1);
              setSelectedNode(null);
            }}
            className="btn-neon p-2"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <RealtimeDataPanel domain="fractal" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />
      <DTUExportButton domain="fractal" data={{}} compact />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        {/* Fractal Visualization */}
        <div className="lg:col-span-3 panel p-4 flex flex-col">
          <div className="flex-1 graph-container relative overflow-hidden">
            <FractalEmpireExplorer
              data={fractalData?.nodes}
              zoom={zoomLevel}
              onNodeSelect={(id) => setSelectedNode(id)}
              selectedNode={selectedNode}
            />

            {/* Depth indicator */}
            <div className="absolute bottom-4 left-4 bg-lattice-void/80 px-3 py-2 rounded-lg">
              <p className="text-xs text-gray-400">Current Depth</p>
              <p className="text-lg font-mono text-neon-purple">
                Level {fractalData?.currentDepth || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Node Detail Panel */}
        <div className="panel p-4 space-y-4 overflow-auto">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-neon-purple" />
            Node Details
          </h3>

          {selectedNode && nodeDetail ? (
            <div className="space-y-4">
              <div className="lens-card">
                <p className="text-xs text-gray-400">Node ID</p>
                <p className="font-mono text-sm truncate">{nodeDetail.id}</p>
              </div>

              <div className="lens-card">
                <p className="text-xs text-gray-400">Type</p>
                <p className="font-medium">{nodeDetail.type}</p>
              </div>

              <div className="lens-card">
                <p className="text-xs text-gray-400">Children</p>
                <p className="text-2xl font-bold text-neon-cyan">
                  {nodeDetail.children?.length || 0}
                </p>
              </div>

              <div className="lens-card">
                <p className="text-xs text-gray-400">Depth</p>
                <p className="font-mono">{nodeDetail.depth}</p>
              </div>

              {nodeDetail.metadata && (
                <div className="lens-card">
                  <p className="text-xs text-gray-400 mb-2">Metadata</p>
                  <pre className="text-xs text-gray-300 overflow-auto max-h-32">
                    {JSON.stringify(nodeDetail.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <button
                onClick={() => setSelectedNode(null)}
                className="btn-neon w-full"
              >
                <Maximize className="w-4 h-4 mr-2 inline" />
                Zoom Into Node
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Click a node to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
