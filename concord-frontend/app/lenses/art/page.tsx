'use client';

import { useState, useRef, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette,
  Image as ImageIcon,
  Upload,
  Plus,
  Grid,
  Layers,
  Wand2,
  Download,
  Heart,
  Share2,
  Filter,
  Search,
  Eye,
  ShoppingBag,
  DollarSign,
  X,
  Brush,
  Droplets,
  Pen,
  Square,
  Circle,
  Type,
  Eraser,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Move,
  Pipette,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';

type ViewMode = 'gallery' | 'canvas' | 'marketplace' | 'my-art';
type CanvasTool = 'brush' | 'eraser' | 'fill' | 'text' | 'shape-rect' | 'shape-circle' | 'eyedropper' | 'move' | 'pen';

interface ArtAsset {
  id: string;
  title: string;
  description: string;
  type: string;
  tags: string[];
  ownerId: string;
  likes: number;
  plays: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

interface ArtListing {
  id: string;
  title: string;
  artType: string;
  style: string;
  price: number;
  tags: string[];
  totalSales: number;
  ownerId: string;
  createdAt: number;
}

const ART_STYLES = ['Digital Painting', 'Pixel Art', 'Vector', 'Photo Manipulation', '3D Render', 'Abstract', 'Collage', 'Generative', 'Album Cover', 'Typography'];
const ART_TYPES = ['cover-art', 'banner', 'logo', 'illustration', 'background', 'character', 'concept-art', 'poster', 'social-media', 'nft'];

const COLOR_PALETTE = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#82E0AA', '#F8C471', '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6',
];

export default function ArtLensPage() {
  useLensNav('art');
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateListing, setShowCreateListing] = useState(false);

  // Canvas state
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('brush');
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#FFFFFF');
  const [canvasZoom, setCanvasZoom] = useState(100);
  const [canvasTitle, setCanvasTitle] = useState('Untitled Artwork');

  // Upload form
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadStyle, setUploadStyle] = useState('Digital Painting');

  // Listing form
  const [listingTitle, setListingTitle] = useState('');
  const [listingType, setListingType] = useState('cover-art');
  const [listingStyle, _setListingStyle] = useState('digital');
  const [listingPrice, setListingPrice] = useState('50');
  const [listingTags, setListingTags] = useState('');

  const { data: artAssets, isLoading: _assetsLoading, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['art-assets', selectedStyle, searchQuery],
    queryFn: () => api.get('/api/artistry/assets', {
      params: { type: 'artwork', search: searchQuery || undefined }
    }).then(r => r.data?.assets || []).catch(() => []),
    initialData: [],
  });

  const { data: artListings, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['art-marketplace'],
    queryFn: () => api.get('/api/artistry/marketplace/art').then(r => r.data?.artworks || []).catch(() => []),
    initialData: [],
  });

  const uploadMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/api/artistry/assets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['art-assets'] });
      setShowUpload(false);
      setUploadTitle('');
      setUploadDescription('');
      setUploadTags('');
    },
  });

  const createListingMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/api/artistry/marketplace/art', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['art-marketplace'] });
      setShowCreateListing(false);
    },
  });

  const handleUpload = useCallback(() => {
    uploadMutation.mutate({
      type: 'artwork',
      title: uploadTitle || 'Untitled',
      description: uploadDescription,
      tags: uploadTags.split(',').map(t => t.trim()).filter(Boolean),
      metadata: { style: uploadStyle },
    });
  }, [uploadTitle, uploadDescription, uploadTags, uploadStyle, uploadMutation]);

  const handleCreateListing = useCallback(() => {
    createListingMutation.mutate({
      title: listingTitle,
      artType: listingType,
      style: listingStyle,
      price: Number(listingPrice),
      tags: listingTags.split(',').map(t => t.trim()).filter(Boolean),
    });
  }, [listingTitle, listingType, listingStyle, listingPrice, listingTags, createListingMutation]);

  const renderNav = () => (
    <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
      <div className="flex items-center gap-2">
        <Palette className="w-6 h-6 text-neon-pink" />
        <h1 className="text-xl font-bold">Art Studio</h1>
      </div>
      <div className="flex items-center gap-2">
        {(['gallery', 'canvas', 'marketplace', 'my-art'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
              viewMode === mode ? 'bg-neon-pink/20 text-neon-pink' : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            {mode === 'my-art' ? 'My Art' : mode}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2 bg-neon-pink/20 text-neon-pink rounded-lg hover:bg-neon-pink/30 text-sm">
          <Upload className="w-4 h-4" />
          Upload
        </button>
        <button onClick={() => setViewMode('canvas')} className="flex items-center gap-2 px-4 py-2 bg-neon-purple/20 text-neon-purple rounded-lg hover:bg-neon-purple/30 text-sm">
          <Brush className="w-4 h-4" />
          Create
        </button>
      </div>
    </div>
  );

  const renderGallery = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search artwork..."
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-neon-pink/50"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setSelectedStyle(null)}
            className={cn('px-3 py-1.5 rounded-full text-xs whitespace-nowrap', !selectedStyle ? 'bg-neon-pink/20 text-neon-pink' : 'bg-white/5 text-gray-400 hover:text-white')}
          >
            All
          </button>
          {ART_STYLES.slice(0, 6).map(style => (
            <button
              key={style}
              onClick={() => setSelectedStyle(selectedStyle === style ? null : style)}
              className={cn('px-3 py-1.5 rounded-full text-xs whitespace-nowrap', selectedStyle === style ? 'bg-neon-pink/20 text-neon-pink' : 'bg-white/5 text-gray-400 hover:text-white')}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Featured Section */}
      <section>
        <h2 className="text-lg font-bold mb-4">Featured Artwork</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(artAssets as ArtAsset[]).length > 0 ? (artAssets as ArtAsset[]).map((art: ArtAsset) => (
            <motion.div
              key={art.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-neon-pink/30 transition-colors cursor-pointer"
            >
              <div className="aspect-square bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center">
                <ImageIcon className="w-16 h-16 opacity-30" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="font-medium text-sm truncate">{art.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-300">
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{art.likes}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{art.plays}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )) : (
            // Placeholder cards
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden bg-white/5 border border-white/10">
                <div className="aspect-square flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${i * 45}, 60%, 25%), hsl(${i * 45 + 60}, 60%, 20%))` }}>
                  <ImageIcon className="w-12 h-12 opacity-20" />
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm text-gray-300">{['Neon Dreams', 'Digital Horizons', 'Abstract Flow', 'Cosmic Pulse', 'Neural Art', 'Pixel Paradise', 'Wave Form', 'Fractal Mind'][i]}</p>
                  <p className="text-xs text-gray-500 mt-1">{ART_STYLES[i % ART_STYLES.length]}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Trending */}
      <section>
        <h2 className="text-lg font-bold mb-4">Trending Styles</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {ART_STYLES.map((style, i) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(style)}
              className="p-4 rounded-xl text-left text-sm font-bold overflow-hidden relative hover:scale-[1.02] transition-transform"
              style={{ background: `linear-gradient(135deg, hsl(${i * 36}, 70%, 35%), hsl(${i * 36 + 40}, 60%, 25%))` }}
            >
              <Palette className="absolute top-2 right-2 w-8 h-8 opacity-20" />
              {style}
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  const renderCanvas = () => {
    const tools: { id: CanvasTool; icon: React.ElementType; label: string }[] = [
      { id: 'brush', icon: Brush, label: 'Brush' },
      { id: 'pen', icon: Pen, label: 'Pen' },
      { id: 'eraser', icon: Eraser, label: 'Eraser' },
      { id: 'fill', icon: Droplets, label: 'Fill' },
      { id: 'text', icon: Type, label: 'Text' },
      { id: 'shape-rect', icon: Square, label: 'Rectangle' },
      { id: 'shape-circle', icon: Circle, label: 'Circle' },
      { id: 'eyedropper', icon: Pipette, label: 'Eyedropper' },
      { id: 'move', icon: Move, label: 'Move' },
    ];

    return (
      <div className="flex h-full">
        {/* Toolbar */}
        <aside className="w-16 bg-black/40 border-r border-white/10 flex flex-col items-center py-4 gap-2">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => setCanvasTool(tool.id)}
              title={tool.label}
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                canvasTool === tool.id ? 'bg-neon-pink/20 text-neon-pink' : 'text-gray-400 hover:text-white hover:bg-white/10'
              )}
            >
              <tool.icon className="w-5 h-5" />
            </button>
          ))}
          <div className="flex-1" />
          <button title="Undo" className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10">
            <Undo2 className="w-5 h-5" />
          </button>
          <button title="Redo" className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10">
            <Redo2 className="w-5 h-5" />
          </button>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/20">
            <input
              type="text"
              value={canvasTitle}
              onChange={e => setCanvasTitle(e.target.value)}
              className="bg-transparent text-sm font-medium focus:outline-none"
            />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button onClick={() => setCanvasZoom(Math.max(25, canvasZoom - 25))} className="p-1 text-gray-400 hover:text-white"><ZoomOut className="w-4 h-4" /></button>
                <span className="text-xs text-gray-400 w-10 text-center">{canvasZoom}%</span>
                <button onClick={() => setCanvasZoom(Math.min(400, canvasZoom + 25))} className="p-1 text-gray-400 hover:text-white"><ZoomIn className="w-4 h-4" /></button>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-neon-pink/20 text-neon-pink rounded text-xs hover:bg-neon-pink/30">
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-gray-300 rounded text-xs hover:bg-white/20">
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center bg-[#1a1a2e] overflow-auto p-8">
            <canvas
              ref={canvasRef}
              width={1024}
              height={768}
              className="bg-white/10 border border-white/20 rounded shadow-2xl cursor-crosshair"
              style={{ width: `${1024 * canvasZoom / 100}px`, height: `${768 * canvasZoom / 100}px` }}
            />
          </div>
        </main>

        {/* Properties Panel */}
        <aside className="w-64 bg-black/40 border-l border-white/10 p-4 space-y-6 overflow-y-auto">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Brush Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Size: {brushSize}px</label>
                <input type="range" min="1" max="100" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-full accent-neon-pink" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Opacity</label>
                <input type="range" min="0" max="100" defaultValue={100} className="w-full accent-neon-pink" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Color</h3>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-lg border border-white/20" style={{ backgroundColor: brushColor }} />
              <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)} className="w-8 h-8 cursor-pointer" />
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {COLOR_PALETTE.map(color => (
                <button
                  key={color}
                  onClick={() => setBrushColor(color)}
                  className={cn('w-7 h-7 rounded-md border transition-transform hover:scale-110', brushColor === color ? 'border-white scale-110' : 'border-white/10')}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Layers</h3>
            <div className="space-y-1">
              {['Background', 'Layer 1', 'Layer 2'].map((layer, i) => (
                <div key={i} className={cn('flex items-center gap-2 px-2 py-1.5 rounded text-sm', i === 1 ? 'bg-white/10' : 'hover:bg-white/5')}>
                  <Layers className="w-3.5 h-3.5 text-gray-400" />
                  <span className="flex-1 text-gray-300">{layer}</span>
                  <Eye className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-white" />
                </div>
              ))}
              <button className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-400 hover:text-white w-full">
                <Plus className="w-3.5 h-3.5" />
                Add Layer
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">AI Assist</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-neon-purple/10 text-neon-purple rounded-lg text-xs hover:bg-neon-purple/20">
                <Wand2 className="w-4 h-4" />
                Generate from Text
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 text-gray-300 rounded-lg text-xs hover:bg-white/10">
                <Palette className="w-4 h-4" />
                Style Transfer
              </button>
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-white/5 text-gray-300 rounded-lg text-xs hover:bg-white/10">
                <Filter className="w-4 h-4" />
                Auto-Enhance
              </button>
            </div>
          </div>
        </aside>
      </div>
    );
  };

  const renderMarketplace = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Art Marketplace</h2>
        <button onClick={() => setShowCreateListing(true)} className="flex items-center gap-2 px-4 py-2 bg-neon-pink/20 text-neon-pink rounded-lg text-sm">
          <ShoppingBag className="w-4 h-4" />
          List Artwork
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {ART_TYPES.map(type => (
          <button key={type} className="px-3 py-1.5 rounded-full bg-white/5 text-xs text-gray-400 hover:text-white whitespace-nowrap capitalize">
            {type.replace('-', ' ')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(artListings as ArtListing[]).length > 0 ? (artListings as ArtListing[]).map((listing: ArtListing) => (
          <div key={listing.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden hover:border-neon-pink/30 transition-colors">
            <div className="aspect-[4/3] bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center">
              <ImageIcon className="w-12 h-12 opacity-20" />
            </div>
            <div className="p-4">
              <h3 className="font-medium">{listing.title}</h3>
              <p className="text-xs text-gray-400 mt-1 capitalize">{listing.artType} - {listing.style}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-neon-green font-bold">${listing.price}</span>
                <span className="text-xs text-gray-400">{listing.totalSales} sold</span>
              </div>
              <button className="w-full mt-3 px-4 py-2 bg-neon-pink/20 text-neon-pink rounded-lg text-sm hover:bg-neon-pink/30">
                Purchase
              </button>
            </div>
          </div>
        )) : (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="aspect-[4/3] flex items-center justify-center" style={{ background: `linear-gradient(135deg, hsl(${i * 60}, 50%, 20%), hsl(${i * 60 + 30}, 50%, 15%))` }}>
                <ImageIcon className="w-10 h-10 opacity-20" />
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-300">{['Album Cover Pack', 'Neon Logo Kit', 'Abstract Backgrounds', 'Character Set', 'Social Media Kit', 'Poster Templates'][i]}</h3>
                <p className="text-xs text-gray-500 mt-1">{ART_TYPES[i]?.replace('-', ' ')}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-neon-green font-bold">${[25, 50, 35, 75, 15, 100][i]}</span>
                  <button className="px-3 py-1.5 bg-white/10 text-gray-300 rounded text-xs hover:bg-white/20">View</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderMyArt = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">My Artwork</h2>
        <div className="flex items-center gap-2">
          <button className="p-2 text-gray-400 hover:text-white"><Grid className="w-5 h-5" /></button>
          <button className="p-2 text-gray-400 hover:text-white"><Layers className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <button
          onClick={() => setViewMode('canvas')}
          className="aspect-square rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 hover:border-neon-pink/50 hover:bg-neon-pink/5 transition-colors"
        >
          <Plus className="w-8 h-8 text-gray-400" />
          <span className="text-xs text-gray-400">New Artwork</span>
        </button>
        {(artAssets as ArtAsset[]).filter((a: ArtAsset) => a.type === 'artwork').map((art: ArtAsset) => (
          <div key={art.id} className="aspect-square rounded-xl bg-white/5 border border-white/10 overflow-hidden group relative cursor-pointer hover:border-neon-pink/30">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center">
              <ImageIcon className="w-10 h-10 opacity-20" />
            </div>
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <span className="text-sm font-medium">{art.title}</span>
              <div className="flex gap-2">
                <button className="p-1.5 bg-white/10 rounded"><Share2 className="w-4 h-4" /></button>
                <button className="p-1.5 bg-white/10 rounded"><Download className="w-4 h-4" /></button>
                <button className="p-1.5 bg-white/10 rounded"><DollarSign className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );


  if (isError || isError2) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message} onRetry={() => { refetch(); refetch2(); }} />
      </div>
    );
  }
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-pink-900/10 to-black">
      {renderNav()}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'gallery' && <div className="h-full overflow-y-auto">{renderGallery()}</div>}
        {viewMode === 'canvas' && renderCanvas()}
        {viewMode === 'marketplace' && <div className="h-full overflow-y-auto">{renderMarketplace()}</div>}
        {viewMode === 'my-art' && <div className="h-full overflow-y-auto">{renderMyArt()}</div>}
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-lattice-surface border border-white/10 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Upload Artwork</h3>
                <button onClick={() => setShowUpload(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Title</label>
                  <input type="text" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-neon-pink/50" placeholder="Artwork title" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Description</label>
                  <textarea value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} rows={3} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-neon-pink/50 resize-none" placeholder="Describe your artwork" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Style</label>
                  <select value={uploadStyle} onChange={e => setUploadStyle(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none">
                    {ART_STYLES.map(s => <option key={s} value={s} className="bg-lattice-surface">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Tags (comma separated)</label>
                  <input type="text" value={uploadTags} onChange={e => setUploadTags(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-neon-pink/50" placeholder="abstract, neon, digital" />
                </div>
                <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-400">Drop files here or click to upload</p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, SVG, WebP up to 50MB</p>
                </div>
                <button onClick={handleUpload} disabled={uploadMutation.isPending} className="w-full py-2.5 bg-neon-pink text-white rounded-lg font-medium hover:bg-neon-pink/80 disabled:opacity-50">
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload Artwork'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Listing Modal */}
      <AnimatePresence>
        {showCreateListing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-lattice-surface border border-white/10 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">List on Marketplace</h3>
                <button onClick={() => setShowCreateListing(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <input type="text" value={listingTitle} onChange={e => setListingTitle(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none" placeholder="Listing title" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={listingType} onChange={e => setListingType(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none">
                    {ART_TYPES.map(t => <option key={t} value={t} className="bg-lattice-surface">{t.replace('-', ' ')}</option>)}
                  </select>
                  <input type="number" value={listingPrice} onChange={e => setListingPrice(e.target.value)} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none" placeholder="Price ($)" />
                </div>
                <input type="text" value={listingTags} onChange={e => setListingTags(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none" placeholder="Tags (comma separated)" />
                <button onClick={handleCreateListing} disabled={createListingMutation.isPending} className="w-full py-2.5 bg-neon-pink text-white rounded-lg font-medium hover:bg-neon-pink/80 disabled:opacity-50">
                  {createListingMutation.isPending ? 'Creating...' : 'Create Listing'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
