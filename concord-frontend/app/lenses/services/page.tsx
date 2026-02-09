'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { ds } from '@/lib/design-system';
import {
  Scissors,
  Users,
  CalendarCheck,
  Sparkles,
  UserCheck,
  Baby,
  Image,
  Plus,
  Search,
  Filter,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
  BarChart3,
  ArrowUpRight,
  AlertTriangle,
  Calendar,
  Clock,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  TrendingUp,
  Star,
  Bell,
  MessageSquare,
  Palette,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModeTab = 'clients' | 'appointments' | 'services' | 'providers' | 'children' | 'portfolio';
type ArtifactType = 'Client' | 'Appointment' | 'ServiceType' | 'Provider' | 'ChildProfile' | 'PortfolioItem';
type Status = 'booked' | 'confirmed' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';

interface ServicesArtifact {
  name: string;
  type: ArtifactType;
  status: Status;
  description: string;
  notes: string;
  // Client-specific
  phone?: string;
  email?: string;
  address?: string;
  preferredProvider?: string;
  visitCount?: number;
  totalSpend?: number;
  lastVisit?: string;
  allergies?: string;
  preferences?: string;
  // Appointment-specific
  clientName?: string;
  providerName?: string;
  serviceName?: string;
  dateTime?: string;
  duration?: number;
  price?: number;
  reminderSent?: boolean;
  specialRequests?: string;
  // ServiceType-specific
  category?: string;
  basePrice?: number;
  durationMin?: number;
  requiresConsultation?: boolean;
  ageRestriction?: string;
  supplies?: string;
  // Provider-specific
  role?: string;
  specialties?: string[];
  availability?: string;
  commission?: number;
  rating?: number;
  clientCount?: number;
  revenueMonth?: number;
  // ChildProfile-specific
  parentName?: string;
  parentPhone?: string;
  age?: number;
  birthday?: string;
  medicalNotes?: string;
  emergencyContact?: string;
  // PortfolioItem-specific
  imageUrl?: string;
  servicePerformed?: string;
  providerCredit?: string;
  tags?: string[];
  featured?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODE_TABS: { id: ModeTab; label: string; icon: typeof Users; artifactType: ArtifactType }[] = [
  { id: 'clients', label: 'Clients', icon: Users, artifactType: 'Client' },
  { id: 'appointments', label: 'Appointments', icon: CalendarCheck, artifactType: 'Appointment' },
  { id: 'services', label: 'Services', icon: Sparkles, artifactType: 'ServiceType' },
  { id: 'providers', label: 'Providers', icon: UserCheck, artifactType: 'Provider' },
  { id: 'children', label: 'Children', icon: Baby, artifactType: 'ChildProfile' },
  { id: 'portfolio', label: 'Portfolio', icon: Image, artifactType: 'PortfolioItem' },
];

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  booked: { label: 'Booked', color: 'blue-400' },
  confirmed: { label: 'Confirmed', color: 'cyan-400' },
  in_progress: { label: 'In Progress', color: 'yellow-400' },
  completed: { label: 'Completed', color: 'green-400' },
  no_show: { label: 'No Show', color: 'red-400' },
  cancelled: { label: 'Cancelled', color: 'gray-400' },
};

const SERVICE_CATEGORIES = ['Hair', 'Nails', 'Skin/Facial', 'Massage', 'Waxing', 'Lashes/Brows', 'Makeup', 'Childcare', 'Tutoring', 'Photography', 'Personal Training', 'Pet Grooming', 'Cleaning', 'Other'];
const PROVIDER_ROLES = ['Stylist', 'Barber', 'Nail Tech', 'Esthetician', 'Massage Therapist', 'Lash Tech', 'Makeup Artist', 'Childcare Provider', 'Tutor', 'Photographer', 'Trainer', 'Groomer', 'Cleaner'];

const SEED_DATA: { title: string; data: Record<string, unknown> }[] = [
  { title: 'Jessica Rivera', data: { name: 'Jessica Rivera', type: 'Client', status: 'completed', description: 'Regular client - hair and nails', phone: '555-0201', email: 'jessica.r@email.com', address: '88 Willow Creek Dr', preferredProvider: 'Aisha K.', visitCount: 24, totalSpend: 3840, lastVisit: '2025-03-01', allergies: 'Latex sensitivity', preferences: 'Prefers warm tones, no ammonia color', notes: 'Always books Saturdays' } },
  { title: 'Marcus Chen', data: { name: 'Marcus Chen', type: 'Client', status: 'booked', description: 'Monthly haircut client', phone: '555-0202', email: 'mchen@email.com', address: '42 Pine Ridge', preferredProvider: 'Tony M.', visitCount: 12, totalSpend: 720, lastVisit: '2025-02-15', allergies: '', preferences: 'Fade, 2 on sides, scissors on top', notes: '' } },
  { title: 'Color & Cut - Jessica R.', data: { name: 'Color & Cut - Jessica R.', type: 'Appointment', status: 'confirmed', description: 'Full color refresh + trim', clientName: 'Jessica Rivera', providerName: 'Aisha K.', serviceName: 'Color & Cut', dateTime: '2025-03-22T10:00', duration: 120, price: 185, reminderSent: true, specialRequests: 'Wants to go slightly warmer this time', notes: '' } },
  { title: 'Kids Haircut - Lily Chen', data: { name: 'Kids Haircut - Lily Chen', type: 'Appointment', status: 'booked', description: 'Trim for 6-year-old', clientName: 'Marcus Chen', providerName: 'Tony M.', serviceName: 'Kids Cut', dateTime: '2025-03-22T14:00', duration: 30, price: 25, reminderSent: false, specialRequests: 'First time, may be nervous', notes: '' } },
  { title: 'Full Color & Cut', data: { name: 'Full Color & Cut', type: 'ServiceType', status: 'completed', description: 'Single-process color with shampoo, condition, and cut', category: 'Hair', basePrice: 185, durationMin: 120, requiresConsultation: true, ageRestriction: '16+', supplies: 'Color mix, gloves, foils, cape', notes: 'Add $30 for long hair, $50 for highlights' } },
  { title: 'Classic Manicure', data: { name: 'Classic Manicure', type: 'ServiceType', status: 'completed', description: 'Shape, cuticle care, hand massage, polish', category: 'Nails', basePrice: 35, durationMin: 45, requiresConsultation: false, ageRestriction: '', supplies: 'Polish, cuticle oil, file, buffer', notes: 'Gel upgrade +$15' } },
  { title: 'Kids Cut', data: { name: 'Kids Cut', type: 'ServiceType', status: 'completed', description: 'Haircut for children 12 and under', category: 'Hair', basePrice: 25, durationMin: 30, requiresConsultation: false, ageRestriction: '12 and under', supplies: 'Cape, spray bottle', notes: 'Includes wash and style' } },
  { title: 'Aisha K.', data: { name: 'Aisha K.', type: 'Provider', status: 'in_progress', description: 'Senior stylist specializing in color and cuts', role: 'Stylist', specialties: ['Color', 'Balayage', 'Cuts', 'Extensions'], availability: 'Tue-Sat 9am-6pm', commission: 55, rating: 4.9, clientCount: 86, revenueMonth: 8400, notes: '12 years experience, lead colorist' } },
  { title: 'Tony M.', data: { name: 'Tony M.', type: 'Provider', status: 'in_progress', description: 'Barber and kids specialist', role: 'Barber', specialties: ['Fades', 'Beard Trim', 'Kids Cuts'], availability: 'Mon-Fri 10am-7pm', commission: 50, rating: 4.8, clientCount: 104, revenueMonth: 6200, notes: 'Great with nervous kids' } },
  { title: 'Lily Chen', data: { name: 'Lily Chen', type: 'ChildProfile', status: 'booked', description: '', parentName: 'Marcus Chen', parentPhone: '555-0202', age: 6, birthday: '2019-05-14', medicalNotes: 'None', emergencyContact: 'Marcus Chen - 555-0202', notes: 'First visit - may need extra patience' } },
  { title: 'Balayage Transformation - Jessica R.', data: { name: 'Balayage Transformation - Jessica R.', type: 'PortfolioItem', status: 'completed', description: 'Before and after balayage with warm caramel tones', imageUrl: '', servicePerformed: 'Balayage + Cut', providerCredit: 'Aisha K.', tags: ['Balayage', 'Color', 'Transformation'], featured: true, notes: 'Client consented to portfolio use' } },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ServicesLensPage() {
  useLensNav('services');

  const [activeTab, setActiveTab] = useState<ModeTab>('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LensItem<ServicesArtifact> | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  // Editor form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<Status>('booked');
  const [formNotes, setFormNotes] = useState('');
  // Client
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPreferredProvider, setFormPreferredProvider] = useState('');
  const [formAllergies, setFormAllergies] = useState('');
  const [formPreferences, setFormPreferences] = useState('');
  // Appointment
  const [formClientName, setFormClientName] = useState('');
  const [formProviderName, setFormProviderName] = useState('');
  const [formServiceName, setFormServiceName] = useState('');
  const [formDateTime, setFormDateTime] = useState('');
  const [formDuration, setFormDuration] = useState('60');
  const [formPrice, setFormPrice] = useState('');
  const [formSpecialRequests, setFormSpecialRequests] = useState('');
  // ServiceType
  const [formCategory, setFormCategory] = useState('Hair');
  const [formBasePrice, setFormBasePrice] = useState('');
  const [formDurationMin, setFormDurationMin] = useState('60');
  const [formSupplies, setFormSupplies] = useState('');
  // Provider
  const [formRole, setFormRole] = useState('Stylist');
  const [formAvailability, setFormAvailability] = useState('');
  const [formCommission, setFormCommission] = useState('50');
  // ChildProfile
  const [formParentName, setFormParentName] = useState('');
  const [formParentPhone, setFormParentPhone] = useState('');
  const [formAge, setFormAge] = useState('');
  const [formBirthday, setFormBirthday] = useState('');
  const [formMedicalNotes, setFormMedicalNotes] = useState('');
  const [formEmergencyContact, setFormEmergencyContact] = useState('');
  // Portfolio
  const [formServicePerformed, setFormServicePerformed] = useState('');
  const [formProviderCredit, setFormProviderCredit] = useState('');
  const [formFeatured, setFormFeatured] = useState(false);

  const activeArtifactType = MODE_TABS.find(t => t.id === activeTab)?.artifactType || 'Client';

  const { items, isLoading, create, update, remove } = useLensData<ServicesArtifact>('services', activeArtifactType, {
    seed: SEED_DATA.filter(s => (s.data as Record<string, unknown>).type === activeArtifactType),
  });

  const filtered = useMemo(() => {
    let result = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.data as unknown as ServicesArtifact).description?.toLowerCase().includes(q) ||
        (i.data as unknown as ServicesArtifact).clientName?.toLowerCase().includes(q) ||
        (i.data as unknown as ServicesArtifact).providerName?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      result = result.filter(i => (i.data as unknown as ServicesArtifact).status === filterStatus);
    }
    return result;
  }, [items, searchQuery, filterStatus]);

  // ---------------------------------------------------------------------------
  // Editor helpers
  // ---------------------------------------------------------------------------

  const openCreate = () => {
    setEditingItem(null);
    setFormName(''); setFormDescription(''); setFormStatus('booked'); setFormNotes('');
    setFormPhone(''); setFormEmail(''); setFormAddress(''); setFormPreferredProvider('');
    setFormAllergies(''); setFormPreferences('');
    setFormClientName(''); setFormProviderName(''); setFormServiceName('');
    setFormDateTime(''); setFormDuration('60'); setFormPrice(''); setFormSpecialRequests('');
    setFormCategory('Hair'); setFormBasePrice(''); setFormDurationMin('60'); setFormSupplies('');
    setFormRole('Stylist'); setFormAvailability(''); setFormCommission('50');
    setFormParentName(''); setFormParentPhone(''); setFormAge(''); setFormBirthday('');
    setFormMedicalNotes(''); setFormEmergencyContact('');
    setFormServicePerformed(''); setFormProviderCredit(''); setFormFeatured(false);
    setEditorOpen(true);
  };

  const openEdit = (item: LensItem<ServicesArtifact>) => {
    const d = item.data as unknown as ServicesArtifact;
    setEditingItem(item);
    setFormName(d.name || item.title); setFormDescription(d.description || '');
    setFormStatus(d.status || 'booked'); setFormNotes(d.notes || '');
    setFormPhone(d.phone || ''); setFormEmail(d.email || '');
    setFormAddress(d.address || ''); setFormPreferredProvider(d.preferredProvider || '');
    setFormAllergies(d.allergies || ''); setFormPreferences(d.preferences || '');
    setFormClientName(d.clientName || ''); setFormProviderName(d.providerName || '');
    setFormServiceName(d.serviceName || ''); setFormDateTime(d.dateTime || '');
    setFormDuration(String(d.duration || '60')); setFormPrice(String(d.price || ''));
    setFormSpecialRequests(d.specialRequests || '');
    setFormCategory(d.category || 'Hair'); setFormBasePrice(String(d.basePrice || ''));
    setFormDurationMin(String(d.durationMin || '60')); setFormSupplies(d.supplies || '');
    setFormRole(d.role || 'Stylist'); setFormAvailability(d.availability || '');
    setFormCommission(String(d.commission || '50'));
    setFormParentName(d.parentName || ''); setFormParentPhone(d.parentPhone || '');
    setFormAge(String(d.age || '')); setFormBirthday(d.birthday || '');
    setFormMedicalNotes(d.medicalNotes || ''); setFormEmergencyContact(d.emergencyContact || '');
    setFormServicePerformed(d.servicePerformed || ''); setFormProviderCredit(d.providerCredit || '');
    setFormFeatured(d.featured || false);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    const base: Record<string, unknown> = {
      name: formName, type: activeArtifactType, status: formStatus,
      description: formDescription, notes: formNotes,
    };
    if (activeArtifactType === 'Client') {
      Object.assign(base, { phone: formPhone, email: formEmail, address: formAddress, preferredProvider: formPreferredProvider, allergies: formAllergies, preferences: formPreferences });
    } else if (activeArtifactType === 'Appointment') {
      Object.assign(base, { clientName: formClientName, providerName: formProviderName, serviceName: formServiceName, dateTime: formDateTime, duration: parseInt(formDuration) || 60, price: parseFloat(formPrice) || 0, specialRequests: formSpecialRequests });
    } else if (activeArtifactType === 'ServiceType') {
      Object.assign(base, { category: formCategory, basePrice: parseFloat(formBasePrice) || 0, durationMin: parseInt(formDurationMin) || 60, supplies: formSupplies });
    } else if (activeArtifactType === 'Provider') {
      Object.assign(base, { role: formRole, availability: formAvailability, commission: parseInt(formCommission) || 50 });
    } else if (activeArtifactType === 'ChildProfile') {
      Object.assign(base, { parentName: formParentName, parentPhone: formParentPhone, age: parseInt(formAge) || 0, birthday: formBirthday, medicalNotes: formMedicalNotes, emergencyContact: formEmergencyContact });
    } else if (activeArtifactType === 'PortfolioItem') {
      Object.assign(base, { servicePerformed: formServicePerformed, providerCredit: formProviderCredit, featured: formFeatured });
    }
    const payload = { title: formName, data: base as Partial<ServicesArtifact>, meta: { status: formStatus, tags: [activeArtifactType] } };
    if (editingItem) { await update(editingItem.id, payload); } else { await create(payload); }
    setEditorOpen(false);
  };

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  const dashboardMetrics = useMemo(() => {
    const allData = items.map(i => i.data as unknown as ServicesArtifact);
    const totalClients = allData.filter(d => d.type === 'Client').length;
    const todayAppts = allData.filter(d => d.type === 'Appointment' && (d.status === 'booked' || d.status === 'confirmed')).length;
    const totalRevenue = allData.filter(d => d.type === 'Appointment' && d.status === 'completed').reduce((s, d) => s + (d.price || 0), 0);
    const noShows = allData.filter(d => d.status === 'no_show').length;
    const avgRating = (() => {
      const providers = allData.filter(d => d.type === 'Provider' && d.rating);
      return providers.length > 0 ? providers.reduce((s, d) => s + (d.rating || 0), 0) / providers.length : 0;
    })();
    const topProvider = allData.filter(d => d.type === 'Provider').sort((a, b) => (b.revenueMonth || 0) - (a.revenueMonth || 0))[0];
    const byStatus: Record<string, number> = {};
    allData.forEach(d => { byStatus[d.status] = (byStatus[d.status] || 0) + 1; });
    return { totalClients, todayAppts, totalRevenue, noShows, avgRating, topProvider, byStatus, total: items.length };
  }, [items]);

  const renderStatusBadge = (status: Status) => {
    const cfg = STATUS_CONFIG[status];
    return <span className={ds.badge(cfg.color)}>{cfg.label}</span>;
  };

  // ---------------------------------------------------------------------------
  // Render: Library
  // ---------------------------------------------------------------------------

  const renderLibrary = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={`Search ${activeTab}...`} className={cn(ds.input, 'pl-10')} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as Status | 'all')} className={cn(ds.select, 'w-40')}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => { setSearchQuery(''); setFilterStatus('all'); }} className={ds.btnGhost}><Filter className="w-4 h-4" /> Clear</button>
        <button onClick={openCreate} className={ds.btnPrimary}><Plus className="w-4 h-4" /> New {activeArtifactType}</button>
      </div>

      {isLoading ? (
        <div className={cn(ds.panel, 'text-center py-12')}><p className={ds.textMuted}>Loading {activeTab}...</p></div>
      ) : filtered.length === 0 ? (
        <div className={cn(ds.panel, 'text-center py-12')}>
          <Scissors className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className={ds.textMuted}>No {activeTab} found. Create one to get started.</p>
        </div>
      ) : (
        <div className={ds.grid3}>
          {filtered.map(item => {
            const d = item.data as unknown as ServicesArtifact;
            return (
              <div key={item.id} className={ds.panelHover} onClick={() => openEdit(item)}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className={ds.heading3}>{item.title}</h3>
                  {renderStatusBadge(d.status)}
                </div>
                {d.description && <p className={cn(ds.textMuted, 'line-clamp-2 mb-2')}>{d.description}</p>}

                {/* Client-specific */}
                {d.type === 'Client' && (
                  <div className="mt-2 space-y-1 text-sm">
                    {d.phone && <p className="flex items-center gap-1 text-gray-400"><Phone className="w-3 h-3" /> {d.phone}</p>}
                    {d.email && <p className="flex items-center gap-1 text-gray-400"><Mail className="w-3 h-3" /> {d.email}</p>}
                    {d.preferredProvider && <p className="flex items-center gap-1 text-gray-400"><Heart className="w-3 h-3" /> Prefers: {d.preferredProvider}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      {d.visitCount && <span className={ds.badge('blue-400')}>{d.visitCount} visits</span>}
                      {d.totalSpend && <span className="text-green-400 font-bold">${d.totalSpend.toLocaleString()}</span>}
                    </div>
                    {d.allergies && <p className="flex items-center gap-1 text-orange-400 text-xs mt-1"><AlertTriangle className="w-3 h-3" /> {d.allergies}</p>}
                  </div>
                )}

                {/* Appointment-specific */}
                {d.type === 'Appointment' && (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="flex items-center gap-1 text-gray-400"><Users className="w-3 h-3" /> {d.clientName} with {d.providerName}</p>
                    <p className="flex items-center gap-1 text-gray-400"><Sparkles className="w-3 h-3" /> {d.serviceName}</p>
                    {d.dateTime && <p className="flex items-center gap-1 text-gray-400"><Calendar className="w-3 h-3" /> {new Date(d.dateTime).toLocaleString()}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      {d.duration && <span className="flex items-center gap-1 text-gray-400"><Clock className="w-3 h-3" /> {d.duration} min</span>}
                      {d.price && <span className="text-green-400 font-bold">${d.price}</span>}
                    </div>
                    {d.reminderSent && <span className={ds.badge('cyan-400')}><Bell className="w-3 h-3" /> Reminder sent</span>}
                    {d.specialRequests && <p className="text-yellow-400 text-xs mt-1">{d.specialRequests}</p>}
                  </div>
                )}

                {/* ServiceType-specific */}
                {d.type === 'ServiceType' && (
                  <div className="mt-2 space-y-1 text-sm">
                    {d.category && <span className={ds.badge('purple-400')}>{d.category}</span>}
                    <div className="flex items-center gap-3 mt-2">
                      {d.basePrice && <span className="text-green-400 font-bold">${d.basePrice}</span>}
                      {d.durationMin && <span className="flex items-center gap-1 text-gray-400"><Clock className="w-3 h-3" /> {d.durationMin} min</span>}
                    </div>
                    {d.ageRestriction && <p className="text-gray-400 text-xs">Age: {d.ageRestriction}</p>}
                    {d.requiresConsultation && <span className={ds.badge('yellow-400')}>Consultation required</span>}
                  </div>
                )}

                {/* Provider-specific */}
                {d.type === 'Provider' && (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="font-medium text-purple-400">{d.role}</p>
                    {d.specialties && d.specialties.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {d.specialties.map(s => <span key={s} className={ds.badge('cyan-400')}>{s}</span>)}
                      </div>
                    )}
                    {d.rating && (
                      <p className="flex items-center gap-1 text-yellow-400">
                        <Star className="w-3 h-3 fill-current" /> {d.rating.toFixed(1)}
                        {d.clientCount && <span className="text-gray-400 ml-2">({d.clientCount} clients)</span>}
                      </p>
                    )}
                    {d.revenueMonth && <p className="text-green-400 font-bold">${d.revenueMonth.toLocaleString()}/mo</p>}
                    {d.availability && <p className="flex items-center gap-1 text-gray-400"><Clock className="w-3 h-3" /> {d.availability}</p>}
                    {d.commission && <p className="text-gray-400">{d.commission}% commission</p>}
                  </div>
                )}

                {/* ChildProfile-specific */}
                {d.type === 'ChildProfile' && (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-gray-400">Age: {d.age} {d.birthday ? `(DOB: ${d.birthday})` : ''}</p>
                    <p className="flex items-center gap-1 text-gray-400"><Users className="w-3 h-3" /> Parent: {d.parentName}</p>
                    {d.parentPhone && <p className="flex items-center gap-1 text-gray-400"><Phone className="w-3 h-3" /> {d.parentPhone}</p>}
                    {d.medicalNotes && d.medicalNotes !== 'None' && (
                      <p className="flex items-center gap-1 text-orange-400 text-xs"><AlertTriangle className="w-3 h-3" /> {d.medicalNotes}</p>
                    )}
                  </div>
                )}

                {/* PortfolioItem-specific */}
                {d.type === 'PortfolioItem' && (
                  <div className="mt-2 space-y-1 text-sm">
                    {d.servicePerformed && <p className="text-gray-400">Service: {d.servicePerformed}</p>}
                    {d.providerCredit && <p className="text-gray-400">By: {d.providerCredit}</p>}
                    {d.featured && <span className={ds.badge('yellow-400')}><Star className="w-3 h-3" /> Featured</span>}
                    {d.tags && d.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {d.tags.map(t => <span key={t} className={ds.badge('gray-400')}>{t}</span>)}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-lattice-border">
                  <button onClick={e => { e.stopPropagation(); openEdit(item); }} className={cn(ds.btnSmall, 'text-gray-400 hover:text-white')}><Edit2 className="w-3 h-3" /> Edit</button>
                  <button onClick={e => { e.stopPropagation(); remove(item.id); }} className={cn(ds.btnSmall, 'text-red-400 hover:text-red-300')}><Trash2 className="w-3 h-3" /> Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Editor
  // ---------------------------------------------------------------------------

  const renderEditor = () => {
    if (!editorOpen) return null;
    return (
      <div className={ds.modalBackdrop} onClick={() => setEditorOpen(false)}>
        <div className={ds.modalContainer}>
          <div className={cn(ds.modalPanel, 'max-w-2xl max-h-[85vh] overflow-y-auto')} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-lattice-border">
              <h2 className={ds.heading2}>{editingItem ? `Edit ${activeArtifactType}` : `New ${activeArtifactType}`}</h2>
              <button onClick={() => setEditorOpen(false)} className={ds.btnGhost}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={ds.label}>Name</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} className={ds.input} placeholder="Name..." />
              </div>
              <div>
                <label className={ds.label}>Description</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} className={ds.textarea} />
              </div>
              <div>
                <label className={ds.label}>Status</label>
                <select value={formStatus} onChange={e => setFormStatus(e.target.value as Status)} className={cn(ds.select, 'w-48')}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              {/* Client fields */}
              {activeTab === 'clients' && (
                <>
                  <div className={ds.grid2}>
                    <div><label className={ds.label}>Phone</label><input value={formPhone} onChange={e => setFormPhone(e.target.value)} className={ds.input} placeholder="555-0100" /></div>
                    <div><label className={ds.label}>Email</label><input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className={ds.input} placeholder="email@example.com" /></div>
                  </div>
                  <div><label className={ds.label}>Address</label><input value={formAddress} onChange={e => setFormAddress(e.target.value)} className={ds.input} /></div>
                  <div className={ds.grid2}>
                    <div><label className={ds.label}>Preferred Provider</label><input value={formPreferredProvider} onChange={e => setFormPreferredProvider(e.target.value)} className={ds.input} /></div>
                    <div><label className={ds.label}>Allergies / Sensitivities</label><input value={formAllergies} onChange={e => setFormAllergies(e.target.value)} className={ds.input} /></div>
                  </div>
                  <div><label className={ds.label}>Preferences</label><textarea value={formPreferences} onChange={e => setFormPreferences(e.target.value)} rows={2} className={ds.textarea} placeholder="Color preferences, style notes..." /></div>
                </>
              )}

              {/* Appointment fields */}
              {activeTab === 'appointments' && (
                <>
                  <div className={ds.grid2}>
                    <div><label className={ds.label}>Client</label><input value={formClientName} onChange={e => setFormClientName(e.target.value)} className={ds.input} /></div>
                    <div><label className={ds.label}>Provider</label><input value={formProviderName} onChange={e => setFormProviderName(e.target.value)} className={ds.input} /></div>
                  </div>
                  <div className={ds.grid3}>
                    <div><label className={ds.label}>Service</label><input value={formServiceName} onChange={e => setFormServiceName(e.target.value)} className={ds.input} /></div>
                    <div><label className={ds.label}>Date & Time</label><input type="datetime-local" value={formDateTime} onChange={e => setFormDateTime(e.target.value)} className={ds.input} /></div>
                    <div><label className={ds.label}>Duration (min)</label><input type="number" value={formDuration} onChange={e => setFormDuration(e.target.value)} className={ds.input} /></div>
                  </div>
                  <div className={ds.grid2}>
                    <div><label className={ds.label}>Price ($)</label><input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} className={ds.input} /></div>
                    <div><label className={ds.label}>Special Requests</label><input value={formSpecialRequests} onChange={e => setFormSpecialRequests(e.target.value)} className={ds.input} /></div>
                  </div>
                </>
              )}

              {/* ServiceType fields */}
              {activeTab === 'services' && (
                <>
                  <div className={ds.grid3}>
                    <div><label className={ds.label}>Category</label><select value={formCategory} onChange={e => setFormCategory(e.target.value)} className={ds.select}>{SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className={ds.label}>Base Price ($)</label><input type="number" value={formBasePrice} onChange={e => setFormBasePrice(e.target.value)} className={ds.input} /></div>
                    <div><label className={ds.label}>Duration (min)</label><input type="number" value={formDurationMin} onChange={e => setFormDurationMin(e.target.value)} className={ds.input} /></div>
                  </div>
                  <div><label className={ds.label}>Supplies Needed</label><input value={formSupplies} onChange={e => setFormSupplies(e.target.value)} className={ds.input} placeholder="List supplies..." /></div>
                </>
              )}

              {/* Provider fields */}
              {activeTab === 'providers' && (
                <div className={ds.grid3}>
                  <div><label className={ds.label}>Role</label><select value={formRole} onChange={e => setFormRole(e.target.value)} className={ds.select}>{PROVIDER_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                  <div><label className={ds.label}>Availability</label><input value={formAvailability} onChange={e => setFormAvailability(e.target.value)} className={ds.input} placeholder="Tue-Sat 9am-6pm" /></div>
                  <div><label className={ds.label}>Commission (%)</label><input type="number" value={formCommission} onChange={e => setFormCommission(e.target.value)} className={ds.input} /></div>
                </div>
              )}

              {/* ChildProfile fields */}
              {activeTab === 'children' && (
                <>
                  <div className={ds.grid2}>
                    <div><label className={ds.label}>Parent Name</label><input value={formParentName} onChange={e => setFormParentName(e.target.value)} className={ds.input} /></div>
                    <div><label className={ds.label}>Parent Phone</label><input value={formParentPhone} onChange={e => setFormParentPhone(e.target.value)} className={ds.input} /></div>
                  </div>
                  <div className={ds.grid2}>
                    <div><label className={ds.label}>Age</label><input type="number" value={formAge} onChange={e => setFormAge(e.target.value)} className={ds.input} /></div>
                    <div><label className={ds.label}>Birthday</label><input type="date" value={formBirthday} onChange={e => setFormBirthday(e.target.value)} className={ds.input} /></div>
                  </div>
                  <div><label className={ds.label}>Medical Notes</label><textarea value={formMedicalNotes} onChange={e => setFormMedicalNotes(e.target.value)} rows={2} className={ds.textarea} /></div>
                  <div><label className={ds.label}>Emergency Contact</label><input value={formEmergencyContact} onChange={e => setFormEmergencyContact(e.target.value)} className={ds.input} /></div>
                </>
              )}

              {/* PortfolioItem fields */}
              {activeTab === 'portfolio' && (
                <>
                  <div className={ds.grid2}>
                    <div><label className={ds.label}>Service Performed</label><input value={formServicePerformed} onChange={e => setFormServicePerformed(e.target.value)} className={ds.input} /></div>
                    <div><label className={ds.label}>Provider Credit</label><input value={formProviderCredit} onChange={e => setFormProviderCredit(e.target.value)} className={ds.input} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="featured" checked={formFeatured} onChange={e => setFormFeatured(e.target.checked)} className="rounded" />
                    <label htmlFor="featured" className={ds.label}>Featured in portfolio</label>
                  </div>
                </>
              )}

              <div>
                <label className={ds.label}>Notes</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} className={ds.textarea} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-lattice-border">
              <button onClick={() => setEditorOpen(false)} className={ds.btnSecondary}>Cancel</button>
              <button onClick={handleSave} className={ds.btnPrimary}><CheckCircle2 className="w-4 h-4" /> {editingItem ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render: Dashboard
  // ---------------------------------------------------------------------------

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-blue-400" /><span className={ds.textMuted}>Total Clients</span></div>
          <p className="text-3xl font-bold">{dashboardMetrics.totalClients}</p>
          <p className={ds.textMuted}>Active client base</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><CalendarCheck className="w-5 h-5 text-cyan-400" /><span className={ds.textMuted}>Upcoming Appts</span></div>
          <p className="text-3xl font-bold">{dashboardMetrics.todayAppts}</p>
          <p className={ds.textMuted}>Booked or confirmed</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><DollarSign className="w-5 h-5 text-green-400" /><span className={ds.textMuted}>Revenue (Completed)</span></div>
          <p className="text-3xl font-bold text-neon-green">${dashboardMetrics.totalRevenue.toLocaleString()}</p>
          <p className={ds.textMuted}>From completed appointments</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><Star className="w-5 h-5 text-yellow-400" /><span className={ds.textMuted}>Avg Provider Rating</span></div>
          <p className="text-3xl font-bold text-yellow-400">{dashboardMetrics.avgRating.toFixed(1)}</p>
          <p className={ds.textMuted}>{dashboardMetrics.noShows} no-shows tracked</p>
        </div>
      </div>

      {dashboardMetrics.topProvider && (
        <div className={ds.panel}>
          <h3 className={cn(ds.heading3, 'mb-3 flex items-center gap-2')}>
            <TrendingUp className="w-5 h-5 text-neon-cyan" /> Top Provider This Month
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xl font-bold">
              {(dashboardMetrics.topProvider.name || '?')[0]}
            </div>
            <div>
              <p className="font-bold text-lg">{dashboardMetrics.topProvider.name}</p>
              <p className={ds.textMuted}>{dashboardMetrics.topProvider.role} - {dashboardMetrics.topProvider.clientCount} clients</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-green-400 font-bold text-xl">${(dashboardMetrics.topProvider.revenueMonth || 0).toLocaleString()}</p>
              <p className={ds.textMuted}>Monthly revenue</p>
            </div>
          </div>
        </div>
      )}

      <div className={ds.panel}>
        <h3 className={cn(ds.heading3, 'mb-4')}>Status Breakdown</h3>
        <div className="space-y-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = dashboardMetrics.byStatus[key] || 0;
            const pct = dashboardMetrics.total > 0 ? (count / dashboardMetrics.total) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-400">{cfg.label}</span>
                <div className="flex-1 h-2 bg-lattice-surface rounded-full overflow-hidden">
                  <div className={`h-full bg-${cfg.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <span className={cn(ds.textMono, 'w-8 text-right')}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={ds.panel}>
        <h3 className={cn(ds.heading3, 'mb-4 flex items-center gap-2')}><TrendingUp className="w-5 h-5 text-neon-cyan" /> Recent Items</h3>
        <div className="space-y-2">
          {items.slice(0, 5).map(item => {
            const d = item.data as unknown as ServicesArtifact;
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-lattice-surface/50 hover:bg-lattice-surface cursor-pointer" onClick={() => openEdit(item)}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className={ds.textMuted}>{d.type} {d.providerName ? `- ${d.providerName}` : ''}</p>
                </div>
                {renderStatusBadge(d.status)}
                <ArrowUpRight className="w-4 h-4 text-gray-500" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className={ds.pageContainer}>
      <header className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <Scissors className="w-8 h-8 text-pink-400" />
          <div>
            <h1 className={ds.heading1}>Personal Services</h1>
            <p className={ds.textMuted}>Clients, appointments, services, providers, and portfolio management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDashboard(!showDashboard)} className={cn(showDashboard ? ds.btnPrimary : ds.btnSecondary)}>
            <BarChart3 className="w-4 h-4" /> Dashboard
          </button>
        </div>
      </header>

      <nav className="flex items-center gap-2 border-b border-lattice-border pb-4 overflow-x-auto">
        {MODE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setShowDashboard(false); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap',
              activeTab === tab.id && !showDashboard
                ? 'bg-neon-blue/20 text-neon-blue'
                : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      {showDashboard ? renderDashboard() : renderLibrary()}
      {renderEditor()}
    </div>
  );
}
