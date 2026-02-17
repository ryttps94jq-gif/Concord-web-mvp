'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
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
  X,
  Trash2,
  AlertTriangle,
  Activity,
  ClipboardList,
  Calendar,
  ShieldCheck,
  FileText,
  Clock,
  CheckCircle,
  Zap,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Thermometer,
  Droplets,
  Wind,
  Weight,
  Minus,
  BarChart3,
  Target,
  RefreshCw,
  Download,
  Timer,
  AlertCircle,
  List,
  LayoutGrid,
  BadgeCheck,
  Syringe,
  Beaker,
  Clipboard,
  CalendarCheck,
  CalendarClock,
  ArrowUpRight,
  ArrowDownRight,
  ListChecks,
  CheckCircle2,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Patients' | 'Encounters' | 'Protocols' | 'Pharmacy' | 'Lab' | 'Therapy';
type ArtifactType = 'Patient' | 'Encounter' | 'CareProtocol' | 'Prescription' | 'LabResult' | 'Treatment';
type Status = 'scheduled' | 'active' | 'completed' | 'cancelled' | 'archived';
type DetailSubTab = 'Overview' | 'Vitals' | 'Medications' | 'Labs' | 'History';
type PatientViewMode = 'cards' | 'timeline';

interface HealthcareArtifact {
  artifactType: ArtifactType;
  status: Status;
  description: string;
  provider?: string;
  date?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  patientId?: string;
  /* Vital Signs */
  heartRate?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  temperature?: number;
  respiratoryRate?: number;
  o2Sat?: number;
  weight?: number;
  height?: number;
  /* SOAP Note */
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;
  visitStart?: string;
  visitEnd?: string;
  chiefComplaint?: string;
  /* Medication */
  dosage?: string;
  frequency?: string;
  route?: string;
  startDate?: string;
  endDate?: string;
  isPRN?: boolean;
  refillsRemaining?: number;
  daysSupply?: number;
  adherencePercent?: number;
  interactions?: string[];
  /* Lab */
  testPanel?: string;
  resultValue?: string;
  referenceRange?: string;
  unit?: string;
  isCritical?: boolean;
  previousValue?: string;
  /* Care Plan */
  goals?: { name: string; target: string; current: string; percent: number }[];
  milestones?: { name: string; dueDate: string; completed: boolean }[];
  interventions?: string[];
  outcomeMeasure?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

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

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

const COMMON_COMPLAINTS = [
  'Chest pain', 'Shortness of breath', 'Headache', 'Abdominal pain',
  'Fever', 'Cough', 'Back pain', 'Dizziness', 'Fatigue', 'Nausea',
  'Joint pain', 'Rash', 'Sore throat', 'Anxiety', 'Insomnia',
];

const COMMON_FINDINGS = [
  'Lungs clear to auscultation', 'Heart regular rate and rhythm',
  'Abdomen soft, non-tender', 'No peripheral edema', 'Alert and oriented x3',
  'Pupils equal, round, reactive', 'Normal gait and station',
  'Mucous membranes moist', 'No lymphadenopathy', 'Skin warm and dry',
];

const COMMON_DIAGNOSES = [
  'Hypertension (I10)', 'Type 2 Diabetes (E11.9)', 'Hyperlipidemia (E78.5)',
  'Major Depressive Disorder (F33.0)', 'GERD (K21.0)', 'Asthma (J45.20)',
  'Osteoarthritis (M17.11)', 'Hypothyroidism (E03.9)', 'Anxiety Disorder (F41.1)',
  'COPD (J44.1)', 'Atrial Fibrillation (I48.91)', 'Heart Failure (I50.9)',
];

const LAB_PANELS: Record<string, { name: string; tests: string[] }> = {
  CBC: { name: 'Complete Blood Count', tests: ['WBC', 'RBC', 'Hemoglobin', 'Hematocrit', 'Platelets', 'MCV', 'MCH'] },
  CMP: { name: 'Comprehensive Metabolic Panel', tests: ['Glucose', 'BUN', 'Creatinine', 'Sodium', 'Potassium', 'Chloride', 'CO2', 'Calcium', 'Albumin', 'Bilirubin', 'ALP', 'AST', 'ALT'] },
  Lipid: { name: 'Lipid Panel', tests: ['Total Cholesterol', 'LDL', 'HDL', 'Triglycerides', 'VLDL'] },
  Thyroid: { name: 'Thyroid Panel', tests: ['TSH', 'Free T4', 'Free T3', 'T3 Uptake'] },
  HbA1c: { name: 'Hemoglobin A1c', tests: ['HbA1c'] },
  Coag: { name: 'Coagulation', tests: ['PT', 'INR', 'aPTT'] },
};

const VITAL_RANGES: Record<string, { low: number; high: number; critLow: number; critHigh: number; unit: string }> = {
  heartRate: { low: 60, high: 100, critLow: 40, critHigh: 150, unit: 'bpm' },
  bpSystolic: { low: 90, high: 120, critLow: 70, critHigh: 180, unit: 'mmHg' },
  bpDiastolic: { low: 60, high: 80, critLow: 40, critHigh: 120, unit: 'mmHg' },
  temperature: { low: 97.0, high: 99.0, critLow: 95.0, critHigh: 103.0, unit: 'F' },
  respiratoryRate: { low: 12, high: 20, critLow: 8, critHigh: 30, unit: '/min' },
  o2Sat: { low: 95, high: 100, critLow: 88, critHigh: 101, unit: '%' },
};

const seedItems: { title: string; data: HealthcareArtifact }[] = [];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getVitalColor(key: string, value: number): string {
  const range = VITAL_RANGES[key];
  if (!range) return 'text-gray-300';
  if (value < range.critLow || value > range.critHigh) return 'text-red-400';
  if (value < range.low || value > range.high) return 'text-yellow-400';
  return 'text-green-400';
}

function getVitalBg(key: string, value: number): string {
  const range = VITAL_RANGES[key];
  if (!range) return 'bg-gray-500/10';
  if (value < range.critLow || value > range.critHigh) return 'bg-red-500/10 border-red-500/30';
  if (value < range.low || value > range.high) return 'bg-yellow-500/10 border-yellow-500/30';
  return 'bg-green-500/10 border-green-500/30';
}

function calculateBMI(weightLbs: number, heightIn: number): { value: number; category: string; color: string } {
  if (!weightLbs || !heightIn) return { value: 0, category: 'N/A', color: 'text-gray-400' };
  const bmi = (weightLbs / (heightIn * heightIn)) * 703;
  if (bmi < 18.5) return { value: Math.round(bmi * 10) / 10, category: 'Underweight', color: 'text-yellow-400' };
  if (bmi < 25) return { value: Math.round(bmi * 10) / 10, category: 'Normal', color: 'text-green-400' };
  if (bmi < 30) return { value: Math.round(bmi * 10) / 10, category: 'Overweight', color: 'text-yellow-400' };
  return { value: Math.round(bmi * 10) / 10, category: 'Obese', color: 'text-red-400' };
}

function calculateDaysRemaining(endDate?: string): number {
  if (!endDate) return -1;
  const end = new Date(endDate);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function calculateVisitDuration(start?: string, end?: string): string {
  if (!start || !end) return '--';
  const s = new Date(start);
  const e = new Date(end);
  const mins = Math.round((e.getTime() - s.getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function isOutOfRange(value: string, refRange: string): boolean {
  if (!value || !refRange) return false;
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  const match = refRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (!match) return false;
  const lo = parseFloat(match[1]);
  const hi = parseFloat(match[2]);
  return num < lo || num > hi;
}

function getTrend(current?: string, previous?: string): 'up' | 'down' | 'stable' | 'none' {
  if (!current || !previous) return 'none';
  const c = parseFloat(current);
  const p = parseFloat(previous);
  if (isNaN(c) || isNaN(p)) return 'none';
  const diff = ((c - p) / p) * 100;
  if (Math.abs(diff) < 2) return 'stable';
  return diff > 0 ? 'up' : 'down';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HealthcareLensPage() {
  useLensNav('healthcare');

  /* ---------- core state ---------- */
  const [activeTab, setActiveTab] = useState<ModeTab>('Patients');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [filterType, setFilterType] = useState<ArtifactType | 'all'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<LensItem<HealthcareArtifact> | null>(null);
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  /* ---------- patient detail drawer ---------- */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<LensItem<HealthcareArtifact> | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<DetailSubTab>('Overview');
  const [patientViewMode, setPatientViewMode] = useState<PatientViewMode>('cards');

  /* ---------- SOAP note state ---------- */
  const [soapSubjective, setSoapSubjective] = useState('');
  const [soapObjective, setSoapObjective] = useState('');
  const [soapAssessment, setSoapAssessment] = useState('');
  const [soapPlan, setSoapPlan] = useState('');
  const [soapComplaint, setSoapComplaint] = useState('');
  const [soapVisitStart, setSoapVisitStart] = useState('');
  const [soapVisitEnd, setSoapVisitEnd] = useState('');
  const [showComplaintPicker, setShowComplaintPicker] = useState(false);
  const [showFindingPicker, setShowFindingPicker] = useState(false);
  const [showDxPicker, setShowDxPicker] = useState(false);

  /* ---------- vitals entry ---------- */
  const [vitalsHR, setVitalsHR] = useState('');
  const [vitalsBPSys, setVitalsBPSys] = useState('');
  const [vitalsBPDia, setVitalsBPDia] = useState('');
  const [vitalsTemp, setVitalsTemp] = useState('');
  const [vitalsRR, setVitalsRR] = useState('');
  const [vitalsO2, setVitalsO2] = useState('');
  const [vitalsWeight, setVitalsWeight] = useState('');
  const [vitalsHeight, setVitalsHeight] = useState('');

  /* ---------- care plan builder ---------- */
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDue, setNewMilestoneDue] = useState('');
  const [newIntervention, setNewIntervention] = useState('');

  /* ---------- lab panel filter ---------- */
  const [labPanelFilter, setLabPanelFilter] = useState<string>('all');

  /* ---------- medication filter ---------- */
  const [medFilter, setMedFilter] = useState<'all' | 'scheduled' | 'prn'>('all');

  /* ---------- dashboard expanded ---------- */
  const [dashboardExpanded, setDashboardExpanded] = useState(false);

  // Editor form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<ArtifactType>('Patient');
  const [formStatus, setFormStatus] = useState<Status>('scheduled');
  const [formDescription, setFormDescription] = useState('');
  const [formProvider, setFormProvider] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [formNotes, setFormNotes] = useState('');

  const { items, isLoading, isError, error, refetch, create, update, remove } = useLensData<HealthcareArtifact>('healthcare', 'artifact', {
    seed: seedItems.map(s => ({ title: s.title, data: s.data as unknown as Record<string, unknown>, meta: { status: s.data.status, tags: [s.data.artifactType] } })),
  });

  const runAction = useRunArtifact('healthcare');

  /* ---------- derived data ---------- */

  const currentTabType = MODE_TABS.find(t => t.id === activeTab)?.defaultType ?? 'Patient';

  const filtered = useMemo(() => {
    let list = items;
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
    patients: items.filter(i => (i.data as unknown as HealthcareArtifact).artifactType === 'Patient').length,
    encounters: items.filter(i => (i.data as unknown as HealthcareArtifact).artifactType === 'Encounter').length,
    prescriptions: items.filter(i => (i.data as unknown as HealthcareArtifact).artifactType === 'Prescription').length,
    labs: items.filter(i => (i.data as unknown as HealthcareArtifact).artifactType === 'LabResult').length,
    pendingLabs: items.filter(i => (i.data as unknown as HealthcareArtifact).artifactType === 'LabResult' && (i.data as unknown as HealthcareArtifact).status === 'scheduled').length,
    criticalLabs: items.filter(i => (i.data as unknown as HealthcareArtifact).artifactType === 'LabResult' && (i.data as unknown as HealthcareArtifact).isCritical).length,
    todayEncounters: items.filter(i => {
      const d = i.data as unknown as HealthcareArtifact;
      return d.artifactType === 'Encounter' && d.date === new Date().toISOString().split('T')[0];
    }).length,
    overdueFollowups: items.filter(i => {
      const d = i.data as unknown as HealthcareArtifact;
      if (d.artifactType !== 'Encounter' || d.status !== 'scheduled') return false;
      return d.date ? new Date(d.date) < new Date() : false;
    }).length,
  }), [items]);

  /* ---------- linked records for a patient ---------- */
  const getPatientLinked = useCallback((patientId: string) => {
    return items.filter(i => {
      const d = i.data as unknown as HealthcareArtifact;
      return d.patientId === patientId && d.artifactType !== 'Patient';
    }).sort((a, b) => {
      const da = (a.data as unknown as HealthcareArtifact).date || '';
      const db = (b.data as unknown as HealthcareArtifact).date || '';
      return db.localeCompare(da);
    });
  }, [items]);

  /* ---------- medication helpers ---------- */
  const filteredMeds = useMemo(() => {
    let meds = filtered;
    if (medFilter === 'prn') meds = meds.filter(i => (i.data as unknown as HealthcareArtifact).isPRN);
    if (medFilter === 'scheduled') meds = meds.filter(i => !(i.data as unknown as HealthcareArtifact).isPRN);
    return meds;
  }, [filtered, medFilter]);

  /* ---------- lab helpers ---------- */
  const filteredLabs = useMemo(() => {
    if (labPanelFilter === 'all') return filtered;
    return filtered.filter(i => (i.data as unknown as HealthcareArtifact).testPanel === labPanelFilter);
  }, [filtered, labPanelFilter]);

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
    setSoapSubjective(''); setSoapObjective(''); setSoapAssessment(''); setSoapPlan('');
    setSoapComplaint(''); setSoapVisitStart(''); setSoapVisitEnd('');
    setVitalsHR(''); setVitalsBPSys(''); setVitalsBPDia(''); setVitalsTemp('');
    setVitalsRR(''); setVitalsO2(''); setVitalsWeight(''); setVitalsHeight('');
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
    setSoapSubjective(d.soapSubjective || '');
    setSoapObjective(d.soapObjective || '');
    setSoapAssessment(d.soapAssessment || '');
    setSoapPlan(d.soapPlan || '');
    setSoapComplaint(d.chiefComplaint || '');
    setSoapVisitStart(d.visitStart || '');
    setSoapVisitEnd(d.visitEnd || '');
    setVitalsHR(d.heartRate?.toString() || '');
    setVitalsBPSys(d.bpSystolic?.toString() || '');
    setVitalsBPDia(d.bpDiastolic?.toString() || '');
    setVitalsTemp(d.temperature?.toString() || '');
    setVitalsRR(d.respiratoryRate?.toString() || '');
    setVitalsO2(d.o2Sat?.toString() || '');
    setVitalsWeight(d.weight?.toString() || '');
    setVitalsHeight(d.height?.toString() || '');
    setShowEditor(true);
  };

  const openDetailDrawer = (item: LensItem<HealthcareArtifact>) => {
    setDrawerItem(item);
    setDetailSubTab('Overview');
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      title: formTitle,
      data: {
        artifactType: formType,
        status: formStatus,
        description: formDescription,
        provider: formProvider,
        date: formDate,
        priority: formPriority,
        notes: formNotes,
        ...(formType === 'Encounter' && {
          soapSubjective, soapObjective, soapAssessment, soapPlan,
          chiefComplaint: soapComplaint,
          visitStart: soapVisitStart, visitEnd: soapVisitEnd,
        }),
        ...(formType === 'Patient' && {
          heartRate: vitalsHR ? Number(vitalsHR) : undefined,
          bpSystolic: vitalsBPSys ? Number(vitalsBPSys) : undefined,
          bpDiastolic: vitalsBPDia ? Number(vitalsBPDia) : undefined,
          temperature: vitalsTemp ? Number(vitalsTemp) : undefined,
          respiratoryRate: vitalsRR ? Number(vitalsRR) : undefined,
          o2Sat: vitalsO2 ? Number(vitalsO2) : undefined,
          weight: vitalsWeight ? Number(vitalsWeight) : undefined,
          height: vitalsHeight ? Number(vitalsHeight) : undefined,
        }),
      } as unknown as Partial<HealthcareArtifact>,
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

  /* ================================================================== */
  /*  VITAL SIGN CARD (reusable)                                        */
  /* ================================================================== */
  const VitalCard = ({ label, value, vitalKey, icon: Icon, unit }: {
    label: string; value?: number; vitalKey: string; icon: React.ElementType; unit?: string;
  }) => {
    const range = VITAL_RANGES[vitalKey];
    const displayUnit = unit || range?.unit || '';
    return (
      <div className={cn('rounded-lg border p-3', value ? getVitalBg(vitalKey, value) : 'bg-gray-500/10 border-lattice-border')}>
        <div className="flex items-center gap-2 mb-1">
          <Icon className={cn('w-4 h-4', value ? getVitalColor(vitalKey, value) : 'text-gray-500')} />
          <span className={ds.textMuted}>{label}</span>
        </div>
        <p className={cn('text-xl font-bold', value ? getVitalColor(vitalKey, value) : 'text-gray-500')}>
          {value ?? '--'}
          <span className="text-xs font-normal ml-1">{displayUnit}</span>
        </p>
        {range && (
          <p className="text-xs text-gray-500 mt-1">{range.low}-{range.high} {displayUnit}</p>
        )}
      </div>
    );
  };

  /* ================================================================== */
  /*  TIMELINE ITEM (for patient timeline view)                         */
  /* ================================================================== */
  const TimelineItem = ({ item }: { item: LensItem<HealthcareArtifact> }) => {
    const d = item.data as unknown as HealthcareArtifact;
    const typeIcons: Record<string, React.ElementType> = {
      Encounter: Stethoscope, Prescription: Pill, LabResult: FlaskConical,
      Treatment: Brain, CareProtocol: ClipboardList, Patient: Users,
    };
    const TypeIcon = typeIcons[d.artifactType] || FileText;
    return (
      <div className="flex gap-4 relative pl-6 pb-6 group">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-lattice-border group-last:hidden" />
        <div className={cn('absolute left-[-5px] top-1 w-[11px] h-[11px] rounded-full border-2 border-lattice-border', d.status === 'active' ? 'bg-green-400' : d.status === 'completed' ? 'bg-neon-cyan' : 'bg-gray-600')} />
        <div className={cn(ds.panelHover, 'flex-1')} onClick={() => openEditEditor(item)}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <TypeIcon className="w-4 h-4 text-gray-400" />
              <span className={ds.heading3}>{item.title}</span>
            </div>
            <span className={ds.badge(STATUS_COLORS[d.status])}>{d.status}</span>
          </div>
          <p className={cn(ds.textMuted, 'line-clamp-2 mb-2')}>{d.description}</p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {d.date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{d.date}</span>}
            {d.provider && <span>{d.provider}</span>}
            <span className={ds.badge('gray-400')}>{d.artifactType}</span>
          </div>
        </div>
      </div>
    );
  };

  /* ================================================================== */
  /*  MEDICATION ROW (for pharmacy tab)                                 */
  /* ================================================================== */
  const MedicationRow = ({ item }: { item: LensItem<HealthcareArtifact> }) => {
    const d = item.data as unknown as HealthcareArtifact;
    const daysLeft = calculateDaysRemaining(d.endDate);
    const adherence = d.adherencePercent ?? 0;
    return (
      <div className={cn(ds.panelHover, 'space-y-2')} onClick={() => openEditEditor(item)}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={cn(ds.heading3, 'text-base')}>{item.title}</h3>
              {d.isPRN && <span className={ds.badge('neon-blue')}>PRN</span>}
              <span className={ds.badge(STATUS_COLORS[d.status])}>{d.status}</span>
            </div>
            <p className={ds.textMuted}>{d.description}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-gray-500 block">Dosage</span>
            <span className="text-gray-200 font-medium">{d.dosage || '--'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Frequency</span>
            <span className="text-gray-200 font-medium">{d.frequency || '--'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Route</span>
            <span className="text-gray-200 font-medium">{d.route || '--'}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Start Date</span>
            <span className="text-gray-200 font-medium">{d.startDate || d.date || '--'}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2">
          {/* Refill tracking */}
          <div className="flex items-center gap-2 text-xs">
            <RefreshCw className="w-3 h-3 text-gray-500" />
            <span className="text-gray-400">
              Refills: <span className="text-gray-200 font-medium">{d.refillsRemaining ?? '--'}</span>
            </span>
          </div>
          {/* Days remaining */}
          {daysLeft >= 0 && (
            <div className={cn('flex items-center gap-1 text-xs', daysLeft <= 7 ? 'text-red-400' : daysLeft <= 14 ? 'text-yellow-400' : 'text-gray-400')}>
              <Timer className="w-3 h-3" />
              {daysLeft} days remaining
            </div>
          )}
          {/* Adherence */}
          <div className="flex items-center gap-2 text-xs flex-1">
            <span className="text-gray-500">Adherence:</span>
            <div className="flex-1 bg-gray-800 rounded-full h-1.5 max-w-[80px]">
              <div
                className={cn('h-full rounded-full', adherence >= 80 ? 'bg-green-400' : adherence >= 50 ? 'bg-yellow-400' : 'bg-red-400')}
                style={{ width: `${Math.min(adherence, 100)}%` }}
              />
            </div>
            <span className={cn(adherence >= 80 ? 'text-green-400' : adherence >= 50 ? 'text-yellow-400' : 'text-red-400')}>
              {adherence}%
            </span>
          </div>
        </div>
        {/* Interaction alerts */}
        {d.interactions && d.interactions.length > 0 && (
          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-1 text-xs text-red-400 mb-1">
              <AlertTriangle className="w-3 h-3" /> Drug Interactions Detected
            </div>
            {d.interactions.map((inter, idx) => (
              <p key={idx} className="text-xs text-red-300 ml-4">- {inter}</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ================================================================== */
  /*  LAB RESULT ROW (for lab tab)                                      */
  /* ================================================================== */
  const LabResultRow = ({ item }: { item: LensItem<HealthcareArtifact> }) => {
    const d = item.data as unknown as HealthcareArtifact;
    const outOfRange = isOutOfRange(d.resultValue || '', d.referenceRange || '');
    const trend = getTrend(d.resultValue, d.previousValue);
    return (
      <div className={cn(ds.panelHover, d.isCritical && 'border-red-500/50')} onClick={() => openEditEditor(item)}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className={cn(ds.heading3, 'text-base')}>{item.title}</h3>
              {d.isCritical && (
                <span className={cn(ds.badge('red-400'), 'animate-pulse')}>
                  <AlertCircle className="w-3 h-3" /> CRITICAL
                </span>
              )}
              {d.testPanel && <span className={ds.badge('neon-cyan')}>{d.testPanel}</span>}
              <span className={ds.badge(STATUS_COLORS[d.status])}>{d.status}</span>
            </div>
            <p className={cn(ds.textMuted, 'mt-1')}>{d.description}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-gray-500 block">Result</span>
            <span className={cn('font-bold text-sm', outOfRange ? 'text-red-400' : 'text-green-400')}>
              {d.resultValue || '--'} {d.unit || ''}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Reference Range</span>
            <span className="text-gray-200">{d.referenceRange || '--'} {d.unit || ''}</span>
          </div>
          <div>
            <span className="text-gray-500 block">Trend</span>
            <span className="flex items-center gap-1">
              {trend === 'up' && <ArrowUpRight className={cn('w-4 h-4', outOfRange ? 'text-red-400' : 'text-yellow-400')} />}
              {trend === 'down' && <ArrowDownRight className={cn('w-4 h-4', outOfRange ? 'text-red-400' : 'text-yellow-400')} />}
              {trend === 'stable' && <Minus className="w-4 h-4 text-green-400" />}
              {trend === 'none' && <span className="text-gray-500">--</span>}
              {d.previousValue && <span className="text-gray-400">(prev: {d.previousValue})</span>}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block">Date</span>
            <span className="text-gray-200">{d.date || '--'}</span>
          </div>
        </div>
      </div>
    );
  };

  /* ================================================================== */
  /*  CARE PLAN CARD (for therapy tab)                                  */
  /* ================================================================== */
  const CarePlanCard = ({ item }: { item: LensItem<HealthcareArtifact> }) => {
    const d = item.data as unknown as HealthcareArtifact;
    const goals = d.goals || [];
    const milestones = d.milestones || [];
    const interventions = d.interventions || [];
    const overallProgress = goals.length > 0 ? Math.round(goals.reduce((s, g) => s + g.percent, 0) / goals.length) : 0;
    return (
      <div className={cn(ds.panelHover, 'space-y-3')} onClick={() => openEditEditor(item)}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className={cn(ds.heading3, 'text-base')}>{item.title}</h3>
            <p className={cn(ds.textMuted, 'mt-1')}>{d.description}</p>
          </div>
          <span className={ds.badge(STATUS_COLORS[d.status])}>{d.status}</span>
        </div>
        {/* Overall progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">Overall Progress</span>
            <span className={cn(overallProgress >= 75 ? 'text-green-400' : overallProgress >= 40 ? 'text-yellow-400' : 'text-gray-400')}>
              {overallProgress}%
            </span>
          </div>
          <div className="bg-gray-800 rounded-full h-2">
            <div
              className={cn('h-full rounded-full transition-all', overallProgress >= 75 ? 'bg-green-400' : overallProgress >= 40 ? 'bg-yellow-400' : 'bg-neon-blue')}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
        {/* Goals summary */}
        {goals.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Goals ({goals.length})</span>
            {goals.slice(0, 3).map((g, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 flex-1">
                  <Target className={cn('w-3 h-3', g.percent >= 100 ? 'text-green-400' : 'text-gray-500')} />
                  <span className="text-gray-300 truncate">{g.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-gray-800 rounded-full h-1 w-16">
                    <div className={cn('h-full rounded-full', g.percent >= 100 ? 'bg-green-400' : 'bg-neon-blue')} style={{ width: `${Math.min(g.percent, 100)}%` }} />
                  </div>
                  <span className="text-gray-400 w-8 text-right">{g.percent}%</span>
                </div>
              </div>
            ))}
            {goals.length > 3 && <p className="text-xs text-gray-500">+{goals.length - 3} more goals</p>}
          </div>
        )}
        {/* Milestones summary */}
        {milestones.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <ListChecks className="w-3 h-3" />
            {milestones.filter(m => m.completed).length}/{milestones.length} milestones complete
          </div>
        )}
        {/* Interventions */}
        {interventions.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Syringe className="w-3 h-3" />
            {interventions.length} interventions
          </div>
        )}
        {/* Outcome */}
        {d.outcomeMeasure && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <BarChart3 className="w-3 h-3" />
            Outcome: {d.outcomeMeasure}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={ds.pageContainer}>
      {/* ============================================================ */}
      {/* Compliance Banner                                            */}
      {/* ============================================================ */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-amber-200">
            This tool assists with record organization. It is not a certified EHR. Consult applicable regulations (HIPAA, etc.) for your jurisdiction.
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-amber-400/70"><ShieldCheck className="w-3 h-3" />HIPAA Aware</span>
            <span className="flex items-center gap-1 text-xs text-amber-400/70"><BadgeCheck className="w-3 h-3" />Audit Trail</span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Header                                                       */}
      {/* ============================================================ */}
      <header className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <Heart className="w-7 h-7 text-red-400" />
          <div>
            <h1 className={ds.heading1}>Healthcare</h1>
            <p className={ds.textMuted}>Clinical record organization and care coordination</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setDrawerOpen(!drawerOpen); }} className={ds.btnGhost}>
            {drawerOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
          <button onClick={openNewEditor} className={ds.btnPrimary}>
            <Plus className="w-4 h-4" /> New Record
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* Mode Tabs                                                    */}
      {/* ============================================================ */}
      <nav className="flex items-center gap-1 border-b border-lattice-border pb-3 overflow-x-auto">
        {MODE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setFilterStatus('all'); setFilterType('all'); }}
            className={cn(ds.btnGhost, 'whitespace-nowrap', activeTab === tab.id && 'bg-neon-blue/20 text-neon-blue')}
          >
            <tab.icon className="w-4 h-4" />
            {tab.id}
          </button>
        ))}
      </nav>

      {/* ============================================================ */}
      {/* Enhanced Dashboard Overview                                   */}
      {/* ============================================================ */}
      <div className="space-y-4">
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

        {/* Expandable detailed dashboard */}
        <button
          onClick={() => setDashboardExpanded(!dashboardExpanded)}
          className={cn(ds.btnGhost, 'text-xs w-full justify-center')}
        >
          {dashboardExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {dashboardExpanded ? 'Collapse Dashboard' : 'Expand Dashboard'}
        </button>

        {dashboardExpanded && (
          <div className={ds.grid4}>
            <div className={cn(ds.panel, 'space-y-2')}>
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-neon-blue" />
                <span className="text-sm font-medium text-white">Today&apos;s Schedule</span>
              </div>
              <p className="text-3xl font-bold text-neon-blue">{stats.todayEncounters}</p>
              <p className={ds.textMuted}>encounters today</p>
            </div>
            <div className={cn(ds.panel, 'space-y-2')}>
              <div className="flex items-center gap-2">
                <Beaker className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-medium text-white">Pending Labs</span>
              </div>
              <p className="text-3xl font-bold text-yellow-400">{stats.pendingLabs}</p>
              <p className={ds.textMuted}>awaiting review</p>
            </div>
            <div className={cn(ds.panel, 'space-y-2')}>
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-white">Overdue Follow-ups</span>
              </div>
              <p className="text-3xl font-bold text-orange-400">{stats.overdueFollowups}</p>
              <p className={ds.textMuted}>need rescheduling</p>
            </div>
            <div className={cn(ds.panel, 'space-y-2')}>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm font-medium text-white">Critical Alerts</span>
              </div>
              <p className="text-3xl font-bold text-red-400">{stats.criticalLabs}</p>
              <p className={ds.textMuted}>critical lab values</p>
            </div>
            {/* Patient census */}
            <div className={cn(ds.panel, 'md:col-span-2 lg:col-span-4')}>
              <h3 className={cn(ds.heading3, 'text-sm mb-3')}>Patient Census</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{stats.patients}</p>
                  <p className="text-xs text-gray-500">Patients</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{stats.encounters}</p>
                  <p className="text-xs text-gray-500">Encounters</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{stats.prescriptions}</p>
                  <p className="text-xs text-gray-500">Prescriptions</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{stats.labs}</p>
                  <p className="text-xs text-gray-500">Lab Results</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{stats.total}</p>
                  <p className="text-xs text-gray-500">Total Records</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Enhanced Domain Actions                                      */}
      {/* ============================================================ */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => handleAction('checkInteractions')} className={ds.btnSecondary}>
          <ShieldCheck className="w-4 h-4" /> Check Drug Interactions
        </button>
        <button onClick={() => handleAction('protocolMatch')} className={ds.btnSecondary}>
          <ClipboardList className="w-4 h-4" /> Protocol Match
        </button>
        <button onClick={() => handleAction('generateSummary')} className={ds.btnSecondary}>
          <FileText className="w-4 h-4" /> Generate Summary
        </button>
        <button onClick={() => handleAction('exportEncounter')} className={ds.btnSecondary}>
          <Download className="w-4 h-4" /> Export Encounter
        </button>
        <button onClick={() => handleAction('soapAutoFill')} className={ds.btnSecondary}>
          <Clipboard className="w-4 h-4" /> SOAP Auto-Fill
        </button>
        {runAction.isPending && <span className="text-xs text-neon-blue animate-pulse">Running...</span>}
      </div>

      {actionResult && (
        <div className={ds.panel}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={ds.heading3}>Action Result</h3>
            <button onClick={() => setActionResult(null)} className={ds.btnGhost}><X className="w-4 h-4" /></button>
          </div>
          <pre className={cn(ds.textMono, 'text-xs overflow-auto max-h-48')}>{JSON.stringify(actionResult, null, 2)}</pre>
        </div>
      )}

      {/* ============================================================ */}
      {/* Main Content Area (with optional drawer)                     */}
      {/* ============================================================ */}
      <div className="flex gap-4">
        {/* ========================================================== */}
        {/* Left: Artifact Library                                     */}
        {/* ========================================================== */}
        <section className={cn(ds.panel, 'flex-1 min-w-0')}>
          <div className={cn(ds.sectionHeader, 'mb-4')}>
            <div className="flex items-center gap-3">
              <h2 className={ds.heading2}>{activeTab}</h2>
              {/* View mode toggle for Patients tab */}
              {activeTab === 'Patients' && (
                <div className="flex items-center border border-lattice-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setPatientViewMode('cards')}
                    className={cn('px-2 py-1', patientViewMode === 'cards' ? 'bg-neon-blue/20 text-neon-blue' : 'text-gray-400 hover:text-white')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPatientViewMode('timeline')}
                    className={cn('px-2 py-1', patientViewMode === 'timeline' ? 'bg-neon-blue/20 text-neon-blue' : 'text-gray-400 hover:text-white')}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search records..."
                  className={cn(ds.input, 'pl-9 w-56')}
                />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as Status | 'all')} className={cn(ds.select, 'w-40')}>
                <option value="all">All statuses</option>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {/* Medication filter for Pharmacy tab */}
              {activeTab === 'Pharmacy' && (
                <select value={medFilter} onChange={e => setMedFilter(e.target.value as 'all' | 'scheduled' | 'prn')} className={cn(ds.select, 'w-36')}>
                  <option value="all">All Meds</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="prn">PRN Only</option>
                </select>
              )}
              {/* Lab panel filter for Lab tab */}
              {activeTab === 'Lab' && (
                <select value={labPanelFilter} onChange={e => setLabPanelFilter(e.target.value)} className={cn(ds.select, 'w-40')}>
                  <option value="all">All Panels</option>
                  {Object.keys(LAB_PANELS).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              )}
            </div>
          </div>

          {isLoading ? (
            <p className={cn(ds.textMuted, 'text-center py-12')}>Loading records...</p>
          ) : (activeTab === 'Pharmacy' ? filteredMeds : activeTab === 'Lab' ? filteredLabs : filtered).length === 0 ? (
            <div className="text-center py-12">
              <Stethoscope className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className={ds.textMuted}>No records found. Create one to get started.</p>
            </div>
          ) : (
            <>
              {/* ---- Patients Tab ---- */}
              {activeTab === 'Patients' && patientViewMode === 'timeline' && (
                <div className="space-y-0">
                  {filtered.map(item => (
                    <div key={item.id} className="mb-4">
                      <div
                        className={cn(ds.panelHover, 'mb-2')}
                        onClick={() => openDetailDrawer(item)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Users className="w-5 h-5 text-neon-blue" />
                            <div>
                              <h3 className={cn(ds.heading3, 'text-base')}>{item.title}</h3>
                              <p className={cn(ds.textMuted, 'line-clamp-1')}>{(item.data as unknown as HealthcareArtifact).description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={ds.badge(STATUS_COLORS[(item.data as unknown as HealthcareArtifact).status])}>{(item.data as unknown as HealthcareArtifact).status}</span>
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          </div>
                        </div>
                      </div>
                      {/* Timeline of linked records */}
                      <div className="ml-8 border-l border-lattice-border pl-4">
                        {getPatientLinked(item.id).slice(0, 5).map(linked => (
                          <TimelineItem key={linked.id} item={linked} />
                        ))}
                        {getPatientLinked(item.id).length === 0 && (
                          <p className={cn(ds.textMuted, 'text-xs py-2')}>No linked records</p>
                        )}
                        {getPatientLinked(item.id).length > 5 && (
                          <p className="text-xs text-neon-blue cursor-pointer hover:underline" onClick={() => openDetailDrawer(item)}>
                            View all {getPatientLinked(item.id).length} records...
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'Patients' && patientViewMode === 'cards' && (
                <div className={ds.grid3}>
                  {filtered.map(item => {
                    const d = item.data as unknown as HealthcareArtifact;
                    const linkedCount = getPatientLinked(item.id).length;
                    return (
                      <div key={item.id} className={ds.panelHover} onClick={() => openDetailDrawer(item)}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className={cn(ds.heading3, 'text-base truncate flex-1')}>{item.title}</h3>
                          <span className={ds.badge(STATUS_COLORS[d.status])}>{d.status}</span>
                        </div>
                        <p className={cn(ds.textMuted, 'line-clamp-2 mb-3')}>{d.description}</p>
                        {/* Quick vitals preview */}
                        {(d.heartRate || d.bpSystolic) && (
                          <div className="flex items-center gap-3 text-xs mb-2">
                            {d.heartRate && (
                              <span className={cn('flex items-center gap-1', getVitalColor('heartRate', d.heartRate))}>
                                <Activity className="w-3 h-3" /> {d.heartRate}
                              </span>
                            )}
                            {d.bpSystolic && d.bpDiastolic && (
                              <span className={cn('flex items-center gap-1', getVitalColor('bpSystolic', d.bpSystolic))}>
                                <Droplets className="w-3 h-3" /> {d.bpSystolic}/{d.bpDiastolic}
                              </span>
                            )}
                            {d.o2Sat && (
                              <span className={cn('flex items-center gap-1', getVitalColor('o2Sat', d.o2Sat))}>
                                <Wind className="w-3 h-3" /> {d.o2Sat}%
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {d.provider && <span className={ds.textMuted}>{d.provider}</span>}
                            {linkedCount > 0 && (
                              <span className={ds.badge('neon-cyan')}>{linkedCount} records</span>
                            )}
                          </div>
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

              {/* ---- Encounters Tab (with SOAP hint) ---- */}
              {activeTab === 'Encounters' && (
                <div className={ds.grid3}>
                  {filtered.map(item => {
                    const d = item.data as unknown as HealthcareArtifact;
                    const hasSoap = d.soapSubjective || d.soapObjective || d.soapAssessment || d.soapPlan;
                    return (
                      <div key={item.id} className={ds.panelHover} onClick={() => openEditEditor(item)}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className={cn(ds.heading3, 'text-base truncate flex-1')}>{item.title}</h3>
                          <span className={ds.badge(STATUS_COLORS[d.status])}>{d.status}</span>
                        </div>
                        <p className={cn(ds.textMuted, 'line-clamp-2 mb-2')}>{d.description}</p>
                        {d.chiefComplaint && (
                          <p className="text-xs text-yellow-400 mb-2">CC: {d.chiefComplaint}</p>
                        )}
                        {hasSoap && (
                          <div className="flex items-center gap-1 mb-2">
                            <Clipboard className="w-3 h-3 text-neon-cyan" />
                            <span className="text-xs text-neon-cyan">SOAP Note</span>
                          </div>
                        )}
                        {(d.visitStart && d.visitEnd) && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                            <Timer className="w-3 h-3" />
                            Duration: {calculateVisitDuration(d.visitStart, d.visitEnd)}
                          </div>
                        )}
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

              {/* ---- Protocols Tab ---- */}
              {activeTab === 'Protocols' && (
                <div className={ds.grid3}>
                  {filtered.map(item => {
                    const d = item.data as unknown as HealthcareArtifact;
                    return (
                      <div key={item.id} className={ds.panelHover} onClick={() => openEditEditor(item)}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className={cn(ds.heading3, 'text-base truncate flex-1')}>{item.title}</h3>
                          <span className={ds.badge(STATUS_COLORS[d.status])}>{d.status}</span>
                        </div>
                        <p className={cn(ds.textMuted, 'line-clamp-2 mb-3')}>{d.description}</p>
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

              {/* ---- Pharmacy Tab (Medication Schedule View) ---- */}
              {activeTab === 'Pharmacy' && (
                <div className="space-y-3">
                  {filteredMeds.map(item => (
                    <MedicationRow key={item.id} item={item} />
                  ))}
                </div>
              )}

              {/* ---- Lab Tab (Lab Results Panel) ---- */}
              {activeTab === 'Lab' && (
                <div className="space-y-3">
                  {/* Lab panel quick stats */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {Object.entries(LAB_PANELS).map(([key, _panel]) => {
                      const count = filtered.filter(i => (i.data as unknown as HealthcareArtifact).testPanel === key).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={key}
                          onClick={() => setLabPanelFilter(labPanelFilter === key ? 'all' : key)}
                          className={cn(ds.btnSmall, labPanelFilter === key ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50' : 'bg-lattice-elevated text-gray-400 border border-lattice-border')}
                        >
                          {key} ({count})
                        </button>
                      );
                    })}
                  </div>
                  {filteredLabs.map(item => (
                    <LabResultRow key={item.id} item={item} />
                  ))}
                </div>
              )}

              {/* ---- Therapy Tab (Care Plan Builder) ---- */}
              {activeTab === 'Therapy' && (
                <div className="space-y-3">
                  {filtered.map(item => (
                    <CarePlanCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        {/* ========================================================== */}
        {/* Right: Detail Drawer (sliding panel)                       */}
        {/* ========================================================== */}
        {drawerOpen && drawerItem && (
          <aside className="w-96 shrink-0 space-y-4 animate-in slide-in-from-right-4">
            <div className={ds.panel}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={ds.heading2}>Patient Detail</h2>
                <button onClick={() => setDrawerOpen(false)} className={ds.btnGhost}><X className="w-4 h-4" /></button>
              </div>
              <div className="mb-4">
                <h3 className={cn(ds.heading3, 'text-lg')}>{drawerItem.title}</h3>
                <p className={ds.textMuted}>{(drawerItem.data as unknown as HealthcareArtifact).description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={ds.badge(STATUS_COLORS[(drawerItem.data as unknown as HealthcareArtifact).status])}>
                    {(drawerItem.data as unknown as HealthcareArtifact).status}
                  </span>
                  {(drawerItem.data as unknown as HealthcareArtifact).provider && (
                    <span className={cn(ds.textMuted, 'text-xs')}>{(drawerItem.data as unknown as HealthcareArtifact).provider}</span>
                  )}
                </div>
              </div>
              {/* Sub-tabs */}
              <div className="flex items-center gap-1 border-b border-lattice-border pb-2 mb-3 overflow-x-auto">
                {(['Overview', 'Vitals', 'Medications', 'Labs', 'History'] as DetailSubTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDetailSubTab(tab)}
                    className={cn(ds.btnGhost, 'text-xs whitespace-nowrap', detailSubTab === tab && 'bg-neon-blue/20 text-neon-blue')}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* ---------- Overview Sub-tab ---------- */}
              {detailSubTab === 'Overview' && (() => {
                const dd = drawerItem.data as unknown as HealthcareArtifact;
                const linked = getPatientLinked(drawerItem.id);
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={cn(ds.panel, 'p-2')}>
                        <span className="text-gray-500 block">Records</span>
                        <span className="text-lg font-bold text-white">{linked.length}</span>
                      </div>
                      <div className={cn(ds.panel, 'p-2')}>
                        <span className="text-gray-500 block">Priority</span>
                        <span className={cn('text-lg font-bold', PRIORITY_COLORS[dd.priority || 'medium'])}>
                          {dd.priority || 'medium'}
                        </span>
                      </div>
                    </div>
                    {dd.notes && (
                      <div>
                        <span className="text-xs text-gray-500 font-medium">Notes</span>
                        <p className="text-sm text-gray-300 mt-1">{dd.notes}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-500 font-medium">Recent Activity</span>
                      <div className="mt-1 space-y-1">
                        {linked.slice(0, 5).map(l => {
                          const ld = l.data as unknown as HealthcareArtifact;
                          return (
                            <div key={l.id} className="flex items-center justify-between text-xs p-2 rounded bg-lattice-surface hover:bg-lattice-elevated cursor-pointer" onClick={() => openEditEditor(l)}>
                              <span className="text-gray-300 truncate flex-1">{l.title}</span>
                              <span className={ds.badge(STATUS_COLORS[ld.status])}>{ld.artifactType}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button onClick={() => openEditEditor(drawerItem)} className={cn(ds.btnSecondary, 'w-full text-sm')}>
                      <FileText className="w-4 h-4" /> Edit Patient Record
                    </button>
                  </div>
                );
              })()}

              {/* ---------- Vitals Sub-tab ---------- */}
              {detailSubTab === 'Vitals' && (() => {
                const dd = drawerItem.data as unknown as HealthcareArtifact;
                const bmi = calculateBMI(dd.weight || 0, dd.height || 0);
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <VitalCard label="Heart Rate" value={dd.heartRate} vitalKey="heartRate" icon={Activity} />
                      <VitalCard label="O2 Sat" value={dd.o2Sat} vitalKey="o2Sat" icon={Wind} />
                      <VitalCard label="BP (Sys)" value={dd.bpSystolic} vitalKey="bpSystolic" icon={Droplets} />
                      <VitalCard label="BP (Dia)" value={dd.bpDiastolic} vitalKey="bpDiastolic" icon={Droplets} />
                      <VitalCard label="Temp" value={dd.temperature} vitalKey="temperature" icon={Thermometer} />
                      <VitalCard label="Resp Rate" value={dd.respiratoryRate} vitalKey="respiratoryRate" icon={Wind} />
                    </div>
                    {/* Weight and BMI */}
                    <div className={cn(ds.panel, 'p-3')}>
                      <div className="flex items-center gap-2 mb-2">
                        <Weight className="w-4 h-4 text-gray-400" />
                        <span className={ds.textMuted}>Weight & BMI</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                          <span className="text-gray-500 block">Weight</span>
                          <span className="text-sm font-bold text-white">{dd.weight ?? '--'} lbs</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">Height</span>
                          <span className="text-sm font-bold text-white">{dd.height ?? '--'} in</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block">BMI</span>
                          <span className={cn('text-sm font-bold', bmi.color)}>{bmi.value || '--'}</span>
                          {bmi.category !== 'N/A' && (
                            <span className={cn('block text-xs', bmi.color)}>{bmi.category}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Vital ranges legend */}
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> Normal</span>
                      <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-yellow-400" /> Borderline</span>
                      <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-400" /> Critical</span>
                    </div>
                  </div>
                );
              })()}

              {/* ---------- Medications Sub-tab ---------- */}
              {detailSubTab === 'Medications' && (() => {
                const linkedMeds = getPatientLinked(drawerItem.id).filter(i => (i.data as unknown as HealthcareArtifact).artifactType === 'Prescription');
                return (
                  <div className="space-y-2">
                    {linkedMeds.length === 0 ? (
                      <p className={cn(ds.textMuted, 'text-center py-4')}>No medications linked</p>
                    ) : linkedMeds.map(med => {
                      const md = med.data as unknown as HealthcareArtifact;
                      const daysLeft = calculateDaysRemaining(md.endDate);
                      return (
                        <div key={med.id} className="p-2 rounded bg-lattice-surface hover:bg-lattice-elevated cursor-pointer text-xs" onClick={() => openEditEditor(med)}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-200 font-medium">{med.title}</span>
                            {md.isPRN && <span className={ds.badge('neon-blue')}>PRN</span>}
                          </div>
                          <div className="flex items-center gap-2 text-gray-500">
                            {md.dosage && <span>{md.dosage}</span>}
                            {md.frequency && <span>- {md.frequency}</span>}
                          </div>
                          {daysLeft >= 0 && daysLeft <= 7 && (
                            <p className="text-red-400 mt-1">Refill in {daysLeft} days</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ---------- Labs Sub-tab ---------- */}
              {detailSubTab === 'Labs' && (() => {
                const linkedLabs = getPatientLinked(drawerItem.id).filter(i => (i.data as unknown as HealthcareArtifact).artifactType === 'LabResult');
                return (
                  <div className="space-y-2">
                    {linkedLabs.length === 0 ? (
                      <p className={cn(ds.textMuted, 'text-center py-4')}>No lab results linked</p>
                    ) : linkedLabs.map(lab => {
                      const ld = lab.data as unknown as HealthcareArtifact;
                      const outOfRange = isOutOfRange(ld.resultValue || '', ld.referenceRange || '');
                      return (
                        <div key={lab.id} className={cn('p-2 rounded cursor-pointer text-xs', ld.isCritical ? 'bg-red-500/10 border border-red-500/30' : 'bg-lattice-surface hover:bg-lattice-elevated')} onClick={() => openEditEditor(lab)}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-200 font-medium">{lab.title}</span>
                            {ld.isCritical && <span className={cn(ds.badge('red-400'), 'text-[10px]')}>CRITICAL</span>}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={cn(outOfRange ? 'text-red-400 font-bold' : 'text-green-400')}>
                              {ld.resultValue || '--'} {ld.unit || ''}
                            </span>
                            <span className="text-gray-500">Ref: {ld.referenceRange || '--'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ---------- History Sub-tab ---------- */}
              {detailSubTab === 'History' && (() => {
                const linked = getPatientLinked(drawerItem.id);
                return (
                  <div className="space-y-0">
                    {linked.length === 0 ? (
                      <p className={cn(ds.textMuted, 'text-center py-4')}>No history records</p>
                    ) : linked.map(item => (
                      <TimelineItem key={item.id} item={item} />
                    ))}
                  </div>
                );
              })()}
            </div>
          </aside>
        )}
      </div>

      {/* ============================================================ */}
      {/* Editor Modal                                                 */}
      {/* ============================================================ */}
      {showEditor && (
        <>
          <div className={ds.modalBackdrop} onClick={() => setShowEditor(false)} />
          <div className={ds.modalContainer}>
            <div className={cn(ds.modalPanel, 'max-w-3xl')}>
              <div className="flex items-center justify-between p-4 border-b border-lattice-border">
                <h2 className={ds.heading2}>{editingItem ? 'Edit Record' : 'New Record'}</h2>
                <button onClick={() => setShowEditor(false)} className={ds.btnGhost}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* ---------- Base fields ---------- */}
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

                {/* ============================================= */}
                {/* SOAP Note Builder (Encounter type)            */}
                {/* ============================================= */}
                {formType === 'Encounter' && (
                  <div className="border border-neon-cyan/30 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Clipboard className="w-5 h-5 text-neon-cyan" />
                      <h3 className={cn(ds.heading3, 'text-neon-cyan')}>SOAP Note Builder</h3>
                    </div>
                    {/* Chief Complaint */}
                    <div className="relative">
                      <label className={ds.label}>Chief Complaint</label>
                      <div className="flex gap-2">
                        <input
                          value={soapComplaint}
                          onChange={e => setSoapComplaint(e.target.value)}
                          className={cn(ds.input, 'flex-1')}
                          placeholder="Patient presents with..."
                        />
                        <button
                          onClick={() => setShowComplaintPicker(!showComplaintPicker)}
                          className={cn(ds.btnSmall, 'bg-lattice-elevated text-gray-400 border border-lattice-border')}
                        >
                          Quick
                        </button>
                      </div>
                      {showComplaintPicker && (
                        <div className="mt-1 p-2 bg-lattice-elevated border border-lattice-border rounded-lg max-h-32 overflow-y-auto">
                          <div className="flex flex-wrap gap-1">
                            {COMMON_COMPLAINTS.map(c => (
                              <button key={c} onClick={() => { setSoapComplaint(c); setShowComplaintPicker(false); }}
                                className="text-xs px-2 py-1 rounded bg-lattice-surface text-gray-300 hover:bg-neon-blue/20 hover:text-neon-blue">
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Visit timing */}
                    <div className={ds.grid2}>
                      <div>
                        <label className={ds.label}>Visit Start</label>
                        <input type="datetime-local" value={soapVisitStart} onChange={e => setSoapVisitStart(e.target.value)} className={ds.input} />
                      </div>
                      <div>
                        <label className={ds.label}>Visit End</label>
                        <input type="datetime-local" value={soapVisitEnd} onChange={e => setSoapVisitEnd(e.target.value)} className={ds.input} />
                      </div>
                    </div>
                    {soapVisitStart && soapVisitEnd && (
                      <div className="flex items-center gap-2 text-xs text-neon-cyan">
                        <Timer className="w-3 h-3" />
                        Visit Duration: {calculateVisitDuration(soapVisitStart, soapVisitEnd)}
                      </div>
                    )}
                    {/* S - Subjective */}
                    <div>
                      <label className={ds.label}>
                        <span className="inline-block w-5 h-5 bg-blue-500/20 text-blue-400 rounded text-center text-xs leading-5 mr-2 font-bold">S</span>
                        Subjective
                      </label>
                      <textarea value={soapSubjective} onChange={e => setSoapSubjective(e.target.value)} className={ds.textarea} rows={3}
                        placeholder="Patient's reported symptoms, history of present illness..." />
                    </div>
                    {/* O - Objective */}
                    <div className="relative">
                      <label className={ds.label}>
                        <span className="inline-block w-5 h-5 bg-green-500/20 text-green-400 rounded text-center text-xs leading-5 mr-2 font-bold">O</span>
                        Objective
                      </label>
                      <textarea value={soapObjective} onChange={e => setSoapObjective(e.target.value)} className={ds.textarea} rows={3}
                        placeholder="Physical examination findings, vital signs, test results..." />
                      <button
                        onClick={() => setShowFindingPicker(!showFindingPicker)}
                        className={cn(ds.btnSmall, 'absolute top-0 right-0 bg-lattice-elevated text-gray-400 border border-lattice-border text-xs')}
                      >
                        Insert Finding
                      </button>
                      {showFindingPicker && (
                        <div className="mt-1 p-2 bg-lattice-elevated border border-lattice-border rounded-lg max-h-32 overflow-y-auto">
                          <div className="flex flex-wrap gap-1">
                            {COMMON_FINDINGS.map(f => (
                              <button key={f} onClick={() => { setSoapObjective(prev => prev ? prev + '. ' + f : f); setShowFindingPicker(false); }}
                                className="text-xs px-2 py-1 rounded bg-lattice-surface text-gray-300 hover:bg-green-500/20 hover:text-green-400">
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* A - Assessment */}
                    <div className="relative">
                      <label className={ds.label}>
                        <span className="inline-block w-5 h-5 bg-yellow-500/20 text-yellow-400 rounded text-center text-xs leading-5 mr-2 font-bold">A</span>
                        Assessment
                      </label>
                      <textarea value={soapAssessment} onChange={e => setSoapAssessment(e.target.value)} className={ds.textarea} rows={3}
                        placeholder="Diagnoses, clinical impression..." />
                      <button
                        onClick={() => setShowDxPicker(!showDxPicker)}
                        className={cn(ds.btnSmall, 'absolute top-0 right-0 bg-lattice-elevated text-gray-400 border border-lattice-border text-xs')}
                      >
                        Add Dx
                      </button>
                      {showDxPicker && (
                        <div className="mt-1 p-2 bg-lattice-elevated border border-lattice-border rounded-lg max-h-40 overflow-y-auto">
                          <div className="flex flex-wrap gap-1">
                            {COMMON_DIAGNOSES.map(dx => (
                              <button key={dx} onClick={() => { setSoapAssessment(prev => prev ? prev + '\n' + dx : dx); setShowDxPicker(false); }}
                                className="text-xs px-2 py-1 rounded bg-lattice-surface text-gray-300 hover:bg-yellow-500/20 hover:text-yellow-400">
                                {dx}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* P - Plan */}
                    <div>
                      <label className={ds.label}>
                        <span className="inline-block w-5 h-5 bg-purple-500/20 text-purple-400 rounded text-center text-xs leading-5 mr-2 font-bold">P</span>
                        Plan
                      </label>
                      <textarea value={soapPlan} onChange={e => setSoapPlan(e.target.value)} className={ds.textarea} rows={3}
                        placeholder="Treatment plan, medications, follow-up, referrals..." />
                    </div>
                  </div>
                )}

                {/* ============================================= */}
                {/* Vital Signs Entry (Patient type)              */}
                {/* ============================================= */}
                {formType === 'Patient' && (
                  <div className="border border-green-500/30 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-5 h-5 text-green-400" />
                      <h3 className={cn(ds.heading3, 'text-green-400')}>Vital Signs</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className={ds.label}>Heart Rate (bpm)</label>
                        <input type="number" value={vitalsHR} onChange={e => setVitalsHR(e.target.value)} className={ds.input} placeholder="72" />
                      </div>
                      <div>
                        <label className={ds.label}>BP Systolic</label>
                        <input type="number" value={vitalsBPSys} onChange={e => setVitalsBPSys(e.target.value)} className={ds.input} placeholder="120" />
                      </div>
                      <div>
                        <label className={ds.label}>BP Diastolic</label>
                        <input type="number" value={vitalsBPDia} onChange={e => setVitalsBPDia(e.target.value)} className={ds.input} placeholder="80" />
                      </div>
                      <div>
                        <label className={ds.label}>Temperature (F)</label>
                        <input type="number" step="0.1" value={vitalsTemp} onChange={e => setVitalsTemp(e.target.value)} className={ds.input} placeholder="98.6" />
                      </div>
                      <div>
                        <label className={ds.label}>Resp Rate (/min)</label>
                        <input type="number" value={vitalsRR} onChange={e => setVitalsRR(e.target.value)} className={ds.input} placeholder="16" />
                      </div>
                      <div>
                        <label className={ds.label}>O2 Sat (%)</label>
                        <input type="number" value={vitalsO2} onChange={e => setVitalsO2(e.target.value)} className={ds.input} placeholder="98" />
                      </div>
                      <div>
                        <label className={ds.label}>Weight (lbs)</label>
                        <input type="number" value={vitalsWeight} onChange={e => setVitalsWeight(e.target.value)} className={ds.input} placeholder="170" />
                      </div>
                      <div>
                        <label className={ds.label}>Height (in)</label>
                        <input type="number" value={vitalsHeight} onChange={e => setVitalsHeight(e.target.value)} className={ds.input} placeholder="68" />
                      </div>
                    </div>
                    {/* Live BMI calculation */}
                    {vitalsWeight && vitalsHeight && (
                      <div className="flex items-center gap-3 p-2 bg-lattice-elevated rounded-lg">
                        <BarChart3 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-400">BMI:</span>
                        {(() => {
                          const bmi = calculateBMI(Number(vitalsWeight), Number(vitalsHeight));
                          return (
                            <span className={cn('text-sm font-bold', bmi.color)}>
                              {bmi.value} ({bmi.category})
                            </span>
                          );
                        })()}
                      </div>
                    )}
                    {/* Live vital range indicators */}
                    <div className="flex flex-wrap gap-2">
                      {vitalsHR && (
                        <span className={cn('text-xs px-2 py-1 rounded', getVitalBg('heartRate', Number(vitalsHR)), getVitalColor('heartRate', Number(vitalsHR)))}>
                          HR: {vitalsHR} bpm
                        </span>
                      )}
                      {vitalsBPSys && (
                        <span className={cn('text-xs px-2 py-1 rounded', getVitalBg('bpSystolic', Number(vitalsBPSys)), getVitalColor('bpSystolic', Number(vitalsBPSys)))}>
                          SBP: {vitalsBPSys} mmHg
                        </span>
                      )}
                      {vitalsBPDia && (
                        <span className={cn('text-xs px-2 py-1 rounded', getVitalBg('bpDiastolic', Number(vitalsBPDia)), getVitalColor('bpDiastolic', Number(vitalsBPDia)))}>
                          DBP: {vitalsBPDia} mmHg
                        </span>
                      )}
                      {vitalsTemp && (
                        <span className={cn('text-xs px-2 py-1 rounded', getVitalBg('temperature', Number(vitalsTemp)), getVitalColor('temperature', Number(vitalsTemp)))}>
                          Temp: {vitalsTemp} F
                        </span>
                      )}
                      {vitalsO2 && (
                        <span className={cn('text-xs px-2 py-1 rounded', getVitalBg('o2Sat', Number(vitalsO2)), getVitalColor('o2Sat', Number(vitalsO2)))}>
                          SpO2: {vitalsO2}%
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* ============================================= */}
                {/* Care Plan Builder (Treatment type)            */}
                {/* ============================================= */}
                {formType === 'Treatment' && (
                  <div className="border border-purple-500/30 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-purple-400" />
                      <h3 className={cn(ds.heading3, 'text-purple-400')}>Care Plan Builder</h3>
                    </div>
                    {/* Add Goal */}
                    <div>
                      <label className={ds.label}>Add Goal</label>
                      <div className="flex gap-2">
                        <input value={newGoalName} onChange={e => setNewGoalName(e.target.value)} className={cn(ds.input, 'flex-1')} placeholder="Goal name" />
                        <input value={newGoalTarget} onChange={e => setNewGoalTarget(e.target.value)} className={cn(ds.input, 'w-32')} placeholder="Target" />
                        <button
                          onClick={() => { if (newGoalName) { setFormNotes(prev => prev + `\n[GOAL] ${newGoalName} -> ${newGoalTarget}`); setNewGoalName(''); setNewGoalTarget(''); } }}
                          className={cn(ds.btnSmall, 'bg-purple-500/20 text-purple-400 border border-purple-500/30')}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {/* Add Milestone */}
                    <div>
                      <label className={ds.label}>Add Milestone</label>
                      <div className="flex gap-2">
                        <input value={newMilestoneName} onChange={e => setNewMilestoneName(e.target.value)} className={cn(ds.input, 'flex-1')} placeholder="Milestone" />
                        <input type="date" value={newMilestoneDue} onChange={e => setNewMilestoneDue(e.target.value)} className={cn(ds.input, 'w-40')} />
                        <button
                          onClick={() => { if (newMilestoneName) { setFormNotes(prev => prev + `\n[MILESTONE] ${newMilestoneName} by ${newMilestoneDue}`); setNewMilestoneName(''); setNewMilestoneDue(''); } }}
                          className={cn(ds.btnSmall, 'bg-purple-500/20 text-purple-400 border border-purple-500/30')}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {/* Add Intervention */}
                    <div>
                      <label className={ds.label}>Add Intervention</label>
                      <div className="flex gap-2">
                        <input value={newIntervention} onChange={e => setNewIntervention(e.target.value)} className={cn(ds.input, 'flex-1')} placeholder="Intervention description" />
                        <button
                          onClick={() => { if (newIntervention) { setFormNotes(prev => prev + `\n[INTERVENTION] ${newIntervention}`); setNewIntervention(''); } }}
                          className={cn(ds.btnSmall, 'bg-purple-500/20 text-purple-400 border border-purple-500/30')}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {/* Outcome Measure */}
                    <div>
                      <label className={ds.label}>Outcome Measure</label>
                      <input className={ds.input} placeholder="e.g., Pain score 0-10, PHQ-9, FIM score" onChange={e => setFormNotes(prev => prev.replace(/\[OUTCOME\].*/, '') + `\n[OUTCOME] ${e.target.value}`)} />
                    </div>
                  </div>
                )}

                {/* Notes (always shown) */}
                <div>
                  <label className={ds.label}>Notes</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className={ds.textarea} rows={3} placeholder="Additional notes..." />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-lattice-border">
                <div className="flex items-center gap-2">
                  {editingItem && (
                    <button onClick={() => { handleDelete(editingItem.id); setShowEditor(false); }} className={ds.btnDanger}>
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                  {/* Quick domain actions in editor */}
                  {editingItem && (
                    <>
                      <button onClick={() => handleAction('generateSummary', editingItem.id)} className={cn(ds.btnGhost, 'text-xs')}>
                        <FileText className="w-3 h-3" /> Summary
                      </button>
                      <button onClick={() => handleAction('exportEncounter', editingItem.id)} className={cn(ds.btnGhost, 'text-xs')}>
                        <Download className="w-3 h-3" /> Export
                      </button>
                    </>
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
