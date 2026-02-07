'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  RefreshCw,
  Brain,
  Zap,
  FileText,
  GitBranch,
  MessageSquare,
  Lightbulb,
  Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AIAction = 'expand' | 'summarize' | 'question' | 'connections' | 'rewrite' | 'explain' | 'challenge';

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: AIAction;
  timestamp: Date;
  isStreaming?: boolean;
}

interface AIAssistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText?: string;
  dtuContext?: { id: string; title: string; content: string };
  className?: string;
}

const actionConfig: Record<AIAction, { icon: React.ElementType; label: string; description: string }> = {
  expand: { icon: Zap, label: 'Expand', description: 'Elaborate on the selected content' },
  summarize: { icon: FileText, label: 'Summarize', description: 'Create a concise summary' },
  question: { icon: MessageSquare, label: 'Question', description: 'Ask about this content' },
  connections: { icon: GitBranch, label: 'Find Connections', description: 'Discover related DTUs' },
  rewrite: { icon: RefreshCw, label: 'Rewrite', description: 'Improve clarity and style' },
  explain: { icon: Lightbulb, label: 'Explain', description: 'Explain in simpler terms' },
  challenge: { icon: Brain, label: 'Challenge', description: 'Present counterarguments' }
};

export function AIAssistPanel({
  isOpen,
  onClose,
  selectedText,
  dtuContext,
  className
}: AIAssistPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle quick action
  const handleQuickAction = async (action: AIAction) => {
    const contextText = selectedText || dtuContext?.content || '';
    if (!contextText) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `[${actionConfig[action].label}] ${contextText.slice(0, 200)}${contextText.length > 200 ? '...' : ''}`,
      action,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setShowQuickActions(false);
    await generateResponse(action, contextText);
  };

  // Handle custom message
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowQuickActions(false);
    await generateResponse('question', input.trim());
  };

  // Generate AI response (simulated)
  const generateResponse = async (action: AIAction, _content: string) => {
    setIsLoading(true);

    // Create placeholder message
    const assistantMessage: AIMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      action,
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    // Simulate streaming response
    const responses: Record<AIAction, string> = {
      expand: `Based on the content provided, here's an expanded analysis:\n\nThe core concepts touch on several interconnected ideas. First, consider the foundational aspects that underpin the main argument. These establish the framework for understanding the broader implications.\n\nFurthermore, when we examine the secondary themes, we find rich connections to established research in cognitive science and philosophy of mind. The interplay between these elements suggests a more nuanced interpretation than initially apparent.\n\nKey considerations:\n• The relationship between perception and cognition\n• How memory consolidation affects understanding\n• The role of context in meaning-making`,
      summarize: `**Summary**\n\nThis content explores the intersection of cognitive frameworks and knowledge representation. The main points are:\n\n1. Discrete thought units provide atomic building blocks\n2. Connections between units form meaningful networks\n3. Higher-order consolidation enables efficient retrieval\n\nThe key insight is that structured thinking leads to better understanding.`,
      question: `Based on your question and the available context, here's my analysis:\n\nThe concept you're asking about relates to how we organize and retrieve knowledge. In the Concord framework, this is handled through DTUs (Discrete Thought Units) which can be connected, consolidated, and queried.\n\nWould you like me to elaborate on any specific aspect?`,
      connections: `I found several related DTUs that might be relevant:\n\n🔗 **Epistemology Notes** (85% match)\nDiscusses the foundations of knowledge\n\n🔗 **Cognitive Architecture** (72% match)\nExplores how the mind organizes information\n\n🔗 **Memory Systems** (68% match)\nCovers consolidation and retrieval processes\n\nShall I explore any of these connections further?`,
      rewrite: `Here's a revised version with improved clarity:\n\n---\n\nThought units serve as the fundamental building blocks of knowledge representation. When connected through meaningful relationships, they form networks that enable sophisticated reasoning and retrieval.\n\nThe key advantage of this approach is modularity: each unit remains discrete while participating in larger cognitive structures.\n\n---\n\nThis version emphasizes clarity and removes redundancy while preserving the core message.`,
      explain: `Let me break this down simply:\n\n**What it is:**\nThink of your thoughts like LEGO blocks. Each block (DTU) is one complete idea.\n\n**How it works:**\nBlocks connect to other blocks. When many blocks connect, they form bigger structures (MEGA/HYPER DTUs).\n\n**Why it matters:**\nThis helps you:\n- Find ideas faster\n- See connections you missed\n- Build complex understanding from simple pieces\n\nDoes this help clarify things?`,
      challenge: `Let me present some counterpoints to consider:\n\n**Alternative Perspective 1:**\nThe assumption that discrete units are the optimal representation may not hold for all types of knowledge. Some understanding is inherently holistic.\n\n**Alternative Perspective 2:**\nThe consolidation process might lose important nuance. What criteria determine what gets preserved?\n\n**Questions to Consider:**\n- How do we handle contradictory information?\n- What about implicit knowledge that resists explicit representation?\n- Is structure always beneficial, or can it constrain thinking?\n\nThese challenges don't invalidate the approach but suggest areas for deeper consideration.`
    };

    const fullResponse = responses[action];
    let currentText = '';

    // Simulate streaming
    for (let i = 0; i < fullResponse.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      currentText += fullResponse[i];

      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessage.id
          ? { ...msg, content: currentText }
          : msg
      ));
    }

    // Mark as complete
    setMessages(prev => prev.map(msg =>
      msg.id === assistantMessage.id
        ? { ...msg, isStreaming: false }
        : msg
    ));

    setIsLoading(false);
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className={cn(
            'fixed right-4 bottom-4 bg-lattice-bg border border-lattice-border rounded-xl shadow-2xl overflow-hidden z-50',
            isExpanded ? 'w-[600px] h-[80vh]' : 'w-[400px] h-[500px]',
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-lattice-border bg-gradient-to-r from-neon-purple/10 to-neon-cyan/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neon-purple" />
              <span className="font-medium text-white">AI Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
              >
                {isExpanded ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Context indicator */}
          {(selectedText || dtuContext) && (
            <div className="px-4 py-2 border-b border-lattice-border bg-lattice-surface/50">
              <p className="text-xs text-gray-400">
                {selectedText ? (
                  <>
                    <span className="text-neon-cyan">Selected:</span>{' '}
                    "{selectedText.slice(0, 50)}..."
                  </>
                ) : dtuContext ? (
                  <>
                    <span className="text-neon-cyan">Context:</span>{' '}
                    {dtuContext.title}
                  </>
                ) : null}
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ height: 'calc(100% - 180px)' }}>
            {messages.length === 0 && showQuickActions ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400 text-center">
                  {selectedText || dtuContext
                    ? 'Choose an action or ask a question:'
                    : 'Ask me anything about your knowledge base:'}
                </p>

                {(selectedText || dtuContext) && (
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(actionConfig) as [AIAction, typeof actionConfig[AIAction]][]).map(
                      ([action, config]) => {
                        const Icon = config.icon;
                        return (
                          <button
                            key={action}
                            onClick={() => handleQuickAction(action)}
                            className="flex items-center gap-2 p-3 bg-lattice-surface border border-lattice-border rounded-lg hover:border-neon-purple/50 hover:bg-neon-purple/5 transition-colors text-left"
                          >
                            <Icon className="w-4 h-4 text-neon-purple" />
                            <div>
                              <p className="text-sm text-white">{config.label}</p>
                              <p className="text-xs text-gray-500">{config.description}</p>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            ) : (
              messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-4 py-3',
                      message.role === 'user'
                        ? 'bg-neon-cyan/20 text-white'
                        : 'bg-lattice-surface text-gray-200'
                    )}
                  >
                    {message.action && message.role === 'user' && (
                      <span className="text-xs text-neon-purple mb-1 block">
                        {actionConfig[message.action].label}
                      </span>
                    )}
                    <div className="text-sm whitespace-pre-wrap">
                      {message.content}
                      {message.isStreaming && (
                        <span className="inline-block w-2 h-4 bg-neon-purple ml-1 animate-pulse" />
                      )}
                    </div>
                    {message.role === 'assistant' && !message.isStreaming && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-lattice-border">
                        <button
                          onClick={() => copyToClipboard(message.content, message.id)}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                          title="Copy"
                        >
                          {copiedId === message.id ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => generateResponse(message.action || 'expand', message.content)}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                          title="Regenerate"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-lattice-border bg-lattice-bg">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  className="w-full bg-lattice-surface border border-lattice-border rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-neon-purple resize-none"
                  rows={1}
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
                <button
                  className="absolute right-2 bottom-2 p-1.5 text-gray-400 hover:text-neon-purple transition-colors"
                  title="Quick actions"
                  onClick={() => setShowQuickActions(!showQuickActions)}
                >
                  <Wand2 className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className={cn(
                  'p-3 rounded-lg transition-colors',
                  input.trim() && !isLoading
                    ? 'bg-neon-purple text-white hover:bg-neon-purple/80'
                    : 'bg-lattice-surface text-gray-500 cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to manage AI assist panel
export function useAIAssist() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<string | undefined>();
  const [dtuContext, setDtuContext] = useState<{ id: string; title: string; content: string } | undefined>();

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setSelectedText(e.detail?.selectedText);
      setDtuContext(e.detail?.dtuContext);
      setIsOpen(true);
    };
    document.addEventListener('toggle-ai-assist', handler as EventListener);
    return () => document.removeEventListener('toggle-ai-assist', handler as EventListener);
  }, []);

  return {
    isOpen,
    selectedText,
    dtuContext,
    open: (text?: string, context?: typeof dtuContext) => {
      setSelectedText(text);
      setDtuContext(context);
      setIsOpen(true);
    },
    close: () => setIsOpen(false)
  };
}
