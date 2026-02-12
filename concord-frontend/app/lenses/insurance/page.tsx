'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import { useState } from 'react';
import {
  Shield, Plus, Search, FileText, AlertTriangle,
  Heart, RefreshCw, Clock, DollarSign, Users,
  ChevronDown, X, BarChart3, TrendingUp
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

type ModeTab = 'policies' | 'claims' | 'risks' | 'benefits' | 'renewals';

const MODE_TABS: { key: ModeTab; label: string; icon: typeof Shield; type: string }[] = [
  { key: 'policies', label: 'Policies', icon: FileText, type: 'Policy' },
  { key: 'claims', label: 'Claims', icon: AlertTriangle, type: 'Claim' },
  { key: 'risks', label: 'Risks', icon: BarChart3, type: 'Risk' },
  { key: 'benefits', label: 'Benefits', icon: Heart, type: 'Benefit' },
  { key: 'renewals', label: 'Renewals', icon: RefreshCw, type: 'Renewal' },
];

const CLAIM_STATUSES = ['filed', 'under_review', 'approved', 'denied', 'paid', 'appealed', 'closed'];
const RENEWAL_STATUSES = ['upcoming', 'quoted', 'reviewing', 'accepted', 'declined'];
const GENERAL_STATUSES = ['active', 'expired', 'pending', 'cancelled'];

function getStatusesForMode(mode: ModeTab): string[] {
  switch (mode) {
    case 'claims': return CLAIM_STATUSES;
    case 'renewals': return RENEWAL_STATUSES;
    default: return GENERAL_STATUSES;
  }
}

const STATUS_COLORS: Record<string, string> = {
  filed: 'text-blue-400', under_review: 'text-yellow-400', approved: 'text-green-400',
  denied: 'text-red-400', paid: 'text-emerald-400', appealed: 'text-orange-400',
  closed: 'text-gray-400', upcoming: 'text-blue-400', quoted: 'text-purple-400',
  reviewing: 'text-yellow-400', accepted: 'text-green-400', declined: 'text-red-400',
  active: 'text-green-400', expired: 'text-red-400', pending: 'text-yellow-400',
  cancelled: 'text-gray-400',
};

export default function InsuranceLensPage() {
  useLensNav('insurance');

  const [activeMode, setActiveMode] = useState<ModeTab>('policies');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const activeTab = MODE_TABS.find(t => t.key === activeMode)!;

  const { isError: isError, error: error, refetch: refetch, items, create, update, remove } = useLensData('insurance', activeTab.type, {
    search: searchQuery || undefined,
    status: statusFilter || undefined,
  });
  const runAction = useRunArtifact('insurance');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState('');
  const [formCarrier, setFormCarrier] = useState('');
  const [formPolicyNumber, setFormPolicyNumber] = useState('');
  const [formPremium, setFormPremium] = useState('');
  const [formDeductible, setFormDeductible] = useState('');
  const [formCoverage, setFormCoverage] = useState('');
  const [formEffective, setFormEffective] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState('');

  const resetForm = () => {
    setFormTitle(''); setFormType(''); setFormCarrier(''); setFormPolicyNumber('');
    setFormPremium(''); setFormDeductible(''); setFormCoverage(''); setFormEffective('');
    setFormExpiry(''); setFormNotes(''); setFormStatus('');
    setEditingId(null); setShowEditor(false);
  };

  const handleCreate = async () => {
    const statuses = getStatusesForMode(activeMode);
    await create({
      title: formTitle || `New ${activeTab.type}`,
      data: {
        type: formType, carrier: formCarrier, policyNumber: formPolicyNumber,
        premium: parseFloat(formPremium) || 0, deductible: parseFloat(formDeductible) || 0,
        coverageLimit: formCoverage, effectiveDate: formEffective,
        expiryDate: formExpiry, notes: formNotes,
      },
      meta: { status: formStatus || statuses[0], tags: [] },
    });
    resetForm();
  };

  const handleEdit = (item: typeof items[0]) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    const d = item.data as Record<string, unknown>;
    setFormType((d.type as string) || '');
    setFormCarrier((d.carrier as string) || '');
    setFormPolicyNumber((d.policyNumber as string) || '');
    setFormPremium(String((d.premium as number) || ''));
    setFormDeductible(String((d.deductible as number) || ''));
    setFormCoverage((d.coverageLimit as string) || '');
    setFormEffective((d.effectiveDate as string) || '');
    setFormExpiry((d.expiryDate as string) || '');
    setFormNotes((d.notes as string) || '');
    setFormStatus(item.meta?.status || '');
    setShowEditor(true);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    await update(editingId, {
      title: formTitle,
      data: {
        type: formType, carrier: formCarrier, policyNumber: formPolicyNumber,
        premium: parseFloat(formPremium) || 0, deductible: parseFloat(formDeductible) || 0,
        coverageLimit: formCoverage, effectiveDate: formEffective,
        expiryDate: formExpiry, notes: formNotes,
      },
      meta: { status: formStatus },
    });
    resetForm();
  };

  const handleAction = async (action: string, artifactId?: string) => {
    const targetId = artifactId || editingId || items[0]?.id;
    if (!targetId) return;
    try {
      const result = await runAction.mutateAsync({ id: targetId, action });
      setActionResult(result.result as Record<string, unknown>);
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  // Dashboard
  const totalItems = items.length;
  const activeItems = items.filter(i => ['active', 'approved', 'accepted'].includes(i.meta?.status)).length;
  const totalPremiums = items.reduce((sum, i) => sum + ((i.data as Record<string, unknown>)?.premium as number || 0), 0);
  const pendingItems = items.filter(i => ['filed', 'under_review', 'upcoming', 'quoted', 'reviewing', 'pending'].includes(i.meta?.status)).length;

  const statuses = getStatusesForMode(activeMode);


  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className={ds.pageContainer}>
      {/* Header */}
      <header className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-emerald-400" />
          <div>
            <h1 className={ds.heading1}>Insurance & Risk</h1>
            <p className={ds.textMuted}>Policy tracking, claims management, risk assessment, benefits administration</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowEditor(true); }} className={ds.btnPrimary}>
          <Plus className="w-4 h-4" /> New {activeTab.type}
        </button>
        {runAction.isPending && <span className="text-xs text-neon-blue animate-pulse">Running...</span>}
      </header>

      {/* Mode Tabs */}
      <div className="flex gap-1 border-b border-lattice-border pb-0">
        {MODE_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveMode(tab.key); setStatusFilter(''); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeMode === tab.key
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dashboard */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <div className={ds.textMuted}>Total {activeTab.label}</div>
          <div className="text-2xl font-bold text-white mt-1">{totalItems}</div>
        </div>
        <div className={ds.panel}>
          <div className={ds.textMuted}>Active</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{activeItems}</div>
        </div>
        <div className={ds.panel}>
          <div className={ds.textMuted}>Pending</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">{pendingItems}</div>
        </div>
        <div className={ds.panel}>
          <div className={ds.textMuted}>Total Premiums</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">${totalPremiums.toLocaleString()}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab.label.toLowerCase()}...`} className={`${ds.input} pl-10`} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${ds.select} w-48`}>
          <option value="">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Artifact List */}
      <div className={ds.grid3}>
        {items.length === 0 ? (
          <p className="col-span-full text-center py-12 text-gray-500">
            No {activeTab.label.toLowerCase()} found. Create your first {activeTab.type.toLowerCase()}.
          </p>
        ) : (
          items.map(item => {
            const d = item.data as Record<string, unknown>;
            return (
              <div key={item.id} className={ds.panelHover} onClick={() => handleEdit(item)}>
                <div className="flex items-start justify-between mb-2">
                  <activeTab.icon className="w-5 h-5 text-emerald-400" />
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[item.meta?.status] || 'text-gray-400'} bg-current/10`}>
                    {(item.meta?.status || '').replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="font-semibold text-white mb-1 line-clamp-1">{item.title}</h3>
                {!!d.carrier && <p className="text-xs text-gray-400 mb-1">Carrier: {String(d.carrier)}</p>}
                {!!d.policyNumber && <p className="text-xs text-gray-400 mb-1">Policy #: {String(d.policyNumber)}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  {!!d.premium && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />${(d.premium as number).toLocaleString()}/mo
                    </span>
                  )}
                  {!!d.deductible && (
                    <span>Ded: ${(d.deductible as number).toLocaleString()}</span>
                  )}
                </div>
                {!!(d.effectiveDate || d.expiryDate) && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {d.effectiveDate as string} - {d.expiryDate as string}
                  </p>
                )}
              </div>
            );
          })
        )}
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

      {/* Editor Modal */}
      {showEditor && (
        <div className={ds.modalBackdrop} onClick={resetForm}>
          <div className={ds.modalContainer} onClick={e => e.stopPropagation()}>
            <div className={`${ds.modalPanel} max-w-lg`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className={ds.heading2}>{editingId ? 'Edit' : 'New'} {activeTab.type}</h2>
                  <button onClick={resetForm} className={ds.btnGhost}><X className="w-4 h-4" /></button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={ds.label}>Title</label>
                    <input className={ds.input} value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Policy name..." />
                  </div>
                  <div className={ds.grid2}>
                    <div>
                      <label className={ds.label}>Type</label>
                      <select className={ds.select} value={formType} onChange={e => setFormType(e.target.value)}>
                        <option value="">Select type...</option>
                        <option value="health">Health</option>
                        <option value="auto">Auto</option>
                        <option value="home">Home</option>
                        <option value="life">Life</option>
                        <option value="business">Business</option>
                        <option value="liability">Liability</option>
                      </select>
                    </div>
                    <div>
                      <label className={ds.label}>Status</label>
                      <select className={ds.select} value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                        {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={ds.grid2}>
                    <div>
                      <label className={ds.label}>Carrier</label>
                      <input className={ds.input} value={formCarrier} onChange={e => setFormCarrier(e.target.value)} placeholder="Insurance carrier..." />
                    </div>
                    <div>
                      <label className={ds.label}>Policy Number</label>
                      <input className={ds.input} value={formPolicyNumber} onChange={e => setFormPolicyNumber(e.target.value)} placeholder="POL-..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={ds.label}>Premium</label>
                      <input type="number" className={ds.input} value={formPremium} onChange={e => setFormPremium(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label className={ds.label}>Deductible</label>
                      <input type="number" className={ds.input} value={formDeductible} onChange={e => setFormDeductible(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label className={ds.label}>Coverage Limit</label>
                      <input className={ds.input} value={formCoverage} onChange={e => setFormCoverage(e.target.value)} placeholder="$100,000" />
                    </div>
                  </div>
                  <div className={ds.grid2}>
                    <div>
                      <label className={ds.label}>Effective Date</label>
                      <input type="date" className={ds.input} value={formEffective} onChange={e => setFormEffective(e.target.value)} />
                    </div>
                    <div>
                      <label className={ds.label}>Expiry Date</label>
                      <input type="date" className={ds.input} value={formExpiry} onChange={e => setFormExpiry(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={ds.label}>Notes</label>
                    <textarea className={`${ds.textarea} h-20`} value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Additional notes..." />
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  {editingId && (
                    <button onClick={() => { remove(editingId); resetForm(); }} className={ds.btnDanger}>Delete</button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <button onClick={resetForm} className={ds.btnSecondary}>Cancel</button>
                    <button onClick={editingId ? handleUpdate : handleCreate} className={ds.btnPrimary}>
                      {editingId ? 'Update' : 'Create'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
