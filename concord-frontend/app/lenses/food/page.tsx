'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { ds } from '@/lib/design-system';
import {
  ChefHat,
  UtensilsCrossed,
  Warehouse,
  CalendarClock,
  FlaskConical,
  Clock,
  Plus,
  Search,
  Filter,
  X,
  Edit2,
  Trash2,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  ArrowUpRight,
  Thermometer,
  Timer,
  Scale,
  ShoppingCart,
  Percent,
  TrendingUp,
  TrendingDown,
  Flame,
  Leaf,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModeTab = 'recipes' | 'menu' | 'inventory' | 'bookings' | 'batches' | 'shifts';
type ArtifactType = 'Recipe' | 'Menu' | 'InventoryItem' | 'Booking' | 'Batch' | 'Shift';
type Status = 'prep' | 'active' | '86d' | 'seasonal' | 'archived';

interface FoodArtifact {
  name: string;
  type: ArtifactType;
  status: Status;
  description: string;
  category: string;
  cost: number;
  price: number;
  notes: string;
  // Recipe-specific
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  ingredients?: { item: string; qty: string; unit: string; cost: number }[];
  allergens?: string[];
  dietary?: string[];
  // Menu-specific
  section?: string;
  menuDate?: string;
  // Inventory-specific
  supplier?: string;
  currentStock?: number;
  parLevel?: number;
  unit?: string;
  expiryDate?: string;
  storageTemp?: string;
  // Booking-specific
  guestName?: string;
  guestCount?: number;
  dateTime?: string;
  tableNumber?: string;
  specialRequests?: string;
  phone?: string;
  // Batch-specific
  recipe?: string;
  batchSize?: number;
  startedAt?: string;
  completedAt?: string;
  yield?: number;
  // Shift-specific
  employee?: string;
  role?: string;
  shiftStart?: string;
  shiftEnd?: string;
  station?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODE_TABS: { id: ModeTab; label: string; icon: typeof ChefHat; artifactType: ArtifactType }[] = [
  { id: 'recipes', label: 'Recipes', icon: ChefHat, artifactType: 'Recipe' },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed, artifactType: 'Menu' },
  { id: 'inventory', label: 'Inventory', icon: Warehouse, artifactType: 'InventoryItem' },
  { id: 'bookings', label: 'Bookings', icon: CalendarClock, artifactType: 'Booking' },
  { id: 'batches', label: 'Batches', icon: FlaskConical, artifactType: 'Batch' },
  { id: 'shifts', label: 'Shifts', icon: Clock, artifactType: 'Shift' },
];

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  prep: { label: 'Prep', color: 'yellow-400' },
  active: { label: 'Active', color: 'green-400' },
  '86d': { label: '86\'d', color: 'red-400' },
  seasonal: { label: 'Seasonal', color: 'blue-400' },
  archived: { label: 'Archived', color: 'gray-400' },
};

const MENU_SECTIONS = ['Appetizers', 'Mains', 'Sides', 'Desserts', 'Beverages', 'Specials', 'Kids'];
const ALLERGENS = ['Gluten', 'Dairy', 'Nuts', 'Shellfish', 'Soy', 'Eggs', 'Fish', 'Sesame'];
const DIETARY_FLAGS = ['Vegan', 'Vegetarian', 'GF', 'DF', 'Keto', 'Halal', 'Kosher'];
const STATIONS = ['Grill', 'Saute', 'Cold/Garde Manger', 'Pastry', 'Prep', 'Expo', 'Dish', 'Bar', 'FOH'];
const ROLES = ['Head Chef', 'Sous Chef', 'Line Cook', 'Prep Cook', 'Pastry Chef', 'Bartender', 'Server', 'Host', 'Dishwasher', 'Manager'];

