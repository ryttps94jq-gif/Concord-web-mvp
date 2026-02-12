'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { ds } from '@/lib/design-system';
import {
  Building2,
  Home,
  Eye,
  ArrowLeftRight,
  KeyRound,
  TrendingUp,
  Plus,
  Search,
  X,
  Trash2,
  MapPin,
  DollarSign,
  Calendar,
  User,
  Bed,
  Bath,
  Square,
  Ruler,
  Tag,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
} from 'lucide-react';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ErrorState } from '@/components/common/EmptyState';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Listings' | 'Showings' | 'Transactions' | 'Rentals' | 'Investing';
type ArtifactType = 'Listing' | 'Showing' | 'Transaction' | 'RentalUnit' | 'Deal';

type ListingStatus = 'coming_soon' | 'active' | 'pending' | 'contingent' | 'sold' | 'withdrawn' | 'expired';
type TransactionStatus = 'offer' | 'accepted' | 'inspection' | 'appraisal' | 'clear_to_close' | 'closed' | 'fell_through';
type AnyStatus = ListingStatus | TransactionStatus | string;

interface RealEstateArtifact {
  artifactType: ArtifactType;
  status: AnyStatus;
  description: string;
  address?: string;
  price?: number;
  agent?: string;
  client?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  date?: string;
  roi?: number;
  notes?: string;
  [key: string]: unknown;
}

const MODE_TABS: { id: ModeTab; icon: React.ElementType; defaultType: ArtifactType }[] = [
  { id: 'Listings', icon: Home, defaultType: 'Listing' },
  { id: 'Showings', icon: Eye, defaultType: 'Showing' },
  { id: 'Transactions', icon: ArrowLeftRight, defaultType: 'Transaction' },
  { id: 'Rentals', icon: KeyRound, defaultType: 'RentalUnit' },
  { id: 'Investing', icon: TrendingUp, defaultType: 'Deal' },
];

const STATUSES_BY_TYPE: Record<ArtifactType, string[]> = {
  Listing: ['coming_soon', 'active', 'pending', 'contingent', 'sold', 'withdrawn', 'expired'],
  Showing: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'],
  Transaction: ['offer', 'accepted', 'inspection', 'appraisal', 'clear_to_close', 'closed', 'fell_through'],
  RentalUnit: ['vacant', 'listed', 'application', 'leased', 'month_to_month', 'notice_given'],
  Deal: ['prospecting', 'analysis', 'due_diligence', 'under_contract', 'closed', 'passed'],
};

const STATUS_COLORS: Record<string, string> = {
  coming_soon: 'neon-blue', active: 'neon-green', pending: 'amber-400', contingent: 'neon-purple',
  sold: 'neon-cyan', withdrawn: 'gray-400', expired: 'red-400',
  offer: 'neon-blue', accepted: 'neon-green', inspection: 'amber-400', appraisal: 'neon-purple',
  clear_to_close: 'neon-cyan', closed: 'neon-green', fell_through: 'red-400',
  scheduled: 'neon-blue', confirmed: 'neon-green', completed: 'neon-cyan', cancelled: 'red-400', no_show: 'gray-400',
  vacant: 'red-400', listed: 'neon-blue', application: 'amber-400', leased: 'neon-green', month_to_month: 'neon-cyan', notice_given: 'amber-400',
  prospecting: 'gray-400', analysis: 'neon-blue', due_diligence: 'amber-400', under_contract: 'neon-purple', passed: 'gray-400',
};

