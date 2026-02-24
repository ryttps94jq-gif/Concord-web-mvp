'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { api } from '@/lib/api/client';
import { apiHelpers } from '@/lib/api/client';
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
import { ErrorState } from '@/components/common/EmptyState';
import { useUIStore } from '@/store/ui';
import { useLensDTUs } from '@/hooks/useLensDTUs';
import { LensContextPanel } from '@/components/lens/LensContextPanel';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';

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
  Array.from({ length: len }, (_, i) => 12 + Math.floor((Math.sin(i * 0.5) * 0.5 + 0.5) * 28));

// ── Data (all from backend — no mock data) ───────────────────────────────────

const _INITIAL_AUTHORS: PostAuthor[] = [];
const INITIAL_POSTS: FeedPost[] = [];
const TRENDING_TOPICS: TrendingTopic[] = [];

const SUGGESTED_USERS: SuggestedUser[] = [];
const NEW_RELEASES: MiniRelease[] = [];

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
  const joinMutation = useMutation({
    mutationFn: () => apiHelpers.artistry.collab.sessions.join(collab.sessionName, { userId: 'current-user' }),
    onSuccess: () => useUIStore.getState().addToast({ type: 'success', message: `Joined "${collab.sessionName}"` }),
  });
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
        <button
          onClick={() => joinMutation.mutate()}
          disabled={joinMutation.isPending || spotsLeft <= 0}
          className="px-4 py-1.5 bg-neon-purple text-white text-sm font-bold rounded-full hover:bg-neon-purple/80 transition-colors disabled:opacity-50"
        >
          {joinMutation.isPending ? 'Joining...' : 'Join'}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function FeedLensPage() {
  useLensNav('feed');

  const {
    hyperDTUs, megaDTUs, regularDTUs,
    tierDistribution, publishToMarketplace,
    isLoading: dtusLoading, refetch: refetchDTUs,
  } = useLensDTUs({ lens: 'feed' });

  const queryClient = useQueryClient();

  const [newPost, setNewPost] = useState('');
  const [activeTab, setActiveTab] = useState<FeedTab>('for-you');
  const [searchQuery, setSearchQuery] = useState('');
  const composeRef = useRef<HTMLTextAreaElement>(null);

  const { isError: isError, error: error, refetch: refetch, items: postLensItems, create: _createLensPost } = useLensData<Record<string, unknown>>('feed', 'post', {
    seed: INITIAL_POSTS.map(p => ({ title: p.content?.slice(0, 80) || p.id, data: p as unknown as Record<string, unknown> })),
  });

  // Fetch real DTU data from backend
  const { data: feedPosts, isLoading, isError: isError2, error: error2, refetch: refetch2,} = useQuery<FeedPost[]>({
    queryKey: ['feed-posts', activeTab],
    queryFn: async () => {
      try {
        const [dtuRes] = await Promise.allSettled([
          apiHelpers.dtus.paginated({ limit: 50 }),
          apiHelpers.artistry.distribution.feed('current'),
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
                verified: (dtu.verified as boolean) || false,
              },
              content: (dtu.content as string)?.slice(0, 400) || (dtu.title as string) || '',
              createdAt: (dtu.createdAt as string) || new Date().toISOString(),
              likes: (dtu.likes as number) || 0,
              comments: (dtu.comments as number) || 0,
              reposts: (dtu.reposts as number) || 0,
              shares: (dtu.shares as number) || 0,
              views: (dtu.views as number) || 0,
              liked: false, reposted: false, bookmarked: false,
              dtuId: dtu.id as string,
            });
          });
        }


        if (serverPosts.length > 0) return serverPosts;
        // Fall back to persisted lens items (which include seeded data)
        if (postLensItems.length > 0) {
          return postLensItems.map(li => ({ id: li.id, ...(li.data as Record<string, unknown>) } as unknown as FeedPost));
        }
        return [];
      } catch {
        if (postLensItems.length > 0) {
          return postLensItems.map(li => ({ id: li.id, ...(li.data as Record<string, unknown>) } as unknown as FeedPost));
        }
        return [];
      }
      return [];
    },
  });

  const { data: trending, isError: isError3, error: error3, refetch: refetch3,} = useQuery<TrendingTopic[]>({
    queryKey: ['trending-topics'],
    queryFn: async () => {
      try {
        const r = await apiHelpers.dtus.list();
        const allTags = new Set<string>();
        (r.data?.dtus || []).forEach((d: Record<string, unknown>) => ((d.tags as string[]) || []).forEach(t => allTags.add(t)));
        const tagArr = Array.from(allTags);
        if (tagArr.length) {
          return tagArr.slice(0, 5).map((tag: string, i: number) => ({
            id: `t-${i}`,
            tag: `#${tag}`,
            category: ['Music', 'Production', 'Community', 'Tech', 'Visual'][i % 5],
            posts: 0,
          }));
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  const postMutation = useMutation({
    mutationFn: (content: string) => apiHelpers.dtus.create({ content, tags: ['post'] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      setNewPost('');
    },
    onError: (err) => {
      console.error('Failed to create post:', err instanceof Error ? err.message : err);
    },
  });

  const likeMutation = useMutation({
    mutationFn: (postId: string) => apiHelpers.dtus.update(postId, { liked: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed-posts'] }),
    onError: (err) => {
      console.error('Failed to like post:', err instanceof Error ? err.message : err);
    },
  });

  const repostMutation = useMutation({
    mutationFn: (postId: string) => apiHelpers.dtus.update(postId, { reposted: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      useUIStore.getState().addToast({ type: 'success', message: 'Reposted!' });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: (postId: string) => apiHelpers.dtus.update(postId, { bookmarked: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed-posts'] }),
  });

  const shareMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (navigator.share) {
        await navigator.share({ title: 'Concord Post', url: `${window.location.origin}/lenses/feed?post=${postId}` });
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/lenses/feed?post=${postId}`);
        useUIStore.getState().addToast({ type: 'success', message: 'Link copied to clipboard' });
      }
    },
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => apiHelpers.social.follow(userId),
    onSuccess: () => useUIStore.getState().addToast({ type: 'success', message: 'Followed!' }),
  });

  const handleComposeHint = useCallback((hint: string) => {
    setNewPost(prev => prev ? `${prev}\n[${hint}]` : `[${hint}]`);
    composeRef.current?.focus();
  }, []);

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
    let posts = feedPosts;
    if (activeTab === 'releases') posts = posts.filter(p => p.type === 'release');
    if (activeTab === 'trending') posts = [...posts].sort((a, b) => b.views - a.views);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      posts = posts.filter(p =>
        p.content.toLowerCase().includes(q) ||
        p.author.name.toLowerCase().includes(q) ||
        p.author.handle.toLowerCase().includes(q) ||
        p.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return posts;
  }, [feedPosts, activeTab, searchQuery]);

  const tabs: { key: FeedTab; label: string }[] = [
    { key: 'for-you', label: 'For You' },
    { key: 'following', label: 'Following' },
    { key: 'releases', label: 'Releases' },
    { key: 'trending', label: 'Trending' },
  ];

  const sidebarNav = [
    { icon: Home, label: 'Home', active: activeTab === 'for-you', action: () => setActiveTab('for-you') },
    { icon: Search, label: 'Explore', active: activeTab === 'trending', action: () => setActiveTab('trending') },
    { icon: Bell, label: 'Notifications', active: false, action: () => useUIStore.getState().addToast({ type: 'info', message: 'Notifications coming soon' }) },
    { icon: Mail, label: 'Messages', active: false, action: () => useUIStore.getState().addToast({ type: 'info', message: 'Messages coming soon' }) },
    { icon: Bookmark, label: 'Bookmarks', active: false, action: () => useUIStore.getState().addToast({ type: 'info', message: 'Bookmarks coming soon' }) },
    { icon: User, label: 'Profile', active: false, action: () => useUIStore.getState().addToast({ type: 'info', message: 'Profile coming soon' }) },
    { icon: Music, label: 'Studio', active: activeTab === 'releases', action: () => setActiveTab('releases') },
  ];


  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetch(); refetch2(); refetch3(); }} />
      </div>
    );
  }
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
              onClick={item.action}
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

        <button
          onClick={() => { composeRef.current?.focus(); composeRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
          className="mt-6 w-12 h-12 xl:w-full xl:h-auto xl:py-3 bg-neon-cyan text-black font-bold rounded-full hover:bg-neon-cyan/90 transition-colors flex items-center justify-center gap-2"
        >
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
                ref={composeRef}
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Share a track, thought, or start a collab..."
                className="w-full bg-transparent text-base text-white placeholder-gray-600 resize-none focus:outline-none min-h-[60px]"
                rows={2}
              />
              <div className="flex items-center justify-between pt-3 border-t border-lattice-border">
                <div className="flex items-center gap-0.5 text-neon-cyan">
                  <button onClick={() => handleComposeHint('Track')} className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors" title="Attach track reference">
                    <ListMusic className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleComposeHint('Audio')} className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors" title="Attach audio">
                    <Mic2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleComposeHint('Image')} className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors" title="Attach image">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleComposeHint('DTU Link')} className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors" title="Link DTU">
                    <Link2 className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleComposeHint('Poll')} className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors" title="Add poll">
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
          ) : filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <MessageCircle className="w-16 h-16 mb-4 opacity-40" />
              <h3 className="text-lg font-medium mb-2 text-white">No posts yet</h3>
              <p className="text-sm mb-4">Create a post or follow users to populate your feed.</p>
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
                        <button
                          onClick={() => useUIStore.getState().addToast({ type: 'info', message: `Post ${post.id} options` })}
                          className="ml-auto p-1 text-gray-600 hover:text-neon-cyan hover:bg-neon-cyan/10 rounded-full transition-colors flex-shrink-0"
                        >
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
                        <button
                          onClick={() => useUIStore.getState().addToast({ type: 'info', message: 'Comments coming soon' })}
                          className="flex items-center gap-1.5 group"
                        >
                          <div className="p-1.5 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
                            <MessageCircle className="w-4 h-4" />
                          </div>
                          <span className="text-xs group-hover:text-blue-400">{formatNumber(post.comments)}</span>
                        </button>

                        <button
                          onClick={() => repostMutation.mutate(post.id)}
                          className={cn(
                            'flex items-center gap-1.5 group',
                            post.reposted && 'text-neon-green'
                          )}
                        >
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

                        <div className="flex items-center gap-1.5 group" title="Views">
                          <div className="p-1.5 rounded-full group-hover:bg-neon-cyan/10 group-hover:text-neon-cyan transition-colors">
                            <Eye className="w-4 h-4" />
                          </div>
                          <span className="text-xs group-hover:text-neon-cyan">{formatNumber(post.views)}</span>
                        </div>

                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => bookmarkMutation.mutate(post.id)}
                            className="p-1.5 rounded-full hover:bg-neon-cyan/10 hover:text-neon-cyan transition-colors"
                          >
                            <Bookmark className={cn('w-4 h-4', post.bookmarked && 'fill-current text-neon-cyan')} />
                          </button>
                          <button
                            onClick={() => shareMutation.mutate(post.id)}
                            className="p-1.5 rounded-full hover:bg-neon-cyan/10 hover:text-neon-cyan transition-colors"
                          >
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
          {(trending || []).map(topic => (
            <button
              key={topic.id}
              onClick={() => setSearchQuery(topic.tag.replace('#', ''))}
              className="w-full px-4 py-2.5 hover:bg-lattice-deep transition-colors text-left"
            >
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">{topic.category}</p>
              <p className="font-semibold text-white text-sm">{topic.tag}</p>
              <p className="text-[11px] text-gray-500">{formatNumber(topic.posts)} posts</p>
            </button>
          ))}
          <button
            onClick={() => setActiveTab('trending')}
            className="w-full px-4 py-3 text-neon-cyan hover:bg-lattice-deep transition-colors text-left text-sm"
          >
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
              <button
                onClick={() => followMutation.mutate(user.id)}
                disabled={followMutation.isPending}
                className="px-3.5 py-1.5 bg-white text-black font-bold rounded-full text-xs hover:bg-gray-200 transition-colors flex-shrink-0 disabled:opacity-50"
              >
                {followMutation.isPending ? '...' : 'Follow'}
              </button>
            </div>
          ))}
          <button
            onClick={() => useUIStore.getState().addToast({ type: 'info', message: 'Discover more users in the social lens' })}
            className="w-full px-4 py-3 text-neon-cyan hover:bg-lattice-deep transition-colors text-left text-sm"
          >
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
            <button
              key={rel.id}
              onClick={() => setSearchQuery(rel.title)}
              className="w-full px-4 py-2.5 hover:bg-lattice-deep transition-colors flex items-center gap-3 text-left"
            >
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
          <button
            onClick={() => setActiveTab('releases')}
            className="w-full px-4 py-3 text-neon-cyan hover:bg-lattice-deep transition-colors text-left text-sm"
          >
            View all releases
          </button>
        </div>

        {/* Footer links */}
        <div className="px-4 text-[11px] text-gray-600 leading-relaxed">
          Terms &middot; Privacy &middot; Cookies &middot; Accessibility &middot; About &middot; Concord &copy; 2026
        </div>
      </aside>

      {/* DTU Context */}
      <div className="mt-6 space-y-3">
        <LensContextPanel
          hyperDTUs={hyperDTUs}
          megaDTUs={megaDTUs}
          regularDTUs={regularDTUs}
          tierDistribution={tierDistribution}
          onPublish={(dtu) => publishToMarketplace({ dtuId: dtu.id })}
          title="Feed DTUs"
        />
        <FeedbackWidget targetType="lens" targetId="feed" />
      </div>
    </div>
  );
}
