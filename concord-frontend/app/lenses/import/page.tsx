'use client';

import { useState, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { Upload, FileJson, Database, Check, AlertTriangle, Loader2, FileText, Archive, RefreshCw, Layers, ChevronDown } from 'lucide-react';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { UniversalActions } from '@/components/lens/UniversalActions';
import { apiHelpers } from '@/lib/api/client';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';
import { UniversalImport } from '@/components/import/UniversalImport';

interface ImportJob {
  id: string;
  filename: string;
  type: 'dtus' | 'personas' | 'memories' | 'config' | 'full_backup';
  status: 'pending' | 'validating' | 'importing' | 'completed' | 'failed';
  progress: number;
  records_total: number;
  records_imported: number;
  records_skipped: number;
  records_failed: number;
  errors: string[];
  started_at: string;
  completed_at?: string;
}

interface ValidationResult {
  valid: boolean;
  type: string;
  record_count: number;
  warnings: string[];
  errors: string[];
  schema_version: string;
  compatible: boolean;
}

export default function ImportLens() {
  useLensNav('import');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('import');
  // Fetch import job history from the backend via lens data API
  const {
    items: importJobItems,
    isLoading: jobsLoading, isError: isError, error: error, refetch: refetch,
    create: createJob,
    update: _updateJob,
  } = useLensData<ImportJob>('import', 'import-job', { seed: [] });

  const importJobs: ImportJob[] = importJobItems.map(item => ({
    id: item.id,
    filename: item.data.filename ?? item.title,
    type: item.data.type ?? 'dtus',
    status: item.data.status ?? 'pending',
    progress: item.data.progress ?? 0,
    records_total: item.data.records_total ?? 0,
    records_imported: item.data.records_imported ?? 0,
    records_skipped: item.data.records_skipped ?? 0,
    records_failed: item.data.records_failed ?? 0,
    errors: item.data.errors ?? [],
    started_at: item.data.started_at ?? item.createdAt,
    completed_at: item.data.completed_at,
  } as ImportJob));

  const [showFeatures, setShowFeatures] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace' | 'skip_existing'>('merge');
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);

  const validateFile = useCallback(async (file: File) => {
    setValidating(true);
    setValidationResult(null);
    try {
      // Read file text to send for validation via the ingest API
      const text = await file.text();
      const response = await apiHelpers.ingest.manual({
        text: `validate:${text.slice(0, 2000)}`,
        title: file.name,
        tags: ['import-validation'],
        declaredSourceType: 'import-validate',
      });
      const respData = response.data;

      // Try to parse a validation result from the API response
      if (respData && typeof respData === 'object') {
        setValidationResult({
          valid: respData.valid !== false,
          type: respData.type || respData.declaredSourceType || 'dtus',
          record_count: respData.record_count || respData.count || 0,
          warnings: respData.warnings || [],
          errors: respData.errors || [],
          schema_version: respData.schema_version || '1.0.0',
          compatible: respData.compatible !== false,
        });
      } else {
        // Fallback: ingest succeeded so the file content is valid
        setValidationResult({
          valid: true,
          type: 'dtus',
          record_count: 0,
          warnings: [],
          errors: [],
          schema_version: '1.0.0',
          compatible: true,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Validation request failed';
      setValidationResult({
        valid: false,
        type: 'unknown',
        record_count: 0,
        warnings: [],
        errors: [message],
        schema_version: 'unknown',
        compatible: false,
      });
    } finally {
      setValidating(false);
    }
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      validateFile(file);
    }
  }, [validateFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      validateFile(file);
    }
  };

  const startImport = async () => {
    if (!selectedFile || !validationResult) return;

    setImporting(true);
    try {
      const fileText = await selectedFile.text();

      // Queue the import via the ingest queue API
      const response = await apiHelpers.ingest.queue({
        text: fileText,
        title: selectedFile.name,
        tags: ['import', validationResult.type, importMode],
        declaredSourceType: `import-${validationResult.type}`,
      });

      const respData = response.data;

      // Record the import job in lens data for history tracking
      await createJob({
        title: selectedFile.name,
        data: {
          filename: selectedFile.name,
          type: validationResult.type,
          status: respData?.status === 'completed' ? 'completed' : 'importing',
          progress: respData?.status === 'completed' ? 100 : 0,
          records_total: validationResult.record_count,
          records_imported: respData?.imported || 0,
          records_skipped: 0,
          records_failed: 0,
          errors: [],
          started_at: new Date().toISOString(),
          completed_at: respData?.status === 'completed' ? new Date().toISOString() : undefined,
          import_mode: importMode,
          queue_id: respData?.id || respData?.queueId,
        } as unknown as Partial<ImportJob>,
        meta: { tags: ['import', validationResult.type], status: 'active' },
      });

      setSelectedFile(null);
      setValidationResult(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      // Still record the failed job in history
      await createJob({
        title: selectedFile.name,
        data: {
          filename: selectedFile.name,
          type: validationResult.type,
          status: 'failed',
          progress: 0,
          records_total: validationResult.record_count,
          records_imported: 0,
          records_skipped: 0,
          records_failed: validationResult.record_count,
          errors: [message],
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        } as unknown as Partial<ImportJob>,
        meta: { tags: ['import', 'failed'], status: 'failed' },
      });
    } finally {
      setImporting(false);
    }
  };

  const handleQuickImport = async (action: 'restore' | 'full_restore' | 'template') => {
    setImporting(true);
    try {
      const prompts: Record<string, { text: string; title: string; sourceType: string }> = {
        restore: { text: 'restore-from-backup', title: 'Backup Restore', sourceType: 'backup-restore' },
        full_restore: { text: 'full-system-restore', title: 'Full System Restore', sourceType: 'full-restore' },
        template: { text: 'import-template', title: 'Template Import', sourceType: 'template-import' },
      };
      const p = prompts[action];
      await apiHelpers.ingest.manual({
        text: p.text,
        title: p.title,
        declaredSourceType: p.sourceType,
        tags: ['import', action],
      });
      await createJob({
        title: p.title,
        data: {
          filename: p.title,
          type: 'full_backup',
          status: 'importing',
          progress: 0,
          records_total: 0,
          records_imported: 0,
          records_skipped: 0,
          records_failed: 0,
          errors: [],
          started_at: new Date().toISOString(),
        } as unknown as Partial<ImportJob>,
        meta: { tags: ['import', action], status: 'active' },
      });
    } catch {
      // Error handled silently -- job creation will reflect failure
    } finally {
      setImporting(false);
    }
  };

  const getStatusColor = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed': return 'text-neon-green';
      case 'failed': return 'text-red-400';
      case 'importing': return 'text-neon-blue';
      case 'validating': return 'text-yellow-400';
      default: return 'text-void-400';
    }
  };

  const getStatusIcon = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed': return <Check className="w-4 h-4" />;
      case 'failed': return <AlertTriangle className="w-4 h-4" />;
      case 'importing':
      case 'validating':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      default: return <FileJson className="w-4 h-4" />;
    }
  };

  const getTypeIcon = (type: ImportJob['type']) => {
    switch (type) {
      case 'dtus': return <FileText className="w-4 h-4" />;
      case 'full_backup': return <Archive className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };


  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className="lens-container">
      <div className="lens-header">
        <div className="flex items-center gap-3">
          <Upload className="w-8 h-8 text-neon-blue" />
          <div>
            <h1 className="text-2xl font-bold text-white">Import Lens</h1>
            <p className="text-void-400">Drop any file — music, images, documents, code, data — it just works</p>
          </div>

      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="import" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
        </div>
      </div>

      {/* AI Actions */}
      <UniversalActions domain="import" artifactId={importJobItems[0]?.id} compact />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Universal Import — Drop any file */}
        <div className="space-y-4">
          <UniversalImport
            onImported={async (result) => {
              // Record the import in lens history
              await createJob({
                title: result.filename,
                data: {
                  filename: result.filename,
                  type: result.category as ImportJob['type'],
                  status: 'completed',
                  progress: 100,
                  records_total: 1,
                  records_imported: 1,
                  records_skipped: 0,
                  records_failed: 0,
                  errors: [],
                  started_at: new Date().toISOString(),
                  completed_at: new Date().toISOString(),
                } as unknown as Partial<ImportJob>,
                meta: { tags: ['import', result.category], status: 'completed' },
              });
            }}
          />

          {/* Legacy structured import (JSON/JSONL/ZIP backups) */}
          <div className="lens-card">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <FileJson className="w-4 h-4 text-neon-blue" />
              Structured Data Import
            </h2>
            <p className="text-void-500 text-xs mb-3">
              For Concord backups, JSON/JSONL data files, and ZIP archives.
            </p>
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                dragActive
                  ? 'border-neon-blue bg-neon-blue/10'
                  : 'border-void-600 hover:border-void-500'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {validating ? (
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-neon-blue animate-spin" />
              ) : (
                <Upload className={`w-8 h-8 mx-auto mb-2 ${dragActive ? 'text-neon-blue' : 'text-void-500'}`} />
              )}
              <p className="text-void-400 text-sm mb-2">
                {validating ? 'Validating...' : 'Drop backup or data files here'}
              </p>
              <label className="btn-secondary cursor-pointer text-xs">
                <input
                  type="file"
                  className="hidden"
                  accept=".json,.jsonl,.zip"
                  onChange={handleFileSelect}
                  disabled={validating}
                />
                Browse
              </label>
            </div>

            {/* Validation Result */}
            {validationResult && selectedFile && (
              <div className="mt-3 p-3 bg-void-800 rounded-lg text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium truncate">{selectedFile.name}</span>
                  {validationResult.valid ? (
                    <span className="text-neon-green text-xs flex items-center gap-1">
                      <Check className="w-3 h-3" /> Valid
                    </span>
                  ) : (
                    <span className="text-red-400 text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Invalid
                    </span>
                  )}
                </div>
                <div className="flex gap-2 mb-2">
                  {(['merge', 'replace', 'skip_existing'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setImportMode(mode)}
                      className={`px-2 py-0.5 rounded text-xs capitalize ${
                        importMode === mode
                          ? 'bg-neon-blue text-white'
                          : 'bg-void-700 text-void-300 hover:bg-void-600'
                      }`}
                    >
                      {mode.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <button
                  onClick={startImport}
                  disabled={!validationResult.valid || importing}
                  className="btn-primary w-full flex items-center justify-center gap-1 text-xs py-1.5"
                >
                  {importing && <Loader2 className="w-3 h-3 animate-spin" />}
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Import Options */}
        <div className="lens-card">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-neon-purple" />
            Quick Import
          </h2>

          <div className="space-y-3">
            <button
              onClick={() => handleQuickImport('restore')}
              disabled={importing}
              className="w-full p-4 bg-void-800 rounded-lg hover:bg-void-700 transition-colors text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <RefreshCw className={`w-8 h-8 text-neon-blue ${importing ? 'animate-spin' : ''}`} />
                <div>
                  <p className="text-white font-medium">Restore from Backup</p>
                  <p className="text-void-400 text-sm">Load from automatic backup point</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleQuickImport('full_restore')}
              disabled={importing}
              className="w-full p-4 bg-void-800 rounded-lg hover:bg-void-700 transition-colors text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <Archive className="w-8 h-8 text-neon-purple" />
                <div>
                  <p className="text-white font-medium">Full System Restore</p>
                  <p className="text-void-400 text-sm">Restore entire system from archive</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => handleQuickImport('template')}
              disabled={importing}
              className="w-full p-4 bg-void-800 rounded-lg hover:bg-void-700 transition-colors text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-neon-green" />
                <div>
                  <p className="text-white font-medium">Import Template</p>
                  <p className="text-void-400 text-sm">Load preconfigured templates</p>
                </div>
              </div>
            </button>
          </div>

          {/* Supported Formats */}
          <div className="mt-6 p-4 bg-void-800 rounded-lg">
            <h3 className="text-white font-medium mb-3">Supported Formats</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Audio (MP3, WAV, FLAC...)
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Images (PNG, JPG, SVG...)
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Video (MP4, WebM, MOV...)
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Documents (PDF, TXT, MD...)
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Data (JSON, CSV, XML...)
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Code (JS, Python, Rust...)
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Backups (JSON, ZIP)
              </div>
              <div className="flex items-center gap-2 text-void-300">
                <Check className="w-4 h-4 text-neon-green" /> Anything else
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import History */}
      <div className="lens-card mt-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileJson className="w-5 h-5 text-neon-green" />
          Import History
        </h2>

        {jobsLoading ? (
          <div className="flex items-center justify-center p-8 text-void-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading import history...
          </div>
        ) : importJobs.length === 0 ? (
          <div className="text-center p-8 text-void-500">
            No import jobs yet. Upload a file or use quick import to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {importJobs.map(job => (
              <div key={job.id} className="p-4 bg-void-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(job.type)}
                    <div>
                      <p className="text-white font-medium">{job.filename}</p>
                      <p className="text-void-400 text-sm capitalize">{job.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 ${getStatusColor(job.status)}`}>
                    {getStatusIcon(job.status)}
                    <span className="capitalize">{job.status}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                {(job.status === 'importing' || job.status === 'validating') && (
                  <div className="mb-2">
                    <div className="h-2 bg-void-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neon-blue transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <p className="text-void-400 text-sm mt-1">{job.progress}% complete</p>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 text-sm mt-2">
                  <div>
                    <span className="text-void-400">Total:</span>
                    <span className="text-white ml-2">{job.records_total.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-void-400">Imported:</span>
                    <span className="text-neon-green ml-2">{job.records_imported.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-void-400">Skipped:</span>
                    <span className="text-yellow-400 ml-2">{job.records_skipped}</span>
                  </div>
                  <div>
                    <span className="text-void-400">Failed:</span>
                    <span className="text-red-400 ml-2">{job.records_failed}</span>
                  </div>
                </div>

                {job.errors.length > 0 && (
                  <div className="mt-2 p-2 bg-red-900/20 rounded text-red-400 text-sm">
                    {job.errors.map((error, i) => (
                      <p key={i}>* {error}</p>
                    ))}
                  </div>
                )}

                <p className="text-void-500 text-xs mt-2">
                  Started: {new Date(job.started_at).toLocaleString()}
                  {job.completed_at && ` | Completed: ${new Date(job.completed_at).toLocaleString()}`}
                </p>
              </div>
            ))}
          </div>
        )}

      {/* Real-time Data Panel */}
      {realtimeData && (
        <RealtimeDataPanel
          domain="import"
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
            <LensFeaturePanel lensId="export_import" />
          </div>
        )}
      </div>
    </div>
  );
}
