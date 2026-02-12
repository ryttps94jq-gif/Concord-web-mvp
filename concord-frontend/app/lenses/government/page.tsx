'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import {
  Landmark,
  FileCheck,
  HardHat,
  ShieldAlert,
  Siren,
  Archive,
  Gavel,
  Plus,
  Search,
  Filter,
  X,
  Edit3,
  Trash2,
  Download,
  TrendingUp,
  BarChart3,
  ListChecks,
  Clock,
  AlertTriangle,
  ChevronDown,
  MapPin,
  CalendarDays,
  Users,
  FileText,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Permits' | 'Public Works' | 'Code Enforcement' | 'Emergency' | 'Records' | 'Court';

type ArtifactType = 'Permit' | 'Project' | 'Violation' | 'EmergencyPlan' | 'Record' | 'CourtCase';

type PermitStatus = 'submitted' | 'under_review' | 'approved' | 'denied' | 'expired' | 'revoked';
type ViolationStatus = 'observed' | 'noticed' | 'compliance_period' | 'resolved' | 'escalated' | 'hearing';
type EmergencyStatus = 'standby' | 'watch' | 'warning' | 'activated' | 'recovery' | 'deactivated';
type GeneralStatus = 'active' | 'pending' | 'closed' | 'archived';
type Status = PermitStatus | ViolationStatus | EmergencyStatus | GeneralStatus;

interface Permit { applicant: string; type: string; address: string; description: string; fee: number; submittedDate: string; }
interface Project { name: string; department: string; budget: number; startDate: string; endDate: string; contractor: string; location: string; }
interface Violation { address: string; code: string; description: string; inspector: string; observedDate: string; severity: string; }
interface EmergencyPlan { name: string; type: string; zone: string; coordinator: string; activationLevel: string; resources: string[]; }
interface RecordEntry { type: string; department: string; filedDate: string; retentionYears: number; description: string; public: boolean; }
interface CourtCase { caseNumber: string; plaintiff: string; defendant: string; judge: string; courtDate: string; type: string; }

type ArtifactData = Permit | Project | Violation | EmergencyPlan | RecordEntry | CourtCase;

const MODE_TABS: { id: ModeTab; icon: typeof Landmark; artifactType: ArtifactType }[] = [
  { id: 'Permits', icon: FileCheck, artifactType: 'Permit' },
  { id: 'Public Works', icon: HardHat, artifactType: 'Project' },
  { id: 'Code Enforcement', icon: ShieldAlert, artifactType: 'Violation' },
  { id: 'Emergency', icon: Siren, artifactType: 'EmergencyPlan' },
  { id: 'Records', icon: Archive, artifactType: 'Record' },
  { id: 'Court', icon: Gavel, artifactType: 'CourtCase' },
];

const STATUS_COLORS: Record<string, string> = {
  submitted: 'neon-blue',
  under_review: 'yellow-400',
  approved: 'green-400',
  denied: 'red-400',
  expired: 'gray-400',
  revoked: 'red-500',
  observed: 'yellow-400',
  noticed: 'orange-400',
  compliance_period: 'neon-cyan',
  resolved: 'green-400',
  escalated: 'red-400',
  hearing: 'neon-purple',
  standby: 'gray-400',
  watch: 'yellow-400',
  warning: 'orange-400',
  activated: 'red-400',
  recovery: 'neon-cyan',
  deactivated: 'green-400',
  active: 'green-400',
  pending: 'yellow-400',
  closed: 'gray-400',
  archived: 'gray-500',
};

const STATUSES_BY_TYPE: Record<ArtifactType, string[]> = {
  Permit: ['submitted', 'under_review', 'approved', 'denied', 'expired', 'revoked'],
  Project: ['active', 'pending', 'closed', 'archived'],
  Violation: ['observed', 'noticed', 'compliance_period', 'resolved', 'escalated', 'hearing'],
  EmergencyPlan: ['standby', 'watch', 'warning', 'activated', 'recovery', 'deactivated'],
  Record: ['active', 'pending', 'closed', 'archived'],
  CourtCase: ['active', 'pending', 'closed', 'archived'],
};

