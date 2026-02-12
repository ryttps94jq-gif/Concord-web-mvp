'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useLensData, LensItem } from '@/lib/hooks/use-lens-data';
import { ds } from '@/lib/design-system';
import {
  BookOpen,
  Receipt,
  Wallet,
  PiggyBank,
  Building2,
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  X,
  Edit3,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  BarChart3,
  AlertCircle,
  ChevronDown,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  ListChecks,
  Calculator,
  Scale,
  Landmark,
  CreditCard,
} from 'lucide-react';
import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts';
import { ErrorState } from '@/components/common/EmptyState';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ModeTab = 'Ledger' | 'Invoicing' | 'Payroll' | 'Budget' | 'Properties' | 'Tax';

type ArtifactType = 'Account' | 'Transaction' | 'Invoice' | 'PayrollEntry' | 'Budget' | 'Property' | 'TaxItem';

type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void';
type TransactionStatus = 'pending' | 'cleared' | 'reconciled';
type GeneralStatus = string;

interface Account { name: string; accountNumber: string; type: string; balance: number; currency: string; institution: string; }
interface Transaction { description: string; account: string; debit: number; credit: number; category: string; reference: string; date: string; }
interface Invoice { invoiceNumber: string; client: string; amount: number; dueDate: string; issuedDate: string; lineItems: number; notes: string; }
interface PayrollEntry { employee: string; period: string; grossPay: number; deductions: number; netPay: number; department: string; }
interface BudgetItem { name: string; category: string; allocated: number; spent: number; period: string; department: string; }
interface Property { name: string; address: string; type: string; units: number; monthlyRent: number; occupancy: number; expenses: number; }
interface TaxItem { name: string; category: string; amount: number; taxYear: string; deductible: boolean; filingStatus: string; }

type ArtifactData = Account | Transaction | Invoice | PayrollEntry | BudgetItem | Property | TaxItem;

const MODE_TABS: { id: ModeTab; icon: typeof BookOpen; types: ArtifactType[] }[] = [
  { id: 'Ledger', icon: BookOpen, types: ['Account', 'Transaction'] },
  { id: 'Invoicing', icon: Receipt, types: ['Invoice'] },
  { id: 'Payroll', icon: Wallet, types: ['PayrollEntry'] },
  { id: 'Budget', icon: PiggyBank, types: ['Budget'] },
  { id: 'Properties', icon: Building2, types: ['Property'] },
  { id: 'Tax', icon: FileSpreadsheet, types: ['TaxItem'] },
];

const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = { draft: 'gray-400', sent: 'neon-blue', partial: 'yellow-400', paid: 'green-400', overdue: 'red-400', void: 'gray-500' };
const TRANSACTION_STATUS_COLORS: Record<TransactionStatus, string> = { pending: 'yellow-400', cleared: 'neon-blue', reconciled: 'green-400' };

function statusColorFor(type: ArtifactType, status: string): string {
  if (type === 'Invoice') return INVOICE_STATUS_COLORS[status as InvoiceStatus] || 'gray-400';
  if (type === 'Transaction') return TRANSACTION_STATUS_COLORS[status as TransactionStatus] || 'gray-400';
  if (status === 'active') return 'green-400';
  if (status === 'pending') return 'yellow-400';
  return 'neon-cyan';
}

