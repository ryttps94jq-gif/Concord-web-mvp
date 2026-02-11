'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import {
  ClipboardList, Layers, ShieldCheck, Cog, HardHat, Box,
  Plus, Search, Filter, X, Edit2, Trash2,
  AlertTriangle, CheckCircle, Clock, Wrench,
  BarChart3, TrendingUp, TrendingDown, Gauge,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ModeTab = 'work_orders' | 'bom' | 'quality' | 'machines' | 'safety' | 'parts';
type ArtifactType = 'WorkOrder' | 'BOM' | 'QCInspection' | 'Machine' | 'SafetyItem' | 'Part';

const WO_STATUSES = ['planned', 'released', 'in_progress', 'qc_hold', 'completed', 'shipped'] as const;
const SAFETY_STATUSES = ['reported', 'investigating', 'corrective_action', 'closed'] as const;
const GENERAL_STATUSES = ['active', 'inactive', 'draft', 'pending', 'review'] as const;

const STATUS_COLORS: Record<string, string> = {
  planned: 'gray-400', released: 'neon-blue', in_progress: 'neon-cyan',
  qc_hold: 'amber-400', completed: 'green-400', shipped: 'neon-purple',
  reported: 'red-400', investigating: 'amber-400', corrective_action: 'neon-blue', closed: 'green-400',
  active: 'green-400', inactive: 'gray-500', draft: 'gray-400', pending: 'neon-blue', review: 'amber-400',
};

