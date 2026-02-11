'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import {
  Heart, FileText, HandHelping, Megaphone, BarChart3, Users,
  Plus, Search, Filter, X, Edit2, Trash2,
  DollarSign, TrendingUp, Target, Calendar,
  Globe, Award, Clock, CheckCircle,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ModeTab = 'donors' | 'grants' | 'volunteers' | 'campaigns' | 'impact' | 'members';
type ArtifactType = 'Donor' | 'Grant' | 'Volunteer' | 'Campaign' | 'ImpactMetric' | 'Member';

const GRANT_STATUSES = ['researching', 'applied', 'pending', 'awarded', 'active', 'reporting', 'closed', 'declined'] as const;
const CAMPAIGN_STATUSES = ['planning', 'active', 'completed', 'paused'] as const;
const GENERAL_STATUSES = ['active', 'inactive', 'pending', 'lapsed', 'prospect'] as const;

const STATUS_COLORS: Record<string, string> = {
  researching: 'gray-400', applied: 'neon-blue', pending: 'amber-400',
  awarded: 'neon-cyan', active: 'green-400', reporting: 'neon-purple',
  closed: 'gray-500', declined: 'red-400',
  planning: 'gray-400', completed: 'green-400', paused: 'amber-400',
  inactive: 'gray-500', lapsed: 'red-400', prospect: 'neon-blue',
};

