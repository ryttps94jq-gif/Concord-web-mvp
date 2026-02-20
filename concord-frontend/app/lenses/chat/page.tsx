'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
import { Virtuoso } from 'react-virtuoso';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Paperclip,
  Mic,
  Smile,
  MoreVertical,
  Search,
  Settings,
  Plus,
  Bot,
  User,
  Sparkles,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Code,
  FileText,
  Brain,
  ChevronDown,
  MessageSquare,
  Zap,
  BookOpen,
  Eye,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
  tokens?: number;
  refs?: Array<{ id: string; title: string; lineageHash?: string }>;
  dtuId?: string;
  feedbackGiven?: 'up' | 'down' | null;
}

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
  messageCount: number;
}

interface AIMode {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
}

const AI_MODES: AIMode[] = [
  { id: 'overview', name: 'Overview', icon: MessageSquare, description: 'General conversation' },
  { id: 'deep', name: 'Deep', icon: Brain, description: 'In-depth analysis' },
  { id: 'creative', name: 'Creative', icon: Sparkles, description: 'Creative writing & brainstorming' },
  { id: 'code', name: 'Code', icon: Code, description: 'Programming help' },
  { id: 'research', name: 'Research', icon: BookOpen, description: 'Research mode with citations' },
  { id: 'creti', name: 'CRETI', icon: Zap, description: 'Structured CRETI format' },
];

