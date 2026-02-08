'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  Heart,
  Plus,
  MoreHorizontal,
  Search,
  Mic2,
  Library,
  Home,
  Disc3,
  ListMusic,
  Clock,
  TrendingUp,
  Download,
  Headphones,
  ChevronDown,
  GripVertical,
  X,
  Maximize2,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl?: string;
  resonanceScore: number;
  bpm?: number;
  key?: string;
  genre?: string;
  liked?: boolean;
  playCount?: number;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  trackCount: number;
  duration: number;
  isOwner: boolean;
  followers?: number;
  type: 'playlist' | 'album' | 'podcast' | 'radio';
}

interface Artist {
  id: string;
  name: string;
  imageUrl?: string;
  monthlyListeners?: number;
  genres?: string[];
}

type RepeatMode = 'off' | 'all' | 'one';
type ViewMode = 'home' | 'search' | 'library' | 'playlist' | 'artist' | 'nowPlaying';
type VisualizerMode = 'bars' | 'waveform' | 'circular' | 'spectrum';

const EQ_PRESETS: { [key: string]: number[] } = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0],
  bass: [6, 5, 4, 2, 0, 0, 0, 0],
  treble: [0, 0, 0, 0, 2, 4, 5, 6],
  vocal: [-2, 0, 2, 4, 4, 2, 0, -2],
  electronic: [4, 3, 0, -2, 0, 2, 4, 5],
  rock: [4, 3, 2, 0, -1, 1, 3, 4],
  jazz: [3, 2, 1, 2, -1, 1, 2, 3],
  classical: [4, 3, 2, 1, 0, 1, 2, 4],
};

const FREQUENCIES = ['32Hz', '64Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz'];

const SEED_TRACKS: Track[] = [
  { id: '1', title: 'Neural Resonance', artist: 'Lattice Dreams', album: 'Cognitive Waves', duration: 234, resonanceScore: 0.92, bpm: 128, key: 'Am', genre: 'Electronic', playCount: 1542 },
  { id: '2', title: 'Quantum Harmonics', artist: 'DTU Protocol', album: 'Memory Palace', duration: 312, resonanceScore: 0.87, bpm: 140, key: 'Em', genre: 'Ambient', playCount: 892 },
  { id: '3', title: 'Synaptic Fire', artist: 'Cortex Theory', album: 'Brain Patterns', duration: 198, resonanceScore: 0.95, bpm: 174, key: 'Dm', genre: 'DnB', playCount: 2341 },
  { id: '4', title: 'Deep Memory', artist: 'Lattice Dreams', album: 'Cognitive Waves', duration: 267, resonanceScore: 0.78, bpm: 100, key: 'C', genre: 'Downtempo', playCount: 567 },
  { id: '5', title: 'Concord Protocol', artist: 'System Collective', album: 'First Contact', duration: 445, resonanceScore: 0.99, bpm: 120, key: 'F#m', genre: 'Progressive', playCount: 4521 },
  { id: '6', title: 'Emergence', artist: 'DTU Protocol', album: 'Memory Palace', duration: 356, resonanceScore: 0.88, bpm: 110, key: 'G', genre: 'Ambient', playCount: 1234 },
];

const SEED_PLAYLISTS: Playlist[] = [
  { id: '1', name: 'Focus Flow', description: 'Deep work concentration music', trackCount: 45, duration: 10800, isOwner: true, followers: 234, type: 'playlist' },
  { id: '2', name: 'Neural Beats', description: 'High-energy cognitive enhancement', trackCount: 32, duration: 7200, isOwner: true, followers: 567, type: 'playlist' },
  { id: '3', name: 'Dream State', description: 'Ambient soundscapes for creativity', trackCount: 28, duration: 9000, isOwner: false, followers: 1234, type: 'playlist' },
  { id: '4', name: 'Cognitive Waves', trackCount: 12, duration: 3600, isOwner: false, type: 'album' },
  { id: '5', name: 'Tech Talk Podcast', trackCount: 156, duration: 360000, isOwner: false, type: 'podcast' },
];

