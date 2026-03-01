'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
import { useUIStore } from '@/store/ui';
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
  CheckCircle2,
  Pin,
  Quote,
  X,
  Hash,
  Terminal,
  GraduationCap,
  Globe,
  HelpCircle,
  Trash2,
  Download,
  Users,
  Check,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';
import { useLensDTUs } from '@/hooks/useLensDTUs';
import { LensContextPanel } from '@/components/lens/LensContextPanel';
import { LensWrapper } from '@/components/lens/LensWrapper';
import { ArtifactRenderer } from '@/components/artifact/ArtifactRenderer';
import { ArtifactUploader } from '@/components/artifact/ArtifactUploader';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { useRealtimeLens } from '@/hooks/useRealtimeLens';
import { LiveIndicator } from '@/components/lens/LiveIndicator';
import { DTUExportButton } from '@/components/lens/DTUExportButton';
import { RealtimeDataPanel } from '@/components/lens/RealtimeDataPanel';
import { LensFeaturePanel } from '@/components/lens/LensFeaturePanel';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface Attachment {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string; // base64 data URL for images
  dataBase64?: string; // base64 content for small files (< 512KB)
}

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
  pinned?: boolean;
  attachments?: Array<{ name: string; size: number; type: string }>;
  quotedMessageId?: string;
  quotedContent?: string;
  sources?: Array<{ type: string; title: string; url: string; source: string; snippet?: string; fetchedAt?: string }>;
  webAugmented?: boolean;
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

interface Persona {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  systemPrompt: string;
}

interface SlashCommand {
  command: string;
  label: string;
  description: string;
  icon: React.ElementType;
  args?: string;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const AI_MODES: AIMode[] = [
  { id: 'overview', name: 'Overview', icon: MessageSquare, description: 'General conversation' },
  { id: 'deep', name: 'Deep', icon: Brain, description: 'In-depth analysis' },
  { id: 'creative', name: 'Creative', icon: Sparkles, description: 'Creative writing & brainstorming' },
  { id: 'code', name: 'Code', icon: Code, description: 'Programming help' },
  { id: 'research', name: 'Research', icon: BookOpen, description: 'Research mode with citations' },
  { id: 'creti', name: 'CRETI', icon: Zap, description: 'Structured CRETI format' },
];

const PERSONAS: Persona[] = [
  {
    id: 'default',
    name: 'Default Assistant',
    icon: Bot,
    description: 'Standard helpful assistant',
    systemPrompt: '',
  },
  {
    id: 'research-analyst',
    name: 'Research Analyst',
    icon: Search,
    description: 'Thorough analysis with citations and evidence',
    systemPrompt: 'You are a rigorous research analyst. Provide well-structured analysis backed by evidence and citations. Always consider multiple perspectives, identify assumptions, and note limitations in the evidence. Use structured formatting with clear sections.',
  },
  {
    id: 'creative-writer',
    name: 'Creative Writer',
    icon: Sparkles,
    description: 'Imaginative and expressive writing style',
    systemPrompt: 'You are a talented creative writer. Use vivid language, metaphors, and engaging narrative techniques. Be imaginative and expressive while remaining clear. Adapt your tone to match the creative task at hand.',
  },
  {
    id: 'code-expert',
    name: 'Code Expert',
    icon: Terminal,
    description: 'Expert programmer with best practices',
    systemPrompt: 'You are an expert software engineer. Write clean, well-documented, production-quality code. Always explain your approach, consider edge cases, suggest optimizations, and follow established design patterns and best practices for the relevant language/framework.',
  },
  {
    id: 'domain-specialist',
    name: 'Domain Specialist',
    icon: Globe,
    description: 'Uses current lens context for domain expertise',
    systemPrompt: 'You are a domain specialist who deeply understands the current context and domain. Reference relevant domain-specific terminology, frameworks, and knowledge. Connect new information to existing domain knowledge in the lattice.',
  },
  {
    id: 'socratic-tutor',
    name: 'Socratic Tutor',
    icon: GraduationCap,
    description: 'Teaches through guided questioning',
    systemPrompt: 'You are a Socratic tutor. Instead of giving direct answers, guide the learner through carefully crafted questions that help them discover the answer themselves. Break complex topics into smaller concepts. Validate understanding at each step before proceeding.',
  },
];

const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/mode', label: '/mode [mode]', description: 'Switch AI mode', icon: Settings, args: 'mode' },
  { command: '/clear', label: '/clear', description: 'Clear chat history', icon: Trash2 },
  { command: '/export', label: '/export', description: 'Export conversation as JSON', icon: Download },
  { command: '/forge', label: '/forge', description: 'Forge last response to DTU', icon: Zap },
  { command: '/help', label: '/help', description: 'Show available commands', icon: HelpCircle },
  { command: '/context', label: '/context [domain]', description: 'Set domain context', icon: Hash, args: 'domain' },
];

