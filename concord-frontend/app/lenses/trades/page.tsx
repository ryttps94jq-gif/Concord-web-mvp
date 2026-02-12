'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import {
  Hammer,
  HardHat,
  Wrench,
  FileText,
  Truck,
  Users,
  Plus,
  Search,
  Filter,
  X,
  Edit2,
  Trash2,
  DollarSign,
  ClipboardCheck,
  Package,
  Calendar,
  MapPin,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModeTab = 'jobs' | 'estimates' | 'materials' | 'permits' | 'equipment' | 'clients';
type ArtifactType = 'Job' | 'Estimate' | 'MaterialsList' | 'Permit' | 'Equipment' | 'Client';
type Status = 'quoted' | 'approved' | 'in_progress' | 'inspection' | 'completed' | 'invoiced' | 'paid';

interface TradesArtifact {
  name: string;
  type: ArtifactType;
  status: Status;
  description: string;
  client: string;
  address: string;
  phone: string;
  value: number;
  startDate: string;
  endDate: string;
  notes: string;
  // Job-specific
  trade?: string;
  foremanAssigned?: string;
  // Estimate-specific
  lineItems?: { description: string; qty: number; unitCost: number }[];
  // Materials-specific
  supplier?: string;
  items?: { material: string; qty: number; unit: string; cost: number }[];
  // Permit-specific
  permitNumber?: string;
  issuingAuthority?: string;
  expiryDate?: string;
  // Equipment-specific
  serialNumber?: string;
  lastService?: string;
  nextService?: string;
  condition?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODE_TABS: { id: ModeTab; label: string; icon: typeof Hammer; artifactType: ArtifactType }[] = [
  { id: 'jobs', label: 'Jobs', icon: Hammer, artifactType: 'Job' },
  { id: 'estimates', label: 'Estimates', icon: FileText, artifactType: 'Estimate' },
  { id: 'materials', label: 'Materials', icon: Package, artifactType: 'MaterialsList' },
  { id: 'permits', label: 'Permits', icon: ShieldCheck, artifactType: 'Permit' },
  { id: 'equipment', label: 'Equipment', icon: Truck, artifactType: 'Equipment' },
  { id: 'clients', label: 'Clients', icon: Users, artifactType: 'Client' },
];

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  quoted: { label: 'Quoted', color: 'gray-400' },
  approved: { label: 'Approved', color: 'blue-400' },
  in_progress: { label: 'In Progress', color: 'yellow-400' },
  inspection: { label: 'Inspection', color: 'purple-400' },
  completed: { label: 'Completed', color: 'green-400' },
  invoiced: { label: 'Invoiced', color: 'cyan-400' },
  paid: { label: 'Paid', color: 'emerald-400' },
};

const TRADES_LIST = ['Plumbing', 'Electrical', 'HVAC', 'Carpentry', 'Roofing', 'Painting', 'Concrete', 'Landscaping', 'General'];

