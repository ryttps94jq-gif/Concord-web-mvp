'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { api } from '@/lib/api/client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Download,
  Star,
  Search,
  Plus,
  TrendingUp,
  Grid3X3,
  List,
  Trash2,
  Check,
  X,
  BarChart2,
  DollarSign,
  Package,
  Music,
  Layers,
  ShoppingCart,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Upload,
  Eye,
  LayoutDashboard,
  FileAudio,
  Palette,
  Plug,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
// marketplace-demo.ts has been deprecated — all data comes from API
import { ErrorState } from '@/components/common/EmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreatorInfo {
  name: string;
  avatar?: string;
  verified?: boolean;
}

interface LicensePrice {
  basic: number;
  premium: number;
  unlimited: number;
  exclusive: number;
}

interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  type: 'beat' | 'stem' | 'sample' | 'artwork' | 'plugin' | 'preset';
  genre?: string;
  bpm?: number;
  key?: string;
  duration?: string;
  creator: CreatorInfo;
  prices: LicensePrice;
  rating: number;
  ratingCount: number;
  sales: number;
  tags: string[];
  featured?: boolean;
  thumbnail?: string;
  previewUrl?: string;
  createdAt: string;
}

interface CartItem {
  item: MarketplaceItem;
  license: string;
  price: number;
}

