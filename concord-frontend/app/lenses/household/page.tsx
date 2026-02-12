'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ds } from '@/lib/design-system';
import {
  Home,
  Users,
  UtensilsCrossed,
  CheckSquare,
  Wrench,
  PawPrint,
  CalendarHeart,
  Plus,
  Search,
  Filter,
  X,
  Edit3,
  Trash2,
  ShoppingCart,
  RotateCcw,
  AlertTriangle,
  Clock,
  TrendingUp,
  BarChart3,
  ListChecks,
  Calendar,
  Heart,
  ChevronDown,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Family' | 'Meals' | 'Chores' | 'Home' | 'Pets' | 'Events';

type ArtifactType = 'FamilyMember' | 'MealPlan' | 'Chore' | 'MaintenanceItem' | 'Pet' | 'MajorEvent';
type Status = 'planned' | 'active' | 'overdue' | 'completed';

interface FamilyMember { name: string; role: string; birthday: string; allergies: string[]; notes: string; }
interface MealPlan { name: string; day: string; mealType: string; recipe: string; servings: number; ingredients: string[]; }
interface Chore { name: string; assignee: string; frequency: string; room: string; estimatedMinutes: number; }
interface MaintenanceItem { name: string; area: string; priority: string; dueDate: string; cost: number; vendor: string; }
interface Pet { name: string; species: string; breed: string; vetDate: string; food: string; notes: string; }
interface MajorEvent { name: string; date: string; location: string; budget: number; guests: number; notes: string; }

type ArtifactData = FamilyMember | MealPlan | Chore | MaintenanceItem | Pet | MajorEvent;

const MODE_TABS: { id: ModeTab; icon: typeof Home; types: ArtifactType[] }[] = [
  { id: 'Family', icon: Users, types: ['FamilyMember'] },
  { id: 'Meals', icon: UtensilsCrossed, types: ['MealPlan'] },
  { id: 'Chores', icon: CheckSquare, types: ['Chore'] },
  { id: 'Home', icon: Wrench, types: ['MaintenanceItem'] },
  { id: 'Pets', icon: PawPrint, types: ['Pet'] },
  { id: 'Events', icon: CalendarHeart, types: ['MajorEvent'] },
];

const STATUS_COLORS: Record<Status, string> = {
  planned: 'neon-blue',
  active: 'green-400',
  overdue: 'red-400',
  completed: 'gray-400',
};

const SEED_DATA: Record<ArtifactType, { title: string; data: Record<string, unknown>; meta: Record<string, unknown> }[]> = {
  FamilyMember: [
    { title: 'Alex Chen', data: { name: 'Alex Chen', role: 'Parent', birthday: '1988-03-15', allergies: ['peanuts'], notes: 'Works from home Tues/Thu' }, meta: { status: 'active', tags: ['parent'] } },
    { title: 'Jamie Chen', data: { name: 'Jamie Chen', role: 'Parent', birthday: '1990-07-22', allergies: [], notes: 'Coaches soccer Saturdays' }, meta: { status: 'active', tags: ['parent'] } },
    { title: 'Mia Chen', data: { name: 'Mia Chen', role: 'Child', birthday: '2016-11-01', allergies: ['dairy'], notes: 'Piano lessons Wed 4pm' }, meta: { status: 'active', tags: ['child'] } },
  ],
  MealPlan: [
    { title: 'Monday Dinner - Pasta Night', data: { name: 'Pasta Night', day: 'Monday', mealType: 'dinner', recipe: 'Spaghetti Bolognese', servings: 4, ingredients: ['pasta', 'ground beef', 'tomato sauce', 'onion', 'garlic'] }, meta: { status: 'planned', tags: ['dinner'] } },
    { title: 'Tuesday Lunch - Chicken Wraps', data: { name: 'Chicken Wraps', day: 'Tuesday', mealType: 'lunch', recipe: 'Grilled Chicken Caesar Wrap', servings: 4, ingredients: ['tortillas', 'chicken', 'lettuce', 'parmesan', 'dressing'] }, meta: { status: 'planned', tags: ['lunch'] } },
  ],
  Chore: [
    { title: 'Vacuum Living Room', data: { name: 'Vacuum Living Room', assignee: 'Alex', frequency: 'weekly', room: 'Living Room', estimatedMinutes: 20 }, meta: { status: 'active', tags: ['cleaning'] } },
    { title: 'Dishes After Dinner', data: { name: 'Dishes After Dinner', assignee: 'Jamie', frequency: 'daily', room: 'Kitchen', estimatedMinutes: 15 }, meta: { status: 'active', tags: ['cleaning'] } },
    { title: 'Take Out Trash', data: { name: 'Take Out Trash', assignee: 'Mia', frequency: 'weekly', room: 'Kitchen', estimatedMinutes: 5 }, meta: { status: 'overdue', tags: ['chore'] } },
  ],
  MaintenanceItem: [
    { title: 'HVAC Filter Replacement', data: { name: 'HVAC Filter Replacement', area: 'Utility Room', priority: 'high', dueDate: '2026-02-15', cost: 45, vendor: 'Home Depot' }, meta: { status: 'planned', tags: ['maintenance'] } },
    { title: 'Gutter Cleaning', data: { name: 'Gutter Cleaning', area: 'Exterior', priority: 'medium', dueDate: '2026-03-01', cost: 200, vendor: 'CleanPro Services' }, meta: { status: 'planned', tags: ['exterior'] } },
  ],
  Pet: [
    { title: 'Biscuit', data: { name: 'Biscuit', species: 'Dog', breed: 'Golden Retriever', vetDate: '2026-04-10', food: 'Blue Buffalo Adult', notes: 'Walks 2x daily, loves fetch' }, meta: { status: 'active', tags: ['dog'] } },
  ],
  MajorEvent: [
    { title: 'Mia\'s Birthday Party', data: { name: 'Mia\'s Birthday Party', date: '2026-11-01', location: 'Home', budget: 300, guests: 12, notes: 'Unicorn theme, dairy-free cake' }, meta: { status: 'planned', tags: ['birthday'] } },
    { title: 'Summer Vacation', data: { name: 'Summer Vacation', date: '2026-07-15', location: 'Lake Tahoe', budget: 3500, guests: 4, notes: 'Cabin rental booked' }, meta: { status: 'planned', tags: ['vacation'] } },
  ],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HouseholdLensPage() {
  useLensNav('household');

  const [mode, setMode] = useState<ModeTab>('Family');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<'library' | 'dashboard'>('library');

  // Editor form state
  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState<Status>('planned');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const currentTypes = MODE_TABS.find(t => t.id === mode)!.types;
  const currentType = currentTypes[0];

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData<ArtifactData>('household', currentType, {
    seed: SEED_DATA[currentType] || [],
  });

  const runAction = useRunArtifact('household');

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
  const openNew = () => {
    setEditingId(null);
    setFormTitle('');
    setFormStatus('planned');
    setFormData({});
    setShowEditor(true);
  };

  const openEdit = (item: LensItem<ArtifactData>) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormStatus((item.meta.status as Status) || 'planned');
    setFormData(item.data as unknown as Record<string, unknown>);
    setShowEditor(true);
  };

  const handleSave = async () => {
    const payload = { title: formTitle, data: formData, meta: { status: formStatus } };
    if (editingId) {
      await update(editingId, payload);
    } else {
      await create(payload);
    }
    setShowEditor(false);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
  };

  const handleAction = async (action: string, artifactId?: string) => {
    const targetId = artifactId || editingId || filtered[0]?.id;
    if (!targetId) return;
    try {
      const result = await runAction.mutateAsync({ id: targetId, action });
      setActionResult(result.result as Record<string, unknown>);
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  /* ---- actions ---- */
  const groceryIngredients = useMemo(() => {
    if (currentType !== 'MealPlan') return [];
    const ingredients = new Set<string>();
    items.forEach(i => {
      const d = i.data as unknown as MealPlan;
      d.ingredients?.forEach(ing => ingredients.add(ing));
    });
    return Array.from(ingredients).sort();
  }, [items, currentType]);

  const overdueCount = items.filter(i => i.meta.status === 'overdue').length;
  const activeCount = items.filter(i => i.meta.status === 'active').length;
  const plannedCount = items.filter(i => i.meta.status === 'planned').length;
  const completedCount = items.filter(i => i.meta.status === 'completed').length;

  /* ---- render helpers ---- */
  const renderStatusBadge = (status: string) => {
    const color = STATUS_COLORS[status as Status] || 'gray-400';
    return <span className={ds.badge(color)}>{status}</span>;
  };

  const renderFormFields = () => {
    switch (currentType) {
      case 'FamilyMember':
        return (
          <>
            <div><label className={ds.label}>Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div><label className={ds.label}>Role</label><select className={ds.select} value={(formData.role as string) || ''} onChange={e => setFormData({ ...formData, role: e.target.value })}><option value="">Select...</option><option value="Parent">Parent</option><option value="Child">Child</option><option value="Grandparent">Grandparent</option><option value="Other">Other</option></select></div>
            <div><label className={ds.label}>Birthday</label><input type="date" className={ds.input} value={(formData.birthday as string) || ''} onChange={e => setFormData({ ...formData, birthday: e.target.value })} /></div>
            <div><label className={ds.label}>Allergies (comma-separated)</label><input className={ds.input} value={((formData.allergies as string[]) || []).join(', ')} onChange={e => setFormData({ ...formData, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
            <div><label className={ds.label}>Notes</label><textarea className={ds.textarea} rows={3} value={(formData.notes as string) || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
          </>
        );
      case 'MealPlan':
        return (
          <>
            <div><label className={ds.label}>Meal Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Day</label><select className={ds.select} value={(formData.day as string) || ''} onChange={e => setFormData({ ...formData, day: e.target.value })}>{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              <div><label className={ds.label}>Meal Type</label><select className={ds.select} value={(formData.mealType as string) || ''} onChange={e => setFormData({ ...formData, mealType: e.target.value })}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></div>
            </div>
            <div><label className={ds.label}>Recipe</label><input className={ds.input} value={(formData.recipe as string) || ''} onChange={e => setFormData({ ...formData, recipe: e.target.value })} /></div>
            <div><label className={ds.label}>Servings</label><input type="number" className={ds.input} value={(formData.servings as number) || ''} onChange={e => setFormData({ ...formData, servings: parseInt(e.target.value) || 0 })} /></div>
            <div><label className={ds.label}>Ingredients (comma-separated)</label><textarea className={ds.textarea} rows={3} value={((formData.ingredients as string[]) || []).join(', ')} onChange={e => setFormData({ ...formData, ingredients: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
          </>
        );
      case 'Chore':
        return (
          <>
            <div><label className={ds.label}>Chore Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Assignee</label><input className={ds.input} value={(formData.assignee as string) || ''} onChange={e => setFormData({ ...formData, assignee: e.target.value })} /></div>
              <div><label className={ds.label}>Room</label><input className={ds.input} value={(formData.room as string) || ''} onChange={e => setFormData({ ...formData, room: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Frequency</label><select className={ds.select} value={(formData.frequency as string) || 'weekly'} onChange={e => setFormData({ ...formData, frequency: e.target.value })}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option></select></div>
              <div><label className={ds.label}>Est. Minutes</label><input type="number" className={ds.input} value={(formData.estimatedMinutes as number) || ''} onChange={e => setFormData({ ...formData, estimatedMinutes: parseInt(e.target.value) || 0 })} /></div>
            </div>
          </>
        );
      case 'MaintenanceItem':
        return (
          <>
            <div><label className={ds.label}>Item Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Area</label><input className={ds.input} value={(formData.area as string) || ''} onChange={e => setFormData({ ...formData, area: e.target.value })} /></div>
              <div><label className={ds.label}>Priority</label><select className={ds.select} value={(formData.priority as string) || 'medium'} onChange={e => setFormData({ ...formData, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Due Date</label><input type="date" className={ds.input} value={(formData.dueDate as string) || ''} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} /></div>
              <div><label className={ds.label}>Est. Cost ($)</label><input type="number" className={ds.input} value={(formData.cost as number) || ''} onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div><label className={ds.label}>Vendor</label><input className={ds.input} value={(formData.vendor as string) || ''} onChange={e => setFormData({ ...formData, vendor: e.target.value })} /></div>
          </>
        );
      case 'Pet':
        return (
          <>
            <div><label className={ds.label}>Pet Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Species</label><select className={ds.select} value={(formData.species as string) || ''} onChange={e => setFormData({ ...formData, species: e.target.value })}><option value="">Select...</option><option value="Dog">Dog</option><option value="Cat">Cat</option><option value="Bird">Bird</option><option value="Fish">Fish</option><option value="Other">Other</option></select></div>
              <div><label className={ds.label}>Breed</label><input className={ds.input} value={(formData.breed as string) || ''} onChange={e => setFormData({ ...formData, breed: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Next Vet Date</label><input type="date" className={ds.input} value={(formData.vetDate as string) || ''} onChange={e => setFormData({ ...formData, vetDate: e.target.value })} /></div>
              <div><label className={ds.label}>Food Brand</label><input className={ds.input} value={(formData.food as string) || ''} onChange={e => setFormData({ ...formData, food: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Notes</label><textarea className={ds.textarea} rows={3} value={(formData.notes as string) || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
          </>
        );
      case 'MajorEvent':
        return (
          <>
            <div><label className={ds.label}>Event Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Date</label><input type="date" className={ds.input} value={(formData.date as string) || ''} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
              <div><label className={ds.label}>Location</label><input className={ds.input} value={(formData.location as string) || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Budget ($)</label><input type="number" className={ds.input} value={(formData.budget as number) || ''} onChange={e => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Guest Count</label><input type="number" className={ds.input} value={(formData.guests as number) || ''} onChange={e => setFormData({ ...formData, guests: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div><label className={ds.label}>Notes</label><textarea className={ds.textarea} rows={3} value={(formData.notes as string) || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
          </>
        );
      default:
        return null;
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
          {currentType === 'FamilyMember' && <><p className={ds.textMuted}>Role: {d.role as string}</p><p className={ds.textMuted}>Birthday: {d.birthday as string}</p>{(d.allergies as string[])?.length > 0 && <p className={ds.textMuted}>Allergies: {(d.allergies as string[]).join(', ')}</p>}</>}
          {currentType === 'MealPlan' && <><p className={ds.textMuted}>{d.day as string} - {d.mealType as string}</p><p className={ds.textMuted}>Servings: {d.servings as number}</p><p className={`${ds.textMono} text-gray-500`}>{((d.ingredients as string[]) || []).length} ingredients</p></>}
          {currentType === 'Chore' && <><p className={ds.textMuted}>Assigned to: {d.assignee as string}</p><p className={ds.textMuted}>{d.frequency as string} - {d.room as string}</p><p className={ds.textMuted}>{d.estimatedMinutes as number} min</p></>}
          {currentType === 'MaintenanceItem' && <><p className={ds.textMuted}>{d.area as string} - Priority: {d.priority as string}</p><p className={ds.textMuted}>Due: {d.dueDate as string}</p><p className={`${ds.textMono} text-gray-500`}>Est. ${d.cost as number}</p></>}
          {currentType === 'Pet' && <><p className={ds.textMuted}>{d.species as string} - {d.breed as string}</p><p className={ds.textMuted}>Next vet: {d.vetDate as string}</p><p className={ds.textMuted}>Food: {d.food as string}</p></>}
          {currentType === 'MajorEvent' && <><p className={ds.textMuted}>{d.date as string} at {d.location as string}</p><p className={ds.textMuted}>Budget: ${d.budget as number} | {d.guests as number} guests</p></>}
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
      {/* Metric cards */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-green-400" /><span className={ds.textMuted}>Active</span></div>
          <p className={ds.heading2}>{activeCount}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-neon-blue" /><span className={ds.textMuted}>Planned</span></div>
          <p className={ds.heading2}>{plannedCount}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-red-400" /><span className={ds.textMuted}>Overdue</span></div>
          <p className={ds.heading2}>{overdueCount}</p>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><ListChecks className="w-4 h-4 text-gray-400" /><span className={ds.textMuted}>Completed</span></div>
          <p className={ds.heading2}>{completedCount}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className={ds.panel}>
        <h3 className={`${ds.heading3} mb-4`}>Quick Actions</h3>
        <div className={ds.grid3}>
          <button className={ds.btnSecondary} onClick={() => { setMode('Meals'); setView('library'); }}>
            <ShoppingCart className="w-4 h-4" /> Generate Grocery List
          </button>
          <button className={ds.btnSecondary} onClick={() => { setMode('Home'); setView('library'); setStatusFilter('overdue'); }}>
            <Wrench className="w-4 h-4" /> Maintenance Due
          </button>
          <button className={ds.btnSecondary} onClick={() => { setMode('Chores'); setView('library'); }}>
            <RotateCcw className="w-4 h-4" /> Chore Rotation
          </button>
        </div>
      </div>

      {/* Grocery list from meals */}
      {groceryIngredients.length > 0 && (
        <div className={ds.panel}>
          <h3 className={`${ds.heading3} mb-3`}>Grocery List (from Meal Plans)</h3>
          <div className="flex flex-wrap gap-2">
            {groceryIngredients.map(ing => (
              <span key={ing} className={ds.badge('neon-cyan')}><ShoppingCart className="w-3 h-3" /> {ing}</span>
            ))}
          </div>
        </div>
      )}

      {/* Overdue items across all types */}
      <div className={ds.panel}>
        <h3 className={`${ds.heading3} mb-3`}>Overdue Items</h3>
        {overdueCount === 0 ? (
          <p className={ds.textMuted}>All caught up! No overdue items.</p>
        ) : (
          <div className="space-y-2">
            {items.filter(i => i.meta.status === 'overdue').map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className={ds.textMuted}>{currentType}</p>
                </div>
                {renderStatusBadge('overdue')}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming events */}
      <div className={ds.panel}>
        <div className={ds.sectionHeader}>
          <h3 className={ds.heading3}>Household Summary</h3>
          <BarChart3 className="w-5 h-5 text-gray-400" />
        </div>
        <div className={`${ds.grid3} mt-4`}>
          <div className="text-center p-3 rounded-lg bg-lattice-elevated/30">
            <Users className="w-6 h-6 text-neon-blue mx-auto mb-1" />
            <p className={ds.heading3}>{SEED_DATA.FamilyMember.length}</p>
            <p className={ds.textMuted}>Family Members</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-lattice-elevated/30">
            <PawPrint className="w-6 h-6 text-neon-purple mx-auto mb-1" />
            <p className={ds.heading3}>{SEED_DATA.Pet.length}</p>
            <p className={ds.textMuted}>Pets</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-lattice-elevated/30">
            <Calendar className="w-6 h-6 text-neon-cyan mx-auto mb-1" />
            <p className={ds.heading3}>{SEED_DATA.MajorEvent.length}</p>
            <p className={ds.textMuted}>Upcoming Events</p>
          </div>
        </div>
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
      {/* Header */}
      <header className={ds.sectionHeader}>
        <div className="flex items-center gap-3">
          <Home className="w-7 h-7 text-neon-cyan" />
          <div>
            <h1 className={ds.heading1}>Home &amp; Family</h1>
            <p className={ds.textMuted}>Household management &amp; family coordination</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className={view === 'library' ? ds.btnPrimary : ds.btnSecondary} onClick={() => setView('library')}>
            <ListChecks className="w-4 h-4" /> Library
          </button>
          <button className={view === 'dashboard' ? ds.btnPrimary : ds.btnSecondary} onClick={() => setView('dashboard')}>
            <BarChart3 className="w-4 h-4" /> Dashboard
          </button>
        </div>
      </header>

      {/* Mode tabs */}
      <nav className="flex items-center gap-2 border-b border-lattice-border pb-4 overflow-x-auto">
        {MODE_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setMode(tab.id); setStatusFilter('all'); setSearchQuery(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                mode === tab.id
                  ? 'bg-neon-cyan/20 text-neon-cyan'
                  : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.id}
            </button>
          );
        })}
      </nav>

      {/* Domain Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => handleAction('generateGroceryList')} className={ds.btnSecondary}>
          <ShoppingCart className="w-4 h-4" /> Generate Grocery List
        </button>
        <button onClick={() => handleAction('assignChores')} className={ds.btnSecondary}>
          <RotateCcw className="w-4 h-4" /> Assign Chores
        </button>
        <button onClick={() => handleAction('scheduleReminder')} className={ds.btnSecondary}>
          <Calendar className="w-4 h-4" /> Schedule Reminder
        </button>
        {runAction.isPending && <span className="text-xs text-neon-blue animate-pulse">Running...</span>}
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

      {/* Content */}
      {view === 'dashboard' ? renderDashboard() : (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className={`${ds.input} pl-10`}
                placeholder={`Search ${mode.toLowerCase()}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-gray-400" />
              <select className={ds.select + ' w-auto'} value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status | 'all')}>
                <option value="all">All Statuses</option>
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="overdue">Overdue</option>
                <option value="completed">Completed</option>
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 -ml-8 pointer-events-none" />
            </div>
            <button className={ds.btnPrimary} onClick={openNew}>
              <Plus className="w-4 h-4" /> New {currentType}
            </button>
          </div>

          {/* Artifact library */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-neon-cyan" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Heart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className={ds.heading3}>No {currentType}s found</p>
              <p className={ds.textMuted}>Create one to get started.</p>
              <button className={`${ds.btnPrimary} mt-4`} onClick={openNew}>
                <Plus className="w-4 h-4" /> Add {currentType}
              </button>
            </div>
          ) : (
            <div className={ds.grid3}>
              {filtered.map(renderCard)}
            </div>
          )}
        </>
      )}

      {/* Editor modal */}
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
                <div>
                  <label className={ds.label}>Title</label>
                  <input className={ds.input} value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Artifact title..." />
                </div>
                <div>
                  <label className={ds.label}>Status</label>
                  <select className={ds.select} value={formStatus} onChange={e => setFormStatus(e.target.value as Status)}>
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="overdue">Overdue</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                {renderFormFields()}
              </div>
              <div className="p-6 border-t border-lattice-border flex items-center justify-end gap-3">
                <button className={ds.btnSecondary} onClick={() => setShowEditor(false)}>Cancel</button>
                <button className={ds.btnPrimary} onClick={handleSave} disabled={!formTitle.trim()}>
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
