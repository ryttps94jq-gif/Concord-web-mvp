'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import {
  CalendarDays, MapPin, Mic2, Bus, Film, Store,
  Plus, Search, Filter, X, Edit2, Trash2,
  Ticket, Star,
  Music, Sparkles,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ModeTab = 'events' | 'venues' | 'performers' | 'tours' | 'productions' | 'vendors';
type ArtifactType = 'Event' | 'Venue' | 'Performer' | 'Tour' | 'Production' | 'Vendor';

const ALL_STATUSES = ['planning', 'confirmed', 'advancing', 'load_in', 'live', 'struck', 'settled', 'cancelled'] as const;

const STATUS_COLORS: Record<string, string> = {
  planning: 'gray-400', confirmed: 'neon-blue', advancing: 'neon-cyan',
  load_in: 'amber-400', live: 'green-400', struck: 'neon-purple',
  settled: 'green-400', cancelled: 'red-400',
};

const MODE_TABS: { id: ModeTab; label: string; icon: typeof CalendarDays; type: ArtifactType }[] = [
  { id: 'events', label: 'Events', icon: CalendarDays, type: 'Event' },
  { id: 'venues', label: 'Venues', icon: MapPin, type: 'Venue' },
  { id: 'performers', label: 'Performers', icon: Mic2, type: 'Performer' },
  { id: 'tours', label: 'Tours', icon: Bus, type: 'Tour' },
  { id: 'productions', label: 'Productions', icon: Film, type: 'Production' },
  { id: 'vendors', label: 'Vendors', icon: Store, type: 'Vendor' },
];

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const SEED: Record<ArtifactType, Array<{ title: string; data: Record<string, unknown>; meta: Record<string, unknown> }>> = {
  Event: [],
  Venue: [],
  Performer: [],
  Tour: [],
  Production: [],
  Vendor: [],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EventsLensPage() {
  useLensNav('events');

  const [mode, setMode] = useState<ModeTab>('events');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState('planning');
  const [formField1, setFormField1] = useState('');
  const [formField2, setFormField2] = useState('');
  const [formField3, setFormField3] = useState('');
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const currentType = MODE_TABS.find(t => t.id === mode)!.type;

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData('events', currentType, {
    seed: SEED[currentType],
  });

  const runAction = useRunArtifact('events');
  const editingItem = items.find(i => i.id === editing) || null;

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

  const resetForm = () => { setFormTitle(''); setFormStatus('planning'); setFormField1(''); setFormField2(''); setFormField3(''); setEditing(null); setShowEditor(false); };
  const openCreate = () => { resetForm(); setShowEditor(true); };

  const openEdit = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setEditing(id);
    setFormTitle(item.title);
    setFormStatus(item.meta?.status || 'planning');
    const vals = Object.values(item.data as Record<string, unknown>);
    setFormField1(String(vals[0] ?? ''));
    setFormField2(String(vals[1] ?? ''));
    setFormField3(String(vals[2] ?? ''));
    setShowEditor(true);
  };

  const handleSave = async () => {
    const data: Record<string, unknown> = {};
    if (mode === 'events') { data.date = formField1; data.venue = formField2; data.capacity = formField3; }
    if (mode === 'venues') { data.address = formField1; data.capacity = formField2; data.type = formField3; }
    if (mode === 'performers') { data.genre = formField1; data.agent = formField2; data.fee = formField3; }
    if (mode === 'tours') { data.artist = formField1; data.dates = formField2; data.markets = formField3; }
    if (mode === 'productions') { data.event = formField1; data.stageSize = formField2; data.crew = formField3; }
    if (mode === 'vendors') { data.category = formField1; data.contact = formField2; data.rate = formField3; }

    if (editing) {
      await update(editing, { title: formTitle, data, meta: { status: formStatus } });
    } else {
      await create({ title: formTitle, data, meta: { status: formStatus } });
    }
    resetForm();
  };

  const _handleAction = async (action: string, artifactId?: string) => {
    const targetId = artifactId || editingItem?.id || filtered[0]?.id;
    if (!targetId) return;
    try {
      const result = await runAction.mutateAsync({ id: targetId, action });
      setActionResult(result.result as Record<string, unknown>);
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  const fieldLabels: Record<ModeTab, [string, string, string]> = {
    events: ['Date', 'Venue', 'Capacity'],
    venues: ['Address', 'Capacity', 'Type'],
    performers: ['Genre', 'Agent', 'Fee'],
    tours: ['Artist', 'Number of Dates', 'Markets'],
    productions: ['Event', 'Stage Size', 'Crew Size'],
    vendors: ['Category', 'Contact Name', 'Rate'],
  };

  // Dashboard metrics
  const upcomingEvents = SEED.Event.filter(e => e.meta.status !== 'cancelled' && e.meta.status !== 'settled').length;
  const totalTicketsSold = SEED.Event.reduce((s, e) => s + (e.data.ticketsSold as number), 0);
  const confirmedVendors = SEED.Vendor.filter(v => v.meta.status === 'confirmed').length;
  const liveShows = SEED.Event.filter(e => e.meta.status === 'live').length;


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
          <Sparkles className="w-7 h-7 text-neon-pink" />
          <div>
            <h1 className={ds.heading1}>Events &amp; Entertainment</h1>
            <p className={ds.textMuted}>Events, venues, performers, tours and production</p>
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
                mode === tab.id ? 'bg-neon-pink/20 text-neon-pink' : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'
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
          <div className="flex items-center gap-2 mb-1"><CalendarDays className="w-4 h-4 text-neon-pink" /><span className={ds.textMuted}>Upcoming Events</span></div>
          <p className="text-2xl font-bold">{upcomingEvents}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Ticket className="w-4 h-4 text-neon-cyan" /><span className={ds.textMuted}>Tickets Sold</span></div>
          <p className="text-2xl font-bold">{totalTicketsSold.toLocaleString()}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Store className="w-4 h-4 text-green-400" /><span className={ds.textMuted}>Confirmed Vendors</span></div>
          <p className="text-2xl font-bold">{confirmedVendors}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Music className="w-4 h-4 text-amber-400" /><span className={ds.textMuted}>Live Now</span></div>
          <p className="text-2xl font-bold">{liveShows}</p>
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
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Artifact library */}
      {isLoading ? (
        <div className="text-center py-12"><p className={ds.textMuted}>Loading...</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDays className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className={ds.textMuted}>No {currentType.toLowerCase()}s found</p>
          <button onClick={openCreate} className={`${ds.btnGhost} mt-3`}><Plus className="w-4 h-4" /> Create one</button>
        </div>
      ) : (
        <div className={ds.grid3}>
          {filtered.map(item => {
            const status = item.meta?.status || 'planning';
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
                {/* Ticket progress for events */}
                {currentType === 'Event' && (item.data as Record<string, unknown>).ticketsSold !== undefined && Number((item.data as Record<string, unknown>).capacity) > 0 && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Tickets</span>
                      <span>{String((item.data as Record<string, unknown>).ticketsSold)}/{String((item.data as Record<string, unknown>).capacity)}</span>
                    </div>
                    <div className="w-full h-2 bg-lattice-elevated rounded-full overflow-hidden">
                      <div className="h-full bg-neon-pink rounded-full transition-all" style={{ width: `${Math.min(100, (Number((item.data as Record<string, unknown>).ticketsSold) / Number((item.data as Record<string, unknown>).capacity)) * 100)}%` }} />
                    </div>
                  </div>
                )}
                {/* Star rating for performers / vendors */}
                {((item.data as Record<string, unknown>).rating !== undefined) && (
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-sm text-amber-400">{String((item.data as Record<string, unknown>).rating)}</span>
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
                  <label className={ds.label}>Title / Name</label>
                  <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className={ds.input} placeholder={`${currentType} name`} />
                </div>
                <div>
                  <label className={ds.label}>Status</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className={ds.select}>
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
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

      {/* Upcoming timeline */}
      <section>
        <h2 className={ds.heading2 + ' mb-3'}>Upcoming Timeline</h2>
        <div className={ds.panel}>
          <div className="divide-y divide-lattice-border">
            {[
              { date: 'Mar 22', event: 'Jazz Under the Stars', venue: 'Rooftop Garden', status: 'advancing' },
              { date: 'Apr 10', event: 'Corporate Gala - TechCorp', venue: 'Grand Ballroom', status: 'planning' },
              { date: 'Jun 14', event: 'Neon Lights Festival 2026', venue: 'Meridian Amphitheatre', status: 'confirmed' },
              { date: 'Jul 04', event: 'Summer Block Party', venue: 'Downtown Plaza', status: 'planning' },
            ].map((evt, i) => (
              <div key={i} className="flex items-center gap-4 py-3 px-2">
                <span className={ds.textMono + ' w-16 text-neon-pink'}>{evt.date}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-200">{evt.event}</p>
                  <p className={ds.textMuted}>{evt.venue}</p>
                </div>
                <span className={ds.badge(STATUS_COLORS[evt.status] || 'gray-400')}>{evt.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
