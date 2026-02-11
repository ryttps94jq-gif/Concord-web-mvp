'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
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

      const response = await api.post('/api/chat', {
        message: content,
        mode: aiMode.id,
        sessionId: selectedConversation,
      });

      return response.data;
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
  });

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendMutation.isPending]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const startNewChat = () => {
    setSelectedConversation(null);
    setLocalMessages([]);
    setFeedbackState({});
  };

  const exp = cogStatus?.experience;
  const attn = cogStatus?.attention;
  const refl = cogStatus?.reflection;


  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetch(); refetch2(); refetch3(); }} />
      </div>
    );
  }
  return (
    <div className="h-full flex bg-lattice-bg">
      {/* Sidebar */}
      <aside className="w-80 border-r border-lattice-border flex flex-col bg-lattice-surface">
        <div className="p-4 border-b border-lattice-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Bot className="w-6 h-6 text-neon-cyan" />
              Chat
            </h1>
            <button className="p-2 hover:bg-lattice-bg rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <button
            onClick={startNewChat}
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
              className="w-full pl-10 pr-4 py-2 bg-lattice-bg border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations?.map((conv: Conversation) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversation(conv.id)}
              className={cn(
                'w-full p-4 text-left hover:bg-lattice-bg transition-colors border-b border-lattice-border/50',
                selectedConversation === conv.id && 'bg-neon-cyan/10 border-l-2 border-l-neon-cyan'
              )}
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
      <main className="flex-1 flex flex-col">
        <header className="px-6 py-4 border-b border-lattice-border flex items-center justify-between bg-lattice-surface">
          <div className="flex items-center gap-4">
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-neon-cyan/10 flex items-center justify-center mb-6">
                <Bot className="w-10 h-10 text-neon-cyan" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to Concord Chat</h2>
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

          {messages.map((message: Message, msgIdx: number) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-4',
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
                    : 'bg-lattice-surface border border-lattice-border text-gray-200 rounded-bl-md'
                )}>
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {message.refs && message.refs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-lattice-border/50">
                      <p className="text-xs text-gray-400 mb-2">Referenced DTUs:</p>
                      <div className="flex flex-wrap gap-1">
                        {message.refs.slice(0, 5).map((ref) => (
                          <span
                            key={ref.id}
                            className="text-xs px-2 py-1 bg-neon-purple/20 text-neon-purple rounded cursor-pointer hover:bg-neon-purple/30"
                            title={ref.id}
                          >
                            {ref.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={cn(
                  'flex items-center gap-2 mt-2 text-xs text-gray-500',
                  message.role === 'user' ? 'justify-end' : ''
                )}>
                  <span>{formatTime(message.timestamp)}</span>
                  {message.role === 'assistant' && (
                    <>
                      <span>·</span>
                      <button
                        onClick={() => copyToClipboard(message.content)}
                        className="hover:text-white transition-colors"
                        title="Copy"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => feedbackMutation.mutate({ messageId: message.id, rating: 'up', index: msgIdx })}
                        className={cn(
                          'transition-colors',
                          feedbackState[message.id] === 'up' ? 'text-green-400' : 'hover:text-green-400'
                        )}
                        title="Good response"
                      >
                        <ThumbsUp className={cn('w-3 h-3', feedbackState[message.id] === 'up' && 'fill-current')} />
                      </button>
                      <button
                        onClick={() => feedbackMutation.mutate({ messageId: message.id, rating: 'down', index: msgIdx })}
                        className={cn(
                          'transition-colors',
                          feedbackState[message.id] === 'down' ? 'text-red-400' : 'hover:text-red-400'
                        )}
                        title="Bad response"
                      >
                        <ThumbsDown className={cn('w-3 h-3', feedbackState[message.id] === 'down' && 'fill-current')} />
                      </button>
                      <button className="hover:text-white transition-colors" title="Regenerate">
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {sendMutation.isPending && (
            <div className="flex gap-4">
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
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
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
  );
}
