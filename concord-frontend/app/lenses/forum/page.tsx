'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  Bookmark,
  BookmarkCheck,
  TrendingUp,
  Clock,
  Flame,
  Users,
  Plus,
  Search,
  X,
  Send,
  Award,
  Pin,
  Lock,
  Trash2,
  ChevronDown,
  ExternalLink,
  Copy,
  Flag,
  Shield,
  Eye,
  ArrowLeft,
  Hash,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserProfile {
  username: string;
  displayName: string;
  avatar: string;
  karma: number;
  joinedAt: string;
  bio: string;
  postCount: number;
  commentCount: number;
}

interface Comment {
  id: string;
  author: UserProfile;
  content: string;
  score: number;
  userVote: number;
  createdAt: string;
  awards: string[];
  replies: Comment[];
  collapsed: boolean;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: UserProfile;
  community: string;
  score: number;
  userVote: number;
  commentCount: number;
  createdAt: string;
  tags: string[];
  flair?: { text: string; color: string };
  pinned: boolean;
  locked: boolean;
  removed: boolean;
  awards: string[];
  saved: boolean;
  comments: Comment[];
  views: number;
}

interface Community {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  icon: string;
  banner: string;
  joined: boolean;
  rules: string[];
  createdAt: string;
  moderators: string[];
}

type SortMode = 'hot' | 'new' | 'top' | 'rising';
type ViewMode = 'feed' | 'detail' | 'profile';

// ---------------------------------------------------------------------------
// Award definitions
// ---------------------------------------------------------------------------

const AWARDS = [
  { id: 'fire', emoji: '\uD83D\uDD25', name: 'Fire Track', cost: 100 },
  { id: 'gold', emoji: '\uD83C\uDFC6', name: 'Gold Record', cost: 500 },
  { id: 'platinum', emoji: '\uD83D\uDC8E', name: 'Platinum', cost: 1000 },
  { id: 'headphones', emoji: '\uD83C\uDFA7', name: 'Headphones', cost: 50 },
  { id: 'mic', emoji: '\uD83C\uDFA4', name: 'Mic Drop', cost: 250 },
  { id: 'vinyl', emoji: '\uD83D\uDCBF', name: 'Vinyl Press', cost: 750 },
];

