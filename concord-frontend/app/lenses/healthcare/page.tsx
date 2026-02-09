'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { ds } from '@/lib/design-system';
import {
  Heart,
  Users,
  Stethoscope,
  Pill,
  FlaskConical,
  Brain,
  Plus,
  Search,
  Filter,
  X,
  Edit3,
  Trash2,
  AlertTriangle,
  Activity,
  ClipboardList,
  Calendar,
  ShieldCheck,
  FileText,
  BarChart2,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Patients' | 'Encounters' | 'Protocols' | 'Pharmacy' | 'Lab' | 'Therapy';
type ArtifactType = 'Patient' | 'Encounter' | 'CareProtocol' | 'Prescription' | 'LabResult' | 'Treatment';
type Status = 'scheduled' | 'active' | 'completed' | 'cancelled' | 'archived';

interface HealthcareArtifact {
  artifactType: ArtifactType;
  status: Status;
  description: string;
  provider?: string;
  date?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  [key: string]: unknown;
}

const MODE_TABS: { id: ModeTab; icon: React.ElementType; defaultType: ArtifactType }[] = [
  { id: 'Patients', icon: Users, defaultType: 'Patient' },
  { id: 'Encounters', icon: Stethoscope, defaultType: 'Encounter' },
  { id: 'Protocols', icon: ClipboardList, defaultType: 'CareProtocol' },
  { id: 'Pharmacy', icon: Pill, defaultType: 'Prescription' },
  { id: 'Lab', icon: FlaskConical, defaultType: 'LabResult' },
  { id: 'Therapy', icon: Brain, defaultType: 'Treatment' },
];

const ALL_STATUSES: Status[] = ['scheduled', 'active', 'completed', 'cancelled', 'archived'];

const STATUS_COLORS: Record<Status, string> = {
  scheduled: 'neon-blue',
  active: 'neon-green',
  completed: 'neon-cyan',
  cancelled: 'red-400',
  archived: 'gray-400',
};

const SEED_ITEMS: { title: string; data: HealthcareArtifact }[] = [
  { title: 'Jane Doe - Annual Physical', data: { artifactType: 'Patient', status: 'active', description: 'Annual wellness exam due', provider: 'Dr. Smith', date: '2025-06-15', priority: 'medium' } },
  { title: 'Post-Op Follow-Up #412', data: { artifactType: 'Encounter', status: 'scheduled', description: 'Knee replacement follow-up at 6 weeks', provider: 'Dr. Chen', date: '2025-06-20', priority: 'high' } },
  { title: 'Diabetes Management Protocol', data: { artifactType: 'CareProtocol', status: 'active', description: 'Type 2 diabetes standard management pathway', provider: 'Endocrinology', priority: 'high' } },
  { title: 'Metformin 500mg BID', data: { artifactType: 'Prescription', status: 'active', description: 'Metformin for glycemic control', provider: 'Dr. Smith', priority: 'medium' } },
  { title: 'HbA1c Panel', data: { artifactType: 'LabResult', status: 'completed', description: 'Hemoglobin A1c result: 6.8%', provider: 'LabCorp', date: '2025-06-01', priority: 'low' } },
  { title: 'CBT Session Plan - Anxiety', data: { artifactType: 'Treatment', status: 'active', description: 'Cognitive behavioral therapy for generalized anxiety', provider: 'Dr. Patel', priority: 'medium' } },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HealthcareLensPage() {
  useLensNav('healthcare');

  const [activeTab, setActiveTab] = useState<ModeTab>('Patients');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [filterType, setFilterType] = useState<ArtifactType | 'all'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<LensItem<HealthcareArtifact> | null>(null);

  // Editor form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<ArtifactType>('Patient');
  const [formStatus, setFormStatus] = useState<Status>('scheduled');
  const [formDescription, setFormDescription] = useState('');
  const [formProvider, setFormProvider] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [formNotes, setFormNotes] = useState('');

  const { items, isLoading, create, update, remove } = useLensData<HealthcareArtifact>('healthcare', 'artifact', {
    seed: SEED_ITEMS.map(s => ({ title: s.title, data: s.data as unknown as Record<string, unknown>, meta: { status: s.data.status, tags: [s.data.artifactType] } })),
  });

  /* ---------- derived data ---------- */

  const currentTabType = MODE_TABS.find(t => t.id === activeTab)?.defaultType ?? 'Patient';

  const filtered = useMemo(() => {
    let list = items;
    // Filter by current tab type
    list = list.filter(i => (i.data as unknown as HealthcareArtifact).artifactType === currentTabType);
    if (filterStatus !== 'all') list = list.filter(i => (i.data as unknown as HealthcareArtifact).status === filterStatus);
    if (filterType !== 'all') list = list.filter(i => (i.data as unknown as HealthcareArtifact).artifactType === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || (i.data as unknown as HealthcareArtifact).description?.toLowerCase().includes(q));
    }
    return list;
  }, [items, currentTabType, filterStatus, filterType, searchQuery]);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter(i => (i.data as unknown as HealthcareArtifact).status === 'active').length,
    scheduled: items.filter(i => (i.data as unknown as HealthcareArtifact).status === 'scheduled').length,
    completed: items.filter(i => (i.data as unknown as HealthcareArtifact).status === 'completed').length,
    urgent: items.filter(i => (i.data as unknown as HealthcareArtifact).priority === 'urgent' || (i.data as unknown as HealthcareArtifact).priority === 'high').length,
  }), [items]);

  /* ---------- editor helpers ---------- */

  const openNewEditor = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormType(currentTabType);
    setFormStatus('scheduled');
    setFormDescription('');
    setFormProvider('');
    setFormDate('');
    setFormPriority('medium');
    setFormNotes('');
    setShowEditor(true);
  };

  const openEditEditor = (item: LensItem<HealthcareArtifact>) => {
    const d = item.data as unknown as HealthcareArtifact;
    setEditingItem(item);
    setFormTitle(item.title);
    setFormType(d.artifactType);
    setFormStatus(d.status);
    setFormDescription(d.description || '');
    setFormProvider(d.provider || '');
    setFormDate(d.date || '');
    setFormPriority(d.priority || 'medium');
    setFormNotes(d.notes || '');
    setShowEditor(true);
  };

  const handleSave = async () => {
    const payload = {
      title: formTitle,
      data: { artifactType: formType, status: formStatus, description: formDescription, provider: formProvider, date: formDate, priority: formPriority, notes: formNotes } as unknown as Partial<HealthcareArtifact>,
      meta: { status: formStatus, tags: [formType] },
    };
    if (editingItem) {
      await update(editingItem.id, payload);
    } else {
      await create(payload);
    }
    setShowEditor(false);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
  };

  const handleAction = (action: string) => {
    // Placeholder for domain actions
    alert(`Action triggered: ${action}. In production this would call the backend.`);
  };

  /* ---------- render ---------- */

  return (
    <div className={ds.pageContainer}>
      {/* Compliance Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-200">
          This tool assists with record organization. It is not a certified EHR. Consult applicable regulations (HIPAA, etc.) for your jurisdiction.
        </p>
      </div>

      {/* Header */}
      <header className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <Heart className="w-7 h-7 text-red-400" />
          <div>
            <h1 className={ds.heading1}>Healthcare</h1>
            <p className={ds.textMuted}>Clinical record organization and care coordination</p>
          </div>
        </div>
        <button onClick={openNewEditor} className={ds.btnPrimary}>
          <Plus className="w-4 h-4" /> New Record
        </button>
      </header>

      {/* Mode Tabs */}
      <nav className="flex items-center gap-1 border-b border-lattice-border pb-3 overflow-x-auto">
        {MODE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setFilterStatus('all'); setFilterType('all'); }}
            className={`${ds.btnGhost} whitespace-nowrap ${activeTab === tab.id ? 'bg-neon-blue/20 text-neon-blue' : ''}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.id}
          </button>
        ))}
      </nav>

      {/* Dashboard Overview */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <Activity className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{stats.active}</p>
          <p className={ds.textMuted}>Active</p>
        </div>
        <div className={ds.panel}>
          <Calendar className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{stats.scheduled}</p>
          <p className={ds.textMuted}>Scheduled</p>
        </div>
        <div className={ds.panel}>
          <CheckCircle className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{stats.completed}</p>
          <p className={ds.textMuted}>Completed</p>
        </div>
        <div className={ds.panel}>
          <AlertTriangle className="w-5 h-5 text-red-400 mb-2" />
          <p className="text-2xl font-bold">{stats.urgent}</p>
          <p className={ds.textMuted}>High Priority</p>
        </div>
      </div>

      {/* Domain Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => handleAction('checkInteractions')} className={ds.btnSecondary}>
          <ShieldCheck className="w-4 h-4" /> Check Interactions
        </button>
        <button onClick={() => handleAction('protocolMatch')} className={ds.btnSecondary}>
          <ClipboardList className="w-4 h-4" /> Protocol Match
        </button>
        <button onClick={() => handleAction('generateSummary')} className={ds.btnSecondary}>
          <FileText className="w-4 h-4" /> Generate Summary
        </button>
      </div>

      {/* Artifact Library */}
      <section className={ds.panel}>
        <div className={`${ds.sectionHeader} mb-4`}>
          <h2 className={ds.heading2}>{activeTab}</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search records..."
                className={`${ds.input} pl-9 w-56`}
              />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as Status | 'all')} className={`${ds.select} w-40`}>
              <option value="all">All statuses</option>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <p className={`${ds.textMuted} text-center py-12`}>Loading records...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Stethoscope className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className={ds.textMuted}>No records found. Create one to get started.</p>
          </div>
        ) : (
          <div className={ds.grid3}>
            {filtered.map(item => {
              const d = item.data as unknown as HealthcareArtifact;
              return (
                <div key={item.id} className={ds.panelHover} onClick={() => openEditEditor(item)}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`${ds.heading3} text-base truncate flex-1`}>{item.title}</h3>
                    <span className={ds.badge(STATUS_COLORS[d.status])}>{d.status}</span>
                  </div>
                  <p className={`${ds.textMuted} line-clamp-2 mb-3`}>{d.description}</p>
                  <div className="flex items-center justify-between text-xs">
                    {d.provider && <span className={ds.textMuted}>{d.provider}</span>}
                    {d.date && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <Clock className="w-3 h-3" /> {d.date}
                      </span>
                    )}
                  </div>
                  {d.priority && (d.priority === 'high' || d.priority === 'urgent') && (
                    <div className="mt-2">
                      <span className={ds.badge('red-400')}>
                        <Zap className="w-3 h-3" /> {d.priority}
                      </span>
                    </div>
                  )}
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
                <h2 className={ds.heading2}>{editingItem ? 'Edit Record' : 'New Record'}</h2>
                <button onClick={() => setShowEditor(false)} className={ds.btnGhost}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className={ds.label}>Title</label>
                  <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className={ds.input} placeholder="Record title" />
                </div>
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Type</label>
                    <select value={formType} onChange={e => setFormType(e.target.value as ArtifactType)} className={ds.select}>
                      <option value="Patient">Patient</option>
                      <option value="Encounter">Encounter</option>
                      <option value="CareProtocol">Care Protocol</option>
                      <option value="Prescription">Prescription</option>
                      <option value="LabResult">Lab Result</option>
                      <option value="Treatment">Treatment</option>
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
                    <label className={ds.label}>Provider</label>
                    <input value={formProvider} onChange={e => setFormProvider(e.target.value)} className={ds.input} placeholder="Attending provider" />
                  </div>
                  <div>
                    <label className={ds.label}>Date</label>
                    <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className={ds.input} />
                  </div>
                </div>
                <div>
                  <label className={ds.label}>Priority</label>
                  <select value={formPriority} onChange={e => setFormPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')} className={ds.select}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className={ds.label}>Description</label>
                  <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} className={ds.textarea} rows={3} placeholder="Clinical description..." />
                </div>
                <div>
                  <label className={ds.label}>Notes</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className={ds.textarea} rows={2} placeholder="Additional notes..." />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border-t border-lattice-border">
                <div>
                  {editingItem && (
                    <button onClick={() => { handleDelete(editingItem.id); setShowEditor(false); }} className={ds.btnDanger}>
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowEditor(false)} className={ds.btnSecondary}>Cancel</button>
                  <button onClick={handleSave} className={ds.btnPrimary}>
                    {editingItem ? 'Update' : 'Create'} Record
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
