'use client';

/**
 * PersistentChatRail — Chat panel that persists across all lens navigations.
 *
 * The killer feature: conversation context carries across lenses.
 * User chats in healthcare → taps fitness lens → same conversation.
 * The brain now has context from both domains.
 */

import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useSessionId, resetSessionId } from '@/hooks/useSessionId';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { SovereigntyPrompt } from '@/components/sovereignty/SovereigntyPrompt';
import { PipelineProgress } from '@/components/pipeline/PipelineProgress';
import {
  MessageSquare,
  Send,
  X,
  ChevronRight,
  ArrowRight,
  Brain,
  Globe,
  ExternalLink,
  Zap,
  Compass,
  Loader,
  Plus,
  Minimize2,
  Maximize2,
  Layers,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  lens?: string | null;
  timestamp: string;
  lensRecommendation?: LensRecommendation | null;
  suggestedAction?: string | null;
  sources?: { title: string; url: string; source: string }[];
}

interface LensRecommendation {
  domain: string;
  reason: string;
  suggestedAction?: string | null;
  confidence: number;
}

interface WebResult {
  title: string;
  source: string;
  snippet: string;
}

interface PersistentChatRailProps {
  currentLens: string;
  collapsed?: boolean;
  onToggle?: () => void;
  onLensNavigate?: (domain: string) => void;
}

type ChatStatus = 'idle' | 'thinking' | 'searching' | 'responding';

// ── Component ──────────────────────────────────────────────────

