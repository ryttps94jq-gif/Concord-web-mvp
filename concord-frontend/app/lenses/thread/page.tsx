'use client';

import { useState, useMemo } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  GitBranch,
  GitMerge,
  GitFork,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  Clock,
  User,
  Bot,
  MoreHorizontal,
  Trash2,
  Copy,
  Pin,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Link2
} from 'lucide-react';

interface ThreadNode {
  id: string;
  parentId: string | null;
  content: string;
  author: 'user' | 'ai';
  timestamp: Date;
  children: ThreadNode[];
  depth: number;
  branchName?: string;
  isPinned?: boolean;
  isArchived?: boolean;
}

interface Thread {
  id: string;
  name: string;
  rootNode: ThreadNode;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  branchCount: number;
}

const MOCK_THREADS: Thread[] = [
  {
    id: 'thread-1',
    name: 'Project Architecture Discussion',
    createdAt: new Date(Date.now() - 86400000 * 2),
    updatedAt: new Date(Date.now() - 3600000),
    messageCount: 24,
    branchCount: 3,
    rootNode: {
      id: 'msg-1',
      parentId: null,
      content: 'How should we structure the microservices architecture?',
      author: 'user',
      timestamp: new Date(Date.now() - 86400000 * 2),
      depth: 0,
      children: [
        {
          id: 'msg-2',
          parentId: 'msg-1',
          content: 'I recommend starting with a domain-driven design approach. Let me outline the key bounded contexts...',
          author: 'ai',
          timestamp: new Date(Date.now() - 86400000 * 2 + 60000),
          depth: 1,
          children: [
            {
              id: 'msg-3',
              parentId: 'msg-2',
              content: 'What about using event sourcing for the order service?',
              author: 'user',
              timestamp: new Date(Date.now() - 86400000),
              depth: 2,
              branchName: 'Event Sourcing Branch',
              children: [
                {
                  id: 'msg-4',
                  parentId: 'msg-3',
                  content: 'Event sourcing would be excellent for the order service. Here\'s why...',
                  author: 'ai',
                  timestamp: new Date(Date.now() - 86400000 + 60000),
                  depth: 3,
                  children: [],
                },
              ],
            },
            {
              id: 'msg-5',
              parentId: 'msg-2',
              content: 'Can we explore the CQRS pattern instead?',
              author: 'user',
              timestamp: new Date(Date.now() - 3600000 * 12),
              depth: 2,
              branchName: 'CQRS Branch',
              children: [],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'thread-2',
    name: 'API Design Review',
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 7200000),
    messageCount: 15,
    branchCount: 2,
    rootNode: {
      id: 'api-1',
      parentId: null,
      content: 'Review the REST API endpoints for the user service',
      author: 'user',
      timestamp: new Date(Date.now() - 86400000),
      depth: 0,
      children: [],
    },
  },
  {
    id: 'thread-3',
    name: 'Database Schema Design',
    createdAt: new Date(Date.now() - 86400000 * 3),
    updatedAt: new Date(Date.now() - 86400000),
    messageCount: 31,
    branchCount: 5,
    rootNode: {
      id: 'db-1',
      parentId: null,
      content: 'Let\'s design the database schema for the new feature',
      author: 'user',
      timestamp: new Date(Date.now() - 86400000 * 3),
      depth: 0,
      children: [],
    },
  },
];

type ViewMode = 'tree' | 'timeline' | 'linear';

export default function ThreadLensPage() {
  useLensNav('thread');

  const [threads] = useState<Thread[]>(MOCK_THREADS);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(MOCK_THREADS[0]);
  const [selectedNode, setSelectedNode] = useState<ThreadNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['msg-1', 'msg-2']));
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [_showArchived, _setShowArchived] = useState(false);

  const { data: sessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get('/api/state/latest').then((r) => r.data),
  });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const flattenThread = (node: ThreadNode): ThreadNode[] => {
    const nodes: ThreadNode[] = [node];
    node.children.forEach((child) => {
      nodes.push(...flattenThread(child));
    });
    return nodes;
  };

  const allNodes = useMemo(() => {
    if (!selectedThread) return [];
    return flattenThread(selectedThread.rootNode);
  }, [selectedThread]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return allNodes;
    return allNodes.filter((node) =>
      node.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allNodes, searchQuery]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const renderThreadNode = (node: ThreadNode, _isLast: boolean = false) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedNode?.id === node.id;

    return (
      <div key={node.id} className="relative">
        {/* Connection lines */}
        {node.depth > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 border-l-2 border-lattice-border"
            style={{ left: `${(node.depth - 1) * 24 + 12}px` }}
          />
        )}

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={`relative flex items-start gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all ${
            isSelected
              ? 'bg-neon-purple/20 border border-neon-purple/50'
              : 'hover:bg-lattice-elevated'
          }`}
          style={{ marginLeft: `${node.depth * 24}px` }}
          onClick={() => setSelectedNode(node)}
        >
          {/* Expand/Collapse button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              className="p-1 rounded hover:bg-lattice-border/50 text-gray-400"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-6" />}

          {/* Author icon */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              node.author === 'user'
                ? 'bg-neon-blue/20 text-neon-blue'
                : 'bg-neon-purple/20 text-neon-purple'
            }`}
          >
            {node.author === 'user' ? (
              <User className="w-4 h-4" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">
                {node.author === 'user' ? 'You' : 'Concord'}
              </span>
              <span className="text-xs text-gray-500">{formatTime(node.timestamp)}</span>
              {node.branchName && (
                <span className="text-xs bg-neon-purple/20 text-neon-purple px-2 py-0.5 rounded-full flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  {node.branchName}
                </span>
              )}
              {node.isPinned && <Pin className="w-3 h-3 text-neon-yellow" />}
            </div>
            <p className="text-sm text-gray-300 line-clamp-2">{node.content}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-1 rounded hover:bg-lattice-border/50 text-gray-400 hover:text-white">
              <GitFork className="w-4 h-4" />
            </button>
            <button className="p-1 rounded hover:bg-lattice-border/50 text-gray-400 hover:text-white">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="relative">
            {node.children.map((child, idx) =>
              renderThreadNode(child, idx === node.children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-lattice-border">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧵</span>
          <div>
            <h1 className="text-xl font-bold">Thread Lens</h1>
            <p className="text-sm text-gray-400">
              Branching conversation threads with lineage tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-lattice-surface rounded-lg p-1">
            {(['tree', 'timeline', 'linear'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-neon-purple text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <button className="btn-neon flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Thread
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Thread List Sidebar */}
        <aside className="w-72 border-r border-lattice-border flex flex-col bg-lattice-surface/50">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search threads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-lattice-deep border border-lattice-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-neon-purple/50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Recent Threads
              </p>
              <div className="space-y-1">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => {
                      setSelectedThread(thread);
                      setSelectedNode(null);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedThread?.id === thread.id
                        ? 'bg-neon-purple/20 border border-neon-purple/30'
                        : 'hover:bg-lattice-elevated'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-medium text-sm truncate">{thread.name}</span>
                      <span className="text-xs text-gray-500">{formatTime(thread.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {thread.messageCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />
                        {thread.branchCount}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-lattice-border">
            <div className="text-xs text-gray-500 space-y-1">
              <p>Session: {sessions?.sessionId || 'default'}</p>
              <p>Total Threads: {threads.length}</p>
            </div>
          </div>
        </aside>

        {/* Thread Tree View */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedThread ? (
            <>
              {/* Thread header */}
              <div className="p-4 border-b border-lattice-border bg-lattice-surface/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GitBranch className="w-5 h-5 text-neon-purple" />
                    <div>
                      <h2 className="font-semibold">{selectedThread.name}</h2>
                      <p className="text-xs text-gray-500">
                        {selectedThread.messageCount} messages · {selectedThread.branchCount} branches
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white">
                      <GitMerge className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white">
                      <GitFork className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white">
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Thread content */}
              <div className="flex-1 overflow-y-auto p-4">
                {viewMode === 'tree' && renderThreadNode(selectedThread.rootNode)}

                {viewMode === 'timeline' && (
                  <div className="relative pl-8">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-lattice-border" />
                    {filteredNodes
                      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
                      .map((node) => (
                        <div key={node.id} className="relative mb-4">
                          <div
                            className={`absolute left-0 w-3 h-3 rounded-full -translate-x-1/2 ${
                              node.author === 'user' ? 'bg-neon-blue' : 'bg-neon-purple'
                            }`}
                            style={{ left: '16px', top: '6px' }}
                          />
                          <div className="ml-6 panel p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium text-sm">
                                {node.author === 'user' ? 'You' : 'Concord'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {node.timestamp.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300">{node.content}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {viewMode === 'linear' && (
                  <div className="space-y-3">
                    {filteredNodes.map((node) => (
                      <div
                        key={node.id}
                        className={`flex gap-3 ${
                          node.author === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[70%] p-3 rounded-lg ${
                            node.author === 'user'
                              ? 'bg-neon-blue/20 border border-neon-blue/30'
                              : 'bg-lattice-elevated border border-lattice-border'
                          }`}
                        >
                          <p className="text-sm">{node.content}</p>
                          <p className="text-xs text-gray-500 mt-1">{formatTime(node.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-neon-purple/30" />
                <p className="text-lg font-medium mb-2">No thread selected</p>
                <p className="text-sm">Select a thread from the sidebar or create a new one</p>
              </div>
            </div>
          )}
        </main>

        {/* Node Details Sidebar */}
        <AnimatePresence>
          {selectedNode && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-lattice-border bg-lattice-surface/50 overflow-hidden"
            >
              <div className="w-80 h-full flex flex-col">
                <div className="p-4 border-b border-lattice-border flex items-center justify-between">
                  <h3 className="font-semibold">Message Details</h3>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 rounded hover:bg-lattice-elevated text-gray-400"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Author</p>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          selectedNode.author === 'user'
                            ? 'bg-neon-blue/20 text-neon-blue'
                            : 'bg-neon-purple/20 text-neon-purple'
                        }`}
                      >
                        {selectedNode.author === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      <span className="font-medium">
                        {selectedNode.author === 'user' ? 'You' : 'Concord AI'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Timestamp</p>
                    <p className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {selectedNode.timestamp.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Content</p>
                    <div className="panel p-3">
                      <p className="text-sm text-gray-300">{selectedNode.content}</p>
                    </div>
                  </div>

                  {selectedNode.branchName && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Branch</p>
                      <span className="inline-flex items-center gap-1 text-sm bg-neon-purple/20 text-neon-purple px-3 py-1 rounded-full">
                        <GitBranch className="w-4 h-4" />
                        {selectedNode.branchName}
                      </span>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Lineage</p>
                    <div className="text-sm space-y-1">
                      <p className="flex items-center gap-2">
                        <ArrowUp className="w-4 h-4 text-gray-400" />
                        Parent: {selectedNode.parentId || 'Root'}
                      </p>
                      <p className="flex items-center gap-2">
                        <ArrowDown className="w-4 h-4 text-gray-400" />
                        Children: {selectedNode.children.length}
                      </p>
                      <p className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-gray-400" />
                        Depth: {selectedNode.depth}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-lattice-border">
                  <div className="grid grid-cols-4 gap-2">
                    <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white flex flex-col items-center gap-1">
                      <GitFork className="w-4 h-4" />
                      <span className="text-xs">Fork</span>
                    </button>
                    <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white flex flex-col items-center gap-1">
                      <Copy className="w-4 h-4" />
                      <span className="text-xs">Copy</span>
                    </button>
                    <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white flex flex-col items-center gap-1">
                      <Link2 className="w-4 h-4" />
                      <span className="text-xs">Link</span>
                    </button>
                    <button className="p-2 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-red-500 flex flex-col items-center gap-1">
                      <Trash2 className="w-4 h-4" />
                      <span className="text-xs">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
