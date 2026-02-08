'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { apiHelpers } from '@/lib/api/client';
import { VoiceRecorder } from '@/components/voice/VoiceRecorder';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Square,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Star,
  Trash2,
  Edit3,
  Check,
  X,
  Save,
  FileText,
  Activity,
  Clock,
  HardDrive,
  Sliders,
  Zap,
  Radio,
  Award,
  GitCompare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RecordingStatus = 'ready' | 'recording' | 'processing';
type ExportFormat = 'wav' | 'mp3' | 'flac';

interface Take {
  id: string;
  number: number;
  name: string;
  duration: number;
  timestamp: Date;
  starred: boolean;
  isBest: boolean;
  waveformHeights: number[];
  transcript: string | null;
}

interface EffectNode {
  id: string;
  name: string;
  enabled: boolean;
  paramLabel: string;
  paramValue: number;
  paramMin: number;
  paramMax: number;
  paramUnit: string;
}

type ProcessingPreset = 'raw' | 'podcast' | 'vocal' | 'broadcast';

const PRESET_CONFIGS: Record<ProcessingPreset, Record<string, { enabled: boolean; value: number }>> = {
  raw: {
    'noise-gate': { enabled: false, value: -60 },
    compressor: { enabled: false, value: 4 },
    eq: { enabled: false, value: 0 },
    'de-esser': { enabled: false, value: 4 },
    reverb: { enabled: false, value: 10 },
  },
  podcast: {
    'noise-gate': { enabled: true, value: -40 },
    compressor: { enabled: true, value: 6 },
    eq: { enabled: true, value: 3 },
    'de-esser': { enabled: true, value: 6 },
    reverb: { enabled: false, value: 10 },
  },
  vocal: {
    'noise-gate': { enabled: true, value: -45 },
    compressor: { enabled: true, value: 4 },
    eq: { enabled: true, value: 5 },
    'de-esser': { enabled: true, value: 5 },
    reverb: { enabled: true, value: 25 },
  },
  broadcast: {
    'noise-gate': { enabled: true, value: -35 },
    compressor: { enabled: true, value: 8 },
    eq: { enabled: true, value: 2 },
    'de-esser': { enabled: true, value: 7 },
    reverb: { enabled: false, value: 5 },
  },
};

const generateWaveform = (count: number): number[] =>
  Array.from({ length: count }, () => Math.random() * 0.7 + 0.15);

const SEED_TAKES: Take[] = [
  {
    id: 'take-1',
    number: 1,
    name: 'Take 1',
    duration: 47,
    timestamp: new Date(Date.now() - 900000),
    starred: false,
    isBest: false,
    waveformHeights: generateWaveform(16),
    transcript: 'This is the first take of the recording session. Testing one two three.',
  },
  {
    id: 'take-2',
    number: 2,
    name: 'Take 2',
    duration: 63,
    timestamp: new Date(Date.now() - 600000),
    starred: true,
    isBest: true,
    waveformHeights: generateWaveform(16),
    transcript: 'Second take with improved delivery. The knowledge lattice enables cognitive enhancement through structured data.',
  },
  {
    id: 'take-3',
    number: 3,
    name: 'Take 3',
    duration: 35,
    timestamp: new Date(Date.now() - 300000),
    starred: false,
    isBest: false,
    waveformHeights: generateWaveform(16),
    transcript: 'Third attempt. Concord cognitive engine processes information in real time.',
  },
  {
    id: 'take-4',
    number: 4,
    name: 'Pickup - Intro',
    duration: 22,
    timestamp: new Date(Date.now() - 120000),
    starred: true,
    isBest: false,
    waveformHeights: generateWaveform(16),
    transcript: null,
  },
];

const INITIAL_EFFECTS: EffectNode[] = [
  { id: 'noise-gate', name: 'Noise Gate', enabled: false, paramLabel: 'Threshold', paramValue: -40, paramMin: -80, paramMax: 0, paramUnit: 'dB' },
  { id: 'compressor', name: 'Compressor', enabled: false, paramLabel: 'Ratio', paramValue: 4, paramMin: 1, paramMax: 20, paramUnit: ':1' },
  { id: 'eq', name: 'EQ', enabled: false, paramLabel: 'Presence', paramValue: 0, paramMin: -12, paramMax: 12, paramUnit: 'dB' },
  { id: 'de-esser', name: 'De-esser', enabled: false, paramLabel: 'Intensity', paramValue: 4, paramMin: 0, paramMax: 10, paramUnit: '' },
  { id: 'reverb', name: 'Reverb', enabled: false, paramLabel: 'Mix', paramValue: 10, paramMin: 0, paramMax: 100, paramUnit: '%' },
];