interface Purchase {
  id: string;
  item: MarketplaceItem;
  license: string;
  price: number;
  purchasedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type Tab = 'browse' | 'myshop' | 'cart' | 'purchases' | 'analytics';
type ViewMode = 'grid' | 'list';
type SortOption = 'popular' | 'price-asc' | 'price-desc' | 'newest' | 'rating';
type CategoryFilter = 'all' | 'beats' | 'stems' | 'samples' | 'artwork' | 'plugins' | 'presets';

const LICENSE_TIERS = [
  { id: 'basic', name: 'Basic', color: 'text-gray-400' },
  { id: 'premium', name: 'Premium', color: 'text-neon-cyan' },
  { id: 'unlimited', name: 'Unlimited', color: 'text-neon-purple' },
  { id: 'exclusive', name: 'Exclusive', color: 'text-neon-pink' },
] as const;

const CATEGORIES: { id: CategoryFilter; name: string; icon: typeof Music }[] = [
  { id: 'all', name: 'All', icon: Grid3X3 },
  { id: 'beats', name: 'Beats', icon: Music },
  { id: 'stems', name: 'Stems', icon: FileAudio },
  { id: 'samples', name: 'Samples', icon: Layers },
  { id: 'artwork', name: 'Artwork', icon: Palette },
  { id: 'plugins', name: 'Plugins', icon: Plug },
  { id: 'presets', name: 'Presets', icon: Settings2 },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'price-asc', label: 'Price: Low-High' },
  { value: 'price-desc', label: 'Price: High-Low' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Best Rated' },
];

const GENRE_OPTIONS = ['All Genres', 'Hip-Hop', 'R&B', 'Pop', 'Electronic', 'Lo-Fi', 'Trap', 'Rock', 'Jazz', 'Ambient'];

// ---------------------------------------------------------------------------
// Helpers: normalize API responses into MarketplaceItem shape
// ---------------------------------------------------------------------------

function normalizeBeats(beats: Record<string, unknown>[]): MarketplaceItem[] {
  return (beats || []).map((b: Record<string, unknown>) => ({
    id: String(b.id || ''),
    title: String(b.title || 'Untitled'),
    description: String(b.description || ''),
    type: 'beat' as const,
    genre: b.genre ? String(b.genre) : undefined,
    bpm: typeof b.bpm === 'number' ? b.bpm : undefined,
    key: b.key ? String(b.key) : undefined,
    creator: { name: String((b as Record<string, unknown>).ownerId || 'Unknown') },
    prices: normalizePrices(b.licenses as Record<string, unknown>),
    rating: typeof b.rating === 'number' ? b.rating : 0,
    ratingCount: Array.isArray(b.reviews) ? b.reviews.length : 0,
    sales: typeof b.totalSales === 'number' ? b.totalSales : 0,
    tags: Array.isArray(b.tags) ? b.tags : [],
    createdAt: b.createdAt ? new Date(b.createdAt as number).toISOString() : new Date().toISOString(),
  }));
}

function normalizeStems(stems: Record<string, unknown>[]): MarketplaceItem[] {
  return (stems || []).map((s: Record<string, unknown>) => ({
    id: String(s.id || ''),
    title: String(s.title || 'Untitled'),
    description: String(s.description || ''),
    type: 'stem' as const,
    genre: s.genre ? String(s.genre) : undefined,
    creator: { name: String(s.ownerId || 'Unknown') },
    prices: { basic: typeof s.price === 'number' ? s.price : 0, premium: 0, unlimited: 0, exclusive: 0 },
    rating: 0,
    ratingCount: 0,
    sales: typeof s.totalSales === 'number' ? s.totalSales : 0,
    tags: Array.isArray(s.tags) ? s.tags : [],
    createdAt: s.createdAt ? new Date(s.createdAt as number).toISOString() : new Date().toISOString(),
  }));
}

function normalizeSamples(samples: Record<string, unknown>[]): MarketplaceItem[] {
  return (samples || []).map((s: Record<string, unknown>) => ({
    id: String(s.id || ''),
    title: String(s.title || 'Untitled'),
    description: String(s.description || ''),
    type: 'sample' as const,
    genre: s.genre ? String(s.genre) : undefined,
    creator: { name: String(s.ownerId || 'Unknown') },
    prices: { basic: typeof s.price === 'number' ? s.price : 0, premium: 0, unlimited: 0, exclusive: 0 },
    rating: 0,
    ratingCount: 0,
    sales: typeof s.totalSales === 'number' ? s.totalSales : 0,
    tags: Array.isArray(s.tags) ? s.tags : [],
    createdAt: s.createdAt ? new Date(s.createdAt as number).toISOString() : new Date().toISOString(),
  }));
}

function normalizeArt(art: Record<string, unknown>[]): MarketplaceItem[] {
  return (art || []).map((a: Record<string, unknown>) => ({
    id: String(a.id || ''),
    title: String(a.title || 'Untitled'),
    description: String(a.description || ''),
    type: 'artwork' as const,
    creator: { name: String(a.ownerId || 'Unknown') },
    prices: { basic: typeof a.price === 'number' ? a.price : 0, premium: 0, unlimited: 0, exclusive: 0 },
    rating: 0,
    ratingCount: 0,
    sales: typeof a.totalSales === 'number' ? a.totalSales : 0,
    tags: Array.isArray(a.tags) ? a.tags : [],
    createdAt: a.createdAt ? new Date(a.createdAt as number).toISOString() : new Date().toISOString(),
  }));
}

function normalizePrices(licenses: Record<string, unknown> | null | undefined): LicensePrice {
  if (!licenses) return { basic: 0, premium: 0, unlimited: 0, exclusive: 0 };
  const get = (key: string) => {
    const entry = licenses[key] as Record<string, unknown> | undefined;
    return typeof entry?.price === 'number' ? entry.price : 0;
  };
  return { basic: get('basic'), premium: get('premium'), unlimited: get('unlimited'), exclusive: get('exclusive') };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function starRating(rating: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={cn('w-3 h-3', i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600')} />
  ));
}

function formatPrice(cents: number) {
  return cents === 0 ? 'Free' : `$${cents}`;
}

function typeIcon(type: MarketplaceItem['type']) {
  switch (type) {
    case 'beat': return Music;
    case 'stem': return FileAudio;
    case 'sample': return Layers;
    case 'artwork': return Palette;
    case 'plugin': return Plug;
    case 'preset': return Settings2;
  }
}

function typeBadgeColor(type: MarketplaceItem['type']) {
  switch (type) {
    case 'beat': return 'bg-neon-purple/20 text-neon-purple';
    case 'stem': return 'bg-neon-cyan/20 text-neon-cyan';
    case 'sample': return 'bg-neon-green/20 text-neon-green';
    case 'artwork': return 'bg-neon-pink/20 text-neon-pink';
    case 'plugin': return 'bg-blue-500/20 text-blue-400';
    case 'preset': return 'bg-orange-500/20 text-orange-400';
  }
}

const isAudioType = (t: string) => ['beat', 'stem', 'sample'].includes(t);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WaveformBars({ playing, small }: { playing?: boolean; small?: boolean }) {
  const barCount = small ? 20 : 40;
  return (
    <div className={cn('flex items-end gap-px', small ? 'h-6' : 'h-10')}>
      {Array.from({ length: barCount }, (_, i) => {
        const h = 20 + Math.sin(i * 0.7) * 30 + Math.cos(i * 1.3) * 25;
        return (
          <motion.div
            key={i}
            className={cn('rounded-sm', playing ? 'bg-neon-purple' : 'bg-gray-600')}
            style={{ width: small ? 2 : 3, height: `${h}%` }}
            animate={playing ? { height: [`${h}%`, `${h + 15}%`, `${h}%`] } : {}}
            transition={playing ? { duration: 0.4 + Math.random() * 0.3, repeat: Infinity, repeatType: 'mirror' } : {}}
          />
        );
      })}
    </div>
  );
}

function ItemCard({
  item, onPlay, isPlaying, onAddToCart, viewMode,
}: {
  item: MarketplaceItem; onPlay: (item: MarketplaceItem) => void; isPlaying: boolean;
  onAddToCart: (item: MarketplaceItem) => void; viewMode: ViewMode;
}) {
  const Icon = typeIcon(item.type);
  const audio = isAudioType(item.type);

  if (viewMode === 'list') {
    return (
      <motion.div layout className="panel p-4 flex items-center gap-4 hover:border-neon-purple/40 transition-colors cursor-pointer">
        {/* Thumbnail */}
        <div className="relative w-14 h-14 rounded-lg bg-lattice-deep flex items-center justify-center shrink-0 overflow-hidden">
          {audio ? <WaveformBars playing={isPlaying} small /> : <Icon className="w-6 h-6 text-gray-500" />}
          {audio && (
            <button onClick={(e) => { e.stopPropagation(); onPlay(item); }}
              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
              {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
            </button>
          )}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{item.title}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', typeBadgeColor(item.type))}>{item.type}</span>
          </div>
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span>{item.creator.name}</span>
            {item.creator.verified && <Check className="w-3 h-3 text-neon-cyan" />}
            {item.genre && <><span className="text-gray-600">|</span><span>{item.genre}</span></>}
            {item.bpm && <><span className="text-gray-600">|</span><span>{item.bpm} BPM</span></>}
          </div>
        </div>
        <div className="flex items-center gap-1">{starRating(item.rating)}<span className="text-xs text-gray-500 ml-1">{item.rating}</span></div>
        <span className="text-neon-green font-bold">{formatPrice(item.prices.basic)}</span>
        <button onClick={(e) => { e.stopPropagation(); onAddToCart(item); }} className="btn-neon small flex items-center gap-1">
          <ShoppingCart className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div layout className="panel p-0 overflow-hidden hover:border-neon-purple/40 transition-colors cursor-pointer group">
      {/* Thumbnail */}
      <div className="relative h-36 bg-lattice-deep flex items-center justify-center">
        {audio ? (
          <div className="px-4 w-full"><WaveformBars playing={isPlaying} /></div>
        ) : (
          <Icon className="w-12 h-12 text-gray-600" />
        )}
        {audio && (
          <button onClick={(e) => { e.stopPropagation(); onPlay(item); }}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            {isPlaying ? <Pause className="w-8 h-8 text-white" /> : <Play className="w-8 h-8 text-white" />}
          </button>
        )}
        <span className={cn('absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-medium', typeBadgeColor(item.type))}>{item.type}</span>
        {item.featured && (
          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-neon-green/20 text-neon-green font-medium">Featured</span>
        )}
      </div>
      {/* Body */}
      <div className="p-3 space-y-2">
        <p className="font-semibold text-sm truncate">{item.title}</p>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <div className="w-4 h-4 rounded-full bg-lattice-elevated flex items-center justify-center text-[9px] font-bold">
            {item.creator.name[0]}
          </div>
          <span className="truncate">{item.creator.name}</span>
          {item.creator.verified && <Check className="w-3 h-3 text-neon-cyan shrink-0" />}
        </div>
        <div className="flex items-center gap-1">
          {starRating(item.rating)}
          <span className="text-[10px] text-gray-500 ml-1">({item.ratingCount})</span>
        </div>
        {(item.bpm || item.key || item.genre) && (
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            {item.genre && <span>{item.genre}</span>}
            {item.bpm && <span>{item.bpm} BPM</span>}
            {item.key && <span>{item.key}</span>}
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-lattice-border">
          <span className="text-neon-green font-bold text-sm">From {formatPrice(item.prices.basic)}</span>
          <button onClick={(e) => { e.stopPropagation(); onAddToCart(item); }}
            className="p-1.5 rounded-lg bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30 transition-colors">
            <ShoppingCart className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AudioPreviewBar({
  item, playing, onToggle, onClose,
}: {
  item: MarketplaceItem | null; playing: boolean; onToggle: () => void; onClose: () => void;
}) {
  if (!item) return null;
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-lattice-deep/95 backdrop-blur-lg border-t border-lattice-border px-6 py-3"
    >
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        <button onClick={onToggle} className="p-2 rounded-full bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30 transition-colors">
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold truncate">{item.title}</span>
            <span className="text-xs text-gray-500">by {item.creator.name}</span>
          </div>
          <WaveformBars playing={playing} small />
        </div>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function MarketplaceLensPage() {
  useLensNav('marketplace');
  const _queryClient = useQueryClient();

  // State
  const [tab, setTab] = useState<Tab>('browse');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [genreFilter, setGenreFilter] = useState('All Genres');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [previewItem, setPreviewItem] = useState<MarketplaceItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [showNewListing, setShowNewListing] = useState(false);

  const { isError: isError, error: error, refetch: refetch, items: _listingItems, create: _createListing } = useLensData('marketplace', 'listing', {
    noSeed: true,
  });
  const { isError: isError2, error: error2, refetch: refetch2, items: _purchaseItems } = useLensData('marketplace', 'purchase', {
    noSeed: true,
  });
  const isError3 = false as boolean; const error3 = null as Error | null; const refetch3 = () => {};
  const isError4 = false as boolean; const error4 = null as Error | null; const refetch4 = () => {};

  // Real API queries — no demo fallback
  const { data: beatsData } = useQuery({
    queryKey: ['artistry-beats'],
    queryFn: () => api.get('/api/artistry/marketplace/beats').then(r => r.data).catch(() => ({ beats: [] })),
  });

  const { data: stemsData, isError: isError5, error: error5, refetch: refetch5,} = useQuery({
    queryKey: ['artistry-stems'],
    queryFn: () => api.get('/api/artistry/marketplace/stems').then(r => r.data).catch(() => ({ stems: [] })),
  });

  const { data: samplesData, isError: isError6, error: error6, refetch: refetch6,} = useQuery({
    queryKey: ['artistry-samples'],
    queryFn: () => api.get('/api/artistry/marketplace/samples').then(r => r.data).catch(() => ({ samples: [] })),
  });

  const { data: artData, isError: isError7, error: error7, refetch: refetch7,} = useQuery({
    queryKey: ['artistry-art'],
    queryFn: () => api.get('/api/artistry/marketplace/art').then(r => r.data).catch(() => ({ artworks: [] })),
  });

  // Purchases from API
  const { data: _purchaseData } = useQuery({
    queryKey: ['artistry-purchases'],
    queryFn: () => api.get('/api/artistry/marketplace/licenses').then(r => r.data).catch(() => ({ licenseTypes: {} })),
  });

  // Merge real API data — no demo fallback
  const allItems = useMemo(() => {
    return [
      ...normalizeBeats(beatsData?.beats ?? []),
      ...normalizeStems(stemsData?.stems ?? []),
      ...normalizeSamples(samplesData?.samples ?? []),
      ...normalizeArt(artData?.artworks ?? []),
    ];
  }, [beatsData, stemsData, samplesData, artData]);

  const featuredItems = useMemo(() => allItems.filter(i => i.featured), [allItems]);

  // Filtered / sorted items
  const filteredItems = useMemo(() => {
    let items = [...allItems];
    if (category !== 'all') {
      const typeMap: Record<string, string> = { beats: 'beat', stems: 'stem', samples: 'sample', artwork: 'artwork', plugins: 'plugin', presets: 'preset' };
      items = items.filter(i => i.type === typeMap[category]);
    }
    if (genreFilter !== 'All Genres') items = items.filter(i => i.genre === genreFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.tags.some(t => t.includes(q)));
    }
    switch (sortBy) {
      case 'popular': items.sort((a, b) => b.sales - a.sales); break;
      case 'price-asc': items.sort((a, b) => a.prices.basic - b.prices.basic); break;
      case 'price-desc': items.sort((a, b) => b.prices.basic - a.prices.basic); break;
      case 'newest': items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'rating': items.sort((a, b) => b.rating - a.rating); break;
    }
    return items;
  }, [allItems, category, genreFilter, search, sortBy]);

  // Cart helpers
  const addToCart = useCallback((item: MarketplaceItem) => {
    setCart(prev => {
      if (prev.some(c => c.item.id === item.id)) return prev;
      return [...prev, { item, license: 'basic', price: item.prices.basic }];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(c => c.item.id !== id));
  }, []);

  const updateCartLicense = useCallback((id: string, license: string) => {
    setCart(prev => prev.map(c => {
      if (c.item.id !== id) return c;
      return { ...c, license, price: c.item.prices[license as keyof LicensePrice] };
    }));
  }, []);

  const cartTotal = useMemo(() => cart.reduce((s, c) => s + c.price, 0), [cart]);

  // Audio preview
  const handlePlay = useCallback((item: MarketplaceItem) => {
    if (previewItem?.id === item.id) { setIsPlaying(p => !p); return; }
    setPreviewItem(item);
    setIsPlaying(true);
  }, [previewItem]);

  const closePreview = useCallback(() => { setPreviewItem(null); setIsPlaying(false); }, []);

  // Checkout
  const handleCheckout = useCallback(() => {
    const newPurchases: Purchase[] = cart.map((c, i) => ({
      id: `p-${Date.now()}-${i}`, item: c.item, license: c.license, price: c.price, purchasedAt: new Date().toISOString(),
    }));
    setPurchases(prev => [...newPurchases, ...prev]);
    setCart([]);
    setTab('purchases');
  }, [cart]);

  // Featured carousel auto-advance
  useEffect(() => {
    if (featuredItems.length <= 1) return;
    const t = setInterval(() => setFeaturedIdx(i => (i + 1) % featuredItems.length), 5000);
    return () => clearInterval(t);
  }, [featuredItems.length]);

  // Shop stats (mock)
  const shopStats = { totalSales: 47, revenue: 3842, itemsListed: 6, avgRating: 4.7 };

  // ----- Render helpers -----

  const TABS: { id: Tab; label: string; icon: typeof Store }[] = [
    { id: 'browse', label: 'Browse', icon: Store },
    { id: 'myshop', label: 'My Shop', icon: LayoutDashboard },
    { id: 'cart', label: 'Cart', icon: ShoppingCart },
    { id: 'purchases', label: 'Purchases', icon: Download },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  ];

  // =========================================================================
  // RENDER
  // =========================================================================


  if (isError || isError2 || isError3 || isError4 || isError5 || isError6 || isError7) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message || error4?.message || error5?.message || error6?.message || error7?.message} onRetry={() => { refetch(); refetch2(); refetch3(); refetch4(); refetch5(); refetch6(); refetch7(); }} />
      </div>
    );
  }
  return (
    <div className="space-y-6 pb-24">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="w-6 h-6 text-neon-purple" />
          <h1 className="text-2xl font-bold">Creative Marketplace</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setTab('myshop')} className="btn-neon flex items-center gap-2 text-sm">
            <LayoutDashboard className="w-4 h-4" /> Seller Dashboard
          </button>
          <button onClick={() => setTab('cart')} className="relative p-2 rounded-lg bg-lattice-surface border border-lattice-border hover:border-neon-purple/50 transition-colors">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neon-pink text-white text-[10px] font-bold flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ---- Tab Navigation ---- */}
      <div className="flex items-center gap-1 bg-lattice-surface/50 p-1 rounded-lg w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors',
              tab === t.id ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.id === 'cart' && cart.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-neon-pink/20 text-neon-pink text-[10px] font-bold">{cart.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ================================================================== */}
      {/* BROWSE TAB                                                         */}
      {/* ================================================================== */}
      {tab === 'browse' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Hero / Featured Carousel */}
          {featuredItems.length > 0 && (
            <div className="relative panel p-0 overflow-hidden rounded-xl">
              <AnimatePresence mode="wait">
                <motion.div key={featuredIdx} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.35 }}
                  className="p-6 bg-gradient-to-br from-neon-purple/10 via-transparent to-neon-cyan/5 flex items-center gap-6">
                  <div className="w-32 h-32 rounded-xl bg-lattice-deep flex items-center justify-center shrink-0">
                    {isAudioType(featuredItems[featuredIdx].type) ? <WaveformBars /> : (() => { const I = typeIcon(featuredItems[featuredIdx].type); return <I className="w-12 h-12 text-gray-500" />; })()}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', typeBadgeColor(featuredItems[featuredIdx].type))}>
                      {featuredItems[featuredIdx].type} -- Featured
                    </span>
                    <h2 className="text-xl font-bold truncate">{featuredItems[featuredIdx].title}</h2>
                    <p className="text-sm text-gray-400 line-clamp-2">{featuredItems[featuredIdx].description}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-neon-green font-bold">From {formatPrice(featuredItems[featuredIdx].prices.basic)}</span>
                      <div className="flex items-center gap-1">{starRating(featuredItems[featuredIdx].rating)}</div>
                      <span className="text-xs text-gray-500">{featuredItems[featuredIdx].sales} sales</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {isAudioType(featuredItems[featuredIdx].type) && (
                        <button onClick={() => handlePlay(featuredItems[featuredIdx])} className="btn-neon purple flex items-center gap-1 text-sm">
                          <Play className="w-4 h-4" /> Preview
                        </button>
                      )}
                      <button onClick={() => addToCart(featuredItems[featuredIdx])} className="btn-neon flex items-center gap-1 text-sm">
                        <ShoppingCart className="w-4 h-4" /> Add to Cart
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
              {featuredItems.length > 1 && (
                <>
                  <button onClick={() => setFeaturedIdx(i => (i - 1 + featuredItems.length) % featuredItems.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setFeaturedIdx(i => (i + 1) % featuredItems.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    {featuredItems.map((_, i) => (
                      <button key={i} onClick={() => setFeaturedIdx(i)}
                        className={cn('w-2 h-2 rounded-full transition-colors', i === featuredIdx ? 'bg-neon-purple' : 'bg-gray-600')} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Category Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setCategory(c.id)}
                className={cn('px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors border',
                  category === c.id ? 'bg-neon-purple/20 border-neon-purple/50 text-neon-purple' : 'bg-lattice-surface border-lattice-border text-gray-400 hover:text-white hover:border-gray-500')}>
                <c.icon className="w-3.5 h-3.5" /> {c.name}
              </button>
            ))}
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search beats, samples, artwork..."
                className="w-full pl-10 pr-4 py-2 bg-lattice-surface border border-lattice-border rounded-lg focus:border-neon-purple outline-none text-sm" />
            </div>
            <select value={genreFilter} onChange={e => setGenreFilter(e.target.value)}
              className="px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm">
              {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm">
              {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <div className="flex items-center bg-lattice-surface border border-lattice-border rounded-lg">
              <button onClick={() => setViewMode('grid')}
                className={cn('p-2 rounded-l-lg transition-colors', viewMode === 'grid' ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-500 hover:text-white')}>
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')}
                className={cn('p-2 rounded-r-lg transition-colors', viewMode === 'list' ? 'bg-neon-purple/20 text-neon-purple' : 'text-gray-500 hover:text-white')}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Results count */}
          <p className="text-xs text-gray-500">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found</p>

          {/* Item Grid / List */}
          <div className={cn(viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2')}>
            <AnimatePresence>
              {filteredItems.map(item => (
                <ItemCard key={item.id} item={item} viewMode={viewMode}
                  isPlaying={previewItem?.id === item.id && isPlaying}
                  onPlay={handlePlay} onAddToCart={addToCart} />
              ))}
            </AnimatePresence>
          </div>
          {filteredItems.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No items match your filters.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ================================================================== */}
      {/* MY SHOP TAB                                                        */}
      {/* ================================================================== */}
      {tab === 'myshop' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Sales', value: shopStats.totalSales, icon: TrendingUp, color: 'text-neon-green' },
              { label: 'Revenue', value: `$${shopStats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-neon-cyan' },
              { label: 'Items Listed', value: shopStats.itemsListed, icon: Package, color: 'text-neon-purple' },
              { label: 'Avg Rating', value: shopStats.avgRating, icon: Star, color: 'text-yellow-400' },
            ].map(s => (
              <div key={s.label} className="lens-card p-4 space-y-1">
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <s.icon className={cn('w-4 h-4', s.color)} /> {s.label}
                </div>
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Listings</h2>
            <button onClick={() => setShowNewListing(true)} className="btn-neon purple flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> New Listing
            </button>
          </div>

          {/* Existing listings from API */}
          <div className="space-y-2">
            {allItems.slice(0, 3).map(item => (
              <div key={item.id} className="panel p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-lattice-deep flex items-center justify-center">
                  {(() => { const I = typeIcon(item.type); return <I className="w-5 h-5 text-gray-500" />; })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.type} -- {item.sales} sales -- ${item.prices.basic}+</p>
                </div>
                <div className="flex items-center gap-1">{starRating(item.rating)}</div>
                <span className="text-neon-green text-sm font-bold">${(item.sales * item.prices.basic * 0.7).toFixed(0)}</span>
                <button className="p-1.5 text-gray-400 hover:text-white transition-colors"><Eye className="w-4 h-4" /></button>
              </div>
            ))}
          </div>

          {/* New Listing Modal */}
          <AnimatePresence>
            {showNewListing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={() => setShowNewListing(false)}>
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-lattice-bg border border-lattice-border rounded-xl w-full max-w-lg p-6 space-y-4"
                  onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">Create New Listing</h3>
                    <button onClick={() => setShowNewListing(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-3">
                    <input placeholder="Title" className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm focus:border-neon-purple outline-none" />
                    <select className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm">
                      <option>Beat</option><option>Stem</option><option>Sample Pack</option><option>Artwork</option><option>Plugin</option><option>Preset</option>
                    </select>
                    <textarea placeholder="Description" rows={3}
                      className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm focus:border-neon-purple outline-none resize-none" />
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Genre" className="px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm focus:border-neon-purple outline-none" />
                      <input placeholder="Tags (comma separated)" className="px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm focus:border-neon-purple outline-none" />
                    </div>
                    <p className="text-xs text-gray-400 font-medium">Pricing per License Tier</p>
                    <div className="grid grid-cols-4 gap-2">
                      {LICENSE_TIERS.map(t => (
                        <div key={t.id} className="space-y-1">
                          <label className={cn('text-[10px] font-medium', t.color)}>{t.name}</label>
                          <input type="number" placeholder="$" className="w-full px-2 py-1.5 bg-lattice-surface border border-lattice-border rounded-lg text-sm focus:border-neon-purple outline-none" />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 p-4 border-2 border-dashed border-lattice-border rounded-lg justify-center text-gray-500 text-sm cursor-pointer hover:border-neon-purple/50 transition-colors">
                      <Upload className="w-5 h-5" /> Upload files
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button onClick={() => setShowNewListing(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                    <button onClick={() => setShowNewListing(false)} className="btn-neon purple text-sm">Publish Listing</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ================================================================== */}
      {/* CART TAB                                                           */}
      {/* ================================================================== */}
      {tab === 'cart' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Your cart is empty</p>
              <p className="text-sm mt-1">Browse the marketplace to find creative assets.</p>
              <button onClick={() => setTab('browse')} className="btn-neon purple mt-4 text-sm">Browse Marketplace</button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {cart.map(ci => {
                  const Icon = typeIcon(ci.item.type);
                  return (
                    <div key={ci.item.id} className="panel p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-lattice-deep flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{ci.item.title}</p>
                        <p className="text-xs text-gray-500">{ci.item.creator.name} -- {ci.item.type}</p>
                      </div>
                      <select value={ci.license} onChange={e => updateCartLicense(ci.item.id, e.target.value)}
                        className="px-2 py-1.5 bg-lattice-surface border border-lattice-border rounded-lg text-sm">
                        {LICENSE_TIERS.map(t => (
                          <option key={t.id} value={t.id}>{t.name} - {formatPrice(ci.item.prices[t.id as keyof LicensePrice])}</option>
                        ))}
                      </select>
                      <span className="text-neon-green font-bold w-16 text-right">{formatPrice(ci.price)}</span>
                      <button onClick={() => removeFromCart(ci.item.id)} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Price breakdown */}
              <div className="panel p-5 space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>Subtotal ({cart.length} item{cart.length !== 1 ? 's' : ''})</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>Platform fee</span>
                  <span>$0</span>
                </div>
                <div className="border-t border-lattice-border pt-3 flex items-center justify-between">
                  <span className="font-bold">Total</span>
                  <span className="text-neon-green text-xl font-bold">{formatPrice(cartTotal)}</span>
                </div>
                <button onClick={handleCheckout} className="btn-neon purple w-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" /> Checkout
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* ================================================================== */}
      {/* PURCHASES TAB                                                      */}
      {/* ================================================================== */}
      {tab === 'purchases' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {purchases.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Download className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No purchases yet</p>
            </div>
          ) : (
            purchases.map(p => {
              const tier = LICENSE_TIERS.find(t => t.id === p.license);
              const Icon = typeIcon(p.item.type);
              return (
                <div key={p.id} className="panel p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-lattice-deep flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.item.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{p.item.creator.name}</span>
                      <span className="text-gray-600">|</span>
                      <span className={tier?.color}>{tier?.name} License</span>
                      <span className="text-gray-600">|</span>
                      <span>{new Date(p.purchasedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span className="text-sm text-gray-400">{formatPrice(p.price)}</span>
                  <button className="btn-neon small flex items-center gap-1 text-sm">
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                </div>
              );
            })
          )}
        </motion.div>
      )}

      {/* ================================================================== */}
      {/* ANALYTICS TAB                                                      */}
      {/* ================================================================== */}
      {tab === 'analytics' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Revenue chart (mock bars) */}
          <div className="panel p-5 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><BarChart2 className="w-4 h-4 text-neon-cyan" /> Revenue Over Time</h3>
            <div className="flex items-end gap-2 h-40">
              {['Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((month, i) => {
                const heights = [35, 52, 68, 85, 60];
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <motion.div initial={{ height: 0 }} animate={{ height: `${heights[i]}%` }} transition={{ delay: i * 0.1, duration: 0.5 }}
                      className="w-full rounded-t-md bg-gradient-to-t from-neon-purple to-neon-cyan/50" />
                    <span className="text-[10px] text-gray-500">{month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Sellers */}
          <div className="panel p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-neon-green" /> Top Selling Items</h3>
            {[...allItems].sort((a, b) => b.sales - a.sales).slice(0, 5).map((item, i) => (
              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-lattice-border last:border-0">
                <span className="text-xs text-gray-600 w-5 text-right font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.type} by {item.creator.name}</p>
                </div>
                <span className="text-xs text-gray-400">{item.sales} sales</span>
                <span className="text-sm text-neon-green font-bold">${(item.sales * item.prices.basic * 0.7).toFixed(0)}</span>
              </div>
            ))}
          </div>

          {/* Quick stats — computed from real data */}
          <div className="grid grid-cols-3 gap-4">
            {(() => {
              const myListings = allItems.slice(0, 3);
              const totalRevenue = myListings.reduce((sum, i) => sum + (i.sales * i.prices.basic * 0.7), 0);
              const totalSales = myListings.reduce((sum, i) => sum + i.sales, 0);
              const avgOrder = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;
              return [
                { label: 'Total Revenue', value: totalRevenue > 0 ? `$${Math.round(totalRevenue).toLocaleString()}` : '$0', sub: `From ${totalSales} sales`, color: 'text-neon-green' },
                { label: 'Total Sales', value: String(totalSales), sub: `Across ${myListings.length} listings`, color: 'text-neon-cyan' },
                { label: 'Avg Order Value', value: avgOrder > 0 ? `$${avgOrder}` : '$0', sub: 'Across all licenses', color: 'text-neon-purple' },
              ];
            })().map(s => (
              <div key={s.label} className="lens-card p-4 space-y-1">
                <p className="text-xs text-gray-400">{s.label}</p>
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.sub}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ================================================================== */}
      {/* AUDIO PREVIEW BAR                                                  */}
      {/* ================================================================== */}
      <AnimatePresence>
        {previewItem && (
          <AudioPreviewBar item={previewItem} playing={isPlaying}
            onToggle={() => setIsPlaying(p => !p)} onClose={closePreview} />
        )}
      </AnimatePresence>
    </div>
  );
}