export default function ChatLensPage() {
  useLensNav('chat');
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<AIMode>(AI_MODES[0]);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [feedbackState, setFeedbackState] = useState<Record<string, 'up' | 'down'>>({});
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cognitive status — shows experience/attention/reflection state
  const { data: cogStatus, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['cognitive-status'],
    queryFn: () => apiHelpers.cognitive.status().then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: conversations, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/api/state/sessions').then(r =>
      r.data?.sessions?.map((s: Record<string, unknown>) => ({
        id: s.id || s.sessionId,
        title: s.title || 'New Conversation',
        lastMessage: s.lastMessage || '',
        updatedAt: s.updatedAt || new Date().toISOString(),
        messageCount: s.messageCount || 0
      })) || []
    ),
  });

  const { data: serverMessages, isError: isError3, error: error3, refetch: refetch3,} = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: () => api.get('/api/state/latest', {
      params: { sessionId: selectedConversation }
    }).then(r =>
      r.data?.lastMessages?.map((m: Record<string, unknown>, i: number) => ({
        id: m.id || `msg-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || new Date().toISOString(),
        model: m.model,
        tokens: m.tokens,
        refs: m.refs
      })) || []
    ),
    enabled: !!selectedConversation,
  });

  const messages = useMemo(() => selectedConversation ? (serverMessages || []) : localMessages, [selectedConversation, serverMessages, localMessages]);

  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString()
      };

      if (!selectedConversation) {
        setLocalMessages(prev => [...prev, userMsg]);
      }

      // Try streaming first, fall back to regular POST
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';
      try {
        setIsStreaming(true);
        setStreamingContent('');
        const streamRes = await fetch(`${apiUrl}/api/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: content,
            mode: aiMode.id,
            sessionId: selectedConversation,
          }),
        });

        if (streamRes.ok && streamRes.headers.get('content-type')?.includes('text/event-stream')) {
          const reader = streamRes.body?.getReader();
          const decoder = new TextDecoder();
          let accumulated = '';
          let finalOut: Record<string, unknown> | null = null;

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              const lines = text.split('\n');
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.chunk) {
                    accumulated += data.chunk;
                    setStreamingContent(accumulated);
                  }
                  if (data.done && data.out) {
                    finalOut = data.out;
                  }
                } catch {
                  // Malformed SSE chunk, skip
                }
              }
            }
          }

          setIsStreaming(false);
          setStreamingContent('');
          return { reply: accumulated, refs: (finalOut as Record<string, unknown>)?.refs, streamed: true };
        }

        // Non-SSE response: fall back to regular JSON
        setIsStreaming(false);
        setStreamingContent('');
        const data = await streamRes.json();
        return data;
      } catch {
        // Stream endpoint failed, fall back to regular POST
        setIsStreaming(false);
        setStreamingContent('');
        const response = await api.post('/api/chat', {
          message: content,
          mode: aiMode.id,
          sessionId: selectedConversation,
        });
        return response.data;
      }
    },
    onSuccess: (data) => {
      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.reply || data.answer || 'No response',
        timestamp: new Date().toISOString(),
        refs: data.refs
      };

      if (!selectedConversation) {
        setLocalMessages(prev => [...prev, assistantMsg]);
      }

      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['cognitive-status'] });
      setInput('');
    },
    onError: (err) => {
      setIsStreaming(false);
      setStreamingContent('');
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Failed to send message: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString()
      };
      if (!selectedConversation) {
        setLocalMessages(prev => [...prev, errorMsg]);
      }
    },
  });

  // Regenerate — resend the last user message to get a new response
  const regenerateMutation = useMutation({
    mutationFn: async (lastUserContent: string) => {
      const response = await api.post('/api/chat', {
        message: lastUserContent,
        mode: aiMode.id,
        sessionId: selectedConversation,
      });
      return response.data;
    },
    onSuccess: (data) => {
      const assistantMsg: Message = {
        id: `asst-regen-${Date.now()}`,
        role: 'assistant',
        content: data.reply || data.answer || 'No response',
        timestamp: new Date().toISOString(),
        refs: data.refs
      };
      if (!selectedConversation) {
        // Remove last assistant message and add new one
        setLocalMessages(prev => {
          const lastAssistantIdx = [...prev].reverse().findIndex(m => m.role === 'assistant');
          if (lastAssistantIdx === -1) return [...prev, assistantMsg];
          const idx = prev.length - 1 - lastAssistantIdx;
          return [...prev.slice(0, idx), assistantMsg];
        });
      }
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['cognitive-status'] });
    },
    onError: (err) => {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Regeneration failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
      if (!selectedConversation) {
        setLocalMessages(prev => [...prev, errorMsg]);
      }
    },
  });

  const handleRegenerate = useCallback(() => {
    // Find the last user message to resend
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg && !regenerateMutation.isPending) {
      regenerateMutation.mutate(lastUserMsg.content);
    }
  }, [messages, regenerateMutation]);

  // Feedback mutation — sends thumbs up/down to backend
  const feedbackMutation = useMutation({
    mutationFn: async ({ messageId, rating, index }: { messageId: string; rating: 'up' | 'down'; index: number }) => {
      const sessionId = selectedConversation || 'default';
      await apiHelpers.chat.feedback({ sessionId, rating, messageIndex: index });
      return { messageId, rating };
    },
    onSuccess: ({ messageId, rating }) => {
      setFeedbackState(prev => ({ ...prev, [messageId]: rating }));
    },
  });

  // Forge to DTU — convert an assistant response into a DTU
  const forgeMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiHelpers.forge.hybrid({
        content,
        tags: ['chat-forged'],
        source: 'chat-lens',
      });
      return response.data;
    },
    onSuccess: (data) => {
      const forgeMsg: Message = {
        id: `forge-${Date.now()}`,
        role: 'system',
        content: `Forged to DTU: ${data?.dtu?.title || data?.title || 'New DTU created'}`,
        timestamp: new Date().toISOString(),
        dtuId: data?.dtu?.id || data?.id,
      };
      setLocalMessages(prev => [...prev, forgeMsg]);
      queryClient.invalidateQueries({ queryKey: ['dtus'] });
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;
    sendMutation.mutate(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const formatTime = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, []);

  const startNewChat = () => {
    setSelectedConversation(null);
    setLocalMessages([]);
    setFeedbackState({});
  };

  const exp = cogStatus?.experience;
  const attn = cogStatus?.attention;
  const refl = cogStatus?.reflection;

  const renderMessage = useCallback((msgIdx: number, message: Message) => (
    <div
      className={cn(
        'flex gap-4 px-4 lg:px-6 py-3',
        message.role === 'user' ? 'flex-row-reverse' : ''
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
        message.role === 'user' ? 'bg-neon-purple' : 'bg-neon-cyan/20'
      )}>
        {message.role === 'user' ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-neon-cyan" />
        )}
      </div>
      <div className={cn('flex-1 max-w-2xl', message.role === 'user' ? 'text-right' : '')}>
        <div className={cn(
          'inline-block p-4 rounded-2xl',
          message.role === 'user'
            ? 'bg-neon-purple text-white rounded-br-md'
            : message.role === 'system'
              ? 'bg-red-500/10 border border-red-500/30 text-red-300 rounded-bl-md'
              : 'bg-lattice-surface border border-lattice-border text-gray-200 rounded-bl-md'
        )}>
          <p className="whitespace-pre-wrap">{message.content}</p>
          {message.refs && message.refs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-lattice-border/50">
              <p className="text-xs text-gray-400 mb-2">Referenced DTUs:</p>
              <div className="flex flex-wrap gap-1">
                {message.refs.slice(0, 5).map((ref) => (
                  <span key={ref.id} className="text-xs px-2 py-1 bg-neon-purple/20 text-neon-purple rounded cursor-pointer hover:bg-neon-purple/30" title={ref.id}>
                    {ref.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className={cn('flex items-center gap-2 mt-2 text-xs text-gray-500', message.role === 'user' ? 'justify-end' : '')}>
          <span>{formatTime(message.timestamp)}</span>
          {message.role === 'assistant' && (
            <>
              <span>·</span>
              <button onClick={() => copyToClipboard(message.content)} className="hover:text-white transition-colors" title="Copy" aria-label="Copy message">
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={() => feedbackMutation.mutate({ messageId: message.id, rating: 'up', index: msgIdx })}
                className={cn('transition-colors', feedbackState[message.id] === 'up' ? 'text-green-400' : 'hover:text-green-400')}
                title="Good response" aria-label="Thumbs up"
              >
                <ThumbsUp className={cn('w-3 h-3', feedbackState[message.id] === 'up' && 'fill-current')} />
              </button>
              <button
                onClick={() => feedbackMutation.mutate({ messageId: message.id, rating: 'down', index: msgIdx })}
                className={cn('transition-colors', feedbackState[message.id] === 'down' ? 'text-red-400' : 'hover:text-red-400')}
                title="Bad response" aria-label="Thumbs down"
              >
                <ThumbsDown className={cn('w-3 h-3', feedbackState[message.id] === 'down' && 'fill-current')} />
              </button>
              <button onClick={handleRegenerate} disabled={regenerateMutation.isPending}
                className={cn('hover:text-white transition-colors', regenerateMutation.isPending && 'animate-spin')}
                title="Regenerate response" aria-label="Regenerate"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <span>·</span>
              <button
                onClick={() => forgeMutation.mutate(message.content)}
                disabled={forgeMutation.isPending}
                className={cn('hover:text-neon-cyan transition-colors flex items-center gap-1', forgeMutation.isPending && 'opacity-50')}
                title="Forge this response into a DTU"
                aria-label="Forge to DTU"
              >
                <Zap className="w-3 h-3" />
                <span className="hidden sm:inline">Forge DTU</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  ), [feedbackState, feedbackMutation, forgeMutation, regenerateMutation, handleRegenerate, copyToClipboard, formatTime]);


  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetch(); refetch2(); refetch3(); }} />
      </div>
    );
  }
  return (
    <div className="h-full flex flex-col bg-lattice-bg">
      <div className="flex-1 flex overflow-hidden relative">
      {/* Mobile sidebar backdrop */}
      {chatSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setChatSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile by default, overlay when open */}
      <aside
        className={cn(
          'w-80 border-r border-lattice-border flex flex-col bg-lattice-surface z-40 transition-transform duration-200',
          'fixed inset-y-0 left-0 lg:relative lg:translate-x-0',
          chatSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        role="complementary"
        aria-label="Conversation list"
      >
        <div className="p-4 border-b border-lattice-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Bot className="w-6 h-6 text-neon-cyan" />
              Chat
            </h2>
            <button
              className="p-2 hover:bg-lattice-bg rounded-lg transition-colors"
              aria-label="Chat settings"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <button
            onClick={() => { startNewChat(); setChatSidebarOpen(false); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-neon-cyan text-black font-medium rounded-lg hover:bg-neon-cyan/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              aria-label="Search conversations"
              className="w-full pl-10 pr-4 py-2 bg-lattice-bg border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" role="list" aria-label="Conversations">
          {conversations?.map((conv: Conversation) => (
            <button
              key={conv.id}
              onClick={() => { setSelectedConversation(conv.id); setChatSidebarOpen(false); }}
              className={cn(
                'w-full p-4 text-left hover:bg-lattice-bg transition-colors border-b border-lattice-border/50',
                selectedConversation === conv.id && 'bg-neon-cyan/10 border-l-2 border-l-neon-cyan'
              )}
              role="listitem"
              aria-current={selectedConversation === conv.id ? 'true' : undefined}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-lattice-bg flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-neon-cyan" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">{conv.title}</h3>
                  <p className="text-sm text-gray-400 truncate">{conv.lastMessage || 'No messages'}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col" aria-label="Chat messages">
        <header className="px-4 lg:px-6 py-4 border-b border-lattice-border flex items-center justify-between bg-lattice-surface">
          <div className="flex items-center gap-3 lg:gap-4">
            {/* Mobile: toggle conversation sidebar */}
            <button
              onClick={() => setChatSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-lattice-bg text-gray-400 hover:text-white transition-colors"
              aria-label="Open conversation list"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowModeSelect(!showModeSelect)}
                className="flex items-center gap-2 px-4 py-2 bg-lattice-bg border border-lattice-border rounded-lg hover:border-gray-500 transition-colors"
              >
                <aiMode.icon className="w-4 h-4 text-neon-cyan" />
                <span className="text-white text-sm font-medium">{aiMode.name}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              <AnimatePresence>
                {showModeSelect && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-2 w-64 bg-lattice-surface border border-lattice-border rounded-lg shadow-xl z-50 overflow-hidden"
                  >
                    {AI_MODES.map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => {
                          setAiMode(mode);
                          setShowModeSelect(false);
                        }}
                        className={cn(
                          'w-full flex items-start gap-3 p-3 hover:bg-lattice-bg transition-colors',
                          aiMode.id === mode.id && 'bg-neon-cyan/10'
                        )}
                      >
                        <mode.icon className={cn(
                          'w-5 h-5 mt-0.5',
                          aiMode.id === mode.id ? 'text-neon-cyan' : 'text-gray-400'
                        )} />
                        <div className="text-left">
                          <p className="font-medium text-white">{mode.name}</p>
                          <p className="text-xs text-gray-400">{mode.description}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Cognitive Status Bar */}
          {cogStatus && (
            <div className="flex items-center gap-4 text-xs">
              {exp && (
                <div className="flex items-center gap-1.5 text-gray-400" title={`${exp.episodes} episodes, ${exp.patterns} patterns learned`}>
                  <Brain className="w-3.5 h-3.5 text-neon-purple" />
                  <span>{exp.patterns} patterns</span>
                </div>
              )}
              {attn && (
                <div className="flex items-center gap-1.5 text-gray-400" title={`${attn.activeThreads} active threads`}>
                  <Eye className="w-3.5 h-3.5 text-neon-cyan" />
                  <span>{attn.activeThreads} threads</span>
                </div>
              )}
              {refl && (
                <div className="flex items-center gap-1.5" title={`Self-calibration: ${((refl.calibration || 0) * 100).toFixed(0)}%`}>
                  <Activity className={`w-3.5 h-3.5 ${(refl.calibration || 0) > 0.6 ? 'text-neon-green' : 'text-yellow-400'}`} />
                  <span className={`${(refl.calibration || 0) > 0.6 ? 'text-neon-green' : 'text-yellow-400'}`}>
                    {((refl.calibration || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
              {refl?.strengths?.length > 0 && (
                <div className="flex items-center gap-1 text-neon-green" title={`Strengths: ${refl.strengths.join(', ')}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-lattice-bg rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-hidden flex flex-col" role="log" aria-label="Chat messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-neon-cyan/10 flex items-center justify-center mb-6">
                <Bot className="w-10 h-10 text-neon-cyan" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to Concordos Chat</h2>
              <p className="text-gray-400 max-w-md mb-8">
                Your local-first AI assistant. All conversations are stored in your lattice as DTUs.
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                {[
                  { icon: Sparkles, label: 'Explain a concept' },
                  { icon: Code, label: 'Help me code' },
                  { icon: FileText, label: 'Summarize text' },
                  { icon: Brain, label: 'Generate CRETI' },
                ].map(suggestion => (
                  <button
                    key={suggestion.label}
                    onClick={() => setInput(suggestion.label)}
                    className="flex items-center gap-3 p-4 bg-lattice-surface border border-lattice-border rounded-lg hover:border-neon-cyan transition-colors text-left"
                  >
                    <suggestion.icon className="w-5 h-5 text-neon-cyan" />
                    <span className="text-sm text-white">{suggestion.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <Virtuoso
              data={messages}
              followOutput="smooth"
              initialTopMostItemIndex={messages.length - 1}
              className="flex-1"
              itemContent={renderMessage}
            />
          )}

          {/* Streaming indicator */}
          {isStreaming && streamingContent && (
            <div className="flex gap-4 px-4 lg:px-6 pb-2">
              <div className="w-10 h-10 rounded-lg bg-neon-cyan/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-neon-cyan animate-pulse" />
              </div>
              <div className="flex-1 max-w-2xl">
                <div className="inline-block p-4 rounded-2xl rounded-bl-md bg-lattice-surface border border-neon-cyan/30 text-gray-200">
                  <p className="whitespace-pre-wrap">{streamingContent}</p>
                  <span className="inline-block w-2 h-4 bg-neon-cyan/60 animate-pulse ml-0.5" />
                </div>
              </div>
            </div>
          )}

          {/* Thinking indicator (when not streaming) */}
          {(sendMutation.isPending || regenerateMutation.isPending) && !isStreaming && (
            <div className="flex gap-4 px-4 lg:px-6 pb-2" role="status" aria-label="AI is thinking">
              <div className="w-10 h-10 rounded-lg bg-neon-cyan/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-neon-cyan animate-pulse" />
              </div>
              <div className="flex-1 max-w-2xl">
                <div className="inline-block p-4 rounded-2xl rounded-bl-md bg-lattice-surface border border-lattice-border">
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="sr-only">AI is generating a response...</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-lattice-border bg-lattice-surface">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-4">
              <div className="flex-1 flex items-end bg-lattice-bg border border-lattice-border rounded-2xl p-2">
                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                  <Paperclip className="w-5 h-5" />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${aiMode.name} mode...`}
                  rows={1}
                  className="flex-1 px-2 py-2 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none max-h-32"
                  style={{ minHeight: '24px' }}
                  disabled={sendMutation.isPending}
                />
                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                  <Smile className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                  <Mic className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || sendMutation.isPending}
                className="p-4 bg-neon-cyan text-black rounded-2xl hover:bg-neon-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              Messages are saved as DTUs in your local lattice. AI runs through Ollama when available.
            </p>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