const seedItems: { title: string; data: RealEstateArtifact }[] = [
  { title: '742 Evergreen Terrace', data: { artifactType: 'Listing', status: 'active', description: 'Charming 3BR/2BA colonial with updated kitchen and landscaped yard', address: '742 Evergreen Terrace, Springfield, IL', price: 425000, agent: 'Lisa Realty', propertyType: 'Single Family', bedrooms: 3, bathrooms: 2, sqft: 1850 } },
  { title: '1600 Pennsylvania Ave NW', data: { artifactType: 'Listing', status: 'coming_soon', description: 'Luxury estate with historic significance, extensive grounds', address: '1600 Pennsylvania Ave NW, Washington, DC', price: 12500000, agent: 'Lisa Realty', propertyType: 'Estate', bedrooms: 16, bathrooms: 35, sqft: 55000 } },
  { title: 'Showing - 742 Evergreen', data: { artifactType: 'Showing', status: 'scheduled', description: 'First showing for the Garcia family', client: 'Garcia Family', agent: 'Lisa Realty', date: '2025-07-10', address: '742 Evergreen Terrace' } },
  { title: 'Purchase - 221B Baker St', data: { artifactType: 'Transaction', status: 'inspection', description: 'Buyer: Watson Ltd. Inspection contingency period, 10 days remaining.', address: '221B Baker St, London', price: 875000, agent: 'Lisa Realty', client: 'Watson Ltd', date: '2025-07-01' } },
  { title: 'Unit 4B - Sunset Apartments', data: { artifactType: 'RentalUnit', status: 'leased', description: '2BR/1BA apartment, lease through Dec 2025', address: '100 Sunset Blvd, Unit 4B', price: 2200, propertyType: 'Apartment', bedrooms: 2, bathrooms: 1, sqft: 950 } },
  { title: 'Mixed-Use Investment - Downtown', data: { artifactType: 'Deal', status: 'analysis', description: '12-unit mixed-use building with retail ground floor, value-add opportunity', address: '500 Main St, Downtown', price: 3200000, roi: 8.5, propertyType: 'Mixed Use' } },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RealEstateLensPage() {
  useLensNav('realestate');

  const [activeTab, setActiveTab] = useState<ModeTab>('Listings');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<LensItem<RealEstateArtifact> | null>(null);

  // Editor form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<ArtifactType>('Listing');
  const [formStatus, setFormStatus] = useState<string>('active');
  const [formDescription, setFormDescription] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formAgent, setFormAgent] = useState('');
  const [formClient, setFormClient] = useState('');
  const [formPropertyType, setFormPropertyType] = useState('');
  const [formBedrooms, setFormBedrooms] = useState('');
  const [formBathrooms, setFormBathrooms] = useState('');
  const [formSqft, setFormSqft] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formRoi, setFormRoi] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData<RealEstateArtifact>('realestate', 'artifact', {
    seed: seedItems.map(s => ({ title: s.title, data: s.data as unknown as Record<string, unknown>, meta: { status: s.data.status, tags: [s.data.artifactType] } })),
  });

  const runAction = useRunArtifact('realestate');

  /* ---------- derived ---------- */

  const currentTabType = MODE_TABS.find(t => t.id === activeTab)?.defaultType ?? 'Listing';
  const currentStatuses = STATUSES_BY_TYPE[currentTabType] ?? [];

  const filtered = useMemo(() => {
    let list = items.filter(i => (i.data as unknown as RealEstateArtifact).artifactType === currentTabType);
    if (filterStatus !== 'all') list = list.filter(i => (i.data as unknown as RealEstateArtifact).status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || (i.data as unknown as RealEstateArtifact).description?.toLowerCase().includes(q) || (i.data as unknown as RealEstateArtifact).address?.toLowerCase().includes(q));
    }
    return list;
  }, [items, currentTabType, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    const all = items;
    const listings = all.filter(i => (i.data as unknown as RealEstateArtifact).artifactType === 'Listing');
    const activeListings = listings.filter(i => (i.data as unknown as RealEstateArtifact).status === 'active');
    const totalListingValue = activeListings.reduce((s, i) => s + ((i.data as unknown as RealEstateArtifact).price || 0), 0);
    const closedDeals = all.filter(i => (i.data as unknown as RealEstateArtifact).artifactType === 'Transaction' && (i.data as unknown as RealEstateArtifact).status === 'closed');
    const closedVolume = closedDeals.reduce((s, i) => s + ((i.data as unknown as RealEstateArtifact).price || 0), 0);
    return {
      activeListings: activeListings.length,
      totalListingValue,
      pendingTransactions: all.filter(i => (i.data as unknown as RealEstateArtifact).artifactType === 'Transaction' && !['closed', 'fell_through'].includes((i.data as unknown as RealEstateArtifact).status)).length,
      closedVolume,
      occupiedRentals: all.filter(i => (i.data as unknown as RealEstateArtifact).artifactType === 'RentalUnit' && ['leased', 'month_to_month'].includes((i.data as unknown as RealEstateArtifact).status)).length,
      investmentDeals: all.filter(i => (i.data as unknown as RealEstateArtifact).artifactType === 'Deal').length,
    };
  }, [items]);

  /* ---------- editor helpers ---------- */

  const openNewEditor = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormType(currentTabType);
    setFormStatus(STATUSES_BY_TYPE[currentTabType][0]);
    setFormDescription('');
    setFormAddress('');
    setFormPrice('');
    setFormAgent('');
    setFormClient('');
    setFormPropertyType('');
    setFormBedrooms('');
    setFormBathrooms('');
    setFormSqft('');
    setFormDate('');
    setFormRoi('');
    setFormNotes('');
    setShowEditor(true);
  };

  const openEditEditor = (item: LensItem<RealEstateArtifact>) => {
    const d = item.data as unknown as RealEstateArtifact;
    setEditingItem(item);
    setFormTitle(item.title);
    setFormType(d.artifactType);
    setFormStatus(d.status);
    setFormDescription(d.description || '');
    setFormAddress(d.address || '');
    setFormPrice(d.price != null ? String(d.price) : '');
    setFormAgent(d.agent || '');
    setFormClient(d.client || '');
    setFormPropertyType(d.propertyType || '');
    setFormBedrooms(d.bedrooms != null ? String(d.bedrooms) : '');
    setFormBathrooms(d.bathrooms != null ? String(d.bathrooms) : '');
    setFormSqft(d.sqft != null ? String(d.sqft) : '');
    setFormDate(d.date || '');
    setFormRoi(d.roi != null ? String(d.roi) : '');
    setFormNotes(d.notes || '');
    setShowEditor(true);
  };

  const handleSave = async () => {
    const payload = {
      title: formTitle,
      data: {
        artifactType: formType, status: formStatus, description: formDescription,
        address: formAddress, price: formPrice ? parseFloat(formPrice) : undefined,
        agent: formAgent, client: formClient, propertyType: formPropertyType,
        bedrooms: formBedrooms ? parseInt(formBedrooms) : undefined,
        bathrooms: formBathrooms ? parseFloat(formBathrooms) : undefined,
        sqft: formSqft ? parseInt(formSqft) : undefined,
        date: formDate, roi: formRoi ? parseFloat(formRoi) : undefined,
        notes: formNotes,
      } as unknown as Partial<RealEstateArtifact>,
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

  const formatCurrency = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
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
          <Building2 className="w-7 h-7 text-neon-cyan" />
          <div>
            <h1 className={ds.heading1}>Real Estate</h1>
            <p className={ds.textMuted}>Listings, transactions, rentals, and investment tracking</p>
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
            className={`${ds.btnGhost} whitespace-nowrap ${activeTab === tab.id ? 'bg-neon-cyan/20 text-neon-cyan' : ''}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.id}
          </button>
        ))}
      </nav>

      {/* Dashboard */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <Home className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{stats.activeListings}</p>
          <p className={ds.textMuted}>Active Listings</p>
        </div>
        <div className={ds.panel}>
          <DollarSign className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{formatCurrency(stats.totalListingValue)}</p>
          <p className={ds.textMuted}>Listing Volume</p>
        </div>
        <div className={ds.panel}>
          <ArrowLeftRight className="w-5 h-5 text-amber-400 mb-2" />
          <p className="text-2xl font-bold">{stats.pendingTransactions}</p>
          <p className={ds.textMuted}>Pending Transactions</p>
        </div>
        <div className={ds.panel}>
          <TrendingUp className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{stats.investmentDeals}</p>
          <p className={ds.textMuted}>Investment Deals</p>
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
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${ds.select} w-48`}>
              <option value="all">All statuses</option>
              {currentStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
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
          <p className={`${ds.textMuted} text-center py-12`}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className={ds.textMuted}>No {activeTab.toLowerCase()} found. Create one to get started.</p>
          </div>
        ) : (
          <div className={ds.grid3}>
            {filtered.map(item => {
              const d = item.data as unknown as RealEstateArtifact;
              const color = STATUS_COLORS[d.status] || 'gray-400';
              return (
                <div key={item.id} className={ds.panelHover} onClick={() => openEditEditor(item)}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`${ds.heading3} text-base truncate flex-1`}>{item.title}</h3>
                    <span className={ds.badge(color)}>{d.status.replace(/_/g, ' ')}</span>
                  </div>
                  {d.address && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                      <MapPin className="w-3 h-3" /> {d.address}
                    </p>
                  )}
                  <p className={`${ds.textMuted} line-clamp-2 mb-3`}>{d.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    {d.price != null && (
                      <span className="font-semibold text-white flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {d.artifactType === 'RentalUnit' ? `${formatCurrency(d.price)}/mo` : formatCurrency(d.price)}
                      </span>
                    )}
                    {d.bedrooms != null && <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {d.bedrooms} bd</span>}
                    {d.bathrooms != null && <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {d.bathrooms} ba</span>}
                    {d.sqft != null && <span className="flex items-center gap-1"><Ruler className="w-3 h-3" /> {d.sqft.toLocaleString()} sqft</span>}
                    {d.roi != null && <span className="flex items-center gap-1 text-neon-green"><ArrowUpRight className="w-3 h-3" /> {d.roi}% ROI</span>}
                    {d.agent && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {d.agent}</span>}
                    {d.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {d.date}</span>}
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
                    <select value={formType} onChange={e => { setFormType(e.target.value as ArtifactType); setFormStatus(STATUSES_BY_TYPE[e.target.value as ArtifactType][0]); }} className={ds.select}>
                      {MODE_TABS.map(t => <option key={t.defaultType} value={t.defaultType}>{t.defaultType}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={ds.label}>Status</label>
                    <select value={formStatus} onChange={e => setFormStatus(e.target.value)} className={ds.select}>
                      {(STATUSES_BY_TYPE[formType] ?? []).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={ds.label}>Address</label>
                  <input value={formAddress} onChange={e => setFormAddress(e.target.value)} className={ds.input} placeholder="Full property address" />
                </div>
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Price ($)</label>
                    <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} className={ds.input} placeholder="0" />
                  </div>
                  <div>
                    <label className={ds.label}>Property Type</label>
                    <input value={formPropertyType} onChange={e => setFormPropertyType(e.target.value)} className={ds.input} placeholder="e.g. Single Family, Condo" />
                  </div>
                </div>
                <div className={ds.grid3}>
                  <div>
                    <label className={ds.label}>Bedrooms</label>
                    <input type="number" value={formBedrooms} onChange={e => setFormBedrooms(e.target.value)} className={ds.input} placeholder="0" min="0" />
                  </div>
                  <div>
                    <label className={ds.label}>Bathrooms</label>
                    <input type="number" value={formBathrooms} onChange={e => setFormBathrooms(e.target.value)} className={ds.input} placeholder="0" min="0" step="0.5" />
                  </div>
                  <div>
                    <label className={ds.label}>Sq Ft</label>
                    <input type="number" value={formSqft} onChange={e => setFormSqft(e.target.value)} className={ds.input} placeholder="0" min="0" />
                  </div>
                </div>
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Agent</label>
                    <input value={formAgent} onChange={e => setFormAgent(e.target.value)} className={ds.input} placeholder="Listing/buyer agent" />
                  </div>
                  <div>
                    <label className={ds.label}>Client</label>
                    <input value={formClient} onChange={e => setFormClient(e.target.value)} className={ds.input} placeholder="Buyer/seller name" />
                  </div>
                </div>
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Date</label>
                    <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className={ds.input} />
                  </div>
                  {formType === 'Deal' && (
                    <div>
                      <label className={ds.label}>Expected ROI (%)</label>
                      <input type="number" value={formRoi} onChange={e => setFormRoi(e.target.value)} className={ds.input} placeholder="0.0" step="0.1" />
                    </div>
                  )}
                </div>
                <div>
                  <label className={ds.label}>Description</label>
                  <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} className={ds.textarea} rows={3} placeholder="Property or transaction description..." />
                </div>
                <div>
                  <label className={ds.label}>Notes</label>
                  <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className={ds.textarea} rows={2} placeholder="Internal notes..." />
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
