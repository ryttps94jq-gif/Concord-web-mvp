'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { apiHelpers } from '@/lib/api/client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Plus, Sparkles, CheckCircle2, Clock, Play, Square, RotateCcw,
  Mic, Music, BookOpen, Target, TrendingUp, Flame, ChevronLeft,
  ChevronRight, FileText, Headphones, Pause,
} from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

// -- Types ------------------------------------------------------------------
interface JournalEntry { id: string; date: string; mood: number | null; notes: string; workedOn: string; learned: string; goals: string }
interface SessionLog { id: string; project: string; duration: number; genre: string; startedAt: string }
interface AudioClip { id: string; name: string; duration: number; waveform: number[]; recordedAt: string }
interface Reminder { id: string; title: string; dueAt: string; completed: boolean }
interface PracticeSession { id: string; skill: string; duration: number; completedAt: string }

// -- Demo data --------------------------------------------------------------
const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Creativity is intelligence having fun.', author: 'Albert Einstein' },
  { text: 'Music is the shorthand of emotion.', author: 'Leo Tolstoy' },
  { text: 'Every artist was first an amateur.', author: 'Ralph Waldo Emerson' },
  { text: 'Without music, life would be a mistake.', author: 'Friedrich Nietzsche' },
  { text: 'The earth has music for those who listen.', author: 'William Shakespeare' },
  { text: 'Art is not what you see, but what you make others see.', author: 'Edgar Degas' },
];

const INITIAL_ENTRIES: JournalEntry[] = [
  { id: 'j1', date: '2026-02-07', mood: 4, notes: 'Incredible session today. Mixed down the verse section and it sounds massive.', workedOn: 'Verse mixdown for "Nightfall" EP track 3', learned: 'Parallel compression on vocals creates a much fuller presence without sacrificing dynamics.', goals: 'Finish the bridge arrangement and start layering synth pads.' },
  { id: 'j2', date: '2026-02-06', mood: 3, notes: 'Steady progress on sound design. Created a few usable patches.', workedOn: 'Synth patch design for ambient project', learned: 'Wavetable modulation with slow LFOs gives organic movement.', goals: 'Record vocal takes for track 3.' },
  { id: 'j3', date: '2026-02-05', mood: 2, notes: 'Struggled with the low-end balance all day. Nothing sounded right.', workedOn: 'Bass mixing on "Concrete" single', learned: 'Sometimes you need fresh ears. Take a break and come back.', goals: 'Revisit the bass mix with reference tracks.' },
  { id: 'j4', date: '2026-02-04', mood: 4, notes: 'Wrote an amazing chord progression that just flowed out.', workedOn: 'Songwriting session — new R&B demo', learned: 'Using the Nashville number system speeds up experimentation.', goals: 'Flesh out the demo with drums and a rough vocal.' },
  { id: 'j5', date: '2026-02-03', mood: 3, notes: 'Organized sample library and tagged everything. Productive day.', workedOn: 'Sample library management and tagging', learned: 'Consistent naming conventions save massive time later.', goals: 'Start the next production session with the cleaned-up library.' },
];

const INITIAL_SESSIONS: SessionLog[] = [
  { id: 's1', project: 'Nightfall EP — Track 3', duration: 145, genre: 'Electronic / Ambient', startedAt: '2026-02-07T09:30:00' },
  { id: 's2', project: 'Concrete Single', duration: 90, genre: 'Hip-Hop / Trap', startedAt: '2026-02-07T13:00:00' },
  { id: 's3', project: 'R&B Demo Sketch', duration: 55, genre: 'R&B / Neo-Soul', startedAt: '2026-02-07T16:15:00' },
];

