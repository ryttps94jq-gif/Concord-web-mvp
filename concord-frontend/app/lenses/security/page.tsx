'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import { useState } from 'react';
import {
  Shield, Plus, Search, AlertTriangle, Route,
  Target, FileSearch, Cpu, MapPin, Clock, Users,
  X
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

type ModeTab = 'posts' | 'incidents' | 'patrols' | 'threats' | 'investigations' | 'assets';

const MODE_TABS: { key: ModeTab; label: string; icon: typeof Shield; type: string }[] = [
  { key: 'posts', label: 'Posts', icon: MapPin, type: 'Post' },
  { key: 'incidents', label: 'Incidents', icon: AlertTriangle, type: 'Incident' },
  { key: 'patrols', label: 'Patrols', icon: Route, type: 'Patrol' },
  { key: 'threats', label: 'Threats', icon: Target, type: 'Threat' },
  { key: 'investigations', label: 'Investigations', icon: FileSearch, type: 'Investigation' },
  { key: 'assets', label: 'Assets', icon: Cpu, type: 'Asset' },
];

const INCIDENT_STATUSES = ['reported', 'responding', 'investigating', 'resolved', 'closed'];
const INVESTIGATION_STATUSES = ['open', 'active', 'pending_review', 'closed_substantiated', 'closed_unsubstantiated'];
const THREAT_STATUSES = ['identified', 'monitoring', 'mitigated', 'escalated', 'resolved'];
const GENERAL_STATUSES = ['active', 'inactive', 'maintenance'];

function getStatusesForMode(mode: ModeTab): string[] {
  switch (mode) {
    case 'incidents': return INCIDENT_STATUSES;
    case 'investigations': return INVESTIGATION_STATUSES;
    case 'threats': return THREAT_STATUSES;
    default: return GENERAL_STATUSES;
  }
}

const STATUS_COLORS: Record<string, string> = {
  reported: 'text-yellow-400', responding: 'text-orange-400', investigating: 'text-blue-400',
  resolved: 'text-green-400', closed: 'text-gray-400', open: 'text-blue-400',
  active: 'text-green-400', pending_review: 'text-yellow-400',
  closed_substantiated: 'text-red-400', closed_unsubstantiated: 'text-gray-400',
  identified: 'text-yellow-400', monitoring: 'text-blue-400', mitigated: 'text-green-400',
  escalated: 'text-red-400', inactive: 'text-gray-400', maintenance: 'text-orange-400',
};

export default function SecurityLensPage() {
  useLensNav('security');

  const [activeMode, setActiveMode] = useState<ModeTab>('incidents');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const activeTab = MODE_TABS.find(t => t.key === activeMode)!;

  const { isError: isError, error: error, refetch: refetch, items, create, update, remove } = useLensData('security', activeTab.type, {
    search: searchQuery || undefined,
    status: statusFilter || undefined,
  });
  const runAction = useRunArtifact('security');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formType, setFormType] = useState('');
  const [formSeverity, setFormSeverity] = useState('medium');
  const [formDescription, setFormDescription] = useState('');
  const [formAssignee, setFormAssignee] = useState('');
  const [formStatus, setFormStatus] = useState('');

  const resetForm = () => {
    setFormTitle(''); setFormLocation(''); setFormType(''); setFormSeverity('medium');
    setFormDescription(''); setFormAssignee(''); setFormStatus('');
    setEditingId(null); setShowEditor(false);
  };

  const handleCreate = async () => {
    const statuses = getStatusesForMode(activeMode);
    await create({
      title: formTitle || `New ${activeTab.type}`,
      data: {
        location: formLocation, type: formType, severity: formSeverity,
        description: formDescription, assignee: formAssignee,
      },
      meta: { status: formStatus || statuses[0], tags: [] },
    });
    resetForm();
  };

  const handleEdit = (item: typeof items[0]) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    const d = item.data as Record<string, unknown>;
    setFormLocation((d.location as string) || '');
    setFormType((d.type as string) || '');
    setFormSeverity((d.severity as string) || 'medium');
    setFormDescription((d.description as string) || '');
    setFormAssignee((d.assignee as string) || '');
    setFormStatus(item.meta?.status || '');
    setShowEditor(true);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    await update(editingId, {
      title: formTitle,
      data: {
        location: formLocation, type: formType, severity: formSeverity,
        description: formDescription, assignee: formAssignee,
      },
      meta: { status: formStatus },
    });
    resetForm();
  };

  const _handleAction = async (action: string, artifactId?: string) => {
    const targetId = artifactId || editingId || items[0]?.id;
    if (!targetId) return;
    try {
      const result = await runAction.mutateAsync({ id: targetId, action });
      setActionResult(result.result as Record<string, unknown>);
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  // Dashboard metrics
  const totalItems = items.length;
  const activeItems = items.filter(i => ['active', 'responding', 'investigating', 'open', 'monitoring', 'identified'].includes(i.meta?.status)).length;
  const criticalItems = items.filter(i => (i.data as Record<string, unknown>)?.severity === 'critical').length;
  const resolvedItems = items.filter(i => ['resolved', 'closed', 'mitigated', 'closed_substantiated', 'closed_unsubstantiated'].includes(i.meta?.status)).length;

  const statuses = getStatusesForMode(activeMode);


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
          <Shield className="w-8 h-8 text-red-400" />
          <div>
            <h1 className={ds.heading1}>Security</h1>
            <p className={ds.textMuted}>Physical security, cybersecurity ops, investigations, loss prevention</p>
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
                  ? 'border-red-400 text-red-400'
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
          <div className={ds.textMuted}>Total</div>
          <div className="text-2xl font-bold text-white mt-1">{totalItems}</div>
        </div>
        <div className={ds.panel}>
          <div className={ds.textMuted}>Active</div>
          <div className="text-2xl font-bold text-green-400 mt-1">{activeItems}</div>
        </div>
        <div className={ds.panel}>
          <div className={ds.textMuted}>Critical</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{criticalItems}</div>
        </div>
        <div className={ds.panel}>
          <div className={ds.textMuted}>Resolved</div>
          <div className="text-2xl font-bold text-gray-400 mt-1">{resolvedItems}</div>
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
          {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Artifact List */}
      <div className={ds.grid3}>
        {items.length === 0 ? (
          <p className="col-span-full text-center py-12 text-gray-500">
            No {activeTab.label.toLowerCase()} found. Create your first {activeTab.type.toLowerCase()}.
          </p>
        ) : (
          items.map(item => {
            const d = item.data as Record<string, unknown>;
            const severity = (d.severity as string) || 'medium';
            const severityColor = severity === 'critical' ? 'text-red-400' : severity === 'high' ? 'text-orange-400' : severity === 'medium' ? 'text-yellow-400' : 'text-green-400';
            return (
              <div key={item.id} className={ds.panelHover} onClick={() => handleEdit(item)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <activeTab.icon className="w-5 h-5 text-red-400" />
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[item.meta?.status] || 'text-gray-400'} bg-current/10`}>
                      {(item.meta?.status || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className={`text-xs ${severityColor}`}>{severity}</span>
                </div>
                <h3 className="font-semibold text-white mb-1 line-clamp-1">{item.title}</h3>
                {!!d.location && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-1">
                    <MapPin className="w-3 h-3" /> {d.location as string}
                  </p>
                )}
                {!!d.description && (
                  <p className="text-sm text-gray-400 line-clamp-2 mb-2">{d.description as string}</p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  {!!d.assignee && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{String(d.assignee)}</span>}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(item.updatedAt).toLocaleDateString()}</span>
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
                      <label className={ds.label}>Location</label>
                      <input className={ds.input} value={formLocation} onChange={e => setFormLocation(e.target.value)} placeholder="Location..." />
                    </div>
                    <div>
                      <label className={ds.label}>Type</label>
                      <input className={ds.input} value={formType} onChange={e => setFormType(e.target.value)} placeholder="Type..." />
                    </div>
                  </div>
                  <div className={ds.grid2}>
                    <div>
                      <label className={ds.label}>Severity</label>
                      <select className={ds.select} value={formSeverity} onChange={e => setFormSeverity(e.target.value)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label className={ds.label}>Status</label>
                      <select className={ds.select} value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                        {statuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={ds.label}>Assignee</label>
                    <input className={ds.input} value={formAssignee} onChange={e => setFormAssignee(e.target.value)} placeholder="Assigned to..." />
                  </div>
                  <div>
                    <label className={ds.label}>Description</label>
                    <textarea className={`${ds.textarea} h-24`} value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Description..." />
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