const MODE_TABS: { id: ModeTab; label: string; icon: typeof ClipboardList; type: ArtifactType }[] = [
  { id: 'work_orders', label: 'Work Orders', icon: ClipboardList, type: 'WorkOrder' },
  { id: 'bom', label: 'BOM', icon: Layers, type: 'BOM' },
  { id: 'quality', label: 'Quality', icon: ShieldCheck, type: 'QCInspection' },
  { id: 'machines', label: 'Machines', icon: Cog, type: 'Machine' },
  { id: 'safety', label: 'Safety', icon: HardHat, type: 'SafetyItem' },
  { id: 'parts', label: 'Parts', icon: Box, type: 'Part' },
];

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const SEED: Record<ArtifactType, Array<{ title: string; data: Record<string, unknown>; meta: Record<string, unknown> }>> = {
  WorkOrder: [
    { title: 'WO-2026-0201', data: { product: 'Hydraulic Actuator HA-400', qty: 250, line: 'Line A', priority: 'high', dueDate: '2026-02-15', completedQty: 80 }, meta: { status: 'in_progress', tags: ['priority'] } },
    { title: 'WO-2026-0198', data: { product: 'Bearing Assembly BA-12', qty: 1000, line: 'Line B', priority: 'medium', dueDate: '2026-02-20', completedQty: 1000 }, meta: { status: 'completed', tags: [] } },
    { title: 'WO-2026-0205', data: { product: 'Precision Gear PG-7', qty: 500, line: 'Line C', priority: 'high', dueDate: '2026-02-12', completedQty: 0 }, meta: { status: 'qc_hold', tags: ['urgent'] } },
    { title: 'WO-2026-0210', data: { product: 'Shaft Coupling SC-3', qty: 150, line: 'Line A', priority: 'low', dueDate: '2026-03-01', completedQty: 0 }, meta: { status: 'planned', tags: [] } },
  ],
  BOM: [
    { title: 'BOM-HA400 Rev C', data: { product: 'Hydraulic Actuator HA-400', revision: 'C', components: 14, totalCost: 186.50, approvedBy: 'Engineering' }, meta: { status: 'active', tags: ['current'] } },
    { title: 'BOM-BA12 Rev A', data: { product: 'Bearing Assembly BA-12', revision: 'A', components: 8, totalCost: 42.30, approvedBy: 'Engineering' }, meta: { status: 'active', tags: [] } },
  ],
  QCInspection: [
    { title: 'QC-2026-0401', data: { workOrder: 'WO-2026-0205', inspector: 'T. Nakamura', defectsFound: 3, sampleSize: 50, defectRate: '6%', disposition: 'Hold' }, meta: { status: 'review', tags: ['critical'] } },
    { title: 'QC-2026-0399', data: { workOrder: 'WO-2026-0198', inspector: 'R. Patel', defectsFound: 0, sampleSize: 100, defectRate: '0%', disposition: 'Accept' }, meta: { status: 'active', tags: ['passed'] } },
  ],
  Machine: [
    { title: 'CNC Mill #M-01', data: { type: 'CNC 5-Axis', manufacturer: 'Haas', model: 'UMC-750', installDate: '2023-06-15', cycleTime: '4.2 min', oee: 87 }, meta: { status: 'active', tags: ['line-a'] } },
    { title: 'Lathe #L-03', data: { type: 'CNC Lathe', manufacturer: 'Mazak', model: 'QT-250', installDate: '2022-01-10', cycleTime: '2.8 min', oee: 91 }, meta: { status: 'active', tags: ['line-b'] } },
    { title: 'Press #P-02', data: { type: 'Hydraulic Press', manufacturer: 'Schuler', model: 'TBS-200', installDate: '2021-09-20', cycleTime: '1.5 min', oee: 72 }, meta: { status: 'inactive', tags: ['maintenance-scheduled'] } },
  ],
  SafetyItem: [
    { title: 'SI-2026-012 Near Miss - Line A', data: { type: 'Near Miss', location: 'Line A, Station 4', reportedBy: 'J. Hernandez', description: 'Unsecured tooling fell from overhead rack', severity: 'medium' }, meta: { status: 'investigating', tags: ['open'] } },
    { title: 'SI-2026-008 PPE Violation', data: { type: 'PPE Violation', location: 'Welding Bay 2', reportedBy: 'M. Brown', description: 'Employee missing face shield during grinding', severity: 'low' }, meta: { status: 'corrective_action', tags: [] } },
    { title: 'SI-2025-097 Slip Hazard', data: { type: 'Hazard', location: 'Loading Dock', reportedBy: 'S. Kim', description: 'Coolant leak creating slip hazard at dock entrance', severity: 'high' }, meta: { status: 'closed', tags: ['resolved'] } },
  ],
  Part: [
    { title: 'PT-4421 Steel Rod 12mm', data: { partNumber: 'PT-4421', material: '4140 Steel', onHand: 2400, reorderPoint: 500, unitCost: 3.25, supplier: 'MetalCo' }, meta: { status: 'active', tags: [] } },
    { title: 'PT-7891 O-Ring Seal', data: { partNumber: 'PT-7891', material: 'Viton', onHand: 8500, reorderPoint: 2000, unitCost: 0.45, supplier: 'SealPro' }, meta: { status: 'active', tags: [] } },
    { title: 'PT-2233 Bronze Bushing', data: { partNumber: 'PT-2233', material: 'C93200 Bronze', onHand: 120, reorderPoint: 300, unitCost: 8.90, supplier: 'BushingWorld' }, meta: { status: 'pending', tags: ['low-stock'] } },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ManufacturingLensPage() {
  useLensNav('manufacturing');

  const [mode, setMode] = useState<ModeTab>('work_orders');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Editor form state
  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState('active');
  const [formField1, setFormField1] = useState('');
  const [formField2, setFormField2] = useState('');
  const [formField3, setFormField3] = useState('');
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const currentType = MODE_TABS.find(t => t.id === mode)!.type;

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData('manufacturing', currentType, {
    seed: SEED[currentType],
  });

  const runAction = useRunArtifact('manufacturing');

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || JSON.stringify(i.data).toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      list = list.filter(i => i.meta?.status === statusFilter);
    }
    return list;
  }, [items, search, statusFilter]);

  const statusOptions = mode === 'work_orders' ? WO_STATUSES
    : mode === 'safety' ? SAFETY_STATUSES
    : GENERAL_STATUSES;

  const resetForm = () => { setFormTitle(''); setFormStatus('active'); setFormField1(''); setFormField2(''); setFormField3(''); setEditing(null); setShowEditor(false); };
  const openCreate = () => { resetForm(); setShowEditor(true); };

  const openEdit = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setEditing(id);
    setFormTitle(item.title);
    setFormStatus(item.meta?.status || 'active');
    const vals = Object.values(item.data as Record<string, unknown>);
    setFormField1(String(vals[0] ?? ''));
    setFormField2(String(vals[1] ?? ''));
    setFormField3(String(vals[2] ?? ''));
    setShowEditor(true);
  };

  const handleSave = async () => {
    const data: Record<string, unknown> = {};
    if (mode === 'work_orders') { data.product = formField1; data.qty = formField2; data.line = formField3; }
    if (mode === 'bom') { data.product = formField1; data.revision = formField2; data.components = formField3; }
    if (mode === 'quality') { data.workOrder = formField1; data.inspector = formField2; data.defectsFound = formField3; }
    if (mode === 'machines') { data.type = formField1; data.manufacturer = formField2; data.model = formField3; }
    if (mode === 'safety') { data.type = formField1; data.location = formField2; data.description = formField3; }
    if (mode === 'parts') { data.partNumber = formField1; data.material = formField2; data.onHand = formField3; }

    if (editing) {
      await update(editing, { title: formTitle, data, meta: { status: formStatus } });
    } else {
      await create({ title: formTitle, data, meta: { status: formStatus } });
    }
    resetForm();
  };

  const handleAction = async (action: string, artifactId?: string) => {
    const targetId = artifactId || editing || filtered[0]?.id;
    if (!targetId) return;
    try {
      const result = await runAction.mutateAsync({ id: targetId, action });
      setActionResult(result.result as Record<string, unknown>);
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  const fieldLabels: Record<ModeTab, [string, string, string]> = {
    work_orders: ['Product', 'Quantity', 'Line'],
    bom: ['Product', 'Revision', 'Components'],
    quality: ['Work Order', 'Inspector', 'Defects Found'],
    machines: ['Type', 'Manufacturer', 'Model'],
    safety: ['Incident Type', 'Location', 'Description'],
    parts: ['Part Number', 'Material', 'On Hand'],
  };

  // Dashboard metrics
  const woInProgress = SEED.WorkOrder.filter(w => w.meta.status === 'in_progress').length;
  const woOnHold = SEED.WorkOrder.filter(w => w.meta.status === 'qc_hold').length;
  const avgOee = Math.round(SEED.Machine.reduce((s, m) => s + (m.data.oee as number), 0) / SEED.Machine.length);
  const openSafetyItems = SEED.SafetyItem.filter(s => s.meta.status !== 'closed').length;


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
          <Cog className="w-7 h-7 text-neon-purple" />
          <div>
            <h1 className={ds.heading1}>Manufacturing</h1>
            <p className={ds.textMuted}>Work orders, quality control, machines and safety</p>
          </div>
        </div>
        <button onClick={openCreate} className={ds.btnPrimary}>
          <Plus className="w-4 h-4" /> New {currentType}
        </button>
        {runAction.isPending && <span className="text-xs text-neon-blue animate-pulse">Running...</span>}
      </header>

      {/* Mode Tabs */}
      <nav className="flex items-center gap-1 border-b border-lattice-border pb-3 overflow-x-auto">
        {MODE_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setMode(tab.id); setSearch(''); setStatusFilter('all'); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                mode === tab.id ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Dashboard */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><ClipboardList className="w-4 h-4 text-neon-cyan" /><span className={ds.textMuted}>WOs In Progress</span></div>
          <p className="text-2xl font-bold">{woInProgress}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className={ds.textMuted}>QC Holds</span></div>
          <p className="text-2xl font-bold">{woOnHold}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Gauge className="w-4 h-4 text-green-400" /><span className={ds.textMuted}>Avg OEE</span></div>
          <p className="text-2xl font-bold">{avgOee}%</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><HardHat className="w-4 h-4 text-red-400" /><span className={ds.textMuted}>Open Safety</span></div>
          <p className="text-2xl font-bold">{openSafetyItems}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${currentType.toLowerCase()}s...`} className={`${ds.input} pl-10`} />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${ds.select} pl-10 pr-8`}>
            <option value="all">All statuses</option>
            {statusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Artifact library */}
      {isLoading ? (
        <div className="text-center py-12"><p className={ds.textMuted}>Loading...</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Box className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className={ds.textMuted}>No {currentType.toLowerCase()}s found</p>
          <button onClick={openCreate} className={`${ds.btnGhost} mt-3`}><Plus className="w-4 h-4" /> Create one</button>
        </div>
      ) : (
        <div className={ds.grid3}>
          {filtered.map(item => {
            const status = item.meta?.status || 'active';
            const color = STATUS_COLORS[status] || 'gray-400';
            return (
              <div key={item.id} className={ds.panelHover} onClick={() => openEdit(item.id)}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className={ds.heading3 + ' truncate flex-1'}>{item.title}</h3>
                  <span className={ds.badge(color)}>{String(status).replace(/_/g, ' ')}</span>
                </div>
                <div className="space-y-1 mb-3">
                  {Object.entries(item.data as Record<string, unknown>).slice(0, 3).map(([k, v]) => (
                    <p key={k} className={ds.textMuted}><span className="text-gray-500">{k}:</span> {String(v)}</p>
                  ))}
                </div>
                {/* Progress bar for work orders */}
                {currentType === 'WorkOrder' && (item.data as Record<string, unknown>).completedQty !== undefined && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{String((item.data as Record<string, unknown>).completedQty)}/{String((item.data as Record<string, unknown>).qty)}</span>
                    </div>
                    <div className="w-full h-2 bg-lattice-elevated rounded-full overflow-hidden">
                      <div className="h-full bg-neon-cyan rounded-full transition-all" style={{ width: `${Math.min(100, (Number((item.data as Record<string, unknown>).completedQty) / Number((item.data as Record<string, unknown>).qty)) * 100)}%` }} />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-lattice-border">
                  <span className={ds.textMuted}>{new Date(item.updatedAt).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={e => { e.stopPropagation(); openEdit(item.id); }} className={ds.btnGhost}><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={e => { e.stopPropagation(); remove(item.id); }} className={`${ds.btnGhost} hover:text-red-400`}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {actionResult && (
        <div className={ds.panel}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={ds.heading3}>Action Result</h3>
            <button onClick={() => setActionResult(null)} className={ds.btnGhost}><X className="w-4 h-4" /></button>
          </div>
          <pre className={`${ds.textMono} text-xs overflow-auto max-h-48`}>{JSON.stringify(actionResult, null, 2)}</pre>
        </div>
      )}

      {/* Editor modal */}
      {showEditor && (
        <>
          <div className={ds.modalBackdrop} onClick={resetForm} />
          <div className={ds.modalContainer}>
            <div className={`${ds.modalPanel} max-w-lg`}>
              <div className="flex items-center justify-between p-4 border-b border-lattice-border">
                <h2 className={ds.heading2}>{editing ? 'Edit' : 'New'} {currentType}</h2>
                <button onClick={resetForm} className={ds.btnGhost}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className={ds.label}>Title</label>
                  <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className={ds.input} placeholder={`${currentType} title`} />
                </div>
                <div>
                  <label className={ds.label}>Status</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className={ds.select}>
                    {statusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className={ds.label}>{fieldLabels[mode][0]}</label>
                  <input value={formField1} onChange={e => setFormField1(e.target.value)} className={ds.input} />
                </div>
                <div>
                  <label className={ds.label}>{fieldLabels[mode][1]}</label>
                  <input value={formField2} onChange={e => setFormField2(e.target.value)} className={ds.input} />
                </div>
                <div>
                  <label className={ds.label}>{fieldLabels[mode][2]}</label>
                  {mode === 'safety' ? (
                    <textarea value={formField3} onChange={e => setFormField3(e.target.value)} className={ds.textarea} rows={3} />
                  ) : (
                    <input value={formField3} onChange={e => setFormField3(e.target.value)} className={ds.input} />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 p-4 border-t border-lattice-border">
                <button onClick={resetForm} className={ds.btnSecondary}>Cancel</button>
                <button onClick={handleSave} className={ds.btnPrimary} disabled={!formTitle.trim()}>
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Production summary */}
      <section>
        <h2 className={ds.heading2 + ' mb-3'}>Production Summary</h2>
        <div className={ds.grid2}>
          <div className={ds.panel}>
            <h3 className={ds.heading3 + ' mb-3'}>Line Utilization</h3>
            {['Line A', 'Line B', 'Line C'].map((line, i) => {
              const util = [78, 91, 45][i];
              return (
                <div key={line} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{line}</span>
                    <span className={util > 80 ? 'text-green-400' : util > 60 ? 'text-amber-400' : 'text-red-400'}>{util}%</span>
                  </div>
                  <div className="w-full h-2 bg-lattice-elevated rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${util > 80 ? 'bg-green-400' : util > 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${util}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className={ds.panel}>
            <h3 className={ds.heading3 + ' mb-3'}>Quality Trend (Last 7 Days)</h3>
            <div className="h-28 flex items-end gap-1">
              {[98.2, 97.5, 99.1, 94.0, 96.8, 98.5, 97.9].map((rate, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className={`text-xs ${rate < 95 ? 'text-red-400' : 'text-gray-400'}`}>{rate}%</span>
                  <div
                    className={`w-full rounded-t ${rate < 95 ? 'bg-red-400' : 'bg-neon-cyan/60'}`}
                    style={{ height: `${(rate - 90) * 10}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