const SEED_DATA: { title: string; data: Record<string, unknown> }[] = [
  { title: 'Pan-Seared Salmon', data: { name: 'Pan-Seared Salmon', type: 'Recipe', status: 'active', description: 'Atlantic salmon with lemon-dill beurre blanc, roasted fingerlings, and haricots verts', category: 'Mains', cost: 8.50, price: 32.00, servings: 1, prepTime: 15, cookTime: 12, ingredients: [{ item: 'Salmon fillet', qty: '8', unit: 'oz', cost: 4.50 }, { item: 'Fingerling potatoes', qty: '6', unit: 'oz', cost: 1.20 }, { item: 'Haricots verts', qty: '4', unit: 'oz', cost: 0.80 }, { item: 'Butter', qty: '2', unit: 'tbsp', cost: 0.40 }, { item: 'Lemon', qty: '1', unit: 'ea', cost: 0.30 }, { item: 'Fresh dill', qty: '1', unit: 'tbsp', cost: 0.15 }], allergens: ['Fish', 'Dairy'], dietary: [], notes: 'Skin-on, score before searing' } },
  { title: 'Mushroom Risotto', data: { name: 'Mushroom Risotto', type: 'Recipe', status: 'active', description: 'Arborio rice with mixed wild mushrooms, parmesan, truffle oil', category: 'Mains', cost: 5.20, price: 26.00, servings: 1, prepTime: 10, cookTime: 25, ingredients: [{ item: 'Arborio rice', qty: '6', unit: 'oz', cost: 0.90 }, { item: 'Mixed mushrooms', qty: '5', unit: 'oz', cost: 2.40 }, { item: 'Parmesan', qty: '2', unit: 'oz', cost: 0.80 }, { item: 'Truffle oil', qty: '1', unit: 'tsp', cost: 0.60 }], allergens: ['Dairy'], dietary: ['Vegetarian', 'GF'], notes: 'Stir constantly, add stock gradually' } },
  { title: 'Chocolate Lava Cake', data: { name: 'Chocolate Lava Cake', type: 'Recipe', status: 'active', description: 'Individual dark chocolate fondant with vanilla bean ice cream', category: 'Desserts', cost: 3.10, price: 14.00, servings: 1, prepTime: 20, cookTime: 14, ingredients: [{ item: 'Dark chocolate (70%)', qty: '4', unit: 'oz', cost: 1.60 }, { item: 'Butter', qty: '3', unit: 'tbsp', cost: 0.60 }, { item: 'Eggs', qty: '2', unit: 'ea', cost: 0.50 }, { item: 'Sugar', qty: '3', unit: 'tbsp', cost: 0.10 }], allergens: ['Dairy', 'Eggs', 'Gluten'], dietary: [], notes: 'Bake to order, 14 min at 425F' } },
  { title: 'Atlantic Salmon Fillet', data: { name: 'Atlantic Salmon Fillet', type: 'InventoryItem', status: 'active', description: 'Fresh Atlantic salmon, skin-on fillets', category: 'Protein', cost: 14.50, price: 0, supplier: 'Harbor Fresh Seafood', currentStock: 24, parLevel: 30, unit: 'lb', expiryDate: '2025-03-10', storageTemp: '32-38F', notes: 'Check for freshness daily' } },
  { title: 'Arborio Rice', data: { name: 'Arborio Rice', type: 'InventoryItem', status: 'active', description: 'Italian arborio rice for risotto', category: 'Dry Goods', cost: 3.80, price: 0, supplier: 'Roma Imports', currentStock: 45, parLevel: 20, unit: 'lb', expiryDate: '2026-01-01', storageTemp: 'Dry/Ambient', notes: '' } },
  { title: 'Table 12 - Anderson', data: { name: 'Table 12 - Anderson', type: 'Booking', status: 'active', description: 'Anniversary dinner', category: '', cost: 0, price: 0, guestName: 'Anderson', guestCount: 4, dateTime: '2025-03-15T19:30', tableNumber: '12', specialRequests: 'Champagne on arrival, nut allergy (1 guest)', phone: '555-0234', notes: 'Repeat customer - VIP' } },
  { title: 'Prep Batch - Lava Cakes', data: { name: 'Prep Batch - Lava Cakes', type: 'Batch', status: 'prep', description: 'Prep 20 lava cake ramekins for evening service', category: 'Desserts', cost: 62.00, price: 0, recipe: 'Chocolate Lava Cake', batchSize: 20, startedAt: '2025-03-15T14:00', completedAt: '', yield: 0, notes: 'Refrigerate after filling, bake to order' } },
  { title: 'Evening Shift - Maria Lopez', data: { name: 'Evening Shift - Maria Lopez', type: 'Shift', status: 'active', description: '', category: '', cost: 0, price: 0, employee: 'Maria Lopez', role: 'Sous Chef', shiftStart: '2025-03-15T15:00', shiftEnd: '2025-03-15T23:00', station: 'Saute', notes: '' } },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FoodLensPage() {
  useLensNav('food');

  const [activeTab, setActiveTab] = useState<ModeTab>('recipes');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LensItem<FoodArtifact> | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  // Editor form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStatus, setFormStatus] = useState<Status>('prep');
  const [formServings, setFormServings] = useState('1');
  const [formPrepTime, setFormPrepTime] = useState('');
  const [formCookTime, setFormCookTime] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSection, setFormSection] = useState('Mains');
  const [formSupplier, setFormSupplier] = useState('');
  const [formCurrentStock, setFormCurrentStock] = useState('');
  const [formParLevel, setFormParLevel] = useState('');
  const [formUnit, setFormUnit] = useState('ea');
  const [formGuestName, setFormGuestName] = useState('');
  const [formGuestCount, setFormGuestCount] = useState('2');
  const [formDateTime, setFormDateTime] = useState('');
  const [formTableNumber, setFormTableNumber] = useState('');
  const [formEmployee, setFormEmployee] = useState('');
  const [formRole, setFormRole] = useState('Line Cook');
  const [formShiftStart, setFormShiftStart] = useState('');
  const [formShiftEnd, setFormShiftEnd] = useState('');
  const [formStation, setFormStation] = useState('Grill');

  const activeArtifactType = MODE_TABS.find(t => t.id === activeTab)?.artifactType || 'Recipe';

  const { items, isLoading, create, update, remove } = useLensData<FoodArtifact>('food', activeArtifactType, {
    seed: SEED_DATA.filter(s => (s.data as Record<string, unknown>).type === activeArtifactType),
  });

  const filtered = useMemo(() => {
    let result = items;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.data as unknown as FoodArtifact).description?.toLowerCase().includes(q) ||
        (i.data as unknown as FoodArtifact).category?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      result = result.filter(i => (i.data as unknown as FoodArtifact).status === filterStatus);
    }
    return result;
  }, [items, searchQuery, filterStatus]);

  // ---------------------------------------------------------------------------
  // Editor helpers
  // ---------------------------------------------------------------------------

  const openCreate = () => {
    setEditingItem(null);
    setFormName(''); setFormDescription(''); setFormCategory(''); setFormCost(''); setFormPrice('');
    setFormStatus('prep'); setFormServings('1'); setFormPrepTime(''); setFormCookTime('');
    setFormNotes(''); setFormSection('Mains'); setFormSupplier(''); setFormCurrentStock('');
    setFormParLevel(''); setFormUnit('ea'); setFormGuestName(''); setFormGuestCount('2');
    setFormDateTime(''); setFormTableNumber(''); setFormEmployee(''); setFormRole('Line Cook');
    setFormShiftStart(''); setFormShiftEnd(''); setFormStation('Grill');
    setEditorOpen(true);
  };

  const openEdit = (item: LensItem<FoodArtifact>) => {
    const d = item.data as unknown as FoodArtifact;
    setEditingItem(item);
    setFormName(d.name || item.title); setFormDescription(d.description || '');
    setFormCategory(d.category || ''); setFormCost(String(d.cost || ''));
    setFormPrice(String(d.price || '')); setFormStatus(d.status || 'prep');
    setFormServings(String(d.servings || '1')); setFormPrepTime(String(d.prepTime || ''));
    setFormCookTime(String(d.cookTime || '')); setFormNotes(d.notes || '');
    setFormSection(d.section || 'Mains'); setFormSupplier(d.supplier || '');
    setFormCurrentStock(String(d.currentStock || '')); setFormParLevel(String(d.parLevel || ''));
    setFormUnit(d.unit || 'ea'); setFormGuestName(d.guestName || '');
    setFormGuestCount(String(d.guestCount || '2')); setFormDateTime(d.dateTime || '');
    setFormTableNumber(d.tableNumber || ''); setFormEmployee(d.employee || '');
    setFormRole(d.role || 'Line Cook'); setFormShiftStart(d.shiftStart || '');
    setFormShiftEnd(d.shiftEnd || ''); setFormStation(d.station || 'Grill');
    setEditorOpen(true);
  };

  const handleSave = async () => {
    const base: Record<string, unknown> = {
      name: formName, type: activeArtifactType, status: formStatus,
      description: formDescription, category: formCategory,
      cost: parseFloat(formCost) || 0, price: parseFloat(formPrice) || 0, notes: formNotes,
    };
    if (activeArtifactType === 'Recipe') {
      Object.assign(base, { servings: parseInt(formServings) || 1, prepTime: parseInt(formPrepTime) || 0, cookTime: parseInt(formCookTime) || 0, section: formSection });
    } else if (activeArtifactType === 'InventoryItem') {
      Object.assign(base, { supplier: formSupplier, currentStock: parseFloat(formCurrentStock) || 0, parLevel: parseFloat(formParLevel) || 0, unit: formUnit });
    } else if (activeArtifactType === 'Booking') {
      Object.assign(base, { guestName: formGuestName, guestCount: parseInt(formGuestCount) || 2, dateTime: formDateTime, tableNumber: formTableNumber });
    } else if (activeArtifactType === 'Shift') {
      Object.assign(base, { employee: formEmployee, role: formRole, shiftStart: formShiftStart, shiftEnd: formShiftEnd, station: formStation });
    }
    const payload = { title: formName, data: base as Partial<FoodArtifact>, meta: { status: formStatus, tags: [activeArtifactType, formCategory || formSection || ''] } };
    if (editingItem) { await update(editingItem.id, payload); } else { await create(payload); }
    setEditorOpen(false);
  };

  // ---------------------------------------------------------------------------
  // Domain actions
  // ---------------------------------------------------------------------------

  const costPlate = (item: LensItem<FoodArtifact>) => {
    const d = item.data as unknown as FoodArtifact;
    if (!d.ingredients) return { foodCost: d.cost, price: d.price, margin: 0 };
    const foodCost = d.ingredients.reduce((s, ing) => s + ing.cost, 0);
    const margin = d.price > 0 ? ((d.price - foodCost) / d.price) * 100 : 0;
    return { foodCost, price: d.price, margin };
  };

  const pourCostCalc = (cost: number, price: number) => price > 0 ? (cost / price) * 100 : 0;

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  const dashboardMetrics = useMemo(() => {
    const allData = items.map(i => i.data as unknown as FoodArtifact);
    const totalRecipeCost = allData.filter(d => d.type === 'Recipe').reduce((s, d) => s + (d.cost || 0), 0);
    const totalRecipePrice = allData.filter(d => d.type === 'Recipe').reduce((s, d) => s + (d.price || 0), 0);
    const avgFoodCostPct = totalRecipePrice > 0 ? (totalRecipeCost / totalRecipePrice) * 100 : 0;
    const lowStockItems = allData.filter(d => d.type === 'InventoryItem' && d.currentStock !== undefined && d.parLevel !== undefined && d.currentStock < d.parLevel).length;
    const activeBookings = allData.filter(d => d.type === 'Booking' && d.status === 'active').length;
    const totalCovers = allData.filter(d => d.type === 'Booking' && d.status === 'active').reduce((s, d) => s + (d.guestCount || 0), 0);
    const eightyFixed = allData.filter(d => d.status === '86d').length;
    const byStatus: Record<string, number> = {};
    allData.forEach(d => { byStatus[d.status] = (byStatus[d.status] || 0) + 1; });
    return { avgFoodCostPct, lowStockItems, activeBookings, totalCovers, eightyFixed, byStatus, total: items.length };
  }, [items]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

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
          <ChefHat className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className={ds.textMuted}>No {activeTab} found. Create one to get started.</p>
        </div>
      ) : (
        <div className={ds.grid3}>
          {filtered.map(item => {
            const d = item.data as unknown as FoodArtifact;
            const plate = d.type === 'Recipe' ? costPlate(item) : null;
            return (
              <div key={item.id} className={ds.panelHover} onClick={() => openEdit(item)}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className={ds.heading3}>{item.title}</h3>
                  {renderStatusBadge(d.status)}
                </div>
                {d.description && <p className={cn(ds.textMuted, 'line-clamp-2 mb-2')}>{d.description}</p>}
                {d.category && <span className={ds.badge('cyan-400')}>{d.category}</span>}

                {/* Recipe-specific details */}
                {d.type === 'Recipe' && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center gap-4 text-sm">
                      {d.prepTime && <span className="flex items-center gap-1 text-gray-400"><Timer className="w-3 h-3" /> Prep {d.prepTime}m</span>}
                      {d.cookTime && <span className="flex items-center gap-1 text-gray-400"><Flame className="w-3 h-3" /> Cook {d.cookTime}m</span>}
                    </div>
                    {plate && (
                      <div className="flex items-center gap-3 mt-2">
                        <span className={cn(ds.textMono, 'text-red-400')}>Cost ${plate.foodCost.toFixed(2)}</span>
                        <span className={cn(ds.textMono, 'text-green-400')}>Price ${plate.price.toFixed(2)}</span>
                        <span className={cn(ds.badge(plate.margin >= 65 ? 'green-400' : plate.margin >= 50 ? 'yellow-400' : 'red-400'))}>
                          {plate.margin.toFixed(0)}% margin
                        </span>
                      </div>
                    )}
                    {d.allergens && d.allergens.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        <AlertTriangle className="w-3 h-3 text-orange-400" />
                        {d.allergens.map(a => <span key={a} className={ds.badge('orange-400')}>{a}</span>)}
                      </div>
                    )}
                    {d.dietary && d.dietary.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        <Leaf className="w-3 h-3 text-green-400" />
                        {d.dietary.map(df => <span key={df} className={ds.badge('green-400')}>{df}</span>)}
                      </div>
                    )}
                  </div>
                )}

                {/* Inventory-specific */}
                {d.type === 'InventoryItem' && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Stock: <span className={cn('font-bold', d.currentStock !== undefined && d.parLevel !== undefined && d.currentStock < d.parLevel ? 'text-red-400' : 'text-green-400')}>{d.currentStock} {d.unit}</span></span>
                      <span className="text-gray-400">Par: {d.parLevel} {d.unit}</span>
                    </div>
                    {d.currentStock !== undefined && d.parLevel !== undefined && d.currentStock < d.parLevel && (
                      <div className="flex items-center gap-1 text-red-400 text-xs"><AlertTriangle className="w-3 h-3" /> Below par level - reorder needed</div>
                    )}
                    {d.storageTemp && <span className="flex items-center gap-1 text-xs text-gray-400"><Thermometer className="w-3 h-3" /> {d.storageTemp}</span>}
                  </div>
                )}

                {/* Booking-specific */}
                {d.type === 'Booking' && (
                  <div className="mt-3 space-y-1 text-sm">
                    <p className="flex items-center gap-1 text-gray-400"><Users className="w-3 h-3" /> {d.guestName} - Party of {d.guestCount}</p>
                    {d.dateTime && <p className="flex items-center gap-1 text-gray-400"><CalendarClock className="w-3 h-3" /> {new Date(d.dateTime).toLocaleString()}</p>}
                    {d.tableNumber && <p className="text-gray-400">Table {d.tableNumber}</p>}
                    {d.specialRequests && <p className="text-orange-400 text-xs">{d.specialRequests}</p>}
                  </div>
                )}

                {/* Shift-specific */}
                {d.type === 'Shift' && (
                  <div className="mt-3 space-y-1 text-sm">
                    <p className="font-medium">{d.employee}</p>
                    <p className="text-gray-400">{d.role} - {d.station}</p>
                    {d.shiftStart && d.shiftEnd && (
                      <p className="flex items-center gap-1 text-gray-400"><Clock className="w-3 h-3" /> {d.shiftStart.slice(11, 16)} - {d.shiftEnd.slice(11, 16)}</p>
                    )}
                  </div>
                )}

                {/* Batch-specific */}
                {d.type === 'Batch' && (
                  <div className="mt-3 space-y-1 text-sm">
                    <p className="text-gray-400">Recipe: {d.recipe}</p>
                    <p className="text-gray-400">Batch size: {d.batchSize}</p>
                    {d.yield !== undefined && d.yield > 0 && <p className="text-green-400">Yield: {d.yield}</p>}
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
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} className={ds.textarea} placeholder="Description..." />
              </div>
              <div className={ds.grid3}>
                <div>
                  <label className={ds.label}>Status</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value as Status)} className={ds.select}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={ds.label}>Category</label>
                  <input value={formCategory} onChange={e => setFormCategory(e.target.value)} className={ds.input} placeholder="Category" />
                </div>
                <div>
                  <label className={ds.label}>Section</label>
                  <select value={formSection} onChange={e => setFormSection(e.target.value)} className={ds.select}>
                    {MENU_SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Cost / Price for recipes and inventory */}
              {(activeTab === 'recipes' || activeTab === 'inventory' || activeTab === 'menu') && (
                <div className={ds.grid2}>
                  <div>
                    <label className={ds.label}>Cost ($)</label>
                    <input type="number" value={formCost} onChange={e => setFormCost(e.target.value)} className={ds.input} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={ds.label}>Menu Price ($)</label>
                    <input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} className={ds.input} placeholder="0.00" />
                  </div>
                </div>
              )}

              {/* Recipe fields */}
              {activeTab === 'recipes' && (
                <div className={ds.grid3}>
                  <div>
                    <label className={ds.label}>Servings</label>
                    <input type="number" value={formServings} onChange={e => setFormServings(e.target.value)} className={ds.input} />
                  </div>
                  <div>
                    <label className={ds.label}>Prep Time (min)</label>
                    <input type="number" value={formPrepTime} onChange={e => setFormPrepTime(e.target.value)} className={ds.input} />
                  </div>
                  <div>
                    <label className={ds.label}>Cook Time (min)</label>
                    <input type="number" value={formCookTime} onChange={e => setFormCookTime(e.target.value)} className={ds.input} />
                  </div>
                </div>
              )}

              {/* Inventory fields */}
              {activeTab === 'inventory' && (
                <div className={ds.grid3}>
                  <div>
                    <label className={ds.label}>Current Stock</label>
                    <input type="number" value={formCurrentStock} onChange={e => setFormCurrentStock(e.target.value)} className={ds.input} />
                  </div>
                  <div>
                    <label className={ds.label}>Par Level</label>
                    <input type="number" value={formParLevel} onChange={e => setFormParLevel(e.target.value)} className={ds.input} />
                  </div>
                  <div>
                    <label className={ds.label}>Unit</label>
                    <select value={formUnit} onChange={e => setFormUnit(e.target.value)} className={ds.select}>
                      {['ea', 'lb', 'oz', 'kg', 'g', 'gal', 'qt', 'pt', 'cs', 'bag'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Booking fields */}
              {activeTab === 'bookings' && (
                <>
                  <div className={ds.grid2}>
                    <div>
                      <label className={ds.label}>Guest Name</label>
                      <input value={formGuestName} onChange={e => setFormGuestName(e.target.value)} className={ds.input} placeholder="Guest name" />
                    </div>
                    <div>
                      <label className={ds.label}>Party Size</label>
                      <input type="number" value={formGuestCount} onChange={e => setFormGuestCount(e.target.value)} className={ds.input} />
                    </div>
                  </div>
                  <div className={ds.grid2}>
                    <div>
                      <label className={ds.label}>Date & Time</label>
                      <input type="datetime-local" value={formDateTime} onChange={e => setFormDateTime(e.target.value)} className={ds.input} />
                    </div>
                    <div>
                      <label className={ds.label}>Table Number</label>
                      <input value={formTableNumber} onChange={e => setFormTableNumber(e.target.value)} className={ds.input} placeholder="Table #" />
                    </div>
                  </div>
                </>
              )}

              {/* Shift fields */}
              {activeTab === 'shifts' && (
                <>
                  <div className={ds.grid2}>
                    <div>
                      <label className={ds.label}>Employee</label>
                      <input value={formEmployee} onChange={e => setFormEmployee(e.target.value)} className={ds.input} placeholder="Employee name" />
                    </div>
                    <div>
                      <label className={ds.label}>Role</label>
                      <select value={formRole} onChange={e => setFormRole(e.target.value)} className={ds.select}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={ds.grid3}>
                    <div>
                      <label className={ds.label}>Station</label>
                      <select value={formStation} onChange={e => setFormStation(e.target.value)} className={ds.select}>
                        {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={ds.label}>Shift Start</label>
                      <input type="datetime-local" value={formShiftStart} onChange={e => setFormShiftStart(e.target.value)} className={ds.input} />
                    </div>
                    <div>
                      <label className={ds.label}>Shift End</label>
                      <input type="datetime-local" value={formShiftEnd} onChange={e => setFormShiftEnd(e.target.value)} className={ds.input} />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className={ds.label}>Notes</label>
                <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} className={ds.textarea} placeholder="Notes..." />
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
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-5 h-5 text-cyan-400" />
            <span className={ds.textMuted}>Avg Food Cost</span>
          </div>
          <p className={cn('text-3xl font-bold', dashboardMetrics.avgFoodCostPct <= 30 ? 'text-green-400' : dashboardMetrics.avgFoodCostPct <= 35 ? 'text-yellow-400' : 'text-red-400')}>
            {dashboardMetrics.avgFoodCostPct.toFixed(1)}%
          </p>
          <p className={ds.textMuted}>Target: under 30%</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart className="w-5 h-5 text-red-400" />
            <span className={ds.textMuted}>Low Stock Alerts</span>
          </div>
          <p className="text-3xl font-bold text-red-400">{dashboardMetrics.lowStockItems}</p>
          <p className={ds.textMuted}>Items below par level</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span className={ds.textMuted}>Bookings / Covers</span>
          </div>
          <p className="text-3xl font-bold">{dashboardMetrics.activeBookings}</p>
          <p className={ds.textMuted}>{dashboardMetrics.totalCovers} total covers</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <span className={ds.textMuted}>86'd Items</span>
          </div>
          <p className="text-3xl font-bold text-orange-400">{dashboardMetrics.eightyFixed}</p>
          <p className={ds.textMuted}>Currently out of stock</p>
        </div>
      </div>

      <div className={ds.panel}>
        <h3 className={cn(ds.heading3, 'mb-4')}>Status Breakdown</h3>
        <div className="space-y-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = dashboardMetrics.byStatus[key] || 0;
            const pct = dashboardMetrics.total > 0 ? (count / dashboardMetrics.total) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-400">{cfg.label}</span>
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
        <h3 className={cn(ds.heading3, 'mb-4 flex items-center gap-2')}>
          <TrendingUp className="w-5 h-5 text-neon-cyan" /> Recent Items
        </h3>
        <div className="space-y-2">
          {items.slice(0, 5).map(item => {
            const d = item.data as unknown as FoodArtifact;
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-lattice-surface/50 hover:bg-lattice-surface cursor-pointer" onClick={() => openEdit(item)}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className={ds.textMuted}>{d.type} {d.category ? `- ${d.category}` : ''}</p>
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
          <ChefHat className="w-8 h-8 text-orange-400" />
          <div>
            <h1 className={ds.heading1}>Food & Hospitality</h1>
            <p className={ds.textMuted}>Recipes, menus, inventory, bookings, and kitchen operations</p>
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