const FLAIRS = [
  { text: 'Discussion', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { text: 'Tutorial', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { text: 'Showcase', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { text: 'Question', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { text: 'Collab', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  { text: 'News', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
];

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const INITIAL_USERS: Record<string, UserProfile> = {
  beatsmith: { username: 'beatsmith', displayName: 'BeatSmith', avatar: 'BS', karma: 14820, joinedAt: '2024-03-15', bio: 'Producer / Sound Designer. Ableton + Serum enthusiast.', postCount: 47, commentCount: 312 },
  synthwave99: { username: 'synthwave99', displayName: 'SynthWave99', avatar: 'SW', karma: 9340, joinedAt: '2024-06-01', bio: 'Retro synth lover. Juno-106 is king.', postCount: 28, commentCount: 189 },
  voxqueen: { username: 'voxqueen', displayName: 'VoxQueen', avatar: 'VQ', karma: 22100, joinedAt: '2023-11-20', bio: 'Vocalist & vocal producer. Melodyne wizard.', postCount: 63, commentCount: 540 },
  bassdrop: { username: 'bassdrop', displayName: 'BassDrop', avatar: 'BD', karma: 7650, joinedAt: '2024-09-10', bio: 'Bass music producer. Sub frequencies are life.', postCount: 19, commentCount: 97 },
  loficharlie: { username: 'loficharlie', displayName: 'LofiCharlie', avatar: 'LC', karma: 5200, joinedAt: '2025-01-05', bio: 'Lo-fi beats and vinyl crackle.', postCount: 12, commentCount: 68 },
  mixmaster_t: { username: 'mixmaster_t', displayName: 'MixMaster T', avatar: 'MT', karma: 31400, joinedAt: '2023-08-12', bio: 'Mixing & mastering engineer. 15+ years in the game.', postCount: 85, commentCount: 720 },
  drumcode_x: { username: 'drumcode_x', displayName: 'DrumCode_X', avatar: 'DX', karma: 11200, joinedAt: '2024-04-22', bio: 'Techno producer. Analog drum machines only.', postCount: 34, commentCount: 201 },
  melodicmind: { username: 'melodicmind', displayName: 'MelodicMind', avatar: 'MM', karma: 8900, joinedAt: '2024-07-18', bio: 'Songwriter and melodic producer. Keys player.', postCount: 22, commentCount: 155 },
};

const INITIAL_COMMUNITIES: Community[] = [
  { id: 'production', name: 'Production', description: 'General music production discussion, tips, and workflow talk.', memberCount: 24500, icon: '\uD83C\uDFDB\uFE0F', banner: 'from-cyan-600 to-blue-700', joined: true, rules: ['Be constructive', 'No self-promo spam', 'Tag your DAW'], createdAt: '2023-06-01', moderators: ['mixmaster_t', 'beatsmith'] },
  { id: 'mixing', name: 'Mixing & Mastering', description: 'EQ, compression, spatial effects, and loudness. Get your mix right.', memberCount: 18200, icon: '\uD83C\uDFA7', banner: 'from-purple-600 to-indigo-700', joined: true, rules: ['Share settings when asking for help', 'Use audio examples'], createdAt: '2023-07-15', moderators: ['mixmaster_t'] },
  { id: 'synths', name: 'Synthesizers', description: 'Hardware and software synths, sound design, and patch sharing.', memberCount: 15800, icon: '\uD83C\uDFB9', banner: 'from-pink-600 to-purple-700', joined: false, rules: ['Specify hardware vs software', 'Share presets freely'], createdAt: '2023-08-20', moderators: ['synthwave99'] },
  { id: 'vocals', name: 'Vocals & Recording', description: 'Recording techniques, vocal processing, microphone reviews.', memberCount: 12400, icon: '\uD83C\uDFA4', banner: 'from-red-600 to-pink-700', joined: true, rules: ['Specify your signal chain', 'Be respectful of all skill levels'], createdAt: '2023-09-10', moderators: ['voxqueen'] },
  { id: 'beats', name: 'Beat Making', description: 'Hip-hop, trap, boom bap, and everything in between.', memberCount: 21000, icon: '\uD83E\uDD41', banner: 'from-orange-600 to-red-700', joined: false, rules: ['Credit your samples', 'Feedback threads welcome'], createdAt: '2023-10-01', moderators: ['beatsmith', 'bassdrop'] },
  { id: 'electronic', name: 'Electronic Music', description: 'House, techno, DnB, ambient, IDM, and experimental electronic.', memberCount: 19300, icon: '\u26A1', banner: 'from-green-600 to-teal-700', joined: true, rules: ['Genre-tag your posts', 'No gatekeeping'], createdAt: '2023-11-15', moderators: ['drumcode_x'] },
  { id: 'gear', name: 'Gear & Reviews', description: 'Hardware reviews, studio setup photos, and gear recommendations.', memberCount: 16700, icon: '\uD83D\uDD27', banner: 'from-yellow-600 to-orange-700', joined: false, rules: ['Disclose affiliations', 'Include price context'], createdAt: '2024-01-05', moderators: ['mixmaster_t'] },
  { id: 'lofi', name: 'Lo-Fi & Chill', description: 'Lo-fi hip hop, chill beats, jazzy samples, and tape saturation.', memberCount: 13600, icon: '\u2615', banner: 'from-amber-700 to-stone-700', joined: true, rules: ['Keep it chill', 'Vinyl crackle is not a personality'], createdAt: '2024-02-20', moderators: ['loficharlie'] },
];

function mkComment(id: string, author: string, content: string, score: number, replies: Comment[] = []): Comment {
  const hrs = Math.floor(Math.random() * 48) + 1;
  return { id, author: INITIAL_USERS[author], content, score, userVote: 0, createdAt: new Date(Date.now() - hrs * 3600000).toISOString(), awards: score > 80 ? ['\uD83D\uDD25'] : [], replies, collapsed: false };
}

const INITIAL_POSTS: Post[] = [
  {
    id: 'p1', title: 'Finally nailed that wide stereo image on my mix - here is my approach',
    content: 'After months of muddy mixes, I discovered that the key is NOT to widen everything. I started by keeping kick, bass, and lead vocal dead center in mono. Then I used Haas effect (10-25ms delay) on doubled guitars, with a high-pass at 200Hz on the widened signal. For pads, mid-side EQ to cut lows from the side channel made a huge difference. The mix suddenly had clarity AND width.\n\nMy signal chain for the stereo bus:\n1. Subtle glue compression (2-3dB GR)\n2. Mid-side EQ - slight low cut on sides, gentle high shelf boost on sides\n3. Stereo imager only on the 2-8kHz range\n4. Limiter at -1dB true peak\n\nAnyone else have tips for stereo imaging without losing mono compatibility?',
    author: INITIAL_USERS.mixmaster_t, community: 'mixing', score: 847, userVote: 0, commentCount: 24, createdAt: new Date(Date.now() - 3 * 3600000).toISOString(), tags: ['mixing', 'stereo', 'tips'], flair: FLAIRS[1], pinned: true, locked: false, removed: false, awards: ['\uD83D\uDD25', '\uD83C\uDFC6', '\uD83C\uDFA7'], saved: false, views: 3420,
    comments: [
      mkComment('c1', 'beatsmith', 'This is gold. The mid-side EQ tip alone changed my mixes. I was boosting sides across the whole spectrum like a fool.', 124, [
        mkComment('c1r1', 'mixmaster_t', 'Glad it helped! Yeah, low-end in the sides is the #1 killer of punch in a mix.', 67, [
          mkComment('c1r1r1', 'bassdrop', 'Can confirm. My sub bass was fighting the side information for months before I figured this out.', 31),
        ]),
      ]),
      mkComment('c2', 'voxqueen', 'For vocals I add a very subtle stereo widener on the reverb return only, never on the dry vocal. Keeps it intimate but spacious.', 98, [
        mkComment('c2r1', 'loficharlie', 'Smart. I might try that on my lo-fi vocal chains.', 15),
      ]),
      mkComment('c3', 'synthwave99', 'Haas effect is so underrated compared to just cranking a stereo knob. Great breakdown.', 56),
    ],
  },
  {
    id: 'p2', title: 'Serum vs Vital for sound design in 2026 - which are you using?',
    content: 'I have been a Serum user since 2018, but Vital has matured so much that I am starting to question my loyalty. The spectral warping in Vital 2.0 is insane, and it is free/affordable.\n\nThat said, Serum\'s wavetable editor and the sheer volume of presets and tutorials available still gives it an edge for learning.\n\nWhat is everyone\'s daily driver for sound design these days?',
    author: INITIAL_USERS.synthwave99, community: 'synths', score: 532, userVote: 0, commentCount: 18, createdAt: new Date(Date.now() - 7 * 3600000).toISOString(), tags: ['synths', 'serum', 'vital', 'sound-design'], flair: FLAIRS[0], pinned: false, locked: false, removed: false, awards: ['\uD83C\uDFA7'], saved: false, views: 2180,
    comments: [
      mkComment('c4', 'beatsmith', 'Vital for everything now. The modulation system is just more intuitive for me. Plus the CPU usage is lower in my tests.', 87, [
        mkComment('c4r1', 'drumcode_x', 'Vital crashes less for me too. Serum has been rock solid though to be fair.', 23),
      ]),
      mkComment('c5', 'melodicmind', 'I use both honestly. Serum for basses and leads, Vital for pads and textures. Different flavors.', 65),
    ],
  },
  {
    id: 'p3', title: 'How I built a vocal chain that works for ANY genre',
    content: 'After recording and mixing vocals across pop, hip-hop, rock, and electronic for 5 years, I settled on a \"universal\" vocal chain that I tweak per genre:\n\n1. Gain staging to -18dBFS RMS\n2. Subtractive EQ (high-pass at 80-120Hz, notch out resonances)\n3. De-esser (dynamic, 4-8kHz range)\n4. Fast compressor (1176-style, 4:1, fast attack for control)\n5. Slow compressor (LA-2A style, gentle 2-3dB for body)\n6. Additive EQ (air shelf at 10kHz, presence at 3-5kHz)\n7. Saturation (tape-style, subtle)\n8. Reverb/delay sends\n\nThe order matters more than the specific plugins. Fight me.',
    author: INITIAL_USERS.voxqueen, community: 'vocals', score: 1243, userVote: 0, commentCount: 31, createdAt: new Date(Date.now() - 12 * 3600000).toISOString(), tags: ['vocals', 'mixing', 'chain', 'tutorial'], flair: FLAIRS[1], pinned: false, locked: false, removed: false, awards: ['\uD83D\uDD25', '\uD83D\uDD25', '\uD83C\uDFC6', '\uD83D\uDCBF'], saved: true, views: 6840,
    comments: [
      mkComment('c6', 'mixmaster_t', 'Serial compression with two different characters is the real pro move here. Most beginners just slam one compressor.', 156, [
        mkComment('c6r1', 'voxqueen', 'Exactly. The 1176 catches peaks, the LA-2A smooths the body. Together they sound natural.', 89),
      ]),
      mkComment('c7', 'loficharlie', 'For lo-fi I skip the de-esser and crank the saturation. But this is a solid starting point for sure.', 42),
    ],
  },
  {
    id: 'p4', title: 'Just got the Roland TR-8S - first impressions from a software-only producer',
    content: 'After 6 years of only using software drums (Battery, Addictive Drums, samples), I finally bought a hardware drum machine. The TR-8S was on sale and I pulled the trigger.\n\nFirst impressions:\n- The feel of tweaking knobs in real time is incomparable to clicking a mouse\n- The built-in effects (scatter, reverb, delay) are actually usable in a mix\n- Sequencing is faster once you learn the workflow\n- It forced me to commit to sounds instead of endlessly tweaking\n\nDownsides:\n- Menu diving for some functions is annoying\n- Sample import workflow is clunky\n- It is one more thing on my desk\n\nOverall: 9/10 would recommend to any electronic producer wanting to break out of the screen.',
    author: INITIAL_USERS.drumcode_x, community: 'gear', score: 421, userVote: 0, commentCount: 15, createdAt: new Date(Date.now() - 18 * 3600000).toISOString(), tags: ['gear', 'drums', 'roland', 'hardware'], flair: FLAIRS[2], pinned: false, locked: false, removed: false, awards: ['\uD83C\uDFA7'], saved: false, views: 1870,
    comments: [
      mkComment('c8', 'synthwave99', 'The scatter effect alone is worth the price. It is like a performable glitch machine.', 55, [
        mkComment('c8r1', 'drumcode_x', 'Right? I have been using it live and it is so much more expressive than automation lanes.', 28),
      ]),
      mkComment('c9', 'beatsmith', 'I switched from the TR-8S to a Digitakt. More flexible sampling but the Roland sounds are unbeatable for classic drum machine tones.', 37),
    ],
  },
  {
    id: 'p5', title: 'Unpopular opinion: most producers over-compress their beats',
    content: 'I hear so many beats where every element is slammed to the limiter and the master is a sausage waveform. Where is the dynamics? Where is the groove?\n\nI started leaving 6-8dB of dynamic range in my beats and suddenly vocalists love working with them. The beat breathes, the vocal sits naturally, and the final master still gets loud enough.\n\nStop trying to win the loudness war on your 2-track bounce. Leave room for the mix engineer.',
    author: INITIAL_USERS.bassdrop, community: 'beats', score: 673, userVote: 0, commentCount: 22, createdAt: new Date(Date.now() - 24 * 3600000).toISOString(), tags: ['beats', 'compression', 'dynamics', 'hot-take'], flair: FLAIRS[0], pinned: false, locked: false, removed: false, awards: ['\uD83D\uDD25', '\uD83C\uDFA4'], saved: false, views: 2950,
    comments: [
      mkComment('c10', 'mixmaster_t', 'THANK YOU. As a mix engineer I cannot tell you how many beats I receive that are already clipping. Leave me headroom, please.', 201, [
        mkComment('c10r1', 'bassdrop', 'Exactly my point. The loudness can happen at mastering. Not on every individual track.', 78),
        mkComment('c10r2', 'beatsmith', 'Counterpoint: for certain trap styles the sausage IS the aesthetic. It is genre-dependent.', 45),
      ]),
      mkComment('c11', 'voxqueen', 'As a vocalist - yes. I need space to sit in the mix. Over-compressed beats make my job 10x harder.', 134),
    ],
  },
  {
    id: 'p6', title: 'Made a free lo-fi sample pack - 200+ one-shots and loops',
    content: 'Hey everyone, I spent the last month recording vinyl crackle, cassette tape noise, room tones, and processing a bunch of jazz piano and guitar through real tape machines.\n\nThe pack includes:\n- 80 vinyl texture loops (various intensities)\n- 40 tape-saturated piano chords\n- 30 processed guitar licks\n- 25 ambient room tone layers\n- 30 foley percussion hits (tapping, brushes, shakers)\n\nAll royalty-free, 24-bit WAV. Download link in the comments.\n\nWould love to hear what you make with these!',
    author: INITIAL_USERS.loficharlie, community: 'lofi', score: 1567, userVote: 0, commentCount: 45, createdAt: new Date(Date.now() - 36 * 3600000).toISOString(), tags: ['lofi', 'samples', 'free', 'resource'], flair: FLAIRS[2], pinned: false, locked: false, removed: false, awards: ['\uD83D\uDD25', '\uD83C\uDFC6', '\uD83C\uDFC6', '\uD83D\uDCBF', '\uD83C\uDFA7'], saved: true, views: 9200,
    comments: [
      mkComment('c12', 'melodicmind', 'These vinyl textures are incredible. Used three of them in a track already. Thank you for sharing!', 89, [
        mkComment('c12r1', 'loficharlie', 'That is awesome, would love to hear the track when it is done!', 34),
      ]),
      mkComment('c13', 'beatsmith', 'The tape piano chords are chef\'s kiss. Perfect amount of warmth and wobble.', 76),
    ],
  },
  {
    id: 'p7', title: 'Guide: Setting up sidechain compression properly (not just the "pumping" effect)',
    content: 'Sidechain compression is one of the most misunderstood tools. Most tutorials only show you the EDM pumping effect, but proper sidechaining is about frequency management.\n\nTechniques I use daily:\n\n1. Kick vs Bass: Sidechain the bass to the kick with a fast attack and medium release. Goal: 3-6dB reduction, barely audible but cleans up the low end.\n\n2. Vocal vs instruments: Sidechain pads and guitars to the vocal. Subtle 1-2dB dip. The vocal cuts through without turning it up.\n\n3. Multiband sidechain: Only duck specific frequency ranges. Duck 60-200Hz of synths when kick hits, leave everything else untouched.\n\n4. Ghost sidechain: Use a duplicate kick track (muted to output) as the trigger. This lets you shape the sidechain envelope independently from the actual kick sound.\n\nStop making everything pump. Start making everything fit.',
    author: INITIAL_USERS.mixmaster_t, community: 'production', score: 956, userVote: 0, commentCount: 28, createdAt: new Date(Date.now() - 48 * 3600000).toISOString(), tags: ['production', 'sidechain', 'compression', 'tutorial'], flair: FLAIRS[1], pinned: false, locked: false, removed: false, awards: ['\uD83D\uDD25', '\uD83C\uDFC6'], saved: false, views: 4100,
    comments: [
      mkComment('c14', 'drumcode_x', 'Ghost sidechain changed my life. Being able to shape the duck curve without affecting the kick sound is incredible.', 112, [
        mkComment('c14r1', 'mixmaster_t', 'It is a game changer for techno especially where you want the kick to trigger the duck but the actual kick might have a long tail.', 58),
      ]),
      mkComment('c15', 'bassdrop', 'Multiband sidechain is underrated. I use it on every bass-heavy mix now. Trackspacer plugin makes it easy.', 73),
    ],
  },
  {
    id: 'p8', title: 'What key and BPM combos work best for different genres?',
    content: 'I have been building a database of popular tracks and analyzing their key/BPM combos. Here are some patterns I found:\n\n- Lo-fi hip hop: Eb minor / F minor, 70-85 BPM\n- Trap: C minor / D minor, 130-160 BPM (half-time feel)\n- House: G minor / A minor, 120-128 BPM\n- DnB: E minor / A minor, 170-178 BPM\n- Pop: C major / G major, 100-120 BPM\n- Ambient: Any key, 60-90 BPM or no fixed tempo\n\nObviously there are exceptions everywhere, but if you are starting a track and want it to "feel" like a genre, these are solid starting points.\n\nWhat patterns have you all noticed?',
    author: INITIAL_USERS.melodicmind, community: 'production', score: 388, userVote: 0, commentCount: 19, createdAt: new Date(Date.now() - 60 * 3600000).toISOString(), tags: ['production', 'music-theory', 'keys', 'bpm'], flair: FLAIRS[0], pinned: false, locked: false, removed: false, awards: ['\uD83C\uDFA7'], saved: false, views: 1650,
    comments: [
      mkComment('c16', 'synthwave99', 'Synthwave is almost always F minor or A minor at 80-118 BPM. The minor key is essential for that nostalgic vibe.', 44, [
        mkComment('c16r1', 'melodicmind', 'Great addition, I should have included synthwave. F minor at 100 BPM is the sweet spot.', 21),
      ]),
      mkComment('c17', 'beatsmith', 'Trap in D minor at 140 BPM is basically the default template for every type beat on YouTube.', 58),
    ],
  },
  {
    id: 'p9', title: 'Anyone else feel like AI-generated music is missing "soul"?',
    content: 'I have been experimenting with various AI music generation tools and while the output is technically impressive, something is always missing. The music sounds correct but not compelling.\n\nI think the difference is intention. When a human producer makes a choice - to leave a note slightly off-grid, to let a reverb tail ring out too long, to have a slightly imperfect vocal take - those "flaws" are what make music feel alive.\n\nAI tools are great for generating ideas and starting points, but I do not think they will replace the human touch in arrangement, mixing decisions, and emotional performance.\n\nWhat is your take? Am I being a luddite or is this a real limitation?',
    author: INITIAL_USERS.beatsmith, community: 'production', score: 712, userVote: 0, commentCount: 35, createdAt: new Date(Date.now() - 72 * 3600000).toISOString(), tags: ['production', 'ai', 'discussion', 'philosophy'], flair: FLAIRS[0], pinned: false, locked: false, removed: false, awards: ['\uD83D\uDD25'], saved: false, views: 3800,
    comments: [
      mkComment('c18', 'voxqueen', 'As a vocalist, the AI vocals creep me out. They are technically perfect but they do not breathe, they do not hesitate, they do not feel. That IS the soul.', 189, [
        mkComment('c18r1', 'loficharlie', 'Imperfection is the whole point of lo-fi. AI will never understand that intentional imperfection is a feature, not a bug.', 76),
      ]),
      mkComment('c19', 'drumcode_x', 'I use AI for generating initial chord progressions and then heavily modify. It is a tool, not a replacement. Like how we use samples.', 94),
    ],
  },
  {
    id: 'p10', title: 'New community: c/electronic is live - join us!',
    content: 'We just launched c/electronic for all things house, techno, DnB, ambient, IDM, breakbeat, and experimental electronic music.\n\nWhether you produce, DJ, or just listen - come hang out. We will be running weekly feedback threads and monthly remix challenges.\n\nNo gatekeeping, all subgenres welcome. See you in there!',
    author: INITIAL_USERS.drumcode_x, community: 'electronic', score: 305, userVote: 0, commentCount: 8, createdAt: new Date(Date.now() - 96 * 3600000).toISOString(), tags: ['electronic', 'community', 'announcement'], flair: FLAIRS[5], pinned: true, locked: false, removed: false, awards: ['\u26A1'], saved: false, views: 1240,
    comments: [
      mkComment('c20', 'synthwave99', 'Joined! Looking forward to the remix challenges.', 22),
      mkComment('c21', 'bassdrop', 'Finally a place for bass music that is not just "post your Soundcloud" spam.', 35),
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatScore(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function countAllComments(comments: Comment[]): number {
  return comments.reduce((sum, c) => sum + 1 + countAllComments(c.replies), 0);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ForumLensPage() {
  useLensNav('forum');
  const queryClient = useQueryClient();

  // ----- State -----
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [communities, setCommunities] = useState<Community[]>(INITIAL_COMMUNITIES);
  const [selectedCommunity, setSelectedCommunity] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('hot');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);

  // Modals
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState<{ type: 'post' | 'comment'; id: string } | null>(null);
  const [showShareModal, setShowShareModal] = useState<string | null>(null);

  // Create post form
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCommunity, setNewPostCommunity] = useState('');
  const [newPostTags, setNewPostTags] = useState('');
  const [newPostFlair, setNewPostFlair] = useState<number | null>(null);

  // Create community form
  const [newCommName, setNewCommName] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');

  // Comment reply
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [postReplyContent, setPostReplyContent] = useState('');

  const { items: _postItems, create: _createPost } = useLensData('forum', 'post', {
    seed: INITIAL_POSTS.map(p => ({ title: p.title, data: p as unknown as Record<string, unknown> })),
  });
  const { items: _communityItems } = useLensData('forum', 'community', {
    seed: INITIAL_COMMUNITIES.map(c => ({ title: c.name, data: c as unknown as Record<string, unknown> })),
  });

  // Keep the API queries for future real-data integration
  useQuery({ queryKey: ['forum-posts-api', selectedCommunity, sortMode], queryFn: () => api.get('/api/dtus', { params: { tags: selectedCommunity !== 'all' ? selectedCommunity : undefined, sort: sortMode === 'new' ? 'createdAt' : 'score', order: 'desc' } }).then(r => r.data), enabled: false });
  useQuery({ queryKey: ['communities-api'], queryFn: () => api.get('/api/tags').then(r => r.data), enabled: false });
  const voteMutation = useMutation({ mutationFn: ({ postId, vote }: { postId: string; vote: number }) => api.post(`/api/dtus/${postId}/vote`, { vote }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forum-posts-api'] }) });

  // ----- Filtered & sorted posts -----
  const displayPosts = useMemo(() => {
    let filtered = posts.filter(p => !p.removed);
    if (selectedCommunity !== 'all') filtered = filtered.filter(p => p.community === selectedCommunity);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q)) || p.author.username.toLowerCase().includes(q));
    }
    const pinned = filtered.filter(p => p.pinned);
    const unpinned = filtered.filter(p => !p.pinned);
    const sorted = [...unpinned].sort((a, b) => {
      if (sortMode === 'new') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortMode === 'top') return b.score - a.score;
      if (sortMode === 'rising') return (b.score / Math.max(1, (Date.now() - new Date(b.createdAt).getTime()) / 3600000)) - (a.score / Math.max(1, (Date.now() - new Date(a.createdAt).getTime()) / 3600000));
      // hot: score weighted by recency
      const hotScore = (p: Post) => p.score / Math.pow(((Date.now() - new Date(p.createdAt).getTime()) / 3600000) + 2, 1.5);
      return hotScore(b) - hotScore(a);
    });
    return [...pinned, ...sorted];
  }, [posts, selectedCommunity, sortMode, searchQuery]);

  const selectedPost = selectedPostId ? posts.find(p => p.id === selectedPostId) || null : null;

  // ----- Actions -----
  const handleVote = useCallback((postId: string, direction: number) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const newVote = p.userVote === direction ? 0 : direction;
      const scoreDelta = newVote - p.userVote;
      return { ...p, userVote: newVote, score: p.score + scoreDelta };
    }));
    voteMutation.mutate({ postId, vote: direction });
  }, [voteMutation]);

  const handleCommentVote = useCallback((commentId: string, direction: number) => {
    function updateComment(comments: Comment[]): Comment[] {
      return comments.map(c => {
        if (c.id === commentId) {
          const newVote = c.userVote === direction ? 0 : direction;
          return { ...c, userVote: newVote, score: c.score + (newVote - c.userVote) };
        }
        return { ...c, replies: updateComment(c.replies) };
      });
    }
    setPosts(prev => prev.map(p => ({ ...p, comments: updateComment(p.comments) })));
  }, []);

  const handleCreatePost = useCallback(() => {
    if (!newPostTitle.trim() || !newPostCommunity) return;
    const newPost: Post = {
      id: `p${Date.now()}`, title: newPostTitle, content: newPostContent,
      author: INITIAL_USERS.beatsmith, community: newPostCommunity,
      score: 1, userVote: 1, commentCount: 0,
      createdAt: new Date().toISOString(),
      tags: newPostTags.split(',').map(t => t.trim()).filter(Boolean),
      flair: newPostFlair !== null ? FLAIRS[newPostFlair] : undefined,
      pinned: false, locked: false, removed: false, awards: [], saved: false, comments: [], views: 1,
    };
    setPosts(prev => [newPost, ...prev]);
    setShowCreatePost(false);
    setNewPostTitle(''); setNewPostContent(''); setNewPostCommunity(''); setNewPostTags(''); setNewPostFlair(null);
  }, [newPostTitle, newPostContent, newPostCommunity, newPostTags, newPostFlair]);

  const handleCreateCommunity = useCallback(() => {
    if (!newCommName.trim()) return;
    const slug = newCommName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const newComm: Community = { id: slug, name: newCommName, description: newCommDesc, memberCount: 1, icon: '\uD83C\uDFB5', banner: 'from-neon-cyan to-neon-purple', joined: true, rules: ['Be respectful', 'Stay on topic'], createdAt: new Date().toISOString(), moderators: ['beatsmith'] };
    setCommunities(prev => [...prev, newComm]);
    setShowCreateCommunity(false);
    setNewCommName(''); setNewCommDesc('');
  }, [newCommName, newCommDesc]);

  const handleAddComment = useCallback((postId: string, parentCommentId: string | null, content: string) => {
    if (!content.trim()) return;
    const newComment: Comment = { id: `c${Date.now()}`, author: INITIAL_USERS.beatsmith, content, score: 1, userVote: 1, createdAt: new Date().toISOString(), awards: [], replies: [], collapsed: false };
    function insertReply(comments: Comment[]): Comment[] {
      return comments.map(c => {
        if (c.id === parentCommentId) return { ...c, replies: [...c.replies, newComment] };
        return { ...c, replies: insertReply(c.replies) };
      });
    }
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const updatedComments = parentCommentId ? insertReply(p.comments) : [...p.comments, newComment];
      return { ...p, comments: updatedComments, commentCount: countAllComments(updatedComments) };
    }));
    setReplyTo(null); setReplyContent(''); setPostReplyContent('');
  }, []);

  const handleToggleSave = useCallback((postId: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, saved: !p.saved } : p));
  }, []);

  const handleGiveAward = useCallback((awardEmoji: string) => {
    if (!showAwardModal) return;
    if (showAwardModal.type === 'post') {
      setPosts(prev => prev.map(p => p.id === showAwardModal.id ? { ...p, awards: [...p.awards, awardEmoji], score: p.score + 10 } : p));
    } else {
      function addAward(comments: Comment[]): Comment[] {
        return comments.map(c => {
          if (c.id === showAwardModal!.id) return { ...c, awards: [...c.awards, awardEmoji], score: c.score + 10 };
          return { ...c, replies: addAward(c.replies) };
        });
      }
      setPosts(prev => prev.map(p => ({ ...p, comments: addAward(p.comments) })));
    }
    setShowAwardModal(null);
  }, [showAwardModal]);

  const handleModAction = useCallback((postId: string, action: 'pin' | 'lock' | 'remove') => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      if (action === 'pin') return { ...p, pinned: !p.pinned };
      if (action === 'lock') return { ...p, locked: !p.locked };
      return { ...p, removed: true };
    }));
  }, []);

  const handleToggleJoin = useCallback((commId: string) => {
    setCommunities(prev => prev.map(c => c.id === commId ? { ...c, joined: !c.joined, memberCount: c.memberCount + (c.joined ? -1 : 1) } : c));
  }, []);

  const openPostDetail = useCallback((postId: string) => {
    setSelectedPostId(postId);
    setViewMode('detail');
  }, []);

  const openProfile = useCallback((user: UserProfile) => {
    setSelectedProfile(user);
    setViewMode('profile');
  }, []);

  const backToFeed = useCallback(() => {
    setViewMode('feed');
    setSelectedPostId(null);
    setSelectedProfile(null);
  }, []);

  // ----- Comment renderer -----
  function renderComment(comment: Comment, postId: string, depth: number = 0) {
    const post = posts.find(p => p.id === postId);
    const isLocked = post?.locked;
    return (
      <div key={comment.id} className={cn('border-l-2 pl-3 mt-3', depth === 0 ? 'border-lattice-border' : depth === 1 ? 'border-gray-700' : 'border-gray-800')}>
        <div className="flex items-start gap-2">
          <div className="flex flex-col items-center gap-0.5 mt-1">
            <button onClick={() => handleCommentVote(comment.id, 1)} className={cn('text-gray-500 hover:text-orange-400 transition-colors', comment.userVote === 1 && 'text-orange-500')}><ArrowBigUp className="w-4 h-4" /></button>
            <span className={cn('text-xs font-bold', comment.userVote === 1 ? 'text-orange-500' : comment.userVote === -1 ? 'text-blue-500' : 'text-gray-400')}>{comment.score}</span>
            <button onClick={() => handleCommentVote(comment.id, -1)} className={cn('text-gray-500 hover:text-blue-400 transition-colors', comment.userVote === -1 && 'text-blue-500')}><ArrowBigDown className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <button onClick={() => openProfile(comment.author)} className="font-semibold text-neon-cyan hover:underline">u/{comment.author.username}</button>
              <span>{formatTime(comment.createdAt)}</span>
              {comment.awards.map((a, i) => <span key={i}>{a}</span>)}
            </div>
            <p className="text-sm text-gray-200 mt-1 whitespace-pre-wrap">{comment.content}</p>
            <div className="flex items-center gap-3 mt-1.5">
              {!isLocked && depth < 3 && (
                <button onClick={() => { setReplyTo(comment.id); setReplyContent(''); }} className="text-xs text-gray-500 hover:text-white flex items-center gap-1"><MessageSquare className="w-3 h-3" />Reply</button>
              )}
              <button onClick={() => setShowAwardModal({ type: 'comment', id: comment.id })} className="text-xs text-gray-500 hover:text-yellow-400 flex items-center gap-1"><Award className="w-3 h-3" />Award</button>
              <button className="text-xs text-gray-500 hover:text-white flex items-center gap-1"><Flag className="w-3 h-3" />Report</button>
            </div>
            <AnimatePresence>
              {replyTo === comment.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
                  <div className="flex gap-2">
                    <input value={replyContent} onChange={e => setReplyContent(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment(postId, comment.id, replyContent)} placeholder="Write a reply..." className="flex-1 px-3 py-1.5 bg-lattice-bg border border-lattice-border rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan input-lattice" />
                    <button onClick={() => handleAddComment(postId, comment.id, replyContent)} className="px-3 py-1.5 bg-neon-cyan text-black text-sm font-medium rounded hover:bg-neon-cyan/90 btn-neon"><Send className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setReplyTo(null)} className="px-2 py-1.5 text-gray-400 hover:text-white text-sm"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {depth < 3 && comment.replies.map(r => renderComment(r, postId, depth + 1))}
          </div>
        </div>
      </div>
    );
  }

  // ----- Post card -----
  function renderPostCard(post: Post) {
    return (
      <motion.article key={post.id} layout className={cn('bg-lattice-surface border rounded-lg hover:border-gray-600 transition-colors lens-card', post.pinned ? 'border-neon-cyan/40' : 'border-lattice-border')}>
        <div className="flex">
          {/* Vote column */}
          <div className="flex flex-col items-center p-2 bg-lattice-bg/50 rounded-l-lg min-w-[48px]">
            <button onClick={() => handleVote(post.id, 1)} className={cn('p-1 rounded hover:bg-lattice-surface transition-colors', post.userVote === 1 ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500')}><ArrowBigUp className="w-6 h-6" /></button>
            <span className={cn('text-sm font-bold py-0.5', post.userVote === 1 ? 'text-orange-500' : post.userVote === -1 ? 'text-blue-500' : 'text-white')}>{formatScore(post.score)}</span>
            <button onClick={() => handleVote(post.id, -1)} className={cn('p-1 rounded hover:bg-lattice-surface transition-colors', post.userVote === -1 ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500')}><ArrowBigDown className="w-6 h-6" /></button>
          </div>
          {/* Content */}
          <div className="flex-1 p-3 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1 flex-wrap">
              {post.pinned && <span className="flex items-center gap-1 text-neon-cyan font-medium"><Pin className="w-3 h-3" />Pinned</span>}
              {post.locked && <span className="flex items-center gap-1 text-yellow-500 font-medium"><Lock className="w-3 h-3" />Locked</span>}
              <button onClick={() => setSelectedCommunity(post.community)} className="font-medium text-white hover:underline">c/{post.community}</button>
              <span>by</span>
              <button onClick={() => openProfile(post.author)} className="hover:underline text-neon-cyan/80">u/{post.author.username}</button>
              <span>{formatTime(post.createdAt)}</span>
              {post.flair && <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', post.flair.color)}>{post.flair.text}</span>}
              {post.awards.map((a, i) => <span key={i}>{a}</span>)}
            </div>
            <h2 onClick={() => openPostDetail(post.id)} className="text-lg font-medium text-white mb-1 cursor-pointer hover:text-neon-cyan leading-snug">{post.title}</h2>
            {post.content && <p className="text-sm text-gray-400 mb-2 line-clamp-2">{post.content}</p>}
            {post.tags.length > 0 && (
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {post.tags.slice(0, 4).map(t => <span key={t} className="px-2 py-0.5 bg-lattice-bg border border-lattice-border rounded text-[10px] text-gray-400"><Hash className="w-2.5 h-2.5 inline mr-0.5" />{t}</span>)}
              </div>
            )}
            <div className="flex items-center gap-1 text-gray-400 flex-wrap">
              <button onClick={() => openPostDetail(post.id)} className="flex items-center gap-1.5 text-xs hover:bg-lattice-bg px-2 py-1 rounded transition-colors"><MessageSquare className="w-4 h-4" />{post.commentCount} Comments</button>
              <button onClick={() => setShowAwardModal({ type: 'post', id: post.id })} className="flex items-center gap-1.5 text-xs hover:bg-lattice-bg px-2 py-1 rounded transition-colors hover:text-yellow-400"><Award className="w-4 h-4" />Award</button>
              <button onClick={() => setShowShareModal(post.id)} className="flex items-center gap-1.5 text-xs hover:bg-lattice-bg px-2 py-1 rounded transition-colors"><Share2 className="w-4 h-4" />Share</button>
              <button onClick={() => handleToggleSave(post.id)} className={cn('flex items-center gap-1.5 text-xs hover:bg-lattice-bg px-2 py-1 rounded transition-colors', post.saved && 'text-neon-cyan')}>{post.saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}{post.saved ? 'Saved' : 'Save'}</button>
              <div className="flex items-center gap-1.5 text-xs px-2 py-1 text-gray-500"><Eye className="w-3.5 h-3.5" />{post.views.toLocaleString()}</div>
              {/* Mod tools */}
              <div className="relative ml-auto group">
                <button className="flex items-center gap-1 text-xs hover:bg-lattice-bg px-2 py-1 rounded transition-colors"><Shield className="w-3.5 h-3.5" /><ChevronDown className="w-3 h-3" /></button>
                <div className="hidden group-hover:block absolute right-0 top-full mt-1 w-40 bg-lattice-surface border border-lattice-border rounded-lg shadow-xl z-20 py-1">
                  <button onClick={() => handleModAction(post.id, 'pin')} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-lattice-bg"><Pin className="w-3.5 h-3.5" />{post.pinned ? 'Unpin' : 'Pin'}</button>
                  <button onClick={() => handleModAction(post.id, 'lock')} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-lattice-bg"><Lock className="w-3.5 h-3.5" />{post.locked ? 'Unlock' : 'Lock'}</button>
                  <button onClick={() => handleModAction(post.id, 'remove')} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" />Remove</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.article>
    );
  }

  // ----- Post detail view -----
  function renderPostDetail() {
    if (!selectedPost) return null;
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 space-y-4">
        <button onClick={backToFeed} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-2"><ArrowLeft className="w-4 h-4" />Back to feed</button>
        <article className="bg-lattice-surface border border-lattice-border rounded-lg overflow-hidden lens-card">
          <div className="flex">
            <div className="flex flex-col items-center p-3 bg-lattice-bg/50 min-w-[56px]">
              <button onClick={() => handleVote(selectedPost.id, 1)} className={cn('p-1 rounded hover:bg-lattice-surface', selectedPost.userVote === 1 ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500')}><ArrowBigUp className="w-7 h-7" /></button>
              <span className={cn('text-base font-bold py-1', selectedPost.userVote === 1 ? 'text-orange-500' : selectedPost.userVote === -1 ? 'text-blue-500' : 'text-white')}>{formatScore(selectedPost.score)}</span>
              <button onClick={() => handleVote(selectedPost.id, -1)} className={cn('p-1 rounded hover:bg-lattice-surface', selectedPost.userVote === -1 ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500')}><ArrowBigDown className="w-7 h-7" /></button>
            </div>
            <div className="flex-1 p-4">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 flex-wrap">
                {selectedPost.pinned && <span className="flex items-center gap-1 text-neon-cyan font-medium"><Pin className="w-3 h-3" />Pinned</span>}
                {selectedPost.locked && <span className="flex items-center gap-1 text-yellow-500 font-medium"><Lock className="w-3 h-3" />Locked</span>}
                <button onClick={() => { setSelectedCommunity(selectedPost.community); backToFeed(); }} className="font-medium text-white hover:underline">c/{selectedPost.community}</button>
                <span>by</span>
                <button onClick={() => openProfile(selectedPost.author)} className="hover:underline text-neon-cyan/80">u/{selectedPost.author.username}</button>
                <span>{formatTime(selectedPost.createdAt)}</span>
                {selectedPost.flair && <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', selectedPost.flair.color)}>{selectedPost.flair.text}</span>}
                {selectedPost.awards.map((a, i) => <span key={i} className="text-sm">{a}</span>)}
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">{selectedPost.title}</h1>
              {selectedPost.content && <div className="text-gray-300 text-sm mb-4 whitespace-pre-wrap leading-relaxed">{selectedPost.content}</div>}
              {selectedPost.tags.length > 0 && (
                <div className="flex gap-1.5 mb-4 flex-wrap">
                  {selectedPost.tags.map(t => <span key={t} className="px-2 py-0.5 bg-lattice-bg border border-lattice-border rounded text-xs text-gray-400"><Hash className="w-3 h-3 inline mr-0.5" />{t}</span>)}
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-400 border-t border-lattice-border pt-3 flex-wrap">
                <span className="text-xs flex items-center gap-1"><MessageSquare className="w-4 h-4" />{selectedPost.commentCount} Comments</span>
                <button onClick={() => setShowAwardModal({ type: 'post', id: selectedPost.id })} className="flex items-center gap-1 text-xs hover:text-yellow-400 transition-colors"><Award className="w-4 h-4" />Award</button>
                <button onClick={() => setShowShareModal(selectedPost.id)} className="flex items-center gap-1 text-xs hover:text-white transition-colors"><Share2 className="w-4 h-4" />Share</button>
                <button onClick={() => handleToggleSave(selectedPost.id)} className={cn('flex items-center gap-1 text-xs transition-colors', selectedPost.saved ? 'text-neon-cyan' : 'hover:text-white')}>{selectedPost.saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}{selectedPost.saved ? 'Saved' : 'Save'}</button>
                <span className="text-xs flex items-center gap-1 text-gray-500"><Eye className="w-3.5 h-3.5" />{selectedPost.views.toLocaleString()} views</span>
              </div>
            </div>
          </div>
        </article>

        {/* Comment input */}
        {!selectedPost.locked && (
          <div className="bg-lattice-surface border border-lattice-border rounded-lg p-4 lens-card">
            <p className="text-xs text-gray-400 mb-2">Comment as <span className="text-neon-cyan">u/beatsmith</span></p>
            <textarea value={postReplyContent} onChange={e => setPostReplyContent(e.target.value)} rows={3} placeholder="What are your thoughts?" className="w-full px-3 py-2 bg-lattice-bg border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan resize-none input-lattice" />
            <div className="flex justify-end mt-2">
              <button onClick={() => handleAddComment(selectedPost.id, null, postReplyContent)} disabled={!postReplyContent.trim()} className="px-4 py-1.5 bg-neon-cyan text-black text-sm font-medium rounded-full hover:bg-neon-cyan/90 disabled:opacity-40 disabled:cursor-not-allowed btn-neon">Comment</button>
            </div>
          </div>
        )}
        {selectedPost.locked && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2 text-yellow-400 text-sm"><Lock className="w-4 h-4" />This thread is locked. New comments are not allowed.</div>
        )}

        {/* Comments */}
        <div className="bg-lattice-surface border border-lattice-border rounded-lg p-4 lens-card">
          <h3 className="text-sm font-semibold text-white mb-3">Comments ({selectedPost.commentCount})</h3>
          {selectedPost.comments.length === 0 && <p className="text-sm text-gray-500 py-4 text-center">No comments yet. Be the first to share your thoughts!</p>}
          {selectedPost.comments.map(c => renderComment(c, selectedPost.id, 0))}
        </div>
      </motion.div>
    );
  }

  // ----- Profile view -----
  function renderProfile() {
    if (!selectedProfile) return null;
    const userPosts = posts.filter(p => p.author.username === selectedProfile.username && !p.removed);
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 space-y-4">
        <button onClick={backToFeed} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-2"><ArrowLeft className="w-4 h-4" />Back to feed</button>
        <div className="bg-lattice-surface border border-lattice-border rounded-lg overflow-hidden lens-card">
          <div className="h-24 bg-gradient-to-r from-neon-cyan/30 to-neon-purple/30" />
          <div className="px-6 pb-4 -mt-8">
            <div className="w-16 h-16 rounded-full bg-lattice-bg border-4 border-lattice-surface flex items-center justify-center text-lg font-bold text-neon-cyan">{selectedProfile.avatar}</div>
            <h2 className="text-xl font-bold text-white mt-2">{selectedProfile.displayName}</h2>
            <p className="text-sm text-gray-400">u/{selectedProfile.username}</p>
            <p className="text-sm text-gray-300 mt-2">{selectedProfile.bio}</p>
            <div className="flex gap-6 mt-3 text-sm">
              <div><span className="font-bold text-white">{selectedProfile.karma.toLocaleString()}</span> <span className="text-gray-400">karma</span></div>
              <div><span className="font-bold text-white">{selectedProfile.postCount}</span> <span className="text-gray-400">posts</span></div>
              <div><span className="font-bold text-white">{selectedProfile.commentCount}</span> <span className="text-gray-400">comments</span></div>
              <div className="text-gray-400">Joined {new Date(selectedProfile.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
            </div>
          </div>
        </div>
        <h3 className="text-sm font-semibold text-white">Posts by u/{selectedProfile.username}</h3>
        {userPosts.length === 0 && <p className="text-gray-500 text-sm">No posts yet.</p>}
        <div className="space-y-3">{userPosts.map(p => renderPostCard(p))}</div>
      </motion.div>
    );
  }

  // ----- Sidebar -----
  function renderSidebar() {
    const activeCommunity = selectedCommunity !== 'all' ? communities.find(c => c.id === selectedCommunity) : null;
    return (
      <aside className="w-80 space-y-4 flex-shrink-0">
        {/* Community info panel */}
        <div className="bg-lattice-surface border border-lattice-border rounded-lg overflow-hidden panel">
          <div className={cn('h-20 bg-gradient-to-r', activeCommunity ? activeCommunity.banner : 'from-neon-cyan to-neon-purple')} />
          <div className="p-4">
            <h3 className="font-bold text-white mb-1 flex items-center gap-2">
              {activeCommunity ? <>{activeCommunity.icon} c/{activeCommunity.name}</> : 'Home'}
            </h3>
            <p className="text-sm text-gray-400 mb-3">{activeCommunity?.description || 'Your personal front page. Browse all communities.'}</p>
            {activeCommunity && (
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                <span><Users className="w-3.5 h-3.5 inline mr-1" />{activeCommunity.memberCount.toLocaleString()} members</span>
                <span>Created {new Date(activeCommunity.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowCreatePost(true)} className="flex-1 py-2 bg-neon-cyan text-black font-medium rounded-full hover:bg-neon-cyan/90 transition-colors text-sm btn-neon">Create Post</button>
              {activeCommunity && (
                <button onClick={() => handleToggleJoin(activeCommunity.id)} className={cn('px-4 py-2 rounded-full text-sm font-medium border transition-colors', activeCommunity.joined ? 'border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-400' : 'border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10')}>
                  {activeCommunity.joined ? 'Joined' : 'Join'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Rules */}
        {activeCommunity && activeCommunity.rules.length > 0 && (
          <div className="bg-lattice-surface border border-lattice-border rounded-lg p-4 panel">
            <h3 className="font-bold text-white mb-2 text-sm">Community Rules</h3>
            <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
              {activeCommunity.rules.map((r, i) => <li key={i}>{r}</li>)}
            </ol>
          </div>
        )}

        {/* Communities list */}
        <div className="bg-lattice-surface border border-lattice-border rounded-lg p-4 panel">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm"><Users className="w-4 h-4" />Communities</h3>
            <button onClick={() => setShowCreateCommunity(true)} className="text-neon-cyan hover:text-neon-cyan/80 transition-colors"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="space-y-1">
            <button onClick={() => { setSelectedCommunity('all'); if (viewMode !== 'feed') backToFeed(); }} className={cn('w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors', selectedCommunity === 'all' ? 'bg-neon-cyan/20 text-neon-cyan' : 'hover:bg-lattice-bg text-gray-300')}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center text-white text-xs font-bold">All</div>
              <span className="text-sm font-medium">All Communities</span>
            </button>
            {communities.map(comm => (
              <button key={comm.id} onClick={() => { setSelectedCommunity(comm.id); if (viewMode !== 'feed') backToFeed(); }} className={cn('w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors', selectedCommunity === comm.id ? 'bg-neon-cyan/20 text-neon-cyan' : 'hover:bg-lattice-bg text-gray-300')}>
                <div className="w-8 h-8 rounded-full bg-lattice-bg flex items-center justify-center text-sm">{comm.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{comm.name}</p>
                  <p className="text-[10px] text-gray-500">{comm.memberCount.toLocaleString()} members</p>
                </div>
                {comm.joined && <Check className="w-3.5 h-3.5 text-neon-cyan flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Lattice Rules */}
        <div className="bg-lattice-surface border border-lattice-border rounded-lg p-4 panel">
          <h3 className="font-bold text-white mb-2 text-sm">Lattice Rules</h3>
          <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
            <li>Respect the sovereignty lock</li>
            <li>No telemetry or data extraction</li>
            <li>Keep discussions constructive</li>
            <li>Link DTUs when relevant</li>
            <li>Tag appropriately</li>
          </ol>
        </div>
      </aside>
    );
  }

  // ===== RENDER =====
  return (
    <div className="min-h-full bg-lattice-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-lattice-surface/95 backdrop-blur border-b border-lattice-border">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-2xl">{'\uD83D\uDD25'}</span>
              <div>
                <h1 className="text-xl font-bold text-white">Forum Lens</h1>
                <p className="text-xs text-gray-400">DTUs as discussion threads</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-1 justify-end">
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); if (viewMode !== 'feed') backToFeed(); }} placeholder="Search posts, tags, users..." className="w-full pl-10 pr-4 py-2 bg-lattice-bg border border-lattice-border rounded-full text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan input-lattice" />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
              </div>
              <button onClick={() => setShowCreatePost(true)} className="flex items-center gap-2 px-4 py-2 bg-neon-cyan text-black font-medium rounded-full hover:bg-neon-cyan/90 transition-colors text-sm flex-shrink-0 btn-neon">
                <Plus className="w-4 h-4" />Create Post
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Main content */}
          <AnimatePresence mode="wait">
            {viewMode === 'feed' && (
              <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 space-y-4 min-w-0">
                {/* Sort bar */}
                <div className="flex items-center gap-2 p-2 bg-lattice-surface border border-lattice-border rounded-lg">
                  {([
                    { id: 'hot' as SortMode, icon: Flame, label: 'Hot' },
                    { id: 'new' as SortMode, icon: Clock, label: 'New' },
                    { id: 'top' as SortMode, icon: TrendingUp, label: 'Top' },
                    { id: 'rising' as SortMode, icon: ArrowBigUp, label: 'Rising' },
                  ]).map(sort => (
                    <button key={sort.id} onClick={() => setSortMode(sort.id)} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors', sortMode === sort.id ? 'bg-lattice-bg text-white' : 'text-gray-400 hover:text-white hover:bg-lattice-bg/50')}>
                      <sort.icon className="w-4 h-4" />{sort.label}
                    </button>
                  ))}
                </div>
                {searchQuery && <p className="text-sm text-gray-400">Showing results for &quot;{searchQuery}&quot; ({displayPosts.length} found)</p>}
                {displayPosts.length === 0 && <div className="text-center py-12 text-gray-500"><MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" /><p>No posts found.{searchQuery ? ' Try a different search.' : ' Be the first to post!'}</p></div>}
                <div className="space-y-3">{displayPosts.map(p => renderPostCard(p))}</div>
              </motion.div>
            )}
            {viewMode === 'detail' && renderPostDetail()}
            {viewMode === 'profile' && renderProfile()}
          </AnimatePresence>

          {/* Sidebar */}
          {renderSidebar()}
        </div>
      </div>

      {/* ========== MODALS ========== */}

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreatePost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreatePost(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="w-full max-w-xl bg-lattice-surface border border-lattice-border rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-lattice-border">
                <h2 className="text-lg font-bold text-white">Create a Post</h2>
                <button onClick={() => setShowCreatePost(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                {/* Community selection */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Community</label>
                  <select value={newPostCommunity} onChange={e => setNewPostCommunity(e.target.value)} className="w-full px-3 py-2 bg-lattice-bg border border-lattice-border rounded-lg text-sm text-white focus:outline-none focus:border-neon-cyan input-lattice">
                    <option value="">Select a community...</option>
                    {communities.map(c => <option key={c.id} value={c.id}>{c.icon} c/{c.name}</option>)}
                  </select>
                </div>
                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
                  <input value={newPostTitle} onChange={e => setNewPostTitle(e.target.value)} placeholder="An interesting title..." maxLength={300} className="w-full px-3 py-2 bg-lattice-bg border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan input-lattice" />
                  <p className="text-[10px] text-gray-500 mt-1 text-right">{newPostTitle.length}/300</p>
                </div>
                {/* Content */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Content</label>
                  <textarea value={newPostContent} onChange={e => setNewPostContent(e.target.value)} rows={6} placeholder="Share your thoughts, tips, questions..." className="w-full px-3 py-2 bg-lattice-bg border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan resize-none input-lattice" />
                </div>
                {/* Tags */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Tags (comma-separated)</label>
                  <input value={newPostTags} onChange={e => setNewPostTags(e.target.value)} placeholder="mixing, tutorial, ableton" className="w-full px-3 py-2 bg-lattice-bg border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan input-lattice" />
                </div>
                {/* Flair */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Flair</label>
                  <div className="flex gap-2 flex-wrap">
                    {FLAIRS.map((f, i) => (
                      <button key={f.text} onClick={() => setNewPostFlair(newPostFlair === i ? null : i)} className={cn('px-3 py-1 rounded-full text-xs font-semibold border transition-colors', f.color, newPostFlair === i && 'ring-2 ring-white/40')}>
                        {f.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-5 py-4 border-t border-lattice-border">
                <button onClick={() => setShowCreatePost(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                <button onClick={handleCreatePost} disabled={!newPostTitle.trim() || !newPostCommunity} className="px-6 py-2 bg-neon-cyan text-black font-medium rounded-full hover:bg-neon-cyan/90 disabled:opacity-40 disabled:cursor-not-allowed text-sm btn-neon">Post</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Community Modal */}
      <AnimatePresence>
        {showCreateCommunity && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreateCommunity(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="w-full max-w-md bg-lattice-surface border border-lattice-border rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-lattice-border">
                <h2 className="text-lg font-bold text-white">Create Community</h2>
                <button onClick={() => setShowCreateCommunity(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Community Name</label>
                  <input value={newCommName} onChange={e => setNewCommName(e.target.value)} placeholder="e.g. Ambient Production" maxLength={50} className="w-full px-3 py-2 bg-lattice-bg border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan input-lattice" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                  <textarea value={newCommDesc} onChange={e => setNewCommDesc(e.target.value)} rows={3} placeholder="What is this community about?" className="w-full px-3 py-2 bg-lattice-bg border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan resize-none input-lattice" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-5 py-4 border-t border-lattice-border">
                <button onClick={() => setShowCreateCommunity(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                <button onClick={handleCreateCommunity} disabled={!newCommName.trim()} className="px-6 py-2 bg-neon-cyan text-black font-medium rounded-full hover:bg-neon-cyan/90 disabled:opacity-40 disabled:cursor-not-allowed text-sm btn-neon">Create</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Award Modal */}
      <AnimatePresence>
        {showAwardModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAwardModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-lattice-surface border border-lattice-border rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-lattice-border">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><Award className="w-5 h-5 text-yellow-400" />Give Award</h2>
                <button onClick={() => setShowAwardModal(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 grid grid-cols-3 gap-3">
                {AWARDS.map(award => (
                  <button key={award.id} onClick={() => handleGiveAward(award.emoji)} className="flex flex-col items-center gap-1 p-3 bg-lattice-bg border border-lattice-border rounded-lg hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-colors">
                    <span className="text-2xl">{award.emoji}</span>
                    <span className="text-xs text-white font-medium">{award.name}</span>
                    <span className="text-[10px] text-gray-500">{award.cost} credits</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowShareModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-lattice-surface border border-lattice-border rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-lattice-border">
                <h2 className="text-lg font-bold text-white">Share Post</h2>
                <button onClick={() => setShowShareModal(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-3">
                <button onClick={() => { navigator.clipboard?.writeText(`https://concord.lattice/forum/${showShareModal}`); setShowShareModal(null); }} className="w-full flex items-center gap-3 p-3 bg-lattice-bg border border-lattice-border rounded-lg hover:border-neon-cyan/50 transition-colors text-left">
                  <Copy className="w-5 h-5 text-gray-400" />
                  <div><p className="text-sm text-white font-medium">Copy Link</p><p className="text-xs text-gray-500">Copy the post URL to clipboard</p></div>
                </button>
                <button onClick={() => setShowShareModal(null)} className="w-full flex items-center gap-3 p-3 bg-lattice-bg border border-lattice-border rounded-lg hover:border-neon-cyan/50 transition-colors text-left">
                  <ExternalLink className="w-5 h-5 text-gray-400" />
                  <div><p className="text-sm text-white font-medium">Open in New Tab</p><p className="text-xs text-gray-500">Open the post in a new browser tab</p></div>
                </button>
                <button onClick={() => setShowShareModal(null)} className="w-full flex items-center gap-3 p-3 bg-lattice-bg border border-lattice-border rounded-lg hover:border-neon-cyan/50 transition-colors text-left">
                  <MessageSquare className="w-5 h-5 text-gray-400" />
                  <div><p className="text-sm text-white font-medium">Crosspost</p><p className="text-xs text-gray-500">Share to another community</p></div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
