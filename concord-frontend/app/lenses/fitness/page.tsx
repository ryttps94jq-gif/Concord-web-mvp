'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import {
  Dumbbell,
  Users,
  ListChecks,
  Flame,
  CalendarDays,
  Shield,
  Medal,
  Plus,
  Search,
  X,
  Trash2,
  Target,
  Timer,
  Zap,
  User,
  Calendar,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Clients' | 'Programs' | 'Workouts' | 'Classes' | 'Teams' | 'Recruiting';
type ArtifactType = 'Client' | 'Program' | 'Workout' | 'Class' | 'Team' | 'Athlete';
type Status = 'active' | 'paused' | 'completed' | 'deferred' | 'graduated';

interface FitnessArtifact {
  artifactType: ArtifactType;
  status: Status;
  description: string;
  coach?: string;
  category?: string;
  duration?: number; // minutes
  intensity?: 'low' | 'moderate' | 'high' | 'extreme';
  schedule?: string;
  goal?: string;
  startDate?: string;
  notes?: string;
  [key: string]: unknown;
}

const MODE_TABS: { id: ModeTab; icon: React.ElementType; defaultType: ArtifactType }[] = [
  { id: 'Clients', icon: Users, defaultType: 'Client' },
  { id: 'Programs', icon: ListChecks, defaultType: 'Program' },
  { id: 'Workouts', icon: Dumbbell, defaultType: 'Workout' },
  { id: 'Classes', icon: CalendarDays, defaultType: 'Class' },
  { id: 'Teams', icon: Shield, defaultType: 'Team' },
  { id: 'Recruiting', icon: Medal, defaultType: 'Athlete' },
];

const ALL_STATUSES: Status[] = ['active', 'paused', 'completed', 'deferred', 'graduated'];

const STATUS_COLORS: Record<Status, string> = {
  active: 'neon-green',
  paused: 'amber-400',
  completed: 'neon-cyan',
  deferred: 'gray-400',
  graduated: 'neon-purple',
};

