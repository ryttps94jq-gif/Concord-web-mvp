'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Shield, Send, RefreshCw, Eye, EyeOff, Lock } from 'lucide-react';

interface AnonMessage {
  id: string;
  content: string;
  timestamp: string;
  encrypted: boolean;
  expiresAt?: string;
}

export default function AnonLensPage() {
  useLensNav('anon');

  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [showMessages, setShowMessages] = useState(true);
  const [ephemeral, setEphemeral] = useState(false);

  const { data: messages } = useQuery({
    queryKey: ['anon-messages'],
    queryFn: () => api.get('/api/anon/messages').then((r) => r.data),
  });

  const { data: identity } = useQuery({
    queryKey: ['anon-identity'],
    queryFn: () => api.get('/api/anon/identity').then((r) => r.data),
  });

  const sendMessage = useMutation({
    mutationFn: (payload: { content: string; recipient: string; ephemeral: boolean }) =>
      api.post('/api/anon/send', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anon-messages'] });
      setMessage('');
      setRecipient('');
    },
  });

  const rotateIdentity = useMutation({
    mutationFn: () => api.post('/api/anon/rotate'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anon-identity'] });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👤</span>
          <div>
            <h1 className="text-xl font-bold">Anon Lens</h1>
            <p className="text-sm text-gray-400">
              Anonymous E2E encrypted messaging
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-neon-green" />
          <span className="text-sm text-neon-green">E2E Encrypted</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Identity Panel */}
        <div className="panel p-4 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-neon-purple" />
            Anonymous Identity
          </h3>

          <div className="lens-card sovereignty-lock">
            <p className="text-xs text-gray-400 mb-1">Your Anon ID</p>
            <p className="font-mono text-sm break-all">
              {identity?.anonId || 'Loading...'}
            </p>
          </div>

          <div className="lens-card">
            <p className="text-xs text-gray-400 mb-1">Public Key</p>
            <p className="font-mono text-xs break-all text-gray-300">
              {identity?.publicKey?.slice(0, 32)}...
            </p>
          </div>

          <button
            onClick={() => rotateIdentity.mutate()}
            disabled={rotateIdentity.isPending}
            className="btn-neon w-full flex items-center justify-center gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${rotateIdentity.isPending ? 'animate-spin' : ''}`}
            />
            Rotate Identity
          </button>

          <p className="text-xs text-gray-500 text-center">
            Rotating generates a new anonymous identity
          </p>
        </div>

        {/* Message Compose */}
        <div className="lg:col-span-2 space-y-4">
          <div className="panel p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Send className="w-4 h-4 text-neon-blue" />
              Send Anonymous Message
            </h3>

            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Recipient Anon ID or Public Key..."
              className="input-lattice font-mono text-sm"
            />

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your encrypted message..."
              className="input-lattice h-32 resize-none"
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ephemeral}
                  onChange={(e) => setEphemeral(e.target.checked)}
                  className="rounded border-lattice-border bg-lattice-deep"
                />
                <span className="text-sm text-gray-400">Ephemeral (self-destruct)</span>
              </label>

              <button
                onClick={() =>
                  sendMessage.mutate({ content: message, recipient, ephemeral })
                }
                disabled={!message || !recipient || sendMessage.isPending}
                className="btn-neon purple"
              >
                <Send className="w-4 h-4 mr-2 inline" />
                {sendMessage.isPending ? 'Encrypting...' : 'Send'}
              </button>
            </div>
          </div>

          {/* Received Messages */}
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-neon-green" />
                Received Messages
              </h3>
              <button
                onClick={() => setShowMessages(!showMessages)}
                className="btn-neon p-2"
              >
                {showMessages ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="space-y-2">
              {messages?.messages?.length === 0 ? (
                <p className="text-center py-8 text-gray-500">
                  No messages yet. Your inbox is secure and empty.
                </p>
              ) : showMessages ? (
                messages?.messages?.map((msg: AnonMessage) => (
                  <div key={msg.id} className="lens-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">
                        {new Date(msg.timestamp).toLocaleString()}
                      </span>
                      {msg.encrypted && (
                        <Lock className="w-3 h-3 text-neon-green" />
                      )}
                    </div>
                    <p className="text-sm">{msg.content}</p>
                    {msg.expiresAt && (
                      <p className="text-xs text-neon-pink mt-2">
                        Expires: {new Date(msg.expiresAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center py-8 text-gray-500">
                  Messages hidden for privacy
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
