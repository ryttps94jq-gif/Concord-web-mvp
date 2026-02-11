'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { ds } from '@/lib/design-system';
import {
  GraduationCap,
  Users,
  BookOpen,
  ClipboardList,
  BarChart2,
  FileText,
  Award,
  Plus,
  Search,
  X,
  Trash2,
  Calendar,
  Clock,
  CheckCircle,
  Star,
  Target,
  TrendingUp,
  Percent,
  User,
  Layers,
} from 'lucide-react';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ErrorState } from '@/components/common/EmptyState';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Students' | 'Courses' | 'Assignments' | 'Grades' | 'Plans' | 'Certifications';
type ArtifactType = 'Student' | 'Course' | 'Assignment' | 'Grade' | 'LessonPlan' | 'Certification';
type Status = 'enrolled' | 'active' | 'completed' | 'withdrawn' | 'graduated';

interface EducationArtifact {
  artifactType: ArtifactType;
  status: Status;
  description: string;
  instructor?: string;
  subject?: string;
  dueDate?: string;
  grade?: string;
  score?: number;
  semester?: string;
  credits?: number;
  notes?: string;
  [key: string]: unknown;
}

const MODE_TABS: { id: ModeTab; icon: React.ElementType; defaultType: ArtifactType }[] = [
  { id: 'Students', icon: Users, defaultType: 'Student' },
  { id: 'Courses', icon: BookOpen, defaultType: 'Course' },
  { id: 'Assignments', icon: ClipboardList, defaultType: 'Assignment' },
  { id: 'Grades', icon: BarChart2, defaultType: 'Grade' },
  { id: 'Plans', icon: FileText, defaultType: 'LessonPlan' },
  { id: 'Certifications', icon: Award, defaultType: 'Certification' },
];

const ALL_STATUSES: Status[] = ['enrolled', 'active', 'completed', 'withdrawn', 'graduated'];

const STATUS_COLORS: Record<Status, string> = {
  enrolled: 'neon-blue',
  active: 'neon-green',
  completed: 'neon-cyan',
  withdrawn: 'red-400',
  graduated: 'amber-400',
};

