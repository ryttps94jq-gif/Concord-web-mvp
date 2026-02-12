'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import {
  Scale,
  Briefcase,
  FileText,
  ShieldCheck,
  Upload,
  Lightbulb,
  Plus,
  Search,
  X,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Gavel,
  BookOpen,
  Eye,
  BarChart2,
  Calendar,
  Tag,
  Users,
  DollarSign,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Cases' | 'Contracts' | 'Compliance' | 'Filings' | 'IP';
type ArtifactType = 'Case' | 'Contract' | 'ComplianceItem' | 'Filing' | 'IPAsset';

type CaseStatus = 'intake' | 'active' | 'discovery' | 'negotiation' | 'trial' | 'appeal' | 'closed';
type ContractStatus = 'draft' | 'review' | 'negotiation' | 'executed' | 'active' | 'expired' | 'terminated';
type ComplianceStatus = 'compliant' | 'due_soon' | 'overdue' | 'under_review';
type AnyStatus = CaseStatus | ContractStatus | ComplianceStatus | string;

interface LegalArtifact {
  artifactType: ArtifactType;
  status: AnyStatus;
  description: string;
  jurisdiction?: string;
  assignee?: string;
  dueDate?: string;
  value?: number;
  parties?: string[];
  notes?: string;
  [key: string]: unknown;
}

const MODE_TABS: { id: ModeTab; icon: React.ElementType; defaultType: ArtifactType }[] = [
  { id: 'Cases', icon: Briefcase, defaultType: 'Case' },
  { id: 'Contracts', icon: FileText, defaultType: 'Contract' },
  { id: 'Compliance', icon: ShieldCheck, defaultType: 'ComplianceItem' },
  { id: 'Filings', icon: Upload, defaultType: 'Filing' },
  { id: 'IP', icon: Lightbulb, defaultType: 'IPAsset' },
];

const STATUSES_BY_TYPE: Record<ArtifactType, string[]> = {
  Case: ['intake', 'active', 'discovery', 'negotiation', 'trial', 'appeal', 'closed'],
  Contract: ['draft', 'review', 'negotiation', 'executed', 'active', 'expired', 'terminated'],
  ComplianceItem: ['compliant', 'due_soon', 'overdue', 'under_review'],
  Filing: ['draft', 'review', 'filed', 'accepted', 'rejected'],
  IPAsset: ['pending', 'registered', 'active', 'expired', 'contested'],
};

const STATUS_COLORS: Record<string, string> = {
  intake: 'neon-blue', active: 'neon-green', discovery: 'neon-purple', negotiation: 'amber-400',
  trial: 'red-400', appeal: 'orange-400', closed: 'gray-400',
  draft: 'gray-400', review: 'neon-blue', executed: 'neon-green', expired: 'red-400', terminated: 'red-400',
  compliant: 'neon-green', due_soon: 'amber-400', overdue: 'red-400', under_review: 'neon-blue',
  filed: 'neon-cyan', accepted: 'neon-green', rejected: 'red-400',
  pending: 'amber-400', registered: 'neon-green', contested: 'red-400',
};

