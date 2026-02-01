'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useLensNav } from '@/hooks/useLensNav';
import { Send, Sparkles, Settings } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts?: string;
  meta?: Record<string, any>;
}

export default function ChatLensPage() {
  const [input, setInput] = useState('');
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [messages, setMessages] = useState<Message[]>([]);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  useLensNav('chat');

  const chatMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await api.post('/api/chat', {
        sessionId,
        prompt,
        mode: 'chat',
        llm: llmEnabled,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || data.result?.reply || 'No response',
          ts: new Date().toISOString(),
          meta: data.meta,
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ['state-latest'] });
    },
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: input, ts: new Date().toISOString() },
    ]);
    chatMutation.mutate(input);
    setInput('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-lattice-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <div>
            <h1 className="text-xl font-bold">Chat Lens</h1>
            <p className="text-sm text-gray-400">
              Mode-aware conversation with DTU retrieval
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-400">LLM</span>
            <button
              onClick={() => setLlmEnabled(!llmEnabled)}
              className={`w-10 h-6 rounded-full transition-colors ${
                llmEnabled ? 'bg-neon-blue' : 'bg-lattice-border'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white m-1 transition-transform ${
                  llmEnabled ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </label>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-neon-blue/50" />
            <p>Start a conversation with Concord</p>
            <p className="text-sm mt-2">
              Ask questions, forge DTUs, or explore your knowledge graph
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-xl ${
                msg.role === 'user'
                  ? 'bg-neon-blue/20 text-white'
                  : 'bg-lattice-surface border border-lattice-border'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.meta?.llmUsed && (
                <span className="text-xs text-neon-purple mt-2 block">
                  ✨ LLM Enhanced
                </span>
              )}
            </div>
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-lattice-surface border border-lattice-border p-4 rounded-xl">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-neon-blue rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-neon-blue rounded-full animate-bounce delay-100" />
                <span className="w-2 h-2 bg-neon-blue rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-lattice-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Concord anything..."
            className="input-lattice flex-1"
            disabled={chatMutation.isPending}
          />
          <button
            onClick={handleSend}
            disabled={chatMutation.isPending || !input.trim()}
            className="btn-neon px-6 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
