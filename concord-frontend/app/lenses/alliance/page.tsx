'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { Loading } from '@/components/common/Loading';
import { useState } from 'react';
import { Users, Plus, MessageSquare, Target, Shield, Zap } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { UniversalActions } from '@/components/lens/UniversalActions';

interface AllianceData {
  name: string;
  description: string;
  members: string[];
  type: 'research' | 'security' | 'development' | 'governance';
  status: 'active' | 'forming' | 'dissolved';
  sharedWorkspace: string;
  activeProposals: number;
  createdAt: string;
}

interface MessageData {
  allianceId: string;
  sender: string;
  content: string;
  timestamp: string;
}

const SEED_ALLIANCES: {
  title: string;
  data: Record<string, unknown>;
}[] = [];

const SEED_MESSAGES: {
  title: string;
  data: Record<string, unknown>;
}[] = [];

export default function AllianceLensPage() {
  useLensNav('alliance');
  const [selectedAlliance, setSelectedAlliance] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [newAllianceName, setNewAllianceName] = useState('');
  const [newAllianceDesc, setNewAllianceDesc] = useState('');
  const [newAllianceType, setNewAllianceType] = useState<AllianceData['type']>('research');

  const {
    items: allianceItems,
    isLoading: alliancesLoading, isError: isError, error: error, refetch: refetch,
    create: createAlliance,
    createMut: createAllianceMut,
  } = useLensData<AllianceData>('alliance', 'alliance', {
    seed: SEED_ALLIANCES,
  });

  const {
    items: messageItems,
    isLoading: messagesLoading, isError: isError2, error: error2, refetch: refetch2,
    create: createMessage,
    createMut: createMessageMut,
  } = useLensData<MessageData>('alliance', 'message', {
    seed: SEED_MESSAGES,
  });

  // Map lens items to the shapes used in rendering
  const alliances = allianceItems.map((item) => ({
    id: item.id,
    name: item.title || item.data?.name || '',
    description: item.data?.description || '',
    members: item.data?.members || [],
    type: (item.data?.type || 'research') as AllianceData['type'],
    status: (item.data?.status || 'forming') as AllianceData['status'],
    sharedWorkspace: item.data?.sharedWorkspace || '',
    activeProposals: item.data?.activeProposals ?? 0,
    createdAt: item.data?.createdAt || item.createdAt,
  }));

  const messages = messageItems.map((item) => ({
    id: item.id,
    allianceId: item.data?.allianceId || '',
    sender: item.data?.sender || '',
    content: item.data?.content || '',
    timestamp: item.data?.timestamp || item.createdAt,
  }));

  const typeColors = {
    research: 'text-neon-purple bg-neon-purple/20',
    security: 'text-neon-green bg-neon-green/20',
    development: 'text-neon-cyan bg-neon-cyan/20',
    governance: 'text-neon-blue bg-neon-blue/20',
  };

  const selectedAllianceData = alliances.find((a) => a.id === selectedAlliance);
  const allianceMessages = messages.filter((m) => m.allianceId === selectedAlliance);

  const handleCreateAlliance = async () => {
    if (!newAllianceName.trim()) return;
    await createAlliance({
      title: newAllianceName,
      data: {
        name: newAllianceName,
        description: newAllianceDesc,
        members: [],
        type: newAllianceType,
        status: 'forming',
        sharedWorkspace: newAllianceName.toLowerCase().replace(/\s+/g, '-'),
        activeProposals: 0,
        createdAt: new Date().toISOString().split('T')[0],
      } as Partial<AllianceData>,
    });
    setNewAllianceName('');
    setNewAllianceDesc('');
    setShowCreate(false);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || !selectedAlliance) return;
    await createMessage({
      title: `Message in ${selectedAllianceData?.name || 'alliance'}`,
      data: {
        allianceId: selectedAlliance,
        sender: 'You',
        content: chatMessage,
        timestamp: new Date().toISOString(),
      } as Partial<MessageData>,
    });
    setChatMessage('');
  };

  const isLoading = alliancesLoading || messagesLoading;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loading text="Loading alliances..." />
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
          <span className="text-2xl">🤝</span>
          <div>
            <h1 className="text-xl font-bold">Alliance Lens</h1>
            <p className="text-sm text-gray-400">
              Multi-entity collaboration and shared workspaces
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-neon purple"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Form Alliance
        </button>
      </header>


      {/* AI Actions */}
      <UniversalActions domain="alliance" artifactId={items[0]?.id} compact />
      {/* Create Alliance Form */}
      {showCreate && (
        <div className="panel p-4 space-y-3">
          <h3 className="font-semibold">Form New Alliance</h3>
          <input
            type="text"
            value={newAllianceName}
            onChange={(e) => setNewAllianceName(e.target.value)}
            placeholder="Alliance name..."
            className="input-lattice w-full"
          />
          <input
            type="text"
            value={newAllianceDesc}
            onChange={(e) => setNewAllianceDesc(e.target.value)}
            placeholder="Description..."
            className="input-lattice w-full"
          />
          <select
            value={newAllianceType}
            onChange={(e) => setNewAllianceType(e.target.value as AllianceData['type'])}
            className="input-lattice w-full"
          >
            <option value="research">Research</option>
            <option value="security">Security</option>
            <option value="development">Development</option>
            <option value="governance">Governance</option>
          </select>
          <button
            onClick={handleCreateAlliance}
            disabled={createAllianceMut.isPending || !newAllianceName.trim()}
            className="btn-neon green w-full"
          >
            {createAllianceMut.isPending ? 'Creating...' : 'Create Alliance'}
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="lens-card">
          <Users className="w-5 h-5 text-neon-purple mb-2" />
          <p className="text-2xl font-bold">{alliances.length}</p>
          <p className="text-sm text-gray-400">Total Alliances</p>
        </div>
        <div className="lens-card">
          <Zap className="w-5 h-5 text-neon-green mb-2" />
          <p className="text-2xl font-bold">{alliances.filter((a) => a.status === 'active').length}</p>
          <p className="text-sm text-gray-400">Active</p>
        </div>
        <div className="lens-card">
          <Target className="w-5 h-5 text-neon-blue mb-2" />
          <p className="text-2xl font-bold">{alliances.reduce((s, a) => s + a.activeProposals, 0)}</p>
          <p className="text-sm text-gray-400">Joint Proposals</p>
        </div>
        <div className="lens-card">
          <Shield className="w-5 h-5 text-neon-cyan mb-2" />
          <p className="text-2xl font-bold">{alliances.reduce((s, a) => s + a.members.length, 0)}</p>
          <p className="text-sm text-gray-400">Total Members</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alliance List */}
        <div className="panel p-4">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-neon-purple" />
            Alliances
          </h2>
          <div className="space-y-3">
            {alliances.map((alliance) => (
              <button
                key={alliance.id}
                onClick={() => setSelectedAlliance(alliance.id)}
                className={`w-full text-left lens-card transition-all ${
                  selectedAlliance === alliance.id ? 'border-neon-cyan ring-1 ring-neon-cyan' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{alliance.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${typeColors[alliance.type]}`}>
                    {alliance.type}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mb-2">{alliance.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{alliance.members.length} members</span>
                  <span className={alliance.status === 'active' ? 'text-neon-green' : 'text-gray-400'}>
                    {alliance.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Alliance Details & Chat */}
        <div className="lg:col-span-2 space-y-4">
          {selectedAllianceData ? (
            <>
              {/* Details */}
              <div className="panel p-4">
                <h2 className="font-semibold mb-4">{selectedAllianceData.name}</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="lens-card">
                    <p className="text-xs text-gray-400">Shared Workspace</p>
                    <p className="font-mono">{selectedAllianceData.sharedWorkspace}</p>
                  </div>
                  <div className="lens-card">
                    <p className="text-xs text-gray-400">Active Proposals</p>
                    <p className="text-xl font-bold text-neon-purple">{selectedAllianceData.activeProposals}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-2">Members</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAllianceData.members.map((member) => (
                      <span key={member} className="px-3 py-1 bg-lattice-surface rounded-full text-sm">
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat */}
              <div className="panel p-4">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-neon-blue" />
                  Alliance Chat
                </h3>
                <div className="space-y-3 mb-4 max-h-60 overflow-auto">
                  {allianceMessages.length === 0 ? (
                    <p className="text-center py-4 text-gray-500">No messages yet</p>
                  ) : (
                    allianceMessages.map((msg) => (
                      <div key={msg.id} className="bg-lattice-deep p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-neon-cyan">{msg.sender}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Message the alliance..."
                    className="input-lattice flex-1"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={createMessageMut.isPending || !chatMessage.trim()}
                    className="btn-neon"
                  >
                    {createMessageMut.isPending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="panel p-4 h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select an alliance to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
