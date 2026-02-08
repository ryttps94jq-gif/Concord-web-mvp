'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useState } from 'react';
import { Scale, Gavel, FileText, CheckCircle, XCircle, AlertTriangle, Plus } from 'lucide-react';

export default function LawLensPage() {
  useLensNav('law');
  const [testProposal, setTestProposal] = useState('');
  const [gateResult, setGateResult] = useState<{ passed: boolean; reasons: string[] } | null>(null);
  const [newCaseTitle, setNewCaseTitle] = useState('');

  // Lens artifact persistence layer
  const { items: caseItems, create: createCase } = useLensData('law', 'case', { noSeed: true });

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

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <span className="text-2xl">⚖️</span>
        <div>
          <h1 className="text-xl font-bold">Law Lens</h1>
          <p className="text-sm text-gray-400">
            Legality gate playground for compliance testing
          </p>
        </div>
      </header>

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
    </div>
  );
}