const mkWave = (n: number): number[] => Array.from({ length: n }, () => 0.1 + Math.random() * 0.9);
const INITIAL_CLIPS: AudioClip[] = [
  { id: 'a1', name: 'Vocal melody idea — verse hook', duration: 34, waveform: mkWave(40), recordedAt: '2026-02-07T10:12:00' },
  { id: 'a2', name: 'Bass tone reference snap', duration: 12, waveform: mkWave(40), recordedAt: '2026-02-07T11:45:00' },
  { id: 'a3', name: 'Pad texture experiment', duration: 48, waveform: mkWave(40), recordedAt: '2026-02-07T14:22:00' },
  { id: 'a4', name: 'Quick note — remix arrangement', duration: 21, waveform: mkWave(40), recordedAt: '2026-02-07T17:05:00' },
];

const INITIAL_REMINDERS: Reminder[] = [
  { id: 'r1', title: 'Send stems to collaborator', dueAt: '2026-02-07T18:00:00', completed: false },
  { id: 'r2', title: 'Backup project files to cloud', dueAt: '2026-02-07T22:00:00', completed: false },
  { id: 'r3', title: 'Review mastering feedback', dueAt: '2026-02-08T10:00:00', completed: false },
];

const SKILLS = ['Finger drumming', 'Chord voicings', 'Sound design', 'Ear training', 'Mixing technique', 'Rhythm exercises'];
const MOODS = ['😤', '😕', '😐', '🙂', '🔥'];
const MOOD_LABELS = ['Frustrated', 'Meh', 'Neutral', 'Good vibes', 'On fire'];