const seedData: { title: string; data: Record<string, unknown> }[] = [
  { title: 'Kitchen Renovation - Miller', data: { name: 'Kitchen Renovation - Miller', type: 'Job', status: 'in_progress', description: 'Full kitchen remodel including cabinets, countertops, plumbing, and electrical', client: 'Sarah Miller', address: '142 Oak Lane', phone: '555-0142', value: 28500, startDate: '2025-03-01', endDate: '2025-04-15', trade: 'General', foremanAssigned: 'Mike Torres', notes: '' } },
  { title: 'Bathroom Plumbing - Chen', data: { name: 'Bathroom Plumbing - Chen', type: 'Job', status: 'quoted', description: 'Master bathroom re-pipe and fixture install', client: 'David Chen', address: '89 Maple Dr', phone: '555-0189', value: 6200, startDate: '2025-04-01', endDate: '2025-04-10', trade: 'Plumbing', foremanAssigned: '', notes: '' } },
  { title: 'Roof Repair Est. - Johnson', data: { name: 'Roof Repair Estimate - Johnson', type: 'Estimate', status: 'quoted', description: 'Repair damaged shingles and flashing', client: 'Tom Johnson', address: '310 Pine St', phone: '555-0310', value: 4800, startDate: '', endDate: '', lineItems: [{ description: 'Shingle replacement (200 sqft)', qty: 1, unitCost: 3200 }, { description: 'Flashing repair', qty: 1, unitCost: 800 }, { description: 'Labor', qty: 16, unitCost: 50 }], notes: '' } },
  { title: 'Electrical Panel Upgrade', data: { name: 'Electrical Panel Upgrade', type: 'Job', status: 'completed', description: '200A panel upgrade with whole-house surge protection', client: 'Angela Brooks', address: '55 Elm Ave', phone: '555-0055', value: 3800, startDate: '2025-02-10', endDate: '2025-02-12', trade: 'Electrical', foremanAssigned: 'Ray Kim', notes: 'Inspector passed first visit' } },
  { title: 'City Building Permit #2025-1847', data: { name: 'City Building Permit #2025-1847', type: 'Permit', status: 'approved', description: 'Structural permit for load-bearing wall removal', client: 'Sarah Miller', address: '142 Oak Lane', phone: '555-0142', value: 350, permitNumber: '2025-1847', issuingAuthority: 'City Building Dept', expiryDate: '2026-03-01', notes: '' } },
  { title: 'Jobsite Materials - Miller Kitchen', data: { name: 'Jobsite Materials - Miller Kitchen', type: 'MaterialsList', status: 'approved', description: 'Materials order for kitchen renovation', client: 'Sarah Miller', address: '142 Oak Lane', phone: '', value: 12400, supplier: 'BuildPro Supply', items: [{ material: 'Cabinet set (maple)', qty: 1, unit: 'set', cost: 6800 }, { material: 'Granite countertop', qty: 32, unit: 'sqft', cost: 3200 }, { material: 'Plumbing fixtures', qty: 1, unit: 'lot', cost: 1200 }, { material: 'Electrical fixtures', qty: 1, unit: 'lot', cost: 1200 }], notes: '' } },
  { title: 'CAT 305 Mini Excavator', data: { name: 'CAT 305 Mini Excavator', type: 'Equipment', status: 'in_progress', description: 'Rented mini excavator for site prep', client: '', address: '', phone: '', value: 450, serialNumber: 'CAT305-2019-8842', lastService: '2025-01-15', nextService: '2025-04-15', condition: 'Good', notes: 'Daily rate $450' } },
  { title: 'Sarah Miller', data: { name: 'Sarah Miller', type: 'Client', status: 'in_progress', description: 'Repeat client - kitchen and bathroom projects', client: 'Sarah Miller', address: '142 Oak Lane', phone: '555-0142', value: 0, startDate: '', endDate: '', notes: '3 completed jobs, 1 active' } },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TradesLensPage() {
  useLensNav('trades');

  const [activeTab, setActiveTab] = useState<ModeTab>('jobs');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LensItem<TradesArtifact> | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  // Editor form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formClient, setFormClient] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formStatus, setFormStatus] = useState<Status>('quoted');
  const [formTrade, setFormTrade] = useState('General');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const activeArtifactType = MODE_TABS.find(t => t.id === activeTab)?.artifactType || 'Job';

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData<TradesArtifact>('trades', activeArtifactType, {
    seed: seedData.filter(s => (s.data as Record<string, unknown>).type === activeArtifactType),
  });

  const runAction = useRunArtifact('trades');

  const filtered = useMemo(() => {
    let result = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.data as unknown as TradesArtifact).client?.toLowerCase().includes(q) ||
        (i.data as unknown as TradesArtifact).address?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      result = result.filter(i => (i.data as unknown as TradesArtifact).status === filterStatus);
    }
    return result;
  }, [items, searchQuery, filterStatus]);

  // ---------------------------------------------------------------------------
  // Editor helpers
  // ---------------------------------------------------------------------------

  const openCreate = () => {
    setEditingItem(null);
    setFormName('');
    setFormDescription('');
    setFormClient('');
    setFormAddress('');
    setFormPhone('');
    setFormValue('');
    setFormStatus('quoted');
    setFormTrade('General');
    setFormStartDate('');
    setFormEndDate('');
    setFormNotes('');
    setEditorOpen(true);
  };

  const openEdit = (item: LensItem<TradesArtifact>) => {
    const d = item.data as unknown as TradesArtifact;
    setEditingItem(item);
    setFormName(d.name || item.title);
    setFormDescription(d.description || '');
    setFormClient(d.client || '');
    setFormAddress(d.address || '');
    setFormPhone(d.phone || '');
    setFormValue(String(d.value || ''));
    setFormStatus(d.status || 'quoted');
    setFormTrade(d.trade || 'General');
    setFormStartDate(d.startDate || '');
    setFormEndDate(d.endDate || '');
    setFormNotes(d.notes || '');
    setEditorOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      title: formName,
      data: {
        name: formName,
        type: activeArtifactType,
        status: formStatus,
        description: formDescription,
        client: formClient,
        address: formAddress,
        phone: formPhone,
        value: parseFloat(formValue) || 0,
        startDate: formStartDate,
        endDate: formEndDate,
        trade: formTrade,
        notes: formNotes,
      } as unknown as Partial<TradesArtifact>,
      meta: { status: formStatus, tags: [activeArtifactType, formTrade] },
    };
    if (editingItem) {
      await update(editingItem.id, payload);
    } else {
      await create(payload);
    }
    setEditorOpen(false);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
  };

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

  // ---------------------------------------------------------------------------
  // Domain actions
  // ---------------------------------------------------------------------------

  const calculateEstimate = (item: LensItem<TradesArtifact>) => {
    const d = item.data as unknown as TradesArtifact;
    const lineItems = d.lineItems || [];
    return lineItems.reduce((sum, li) => sum + li.qty * li.unitCost, 0);
  };

  // ---------------------------------------------------------------------------
  // Dashboard metrics
  // ---------------------------------------------------------------------------

  const dashboardMetrics = useMemo(() => {
    const allData = items.map(i => i.data as unknown as TradesArtifact);
    const totalValue = allData.reduce((s, d) => s + (d.value || 0), 0);
    const byStatus: Record<string, number> = {};
    allData.forEach(d => { byStatus[d.status] = (byStatus[d.status] || 0) + 1; });
    const activeJobs = allData.filter(d => d.status === 'in_progress').length;
    const pendingInspections = allData.filter(d => d.status === 'inspection').length;
    const unpaidInvoices = allData.filter(d => d.status === 'invoiced').reduce((s, d) => s + (d.value || 0), 0);
    return { totalValue, byStatus, activeJobs, pendingInspections, unpaidInvoices, total: items.length };
  }, [items]);

  // ---------------------------------------------------------------------------
  // Render: Status badge
  // ---------------------------------------------------------------------------

  const renderStatusBadge = (status: Status) => {
    const cfg = STATUS_CONFIG[status];
    return (
      <span className={ds.badge(cfg.color)}>
        {cfg.label}
      </span>
    );
  };

  // ---------------------------------------------------------------------------
  // Render: Artifact library
  // ---------------------------------------------------------------------------

  const renderLibrary = () => (
    <div className="space-y-4">
      {/* Search & filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className={cn(ds.input, 'pl-10')}
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as Status | 'all')}
          className={cn(ds.select, 'w-44')}
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <button onClick={() => { setSearchQuery(''); setFilterStatus('all'); }} className={ds.btnGhost}>
          <Filter className="w-4 h-4" /> Clear
        </button>
        <button onClick={openCreate} className={ds.btnPrimary}>
          <Plus className="w-4 h-4" /> New {activeArtifactType}
        </button>
      </div>

      {/* Items grid */}
      {isLoading ? (
        <div className={cn(ds.panel, 'text-center py-12')}>
          <p className={ds.textMuted}>Loading {activeTab}...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={cn(ds.panel, 'text-center py-12')}>
          <Package className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className={ds.textMuted}>No {activeTab} found. Create one to get started.</p>
        </div>
      ) : (
        <div className={ds.grid3}>
          {filtered.map(item => {
            const d = item.data as unknown as TradesArtifact;
            return (
              <div key={item.id} className={ds.panelHover} onClick={() => openEdit(item)}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className={ds.heading3}>{item.title}</h3>
                  {renderStatusBadge(d.status)}
                </div>
                {d.client && (
                  <p className={cn(ds.textMuted, 'flex items-center gap-1 mb-1')}>
                    <Users className="w-3 h-3" /> {d.client}
                  </p>
                )}
                {d.address && (
                  <p className={cn(ds.textMuted, 'flex items-center gap-1 mb-1')}>
                    <MapPin className="w-3 h-3" /> {d.address}
                  </p>
                )}
                {d.trade && (
                  <p className={cn(ds.textMuted, 'flex items-center gap-1 mb-1')}>
                    <Wrench className="w-3 h-3" /> {d.trade}
                  </p>
                )}
                {d.value > 0 && (
                  <p className="text-lg font-bold text-neon-green mt-2">
                    ${d.value.toLocaleString()}
                  </p>
                )}
                {d.startDate && (
                  <p className={cn(ds.textMuted, 'flex items-center gap-1 mt-1')}>
                    <Calendar className="w-3 h-3" /> {d.startDate}{d.endDate ? ` - ${d.endDate}` : ''}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-lattice-border">
                  <button onClick={e => { e.stopPropagation(); openEdit(item); }} className={cn(ds.btnSmall, 'text-gray-400 hover:text-white')}>
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(item.id); }} className={cn(ds.btnSmall, 'text-red-400 hover:text-red-300')}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                  {d.type === 'Estimate' && (
                    <span className={cn(ds.textMono, 'ml-auto text-gray-400')}>
                      Est: ${calculateEstimate(item).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Editor modal
  // ---------------------------------------------------------------------------

  const renderEditor = () => {
    if (!editorOpen) return null;
    return (
      <div className={ds.modalBackdrop} onClick={() => setEditorOpen(false)}>
        <div className={ds.modalContainer}>
          <div className={cn(ds.modalPanel, 'max-w-2xl max-h-[85vh] overflow-y-auto')} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-lattice-border">
              <h2 className={ds.heading2}>
                {editingItem ? `Edit ${activeArtifactType}` : `New ${activeArtifactType}`}
              </h2>
              <button onClick={() => setEditorOpen(false)} className={ds.btnGhost}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={ds.label}>Name / Title</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} className={ds.input} placeholder="Job name..." />
              </div>
              <div>
                <label className={ds.label}>Description</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3} className={ds.textarea} placeholder="Details..." />
              </div>
              <div className={ds.grid2}>
                <div>
                  <label className={ds.label}>Client</label>
                  <input value={formClient} onChange={e => setFormClient(e.target.value)} className={ds.input} placeholder="Client name" />
                </div>
                <div>
                  <label className={ds.label}>Phone</label>
                  <input value={formPhone} onChange={e => setFormPhone(e.target.value)} className={ds.input} placeholder="555-0100" />
                </div>
              </div>
              <div>
                <label className={ds.label}>Address</label>
                <input value={formAddress} onChange={e => setFormAddress(e.target.value)} className={ds.input} placeholder="Street address" />
              </div>
              <div className={ds.grid3}>
                <div>
                  <label className={ds.label}>Status</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value as Status)} className={ds.select}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={ds.label}>Trade</label>
                  <select value={formTrade} onChange={e => setFormTrade(e.target.value)} className={ds.select}>
                    {TRADES_LIST.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={ds.label}>Value ($)</label>
                  <input type="number" value={formValue} onChange={e => setFormValue(e.target.value)} className={ds.input} placeholder="0.00" />
                </div>
              </div>
              <div className={ds.grid2}>
                <div>
                  <label className={ds.label}>Start Date</label>
                  <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} className={ds.input} />
                </div>
                <div>
                  <label className={ds.label}>End Date</label>
                  <input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} className={ds.input} />
                </div>
              </div>
              <div>
                <label className={ds.label}>Notes</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} className={ds.textarea} placeholder="Additional notes..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-lattice-border">
              <button onClick={() => setEditorOpen(false)} className={ds.btnSecondary}>Cancel</button>
              <button onClick={handleSave} className={ds.btnPrimary}>
                <CheckCircle2 className="w-4 h-4" /> {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render: Dashboard
  // ---------------------------------------------------------------------------

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2">
            <Hammer className="w-5 h-5 text-yellow-400" />
            <span className={ds.textMuted}>Active Jobs</span>
          </div>
          <p className="text-3xl font-bold">{dashboardMetrics.activeJobs}</p>
          <p className={ds.textMuted}>In progress right now</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className={ds.textMuted}>Total Pipeline</span>
          </div>
          <p className="text-3xl font-bold text-neon-green">${dashboardMetrics.totalValue.toLocaleString()}</p>
          <p className={ds.textMuted}>{dashboardMetrics.total} items total</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck className="w-5 h-5 text-purple-400" />
            <span className={ds.textMuted}>Pending Inspections</span>
          </div>
          <p className="text-3xl font-bold">{dashboardMetrics.pendingInspections}</p>
          <p className={ds.textMuted}>Awaiting sign-off</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <span className={ds.textMuted}>Unpaid Invoices</span>
          </div>
          <p className="text-3xl font-bold text-orange-400">${dashboardMetrics.unpaidInvoices.toLocaleString()}</p>
          <p className={ds.textMuted}>Outstanding balance</p>
        </div>
      </div>

      {/* Status breakdown */}
      <div className={ds.panel}>
        <h3 className={cn(ds.heading3, 'mb-4')}>Status Breakdown</h3>
        <div className="space-y-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = dashboardMetrics.byStatus[key] || 0;
            const pct = dashboardMetrics.total > 0 ? (count / dashboardMetrics.total) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-400">{cfg.label}</span>
                <div className="flex-1 h-2 bg-lattice-surface rounded-full overflow-hidden">
                  <div className={`h-full bg-${cfg.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className={cn(ds.textMono, 'w-8 text-right')}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div className={ds.panel}>
        <h3 className={cn(ds.heading3, 'mb-4 flex items-center gap-2')}>
          <TrendingUp className="w-5 h-5 text-neon-cyan" /> Recent Items
        </h3>
        <div className="space-y-2">
          {items.slice(0, 5).map(item => {
            const d = item.data as unknown as TradesArtifact;
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-lattice-surface/50 hover:bg-lattice-surface cursor-pointer" onClick={() => openEdit(item)}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className={ds.textMuted}>{d.client || d.type} {d.trade ? `- ${d.trade}` : ''}</p>
                </div>
                {renderStatusBadge(d.status)}
                {d.value > 0 && <span className={cn(ds.textMono, 'text-green-400')}>${d.value.toLocaleString()}</span>}
                <ArrowUpRight className="w-4 h-4 text-gray-500" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------


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
          <HardHat className="w-8 h-8 text-yellow-400" />
          <div>
            <h1 className={ds.heading1}>Trades & Construction</h1>
            <p className={ds.textMuted}>Manage jobs, estimates, materials, permits, and equipment</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDashboard(!showDashboard)} className={cn(showDashboard ? ds.btnPrimary : ds.btnSecondary)}>
            <BarChart3 className="w-4 h-4" /> Dashboard
          </button>
        </div>
      </header>

      {/* Mode tabs */}
      <nav className="flex items-center gap-2 border-b border-lattice-border pb-4 overflow-x-auto">
        {MODE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setShowDashboard(false); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap',
              activeTab === tab.id && !showDashboard
                ? 'bg-neon-blue/20 text-neon-blue'
                : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Domain Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => handleAction('generateEstimate')} className={ds.btnSecondary}>
          <FileText className="w-4 h-4" /> Generate Estimate
        </button>
        <button onClick={() => handleAction('checkPermits')} className={ds.btnSecondary}>
          <ShieldCheck className="w-4 h-4" /> Check Permits
        </button>
        <button onClick={() => handleAction('scheduleInspection')} className={ds.btnSecondary}>
          <ClipboardCheck className="w-4 h-4" /> Schedule Inspection
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

      {/* Content */}
      {showDashboard ? renderDashboard() : renderLibrary()}

      {/* Editor modal */}
      {renderEditor()}
    </div>
  );
}