const ACCEPTED_FILE_TYPES = '.txt,.md,.json,.csv,.pdf,.png,.jpg,.jpeg';
const MAX_BASE64_SIZE = 512 * 1024; // 512KB — encode files smaller than this

// ──────────────────────────────────────────────
// Helper: file to base64
// ──────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function ChatLensPage() {
  useLensNav('chat');
  const { latestData: realtimeData, alerts: realtimeAlerts, insights: realtimeInsights, isLive, lastUpdated } = useRealtimeLens('chat');
  const queryClient = useQueryClient();

  const {
    hyperDTUs, megaDTUs, regularDTUs,
    tierDistribution, publishToMarketplace,
    isLoading: dtusLoading, refetch: refetchDTUs,
  } = useLensDTUs({ lens: 'chat' });

  // Existing state
  const [input, setInput] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<AIMode>(AI_MODES[0]);
  const [showModeSelect, setShowModeSelect] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [feedbackState, setFeedbackState] = useState<Record<string, 'up' | 'down'>>({});
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  // New state — Persona picker
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PERSONAS[0]);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);

  // New state — Slash commands
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  // New state — File attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New state — Message actions
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // New state — Domain context
  const [domainContext, setDomainContext] = useState<string>('');

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ──────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────

  const { data: cogStatus, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['cognitive-status'],
    queryFn: () => apiHelpers.cognitive.status().then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: conversations, isError: isError2, error: error2, refetch: refetch2 } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiHelpers.eventsLog.list({ type: 'chat', limit: 50 }).then(r =>
      (r.data?.events || []).map((s: Record<string, unknown>) => ({
        id: s.id || s.sessionId,
        title: s.title || 'New Conversation',
        lastMessage: s.lastMessage || '',
        updatedAt: s.updatedAt || new Date().toISOString(),
        messageCount: s.messageCount || 0
      }))
    ),
  });

  const { data: serverMessages, isError: isError3, error: error3, refetch: refetch3 } = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: () => apiHelpers.cognitive.status().then(r =>
      (r.data?.lastMessages || []).map((m: Record<string, unknown>, i: number) => ({
        id: m.id || `msg-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || new Date().toISOString(),
        model: m.model,
        tokens: m.tokens,
        refs: m.refs
      }))
    ),
    enabled: !!selectedConversation,
  });

  const messages = useMemo(() => selectedConversation ? (serverMessages || []) : localMessages, [selectedConversation, serverMessages, localMessages]);

  const filteredConversations = useMemo(() => {
    if (!conversations || !conversationSearch.trim()) return conversations || [];
    const q = conversationSearch.toLowerCase();
    return (conversations as Conversation[]).filter(
      (c) => c.title.toLowerCase().includes(q) || c.lastMessage?.toLowerCase().includes(q)
    );
  }, [conversations, conversationSearch]);

  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // ──────────────────────────────────────────────
  // Slash command filtering
  // ──────────────────────────────────────────────

  const filteredSlashCommands = useMemo(() => {
    if (!slashFilter) return SLASH_COMMANDS;
    const q = slashFilter.toLowerCase();
    return SLASH_COMMANDS.filter(
      cmd => cmd.command.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q)
    );
  }, [slashFilter]);

  // Reset selection when filtered commands change
  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [filteredSlashCommands.length]);

  // ──────────────────────────────────────────────
  // Slash command execution
  // ──────────────────────────────────────────────

  const executeSlashCommand = useCallback((rawInput: string) => {
    const trimmed = rawInput.trim();
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    switch (cmd) {
      case '/mode': {
        if (arg) {
          const mode = AI_MODES.find(m => m.id.toLowerCase() === arg.toLowerCase() || m.name.toLowerCase() === arg.toLowerCase());
          if (mode) {
            setAiMode(mode);
            const sysMsg: Message = {
              id: `sys-${Date.now()}`,
              role: 'system',
              content: `Switched to ${mode.name} mode: ${mode.description}`,
              timestamp: new Date().toISOString(),
            };
            setLocalMessages(prev => [...prev, sysMsg]);
          } else {
            const sysMsg: Message = {
              id: `sys-${Date.now()}`,
              role: 'system',
              content: `Unknown mode "${arg}". Available: ${AI_MODES.map(m => m.id).join(', ')}`,
              timestamp: new Date().toISOString(),
            };
            setLocalMessages(prev => [...prev, sysMsg]);
          }
        } else {
          setShowModeSelect(true);
        }
        break;
      }
      case '/clear':
        startNewChat();
        break;
      case '/export':
        handleExportChat();
        break;
      case '/forge': {
        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
        if (lastAssistant) {
          forgeMutation.mutate(lastAssistant.content);
        } else {
          const sysMsg: Message = {
            id: `sys-${Date.now()}`,
            role: 'system',
            content: 'No assistant message to forge.',
            timestamp: new Date().toISOString(),
          };
          setLocalMessages(prev => [...prev, sysMsg]);
        }
        break;
      }
      case '/help': {
        const helpText = SLASH_COMMANDS.map(c => `${c.label} — ${c.description}`).join('\n');
        const sysMsg: Message = {
          id: `sys-${Date.now()}`,
          role: 'system',
          content: `Available commands:\n${helpText}`,
          timestamp: new Date().toISOString(),
        };
        setLocalMessages(prev => [...prev, sysMsg]);
        break;
      }
      case '/context': {
        if (arg) {
          setDomainContext(arg);
          const sysMsg: Message = {
            id: `sys-${Date.now()}`,
            role: 'system',
            content: `Domain context set to: ${arg}`,
            timestamp: new Date().toISOString(),
          };
          setLocalMessages(prev => [...prev, sysMsg]);
        } else {
          const current = domainContext || '(none)';
          const sysMsg: Message = {
            id: `sys-${Date.now()}`,
            role: 'system',
            content: `Current domain context: ${current}. Use /context [domain] to set one.`,
            timestamp: new Date().toISOString(),
          };
          setLocalMessages(prev => [...prev, sysMsg]);
        }
        break;
      }
      default: {
        const sysMsg: Message = {
          id: `sys-${Date.now()}`,
          role: 'system',
          content: `Unknown command: ${cmd}. Type /help for available commands.`,
          timestamp: new Date().toISOString(),
        };
        setLocalMessages(prev => [...prev, sysMsg]);
      }
    }

    setInput('');
    setShowSlashMenu(false);
    setSlashFilter('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, domainContext]);

  // ──────────────────────────────────────────────
  // Mutations
  // ──────────────────────────────────────────────

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      // Build attachment metadata
      const attachmentMeta = attachments.map(a => ({
        name: a.name,
        size: a.size,
        type: a.type,
        ...(a.dataBase64 ? { data: a.dataBase64 } : {}),
      }));

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
        attachments: attachmentMeta.map(a => ({ name: a.name, size: a.size, type: a.type })),
        quotedMessageId: quotedMessage?.id,
        quotedContent: quotedMessage?.content ? quotedMessage.content.slice(0, 200) : undefined,
      };

      if (!selectedConversation) {
        setLocalMessages(prev => [...prev, userMsg]);
      }

      // Build system prompt from persona + domain context
      let systemPrompt = '';
      if (selectedPersona.systemPrompt) {
        systemPrompt = selectedPersona.systemPrompt;
      }
      if (domainContext) {
        systemPrompt += (systemPrompt ? '\n\n' : '') + `Current domain context: ${domainContext}. Use domain-specific knowledge and terminology.`;
      }

      // Build the message to send, optionally including quoted context
      let messageContent = content;
      if (quotedMessage) {
        messageContent = `[Quoting: "${quotedMessage.content.slice(0, 200)}"]\n\n${content}`;
      }

      // Clear attachments and quote after building message
      setAttachments([]);
      setQuotedMessage(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';
      try {
        setIsStreaming(true);
        setStreamingContent('');
        const streamRes = await fetch(`${apiUrl}/api/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: messageContent,
            mode: aiMode.id,
            sessionId: selectedConversation,
            ...(systemPrompt ? { systemPrompt } : {}),
            ...(attachmentMeta.length > 0 ? { attachments: attachmentMeta } : {}),
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
          return {
            reply: accumulated,
            refs: (finalOut as Record<string, unknown>)?.refs,
            sources: (finalOut as Record<string, unknown>)?.sources,
            webAugmented: (finalOut as Record<string, unknown>)?.webAugmented,
            streamed: true,
          };
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
          message: messageContent,
          mode: aiMode.id,
          sessionId: selectedConversation,
          ...(systemPrompt ? { systemPrompt } : {}),
          ...(attachmentMeta.length > 0 ? { attachments: attachmentMeta } : {}),
        });
        return response.data;
      }
    },
    onSuccess: (data) => {
      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.reply || data.answer || data.content || data.text || data.response || (data.error ? `Error: ${data.error}` : 'The conscious brain is not responding. Check that the Ollama service is running.'),
        timestamp: new Date().toISOString(),
        refs: data.refs,
        sources: data.sources as Message['sources'],
        webAugmented: !!data.webAugmented,
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
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg && !regenerateMutation.isPending) {
      regenerateMutation.mutate(lastUserMsg.content);
    }
  }, [messages, regenerateMutation]);

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

  const deleteConversationMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiHelpers.lens.delete('chat', sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (selectedConversation) {
        setSelectedConversation(null);
        setLocalMessages([]);
      }
    },
  });

  // ──────────────────────────────────────────────
  // Handlers
  // ──────────────────────────────────────────────

  const handleExportChat = useCallback(() => {
    const exportData = messages.map((m: Message) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      ...(m.attachments ? { attachments: m.attachments } : {}),
      ...(m.pinned ? { pinned: true } : {}),
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMoreMenu(false);
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || sendMutation.isPending) return;

    // Check for slash commands
    if (input.trim().startsWith('/')) {
      executeSlashCommand(input);
      return;
    }

    sendMutation.mutate(input);
  }, [input, sendMutation, executeSlashCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Slash menu navigation
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashSelectedIndex(prev => Math.min(prev + 1, filteredSlashCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const selected = filteredSlashCommands[slashSelectedIndex];
        if (selected) {
          // Insert the command into the input
          setInput(selected.command + (selected.args ? ' ' : ''));
          setShowSlashMenu(false);
          setSlashFilter('');
          // If no args needed, execute immediately
          if (!selected.args) {
            // Use setTimeout to allow state to settle
            setTimeout(() => executeSlashCommand(selected.command), 0);
          }
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        setSlashFilter('');
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredSlashCommands[slashSelectedIndex];
        if (selected) {
          setInput(selected.command + (selected.args ? ' ' : ''));
          setShowSlashMenu(false);
          setSlashFilter('');
        }
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [showSlashMenu, filteredSlashCommands, slashSelectedIndex, handleSend, executeSlashCommand]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Slash command detection
    if (value.startsWith('/')) {
      const commandText = value.slice(1).split(/\s/)[0]; // text after / before first space
      if (!value.includes(' ') || value.split(/\s/).length <= 1) {
        setShowSlashMenu(true);
        setSlashFilter(commandText);
      } else {
        setShowSlashMenu(false);
        setSlashFilter('');
      }
    } else {
      setShowSlashMenu(false);
      setSlashFilter('');
    }
  }, []);

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    setInput(cmd.command + (cmd.args ? ' ' : ''));
    setShowSlashMenu(false);
    setSlashFilter('');
    inputRef.current?.focus();
    if (!cmd.args) {
      setTimeout(() => executeSlashCommand(cmd.command), 0);
    }
  }, [executeSlashCommand]);

  // ──────────────────────────────────────────────
  // File attachment handlers
  // ──────────────────────────────────────────────

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const attachment: Attachment = {
        id: `att-${Date.now()}-${i}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      };

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        try {
          attachment.preview = await fileToBase64(file);
        } catch {
          // Preview generation failed — non-critical
        }
      }

      // Base64 encode small files
      if (file.size <= MAX_BASE64_SIZE) {
        try {
          attachment.dataBase64 = await fileToBase64(file);
        } catch {
          // Encoding failed — will send metadata only
        }
      }

      newAttachments.push(attachment);
    }

    setAttachments(prev => [...prev, ...newAttachments]);

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // ──────────────────────────────────────────────
  // Message action handlers
  // ──────────────────────────────────────────────

  const copyToClipboard = useCallback((text: string, messageId?: string) => {
    navigator.clipboard.writeText(text).then(() => {
      if (messageId) {
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);
      }
    });
  }, []);

  const togglePin = useCallback((messageId: string) => {
    setPinnedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
    // Update the message in localMessages to reflect pinned state
    setLocalMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, pinned: !m.pinned } : m
    ));
  }, []);

  const quoteMessage = useCallback((message: Message) => {
    setQuotedMessage(message);
    inputRef.current?.focus();
  }, []);

  const formatTime = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, []);

  const startNewChat = useCallback(() => {
    setSelectedConversation(null);
    setLocalMessages([]);
    setFeedbackState({});
    setAttachments([]);
    setQuotedMessage(null);
    setPinnedMessages(new Set());
  }, []);

  const exp = cogStatus?.experience;
  const attn = cogStatus?.attention;
  const refl = cogStatus?.reflection;

  // ──────────────────────────────────────────────
  // Message renderer
  // ──────────────────────────────────────────────

  const renderMessage = useCallback((msgIdx: number, message: Message) => {
    const isPinned = pinnedMessages.has(message.id) || message.pinned;

    return (
      <div
        className={cn(
          'flex gap-4 px-4 lg:px-6 py-3 group relative',
          message.role === 'user' ? 'flex-row-reverse' : '',
          isPinned && 'bg-yellow-500/5 border-l-2 border-l-yellow-500/50'
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
          {/* Pinned indicator */}
          {isPinned && (
            <div className="flex items-center gap-1 text-yellow-500/80 text-xs mb-1">
              <Pin className="w-3 h-3" />
              <span>Pinned</span>
            </div>
          )}

          {/* Quoted message reference */}
          {message.quotedContent && (
            <div className={cn(
              'mb-2 p-2 rounded-lg border text-xs text-gray-400 max-w-sm',
              message.role === 'user'
                ? 'bg-neon-purple/10 border-neon-purple/30 ml-auto'
                : 'bg-lattice-bg border-lattice-border'
            )}>
              <div className="flex items-center gap-1 mb-1 text-gray-500">
                <Quote className="w-3 h-3" />
                <span>Replying to</span>
              </div>
              <p className="truncate">{message.quotedContent}</p>
            </div>
          )}

          <div className={cn(
            'inline-block p-4 rounded-2xl',
            message.role === 'user'
              ? 'bg-neon-purple text-white rounded-br-md'
              : message.role === 'system'
                ? 'bg-red-500/10 border border-red-500/30 text-red-300 rounded-bl-md'
                : 'bg-lattice-surface border border-lattice-border text-gray-200 rounded-bl-md'
          )}>
            <p className="whitespace-pre-wrap">{message.content}</p>

            {/* Attachment chips on user messages */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                {message.attachments.map((att, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded text-xs">
                    <Paperclip className="w-3 h-3" />
                    <span className="truncate max-w-[120px]">{att.name}</span>
                    <span className="text-white/50">{formatBytes(att.size)}</span>
                  </span>
                ))}
              </div>
            )}

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

            {/* Web sources panel */}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-lattice-border/50">
                <div className="flex items-center gap-1.5 text-xs text-neon-cyan/80 mb-2">
                  <Globe className="w-3 h-3" />
                  <span>Web Sources</span>
                </div>
                <div className="space-y-1.5">
                  {message.sources.map((src, i) => (
                    <a
                      key={`${src.url}-${i}`}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 p-1.5 rounded bg-neon-cyan/5 hover:bg-neon-cyan/10 transition-colors group/src"
                    >
                      <ExternalLink className="w-3 h-3 mt-0.5 text-neon-cyan/60 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-neon-cyan/90 truncate group-hover/src:text-neon-cyan">{src.title}</p>
                        <p className="text-[10px] text-gray-500 truncate">{src.source}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Message action bar */}
          <div className={cn(
            'flex items-center gap-2 mt-2 text-xs text-gray-500',
            message.role === 'user' ? 'justify-end' : ''
          )}>
            <span>{formatTime(message.timestamp)}</span>

            {/* Copy button — available on ALL messages */}
            <span>·</span>
            <button
              onClick={() => copyToClipboard(message.content, message.id)}
              className="hover:text-white transition-colors"
              title="Copy to clipboard"
              aria-label="Copy message"
            >
              {copiedMessageId === message.id ? (
                <Check className="w-3 h-3 text-neon-green" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>

            {/* Pin button — available on ALL messages */}
            <button
              onClick={() => togglePin(message.id)}
              className={cn(
                'transition-colors',
                isPinned ? 'text-yellow-500' : 'hover:text-yellow-500'
              )}
              title={isPinned ? 'Unpin message' : 'Pin message'}
              aria-label={isPinned ? 'Unpin message' : 'Pin message'}
            >
              <Pin className={cn('w-3 h-3', isPinned && 'fill-current')} />
            </button>

            {/* Quote / Reply button — available on ALL messages */}
            <button
              onClick={() => quoteMessage(message)}
              className="hover:text-neon-cyan transition-colors"
              title="Reply to this message"
              aria-label="Quote and reply"
            >
              <Quote className="w-3 h-3" />
            </button>

            {/* Assistant-specific actions */}
            {message.role === 'assistant' && (
              <>
                <span>·</span>
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
    );
  }, [feedbackState, feedbackMutation, forgeMutation, regenerateMutation, handleRegenerate, copyToClipboard, formatTime, pinnedMessages, copiedMessageId, togglePin, quoteMessage]);

  // ──────────────────────────────────────────────
  // Loading / Error states
  // ──────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetch(); refetch2(); refetch3(); }} />
      </div>
    );
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-lattice-bg">
      {/* Real-time Enhancement Toolbar */}
      <div className="flex items-center gap-2 px-4 py-1 border-b border-lattice-border/30 flex-wrap">
        <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} compact />
        <DTUExportButton domain="chat" data={realtimeData || {}} compact />
        {realtimeAlerts.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400">
            {realtimeAlerts.length} alert{realtimeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <RealtimeDataPanel domain="chat" data={realtimeData} isLive={isLive} lastUpdated={lastUpdated} insights={realtimeInsights} compact />
      <div className="flex-1 flex overflow-hidden relative">
      {/* Mobile sidebar backdrop */}
      {chatSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setChatSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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
              onClick={() => useUIStore.getState().addToast({ type: 'info', message: 'Chat settings coming soon' })}
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

        {/* DTU Context */}
        <div className="p-3 border-t border-white/10 space-y-3">
          <ArtifactUploader lens="chat" acceptTypes="*/*" multi compact onUploadComplete={() => refetchDTUs()} />
          <LensContextPanel
            hyperDTUs={hyperDTUs}
            megaDTUs={megaDTUs}
            regularDTUs={regularDTUs}
            tierDistribution={tierDistribution}
            onPublish={(dtu) => publishToMarketplace({ dtuId: dtu.id })}
            title="Chat DTUs"
            className="!bg-transparent !border-0 !p-0"
          />
          <FeedbackWidget targetType="lens" targetId="chat" />
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              placeholder="Search conversations..."
              aria-label="Search conversations"
              className="w-full pl-10 pr-4 py-2 bg-lattice-bg border border-lattice-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" role="list" aria-label="Conversations">
          {filteredConversations?.map((conv: Conversation) => (
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

            {/* AI Mode selector */}
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

            {/* Persona Picker */}
            <div className="relative">
              <button
                onClick={() => setShowPersonaPicker(!showPersonaPicker)}
                className="flex items-center gap-2 px-3 py-2 bg-lattice-bg border border-lattice-border rounded-lg hover:border-gray-500 transition-colors"
                title="Select persona"
              >
                <Users className="w-4 h-4 text-neon-purple" />
                <span className="text-white text-sm font-medium hidden sm:inline">{selectedPersona.name}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              <AnimatePresence>
                {showPersonaPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-2 w-72 bg-lattice-surface border border-lattice-border rounded-lg shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-3 border-b border-lattice-border">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Persona</p>
                    </div>
                    {PERSONAS.map(persona => (
                      <button
                        key={persona.id}
                        onClick={() => {
                          setSelectedPersona(persona);
                          setShowPersonaPicker(false);
                          // Announce the change
                          if (persona.id !== selectedPersona.id) {
                            const sysMsg: Message = {
                              id: `sys-${Date.now()}`,
                              role: 'system',
                              content: `Persona switched to: ${persona.name} — ${persona.description}`,
                              timestamp: new Date().toISOString(),
                            };
                            setLocalMessages(prev => [...prev, sysMsg]);
                          }
                        }}
                        className={cn(
                          'w-full flex items-start gap-3 p-3 hover:bg-lattice-bg transition-colors',
                          selectedPersona.id === persona.id && 'bg-neon-purple/10'
                        )}
                      >
                        <persona.icon className={cn(
                          'w-5 h-5 mt-0.5',
                          selectedPersona.id === persona.id ? 'text-neon-purple' : 'text-gray-400'
                        )} />
                        <div className="text-left">
                          <p className="font-medium text-white">{persona.name}</p>
                          <p className="text-xs text-gray-400">{persona.description}</p>
                        </div>
                        {selectedPersona.id === persona.id && (
                          <Check className="w-4 h-4 text-neon-purple ml-auto mt-0.5 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Domain context badge */}
            {domainContext && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-neon-cyan/10 border border-neon-cyan/30 rounded-full text-xs text-neon-cyan">
                <Hash className="w-3 h-3" />
                <span>{domainContext}</span>
                <button
                  onClick={() => setDomainContext('')}
                  className="ml-0.5 hover:text-white transition-colors"
                  title="Clear domain context"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Cognitive Status Bar */}
          {cogStatus && (
            <div className="hidden md:flex items-center gap-4 text-xs">
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

          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 hover:bg-lattice-bg rounded-lg transition-colors"
              aria-label="Chat options"
            >
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </button>
            <AnimatePresence>
              {showMoreMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full right-0 mt-2 w-48 bg-lattice-surface border border-lattice-border rounded-lg shadow-xl z-50 overflow-hidden"
                >
                  <button
                    onClick={handleExportChat}
                    disabled={messages.length === 0}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-200 hover:bg-lattice-bg transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Export Chat
                  </button>
                  <button
                    onClick={() => { startNewChat(); setShowMoreMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-200 hover:bg-lattice-bg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Conversation
                  </button>
                  {selectedConversation && (
                    <button
                      onClick={() => {
                        deleteConversationMutation.mutate(selectedConversation);
                        setShowMoreMenu(false);
                      }}
                      disabled={deleteConversationMutation.isPending}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-lattice-border disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-4 h-4 ${deleteConversationMutation.isPending ? 'animate-spin' : ''}`} />
                      {deleteConversationMutation.isPending ? 'Deleting...' : 'Delete Conversation'}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
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
              <p className="text-xs text-gray-500 mt-6">
                Type <code className="px-1.5 py-0.5 bg-lattice-surface rounded text-gray-400">/help</code> for slash commands
              </p>
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

            {/* Quoted message indicator */}
            {quotedMessage && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-lattice-bg border border-lattice-border rounded-lg">
                <Quote className="w-4 h-4 text-neon-cyan flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-0.5">
                    Replying to {quotedMessage.role === 'user' ? 'yourself' : 'assistant'}
                  </p>
                  <p className="text-sm text-gray-300 truncate">{quotedMessage.content}</p>
                </div>
                <button
                  onClick={() => setQuotedMessage(null)}
                  className="p-1 hover:bg-lattice-surface rounded transition-colors flex-shrink-0"
                  aria-label="Cancel reply"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            )}

            {/* Attachment chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map(att => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-lattice-bg border border-lattice-border rounded-lg text-sm"
                  >
                    {att.preview ? (
                      <img
                        src={att.preview}
                        alt={att.name}
                        className="w-6 h-6 rounded object-cover"
                      />
                    ) : (
                      <FileText className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-gray-300 truncate max-w-[150px]">{att.name}</span>
                    <span className="text-gray-500 text-xs">{formatBytes(att.size)}</span>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="p-0.5 hover:bg-lattice-surface rounded transition-colors"
                      aria-label={`Remove ${att.name}`}
                    >
                      <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Slash command autocomplete dropdown */}
            <div className="relative">
              <AnimatePresence>
                {showSlashMenu && filteredSlashCommands.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 mb-2 w-72 bg-lattice-surface border border-lattice-border rounded-lg shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-2 border-b border-lattice-border">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Commands</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {filteredSlashCommands.map((cmd, idx) => (
                        <button
                          key={cmd.command}
                          onClick={() => handleSlashSelect(cmd)}
                          onMouseEnter={() => setSlashSelectedIndex(idx)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                            idx === slashSelectedIndex ? 'bg-neon-cyan/10' : 'hover:bg-lattice-bg'
                          )}
                        >
                          <cmd.icon className={cn(
                            'w-4 h-4 flex-shrink-0',
                            idx === slashSelectedIndex ? 'text-neon-cyan' : 'text-gray-400'
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono text-white">{cmd.label}</p>
                            <p className="text-xs text-gray-400">{cmd.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="p-2 border-t border-lattice-border text-xs text-gray-500 flex items-center gap-3">
                      <span><kbd className="px-1 py-0.5 bg-lattice-bg rounded text-gray-400">Tab</kbd> select</span>
                      <span><kbd className="px-1 py-0.5 bg-lattice-bg rounded text-gray-400">Enter</kbd> confirm</span>
                      <span><kbd className="px-1 py-0.5 bg-lattice-bg rounded text-gray-400">Esc</kbd> dismiss</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-end gap-4">
                <div className="flex-1 flex items-end bg-lattice-bg border border-lattice-border rounded-2xl p-2">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-label="Attach files"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Attach files"
                    aria-label="Attach files"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${aiMode.name} mode${selectedPersona.id !== 'default' ? ` as ${selectedPersona.name}` : ''}... (/ for commands)`}
                    rows={1}
                    className="flex-1 px-2 py-2 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none max-h-32"
                    style={{ minHeight: '24px' }}
                    disabled={sendMutation.isPending}
                  />
                  <button onClick={() => setInput(prev => prev + ' :)')} className="p-2 text-gray-400 hover:text-white transition-colors">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button onClick={() => setInput(prev => prev + ' [Voice Note]')} className="p-2 text-gray-400 hover:text-white transition-colors">
                    <Mic className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || sendMutation.isPending}
                  className="p-4 bg-neon-cyan text-black rounded-2xl hover:bg-neon-cyan/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center mt-2">
              Messages are saved as DTUs in your local lattice. AI runs through Ollama when available.
            </p>
          </div>
        </div>
      </main>

      {/* Lens Features */}
      <div className="border-t border-white/10">
        <button
          onClick={() => setShowFeatures(!showFeatures)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Lens Features & Capabilities
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFeatures ? 'rotate-180' : ''}`} />
        </button>
        {showFeatures && (
          <div className="px-4 pb-4">
            <LensFeaturePanel lensId="chat" />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
