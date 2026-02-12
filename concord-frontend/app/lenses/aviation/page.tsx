'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import { useState } from 'react';
import {
  Plane, Plus, Search, Anchor, Ship, MapPin,
  Clock, Users, Wrench, Calendar, ChevronDown, X,
  Navigation, Award, Gauge
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

type ModeTab = 'flights' | 'aircraft' | 'vessels' | 'slips' | 'charters' | 'crew';

const MODE_TABS: { key: ModeTab; label: string; icon: typeof Plane; type: string }[] = [
  { key: 'flights', label: 'Flights', icon: Plane, type: 'Flight' },
  { key: 'aircraft', label: 'Aircraft', icon: Navigation, type: 'Aircraft' },
  { key: 'vessels', label: 'Vessels', icon: Ship, type: 'Vessel' },
  { key: 'slips', label: 'Slips', icon: Anchor, type: 'Slip' },
  { key: 'charters', label: 'Charters', icon: Calendar, type: 'Charter' },
  { key: 'crew', label: 'Crew', icon: Users, type: 'CrewMember' },
];

const STATUSES = ['scheduled', 'active', 'completed', 'maintenance', 'grounded', 'stored'];

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'text-blue-400', active: 'text-green-400', completed: 'text-gray-400',
  maintenance: 'text-orange-400', grounded: 'text-red-400', stored: 'text-purple-400',
};

export default function AviationLensPage() {
  useLensNav('aviation');

  const [activeMode, setActiveMode] = useState<ModeTab>('flights');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeTab = MODE_TABS.find(t => t.key === activeMode)!;

  const { isError: isError, error: error, refetch: refetch, items, create, update, remove } = useLensData('aviation', activeTab.type, {
    search: searchQuery || undefined,
    status: statusFilter || undefined,
  });

  const runAction = useRunArtifact('aviation');
  const editingItem = items.find(i => i.id === editingId) || null;
  const filtered = items;

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDeparture, setFormDeparture] = useState('');
  const [formArrival, setFormArrival] = useState('');
  const [formRegistration, setFormRegistration] = useState('');
  const [formHours, setFormHours] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const resetForm = () => {
    setFormTitle(''); setFormDate(''); setFormDeparture(''); setFormArrival('');
    setFormRegistration(''); setFormHours(''); setFormNotes(''); setFormStatus('');
    setEditingId(null); setShowEditor(false);
  };

  const handleCreate = async () => {
    await create({
      title: formTitle || `New ${activeTab.type}`,
      data: {
        date: formDate, departure: formDeparture, arrival: formArrival,
        registration: formRegistration, hours: parseFloat(formHours) || 0,
        notes: formNotes,
      },
      meta: { status: formStatus || 'scheduled', tags: [] },
    });
    resetForm();
  };

  const handleEdit = (item: typeof items[0]) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    const d = item.data as Record<string, unknown>;
    setFormDate((d.date as string) || '');
    setFormDeparture((d.departure as string) || '');
    setFormArrival((d.arrival as string) || '');
    setFormRegistration((d.registration as string) || '');
    setFormHours(String((d.hours as number) || ''));
    setFormNotes((d.notes as string) || '');
    setFormStatus(item.meta?.status || '');
    setShowEditor(true);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    await update(editingId, {
      title: formTitle,
      data: {
        date: formDate, departure: formDeparture, arrival: formArrival,
        registration: formRegistration, hours: parseFloat(formHours) || 0,
        notes: formNotes,
      },
      meta: { status: formStatus },
    });
    resetForm();
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

  // Dashboard
  const totalItems = items.length;
  const activeItems = items.filter(i => i.meta?.status === 'active').length;
  const maintenanceItems = items.filter(i => i.meta?.status === 'maintenance').length;
  const totalHours = items.reduce((sum, i) => sum + ((i.data as Record<string, unknown>)?.hours as number || 0), 0);


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
          <Plane className="w-8 h-8 text-sky-400" />
          <div>
            <h1 className={ds.heading1}>Aviation & Maritime</h1>
            <p className={ds.textMuted}>Flight planning, pilot logbooks, marina management, charter operations</p>
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
                  ? 'border-sky-400 text-sky-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dashboard Metrics */}
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
          <div className={ds.textMuted}>Maintenance</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{maintenanceItems}</div>
        </div>
        <div className={ds.panel}>
          <div className={ds.textMuted}>Total Hours</div>
          <div className="text-2xl font-bold text-sky-400 mt-1">{totalHours.toFixed(1)}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab.label.toLowerCase()}...`}
            className={`${ds.input} pl-10`}
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${ds.select} w-48`}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Artifact List */}
      <div className={ds.grid3}>
        {items.length === 0 ? (
          <p className="col-span-full text-center py-12 text-gray-500">
            No {activeTab.label.toLowerCase()} found. Create your first entry.
          </p>
        ) : (
          items.map(item => {
            const d = item.data as Record<string, unknown>;
            return (
              <div key={item.id} className={ds.panelHover} onClick={() => handleEdit(item)}>
                <div className="flex items-start justify-between mb-2">
                  <activeTab.icon className="w-5 h-5 text-sky-400" />
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[item.meta?.status] || 'text-gray-400'} bg-current/10`}>
                    {item.meta?.status}
                  </span>
                </div>
                <h3 className="font-semibold text-white mb-1 line-clamp-1">{item.title}</h3>
                {!!(d.departure || d.arrival) && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                    <Navigation className="w-3 h-3" /> {d.departure as string} → {d.arrival as string}
                  </p>
                )}
                {!!d.registration && (
                  <p className="text-xs text-gray-400 mb-1">Reg: {d.registration as string}</p>
                )}
                {!!d.hours && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                    <Gauge className="w-3 h-3" /> {d.hours as number} hours
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                  {!!d.date && <span><Calendar className="w-3 h-3 inline mr-1" />{String(d.date)}</span>}
                  <span><Clock className="w-3 h-3 inline mr-1" />{new Date(item.updatedAt).toLocaleDateString()}</span>
                </div>
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
                    <input className={ds.input} value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder={`${activeTab.type} title...`} />
                  </div>
                  <div className={ds.grid2}>
                    <div>
                      <label className={ds.label}>Date</label>
                      <input type="date" className={ds.input} value={formDate} onChange={e => setFormDate(e.target.value)} />
                    </div>
                    <div>
                      <label className={ds.label}>Status</label>
                      <select className={ds.select} value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={ds.grid2}>
                    <div>
                      <label className={ds.label}>Departure</label>
                      <input className={ds.input} value={formDeparture} onChange={e => setFormDeparture(e.target.value)} placeholder="ICAO/IATA..." />
                    </div>
                    <div>
                      <label className={ds.label}>Arrival</label>
                      <input className={ds.input} value={formArrival} onChange={e => setFormArrival(e.target.value)} placeholder="ICAO/IATA..." />
                    </div>
                  </div>
                  <div className={ds.grid2}>
                    <div>
                      <label className={ds.label}>Registration</label>
                      <input className={ds.input} value={formRegistration} onChange={e => setFormRegistration(e.target.value)} placeholder="N12345..." />
                    </div>
                    <div>
                      <label className={ds.label}>Hours</label>
                      <input type="number" step="0.1" className={ds.input} value={formHours} onChange={e => setFormHours(e.target.value)} placeholder="0.0" />
                    </div>
                  </div>
                  <div>
                    <label className={ds.label}>Notes</label>
                    <textarea className={`${ds.textarea} h-24`} value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Notes..." />
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
