'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { ds } from '@/lib/design-system';
import {
  TreePine,
  MapPin,
  Bug,
  ClipboardList,
  Footprints,
  Thermometer,
  Trash2 as TrashIcon,
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
  Droplets,
  Leaf,
  Mountain,
  Globe,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Sites' | 'Species' | 'Surveys' | 'Trails' | 'Monitoring' | 'Waste';

type ArtifactType = 'Site' | 'Species' | 'Survey' | 'TrailAsset' | 'EnvironmentalSample' | 'WasteStream';
type Status = 'active' | 'monitoring' | 'critical' | 'remediation' | 'closed' | 'seasonal';

interface Site { name: string; type: string; lat: number; lon: number; acreage: number; manager: string; designation: string; }
interface SpeciesRecord { commonName: string; scientificName: string; category: string; conservationStatus: string; habitat: string; population: string; lastSighted: string; }
interface Survey { name: string; method: string; area: string; leadResearcher: string; startDate: string; endDate: string; sampleCount: number; }
interface TrailAsset { name: string; length: number; difficulty: string; surface: string; condition: string; lastInspected: string; features: string[]; }
interface EnvironmentalSample { sampleId: string; medium: string; parameter: string; value: number; unit: string; collectionDate: string; location: string; lat: number; lon: number; }
interface WasteStream { name: string; type: string; source: string; volume: number; unit: string; disposalMethod: string; complianceFramework: string; }

type ArtifactData = Site | SpeciesRecord | Survey | TrailAsset | EnvironmentalSample | WasteStream;

const MODE_TABS: { id: ModeTab; icon: typeof TreePine; artifactType: ArtifactType }[] = [
  { id: 'Sites', icon: MapPin, artifactType: 'Site' },
  { id: 'Species', icon: Bug, artifactType: 'Species' },
  { id: 'Surveys', icon: ClipboardList, artifactType: 'Survey' },
  { id: 'Trails', icon: Footprints, artifactType: 'TrailAsset' },
  { id: 'Monitoring', icon: Thermometer, artifactType: 'EnvironmentalSample' },
  { id: 'Waste', icon: TrashIcon, artifactType: 'WasteStream' },
];

const ALL_STATUSES: Status[] = ['active', 'monitoring', 'critical', 'remediation', 'closed', 'seasonal'];

const STATUS_COLORS: Record<Status, string> = {
  active: 'green-400',
  monitoring: 'neon-blue',
  critical: 'red-400',
  remediation: 'orange-400',
  closed: 'gray-400',
  seasonal: 'neon-purple',
};

const SEED_DATA: Record<ArtifactType, { title: string; data: Record<string, unknown>; meta: Record<string, unknown> }[]> = {
  Site: [
    { title: 'Cedar Creek Wetland Reserve', data: { name: 'Cedar Creek Wetland Reserve', type: 'Wetland', lat: 45.123, lon: -93.456, acreage: 340, manager: 'DNR District 7', designation: 'State Natural Area' }, meta: { status: 'active', tags: ['wetland', 'protected'] } },
    { title: 'Quarry Bluff Remediation Site', data: { name: 'Quarry Bluff Remediation Site', type: 'Brownfield', lat: 44.987, lon: -93.221, acreage: 28, manager: 'EPA Region 5', designation: 'Superfund' }, meta: { status: 'remediation', tags: ['brownfield', 'superfund'] } },
    { title: 'Hawk Ridge Migration Corridor', data: { name: 'Hawk Ridge Migration Corridor', type: 'Wildlife Corridor', lat: 46.813, lon: -92.044, acreage: 1200, manager: 'Audubon Society', designation: 'Important Bird Area' }, meta: { status: 'seasonal', tags: ['birds', 'migration'] } },
  ],
  Species: [
    { title: 'Rusty Patched Bumble Bee', data: { commonName: 'Rusty Patched Bumble Bee', scientificName: 'Bombus affinis', category: 'Insect', conservationStatus: 'Endangered', habitat: 'Prairie grasslands', population: 'Declining', lastSighted: '2026-01-15' }, meta: { status: 'critical', tags: ['pollinator', 'endangered'] } },
    { title: 'Blanding\'s Turtle', data: { commonName: 'Blanding\'s Turtle', scientificName: 'Emydoidea blandingii', category: 'Reptile', conservationStatus: 'Threatened', habitat: 'Wetlands and marshes', population: 'Stable', lastSighted: '2025-09-20' }, meta: { status: 'monitoring', tags: ['reptile', 'threatened'] } },
    { title: 'Northern Long-Eared Bat', data: { commonName: 'Northern Long-Eared Bat', scientificName: 'Myotis septentrionalis', category: 'Mammal', conservationStatus: 'Endangered', habitat: 'Forest roosts / caves', population: 'Declining', lastSighted: '2025-11-02' }, meta: { status: 'critical', tags: ['mammal', 'endangered'] } },
  ],
  Survey: [
    { title: 'Spring Amphibian Census 2026', data: { name: 'Spring Amphibian Census 2026', method: 'Visual Encounter Survey', area: 'Cedar Creek Wetland', leadResearcher: 'Dr. Kim Patel', startDate: '2026-03-15', endDate: '2026-05-30', sampleCount: 0 }, meta: { status: 'active', tags: ['amphibians', 'census'] } },
    { title: 'Water Quality Baseline Study', data: { name: 'Water Quality Baseline Study', method: 'Grab Sampling', area: 'North Fork Watershed', leadResearcher: 'Dr. James Okafor', startDate: '2026-01-01', endDate: '2026-12-31', sampleCount: 48 }, meta: { status: 'monitoring', tags: ['water', 'baseline'] } },
  ],
  TrailAsset: [
    { title: 'Lakeshore Loop Trail', data: { name: 'Lakeshore Loop Trail', length: 5.4, difficulty: 'Easy', surface: 'Crushed limestone', condition: 'Good', lastInspected: '2026-01-05', features: ['Accessible', 'Interpretive signs', 'Birdwatching blinds'] }, meta: { status: 'active', tags: ['loop', 'accessible'] } },
    { title: 'Ridge Summit Trail', data: { name: 'Ridge Summit Trail', length: 8.2, difficulty: 'Strenuous', surface: 'Natural', condition: 'Fair - erosion near mile 3', lastInspected: '2025-11-20', features: ['Scenic overlook', 'Backcountry camping'] }, meta: { status: 'monitoring', tags: ['summit', 'erosion'] } },
  ],
  EnvironmentalSample: [
    { title: 'WQ-2026-001 Nitrate', data: { sampleId: 'WQ-2026-001', medium: 'Surface Water', parameter: 'Nitrate-N', value: 8.4, unit: 'mg/L', collectionDate: '2026-01-20', location: 'North Fork Station A', lat: 45.001, lon: -93.102 }, meta: { status: 'monitoring', tags: ['water', 'nitrate'] } },
    { title: 'AQ-2026-014 PM2.5', data: { sampleId: 'AQ-2026-014', medium: 'Air', parameter: 'PM2.5', value: 18.7, unit: 'ug/m3', collectionDate: '2026-01-22', location: 'Industrial District Monitor', lat: 44.950, lon: -93.250 }, meta: { status: 'active', tags: ['air', 'particulates'] } },
    { title: 'SL-2026-003 Lead', data: { sampleId: 'SL-2026-003', medium: 'Soil', parameter: 'Lead (Pb)', value: 420, unit: 'mg/kg', collectionDate: '2026-01-18', location: 'Quarry Bluff Grid B7', lat: 44.988, lon: -93.220 }, meta: { status: 'critical', tags: ['soil', 'lead', 'contamination'] } },
  ],
  WasteStream: [
    { title: 'Industrial Solvent Waste', data: { name: 'Industrial Solvent Waste', type: 'Hazardous', source: 'MegaChem Manufacturing', volume: 2400, unit: 'gallons/month', disposalMethod: 'Licensed HW facility', complianceFramework: 'RCRA Subtitle C' }, meta: { status: 'monitoring', tags: ['hazardous', 'solvent'] } },
    { title: 'Municipal Biosolids', data: { name: 'Municipal Biosolids', type: 'Non-hazardous', source: 'City WWTP', volume: 850, unit: 'dry tons/year', disposalMethod: 'Land application', complianceFramework: 'EPA 503 Rule' }, meta: { status: 'active', tags: ['biosolids', 'municipal'] } },
  ],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function EnvironmentLensPage() {
  useLensNav('environment');

  const [mode, setMode] = useState<ModeTab>('Sites');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<'library' | 'dashboard'>('library');

  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState<Status>('active');
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const currentType = MODE_TABS.find(t => t.id === mode)!.artifactType;

  const { items, isLoading, create, update, remove } = useLensData<ArtifactData>('environment', currentType, {
    seed: SEED_DATA[currentType] || [],
  });

  /* ---- filtering ---- */
  const filtered = useMemo(() => {
    let list = items;
    if (searchQuery) { const q = searchQuery.toLowerCase(); list = list.filter(i => i.title.toLowerCase().includes(q)); }
    if (statusFilter !== 'all') { list = list.filter(i => i.meta.status === statusFilter); }
    return list;
  }, [items, searchQuery, statusFilter]);

  /* ---- editor helpers ---- */
  const openNew = () => { setEditingId(null); setFormTitle(''); setFormStatus('active'); setFormData({}); setShowEditor(true); };
  const openEdit = (item: LensItem<ArtifactData>) => { setEditingId(item.id); setFormTitle(item.title); setFormStatus((item.meta.status as Status) || 'active'); setFormData(item.data as Record<string, unknown>); setShowEditor(true); };
  const handleSave = async () => { const payload = { title: formTitle, data: formData, meta: { status: formStatus } }; if (editingId) { await update(editingId, payload); } else { await create(payload); } setShowEditor(false); };
  const handleDelete = async (id: string) => { await remove(id); };

  /* ---- stats ---- */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_STATUSES.forEach(s => { counts[s] = 0; });
    items.forEach(i => { const s = i.meta.status; if (counts[s] !== undefined) counts[s]++; });
    return counts;
  }, [items]);

  /* ---- export geojson ---- */
  const exportGeoJSON = () => {
    const features = items.filter(i => {
      const d = i.data as Record<string, unknown>;
      return d.lat && d.lon;
    }).map(i => {
      const d = i.data as Record<string, unknown>;
      return { type: 'Feature' as const, properties: { title: i.title, status: i.meta.status, type: currentType }, geometry: { type: 'Point' as const, coordinates: [d.lon as number, d.lat as number] } };
    });
    const geojson = { type: 'FeatureCollection', features };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `environment-${currentType.toLowerCase()}.geojson`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ---- status badge ---- */
  const renderStatusBadge = (status: string) => {
    const color = STATUS_COLORS[status as Status] || 'gray-400';
    return <span className={ds.badge(color)}>{status}</span>;
  };

  /* ---- form fields ---- */
  const renderFormFields = () => {
    switch (currentType) {
      case 'Site':
        return (
          <>
            <div><label className={ds.label}>Site Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Site Type</label><select className={ds.select} value={(formData.type as string) || ''} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="">Select...</option><option value="Wetland">Wetland</option><option value="Forest">Forest</option><option value="Prairie">Prairie</option><option value="Brownfield">Brownfield</option><option value="Wildlife Corridor">Wildlife Corridor</option><option value="Marine">Marine</option></select></div>
              <div><label className={ds.label}>Designation</label><input className={ds.input} value={(formData.designation as string) || ''} onChange={e => setFormData({ ...formData, designation: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Latitude</label><input type="number" step="0.001" className={ds.input} value={(formData.lat as number) || ''} onChange={e => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Longitude</label><input type="number" step="0.001" className={ds.input} value={(formData.lon as number) || ''} onChange={e => setFormData({ ...formData, lon: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Acreage</label><input type="number" className={ds.input} value={(formData.acreage as number) || ''} onChange={e => setFormData({ ...formData, acreage: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Managing Entity</label><input className={ds.input} value={(formData.manager as string) || ''} onChange={e => setFormData({ ...formData, manager: e.target.value })} /></div>
            </div>
          </>
        );
      case 'Species':
        return (
          <>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Common Name</label><input className={ds.input} value={(formData.commonName as string) || ''} onChange={e => setFormData({ ...formData, commonName: e.target.value })} /></div>
              <div><label className={ds.label}>Scientific Name</label><input className={`${ds.input} italic`} value={(formData.scientificName as string) || ''} onChange={e => setFormData({ ...formData, scientificName: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Category</label><select className={ds.select} value={(formData.category as string) || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}><option value="">Select...</option><option value="Mammal">Mammal</option><option value="Bird">Bird</option><option value="Reptile">Reptile</option><option value="Amphibian">Amphibian</option><option value="Fish">Fish</option><option value="Insect">Insect</option><option value="Plant">Plant</option></select></div>
              <div><label className={ds.label}>Conservation Status</label><select className={ds.select} value={(formData.conservationStatus as string) || ''} onChange={e => setFormData({ ...formData, conservationStatus: e.target.value })}><option value="">Select...</option><option value="Least Concern">Least Concern</option><option value="Near Threatened">Near Threatened</option><option value="Vulnerable">Vulnerable</option><option value="Threatened">Threatened</option><option value="Endangered">Endangered</option><option value="Critically Endangered">Critically Endangered</option></select></div>
            </div>
            <div><label className={ds.label}>Habitat</label><input className={ds.input} value={(formData.habitat as string) || ''} onChange={e => setFormData({ ...formData, habitat: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Population Trend</label><select className={ds.select} value={(formData.population as string) || ''} onChange={e => setFormData({ ...formData, population: e.target.value })}><option value="Increasing">Increasing</option><option value="Stable">Stable</option><option value="Declining">Declining</option><option value="Unknown">Unknown</option></select></div>
              <div><label className={ds.label}>Last Sighted</label><input type="date" className={ds.input} value={(formData.lastSighted as string) || ''} onChange={e => setFormData({ ...formData, lastSighted: e.target.value })} /></div>
            </div>
          </>
        );
      case 'Survey':
        return (
          <>
            <div><label className={ds.label}>Survey Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Method</label><input className={ds.input} value={(formData.method as string) || ''} onChange={e => setFormData({ ...formData, method: e.target.value })} /></div>
              <div><label className={ds.label}>Study Area</label><input className={ds.input} value={(formData.area as string) || ''} onChange={e => setFormData({ ...formData, area: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Lead Researcher</label><input className={ds.input} value={(formData.leadResearcher as string) || ''} onChange={e => setFormData({ ...formData, leadResearcher: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Start Date</label><input type="date" className={ds.input} value={(formData.startDate as string) || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} /></div>
              <div><label className={ds.label}>End Date</label><input type="date" className={ds.input} value={(formData.endDate as string) || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Sample Count</label><input type="number" className={ds.input} value={(formData.sampleCount as number) || ''} onChange={e => setFormData({ ...formData, sampleCount: parseInt(e.target.value) || 0 })} /></div>
          </>
        );
      case 'TrailAsset':
        return (
          <>
            <div><label className={ds.label}>Trail Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Length (miles)</label><input type="number" step="0.1" className={ds.input} value={(formData.length as number) || ''} onChange={e => setFormData({ ...formData, length: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Difficulty</label><select className={ds.select} value={(formData.difficulty as string) || ''} onChange={e => setFormData({ ...formData, difficulty: e.target.value })}><option value="Easy">Easy</option><option value="Moderate">Moderate</option><option value="Strenuous">Strenuous</option></select></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Surface</label><input className={ds.input} value={(formData.surface as string) || ''} onChange={e => setFormData({ ...formData, surface: e.target.value })} /></div>
              <div><label className={ds.label}>Condition</label><input className={ds.input} value={(formData.condition as string) || ''} onChange={e => setFormData({ ...formData, condition: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Last Inspected</label><input type="date" className={ds.input} value={(formData.lastInspected as string) || ''} onChange={e => setFormData({ ...formData, lastInspected: e.target.value })} /></div>
            <div><label className={ds.label}>Features (comma-separated)</label><textarea className={ds.textarea} rows={2} value={((formData.features as string[]) || []).join(', ')} onChange={e => setFormData({ ...formData, features: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
          </>
        );
      case 'EnvironmentalSample':
        return (
          <>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Sample ID</label><input className={ds.input} value={(formData.sampleId as string) || ''} onChange={e => setFormData({ ...formData, sampleId: e.target.value })} /></div>
              <div><label className={ds.label}>Medium</label><select className={ds.select} value={(formData.medium as string) || ''} onChange={e => setFormData({ ...formData, medium: e.target.value })}><option value="">Select...</option><option value="Surface Water">Surface Water</option><option value="Groundwater">Groundwater</option><option value="Soil">Soil</option><option value="Air">Air</option><option value="Sediment">Sediment</option></select></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Parameter</label><input className={ds.input} value={(formData.parameter as string) || ''} onChange={e => setFormData({ ...formData, parameter: e.target.value })} /></div>
              <div><label className={ds.label}>Value</label><input type="number" step="0.01" className={ds.input} value={(formData.value as number) || ''} onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Unit</label><input className={ds.input} value={(formData.unit as string) || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })} /></div>
              <div><label className={ds.label}>Collection Date</label><input type="date" className={ds.input} value={(formData.collectionDate as string) || ''} onChange={e => setFormData({ ...formData, collectionDate: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Location</label><input className={ds.input} value={(formData.location as string) || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Latitude</label><input type="number" step="0.001" className={ds.input} value={(formData.lat as number) || ''} onChange={e => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Longitude</label><input type="number" step="0.001" className={ds.input} value={(formData.lon as number) || ''} onChange={e => setFormData({ ...formData, lon: parseFloat(e.target.value) || 0 })} /></div>
            </div>
          </>
        );
      case 'WasteStream':
        return (
          <>
            <div><label className={ds.label}>Stream Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Waste Type</label><select className={ds.select} value={(formData.type as string) || ''} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="">Select...</option><option value="Hazardous">Hazardous</option><option value="Non-hazardous">Non-hazardous</option><option value="Universal">Universal</option><option value="E-waste">E-waste</option></select></div>
              <div><label className={ds.label}>Source</label><input className={ds.input} value={(formData.source as string) || ''} onChange={e => setFormData({ ...formData, source: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Volume</label><input type="number" className={ds.input} value={(formData.volume as number) || ''} onChange={e => setFormData({ ...formData, volume: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Unit</label><input className={ds.input} value={(formData.unit as string) || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="e.g. gallons/month" /></div>
            </div>
            <div><label className={ds.label}>Disposal Method</label><input className={ds.input} value={(formData.disposalMethod as string) || ''} onChange={e => setFormData({ ...formData, disposalMethod: e.target.value })} /></div>
            <div><label className={ds.label}>Compliance Framework</label><input className={ds.input} value={(formData.complianceFramework as string) || ''} onChange={e => setFormData({ ...formData, complianceFramework: e.target.value })} /></div>
          </>
        );
      default: return null;
    }
  };

  /* ---- artifact card ---- */
  const renderCard = (item: LensItem<ArtifactData>) => {
    const d = item.data as Record<string, unknown>;
    return (
      <div key={item.id} className={ds.panelHover}>
        <div className={ds.sectionHeader}>
          <h3 className={ds.heading3}>{item.title}</h3>
          {renderStatusBadge(item.meta.status)}
        </div>
        <div className="mt-2 space-y-1">
          {currentType === 'Site' && <><p className={ds.textMuted}>{d.type as string} - {d.designation as string}</p><p className={ds.textMuted}>{d.acreage as number} acres | Manager: {d.manager as string}</p><p className={`${ds.textMono} text-gray-500`}>{d.lat as number}, {d.lon as number}</p></>}
          {currentType === 'Species' && <><p className={`${ds.textMuted} italic`}>{d.scientificName as string}</p><p className={ds.textMuted}>{d.category as string} | {d.conservationStatus as string}</p><p className={ds.textMuted}>Population: {d.population as string} | Habitat: {d.habitat as string}</p></>}
          {currentType === 'Survey' && <><p className={ds.textMuted}>{d.method as string} - {d.area as string}</p><p className={ds.textMuted}>Lead: {d.leadResearcher as string}</p><p className={`${ds.textMono} text-gray-500`}>{d.sampleCount as number} samples collected</p></>}
          {currentType === 'TrailAsset' && <><p className={ds.textMuted}>{d.length as number} mi | {d.difficulty as string} | {d.surface as string}</p><p className={ds.textMuted}>Condition: {d.condition as string}</p><div className="flex flex-wrap gap-1 mt-1">{((d.features as string[]) || []).map(f => <span key={f} className={ds.badge('neon-cyan')}>{f}</span>)}</div></>}
          {currentType === 'EnvironmentalSample' && <><p className={`${ds.textMono} text-gray-500`}>{d.sampleId as string}</p><p className={ds.textMuted}>{d.medium as string}: {d.parameter as string} = {d.value as number} {d.unit as string}</p><p className={ds.textMuted}>{d.location as string} | {d.collectionDate as string}</p></>}
          {currentType === 'WasteStream' && <><p className={ds.textMuted}>{d.type as string} | Source: {d.source as string}</p><p className={ds.textMuted}>Volume: {d.volume as number} {d.unit as string}</p><p className={ds.textMuted}>Disposal: {d.disposalMethod as string}</p><p className={`${ds.textMono} text-gray-500`}>{d.complianceFramework as string}</p></>}
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
        <div className={ds.panel}><div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-neon-blue" /><span className={ds.textMuted}>Monitoring</span></div><p className={ds.heading2}>{statusCounts['monitoring'] || 0}</p></div>
        <div className={ds.panel}><div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-red-400" /><span className={ds.textMuted}>Critical</span></div><p className={ds.heading2}>{statusCounts['critical'] || 0}</p></div>
        <div className={ds.panel}><div className="flex items-center gap-2 mb-2"><Leaf className="w-4 h-4 text-neon-purple" /><span className={ds.textMuted}>Seasonal</span></div><p className={ds.heading2}>{statusCounts['seasonal'] || 0}</p></div>
      </div>

      <div className={ds.panel}>
        <h3 className={`${ds.heading3} mb-4`}>Status Breakdown - {mode}</h3>
        <div className={ds.grid3}>
          {ALL_STATUSES.map(s => (
            <div key={s} className="flex items-center justify-between p-3 rounded-lg bg-lattice-elevated/30">
              <span className="text-sm text-gray-300">{s}</span>
              <span className={ds.badge(STATUS_COLORS[s])}>{statusCounts[s] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={ds.panel}>
        <div className={ds.sectionHeader}><h3 className={ds.heading3}>Environmental Summary</h3><BarChart3 className="w-5 h-5 text-gray-400" /></div>
        <div className={`${ds.grid3} mt-4`}>
          <div className="text-center p-3 rounded-lg bg-lattice-elevated/30"><Mountain className="w-6 h-6 text-green-400 mx-auto mb-1" /><p className={ds.heading3}>{SEED_DATA.Site.length}</p><p className={ds.textMuted}>Managed Sites</p></div>
          <div className="text-center p-3 rounded-lg bg-lattice-elevated/30"><Bug className="w-6 h-6 text-neon-purple mx-auto mb-1" /><p className={ds.heading3}>{SEED_DATA.Species.length}</p><p className={ds.textMuted}>Tracked Species</p></div>
          <div className="text-center p-3 rounded-lg bg-lattice-elevated/30"><Droplets className="w-6 h-6 text-neon-blue mx-auto mb-1" /><p className={ds.heading3}>{SEED_DATA.EnvironmentalSample.length}</p><p className={ds.textMuted}>Active Samples</p></div>
        </div>
      </div>

      <div className={ds.panel}>
        <h3 className={`${ds.heading3} mb-3`}>Critical Alerts</h3>
        {items.filter(i => i.meta.status === 'critical').length === 0 ? (
          <p className={ds.textMuted}>No critical items at this time.</p>
        ) : (
          <div className="space-y-2">
            {items.filter(i => i.meta.status === 'critical').map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div><p className="text-sm font-medium text-white">{item.title}</p><p className={ds.textMuted}>{currentType}</p></div>
                {renderStatusBadge('critical')}
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

  return (
    <div className={ds.pageContainer}>
      <header className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <TreePine className="w-7 h-7 text-green-400" />
          <div><h1 className={ds.heading1}>Environmental &amp; Outdoors</h1><p className={ds.textMuted}>Sites, species tracking, surveys &amp; environmental monitoring</p></div>
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
            <button key={tab.id} onClick={() => { setMode(tab.id); setStatusFilter('all'); setSearchQuery(''); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${mode === tab.id ? 'bg-green-500/20 text-green-400' : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'}`}>
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
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 -ml-8 pointer-events-none" />
            </div>
            <button className={ds.btnPrimary} onClick={openNew}><Plus className="w-4 h-4" /> New {currentType}</button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <TreePine className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className={ds.heading3}>No {currentType}s found</p>
              <p className={ds.textMuted}>Create one to get started.</p>
              <button className={`${ds.btnPrimary} mt-4`} onClick={openNew}><Plus className="w-4 h-4" /> Add {currentType}</button>
            </div>
          ) : (
            <div className={ds.grid3}>{filtered.map(renderCard)}</div>
          )}
        </>
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
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
