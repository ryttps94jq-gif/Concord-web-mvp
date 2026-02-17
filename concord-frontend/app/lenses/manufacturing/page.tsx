'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import {
  ClipboardList, Layers, ShieldCheck, Cog, HardHat, Box,
  Plus, Search, Filter, X, Edit2, Trash2, AlertTriangle,
  Gauge, Calendar, ChevronRight, ChevronDown, Activity,
  Clock, Target, Wrench, TrendingUp, BarChart3, CheckCircle2,
  XCircle, FileText, Zap, Settings, Timer,
  Eye, PackageCheck, Truck,
  Calculator, CircleDot, ListChecks, Shield,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ModeTab = 'dashboard' | 'work_orders' | 'bom' | 'quality' | 'scheduling' | 'machines' | 'safety';
type ArtifactType = 'WorkOrder' | 'BOM' | 'QCInspection' | 'Schedule' | 'Machine' | 'SafetyItem';

type WOStatus = 'planned' | 'released' | 'in_progress' | 'qc' | 'complete';
type _QCDisposition = 'accept' | 'reject' | 'hold' | 'rework';
type MachineStatus = 'running' | 'idle' | 'maintenance' | 'down';
type _SafetyType = 'incident' | 'near_miss' | 'observation' | 'audit';
type _SafetySeverity = 'low' | 'medium' | 'high' | 'critical';

const WO_STATUSES: WOStatus[] = ['planned', 'released', 'in_progress', 'qc', 'complete'];
const SAFETY_STATUSES = ['reported', 'investigating', 'corrective_action', 'closed'] as const;
const GENERAL_STATUSES = ['active', 'inactive', 'draft', 'pending', 'review'] as const;
const MACHINE_STATUSES: MachineStatus[] = ['running', 'idle', 'maintenance', 'down'];

const STATUS_COLORS: Record<string, string> = {
  planned: 'gray-400', released: 'neon-blue', in_progress: 'neon-cyan',
  qc: 'amber-400', complete: 'green-400', shipped: 'neon-purple',
  reported: 'red-400', investigating: 'amber-400', corrective_action: 'neon-blue', closed: 'green-400',
  active: 'green-400', inactive: 'gray-500', draft: 'gray-400', pending: 'neon-blue', review: 'amber-400',
  running: 'green-400', idle: 'amber-400', maintenance: 'neon-blue', down: 'red-400',
  accept: 'green-400', reject: 'red-400', hold: 'amber-400', rework: 'neon-purple',
  low: 'green-400', medium: 'amber-400', high: 'red-400', critical: 'red-500',
};

const MODE_TABS: { id: ModeTab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'work_orders', label: 'Work Orders', icon: ClipboardList },
  { id: 'bom', label: 'BOM', icon: Layers },
  { id: 'quality', label: 'Quality', icon: ShieldCheck },
  { id: 'scheduling', label: 'Scheduling', icon: Calendar },
  { id: 'machines', label: 'Equipment', icon: Cog },
  { id: 'safety', label: 'Safety', icon: HardHat },
];

const ARTIFACT_FOR_TAB: Record<ModeTab, ArtifactType> = {
  dashboard: 'WorkOrder',
  work_orders: 'WorkOrder',
  bom: 'BOM',
  quality: 'QCInspection',
  scheduling: 'Schedule',
  machines: 'Machine',
  safety: 'SafetyItem',
};

// ---------------------------------------------------------------------------
// BOM Tree structure
// ---------------------------------------------------------------------------
interface BOMNode {
  id: string;
  part: string;
  partNumber: string;
  qtyPer: number;
  unitCost: number;
  children?: BOMNode[];
}

const BOM_TREE: BOMNode[] = [
  {
    id: 'asm-ha400', part: 'Hydraulic Actuator HA-400', partNumber: 'HA-400', qtyPer: 1, unitCost: 0,
    children: [
      {
        id: 'sub-cyl', part: 'Cylinder Assembly', partNumber: 'CYL-100', qtyPer: 1, unitCost: 45.00,
        children: [
          { id: 'cyl-tube', part: 'Cylinder Tube 4140', partNumber: 'PT-4421', qtyPer: 1, unitCost: 18.50 },
          { id: 'cyl-cap', part: 'End Cap Machined', partNumber: 'PT-4422', qtyPer: 2, unitCost: 6.25 },
          { id: 'cyl-seal', part: 'O-Ring Seal Viton', partNumber: 'PT-7891', qtyPer: 4, unitCost: 0.45 },
        ]
      },
      {
        id: 'sub-piston', part: 'Piston Assembly', partNumber: 'PIS-200', qtyPer: 1, unitCost: 32.00,
        children: [
          { id: 'pis-rod', part: 'Piston Rod Chrome', partNumber: 'PT-5501', qtyPer: 1, unitCost: 14.00 },
          { id: 'pis-head', part: 'Piston Head Forged', partNumber: 'PT-5502', qtyPer: 1, unitCost: 9.50 },
          { id: 'pis-ring', part: 'Piston Ring Set', partNumber: 'PT-5503', qtyPer: 1, unitCost: 4.25 },
        ]
      },
      {
        id: 'sub-valve', part: 'Valve Block', partNumber: 'VLV-300', qtyPer: 1, unitCost: 52.00,
        children: [
          { id: 'vlv-body', part: 'Valve Body AL6061', partNumber: 'PT-6601', qtyPer: 1, unitCost: 22.00 },
          { id: 'vlv-spool', part: 'Spool Valve', partNumber: 'PT-6602', qtyPer: 2, unitCost: 8.75 },
          { id: 'vlv-spring', part: 'Return Spring', partNumber: 'PT-6603', qtyPer: 2, unitCost: 1.20 },
        ]
      },
      { id: 'bsh-main', part: 'Bronze Bushing', partNumber: 'PT-2233', qtyPer: 2, unitCost: 8.90 },
      { id: 'hwd-bolts', part: 'Mounting Bolt Kit', partNumber: 'PT-9901', qtyPer: 1, unitCost: 3.50 },
    ]
  }
];

