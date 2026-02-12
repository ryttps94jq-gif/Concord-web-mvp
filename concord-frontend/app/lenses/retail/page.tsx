'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { ds } from '@/lib/design-system';
import {
  Store,
  Package,
  ShoppingBag,
  Users,
  Target,
  Headphones,
  Monitor,
  Plus,
  Search,
  Filter,
  X,
  Edit3,
  Trash2,
  TrendingUp,
  DollarSign,
  Clock,
  BarChart3,
  AlertCircle,
  ChevronDown,
  Truck,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  ListChecks,
} from 'lucide-react';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ErrorState } from '@/components/common/EmptyState';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Products' | 'Orders' | 'Customers' | 'Pipeline' | 'Support' | 'Displays';

type ArtifactType = 'Product' | 'Order' | 'Customer' | 'Lead' | 'Ticket' | 'Display';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'returned';
type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
type GeneralStatus = string;

interface Product { name: string; sku: string; category: string; price: number; stock: number; reorderPoint: number; supplier: string; }
interface Order { orderNumber: string; customer: string; items: number; total: number; shippingMethod: string; trackingNumber: string; }
interface Customer { name: string; email: string; phone: string; totalOrders: number; totalSpent: number; tier: string; }
interface Lead { name: string; company: string; email: string; value: number; source: string; assignee: string; probability: number; }
interface Ticket { subject: string; customer: string; priority: string; category: string; assignee: string; slaDeadline: string; }
interface Display { name: string; location: string; type: string; startDate: string; endDate: string; products: string[]; }

type ArtifactData = Product | Order | Customer | Lead | Ticket | Display;

const MODE_TABS: { id: ModeTab; icon: typeof Store; types: ArtifactType[] }[] = [
  { id: 'Products', icon: Package, types: ['Product'] },
  { id: 'Orders', icon: ShoppingBag, types: ['Order'] },
  { id: 'Customers', icon: Users, types: ['Customer'] },
  { id: 'Pipeline', icon: Target, types: ['Lead'] },
  { id: 'Support', icon: Headphones, types: ['Ticket'] },
  { id: 'Displays', icon: Monitor, types: ['Display'] },
];

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = { pending: 'yellow-400', processing: 'neon-blue', shipped: 'neon-cyan', delivered: 'green-400', returned: 'red-400' };
const LEAD_STATUS_COLORS: Record<LeadStatus, string> = { new: 'neon-cyan', contacted: 'neon-blue', qualified: 'neon-purple', proposal: 'yellow-400', negotiation: 'orange-400', won: 'green-400', lost: 'red-400' };
const TICKET_STATUS_COLORS: Record<TicketStatus, string> = { open: 'red-400', in_progress: 'neon-blue', waiting: 'yellow-400', resolved: 'green-400', closed: 'gray-400' };

function statusColorFor(type: ArtifactType, status: string): string {
  if (type === 'Order') return ORDER_STATUS_COLORS[status as OrderStatus] || 'gray-400';
  if (type === 'Lead') return LEAD_STATUS_COLORS[status as LeadStatus] || 'gray-400';
  if (type === 'Ticket') return TICKET_STATUS_COLORS[status as TicketStatus] || 'gray-400';
  return 'neon-cyan';
}

function statusOptionsFor(type: ArtifactType): string[] {
  if (type === 'Order') return ['pending', 'processing', 'shipped', 'delivered', 'returned'];
  if (type === 'Lead') return ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
  if (type === 'Ticket') return ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
  return ['active'];
}

