'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useState } from 'react';
import { Scale, Gavel, FileText, CheckCircle, XCircle, AlertTriangle, Plus, Layers, ChevronDown, BookOpen, Shield, Users, Clock, Copy } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';
import { ConnectiveTissueBar } from '@/components/lens/ConnectiveTissueBar';

export default function LawLensPage() {
  useLensNav('law');
  const [testProposal, setTestProposal] = useState('');
  const [gateResult, setGateResult] = useState<{ passed: boolean; reasons: string[] } | null>(null);
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [showFeatures, setShowFeatures] = useState(false);
  const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('law');

  // Lens artifact persistence layer
  const { isLoading, isError: isError, error: error, refetch: refetch, items: caseItems, create: createCase } = useLensData('law', 'case', { noSeed: true });

  const legalFrameworks = [
    { id: 'gdpr', name: 'GDPR', status: 'compliant', description: 'EU data protection' },
    { id: 'ccpa', name: 'CCPA', status: 'compliant', description: 'California privacy' },
    { id: 'ai-act', name: 'EU AI Act', status: 'review', description: 'AI regulations' },
    { id: 'dmca', name: 'DMCA', status: 'compliant', description: 'Copyright law' },
  ];

  const handleCreateCase = () => {
    if (!newCaseTitle.trim()) return;
    createCase({ title: newCaseTitle, data: { jurisdiction: 'US', frameworks: ['GDPR', 'CCPA', 'DMCA'] }, meta: { status: 'open' } });
    setNewCaseTitle('');
  };

  const handleGateCheck = () => {
    const lower = testProposal.toLowerCase();
    const violations: string[] = [];

    if (lower.includes('personal data') && lower.includes('sell')) {
      violations.push('GDPR Art. 6: Unlawful processing');
    }
    if (lower.includes('copyright') && lower.includes('bypass')) {
      violations.push('DMCA §1201: Circumvention');
    }
    if (lower.includes('discriminat')) {
      violations.push('EU AI Act: Prohibited practice');
    }

    setGateResult({
      passed: violations.length === 0,
      reasons: violations.length > 0 ? violations : ['No legal violations detected'],
    });
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
        <span className="text-2xl">⚖️</span>
        <div>
          <h1 className="text-xl font-bold">Law Lens</h1>
          <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
          <p className="text-sm text-gray-400">
            Legality gate playground for compliance testing
          </p>
        </div>
      </header>

      <RealtimeDataPanel domain="law" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={insights} compact />
      <DTUExportButton domain="law" data={{}} compact />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Scale className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{legalFrameworks.length}</p>
          <p className="text-sm text-gray-400">Frameworks</p>
        </div>
        <div className="lens-card">
          <CheckCircle className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{legalFrameworks.filter((f) => f.status === 'compliant').length}</p>
          <p className="text-sm text-gray-400">Compliant</p>
        </div>
        <div className="lens-card">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mb-2" />
          <p className="text-2xl font-bold">{legalFrameworks.filter((f) => f.status === 'review').length}</p>
          <p className="text-sm text-gray-400">Under Review</p>
        </div>
        <div className="lens-card">
          <Gavel className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">Active</p>
          <p className="text-sm text-gray-400">Gate Status</p>
        </div>
      </div>

      {/* Legality Gate Tester */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Gavel className="w-4 h-4 text-neon-purple" />
          Legality Gate Tester
        </h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={testProposal}
            onChange={(e) => setTestProposal(e.target.value)}
            placeholder="Describe a proposed action..."
            className="input-lattice flex-1"
          />
          <button onClick={handleGateCheck} className="btn-neon purple">
            Check Gate
          </button>
        </div>
        {gateResult && (
          <div className={`p-4 rounded-lg ${gateResult.passed ? 'bg-neon-green/20' : 'bg-neon-pink/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              {gateResult.passed ? (
                <CheckCircle className="w-5 h-5 text-neon-green" />
              ) : (
                <XCircle className="w-5 h-5 text-neon-pink" />
              )}
              <span className={gateResult.passed ? 'text-neon-green' : 'text-neon-pink'}>
                {gateResult.passed ? 'GATE PASSED' : 'GATE BLOCKED'}
              </span>
            </div>
            <ul className="text-sm space-y-1">
              {gateResult.reasons.map((r, i) => (
                <li key={i} className="text-gray-300">• {r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Case Files */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-neon-cyan" />
          Case Files
        </h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newCaseTitle}
            onChange={(e) => setNewCaseTitle(e.target.value)}
            placeholder="New case file title..."
            className="input-lattice flex-1"
          />
          <button onClick={handleCreateCase} className="btn-neon purple">
            <Plus className="w-4 h-4 mr-1 inline" />
            Create
          </button>
        </div>
        <div className="space-y-2">
          {caseItems.length === 0 ? (
            <p className="text-center py-4 text-gray-500 text-sm">No case files yet</p>
          ) : (
            caseItems.map((item) => (
              <div key={item.id} className="lens-card">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{item.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    item.meta?.status === 'open' ? 'bg-blue-400/20 text-blue-400' : 'bg-green-400/20 text-green-400'
                  }`}>
                    {item.meta?.status || 'draft'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Created {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Frameworks */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-neon-blue" />
          Legal Frameworks
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {legalFrameworks.map((fw) => (
            <div key={fw.id} className="lens-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{fw.name}</span>
                <span className={`w-2 h-2 rounded-full ${
                  fw.status === 'compliant' ? 'bg-neon-green' : 'bg-yellow-500'
                }`} />
              </div>
              <p className="text-xs text-gray-400">{fw.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contract Builder - Clause Library */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-neon-purple" />
          Contract Builder - Clause Library
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Browse and compose contracts from pre-approved clause templates. All clauses are validated against active legal frameworks.
        </p>

        {/* Clause Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {/* Data Protection Clauses */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-neon-cyan/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-neon-cyan/10 rounded-lg">
                <Shield className="w-5 h-5 text-neon-cyan" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">Data Protection</h3>
                <span className="text-[10px] text-gray-500">12 clauses available</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-neon-green/20 text-neon-green">GDPR</span>
            </div>
            <div className="space-y-2">
              {['Data Processing Agreement', 'Sub-Processor Notification', 'Data Breach Response'].map((clause) => (
                <div key={clause} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                  <span className="text-xs text-gray-300">{clause}</span>
                  <button className="text-[10px] text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1">
                    <Copy className="w-3 h-3" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Intellectual Property Clauses */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-neon-purple/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-neon-purple/10 rounded-lg">
                <Scale className="w-5 h-5 text-neon-purple" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">Intellectual Property</h3>
                <span className="text-[10px] text-gray-500">8 clauses available</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-neon-purple/20 text-neon-purple">DMCA</span>
            </div>
            <div className="space-y-2">
              {['IP Assignment', 'License Grant', 'Non-Compete Restriction'].map((clause) => (
                <div key={clause} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                  <span className="text-xs text-gray-300">{clause}</span>
                  <button className="text-[10px] text-neon-purple hover:text-neon-purple/80 flex items-center gap-1">
                    <Copy className="w-3 h-3" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Liability Clauses */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-neon-green/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-neon-green/10 rounded-lg">
                <Users className="w-5 h-5 text-neon-green" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">Liability & Indemnity</h3>
                <span className="text-[10px] text-gray-500">6 clauses available</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-neon-green/20 text-neon-green">Standard</span>
            </div>
            <div className="space-y-2">
              {['Limitation of Liability', 'Indemnification', 'Force Majeure'].map((clause) => (
                <div key={clause} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                  <span className="text-xs text-gray-300">{clause}</span>
                  <button className="text-[10px] text-neon-green hover:text-neon-green/80 flex items-center gap-1">
                    <Copy className="w-3 h-3" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Termination Clauses */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-yellow-500/30 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">Termination & Renewal</h3>
                <span className="text-[10px] text-gray-500">5 clauses available</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500">Standard</span>
            </div>
            <div className="space-y-2">
              {['Termination for Cause', 'Auto-Renewal Terms', 'Survival Provisions'].map((clause) => (
                <div key={clause} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                  <span className="text-xs text-gray-300">{clause}</span>
                  <button className="text-[10px] text-yellow-500 hover:text-yellow-500/80 flex items-center gap-1">
                    <Copy className="w-3 h-3" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contract Assembly Status */}
        <div className="bg-black/40 border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Contract Assembly</span>
            <span className="text-xs text-gray-500">0 clauses selected</span>
          </div>
          <div className="flex items-center justify-center py-6 border border-dashed border-white/10 rounded-lg">
            <p className="text-sm text-gray-500">Add clauses from the library above to start building your contract</p>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="flex-1 py-2 rounded-lg text-xs bg-neon-purple/10 border border-neon-purple/30 text-neon-purple hover:bg-neon-purple/20 transition-colors disabled:opacity-50" disabled>
              Preview Contract
            </button>
            <button className="flex-1 py-2 rounded-lg text-xs bg-neon-green/10 border border-neon-green/30 text-neon-green hover:bg-neon-green/20 transition-colors disabled:opacity-50" disabled>
              Generate Document
            </button>
          </div>
        </div>
      </div>

      <ConnectiveTissueBar lensId="ext_law" />

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
            <LensFeaturePanel lensId="ext_law" />
          </div>
        )}
      </div>
    </div>
  );
}