// -- Helpers ----------------------------------------------------------------
const fmtTime = (sec: number) => `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
const fmtDur = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };
const dayName = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
const shortDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// -- Circular Timer SVG -----------------------------------------------------
function CircularTimer({ progress, timeLeft, size = 160 }: { progress: number; timeLeft: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-lattice-border" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#timerGrad)" strokeWidth={8}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} className="transition-all duration-300" />
      <defs>
        <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" /><stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="fill-white text-2xl font-mono font-bold transform rotate-90" style={{ transformOrigin: 'center' }}>
        {fmtTime(timeLeft)}
      </text>
    </svg>
  );
}

// -- Mini Waveform ----------------------------------------------------------
function MiniWaveform({ data, playing }: { data: number[]; playing: boolean }) {
  return (
    <div className="flex items-end gap-px h-8">
      {data.map((v, i) => (
        <div key={i} className={`w-1 rounded-full transition-colors ${playing ? 'bg-neon-cyan' : 'bg-gray-600'}`}
          style={{ height: `${v * 100}%` }} />
      ))}
    </div>
  );
}

// ===========================================================================
// Main Page Component
// ===========================================================================
export default function DailyLensPage() {
  useLensNav('daily');
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  // -- State ----------------------------------------------------------------
  const [selectedDate, setSelectedDate] = useState(today);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDue, setReminderDue] = useState('');
  const [selectedMood, setSelectedMood] = useState<number | null>(4);
  const [journalNotes, setJournalNotes] = useState(INITIAL_ENTRIES[0].notes);
  const [workedOn, setWorkedOn] = useState(INITIAL_ENTRIES[0].workedOn);
  const [learned, setLearned] = useState(INITIAL_ENTRIES[0].learned);
  const [goals, setGoals] = useState(INITIAL_ENTRIES[0].goals);
  const [sessions, setSessions] = useState<SessionLog[]>(INITIAL_SESSIONS);
  const [newProject, setNewProject] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [clips] = useState<AudioClip[]>(INITIAL_CLIPS);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [timerDuration, setTimerDuration] = useState(15 * 60);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(SKILLS[0]);
  const [practiceHistory, setPracticeHistory] = useState<PracticeSession[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [localReminders, setLocalReminders] = useState<Reminder[]>(INITIAL_REMINDERS);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });

  const { isError: isError, error: error, refetch: refetch, items: _entryItems, create: _createEntry } = useLensData('daily', 'entry', {
    seed: INITIAL_ENTRIES.map(e => ({ title: e.date, data: e as unknown as Record<string, unknown> })),
  });
  const { isError: isError2, error: error2, refetch: refetch2, items: _sessionItems, create: _createSession } = useLensData('daily', 'session', {
    seed: INITIAL_SESSIONS.map(s => ({ title: s.project, data: s as unknown as Record<string, unknown> })),
  });
  const { isError: isError3, error: error3, refetch: refetch3, items: _reminderItems, create: _createReminder } = useLensData('daily', 'reminder', {
    seed: INITIAL_REMINDERS.map(r => ({ title: r.title, data: r as unknown as Record<string, unknown> })),
  });

  // -- API queries (preserved from original) --------------------------------
  const { data: dailyData, isError: isError4, error: error4, refetch: refetch4,} = useQuery({
    queryKey: ['daily-notes'],
    queryFn: () => apiHelpers.daily.list().then((r) => r.data),
  });
  const isError5 = false as boolean; const error5 = null as Error | null; const refetch5 = () => {};
  const isError6 = false as boolean; const error6 = null as Error | null; const refetch6 = () => {};
  const generateDigest = useMutation({
    mutationFn: () => apiHelpers.daily.digest(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daily-notes'] }),
  });
  const createReminderMut = useMutation({
    mutationFn: () => apiHelpers.daily.createReminder({ title: reminderTitle, dueAt: reminderDue }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reminders-due'] }); setReminderTitle(''); setReminderDue(''); },
  });
  const completeReminderMut = useMutation({
    mutationFn: (id: string) => apiHelpers.daily.completeReminder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders-due'] }),
  });
  const _notes = useMemo(() => {
    const raw = dailyData?.notes || dailyData || [];
    return Array.isArray(raw) ? raw : [];
  }, [dailyData]);

  // -- Practice timer logic -------------------------------------------------
  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            setPracticeHistory((h) => [
              { id: `p${Date.now()}`, skill: selectedSkill, duration: timerDuration, completedAt: new Date().toISOString() },
              ...h,
            ]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning, timeLeft, timerDuration, selectedSkill]);

  const startTimer = useCallback(() => setTimerRunning(true), []);
  const stopTimer = useCallback(() => setTimerRunning(false), []);
  const resetTimer = useCallback(() => { setTimerRunning(false); setTimeLeft(timerDuration); }, [timerDuration]);

  // -- Add session ----------------------------------------------------------
  const addSession = useCallback(() => {
    if (!newProject.trim()) return;
    setSessions((prev) => [...prev, {
      id: `s${Date.now()}`, project: newProject, duration: parseInt(newDuration) || 30,
      genre: newGenre || 'General', startedAt: new Date().toISOString(),
    }]);
    setNewProject(''); setNewGenre(''); setNewDuration(''); setShowSessionForm(false);
  }, [newProject, newGenre, newDuration]);

  // -- Calendar helpers -----------------------------------------------------
  const calDays = useMemo(() => {
    const first = new Date(calMonth.year, calMonth.month, 1);
    const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
    const cells: (number | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [calMonth]);

  const entryDates = useMemo(() => new Set(INITIAL_ENTRIES.map((e) => e.date)), []);

  const recentDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) { const d = new Date(); d.setDate(d.getDate() - i); dates.push(d.toISOString().split('T')[0]); }
    return dates;
  }, []);

  const entriesThisWeek = INITIAL_ENTRIES.filter((e) => {
    return (new Date().getTime() - new Date(e.date).getTime()) / 86400000 <= 7;
  }).length;

  // -- Daily digest (mock) --------------------------------------------------
  const dailyDigest = useMemo(() => {
    const tot = sessions.reduce((s, x) => s + x.duration, 0);
    const genres = [...new Set(sessions.map((s) => s.genre))].join(', ');
    const pending = localReminders.filter((r) => !r.completed).length;
    return `You spent ${fmtDur(tot)} across ${sessions.length} sessions today. Genres covered: ${genres}. You recorded ${clips.length} audio clips and have ${pending} pending reminders.${selectedMood !== null ? ` Mood: ${MOODS[selectedMood]}` : ''}`;
  }, [sessions, clips.length, localReminders, selectedMood]);

  // -- Handlers -------------------------------------------------------------
  const handleCompleteReminder = (id: string) => {
    setLocalReminders((prev) => prev.map((r) => (r.id === id ? { ...r, completed: true } : r)));
    completeReminderMut.mutate(id);
  };
  const handleAddReminder = () => {
    if (!reminderTitle.trim() || !reminderDue) return;
    setLocalReminders((prev) => [...prev, { id: `r${Date.now()}`, title: reminderTitle, dueAt: reminderDue, completed: false }]);
    createReminderMut.mutate(); setReminderTitle(''); setReminderDue('');
  };
  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    const entry = INITIAL_ENTRIES.find((e) => e.date === dateStr);
    if (entry) { setSelectedMood(entry.mood); setJournalNotes(entry.notes); setWorkedOn(entry.workedOn); setLearned(entry.learned); setGoals(entry.goals); }
    else { setSelectedMood(null); setJournalNotes(''); setWorkedOn(''); setLearned(''); setGoals(''); }
  };

  // -- Render ---------------------------------------------------------------

  if (isError || isError2 || isError3 || isError4 || isError5 || isError6) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message || error4?.message || error5?.message || error6?.message} onRetry={() => { refetch(); refetch2(); refetch3(); refetch4(); refetch5(); refetch6(); }} />
      </div>
    );
  }
  return (
    <div className="h-[calc(100vh-4rem)] flex bg-lattice-deep text-white overflow-hidden">
      {/* =================== LEFT SIDEBAR =================== */}
      <aside className="w-72 border-r border-lattice-border bg-lattice-surface/40 flex flex-col shrink-0">
        {/* Mini calendar */}
        <div className="p-4 border-b border-lattice-border">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCalMonth((m) => { const p = new Date(m.year, m.month - 1); return { year: p.getFullYear(), month: p.getMonth() }; })}
              className="p-1 hover:bg-white/10 rounded"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold">
              {new Date(calMonth.year, calMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setCalMonth((m) => { const n = new Date(m.year, m.month + 1); return { year: n.getFullYear(), month: n.getMonth() }; })}
              className="p-1 hover:bg-white/10 rounded"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {['S','M','T','W','T','F','S'].map((d, i) => <span key={i} className="text-gray-500 font-medium py-1">{d}</span>)}
            {calDays.map((day, i) => {
              if (day === null) return <span key={`e${i}`} />;
              const ds = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const sel = ds === selectedDate, tdy = ds === today, has = entryDates.has(ds);
              return (
                <button key={ds} onClick={() => handleSelectDate(ds)}
                  className={`py-1 rounded text-xs relative transition-colors ${sel ? 'bg-neon-cyan/30 text-neon-cyan font-bold' : tdy ? 'bg-white/10 font-semibold' : 'hover:bg-white/5'}`}>
                  {day}
                  {has && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-neon-purple" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 px-1">Recent Entries</p>
          {recentDates.map((ds) => {
            const entry = INITIAL_ENTRIES.find((e) => e.date === ds);
            return (
              <button key={ds} onClick={() => handleSelectDate(ds)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                  ds === selectedDate ? 'bg-neon-cyan/10 border border-neon-cyan/30 text-white' : 'hover:bg-white/5 text-gray-400'}`}>
                <div>
                  <span className="font-medium text-inherit">{shortDate(ds)}</span>
                  <span className="text-xs text-gray-500 ml-2">{dayName(ds)}</span>
                </div>
                {entry ? <span className="text-sm">{entry.mood !== null ? MOODS[entry.mood] : ''}</span>
                  : ds <= today ? <span className="w-2 h-2 rounded-full bg-gray-700" /> : null}
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div className="p-4 border-t border-lattice-border space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> This week</span>
            <span className="font-semibold text-neon-cyan">{entriesThisWeek} entries</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-orange-400" /> Streak</span>
            <span className="font-semibold text-orange-400">5 days</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Total</span>
            <span className="font-semibold">47 entries</span>
          </div>
        </div>
      </aside>

      {/* =================== MAIN CONTENT =================== */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Inspiration quote */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-3 px-4 rounded-lg bg-gradient-to-r from-neon-purple/10 to-neon-cyan/10 border border-lattice-border">
            <p className="text-sm italic text-gray-300">&ldquo;{quote.text}&rdquo;</p>
            <p className="text-xs text-gray-500 mt-1">&mdash; {quote.author}</p>
          </motion.div>

          {/* Date header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h1>
              <p className="text-sm text-gray-400 mt-0.5">Production Journal</p>
            </div>
            <button onClick={() => generateDigest.mutate()} disabled={generateDigest.isPending}
              className="btn-neon purple flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4" />
              {generateDigest.isPending ? 'Generating...' : 'Generate Digest'}
            </button>
          </div>

          {/* Mood tracker */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="lens-card">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">How are you feeling?</h2>
            <div className="flex items-center gap-3">
              {MOODS.map((emoji, idx) => (
                <button key={idx} onClick={() => setSelectedMood(idx)}
                  className={`text-2xl p-2 rounded-xl transition-all ${selectedMood === idx ? 'bg-neon-cyan/20 ring-2 ring-neon-cyan scale-110' : 'hover:bg-white/10 opacity-60 hover:opacity-100'}`}>
                  {emoji}
                </button>
              ))}
              {selectedMood !== null && <span className="ml-3 text-sm text-gray-400">{MOOD_LABELS[selectedMood]}</span>}
            </div>
          </motion.div>

          {/* Journal entry */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="lens-card space-y-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-neon-purple" /> Journal Entry
            </h2>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Daily Notes</label>
              <textarea value={journalNotes} onChange={(e) => setJournalNotes(e.target.value)}
                placeholder="How did your day go?" rows={3} className="input-lattice w-full text-sm resize-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <Music className="w-3 h-3" /> What I worked on today
              </label>
              <textarea value={workedOn} onChange={(e) => setWorkedOn(e.target.value)}
                placeholder="Production log..." rows={2} className="input-lattice w-full text-sm resize-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" /> What I learned
              </label>
              <textarea value={learned} onChange={(e) => setLearned(e.target.value)}
                placeholder="Key takeaways..." rows={2} className="input-lattice w-full text-sm resize-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3 h-3" /> Goals for tomorrow
              </label>
              <textarea value={goals} onChange={(e) => setGoals(e.target.value)}
                placeholder="What do you want to accomplish?" rows={2} className="input-lattice w-full text-sm resize-none" />
            </div>
          </motion.div>

          {/* Session log */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="lens-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-neon-cyan" /> Session Log
              </h2>
              <button onClick={() => setShowSessionForm((v) => !v)} className="btn-neon text-xs flex items-center gap-1">
                <Plus className="w-3 h-3" /> Log Session
              </button>
            </div>
            <AnimatePresence>
              {showSessionForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
                  <div className="p-3 rounded-lg bg-white/5 border border-lattice-border space-y-2">
                    <input type="text" value={newProject} onChange={(e) => setNewProject(e.target.value)}
                      placeholder="Project name..." className="input-lattice w-full text-sm" />
                    <div className="flex gap-2">
                      <input type="text" value={newGenre} onChange={(e) => setNewGenre(e.target.value)}
                        placeholder="Genre..." className="input-lattice flex-1 text-sm" />
                      <input type="number" value={newDuration} onChange={(e) => setNewDuration(e.target.value)}
                        placeholder="Minutes" className="input-lattice w-24 text-sm" />
                    </div>
                    <button onClick={addSession} className="btn-neon purple text-xs w-full">Add</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-lattice-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.project}</p>
                    <p className="text-xs text-gray-500">{s.genre}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="text-sm font-mono text-neon-cyan">{fmtDur(s.duration)}</span>
                    <p className="text-xs text-gray-500">{new Date(s.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && <p className="text-center text-sm text-gray-500 py-4">No sessions logged yet today.</p>}
            </div>
          </motion.div>

          {/* Audio clips */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="lens-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Headphones className="w-4 h-4 text-neon-purple" /> Audio Clips
              </h2>
              <button className="btn-neon purple text-xs flex items-center gap-1">
                <Mic className="w-3 h-3" /> Record Quick Note
              </button>
            </div>
            <div className="space-y-2">
              {clips.map((clip) => {
                const isPlaying = playingClip === clip.id;
                return (
                  <div key={clip.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-lattice-border">
                    <button onClick={() => setPlayingClip(isPlaying ? null : clip.id)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${isPlaying ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-white/10 hover:bg-white/20'}`}>
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{clip.name}</p>
                      <p className="text-xs text-gray-500">{new Date(clip.recordedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                    <MiniWaveform data={clip.waveform} playing={isPlaying} />
                    <span className="text-xs text-gray-500 font-mono shrink-0 ml-2">{fmtTime(clip.duration)}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Practice timer */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="lens-card">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-orange-400" /> Practice Timer
            </h2>
            <div className="flex gap-8 items-start">
              <div className="flex flex-col items-center gap-3">
                <CircularTimer progress={timerDuration > 0 ? (timerDuration - timeLeft) / timerDuration : 0} timeLeft={timeLeft} />
                <div className="flex items-center gap-2">
                  {!timerRunning ? (
                    <button onClick={startTimer} disabled={timeLeft === 0} className="btn-neon flex items-center gap-1.5 text-sm">
                      <Play className="w-3.5 h-3.5" /> Start
                    </button>
                  ) : (
                    <button onClick={stopTimer} className="btn-neon flex items-center gap-1.5 text-sm">
                      <Square className="w-3.5 h-3.5" /> Stop
                    </button>
                  )}
                  <button onClick={resetTimer} className="btn-neon purple flex items-center gap-1.5 text-sm">
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                </div>
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Skill</label>
                  <select value={selectedSkill} onChange={(e) => setSelectedSkill(e.target.value)} className="input-lattice w-full text-sm">
                    {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider">Duration</label>
                  <div className="flex gap-2">
                    {[5, 10, 15, 25, 45].map((m) => (
                      <button key={m} onClick={() => { setTimerDuration(m * 60); setTimeLeft(m * 60); setTimerRunning(false); }}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${timerDuration === m * 60
                          ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}>
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
                {practiceHistory.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Today&apos;s Sessions</p>
                    <div className="space-y-1">
                      {practiceHistory.map((ph) => (
                        <div key={ph.id} className="flex items-center justify-between text-xs p-2 rounded bg-white/5">
                          <span>{ph.skill}</span>
                          <span className="text-neon-cyan font-mono">{fmtTime(ph.duration)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Reminders */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="lens-card">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-neon-yellow" /> Reminders
              {localReminders.filter((r) => !r.completed).length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                  {localReminders.filter((r) => !r.completed).length}
                </span>
              )}
            </h2>
            <div className="flex gap-2 mb-4">
              <input type="text" value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="Reminder title..." className="input-lattice flex-1 text-sm" />
              <input type="datetime-local" value={reminderDue} onChange={(e) => setReminderDue(e.target.value)}
                className="input-lattice text-sm" />
              <button onClick={handleAddReminder} disabled={!reminderTitle.trim() || !reminderDue}
                className="btn-neon purple text-sm flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {localReminders.filter((r) => !r.completed).map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-lattice-border">
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-gray-500">
                      Due {new Date(r.dueAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <button onClick={() => handleCompleteReminder(r.id)}
                    className="p-1.5 text-green-400 hover:bg-green-400/20 rounded-lg transition-colors">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {localReminders.filter((r) => !r.completed).length === 0 && (
                <p className="text-center text-sm text-gray-500 py-3">All caught up!</p>
              )}
            </div>
          </motion.div>

          {/* Daily digest */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="lens-card bg-gradient-to-br from-neon-purple/5 to-neon-cyan/5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-neon-purple" /> Daily Digest
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed">{dailyDigest}</p>
          </motion.div>

          <div className="h-6" />
        </div>
      </main>
    </div>
  );
}
