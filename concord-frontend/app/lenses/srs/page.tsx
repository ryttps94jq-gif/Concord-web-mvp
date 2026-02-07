'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Clock, CheckCircle2, Brain, TrendingUp, Plus, Search,
  FolderOpen, BarChart3, Settings, Shuffle, Eye, EyeOff, Trash2,
  Edit3, Star, Filter, ChevronDown, ChevronRight, RotateCcw,
  Zap, Target, Award, Layers, Tag, Calendar, ArrowRight,
  Play, Pause, Volume2, XCircle, GripVertical, Hash
} from 'lucide-react';

// --- Types ---
interface SRSItem {
  dtuId: string;
  title?: string;
  content?: string;
  front?: string;
  back?: string;
  nextReview?: string;
  interval?: number;
  easiness?: number;
  repetitions?: number;
  deck?: string;
  tags?: string[];
  lapses?: number;
  streak?: number;
  createdAt?: string;
  lastReview?: string;
}

interface Deck {
  id: string;
  name: string;
  description?: string;
  color: string;
  cardCount: number;
  dueCount: number;
  newCount: number;
  learnCount: number;
}

type ViewMode = 'study' | 'decks' | 'browse' | 'stats' | 'create';
type StudyMode = 'normal' | 'cram' | 'reverse' | 'quiz';