const _SEED_ARTISTS: Artist[] = [
  { id: '1', name: 'Lattice Dreams', monthlyListeners: 245000, genres: ['Electronic', 'Ambient'] },
  { id: '2', name: 'DTU Protocol', monthlyListeners: 189000, genres: ['Ambient', 'Experimental'] },
  { id: '3', name: 'Cortex Theory', monthlyListeners: 312000, genres: ['DnB', 'Electronic'] },
  { id: '4', name: 'System Collective', monthlyListeners: 567000, genres: ['Progressive', 'Electronic'] },
];

export default function MusicLensPage() {
  useLensNav('music');
  const _queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(42);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isShuffled, setIsShuffled] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [showQueue, setShowQueue] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  // Audio processing
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('bars');
  const [eqPreset, setEqPreset] = useState('flat');
  const [eqBands, setEqBands] = useState<number[]>(EQ_PRESETS.flat);
  const [crossfade, setCrossfade] = useState(0);

  // Persistent lens data (replaces MOCK arrays)
  const { items: trackItems } = useLensData<Track>('music', 'track', {
    seed: SEED_TRACKS.map(t => ({ title: t.title, data: t as unknown as Record<string, unknown> })),
  });
  const { items: playlistItems } = useLensData<Playlist>('music', 'playlist', {
    seed: SEED_PLAYLISTS.map(p => ({ title: p.name, data: p as unknown as Record<string, unknown> })),
  });
  const allTracks: Track[] = trackItems.length > 0 ? trackItems.map(i => ({ ...(i.data as unknown as Track), id: i.id })) : SEED_TRACKS;
  const playlists: Playlist[] = playlistItems.length > 0 ? playlistItems.map(i => ({ ...(i.data as unknown as Playlist), id: i.id })) : SEED_PLAYLISTS;

  // Queue
  const [queue, setQueue] = useState<Track[]>(SEED_TRACKS);
  const currentTrack = queue[currentTrackIndex] || allTracks[0];

  // Sync queue when tracks load from backend
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (allTracks.length > 0) setQueue(allTracks); }, [allTracks.length]);

  // Visualizer animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isPlaying) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barCount = 64;
    const barWidth = width / barCount - 2;

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#00d4ff');
      gradient.addColorStop(0.5, '#7c3aed');
      gradient.addColorStop(1, '#f472b6');

      for (let i = 0; i < barCount; i++) {
        const value = Math.random() * 0.5 + 0.3 + Math.sin(Date.now() / 200 + i * 0.2) * 0.2;
        const barHeight = value * height * 0.8;

        if (visualizerMode === 'bars') {
          ctx.fillStyle = gradient;
          ctx.fillRect(i * (barWidth + 2), height - barHeight, barWidth, barHeight);
        } else if (visualizerMode === 'waveform') {
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2;
          ctx.beginPath();
          const y = height / 2 + Math.sin(Date.now() / 100 + i * 0.3) * height * 0.3 * value;
          if (i === 0) ctx.moveTo(i * (width / barCount), y);
          else ctx.lineTo(i * (width / barCount), y);
        } else if (visualizerMode === 'circular') {
          const centerX = width / 2;
          const centerY = height / 2;
          const radius = Math.min(width, height) * 0.3;
          const angle = (i / barCount) * Math.PI * 2;
          const innerRadius = radius * 0.5;
          const outerRadius = radius + barHeight * 0.5;

          ctx.strokeStyle = `hsl(${(i / barCount) * 360}, 80%, 60%)`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(
            centerX + Math.cos(angle) * innerRadius,
            centerY + Math.sin(angle) * innerRadius
          );
          ctx.lineTo(
            centerX + Math.cos(angle) * outerRadius,
            centerY + Math.sin(angle) * outerRadius
          );
          ctx.stroke();
        } else if (visualizerMode === 'spectrum') {
          const hue = (i / barCount) * 120;
          ctx.fillStyle = `hsla(${hue}, 80%, 50%, 0.8)`;
          ctx.beginPath();
          ctx.arc(
            i * (width / barCount) + barWidth / 2,
            height - barHeight / 2,
            barHeight / 3,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }

      if (visualizerMode === 'waveform') {
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, visualizerMode]);

  const handleNext = useCallback(() => {
    if (isShuffled) {
      setCurrentTrackIndex(Math.floor(Math.random() * queue.length));
    } else {
      setCurrentTrackIndex((prev) => (prev + 1) % queue.length);
    }
    setCurrentTime(0);
  }, [isShuffled, queue.length]);

  // Progress simulation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= currentTrack.duration) {
          handleNext();
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, handleNext]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours} hr ${mins} min`;
    return `${mins} min`;
  };

  const handlePrev = () => {
    if (currentTime > 3) {
      setCurrentTime(0);
    } else {
      setCurrentTrackIndex((prev) => (prev - 1 + queue.length) % queue.length);
      setCurrentTime(0);
    }
  };

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  };

  const handleEqChange = (index: number, value: number) => {
    const newBands = [...eqBands];
    newBands[index] = value;
    setEqBands(newBands);
    setEqPreset('custom');
  };

  const applyEqPreset = (preset: string) => {
    setEqPreset(preset);
    setEqBands(EQ_PRESETS[preset] || EQ_PRESETS.flat);
  };

  const playTrack = (track: Track) => {
    const index = queue.findIndex((t) => t.id === track.id);
    if (index !== -1) {
      setCurrentTrackIndex(index);
      setCurrentTime(0);
      setIsPlaying(true);
    }
  };

  const _addToQueue = (track: Track) => {
    setQueue([...queue, track]);
  };

  const removeFromQueue = (trackId: string) => {
    setQueue(queue.filter((t) => t.id !== trackId));
  };

  const renderSidebar = () => (
    <aside className="w-64 flex-shrink-0 bg-black/40 flex flex-col">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-6">
          <Music className="w-8 h-8 text-neon-cyan" />
          <span className="text-xl font-bold">Music Lens</span>
        </div>

        <nav className="space-y-1">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'search', icon: Search, label: 'Search' },
            { id: 'library', icon: Library, label: 'Your Library' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setViewMode(item.id as ViewMode)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                viewMode === item.id
                  ? 'bg-neon-cyan/20 text-neon-cyan'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase">Playlists</span>
          <button className="p-1 rounded hover:bg-lattice-elevated text-gray-400">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          {playlists.slice(0, 8).map((playlist: Playlist) => (
            <button
              key={playlist.id}
              onClick={() => {
                setSelectedPlaylist(playlist);
                setViewMode('playlist');
              }}
              className={cn(
                'w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-left',
                selectedPlaylist?.id === playlist.id
                  ? 'bg-lattice-elevated text-white'
                  : 'text-gray-400 hover:text-white hover:bg-lattice-elevated/50'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded flex items-center justify-center',
                playlist.type === 'podcast' ? 'bg-green-600' :
                playlist.type === 'album' ? 'bg-purple-600' :
                'bg-gradient-to-br from-neon-purple to-neon-pink'
              )}>
                {playlist.type === 'podcast' ? (
                  <Mic2 className="w-5 h-5" />
                ) : playlist.type === 'album' ? (
                  <Disc3 className="w-5 h-5" />
                ) : (
                  <ListMusic className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{playlist.name}</p>
                <p className="text-xs text-gray-500 capitalize">{playlist.type}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );

  const renderMainContent = () => {
    if (viewMode === 'home') {
      return (
        <div className="space-y-8">
          {/* Recently Played */}
          <section>
            <h2 className="text-2xl font-bold mb-4">Good evening</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {playlists.slice(0, 6).map((playlist: Playlist) => (
                <button
                  key={playlist.id}
                  onClick={() => {
                    setSelectedPlaylist(playlist);
                    setViewMode('playlist');
                  }}
                  className="flex items-center gap-4 bg-white/5 hover:bg-white/10 rounded-md overflow-hidden transition-colors group"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center">
                    <ListMusic className="w-8 h-8" />
                  </div>
                  <span className="font-semibold">{playlist.name}</span>
                  <div className="ml-auto mr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="w-12 h-12 rounded-full bg-neon-green flex items-center justify-center shadow-lg">
                      <Play className="w-5 h-5 text-black ml-1" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Made for You */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Made for You</h2>
              <button className="text-sm text-gray-400 hover:text-white">Show all</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {['Daily Mix 1', 'Discover Weekly', 'Release Radar', 'Your Top 2024', 'Repeat Rewind'].map((name, i) => (
                <div key={i} className="group cursor-pointer">
                  <div className="relative aspect-square rounded-md overflow-hidden bg-gradient-to-br from-purple-600 to-blue-600 mb-3">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Music className="w-16 h-16 opacity-50" />
                    </div>
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                      <button className="w-12 h-12 rounded-full bg-neon-green flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 text-black ml-1" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-semibold truncate">{name}</h3>
                  <p className="text-sm text-gray-400 truncate">Based on your listening</p>
                </div>
              ))}
            </div>
          </section>

          {/* Popular Artists */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Popular Artists</h2>
              <button className="text-sm text-gray-400 hover:text-white">Show all</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {_SEED_ARTISTS.map((artist) => (
                <div key={artist.id} className="group cursor-pointer text-center">
                  <div className="relative aspect-square rounded-full overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800 mb-3 mx-auto">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Headphones className="w-12 h-12 opacity-50" />
                    </div>
                  </div>
                  <h3 className="font-semibold truncate">{artist.name}</h3>
                  <p className="text-sm text-gray-400">Artist</p>
                </div>
              ))}
            </div>
          </section>

          {/* Trending Now */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-neon-green" />
                Trending Now
              </h2>
            </div>
            <div className="space-y-2">
              {SEED_TRACKS.slice(0, 5).map((track, index) => (
                <button
                  key={track.id}
                  onClick={() => playTrack(track)}
                  className={cn(
                    'w-full flex items-center gap-4 p-2 rounded-lg transition-colors group',
                    currentTrack.id === track.id
                      ? 'bg-white/10'
                      : 'hover:bg-white/5'
                  )}
                >
                  <span className="w-6 text-center text-gray-400 group-hover:hidden">
                    {index + 1}
                  </span>
                  <Play className="w-4 h-4 hidden group-hover:block" />
                  <div className="w-12 h-12 rounded bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center">
                    <Music className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className={cn(
                      'font-medium truncate',
                      currentTrack.id === track.id && 'text-neon-green'
                    )}>
                      {track.title}
                    </p>
                    <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                  </div>
                  <div className="flex items-center gap-4 text-gray-400 text-sm">
                    <span className="hidden md:block">{track.album}</span>
                    <span className="hidden lg:flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {track.playCount?.toLocaleString()}
                    </span>
                    <span>{formatTime(track.duration)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      );
    }

    if (viewMode === 'search') {
      return (
        <div className="space-y-6">
          <div className="sticky top-0 bg-lattice-deep/90 backdrop-blur-xl pb-4 z-10">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="What do you want to listen to?"
                className="w-full pl-12 pr-4 py-3 bg-white rounded-full text-black placeholder-gray-500 focus:outline-none"
              />
            </div>
          </div>

          {searchQuery ? (
            <div className="space-y-6">
              <section>
                <h3 className="text-xl font-bold mb-4">Songs</h3>
                <div className="space-y-2">
                  {SEED_TRACKS.filter((t) =>
                    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.artist.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((track) => (
                    <button
                      key={track.id}
                      onClick={() => playTrack(track)}
                      className="w-full flex items-center gap-4 p-2 rounded-lg hover:bg-white/5"
                    >
                      <div className="w-12 h-12 rounded bg-gradient-to-br from-neon-cyan to-neon-blue flex items-center justify-center">
                        <Music className="w-6 h-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium">{track.title}</p>
                        <p className="text-sm text-gray-400">{track.artist}</p>
                      </div>
                      <span className="text-gray-400">{formatTime(track.duration)}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <div>
              <h3 className="text-xl font-bold mb-4">Browse all</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {['Electronic', 'Ambient', 'Focus', 'Workout', 'Chill', 'Party', 'Sleep', 'Meditation'].map((genre) => (
                  <button
                    key={genre}
                    className="aspect-[1.5] rounded-lg p-4 text-left font-bold text-xl overflow-hidden relative"
                    style={{
                      background: `linear-gradient(135deg, hsl(${Math.random() * 360}, 70%, 40%), hsl(${Math.random() * 360}, 70%, 30%))`,
                    }}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (viewMode === 'library') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Your Library</h2>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 rounded-full bg-white/10 text-sm hover:bg-white/20">Playlists</button>
              <button className="px-3 py-1 rounded-full text-gray-400 text-sm hover:text-white">Podcasts</button>
              <button className="px-3 py-1 rounded-full text-gray-400 text-sm hover:text-white">Artists</button>
              <button className="px-3 py-1 rounded-full text-gray-400 text-sm hover:text-white">Albums</button>
            </div>
          </div>

          <div className="space-y-2">
            {playlists.filter((p: Playlist) => p.isOwner).map((playlist: Playlist) => (
              <button
                key={playlist.id}
                onClick={() => {
                  setSelectedPlaylist(playlist);
                  setViewMode('playlist');
                }}
                className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-white/5"
              >
                <div className="w-16 h-16 rounded bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center">
                  <ListMusic className="w-8 h-8" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold">{playlist.name}</h3>
                  <p className="text-sm text-gray-400">
                    {playlist.type} · {playlist.trackCount} songs · {formatDuration(playlist.duration)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (viewMode === 'playlist' && selectedPlaylist) {
      return (
        <div>
          <div className="flex items-end gap-6 mb-8 bg-gradient-to-b from-purple-900/40 to-transparent p-6 -mx-6 -mt-6">
            <div className="w-48 h-48 rounded-lg bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center shadow-2xl">
              <ListMusic className="w-20 h-20" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold uppercase">{selectedPlaylist.type}</p>
              <h1 className="text-5xl font-bold my-3">{selectedPlaylist.name}</h1>
              {selectedPlaylist.description && (
                <p className="text-gray-400 mb-2">{selectedPlaylist.description}</p>
              )}
              <p className="text-sm text-gray-400">
                {selectedPlaylist.trackCount} songs · {formatDuration(selectedPlaylist.duration)}
                {selectedPlaylist.followers && ` · ${selectedPlaylist.followers.toLocaleString()} followers`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-14 h-14 rounded-full bg-neon-green flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 text-black" />
              ) : (
                <Play className="w-6 h-6 text-black ml-1" />
              )}
            </button>
            <button className="text-gray-400 hover:text-white">
              <Heart className="w-8 h-8" />
            </button>
            <button className="text-gray-400 hover:text-white">
              <Download className="w-6 h-6" />
            </button>
            <button className="text-gray-400 hover:text-white">
              <MoreHorizontal className="w-6 h-6" />
            </button>
          </div>

          <table className="w-full">
            <thead>
              <tr className="text-gray-400 text-sm border-b border-white/10">
                <th className="text-left py-2 w-12">#</th>
                <th className="text-left py-2">Title</th>
                <th className="text-left py-2 hidden md:table-cell">Album</th>
                <th className="text-left py-2 hidden lg:table-cell">Genre</th>
                <th className="text-right py-2 w-20">
                  <Clock className="w-4 h-4 inline-block" />
                </th>
              </tr>
            </thead>
            <tbody>
              {SEED_TRACKS.map((track, index) => (
                <tr
                  key={track.id}
                  onClick={() => playTrack(track)}
                  className={cn(
                    'group cursor-pointer hover:bg-white/5 transition-colors',
                    currentTrack.id === track.id && 'bg-white/10'
                  )}
                >
                  <td className="py-3 text-gray-400 group-hover:hidden">{index + 1}</td>
                  <td className="py-3 hidden group-hover:table-cell">
                    <Play className="w-4 h-4" />
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center">
                        <Music className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={cn(
                          'font-medium',
                          currentTrack.id === track.id && 'text-neon-green'
                        )}>
                          {track.title}
                        </p>
                        <p className="text-sm text-gray-400">{track.artist}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-gray-400 hidden md:table-cell">{track.album}</td>
                  <td className="py-3 text-gray-400 hidden lg:table-cell">{track.genre}</td>
                  <td className="py-3 text-gray-400 text-right">{formatTime(track.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  const renderNowPlaying = () => (
    <div className={cn(
      'fixed inset-0 z-50 bg-gradient-to-b from-purple-900/90 to-black/95 backdrop-blur-xl flex flex-col',
      !isFullscreen && 'hidden'
    )}>
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => setIsFullscreen(false)}
          className="p-2 rounded-full hover:bg-white/10"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <span className="text-sm text-gray-400">Now Playing</span>
        <button className="p-2 rounded-full hover:bg-white/10">
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-72 h-72 md:w-96 md:h-96 rounded-lg bg-gradient-to-br from-neon-purple via-neon-cyan to-neon-pink shadow-2xl mb-8 relative overflow-hidden">
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="absolute inset-0 w-full h-full opacity-60"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Music className="w-32 h-32 opacity-30" />
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">{currentTrack.title}</h2>
          <p className="text-gray-400">{currentTrack.artist}</p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-10">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 bg-white/20 rounded-full cursor-pointer group">
              <div
                className="h-full bg-white rounded-full relative"
                style={{ width: `${(currentTime / currentTrack.duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <span className="text-xs text-gray-400 w-10">{formatTime(currentTrack.duration)}</span>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setIsShuffled(!isShuffled)}
              className={cn('p-2', isShuffled ? 'text-neon-green' : 'text-gray-400 hover:text-white')}
            >
              <Shuffle className="w-5 h-5" />
            </button>
            <button onClick={handlePrev} className="p-2 text-gray-400 hover:text-white">
              <SkipBack className="w-7 h-7" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-black" />
              ) : (
                <Play className="w-8 h-8 text-black ml-1" />
              )}
            </button>
            <button onClick={handleNext} className="p-2 text-gray-400 hover:text-white">
              <SkipForward className="w-7 h-7" />
            </button>
            <button
              onClick={toggleRepeat}
              className={cn('p-2', repeatMode !== 'off' ? 'text-neon-green' : 'text-gray-400 hover:text-white')}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 flex justify-center gap-8">
        <button
          onClick={() => setShowLyrics(!showLyrics)}
          className={cn('p-2 rounded-lg', showLyrics ? 'bg-white/10' : '')}
        >
          <Mic2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowQueue(!showQueue)}
          className={cn('p-2 rounded-lg', showQueue ? 'bg-white/10' : '')}
        >
          <ListMusic className="w-5 h-5" />
        </button>
        <button onClick={() => setShowEqualizer(!showEqualizer)} className="p-2">
          <BarChart3 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderQueue = () => (
    <AnimatePresence>
      {showQueue && (
        <motion.aside
          initial={{ width: 0 }}
          animate={{ width: 320 }}
          exit={{ width: 0 }}
          className="border-l border-white/10 bg-black/40 overflow-hidden flex-shrink-0"
        >
          <div className="w-80 h-full flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-semibold">Queue</h3>
              <button onClick={() => setShowQueue(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-white/10">
              <p className="text-xs text-gray-400 uppercase mb-2">Now Playing</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center">
                  <Music className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neon-green truncate">{currentTrack.title}</p>
                  <p className="text-sm text-gray-400 truncate">{currentTrack.artist}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs text-gray-400 uppercase mb-2">Next Up</p>
              <Reorder.Group values={queue} onReorder={setQueue} className="space-y-2">
                {queue.slice(currentTrackIndex + 1).map((track) => (
                  <Reorder.Item key={track.id} value={track}>
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4 text-gray-600" />
                      <div className="w-10 h-10 rounded bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                        <Music className="w-5 h-5 opacity-50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{track.title}</p>
                        <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                      </div>
                      <button
                        onClick={() => removeFromQueue(track.id)}
                        className="p-1 text-gray-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );

  const renderEqualizer = () => (
    <AnimatePresence>
      {showEqualizer && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-lattice-surface border border-white/10 rounded-xl p-6 shadow-2xl z-40"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Equalizer</h3>
            <div className="flex items-center gap-2">
              <select
                value={eqPreset}
                onChange={(e) => applyEqPreset(e.target.value)}
                className="bg-white/10 rounded px-3 py-1 text-sm focus:outline-none"
              >
                {Object.keys(EQ_PRESETS).map((preset) => (
                  <option key={preset} value={preset} className="bg-lattice-surface">
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </option>
                ))}
                <option value="custom" className="bg-lattice-surface">Custom</option>
              </select>
              <button
                onClick={() => setShowEqualizer(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-end gap-4 h-32">
            {FREQUENCIES.map((freq, i) => (
              <div key={freq} className="flex flex-col items-center">
                <div className="h-24 w-6 bg-white/10 rounded-full relative overflow-hidden">
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    value={eqBands[i]}
                    onChange={(e) => handleEqChange(i, parseInt(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    style={{ writingMode: 'vertical-rl' as React.CSSProperties['writingMode'] }}
                  />
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-neon-cyan to-neon-purple rounded-full transition-all"
                    style={{ height: `${(eqBands[i] + 12) / 24 * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 mt-2">{freq}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Visualizer</span>
                <select
                  value={visualizerMode}
                  onChange={(e) => setVisualizerMode(e.target.value as VisualizerMode)}
                  className="bg-white/10 rounded px-2 py-1 text-xs focus:outline-none"
                >
                  {['bars', 'waveform', 'circular', 'spectrum'].map((mode) => (
                    <option key={mode} value={mode} className="bg-lattice-surface">
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Crossfade</span>
              <input
                type="range"
                min="0"
                max="12"
                value={crossfade}
                onChange={(e) => setCrossfade(parseInt(e.target.value))}
                className="w-20"
              />
              <span className="text-xs w-6">{crossfade}s</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-purple-900/20 to-black">
      <div className="flex-1 flex overflow-hidden">
        {renderSidebar()}

        <main className="flex-1 overflow-y-auto p-6">
          {renderMainContent()}
        </main>

        {renderQueue()}
      </div>

      {/* Player Bar */}
      <footer className="h-20 bg-black/80 border-t border-white/10 flex items-center px-4">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-1/4 min-w-[200px]">
          <button
            onClick={() => setIsFullscreen(true)}
            className="w-14 h-14 rounded bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center flex-shrink-0 relative overflow-hidden group"
          >
            <canvas
              ref={canvasRef}
              width={56}
              height={56}
              className="absolute inset-0 w-full h-full"
            />
            <Music className="w-6 h-6 relative z-10" />
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-5 h-5" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate hover:underline cursor-pointer">{currentTrack.title}</p>
            <p className="text-sm text-gray-400 truncate hover:underline cursor-pointer">{currentTrack.artist}</p>
          </div>
          <button className={cn('p-2', currentTrack.liked ? 'text-neon-green' : 'text-gray-400 hover:text-white')}>
            <Heart className={cn('w-4 h-4', currentTrack.liked && 'fill-current')} />
          </button>
        </div>

        {/* Playback Controls */}
        <div className="flex-1 flex flex-col items-center max-w-2xl mx-auto px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsShuffled(!isShuffled)}
              className={cn('p-2', isShuffled ? 'text-neon-green' : 'text-gray-400 hover:text-white')}
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={handlePrev} className="p-2 text-gray-400 hover:text-white">
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-black" />
              ) : (
                <Play className="w-4 h-4 text-black ml-0.5" />
              )}
            </button>
            <button onClick={handleNext} className="p-2 text-gray-400 hover:text-white">
              <SkipForward className="w-5 h-5" />
            </button>
            <button
              onClick={toggleRepeat}
              className={cn('p-2', repeatMode !== 'off' ? 'text-neon-green' : 'text-gray-400 hover:text-white')}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          <div className="w-full flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400 w-10 text-right">{formatTime(currentTime)}</span>
            <div
              className="flex-1 h-1 bg-white/20 rounded-full cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                setCurrentTime(Math.floor(percent * currentTrack.duration));
              }}
            >
              <div
                className="h-full bg-white group-hover:bg-neon-green rounded-full relative transition-colors"
                style={{ width: `${(currentTime / currentTrack.duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <span className="text-xs text-gray-400 w-10">{formatTime(currentTrack.duration)}</span>
          </div>
        </div>

        {/* Volume & Extra Controls */}
        <div className="flex items-center gap-3 w-1/4 min-w-[200px] justify-end">
          <button onClick={() => setShowLyrics(!showLyrics)} className="p-2 text-gray-400 hover:text-white">
            <Mic2 className="w-4 h-4" />
          </button>
          <button onClick={() => setShowQueue(!showQueue)} className={cn('p-2', showQueue ? 'text-neon-green' : 'text-gray-400 hover:text-white')}>
            <ListMusic className="w-4 h-4" />
          </button>
          <button onClick={() => setShowEqualizer(!showEqualizer)} className="p-2 text-gray-400 hover:text-white">
            <BarChart3 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 text-gray-400 hover:text-white"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseInt(e.target.value));
                setIsMuted(false);
              }}
              className="w-24 accent-white"
            />
          </div>
          <button onClick={() => setIsFullscreen(true)} className="p-2 text-gray-400 hover:text-white">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {renderNowPlaying()}
      {renderEqualizer()}
    </div>
  );
}
