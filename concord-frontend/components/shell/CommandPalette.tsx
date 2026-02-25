'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, Sparkles, Brain, Zap, RefreshCw, TrendingDown, Clock } from 'lucide-react';
import { getCommandPaletteLenses, getParentCoreLens, getCoreLensConfig, LENS_CATEGORIES, type LensCategory } from '@/lib/lens-registry';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Command {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

interface NLPResult {
  intent: string;
  confidence: number;
  result: {
    action: string;
    path?: string | null;
    results?: Array<{ id: string; title: string; score: number; tags?: string[]; freshness?: number }>;
    items?: Array<{ id: string; title: string; freshness?: number; updatedAt?: string }>;
    message?: string;
    content?: string;
    total?: number;
    count?: number;
    domain?: string | null;
    redirect?: string;
  };
}

type PaletteMode = 'commands' | 'nlp';

const paletteLenses = getCommandPaletteLenses();

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<PaletteMode>('commands');
  const [nlpResult, setNlpResult] = useState<NLPResult | null>(null);
  const [nlpLoading, setNlpLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Detect NLP mode: if input starts with > or contains action verbs
  const isNLPQuery = useCallback((q: string) => {
    if (q.startsWith('>')) return true;
    const nlpPatterns = /^(search|find|create|analyze|generate|suggest|show|open|go to|navigate|count|how many|stale|fresh|recent|summarize|brief)/i;
    return nlpPatterns.test(q.trim());
  }, []);

  const commands: Command[] = useMemo(() => {
    const navCommands: Command[] = paletteLenses.map((lens) => {
      const Icon = lens.icon;
      const parentId = getParentCoreLens(lens.id);
      const parentConfig = parentId ? getCoreLensConfig(parentId) : null;
      const namePrefix = parentConfig ? `${parentConfig.name} > ` : '';
      return {
        id: `nav-${lens.id}`,
        name: `Go to ${namePrefix}${lens.name}`,
        description: lens.description,
        icon: <Icon className="w-4 h-4" />,
        action: () => router.push(lens.path),
        category: LENS_CATEGORIES[lens.category as LensCategory]?.label || lens.category,
      };
    });

    const actionCommands: Command[] = [
      {
        id: 'nav-dashboard',
        name: 'Go to Dashboard',
        description: 'Return to the main dashboard',
        icon: <ArrowRight className="w-4 h-4" />,
        action: () => router.push('/'),
        category: 'Action',
      },
      {
        id: 'action-new-dtu',
        name: 'Create New DTU',
        description: 'Start a new thought unit',
        icon: <ArrowRight className="w-4 h-4" />,
        action: () => router.push('/lenses/chat?new=true'),
        category: 'Action',
      },
      {
        id: 'action-morning-brief',
        name: 'Generate Morning Brief',
        description: 'AI summary of your recent cognitive activity',
        icon: <Sparkles className="w-4 h-4" />,
        action: () => router.push('/?brief=true'),
        category: 'Action',
      },
      {
        id: 'action-stale-dtus',
        name: 'View Stale DTUs',
        description: 'DTUs that need attention or refreshing',
        icon: <TrendingDown className="w-4 h-4" />,
        action: () => { setQuery('>stale'); },
        category: 'Action',
      },
      {
        id: 'action-recent',
        name: 'View Recent Activity',
        description: 'Most recently updated DTUs',
        icon: <Clock className="w-4 h-4" />,
        action: () => { setQuery('>recent'); },
        category: 'Action',
      },
    ];

    return [...actionCommands, ...navCommands];
  }, [router]);

  const filteredCommands = useMemo(() => {
    if (!query || mode === 'nlp') return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [commands, query, mode]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  // NLP command execution
  const executeNLP = useCallback(async (input: string) => {
    const cleanInput = input.startsWith('>') ? input.slice(1).trim() : input.trim();
    if (!cleanInput) return;

    setNlpLoading(true);
    setNlpResult(null);
    try {
      const { data } = await api.post('/api/command/nlp', { input: cleanInput });
      if (data.ok) {
        setNlpResult(data);
        // Auto-navigate for navigate intent
        if (data.result?.action === 'navigate' && data.result?.path) {
          onClose();
          router.push(data.result.path);
        }
      }
    } catch {
      setNlpResult({ intent: 'error', confidence: 0, result: { action: 'error', message: 'Failed to process command' } });
    } finally {
      setNlpLoading(false);
    }
  }, [onClose, router]);

  // Switch mode based on query content
  useEffect(() => {
    if (query && isNLPQuery(query)) {
      setMode('nlp');
    } else {
      setMode('commands');
      setNlpResult(null);
    }
  }, [query, isNLPQuery]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setMode('commands');
      setNlpResult(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (mode === 'nlp' && nlpResult?.result?.results) {
          setSelectedIndex((i) => Math.min(i + 1, nlpResult.result.results!.length - 1));
        } else if (mode === 'nlp' && nlpResult?.result?.items) {
          setSelectedIndex((i) => Math.min(i + 1, nlpResult.result.items!.length - 1));
        } else {
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (mode === 'nlp') {
          executeNLP(query);
        } else if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
          setQuery('');
        }
        break;
      case 'Escape':
        onClose();
        setQuery('');
        break;
    }
  };

  if (!isOpen) return null;

  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-xl bg-lattice-surface border border-lattice-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-lattice-border">
          {mode === 'nlp' ? (
            <Brain className="w-5 h-5 text-neon-cyan" aria-hidden="true" />
          ) : (
            <Search className="w-5 h-5 text-gray-400" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'nlp' ? 'Ask anything... (Enter to execute)' : 'Search lenses, or type > for NLP commands...'}
            className="flex-1 bg-transparent text-white placeholder:text-gray-500 outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={filteredCommands[selectedIndex]?.id}
          />
          {nlpLoading && <RefreshCw className="w-4 h-4 text-neon-cyan animate-spin" />}
          {mode === 'nlp' && (
            <span className="px-2 py-0.5 text-[10px] font-medium text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/30 rounded">
              NLP
            </span>
          )}
          <kbd className="px-2 py-1 text-xs bg-lattice-elevated rounded text-gray-500">
            ESC
          </kbd>
        </div>

        {/* NLP Results */}
        {mode === 'nlp' && nlpResult && (
          <div ref={listRef} id="command-list" className="max-h-80 overflow-auto">
            {/* Search results */}
            {nlpResult.result?.results && nlpResult.result.results.length > 0 && (
              <div className="p-2">
                <p className="px-2 py-1 text-xs text-gray-500 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-neon-cyan" />
                  Search Results ({nlpResult.result.total || nlpResult.result.results.length})
                </p>
                {nlpResult.result.results.map((item, i) => (
                  <button
                    key={item.id}
                    data-selected={i === selectedIndex}
                    onClick={() => {
                      router.push(`/lenses/board?dtu=${item.id}`);
                      onClose();
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                      i === selectedIndex ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-gray-300 hover:bg-lattice-elevated'
                    )}
                  >
                    <Brain className="w-4 h-4 text-gray-400" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {item.tags?.map(t => <span key={t}>#{t}</span>)}
                        {typeof item.freshness === 'number' && (
                          <span className={cn(
                            item.freshness > 0.7 ? 'text-neon-green' : item.freshness > 0.3 ? 'text-amber-400' : 'text-red-400'
                          )}>
                            {Math.round(item.freshness * 100)}% fresh
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{Math.round(item.score * 100)}%</span>
                  </button>
                ))}
              </div>
            )}

            {/* Stale/Recent items */}
            {nlpResult.result?.items && nlpResult.result.items.length > 0 && (
              <div className="p-2">
                <p className="px-2 py-1 text-xs text-gray-500 uppercase flex items-center gap-1.5">
                  {nlpResult.result.action === 'stale' ? (
                    <><TrendingDown className="w-3 h-3 text-amber-400" /> Stale DTUs</>
                  ) : (
                    <><Clock className="w-3 h-3 text-neon-cyan" /> Recent DTUs</>
                  )}
                </p>
                {nlpResult.result.items.map((item, i) => (
                  <button
                    key={item.id}
                    data-selected={i === selectedIndex}
                    onClick={() => {
                      router.push(`/lenses/board?dtu=${item.id}`);
                      onClose();
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                      i === selectedIndex ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-gray-300 hover:bg-lattice-elevated'
                    )}
                  >
                    <Brain className="w-4 h-4 text-gray-400" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                    </div>
                    {typeof item.freshness === 'number' && (
                      <span className={cn(
                        'text-xs',
                        item.freshness > 0.7 ? 'text-neon-green' : item.freshness > 0.3 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {Math.round(item.freshness * 100)}%
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Text message results */}
            {nlpResult.result?.message && !nlpResult.result?.results && !nlpResult.result?.items && (
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <Zap className="w-5 h-5 text-neon-cyan mt-0.5 shrink-0" />
                  <div>
                    <p className="text-white font-medium">{nlpResult.result.message}</p>
                    {nlpResult.result.domain && (
                      <button
                        onClick={() => { router.push(`/lenses/${nlpResult.result.domain}`); onClose(); }}
                        className="mt-2 text-sm text-neon-cyan hover:underline"
                      >
                        Open {nlpResult.result.domain} lens →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* No results */}
            {nlpResult.result?.action === 'error' && (
              <div className="px-4 py-8 text-center text-gray-500">
                Could not process command. Try rephrasing.
              </div>
            )}
          </div>
        )}

        {/* NLP hint when in NLP mode but no result yet */}
        {mode === 'nlp' && !nlpResult && !nlpLoading && (
          <div className="p-4 text-center">
            <p className="text-sm text-gray-400">Press <kbd className="px-1.5 py-0.5 bg-lattice-elevated border border-lattice-border rounded text-xs">Enter</kbd> to execute</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {['search React hooks', 'count finance DTUs', 'stale', 'recent', 'create new idea'].map(ex => (
                <button
                  key={ex}
                  onClick={() => { setQuery(`>${ex}`); }}
                  className="px-2 py-1 text-xs text-gray-400 bg-lattice-elevated rounded hover:text-white transition-colors"
                >
                  &gt; {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Standard command list (non-NLP mode) */}
        {mode === 'commands' && (
          <div ref={listRef} id="command-list" role="listbox" className="max-h-80 overflow-auto">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                No results found for &ldquo;{query}&rdquo;
              </div>
            ) : (
              <div className="p-2">
                {Object.entries(groupedCommands).map(([category, cmds]) => {
                  const section = (
                    <div key={category} className="mb-2">
                      <p className="px-2 py-1 text-xs text-gray-500 uppercase">
                        {category}
                      </p>
                      {cmds.map((cmd) => {
                        const index = runningIndex++;
                        const isSelected = index === selectedIndex;
                        return (
                          <button
                            key={cmd.id}
                            id={cmd.id}
                            role="option"
                            aria-selected={isSelected}
                            data-selected={isSelected}
                            onClick={() => {
                              cmd.action();
                              onClose();
                              setQuery('');
                            }}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                              isSelected
                                ? 'bg-neon-blue/20 text-neon-blue'
                                : 'text-gray-300 hover:bg-lattice-elevated'
                            )}
                          >
                            <span className="text-gray-400">{cmd.icon}</span>
                            <div className="flex-1 text-left">
                              <p className="font-medium">{cmd.name}</p>
                              <p className="text-xs text-gray-500">{cmd.description}</p>
                            </div>
                            {isSelected && (
                              <kbd className="px-2 py-1 text-xs bg-neon-blue/20 rounded">
                                Enter
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                  return section;
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-lattice-border flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>&uarr;&darr; Navigate</span>
            <span>&crarr; {mode === 'nlp' ? 'Execute' : 'Select'}</span>
            <span>ESC Close</span>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'commands' && <span className="text-gray-600">&gt; for NLP</span>}
            <span>{mode === 'nlp' ? 'NLP Mode' : `${filteredCommands.length} results`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
