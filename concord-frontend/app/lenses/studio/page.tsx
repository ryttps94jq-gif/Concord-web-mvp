'use client';

import { useState, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Play,
  Pause,
  Square,
  Circle,
  Plus,
  Trash2,
  Sliders,
  Mic2,
  Piano,
  Guitar,
  Drum,
  Waves,
  Save,
  Download,
  X,
  Headphones,
  Radio,
  Zap,
  BarChart3,
  Activity,
  Layers,
  Clock,
  Sparkles,
  Brain,
  BookOpen,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StudioView = 'arrange' | 'mixer' | 'instruments' | 'effects' | 'ai-assistant' | 'learn';

interface Project {
  id: string;
  title: string;
  bpm: number;
  key: string;
  scale: string;
  genre: string | null;
  tracks: Track[];
  masterBus: { volume: number; effects: Effect[] };
  arrangement: { length: number; sections: Section[] };
  createdAt: number;
  updatedAt: number;
}

interface Track {
  id: string;
  name: string;
  type: string;
  instrumentId: string | null;
  color: string;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  armed: boolean;
  effects: Effect[];
  clips: Clip[];
}

interface Effect {
  id: string;
  effectId?: string;
  name: string;
  label?: string;
  effect?: string;
  category: string;
  enabled: boolean;
  params: Record<string, unknown>;
}

interface Clip {
  id: string;
  name: string;
  startBar: number;
  lengthBars: number;
  color: string;
}

interface Section {
  id: string;
  name: string;
  start: number;
  end: number;
  color: string;
}

interface Instrument {
  name: string;
  type: string;
  category: string;
  params: string[];
}

const _TRACK_COLORS = ['#7c3aed', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

export default function StudioLensPage() {
  useLensNav('studio');
  const queryClient = useQueryClient();

  const [studioView, setStudioView] = useState<StudioView>('arrange');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [_showEffects, setShowEffects] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);

  // New project form
  const [newTitle, setNewTitle] = useState('');
  const [newBpm, setNewBpm] = useState('120');
  const [newKey, setNewKey] = useState('C');
  const [newGenre, setNewGenre] = useState('');

  // AI assistant
  const [aiQuestion, setAiQuestion] = useState('');

  const { data: projects } = useQuery({
    queryKey: ['studio-projects'],
    queryFn: () => api.get('/api/artistry/studio/projects').then(r => r.data?.projects || []).catch(() => []),
    initialData: [],
  });

  const { data: activeProject, refetch: refetchProject } = useQuery({
    queryKey: ['studio-project', activeProjectId],
    queryFn: () => activeProjectId ? api.get(`/api/artistry/studio/projects/${activeProjectId}`).then(r => r.data?.project || null).catch(() => null) : null,
    enabled: !!activeProjectId,
  });

  const { data: instruments } = useQuery({
    queryKey: ['studio-instruments'],
    queryFn: () => api.get('/api/artistry/studio/instruments').then(r => r.data?.instruments || {}).catch(() => ({})),
    initialData: {},
  });

  const { data: effectsCatalog } = useQuery({
    queryKey: ['studio-effects'],
    queryFn: () => api.get('/api/artistry/studio/effects').then(r => r.data?.effects || {}).catch(() => ({})),
    initialData: {},
  });

  const { data: genres } = useQuery({
    queryKey: ['artistry-genres'],
    queryFn: () => api.get('/api/artistry/genres').then(r => r.data || {}).catch(() => ({})),
    initialData: {},
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/api/artistry/studio/projects', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['studio-projects'] });
      setActiveProjectId(res.data?.project?.id);
      setShowNewProject(false);
      setNewTitle('');
    },
  });

  const addTrackMutation = useMutation({
    mutationFn: (data: { instrumentId?: string; name?: string; type?: string }) =>
      api.post(`/api/artistry/studio/projects/${activeProjectId}/tracks`, data),
    onSuccess: () => {
      refetchProject();
      setShowAddTrack(false);
    },
  });

  const updateTrackMutation = useMutation({
    mutationFn: ({ trackId, ...data }: { trackId: string } & Record<string, unknown>) =>
      api.patch(`/api/artistry/studio/projects/${activeProjectId}/tracks/${trackId}`, data),
    onSuccess: () => refetchProject(),
  });

  const deleteTrackMutation = useMutation({
    mutationFn: (trackId: string) => api.delete(`/api/artistry/studio/projects/${activeProjectId}/tracks/${trackId}`),
    onSuccess: () => refetchProject(),
  });

  const addEffectMutation = useMutation({
    mutationFn: ({ trackId, effectId }: { trackId: string; effectId: string }) =>
      api.post(`/api/artistry/studio/projects/${activeProjectId}/tracks/${trackId}/effects`, { effectId }),
    onSuccess: () => refetchProject(),
  });

  const masterMutation = useMutation({
    mutationFn: () => api.post('/api/artistry/studio/master', { projectId: activeProjectId }),
  });

  const aiAnalyzeMutation = useMutation({
    mutationFn: () => api.post('/api/artistry/ai/analyze-project', { projectId: activeProjectId }),
  });

  const aiSessionMutation = useMutation({
    mutationFn: (question: string) => api.post('/api/artistry/ai/session', { projectId: activeProjectId, question }),
  });

  const aiChordsMutation = useMutation({
    mutationFn: () => api.post('/api/artistry/ai/suggest-chords', {
      key: (activeProject as Project)?.key || 'C',
      scale: (activeProject as Project)?.scale || 'major',
      genre: (activeProject as Project)?.genre,
    }),
  });

  const aiDrumsMutation = useMutation({
    mutationFn: () => api.post('/api/artistry/ai/suggest-drums', {
      bpm: (activeProject as Project)?.bpm || 120,
      genre: (activeProject as Project)?.genre || 'electronic',
    }),
  });

  const handleCreateProject = useCallback(() => {
    createProjectMutation.mutate({
      title: newTitle || 'Untitled Project',
      bpm: Number(newBpm) || 120,
      key: newKey,
      genre: newGenre || undefined,
    });
  }, [newTitle, newBpm, newKey, newGenre, createProjectMutation]);

  const proj = activeProject as Project | null;

  const renderTransportBar = () => (
    <div className="h-12 bg-black/60 border-b border-white/10 flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setIsPlaying(!isPlaying)} className={cn('w-8 h-8 rounded-full flex items-center justify-center', isPlaying ? 'bg-neon-green text-black' : 'bg-white/10 text-white hover:bg-white/20')}>
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <button onClick={() => { setIsPlaying(false); setPlayhead(0); }} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20">
          <Square className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setIsRecording(!isRecording)} className={cn('w-8 h-8 rounded-full flex items-center justify-center', isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-red-400 hover:bg-white/20')}>
          <Circle className="w-3.5 h-3.5 fill-current" />
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-mono text-neon-cyan">{Math.floor(playhead / 4) + 1}.{(playhead % 4) + 1}.1</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded">
          <Activity className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-mono">{proj?.bpm || 120} BPM</span>
        </div>
        <div className="px-2 py-1 bg-white/5 rounded">
          <span className="font-mono">{proj?.key || 'C'} {proj?.scale || 'major'}</span>
        </div>
        {proj?.genre && (
          <div className="px-2 py-1 bg-neon-purple/10 text-neon-purple rounded text-xs capitalize">
            {proj.genre}
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {(['arrange', 'mixer', 'instruments', 'effects', 'ai-assistant', 'learn'] as StudioView[]).map(v => (
          <button key={v} onClick={() => setStudioView(v)} className={cn('px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors', studioView === v ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-gray-400 hover:text-white')}>
            {v.replace('-', ' ')}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => masterMutation.mutate()} className="flex items-center gap-1 px-3 py-1.5 bg-neon-green/20 text-neon-green rounded text-xs hover:bg-neon-green/30">
          <Zap className="w-3.5 h-3.5" />
          Master
        </button>
        <button className="p-1.5 text-gray-400 hover:text-white"><Save className="w-4 h-4" /></button>
        <button className="p-1.5 text-gray-400 hover:text-white"><Download className="w-4 h-4" /></button>
      </div>
    </div>
  );

  const renderArrangeView = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Timeline ruler */}
      <div className="h-8 bg-black/40 border-b border-white/10 flex items-center pl-48">
        <div className="flex">
          {proj?.arrangement?.sections?.map((section: Section) => (
            <div key={section.id} className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: section.color + '30', color: section.color, width: `${(section.end - section.start) * 60}px` }}>
              {section.name}
            </div>
          ))}
          {Array.from({ length: Math.ceil((proj?.arrangement?.length || 64) / 4) }).map((_, i) => (
            <div key={i} className="w-[240px] text-xs text-gray-500 border-l border-white/5 pl-1 flex-shrink-0">
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Tracks */}
      <div className="flex-1 overflow-auto">
        {proj?.tracks?.map((track: Track, _idx: number) => (
          <div key={track.id} className={cn('flex border-b border-white/5 hover:bg-white/[0.02]', selectedTrackId === track.id && 'bg-white/5')}>
            {/* Track header */}
            <div className="w-48 flex-shrink-0 p-2 border-r border-white/10 bg-black/30" onClick={() => setSelectedTrackId(track.id)}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: track.color }} />
                <span className="text-sm font-medium truncate flex-1">{track.name}</span>
                <button onClick={() => deleteTrackMutation.mutate(track.id)} className="p-0.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <button onClick={() => updateTrackMutation.mutate({ trackId: track.id, mute: !track.mute })} className={cn('px-1.5 py-0.5 text-[10px] rounded font-bold', track.mute ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-gray-400')}>M</button>
                <button onClick={() => updateTrackMutation.mutate({ trackId: track.id, solo: !track.solo })} className={cn('px-1.5 py-0.5 text-[10px] rounded font-bold', track.solo ? 'bg-yellow-500/30 text-yellow-400' : 'bg-white/10 text-gray-400')}>S</button>
                <button onClick={() => updateTrackMutation.mutate({ trackId: track.id, armed: !track.armed })} className={cn('px-1.5 py-0.5 text-[10px] rounded font-bold', track.armed ? 'bg-red-500 text-white' : 'bg-white/10 text-gray-400')}>R</button>
                <div className="flex-1" />
                <input type="range" min="-24" max="6" value={track.volume} onChange={e => updateTrackMutation.mutate({ trackId: track.id, volume: Number(e.target.value) })} className="w-16 h-1 accent-white" />
              </div>
            </div>

            {/* Clip area */}
            <div className="flex-1 h-16 relative">
              {track.clips?.map((clip: Clip) => (
                <div
                  key={clip.id}
                  className="absolute top-1 bottom-1 rounded-md border border-white/20 flex items-center px-2 text-xs truncate"
                  style={{
                    left: `${clip.startBar * 60}px`,
                    width: `${clip.lengthBars * 60}px`,
                    backgroundColor: (clip.color || track.color) + '40',
                    borderColor: clip.color || track.color,
                  }}
                >
                  {clip.name}
                </div>
              ))}
              {/* Playhead */}
              <div className="absolute top-0 bottom-0 w-px bg-neon-cyan/60" style={{ left: `${playhead * 15}px` }} />
            </div>
          </div>
        ))}

        {/* Add track button */}
        <button onClick={() => setShowAddTrack(true)} className="w-full py-3 border-b border-white/5 flex items-center justify-center gap-2 text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="text-sm">Add Track</span>
        </button>
      </div>
    </div>
  );

  const renderMixerView = () => (
    <div className="flex-1 overflow-x-auto p-4">
      <div className="flex gap-3 min-w-max">
        {proj?.tracks?.map((track: Track) => (
          <div key={track.id} className="w-28 bg-black/40 rounded-xl border border-white/10 p-3 flex flex-col items-center gap-2">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: track.color }} />
            <span className="text-xs font-medium truncate w-full text-center">{track.name}</span>

            <div className="flex gap-1">
              <button onClick={() => updateTrackMutation.mutate({ trackId: track.id, mute: !track.mute })} className={cn('px-1 py-0.5 text-[9px] rounded', track.mute ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-gray-500')}>M</button>
              <button onClick={() => updateTrackMutation.mutate({ trackId: track.id, solo: !track.solo })} className={cn('px-1 py-0.5 text-[9px] rounded', track.solo ? 'bg-yellow-500/30 text-yellow-400' : 'bg-white/10 text-gray-500')}>S</button>
            </div>

            {/* Pan knob (visual) */}
            <div className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center relative">
              <div className="w-0.5 h-3 bg-neon-cyan rounded-full" style={{ transform: `rotate(${track.pan * 135}deg)`, transformOrigin: 'bottom center' }} />
            </div>
            <span className="text-[10px] text-gray-400">Pan: {track.pan > 0 ? `R${track.pan}` : track.pan < 0 ? `L${Math.abs(track.pan)}` : 'C'}</span>

            {/* Fader */}
            <div className="h-32 w-4 bg-white/10 rounded-full relative overflow-hidden">
              <div className="absolute bottom-0 w-full bg-gradient-to-t from-neon-cyan to-neon-purple rounded-full transition-all" style={{ height: `${((track.volume + 24) / 30) * 100}%` }} />
            </div>
            <span className="text-[10px] text-gray-400 font-mono">{track.volume > 0 ? '+' : ''}{track.volume} dB</span>

            {/* Effect slots */}
            <div className="w-full space-y-1 mt-1">
              {track.effects?.slice(0, 3).map((fx: Effect) => (
                <div key={fx.id} className={cn('px-1.5 py-0.5 rounded text-[9px] truncate', fx.enabled ? 'bg-neon-purple/20 text-neon-purple' : 'bg-white/5 text-gray-500')}>
                  {fx.name}
                </div>
              ))}
              <button onClick={() => { setSelectedTrackId(track.id); setShowEffects(true); }} className="w-full px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-white bg-white/5 rounded">
                + FX
              </button>
            </div>
          </div>
        ))}

        {/* Master bus */}
        <div className="w-28 bg-black/60 rounded-xl border border-neon-cyan/30 p-3 flex flex-col items-center gap-2">
          <Headphones className="w-4 h-4 text-neon-cyan" />
          <span className="text-xs font-bold text-neon-cyan">Master</span>
          <div className="h-32 w-4 bg-white/10 rounded-full relative overflow-hidden">
            <div className="absolute bottom-0 w-full bg-gradient-to-t from-neon-green to-neon-cyan rounded-full" style={{ height: '80%' }} />
          </div>
          <span className="text-[10px] text-gray-400 font-mono">0 dB</span>
          <div className="w-full space-y-1">
            {proj?.masterBus?.effects?.slice(0, 4).map((fx: Effect, i: number) => (
              <div key={i} className="px-1.5 py-0.5 rounded text-[9px] truncate bg-neon-cyan/10 text-neon-cyan">
                {fx.label || fx.name || fx.effect}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderInstrumentsView = () => {
    const cats = Object.entries(instruments as Record<string, Instrument>).reduce<Record<string, [string, Instrument][]>>((acc, entry) => {
      const [id, inst] = entry as [string, Instrument];
      const cat = inst.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push([id, inst]);
      return acc;
    }, {});

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <h2 className="text-xl font-bold">Instruments</h2>
        {Object.entries(cats).map(([category, items]) => (
          <section key={category}>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3 capitalize">{category}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map(([id, inst]: [string, Instrument]) => (
                <button
                  key={id}
                  onClick={() => addTrackMutation.mutate({ instrumentId: id, type: 'midi' })}
                  className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-neon-cyan/30 text-left transition-colors group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 flex items-center justify-center">
                      {inst.category === 'keys' ? <Piano className="w-5 h-5 text-neon-cyan" /> :
                       inst.category === 'guitar' ? <Guitar className="w-5 h-5 text-neon-cyan" /> :
                       inst.category === 'drums' ? <Drum className="w-5 h-5 text-neon-cyan" /> :
                       <Waves className="w-5 h-5 text-neon-cyan" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{inst.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{inst.type}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    {inst.params?.join(', ')}
                  </p>
                  <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-neon-cyan">Click to add track</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  };

  const renderEffectsView = () => {
    const cats = Object.entries(effectsCatalog as Record<string, { name: string; category: string; params: string[] }>).reduce<Record<string, [string, { name: string; category: string; params: string[] }][]>>((acc, entry) => {
      const [id, fx] = entry;
      const cat = fx.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push([id, fx]);
      return acc;
    }, {});

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <h2 className="text-xl font-bold">Effects</h2>
        {selectedTrackId && <p className="text-sm text-gray-400">Adding effects to: {proj?.tracks?.find((t: Track) => t.id === selectedTrackId)?.name || 'selected track'}</p>}
        {Object.entries(cats).map(([category, items]) => (
          <section key={category}>
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3 capitalize">{category}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map(([id, fx]) => (
                <button
                  key={id}
                  onClick={() => selectedTrackId && addEffectMutation.mutate({ trackId: selectedTrackId, effectId: id })}
                  disabled={!selectedTrackId}
                  className={cn('p-4 rounded-xl bg-white/5 border border-white/10 text-left transition-colors', selectedTrackId ? 'hover:border-neon-purple/30 cursor-pointer' : 'opacity-50 cursor-not-allowed')}
                >
                  <p className="font-medium text-sm">{fx.name}</p>
                  <p className="text-xs text-gray-400 capitalize mt-1">{fx.category}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{fx.params?.join(', ')}</p>
                </button>
              ))}
            </div>
          </section>
        ))}
        {!selectedTrackId && <p className="text-center text-gray-500 py-8">Select a track first to add effects</p>}
      </div>
    );
  };

  const renderAIAssistant = () => (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-neon-purple" />
        <h2 className="text-xl font-bold">AI Production Assistant</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button onClick={() => aiAnalyzeMutation.mutate()} disabled={!activeProjectId || aiAnalyzeMutation.isPending} className="p-4 rounded-xl bg-neon-purple/10 border border-neon-purple/20 text-left hover:bg-neon-purple/20 disabled:opacity-50">
          <BarChart3 className="w-6 h-6 text-neon-purple mb-2" />
          <h3 className="font-semibold">Analyze Project</h3>
          <p className="text-xs text-gray-400 mt-1">Get mix score, suggestions, and genre analysis</p>
        </button>
        <button onClick={() => aiChordsMutation.mutate()} disabled={aiChordsMutation.isPending} className="p-4 rounded-xl bg-neon-cyan/10 border border-neon-cyan/20 text-left hover:bg-neon-cyan/20 disabled:opacity-50">
          <Music className="w-6 h-6 text-neon-cyan mb-2" />
          <h3 className="font-semibold">Suggest Chords</h3>
          <p className="text-xs text-gray-400 mt-1">AI chord progressions in your key</p>
        </button>
        <button onClick={() => aiDrumsMutation.mutate()} disabled={aiDrumsMutation.isPending} className="p-4 rounded-xl bg-neon-green/10 border border-neon-green/20 text-left hover:bg-neon-green/20 disabled:opacity-50">
          <Drum className="w-6 h-6 text-neon-green mb-2" />
          <h3 className="font-semibold">Generate Drums</h3>
          <p className="text-xs text-gray-400 mt-1">AI drum patterns for your genre</p>
        </button>
      </div>

      {/* AI Analysis Results */}
      {aiAnalyzeMutation.data && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h3 className="font-semibold mb-3">Project Analysis</h3>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-center">
              <div className="text-3xl font-bold text-neon-cyan">{(aiAnalyzeMutation.data as { data: { analysis: { mixScore: number } } }).data?.analysis?.mixScore || 0}</div>
              <div className="text-xs text-gray-400">Mix Score</div>
            </div>
          </div>
          <div className="space-y-2">
            {((aiAnalyzeMutation.data as { data: { analysis: { suggestions: { type: string; priority: string; suggestion: string }[] } } }).data?.analysis?.suggestions || []).map((s: { type: string; priority: string; suggestion: string }, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={cn('px-1.5 py-0.5 text-[10px] rounded capitalize', s.priority === 'high' ? 'bg-red-500/20 text-red-400' : s.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400')}>{s.priority}</span>
                <span className="text-gray-300">{s.suggestion}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chord Suggestions */}
      {aiChordsMutation.data && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h3 className="font-semibold mb-3">Chord Progressions</h3>
          <div className="space-y-3">
            {((aiChordsMutation.data as { data: { progressions: { name: string; chords: string[]; mood: string }[] } }).data?.progressions || []).map((p: { name: string; chords: string[]; mood: string }, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-medium w-24">{p.name}</span>
                <div className="flex gap-2">
                  {p.chords.map((c: string, j: number) => (
                    <span key={j} className="px-3 py-1.5 bg-neon-cyan/10 text-neon-cyan rounded text-sm font-mono">{c}</span>
                  ))}
                </div>
                <span className="text-xs text-gray-400 capitalize">{p.mood}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ask AI */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-neon-purple" /> Ask AI</h3>
        <div className="flex gap-2">
          <input type="text" value={aiQuestion} onChange={e => setAiQuestion(e.target.value)} placeholder="How can I make my mix sound wider?" className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-neon-purple/50" />
          <button onClick={() => { aiSessionMutation.mutate(aiQuestion); setAiQuestion(''); }} disabled={!aiQuestion || aiSessionMutation.isPending} className="px-4 py-2 bg-neon-purple/20 text-neon-purple rounded-lg text-sm hover:bg-neon-purple/30 disabled:opacity-50">
            Ask
          </button>
        </div>
        {aiSessionMutation.data && (
          <div className="mt-3 p-3 bg-white/5 rounded-lg text-sm text-gray-300">
            {(aiSessionMutation.data as { data: { answer: string } }).data?.answer}
          </div>
        )}
      </div>
    </div>
  );

  const renderLearnView = () => (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="w-6 h-6 text-neon-green" />
        <h2 className="text-xl font-bold">Learning Center</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: 'Fundamentals', desc: 'Rhythm, melody, harmony, song structure', icon: Music, color: 'neon-cyan' },
          { title: 'Sound Design', desc: 'Synthesis, sampling, layering, processing', icon: Waves, color: 'neon-purple' },
          { title: 'Mixing', desc: 'EQ, compression, reverb, panning, automation', icon: Sliders, color: 'neon-pink' },
          { title: 'Arrangement', desc: 'Song structure, builds, transitions', icon: Layers, color: 'neon-green' },
          { title: 'Mastering', desc: 'Loudness, EQ balance, limiting', icon: Target, color: 'neon-cyan' },
          { title: 'Genre Studies', desc: 'Genre-specific production techniques', icon: Radio, color: 'neon-purple' },
        ].map((mod, i) => (
          <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors cursor-pointer">
            <mod.icon className={`w-8 h-8 text-${mod.color} mb-3`} />
            <h3 className="font-semibold">{mod.title}</h3>
            <p className="text-xs text-gray-400 mt-1">{mod.desc}</p>
            <div className="mt-3 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full bg-${mod.color} rounded-full`} style={{ width: `${Math.random() * 60}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // No project selected view
  if (!activeProjectId) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-cyan-900/10 to-black">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
          <div className="flex items-center gap-2">
            <Headphones className="w-6 h-6 text-neon-cyan" />
            <h1 className="text-xl font-bold">Studio</h1>
          </div>
          <button onClick={() => setShowNewProject(true)} className="flex items-center gap-2 px-4 py-2 bg-neon-cyan/20 text-neon-cyan rounded-lg text-sm hover:bg-neon-cyan/30">
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-lg font-bold mb-4">Recent Projects</h2>
          {(projects as { id: string; title: string; bpm: number; key: string; genre: string; trackCount: number; updatedAt: number }[]).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(projects as { id: string; title: string; bpm: number; key: string; genre: string; trackCount: number; updatedAt: number }[]).map(p => (
                <button key={p.id} onClick={() => setActiveProjectId(p.id)} className="p-4 rounded-xl bg-white/5 border border-white/10 text-left hover:border-neon-cyan/30 transition-colors">
                  <h3 className="font-semibold">{p.title}</h3>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{p.bpm} BPM</span>
                    <span>{p.key}</span>
                    {p.genre && <span className="capitalize">{p.genre}</span>}
                    <span>{p.trackCount} tracks</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Headphones className="w-16 h-16 mx-auto text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-400">No projects yet</h3>
              <p className="text-sm text-gray-500 mt-1">Create your first studio project to get started</p>
              <button onClick={() => setShowNewProject(true)} className="mt-4 px-6 py-2 bg-neon-cyan/20 text-neon-cyan rounded-lg text-sm hover:bg-neon-cyan/30">
                Create Project
              </button>
            </div>
          )}
        </div>

        {/* New Project Modal */}
        <AnimatePresence>
          {showNewProject && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-lattice-surface border border-white/10 rounded-xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">New Project</h3>
                  <button onClick={() => setShowNewProject(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none" placeholder="Project title" />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">BPM</label>
                      <input type="number" value={newBpm} onChange={e => setNewBpm(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Key</label>
                      <select value={newKey} onChange={e => setNewKey(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none">
                        {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => <option key={k} value={k} className="bg-lattice-surface">{k}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Genre</label>
                      <select value={newGenre} onChange={e => setNewGenre(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none">
                        <option value="" className="bg-lattice-surface">Any</option>
                        {Object.keys((genres as { genres?: Record<string, unknown> })?.genres || {}).map(g => <option key={g} value={g} className="bg-lattice-surface capitalize">{g}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={handleCreateProject} disabled={createProjectMutation.isPending} className="w-full py-2.5 bg-neon-cyan text-black rounded-lg font-medium hover:bg-neon-cyan/80 disabled:opacity-50">
                    {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-cyan-900/10 to-black">
      {renderTransportBar()}
      {studioView === 'arrange' && renderArrangeView()}
      {studioView === 'mixer' && renderMixerView()}
      {studioView === 'instruments' && renderInstrumentsView()}
      {studioView === 'effects' && renderEffectsView()}
      {studioView === 'ai-assistant' && renderAIAssistant()}
      {studioView === 'learn' && renderLearnView()}

      {/* Add Track Modal */}
      <AnimatePresence>
        {showAddTrack && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-lattice-surface border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Add Track</h3>
                <button onClick={() => setShowAddTrack(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-2">
                <button onClick={() => addTrackMutation.mutate({ type: 'audio', name: 'Audio Track' })} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-left hover:border-neon-cyan/30 flex items-center gap-3">
                  <Mic2 className="w-5 h-5 text-neon-cyan" />
                  <div><p className="font-medium text-sm">Audio Track</p><p className="text-xs text-gray-400">Record or import audio</p></div>
                </button>
                {Object.entries(instruments as Record<string, Instrument>).slice(0, 8).map(([id, inst]) => (
                  <button key={id} onClick={() => addTrackMutation.mutate({ instrumentId: id, type: 'midi' })} className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-left hover:border-neon-cyan/30 flex items-center gap-3">
                    <Waves className="w-5 h-5 text-neon-purple" />
                    <div><p className="font-medium text-sm">{inst.name}</p><p className="text-xs text-gray-400 capitalize">{inst.category}</p></div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Master Result */}
      <AnimatePresence>
        {masterMutation.data && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-4 right-4 z-50 bg-lattice-surface border border-neon-green/30 rounded-xl p-4 w-80 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-neon-green flex items-center gap-2"><Zap className="w-4 h-4" /> Mastering Complete</h4>
              <button onClick={() => masterMutation.reset()} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs text-gray-400 space-y-1">
              <p>Output LUFS: {(masterMutation.data as { data: { master: { analysis: { outputLufs: number } } } }).data?.master?.analysis?.outputLufs}</p>
              <p>True Peak: {(masterMutation.data as { data: { master: { analysis: { truePeak: number } } } }).data?.master?.analysis?.truePeak} dBTP</p>
              <p>Dynamic Range: {Math.round((masterMutation.data as { data: { master: { analysis: { dynamicRange: number } } } }).data?.master?.analysis?.dynamicRange || 0)} dB</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