function calcBOMCost(node: BOMNode): number {
  if (!node.children || node.children.length === 0) return node.unitCost * node.qtyPer;
  return node.children.reduce((sum, child) => sum + calcBOMCost(child), 0) * node.qtyPer;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const SEED: Record<ArtifactType, Array<{ title: string; data: Record<string, unknown>; meta: Record<string, unknown> }>> = {
  WorkOrder: [
    { title: 'WO-2026-0201', data: { product: 'Hydraulic Actuator HA-400', qty: 250, line: 'Line A', priority: 'high', dueDate: '2026-02-15', completedQty: 80, bomRef: 'BOM-HA400 Rev C', routingSteps: ['CNC Machining', 'Assembly', 'Pressure Test', 'Paint', 'Pack'], currentStep: 1, scrapQty: 3, setupTime: 45 }, meta: { status: 'in_progress', tags: ['priority'] } },
    { title: 'WO-2026-0198', data: { product: 'Bearing Assembly BA-12', qty: 1000, line: 'Line B', priority: 'medium', dueDate: '2026-02-20', completedQty: 1000, bomRef: 'BOM-BA12 Rev A', routingSteps: ['Turning', 'Grinding', 'Assembly', 'QC Inspect'], currentStep: 4, scrapQty: 8, setupTime: 30 }, meta: { status: 'complete', tags: [] } },
    { title: 'WO-2026-0205', data: { product: 'Precision Gear PG-7', qty: 500, line: 'Line C', priority: 'high', dueDate: '2026-02-12', completedQty: 340, bomRef: 'BOM-PG7 Rev B', routingSteps: ['Hobbing', 'Heat Treat', 'Grinding', 'QC Inspect', 'Pack'], currentStep: 3, scrapQty: 12, setupTime: 60 }, meta: { status: 'qc', tags: ['urgent'] } },
    { title: 'WO-2026-0210', data: { product: 'Shaft Coupling SC-3', qty: 150, line: 'Line A', priority: 'low', dueDate: '2026-03-01', completedQty: 0, bomRef: 'BOM-SC3 Rev A', routingSteps: ['Turning', 'Milling', 'Assembly', 'Test'], currentStep: 0, scrapQty: 0, setupTime: 25 }, meta: { status: 'planned', tags: [] } },
    { title: 'WO-2026-0212', data: { product: 'Valve Block VB-50', qty: 300, line: 'Line B', priority: 'medium', dueDate: '2026-02-25', completedQty: 0, bomRef: 'BOM-VB50 Rev D', routingSteps: ['CNC Mill', 'Deburr', 'Anodize', 'Assembly', 'Test'], currentStep: 0, scrapQty: 0, setupTime: 55 }, meta: { status: 'released', tags: [] } },
  ],
  BOM: [
    { title: 'BOM-HA400 Rev C', data: { product: 'Hydraulic Actuator HA-400', revision: 'C', prevRevision: 'B', components: 14, levels: 3, totalCost: 186.50, approvedBy: 'J. Chen - Engineering', approvedDate: '2026-01-15', changeNote: 'Updated valve block specs per ECO-2026-044' }, meta: { status: 'active', tags: ['current'] } },
    { title: 'BOM-BA12 Rev A', data: { product: 'Bearing Assembly BA-12', revision: 'A', prevRevision: '-', components: 8, levels: 2, totalCost: 42.30, approvedBy: 'J. Chen - Engineering', approvedDate: '2025-11-20', changeNote: 'Initial release' }, meta: { status: 'active', tags: [] } },
    { title: 'BOM-PG7 Rev B', data: { product: 'Precision Gear PG-7', revision: 'B', prevRevision: 'A', components: 6, levels: 2, totalCost: 67.80, approvedBy: 'R. Singh - Engineering', approvedDate: '2026-01-28', changeNote: 'Material change: 8620 to 4340 steel' }, meta: { status: 'active', tags: [] } },
    { title: 'BOM-HA400 Rev B', data: { product: 'Hydraulic Actuator HA-400', revision: 'B', prevRevision: 'A', components: 13, levels: 3, totalCost: 178.20, approvedBy: 'J. Chen - Engineering', approvedDate: '2025-09-10', changeNote: 'Added secondary seal' }, meta: { status: 'inactive', tags: ['superseded'] } },
  ],
  QCInspection: [
    { title: 'QC-2026-0401', data: { workOrder: 'WO-2026-0205', product: 'Precision Gear PG-7', inspector: 'T. Nakamura', inspectionDate: '2026-02-11', sampleSize: 50, passCount: 47, failCount: 3, defectRate: 6.0, disposition: 'hold', defects: [{ type: 'Dimensional', severity: 'major', desc: 'OD out of tolerance +0.003"', rootCause: 'Tool wear' }, { type: 'Surface', severity: 'minor', desc: 'Surface finish Ra 64 vs spec Ra 32', rootCause: 'Feed rate' }, { type: 'Dimensional', severity: 'major', desc: 'Bore undersize -0.002"', rootCause: 'Tool wear' }], measurements: [{ param: 'OD', nominal: 2.500, tolerance: 0.001, actual: 2.503, pass: false }, { param: 'Bore ID', nominal: 1.000, tolerance: 0.001, actual: 0.998, pass: false }, { param: 'Face Width', nominal: 0.750, tolerance: 0.002, actual: 0.751, pass: true }, { param: 'Tooth Profile', nominal: 'Class 10', tolerance: 'AGMA', actual: 'Class 10', pass: true }] }, meta: { status: 'review', tags: ['critical'] } },
    { title: 'QC-2026-0399', data: { workOrder: 'WO-2026-0198', product: 'Bearing Assembly BA-12', inspector: 'R. Patel', inspectionDate: '2026-02-10', sampleSize: 100, passCount: 100, failCount: 0, defectRate: 0.0, disposition: 'accept', defects: [], measurements: [{ param: 'Bore ID', nominal: 12.000, tolerance: 0.005, actual: 12.002, pass: true }, { param: 'OD', nominal: 28.000, tolerance: 0.005, actual: 27.998, pass: true }, { param: 'Width', nominal: 8.000, tolerance: 0.010, actual: 8.003, pass: true }] }, meta: { status: 'active', tags: ['passed'] } },
    { title: 'QC-2026-0395', data: { workOrder: 'WO-2026-0201', product: 'Hydraulic Actuator HA-400', inspector: 'T. Nakamura', inspectionDate: '2026-02-09', sampleSize: 30, passCount: 29, failCount: 1, defectRate: 3.3, disposition: 'accept', defects: [{ type: 'Cosmetic', severity: 'minor', desc: 'Paint chip on housing', rootCause: 'Handling' }], measurements: [{ param: 'Pressure Test', nominal: 3000, tolerance: 50, actual: 3010, pass: true }, { param: 'Stroke Length', nominal: 6.000, tolerance: 0.010, actual: 5.998, pass: true }] }, meta: { status: 'active', tags: [] } },
  ],
  Schedule: [
    { title: 'SCH-Line A - Week 7', data: { line: 'Line A', week: '2026-W07', slots: [{ machine: 'CNC Mill #M-01', wo: 'WO-2026-0201', product: 'HA-400', startHr: 0, endHr: 8, day: 'Mon' }, { machine: 'CNC Mill #M-01', wo: 'WO-2026-0201', product: 'HA-400', startHr: 0, endHr: 8, day: 'Tue' }, { machine: 'CNC Mill #M-01', wo: 'WO-2026-0210', product: 'SC-3', startHr: 0, endHr: 6, day: 'Wed' }, { machine: 'Assembly #A-01', wo: 'WO-2026-0201', product: 'HA-400', startHr: 0, endHr: 8, day: 'Mon' }, { machine: 'Assembly #A-01', wo: 'WO-2026-0201', product: 'HA-400', startHr: 0, endHr: 8, day: 'Tue' }], capacityPct: 78, bottleneck: 'CNC Mill #M-01' }, meta: { status: 'active', tags: [] } },
    { title: 'SCH-Line B - Week 7', data: { line: 'Line B', week: '2026-W07', slots: [{ machine: 'Lathe #L-03', wo: 'WO-2026-0212', product: 'VB-50', startHr: 0, endHr: 8, day: 'Mon' }, { machine: 'Lathe #L-03', wo: 'WO-2026-0212', product: 'VB-50', startHr: 0, endHr: 8, day: 'Tue' }, { machine: 'Lathe #L-03', wo: 'WO-2026-0212', product: 'VB-50', startHr: 0, endHr: 6, day: 'Wed' }], capacityPct: 91, bottleneck: 'Lathe #L-03' }, meta: { status: 'active', tags: [] } },
    { title: 'SCH-Line C - Week 7', data: { line: 'Line C', week: '2026-W07', slots: [{ machine: 'Hobbing #H-01', wo: 'WO-2026-0205', product: 'PG-7', startHr: 0, endHr: 8, day: 'Mon' }, { machine: 'Hobbing #H-01', wo: 'WO-2026-0205', product: 'PG-7', startHr: 0, endHr: 8, day: 'Tue' }, { machine: 'Heat Treat #HT-01', wo: 'WO-2026-0205', product: 'PG-7', startHr: 0, endHr: 8, day: 'Wed' }], capacityPct: 45, bottleneck: 'Heat Treat #HT-01' }, meta: { status: 'active', tags: [] } },
  ],
  Machine: [
    { title: 'CNC Mill #M-01', data: { type: 'CNC 5-Axis', manufacturer: 'Haas', model: 'UMC-750', machineStatus: 'running', installDate: '2023-06-15', cycleTime: 4.2, hoursRun: 6.5, hoursAvail: 8, idealCycleTime: 4.0, totalParts: 155, goodParts: 150, availability: 92, performance: 88, quality: 96.8, oee: 78.4, nextMaintenance: '2026-02-20', maintenanceType: 'Spindle bearing inspection', downtimeLog: [{ date: '2026-02-08', duration: 45, reason: 'Tool change delay' }, { date: '2026-02-05', duration: 120, reason: 'Coolant pump failure' }] }, meta: { status: 'active', tags: ['line-a'] } },
    { title: 'Lathe #L-03', data: { type: 'CNC Lathe', manufacturer: 'Mazak', model: 'QT-250', machineStatus: 'running', installDate: '2022-01-10', cycleTime: 2.8, hoursRun: 7.2, hoursAvail: 8, idealCycleTime: 2.5, totalParts: 310, goodParts: 305, availability: 95, performance: 91, quality: 98.4, oee: 85.1, nextMaintenance: '2026-02-18', maintenanceType: 'Chuck jaw replacement', downtimeLog: [{ date: '2026-02-10', duration: 30, reason: 'Material changeover' }] }, meta: { status: 'active', tags: ['line-b'] } },
    { title: 'Press #P-02', data: { type: 'Hydraulic Press', manufacturer: 'Schuler', model: 'TBS-200', machineStatus: 'maintenance', installDate: '2021-09-20', cycleTime: 1.5, hoursRun: 0, hoursAvail: 8, idealCycleTime: 1.2, totalParts: 0, goodParts: 0, availability: 0, performance: 0, quality: 0, oee: 0, nextMaintenance: '2026-02-12', maintenanceType: 'Hydraulic seal replacement', downtimeLog: [{ date: '2026-02-11', duration: 480, reason: 'Hydraulic seal failure' }, { date: '2026-02-10', duration: 60, reason: 'Pressure fluctuation investigation' }] }, meta: { status: 'inactive', tags: ['maintenance'] } },
    { title: 'Hobbing #H-01', data: { type: 'Gear Hobbing', manufacturer: 'Gleason', model: 'Genesis 210H', machineStatus: 'running', installDate: '2024-03-01', cycleTime: 6.5, hoursRun: 5.8, hoursAvail: 8, idealCycleTime: 6.0, totalParts: 88, goodParts: 85, availability: 88, performance: 84, quality: 96.6, oee: 71.3, nextMaintenance: '2026-03-01', maintenanceType: 'Hob cutter inspection', downtimeLog: [] }, meta: { status: 'active', tags: ['line-c'] } },
    { title: 'Assembly #A-01', data: { type: 'Assembly Station', manufacturer: 'Custom', model: 'AS-400', machineStatus: 'idle', installDate: '2023-01-15', cycleTime: 12.0, hoursRun: 4.0, hoursAvail: 8, idealCycleTime: 10.0, totalParts: 32, goodParts: 31, availability: 75, performance: 80, quality: 96.9, oee: 58.1, nextMaintenance: '2026-02-28', maintenanceType: 'Torque wrench calibration', downtimeLog: [{ date: '2026-02-11', duration: 90, reason: 'Waiting for parts from CNC' }] }, meta: { status: 'active', tags: ['line-a'] } },
  ],
  SafetyItem: [
    { title: 'SI-2026-012 Near Miss - Line A', data: { incidentType: 'near_miss', location: 'Line A, Station 4', reportedBy: 'J. Hernandez', reportDate: '2026-02-10', description: 'Unsecured tooling fell from overhead rack', severity: 'medium', rootCause: 'Improper storage of tooling on overhead rack', correctiveAction: 'Install retention clips on all overhead racks', dueDate: '2026-02-20', oshaRecordable: false, lostTimeDays: 0, trainingRequired: 'Tool Storage Safety Refresher' }, meta: { status: 'investigating', tags: ['open'] } },
    { title: 'SI-2026-008 PPE Violation', data: { incidentType: 'observation', location: 'Welding Bay 2', reportedBy: 'M. Brown', reportDate: '2026-02-07', description: 'Employee missing face shield during grinding', severity: 'low', rootCause: 'PPE not readily accessible at station', correctiveAction: 'Install PPE dispensers at each welding bay', dueDate: '2026-02-14', oshaRecordable: false, lostTimeDays: 0, trainingRequired: 'PPE Compliance Training' }, meta: { status: 'corrective_action', tags: [] } },
    { title: 'SI-2026-003 Slip Incident', data: { incidentType: 'incident', location: 'Loading Dock', reportedBy: 'S. Kim', reportDate: '2026-01-28', description: 'Employee slipped on coolant leak near dock entrance, minor ankle sprain', severity: 'high', rootCause: 'Coolant line fitting failure, no drip pan installed', correctiveAction: 'Replaced fitting, installed drip pans, added non-slip mats', dueDate: '2026-02-05', oshaRecordable: true, lostTimeDays: 2, trainingRequired: 'Spill Response Procedure' }, meta: { status: 'closed', tags: ['resolved'] } },
    { title: 'SI-2026-015 Audit Finding', data: { incidentType: 'audit', location: 'Paint Booth 1', reportedBy: 'Safety Committee', reportDate: '2026-02-11', description: 'Fire extinguisher expired, ventilation filter overdue for replacement', severity: 'medium', rootCause: 'Missed maintenance schedule item', correctiveAction: 'Replace extinguisher and filters, update PM schedule', dueDate: '2026-02-15', oshaRecordable: false, lostTimeDays: 0, trainingRequired: 'Fire Safety Awareness' }, meta: { status: 'reported', tags: ['audit'] } },
  ],
};

// ---------------------------------------------------------------------------
// Dashboard metric helpers
// ---------------------------------------------------------------------------
function computeDashboardMetrics() {
  const wos = SEED.WorkOrder;
  const machines = SEED.Machine;
  const qcs = SEED.QCInspection;
  const safety = SEED.SafetyItem;

  const unitsToday = wos.reduce((s, w) => s + (w.data.completedQty as number), 0);
  const openWOs = wos.filter(w => w.meta.status !== 'complete').length;
  const totalQCSamples = qcs.reduce((s, q) => s + (q.data.sampleSize as number), 0);
  const totalQCPass = qcs.reduce((s, q) => s + (q.data.passCount as number), 0);
  const qcPassRate = totalQCSamples > 0 ? ((totalQCPass / totalQCSamples) * 100) : 0;
  const activeMachines = machines.filter(m => (m.data.machineStatus as string) !== 'maintenance');
  const avgOEE = activeMachines.length > 0
    ? activeMachines.reduce((s, m) => s + (m.data.oee as number), 0) / activeMachines.length
    : 0;
  const safetyMTD = safety.filter(s => s.meta.status !== 'closed').length;
  const oshaRecordables = safety.filter(s => s.data.oshaRecordable === true).length;
  const onTimeWOs = wos.filter(w => {
    if (w.meta.status !== 'complete') return false;
    return true;
  }).length;
  const totalDueWOs = wos.filter(w => w.meta.status === 'complete' || new Date(w.data.dueDate as string) <= new Date()).length;
  const onTimeRate = totalDueWOs > 0 ? ((onTimeWOs / totalDueWOs) * 100) : 100;
  const totalLostDays = safety.reduce((s, si) => s + (si.data.lostTimeDays as number), 0);

  return { unitsToday, openWOs, qcPassRate, avgOEE, safetyMTD, oshaRecordables, onTimeRate, totalLostDays };
}

// ---------------------------------------------------------------------------
// BOM Tree Component
// ---------------------------------------------------------------------------
function BOMTreeNode({ node, depth = 0 }: { node: BOMNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const rollupCost = calcBOMCost(node);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded hover:bg-lattice-elevated/50 cursor-pointer',
          depth === 0 && 'bg-lattice-elevated/30'
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        ) : (
          <CircleDot className="w-3 h-3 text-gray-600 flex-shrink-0 ml-0.5" />
        )}
        <span className={cn('text-sm flex-1', depth === 0 ? 'font-semibold text-white' : 'text-gray-300')}>{node.part}</span>
        <span className={cn(ds.textMono, 'text-xs text-gray-500 w-20')}>{node.partNumber}</span>
        <span className="text-xs text-gray-400 w-12 text-right">{node.qtyPer}x</span>
        <span className="text-xs text-neon-cyan w-20 text-right font-mono">${rollupCost.toFixed(2)}</span>
      </div>
      {expanded && hasChildren && node.children!.map(child => (
        <BOMTreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OEE Gauge component
// ---------------------------------------------------------------------------
function OEEGauge({ value, label, size = 'md' }: { value: number; label: string; size?: 'sm' | 'md' }) {
  const color = value >= 85 ? 'text-green-400' : value >= 65 ? 'text-amber-400' : 'text-red-400';
  const _bgColor = value >= 85 ? 'bg-green-400' : value >= 65 ? 'bg-amber-400' : 'bg-red-400';
  const dim = size === 'sm' ? 'w-16 h-16' : 'w-20 h-20';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('relative rounded-full flex items-center justify-center', dim)}>
        <svg className="absolute inset-0" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-lattice-border"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${value}, 100`}
            className={color}
            strokeLinecap="round"
          />
        </svg>
        <span className={cn('text-sm font-bold', color)}>{value.toFixed(0)}%</span>
      </div>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule Timeline mini-component
// ---------------------------------------------------------------------------
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_COLORS = ['bg-neon-blue/40', 'bg-neon-cyan/40', 'bg-neon-purple/40', 'bg-green-400/40', 'bg-amber-400/40'];

function ScheduleTimeline({ schedule }: { schedule: LensItem }) {
  const data = schedule.data as Record<string, unknown>;
  const slots = (data.slots as Array<Record<string, unknown>>) || [];
  const machines = [...new Set(slots.map(s => s.machine as string))];
  const capacityPct = data.capacityPct as number;
  const bottleneck = data.bottleneck as string;

  return (
    <div className={ds.panel}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className={ds.heading3}>{schedule.title}</h3>
          <p className={ds.textMuted}>{data.line as string} - {data.week as string}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className={cn('text-lg font-bold', capacityPct > 85 ? 'text-red-400' : capacityPct > 60 ? 'text-amber-400' : 'text-green-400')}>{capacityPct}%</span>
            <p className={ds.textMuted}>Capacity</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {machines.map(machine => {
          const machineSlots = slots.filter(s => s.machine === machine);
          return (
            <div key={machine} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-32 truncate" title={machine}>{machine}</span>
              <div className="flex-1 flex gap-0.5">
                {DAYS.map((day, di) => {
                  const slot = machineSlots.find(s => s.day === day);
                  return (
                    <div key={day} className="flex-1 h-7 rounded relative" title={slot ? `${slot.wo} - ${slot.product}` : 'Available'}>
                      <div className={cn('h-full rounded', slot ? DAY_COLORS[di % DAY_COLORS.length] : 'bg-lattice-elevated/30')} style={slot ? { width: `${((slot.endHr as number) / 8) * 100}%` } : { width: '100%' }}>
                        {slot && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white/80 truncate px-1">{slot.product as string}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1 mt-2">
        {DAYS.map((day, i) => (
          <div key={day} className="flex-1 text-center">
            <span className="text-[10px] text-gray-500" style={{ marginLeft: i === 0 ? '136px' : '0' }}>{day}</span>
          </div>
        ))}
      </div>
      {bottleneck && (
        <div className="mt-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-amber-400">Bottleneck: {bottleneck}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ManufacturingLensPage() {
  useLensNav('manufacturing');

  const [mode, setMode] = useState<ModeTab>('dashboard');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [detailItem, setDetailItem] = useState<string | null>(null);
  const [showBOMTree, setShowBOMTree] = useState(false);
  const [showOEECalc, setShowOEECalc] = useState(false);
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  // Editor form state
  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState('active');
  const [formFields, setFormFields] = useState<Record<string, string>>({});

  // OEE Calculator state
  const [oeeAvail, setOeeAvail] = useState('90');
  const [oeePerf, setOeePerf] = useState('85');
  const [oeeQual, setOeeQual] = useState('95');

  const currentType = ARTIFACT_FOR_TAB[mode];

  const { items, isLoading, isError, error, refetch, create, update, remove } = useLensData('manufacturing', currentType, {
    seed: SEED[currentType],
  });

  const runAction = useRunArtifact('manufacturing');

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

  const statusOptions = mode === 'work_orders' ? WO_STATUSES
    : mode === 'safety' ? SAFETY_STATUSES
    : mode === 'machines' ? MACHINE_STATUSES
    : GENERAL_STATUSES;

  const resetForm = useCallback(() => {
    setFormTitle('');
    setFormStatus('active');
    setFormFields({});
    setEditing(null);
    setShowEditor(false);
  }, []);

  const openCreate = useCallback(() => {
    resetForm();
    setShowEditor(true);
  }, [resetForm]);

  const openEdit = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setEditing(id);
    setFormTitle(item.title);
    setFormStatus(item.meta?.status || 'active');
    const fields: Record<string, string> = {};
    Object.entries(item.data as Record<string, unknown>).forEach(([k, v]) => {
      if (typeof v !== 'object') fields[k] = String(v ?? '');
    });
    setFormFields(fields);
    setShowEditor(true);
  }, [items]);

  const handleSave = useCallback(async () => {
    const data: Record<string, unknown> = { ...formFields };
    if (editing) {
      await update(editing, { title: formTitle, data, meta: { status: formStatus } });
    } else {
      await create({ title: formTitle, data, meta: { status: formStatus } });
    }
    resetForm();
  }, [editing, formTitle, formFields, formStatus, create, update, resetForm]);

  const handleAction = useCallback(async (action: string, artifactId?: string) => {
    const targetId = artifactId || editing || filtered[0]?.id;
    if (!targetId) return;
    try {
      const result = await runAction.mutateAsync({ id: targetId, action });
      setActionResult(result.result as Record<string, unknown>);
    } catch (err) {
      console.error('Action failed:', err);
    }
  }, [editing, filtered, runAction]);

  const fieldConfig: Record<ModeTab, Array<{ key: string; label: string; type?: 'text' | 'textarea' | 'select'; options?: string[] }>> = {
    dashboard: [],
    work_orders: [
      { key: 'product', label: 'Product' },
      { key: 'qty', label: 'Quantity' },
      { key: 'line', label: 'Production Line' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high'] },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'bomRef', label: 'BOM Reference' },
    ],
    bom: [
      { key: 'product', label: 'Product' },
      { key: 'revision', label: 'Revision' },
      { key: 'components', label: 'Component Count' },
      { key: 'totalCost', label: 'Total Cost ($)' },
      { key: 'approvedBy', label: 'Approved By' },
      { key: 'changeNote', label: 'Change Note', type: 'textarea' },
    ],
    quality: [
      { key: 'workOrder', label: 'Work Order' },
      { key: 'inspector', label: 'Inspector' },
      { key: 'sampleSize', label: 'Sample Size' },
      { key: 'passCount', label: 'Pass Count' },
      { key: 'failCount', label: 'Fail Count' },
      { key: 'disposition', label: 'Disposition', type: 'select', options: ['accept', 'reject', 'hold', 'rework'] },
    ],
    scheduling: [
      { key: 'line', label: 'Production Line' },
      { key: 'week', label: 'Week' },
      { key: 'capacityPct', label: 'Capacity %' },
      { key: 'bottleneck', label: 'Bottleneck' },
    ],
    machines: [
      { key: 'type', label: 'Machine Type' },
      { key: 'manufacturer', label: 'Manufacturer' },
      { key: 'model', label: 'Model' },
      { key: 'machineStatus', label: 'Status', type: 'select', options: ['running', 'idle', 'maintenance', 'down'] },
      { key: 'nextMaintenance', label: 'Next Maintenance' },
      { key: 'maintenanceType', label: 'Maintenance Type' },
    ],
    safety: [
      { key: 'incidentType', label: 'Type', type: 'select', options: ['incident', 'near_miss', 'observation', 'audit'] },
      { key: 'location', label: 'Location' },
      { key: 'reportedBy', label: 'Reported By' },
      { key: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'correctiveAction', label: 'Corrective Action', type: 'textarea' },
    ],
  };

  // Dashboard metrics
  const metrics = useMemo(() => computeDashboardMetrics(), []);
  const oeeCalcResult = useMemo(() => {
    const a = parseFloat(oeeAvail) || 0;
    const p = parseFloat(oeePerf) || 0;
    const q = parseFloat(oeeQual) || 0;
    return (a * p * q) / 10000;
  }, [oeeAvail, oeePerf, oeeQual]);

  // First pass yield from QC data
  const firstPassYield = useMemo(() => {
    const qcs = SEED.QCInspection;
    const totalSamples = qcs.reduce((s, q) => s + (q.data.sampleSize as number), 0);
    const totalPass = qcs.reduce((s, q) => s + (q.data.passCount as number), 0);
    return totalSamples > 0 ? ((totalPass / totalSamples) * 100) : 0;
  }, []);

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Dashboard
  // ---------------------------------------------------------------------------
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1">
            <PackageCheck className="w-4 h-4 text-neon-cyan" />
            <span className={ds.textMuted}>Units Produced</span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics.unitsToday.toLocaleString()}</p>
          <p className="text-xs text-green-400 mt-1">+12% vs yesterday</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1">
            <Gauge className="w-4 h-4 text-green-400" />
            <span className={ds.textMuted}>Avg OEE</span>
          </div>
          <p className={cn('text-2xl font-bold', metrics.avgOEE >= 85 ? 'text-green-400' : metrics.avgOEE >= 65 ? 'text-amber-400' : 'text-red-400')}>
            {metrics.avgOEE.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">World-class: 85%+</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-4 h-4 text-neon-blue" />
            <span className={ds.textMuted}>Open Work Orders</span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics.openWOs}</p>
          <p className="text-xs text-amber-400 mt-1">1 overdue</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-neon-purple" />
            <span className={ds.textMuted}>QC Pass Rate</span>
          </div>
          <p className={cn('text-2xl font-bold', metrics.qcPassRate >= 95 ? 'text-green-400' : 'text-amber-400')}>
            {metrics.qcPassRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">First pass yield: {firstPassYield.toFixed(1)}%</p>
        </div>
      </div>

      <div className={ds.grid4}>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1">
            <HardHat className="w-4 h-4 text-red-400" />
            <span className={ds.textMuted}>Safety Incidents MTD</span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics.safetyMTD}</p>
          <p className="text-xs text-gray-500 mt-1">OSHA recordable: {metrics.oshaRecordables}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4 text-green-400" />
            <span className={ds.textMuted}>On-Time Delivery</span>
          </div>
          <p className={cn('text-2xl font-bold', metrics.onTimeRate >= 95 ? 'text-green-400' : 'text-amber-400')}>
            {metrics.onTimeRate.toFixed(0)}%
          </p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className={ds.textMuted}>Lost Time Days</span>
          </div>
          <p className="text-2xl font-bold text-white">{metrics.totalLostDays}</p>
          <p className="text-xs text-gray-500 mt-1">MTD incident rate</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-neon-cyan" />
            <span className={ds.textMuted}>Machine Uptime</span>
          </div>
          <p className="text-2xl font-bold text-green-400">87.5%</p>
          <p className="text-xs text-gray-500 mt-1">4/5 machines running</p>
        </div>
      </div>

      {/* Line Utilization + Quality Trend */}
      <div className={ds.grid2}>
        <div className={ds.panel}>
          <h3 className={ds.heading3 + ' mb-3'}>Production Line Utilization</h3>
          {[
            { line: 'Line A', util: 78, machines: 2, wo: 'WO-0201' },
            { line: 'Line B', util: 91, machines: 1, wo: 'WO-0212' },
            { line: 'Line C', util: 45, machines: 1, wo: 'WO-0205' },
          ].map(l => (
            <div key={l.line} className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">{l.line} <span className="text-gray-600">({l.machines} machines, {l.wo})</span></span>
                <span className={cn(l.util > 80 ? 'text-green-400' : l.util > 60 ? 'text-amber-400' : 'text-red-400')}>{l.util}%</span>
              </div>
              <div className="w-full h-2.5 bg-lattice-elevated rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', l.util > 80 ? 'bg-green-400' : l.util > 60 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${l.util}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className={ds.panel}>
          <h3 className={ds.heading3 + ' mb-3'}>Quality Trend (Last 7 Days)</h3>
          <div className="h-32 flex items-end gap-1.5">
            {[
              { day: 'Mon', rate: 98.2 }, { day: 'Tue', rate: 97.5 },
              { day: 'Wed', rate: 99.1 }, { day: 'Thu', rate: 94.0 },
              { day: 'Fri', rate: 96.8 }, { day: 'Sat', rate: 98.5 },
              { day: 'Sun', rate: 97.9 },
            ].map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className={cn('text-xs', d.rate < 95 ? 'text-red-400' : 'text-gray-400')}>{d.rate}%</span>
                <div
                  className={cn('w-full rounded-t transition-all', d.rate < 95 ? 'bg-red-400' : 'bg-neon-cyan/60')}
                  style={{ height: `${(d.rate - 90) * 10}%` }}
                />
                <span className="text-[10px] text-gray-600">{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Machine OEE Overview */}
      <div className={ds.panel}>
        <h3 className={ds.heading3 + ' mb-4'}>Equipment OEE Overview</h3>
        <div className="flex flex-wrap items-center justify-around gap-4">
          {SEED.Machine.map(m => {
            const oee = m.data.oee as number;
            const status = m.data.machineStatus as string;
            return (
              <div key={m.title} className="flex flex-col items-center gap-2">
                <OEEGauge value={oee} label="" />
                <span className="text-xs text-white font-medium">{m.title}</span>
                <span className={ds.badge(STATUS_COLORS[status] || 'gray-400')}>{status}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Work Orders */}
      <div className={ds.panel}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={ds.heading3}>Recent Work Orders</h3>
          <button onClick={() => setMode('work_orders')} className={ds.btnGhost}>
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left border-b border-lattice-border">
                <th className="pb-2 pr-4 font-medium">WO #</th>
                <th className="pb-2 pr-4 font-medium">Product</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Progress</th>
                <th className="pb-2 pr-4 font-medium">Due Date</th>
                <th className="pb-2 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody>
              {SEED.WorkOrder.map(wo => {
                const pct = (wo.data.qty as number) > 0 ? ((wo.data.completedQty as number) / (wo.data.qty as number)) * 100 : 0;
                const status = wo.meta.status as string;
                const priority = wo.data.priority as string;
                return (
                  <tr key={wo.title} className="border-b border-lattice-border/50 hover:bg-lattice-elevated/30">
                    <td className="py-2 pr-4 font-mono text-neon-cyan">{wo.title}</td>
                    <td className="py-2 pr-4 text-gray-300">{wo.data.product as string}</td>
                    <td className="py-2 pr-4"><span className={ds.badge(STATUS_COLORS[status])}>{status.replace(/_/g, ' ')}</span></td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-lattice-elevated rounded-full overflow-hidden">
                          <div className="h-full bg-neon-cyan rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-gray-400">{wo.data.dueDate as string}</td>
                    <td className="py-2">
                      <span className={ds.badge(priority === 'high' ? 'red-400' : priority === 'medium' ? 'amber-400' : 'gray-400')}>{priority}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Work Orders
  // ---------------------------------------------------------------------------
  const renderWorkOrders = () => (
    <div className="space-y-4">
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Box className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className={ds.textMuted}>No work orders found</p>
          <button onClick={openCreate} className={cn(ds.btnGhost, 'mt-3')}><Plus className="w-4 h-4" /> Create one</button>
        </div>
      ) : (
        filtered.map(item => {
          const d = item.data as Record<string, unknown>;
          const status = (item.meta?.status || 'planned') as string;
          const pct = (d.qty as number) > 0 ? ((d.completedQty as number) / (d.qty as number)) * 100 : 0;
          const steps = (d.routingSteps as string[]) || [];
          const currentStep = (d.currentStep as number) || 0;
          const isDetail = detailItem === item.id;

          return (
            <div key={item.id} className={cn(ds.panel, 'hover:border-neon-cyan/30 transition-colors')}>
              <div className="flex items-start justify-between mb-3 cursor-pointer" onClick={() => setDetailItem(isDetail ? null : item.id)}>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className={ds.heading3}>{item.title}</h3>
                    <span className={ds.badge(STATUS_COLORS[status])}>{status.replace(/_/g, ' ')}</span>
                    {d.priority === 'high' && <span className={ds.badge('red-400')}>HIGH</span>}
                  </div>
                  <p className="text-gray-300">{d.product as string}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); openEdit(item.id); }} className={ds.btnGhost}><Edit2 className="w-4 h-4" /></button>
                  <button onClick={e => { e.stopPropagation(); remove(item.id); }} className={cn(ds.btnGhost, 'hover:text-red-400')}><Trash2 className="w-4 h-4" /></button>
                  {isDetail ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Completion: {(d.completedQty as number).toLocaleString()} / {(d.qty as number).toLocaleString()} units</span>
                  <span className="font-mono">{pct.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2.5 bg-lattice-elevated rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', status === 'complete' ? 'bg-green-400' : 'bg-neon-cyan')} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>

              {/* Quick info row */}
              <div className="flex flex-wrap gap-4 text-sm">
                <span className={ds.textMuted}><Calendar className="w-3.5 h-3.5 inline mr-1" />Due: {d.dueDate as string}</span>
                <span className={ds.textMuted}><Settings className="w-3.5 h-3.5 inline mr-1" />{d.line as string}</span>
                <span className={ds.textMuted}><FileText className="w-3.5 h-3.5 inline mr-1" />{d.bomRef as string}</span>
                <span className={ds.textMuted}><Timer className="w-3.5 h-3.5 inline mr-1" />Setup: {d.setupTime as number}min</span>
                {(d.scrapQty as number) > 0 && (
                  <span className="text-sm text-red-400"><XCircle className="w-3.5 h-3.5 inline mr-1" />Scrap: {d.scrapQty as number}</span>
                )}
              </div>

              {/* Expanded detail */}
              {isDetail && (
                <div className="mt-4 pt-4 border-t border-lattice-border">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">Routing Steps</h4>
                  <div className="flex items-center gap-1 flex-wrap">
                    {steps.map((step, idx) => {
                      const isComplete = idx < currentStep;
                      const isCurrent = idx === currentStep;
                      return (
                        <div key={idx} className="flex items-center gap-1">
                          <div className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                            isComplete && 'bg-green-400/20 border-green-400/40 text-green-400',
                            isCurrent && 'bg-neon-cyan/20 border-neon-cyan/40 text-neon-cyan animate-pulse',
                            !isComplete && !isCurrent && 'bg-lattice-elevated border-lattice-border text-gray-500'
                          )}>
                            {isComplete ? <CheckCircle2 className="w-3 h-3" /> : isCurrent ? <Activity className="w-3 h-3" /> : <CircleDot className="w-3 h-3" />}
                            {step}
                          </div>
                          {idx < steps.length - 1 && <ChevronRight className="w-3 h-3 text-gray-600" />}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button onClick={() => handleAction('advanceStep', item.id)} className={cn(ds.btnPrimary, ds.btnSmall)}>
                      <Zap className="w-3.5 h-3.5" /> Advance Step
                    </button>
                    <button onClick={() => handleAction('generateTraveler', item.id)} className={cn(ds.btnSecondary, ds.btnSmall)}>
                      <FileText className="w-3.5 h-3.5" /> Print Traveler
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: BOM
  // ---------------------------------------------------------------------------
  const renderBOM = () => (
    <div className="space-y-4">
      {/* BOM Tree Viewer */}
      <div className={ds.panel}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={ds.heading3}>Multi-Level BOM Tree: Hydraulic Actuator HA-400</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBOMTree(!showBOMTree)} className={ds.btnSecondary}>
              {showBOMTree ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {showBOMTree ? 'Collapse' : 'Expand'} Tree
            </button>
          </div>
        </div>
        {showBOMTree && (
          <div className="border border-lattice-border rounded-lg p-2">
            <div className="flex items-center gap-4 text-xs text-gray-500 pb-2 mb-2 border-b border-lattice-border px-2">
              <span className="flex-1">Component</span>
              <span className="w-20">Part #</span>
              <span className="w-12 text-right">Qty</span>
              <span className="w-20 text-right">Cost Rollup</span>
            </div>
            {BOM_TREE.map(node => (
              <BOMTreeNode key={node.id} node={node} />
            ))}
            <div className="mt-3 pt-3 border-t border-lattice-border flex items-center justify-between px-2">
              <span className="text-sm font-semibold text-white">Total BOM Cost</span>
              <span className="text-lg font-bold text-neon-cyan font-mono">${calcBOMCost(BOM_TREE[0]).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* BOM Comparison */}
      <div className={ds.panel}>
        <h3 className={ds.heading3 + ' mb-3'}>BOM Revision Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left border-b border-lattice-border">
                <th className="pb-2 pr-4 font-medium">Attribute</th>
                <th className="pb-2 pr-4 font-medium">Rev B (Previous)</th>
                <th className="pb-2 pr-4 font-medium">Rev C (Current)</th>
                <th className="pb-2 font-medium">Delta</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {[
                { attr: 'Components', revB: '13', revC: '14', delta: '+1', color: 'text-amber-400' },
                { attr: 'Total Cost', revB: '$178.20', revC: '$186.50', delta: '+$8.30', color: 'text-red-400' },
                { attr: 'Valve Block Spec', revB: 'VLV-300 Rev A', revC: 'VLV-300 Rev B', delta: 'Changed', color: 'text-neon-blue' },
                { attr: 'Secondary Seal', revB: 'Added', revC: 'Retained', delta: 'No change', color: 'text-gray-500' },
                { attr: 'Approved', revB: '2025-09-10', revC: '2026-01-15', delta: '-', color: 'text-gray-500' },
              ].map(row => (
                <tr key={row.attr} className="border-b border-lattice-border/30">
                  <td className="py-2 pr-4 text-gray-400">{row.attr}</td>
                  <td className="py-2 pr-4">{row.revB}</td>
                  <td className="py-2 pr-4 font-medium">{row.revC}</td>
                  <td className={cn('py-2 font-medium', row.color)}>{row.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOM List */}
      <div className={ds.grid2}>
        {filtered.map(item => {
          const d = item.data as Record<string, unknown>;
          const status = item.meta?.status || 'active';
          return (
            <div key={item.id} className={ds.panelHover} onClick={() => openEdit(item.id)}>
              <div className="flex items-start justify-between mb-2">
                <h3 className={cn(ds.heading3, 'truncate flex-1')}>{item.title}</h3>
                <span className={ds.badge(STATUS_COLORS[status as string])}>{(status as string).replace(/_/g, ' ')}</span>
              </div>
              <div className="space-y-1 text-sm">
                <p className={ds.textMuted}>Product: <span className="text-gray-300">{d.product as string}</span></p>
                <p className={ds.textMuted}>Revision: <span className="text-white font-mono">{d.revision as string}</span> {d.prevRevision !== '-' && <span className="text-gray-600">(prev: {d.prevRevision as string})</span>}</p>
                <p className={ds.textMuted}>Components: <span className="text-white">{String(d.components)}</span> across <span className="text-white">{String(d.levels)}</span> levels</p>
                <p className={ds.textMuted}>Cost: <span className="text-neon-cyan font-mono">${(d.totalCost as number).toFixed(2)}</span></p>
                <p className={ds.textMuted}>Approved: <span className="text-gray-300">{d.approvedBy as string}</span></p>
              </div>
              {Boolean(d.changeNote) && (
                <div className="mt-2 p-2 bg-lattice-elevated/50 rounded text-xs text-gray-400">
                  <FileText className="w-3 h-3 inline mr-1" />{d.changeNote as string}
                </div>
              )}
              <div className="flex items-center justify-end gap-1 pt-2 mt-2 border-t border-lattice-border">
                <button onClick={e => { e.stopPropagation(); openEdit(item.id); }} className={ds.btnGhost}><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={e => { e.stopPropagation(); remove(item.id); }} className={cn(ds.btnGhost, 'hover:text-red-400')}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Quality Control
  // ---------------------------------------------------------------------------
  const renderQuality = () => (
    <div className="space-y-4">
      {/* QC Summary */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 text-green-400" /><span className={ds.textMuted}>First Pass Yield</span></div>
          <p className="text-2xl font-bold text-green-400">{firstPassYield.toFixed(1)}%</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><ListChecks className="w-4 h-4 text-neon-blue" /><span className={ds.textMuted}>Inspections MTD</span></div>
          <p className="text-2xl font-bold text-white">{SEED.QCInspection.length}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><XCircle className="w-4 h-4 text-red-400" /><span className={ds.textMuted}>Total Defects</span></div>
          <p className="text-2xl font-bold text-red-400">{SEED.QCInspection.reduce((s, q) => s + (q.data.failCount as number), 0)}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-1"><BarChart3 className="w-4 h-4 text-neon-purple" /><span className={ds.textMuted}>SPC Status</span></div>
          <p className="text-lg font-bold text-amber-400">1 OOC</p>
          <p className="text-xs text-gray-500">PG-7 OD dimension</p>
        </div>
      </div>

      {/* Inspection Cards */}
      {filtered.map(item => {
        const d = item.data as Record<string, unknown>;
        const status = item.meta?.status || 'active';
        const disposition = d.disposition as string;
        const defects = (d.defects as Array<Record<string, unknown>>) || [];
        const measurements = (d.measurements as Array<Record<string, unknown>>) || [];
        const isDetail = detailItem === item.id;

        return (
          <div key={item.id} className={ds.panel}>
            <div className="flex items-start justify-between mb-3 cursor-pointer" onClick={() => setDetailItem(isDetail ? null : item.id)}>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className={ds.heading3}>{item.title}</h3>
                  <span className={ds.badge(STATUS_COLORS[disposition] || 'gray-400')}>{disposition}</span>
                  <span className={ds.badge(STATUS_COLORS[status as string] || 'gray-400')}>{(status as string).replace(/_/g, ' ')}</span>
                </div>
                <p className={ds.textMuted}>{d.product as string} - {d.workOrder as string}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); openEdit(item.id); }} className={ds.btnGhost}><Edit2 className="w-4 h-4" /></button>
                {isDetail ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
              </div>
            </div>

            {/* Pass / Fail bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Inspector: {d.inspector as string} | Date: {d.inspectionDate as string}</span>
                <span className="text-gray-400">Sample: {String(d.sampleSize)} | Defect Rate: {(d.defectRate as number).toFixed(1)}%</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden">
                <div className="bg-green-400 transition-all" style={{ width: `${((d.passCount as number) / (d.sampleSize as number)) * 100}%` }} />
                <div className="bg-red-400 transition-all" style={{ width: `${((d.failCount as number) / (d.sampleSize as number)) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-green-400">{d.passCount as number} passed</span>
                <span className="text-red-400">{d.failCount as number} failed</span>
              </div>
            </div>

            {isDetail && (
              <div className="space-y-4 mt-4 pt-4 border-t border-lattice-border">
                {/* Measurements vs Tolerances */}
                {measurements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Measurements vs Tolerances</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 text-left border-b border-lattice-border">
                            <th className="pb-2 pr-3 font-medium">Parameter</th>
                            <th className="pb-2 pr-3 font-medium">Nominal</th>
                            <th className="pb-2 pr-3 font-medium">Tolerance</th>
                            <th className="pb-2 pr-3 font-medium">Actual</th>
                            <th className="pb-2 font-medium">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {measurements.map((m, i) => (
                            <tr key={i} className="border-b border-lattice-border/30">
                              <td className="py-1.5 pr-3 text-gray-300">{m.param as string}</td>
                              <td className="py-1.5 pr-3 font-mono text-gray-400">{String(m.nominal)}</td>
                              <td className="py-1.5 pr-3 font-mono text-gray-400">{typeof m.tolerance === 'number' ? `+/-${m.tolerance}` : String(m.tolerance)}</td>
                              <td className="py-1.5 pr-3 font-mono text-white">{String(m.actual)}</td>
                              <td className="py-1.5">
                                {m.pass ? (
                                  <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> PASS</span>
                                ) : (
                                  <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3.5 h-3.5" /> FAIL</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Defect Details */}
                {defects.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Defect Details</h4>
                    <div className="space-y-2">
                      {defects.map((def, i) => (
                        <div key={i} className="flex items-start gap-3 p-2 bg-lattice-elevated/50 rounded-lg">
                          <AlertTriangle className={cn('w-4 h-4 mt-0.5 flex-shrink-0', (def.severity as string) === 'major' ? 'text-red-400' : 'text-amber-400')} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-white">{def.type as string}</span>
                              <span className={ds.badge((def.severity as string) === 'major' ? 'red-400' : 'amber-400')}>{def.severity as string}</span>
                            </div>
                            <p className="text-xs text-gray-300">{def.desc as string}</p>
                            <p className="text-xs text-gray-500 mt-1">Root Cause: {def.rootCause as string}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Scheduling
  // ---------------------------------------------------------------------------
  const renderScheduling = () => (
    <div className="space-y-4">
      <div className={ds.grid3}>
        {[
          { line: 'Line A', capacity: 78, color: 'amber-400' },
          { line: 'Line B', capacity: 91, color: 'green-400' },
          { line: 'Line C', capacity: 45, color: 'red-400' },
        ].map(l => (
          <div key={l.line} className={ds.panel}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-300">{l.line}</span>
              <span className={cn('text-lg font-bold', `text-${l.color}`)}>{l.capacity}%</span>
            </div>
            <div className="w-full h-2 bg-lattice-elevated rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full', `bg-${l.color}`)} style={{ width: `${l.capacity}%` }} />
            </div>
            <p className={cn(ds.textMuted, 'mt-1')}>Capacity utilization</p>
          </div>
        ))}
      </div>

      <div className={ds.panel}>
        <h3 className={ds.heading3 + ' mb-2'}>Setup Time Tracking</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left border-b border-lattice-border">
                <th className="pb-2 pr-4 font-medium">Work Order</th>
                <th className="pb-2 pr-4 font-medium">Product</th>
                <th className="pb-2 pr-4 font-medium">Line</th>
                <th className="pb-2 pr-4 font-medium">Setup Time</th>
                <th className="pb-2 font-medium">Optimization</th>
              </tr>
            </thead>
            <tbody>
              {SEED.WorkOrder.map(wo => {
                const setupTime = wo.data.setupTime as number;
                const isLong = setupTime > 40;
                return (
                  <tr key={wo.title} className="border-b border-lattice-border/30">
                    <td className="py-2 pr-4 font-mono text-neon-cyan">{wo.title}</td>
                    <td className="py-2 pr-4 text-gray-300">{wo.data.product as string}</td>
                    <td className="py-2 pr-4 text-gray-400">{wo.data.line as string}</td>
                    <td className="py-2 pr-4">
                      <span className={cn('font-mono', isLong ? 'text-amber-400' : 'text-gray-300')}>{setupTime} min</span>
                    </td>
                    <td className="py-2">
                      {isLong ? (
                        <span className="text-xs text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Consider SMED</span>
                      ) : (
                        <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Optimal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Schedule Timelines */}
      {filtered.map(item => (
        <ScheduleTimeline key={item.id} schedule={item} />
      ))}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Equipment / Machines
  // ---------------------------------------------------------------------------
  const renderMachines = () => (
    <div className="space-y-4">
      {/* OEE Calculator */}
      <div className={ds.panel}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={ds.heading3}>OEE Calculator</h3>
          <button onClick={() => setShowOEECalc(!showOEECalc)} className={ds.btnGhost}>
            <Calculator className="w-4 h-4" /> {showOEECalc ? 'Hide' : 'Show'}
          </button>
        </div>
        {showOEECalc && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className={ds.label}>Availability %</label>
              <input value={oeeAvail} onChange={e => setOeeAvail(e.target.value)} className={ds.input} type="number" min="0" max="100" />
            </div>
            <div>
              <label className={ds.label}>Performance %</label>
              <input value={oeePerf} onChange={e => setOeePerf(e.target.value)} className={ds.input} type="number" min="0" max="100" />
            </div>
            <div>
              <label className={ds.label}>Quality %</label>
              <input value={oeeQual} onChange={e => setOeeQual(e.target.value)} className={ds.input} type="number" min="0" max="100" />
            </div>
            <div className="flex flex-col justify-end">
              <label className={ds.label}>OEE Result</label>
              <div className={cn('text-2xl font-bold font-mono', oeeCalcResult >= 85 ? 'text-green-400' : oeeCalcResult >= 65 ? 'text-amber-400' : 'text-red-400')}>
                {oeeCalcResult.toFixed(1)}%
              </div>
              <p className="text-xs text-gray-500">{oeeCalcResult >= 85 ? 'World Class' : oeeCalcResult >= 65 ? 'Average' : 'Below Average'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Machine Cards */}
      {filtered.map(item => {
        const d = item.data as Record<string, unknown>;
        const machineStatus = d.machineStatus as string;
        const oee = d.oee as number;
        const availability = d.availability as number;
        const performance = d.performance as number;
        const quality = d.quality as number;
        const downtimeLog = (d.downtimeLog as Array<Record<string, unknown>>) || [];
        const isDetail = detailItem === item.id;
        const totalDowntime = downtimeLog.reduce((s, e) => s + (e.duration as number), 0);

        return (
          <div key={item.id} className={cn(ds.panel, 'hover:border-neon-cyan/30 transition-colors')}>
            <div className="flex items-start justify-between mb-3 cursor-pointer" onClick={() => setDetailItem(isDetail ? null : item.id)}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-3 h-3 rounded-full',
                  machineStatus === 'running' ? 'bg-green-400 animate-pulse' :
                  machineStatus === 'idle' ? 'bg-amber-400' :
                  machineStatus === 'maintenance' ? 'bg-neon-blue' : 'bg-red-400'
                )} />
                <div>
                  <h3 className={ds.heading3}>{item.title}</h3>
                  <p className={ds.textMuted}>{d.manufacturer as string} {d.model as string} - {d.type as string}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={ds.badge(STATUS_COLORS[machineStatus])}>{machineStatus}</span>
                <button onClick={e => { e.stopPropagation(); openEdit(item.id); }} className={ds.btnGhost}><Edit2 className="w-4 h-4" /></button>
                {isDetail ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
              </div>
            </div>

            {/* OEE Gauges */}
            <div className="flex items-center justify-around py-2">
              <OEEGauge value={oee} label="OEE" />
              <OEEGauge value={availability} label="Avail" size="sm" />
              <OEEGauge value={performance} label="Perf" size="sm" />
              <OEEGauge value={quality} label="Quality" size="sm" />
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-4 mt-3 text-sm">
              <span className={ds.textMuted}><Timer className="w-3.5 h-3.5 inline mr-1" />Cycle: {d.cycleTime as number}min (ideal: {d.idealCycleTime as number}min)</span>
              <span className={ds.textMuted}><Clock className="w-3.5 h-3.5 inline mr-1" />Run: {d.hoursRun as number}h / {d.hoursAvail as number}h</span>
              <span className={ds.textMuted}><Wrench className="w-3.5 h-3.5 inline mr-1" />Next PM: {d.nextMaintenance as string}</span>
            </div>

            {isDetail && (
              <div className="mt-4 pt-4 border-t border-lattice-border space-y-4">
                {/* Maintenance Schedule */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Upcoming Maintenance</h4>
                  <div className="p-3 bg-lattice-elevated/50 rounded-lg flex items-center gap-3">
                    <Wrench className="w-5 h-5 text-neon-blue" />
                    <div>
                      <p className="text-sm text-white">{d.maintenanceType as string}</p>
                      <p className="text-xs text-gray-400">Scheduled: {d.nextMaintenance as string}</p>
                    </div>
                  </div>
                </div>

                {/* Downtime Log */}
                {downtimeLog.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">
                      Downtime Log <span className="text-gray-500 font-normal">({totalDowntime} min total)</span>
                    </h4>
                    <div className="space-y-1">
                      {downtimeLog.map((entry, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 bg-lattice-elevated/30 rounded">
                          <Clock className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          <span className="text-xs text-gray-400 w-24">{entry.date as string}</span>
                          <span className="text-xs text-red-400 w-16 font-mono">{entry.duration as number} min</span>
                          <span className="text-xs text-gray-300 flex-1">{entry.reason as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button onClick={() => handleAction('scheduleMaintenance', item.id)} className={cn(ds.btnSecondary, ds.btnSmall)}>
                    <Wrench className="w-3.5 h-3.5" /> Schedule PM
                  </button>
                  <button onClick={() => handleAction('logDowntime', item.id)} className={cn(ds.btnSecondary, ds.btnSmall)}>
                    <Clock className="w-3.5 h-3.5" /> Log Downtime
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Safety
  // ---------------------------------------------------------------------------
  const renderSafety = () => {
    const safetyItems = SEED.SafetyItem;
    const totalIncidents = safetyItems.length;
    const oshaRecordables = safetyItems.filter(s => s.data.oshaRecordable === true).length;
    const nearMisses = safetyItems.filter(s => (s.data.incidentType as string) === 'near_miss').length;
    const openItems = safetyItems.filter(s => s.meta.status !== 'closed').length;
    const totalHours = 50000; // YTD employee hours placeholder
    const oshaRate = totalHours > 0 ? ((oshaRecordables * 200000) / totalHours).toFixed(2) : '0.00';

    return (
      <div className="space-y-4">
        {/* Safety Dashboard */}
        <div className={ds.grid4}>
          <div className={ds.panel}>
            <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-400" /><span className={ds.textMuted}>Total Incidents MTD</span></div>
            <p className="text-2xl font-bold text-white">{totalIncidents}</p>
          </div>
          <div className={ds.panel}>
            <div className="flex items-center gap-2 mb-1"><Shield className="w-4 h-4 text-amber-400" /><span className={ds.textMuted}>OSHA Recordable Rate</span></div>
            <p className="text-2xl font-bold text-amber-400">{oshaRate}</p>
            <p className="text-xs text-gray-500">per 200,000 hrs</p>
          </div>
          <div className={ds.panel}>
            <div className="flex items-center gap-2 mb-1"><Eye className="w-4 h-4 text-neon-blue" /><span className={ds.textMuted}>Near Misses</span></div>
            <p className="text-2xl font-bold text-neon-blue">{nearMisses}</p>
          </div>
          <div className={ds.panel}>
            <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className={ds.textMuted}>Open Items</span></div>
            <p className="text-2xl font-bold text-white">{openItems}</p>
          </div>
        </div>

        {/* Training Compliance */}
        <div className={ds.panel}>
          <h3 className={ds.heading3 + ' mb-3'}>Training Compliance by Employee</h3>
          <div className="space-y-2">
            {[
              { name: 'J. Hernandez', role: 'Machinist', compliance: 100, certs: ['Lockout/Tagout', 'Forklift', 'First Aid'] },
              { name: 'M. Brown', role: 'Welder', compliance: 85, certs: ['Lockout/Tagout', 'Hot Work Permit'] },
              { name: 'S. Kim', role: 'Material Handler', compliance: 92, certs: ['Forklift', 'Hazmat', 'First Aid'] },
              { name: 'T. Nakamura', role: 'QC Inspector', compliance: 100, certs: ['Lockout/Tagout', 'Chemical Handling', 'First Aid'] },
              { name: 'R. Patel', role: 'QC Inspector', compliance: 77, certs: ['Lockout/Tagout'] },
            ].map(emp => (
              <div key={emp.name} className="flex items-center gap-3 p-2 bg-lattice-elevated/30 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">{emp.name}</span>
                    <span className="text-xs text-gray-500">{emp.role}</span>
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {emp.certs.map(c => (
                      <span key={c} className={ds.badge('green-400')}>{c}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={cn('text-lg font-bold', emp.compliance >= 90 ? 'text-green-400' : emp.compliance >= 75 ? 'text-amber-400' : 'text-red-400')}>
                    {emp.compliance}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Audit Schedule */}
        <div className={ds.panel}>
          <h3 className={ds.heading3 + ' mb-3'}>Safety Audit Schedule</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-left border-b border-lattice-border">
                  <th className="pb-2 pr-4 font-medium">Area</th>
                  <th className="pb-2 pr-4 font-medium">Last Audit</th>
                  <th className="pb-2 pr-4 font-medium">Next Due</th>
                  <th className="pb-2 pr-4 font-medium">Auditor</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { area: 'CNC Shop Floor', last: '2026-01-15', next: '2026-02-15', auditor: 'Safety Committee', status: 'due_soon' },
                  { area: 'Welding Bay', last: '2026-02-01', next: '2026-03-01', auditor: 'M. Brown', status: 'current' },
                  { area: 'Paint Booth', last: '2025-12-10', next: '2026-02-10', auditor: 'Safety Committee', status: 'overdue' },
                  { area: 'Loading Dock', last: '2026-01-28', next: '2026-02-28', auditor: 'S. Kim', status: 'current' },
                  { area: 'Assembly Area', last: '2026-02-05', next: '2026-03-05', auditor: 'J. Hernandez', status: 'current' },
                ].map(audit => (
                  <tr key={audit.area} className="border-b border-lattice-border/30">
                    <td className="py-2 pr-4 text-gray-300">{audit.area}</td>
                    <td className="py-2 pr-4 text-gray-400">{audit.last}</td>
                    <td className="py-2 pr-4 text-gray-400">{audit.next}</td>
                    <td className="py-2 pr-4 text-gray-400">{audit.auditor}</td>
                    <td className="py-2">
                      <span className={ds.badge(audit.status === 'overdue' ? 'red-400' : audit.status === 'due_soon' ? 'amber-400' : 'green-400')}>
                        {audit.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Incident Cards */}
        {filtered.map(item => {
          const d = item.data as Record<string, unknown>;
          const status = item.meta?.status || 'reported';
          const severity = d.severity as string;
          const incidentType = d.incidentType as string;
          const isDetail = detailItem === item.id;

          return (
            <div key={item.id} className={cn(ds.panel, 'hover:border-neon-cyan/30 transition-colors')}>
              <div className="flex items-start justify-between mb-2 cursor-pointer" onClick={() => setDetailItem(isDetail ? null : item.id)}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={ds.heading3}>{item.title}</h3>
                    <span className={ds.badge(STATUS_COLORS[severity] || 'gray-400')}>{severity}</span>
                    <span className={ds.badge(STATUS_COLORS[status as string] || 'gray-400')}>{(status as string).replace(/_/g, ' ')}</span>
                    <span className={ds.badge('gray-400')}>{incidentType.replace(/_/g, ' ')}</span>
                  </div>
                  <p className={ds.textMuted}>{d.location as string} | Reported by {d.reportedBy as string} on {d.reportDate as string}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); openEdit(item.id); }} className={ds.btnGhost}><Edit2 className="w-4 h-4" /></button>
                  <button onClick={e => { e.stopPropagation(); remove(item.id); }} className={cn(ds.btnGhost, 'hover:text-red-400')}><Trash2 className="w-4 h-4" /></button>
                  {isDetail ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                </div>
              </div>

              <p className="text-sm text-gray-300 mb-2">{d.description as string}</p>

              {Boolean(d.oshaRecordable) && (
                <div className="flex items-center gap-2 mb-2">
                  <span className={ds.badge('red-400')}>OSHA RECORDABLE</span>
                  {(d.lostTimeDays as number) > 0 && (
                    <span className="text-xs text-red-400">{d.lostTimeDays as number} lost time days</span>
                  )}
                </div>
              )}

              {isDetail && (
                <div className="mt-3 pt-3 border-t border-lattice-border space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Root Cause</h4>
                    <p className="text-sm text-gray-300">{d.rootCause as string}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Corrective Action</h4>
                    <p className="text-sm text-gray-300">{d.correctiveAction as string}</p>
                    <p className={ds.textMuted}>Due: {d.dueDate as string}</p>
                  </div>
                  {Boolean(d.trainingRequired) && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Training Required</h4>
                      <span className={ds.badge('neon-blue')}>{d.trainingRequired as string}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render: Main
  // ---------------------------------------------------------------------------
  const renderContent = () => {
    switch (mode) {
      case 'dashboard': return renderDashboard();
      case 'work_orders': return renderWorkOrders();
      case 'bom': return renderBOM();
      case 'quality': return renderQuality();
      case 'scheduling': return renderScheduling();
      case 'machines': return renderMachines();
      case 'safety': return renderSafety();
      default: return null;
    }
  };

  return (
    <div className={ds.pageContainer}>
      {/* Header */}
      <header className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <Cog className="w-7 h-7 text-neon-purple" />
          <div>
            <h1 className={ds.heading1}>Manufacturing</h1>
            <p className={ds.textMuted}>Work orders, BOM, quality, scheduling, equipment and safety management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode !== 'dashboard' && (
            <button onClick={openCreate} className={ds.btnPrimary}>
              <Plus className="w-4 h-4" /> New {currentType}
            </button>
          )}
          {runAction.isPending && <span className="text-xs text-neon-blue animate-pulse">Running action...</span>}
        </div>
      </header>

      {/* Mode Tabs */}
      <nav className="flex items-center gap-1 border-b border-lattice-border pb-3 overflow-x-auto">
        {MODE_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setMode(tab.id); setSearch(''); setStatusFilter('all'); setDetailItem(null); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                mode === tab.id ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Filters (not on dashboard) */}
      {mode !== 'dashboard' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${currentType.toLowerCase()}s...`} className={cn(ds.input, 'pl-10')} />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={cn(ds.select, 'pl-10 pr-8')}>
              <option value="all">All statuses</option>
              {statusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Domain Actions */}
      {mode !== 'dashboard' && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => handleAction('scheduleOptimizer')} className={ds.btnSecondary}>
            <TrendingUp className="w-4 h-4" /> Schedule Optimizer
          </button>
          <button onClick={() => handleAction('bomCostCalc')} className={ds.btnSecondary}>
            <Calculator className="w-4 h-4" /> BOM Cost Calc
          </button>
          <button onClick={() => handleAction('oeeCalculator')} className={ds.btnSecondary}>
            <Gauge className="w-4 h-4" /> OEE Calculator
          </button>
          <button onClick={() => handleAction('safetyRateReport')} className={ds.btnSecondary}>
            <Shield className="w-4 h-4" /> Safety Rate Report
          </button>
          <button onClick={() => handleAction('defectAnalysis')} className={ds.btnSecondary}>
            <BarChart3 className="w-4 h-4" /> Defect Analysis
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12"><p className={ds.textMuted}>Loading manufacturing data...</p></div>
      ) : (
        renderContent()
      )}

      {/* Action Result */}
      {actionResult && (
        <div className={ds.panel}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={ds.heading3}>Action Result</h3>
            <button onClick={() => setActionResult(null)} className={ds.btnGhost}><X className="w-4 h-4" /></button>
          </div>
          <pre className={cn(ds.textMono, 'text-xs overflow-auto max-h-48')}>{JSON.stringify(actionResult, null, 2)}</pre>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <>
          <div className={ds.modalBackdrop} onClick={resetForm} />
          <div className={ds.modalContainer}>
            <div className={cn(ds.modalPanel, 'max-w-2xl')}>
              <div className="flex items-center justify-between p-4 border-b border-lattice-border">
                <h2 className={ds.heading2}>{editing ? 'Edit' : 'New'} {currentType}</h2>
                <button onClick={resetForm} className={ds.btnGhost}><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className={ds.label}>Title</label>
                  <input value={formTitle} onChange={e => setFormTitle(e.target.value)} className={ds.input} placeholder={`${currentType} title`} />
                </div>
                <div>
                  <label className={ds.label}>Status</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className={ds.select}>
                    {statusOptions.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className={ds.grid2}>
                  {(fieldConfig[mode] || []).map(field => (
                    <div key={field.key}>
                      <label className={ds.label}>{field.label}</label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={formFields[field.key] || ''}
                          onChange={e => setFormFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className={ds.textarea}
                          rows={3}
                        />
                      ) : field.type === 'select' && field.options ? (
                        <select
                          value={formFields[field.key] || ''}
                          onChange={e => setFormFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className={ds.select}
                        >
                          <option value="">Select...</option>
                          {field.options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                        </select>
                      ) : (
                        <input
                          value={formFields[field.key] || ''}
                          onChange={e => setFormFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className={ds.input}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border-t border-lattice-border">
                <div>
                  {editing && (
                    <button onClick={() => { remove(editing); resetForm(); }} className={ds.btnDanger}>
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={resetForm} className={ds.btnSecondary}>Cancel</button>
                  <button onClick={handleSave} className={ds.btnPrimary} disabled={!formTitle.trim()}>
                    {editing ? 'Update' : 'Create'}
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
