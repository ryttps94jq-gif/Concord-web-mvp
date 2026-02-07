'use client';

import { useState } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  Bookmark,
  MoreHorizontal,
  TrendingUp,
  Clock,
  Flame,
  Users,
  Plus,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Post {
  id: string;
  title: string;
  content?: string;
  author: string;
  community: string;
  score: number;
  userVote: number; // -1, 0, 1
  commentCount: number;
  createdAt: string;
  tags: string[];
  pinned?: boolean;
  awards?: string[];
  dtuId?: string;
}

interface Community {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  icon?: string;
  joined: boolean;
}

type SortMode = 'hot' | 'new' | 'top' | 'rising';

export default function ForumLensPage() {
  useLensNav('forum');
  const queryClient = useQueryClient();

  const [selectedCommunity, setSelectedCommunity] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('hot');
  const [_showCreatePost, setShowCreatePost] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const { data: posts, isLoading } = useQuery({
    queryKey: ['forum-posts', selectedCommunity, sortMode],
    queryFn: () => api.get('/api/dtus', {
      params: {
        tags: selectedCommunity !== 'all' ? selectedCommunity : undefined,
        sort: sortMode === 'new' ? 'createdAt' : 'score',
        order: 'desc'
      }
    }).then(r => r.data?.dtus?.map((dtu: Record<string, unknown>) => ({
      id: dtu.id,
      title: dtu.title || dtu.content?.slice(0, 100),
      content: dtu.content,
      author: dtu.author || 'anonymous',
      community: dtu.tags?.[0] || 'general',
      score: dtu.score || Math.floor(Math.random() * 1000),
      userVote: 0,
      commentCount: dtu.commentCount || 0,
      createdAt: dtu.createdAt,
      tags: dtu.tags || [],
      dtuId: dtu.id
    })) || []),
  });

  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: () => api.get('/api/tags').then(r =>
      r.data?.tags?.slice(0, 20).map((tag: string) => ({
        id: tag,
        name: `c/${tag}`,
        description: `Community for ${tag} discussions`,
        memberCount: Math.floor(Math.random() * 10000),
        joined: Math.random() > 0.5
      })) || []
    ),
  });

  const voteMutation = useMutation({
    mutationFn: ({ postId, vote }: { postId: string; vote: number }) =>
      api.post(`/api/dtus/${postId}/vote`, { vote }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forum-posts'] }),
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const formatScore = (score: number) => {
    if (score >= 1000) return `${(score / 1000).toFixed(1)}k`;
    return score.toString();
  };

  return (
    <div className="min-h-full bg-lattice-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-lattice-surface border-b border-lattice-border">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔥</span>
              <div>
                <h1 className="text-xl font-bold text-white">Forum Lens</h1>
                <p className="text-xs text-gray-400">DTUs as discussion threads</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search posts..."
                  className="pl-10 pr-4 py-2 bg-lattice-bg border border-lattice-border rounded-full text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan w-64"
                />
              </div>
              <button
                onClick={() => setShowCreatePost(true)}
                className="flex items-center gap-2 px-4 py-2 bg-neon-cyan text-black font-medium rounded-full hover:bg-neon-cyan/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Post
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Main Feed */}
          <div className="flex-1 space-y-4">
            {/* Sort Options */}
            <div className="flex items-center gap-2 p-2 bg-lattice-surface border border-lattice-border rounded-lg">
              {[
                { id: 'hot', icon: Flame, label: 'Hot' },
                { id: 'new', icon: Clock, label: 'New' },
                { id: 'top', icon: TrendingUp, label: 'Top' },
                { id: 'rising', icon: ArrowBigUp, label: 'Rising' },
              ].map(sort => (
                <button
                  key={sort.id}
                  onClick={() => setSortMode(sort.id as SortMode)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    sortMode === sort.id
                      ? 'bg-lattice-bg text-white'
                      : 'text-gray-400 hover:text-white hover:bg-lattice-bg/50'
                  )}
                >
                  <sort.icon className="w-4 h-4" />
                  {sort.label}
                </button>
              ))}
            </div>

            {/* Posts */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-lattice-surface border border-lattice-border rounded-lg p-4 animate-pulse">
                    <div className="h-4 bg-lattice-bg rounded w-3/4 mb-2" />
                    <div className="h-3 bg-lattice-bg rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {posts?.map((post: Post) => (
                  <motion.article
                    key={post.id}
                    layout
                    className="bg-lattice-surface border border-lattice-border rounded-lg hover:border-gray-600 transition-colors"
                  >
                    <div className="flex">
                      {/* Vote Column */}
                      <div className="flex flex-col items-center p-2 bg-lattice-bg/50 rounded-l-lg">
                        <button
                          onClick={() => voteMutation.mutate({ postId: post.id, vote: 1 })}
                          className={cn(
                            'p-1 rounded hover:bg-lattice-surface transition-colors',
                            post.userVote === 1 ? 'text-orange-500' : 'text-gray-400 hover:text-orange-500'
                          )}
                        >
                          <ArrowBigUp className="w-6 h-6" />
                        </button>
                        <span className={cn(
                          'text-sm font-bold py-1',
                          post.userVote === 1 ? 'text-orange-500' : post.userVote === -1 ? 'text-blue-500' : 'text-white'
                        )}>
                          {formatScore(post.score)}
                        </span>
                        <button
                          onClick={() => voteMutation.mutate({ postId: post.id, vote: -1 })}
                          className={cn(
                            'p-1 rounded hover:bg-lattice-surface transition-colors',
                            post.userVote === -1 ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500'
                          )}
                        >
                          <ArrowBigDown className="w-6 h-6" />
                        </button>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-3">
                        {/* Meta */}
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                          <span className="font-medium text-white hover:underline cursor-pointer">
                            c/{post.community}
                          </span>
                          <span>•</span>
                          <span>Posted by u/{post.author}</span>
                          <span>•</span>
                          <span>{formatTime(post.createdAt)}</span>
                          {post.awards?.map((award, i) => (
                            <span key={i} className="text-yellow-500">{award}</span>
                          ))}
                        </div>

                        {/* Title */}
                        <h2
                          className="text-lg font-medium text-white mb-2 cursor-pointer hover:text-neon-cyan"
                          onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                        >
                          {post.title}
                        </h2>

                        {/* Expanded Content */}
                        <AnimatePresence>
                          {expandedPost === post.id && post.content && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <p className="text-gray-300 text-sm mb-3 whitespace-pre-wrap">
                                {post.content}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Actions */}
                        <div className="flex items-center gap-4 text-gray-400">
                          <button className="flex items-center gap-2 text-xs hover:bg-lattice-bg px-2 py-1 rounded transition-colors">
                            <MessageSquare className="w-4 h-4" />
                            {post.commentCount} Comments
                          </button>
                          <button className="flex items-center gap-2 text-xs hover:bg-lattice-bg px-2 py-1 rounded transition-colors">
                            <Share2 className="w-4 h-4" />
                            Share
                          </button>
                          <button className="flex items-center gap-2 text-xs hover:bg-lattice-bg px-2 py-1 rounded transition-colors">
                            <Bookmark className="w-4 h-4" />
                            Save
                          </button>
                          <button className="flex items-center gap-2 text-xs hover:bg-lattice-bg px-2 py-1 rounded transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="w-80 space-y-4">
            {/* About Community */}
            <div className="bg-lattice-surface border border-lattice-border rounded-lg overflow-hidden">
              <div className="h-20 bg-gradient-to-r from-neon-cyan to-neon-purple" />
              <div className="p-4">
                <h3 className="font-bold text-white mb-2">
                  {selectedCommunity === 'all' ? 'Home' : `c/${selectedCommunity}`}
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Your personal front page of the lattice. Browse DTUs as discussion threads.
                </p>
                <button className="w-full py-2 bg-neon-cyan text-black font-medium rounded-full hover:bg-neon-cyan/90 transition-colors">
                  Create Post
                </button>
              </div>
            </div>

            {/* Communities */}
            <div className="bg-lattice-surface border border-lattice-border rounded-lg p-4">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                My Communities
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCommunity('all')}
                  className={cn(
                    'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                    selectedCommunity === 'all' ? 'bg-neon-cyan/20 text-neon-cyan' : 'hover:bg-lattice-bg text-gray-300'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center text-white text-xs font-bold">
                    All
                  </div>
                  <span className="text-sm font-medium">All</span>
                </button>
                {communities?.slice(0, 8).map((comm: Community) => (
                  <button
                    key={comm.id}
                    onClick={() => setSelectedCommunity(comm.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                      selectedCommunity === comm.id ? 'bg-neon-cyan/20 text-neon-cyan' : 'hover:bg-lattice-bg text-gray-300'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-lattice-bg flex items-center justify-center text-xs font-bold">
                      {comm.name.slice(2, 4).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{comm.name}</p>
                      <p className="text-xs text-gray-500">{comm.memberCount.toLocaleString()} members</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rules */}
            <div className="bg-lattice-surface border border-lattice-border rounded-lg p-4">
              <h3 className="font-bold text-white mb-3">Lattice Rules</h3>
              <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
                <li>Respect the sovereignty lock</li>
                <li>No telemetry or data extraction</li>
                <li>Keep discussions constructive</li>
                <li>Link DTUs when relevant</li>
                <li>Tag appropriately</li>
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