const SEED_ITEMS: { title: string; data: EducationArtifact }[] = [
  { title: 'Alex Johnson', data: { artifactType: 'Student', status: 'enrolled', description: 'Computer Science major, sophomore year', subject: 'Computer Science', semester: 'Fall 2025', credits: 15 } },
  { title: 'CS 301 - Data Structures', data: { artifactType: 'Course', status: 'active', description: 'Advanced data structures and algorithms', instructor: 'Prof. Williams', subject: 'Computer Science', semester: 'Fall 2025', credits: 4 } },
  { title: 'Midterm Project - Binary Trees', data: { artifactType: 'Assignment', status: 'active', description: 'Implement AVL tree with balancing, include unit tests', instructor: 'Prof. Williams', subject: 'CS 301', dueDate: '2025-10-15' } },
  { title: 'CS 301 Midterm Exam', data: { artifactType: 'Grade', status: 'completed', description: 'Midterm examination grade', grade: 'A-', score: 91, subject: 'CS 301', semester: 'Fall 2025' } },
  { title: 'Week 8: Graph Algorithms', data: { artifactType: 'LessonPlan', status: 'active', description: 'BFS, DFS, Dijkstra shortest path, spanning trees', instructor: 'Prof. Williams', subject: 'CS 301' } },
  { title: 'AWS Cloud Practitioner', data: { artifactType: 'Certification', status: 'completed', description: 'AWS foundational cloud certification', dueDate: '2025-12-01' } },
  { title: 'Maria Chen', data: { artifactType: 'Student', status: 'enrolled', description: 'Mathematics major, junior year', subject: 'Mathematics', semester: 'Fall 2025', credits: 16 } },
  { title: 'MATH 401 - Real Analysis', data: { artifactType: 'Course', status: 'active', description: 'Introduction to real analysis and measure theory', instructor: 'Prof. Nakamura', subject: 'Mathematics', semester: 'Fall 2025', credits: 3 } },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function EducationLensPage() {
  useLensNav('education');

  const [activeTab, setActiveTab] = useState<ModeTab>('Students');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<LensItem<EducationArtifact> | null>(null);

  // Editor form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<ArtifactType>('Student');
  const [formStatus, setFormStatus] = useState<Status>('enrolled');
  const [formDescription, setFormDescription] = useState('');
  const [formInstructor, setFormInstructor] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formGrade, setFormGrade] = useState('');
  const [formScore, setFormScore] = useState('');
  const [formSemester, setFormSemester] = useState('');
  const [formCredits, setFormCredits] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData<EducationArtifact>('education', 'artifact', {
    seed: SEED_ITEMS.map(s => ({ title: s.title, data: s.data as unknown as Record<string, unknown>, meta: { status: s.data.status, tags: [s.data.artifactType] } })),
  });

  const runAction = useRunArtifact('education');

  /* ---------- derived ---------- */

  const currentTabType = MODE_TABS.find(t => t.id === activeTab)?.defaultType ?? 'Student';

  const filtered = useMemo(() => {
    let list = items.filter(i => (i.data as unknown as EducationArtifact).artifactType === currentTabType);
    if (filterStatus !== 'all') list = list.filter(i => (i.data as unknown as EducationArtifact).status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || (i.data as unknown as EducationArtifact).description?.toLowerCase().includes(q));
    }
    return list;
  }, [items, currentTabType, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    const all = items;
    const grades = all.filter(i => (i.data as unknown as EducationArtifact).artifactType === 'Grade' && (i.data as unknown as EducationArtifact).score != null);
    const avgScore = grades.length > 0 ? grades.reduce((s, i) => s + ((i.data as unknown as EducationArtifact).score ?? 0), 0) / grades.length : 0;
    return {
      students: all.filter(i => (i.data as unknown as EducationArtifact).artifactType === 'Student').length,
      activeCourses: all.filter(i => (i.data as unknown as EducationArtifact).artifactType === 'Course' && (i.data as unknown as EducationArtifact).status === 'active').length,
      pendingAssignments: all.filter(i => (i.data as unknown as EducationArtifact).artifactType === 'Assignment' && (i.data as unknown as EducationArtifact).status === 'active').length,
      avgScore: Math.round(avgScore),
      certifications: all.filter(i => (i.data as unknown as EducationArtifact).artifactType === 'Certification' && (i.data as unknown as EducationArtifact).status === 'completed').length,
    };
  }, [items]);

  /* ---------- editor helpers ---------- */

  const openNewEditor = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormType(currentTabType);
    setFormStatus('enrolled');
    setFormDescription('');
    setFormInstructor('');
    setFormSubject('');
    setFormDueDate('');
    setFormGrade('');
    setFormScore('');
    setFormSemester('');
    setFormCredits('');
    setFormNotes('');
    setShowEditor(true);
  };

  const openEditEditor = (item: LensItem<EducationArtifact>) => {
    const d = item.data as unknown as EducationArtifact;
    setEditingItem(item);
    setFormTitle(item.title);
    setFormType(d.artifactType);
    setFormStatus(d.status);
    setFormDescription(d.description || '');
    setFormInstructor(d.instructor || '');
    setFormSubject(d.subject || '');
    setFormDueDate(d.dueDate || '');
    setFormGrade(d.grade || '');
    setFormScore(d.score != null ? String(d.score) : '');
    setFormSemester(d.semester || '');
    setFormCredits(d.credits != null ? String(d.credits) : '');
    setFormNotes(d.notes || '');
    setShowEditor(true);
  };

  const handleSave = async () => {
    const payload = {
      title: formTitle,
      data: {
        artifactType: formType, status: formStatus, description: formDescription,
        instructor: formInstructor, subject: formSubject, dueDate: formDueDate,
        grade: formGrade || undefined, score: formScore ? parseFloat(formScore) : undefined,
        semester: formSemester, credits: formCredits ? parseInt(formCredits) : undefined,
        notes: formNotes,
      } as unknown as Partial<EducationArtifact>,
      meta: { status: formStatus, tags: [formType] },
    };
    if (editingItem) await update(editingItem.id, payload);
    else await create(payload);
    setShowEditor(false);
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
          <GraduationCap className="w-7 h-7 text-neon-blue" />
          <div>
            <h1 className={ds.heading1}>Education</h1>
            <p className={ds.textMuted}>Student management, courses, assignments, and academic tracking</p>
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
            onClick={() => { setActiveTab(tab.id); setFilterStatus('all'); }}
            className={`${ds.btnGhost} whitespace-nowrap ${activeTab === tab.id ? 'bg-neon-blue/20 text-neon-blue' : ''}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.id}
          </button>
        ))}
      </nav>

      {/* Dashboard */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <Users className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{stats.students}</p>
          <p className={ds.textMuted}>Students</p>
        </div>
        <div className={ds.panel}>
          <BookOpen className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{stats.activeCourses}</p>
          <p className={ds.textMuted}>Active Courses</p>
        </div>
        <div className={ds.panel}>
          <ClipboardList className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-2xl font-bold">{stats.pendingAssignments}</p>
          <p className={ds.textMuted}>Pending Assignments</p>
        </div>
        <div className={ds.panel}>
          <TrendingUp className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{stats.avgScore > 0 ? `${stats.avgScore}%` : '--'}</p>
          <p className={ds.textMuted}>Avg Score</p>
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
            {runAction.isPending && <span className="text-xs text-neon-blue animate-pulse">Running...</span>}
          </div>
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

        {isLoading ? (
          <p className={`${ds.textMuted} text-center py-12`}>Loading records...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className={ds.textMuted}>No {activeTab.toLowerCase()} found. Create one to get started.</p>
          </div>
        ) : (
          <div className={ds.grid3}>
            {filtered.map(item => {
              const d = item.data as unknown as EducationArtifact;
              return (
                <div key={item.id} className={ds.panelHover} onClick={() => openEditEditor(item)}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`${ds.heading3} text-base truncate flex-1`}>{item.title}</h3>
                    <span className={ds.badge(STATUS_COLORS[d.status])}>{d.status}</span>
                  </div>
                  <p className={`${ds.textMuted} line-clamp-2 mb-3`}>{d.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    {d.instructor && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {d.instructor}</span>}
                    {d.subject && <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {d.subject}</span>}
                    {d.dueDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {d.dueDate}</span>}
                    {d.grade && <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {d.grade}</span>}
                    {d.score != null && <span className="flex items-center gap-1"><Percent className="w-3 h-3" /> {d.score}%</span>}
                    {d.credits != null && <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {d.credits} cr</span>}
                  </div>
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
                      <option value="Student">Student</option>
                      <option value="Course">Course</option>
                      <option value="Assignment">Assignment</option>
                      <option value="Grade">Grade</option>
                      <option value="LessonPlan">Lesson Plan</option>
                      <option value="Certification">Certification</option>
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
                    <label className={ds.label}>Instructor</label>
                    <input value={formInstructor} onChange={e => setFormInstructor(e.target.value)} className={ds.input} placeholder="Instructor name" />
                  </div>
                  <div>
                    <label className={ds.label}>Subject</label>
                    <input value={formSubject} onChange={e => setFormSubject(e.target.value)} className={ds.input} placeholder="Subject area" />
                  </div>
                </div>
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Semester</label>
                    <input value={formSemester} onChange={e => setFormSemester(e.target.value)} className={ds.input} placeholder="e.g. Fall 2025" />
                  </div>
                  <div>
                    <label className={ds.label}>Due Date</label>
                    <input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} className={ds.input} />
                  </div>
                </div>
                {(formType === 'Grade' || formType === 'Assignment') && (
                  <div className={ds.grid2}>
                    <div>
                      <label className={ds.label}>Grade</label>
                      <input value={formGrade} onChange={e => setFormGrade(e.target.value)} className={ds.input} placeholder="e.g. A, B+, Pass" />
                    </div>
                    <div>
                      <label className={ds.label}>Score (%)</label>
                      <input type="number" value={formScore} onChange={e => setFormScore(e.target.value)} className={ds.input} placeholder="0-100" min="0" max="100" />
                    </div>
                  </div>
                )}
                <div>
                  <label className={ds.label}>Credits</label>
                  <input type="number" value={formCredits} onChange={e => setFormCredits(e.target.value)} className={ds.input} placeholder="Credit hours" min="0" />
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
