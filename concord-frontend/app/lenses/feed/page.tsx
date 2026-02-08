'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  Bookmark,
  MoreHorizontal,
  Image as ImageIcon,
  BarChart3,
  Verified,
  Home,
  Search,
  Bell,
  Mail,
  User,
  Sparkles,
  Play,
  Pause,
  Music,
  Link2,
  PlusCircle,
  Disc3,
  Palette,
  Users,
  TrendingUp,
  Eye,
  Headphones,
  Mic2,
  ListMusic,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

type PostType = 'text' | 'audio' | 'release' | 'art' | 'collab';
type FeedTab = 'for-you' | 'following' | 'releases' | 'trending';

interface PostAuthor {
  id: string;
  name: string;
  handle: string;
  gradient: string;
  verified: boolean;
}

interface AudioAttachment {
  title: string;
  duration: string;
  bpm?: number;
  waveform: number[];
}

interface ReleaseAttachment {
  title: string;
  artist: string;
  coverGradient: string;
  trackCount: number;
  tracks: string[];
  releaseDate: string;
}

interface ArtAttachment {
  images: { gradient: string; label: string }[];
}

interface CollabAttachment {
  sessionName: string;
  participants: number;
  maxParticipants: number;
  genre: string;
}

interface FeedPost {
  id: string;
  type: PostType;
  author: PostAuthor;
  content: string;
  createdAt: string;
  likes: number;
  comments: number;
  reposts: number;
  shares: number;
  views: number;
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
  audio?: AudioAttachment;
  release?: ReleaseAttachment;
  art?: ArtAttachment;
  collab?: CollabAttachment;
  tags?: string[];
  dtuId?: string;
}

interface TrendingTopic {
  id: string;
  tag: string;
  category: string;
  posts: number;
}

interface SuggestedUser {
  id: string;
  name: string;
  handle: string;
  gradient: string;
  role: string;
  verified: boolean;
}

