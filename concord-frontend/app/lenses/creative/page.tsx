'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import {
  Palette, Camera, Image, Tv, LayoutGrid, FileCheck,
  Plus, Search, Filter, X, Edit2, Trash2,
  Clock, Eye, Download, Share2, Star,
  BarChart3, TrendingUp, FileImage, Video, Aperture,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ModeTab = 'projects' | 'shoots' | 'assets' | 'episodes' | 'collections' | 'proofs';
type ArtifactType = 'Project' | 'Shoot' | 'Asset' | 'Episode' | 'Collection' | 'ClientProof';

const ALL_STATUSES = ['brief', 'pre_production', 'production', 'post_production', 'review', 'delivered', 'archived'] as const;

const STATUS_COLORS: Record<string, string> = {
  brief: 'gray-400', pre_production: 'neon-blue', production: 'neon-cyan',
  post_production: 'neon-purple', review: 'amber-400', delivered: 'green-400', archived: 'gray-500',
};

const MODE_TABS: { id: ModeTab; label: string; icon: typeof Palette; type: ArtifactType }[] = [
  { id: 'projects', label: 'Projects', icon: Palette, type: 'Project' },
  { id: 'shoots', label: 'Shoots', icon: Camera, type: 'Shoot' },
  { id: 'assets', label: 'Assets', icon: Image, type: 'Asset' },
  { id: 'episodes', label: 'Episodes', icon: Tv, type: 'Episode' },
  { id: 'collections', label: 'Collections', icon: LayoutGrid, type: 'Collection' },
  { id: 'proofs', label: 'Proofs', icon: FileCheck, type: 'ClientProof' },
];

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const SEED: Record<ArtifactType, Array<{ title: string; data: Record<string, unknown>; meta: Record<string, unknown> }>> = {
  Project: [
    { title: 'Brand Refresh - Lumina Co', data: { client: 'Lumina Co', type: 'Branding', budget: 85000, deadline: '2026-04-01', lead: 'Ava Thompson', deliverables: 24 }, meta: { status: 'production', tags: ['branding', 'priority'] } },
    { title: 'Product Launch - NovaTech', data: { client: 'NovaTech', type: 'Campaign', budget: 120000, deadline: '2026-05-15', lead: 'Marcus Reed', deliverables: 42 }, meta: { status: 'pre_production', tags: ['campaign'] } },
    { title: 'Annual Report 2025 - FinGroup', data: { client: 'FinGroup', type: 'Print / Digital', budget: 35000, deadline: '2026-03-01', lead: 'Sofia Nguyen', deliverables: 8 }, meta: { status: 'review', tags: ['print'] } },
    { title: 'Documentary - Urban Roots', data: { client: 'Internal', type: 'Film', budget: 200000, deadline: '2026-09-01', lead: 'James Carter', deliverables: 1 }, meta: { status: 'production', tags: ['film', 'documentary'] } },
  ],
  Shoot: [
    { title: 'Lumina Hero Shots - Studio A', data: { project: 'Lumina Co Brand Refresh', date: '2026-02-20', location: 'Studio A', photographer: 'Mia Chen', duration: '8 hours', shotList: 48 }, meta: { status: 'pre_production', tags: ['product'] } },
    { title: 'NovaTech Lifestyle - On Location', data: { project: 'NovaTech Product Launch', date: '2026-03-10', location: 'Downtown Loft', photographer: 'Elijah Brooks', duration: '10 hours', shotList: 72 }, meta: { status: 'brief', tags: ['lifestyle'] } },
    { title: 'Urban Roots B-Roll - Day 4', data: { project: 'Urban Roots Documentary', date: '2026-02-15', location: 'East Side Market', photographer: 'James Carter', duration: '6 hours', shotList: 0 }, meta: { status: 'production', tags: ['documentary', 'b-roll'] } },
  ],
  Asset: [
    { title: 'lumina-logo-primary.svg', data: { type: 'Vector', format: 'SVG', resolution: 'Scalable', fileSize: '42 KB', project: 'Lumina Co Brand Refresh', version: 3 }, meta: { status: 'delivered', tags: ['logo', 'final'] } },
    { title: 'nova-hero-16x9.psd', data: { type: 'Photo', format: 'PSD', resolution: '5760x3240', fileSize: '285 MB', project: 'NovaTech Product Launch', version: 1 }, meta: { status: 'production', tags: ['hero', 'wip'] } },
    { title: 'urban-roots-ep1-rough.mp4', data: { type: 'Video', format: 'MP4', resolution: '4K', fileSize: '12.4 GB', project: 'Urban Roots Documentary', version: 2 }, meta: { status: 'post_production', tags: ['rough-cut'] } },
    { title: 'fingroup-charts-set.ai', data: { type: 'Vector', format: 'AI', resolution: 'Scalable', fileSize: '18 MB', project: 'FinGroup Annual Report', version: 5 }, meta: { status: 'review', tags: ['infographic'] } },
  ],
  Episode: [
    { title: 'Urban Roots - Ep. 1: Seeds', data: { series: 'Urban Roots', number: 1, duration: '28 min', director: 'James Carter', editor: 'Lena Park', airDate: '2026-09-15' }, meta: { status: 'post_production', tags: ['pilot'] } },
    { title: 'Urban Roots - Ep. 2: Soil', data: { series: 'Urban Roots', number: 2, duration: '26 min', director: 'James Carter', editor: 'Lena Park', airDate: '2026-09-22' }, meta: { status: 'production', tags: [] } },
    { title: 'Urban Roots - Ep. 3: Growth', data: { series: 'Urban Roots', number: 3, duration: 'TBD', director: 'James Carter', editor: 'Lena Park', airDate: '2026-09-29' }, meta: { status: 'brief', tags: [] } },
  ],
  Collection: [
    { title: 'Lumina Brand Kit v3', data: { project: 'Lumina Co Brand Refresh', assetCount: 18, categories: 'Logo, Color, Typography, Iconography', sharedWith: 'Client + Internal', lastUpdated: '2026-02-05' }, meta: { status: 'production', tags: ['brand-kit'] } },
    { title: 'NovaTech Campaign Assets', data: { project: 'NovaTech Product Launch', assetCount: 6, categories: 'Photo, Video, Copy', sharedWith: 'Internal', lastUpdated: '2026-02-01' }, meta: { status: 'pre_production', tags: ['campaign'] } },
  ],
  ClientProof: [
    { title: 'Lumina Logo Options - Round 2', data: { project: 'Lumina Co Brand Refresh', client: 'Lumina Co', sentDate: '2026-02-03', versions: 4, feedback: 'Prefer option B with minor color tweak', approved: false }, meta: { status: 'review', tags: ['logo'] } },
    { title: 'FinGroup Report Draft v5', data: { project: 'FinGroup Annual Report', client: 'FinGroup', sentDate: '2026-02-06', versions: 5, feedback: 'Approved with minor edits p.12', approved: true }, meta: { status: 'delivered', tags: ['approved'] } },
    { title: 'NovaTech Mood Board', data: { project: 'NovaTech Product Launch', client: 'NovaTech', sentDate: '2026-01-28', versions: 2, feedback: 'Love direction 1, explore further', approved: false }, meta: { status: 'review', tags: ['mood-board'] } },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CreativeLensPage() {
  useLensNav('creative');

  const [mode, setMode] = useState<ModeTab>('projects');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState('brief');
  const [formField1, setFormField1] = useState('');
  const [formField2, setFormField2] = useState('');
  const [formField3, setFormField3] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const currentType = MODE_TABS.find(t => t.id === mode)!.type;

  const { items, isLoading, create, update, remove } = useLensData('creative', currentType, {
    seed: SEED[currentType],
  });

  const runAction = useRunArtifact('creative');

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

  const resetForm = () => { setFormTitle(''); setFormStatus('brief'); setFormField1(''); setFormField2(''); setFormField3(''); setFormNotes(''); setEditing(null); setShowEditor(false); };
  const openCreate = () => { resetForm(); setShowEditor(true); };

  const openEdit = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setEditing(id);
    setFormTitle(item.title);
    setFormStatus(item.meta?.status || 'brief');
    const vals = Object.values(item.data as Record<string, unknown>);
    setFormField1(String(vals[0] ?? ''));
    setFormField2(String(vals[1] ?? ''));
    setFormField3(String(vals[2] ?? ''));
    setFormNotes(String(vals[4] ?? ''));
    setShowEditor(true);
  };

  const handleSave = async () => {
    const data: Record<string, unknown> = {};
    if (mode === 'projects') { data.client = formField1; data.type = formField2; data.budget = formField3; data.notes = formNotes; }
    if (mode === 'shoots') { data.project = formField1; data.date = formField2; data.location = formField3; data.notes = formNotes; }
    if (mode === 'assets') { data.type = formField1; data.format = formField2; data.resolution = formField3; data.notes = formNotes; }
    if (mode === 'episodes') { data.series = formField1; data.number = formField2; data.duration = formField3; data.notes = formNotes; }
    if (mode === 'collections') { data.project = formField1; data.assetCount = formField2; data.categories = formField3; data.notes = formNotes; }
    if (mode === 'proofs') { data.project = formField1; data.client = formField2; data.versions = formField3; data.feedback = formNotes; }

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

  const fieldLabels: Record<ModeTab, [string, string, string, string]> = {
    projects: ['Client', 'Type', 'Budget', 'Notes'],
    shoots: ['Project', 'Date', 'Location', 'Notes'],
    assets: ['Asset Type', 'Format', 'Resolution', 'Notes'],
    episodes: ['Series', 'Episode Number', 'Duration', 'Notes'],
    collections: ['Project', 'Asset Count', 'Categories', 'Notes'],
    proofs: ['Project', 'Client', 'Versions', 'Client Feedback'],
  };

  // Dashboard metrics
  const activeProjects = SEED.Project.filter(p => !['archived', 'delivered'].includes(p.meta.status as string)).length;
  const inReview = items.filter(i => i.meta?.status === 'review').length;
  const totalBudget = SEED.Project.reduce((s, p) => s + (p.data.budget as number), 0);
  const deliveredCount = items.filter(i => i.meta?.status === 'delivered').length;

  // Icon helper for asset types
  const assetIcon = (type: string) => {
    if (type === 'Video' || type === 'Film') return <Video className="w-4 h-4 text-neon-purple" />;
    if (type === 'Photo') return <Aperture className="w-4 h-4 text-neon-cyan" />;
    return <FileImage className="w-4 h-4 text-neon-blue" />;
  };

  return (
    <div className={ds.pageContainer}>
      {/* Header */}
      <header className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <Palette className="w-7 h-7 text-neon-purple" />
          <div>
            <h1 className={ds.heading1}>Creative Production</h1>
            <p className={ds.textMuted}>Projects, shoots, assets, episodes and client proofs</p>
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
          <div className="flex items-center gap-2 mb-1"><Palette className="w-4 h-4 text-neon-purple" /><span className={ds.textMuted}>Active Projects</span></div>
          <p className="text-2xl font-bold">{activeProjects}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Eye className="w-4 h-4 text-amber-400" /><span className={ds.textMuted}>In Review</span></div>
          <p className="text-2xl font-bold">{inReview}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-neon-cyan" /><span className={ds.textMuted}>Total Budget</span></div>
          <p className="text-2xl font-bold">${(totalBudget / 1000).toFixed(0)}k</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><FileCheck className="w-4 h-4 text-green-400" /><span className={ds.textMuted}>Delivered</span></div>
          <p className="text-2xl font-bold">{deliveredCount}</p>
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
          <Image className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className={ds.textMuted}>No {currentType.toLowerCase()}s found</p>
          <button onClick={openCreate} className={`${ds.btnGhost} mt-3`}><Plus className="w-4 h-4" /> Create one</button>
        </div>
      ) : (
        <div className={ds.grid3}>
          {filtered.map(item => {
            const status = item.meta?.status || 'brief';
            const color = STATUS_COLORS[status] || 'gray-400';
            const d = item.data as Record<string, unknown>;
            return (
              <div key={item.id} className={ds.panelHover} onClick={() => openEdit(item.id)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {currentType === 'Asset' && assetIcon(String(d.type || ''))}
                    <h3 className={ds.heading3 + ' truncate'}>{item.title}</h3>
                  </div>
                  <span className={ds.badge(color)}>{String(status).replace(/_/g, ' ')}</span>
                </div>
                <div className="space-y-1 mb-3">
                  {Object.entries(d).slice(0, 3).map(([k, v]) => (
                    <p key={k} className={ds.textMuted}><span className="text-gray-500">{k}:</span> {String(v)}</p>
                  ))}
                </div>
                {/* Approval indicator for proofs */}
                {currentType === 'ClientProof' && d.approved !== undefined && (
                  <div className={`flex items-center gap-1 text-xs mb-2 ${d.approved ? 'text-green-400' : 'text-amber-400'}`}>
                    {d.approved ? <FileCheck className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {d.approved ? 'Client Approved' : 'Awaiting Approval'}
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
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className={ds.label}>Title</label>
                  <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className={ds.input} placeholder={`${currentType} title`} />
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
                <div>
                  <label className={ds.label}>{fieldLabels[mode][3]}</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className={ds.textarea} rows={3} placeholder="Additional notes or feedback..." />
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

      {/* Pipeline overview */}
      <section>
        <h2 className={ds.heading2 + ' mb-3'}>Pipeline</h2>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {ALL_STATUSES.map(status => {
              const count = items.filter(i => i.meta?.status === status).length;
              return (
                <div key={status} className="flex-1 min-w-[100px] text-center p-3 rounded-lg bg-lattice-elevated/50">
                  <span className={ds.badge(STATUS_COLORS[status])}>{status.replace(/_/g, ' ')}</span>
                  <p className="text-2xl font-bold mt-2">{count}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