const seedItems: { title: string; data: FitnessArtifact }[] = [];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FitnessLensPage() {
  useLensNav('fitness');

  const [activeTab, setActiveTab] = useState<ModeTab>('Clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<LensItem<FitnessArtifact> | null>(null);

  // Editor form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<ArtifactType>('Client');
  const [formStatus, setFormStatus] = useState<Status>('active');
  const [formDescription, setFormDescription] = useState('');
  const [formCoach, setFormCoach] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formIntensity, setFormIntensity] = useState<'low' | 'moderate' | 'high' | 'extreme'>('moderate');
  const [formSchedule, setFormSchedule] = useState('');
  const [formGoal, setFormGoal] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData<FitnessArtifact>('fitness', 'artifact', {
    seed: seedItems.map(s => ({ title: s.title, data: s.data as unknown as Record<string, unknown>, meta: { status: s.data.status, tags: [s.data.artifactType] } })),
  });

  const runAction = useRunArtifact('fitness');

  /* ---------- derived ---------- */

  const currentTabType = MODE_TABS.find(t => t.id === activeTab)?.defaultType ?? 'Client';

  const filtered = useMemo(() => {
    let list = items.filter(i => (i.data as unknown as FitnessArtifact).artifactType === currentTabType);
    if (filterStatus !== 'all') list = list.filter(i => (i.data as unknown as FitnessArtifact).status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || (i.data as unknown as FitnessArtifact).description?.toLowerCase().includes(q));
    }
    return list;
  }, [items, currentTabType, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    const all = items;
    return {
      activeClients: all.filter(i => (i.data as unknown as FitnessArtifact).artifactType === 'Client' && (i.data as unknown as FitnessArtifact).status === 'active').length,
      programs: all.filter(i => (i.data as unknown as FitnessArtifact).artifactType === 'Program').length,
      workouts: all.filter(i => (i.data as unknown as FitnessArtifact).artifactType === 'Workout').length,
      weeklyClasses: all.filter(i => (i.data as unknown as FitnessArtifact).artifactType === 'Class' && (i.data as unknown as FitnessArtifact).status === 'active').length,
      teams: all.filter(i => (i.data as unknown as FitnessArtifact).artifactType === 'Team').length,
      prospects: all.filter(i => (i.data as unknown as FitnessArtifact).artifactType === 'Athlete').length,
    };
  }, [items]);

  /* ---------- editor helpers ---------- */

  const openNewEditor = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormType(currentTabType);
    setFormStatus('active');
    setFormDescription('');
    setFormCoach('');
    setFormCategory('');
    setFormDuration('');
    setFormIntensity('moderate');
    setFormSchedule('');
    setFormGoal('');
    setFormStartDate('');
    setFormNotes('');
    setShowEditor(true);
  };

  const openEditEditor = (item: LensItem<FitnessArtifact>) => {
    const d = item.data as unknown as FitnessArtifact;
    setEditingItem(item);
    setFormTitle(item.title);
    setFormType(d.artifactType);
    setFormStatus(d.status);
    setFormDescription(d.description || '');
    setFormCoach(d.coach || '');
    setFormCategory(d.category || '');
    setFormDuration(d.duration != null ? String(d.duration) : '');
    setFormIntensity(d.intensity || 'moderate');
    setFormSchedule(d.schedule || '');
    setFormGoal(d.goal || '');
    setFormStartDate(d.startDate || '');
    setFormNotes(d.notes || '');
    setShowEditor(true);
  };

  const handleSave = async () => {
    const payload = {
      title: formTitle,
      data: {
        artifactType: formType, status: formStatus, description: formDescription,
        coach: formCoach, category: formCategory,
        duration: formDuration ? parseInt(formDuration) : undefined,
        intensity: formIntensity, schedule: formSchedule, goal: formGoal,
        startDate: formStartDate, notes: formNotes,
      } as unknown as Partial<FitnessArtifact>,
      meta: { status: formStatus, tags: [formType] },
    };
    if (editingItem) await update(editingItem.id, payload);
    else await create(payload);
    setShowEditor(false);
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

  const intensityColor = (level: string) => {
    switch (level) {
      case 'low': return 'neon-green';
      case 'moderate': return 'neon-blue';
      case 'high': return 'amber-400';
      case 'extreme': return 'red-400';
      default: return 'gray-400';
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
      {/* Header */}
      <header className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <Dumbbell className="w-7 h-7 text-neon-green" />
          <div>
            <h1 className={ds.heading1}>Fitness & Wellness</h1>
            <p className={ds.textMuted}>Client management, programming, scheduling, and recruiting</p>
          </div>
        </div>
        <button onClick={openNewEditor} className={ds.btnPrimary}>
          <Plus className="w-4 h-4" /> New Record
        </button>
        {runAction.isPending && <span className="text-xs text-neon-blue animate-pulse">Running...</span>}
      </header>

      {/* Mode Tabs */}
      <nav className="flex items-center gap-1 border-b border-lattice-border pb-3 overflow-x-auto">
        {MODE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setFilterStatus('all'); }}
            className={`${ds.btnGhost} whitespace-nowrap ${activeTab === tab.id ? 'bg-neon-green/20 text-neon-green' : ''}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.id}
          </button>
        ))}
      </nav>

      {/* Dashboard */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <Users className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{stats.activeClients}</p>
          <p className={ds.textMuted}>Active Clients</p>
        </div>
        <div className={ds.panel}>
          <ListChecks className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{stats.programs}</p>
          <p className={ds.textMuted}>Programs</p>
        </div>
        <div className={ds.panel}>
          <Flame className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-2xl font-bold">{stats.workouts}</p>
          <p className={ds.textMuted}>Workouts</p>
        </div>
        <div className={ds.panel}>
          <CalendarDays className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{stats.weeklyClasses}</p>
          <p className={ds.textMuted}>Active Classes</p>
        </div>
      </div>

      {/* Artifact Library */}
      <section className={ds.panel}>
        <div className={`${ds.sectionHeader} mb-4`}>
          <h2 className={ds.heading2}>{activeTab}</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className={`${ds.input} pl-9 w-56`} />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as Status | 'all')} className={`${ds.select} w-40`}>
              <option value="all">All statuses</option>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <p className={`${ds.textMuted} text-center py-12`}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Dumbbell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className={ds.textMuted}>No {activeTab.toLowerCase()} found. Create one to get started.</p>
          </div>
        ) : (
          <div className={ds.grid3}>
            {filtered.map(item => {
              const d = item.data as unknown as FitnessArtifact;
              return (
                <div key={item.id} className={ds.panelHover} onClick={() => openEditEditor(item)}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`${ds.heading3} text-base truncate flex-1`}>{item.title}</h3>
                    <span className={ds.badge(STATUS_COLORS[d.status])}>{d.status}</span>
                  </div>
                  <p className={`${ds.textMuted} line-clamp-2 mb-3`}>{d.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    {d.coach && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {d.coach}</span>}
                    {d.category && <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {d.category}</span>}
                    {d.duration != null && <span className="flex items-center gap-1"><Timer className="w-3 h-3" /> {d.duration} min</span>}
                    {d.intensity && (
                      <span className={ds.badge(intensityColor(d.intensity))}>
                        <Zap className="w-3 h-3" /> {d.intensity}
                      </span>
                    )}
                    {d.schedule && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {d.schedule}</span>}
                  </div>
                  {d.goal && (
                    <div className="mt-2">
                      <span className="text-xs text-neon-cyan flex items-center gap-1">
                        <Target className="w-3 h-3" /> {d.goal}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

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
                    <select value={formType} onChange={e => setFormType(e.target.value as ArtifactType)} className={ds.select}>
                      <option value="Client">Client</option>
                      <option value="Program">Program</option>
                      <option value="Workout">Workout</option>
                      <option value="Class">Class</option>
                      <option value="Team">Team</option>
                      <option value="Athlete">Athlete</option>
                    </select>
                  </div>
                  <div>
                    <label className={ds.label}>Status</label>
                    <select value={formStatus} onChange={e => setFormStatus(e.target.value as Status)} className={ds.select}>
                      {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Coach / Instructor</label>
                    <input value={formCoach} onChange={e => setFormCoach(e.target.value)} className={ds.input} placeholder="Coach name" />
                  </div>
                  <div>
                    <label className={ds.label}>Category</label>
                    <input value={formCategory} onChange={e => setFormCategory(e.target.value)} className={ds.input} placeholder="e.g. HIIT, Yoga, Strength" />
                  </div>
                </div>
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Duration (minutes)</label>
                    <input type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)} className={ds.input} placeholder="45" min="0" />
                  </div>
                  <div>
                    <label className={ds.label}>Intensity</label>
                    <select value={formIntensity} onChange={e => setFormIntensity(e.target.value as 'low' | 'moderate' | 'high' | 'extreme')} className={ds.select}>
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                      <option value="extreme">Extreme</option>
                    </select>
                  </div>
                </div>
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Schedule</label>
                    <input value={formSchedule} onChange={e => setFormSchedule(e.target.value)} className={ds.input} placeholder="e.g. Mon/Wed/Fri 6AM" />
                  </div>
                  <div>
                    <label className={ds.label}>Start Date</label>
                    <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} className={ds.input} />
                  </div>
                </div>
                <div>
                  <label className={ds.label}>Goal</label>
                  <input value={formGoal} onChange={e => setFormGoal(e.target.value)} className={ds.input} placeholder="Target or goal" />
                </div>
                <div>
                  <label className={ds.label}>Description</label>
                  <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} className={ds.textarea} rows={3} placeholder="Description..." />
                </div>
                <div>
                  <label className={ds.label}>Notes</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className={ds.textarea} rows={2} placeholder="Additional notes..." />
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