function statusOptionsFor(type: ArtifactType): string[] {
  if (type === 'Invoice') return ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'];
  if (type === 'Transaction') return ['pending', 'cleared', 'reconciled'];
  return ['active', 'pending', 'closed'];
}

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const SEED_DATA: Record<string, { title: string; data: Record<string, unknown>; meta: Record<string, unknown> }[]> = {
  Account: [
    { title: 'Operating Checking', data: { name: 'Operating Checking', accountNumber: '****4521', type: 'Asset', balance: 84250.00, currency: 'USD', institution: 'First National Bank' }, meta: { status: 'active', tags: ['checking'] } },
    { title: 'Business Savings', data: { name: 'Business Savings', accountNumber: '****7833', type: 'Asset', balance: 150000.00, currency: 'USD', institution: 'First National Bank' }, meta: { status: 'active', tags: ['savings'] } },
    { title: 'Accounts Receivable', data: { name: 'Accounts Receivable', accountNumber: 'AR-001', type: 'Asset', balance: 32450.00, currency: 'USD', institution: 'Internal' }, meta: { status: 'active', tags: ['receivable'] } },
    { title: 'Revenue - Services', data: { name: 'Revenue - Services', accountNumber: 'REV-100', type: 'Revenue', balance: 245000.00, currency: 'USD', institution: 'Internal' }, meta: { status: 'active', tags: ['revenue'] } },
    { title: 'Accounts Payable', data: { name: 'Accounts Payable', accountNumber: 'AP-001', type: 'Liability', balance: 18750.00, currency: 'USD', institution: 'Internal' }, meta: { status: 'active', tags: ['payable'] } },
  ],
  Transaction: [
    { title: 'Client payment - Acme Corp', data: { description: 'Client payment - Acme Corp', account: 'Operating Checking', debit: 12500, credit: 0, category: 'Revenue', reference: 'INV-2026-042', date: '2026-02-07' }, meta: { status: 'cleared', tags: ['payment'] } },
    { title: 'Office rent - February', data: { description: 'Office rent - February', account: 'Operating Checking', debit: 0, credit: 3500, category: 'Expense', reference: 'CHK-1842', date: '2026-02-01' }, meta: { status: 'reconciled', tags: ['rent'] } },
    { title: 'Software subscription', data: { description: 'Software subscription', account: 'Operating Checking', debit: 0, credit: 299, category: 'Expense', reference: 'AUTO-0214', date: '2026-02-05' }, meta: { status: 'pending', tags: ['software'] } },
    { title: 'Vendor payment - SupplyChain Ltd', data: { description: 'Vendor payment - SupplyChain Ltd', account: 'Accounts Payable', debit: 0, credit: 8400, category: 'COGS', reference: 'PO-3391', date: '2026-02-06' }, meta: { status: 'cleared', tags: ['vendor'] } },
  ],
  Invoice: [
    { title: 'INV-2026-045 - TechStart Inc', data: { invoiceNumber: 'INV-2026-045', client: 'TechStart Inc', amount: 15000, dueDate: '2026-03-01', issuedDate: '2026-02-01', lineItems: 3, notes: 'Consulting services - January' }, meta: { status: 'sent', tags: ['consulting'] } },
    { title: 'INV-2026-044 - GreenCo', data: { invoiceNumber: 'INV-2026-044', client: 'GreenCo Sustainability', amount: 8750, dueDate: '2026-02-15', issuedDate: '2026-01-15', lineItems: 2, notes: 'Monthly retainer' }, meta: { status: 'overdue', tags: ['retainer'] } },
    { title: 'INV-2026-043 - Metro Schools', data: { invoiceNumber: 'INV-2026-043', client: 'Metro City Schools', amount: 22400, dueDate: '2026-02-28', issuedDate: '2026-01-28', lineItems: 5, notes: 'Training program delivery' }, meta: { status: 'partial', tags: ['training'] } },
    { title: 'INV-2026-042 - Acme Corp', data: { invoiceNumber: 'INV-2026-042', client: 'Acme Corp', amount: 12500, dueDate: '2026-02-07', issuedDate: '2026-01-07', lineItems: 2, notes: 'Project milestone 2' }, meta: { status: 'paid', tags: ['project'] } },
  ],
  PayrollEntry: [
    { title: 'Jan 2026 - Sarah Mitchell', data: { employee: 'Sarah Mitchell', period: '2026-01', grossPay: 8500, deductions: 2125, netPay: 6375, department: 'Engineering' }, meta: { status: 'active', tags: ['engineering'] } },
    { title: 'Jan 2026 - Mike Chen', data: { employee: 'Mike Chen', period: '2026-01', grossPay: 7200, deductions: 1800, netPay: 5400, department: 'Sales' }, meta: { status: 'active', tags: ['sales'] } },
    { title: 'Jan 2026 - Lisa Park', data: { employee: 'Lisa Park', period: '2026-01', grossPay: 9000, deductions: 2250, netPay: 6750, department: 'Operations' }, meta: { status: 'active', tags: ['operations'] } },
  ],
  Budget: [
    { title: 'Marketing Q1 2026', data: { name: 'Marketing Q1 2026', category: 'Marketing', allocated: 25000, spent: 14200, period: 'Q1-2026', department: 'Marketing' }, meta: { status: 'active', tags: ['marketing'] } },
    { title: 'Engineering Q1 2026', data: { name: 'Engineering Q1 2026', category: 'Engineering', allocated: 80000, spent: 52300, period: 'Q1-2026', department: 'Engineering' }, meta: { status: 'active', tags: ['engineering'] } },
    { title: 'Office Operations Q1 2026', data: { name: 'Office Operations Q1 2026', category: 'Operations', allocated: 15000, spent: 11800, period: 'Q1-2026', department: 'Operations' }, meta: { status: 'active', tags: ['operations'] } },
  ],
  Property: [
    { title: '120 Main Street Office', data: { name: '120 Main Street Office', address: '120 Main St, Suite 400', type: 'Commercial', units: 4, monthlyRent: 12000, occupancy: 100, expenses: 3200 }, meta: { status: 'active', tags: ['commercial'] } },
    { title: 'Elm Street Apartments', data: { name: 'Elm Street Apartments', address: '45 Elm Street', type: 'Residential', units: 8, monthlyRent: 14400, occupancy: 87.5, expenses: 4800 }, meta: { status: 'active', tags: ['residential'] } },
  ],
  TaxItem: [
    { title: 'Office Equipment Depreciation', data: { name: 'Office Equipment Depreciation', category: 'Depreciation', amount: 12000, taxYear: '2025', deductible: true, filingStatus: 'pending' }, meta: { status: 'pending', tags: ['depreciation'] } },
    { title: 'Business Insurance Premium', data: { name: 'Business Insurance Premium', category: 'Insurance', amount: 8400, taxYear: '2025', deductible: true, filingStatus: 'pending' }, meta: { status: 'pending', tags: ['insurance'] } },
    { title: 'Estimated Q4 Tax Payment', data: { name: 'Estimated Q4 Tax Payment', category: 'Estimated Tax', amount: 15000, taxYear: '2025', deductible: false, filingStatus: 'filed' }, meta: { status: 'active', tags: ['quarterly'] } },
  ],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AccountingLensPage() {
  useLensNav('accounting');

  const [mode, setMode] = useState<ModeTab>('Ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<'library' | 'dashboard'>('library');
  const [ledgerSubType, setLedgerSubType] = useState<'Account' | 'Transaction'>('Account');

  const [formTitle, setFormTitle] = useState('');
  const [formStatus, setFormStatus] = useState<string>('active');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [actionResult, setActionResult] = useState<Record<string, unknown> | null>(null);

  const currentType: ArtifactType = mode === 'Ledger' ? ledgerSubType : MODE_TABS.find(t => t.id === mode)!.types[0];

  const { items, isLoading, isError: isError, error: error, refetch: refetch, create, update, remove } = useLensData<ArtifactData>('accounting', currentType, {
    seed: SEED_DATA[currentType] || [],
  });

  const runAction = useRunArtifact('accounting');

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
  const totalAssets = useMemo(() => {
    return SEED_DATA.Account.filter(a => a.data.type === 'Asset').reduce((s, a) => s + (a.data.balance as number), 0);
  }, []);

  const totalLiabilities = useMemo(() => {
    return SEED_DATA.Account.filter(a => a.data.type === 'Liability').reduce((s, a) => s + (a.data.balance as number), 0);
  }, []);

  const totalRevenue = useMemo(() => {
    return SEED_DATA.Account.filter(a => a.data.type === 'Revenue').reduce((s, a) => s + (a.data.balance as number), 0);
  }, []);

  const invoiceAging = useMemo(() => {
    const aging = { current: 0, thirtyDay: 0, sixtyDay: 0, ninetyPlus: 0 };
    SEED_DATA.Invoice.forEach(inv => {
      if (inv.meta.status === 'paid' || inv.meta.status === 'void') return;
      const due = new Date(inv.data.dueDate as string);
      const now = new Date();
      const daysPast = Math.floor((now.getTime() - due.getTime()) / 86400000);
      const amt = inv.data.amount as number;
      if (daysPast <= 0) aging.current += amt;
      else if (daysPast <= 30) aging.thirtyDay += amt;
      else if (daysPast <= 60) aging.sixtyDay += amt;
      else aging.ninetyPlus += amt;
    });
    return aging;
  }, []);

  const budgetVariance = useMemo(() => {
    return SEED_DATA.Budget.map(b => ({
      name: b.data.name as string,
      allocated: b.data.allocated as number,
      spent: b.data.spent as number,
      variance: (b.data.allocated as number) - (b.data.spent as number),
      percent: ((b.data.spent as number) / (b.data.allocated as number)) * 100,
    }));
  }, []);

  const rentRoll = useMemo(() => {
    return SEED_DATA.Property.reduce((s, p) => s + (p.data.monthlyRent as number), 0);
  }, []);

  /* ---- badge ---- */
  const renderStatusBadge = (status: string) => {
    const color = statusColorFor(currentType, status);
    return <span className={ds.badge(color)}>{status}</span>;
  };

  /* ---- form fields ---- */
  const renderFormFields = () => {
    switch (currentType) {
      case 'Account':
        return (
          <>
            <div><label className={ds.label}>Account Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Account Number</label><input className={ds.input} value={(formData.accountNumber as string) || ''} onChange={e => setFormData({ ...formData, accountNumber: e.target.value })} /></div>
              <div><label className={ds.label}>Type</label><select className={ds.select} value={(formData.type as string) || ''} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="">Select...</option><option value="Asset">Asset</option><option value="Liability">Liability</option><option value="Equity">Equity</option><option value="Revenue">Revenue</option><option value="Expense">Expense</option></select></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Balance ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.balance as number) || ''} onChange={e => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Institution</label><input className={ds.input} value={(formData.institution as string) || ''} onChange={e => setFormData({ ...formData, institution: e.target.value })} /></div>
            </div>
          </>
        );
      case 'Transaction':
        return (
          <>
            <div><label className={ds.label}>Description</label><input className={ds.input} value={(formData.description as string) || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Account</label><input className={ds.input} value={(formData.account as string) || ''} onChange={e => setFormData({ ...formData, account: e.target.value })} /></div>
              <div><label className={ds.label}>Category</label><select className={ds.select} value={(formData.category as string) || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}><option value="">Select...</option><option value="Revenue">Revenue</option><option value="Expense">Expense</option><option value="COGS">COGS</option><option value="Transfer">Transfer</option></select></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Debit ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.debit as number) || ''} onChange={e => setFormData({ ...formData, debit: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Credit ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.credit as number) || ''} onChange={e => setFormData({ ...formData, credit: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Reference</label><input className={ds.input} value={(formData.reference as string) || ''} onChange={e => setFormData({ ...formData, reference: e.target.value })} /></div>
              <div><label className={ds.label}>Date</label><input type="date" className={ds.input} value={(formData.date as string) || ''} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
            </div>
          </>
        );
      case 'Invoice':
        return (
          <>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Invoice Number</label><input className={ds.input} value={(formData.invoiceNumber as string) || ''} onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })} /></div>
              <div><label className={ds.label}>Client</label><input className={ds.input} value={(formData.client as string) || ''} onChange={e => setFormData({ ...formData, client: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Amount ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.amount as number) || ''} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Line Items</label><input type="number" className={ds.input} value={(formData.lineItems as number) || ''} onChange={e => setFormData({ ...formData, lineItems: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Issued Date</label><input type="date" className={ds.input} value={(formData.issuedDate as string) || ''} onChange={e => setFormData({ ...formData, issuedDate: e.target.value })} /></div>
              <div><label className={ds.label}>Due Date</label><input type="date" className={ds.input} value={(formData.dueDate as string) || ''} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} /></div>
            </div>
            <div><label className={ds.label}>Notes</label><textarea className={ds.textarea} rows={3} value={(formData.notes as string) || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} /></div>
          </>
        );
      case 'PayrollEntry':
        return (
          <>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Employee</label><input className={ds.input} value={(formData.employee as string) || ''} onChange={e => setFormData({ ...formData, employee: e.target.value })} /></div>
              <div><label className={ds.label}>Period (YYYY-MM)</label><input className={ds.input} value={(formData.period as string) || ''} onChange={e => setFormData({ ...formData, period: e.target.value })} placeholder="2026-02" /></div>
            </div>
            <div className={ds.grid3}>
              <div><label className={ds.label}>Gross Pay ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.grossPay as number) || ''} onChange={e => setFormData({ ...formData, grossPay: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Deductions ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.deductions as number) || ''} onChange={e => setFormData({ ...formData, deductions: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Net Pay ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.netPay as number) || ''} onChange={e => setFormData({ ...formData, netPay: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div><label className={ds.label}>Department</label><input className={ds.input} value={(formData.department as string) || ''} onChange={e => setFormData({ ...formData, department: e.target.value })} /></div>
          </>
        );
      case 'Budget':
        return (
          <>
            <div><label className={ds.label}>Budget Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Category</label><input className={ds.input} value={(formData.category as string) || ''} onChange={e => setFormData({ ...formData, category: e.target.value })} /></div>
              <div><label className={ds.label}>Department</label><input className={ds.input} value={(formData.department as string) || ''} onChange={e => setFormData({ ...formData, department: e.target.value })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Allocated ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.allocated as number) || ''} onChange={e => setFormData({ ...formData, allocated: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Spent ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.spent as number) || ''} onChange={e => setFormData({ ...formData, spent: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div><label className={ds.label}>Period</label><input className={ds.input} value={(formData.period as string) || ''} onChange={e => setFormData({ ...formData, period: e.target.value })} placeholder="Q1-2026" /></div>
          </>
        );
      case 'Property':
        return (
          <>
            <div><label className={ds.label}>Property Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div><label className={ds.label}>Address</label><input className={ds.input} value={(formData.address as string) || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Type</label><select className={ds.select} value={(formData.type as string) || ''} onChange={e => setFormData({ ...formData, type: e.target.value })}><option value="">Select...</option><option value="Commercial">Commercial</option><option value="Residential">Residential</option><option value="Industrial">Industrial</option><option value="Mixed-Use">Mixed-Use</option></select></div>
              <div><label className={ds.label}>Units</label><input type="number" className={ds.input} value={(formData.units as number) || ''} onChange={e => setFormData({ ...formData, units: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className={ds.grid3}>
              <div><label className={ds.label}>Monthly Rent ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.monthlyRent as number) || ''} onChange={e => setFormData({ ...formData, monthlyRent: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Occupancy (%)</label><input type="number" min="0" max="100" className={ds.input} value={(formData.occupancy as number) || ''} onChange={e => setFormData({ ...formData, occupancy: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className={ds.label}>Monthly Expenses ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.expenses as number) || ''} onChange={e => setFormData({ ...formData, expenses: parseFloat(e.target.value) || 0 })} /></div>
            </div>
          </>
        );
      case 'TaxItem':
        return (
          <>
            <div><label className={ds.label}>Item Name</label><input className={ds.input} value={(formData.name as string) || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Category</label><select className={ds.select} value={(formData.category as string) || ''} onChange={e => setFormData({ ...formData, category: e.target.value })}><option value="">Select...</option><option value="Depreciation">Depreciation</option><option value="Insurance">Insurance</option><option value="Estimated Tax">Estimated Tax</option><option value="Deduction">Deduction</option><option value="Credit">Credit</option></select></div>
              <div><label className={ds.label}>Amount ($)</label><input type="number" step="0.01" className={ds.input} value={(formData.amount as number) || ''} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className={ds.grid2}>
              <div><label className={ds.label}>Tax Year</label><input className={ds.input} value={(formData.taxYear as string) || ''} onChange={e => setFormData({ ...formData, taxYear: e.target.value })} placeholder="2025" /></div>
              <div><label className={ds.label}>Deductible?</label><select className={ds.select} value={formData.deductible ? 'true' : 'false'} onChange={e => setFormData({ ...formData, deductible: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
            </div>
          </>
        );
      default: return null;
    }
  };

  /* ---- card ---- */
  const renderCard = (item: LensItem<ArtifactData>) => {
    const d = item.data as Record<string, unknown>;
    return (
      <div key={item.id} className={ds.panelHover}>
        <div className={ds.sectionHeader}>
          <h3 className={ds.heading3}>{item.title}</h3>
          {renderStatusBadge(item.meta.status)}
        </div>
        <div className="mt-2 space-y-1">
          {currentType === 'Account' && <><p className={`${ds.textMono} text-gray-500`}>{d.accountNumber as string} | {d.type as string}</p><p className={`${ds.heading3} ${(d.type as string) === 'Liability' ? 'text-red-400' : 'text-green-400'}`}>{fmt(d.balance as number)}</p><p className={ds.textMuted}>{d.institution as string}</p></>}
          {currentType === 'Transaction' && <><p className={ds.textMuted}>{d.account as string} | {d.category as string}</p><div className="flex items-center gap-4"><span className={`${ds.textMono} text-green-400`}>DR {fmt(d.debit as number)}</span><span className={`${ds.textMono} text-red-400`}>CR {fmt(d.credit as number)}</span></div><p className={ds.textMuted}>Ref: {d.reference as string} | {d.date as string}</p></>}
          {currentType === 'Invoice' && <><p className={ds.textMuted}>Client: {d.client as string}</p><p className={ds.heading3}>{fmt(d.amount as number)}</p><p className={ds.textMuted}>Issued: {d.issuedDate as string} | Due: {d.dueDate as string}</p><p className={ds.textMuted}>{d.lineItems as number} line items</p></>}
          {currentType === 'PayrollEntry' && <><p className={ds.textMuted}>{d.employee as string} | {d.department as string}</p><p className={ds.textMuted}>Period: {d.period as string}</p><div className="flex items-center gap-3"><span className={ds.textMuted}>Gross: {fmt(d.grossPay as number)}</span><span className={ds.textMuted}>Net: {fmt(d.netPay as number)}</span></div></>}
          {currentType === 'Budget' && <><p className={ds.textMuted}>{d.category as string} | {d.department as string}</p><div className="mt-2"><div className="flex justify-between text-xs text-gray-400 mb-1"><span>{fmt(d.spent as number)} spent</span><span>{fmt(d.allocated as number)} allocated</span></div><div className="h-2 bg-lattice-elevated rounded-full overflow-hidden"><div className={`h-full rounded-full ${((d.spent as number) / (d.allocated as number)) > 0.9 ? 'bg-red-400' : ((d.spent as number) / (d.allocated as number)) > 0.7 ? 'bg-yellow-400' : 'bg-green-400'}`} style={{ width: `${Math.min(100, ((d.spent as number) / (d.allocated as number)) * 100)}%` }} /></div></div><p className={ds.textMuted}>Remaining: {fmt((d.allocated as number) - (d.spent as number))}</p></>}
          {currentType === 'Property' && <><p className={ds.textMuted}>{d.address as string}</p><p className={ds.textMuted}>{d.type as string} | {d.units as number} units | {d.occupancy as number}% occupied</p><div className="flex items-center gap-3"><span className={`${ds.textMono} text-green-400`}>Rent: {fmt(d.monthlyRent as number)}/mo</span><span className={`${ds.textMono} text-red-400`}>Exp: {fmt(d.expenses as number)}/mo</span></div><p className={ds.textMuted}>NOI: {fmt((d.monthlyRent as number) - (d.expenses as number))}/mo</p></>}
          {currentType === 'TaxItem' && <><p className={ds.textMuted}>{d.category as string} | Tax Year: {d.taxYear as string}</p><p className={ds.heading3}>{fmt(d.amount as number)}</p><span className={ds.badge((d.deductible as boolean) ? 'green-400' : 'gray-400')}>{(d.deductible as boolean) ? 'Deductible' : 'Non-deductible'}</span></>}
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
      {/* Key metrics */}
      <div className={ds.grid4}>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-green-400" /><span className={ds.textMuted}>Total Assets</span></div>
          <p className={ds.heading2}>{fmt(totalAssets)}</p>
          <div className="flex items-center gap-1 mt-1 text-green-400 text-sm"><ArrowUpRight className="w-3 h-3" /> +4.2%</div>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><CreditCard className="w-4 h-4 text-red-400" /><span className={ds.textMuted}>Total Liabilities</span></div>
          <p className={ds.heading2}>{fmt(totalLiabilities)}</p>
          <div className="flex items-center gap-1 mt-1 text-green-400 text-sm"><ArrowDownRight className="w-3 h-3" /> -2.1%</div>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-neon-cyan" /><span className={ds.textMuted}>Net Revenue</span></div>
          <p className={ds.heading2}>{fmt(totalRevenue)}</p>
          <div className="flex items-center gap-1 mt-1 text-green-400 text-sm"><ArrowUpRight className="w-3 h-3" /> +15.3%</div>
        </div>
        <div className={ds.panel}>
          <div className="flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-neon-purple" /><span className={ds.textMuted}>Rent Roll (Monthly)</span></div>
          <p className={ds.heading2}>{fmt(rentRoll)}</p>
          <p className={ds.textMuted}>{SEED_DATA.Property.length} properties</p>
        </div>
      </div>

      {/* Trial Balance Summary */}
      <div className={ds.panel}>
        <div className={ds.sectionHeader}>
          <h3 className={ds.heading3}>Trial Balance Summary</h3>
          <Scale className="w-5 h-5 text-gray-400" />
        </div>
        <div className={`${ds.grid2} mt-4`}>
          <div>
            <h4 className={`${ds.textMuted} mb-3`}>DEBITS</h4>
            {SEED_DATA.Account.filter(a => a.data.type === 'Asset' || a.data.type === 'Expense').map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-lattice-border/30">
                <span className="text-sm text-white">{a.data.name as string}</span>
                <span className={`${ds.textMono} text-green-400`}>{fmt(a.data.balance as number)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 font-bold">
              <span className="text-white">Total Debits</span>
              <span className={`${ds.textMono} text-green-400`}>{fmt(totalAssets)}</span>
            </div>
          </div>
          <div>
            <h4 className={`${ds.textMuted} mb-3`}>CREDITS</h4>
            {SEED_DATA.Account.filter(a => a.data.type === 'Liability' || a.data.type === 'Revenue' || a.data.type === 'Equity').map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-lattice-border/30">
                <span className="text-sm text-white">{a.data.name as string}</span>
                <span className={`${ds.textMono} text-neon-cyan`}>{fmt(a.data.balance as number)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 font-bold">
              <span className="text-white">Total Credits</span>
              <span className={`${ds.textMono} text-neon-cyan`}>{fmt(totalLiabilities + totalRevenue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Aging */}
      <div className={ds.panel}>
        <h3 className={`${ds.heading3} mb-4`}>Invoice Aging Report</h3>
        <div className={ds.grid4}>
          <div className="text-center p-4 rounded-lg bg-green-400/10 border border-green-400/20">
            <p className={ds.textMuted}>Current</p>
            <p className={`${ds.heading2} text-green-400`}>{fmt(invoiceAging.current)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
            <p className={ds.textMuted}>1-30 Days</p>
            <p className={`${ds.heading2} text-yellow-400`}>{fmt(invoiceAging.thirtyDay)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-orange-400/10 border border-orange-400/20">
            <p className={ds.textMuted}>31-60 Days</p>
            <p className={`${ds.heading2} text-orange-400`}>{fmt(invoiceAging.sixtyDay)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-red-400/10 border border-red-400/20">
            <p className={ds.textMuted}>90+ Days</p>
            <p className={`${ds.heading2} text-red-400`}>{fmt(invoiceAging.ninetyPlus)}</p>
          </div>
        </div>
      </div>

      {/* Budget Variance */}
      <div className={ds.panel}>
        <h3 className={`${ds.heading3} mb-4`}>Budget Variance Analysis</h3>
        <div className="space-y-4">
          {budgetVariance.map((b, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white">{b.name}</span>
                <div className="flex items-center gap-3">
                  <span className={ds.textMuted}>{b.percent.toFixed(1)}% used</span>
                  <span className={`${ds.textMono} ${b.variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {b.variance >= 0 ? '+' : ''}{fmt(b.variance)} remaining
                  </span>
                </div>
              </div>
              <div className="h-3 bg-lattice-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${b.percent > 90 ? 'bg-red-400' : b.percent > 75 ? 'bg-yellow-400' : 'bg-green-400'}`}
                  style={{ width: `${Math.min(100, b.percent)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className={ds.panel}>
        <h3 className={`${ds.heading3} mb-4`}>Financial Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button className={ds.btnSecondary} onClick={() => { setMode('Ledger'); setView('dashboard'); }}>
            <Scale className="w-4 h-4" /> Trial Balance
          </button>
          <button className={ds.btnSecondary} onClick={() => { setMode('Ledger'); setView('library'); }}>
            <Calculator className="w-4 h-4" /> Profit &amp; Loss
          </button>
          <button className={ds.btnSecondary} onClick={() => { setMode('Invoicing'); setView('library'); setStatusFilter('overdue'); }}>
            <AlertCircle className="w-4 h-4" /> Invoice Aging
          </button>
          <button className={ds.btnSecondary} onClick={() => { setMode('Budget'); setView('library'); }}>
            <BarChart3 className="w-4 h-4" /> Budget Variance
          </button>
          <button className={ds.btnSecondary} onClick={() => { setMode('Properties'); setView('library'); }}>
            <Building2 className="w-4 h-4" /> Rent Roll
          </button>
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
          <Landmark className="w-7 h-7 text-green-400" />
          <div>
            <h1 className={ds.heading1}>Accounting &amp; Finance</h1>
            <p className={ds.textMuted}>General ledger, invoicing, payroll &amp; financial reporting</p>
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
                  ? 'bg-green-400/20 text-green-400'
                  : 'text-gray-400 hover:text-white hover:bg-lattice-elevated'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.id}
            </button>
          );
        })}
      </nav>

      {/* Ledger sub-type toggle */}
      {mode === 'Ledger' && view === 'library' && (
        <div className="flex items-center gap-2">
          <button
            className={ledgerSubType === 'Account' ? ds.btnPrimary : ds.btnSecondary}
            onClick={() => { setLedgerSubType('Account'); setStatusFilter('all'); }}
          >
            <BookOpen className="w-4 h-4" /> Chart of Accounts
          </button>
          <button
            className={ledgerSubType === 'Transaction' ? ds.btnPrimary : ds.btnSecondary}
            onClick={() => { setLedgerSubType('Transaction'); setStatusFilter('all'); }}
          >
            <Receipt className="w-4 h-4" /> Journal Entries
          </button>
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
                placeholder={`Search ${currentType.toLowerCase()}s...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-gray-400" />
              <select className={ds.select + ' w-auto'} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                {statusOptionsFor(currentType).map(s => (
                  <option key={s} value={s}>{s}</option>
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
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Landmark className="w-12 h-12 text-gray-600 mx-auto mb-3" />
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
                      <option key={s} value={s}>{s}</option>
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