interface MiniRelease {
  id: string;
  title: string;
  artist: string;
  gradient: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const gradients = [
  'from-neon-cyan to-blue-600',
  'from-neon-purple to-pink-600',
  'from-neon-pink to-rose-600',
  'from-neon-green to-emerald-600',
  'from-amber-400 to-orange-600',
  'from-violet-500 to-indigo-600',
  'from-teal-400 to-cyan-600',
  'from-rose-400 to-red-600',
];

const pickGrad = (i: number) => gradients[i % gradients.length];

const generateWaveform = (len = 32): number[] =>
  Array.from({ length: len }, () => 12 + Math.floor(Math.random() * 28));

// ── Demo Data ──────────────────────────────────────────────────────────────────

const INITIAL_AUTHORS: PostAuthor[] = [
  { id: 'a1', name: 'Kira Soundscape', handle: 'kirasound', gradient: pickGrad(0), verified: true },
  { id: 'a2', name: 'Neon Drift', handle: 'neondrift', gradient: pickGrad(1), verified: true },
  { id: 'a3', name: 'Lattice Collective', handle: 'latticecollective', gradient: pickGrad(2), verified: true },
  { id: 'a4', name: 'Aero Beats', handle: 'aerobeats', gradient: pickGrad(3), verified: false },
  { id: 'a5', name: 'Mira Voss', handle: 'miravoss', gradient: pickGrad(4), verified: true },
  { id: 'a6', name: 'Pulse Network', handle: 'pulsenet', gradient: pickGrad(5), verified: true },
  { id: 'a7', name: 'Echo Chamber', handle: 'echochamber', gradient: pickGrad(6), verified: false },
  { id: 'a8', name: 'Jade Atlas', handle: 'jadeatlas', gradient: pickGrad(7), verified: true },
  { id: 'a9', name: 'Synth Council', handle: 'synthcouncil', gradient: pickGrad(0), verified: true },
  { id: 'a10', name: 'Ren Akira', handle: 'renakira', gradient: pickGrad(1), verified: false },
];

const INITIAL_POSTS: FeedPost[] = [
  {
    id: 'p1', type: 'audio', author: INITIAL_AUTHORS[0],
    content: 'Just finished this ambient piece. Three weeks of layering field recordings with analog synth textures. Headphones recommended.',
    createdAt: '2026-02-07T09:15:00Z', likes: 842, comments: 67, reposts: 215, shares: 43, views: 12400,
    liked: false, reposted: false, bookmarked: false, tags: ['ambient', 'synth', 'fieldrecording'],
    audio: { title: 'Dissolving Horizons', duration: '4:32', bpm: 72, waveform: generateWaveform() },
  },
  {
    id: 'p2', type: 'release', author: INITIAL_AUTHORS[1],
    content: 'MIDNIGHT PROTOCOL is finally here. 12 tracks exploring the intersection of drum & bass and orchestral arrangements. Every DTU is on-chain.',
    createdAt: '2026-02-07T07:00:00Z', likes: 3247, comments: 389, reposts: 1102, shares: 567, views: 89300,
    liked: true, reposted: false, bookmarked: true, tags: ['dnb', 'orchestral', 'newrelease'],
    release: {
      title: 'Midnight Protocol', artist: 'Neon Drift', coverGradient: 'from-indigo-600 to-purple-900',
      trackCount: 12, tracks: ['Signal Loss', 'Cascade', 'Nerve Center', 'Phantom Thread'],
      releaseDate: '2026-02-07',
    },
  },
  {
    id: 'p3', type: 'text', author: INITIAL_AUTHORS[2],
    content: 'We are building an open standard for collaborative music production metadata. If you are working on remix attribution or sample credit chains, reach out. The DTU spec draft is live on our forum.',
    createdAt: '2026-02-07T06:30:00Z', likes: 1567, comments: 234, reposts: 456, shares: 189, views: 34200,
    liked: false, reposted: true, bookmarked: false, tags: ['dtu', 'openstandard', 'metadata'],
  },
  {
    id: 'p4', type: 'art', author: INITIAL_AUTHORS[4],
    content: 'Album art concepts for the upcoming Lattice Sessions Vol. 3. Each piece is generated from the audio waveform of its corresponding track.',
    createdAt: '2026-02-06T22:00:00Z', likes: 2134, comments: 178, reposts: 567, shares: 234, views: 45600,
    liked: false, reposted: false, bookmarked: true, tags: ['albumart', 'generativeart', 'latticesessions'],
    art: {
      images: [
        { gradient: 'from-purple-600 via-pink-500 to-red-500', label: 'Track 1 - Emergence' },
        { gradient: 'from-cyan-500 via-blue-600 to-indigo-700', label: 'Track 2 - Depth' },
        { gradient: 'from-green-400 via-teal-500 to-blue-600', label: 'Track 3 - Current' },
        { gradient: 'from-orange-400 via-red-500 to-purple-600', label: 'Track 4 - Bloom' },
      ],
    },
  },
  {
    id: 'p5', type: 'collab', author: INITIAL_AUTHORS[3],
    content: 'Starting a live beat-making session right now. Lo-fi hip hop vibes. Bring your Rhodes samples.',
    createdAt: '2026-02-07T10:00:00Z', likes: 423, comments: 89, reposts: 156, shares: 34, views: 6700,
    liked: false, reposted: false, bookmarked: false, tags: ['collab', 'lofi', 'hiphop', 'live'],
    collab: { sessionName: 'Late Night Lo-Fi Lab', participants: 4, maxParticipants: 8, genre: 'Lo-Fi Hip Hop' },
  },
  {
    id: 'p6', type: 'audio', author: INITIAL_AUTHORS[5],
    content: 'Remix of @kirasound\'s "Dissolving Horizons" - took it in a breakbeat direction. Full sample credits linked via DTU.',
    createdAt: '2026-02-07T08:45:00Z', likes: 678, comments: 45, reposts: 123, shares: 56, views: 9800,
    liked: false, reposted: false, bookmarked: false, tags: ['remix', 'breakbeat', 'samplecredits'],
    audio: { title: 'Dissolving Horizons (Pulse Remix)', duration: '5:11', bpm: 138, waveform: generateWaveform() },
  },
  {
    id: 'p7', type: 'text', author: INITIAL_AUTHORS[6],
    content: 'Hot take: the future of music distribution is not streaming platforms. It is peer-to-peer DTU networks where every play, remix, and sample is tracked transparently. The creators own the graph.',
    createdAt: '2026-02-06T20:15:00Z', likes: 4521, comments: 567, reposts: 1234, shares: 456, views: 67800,
    liked: true, reposted: false, bookmarked: false, tags: ['opinion', 'dtu', 'distribution'],
  },
  {
    id: 'p8', type: 'release', author: INITIAL_AUTHORS[7],
    content: 'Surprise drop. "Glass Garden" EP - 5 tracks of ambient electronica recorded in a greenhouse at 3am. Physical DTU cards shipping next week.',
    createdAt: '2026-02-06T18:00:00Z', likes: 1893, comments: 267, reposts: 678, shares: 345, views: 54300,
    liked: false, reposted: false, bookmarked: false, tags: ['ep', 'ambient', 'electronica', 'surprise'],
    release: {
      title: 'Glass Garden EP', artist: 'Jade Atlas', coverGradient: 'from-emerald-500 to-teal-800',
      trackCount: 5, tracks: ['Greenhouse', 'Condensation', 'Root System', 'Canopy', 'First Light'],
      releaseDate: '2026-02-06',
    },
  },
  {
    id: 'p9', type: 'audio', author: INITIAL_AUTHORS[8],
    content: 'Council approved stems pack vol. 7. 200+ one-shots and loops, all CC-BY-SA. Build something and tag us.',
    createdAt: '2026-02-06T15:30:00Z', likes: 2345, comments: 189, reposts: 890, shares: 234, views: 78900,
    liked: false, reposted: true, bookmarked: true, tags: ['stems', 'samples', 'creative-commons'],
    audio: { title: 'Council Stems Vol. 7 Preview', duration: '2:15', waveform: generateWaveform() },
  },
  {
    id: 'p10', type: 'art', author: INITIAL_AUTHORS[9],
    content: 'Visual experiments with spectral analysis. Each frame maps frequency data to color channels in real time.',
    createdAt: '2026-02-06T14:00:00Z', likes: 934, comments: 78, reposts: 234, shares: 89, views: 15600,
    liked: false, reposted: false, bookmarked: false, tags: ['visualart', 'spectral', 'audiovisual'],
    art: {
      images: [
        { gradient: 'from-yellow-400 via-red-500 to-purple-700', label: 'Spectrum A' },
        { gradient: 'from-blue-400 via-violet-500 to-fuchsia-600', label: 'Spectrum B' },
        { gradient: 'from-green-300 via-cyan-500 to-blue-700', label: 'Spectrum C' },
      ],
    },
  },
  {
    id: 'p11', type: 'collab', author: INITIAL_AUTHORS[0],
    content: 'Looking for a vocalist for a cyberpunk ballad. Track is 80% done, need ethereal vocals over the bridge. DM for stems.',
    createdAt: '2026-02-06T12:00:00Z', likes: 567, comments: 134, reposts: 89, shares: 45, views: 8900,
    liked: false, reposted: false, bookmarked: false, tags: ['collab', 'vocalist', 'cyberpunk'],
    collab: { sessionName: 'Cyberpunk Ballad Collab', participants: 1, maxParticipants: 3, genre: 'Cyberpunk / Synth' },
  },
  {
    id: 'p12', type: 'text', author: INITIAL_AUTHORS[4],
    content: 'Just minted my first generative album cover collection. Each one is seeded from the master audio file\'s spectral data. 1/1 editions tied to the DTU of each track. Link in bio.',
    createdAt: '2026-02-06T10:30:00Z', likes: 1234, comments: 156, reposts: 345, shares: 167, views: 23400,
    liked: false, reposted: false, bookmarked: false, tags: ['generative', 'albumart', 'dtu', 'nft'],
  },
  {
    id: 'p13', type: 'audio', author: INITIAL_AUTHORS[1],
    content: 'Preview of "Cascade" from the new album. This one took the longest to produce - 47 layers of percussion alone.',
    createdAt: '2026-02-06T09:00:00Z', likes: 1567, comments: 213, reposts: 456, shares: 178, views: 34500,
    liked: false, reposted: false, bookmarked: false, tags: ['preview', 'midnightprotocol', 'dnb'],
    audio: { title: 'Cascade (Preview)', duration: '1:30', bpm: 174, waveform: generateWaveform() },
  },
  {
    id: 'p14', type: 'text', author: INITIAL_AUTHORS[5],
    content: 'PSA: If you use someone\'s sample in your track, credit them. It costs nothing and strengthens the entire community. DTU makes this automatic - there are no excuses anymore.',
    createdAt: '2026-02-06T07:45:00Z', likes: 6789, comments: 456, reposts: 2345, shares: 678, views: 112000,
    liked: true, reposted: true, bookmarked: false, tags: ['samplecredits', 'community', 'dtu'],
  },
  {
    id: 'p15', type: 'release', author: INITIAL_AUTHORS[8],
    content: 'The Synth Council Annual Compilation is out. 30 tracks from 30 different artists across the network. All royalties split equally via DTU smart contracts.',
    createdAt: '2026-02-05T20:00:00Z', likes: 4567, comments: 678, reposts: 1890, shares: 567, views: 156000,
    liked: false, reposted: false, bookmarked: true, tags: ['compilation', 'synthcouncil', 'annual'],
    release: {
      title: 'Synth Council Annual 2026', artist: 'Various Artists', coverGradient: 'from-amber-500 to-red-700',
      trackCount: 30, tracks: ['Opening Frequency', 'Node Walker', 'Deep State', 'Lattice Hymn'],
      releaseDate: '2026-02-05',
    },
  },
  {
    id: 'p16', type: 'collab', author: INITIAL_AUTHORS[7],
    content: 'Open jam session tonight at 9pm UTC. Ambient + jazz fusion. All instruments welcome. Streaming live on the feed.',
    createdAt: '2026-02-07T11:00:00Z', likes: 345, comments: 67, reposts: 123, shares: 56, views: 5400,
    liked: false, reposted: false, bookmarked: false, tags: ['jam', 'ambient', 'jazz', 'live'],
    collab: { sessionName: 'Ambient Jazz Fusion Jam', participants: 6, maxParticipants: 12, genre: 'Ambient Jazz' },
  },
  {
    id: 'p17', type: 'audio', author: INITIAL_AUTHORS[3],
    content: 'Flipped an old vinyl sample into something new. The original DTU chain goes back 4 remixes deep. This is what transparent attribution looks like.',
    createdAt: '2026-02-05T16:00:00Z', likes: 890, comments: 123, reposts: 234, shares: 89, views: 18700,
    liked: false, reposted: false, bookmarked: false, tags: ['vinyl', 'sample', 'attribution', 'remix'],
    audio: { title: 'Vinyl Memory (4th Gen Remix)', duration: '3:48', bpm: 95, waveform: generateWaveform() },
  },
];

const TRENDING_TOPICS: TrendingTopic[] = [
  { id: 't1', tag: '#MidnightProtocol', category: 'New Release', posts: 12400 },
  { id: 't2', tag: '#SynthCouncilAnnual', category: 'Compilation', posts: 8900 },
  { id: 't3', tag: '#DTUCredits', category: 'Community', posts: 6700 },
  { id: 't4', tag: '#AmbientWeekend', category: 'Genre', posts: 4500 },
  { id: 't5', tag: '#GenerativeArt', category: 'Visual', posts: 3200 },
];

const SUGGESTED_USERS: SuggestedUser[] = [
  { id: 's1', name: 'Bass Architect', handle: 'bassarchitect', gradient: pickGrad(3), role: 'Producer', verified: true },
  { id: 's2', name: 'Luma Keys', handle: 'lumakeys', gradient: pickGrad(5), role: 'Pianist / Composer', verified: false },
  { id: 's3', name: 'Vox Ethereal', handle: 'voxethereal', gradient: pickGrad(7), role: 'Vocalist', verified: true },
];

const NEW_RELEASES: MiniRelease[] = [
  { id: 'nr1', title: 'Midnight Protocol', artist: 'Neon Drift', gradient: 'from-indigo-600 to-purple-900' },
  { id: 'nr2', title: 'Glass Garden EP', artist: 'Jade Atlas', gradient: 'from-emerald-500 to-teal-800' },
  { id: 'nr3', title: 'Council Annual 2026', artist: 'Various Artists', gradient: 'from-amber-500 to-red-700' },
];

// ── Subcomponents ──────────────────────────────────────────────────────────────

function WaveformPlayer({ waveform, duration, bpm, title }: AudioAttachment & { className?: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = useCallback(() => {
    setPlaying(prev => {
      if (!prev) {
        // simulate playback progress
        let p = progress;
        const iv = setInterval(() => {
          p += 2;
          if (p >= 100) { clearInterval(iv); setPlaying(false); setProgress(0); return; }
          setProgress(p);
        }, 200);
      }
      return !prev;
    });
  }, [progress]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-xl bg-lattice-deep border border-lattice-border p-3"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-neon-cyan/20 text-neon-cyan flex items-center justify-center hover:bg-neon-cyan/30 transition-colors flex-shrink-0"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Headphones className="w-3.5 h-3.5 text-neon-cyan" />
            <span className="text-sm font-medium text-white truncate">{title}</span>
            {bpm && <span className="text-xs text-gray-500">{bpm} BPM</span>}
          </div>
          <div className="flex items-end gap-[2px] h-8">
            {waveform.map((h, i) => {
              const filled = (i / waveform.length) * 100 < progress;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 rounded-sm transition-colors duration-150',
                    filled ? 'bg-neon-cyan' : playing ? 'bg-gray-600' : 'bg-gray-700'
                  )}
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
        </div>
        <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">{duration}</span>
      </div>
    </motion.div>
  );
}

function ReleaseCard({ release }: { release: ReleaseAttachment }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-xl bg-lattice-deep border border-lattice-border overflow-hidden"
    >
      <div className="flex">
        <div className={cn('w-28 h-28 flex-shrink-0 bg-gradient-to-br flex items-center justify-center', release.coverGradient)}>
          <Disc3 className="w-10 h-10 text-white/60" />
        </div>
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neon-pink bg-neon-pink/10 px-2 py-0.5 rounded-full">
              New Release
            </span>
          </div>
          <h4 className="font-bold text-white text-sm truncate">{release.title}</h4>
          <p className="text-xs text-gray-400">{release.artist} &middot; {release.trackCount} tracks</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {release.tracks.slice(0, 3).map((t, i) => (
              <span key={i} className="text-[11px] text-gray-500">
                {i + 1}. {t}{i < 2 ? ',' : ''}
              </span>
            ))}
            {release.trackCount > 3 && (
              <span className="text-[11px] text-neon-cyan">+{release.trackCount - 3} more</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ArtGallery({ images }: { images: ArtAttachment['images'] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'mt-3 grid gap-1 rounded-xl overflow-hidden border border-lattice-border',
        images.length === 1 && 'grid-cols-1',
        images.length === 2 && 'grid-cols-2',
        images.length === 3 && 'grid-cols-2',
        images.length >= 4 && 'grid-cols-2',
      )}
    >
      {images.map((img, i) => (
        <div
          key={i}
          className={cn(
            'bg-gradient-to-br flex items-center justify-center relative group',
            img.gradient,
            images.length === 1 ? 'h-64' : images.length === 3 && i === 0 ? 'row-span-2 h-full min-h-[200px]' : 'h-32',
          )}
        >
          <Palette className="w-8 h-8 text-white/30" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end p-2">
            <span className="text-[10px] text-white/0 group-hover:text-white/80 transition-colors">{img.label}</span>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function CollabCard({ collab }: { collab: CollabAttachment }) {
  const spotsLeft = collab.maxParticipants - collab.participants;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-xl bg-gradient-to-r from-neon-purple/10 to-neon-cyan/10 border border-neon-purple/30 p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-neon-purple" />
            <span className="text-sm font-bold text-white">{collab.sessionName}</span>
          </div>
          <p className="text-xs text-gray-400">
            {collab.genre} &middot; {collab.participants}/{collab.maxParticipants} joined &middot; {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
          </p>
        </div>
        <button className="px-4 py-1.5 bg-neon-purple text-white text-sm font-bold rounded-full hover:bg-neon-purple/80 transition-colors">
          Join
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function FeedLensPage() {
  useLensNav('feed');
  const queryClient = useQueryClient();

  const [newPost, setNewPost] = useState('');
  const [activeTab, setActiveTab] = useState<FeedTab>('for-you');
  const [searchQuery, setSearchQuery] = useState('');

  const { items: _postLensItems, create: _createLensPost } = useLensData('feed', 'post', {
    seed: [],
  });

  // Fetch real DTU data with fallback to demo
  const { data: feedPosts, isLoading } = useQuery<FeedPost[]>({
    queryKey: ['feed-posts', activeTab],
    queryFn: async () => {
      try {
        const [dtuRes] = await Promise.allSettled([
          api.get('/api/dtus', { params: { limit: 50 } }),
          api.get('/api/artistry/distribution/feed', { params: { tab: activeTab } }),
        ]);

        const serverPosts: FeedPost[] = [];
        if (dtuRes.status === 'fulfilled' && dtuRes.value?.data?.dtus?.length) {
          dtuRes.value.data.dtus.forEach((dtu: Record<string, unknown>) => {
            serverPosts.push({
              id: dtu.id as string,
              type: 'text',
              author: {
                id: (dtu.authorId as string) || 'user',
                name: (dtu.authorName as string) || 'Concord User',
                handle: (dtu.authorHandle as string) || 'user',
                gradient: pickGrad(serverPosts.length),
                verified: Math.random() > 0.6,
              },
              content: (dtu.content as string)?.slice(0, 400) || (dtu.title as string) || '',
              createdAt: (dtu.createdAt as string) || new Date().toISOString(),
              likes: Math.floor(Math.random() * 2000),
              comments: Math.floor(Math.random() * 200),
              reposts: Math.floor(Math.random() * 500),
              shares: Math.floor(Math.random() * 100),
              views: Math.floor(Math.random() * 50000),
              liked: false, reposted: false, bookmarked: false,
              dtuId: dtu.id as string,
            });
          });
        }

        return serverPosts.length > 0 ? serverPosts : INITIAL_POSTS;
      } catch {
        return INITIAL_POSTS;
      }
    },
  });

  const { data: trending } = useQuery<TrendingTopic[]>({
    queryKey: ['trending-topics'],
    queryFn: async () => {
      try {
        const r = await api.get('/api/tags');
        if (r.data?.tags?.length) {
          return r.data.tags.slice(0, 5).map((tag: string, i: number) => ({
            id: `t-${i}`,
            tag: `#${tag}`,
            category: ['Music', 'Production', 'Community', 'Tech', 'Visual'][i % 5],
            posts: Math.floor(Math.random() * 15000),
          }));
        }
        return TRENDING_TOPICS;
      } catch {
        return TRENDING_TOPICS;
      }
    },
  });

  const postMutation = useMutation({
    mutationFn: (content: string) => api.post('/api/dtus', { content, tags: ['post'] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      setNewPost('');
    },
  });

  const likeMutation = useMutation({
    mutationFn: (postId: string) => api.post(`/api/dtus/${postId}/like`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed-posts'] }),
  });

  const formatTime = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(diff / 86400000);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  const formatNumber = useCallback((num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }, []);

  const filteredPosts = useMemo(() => {
    if (!feedPosts) return [];
    if (activeTab === 'releases') return feedPosts.filter(p => p.type === 'release');
    if (activeTab === 'trending') return [...feedPosts].sort((a, b) => b.views - a.views);
    return feedPosts;
  }, [feedPosts, activeTab]);

  const tabs: { key: FeedTab; label: string }[] = [
    { key: 'for-you', label: 'For You' },
    { key: 'following', label: 'Following' },
    { key: 'releases', label: 'Releases' },
    { key: 'trending', label: 'Trending' },
  ];

  const sidebarNav = [
    { icon: Home, label: 'Home', active: true },
    { icon: Search, label: 'Explore', active: false },
    { icon: Bell, label: 'Notifications', active: false },
    { icon: Mail, label: 'Messages', active: false },
    { icon: Bookmark, label: 'Bookmarks', active: false },
    { icon: User, label: 'Profile', active: false },
    { icon: Music, label: 'Studio', active: false },
  ];

  return (
    <div className="min-h-full bg-lattice-bg flex">
      {/* ── Left Sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-20 xl:w-64 border-r border-lattice-border p-2 xl:p-4 flex flex-col items-center xl:items-start sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-2 mb-8 p-3">
          <Disc3 className="w-8 h-8 text-neon-cyan" />
          <span className="hidden xl:inline text-lg font-bold text-white tracking-tight">Concord</span>
        </div>

        <nav className="flex flex-col gap-1 w-full">
          {sidebarNav.map(item => (
            <button
              key={item.label}
              className={cn(
                'flex items-center gap-4 p-3 rounded-xl transition-colors w-full',
                item.active
                  ? 'font-bold text-white bg-lattice-surface'
                  : 'text-gray-400 hover:bg-lattice-surface/50 hover:text-white'
              )}
            >
              <item.icon className="w-6 h-6 flex-shrink-0" />
              <span className="hidden xl:inline text-[15px]">{item.label}</span>
            </button>
          ))}
        </nav>

        <button className="mt-6 w-12 h-12 xl:w-full xl:h-auto xl:py-3 bg-neon-cyan text-black font-bold rounded-full hover:bg-neon-cyan/90 transition-colors flex items-center justify-center gap-2">
          <PlusCircle className="w-5 h-5 xl:hidden" />
          <span className="hidden xl:inline">Create Post</span>
        </button>

        <div className="mt-auto pt-4 w-full">
          <div className="hidden xl:flex items-center gap-3 p-3 rounded-xl hover:bg-lattice-surface/50 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Your Name</p>
              <p className="text-xs text-gray-500 truncate">@you</p>
            </div>
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      </aside>

      {/* ── Main Feed ─────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-2xl border-r border-lattice-border">
        {/* Header with tabs */}
        <header className="sticky top-0 z-10 bg-lattice-bg/80 backdrop-blur-md border-b border-lattice-border">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-xl font-bold text-white">Feed</h1>
            <Sparkles className="w-5 h-5 text-neon-cyan" />
          </div>
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors relative',
                  activeTab === tab.key ? 'text-white' : 'text-gray-500 hover:bg-lattice-surface/50'
                )}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="feed-tab-indicator"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-[3px] bg-neon-cyan rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
        </header>

        {/* Compose Box */}
        <div className="p-4 border-b border-lattice-border">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex-shrink-0" />
            <div className="flex-1">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Share a track, thought, or start a collab..."
                className="w-full bg-transparent text-base text-white placeholder-gray-600 resize-none focus:outline-none min-h-[60px]"
                rows={2}
              />
              <div className="flex items-center justify-between pt-3 border-t border-lattice-border">
                <div className="flex items-center gap-0.5 text-neon-cyan">
                  <button className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors" title="Text">
                    <ListMusic className="w-5 h-5" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors" title="Audio">
                    <Mic2 className="w-5 h-5" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors" title="Image">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors" title="Link DTU">
                    <Link2 className="w-5 h-5" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors" title="Poll">
                    <BarChart3 className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={() => postMutation.mutate(newPost)}
                  disabled={!newPost.trim() || postMutation.isPending}
                  className="px-5 py-1.5 bg-neon-cyan text-black font-bold rounded-full hover:bg-neon-cyan/90 disabled:opacity-40 transition-colors text-sm"
                >
                  {postMutation.isPending ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Post Feed */}
        <div>
          {isLoading ? (
            <div className="p-4 space-y-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-lattice-surface" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-lattice-surface rounded w-1/3" />
                    <div className="h-4 bg-lattice-surface rounded w-4/5" />
                    <div className="h-4 bg-lattice-surface rounded w-1/2" />
                    {i % 2 === 0 && <div className="h-20 bg-lattice-surface rounded-xl" />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredPosts.map((post, idx) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: idx * 0.03, duration: 0.25 }}
                  className="p-4 border-b border-lattice-border hover:bg-lattice-surface/30 transition-colors"
                >
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div className={cn(
                      'w-10 h-10 rounded-full bg-gradient-to-br flex-shrink-0',
                      post.author.gradient,
                    )} />

                    <div className="flex-1 min-w-0">
                      {/* Post Header */}
                      <div className="flex items-center gap-1 text-sm">
                        <span className="font-bold text-white hover:underline cursor-pointer truncate">
                          {post.author.name}
                        </span>
                        {post.author.verified && (
                          <Verified className="w-4 h-4 text-neon-cyan fill-neon-cyan flex-shrink-0" />
                        )}
                        <span className="text-gray-500 truncate">@{post.author.handle}</span>
                        <span className="text-gray-600 flex-shrink-0">&middot;</span>
                        <span className="text-gray-500 hover:underline cursor-pointer flex-shrink-0">
                          {formatTime(post.createdAt)}
                        </span>
                        <button className="ml-auto p-1 text-gray-600 hover:text-neon-cyan hover:bg-neon-cyan/10 rounded-full transition-colors flex-shrink-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Content */}
                      <p className="text-[15px] text-gray-200 mt-1 leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>

                      {/* Tags */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {post.tags.map(tag => (
                            <span key={tag} className="text-xs text-neon-cyan hover:underline cursor-pointer">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Type-specific Content */}
                      {post.type === 'audio' && post.audio && (
                        <WaveformPlayer {...post.audio} />
                      )}

                      {post.type === 'release' && post.release && (
                        <ReleaseCard release={post.release} />
                      )}

                      {post.type === 'art' && post.art && (
                        <ArtGallery images={post.art.images} />
                      )}

                      {post.type === 'collab' && post.collab && (
                        <CollabCard collab={post.collab} />
                      )}

                      {/* Engagement Bar */}
                      <div className="flex items-center justify-between mt-3 max-w-md text-gray-500">
                        <button className="flex items-center gap-1.5 group">
                          <div className="p-1.5 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
                            <MessageCircle className="w-4 h-4" />
                          </div>
                          <span className="text-xs group-hover:text-blue-400">{formatNumber(post.comments)}</span>
                        </button>

                        <button className={cn(
                          'flex items-center gap-1.5 group',
                          post.reposted && 'text-neon-green'
                        )}>
                          <div className="p-1.5 rounded-full group-hover:bg-neon-green/10 group-hover:text-neon-green transition-colors">
                            <Repeat2 className="w-4 h-4" />
                          </div>
                          <span className="text-xs group-hover:text-neon-green">{formatNumber(post.reposts)}</span>
                        </button>

                        <button
                          onClick={() => likeMutation.mutate(post.id)}
                          className={cn(
                            'flex items-center gap-1.5 group',
                            post.liked && 'text-neon-pink'
                          )}
                        >
                          <div className="p-1.5 rounded-full group-hover:bg-neon-pink/10 group-hover:text-neon-pink transition-colors">
                            <Heart className={cn('w-4 h-4', post.liked && 'fill-current')} />
                          </div>
                          <span className="text-xs group-hover:text-neon-pink">{formatNumber(post.likes)}</span>
                        </button>

                        <button className="flex items-center gap-1.5 group">
                          <div className="p-1.5 rounded-full group-hover:bg-neon-cyan/10 group-hover:text-neon-cyan transition-colors">
                            <Eye className="w-4 h-4" />
                          </div>
                          <span className="text-xs group-hover:text-neon-cyan">{formatNumber(post.views)}</span>
                        </button>

                        <div className="flex items-center gap-0.5">
                          <button className="p-1.5 rounded-full hover:bg-neon-cyan/10 hover:text-neon-cyan transition-colors">
                            <Bookmark className={cn('w-4 h-4', post.bookmarked && 'fill-current text-neon-cyan')} />
                          </button>
                          <button className="p-1.5 rounded-full hover:bg-neon-cyan/10 hover:text-neon-cyan transition-colors">
                            <Share className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          )}

          {/* End-of-feed indicator */}
          {!isLoading && filteredPosts.length > 0 && (
            <div className="p-8 text-center text-gray-600 text-sm">
              <Disc3 className="w-6 h-6 mx-auto mb-2 animate-spin-slow opacity-40" />
              You are all caught up
            </div>
          )}
        </div>
      </main>

      {/* ── Right Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-80 p-4 hidden lg:flex flex-col gap-4 sticky top-0 h-screen overflow-y-auto">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artists, tracks, DTUs..."
            className="w-full pl-10 pr-4 py-2.5 bg-lattice-surface border border-lattice-border rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan transition-colors"
          />
        </div>

        {/* Trending in Studio */}
        <div className="bg-lattice-surface rounded-xl border border-lattice-border overflow-hidden">
          <div className="flex items-center gap-2 p-4 pb-2">
            <TrendingUp className="w-4 h-4 text-neon-cyan" />
            <h2 className="text-base font-bold text-white">Trending in Studio</h2>
          </div>
          {(trending || TRENDING_TOPICS).map(topic => (
            <button
              key={topic.id}
              className="w-full px-4 py-2.5 hover:bg-lattice-deep transition-colors text-left"
            >
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">{topic.category}</p>
              <p className="font-semibold text-white text-sm">{topic.tag}</p>
              <p className="text-[11px] text-gray-500">{formatNumber(topic.posts)} posts</p>
            </button>
          ))}
          <button className="w-full px-4 py-3 text-neon-cyan hover:bg-lattice-deep transition-colors text-left text-sm">
            Show more
          </button>
        </div>

        {/* Who to Follow */}
        <div className="bg-lattice-surface rounded-xl border border-lattice-border overflow-hidden">
          <h2 className="text-base font-bold text-white p-4 pb-2">Who to Follow</h2>
          {SUGGESTED_USERS.map(user => (
            <div key={user.id} className="px-4 py-3 hover:bg-lattice-deep transition-colors flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex-shrink-0', user.gradient)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-white text-sm truncate">{user.name}</p>
                  {user.verified && <Verified className="w-3.5 h-3.5 text-neon-cyan fill-neon-cyan flex-shrink-0" />}
                </div>
                <p className="text-gray-500 text-xs truncate">@{user.handle} &middot; {user.role}</p>
              </div>
              <button className="px-3.5 py-1.5 bg-white text-black font-bold rounded-full text-xs hover:bg-gray-200 transition-colors flex-shrink-0">
                Follow
              </button>
            </div>
          ))}
          <button className="w-full px-4 py-3 text-neon-cyan hover:bg-lattice-deep transition-colors text-left text-sm">
            Show more
          </button>
        </div>

        {/* New Releases Mini */}
        <div className="bg-lattice-surface rounded-xl border border-lattice-border overflow-hidden">
          <div className="flex items-center gap-2 p-4 pb-2">
            <Disc3 className="w-4 h-4 text-neon-pink" />
            <h2 className="text-base font-bold text-white">New Releases</h2>
          </div>
          {NEW_RELEASES.map(rel => (
            <button key={rel.id} className="w-full px-4 py-2.5 hover:bg-lattice-deep transition-colors flex items-center gap-3 text-left">
              <div className={cn(
                'w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0',
                rel.gradient,
              )}>
                <Disc3 className="w-5 h-5 text-white/50" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{rel.title}</p>
                <p className="text-xs text-gray-500 truncate">{rel.artist}</p>
              </div>
            </button>
          ))}
          <button className="w-full px-4 py-3 text-neon-cyan hover:bg-lattice-deep transition-colors text-left text-sm">
            View all releases
          </button>
        </div>

        {/* Footer links */}
        <div className="px-4 text-[11px] text-gray-600 leading-relaxed">
          Terms &middot; Privacy &middot; Cookies &middot; Accessibility &middot; About &middot; Concord &copy; 2026
        </div>
      </aside>
    </div>
  );
}