const SEED_DATA: Record<ArtifactType, { title: string; data: Record<string, unknown>; meta: Record<string, unknown> }[]> = {
  Permit: [
    { title: 'Building Permit - 142 Elm St', data: { applicant: 'Sarah Mitchell', type: 'Building', address: '142 Elm St', description: 'Two-story residential addition', fee: 1250, submittedDate: '2026-01-10' }, meta: { status: 'under_review', tags: ['residential'] } },
    { title: 'Electrical Permit - 300 Main Ave', data: { applicant: 'Mike Torres', type: 'Electrical', address: '300 Main Ave', description: 'Commercial panel upgrade 200A', fee: 450, submittedDate: '2026-01-15' }, meta: { status: 'approved', tags: ['commercial'] } },
    { title: 'Demolition Permit - 88 Oak Ln', data: { applicant: 'BuildRight LLC', type: 'Demolition', address: '88 Oak Ln', description: 'Tear-down of condemned structure', fee: 800, submittedDate: '2026-01-20' }, meta: { status: 'submitted', tags: ['demolition'] } },
  ],
  Project: [
    { title: 'Downtown Sidewalk Restoration', data: { name: 'Downtown Sidewalk Restoration', department: 'Public Works', budget: 450000, startDate: '2026-03-01', endDate: '2026-08-15', contractor: 'CivicBuild Inc', location: 'Main St corridor' }, meta: { status: 'active', tags: ['infrastructure'] } },
    { title: 'Water Main Replacement Phase 2', data: { name: 'Water Main Replacement Phase 2', department: 'Water Dept', budget: 1200000, startDate: '2026-04-01', endDate: '2026-12-01', contractor: 'AquaPipe Solutions', location: 'North District' }, meta: { status: 'pending', tags: ['water', 'utilities'] } },
  ],
  Violation: [
    { title: 'Overgrown Property - 55 Cedar Dr', data: { address: '55 Cedar Dr', code: 'MC-7.12', description: 'Vegetation exceeding 12 inches', inspector: 'Officer Daniels', observedDate: '2026-01-28', severity: 'minor' }, meta: { status: 'noticed', tags: ['property'] } },
    { title: 'Unpermitted Construction - 220 Pine Rd', data: { address: '220 Pine Rd', code: 'BC-3.04', description: 'Deck built without permit', inspector: 'Officer Chen', observedDate: '2026-01-22', severity: 'major' }, meta: { status: 'compliance_period', tags: ['building'] } },
  ],
  EmergencyPlan: [
    { title: 'Flood Response Plan', data: { name: 'Flood Response Plan', type: 'Natural Disaster', zone: 'Zone A - Riverside', coordinator: 'Chief Martinez', activationLevel: 'Level 3', resources: ['Sandbags', 'Pumps', 'Shelters', 'National Guard'] }, meta: { status: 'standby', tags: ['flood', 'natural'] } },
    { title: 'Severe Weather Protocol', data: { name: 'Severe Weather Protocol', type: 'Weather', zone: 'Countywide', coordinator: 'Dir. Thompson', activationLevel: 'Level 2', resources: ['Warning sirens', 'Shelters', 'First Responders'] }, meta: { status: 'watch', tags: ['weather'] } },
  ],
  Record: [
    { title: 'Council Meeting Minutes - Jan 2026', data: { type: 'Minutes', department: 'City Council', filedDate: '2026-01-31', retentionYears: 10, description: 'Regular session minutes including budget amendment vote', public: true }, meta: { status: 'active', tags: ['council'] } },
  ],
  CourtCase: [
    { title: 'City v. Greenfield Developers', data: { caseNumber: '2026-CV-0412', plaintiff: 'City of Meridian', defendant: 'Greenfield Developers LLC', judge: 'Hon. Patricia Wells', courtDate: '2026-03-15', type: 'Zoning Violation' }, meta: { status: 'active', tags: ['zoning'] } },
  ],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GovernmentLensPage() {
  useLensNav('government');

  const [mode, setMode] = useState<ModeTab>('Permits');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<'library' | 'dashboard'>('library');

  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState<string>('submitted');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const currentType = MODE_TABS.find(t => t.id === mode)!.artifactType;
  const availableStatuses = STATUSES_BY_TYPE[currentType];

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData<ArtifactData>('government', currentType, {
    seed: SEED_DATA[currentType] || [],
  });

  const runAction = useRunArtifact('government');
  const editingItem = items.find(i => i.id === editingId) || null;

  /* ---- filtering ---- */
  const filtered = useMemo(() => {
    let list = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      list = list.filter(i => i.meta.status === statusFilter);
    }
    return list;
  }, [items, searchQuery, statusFilter]);

  /* ---- editor helpers ---- */
  const openNew = () => { setEditingId(null); setFormTitle(''); setFormStatus(availableStatuses[0]); setFormData({}); setShowEditor(true); };
  const openEdit = (item: LensItem<ArtifactData>) => { setEditingId(item.id); setFormTitle(item.title); setFormStatus(item.meta.status || availableStatuses[0]); setFormData(item.data as unknown as Record<string, unknown>); setShowEditor(true); };
  const handleSave = async () => { const payload = { title: formTitle, data: formData, meta: { status: formStatus } }; if (editingId) { await update(editingId, payload); } else { await create(payload); } setShowEditor(false); };
  const handleDelete = async (id: string) => { await remove(id); };

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

  /* ---- stats ---- */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    availableStatuses.forEach(s => { counts[s] = 0; });
    items.forEach(i => { const s = i.meta.status; if (counts[s] !== undefined) counts[s]++; });
    return counts;
  }, [items, availableStatuses]);

  /* ---- status badge ---- */
  const renderStatusBadge = (status: string) => {
    const color = STATUS_COLORS[status] || 'gray-400';
    return <span className={ds.badge(color)}>{status.replace(/_/g, ' ')}</span>;
  };

  /* ---- form fields ---- */
  const renderFormFields = () => {
    switch (currentType) {
      case 'Permit':
        return (
          <>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Applicant</label><input className={ds.input} value={(formData.applicant as string) || ''} onChange={e => setFormData({ ...formData, applicant: e.target.value })} /></div>
              <div><label className={ds.label}>Permit Type</label><select className={ds.select} value={(formData.type as string) || ''} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="">Select...</option><option value="Building">Building</option><option value="Electrical">Electrical</option><option value="Plumbing">Plumbing</option><option value="Demolition">Demolition</option><option value="Grading">Grading</option><option value="Sign">Sign</option></select></div>
            </div>
            <div><label className={ds.label}>Address</label><input className={ds.input} value={(formData.address as string) || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
            <div><label className={ds.label}>Description</label><textarea className={ds.textarea} rows={3} value={(formData.description as string) || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Fee ($)</label><input type="number" className={ds.input} value={(formData.fee as number) || ''} onChange={e => setFormData({ ...formData, fee: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Submitted Date</label><input type="date" className={ds.input} value={(formData.submittedDate as string) || ''} onChange={e => setFormData({ ...formData, submittedDate: e.target.value })} /></div>
            </div>
          </>
        );
      case 'Project':
        return (
          <>
            <div><label className={ds.label}>Project Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Department</label><input className={ds.input} value={(formData.department as string) || ''} onChange={e => setFormData({ ...formData, department: e.target.value })} /></div>
              <div><label className={ds.label}>Contractor</label><input className={ds.input} value={(formData.contractor as string) || ''} onChange={e => setFormData({ ...formData, contractor: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Location</label><input className={ds.input} value={(formData.location as string) || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Start Date</label><input type="date" className={ds.input} value={(formData.startDate as string) || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} /></div>
              <div><label className={ds.label}>End Date</label><input type="date" className={ds.input} value={(formData.endDate as string) || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Budget ($)</label><input type="number" className={ds.input} value={(formData.budget as number) || ''} onChange={e => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })} /></div>
          </>
        );
      case 'Violation':
        return (
          <>
            <div><label className={ds.label}>Address</label><input className={ds.input} value={(formData.address as string) || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Code Section</label><input className={ds.input} value={(formData.code as string) || ''} onChange={e => setFormData({ ...formData, code: e.target.value })} /></div>
              <div><label className={ds.label}>Severity</label><select className={ds.select} value={(formData.severity as string) || ''} onChange={e => setFormData({ ...formData, severity: e.target.value })}><option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option></select></div>
            </div>
            <div><label className={ds.label}>Description</label><textarea className={ds.textarea} rows={3} value={(formData.description as string) || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Inspector</label><input className={ds.input} value={(formData.inspector as string) || ''} onChange={e => setFormData({ ...formData, inspector: e.target.value })} /></div>
              <div><label className={ds.label}>Observed Date</label><input type="date" className={ds.input} value={(formData.observedDate as string) || ''} onChange={e => setFormData({ ...formData, observedDate: e.target.value })} /></div>
            </div>
          </>
        );
      case 'EmergencyPlan':
        return (
          <>
            <div><label className={ds.label}>Plan Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Emergency Type</label><select className={ds.select} value={(formData.type as string) || ''} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="">Select...</option><option value="Natural Disaster">Natural Disaster</option><option value="Weather">Weather</option><option value="Fire">Fire</option><option value="Hazmat">Hazmat</option><option value="Civil">Civil</option></select></div>
              <div><label className={ds.label}>Zone</label><input className={ds.input} value={(formData.zone as string) || ''} onChange={e => setFormData({ ...formData, zone: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Coordinator</label><input className={ds.input} value={(formData.coordinator as string) || ''} onChange={e => setFormData({ ...formData, coordinator: e.target.value })} /></div>
              <div><label className={ds.label}>Activation Level</label><select className={ds.select} value={(formData.activationLevel as string) || ''} onChange={e => setFormData({ ...formData, activationLevel: e.target.value })}><option value="Level 1">Level 1</option><option value="Level 2">Level 2</option><option value="Level 3">Level 3</option></select></div>
            </div>
            <div><label className={ds.label}>Resources (comma-separated)</label><textarea className={ds.textarea} rows={3} value={((formData.resources as string[]) || []).join(', ')} onChange={e => setFormData({ ...formData, resources: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
          </>
        );
      case 'Record':
        return (
          <>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Record Type</label><select className={ds.select} value={(formData.type as string) || ''} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="">Select...</option><option value="Minutes">Minutes</option><option value="Ordinance">Ordinance</option><option value="Resolution">Resolution</option><option value="Contract">Contract</option><option value="Correspondence">Correspondence</option></select></div>
              <div><label className={ds.label}>Department</label><input className={ds.input} value={(formData.department as string) || ''} onChange={e => setFormData({ ...formData, department: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Description</label><textarea className={ds.textarea} rows={3} value={(formData.description as string) || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Filed Date</label><input type="date" className={ds.input} value={(formData.filedDate as string) || ''} onChange={e => setFormData({ ...formData, filedDate: e.target.value })} /></div>
              <div><label className={ds.label}>Retention (years)</label><input type="number" className={ds.input} value={(formData.retentionYears as number) || ''} onChange={e => setFormData({ ...formData, retentionYears: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="publicRecord" checked={(formData.public as boolean) || false} onChange={e => setFormData({ ...formData, public: e.target.checked })} className="rounded" />
              <label htmlFor="publicRecord" className={ds.label + ' mb-0'}>Public Record</label>
            </div>
          </>
        );
      case 'CourtCase':
        return (
          <>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Case Number</label><input className={ds.input} value={(formData.caseNumber as string) || ''} onChange={e => setFormData({ ...formData, caseNumber: e.target.value })} /></div>
              <div><label className={ds.label}>Case Type</label><select className={ds.select} value={(formData.type as string) || ''} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="">Select...</option><option value="Zoning Violation">Zoning Violation</option><option value="Code Enforcement">Code Enforcement</option><option value="Civil">Civil</option><option value="Tax Appeal">Tax Appeal</option></select></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Plaintiff</label><input className={ds.input} value={(formData.plaintiff as string) || ''} onChange={e => setFormData({ ...formData, plaintiff: e.target.value })} /></div>
              <div><label className={ds.label}>Defendant</label><input className={ds.input} value={(formData.defendant as string) || ''} onChange={e => setFormData({ ...formData, defendant: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Judge</label><input className={ds.input} value={(formData.judge as string) || ''} onChange={e => setFormData({ ...formData, judge: e.target.value })} /></div>
              <div><label className={ds.label}>Court Date</label><input type="date" className={ds.input} value={(formData.courtDate as string) || ''} onChange={e => setFormData({ ...formData, courtDate: e.target.value })} /></div>
            </div>
          </>
        );
      default: return null;
    }
  };

  /* ---- artifact card ---- */
  const renderCard = (item: LensItem<ArtifactData>) => {
    const d = item.data as unknown as Record<string, unknown>;
    return (
      <div key={item.id} className={ds.panelHover}>
        <div className={ds.sectionHeader}>
          <h3 className={ds.heading3}>{item.title}</h3>
          {renderStatusBadge(item.meta.status)}
        </div>
        <div className="mt-2 space-y-1">
          {currentType === 'Permit' && <><p className={ds.textMuted}><MapPin className="w-3 h-3 inline mr-1" />{d.address as string}</p><p className={ds.textMuted}>Applicant: {d.applicant as string}</p><p className={`${ds.textMono} text-gray-500`}>Fee: ${d.fee as number}</p></>}
          {currentType === 'Project' && <><p className={ds.textMuted}>{d.department as string} - {d.location as string}</p><p className={ds.textMuted}>Contractor: {d.contractor as string}</p><p className={`${ds.textMono} text-gray-500`}>Budget: ${((d.budget as number) || 0).toLocaleString()}</p></>}
          {currentType === 'Violation' && <><p className={ds.textMuted}><MapPin className="w-3 h-3 inline mr-1" />{d.address as string}</p><p className={ds.textMuted}>Code: {d.code as string} | Severity: {d.severity as string}</p><p className={ds.textMuted}>Inspector: {d.inspector as string}</p></>}
          {currentType === 'EmergencyPlan' && <><p className={ds.textMuted}>Type: {d.type as string}</p><p className={ds.textMuted}>Zone: {d.zone as string}</p><p className={ds.textMuted}>Coordinator: {d.coordinator as string}</p><p className={`${ds.textMono} text-gray-500`}>{((d.resources as string[]) || []).length} resources assigned</p></>}
          {currentType === 'Record' && <><p className={ds.textMuted}>{d.type as string} - {d.department as string}</p><p className={ds.textMuted}>Filed: {d.filedDate as string}</p><p className={ds.textMuted}>{d.public ? 'Public' : 'Non-public'} | Retention: {d.retentionYears as number}yr</p></>}
          {currentType === 'CourtCase' && <><p className={`${ds.textMono} text-gray-500`}>{d.caseNumber as string}</p><p className={ds.textMuted}>{d.plaintiff as string} v. {d.defendant as string}</p><p className={ds.textMuted}>Judge: {d.judge as string} | {d.courtDate as string}</p></>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button className={`${ds.btnGhost} ${ds.btnSmall}`} onClick={() => openEdit(item)}><Edit3 className="w-3.5 h-3.5" /> Edit</button>
          <button className={`${ds.btnDanger} ${ds.btnSmall}`} onClick={() => handleDelete(item.id)}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
        </div>
      </div>
    );
  };

  /* ---- dashboard ---- */
  const renderDashboard = () => {
    const totalBudget = items.reduce((sum, i) => { const d = i.data as unknown as Record<string, unknown>; return sum + ((d.budget as number) || (d.fee as number) || 0); }, 0);
    return (
      <div className="space-y-6">
        <div className={ds.grid4}>
          <div className={ds.panel}><div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-green-400" /><span className={ds.textMuted}>Total Items</span></div><p className={ds.heading2}>{items.length}</p></div>
          <div className={ds.panel}><div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-yellow-400" /><span className={ds.textMuted}>Pending Review</span></div><p className={ds.heading2}>{statusCounts['under_review'] || statusCounts['pending'] || 0}</p></div>
          <div className={ds.panel}><div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-red-400" /><span className={ds.textMuted}>Urgent</span></div><p className={ds.heading2}>{(statusCounts['escalated'] || 0) + (statusCounts['activated'] || 0) + (statusCounts['denied'] || 0)}</p></div>
          <div className={ds.panel}><div className="flex items-center gap-2 mb-2"><FileText className="w-4 h-4 text-neon-cyan" /><span className={ds.textMuted}>Budget/Fees</span></div><p className={ds.heading2}>${totalBudget.toLocaleString()}</p></div>
        </div>

        <div className={ds.panel}>
          <h3 className={`${ds.heading3} mb-4`}>Status Breakdown - {mode}</h3>
          <div className={ds.grid3}>
            {availableStatuses.map(s => (
              <div key={s} className="flex items-center justify-between p-3 rounded-lg bg-lattice-elevated/30">
                <span className="text-sm text-gray-300">{s.replace(/_/g, ' ')}</span>
                <span className={ds.badge(STATUS_COLORS[s] || 'gray-400')}>{statusCounts[s] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={ds.panel}>
          <div className={ds.sectionHeader}><h3 className={ds.heading3}>Department Overview</h3><BarChart3 className="w-5 h-5 text-gray-400" /></div>
          <div className={`${ds.grid3} mt-4`}>
            <div className="text-center p-3 rounded-lg bg-lattice-elevated/30"><FileCheck className="w-6 h-6 text-neon-blue mx-auto mb-1" /><p className={ds.heading3}>{SEED_DATA.Permit.length}</p><p className={ds.textMuted}>Active Permits</p></div>
            <div className="text-center p-3 rounded-lg bg-lattice-elevated/30"><HardHat className="w-6 h-6 text-yellow-400 mx-auto mb-1" /><p className={ds.heading3}>{SEED_DATA.Project.length}</p><p className={ds.textMuted}>Public Works</p></div>
            <div className="text-center p-3 rounded-lg bg-lattice-elevated/30"><Siren className="w-6 h-6 text-red-400 mx-auto mb-1" /><p className={ds.heading3}>{SEED_DATA.EmergencyPlan.length}</p><p className={ds.textMuted}>Emergency Plans</p></div>
          </div>
        </div>

        <div className={ds.panel}>
          <h3 className={`${ds.heading3} mb-3`}>Recent Activity</h3>
          {items.length === 0 ? <p className={ds.textMuted}>No recent activity.</p> : (
            <div className="space-y-2">
              {items.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-lattice-elevated/20">
                  <div><p className="text-sm font-medium text-white">{item.title}</p><p className={ds.textMuted}>{currentType} - {new Date(item.createdAt).toLocaleDateString()}</p></div>
                  {renderStatusBadge(item.meta.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ================================================================ */
  /*  Main render                                                      */
  /* ================================================================ */


  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className={ds.pageContainer}>
      <header className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <Landmark className="w-7 h-7 text-neon-cyan" />
          <div><h1 className={ds.heading1}>Government &amp; Public Service</h1><p className={ds.textMuted}>Permits, public works, code enforcement &amp; emergency management</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button className={view === 'library' ? ds.btnPrimary : ds.btnSecondary} onClick={() => setView('library')}><ListChecks className="w-4 h-4" /> Library</button>
          <button className={view === 'dashboard' ? ds.btnPrimary : ds.btnSecondary} onClick={() => setView('dashboard')}><BarChart3 className="w-4 h-4" /> Dashboard</button>
          <button className={ds.btnGhost}><Download className="w-4 h-4" /></button>
        </div>
      </header>

      <nav className="flex items-center gap-2 border-b border-lattice-border pb-4 overflow-x-auto">
        {MODE_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => { setMode(tab.id); setStatusFilter('all'); setSearchQuery(''); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${mode === tab.id ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'}`}>
              <Icon className="w-4 h-4" />{tab.id}
            </button>
          );
        })}
      </nav>

      {view === 'dashboard' ? renderDashboard() : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className={`${ds.input} pl-10`} placeholder={`Search ${mode.toLowerCase()}...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-gray-400" />
              <select className={ds.select + ' w-auto'} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                {availableStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 -ml-8 pointer-events-none" />
            </div>
            <button className={ds.btnPrimary} onClick={openNew}><Plus className="w-4 h-4" /> New {currentType}</button>
            {runAction.isPending && <span className="text-xs text-neon-blue animate-pulse">Running...</span>}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-neon-cyan" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Landmark className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className={ds.heading3}>No {currentType}s found</p>
              <p className={ds.textMuted}>Create one to get started.</p>
              <button className={`${ds.btnPrimary} mt-4`} onClick={openNew}><Plus className="w-4 h-4" /> Add {currentType}</button>
            </div>
          ) : (
            <div className={ds.grid3}>{filtered.map(renderCard)}</div>
          )}
        </>
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

      {showEditor && (
        <div className={ds.modalBackdrop} onClick={() => setShowEditor(false)}>
          <div className={ds.modalContainer}>
            <div className={`${ds.modalPanel} max-w-xl`} onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-lattice-border">
                <div className={ds.sectionHeader}>
                  <h2 className={ds.heading2}>{editingId ? 'Edit' : 'New'} {currentType}</h2>
                  <button className={ds.btnGhost} onClick={() => setShowEditor(false)}><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div><label className={ds.label}>Title</label><input className={ds.input} value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Artifact title..." /></div>
                <div><label className={ds.label}>Status</label><select className={ds.select} value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                  {availableStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select></div>
                {renderFormFields()}
              </div>
              <div className="p-6 border-t border-lattice-border flex items-center justify-end gap-3">
                <button className={ds.btnSecondary} onClick={() => setShowEditor(false)}>Cancel</button>
                <button className={ds.btnPrimary} onClick={handleSave} disabled={!formTitle.trim()}>{editingId ? 'Update' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
