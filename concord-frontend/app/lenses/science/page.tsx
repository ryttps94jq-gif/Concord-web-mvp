'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import {
  FlaskConical,
  Compass,
  Eye,
  TestTubes,
  Microscope,
  LineChart,
  Wrench,
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
  Globe,
  BookOpen,
  Beaker,
  MapPin,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Expeditions' | 'Observations' | 'Samples' | 'Lab' | 'Analysis' | 'Equipment';

type ArtifactType = 'Expedition' | 'Observation' | 'Sample' | 'LabProtocol' | 'Analysis' | 'Equipment';
type Status = 'planned' | 'active' | 'analyzing' | 'peer_review' | 'published' | 'archived';

interface Expedition { name: string; region: string; lat: number; lon: number; pi: string; startDate: string; endDate: string; teamSize: number; fundingSource: string; }
interface Observation { subject: string; method: string; location: string; lat: number; lon: number; observer: string; datetime: string; conditions: string; notes: string; }
interface SampleData { sampleId: string; type: string; source: string; collectionDate: string; collector: string; preservationMethod: string; storageLocation: string; quantity: number; unit: string; }
interface LabProtocol { name: string; version: string; equipment: string[]; duration: string; safetyLevel: string; author: string; lastValidated: string; }
interface AnalysisData { name: string; method: string; dataset: string; software: string; author: string; startDate: string; pValue: string; conclusion: string; }
interface EquipmentData { name: string; model: string; serialNumber: string; calibrationDate: string; nextCalibration: string; location: string; condition: string; assignedTo: string; }

type ArtifactDataUnion = Expedition | Observation | SampleData | LabProtocol | AnalysisData | EquipmentData;

const MODE_TABS: { id: ModeTab; icon: typeof FlaskConical; artifactType: ArtifactType }[] = [
  { id: 'Expeditions', icon: Compass, artifactType: 'Expedition' },
  { id: 'Observations', icon: Eye, artifactType: 'Observation' },
  { id: 'Samples', icon: TestTubes, artifactType: 'Sample' },
  { id: 'Lab', icon: Microscope, artifactType: 'LabProtocol' },
  { id: 'Analysis', icon: LineChart, artifactType: 'Analysis' },
  { id: 'Equipment', icon: Wrench, artifactType: 'Equipment' },
];

const ALL_STATUSES: Status[] = ['planned', 'active', 'analyzing', 'peer_review', 'published', 'archived'];

const STATUS_COLORS: Record<Status, string> = {
  planned: 'neon-blue',
  active: 'green-400',
  analyzing: 'yellow-400',
  peer_review: 'neon-purple',
  published: 'neon-cyan',
  archived: 'gray-400',
};

