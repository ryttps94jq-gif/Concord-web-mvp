'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import {
  Truck, Users, Package, Warehouse, Route, ShieldCheck,
  Plus, Search, Filter, X, Edit2, Trash2, MapPin,
  AlertTriangle, CheckCircle,
  Fuel,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ModeTab = 'fleet' | 'drivers' | 'shipments' | 'warehouse' | 'routes' | 'compliance';

type ArtifactType = 'Vehicle' | 'Driver' | 'Shipment' | 'WarehouseItem' | 'Route' | 'ComplianceLog';

const SHIPMENT_STATUSES = ['booked', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception'] as const;
const ROUTE_STATUSES = ['planned', 'dispatched', 'in_progress', 'completed'] as const;
const GENERAL_STATUSES = ['active', 'inactive', 'maintenance', 'pending', 'flagged'] as const;

const STATUS_COLORS: Record<string, string> = {
  booked: 'neon-blue', picked_up: 'neon-cyan', in_transit: 'neon-purple',
  out_for_delivery: 'amber-400', delivered: 'green-400', exception: 'red-400',
  planned: 'gray-400', dispatched: 'neon-blue', in_progress: 'neon-cyan', completed: 'green-400',
  active: 'green-400', inactive: 'gray-500', maintenance: 'amber-400',
  pending: 'neon-blue', flagged: 'red-400',
};

const MODE_TABS: { id: ModeTab; label: string; icon: typeof Truck; type: ArtifactType }[] = [
  { id: 'fleet', label: 'Fleet', icon: Truck, type: 'Vehicle' },
  { id: 'drivers', label: 'Drivers', icon: Users, type: 'Driver' },
  { id: 'shipments', label: 'Shipments', icon: Package, type: 'Shipment' },
  { id: 'warehouse', label: 'Warehouse', icon: Warehouse, type: 'WarehouseItem' },
  { id: 'routes', label: 'Routes', icon: Route, type: 'Route' },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck, type: 'ComplianceLog' },
];

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const SEED: Record<ArtifactType, Array<{ title: string; data: Record<string, unknown>; meta: Record<string, unknown> }>> = {
  Vehicle: [],
  Driver: [],
  Shipment: [],
  WarehouseItem: [],
  Route: [],
  ComplianceLog: [],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LogisticsLensPage() {
  useLensNav('logistics');

  const [mode, setMode] = useState<ModeTab>('fleet');
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

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData('logistics', currentType, {
    seed: SEED[currentType],
  });

  const runAction = useRunArtifact('logistics');

  // Derived data
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

  const statusOptions = mode === 'shipments' ? SHIPMENT_STATUSES
    : mode === 'routes' ? ROUTE_STATUSES
    : GENERAL_STATUSES;

  // Editor helpers
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
    if (mode === 'fleet') { data.make = formField1; data.model = formField2; data.mileage = formField3; }
    if (mode === 'drivers') { data.license = formField1; data.phone = formField2; data.hoursThisWeek = formField3; }
    if (mode === 'shipments') { data.origin = formField1; data.destination = formField2; data.weight = formField3; }
    if (mode === 'warehouse') { data.sku = formField1; data.zone = formField2; data.quantity = formField3; }
    if (mode === 'routes') { data.origin = formField1; data.destination = formField2; data.distance = formField3; }
    if (mode === 'compliance') { data.type = formField1; data.inspector = formField2; data.findings = formField3; }

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
    fleet: ['Make', 'Model', 'Mileage'],
    drivers: ['License Class', 'Phone', 'Hours This Week'],
    shipments: ['Origin', 'Destination', 'Weight'],
    warehouse: ['SKU', 'Zone', 'Quantity'],
    routes: ['Origin', 'Destination', 'Distance'],
    compliance: ['Type', 'Inspector', 'Findings'],
  };

  // ---------------------------------------------------------------------------
  // Dashboard metrics
  // ---------------------------------------------------------------------------
  const totalVehicles = SEED.Vehicle.length;
  const activeDrivers = SEED.Driver.filter(d => d.meta.status === 'active').length;
  const inTransitShipments = items.filter(i => (i.meta?.status === 'in_transit')).length;

  // ---------------------------------------------------------------------------
  // Render
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
          <Truck className="w-7 h-7 text-neon-cyan" />
          <div>
            <h1 className={ds.heading1}>Transportation &amp; Logistics</h1>
            <p className={ds.textMuted}>Fleet, shipments, warehouse and compliance management</p>
          </div>
        </div>
        <button onClick={openCreate} className={ds.btnPrimary}>
          <Plus className="w-4 h-4" /> New {currentType}
        </button>
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
                mode === tab.id ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Dashboard overview */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Truck className="w-4 h-4 text-neon-cyan" /><span className={ds.textMuted}>Fleet Size</span></div>
          <p className="text-2xl font-bold">{totalVehicles}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-green-400" /><span className={ds.textMuted}>Active Drivers</span></div>
          <p className="text-2xl font-bold">{activeDrivers}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Package className="w-4 h-4 text-neon-purple" /><span className={ds.textMuted}>In Transit</span></div>
          <p className="text-2xl font-bold">{inTransitShipments}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className={ds.textMuted}>Exceptions</span></div>
          <p className="text-2xl font-bold">{items.filter(i => i.meta?.status === 'exception' || i.meta?.status === 'flagged').length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${currentType.toLowerCase()}s...`}
            className={`${ds.input} pl-10`}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${ds.select} pl-10 pr-8`}>
            <option value="all">All statuses</option>
            {statusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Domain Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => handleAction('optimizeRoute')} className={ds.btnSecondary}>
          <Route className="w-4 h-4" /> Optimize Route
        </button>
        <button onClick={() => handleAction('trackShipment')} className={ds.btnSecondary}>
          <Package className="w-4 h-4" /> Track Shipment
        </button>
        <button onClick={() => handleAction('complianceCheck')} className={ds.btnSecondary}>
          <ShieldCheck className="w-4 h-4" /> Compliance Check
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

      {/* Artifact library */}
      {isLoading ? (
        <div className="text-center py-12"><p className={ds.textMuted}>Loading {currentType.toLowerCase()}s...</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-10 h-10 text-gray-600 mx-auto mb-3" />
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
                  <input value={formField3} onChange={e => setFormField3(e.target.value)} className={ds.input} />
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

      {/* Extended dashboard — recent activity feed */}
      <section>
        <h2 className={ds.heading2 + ' mb-3'}>Recent Activity</h2>
        <div className={ds.panel}>
          <div className="divide-y divide-lattice-border">
            {[
              { icon: Truck, text: 'Cascadia #101 left Chicago hub', time: '2h ago', color: 'text-neon-cyan' },
              { icon: CheckCircle, text: 'Shipment SH-003 delivered to Portland', time: '5h ago', color: 'text-green-400' },
              { icon: AlertTriangle, text: 'ELD audit flagged minor gap', time: '1d ago', color: 'text-amber-400' },
              { icon: Fuel, text: 'Fleet fuel cost up 4% this week', time: '1d ago', color: 'text-red-400' },
              { icon: MapPin, text: 'New route RT-ATL-MIA-01 planned', time: '2d ago', color: 'text-neon-blue' },
            ].map((evt, i) => {
              const Icon = evt.icon;
              return (
                <div key={i} className="flex items-center gap-3 py-3 px-2">
                  <Icon className={`w-4 h-4 ${evt.color}`} />
                  <span className="flex-1 text-sm text-gray-200">{evt.text}</span>
                  <span className={ds.textMuted}>{evt.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
