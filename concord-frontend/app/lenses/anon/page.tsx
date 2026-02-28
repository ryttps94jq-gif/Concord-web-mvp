'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useMutation } from '@tanstack/react-query';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useState } from 'react';
import { Shield, Send, RefreshCw, Eye, EyeOff, Lock } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';

interface AnonMessage {
  id: string;
  content: string;
  timestamp: string;
  encrypted: boolean;
  expiresAt?: string;
}

export default function AnonLensPage() {
  useLensNav('anon');

  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [showMessages, setShowMessages] = useState(true);
  const [ephemeral, setEphemeral] = useState(false);

  const { items: messageItems, isLoading, isError: isError, error: error, refetch: refetch, create: createMessage } = useLensData<Record<string, unknown>>('anon', 'message', { seed: [] });
  const messages = messageItems.map(i => ({ id: i.id, ...(i.data || {}) })) as unknown as AnonMessage[];

  const { items: identityItems, isError: isError2, error: error2, refetch: refetch2, create: createIdentity, remove: removeIdentity } = useLensData<Record<string, unknown>>('anon', 'identity', { seed: [] });
  const identity = identityItems.length > 0 ? identityItems[0].data : null;

  const sendMessage = useMutation({
    mutationFn: (payload: { content: string; recipient: string; ephemeral: boolean }) =>
      createMessage({ title: 'message', data: payload }),
    onSuccess: () => {
      refetch();
      setMessage('');
      setRecipient('');
    },
    onError: (err) => console.error('Send anonymous message failed:', err instanceof Error ? err.message : err),
  });

  const rotateIdentity = useMutation({
    mutationFn: async () => {
      if (identityItems.length > 0) await removeIdentity(identityItems[0].id);
      return createIdentity({ title: 'identity', data: { alias: `anon-${Math.random().toString(36).slice(2, 8)}`, rotatedAt: new Date().toISOString() } });
    },
    onSuccess: () => {
      refetch2();
    },
    onError: (err) => console.error('Identity rotation failed:', err instanceof Error ? err.message : err),
  });


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isError || isError2) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message} onRetry={() => { refetch(); refetch2(); }} />
      </div>
    );
  }
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


      {/* AI Actions */}
      <UniversalActions domain="anon" artifactId={messageItems[0]?.id} compact />
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
              {String(identity?.anonId || 'Loading...')}
            </p>
          </div>

          <div className="lens-card">
            <p className="text-xs text-gray-400 mb-1">Public Key</p>
            <p className="font-mono text-xs break-all text-gray-300">
              {String(identity?.publicKey || '').slice(0, 32)}...
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
              {messages?.length === 0 ? (
                <p className="text-center py-8 text-gray-500">
                  No messages yet. Your inbox is secure and empty.
                </p>
              ) : showMessages ? (
                messages?.map((msg: AnonMessage) => (
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
