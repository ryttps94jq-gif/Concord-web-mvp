'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Clock,
  Send,
  X,
  Music,
  Paintbrush,
  PenTool,
  Mic2,
  Disc3,
  Globe,
  Lock,
  Mail,
  UserPlus,
  LogOut,
  Settings,
  Upload,
  Monitor,
  MessageSquare,
  Check,
  XCircle,
  Crown,
  Radio,
  Hash,
  FileAudio,
  Paperclip,
  Timer,
  Archive,
  Search,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProjectType = 'beat' | 'song' | 'remix' | 'art' | 'writing';
type SessionStatus = 'open' | 'in-progress' | 'full' | 'private';
type Privacy = 'public' | 'private' | 'invite-only';
type ParticipantRole = 'host' | 'producer' | 'vocalist' | 'mixer' | 'artist' | 'writer';
type MainTab = 'active' | 'mine' | 'invitations' | 'history';
type FilterPill = 'all' | ProjectType;

interface Participant {
  id: string;
  name: string;
  avatar: string;
  role: ParticipantRole;
  online: boolean;
}

interface CollabSession {
  id: string;
  name: string;
  projectType: ProjectType;
  host: Participant;
  participants: Participant[];
  status: SessionStatus;
  privacy: Privacy;
  genre: string[];
  maxCapacity: number;
  description: string;
  startedAt: number;
  linkedProjectId?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

interface Invitation {
  id: string;
  sessionName: string;
  fromName: string;
  fromAvatar: string;
  projectType: ProjectType;
  genre: string;
  sentAt: number;
}

interface HistoryEntry {
  id: string;
  sessionName: string;
  projectType: ProjectType;
  duration: number;
  participantCount: number;
  filesShared: number;
  endedAt: number;
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const AVATARS = [
  'bg-gradient-to-br from-neon-blue to-neon-purple',
  'bg-gradient-to-br from-neon-cyan to-neon-blue',
  'bg-gradient-to-br from-neon-purple to-pink-500',
  'bg-gradient-to-br from-amber-500 to-orange-600',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-rose-500 to-red-600',
  'bg-gradient-to-br from-violet-500 to-indigo-600',
  'bg-gradient-to-br from-sky-400 to-blue-600',
];

const NAMES = [
  'ProdByVex', 'LunaBeatsmith', 'AceOnTheTrack', 'SketchQueen',
  'RhymeCraft', 'WaveSurgeon', 'NovaMelody', 'BassAlchemy',
  'InkFlow', 'PixelDrift', 'VocalFire', 'SynthLord',
];

function makePart(idx: number, role: ParticipantRole, online = true): Participant {
  return {
    id: `p-${idx}`,
    name: NAMES[idx % NAMES.length],
    avatar: AVATARS[idx % AVATARS.length],
    role,
    online,
  };
}

const INITIAL_SESSIONS: CollabSession[] = [
  {
    id: 'cs-1',
    name: 'Midnight Trap Session',
    projectType: 'beat',
    host: makePart(0, 'host'),
    participants: [makePart(0, 'host'), makePart(1, 'producer'), makePart(2, 'mixer')],
    status: 'open',
    privacy: 'public',
    genre: ['Trap', 'Hip-Hop'],
    maxCapacity: 6,
    description: 'Late night trap cooking. Bring your 808s.',
    startedAt: Date.now() - 3_420_000,
  },
  {
    id: 'cs-2',
    name: 'R&B Vocals Collab',
    projectType: 'song',
    host: makePart(3, 'host'),
    participants: [makePart(3, 'host'), makePart(4, 'vocalist'), makePart(5, 'producer'), makePart(6, 'mixer')],
    status: 'in-progress',
    privacy: 'public',
    genre: ['R&B', 'Soul'],
    maxCapacity: 5,
    description: 'Working on a soulful R&B track. Need vocalists.',
    startedAt: Date.now() - 7_200_000,
  },
  {
    id: 'cs-3',
    name: 'Lo-Fi Remix Challenge',
    projectType: 'remix',
    host: makePart(7, 'host'),
    participants: [makePart(7, 'host'), makePart(8, 'producer')],
    status: 'open',
    privacy: 'public',
    genre: ['Lo-Fi', 'Chill'],
    maxCapacity: 4,
    description: 'Remixing classic jazz samples into lo-fi beats.',
    startedAt: Date.now() - 1_800_000,
  },
  {
    id: 'cs-4',
    name: 'Album Art Workshop',
    projectType: 'art',
    host: makePart(9, 'host'),
    participants: [makePart(9, 'host'), makePart(10, 'artist')],
    status: 'open',
    privacy: 'invite-only',
    genre: ['Visual', 'Design'],
    maxCapacity: 3,
    description: 'Designing cover art for upcoming EP release.',
    startedAt: Date.now() - 5_400_000,
  },
  {
    id: 'cs-5',
    name: 'Songwriting Circle',
    projectType: 'writing',
    host: makePart(11, 'host'),
    participants: [makePart(11, 'host'), makePart(0, 'writer'), makePart(1, 'writer'), makePart(2, 'vocalist')],
    status: 'in-progress',
    privacy: 'public',
    genre: ['Pop', 'Indie'],
    maxCapacity: 6,
    description: 'Collaborative songwriting. Bring lyrics and melodies.',
    startedAt: Date.now() - 10_800_000,
  },
  {
    id: 'cs-6',
    name: 'Drill Production Lab',
    projectType: 'beat',
    host: makePart(4, 'host'),
    participants: [makePart(4, 'host'), makePart(5, 'producer'), makePart(6, 'mixer'), makePart(7, 'producer'), makePart(8, 'vocalist')],
    status: 'full',
    privacy: 'public',
    genre: ['Drill', 'UK Drill'],
    maxCapacity: 5,
    description: 'Heavy drill session. Sliding hi-hats and dark pads.',
    startedAt: Date.now() - 14_400_000,
  },
  {
    id: 'cs-7',
    name: 'Private Studio Lockout',
    projectType: 'song',
    host: makePart(3, 'host'),
    participants: [makePart(3, 'host'), makePart(10, 'vocalist')],
    status: 'private',
    privacy: 'private',
    genre: ['Pop', 'Electronic'],
    maxCapacity: 4,
    description: 'Locked session for album work. Invite only.',
    startedAt: Date.now() - 2_700_000,
  },
  {
    id: 'cs-8',
    name: 'Ambient Soundscapes',
    projectType: 'remix',
    host: makePart(6, 'host'),
    participants: [makePart(6, 'host'), makePart(11, 'producer'), makePart(0, 'mixer')],
    status: 'open',
    privacy: 'public',
    genre: ['Ambient', 'Experimental'],
    maxCapacity: 5,
    description: 'Creating immersive ambient textures and soundscapes.',
    startedAt: Date.now() - 4_500_000,
  },
];

const INITIAL_CHAT: ChatMessage[] = [
  { id: 'm-1', senderId: 'p-0', senderName: 'ProdByVex', senderAvatar: AVATARS[0], text: 'Yo, session is live. Drop your stems in the shared folder.', timestamp: Date.now() - 3_300_000 },
  { id: 'm-2', senderId: 'system', senderName: 'System', senderAvatar: '', text: 'LunaBeatsmith joined the session', timestamp: Date.now() - 3_200_000, isSystem: true },
  { id: 'm-3', senderId: 'p-1', senderName: 'LunaBeatsmith', senderAvatar: AVATARS[1], text: 'Hey! Got some fire 808 patterns ready to go.', timestamp: Date.now() - 3_100_000 },
  { id: 'm-4', senderId: 'p-0', senderName: 'ProdByVex', senderAvatar: AVATARS[0], text: 'Perfect. The BPM is set to 145. Key of F minor.', timestamp: Date.now() - 2_900_000 },
  { id: 'm-5', senderId: 'system', senderName: 'System', senderAvatar: '', text: 'AceOnTheTrack joined the session', timestamp: Date.now() - 2_700_000, isSystem: true },
  { id: 'm-6', senderId: 'p-2', senderName: 'AceOnTheTrack', senderAvatar: AVATARS[2], text: 'What up! I can handle the mix when you guys lay down the parts.', timestamp: Date.now() - 2_500_000 },
  { id: 'm-7', senderId: 'p-1', senderName: 'LunaBeatsmith', senderAvatar: AVATARS[1], text: 'Check the timeline, just dropped the main loop.', timestamp: Date.now() - 2_000_000 },
  { id: 'm-8', senderId: 'p-0', senderName: 'ProdByVex', senderAvatar: AVATARS[0], text: 'That melody is crazy. Let me add some counter-melody.', timestamp: Date.now() - 1_500_000 },
  { id: 'm-9', senderId: 'p-2', senderName: 'AceOnTheTrack', senderAvatar: AVATARS[2], text: 'I added some compression on the master bus. Sounds way punchier now.', timestamp: Date.now() - 900_000 },
  { id: 'm-10', senderId: 'p-1', senderName: 'LunaBeatsmith', senderAvatar: AVATARS[1], text: 'Uploaded a vocal chop sample pack in the files section.', timestamp: Date.now() - 600_000 },
  { id: 'm-11', senderId: 'p-0', senderName: 'ProdByVex', senderAvatar: AVATARS[0], text: 'This is turning out heat. Let me bounce a rough mix.', timestamp: Date.now() - 300_000 },
  { id: 'm-12', senderId: 'system', senderName: 'System', senderAvatar: '', text: 'ProdByVex shared a file: rough_mix_v1.wav', timestamp: Date.now() - 200_000, isSystem: true },
];

const INITIAL_INVITATIONS: Invitation[] = [
  { id: 'inv-1', sessionName: 'Late Night Vibes', fromName: 'SynthLord', fromAvatar: AVATARS[5], projectType: 'beat', genre: 'Synthwave', sentAt: Date.now() - 1_800_000 },
  { id: 'inv-2', sessionName: 'Cover Art Sprint', fromName: 'PixelDrift', fromAvatar: AVATARS[3], projectType: 'art', genre: 'Design', sentAt: Date.now() - 7_200_000 },
  { id: 'inv-3', sessionName: 'Hook Writing Jam', fromName: 'VocalFire', fromAvatar: AVATARS[6], projectType: 'writing', genre: 'Pop', sentAt: Date.now() - 14_400_000 },
];

const INITIAL_HISTORY: HistoryEntry[] = [
  { id: 'h-1', sessionName: 'Boom Bap Revival', projectType: 'beat', duration: 7_200_000, participantCount: 4, filesShared: 12, endedAt: Date.now() - 86_400_000 },
  { id: 'h-2', sessionName: 'EDM Drop Workshop', projectType: 'remix', duration: 5_400_000, participantCount: 3, filesShared: 8, endedAt: Date.now() - 172_800_000 },
  { id: 'h-3', sessionName: 'Acoustic Ballad', projectType: 'song', duration: 10_800_000, participantCount: 2, filesShared: 5, endedAt: Date.now() - 259_200_000 },
  { id: 'h-4', sessionName: 'Brand Identity Kit', projectType: 'art', duration: 3_600_000, participantCount: 2, filesShared: 15, endedAt: Date.now() - 345_600_000 },
  { id: 'h-5', sessionName: 'Concept Album Lyrics', projectType: 'writing', duration: 14_400_000, participantCount: 5, filesShared: 3, endedAt: Date.now() - 604_800_000 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<ProjectType, typeof Music> = {
  beat: Disc3,
  song: Mic2,
  remix: Radio,
  art: Paintbrush,
  writing: PenTool,
};

const TYPE_COLORS: Record<ProjectType, string> = {
  beat: 'text-neon-blue',
  song: 'text-neon-purple',
  remix: 'text-neon-cyan',
  art: 'text-amber-400',
  writing: 'text-emerald-400',
};

const STATUS_STYLES: Record<SessionStatus, string> = {
  'open': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'in-progress': 'bg-neon-blue/20 text-neon-blue border-neon-blue/30',
  'full': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'private': 'bg-neon-purple/20 text-neon-purple border-neon-purple/30',
};

const ROLE_BADGE: Record<ParticipantRole, { label: string; color: string }> = {
  host: { label: 'Host', color: 'bg-amber-500/20 text-amber-400' },
  producer: { label: 'Producer', color: 'bg-neon-blue/20 text-neon-blue' },
  vocalist: { label: 'Vocalist', color: 'bg-neon-purple/20 text-neon-purple' },
  mixer: { label: 'Mixer', color: 'bg-neon-cyan/20 text-neon-cyan' },
  artist: { label: 'Artist', color: 'bg-amber-400/20 text-amber-400' },
  writer: { label: 'Writer', color: 'bg-emerald-400/20 text-emerald-400' },
};

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CollabLensPage() {
  useLensNav('collab');
  const _queryClient = useQueryClient();

  const { items: _sessionItems, create: _createSession } = useLensData('collab', 'session', {
    seed: INITIAL_SESSIONS.map(s => ({ title: s.name, data: s as unknown as Record<string, unknown> })),
  });

  const [activeTab, setActiveTab] = useState<MainTab>('active');
  const [filterPill, setFilterPill] = useState<FilterPill>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeSession, setActiveSession] = useState<CollabSession | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Queries -- fall back to demo data
  const { data: _sessionsData } = useQuery({
    queryKey: ['artistry-collab-sessions'],
    queryFn: () => api.get('/api/artistry/collab/sessions').then(r => r.data),
    refetchInterval: 8000,
    retry: 1,
  });

  const { data: _collabData } = useQuery({
    queryKey: ['collab-sessions'],
    queryFn: () => api.get('/api/collab/sessions').then(r => r.data),
    refetchInterval: 8000,
    retry: 1,
  });

  const sessions: CollabSession[] = INITIAL_SESSIONS;
  const onlineCount = sessions.reduce((n, s) => n + s.participants.filter(p => p.online).length, 0);

  // Filter sessions
  const filteredSessions = sessions.filter(s => {
    if (filterPill !== 'all' && s.projectType !== filterPill) return false;
    if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const mySessions = sessions.filter(s => s.host.id === 'p-0' || s.participants.some(p => p.id === 'p-0'));

  const TABS: { key: MainTab; label: string; count?: number }[] = [
    { key: 'active', label: 'Active Sessions', count: sessions.length },
    { key: 'mine', label: 'My Sessions', count: mySessions.length },
    { key: 'invitations', label: 'Invitations', count: INITIAL_INVITATIONS.length },
    { key: 'history', label: 'Session History' },
  ];

  const PILLS: { key: FilterPill; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'beat', label: 'Beats' },
    { key: 'song', label: 'Songs' },
    { key: 'remix', label: 'Remixes' },
    { key: 'art', label: 'Art' },
    { key: 'writing', label: 'Writing' },
  ];

  // If viewing an active session
  if (activeSession) {
    return (
      <ActiveSessionView
        session={activeSession}
        onLeave={() => setActiveSession(null)}
      />
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-[1440px] mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Collaboration Hub</h1>
            <p className="text-sm text-gray-400">Create, join, and collaborate in real time</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">{onlineCount} online</span>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Session
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="flex items-center gap-1 border-b border-lattice-border">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-neon-blue text-neon-blue'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn(
                'ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full',
                activeTab === tab.key ? 'bg-neon-blue/20 text-neon-blue' : 'bg-gray-700 text-gray-400'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'active' && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Filter pills + search */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {PILLS.map(pill => (
                  <button
                    key={pill.key}
                    onClick={() => setFilterPill(pill.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                      filterPill === pill.key
                        ? 'bg-neon-blue/20 text-neon-blue border-neon-blue/40'
                        : 'bg-lattice-surface text-gray-400 border-lattice-border hover:border-gray-500'
                    )}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm bg-lattice-surface border border-lattice-border rounded-lg w-56 focus:outline-none focus:border-neon-blue/50"
                />
              </div>
            </div>

            {/* Session grid */}
            {filteredSessions.length === 0 ? (
              <div className="panel p-12 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No sessions found</p>
                <p className="text-sm mt-1">Try adjusting your filters or create a new session.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onJoin={() => setActiveSession(session)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'mine' && (
          <motion.div
            key="mine"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {mySessions.length === 0 ? (
              <div className="panel p-12 text-center text-gray-400">
                <Music className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No active sessions</p>
                <p className="text-sm mt-1">Create or join a session to see it here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {mySessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onJoin={() => setActiveSession(session)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'invitations' && (
          <motion.div
            key="invitations"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {INITIAL_INVITATIONS.map(inv => (
              <InvitationCard key={inv.id} invitation={inv} />
            ))}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {INITIAL_HISTORY.map(entry => (
              <HistoryCard key={entry.id} entry={entry} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create session modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateSessionModal onClose={() => setShowCreateModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session Card
// ---------------------------------------------------------------------------

function SessionCard({ session, onJoin }: { session: CollabSession; onJoin: () => void }) {
  const TypeIcon = TYPE_ICONS[session.projectType];
  const elapsed = Date.now() - session.startedAt;
  const isPrivate = session.privacy === 'private' || session.privacy === 'invite-only';

  return (
    <motion.div
      layout
      className="lens-card p-4 space-y-3 hover:border-neon-blue/30 transition-colors cursor-pointer group"
      onClick={onJoin}
    >
      {/* Top row: type icon + name + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-lattice-surface shrink-0', TYPE_COLORS[session.projectType])}>
            <TypeIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate group-hover:text-neon-blue transition-colors">
              {session.name}
            </h3>
            <p className="text-[11px] text-gray-500 capitalize">{session.projectType}</p>
          </div>
        </div>
        <span className={cn(
          'text-[10px] px-2 py-0.5 rounded-full border shrink-0 capitalize font-medium',
          STATUS_STYLES[session.status]
        )}>
          {session.status}
        </span>
      </div>

      {/* Host */}
      <div className="flex items-center gap-2">
        <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white', session.host.avatar)}>
          {session.host.name[0]}
        </div>
        <span className="text-xs text-gray-400">
          Hosted by <span className="text-gray-200">{session.host.name}</span>
        </span>
      </div>

      {/* Genre tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {session.genre.map(g => (
          <span key={g} className="text-[10px] px-2 py-0.5 bg-lattice-surface border border-lattice-border rounded-full text-gray-400">
            <Hash className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />{g}
          </span>
        ))}
      </div>

      {/* Bottom row: participants + timer + join */}
      <div className="flex items-center justify-between pt-1 border-t border-lattice-border">
        <div className="flex items-center gap-3">
          {/* Stacked avatars */}
          <div className="flex items-center -space-x-1.5">
            {session.participants.slice(0, 3).map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  'w-6 h-6 rounded-full border-2 border-lattice-surface flex items-center justify-center text-[8px] font-bold text-white',
                  p.avatar
                )}
                style={{ zIndex: 10 - i }}
                title={p.name}
              >
                {p.name[0]}
              </div>
            ))}
            {session.participants.length > 3 && (
              <div className="w-6 h-6 rounded-full border-2 border-lattice-surface bg-gray-700 flex items-center justify-center text-[9px] text-gray-300 font-medium" style={{ zIndex: 6 }}>
                +{session.participants.length - 3}
              </div>
            )}
          </div>
          <span className="text-[11px] text-gray-500">
            {session.participants.length}/{session.maxCapacity}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <Timer className="w-3 h-3" />
            {formatDuration(elapsed)}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onJoin(); }}
          className={cn(
            'text-xs px-3 py-1 rounded-md font-medium transition-colors',
            session.status === 'full'
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : isPrivate
              ? 'bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30'
              : 'bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30'
          )}
          disabled={session.status === 'full'}
        >
          {session.status === 'full' ? 'Full' : isPrivate ? 'Request' : 'Join'}
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Active Session View
// ---------------------------------------------------------------------------

function ActiveSessionView({ session, onLeave }: { session: CollabSession; onLeave: () => void }) {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(Date.now() - session.startedAt);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - session.startedAt), 1000);
    return () => clearInterval(t);
  }, [session.startedAt]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, {
      id: `m-${Date.now()}`,
      senderId: 'me',
      senderName: 'You',
      senderAvatar: AVATARS[0],
      text: chatInput.trim(),
      timestamp: Date.now(),
    }]);
    setChatInput('');
  }, [chatInput]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-lattice-border bg-lattice-surface/50">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', TYPE_COLORS[session.projectType])}>
            {(() => { const I = TYPE_ICONS[session.projectType]; return <I className="w-4 h-4" />; })()}
          </div>
          <div>
            <h2 className="font-semibold text-sm">{session.name}</h2>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{formatDuration(elapsed)}</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{session.participants.length}/{session.maxCapacity}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium"
        >
          <LogOut className="w-3.5 h-3.5" />
          Leave
        </button>
      </div>

      {/* Main content: 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: participants */}
        <div className="w-56 border-r border-lattice-border bg-lattice-surface/30 p-3 flex flex-col gap-1 overflow-y-auto shrink-0">
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
            Participants ({session.participants.length})
          </h3>
          {session.participants.map(p => (
            <div key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-lattice-surface transition-colors">
              <div className="relative">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white', p.avatar)}>
                  {p.name[0]}
                </div>
                <span className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-lattice-surface',
                  p.online ? 'bg-emerald-400' : 'bg-gray-600'
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{p.name}</p>
                <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', ROLE_BADGE[p.role].color)}>
                  {p.role === 'host' && <Crown className="w-2 h-2 inline mr-0.5 -mt-px" />}
                  {ROLE_BADGE[p.role].label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Center: shared workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {/* Project timeline placeholder */}
            <div className="panel p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Project Timeline</h3>
              <div className="space-y-2">
                {['Intro', 'Verse 1', 'Hook', 'Verse 2', 'Bridge', 'Outro'].map((section, i) => (
                  <div key={section} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-12 text-right">{(i * 8) + 1}-{(i + 1) * 8}</span>
                    <div
                      className={cn(
                        'h-7 rounded flex items-center px-2 text-[11px] font-medium',
                        i % 3 === 0 ? 'bg-neon-blue/15 text-neon-blue' :
                        i % 3 === 1 ? 'bg-neon-purple/15 text-neon-purple' :
                        'bg-neon-cyan/15 text-neon-cyan'
                      )}
                      style={{ width: `${Math.max(60, Math.random() * 100)}%` }}
                    >
                      {section}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shared notes */}
            <div className="panel p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Shared Notes</h3>
              <div className="bg-lattice-surface rounded-lg p-3 text-sm text-gray-300 space-y-2 min-h-[80px]">
                <p>- BPM: 145 | Key: F minor</p>
                <p>- Main melody uses pentatonic scale with chromatic runs</p>
                <p>- 808 pattern: half-time bounce with triplet rolls at bar 4</p>
                <p>- Vocal chops layered on hook section, need reverb tail</p>
                <p>- Reference tracks: Metro Boomin, Southside style</p>
              </div>
            </div>

            {/* Shared files */}
            <div className="panel p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Shared Files</h3>
              <div className="space-y-1.5">
                {[
                  { name: 'main_melody_v2.mid', size: '12 KB', by: 'LunaBeatsmith' },
                  { name: '808_bounce.wav', size: '2.4 MB', by: 'ProdByVex' },
                  { name: 'vocal_chops_pack.zip', size: '18 MB', by: 'LunaBeatsmith' },
                  { name: 'rough_mix_v1.wav', size: '8.1 MB', by: 'ProdByVex' },
                ].map(f => (
                  <div key={f.name} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-lattice-surface transition-colors">
                    <div className="flex items-center gap-2">
                      <FileAudio className="w-3.5 h-3.5 text-neon-cyan" />
                      <span className="text-xs font-medium">{f.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                      <span>{f.size}</span>
                      <span>{f.by}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center gap-2 px-5 py-3 border-t border-lattice-border bg-lattice-surface/50">
            <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-lattice-surface border border-lattice-border text-gray-300 hover:border-neon-blue/40 transition-colors">
              <Monitor className="w-3.5 h-3.5" /> Share Screen
            </button>
            <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-lattice-surface border border-lattice-border text-gray-300 hover:border-neon-blue/40 transition-colors">
              <Upload className="w-3.5 h-3.5" /> Upload File
            </button>
            <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-lattice-surface border border-lattice-border text-gray-300 hover:border-neon-blue/40 transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Invite
            </button>
            <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-lattice-surface border border-lattice-border text-gray-300 hover:border-neon-blue/40 transition-colors">
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
          </div>
        </div>

        {/* Right panel: live chat */}
        <div className="w-72 border-l border-lattice-border flex flex-col shrink-0">
          <div className="px-3 py-2.5 border-b border-lattice-border">
            <h3 className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Live Chat
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.isSystem ? (
                  <p className="text-[10px] text-gray-600 text-center italic py-1">{msg.text}</p>
                ) : (
                  <div className="flex gap-2">
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 mt-0.5', msg.senderAvatar)}>
                      {msg.senderName[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-semibold text-gray-300">{msg.senderName}</span>
                        <span className="text-[9px] text-gray-600">{formatTimestamp(msg.timestamp)}</span>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed break-words">{msg.text}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2 border-t border-lattice-border">
            <div className="flex items-center gap-1.5">
              <button className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors">
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                className="flex-1 text-xs py-1.5 px-2.5 bg-lattice-surface border border-lattice-border rounded-md focus:outline-none focus:border-neon-blue/50"
              />
              <button
                onClick={sendMessage}
                className="p-1.5 text-neon-blue hover:text-neon-cyan transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invitation Card
// ---------------------------------------------------------------------------

function InvitationCard({ invitation }: { invitation: Invitation }) {
  const [responded, setResponded] = useState<'accepted' | 'declined' | null>(null);
  const TypeIcon = TYPE_ICONS[invitation.projectType];

  if (responded) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 0.5 }}
        className="panel p-4 flex items-center justify-between"
      >
        <span className="text-sm text-gray-500">
          {responded === 'accepted' ? 'Accepted' : 'Declined'}: {invitation.sessionName}
        </span>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          responded === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
        )}>
          {responded === 'accepted' ? <Check className="w-3 h-3 inline mr-0.5" /> : <XCircle className="w-3 h-3 inline mr-0.5" />}
          {responded}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div layout className="panel p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white', invitation.fromAvatar)}>
          {invitation.fromName[0]}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            <span className="text-gray-200">{invitation.fromName}</span>
            <span className="text-gray-500"> invited you to </span>
            <span className="text-neon-blue">{invitation.sessionName}</span>
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <TypeIcon className={cn('w-3 h-3', TYPE_COLORS[invitation.projectType])} />
            <span className="text-[11px] text-gray-500 capitalize">{invitation.projectType}</span>
            <span className="text-[11px] text-gray-600">|</span>
            <span className="text-[11px] text-gray-500">{invitation.genre}</span>
            <span className="text-[11px] text-gray-600">|</span>
            <span className="text-[11px] text-gray-500">{formatTimeAgo(invitation.sentAt)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setResponded('declined')}
          className="text-xs px-3 py-1.5 rounded-md bg-lattice-surface border border-lattice-border text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
        >
          Decline
        </button>
        <button
          onClick={() => setResponded('accepted')}
          className="text-xs px-3 py-1.5 rounded-md bg-neon-blue/20 text-neon-blue hover:bg-neon-blue/30 font-medium transition-colors"
        >
          Accept
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// History Card
// ---------------------------------------------------------------------------

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const TypeIcon = TYPE_ICONS[entry.projectType];
  return (
    <div className="panel p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center bg-lattice-surface', TYPE_COLORS[entry.projectType])}>
          <TypeIcon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium truncate">{entry.sessionName}</h3>
          <p className="text-[11px] text-gray-500 capitalize">{entry.projectType} session</p>
        </div>
      </div>
      <div className="flex items-center gap-5 text-[11px] text-gray-500 shrink-0">
        <div className="flex items-center gap-1" title="Duration">
          <Clock className="w-3 h-3" />
          {formatDuration(entry.duration)}
        </div>
        <div className="flex items-center gap-1" title="Participants">
          <Users className="w-3 h-3" />
          {entry.participantCount}
        </div>
        <div className="flex items-center gap-1" title="Files shared">
          <FileAudio className="w-3 h-3" />
          {entry.filesShared}
        </div>
        <div className="flex items-center gap-1" title="Ended">
          <Archive className="w-3 h-3" />
          {formatTimeAgo(entry.endedAt)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Session Modal
// ---------------------------------------------------------------------------

function CreateSessionModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    type: 'beat' as ProjectType,
    genre: '',
    maxParticipants: 6,
    privacy: 'public' as Privacy,
    description: '',
    linkedProjectId: '',
  });

  const { data: projectsData } = useQuery({
    queryKey: ['studio-projects-for-link'],
    queryFn: () => api.get('/api/artistry/studio/projects').then(r => r.data),
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post('/api/artistry/collab/sessions', {
        projectId: data.linkedProjectId || undefined,
        maxParticipants: data.maxParticipants,
        mode: data.privacy,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artistry-collab-sessions'] });
      onClose();
    },
  });

  const projects: { id: string; title: string }[] = projectsData?.projects ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-lattice-surface border border-lattice-border rounded-xl p-6 w-full max-w-lg space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Create Session</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Session name */}
        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Session Name</label>
          <input
            type="text"
            placeholder="e.g. Late Night Beat Session"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-lattice-surface border border-lattice-border rounded-lg focus:outline-none focus:border-neon-blue/50"
          />
        </div>

        {/* Type + Genre row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Type</label>
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as ProjectType })}
              className="w-full px-3 py-2 text-sm bg-lattice-surface border border-lattice-border rounded-lg focus:outline-none focus:border-neon-blue/50"
            >
              <option value="beat">Beat</option>
              <option value="song">Song</option>
              <option value="remix">Remix</option>
              <option value="art">Art</option>
              <option value="writing">Writing</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Genre</label>
            <input
              type="text"
              placeholder="e.g. Trap, Lo-Fi"
              value={form.genre}
              onChange={e => setForm({ ...form, genre: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-lattice-surface border border-lattice-border rounded-lg focus:outline-none focus:border-neon-blue/50"
            />
          </div>
        </div>

        {/* Max participants + Privacy row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Max Participants</label>
            <select
              value={form.maxParticipants}
              onChange={e => setForm({ ...form, maxParticipants: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm bg-lattice-surface border border-lattice-border rounded-lg focus:outline-none focus:border-neon-blue/50"
            >
              {[2, 3, 4, 5, 6, 8, 10].map(n => (
                <option key={n} value={n}>{n} participants</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Privacy</label>
            <select
              value={form.privacy}
              onChange={e => setForm({ ...form, privacy: e.target.value as Privacy })}
              className="w-full px-3 py-2 text-sm bg-lattice-surface border border-lattice-border rounded-lg focus:outline-none focus:border-neon-blue/50"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="invite-only">Invite Only</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Description</label>
          <textarea
            placeholder="What's this session about?"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 text-sm bg-lattice-surface border border-lattice-border rounded-lg focus:outline-none focus:border-neon-blue/50 resize-none"
          />
        </div>

        {/* Link existing project */}
        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Link Existing Project (optional)</label>
          <select
            value={form.linkedProjectId}
            onChange={e => setForm({ ...form, linkedProjectId: e.target.value })}
            className="w-full px-3 py-2 text-sm bg-lattice-surface border border-lattice-border rounded-lg focus:outline-none focus:border-neon-blue/50"
          >
            <option value="">No linked project</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.title || `Project ${p.id.slice(-6)}`}</option>
            ))}
          </select>
        </div>

        {/* Privacy indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {form.privacy === 'public' && <><Globe className="w-3.5 h-3.5 text-emerald-400" /> Anyone can join this session</>}
          {form.privacy === 'private' && <><Lock className="w-3.5 h-3.5 text-neon-purple" /> Only people with the link can join</>}
          {form.privacy === 'invite-only' && <><Mail className="w-3.5 h-3.5 text-amber-400" /> Only invited users can join</>}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate(form)}
            disabled={!form.name.trim() || createMutation.isPending}
            className={cn(
              'btn-primary px-5 py-2 rounded-lg text-sm font-medium',
              (!form.name.trim() || createMutation.isPending) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
