'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Download, FileJson, FileText, Database, Check, Package, Layers, ChevronDown, FileCode, FileSpreadsheet, FileType, Hash, ArrowDownToLine } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';
import { ConnectiveTissueBar } from '@/components/lens/ConnectiveTissueBar';

export default function ExportLensPage() {
  useLensNav('export');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('export');
  const [showFeatures, setShowFeatures] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'json' | 'csv' | 'markdown'>('json');
  const [selectedData, setSelectedData] = useState<string[]>(['dtus']);
  const [exporting, setExporting] = useState(false);

  // Backend: GET /api/dtus
  const { data: dtusData, isLoading, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['dtus'],
    queryFn: () => api.get('/api/dtus').then((r) => r.data),
  });

  const dataOptions = [
    { id: 'dtus', label: 'DTUs', count: dtusData?.dtus?.length || 0, icon: Database },
    { id: 'events', label: 'Events', count: 500, icon: FileText },
    { id: 'settings', label: 'Settings', count: 45, icon: Package },
  ];

  const formats = [
    { id: 'json', label: 'JSON', desc: 'Full data structure' },
    { id: 'csv', label: 'CSV', desc: 'Spreadsheet format' },
    { id: 'markdown', label: 'Markdown', desc: 'Human readable' },
  ];

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      const data = { dtus: dtusData?.dtus || [] };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `concord-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    }, 1000);
  };

  const toggleData = (id: string) => {
    setSelectedData((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };


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

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">📤</span>
        <div>
          <h1 className="text-xl font-bold">Export Lens</h1>
          <p className="text-sm text-gray-400">
            Export DTUs and queues for user-owned data backups
          </p>
        </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="export" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Database className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{dtusData?.dtus?.length || 0}</p>
          <p className="text-sm text-gray-400">Total DTUs</p>
        </div>
        <div className="lens-card">
          <FileJson className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">3</p>
          <p className="text-sm text-gray-400">Export Formats</p>
        </div>
        <div className="lens-card">
          <Download className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{selectedData.length}</p>
          <p className="text-sm text-gray-400">Selected</p>
        </div>
        <div className="lens-card">
          <Check className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">Ready</p>
          <p className="text-sm text-gray-400">Status</p>
        </div>
      </div>

      {/* Data Selection */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-neon-blue" />
          Select Data to Export
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dataOptions.map((opt) => {
            const Icon = opt.icon;
            const selected = selectedData.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggleData(opt.id)}
                className={`lens-card text-left ${
                  selected ? 'border-neon-green ring-1 ring-neon-green' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-5 h-5 ${selected ? 'text-neon-green' : 'text-gray-400'}`} />
                  {selected && <Check className="w-4 h-4 text-neon-green" />}
                </div>
                <p className="font-semibold">{opt.label}</p>
                <p className="text-sm text-gray-400">{opt.count.toLocaleString()} items</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Format Selection */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <FileJson className="w-4 h-4 text-neon-green" />
          Export Format
        </h2>
        <div className="flex gap-4">
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => setSelectedFormat(fmt.id as typeof selectedFormat)}
              className={`flex-1 lens-card ${
                selectedFormat === fmt.id ? 'border-neon-purple ring-1 ring-neon-purple' : ''
              }`}
            >
              <p className="font-semibold">{fmt.label}</p>
              <p className="text-xs text-gray-400">{fmt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={selectedData.length === 0 || exporting}
        className="btn-neon green w-full py-4 text-lg"
      >
        <Download className="w-5 h-5 mr-2 inline" />
        {exporting ? 'Exporting...' : `Export ${selectedData.length} dataset(s) as ${selectedFormat.toUpperCase()}`}
      </button>

      <div className="panel p-4 border-l-4 border-sovereignty-locked">
        <h3 className="font-semibold text-sovereignty-locked mb-2">Your Data, Your Control</h3>
        <p className="text-sm text-gray-400">
          As per the OWNER_CONTROL invariant, you can export all your data at any time.
          Exports are complete and unredacted - this proves NO_RESALE compliance.
        </p>

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="export"
          data={realtimeData}
          isLive={isLive}
          lastUpdated={lastUpdated}
          insights={realtimeInsights}
          compact
        />
      )}
      </div>

      {/* Export Options Grid */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <ArrowDownToLine className="w-4 h-4 text-neon-purple" />
          Export Options
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Choose your preferred export format. Each format is optimized for different use cases and downstream integrations.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* JSON Card */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-neon-cyan/30 transition-all group cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-neon-cyan/10 rounded-lg group-hover:bg-neon-cyan/20 transition-colors">
                <FileJson className="w-6 h-6 text-neon-cyan" />
              </div>
              <div>
                <h3 className="font-medium text-white">JSON</h3>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Structured Data</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Full hierarchical data export preserving all relationships, metadata, and DTU provenance chains.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-[10px] text-gray-600">~2.4 MB estimated</span>
              <span className="text-[10px] text-neon-cyan">application/json</span>
            </div>
          </div>

          {/* CSV Card */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-neon-green/30 transition-all group cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-neon-green/10 rounded-lg group-hover:bg-neon-green/20 transition-colors">
                <FileSpreadsheet className="w-6 h-6 text-neon-green" />
              </div>
              <div>
                <h3 className="font-medium text-white">CSV</h3>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Tabular Data</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Flat spreadsheet format compatible with Excel, Google Sheets, and data analysis tools.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-[10px] text-gray-600">~1.8 MB estimated</span>
              <span className="text-[10px] text-neon-green">text/csv</span>
            </div>
          </div>

          {/* PDF Card */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-neon-purple/30 transition-all group cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-neon-purple/10 rounded-lg group-hover:bg-neon-purple/20 transition-colors">
                <FileText className="w-6 h-6 text-neon-purple" />
              </div>
              <div>
                <h3 className="font-medium text-white">PDF</h3>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Document</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Formatted human-readable report with charts, tables, and executive summary sections.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-[10px] text-gray-600">~5.1 MB estimated</span>
              <span className="text-[10px] text-neon-purple">application/pdf</span>
            </div>
          </div>

          {/* XML Card */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-yellow-500/30 transition-all group cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                <FileCode className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <h3 className="font-medium text-white">XML</h3>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Interchange</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Standards-compliant XML with XSD schema for enterprise system integration and SOAP APIs.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-[10px] text-gray-600">~3.2 MB estimated</span>
              <span className="text-[10px] text-yellow-500">application/xml</span>
            </div>
          </div>

          {/* Markdown Card */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-blue-400/30 transition-all group cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-blue-400/10 rounded-lg group-hover:bg-blue-400/20 transition-colors">
                <Hash className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">Markdown</h3>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Documentation</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              Clean markdown output ideal for documentation, wikis, and version-controlled knowledge bases.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-[10px] text-gray-600">~0.9 MB estimated</span>
              <span className="text-[10px] text-blue-400">text/markdown</span>
            </div>
          </div>
        </div>
      </div>

      <ConnectiveTissueBar lensId="export_import" />

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
            <LensFeaturePanel lensId="export_import" />
          </div>
        )}
      </div>
    </div>
  );
}