const seedData: Record<ArtifactType, { title: string; data: Record<string, unknown>; meta: Record<string, unknown> }[]> = {
  Expedition: [
    { title: 'Atacama Extremophile Survey', data: { name: 'Atacama Extremophile Survey', region: 'Atacama Desert, Chile', lat: -23.865, lon: -69.140, pi: 'Dr. Elena Vasquez', startDate: '2026-03-01', endDate: '2026-04-15', teamSize: 8, fundingSource: 'NSF Grant #2026-BIO-4401' }, meta: { status: 'planned', tags: ['astrobiology', 'extremophile'] } },
    { title: 'Arctic Sea Ice Monitoring 2026', data: { name: 'Arctic Sea Ice Monitoring 2026', region: 'Svalbard, Norway', lat: 78.230, lon: 15.635, pi: 'Dr. Lars Eriksen', startDate: '2026-06-01', endDate: '2026-08-30', teamSize: 12, fundingSource: 'EU Horizon Europe' }, meta: { status: 'planned', tags: ['climate', 'arctic'] } },
    { title: 'Borneo Canopy Biodiversity', data: { name: 'Borneo Canopy Biodiversity', region: 'Danum Valley, Borneo', lat: 4.965, lon: 117.804, pi: 'Dr. Amara Tan', startDate: '2025-11-01', endDate: '2026-02-28', teamSize: 6, fundingSource: 'National Geographic Society' }, meta: { status: 'active', tags: ['biodiversity', 'tropical'] } },
  ],
  Observation: [
    { title: 'Thermal Vent Microbial Mat OBS-001', data: { subject: 'Microbial mat community', method: 'In-situ photography + temperature logging', location: 'Salar de Atacama, Laguna Cejar', lat: -23.390, lon: -68.225, observer: 'Dr. Elena Vasquez', datetime: '2026-01-20T14:30:00Z', conditions: 'Clear, 28C, wind 5kph', notes: 'Pink-orange mat at 42C spring outflow' }, meta: { status: 'active', tags: ['microbiology', 'field'] } },
    { title: 'Orangutan Nest Count - Sector 7', data: { subject: 'Pongo pygmaeus nesting behavior', method: 'Line-transect survey', location: 'Danum Valley Sector 7', lat: 4.958, lon: 117.811, observer: 'Dr. Amara Tan', datetime: '2026-01-18T07:00:00Z', conditions: 'Overcast, 26C, humidity 95%', notes: '14 fresh nests identified, 3 reused structures' }, meta: { status: 'analyzing', tags: ['primates', 'behavior'] } },
  ],
  Sample: [
    { title: 'ATK-S-001 Halophilic Isolate', data: { sampleId: 'ATK-S-001', type: 'Biological', source: 'Hypersaline spring sediment', collectionDate: '2026-01-20', collector: 'Dr. Vasquez', preservationMethod: 'Cryopreservation -80C', storageLocation: 'Lab A, Freezer 3, Rack 2', quantity: 50, unit: 'mL' }, meta: { status: 'analyzing', tags: ['halophile', 'sediment'] } },
    { title: 'BRN-S-014 Canopy Soil Core', data: { sampleId: 'BRN-S-014', type: 'Soil', source: 'Epiphyte root mass, 30m canopy', collectionDate: '2026-01-15', collector: 'Dr. Tan', preservationMethod: 'Air-dried, sealed bag', storageLocation: 'Field Station B, Shelf 4', quantity: 200, unit: 'g' }, meta: { status: 'active', tags: ['soil', 'canopy'] } },
  ],
  LabProtocol: [
    { title: 'DNA Extraction - Hypersaline Samples', data: { name: 'DNA Extraction - Hypersaline Samples', version: '3.2', equipment: ['Centrifuge', 'Vortex Mixer', 'Thermocycler', 'NanoDrop'], duration: '4 hours', safetyLevel: 'BSL-1', author: 'Dr. Vasquez', lastValidated: '2025-12-01' }, meta: { status: 'published', tags: ['molecular', 'DNA'] } },
    { title: '16S rRNA Amplicon Sequencing Prep', data: { name: '16S rRNA Amplicon Sequencing Prep', version: '2.1', equipment: ['PCR Hood', 'Thermocycler', 'Gel Electrophoresis', 'Qubit Fluorometer'], duration: '6 hours', safetyLevel: 'BSL-1', author: 'Dr. Kim Park', lastValidated: '2025-10-15' }, meta: { status: 'published', tags: ['sequencing', '16S'] } },
  ],
  Analysis: [
    { title: 'Atacama Microbial Diversity - 16S', data: { name: 'Atacama Microbial Diversity - 16S', method: 'QIIME2 + DADA2 pipeline', dataset: 'ATK-SEQ-2026-batch1', software: 'QIIME2 v2025.10, R v4.4', author: 'Dr. Kim Park', startDate: '2026-02-01', pValue: 'p < 0.001', conclusion: 'Novel halophilic Archaea clade identified in 3 of 5 springs' }, meta: { status: 'peer_review', tags: ['metagenomics', 'diversity'] } },
  ],
  Equipment: [
    { title: 'Portable pH/Conductivity Meter', data: { name: 'Portable pH/Conductivity Meter', model: 'Hanna HI98194', serialNumber: 'HI-98194-2024-0087', calibrationDate: '2026-01-05', nextCalibration: '2026-04-05', location: 'Field Kit A', condition: 'Good', assignedTo: 'Atacama Field Team' }, meta: { status: 'active', tags: ['field', 'water-quality'] } },
    { title: 'Thermal Imaging Camera', data: { name: 'Thermal Imaging Camera', model: 'FLIR E96', serialNumber: 'FLIR-E96-2023-1142', calibrationDate: '2025-11-20', nextCalibration: '2026-05-20', location: 'Equipment Room 2', condition: 'Good', assignedTo: 'Borneo Canopy Team' }, meta: { status: 'active', tags: ['thermal', 'imaging'] } },
    { title: 'Illumina MiSeq Sequencer', data: { name: 'Illumina MiSeq Sequencer', model: 'MiSeq System', serialNumber: 'MS-2022-0019', calibrationDate: '2026-01-15', nextCalibration: '2026-07-15', location: 'Genomics Lab, Room 104', condition: 'Excellent', assignedTo: 'Genomics Core' }, meta: { status: 'active', tags: ['sequencer', 'genomics'] } },
  ],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ScienceLensPage() {
  useLensNav('science');

  const [mode, setMode] = useState<ModeTab>('Expeditions');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<'library' | 'dashboard'>('library');

  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState<Status>('planned');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const currentType = MODE_TABS.find(t => t.id === mode)!.artifactType;

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData<ArtifactDataUnion>('science', currentType, {
    seed: seedData[currentType] || [],
  });

  const runAction = useRunArtifact('science');
  const editingItem = items.find(i => i.id === editingId) || null;

  /* ---- filtering ---- */
  const filtered = useMemo(() => {
    let list = items;
    if (searchQuery) { const q = searchQuery.toLowerCase(); list = list.filter(i => i.title.toLowerCase().includes(q)); }
    if (statusFilter !== 'all') { list = list.filter(i => i.meta.status === statusFilter); }
    return list;
  }, [items, searchQuery, statusFilter]);

  /* ---- editor helpers ---- */
  const openNew = () => { setEditingId(null); setFormTitle(''); setFormStatus('planned'); setFormData({}); setShowEditor(true); };
  const openEdit = (item: LensItem<ArtifactDataUnion>) => { setEditingId(item.id); setFormTitle(item.title); setFormStatus((item.meta.status as Status) || 'planned'); setFormData(item.data as unknown as Record<string, unknown>); setShowEditor(true); };
  const handleSave = async () => { const payload = { title: formTitle, data: formData, meta: { status: formStatus } }; if (editingId) { await update(editingId, payload); } else { await create(payload); } setShowEditor(false); };
  const handleDelete = async (id: string) => { await remove(id); };

  const handleAction = async (action: string, artifactId?: string) => {
    const targetId = artifactId || editingItem?.id || filtered[0]?.id;
    if (!targetId) return;
    try {
      const result = await runAction.mutateAsync({ id: targetId, action });
      setActionResult(result.result as unknown as Record<string, unknown>);
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  /* ---- stats ---- */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_STATUSES.forEach(s => { counts[s] = 0; });
    items.forEach(i => { const s = i.meta.status; if (counts[s] !== undefined) counts[s]++; });
    return counts;
  }, [items]);

  /* ---- export geojson ---- */
  const exportGeoJSON = () => {
    const features = items.filter(i => { const d = i.data as unknown as Record<string, unknown>; return d.lat && d.lon; }).map(i => {
      const d = i.data as unknown as Record<string, unknown>;
      return { type: 'Feature' as const, properties: { title: i.title, status: i.meta.status, type: currentType }, geometry: { type: 'Point' as const, coordinates: [d.lon as number, d.lat as number] } };
    });
    const geojson = { type: 'FeatureCollection', features };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `science-${currentType.toLowerCase()}.geojson`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ---- status badge ---- */
  const renderStatusBadge = (status: string) => {
    const color = STATUS_COLORS[status as Status] || 'gray-400';
    return <span className={ds.badge(color)}>{status.replace(/_/g, ' ')}</span>;
  };

  /* ---- form fields ---- */
  const renderFormFields = () => {
    switch (currentType) {
      case 'Expedition':
        return (
          <>
            <div><label className={ds.label}>Expedition Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div><label className={ds.label}>Region</label><input className={ds.input} value={(formData.region as string) || ''} onChange={e => setFormData({ ...formData, region: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Latitude</label><input type="number" step="0.001" className={ds.input} value={(formData.lat as number) || ''} onChange={e => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Longitude</label><input type="number" step="0.001" className={ds.input} value={(formData.lon as number) || ''} onChange={e => setFormData({ ...formData, lon: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div><label className={ds.label}>Principal Investigator</label><input className={ds.input} value={(formData.pi as string) || ''} onChange={e => setFormData({ ...formData, pi: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Start Date</label><input type="date" className={ds.input} value={(formData.startDate as string) || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} /></div>
              <div><label className={ds.label}>End Date</label><input type="date" className={ds.input} value={(formData.endDate as string) || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Team Size</label><input type="number" className={ds.input} value={(formData.teamSize as number) || ''} onChange={e => setFormData({ ...formData, teamSize: parseInt(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Funding Source</label><input className={ds.input} value={(formData.fundingSource as string) || ''} onChange={e => setFormData({ ...formData, fundingSource: e.target.value })} /></div>
            </div>
          </>
        );
      case 'Observation':
        return (
          <>
            <div><label className={ds.label}>Subject</label><input className={ds.input} value={(formData.subject as string) || ''} onChange={e => setFormData({ ...formData, subject: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Method</label><input className={ds.input} value={(formData.method as string) || ''} onChange={e => setFormData({ ...formData, method: e.target.value })} /></div>
              <div><label className={ds.label}>Observer</label><input className={ds.input} value={(formData.observer as string) || ''} onChange={e => setFormData({ ...formData, observer: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Location</label><input className={ds.input} value={(formData.location as string) || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Latitude</label><input type="number" step="0.001" className={ds.input} value={(formData.lat as number) || ''} onChange={e => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Longitude</label><input type="number" step="0.001" className={ds.input} value={(formData.lon as number) || ''} onChange={e => setFormData({ ...formData, lon: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div><label className={ds.label}>Date/Time</label><input type="datetime-local" className={ds.input} value={(formData.datetime as string) || ''} onChange={e => setFormData({ ...formData, datetime: e.target.value })} /></div>
            <div><label className={ds.label}>Conditions</label><input className={ds.input} value={(formData.conditions as string) || ''} onChange={e => setFormData({ ...formData, conditions: e.target.value })} /></div>
            <div><label className={ds.label}>Notes</label><textarea className={ds.textarea} rows={3} value={(formData.notes as string) || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
          </>
        );
      case 'Sample':
        return (
          <>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Sample ID</label><input className={ds.input} value={(formData.sampleId as string) || ''} onChange={e => setFormData({ ...formData, sampleId: e.target.value })} /></div>
              <div><label className={ds.label}>Sample Type</label><select className={ds.select} value={(formData.type as string) || ''} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="">Select...</option><option value="Biological">Biological</option><option value="Soil">Soil</option><option value="Water">Water</option><option value="Rock">Rock</option><option value="Air">Air</option><option value="Tissue">Tissue</option></select></div>
            </div>
            <div><label className={ds.label}>Source Description</label><input className={ds.input} value={(formData.source as string) || ''} onChange={e => setFormData({ ...formData, source: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Collection Date</label><input type="date" className={ds.input} value={(formData.collectionDate as string) || ''} onChange={e => setFormData({ ...formData, collectionDate: e.target.value })} /></div>
              <div><label className={ds.label}>Collector</label><input className={ds.input} value={(formData.collector as string) || ''} onChange={e => setFormData({ ...formData, collector: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Preservation Method</label><input className={ds.input} value={(formData.preservationMethod as string) || ''} onChange={e => setFormData({ ...formData, preservationMethod: e.target.value })} /></div>
            <div><label className={ds.label}>Storage Location</label><input className={ds.input} value={(formData.storageLocation as string) || ''} onChange={e => setFormData({ ...formData, storageLocation: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Quantity</label><input type="number" className={ds.input} value={(formData.quantity as number) || ''} onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Unit</label><input className={ds.input} value={(formData.unit as string) || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="mL, g, etc." /></div>
            </div>
          </>
        );
      case 'LabProtocol':
        return (
          <>
            <div><label className={ds.label}>Protocol Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Version</label><input className={ds.input} value={(formData.version as string) || ''} onChange={e => setFormData({ ...formData, version: e.target.value })} /></div>
              <div><label className={ds.label}>Duration</label><input className={ds.input} value={(formData.duration as string) || ''} onChange={e => setFormData({ ...formData, duration: e.target.value })} placeholder="e.g. 4 hours" /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Safety Level</label><select className={ds.select} value={(formData.safetyLevel as string) || ''} onChange={e => setFormData({ ...formData, safetyLevel: e.target.value })}><option value="BSL-1">BSL-1</option><option value="BSL-2">BSL-2</option><option value="BSL-3">BSL-3</option><option value="BSL-4">BSL-4</option></select></div>
              <div><label className={ds.label}>Author</label><input className={ds.input} value={(formData.author as string) || ''} onChange={e => setFormData({ ...formData, author: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Equipment (comma-separated)</label><textarea className={ds.textarea} rows={2} value={((formData.equipment as string[]) || []).join(', ')} onChange={e => setFormData({ ...formData, equipment: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
            <div><label className={ds.label}>Last Validated</label><input type="date" className={ds.input} value={(formData.lastValidated as string) || ''} onChange={e => setFormData({ ...formData, lastValidated: e.target.value })} /></div>
          </>
        );
      case 'Analysis':
        return (
          <>
            <div><label className={ds.label}>Analysis Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Method</label><input className={ds.input} value={(formData.method as string) || ''} onChange={e => setFormData({ ...formData, method: e.target.value })} /></div>
              <div><label className={ds.label}>Dataset</label><input className={ds.input} value={(formData.dataset as string) || ''} onChange={e => setFormData({ ...formData, dataset: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Software</label><input className={ds.input} value={(formData.software as string) || ''} onChange={e => setFormData({ ...formData, software: e.target.value })} /></div>
              <div><label className={ds.label}>Author</label><input className={ds.input} value={(formData.author as string) || ''} onChange={e => setFormData({ ...formData, author: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Start Date</label><input type="date" className={ds.input} value={(formData.startDate as string) || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} /></div>
              <div><label className={ds.label}>p-Value</label><input className={ds.input} value={(formData.pValue as string) || ''} onChange={e => setFormData({ ...formData, pValue: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Conclusion</label><textarea className={ds.textarea} rows={3} value={(formData.conclusion as string) || ''} onChange={e => setFormData({ ...formData, conclusion: e.target.value })} /></div>
          </>
        );
      case 'Equipment':
        return (
          <>
            <div><label className={ds.label}>Equipment Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Model</label><input className={ds.input} value={(formData.model as string) || ''} onChange={e => setFormData({ ...formData, model: e.target.value })} /></div>
              <div><label className={ds.label}>Serial Number</label><input className={ds.input} value={(formData.serialNumber as string) || ''} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Calibration Date</label><input type="date" className={ds.input} value={(formData.calibrationDate as string) || ''} onChange={e => setFormData({ ...formData, calibrationDate: e.target.value })} /></div>
              <div><label className={ds.label}>Next Calibration</label><input type="date" className={ds.input} value={(formData.nextCalibration as string) || ''} onChange={e => setFormData({ ...formData, nextCalibration: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Location</label><input className={ds.input} value={(formData.location as string) || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
              <div><label className={ds.label}>Condition</label><select className={ds.select} value={(formData.condition as string) || ''} onChange={e => setFormData({ ...formData, condition: e.target.value })}><option value="Excellent">Excellent</option><option value="Good">Good</option><option value="Fair">Fair</option><option value="Needs Repair">Needs Repair</option><option value="Out of Service">Out of Service</option></select></div>
            </div>
            <div><label className={ds.label}>Assigned To</label><input className={ds.input} value={(formData.assignedTo as string) || ''} onChange={e => setFormData({ ...formData, assignedTo: e.target.value })} /></div>
          </>
        );
      default: return null;
    }
  };

  /* ---- artifact card ---- */
  const renderCard = (item: LensItem<ArtifactDataUnion>) => {
    const d = item.data as unknown as Record<string, unknown>;
    return (
      <div key={item.id} className={ds.panelHover}>
        <div className={ds.sectionHeader}>
          <h3 className={ds.heading3}>{item.title}</h3>
          {renderStatusBadge(item.meta.status)}
        </div>
        <div className="mt-2 space-y-1">
          {currentType === 'Expedition' && <><p className={ds.textMuted}><MapPin className="w-3 h-3 inline mr-1" />{d.region as string}</p><p className={ds.textMuted}>PI: {d.pi as string} | Team: {d.teamSize as number}</p><p className={`${ds.textMono} text-gray-500`}>{d.startDate as string} to {d.endDate as string}</p><p className={ds.textMuted}>{d.fundingSource as string}</p></>}
          {currentType === 'Observation' && <><p className={ds.textMuted}>{d.subject as string}</p><p className={ds.textMuted}>Method: {d.method as string}</p><p className={ds.textMuted}>By: {d.observer as string} | {d.conditions as string}</p></>}
          {currentType === 'Sample' && <><p className={`${ds.textMono} text-gray-500`}>{d.sampleId as string}</p><p className={ds.textMuted}>{d.type as string} | {d.source as string}</p><p className={ds.textMuted}>{d.quantity as number} {d.unit as string} | {d.preservationMethod as string}</p></>}
          {currentType === 'LabProtocol' && <><p className={ds.textMuted}>v{d.version as string} | {d.duration as string} | {d.safetyLevel as string}</p><p className={ds.textMuted}>Author: {d.author as string}</p><div className="flex flex-wrap gap-1 mt-1">{((d.equipment as string[]) || []).map(eq => <span key={eq} className={ds.badge('neon-cyan')}>{eq}</span>)}</div></>}
          {currentType === 'Analysis' && <><p className={ds.textMuted}>{d.method as string}</p><p className={ds.textMuted}>Dataset: {d.dataset as string} | {d.software as string}</p><p className={`${ds.textMono} text-gray-500`}>{d.pValue as string}</p><p className={ds.textMuted}>{d.conclusion as string}</p></>}
          {currentType === 'Equipment' && <><p className={ds.textMuted}>{d.model as string} | SN: {d.serialNumber as string}</p><p className={ds.textMuted}>Condition: {d.condition as string} | Location: {d.location as string}</p><p className={ds.textMuted}>Assigned: {d.assignedTo as string}</p><p className={`${ds.textMono} text-gray-500`}>Cal: {d.calibrationDate as string} | Next: {d.nextCalibration as string}</p></>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button className={`${ds.btnGhost} ${ds.btnSmall}`} onClick={() => openEdit(item)}><Edit3 className="w-3.5 h-3.5" /> Edit</button>
          <button className={`${ds.btnDanger} ${ds.btnSmall}`} onClick={() => handleDelete(item.id)}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
        </div>
      </div>
    );
  };

  /* ---- dashboard ---- */
  const renderDashboard = () => (
    <div className="space-y-6">
      <div className={ds.grid4}>
        <div className={ds.panel}><div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-green-400" /><span className={ds.textMuted}>Active</span></div><p className={ds.heading2}>{statusCounts['active'] || 0}</p></div>
        <div className={ds.panel}><div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-yellow-400" /><span className={ds.textMuted}>Analyzing</span></div><p className={ds.heading2}>{statusCounts['analyzing'] || 0}</p></div>
        <div className={ds.panel}><div className="flex items-center gap-2 mb-2"><BookOpen className="w-4 h-4 text-neon-purple" /><span className={ds.textMuted}>Peer Review</span></div><p className={ds.heading2}>{statusCounts['peer_review'] || 0}</p></div>
        <div className={ds.panel}><div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-neon-cyan" /><span className={ds.textMuted}>Published</span></div><p className={ds.heading2}>{statusCounts['published'] || 0}</p></div>
      </div>

      <div className={ds.panel}>
        <h3 className={`${ds.heading3} mb-4`}>Research Pipeline - {mode}</h3>
        <div className={ds.grid3}>
          {ALL_STATUSES.map(s => (
            <div key={s} className="flex items-center justify-between p-3 rounded-lg bg-lattice-elevated/30">
              <span className="text-sm text-gray-300">{s.replace(/_/g, ' ')}</span>
              <span className={ds.badge(STATUS_COLORS[s])}>{statusCounts[s] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={ds.panel}>
        <div className={ds.sectionHeader}><h3 className={ds.heading3}>Research Overview</h3><BarChart3 className="w-5 h-5 text-gray-400" /></div>
        <div className={`${ds.grid3} mt-4`}>
          <div className="text-center p-3 rounded-lg bg-lattice-elevated/30"><Compass className="w-6 h-6 text-neon-blue mx-auto mb-1" /><p className={ds.heading3}>{seedData.Expedition.length}</p><p className={ds.textMuted}>Expeditions</p></div>
          <div className="text-center p-3 rounded-lg bg-lattice-elevated/30"><TestTubes className="w-6 h-6 text-green-400 mx-auto mb-1" /><p className={ds.heading3}>{seedData.Sample.length}</p><p className={ds.textMuted}>Samples</p></div>
          <div className="text-center p-3 rounded-lg bg-lattice-elevated/30"><Wrench className="w-6 h-6 text-yellow-400 mx-auto mb-1" /><p className={ds.heading3}>{seedData.Equipment.length}</p><p className={ds.textMuted}>Equipment</p></div>
        </div>
      </div>

      <div className={ds.panel}>
        <h3 className={`${ds.heading3} mb-3`}>Items in Peer Review</h3>
        {items.filter(i => i.meta.status === 'peer_review').length === 0 ? (
          <p className={ds.textMuted}>No items currently in peer review.</p>
        ) : (
          <div className="space-y-2">
            {items.filter(i => i.meta.status === 'peer_review').map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-neon-purple/10 border border-neon-purple/20">
                <div><p className="text-sm font-medium text-white">{item.title}</p><p className={ds.textMuted}>{currentType}</p></div>
                {renderStatusBadge('peer_review')}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

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
          <FlaskConical className="w-7 h-7 text-neon-purple" />
          <div><h1 className={ds.heading1}>Science &amp; Field Work</h1><p className={ds.textMuted}>Expeditions, observations, samples &amp; laboratory analysis</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button className={view === 'library' ? ds.btnPrimary : ds.btnSecondary} onClick={() => setView('library')}><ListChecks className="w-4 h-4" /> Library</button>
          <button className={view === 'dashboard' ? ds.btnPrimary : ds.btnSecondary} onClick={() => setView('dashboard')}><BarChart3 className="w-4 h-4" /> Dashboard</button>
          <button className={ds.btnGhost} onClick={exportGeoJSON} title="Export GeoJSON"><Globe className="w-4 h-4" /></button>
          <button className={ds.btnGhost}><Download className="w-4 h-4" /></button>
        </div>
      </header>

      <nav className="flex items-center gap-2 border-b border-lattice-border pb-4 overflow-x-auto">
        {MODE_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => { setMode(tab.id); setStatusFilter('all'); setSearchQuery(''); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${mode === tab.id ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'}`}>
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
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 -ml-8 pointer-events-none" />
            </div>
            <button className={ds.btnPrimary} onClick={openNew}><Plus className="w-4 h-4" /> New {currentType}</button>
            {runAction.isPending && <span className="text-xs text-neon-blue animate-pulse">Running...</span>}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-neon-purple" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <FlaskConical className="w-12 h-12 text-gray-600 mx-auto mb-3" />
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
                <div><label className={ds.label}>Status</label><select className={ds.select} value={formStatus} onChange={e => setFormStatus(e.target.value as Status)}>
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
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
