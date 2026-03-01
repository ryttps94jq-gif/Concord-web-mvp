'use client';

import { useState, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Upload, Settings2, CheckCircle2, AlertTriangle, Loader2, Clock, Database, Layers, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

interface IngestJob {
  id: string;
  filename?: string;
  status: string;
  dtusCreated?: number;
  chunksProcessed?: number;
  totalChunks?: number;
  createdAt?: string;
  error?: string;
}

export default function IngestLensPage() {
  useLensNav('ingest');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('ingest');

  const queryClient = useQueryClient();
  const [textInput, setTextInput] = useState('');
  const [chunkSize, setChunkSize] = useState(500);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  // Fetch past ingestions
  const { data: historyData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ingest-history'],
    queryFn: () => api.get('/api/dtus?limit=50').then(r => r.data).catch(() => ({ dtus: [] })),
    refetchInterval: 10000,
  });

  const history: IngestJob[] = (historyData?.ingestions || []);
  const recentDtus = historyData?.dtus || [];

  // Ingest text as DTU
  const ingestText = useMutation({
    mutationFn: async () => {
      const chunks = [];
      // Simple chunking by character count
      for (let i = 0; i < textInput.length; i += chunkSize - chunkOverlap) {
        chunks.push(textInput.slice(i, i + chunkSize));
      }

      const results: Record<string, unknown>[] = [];
      for (let ci = 0; ci < chunks.length; ci++) {
        const res = await api.post('/api/dtus', {
          title: title || `Ingested chunk ${ci + 1}`,
          content: chunks[ci],
          domain: domain || undefined,
          tags: ['ingested'],
        });
        results.push(res.data);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingest-history'] });
      setTextInput('');
      setTitle('');
    },
  });

  // File upload handler
  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    setTextInput(text);
    setTitle(file.name.replace(/\.[^.]+$/, ''));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const chunkCount = textInput.length > 0 ? Math.ceil(textInput.length / (chunkSize - chunkOverlap)) : 0;

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={(error as Error)?.message} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <Upload className="w-6 h-6 text-neon-cyan" />
        <div>
          <h1 className="text-xl font-bold">Ingest</h1>
          <p className="text-sm text-gray-400">
            Upload text and documents to create DTUs with configurable chunking
          </p>
        </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="ingest" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
              dragOver ? 'border-neon-cyan bg-neon-cyan/5' : 'border-lattice-border hover:border-gray-600'
            )}
          >
            <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <p className="text-sm text-gray-300">Drag & drop a text file here</p>
            <p className="text-xs text-gray-500 mt-1">or</p>
            <label className="inline-block mt-2 px-4 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm text-gray-300 hover:text-white hover:border-gray-500 cursor-pointer transition-colors">
              Browse files
              <input type="file" className="hidden" accept=".txt,.md,.csv,.json" onChange={handleFileInput} />
            </label>
          </div>

          {/* Title and domain */}
          <div className="flex gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="flex-1 px-4 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
            />
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Domain (optional)"
              className="w-40 px-4 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
            />
          </div>

          {/* Text area */}
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste or type text to ingest..."
            rows={12}
            className="w-full px-4 py-3 bg-lattice-surface border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan resize-y font-mono"
          />

          {/* Preview and actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>{textInput.length.toLocaleString()} chars</span>
              <span>{chunkCount} chunk{chunkCount !== 1 ? 's' : ''}</span>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className={cn('flex items-center gap-1 transition-colors', showConfig ? 'text-neon-cyan' : 'hover:text-gray-300')}
              >
                <Settings2 className="w-4 h-4" /> Config
              </button>
            </div>
            <button
              onClick={() => ingestText.mutate()}
              disabled={!textInput.trim() || ingestText.isPending}
              className="px-6 py-2 bg-neon-cyan/20 border border-neon-cyan/40 rounded-lg text-sm font-medium text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {ingestText.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {ingestText.isPending ? 'Ingesting...' : 'Ingest'}
            </button>
          </div>

          {ingestText.isSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              Successfully ingested {chunkCount} chunk{chunkCount !== 1 ? 's' : ''} as DTUs
            </div>
          )}

          {ingestText.isError && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              <AlertTriangle className="w-4 h-4" />
              Failed to ingest: {(ingestText.error as Error)?.message || 'Unknown error'}
            </div>
          )}

          {/* Chunking config */}
          {showConfig && (
            <div className="panel p-4 space-y-3">
              <h3 className="text-sm font-medium text-white">Chunking Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Chunk size (chars): {chunkSize}</label>
                  <input type="range" min="100" max="2000" step="50" value={chunkSize}
                    onChange={(e) => setChunkSize(+e.target.value)} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Overlap (chars): {chunkOverlap}</label>
                  <input type="range" min="0" max="200" step="10" value={chunkOverlap}
                    onChange={(e) => setChunkOverlap(+e.target.value)} className="w-full" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History sidebar */}
        <div className="space-y-4">
          <div className="panel p-4">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" /> Ingestion History
            </h2>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-lattice-deep animate-pulse rounded" />)}
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map(job => (
                  <div key={job.id} className="p-2 rounded bg-lattice-deep text-xs">
                    <div className="flex justify-between">
                      <span className="text-white truncate">{job.filename || job.id.slice(0, 8)}</span>
                      <span className={cn(
                        job.status === 'completed' ? 'text-green-400' :
                        job.status === 'failed' ? 'text-red-400' : 'text-yellow-400'
                      )}>{job.status}</span>
                    </div>
                    {job.dtusCreated != null && (
                      <span className="text-gray-500">{job.dtusCreated} DTUs created</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 text-center py-4">No ingestion history yet</p>
            )}
          </div>

          <div className="panel p-4">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-gray-400" /> Recent DTUs
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentDtus.slice(0, 10).map((d: Record<string, unknown>) => (
                <div key={d.id as string} className="p-2 rounded bg-lattice-deep text-xs">
                  <p className="text-white truncate">{(d.title as string) || (d.summary as string)?.slice(0, 40) || (d.id as string).slice(0, 8)}</p>
                  <p className="text-gray-500">{d.tier as string || 'regular'}</p>
                </div>
              ))}
              {recentDtus.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">No DTUs yet</p>
              )}
            </div>
          </div>
        </div>

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="ingest"
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
            <LensFeaturePanel lensId="ingest" />
          </div>
        )}
      </div>
    </div>
  );
}