// --- SM-2 Algorithm (client-side) ---
function sm2(item: SRSItem, quality: number): { interval: number; easiness: number; repetitions: number } {
  let { easiness = 2.5, repetitions = 0, interval = 1 } = item;

  if (quality >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easiness);
    repetitions++;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easiness = Math.max(1.3, easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  return { interval, easiness, repetitions };
}

// --- Demo Data ---
const DEMO_DECKS: Deck[] = [
  { id: 'music-theory', name: 'Music Theory', description: 'Scales, chords, intervals, and harmonic analysis', color: '#06b6d4', cardCount: 48, dueCount: 12, newCount: 5, learnCount: 3 },
  { id: 'production', name: 'Production Techniques', description: 'DAW workflows, mixing, mastering, sound design', color: '#a855f7', cardCount: 36, dueCount: 8, newCount: 3, learnCount: 2 },
  { id: 'audio-eng', name: 'Audio Engineering', description: 'Signal flow, EQ, compression, acoustics', color: '#f97316', cardCount: 24, dueCount: 5, newCount: 4, learnCount: 1 },
  { id: 'history', name: 'Music History', description: 'Genres, movements, influential artists, cultural impact', color: '#22c55e', cardCount: 30, dueCount: 7, newCount: 2, learnCount: 4 },
  { id: 'synthesis', name: 'Synthesis & Sound Design', description: 'Oscillators, filters, modulation, FM/AM/wavetable', color: '#ec4899', cardCount: 20, dueCount: 4, newCount: 6, learnCount: 0 },
];

const DEMO_CARDS: SRSItem[] = [
  { dtuId: 'srs-001', front: 'What is the circle of fifths?', back: 'A visual representation of the relationships among the 12 tones of the chromatic scale. Moving clockwise adds a sharp; counterclockwise adds a flat. Adjacent keys differ by one accidental.', deck: 'music-theory', tags: ['harmony', 'fundamentals'], easiness: 2.5, repetitions: 3, interval: 15, streak: 3, lapses: 0, lastReview: '2026-02-05', nextReview: '2026-02-07' },
  { dtuId: 'srs-002', front: 'What is sidechain compression?', back: 'A technique where the compressor on one track is triggered by the signal of another track. Commonly used to duck bass/pads under the kick drum for a pumping effect.', deck: 'production', tags: ['mixing', 'compression'], easiness: 2.3, repetitions: 2, interval: 6, streak: 2, lapses: 1, lastReview: '2026-02-01', nextReview: '2026-02-07' },
  { dtuId: 'srs-003', front: 'Explain the Nyquist theorem.', back: 'A signal must be sampled at least twice its highest frequency to be accurately reconstructed. CD audio (44.1kHz) can reproduce frequencies up to 22.05kHz, covering the full human hearing range.', deck: 'audio-eng', tags: ['digital-audio', 'sampling'], easiness: 2.6, repetitions: 4, interval: 20, streak: 4, lapses: 0, lastReview: '2026-01-18', nextReview: '2026-02-07' },
  { dtuId: 'srs-004', front: 'What is a diminished 7th chord?', back: 'A four-note chord built entirely from minor thirds (3 semitones each). Every inversion is equidistant. There are only 3 unique dim7 chords. Formula: 1-b3-b5-bb7.', deck: 'music-theory', tags: ['chords', 'harmony'], easiness: 2.1, repetitions: 1, interval: 1, streak: 0, lapses: 2, lastReview: '2026-02-06', nextReview: '2026-02-07' },
  { dtuId: 'srs-005', front: 'What is FM synthesis?', back: 'Frequency Modulation synthesis uses one oscillator (modulator) to modulate the frequency of another (carrier). Creates complex, evolving timbres. Popularized by the Yamaha DX7 (1983).', deck: 'synthesis', tags: ['synthesis', 'sound-design'], easiness: 2.5, repetitions: 2, interval: 10, streak: 2, lapses: 0, lastReview: '2026-01-28', nextReview: '2026-02-07' },
  { dtuId: 'srs-006', front: 'What are the 3 types of minor scales?', back: 'Natural minor (Aeolian mode): W-H-W-W-H-W-W\nHarmonic minor: raises 7th degree (augmented 2nd between 6-7)\nMelodic minor: raises 6th & 7th ascending, natural descending', deck: 'music-theory', tags: ['scales', 'fundamentals'], easiness: 2.4, repetitions: 5, interval: 30, streak: 5, lapses: 1, lastReview: '2026-01-08', nextReview: '2026-02-07' },
  { dtuId: 'srs-007', front: 'What is parallel compression?', back: 'Also called "New York compression." Blend a heavily compressed signal with the dry signal. Preserves transients and dynamics while adding body and sustain. Common on drums and vocals.', deck: 'production', tags: ['mixing', 'compression'], easiness: 2.5, repetitions: 3, interval: 12, streak: 3, lapses: 0, lastReview: '2026-01-26', nextReview: '2026-02-07' },
  { dtuId: 'srs-008', front: 'Who pioneered musique concrète?', back: 'Pierre Schaeffer in 1948 at RTF Paris. Used recorded sounds (not synthesized) as raw material, manipulated via tape techniques (splicing, speed change, reversal). Foundational to electronic music and sampling.', deck: 'history', tags: ['electronic', 'pioneers'], easiness: 2.5, repetitions: 1, interval: 6, streak: 1, lapses: 0, lastReview: '2026-02-01', nextReview: '2026-02-07' },
  { dtuId: 'srs-009', front: 'What is a wavetable synthesizer?', back: 'Stores multiple single-cycle waveforms in a table. Playback position sweeps through the table to create evolving timbres. Serum, Vital, and Massive X are popular wavetable synths.', deck: 'synthesis', tags: ['synthesis', 'sound-design'], easiness: 2.5, repetitions: 0, interval: 0, streak: 0, lapses: 0 },
  { dtuId: 'srs-010', front: 'What is the Fletcher-Munson curve?', back: 'Equal-loudness contours showing that human hearing sensitivity varies by frequency. We are most sensitive to 2-5kHz and less sensitive to low and very high frequencies at lower volumes. Important for mixing at consistent levels.', deck: 'audio-eng', tags: ['psychoacoustics', 'mixing'], easiness: 2.5, repetitions: 0, interval: 0, streak: 0, lapses: 0 },
];

// --- Stat helpers ---
function getRetentionRate(cards: SRSItem[]): number {
  const reviewed = cards.filter(c => (c.repetitions || 0) > 0);
  if (reviewed.length === 0) return 0;
  const retained = reviewed.filter(c => (c.streak || 0) > 0);
  return Math.round((retained.length / reviewed.length) * 100);
}

function getAverageEase(cards: SRSItem[]): number {
  if (cards.length === 0) return 2.5;
  return +(cards.reduce((s, c) => s + (c.easiness || 2.5), 0) / cards.length).toFixed(2);
}

function getMatureCount(cards: SRSItem[]): number {
  return cards.filter(c => (c.interval || 0) >= 21).length;
}

function getYoungCount(cards: SRSItem[]): number {
  return cards.filter(c => (c.interval || 0) > 0 && (c.interval || 0) < 21).length;
}

function getNewCount(cards: SRSItem[]): number {
  return cards.filter(c => (c.repetitions || 0) === 0).length;
}

// --- Review forecast (next 30 days) ---
function getForecast(cards: SRSItem[]): number[] {
  const forecast = new Array(30).fill(0);
  const today = new Date();
  cards.forEach(card => {
    if (card.nextReview) {
      const diff = Math.floor((new Date(card.nextReview).getTime() - today.getTime()) / 86400000);
      if (diff >= 0 && diff < 30) forecast[diff]++;
    }
  });
  return forecast;
}

export default function SRSLensPage() {
  useLensNav('srs');

  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>('study');
  const [studyMode, setStudyMode] = useState<StudyMode>('normal');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDeck, setFilterDeck] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [editingCard, setEditingCard] = useState<SRSItem | null>(null);

  // Create card form
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newDeck, setNewDeck] = useState('music-theory');
  const [newTags, setNewTags] = useState('');

  // Create deck form
  const [deckName, setDeckName] = useState('');
  const [deckDesc, setDeckDesc] = useState('');
  const [deckColor, setDeckColor] = useState('#06b6d4');

  // API with fallback
  const { data: dueData, isLoading } = useQuery({
    queryKey: ['srs-due'],
    queryFn: () => apiHelpers.srs.due().then((r) => r.data).catch(() => null),
    refetchInterval: 30000,
  });

  const addToSrs = useMutation({
    mutationFn: (dtuId: string) => apiHelpers.srs.add(dtuId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['srs-due'] }),
  });

  const reviewItem = useMutation({
    mutationFn: ({ dtuId, quality }: { dtuId: string; quality: number }) =>
      apiHelpers.srs.review(dtuId, { quality }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['srs-due'] }),
  });

  // Use API data or demo
  const allCards: SRSItem[] = useMemo(() => {
    const apiItems = dueData?.items || dueData?.due || (Array.isArray(dueData) ? dueData : []);
    return apiItems.length > 0 ? apiItems : DEMO_CARDS;
  }, [dueData]);

  const decks: Deck[] = useMemo(() => {
    return DEMO_DECKS.map(d => ({
      ...d,
      cardCount: allCards.filter(c => c.deck === d.id).length || d.cardCount,
      dueCount: allCards.filter(c => c.deck === d.id && c.nextReview && new Date(c.nextReview) <= new Date()).length || d.dueCount,
      newCount: allCards.filter(c => c.deck === d.id && (c.repetitions || 0) === 0).length || d.newCount,
    }));
  }, [allCards]);

  const dueCards = useMemo(() => {
    let cards = allCards.filter(c => {
      if (!c.nextReview) return (c.repetitions || 0) === 0; // new cards are due
      return new Date(c.nextReview) <= new Date();
    });
    if (selectedDeck) cards = cards.filter(c => c.deck === selectedDeck);
    if (studyMode === 'reverse') {
      cards = cards.map(c => ({ ...c, front: c.back, back: c.front }));
    }
    return cards;
  }, [allCards, selectedDeck, studyMode]);

  const current = dueCards[currentIndex];
  const remaining = Math.max(0, dueCards.length - currentIndex);

  // Browse filtering
  const filteredCards = useMemo(() => {
    let cards = allCards;
    if (filterDeck !== 'all') cards = cards.filter(c => c.deck === filterDeck);
    if (filterTag !== 'all') cards = cards.filter(c => c.tags?.includes(filterTag));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      cards = cards.filter(c =>
        c.front?.toLowerCase().includes(q) ||
        c.back?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q)
      );
    }
    return cards;
  }, [allCards, filterDeck, filterTag, searchQuery]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allCards.forEach(c => c.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [allCards]);

  const forecast = useMemo(() => getForecast(allCards), [allCards]);
  const maxForecast = Math.max(...forecast, 1);

  const handleReview = useCallback((quality: number) => {
    if (!current) return;
    setSessionReviewed(p => p + 1);
    if (quality >= 3) setSessionCorrect(p => p + 1);

    reviewItem.mutate(
      { dtuId: current.dtuId, quality },
      { onError: () => {} }
    );

    setShowAnswer(false);
    setCurrentIndex(prev => prev + 1);
  }, [current, reviewItem]);

  const handleCreateCard = useCallback(() => {
    if (!newFront.trim() || !newBack.trim()) return;
    addToSrs.mutate(newFront, {
      onSuccess: () => {
        setNewFront('');
        setNewBack('');
        setNewTags('');
        setShowCreateCard(false);
      },
      onError: () => {
        setShowCreateCard(false);
      }
    });
  }, [newFront, newBack, addToSrs]);

  const qualityButtons = [
    { label: 'Again', sublabel: '< 1m', quality: 0, color: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30' },
    { label: 'Hard', sublabel: '~6m', quality: 2, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30' },
    { label: 'Good', sublabel: '~10m', quality: 4, color: 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' },
    { label: 'Easy', sublabel: '4d', quality: 5, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30' },
  ];

  const navItems = [
    { id: 'study' as ViewMode, icon: Play, label: 'Study' },
    { id: 'decks' as ViewMode, icon: Layers, label: 'Decks' },
    { id: 'browse' as ViewMode, icon: Search, label: 'Browse' },
    { id: 'stats' as ViewMode, icon: BarChart3, label: 'Statistics' },
  ];

  return (
    <div className="min-h-full bg-lattice-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-lattice-surface border-b border-lattice-border">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-7 h-7 text-neon-cyan" />
              <div>
                <h1 className="text-xl font-bold text-white">Spaced Repetition Studio</h1>
                <p className="text-xs text-gray-400">Master knowledge with scientifically-optimized review scheduling</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {navItems.map(nav => (
                <button
                  key={nav.id}
                  onClick={() => setView(nav.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    view === nav.id
                      ? 'bg-neon-cyan/20 text-neon-cyan'
                      : 'text-gray-400 hover:text-white hover:bg-lattice-bg'
                  }`}
                >
                  <nav.icon className="w-4 h-4" />
                  {nav.label}
                </button>
              ))}
              <button
                onClick={() => setShowCreateCard(true)}
                className="flex items-center gap-1 px-3 py-2 bg-neon-cyan text-black font-medium rounded-lg hover:bg-neon-cyan/90 transition-colors text-sm ml-2"
              >
                <Plus className="w-4 h-4" />
                Add Card
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* ===== STUDY VIEW ===== */}
        {view === 'study' && (
          <div className="space-y-6">
            {/* Session stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="lens-card text-center">
                <Clock className="w-5 h-5 text-neon-yellow mx-auto mb-1" />
                <p className="text-2xl font-bold">{remaining}</p>
                <p className="text-xs text-gray-400">Due Now</p>
              </div>
              <div className="lens-card text-center">
                <CheckCircle2 className="w-5 h-5 text-neon-green mx-auto mb-1" />
                <p className="text-2xl font-bold">{sessionReviewed}</p>
                <p className="text-xs text-gray-400">Reviewed</p>
              </div>
              <div className="lens-card text-center">
                <Target className="w-5 h-5 text-neon-blue mx-auto mb-1" />
                <p className="text-2xl font-bold">
                  {sessionReviewed > 0 ? Math.round((sessionCorrect / sessionReviewed) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-400">Accuracy</p>
              </div>
              <div className="lens-card text-center">
                <Zap className="w-5 h-5 text-neon-purple mx-auto mb-1" />
                <p className="text-2xl font-bold">{current?.streak || 0}</p>
                <p className="text-xs text-gray-400">Card Streak</p>
              </div>
              <div className="lens-card text-center">
                <TrendingUp className="w-5 h-5 text-neon-cyan mx-auto mb-1" />
                <p className="text-2xl font-bold">{getRetentionRate(allCards)}%</p>
                <p className="text-xs text-gray-400">Retention</p>
              </div>
            </div>

            {/* Study mode selector + deck filter */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 p-1 bg-lattice-surface border border-lattice-border rounded-lg">
                {(['normal', 'cram', 'reverse', 'quiz'] as StudyMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => { setStudyMode(mode); setCurrentIndex(0); setShowAnswer(false); }}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
                      studyMode === mode
                        ? 'bg-neon-cyan/20 text-neon-cyan'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <select
                value={selectedDeck || ''}
                onChange={(e) => { setSelectedDeck(e.target.value || null); setCurrentIndex(0); setShowAnswer(false); }}
                className="input-lattice text-sm"
              >
                <option value="">All Decks</option>
                {decks.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.dueCount} due)</option>
                ))}
              </select>
            </div>

            {/* Review Card */}
            <div className="max-w-2xl mx-auto">
              {isLoading ? (
                <div className="panel p-12 text-center text-gray-500">Loading review items...</div>
              ) : !current ? (
                <div className="panel p-12 text-center">
                  <Award className="w-20 h-20 mx-auto mb-4 text-neon-green opacity-50" />
                  <p className="text-xl font-bold text-white mb-2">All caught up!</p>
                  <p className="text-sm text-gray-400 mb-1">
                    {sessionReviewed > 0
                      ? `Great session! You reviewed ${sessionReviewed} cards with ${Math.round((sessionCorrect / sessionReviewed) * 100)}% accuracy.`
                      : 'No cards due for review right now.'
                    }
                  </p>
                  <p className="text-xs text-gray-500 mb-6">
                    Next review: {forecast[1] > 0 ? `${forecast[1]} cards tomorrow` : 'Check back later'}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button onClick={() => setView('decks')} className="btn-neon text-sm">
                      Browse Decks
                    </button>
                    <button onClick={() => setShowCreateCard(true)} className="btn-neon purple text-sm">
                      Create Cards
                    </button>
                  </div>
                </div>
              ) : (
                <motion.div className="space-y-4" layout>
                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-mono">{currentIndex + 1}/{dueCards.length}</span>
                    <div className="flex-1 h-1.5 bg-lattice-deep rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-neon-cyan to-neon-green"
                        animate={{ width: `${((currentIndex + 1) / dueCards.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <span className="text-xs text-gray-400">{remaining} left</span>
                  </div>

                  {/* Card */}
                  <div className="panel overflow-hidden">
                    {/* Card meta */}
                    <div className="flex items-center justify-between px-5 py-2 bg-lattice-bg/50 border-b border-lattice-border">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: decks.find(d => d.id === current.deck)?.color || '#666' }}
                        />
                        <span className="text-xs text-gray-400">{decks.find(d => d.id === current.deck)?.name || current.deck}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {current.tags?.map(tag => (
                          <span key={tag} className="flex items-center gap-1">
                            <Tag className="w-3 h-3" />{tag}
                          </span>
                        ))}
                        <span className="flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />{current.repetitions || 0} reps
                        </span>
                        {(current.lapses || 0) > 0 && (
                          <span className="text-red-400">{current.lapses} lapses</span>
                        )}
                      </div>
                    </div>

                    {/* Front */}
                    <div className="p-8 min-h-[160px] flex items-center justify-center">
                      <p className="text-lg text-center text-white font-medium">
                        {current.front || current.title || current.content || current.dtuId}
                      </p>
                    </div>

                    {/* Answer */}
                    <AnimatePresence>
                      {showAnswer ? (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className="border-t border-dashed border-lattice-border mx-6" />
                          <div className="p-8 min-h-[120px] flex items-center justify-center">
                            <p className="text-sm text-gray-300 whitespace-pre-wrap text-center leading-relaxed">
                              {current.back || current.content || 'Review this item to reinforce understanding.'}
                            </p>
                          </div>
                          <div className="grid grid-cols-4 gap-2 px-5 pb-5">
                            {qualityButtons.map((btn) => (
                              <button
                                key={btn.quality}
                                onClick={() => handleReview(btn.quality)}
                                disabled={reviewItem.isPending}
                                className={`p-3 rounded-lg border text-sm font-medium transition-all ${btn.color}`}
                              >
                                <div>{btn.label}</div>
                                <div className="text-[10px] opacity-60 mt-0.5">{btn.sublabel}</div>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      ) : (
                        <div className="px-5 pb-5">
                          <button
                            onClick={() => setShowAnswer(true)}
                            className="w-full py-3 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan rounded-lg font-medium hover:bg-neon-cyan/20 transition-colors"
                          >
                            Show Answer
                          </button>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Keyboard shortcuts hint */}
                  <div className="text-center text-xs text-gray-600">
                    Space: flip &middot; 1-4: rate &middot; S: skip
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* ===== DECKS VIEW ===== */}
        {view === 'decks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Your Decks</h2>
              <button
                onClick={() => setShowCreateDeck(true)}
                className="flex items-center gap-1 btn-neon purple text-sm"
              >
                <Plus className="w-4 h-4" /> New Deck
              </button>
            </div>

            {/* Deck overview stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="lens-card text-center">
                <Layers className="w-5 h-5 text-neon-cyan mx-auto mb-1" />
                <p className="text-2xl font-bold">{decks.length}</p>
                <p className="text-xs text-gray-400">Decks</p>
              </div>
              <div className="lens-card text-center">
                <BookOpen className="w-5 h-5 text-neon-blue mx-auto mb-1" />
                <p className="text-2xl font-bold">{allCards.length}</p>
                <p className="text-xs text-gray-400">Total Cards</p>
              </div>
              <div className="lens-card text-center">
                <Clock className="w-5 h-5 text-neon-yellow mx-auto mb-1" />
                <p className="text-2xl font-bold">{dueCards.length}</p>
                <p className="text-xs text-gray-400">Due Today</p>
              </div>
              <div className="lens-card text-center">
                <Star className="w-5 h-5 text-neon-green mx-auto mb-1" />
                <p className="text-2xl font-bold">{getMatureCount(allCards)}</p>
                <p className="text-xs text-gray-400">Mature</p>
              </div>
            </div>

            {/* Deck grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {decks.map(deck => (
                <motion.div
                  key={deck.id}
                  whileHover={{ scale: 1.02 }}
                  className="panel overflow-hidden cursor-pointer group"
                  onClick={() => { setSelectedDeck(deck.id); setCurrentIndex(0); setView('study'); }}
                >
                  <div className="h-2" style={{ backgroundColor: deck.color }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-white group-hover:text-neon-cyan transition-colors">{deck.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{deck.description}</p>
                      </div>
                      <FolderOpen className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="text-center p-2 bg-blue-500/10 rounded">
                        <p className="text-sm font-bold text-blue-400">{deck.newCount}</p>
                        <p className="text-[10px] text-gray-500">New</p>
                      </div>
                      <div className="text-center p-2 bg-red-500/10 rounded">
                        <p className="text-sm font-bold text-red-400">{deck.learnCount}</p>
                        <p className="text-[10px] text-gray-500">Learning</p>
                      </div>
                      <div className="text-center p-2 bg-green-500/10 rounded">
                        <p className="text-sm font-bold text-green-400">{deck.dueCount}</p>
                        <p className="text-[10px] text-gray-500">Review</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-lattice-border">
                      <span className="text-xs text-gray-500">{deck.cardCount} cards total</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedDeck(deck.id); setCurrentIndex(0); setView('study'); }}
                        className="text-xs text-neon-cyan font-medium flex items-center gap-1 hover:underline"
                      >
                        Study now <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ===== BROWSE VIEW ===== */}
        {view === 'browse' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cards..."
                  className="pl-10 pr-4 py-2 w-full bg-lattice-surface border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
                />
              </div>
              <select
                value={filterDeck}
                onChange={(e) => setFilterDeck(e.target.value)}
                className="input-lattice text-sm"
              >
                <option value="all">All Decks</option>
                {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="input-lattice text-sm"
              >
                <option value="all">All Tags</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-xs text-gray-400">{filteredCards.length} cards</span>
            </div>

            {/* Card table */}
            <div className="panel overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-lattice-border bg-lattice-bg/50">
                    <th className="p-3">Front</th>
                    <th className="p-3 w-32">Deck</th>
                    <th className="p-3 w-20 text-center">Interval</th>
                    <th className="p-3 w-20 text-center">Ease</th>
                    <th className="p-3 w-20 text-center">Reps</th>
                    <th className="p-3 w-20 text-center">Lapses</th>
                    <th className="p-3 w-28">Next Review</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCards.map(card => (
                    <tr
                      key={card.dtuId}
                      className="border-b border-lattice-border/50 hover:bg-lattice-surface/50 cursor-pointer transition-colors"
                      onClick={() => setEditingCard(card)}
                    >
                      <td className="p-3">
                        <p className="text-sm text-white truncate max-w-md">{card.front || card.title || card.dtuId}</p>
                        {card.tags && card.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {card.tags.map(t => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-lattice-bg rounded text-gray-500">{t}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: decks.find(d => d.id === card.deck)?.color || '#666' }}
                          />
                          <span className="text-xs text-gray-400">{decks.find(d => d.id === card.deck)?.name || card.deck}</span>
                        </div>
                      </td>
                      <td className="p-3 text-center text-xs font-mono text-gray-300">{card.interval || 0}d</td>
                      <td className="p-3 text-center text-xs font-mono text-gray-300">{(card.easiness || 2.5).toFixed(1)}</td>
                      <td className="p-3 text-center text-xs font-mono text-gray-300">{card.repetitions || 0}</td>
                      <td className="p-3 text-center text-xs font-mono">
                        <span className={(card.lapses || 0) > 2 ? 'text-red-400' : 'text-gray-300'}>{card.lapses || 0}</span>
                      </td>
                      <td className="p-3 text-xs text-gray-400">
                        {card.nextReview ? new Date(card.nextReview).toLocaleDateString() : 'New'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCards.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No cards match your filters</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== STATISTICS VIEW ===== */}
        {view === 'stats' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-white">Learning Statistics</h2>

            {/* Overview cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="lens-card text-center">
                <p className="text-2xl font-bold text-neon-cyan">{allCards.length}</p>
                <p className="text-xs text-gray-400">Total Cards</p>
              </div>
              <div className="lens-card text-center">
                <p className="text-2xl font-bold text-blue-400">{getNewCount(allCards)}</p>
                <p className="text-xs text-gray-400">New</p>
              </div>
              <div className="lens-card text-center">
                <p className="text-2xl font-bold text-orange-400">{getYoungCount(allCards)}</p>
                <p className="text-xs text-gray-400">Young</p>
              </div>
              <div className="lens-card text-center">
                <p className="text-2xl font-bold text-green-400">{getMatureCount(allCards)}</p>
                <p className="text-xs text-gray-400">Mature (&ge;21d)</p>
              </div>
              <div className="lens-card text-center">
                <p className="text-2xl font-bold text-neon-purple">{getAverageEase(allCards)}</p>
                <p className="text-xs text-gray-400">Avg Ease</p>
              </div>
            </div>

            {/* Retention gauge */}
            <div className="panel p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-neon-green" />
                Retention Rate
              </h3>
              <div className="flex items-center gap-6">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-lattice-deep" strokeWidth="10" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="url(#retGrad)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${getRetentionRate(allCards) * 2.64} 264`}
                    />
                    <defs>
                      <linearGradient id="retGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{getRetentionRate(allCards)}%</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm text-gray-400">
                  <p>Cards with active streaks are considered retained.</p>
                  <p>Target: 85-95% for optimal learning efficiency.</p>
                  <p className={getRetentionRate(allCards) >= 85 ? 'text-green-400' : 'text-yellow-400'}>
                    {getRetentionRate(allCards) >= 85
                      ? 'Your retention is excellent! Keep it up.'
                      : 'Consider reviewing more frequently to improve retention.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Review forecast */}
            <div className="panel p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-neon-blue" />
                30-Day Review Forecast
              </h3>
              <div className="flex items-end gap-1 h-32">
                {forecast.map((count, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t transition-all hover:opacity-80"
                      style={{
                        height: `${(count / maxForecast) * 100}%`,
                        minHeight: count > 0 ? '4px' : '0px',
                        backgroundColor: i === 0 ? '#06b6d4' : i < 7 ? '#22c55e' : '#6b7280'
                      }}
                      title={`Day ${i}: ${count} cards`}
                    />
                    {i % 5 === 0 && (
                      <span className="text-[9px] text-gray-600">{i}d</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Per-deck breakdown */}
            <div className="panel p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-neon-purple" />
                Deck Breakdown
              </h3>
              <div className="space-y-3">
                {decks.map(deck => {
                  const deckCards = allCards.filter(c => c.deck === deck.id);
                  const mature = getMatureCount(deckCards);
                  const young = getYoungCount(deckCards);
                  const newC = getNewCount(deckCards);
                  const total = deckCards.length || deck.cardCount;
                  return (
                    <div key={deck.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: deck.color }} />
                          <span className="text-sm font-medium text-white">{deck.name}</span>
                        </div>
                        <span className="text-xs text-gray-400">{total} cards</span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-lattice-deep">
                        {mature > 0 && (
                          <div className="bg-green-500" style={{ width: `${(mature / total) * 100}%` }} title={`${mature} mature`} />
                        )}
                        {young > 0 && (
                          <div className="bg-orange-400" style={{ width: `${(young / total) * 100}%` }} title={`${young} young`} />
                        )}
                        {newC > 0 && (
                          <div className="bg-blue-400" style={{ width: `${(newC / total) * 100}%` }} title={`${newC} new`} />
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-6 mt-3 pt-3 border-t border-lattice-border text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500" /> Mature (&ge;21d)</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-400" /> Young</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-400" /> New</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== CREATE CARD MODAL ===== */}
      <AnimatePresence>
        {showCreateCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowCreateCard(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-lattice-surface border border-lattice-border rounded-xl w-full max-w-lg p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-neon-cyan" /> Create Card
                </h2>
                <button onClick={() => setShowCreateCard(false)} className="text-gray-400 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Front (Question)</label>
                <textarea
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder="What is the question?"
                  className="input-lattice w-full h-24 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Back (Answer)</label>
                <textarea
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder="What is the answer?"
                  className="input-lattice w-full h-32 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Deck</label>
                  <select
                    value={newDeck}
                    onChange={(e) => setNewDeck(e.target.value)}
                    className="input-lattice w-full"
                  >
                    {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="harmony, chords"
                    className="input-lattice w-full"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateCard(false)}
                  className="flex-1 py-2 border border-lattice-border rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCard}
                  disabled={!newFront.trim() || !newBack.trim()}
                  className="flex-1 py-2 bg-neon-cyan text-black font-medium rounded-lg hover:bg-neon-cyan/90 transition-colors disabled:opacity-50"
                >
                  Create Card
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== CREATE DECK MODAL ===== */}
      <AnimatePresence>
        {showCreateDeck && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowCreateDeck(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-lattice-surface border border-lattice-border rounded-xl w-full max-w-md p-6 space-y-4"
            >
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-neon-purple" /> Create Deck
              </h2>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Deck Name</label>
                <input
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="e.g., Jazz Harmony"
                  className="input-lattice w-full"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Description</label>
                <textarea
                  value={deckDesc}
                  onChange={(e) => setDeckDesc(e.target.value)}
                  placeholder="What this deck covers..."
                  className="input-lattice w-full h-20 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Color</label>
                <div className="flex gap-2">
                  {['#06b6d4', '#a855f7', '#f97316', '#22c55e', '#ec4899', '#eab308', '#3b82f6', '#ef4444'].map(c => (
                    <button
                      key={c}
                      onClick={() => setDeckColor(c)}
                      className={`w-8 h-8 rounded-lg transition-transform ${deckColor === c ? 'scale-125 ring-2 ring-white' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateDeck(false)}
                  className="flex-1 py-2 border border-lattice-border rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!deckName.trim()}
                  onClick={() => setShowCreateDeck(false)}
                  className="flex-1 py-2 bg-neon-purple text-white font-medium rounded-lg hover:bg-neon-purple/90 transition-colors disabled:opacity-50"
                >
                  Create Deck
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== CARD DETAIL MODAL ===== */}
      <AnimatePresence>
        {editingCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setEditingCard(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-lattice-surface border border-lattice-border rounded-xl w-full max-w-lg p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Card Details</h2>
                <button onClick={() => setEditingCard(null)} className="text-gray-400 hover:text-white">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Front</label>
                  <div className="p-3 bg-lattice-bg rounded-lg text-sm text-white">
                    {editingCard.front || editingCard.title || editingCard.dtuId}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Back</label>
                  <div className="p-3 bg-lattice-bg rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
                    {editingCard.back || editingCard.content || '—'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-lattice-bg rounded-lg">
                    <p className="text-xs text-gray-500">Interval</p>
                    <p className="text-sm font-mono text-white">{editingCard.interval || 0} days</p>
                  </div>
                  <div className="p-3 bg-lattice-bg rounded-lg">
                    <p className="text-xs text-gray-500">Ease Factor</p>
                    <p className="text-sm font-mono text-white">{(editingCard.easiness || 2.5).toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-lattice-bg rounded-lg">
                    <p className="text-xs text-gray-500">Repetitions</p>
                    <p className="text-sm font-mono text-white">{editingCard.repetitions || 0}</p>
                  </div>
                  <div className="p-3 bg-lattice-bg rounded-lg">
                    <p className="text-xs text-gray-500">Lapses</p>
                    <p className="text-sm font-mono text-white">{editingCard.lapses || 0}</p>
                  </div>
                  <div className="p-3 bg-lattice-bg rounded-lg">
                    <p className="text-xs text-gray-500">Streak</p>
                    <p className="text-sm font-mono text-white">{editingCard.streak || 0}</p>
                  </div>
                  <div className="p-3 bg-lattice-bg rounded-lg">
                    <p className="text-xs text-gray-500">Next Review</p>
                    <p className="text-sm font-mono text-white">
                      {editingCard.nextReview ? new Date(editingCard.nextReview).toLocaleDateString() : 'New'}
                    </p>
                  </div>
                </div>

                {editingCard.tags && editingCard.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {editingCard.tags.map(t => (
                      <span key={t} className="text-xs px-2 py-1 bg-lattice-bg rounded-full text-gray-400">
                        <Tag className="w-3 h-3 inline mr-1" />{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingCard(null)}
                  className="flex-1 py-2 border border-lattice-border rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  Close
                </button>
                <button className="py-2 px-4 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors text-sm">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