export function PersistentChatRail({
  currentLens,
  collapsed = false,
  onToggle,
  onLensNavigate,
}: PersistentChatRailProps) {
  const sessionId = useSessionId();
  const { on, emit, isConnected } = useSocket({ autoConnect: true });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [chatStatus, setChatStatus] = useState<ChatStatus>('idle');
  const [streamingText, setStreamingText] = useState('');
  const [webResults, setWebResults] = useState<WebResult[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  // Sovereignty prompt state
  const [sovereigntyPrompt, setSovereigntyPrompt] = useState<{
    message: string;
    localCount: number;
    globalCount: number;
    globalDomains: string[];
    globalDTUIds: string[];
    globalPreview?: { id: string; title: string; domain: string; score: number }[];
    originalPrompt: string;
  } | null>(null);
  const [isResolvingSovereignty, setIsResolvingSovereignty] = useState(false);
  // Pipeline prompt state
  const [pipelinePrompt, setPipelinePrompt] = useState<{
    pipelineId: string;
    description: string;
    variables: Record<string, unknown>;
    steps: { lens: string; action: string; order: number }[];
    message: string;
  } | null>(null);
  const [activePipeline, setActivePipeline] = useState<{
    pipelineId: string;
    executionId: string;
    description: string;
    steps: { lens: string; action: string; order: number }[];
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // ── WebSocket event listeners ──────────────────────────────

  useEffect(() => {
    const handleStatus = (data: unknown) => {
      const d = data as { sessionId?: string; status?: ChatStatus };
      if (d.sessionId === sessionId) {
        setChatStatus(d.status || 'idle');
      }
    };

    const handleToken = (data: unknown) => {
      const d = data as { sessionId?: string; token?: string };
      if (d.sessionId === sessionId && d.token) {
        setStreamingText(prev => prev + d.token);
      }
    };

    const handleWebResults = (data: unknown) => {
      const d = data as { sessionId?: string; results?: WebResult[] };
      if (d.sessionId === sessionId && d.results) {
        setWebResults(d.results);
      }
    };

    const handleComplete = (data: unknown) => {
      const d = data as {
        sessionId?: string;
        response?: string;
        lensRecommendation?: LensRecommendation;
        sources?: { title: string; url: string; source: string }[];
      };
      if (d.sessionId === sessionId) {
        const msg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content: d.response || '',
          lens: currentLens,
          timestamp: new Date().toISOString(),
          lensRecommendation: d.lensRecommendation || null,
          sources: d.sources || [],
        };
        setMessages(prev => [...prev, msg]);
        setStreamingText('');
        setChatStatus('idle');
        setWebResults([]);
      }
    };

    on('chat:status', handleStatus);
    on('chat:token', handleToken);
    on('chat:web_results', handleWebResults);
    on('chat:complete', handleComplete);

    return () => {};
  }, [on, sessionId, currentLens]);

  // ── Send message ──────────────────────────────────────────

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: content.trim(),
      lens: currentLens,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setChatStatus('thinking');

    // Try WebSocket first, fall back to HTTP
    if (isConnected) {
      emit('chat:message', {
        sessionId,
        prompt: content.trim(),
        lens: currentLens,
      });
    } else {
      try {
        const response = await api.post('/api/chat', {
          sessionId,
          prompt: content.trim(),
          lens: currentLens,
        });
        const data = response.data;

        // Handle sovereignty prompt — local substrate insufficient
        if (data?.type === 'sovereignty_prompt') {
          setSovereigntyPrompt({
            message: data.message || 'Your substrate needs global knowledge for this.',
            localCount: data.localCount || 0,
            globalCount: data.globalCount || 0,
            globalDomains: data.globalDomains || [],
            globalDTUIds: data.globalDTUIds || [],
            globalPreview: data.globalPreview || [],
            originalPrompt: content.trim(),
          });
          setChatStatus('idle');
          return;
        }

        // Handle pipeline prompt — life event detected
        if (data?.type === 'pipeline_prompt') {
          setPipelinePrompt({
            pipelineId: data.pipelineId,
            description: data.description,
            variables: data.variables || {},
            steps: data.steps || [],
            message: data.message,
          });
          setChatStatus('idle');
          return;
        }

        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content: data?.response || data?.reply || data?.message || data?.output || JSON.stringify(data),
          lens: currentLens,
          timestamp: new Date().toISOString(),
          lensRecommendation: data?.lensRecommendation || null,
        };
        setMessages(prev => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: `msg-${Date.now()}-err`,
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Failed to get response'}`,
          lens: currentLens,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        setChatStatus('idle');
      }
    }
  }, [sessionId, currentLens, isConnected, emit]);

  // ── Handle sovereignty resolution ──────────────────────────

  const handleSovereigntyResolve = useCallback(async (
    choice: 'sync_temp' | 'sync_permanent' | 'skip',
    remember: boolean,
  ) => {
    if (!sovereigntyPrompt) return;
    setIsResolvingSovereignty(true);
    setChatStatus('thinking');

    try {
      const response = await api.post('/api/chat/sovereignty-resolve', {
        sessionId,
        choice,
        globalDTUIds: sovereigntyPrompt.globalDTUIds,
        originalPrompt: sovereigntyPrompt.originalPrompt,
        lens: currentLens,
        remember,
      });
      const data = response.data;
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-sov`,
        role: 'assistant',
        content: data?.content || data?.reply || data?.response || 'Response received.',
        lens: currentLens,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-sov-err`,
        role: 'assistant',
        content: `Error resolving sovereignty: ${err instanceof Error ? err.message : 'Unknown error'}`,
        lens: currentLens,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSovereigntyPrompt(null);
      setIsResolvingSovereignty(false);
      setChatStatus('idle');
    }
  }, [sovereigntyPrompt, sessionId, currentLens]);

  // ── Handle submit ──────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleNewConversation = () => {
    resetSessionId();
    setMessages([]);
    setStreamingText('');
    setChatStatus('idle');
    setWebResults([]);
  };

  // ── Collapsed state (floating button) ──────────────────────

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full
          bg-gradient-to-br from-neon-blue to-neon-purple
          shadow-lg shadow-neon-blue/20 hover:shadow-neon-blue/40
          flex items-center justify-center transition-all hover:scale-105"
        aria-label="Open chat"
      >
        <MessageSquare className="w-6 h-6 text-white" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-neon-pink
            text-white text-[10px] rounded-full flex items-center justify-center">
            {messages.length > 9 ? '9+' : messages.length}
          </span>
        )}
      </button>
    );
  }

  // ── Expanded state (side panel) ────────────────────────────

  return (
    <div
      className={cn(
        'fixed right-0 top-14 lg:top-16 bottom-0 z-30 flex flex-col',
        'bg-lattice-deep border-l border-lattice-border',
        'transition-all duration-300',
        isExpanded ? 'w-[600px]' : 'w-[380px]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-lattice-border bg-lattice-surface">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-neon-cyan" />
          <span className="text-sm font-medium text-white">Concord Chat</span>
          {currentLens && (
            <span className="text-xs text-zinc-500 px-2 py-0.5 rounded-full bg-zinc-800">
              {currentLens}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewConversation}
            className="p-1.5 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors"
            title="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Brain className="w-10 h-10 text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-400 mb-1">Chat with Concord</p>
            <p className="text-xs text-zinc-600 max-w-[240px]">
              Your conversation follows you across all lenses. Context is never lost.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const prevLens = i > 0 ? messages[i - 1].lens : null;
          const showTransition = msg.lens && msg.lens !== prevLens && i > 0;

          return (
            <Fragment key={msg.id}>
              {/* Lens transition marker */}
              {showTransition && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-zinc-700" />
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1.5 whitespace-nowrap">
                    <ArrowRight className="w-3 h-3" />
                    Moved to {msg.lens} lens
                  </span>
                  <div className="flex-1 h-px bg-zinc-700" />
                </div>
              )}

              {/* Message */}
              <div
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-neon-blue/20 text-zinc-100 border border-neon-blue/20'
                      : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700/50'
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-700/50 space-y-1">
                      {msg.sources.map((s, si) => (
                        <div key={si} className="flex items-center gap-1 text-[10px] text-zinc-500">
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>{s.source}: {s.title}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lens recommendation chip */}
                  {msg.lensRecommendation && (
                    <button
                      onClick={() => onLensNavigate?.(msg.lensRecommendation!.domain)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-2
                        bg-neon-cyan/10 border border-neon-cyan/30 rounded-full
                        text-xs text-neon-cyan hover:bg-neon-cyan/20 transition-all"
                    >
                      <Compass className="w-3 h-3" />
                      Open {msg.lensRecommendation.domain} lens
                      <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                  )}

                  {/* Suggested action button */}
                  {msg.lensRecommendation?.suggestedAction && (
                    <button
                      onClick={() => {
                        onLensNavigate?.(msg.lensRecommendation!.domain);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 mt-2
                        bg-neon-blue/10 border border-neon-blue/30 rounded-lg
                        text-xs text-neon-blue hover:bg-neon-blue/20 transition-all"
                    >
                      <Zap className="w-3 h-3" />
                      Generate {msg.lensRecommendation.suggestedAction.replace(/-/g, ' ')}
                    </button>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}

        {/* Status indicators */}
        {chatStatus === 'thinking' && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 px-2 py-1">
            <Brain className="w-4 h-4 animate-pulse" />
            Thinking...
          </div>
        )}
        {chatStatus === 'searching' && (
          <div className="flex items-center gap-2 text-sm text-neon-cyan px-2 py-1">
            <Globe className="w-4 h-4 animate-spin" />
            Searching the web...
          </div>
        )}

        {/* Web search results */}
        {webResults.length > 0 && (
          <div className="px-2 py-1 space-y-1">
            {webResults.map((r, i) => (
              <div key={i} className="text-[10px] text-zinc-500 flex items-center gap-1">
                <ExternalLink className="w-2.5 h-2.5" />
                {r.source}: {r.title}
              </div>
            ))}
          </div>
        )}

        {/* Streaming text */}
        {streamingText && (
          <div className="bg-zinc-800/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 border border-zinc-700/50">
            <div className="whitespace-pre-wrap break-words">{streamingText}</div>
            <span className="inline-block w-1.5 h-4 bg-neon-cyan animate-pulse ml-0.5" />
          </div>
        )}

        {/* Sovereignty Prompt */}
        {sovereigntyPrompt && (
          <SovereigntyPrompt
            message={sovereigntyPrompt}
            onResolve={handleSovereigntyResolve}
            isResolving={isResolvingSovereignty}
          />
        )}

        {/* Pipeline Prompt — life event detected */}
        {pipelinePrompt && (
          <div className="mx-4 my-3 p-4 rounded-lg border border-blue-500/30 bg-blue-900/10">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Pipeline Available</span>
            </div>
            <p className="text-sm text-zinc-300 mb-3">{pipelinePrompt.message}</p>
            <div className="mb-3 space-y-1">
              <p className="text-xs text-zinc-500">Steps:</p>
              {pipelinePrompt.steps.map((s, i) => (
                <div key={i} className="text-xs text-zinc-400 flex items-center gap-2">
                  <span className="text-zinc-600">{s.order}.</span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">{s.lens}</span>
                  {s.action.replace(/-/g, ' ')}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const pp = pipelinePrompt;
                  setPipelinePrompt(null);
                  try {
                    const res = await api.post('/api/pipeline/execute', {
                      pipelineId: pp.pipelineId,
                      variables: pp.variables,
                      sessionId,
                    });
                    if (res.data?.execution) {
                      setActivePipeline({
                        pipelineId: pp.pipelineId,
                        executionId: res.data.execution.id,
                        description: pp.description,
                        steps: pp.steps,
                      });
                    }
                  } catch { /* silent */ }
                }}
                className="px-3 py-2 rounded-lg text-sm bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-colors"
              >
                Run pipeline
              </button>
              <button
                onClick={() => setPipelinePrompt(null)}
                className="px-3 py-2 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-600 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Active Pipeline Progress */}
        {activePipeline && (
          <PipelineProgress
            pipelineId={activePipeline.pipelineId}
            executionId={activePipeline.executionId}
            description={activePipeline.description}
            steps={activePipeline.steps}
            onComplete={() => {
              setMessages(prev => [...prev, {
                id: `msg-${Date.now()}-pipeline`,
                role: 'assistant' as const,
                content: `Pipeline complete! ${activePipeline.description} — all documents generated.`,
                lens: currentLens,
                timestamp: new Date().toISOString(),
              }]);
              setActivePipeline(null);
            }}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-lattice-border bg-lattice-surface"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Concord anything..."
            rows={1}
            className="flex-1 resize-none bg-lattice-deep border border-lattice-border rounded-lg
              px-3 py-2 text-sm text-white placeholder:text-zinc-500
              outline-none focus:border-neon-blue/50 transition-colors
              max-h-32 overflow-y-auto"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || chatStatus !== 'idle'}
            className="p-2 rounded-lg bg-neon-blue/20 text-neon-blue
              hover:bg-neon-blue/30 disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors"
          >
            {chatStatus !== 'idle' ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PersistentChatRail;