const seedData: Record<ArtifactType, { title: string; data: Record<string, unknown>; meta: Record<string, unknown> }[]> = {
  Product: [
    { title: 'Wireless Headphones Pro', data: { name: 'Wireless Headphones Pro', sku: 'WHP-001', category: 'Electronics', price: 149.99, stock: 234, reorderPoint: 50, supplier: 'AudioTech Inc' }, meta: { status: 'active', tags: ['electronics', 'featured'] } },
    { title: 'Ergonomic Office Chair', data: { name: 'Ergonomic Office Chair', sku: 'EOC-042', category: 'Furniture', price: 399.00, stock: 18, reorderPoint: 20, supplier: 'ComfortWorks' }, meta: { status: 'active', tags: ['furniture', 'low-stock'] } },
    { title: 'Organic Coffee Beans 1lb', data: { name: 'Organic Coffee Beans 1lb', sku: 'OCB-110', category: 'Food & Beverage', price: 18.50, stock: 520, reorderPoint: 100, supplier: 'BeanOrigin Co' }, meta: { status: 'active', tags: ['food'] } },
  ],
  Order: [
    { title: 'ORD-2026-0842', data: { orderNumber: 'ORD-2026-0842', customer: 'Sarah Mitchell', items: 3, total: 567.49, shippingMethod: 'Express', trackingNumber: '1Z999AA10123456784' }, meta: { status: 'shipped', tags: ['express'] } },
    { title: 'ORD-2026-0841', data: { orderNumber: 'ORD-2026-0841', customer: 'James Wong', items: 1, total: 149.99, shippingMethod: 'Standard', trackingNumber: '' }, meta: { status: 'processing', tags: [] } },
    { title: 'ORD-2026-0840', data: { orderNumber: 'ORD-2026-0840', customer: 'Elena Rodriguez', items: 5, total: 1243.00, shippingMethod: 'Express', trackingNumber: '1Z999AA10123456785' }, meta: { status: 'delivered', tags: ['express', 'high-value'] } },
  ],
  Customer: [
    { title: 'Sarah Mitchell', data: { name: 'Sarah Mitchell', email: 'sarah@example.com', phone: '(555) 123-4567', totalOrders: 12, totalSpent: 3420.50, tier: 'Gold' }, meta: { status: 'active', tags: ['gold'] } },
    { title: 'James Wong', data: { name: 'James Wong', email: 'james.w@example.com', phone: '(555) 234-5678', totalOrders: 3, totalSpent: 649.97, tier: 'Silver' }, meta: { status: 'active', tags: ['silver'] } },
    { title: 'Elena Rodriguez', data: { name: 'Elena Rodriguez', email: 'elena.r@example.com', phone: '(555) 345-6789', totalOrders: 28, totalSpent: 12580.00, tier: 'Platinum' }, meta: { status: 'active', tags: ['platinum', 'vip'] } },
  ],
  Lead: [
    { title: 'TechStart Inc - Enterprise License', data: { name: 'TechStart Inc', company: 'TechStart Inc', email: 'buyer@techstart.io', value: 45000, source: 'Trade Show', assignee: 'Mike Chen', probability: 60 }, meta: { status: 'proposal', tags: ['enterprise'] } },
    { title: 'GreenCo - Bulk Order', data: { name: 'GreenCo', company: 'GreenCo Sustainability', email: 'procurement@greenco.com', value: 12500, source: 'Website', assignee: 'Lisa Park', probability: 80 }, meta: { status: 'negotiation', tags: ['bulk'] } },
    { title: 'City Schools District', data: { name: 'City Schools District', company: 'Metro City Schools', email: 'purchasing@cityschools.edu', value: 78000, source: 'Referral', assignee: 'Mike Chen', probability: 30 }, meta: { status: 'qualified', tags: ['education', 'government'] } },
  ],
  Ticket: [
    { title: 'TK-1052: Defective unit received', data: { subject: 'Defective unit received', customer: 'Sarah Mitchell', priority: 'high', category: 'Returns', assignee: 'Support Team A', slaDeadline: '2026-02-09T17:00:00Z' }, meta: { status: 'open', tags: ['returns', 'urgent'] } },
    { title: 'TK-1051: Billing question', data: { subject: 'Billing question', customer: 'James Wong', priority: 'low', category: 'Billing', assignee: 'Support Team B', slaDeadline: '2026-02-10T17:00:00Z' }, meta: { status: 'in_progress', tags: ['billing'] } },
    { title: 'TK-1050: Shipping delay inquiry', data: { subject: 'Shipping delay inquiry', customer: 'Elena Rodriguez', priority: 'medium', category: 'Shipping', assignee: 'Support Team A', slaDeadline: '2026-02-11T17:00:00Z' }, meta: { status: 'waiting', tags: ['shipping'] } },
  ],
  Display: [
    { title: 'Spring Collection Window', data: { name: 'Spring Collection Window', location: 'Main Entrance', type: 'Window', startDate: '2026-03-01', endDate: '2026-04-30', products: ['WHP-001', 'EOC-042'] }, meta: { status: 'active', tags: ['seasonal'] } },
    { title: 'Coffee Corner Endcap', data: { name: 'Coffee Corner Endcap', location: 'Aisle 3 End', type: 'Endcap', startDate: '2026-02-01', endDate: '2026-02-28', products: ['OCB-110'] }, meta: { status: 'active', tags: ['food'] } },
  ],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RetailLensPage() {
  useLensNav('retail');

  const [mode, setMode] = useState<ModeTab>('Products');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<'library' | 'dashboard'>('library');

  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState<string>('active');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const currentType = MODE_TABS.find(t => t.id === mode)!.types[0];

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData<ArtifactData>('retail', currentType, {
    seed: seedData[currentType] || [],
  });

  const runAction = useRunArtifact('retail');

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

  /* ---- editor ---- */
  const openNew = () => {
    setEditingId(null);
    setFormTitle('');
    setFormStatus(statusOptionsFor(currentType)[0]);
    setFormData({});
    setShowEditor(true);
  };

  const openEdit = (item: LensItem<ArtifactData>) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormStatus(item.meta.status || 'active');
    setFormData(item.data as unknown as Record<string, unknown>);
    setShowEditor(true);
  };

  const handleSave = async () => {
    const payload = { title: formTitle, data: formData, meta: { status: formStatus } };
    if (editingId) await update(editingId, payload);
    else await create(payload);
    setShowEditor(false);
  };

  const handleDelete = async (id: string) => { await remove(id); };

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

  /* ---- computed metrics ---- */
  const pipelineValue = useMemo(() => {
    if (currentType !== 'Lead') return 0;
    return items.reduce((sum, i) => {
      const d = i.data as unknown as Lead;
      if (i.meta.status !== 'won' && i.meta.status !== 'lost') return sum + (d.value || 0);
      return sum;
    }, 0);
  }, [items, currentType]);

  const customerLTV = useMemo(() => {
    if (currentType !== 'Customer') return 0;
    const customers = items.length || 1;
    return items.reduce((sum, i) => sum + ((i.data as unknown as Customer).totalSpent || 0), 0) / customers;
  }, [items, currentType]);

  const lowStockProducts = useMemo(() => {
    if (currentType !== 'Product') return [];
    return items.filter(i => {
      const d = i.data as unknown as Product;
      return d.stock <= d.reorderPoint;
    });
  }, [items, currentType]);

  const openTicketCount = useMemo(() => {
    if (currentType !== 'Ticket') return 0;
    return items.filter(i => i.meta.status === 'open' || i.meta.status === 'in_progress').length;
  }, [items, currentType]);

  /* ---- badge ---- */
  const renderStatusBadge = (status: string) => {
    const color = statusColorFor(currentType, status);
    return <span className={ds.badge(color)}>{status.replace('_', ' ')}</span>;
  };

  /* ---- form fields ---- */
  const renderFormFields = () => {
    switch (currentType) {
      case 'Product':
        return (
          <>
            <div><label className={ds.label}>Product Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>SKU</label><input className={ds.input} value={(formData.sku as string) || ''} onChange={e => setFormData({ ...formData, sku: e.target.value })} /></div>
              <div><label className={ds.label}>Category</label><select className={ds.select} value={(formData.category as string) || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}><option value="">Select...</option><option value="Electronics">Electronics</option><option value="Furniture">Furniture</option><option value="Food & Beverage">Food & Beverage</option><option value="Apparel">Apparel</option><option value="Other">Other</option></select></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Price ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.price as number) || ''} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Stock</label><input type="number" className={ds.input} value={(formData.stock as number) || ''} onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Reorder Point</label><input type="number" className={ds.input} value={(formData.reorderPoint as number) || ''} onChange={e => setFormData({ ...formData, reorderPoint: parseInt(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Supplier</label><input className={ds.input} value={(formData.supplier as string) || ''} onChange={e => setFormData({ ...formData, supplier: e.target.value })} /></div>
            </div>
          </>
        );
      case 'Order':
        return (
          <>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Order Number</label><input className={ds.input} value={(formData.orderNumber as string) || ''} onChange={e => setFormData({ ...formData, orderNumber: e.target.value })} /></div>
              <div><label className={ds.label}>Customer</label><input className={ds.input} value={(formData.customer as string) || ''} onChange={e => setFormData({ ...formData, customer: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Items Count</label><input type="number" className={ds.input} value={(formData.items as number) || ''} onChange={e => setFormData({ ...formData, items: parseInt(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Total ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.total as number) || ''} onChange={e => setFormData({ ...formData, total: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Shipping Method</label><select className={ds.select} value={(formData.shippingMethod as string) || 'Standard'} onChange={e => setFormData({ ...formData, shippingMethod: e.target.value })}><option value="Standard">Standard</option><option value="Express">Express</option><option value="Overnight">Overnight</option><option value="Pickup">In-store Pickup</option></select></div>
              <div><label className={ds.label}>Tracking Number</label><input className={ds.input} value={(formData.trackingNumber as string) || ''} onChange={e => setFormData({ ...formData, trackingNumber: e.target.value })} /></div>
            </div>
          </>
        );
      case 'Customer':
        return (
          <>
            <div><label className={ds.label}>Customer Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Email</label><input type="email" className={ds.input} value={(formData.email as string) || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
              <div><label className={ds.label}>Phone</label><input className={ds.input} value={(formData.phone as string) || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Total Orders</label><input type="number" className={ds.input} value={(formData.totalOrders as number) || ''} onChange={e => setFormData({ ...formData, totalOrders: parseInt(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Total Spent ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.totalSpent as number) || ''} onChange={e => setFormData({ ...formData, totalSpent: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div><label className={ds.label}>Tier</label><select className={ds.select} value={(formData.tier as string) || 'Bronze'} onChange={e => setFormData({ ...formData, tier: e.target.value })}><option value="Bronze">Bronze</option><option value="Silver">Silver</option><option value="Gold">Gold</option><option value="Platinum">Platinum</option></select></div>
          </>
        );
      case 'Lead':
        return (
          <>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Contact Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className={ds.label}>Company</label><input className={ds.input} value={(formData.company as string) || ''} onChange={e => setFormData({ ...formData, company: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Email</label><input type="email" className={ds.input} value={(formData.email as string) || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
              <div><label className={ds.label}>Source</label><select className={ds.select} value={(formData.source as string) || ''} onChange={e => setFormData({ ...formData, source: e.target.value })}><option value="">Select...</option><option value="Website">Website</option><option value="Trade Show">Trade Show</option><option value="Referral">Referral</option><option value="Cold Call">Cold Call</option><option value="Social Media">Social Media</option></select></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Deal Value ($)</label><input type="number" className={ds.input} value={(formData.value as number) || ''} onChange={e => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Probability (%)</label><input type="number" min="0" max="100" className={ds.input} value={(formData.probability as number) || ''} onChange={e => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div><label className={ds.label}>Assignee</label><input className={ds.input} value={(formData.assignee as string) || ''} onChange={e => setFormData({ ...formData, assignee: e.target.value })} /></div>
          </>
        );
      case 'Ticket':
        return (
          <>
            <div><label className={ds.label}>Subject</label><input className={ds.input} value={(formData.subject as string) || ''} onChange={e => setFormData({ ...formData, subject: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Customer</label><input className={ds.input} value={(formData.customer as string) || ''} onChange={e => setFormData({ ...formData, customer: e.target.value })} /></div>
              <div><label className={ds.label}>Category</label><select className={ds.select} value={(formData.category as string) || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}><option value="">Select...</option><option value="Returns">Returns</option><option value="Billing">Billing</option><option value="Shipping">Shipping</option><option value="Product">Product</option><option value="General">General</option></select></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Priority</label><select className={ds.select} value={(formData.priority as string) || 'medium'} onChange={e => setFormData({ ...formData, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
              <div><label className={ds.label}>Assignee</label><input className={ds.input} value={(formData.assignee as string) || ''} onChange={e => setFormData({ ...formData, assignee: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>SLA Deadline</label><input type="datetime-local" className={ds.input} value={(formData.slaDeadline as string) || ''} onChange={e => setFormData({ ...formData, slaDeadline: e.target.value })} /></div>
          </>
        );
      case 'Display':
        return (
          <>
            <div><label className={ds.label}>Display Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Location</label><input className={ds.input} value={(formData.location as string) || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
              <div><label className={ds.label}>Type</label><select className={ds.select} value={(formData.type as string) || ''} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="">Select...</option><option value="Window">Window</option><option value="Endcap">Endcap</option><option value="Floor">Floor Stand</option><option value="Counter">Counter</option><option value="Digital">Digital Sign</option></select></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Start Date</label><input type="date" className={ds.input} value={(formData.startDate as string) || ''} onChange={e => setFormData({ ...formData, startDate: e.target.value })} /></div>
              <div><label className={ds.label}>End Date</label><input type="date" className={ds.input} value={(formData.endDate as string) || ''} onChange={e => setFormData({ ...formData, endDate: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Product SKUs (comma-separated)</label><input className={ds.input} value={((formData.products as string[]) || []).join(', ')} onChange={e => setFormData({ ...formData, products: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
          </>
        );
      default: return null;
    }
  };

  /* ---- card ---- */
  const renderCard = (item: LensItem<ArtifactData>) => {
    const d = item.data as unknown as Record<string, unknown>;
    return (
      <div key={item.id} className={ds.panelHover}>
        <div className={ds.sectionHeader}>
          <h3 className={ds.heading3}>{item.title}</h3>
          {renderStatusBadge(item.meta.status)}
        </div>
        <div className="mt-2 space-y-1">
          {currentType === 'Product' && <><p className={`${ds.textMono} text-gray-500`}>SKU: {d.sku as string}</p><p className={ds.textMuted}>{d.category as string} | ${(d.price as number)?.toFixed(2)}</p><p className={ds.textMuted}>Stock: {d.stock as number} (reorder at {d.reorderPoint as number})</p>{(d.stock as number) <= (d.reorderPoint as number) && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Low stock - reorder needed</p>}</>}
          {currentType === 'Order' && <><p className={ds.textMuted}>Customer: {d.customer as string}</p><p className={ds.textMuted}>{d.items as number} items | ${(d.total as number)?.toFixed(2)}</p><p className={ds.textMuted}>{d.shippingMethod as string}{d.trackingNumber ? ` | ${d.trackingNumber}` : ''}</p></>}
          {currentType === 'Customer' && <><div className="flex items-center gap-2 text-sm text-gray-400"><Mail className="w-3 h-3" />{d.email as string}</div><div className="flex items-center gap-2 text-sm text-gray-400"><Phone className="w-3 h-3" />{d.phone as string}</div><p className={ds.textMuted}>{d.totalOrders as number} orders | ${(d.totalSpent as number)?.toFixed(2)} spent</p><span className={ds.badge(d.tier === 'Platinum' ? 'neon-purple' : d.tier === 'Gold' ? 'yellow-400' : 'gray-400')}><Star className="w-3 h-3" /> {d.tier as string}</span></>}
          {currentType === 'Lead' && <><p className={ds.textMuted}>{d.company as string}</p><p className={ds.textMuted}>Value: ${((d.value as number) || 0).toLocaleString()} | {d.probability as number}% probability</p><p className={ds.textMuted}>Source: {d.source as string} | Assigned: {d.assignee as string}</p></>}
          {currentType === 'Ticket' && <><p className={ds.textMuted}>Customer: {d.customer as string}</p><p className={ds.textMuted}>Category: {d.category as string} | Priority: {d.priority as string}</p><p className={ds.textMuted}>Assigned: {d.assignee as string}</p></>}
          {currentType === 'Display' && <><p className={ds.textMuted}>{d.location as string} | {d.type as string}</p><p className={ds.textMuted}>{d.startDate as string} to {d.endDate as string}</p><p className={ds.textMuted}>{((d.products as string[]) || []).length} products featured</p></>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button className={`${ds.btnGhost} ${ds.btnSmall}`} onClick={() => openEdit(item)}><Edit3 className="w-3.5 h-3.5" /> Edit</button>
          <button className={`${ds.btnDanger} ${ds.btnSmall}`} onClick={() => handleDelete(item.id)}><Trash2 className="w-3.5 h-3.5" /> Delete</button>
        </div>
      </div>
    );
  };

  /* ---- dashboard ---- */
  const renderDashboard = () => {
    const totalRevenue = seedData.Order.reduce((s, o) => s + ((o.data.total as number) || 0), 0);
    const totalPipelineVal = seedData.Lead.reduce((s, l) => {
      const st = l.meta.status as string;
      if (st !== 'won' && st !== 'lost') return s + ((l.data.value as number) || 0);
      return s;
    }, 0);
    const avgLTV = seedData.Customer.reduce((s, c) => s + ((c.data.totalSpent as number) || 0), 0) / (seedData.Customer.length || 1);

    return (
      <div className="space-y-6">
        <div className={ds.grid4}>
          <div className={ds.panel}>
            <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-green-400" /><span className={ds.textMuted}>Revenue (Recent)</span></div>
            <p className={ds.heading2}>${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center gap-1 mt-1 text-green-400 text-sm"><ArrowUpRight className="w-3 h-3" /> +12.4%</div>
          </div>
          <div className={ds.panel}>
            <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-neon-purple" /><span className={ds.textMuted}>Pipeline Value</span></div>
            <p className={ds.heading2}>${totalPipelineVal.toLocaleString()}</p>
            <p className={ds.textMuted}>{seedData.Lead.length} active deals</p>
          </div>
          <div className={ds.panel}>
            <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-neon-cyan" /><span className={ds.textMuted}>Avg Customer LTV</span></div>
            <p className={ds.heading2}>${avgLTV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <div className="flex items-center gap-1 mt-1 text-green-400 text-sm"><ArrowUpRight className="w-3 h-3" /> +8.1%</div>
          </div>
          <div className={ds.panel}>
            <div className="flex items-center gap-2 mb-2"><Headphones className="w-4 h-4 text-red-400" /><span className={ds.textMuted}>Open Tickets</span></div>
            <p className={ds.heading2}>{seedData.Ticket.filter(t => t.meta.status === 'open' || t.meta.status === 'in_progress').length}</p>
            <p className={ds.textMuted}>SLA compliance 94%</p>
          </div>
        </div>

        {/* Reorder check */}
        <div className={ds.panel}>
          <h3 className={`${ds.heading3} mb-3`}>Reorder Check</h3>
          {seedData.Product.filter(p => (p.data.stock as number) <= (p.data.reorderPoint as number)).length === 0 ? (
            <div className="flex items-center gap-2 text-green-400"><CheckCircle2 className="w-5 h-5" /> All products above reorder point.</div>
          ) : (
            <div className="space-y-2">
              {seedData.Product.filter(p => (p.data.stock as number) <= (p.data.reorderPoint as number)).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div>
                    <p className="text-sm font-medium text-white">{p.title}</p>
                    <p className={ds.textMuted}>Stock: {p.data.stock as number} / Reorder at: {p.data.reorderPoint as number}</p>
                  </div>
                  <button className={ds.btnSecondary}><Truck className="w-4 h-4" /> Reorder</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline stages */}
        <div className={ds.panel}>
          <h3 className={`${ds.heading3} mb-4`}>Sales Pipeline</h3>
          <div className="flex items-end gap-2">
            {(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won'] as LeadStatus[]).map(stage => {
              const count = seedData.Lead.filter(l => l.meta.status === stage).length;
              const maxCount = 3;
              const height = Math.max(20, (count / maxCount) * 120);
              return (
                <div key={stage} className="flex-1 text-center">
                  <div className="flex justify-center mb-1">
                    <div className={`w-full rounded-t-lg bg-neon-purple/30 border border-neon-purple/50`} style={{ height: `${height}px` }}>
                      <span className="text-xs font-bold text-white block pt-1">{count}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 capitalize">{stage}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className={ds.panel}>
          <h3 className={`${ds.heading3} mb-4`}>Quick Actions</h3>
          <div className={ds.grid4}>
            <button className={ds.btnSecondary} onClick={() => { setMode('Products'); setView('library'); }}>
              <Package className="w-4 h-4" /> Reorder Check
            </button>
            <button className={ds.btnSecondary} onClick={() => { setMode('Pipeline'); setView('library'); }}>
              <TrendingUp className="w-4 h-4" /> Pipeline Value
            </button>
            <button className={ds.btnSecondary} onClick={() => { setMode('Customers'); setView('library'); }}>
              <Users className="w-4 h-4" /> Customer LTV
            </button>
            <button className={ds.btnSecondary} onClick={() => { setMode('Support'); setView('library'); }}>
              <Clock className="w-4 h-4" /> SLA Status
            </button>
          </div>
        </div>
      </div>
    );
  };

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
          <Store className="w-7 h-7 text-neon-purple" />
          <div>
            <h1 className={ds.heading1}>Retail &amp; Commerce</h1>
            <p className={ds.textMuted}>Products, orders, customers &amp; sales pipeline</p>
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
                  ? 'bg-neon-purple/20 text-neon-purple'
                  : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.id}
            </button>
          );
        })}
      </nav>

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
              <select className={ds.select + ' w-auto'} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                {statusOptionsFor(currentType).map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 -ml-8 pointer-events-none" />
            </div>
            <button className={ds.btnPrimary} onClick={openNew}>
              <Plus className="w-4 h-4" /> New {currentType}
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

          {/* Artifact library */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-neon-purple" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Store className="w-12 h-12 text-gray-600 mx-auto mb-3" />
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
                  <select className={ds.select} value={formStatus} onChange={e => setFormStatus(e.target.value)}>
                    {statusOptionsFor(currentType).map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
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