const seedItems: { title: string; data: LegalArtifact }[] = [
  { title: 'Smith v. Acme Corp', data: { artifactType: 'Case', status: 'discovery', description: 'Product liability dispute, class action potential', jurisdiction: 'US Federal', assignee: 'J. Whitfield', dueDate: '2025-08-01', value: 2500000 } },
  { title: 'SaaS License Agreement - TechCo', data: { artifactType: 'Contract', status: 'review', description: 'Enterprise SaaS license with 3-year term', jurisdiction: 'Delaware', assignee: 'M. Torres', dueDate: '2025-07-15', value: 480000 } },
  { title: 'GDPR Annual Audit', data: { artifactType: 'ComplianceItem', status: 'due_soon', description: 'Annual GDPR compliance audit for EU operations', jurisdiction: 'EU', assignee: 'L. Fischer', dueDate: '2025-07-01' } },
  { title: 'SEC Form 10-K', data: { artifactType: 'Filing', status: 'draft', description: 'Annual report filing for fiscal year', jurisdiction: 'US Federal', assignee: 'R. Gupta', dueDate: '2025-06-30' } },
  { title: 'PatentApp #2025-1142', data: { artifactType: 'IPAsset', status: 'pending', description: 'Utility patent application for ML inference method', jurisdiction: 'USPTO', assignee: 'K. Yamamoto' } },
  { title: 'NDA - Vendor Partnership', data: { artifactType: 'Contract', status: 'executed', description: 'Mutual NDA for strategic vendor evaluation', jurisdiction: 'New York', parties: ['Our Company', 'VendorCo'], assignee: 'M. Torres' } },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function LegalLensPage() {
  useLensNav('legal');

  const [activeTab, setActiveTab] = useState<ModeTab>('Cases');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<LensItem<LegalArtifact> | null>(null);

  // Editor form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<ArtifactType>('Case');
  const [formStatus, setFormStatus] = useState<string>('intake');
  const [formDescription, setFormDescription] = useState('');
  const [formJurisdiction, setFormJurisdiction] = useState('');
  const [formAssignee, setFormAssignee] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData<LegalArtifact>('legal', 'artifact', {
    seed: seedItems.map(s => ({ title: s.title, data: s.data as unknown as Record<string, unknown>, meta: { status: s.data.status, tags: [s.data.artifactType] } })),
  });

  const runAction = useRunArtifact('legal');

  /* ---------- derived ---------- */

  const currentTabType = MODE_TABS.find(t => t.id === activeTab)?.defaultType ?? 'Case';
  const currentStatuses = STATUSES_BY_TYPE[currentTabType] ?? [];

  const filtered = useMemo(() => {
    let list = items.filter(i => (i.data as unknown as LegalArtifact).artifactType === currentTabType);
    if (filterStatus !== 'all') list = list.filter(i => (i.data as unknown as LegalArtifact).status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || (i.data as unknown as LegalArtifact).description?.toLowerCase().includes(q));
    }
    return list;
  }, [items, currentTabType, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    const all = items;
    return {
      totalCases: all.filter(i => (i.data as unknown as LegalArtifact).artifactType === 'Case').length,
      activeContracts: all.filter(i => (i.data as unknown as LegalArtifact).artifactType === 'Contract' && ['active', 'executed'].includes((i.data as unknown as LegalArtifact).status)).length,
      complianceOverdue: all.filter(i => (i.data as unknown as LegalArtifact).artifactType === 'ComplianceItem' && (i.data as unknown as LegalArtifact).status === 'overdue').length,
      pendingIP: all.filter(i => (i.data as unknown as LegalArtifact).artifactType === 'IPAsset' && (i.data as unknown as LegalArtifact).status === 'pending').length,
      totalValue: all.reduce((sum, i) => sum + ((i.data as unknown as LegalArtifact).value || 0), 0),
    };
  }, [items]);

  /* ---------- editor helpers ---------- */

  const openNewEditor = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormType(currentTabType);
    setFormStatus(STATUSES_BY_TYPE[currentTabType][0]);
    setFormDescription('');
    setFormJurisdiction('');
    setFormAssignee('');
    setFormDueDate('');
    setFormValue('');
    setFormNotes('');
    setShowEditor(true);
  };

  const openEditEditor = (item: LensItem<LegalArtifact>) => {
    const d = item.data as unknown as LegalArtifact;
    setEditingItem(item);
    setFormTitle(item.title);
    setFormType(d.artifactType);
    setFormStatus(d.status);
    setFormDescription(d.description || '');
    setFormJurisdiction(d.jurisdiction || '');
    setFormAssignee(d.assignee || '');
    setFormDueDate(d.dueDate || '');
    setFormValue(d.value ? String(d.value) : '');
    setFormNotes(d.notes || '');
    setShowEditor(true);
  };

  const handleSave = async () => {
    const payload = {
      title: formTitle,
      data: {
        artifactType: formType, status: formStatus, description: formDescription,
        jurisdiction: formJurisdiction, assignee: formAssignee, dueDate: formDueDate,
        value: formValue ? parseFloat(formValue) : undefined, notes: formNotes,
      } as unknown as Partial<LegalArtifact>,
      meta: { status: formStatus, tags: [formType] },
    };
    if (editingItem) await update(editingItem.id, payload);
    else await create(payload);
    setShowEditor(false);
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

  const handleAction = async (action: string, artifactId?: string) => {
    const targetId = artifactId || editingItem?.id || filtered[0]?.id;
    if (!targetId) return;
    try {
      const result = await runAction.mutateAsync({ id: targetId, action });
      setActionResult(result.result as Record<string, unknown>);
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  /* ---------- render ---------- */


  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className={ds.pageContainer}>
      {/* Legal Disclaimer */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-200">
          This tool assists with legal organization. It does not constitute legal advice.
        </p>
      </div>

      {/* Header */}
      <header className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <Scale className="w-7 h-7 text-neon-purple" />
          <div>
            <h1 className={ds.heading1}>Legal</h1>
            <p className={ds.textMuted}>Case management, contracts, compliance, and IP tracking</p>
          </div>
        </div>
        <button onClick={openNewEditor} className={ds.btnPrimary}>
          <Plus className="w-4 h-4" /> New Item
        </button>
      </header>

      {/* Mode Tabs */}
      <nav className="flex items-center gap-1 border-b border-lattice-border pb-3 overflow-x-auto">
        {MODE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setFilterStatus('all'); }}
            className={`${ds.btnGhost} whitespace-nowrap ${activeTab === tab.id ? 'bg-neon-purple/20 text-neon-purple' : ''}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.id}
          </button>
        ))}
      </nav>

      {/* Dashboard */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <Briefcase className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{stats.totalCases}</p>
          <p className={ds.textMuted}>Cases</p>
        </div>
        <div className={ds.panel}>
          <FileText className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{stats.activeContracts}</p>
          <p className={ds.textMuted}>Active Contracts</p>
        </div>
        <div className={ds.panel}>
          <AlertTriangle className="w-5 h-5 text-red-400 mb-2" />
          <p className="text-2xl font-bold">{stats.complianceOverdue}</p>
          <p className={ds.textMuted}>Overdue Compliance</p>
        </div>
        <div className={ds.panel}>
          <DollarSign className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
          <p className={ds.textMuted}>Total Value at Stake</p>
        </div>
      </div>

      {/* Domain Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => handleAction('conflictCheck')} className={ds.btnSecondary}>
          <ShieldCheck className="w-4 h-4" /> Conflict Check
        </button>
        <button onClick={() => handleAction('deadlineAudit')} className={ds.btnSecondary}>
          <Clock className="w-4 h-4" /> Deadline Audit
        </button>
        <button onClick={() => handleAction('generateBrief')} className={ds.btnSecondary}>
          <BookOpen className="w-4 h-4" /> Generate Brief
        </button>
        {runAction.isPending && <span className="text-xs text-neon-blue animate-pulse">Running...</span>}
      </div>

      {actionResult && (
        <div className={ds.panel}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={ds.heading3}>Action Result</h3>
            <button onClick={() => setActionResult(null)} className={ds.btnGhost}><X className="w-4 h-4" /></button>
          </div>
          <pre className={`${ds.textMono} text-xs overflow-auto max-h-48`}>{JSON.stringify(actionResult, null, 2)}</pre>
        </div>
      )}

      {/* Artifact Library */}
      <section className={ds.panel}>
        <div className={`${ds.sectionHeader} mb-4`}>
          <h2 className={ds.heading2}>{activeTab}</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className={`${ds.input} pl-9 w-56`} />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${ds.select} w-44`}>
              <option value="all">All statuses</option>
              {currentStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <p className={`${ds.textMuted} text-center py-12`}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Scale className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className={ds.textMuted}>No {activeTab.toLowerCase()} found. Create one to get started.</p>
          </div>
        ) : (
          <div className={ds.grid3}>
            {filtered.map(item => {
              const d = item.data as unknown as LegalArtifact;
              const color = STATUS_COLORS[d.status] || 'gray-400';
              return (
                <div key={item.id} className={ds.panelHover} onClick={() => openEditEditor(item)}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`${ds.heading3} text-base truncate flex-1`}>{item.title}</h3>
                    <span className={ds.badge(color)}>{d.status.replace(/_/g, ' ')}</span>
                  </div>
                  <p className={`${ds.textMuted} line-clamp-2 mb-3`}>{d.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    {d.jurisdiction && <span className="flex items-center gap-1"><Gavel className="w-3 h-3" /> {d.jurisdiction}</span>}
                    {d.assignee && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {d.assignee}</span>}
                    {d.dueDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {d.dueDate}</span>}
                    {d.value != null && d.value > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {formatCurrency(d.value)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Editor Modal */}
      {showEditor && (
        <>
          <div className={ds.modalBackdrop} onClick={() => setShowEditor(false)} />
          <div className={ds.modalContainer}>
            <div className={`${ds.modalPanel} max-w-2xl`}>
              <div className="flex items-center justify-between p-4 border-b border-lattice-border">
                <h2 className={ds.heading2}>{editingItem ? 'Edit' : 'New'} {formType}</h2>
                <button onClick={() => setShowEditor(false)} className={ds.btnGhost}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className={ds.label}>Title</label>
                  <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className={ds.input} placeholder="Title" />
                </div>
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Type</label>
                    <select value={formType} onChange={e => { setFormType(e.target.value as ArtifactType); setFormStatus(STATUSES_BY_TYPE[e.target.value as ArtifactType][0]); }} className={ds.select}>
                      {MODE_TABS.map(t => <option key={t.defaultType} value={t.defaultType}>{t.defaultType}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={ds.label}>Status</label>
                    <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className={ds.select}>
                      {(STATUSES_BY_TYPE[formType] ?? []).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Jurisdiction</label>
                    <input value={formJurisdiction} onChange={e => setFormJurisdiction(e.target.value)} className={ds.input} placeholder="e.g. US Federal, Delaware, EU" />
                  </div>
                  <div>
                    <label className={ds.label}>Assignee</label>
                    <input value={formAssignee} onChange={e => setFormAssignee(e.target.value)} className={ds.input} placeholder="Assigned attorney/team" />
                  </div>
                </div>
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Due Date</label>
                    <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className={ds.input} />
                  </div>
                  <div>
                    <label className={ds.label}>Value ($)</label>
                    <input type="number" value={formValue} onChange={e => setFormValue(e.target.value)} className={ds.input} placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className={ds.label}>Description</label>
                  <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} className={ds.textarea} rows={3} placeholder="Describe the matter..." />
                </div>
                <div>
                  <label className={ds.label}>Notes</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className={ds.textarea} rows={2} placeholder="Internal notes..." />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border-t border-lattice-border">
                <div>
                  {editingItem && (
                    <button onClick={() => { remove(editingItem.id); setShowEditor(false); }} className={ds.btnDanger}>
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowEditor(false)} className={ds.btnSecondary}>Cancel</button>
                  <button onClick={handleSave} className={ds.btnPrimary}>
                    {editingItem ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