const SEED_INPUTS = [
  { id: 'default', label: 'Built-in Microphone' },
  { id: 'usb-1', label: 'Blue Yeti USB' },
  { id: 'interface-1', label: 'Focusrite Scarlett 2i2 - Input 1' },
  { id: 'interface-2', label: 'Focusrite Scarlett 2i2 - Input 2' },
];

export default function VoiceLensPage() {
  useLensNav('voice');
  const queryClient = useQueryClient();

  // Recording state
  const [status, setStatus] = useState<RecordingStatus>('ready');
  const [recordingTime, setRecordingTime] = useState(0);
  const [sessionTime, setSessionTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Takes
  const [takes, setTakes] = useState<Take[]>(SEED_TAKES);
  const { items: _takeItems, create: _createTake } = useLensData<Take>('voice', 'take', {
    seed: SEED_TAKES.map(t => ({ title: t.name, data: t as unknown as Record<string, unknown> })),
  });
  const [activeTakeId, setActiveTakeId] = useState<string | null>('take-2');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Processing
  const [effects, setEffects] = useState<EffectNode[]>(INITIAL_EFFECTS);
  const [activePreset, setActivePreset] = useState<ProcessingPreset>('raw');

  // Transcription
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState('');

  // Input
  const [selectedInput, setSelectedInput] = useState('default');

  // Waveform animation
  const [waveformBars, setWaveformBars] = useState<number[]>(() =>
    Array.from({ length: 48 }, () => 0.1)
  );
  const animFrameRef = useRef<number>();

  // Level meters
  const [levelL, setLevelL] = useState(0);
  const [levelR, setLevelR] = useState(0);

  const activeTake = takes.find((t) => t.id === activeTakeId) || null;

  // Session timer
  useEffect(() => {
    const iv = setInterval(() => setSessionTime((p) => p + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Recording timer
  useEffect(() => {
    if (status !== 'recording') return;
    const iv = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    return () => clearInterval(iv);
  }, [status]);

  // Waveform + level animation while recording
  useEffect(() => {
    if (status !== 'recording') {
      setWaveformBars(Array.from({ length: 48 }, () => 0.1));
      setLevelL(0);
      setLevelR(0);
      return;
    }
    let running = true;
    const animate = () => {
      if (!running) return;
      setWaveformBars(
        Array.from({ length: 48 }, (_, i) =>
          Math.max(0.08, Math.min(1, 0.3 + Math.sin(Date.now() / 180 + i * 0.35) * 0.25 + Math.random() * 0.35))
        )
      );
      setLevelL(0.4 + Math.random() * 0.5);
      setLevelR(0.35 + Math.random() * 0.5);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [status]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (d: Date) => {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  // Transport handlers
  const handleRecord = useCallback(() => {
    setStatus('recording');
    setRecordingTime(0);
  }, []);

  const handleStop = useCallback(() => {
    if (status === 'recording') {
      setStatus('processing');
      const newTake: Take = {
        id: `take-${Date.now()}`,
        number: takes.length + 1,
        name: `Take ${takes.length + 1}`,
        duration: recordingTime,
        timestamp: new Date(),
        starred: false,
        isBest: false,
        waveformHeights: generateWaveform(16),
        transcript: null,
      };
      setTimeout(() => {
        setTakes((prev) => [...prev, newTake]);
        setActiveTakeId(newTake.id);
        setStatus('ready');
      }, 1200);
    } else {
      setIsPlaying(false);
    }
  }, [status, recordingTime, takes.length]);

  const handlePlayPause = useCallback(() => {
    if (status === 'recording') return;
    setIsPlaying((p) => !p);
  }, [status]);

  // Take actions
  const toggleStar = (id: string) =>
    setTakes((prev) => prev.map((t) => (t.id === id ? { ...t, starred: !t.starred } : t)));

  const deleteTake = (id: string) => {
    setTakes((prev) => prev.filter((t) => t.id !== id));
    if (activeTakeId === id) setActiveTakeId(null);
  };

  const startRename = (take: Take) => {
    setRenamingId(take.id);
    setRenameValue(take.name);
  };

  const confirmRename = () => {
    if (renamingId && renameValue.trim()) {
      setTakes((prev) =>
        prev.map((t) => (t.id === renamingId ? { ...t, name: renameValue.trim() } : t))
      );
    }
    setRenamingId(null);
  };

  const markBest = (id: string) =>
    setTakes((prev) =>
      prev.map((t) => ({ ...t, isBest: t.id === id }))
    );

  // Effects
  const toggleEffect = (id: string) =>
    setEffects((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
    );

  const setEffectParam = (id: string, value: number) =>
    setEffects((prev) =>
      prev.map((e) => (e.id === id ? { ...e, paramValue: value } : e))
    );

  const applyPreset = (preset: ProcessingPreset) => {
    setActivePreset(preset);
    const cfg = PRESET_CONFIGS[preset];
    setEffects((prev) =>
      prev.map((e) => {
        const pc = cfg[e.id];
        return pc ? { ...e, enabled: pc.enabled, paramValue: pc.value } : e;
      })
    );
  };

  // Transcription / Save
  const handleTranscribe = async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    const res = await apiHelpers.voice.transcribe(formData);
    return res.data?.transcript || res.data?.text || '';
  };

  const saveMutation = useMutation({
    mutationFn: async ({ transcript }: { transcript?: string }) => {
      const formData = new FormData();
      formData.append('audio', new Blob(), 'recording.webm');
      if (transcript) formData.append('transcript', transcript);
      return apiHelpers.voice.ingest(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dtus'] });
    },
  });

  const handleSaveDTU = () => {
    if (activeTake?.transcript) {
      saveMutation.mutate({ transcript: activeTake.transcript });
    }
  };

  // Stats
  const totalDuration = takes.reduce((s, t) => s + t.duration, 0);
  const estimatedStorage = takes.reduce((s, t) => s + t.duration * 176, 0);
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-purple-900/10 to-black">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-lattice-border bg-black/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-neon-pink/20 flex items-center justify-center">
            <Mic className="w-5 h-5 text-neon-pink" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Recording Booth</h1>
            <p className="text-xs text-gray-500">Voice capture and processing studio</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Input selector */}
          <div className="flex items-center gap-2">
            <Mic className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedInput}
              onChange={(e) => setSelectedInput(e.target.value)}
              className="bg-white/5 border border-lattice-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-neon-cyan/50"
            >
              {SEED_INPUTS.map((inp) => (
                <option key={inp.id} value={inp.id} className="bg-lattice-surface">
                  {inp.label}
                </option>
              ))}
            </select>
          </div>
          {/* Session timer */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-mono text-gray-300">Session {formatTime(sessionTime)}</span>
          </div>
        </div>
      </header>

      {/* Main three-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Take management */}
        <aside className="w-72 flex-shrink-0 border-r border-lattice-border bg-black/30 flex flex-col">
          <div className="px-4 py-3 border-b border-lattice-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">Takes</h2>
            <button className="text-xs text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1">
              <GitCompare className="w-3 h-3" />
              Compare
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {takes.map((take) => (
              <div
                key={take.id}
                onClick={() => setActiveTakeId(take.id)}
                className={cn(
                  'px-4 py-3 border-b border-white/5 cursor-pointer transition-colors group',
                  activeTakeId === take.id
                    ? 'bg-neon-cyan/5 border-l-2 border-l-neon-cyan'
                    : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  {renamingId === take.id ? (
                    <div className="flex items-center gap-1 flex-1 mr-2">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                        className="flex-1 bg-white/10 border border-lattice-border rounded px-2 py-0.5 text-xs focus:outline-none"
                        autoFocus
                      />
                      <button onClick={confirmRename} className="text-neon-cyan">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setRenamingId(null)} className="text-gray-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm font-medium truncate">{take.name}</span>
                      {take.isBest && (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-neon-pink/15 text-neon-pink text-[10px] rounded-full font-semibold whitespace-nowrap">
                          <Award className="w-2.5 h-2.5" />
                          Best
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(take.id); }}
                      className={cn('p-1 rounded', take.starred ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400')}
                    >
                      <Star className={cn('w-3 h-3', take.starred && 'fill-current')} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); startRename(take); }}
                      className="p-1 rounded text-gray-600 hover:text-gray-300"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); markBest(take.id); }}
                      className="p-1 rounded text-gray-600 hover:text-neon-pink"
                    >
                      <Award className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTake(take.id); }}
                      className="p-1 rounded text-gray-600 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-500 mb-2">
                  <span>{formatTime(take.duration)}</span>
                  <span>{formatTimestamp(take.timestamp)}</span>
                </div>
                {/* Waveform thumbnail */}
                <div className="flex items-end gap-[2px] h-5">
                  {take.waveformHeights.map((h, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex-1 rounded-sm transition-colors',
                        activeTakeId === take.id ? 'bg-neon-cyan/60' : 'bg-gray-700'
                      )}
                      style={{ height: `${h * 100}%` }}
                    />
                  ))}
                </div>
              </div>
            ))}
            {takes.length === 0 && (
              <div className="p-6 text-center text-gray-600 text-sm">
                No takes yet. Press record to begin.
              </div>
            )}
          </div>
        </aside>

        {/* Center - Main recording area */}
        <main className="flex-1 flex flex-col items-center justify-between py-6 px-4 overflow-y-auto">
          {/* Status indicator */}
          <div className="flex items-center gap-2 mb-4">
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                status === 'ready' && 'bg-green-500',
                status === 'recording' && 'bg-red-500 animate-pulse',
                status === 'processing' && 'bg-yellow-500 animate-pulse'
              )}
            />
            <span
              className={cn(
                'text-sm font-medium uppercase tracking-wider',
                status === 'ready' && 'text-green-400',
                status === 'recording' && 'text-red-400',
                status === 'processing' && 'text-yellow-400'
              )}
            >
              {status === 'ready' ? 'Ready' : status === 'recording' ? 'Recording' : 'Processing'}
            </span>
          </div>

          {/* Record button */}
          <motion.button
            onClick={status === 'recording' ? handleStop : handleRecord}
            disabled={status === 'processing'}
            className={cn(
              'relative w-28 h-28 rounded-full flex items-center justify-center transition-colors mb-6',
              status === 'recording'
                ? 'bg-red-500/20 border-2 border-red-500'
                : status === 'processing'
                  ? 'bg-yellow-500/10 border-2 border-yellow-500/50 cursor-not-allowed'
                  : 'bg-red-500/10 border-2 border-red-500/60 hover:bg-red-500/20'
            )}
            whileTap={status !== 'processing' ? { scale: 0.95 } : undefined}
          >
            {status === 'recording' && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-red-500/40"
                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {status === 'recording' ? (
              <Square className="w-10 h-10 text-red-400 fill-red-400" />
            ) : status === 'processing' ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Activity className="w-10 h-10 text-yellow-400" />
              </motion.div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-red-500" />
            )}
          </motion.button>

          {/* Recording timer */}
          <div className="text-4xl font-mono text-white mb-6">
            {status === 'recording' ? (
              <span className="text-red-400">{formatTime(recordingTime)}</span>
            ) : (
              <span className="text-gray-500">{formatTime(activeTake?.duration || 0)}</span>
            )}
          </div>

          {/* Waveform visualization */}
          <div className="w-full max-w-2xl h-28 flex items-center justify-center gap-[3px] mb-6 px-4">
            {waveformBars.map((h, i) => (
              <motion.div
                key={i}
                className={cn(
                  'w-[6px] rounded-full',
                  status === 'recording' ? 'bg-neon-cyan' : 'bg-gray-700'
                )}
                animate={{ height: `${h * 100}%` }}
                transition={{ duration: 0.08, ease: 'easeOut' }}
                style={{ minHeight: 4 }}
              />
            ))}
          </div>

          {/* Level meters */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-[10px] text-gray-500 font-mono w-4 text-right">L</span>
            <div className="w-48 h-3 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple"
                animate={{ width: `${levelL * 100}%` }}
                transition={{ duration: 0.06 }}
              />
            </div>
            <div className="w-48 h-3 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple"
                animate={{ width: `${levelR * 100}%` }}
                transition={{ duration: 0.06 }}
              />
            </div>
            <span className="text-[10px] text-gray-500 font-mono w-4">R</span>
          </div>

          {/* Transport controls */}
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => {}} className="p-2.5 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={status === 'recording' ? handleStop : status === 'processing' ? undefined : handleRecord}
              disabled={status === 'processing'}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                status === 'recording'
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              )}
            >
              {status === 'recording' ? (
                <Square className="w-5 h-5 fill-current" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-red-500" />
              )}
            </button>
            <button
              onClick={handlePlayPause}
              disabled={status === 'recording'}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                'bg-white/10 text-white hover:bg-white/20',
                status === 'recording' && 'opacity-40 cursor-not-allowed'
              )}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button onClick={() => {}} className="p-2.5 rounded-full bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Hidden VoiceRecorder - keeps functional hook available */}
          <div className="hidden">
            <VoiceRecorder onTranscribe={handleTranscribe} maxDuration={600} />
          </div>
        </main>

        {/* Right sidebar - Processing chain */}
        <aside className="w-72 flex-shrink-0 border-l border-lattice-border bg-black/30 flex flex-col">
          <div className="px-4 py-3 border-b border-lattice-border">
            <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5" />
              Processing Chain
            </h2>
          </div>

          {/* Presets */}
          <div className="px-4 py-3 border-b border-white/5">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-2">Preset</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['raw', 'podcast', 'vocal', 'broadcast'] as ProcessingPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                    activePreset === preset
                      ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                      : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Effect chain */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {effects.map((fx, idx) => (
              <div key={fx.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 font-mono">{idx + 1}</span>
                    <span className="text-sm font-medium">{fx.name}</span>
                  </div>
                  <button
                    onClick={() => toggleEffect(fx.id)}
                    className={cn(
                      'w-9 h-5 rounded-full transition-colors relative',
                      fx.enabled ? 'bg-neon-cyan' : 'bg-gray-700'
                    )}
                  >
                    <motion.div
                      className="w-4 h-4 rounded-full bg-white absolute top-0.5"
                      animate={{ left: fx.enabled ? 18 : 2 }}
                      transition={{ duration: 0.15 }}
                    />
                  </button>
                </div>
                <AnimatePresence>
                  {fx.enabled && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                          <span>{fx.paramLabel}</span>
                          <span className="font-mono">
                            {fx.paramValue}{fx.paramUnit}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={fx.paramMin}
                          max={fx.paramMax}
                          value={fx.paramValue}
                          onChange={(e) => setEffectParam(fx.id, Number(e.target.value))}
                          className="w-full h-1 accent-neon-cyan"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Apply processing */}
          <div className="px-4 py-3 border-t border-lattice-border">
            <button className="w-full py-2 bg-neon-purple/20 text-neon-purple rounded-lg text-sm font-medium hover:bg-neon-purple/30 transition-colors flex items-center justify-center gap-2">
              <Zap className="w-4 h-4" />
              Apply Processing
            </button>
          </div>
        </aside>
      </div>

      {/* Bottom section - Transcription + Export */}
      <div className="border-t border-lattice-border bg-black/40">
        <div className="flex items-stretch">
          {/* Transcription panel */}
          <div className="flex-1 p-4 border-r border-white/5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Transcription
              </h3>
              {activeTake?.transcript && (
                <button
                  onClick={() => {
                    if (editingTranscript) {
                      setTakes((prev) =>
                        prev.map((t) =>
                          t.id === activeTakeId ? { ...t, transcript: transcriptDraft } : t
                        )
                      );
                      setEditingTranscript(false);
                    } else {
                      setTranscriptDraft(activeTake.transcript || '');
                      setEditingTranscript(true);
                    }
                  }}
                  className="text-xs text-neon-cyan hover:text-neon-cyan/80 flex items-center gap-1"
                >
                  {editingTranscript ? <Check className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                  {editingTranscript ? 'Save' : 'Edit'}
                </button>
              )}
            </div>
            {activeTake ? (
              editingTranscript ? (
                <textarea
                  value={transcriptDraft}
                  onChange={(e) => setTranscriptDraft(e.target.value)}
                  className="w-full h-16 bg-white/5 border border-lattice-border rounded-lg p-2 text-xs text-gray-300 resize-none focus:outline-none focus:border-neon-cyan/50"
                />
              ) : activeTake.transcript ? (
                <p className="text-xs text-gray-400 line-clamp-3">{activeTake.transcript}</p>
              ) : (
                <p className="text-xs text-gray-600 italic">No transcript available. Process take to generate.</p>
              )
            ) : (
              <p className="text-xs text-gray-600 italic">Select a take to view its transcription.</p>
            )}
          </div>

          {/* Export + Save */}
          <div className="flex items-center gap-3 px-4">
            <button
              onClick={handleSaveDTU}
              disabled={!activeTake?.transcript || saveMutation.isPending}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors',
                activeTake?.transcript
                  ? 'bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30'
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              )}
            >
              <Save className="w-3.5 h-3.5" />
              {saveMutation.isPending ? 'Saving...' : 'Save as DTU'}
            </button>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 mr-1">Export:</span>
              {(['wav', 'mp3', 'flac'] as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  className="px-2.5 py-1.5 bg-white/5 rounded text-[10px] font-mono uppercase text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-lattice-border bg-black/60 text-[11px] text-gray-500">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <Radio className="w-3 h-3" />
            {takes.length} take{takes.length !== 1 ? 's' : ''} recorded
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {formatTime(totalDuration)} total
          </span>
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3 h-3" />
            {formatBytes(estimatedStorage)} est.
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3" />
          <span>48kHz / 24-bit</span>
        </div>
      </div>
    </div>
  );
}