const MODE_TABS: { id: ModeTab; label: string; icon: typeof Heart; type: ArtifactType }[] = [
  { id: 'donors', label: 'Donors', icon: Heart, type: 'Donor' },
  { id: 'grants', label: 'Grants', icon: FileText, type: 'Grant' },
  { id: 'volunteers', label: 'Volunteers', icon: HandHelping, type: 'Volunteer' },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone, type: 'Campaign' },
  { id: 'impact', label: 'Impact', icon: BarChart3, type: 'ImpactMetric' },
  { id: 'members', label: 'Members', icon: Users, type: 'Member' },
];

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const SEED: Record<ArtifactType, Array<{ title: string; data: Record<string, unknown>; meta: Record<string, unknown> }>> = {
  Donor: [
    { title: 'Eleanor Whitfield', data: { type: 'Individual', totalGiven: 125000, lastGift: '2026-01-15', frequency: 'Annual', level: 'Major', pledged: 50000 }, meta: { status: 'active', tags: ['major-donor', 'board-member'] } },
    { title: 'Greenfield Foundation', data: { type: 'Foundation', totalGiven: 500000, lastGift: '2025-12-01', frequency: 'Annual', level: 'Leadership', pledged: 250000 }, meta: { status: 'active', tags: ['foundation', 'multi-year'] } },
    { title: 'Marcus & Tina Okafor', data: { type: 'Individual', totalGiven: 8500, lastGift: '2026-02-01', frequency: 'Monthly', level: 'Sustaining', pledged: 0 }, meta: { status: 'active', tags: ['monthly'] } },
    { title: 'TechForward Inc', data: { type: 'Corporate', totalGiven: 75000, lastGift: '2025-06-15', frequency: 'One-time', level: 'Partner', pledged: 0 }, meta: { status: 'prospect', tags: ['corporate', 'renewal-due'] } },
  ],
  Grant: [
    { title: 'Ford Foundation - Community Resilience', data: { funder: 'Ford Foundation', amount: 350000, period: '2026-2028', program: 'Community Resilience', deadline: '2026-03-15', matchRequired: false }, meta: { status: 'awarded', tags: ['multi-year'] } },
    { title: 'NEA Arts Access Grant', data: { funder: 'National Endowment for the Arts', amount: 50000, period: '2026-2027', program: 'Arts Access', deadline: '2026-04-01', matchRequired: true }, meta: { status: 'applied', tags: ['arts'] } },
    { title: 'City of Portland Community Dev', data: { funder: 'City of Portland', amount: 120000, period: '2026', program: 'Youth Development', deadline: '2026-02-28', matchRequired: false }, meta: { status: 'pending', tags: ['government', 'youth'] } },
    { title: 'Kresge Foundation Climate', data: { funder: 'Kresge Foundation', amount: 200000, period: '2026-2027', program: 'Climate Justice', deadline: '2026-05-01', matchRequired: false }, meta: { status: 'researching', tags: ['climate'] } },
    { title: 'USDA Rural Development', data: { funder: 'USDA', amount: 85000, period: '2025-2026', program: 'Food Access', deadline: '', matchRequired: true }, meta: { status: 'reporting', tags: ['federal', 'food'] } },
  ],
  Volunteer: [
    { title: 'Sarah Martinez', data: { role: 'Event Coordinator', hoursThisYear: 120, skills: 'Event planning, Spanish fluency', availability: 'Weekends', startDate: '2024-05-01', email: 'sarah.m@email.com' }, meta: { status: 'active', tags: ['events', 'bilingual'] } },
    { title: 'David Kim', data: { role: 'Tutoring Lead', hoursThisYear: 85, skills: 'STEM tutoring, curriculum design', availability: 'Tues/Thurs evenings', startDate: '2025-01-15', email: 'david.k@email.com' }, meta: { status: 'active', tags: ['education'] } },
    { title: 'Aisha Johnson', data: { role: 'Social Media', hoursThisYear: 42, skills: 'Content creation, graphic design', availability: 'Remote / flexible', startDate: '2025-09-01', email: 'aisha.j@email.com' }, meta: { status: 'active', tags: ['marketing', 'remote'] } },
  ],
  Campaign: [
    { title: 'Spring Gala 2026', data: { type: 'Event', goal: 150000, raised: 98000, startDate: '2026-02-01', endDate: '2026-04-15', channel: 'In-person + Online', donors: 245 }, meta: { status: 'active', tags: ['annual', 'gala'] } },
    { title: 'Year-End Giving 2025', data: { type: 'Appeal', goal: 200000, raised: 218000, startDate: '2025-11-01', endDate: '2025-12-31', channel: 'Email + Direct Mail', donors: 892 }, meta: { status: 'completed', tags: ['annual', 'year-end'] } },
    { title: 'Community Garden Capital Campaign', data: { type: 'Capital', goal: 500000, raised: 175000, startDate: '2025-09-01', endDate: '2026-09-01', channel: 'Major Gifts + Grants', donors: 48 }, meta: { status: 'active', tags: ['capital', 'multi-year'] } },
    { title: 'GivingTuesday 2026', data: { type: 'Day-of-Giving', goal: 50000, raised: 0, startDate: '2026-12-01', endDate: '2026-12-01', channel: 'Social Media + Email', donors: 0 }, meta: { status: 'planning', tags: ['givingtuesday'] } },
  ],
  ImpactMetric: [
    { title: 'Youth Served', data: { category: 'People', value: 1250, unit: 'individuals', period: 'FY 2026 YTD', target: 2000, program: 'Youth Development' }, meta: { status: 'active', tags: ['youth'] } },
    { title: 'Meals Distributed', data: { category: 'Services', value: 45000, unit: 'meals', period: 'FY 2026 YTD', target: 80000, program: 'Food Access' }, meta: { status: 'active', tags: ['food'] } },
    { title: 'Volunteer Hours', data: { category: 'Engagement', value: 3200, unit: 'hours', period: 'FY 2026 YTD', target: 6000, program: 'All Programs' }, meta: { status: 'active', tags: [] } },
    { title: 'Community Events Held', data: { category: 'Events', value: 18, unit: 'events', period: 'FY 2026 YTD', target: 36, program: 'Community Engagement' }, meta: { status: 'active', tags: [] } },
    { title: 'Trees Planted', data: { category: 'Environment', value: 520, unit: 'trees', period: 'FY 2026 YTD', target: 1000, program: 'Climate Justice' }, meta: { status: 'active', tags: ['climate'] } },
  ],
  Member: [
    { title: 'Clara Reeves', data: { level: 'Sustaining', joinDate: '2022-03-15', renewalDate: '2026-03-15', annualDues: 250, committees: 'Governance, Programs', email: 'clara.r@email.com' }, meta: { status: 'active', tags: ['board-eligible'] } },
    { title: 'James Ogunyemi', data: { level: 'Community', joinDate: '2024-08-01', renewalDate: '2026-08-01', annualDues: 50, committees: 'None', email: 'james.o@email.com' }, meta: { status: 'active', tags: [] } },
    { title: 'Priya Sharma', data: { level: 'Leadership', joinDate: '2021-01-10', renewalDate: '2026-01-10', annualDues: 1000, committees: 'Finance, Fundraising', email: 'priya.s@email.com' }, meta: { status: 'lapsed', tags: ['renewal-overdue'] } },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function NonprofitLensPage() {
  useLensNav('nonprofit');

  const [mode, setMode] = useState<ModeTab>('donors');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState('active');
  const [formField1, setFormField1] = useState('');
  const [formField2, setFormField2] = useState('');
  const [formField3, setFormField3] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const currentType = MODE_TABS.find(t => t.id === mode)!.type;

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData('nonprofit', currentType, {
    seed: SEED[currentType],
  });

  const runAction = useRunArtifact('nonprofit');

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

  const statusOptions = mode === 'grants' ? GRANT_STATUSES
    : mode === 'campaigns' ? CAMPAIGN_STATUSES
    : GENERAL_STATUSES;

  const resetForm = () => { setFormTitle(''); setFormStatus('active'); setFormField1(''); setFormField2(''); setFormField3(''); setFormNotes(''); setEditing(null); setShowEditor(false); };
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
    setFormNotes(String(vals[4] ?? ''));
    setShowEditor(true);
  };

  const handleSave = async () => {
    const data: Record<string, unknown> = {};
    if (mode === 'donors') { data.type = formField1; data.totalGiven = formField2; data.frequency = formField3; data.notes = formNotes; }
    if (mode === 'grants') { data.funder = formField1; data.amount = formField2; data.program = formField3; data.notes = formNotes; }
    if (mode === 'volunteers') { data.role = formField1; data.hoursThisYear = formField2; data.skills = formField3; data.notes = formNotes; }
    if (mode === 'campaigns') { data.type = formField1; data.goal = formField2; data.channel = formField3; data.notes = formNotes; }
    if (mode === 'impact') { data.category = formField1; data.value = formField2; data.target = formField3; data.notes = formNotes; }
    if (mode === 'members') { data.level = formField1; data.annualDues = formField2; data.committees = formField3; data.notes = formNotes; }

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
    donors: ['Donor Type', 'Total Given ($)', 'Frequency', 'Notes'],
    grants: ['Funder', 'Amount ($)', 'Program Area', 'Notes'],
    volunteers: ['Role', 'Hours This Year', 'Skills', 'Notes'],
    campaigns: ['Campaign Type', 'Goal ($)', 'Channel', 'Notes'],
    impact: ['Category', 'Current Value', 'Target', 'Notes'],
    members: ['Membership Level', 'Annual Dues ($)', 'Committees', 'Notes'],
  };

  // Dashboard metrics
  const totalRaised = SEED.Campaign.reduce((s, c) => s + (c.data.raised as number), 0);
  const activeGrants = SEED.Grant.filter(g => ['awarded', 'active', 'reporting'].includes(g.meta.status as string)).length;
  const volunteerHours = SEED.Volunteer.reduce((s, v) => s + (v.data.hoursThisYear as number), 0);
  const activeDonors = SEED.Donor.filter(d => d.meta.status === 'active').length;


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
          <Heart className="w-7 h-7 text-neon-pink" />
          <div>
            <h1 className={ds.heading1}>Nonprofit &amp; Community</h1>
            <p className={ds.textMuted}>Donors, grants, volunteers, campaigns and impact tracking</p>
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
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-400" /><span className={ds.textMuted}>Total Raised</span></div>
          <p className="text-2xl font-bold">${(totalRaised / 1000).toFixed(0)}k</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Award className="w-4 h-4 text-neon-cyan" /><span className={ds.textMuted}>Active Grants</span></div>
          <p className="text-2xl font-bold">{activeGrants}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-neon-purple" /><span className={ds.textMuted}>Volunteer Hours</span></div>
          <p className="text-2xl font-bold">{volunteerHours.toLocaleString()}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Heart className="w-4 h-4 text-neon-pink" /><span className={ds.textMuted}>Active Donors</span></div>
          <p className="text-2xl font-bold">{activeDonors}</p>
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
          <Heart className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className={ds.textMuted}>No {currentType.toLowerCase()}s found</p>
          <button onClick={openCreate} className={`${ds.btnGhost} mt-3`}><Plus className="w-4 h-4" /> Create one</button>
        </div>
      ) : (
        <div className={ds.grid3}>
          {filtered.map(item => {
            const status = item.meta?.status || 'active';
            const color = STATUS_COLORS[status] || 'gray-400';
            const d = item.data as Record<string, unknown>;
            return (
              <div key={item.id} className={ds.panelHover} onClick={() => openEdit(item.id)}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className={ds.heading3 + ' truncate flex-1'}>{item.title}</h3>
                  <span className={ds.badge(color)}>{String(status).replace(/_/g, ' ')}</span>
                </div>
                <div className="space-y-1 mb-3">
                  {Object.entries(d).slice(0, 3).map(([k, v]) => (
                    <p key={k} className={ds.textMuted}><span className="text-gray-500">{k}:</span> {String(v)}</p>
                  ))}
                </div>
                {/* Campaign fundraising progress */}
                {currentType === 'Campaign' && d.goal !== undefined && Number(d.goal) > 0 && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Raised</span>
                      <span>${Number(d.raised).toLocaleString()} / ${Number(d.goal).toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-lattice-elevated rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${Math.min(100, (Number(d.raised) / Number(d.goal)) * 100)}%` }} />
                    </div>
                  </div>
                )}
                {/* Impact metric progress */}
                {currentType === 'ImpactMetric' && d.target !== undefined && Number(d.target) > 0 && (
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{Number(d.value).toLocaleString()} / {Number(d.target).toLocaleString()} {String(d.unit || '')}</span>
                    </div>
                    <div className="w-full h-2 bg-lattice-elevated rounded-full overflow-hidden">
                      <div className="h-full bg-neon-cyan rounded-full transition-all" style={{ width: `${Math.min(100, (Number(d.value) / Number(d.target)) * 100)}%` }} />
                    </div>
                  </div>
                )}
                {/* Donor giving level badge */}
                {currentType === 'Donor' && d.level && (
                  <div className="flex items-center gap-1 mb-2">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-amber-400">{String(d.level)} Donor</span>
                    {d.totalGiven && <span className={ds.textMuted + ' ml-auto'}>${Number(d.totalGiven).toLocaleString()}</span>}
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
                  <label className={ds.label}>Name / Title</label>
                  <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className={ds.input} placeholder={`${currentType} name`} />
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
                <div>
                  <label className={ds.label}>{fieldLabels[mode][3]}</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className={ds.textarea} rows={3} placeholder="Additional notes..." />
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

      {/* Grant pipeline + impact summary */}
      <div className={ds.grid2}>
        <section>
          <h2 className={ds.heading2 + ' mb-3'}>Grant Pipeline</h2>
          <div className={ds.panel}>
            <div className="divide-y divide-lattice-border">
              {SEED.Grant.map((g, i) => (
                <div key={i} className="flex items-center gap-3 py-3 px-2">
                  <span className={ds.badge(STATUS_COLORS[g.meta.status as string] || 'gray-400')}>{String(g.meta.status).replace(/_/g, ' ')}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{g.title}</p>
                    <p className={ds.textMuted}>{g.data.funder as string}</p>
                  </div>
                  <span className={ds.textMono + ' text-green-400'}>${((g.data.amount as number) / 1000).toFixed(0)}k</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section>
          <h2 className={ds.heading2 + ' mb-3'}>Impact Snapshot</h2>
          <div className={ds.panel}>
            <div className="divide-y divide-lattice-border">
              {SEED.ImpactMetric.map((m, i) => {
                const pct = Math.round((m.data.value as number) / (m.data.target as number) * 100);
                return (
                  <div key={i} className="py-3 px-2">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-200">{m.title}</span>
                      <span className={ds.textMuted}>{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-lattice-elevated rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 75 ? 'bg-green-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <p className={ds.textMuted + ' mt-1'}>{(m.data.value as number).toLocaleString()} / {(m.data.target as number).toLocaleString()} {m.data.unit as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
