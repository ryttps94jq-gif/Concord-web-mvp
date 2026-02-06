'use client';

import { useState } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  Bookmark,
  MoreHorizontal,
  Image as ImageIcon,
  Smile,
  MapPin,
  Calendar,
  BarChart3,
  Verified,
  Home,
  Search,
  Bell,
  Mail,
  User,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedPost {
  id: string;
  author: {
    id: string;
    name: string;
    handle: string;
    avatar?: string;
    verified?: boolean;
  };
  content: string;
  createdAt: string;
  likes: number;
  reposts: number;
  replies: number;
  views: number;
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
  images?: string[];
  replyTo?: string;
  dtuId?: string;
}

interface TrendingTopic {
  id: string;
  category: string;
  topic: string;
  posts: number;
}

export default function FeedLensPage() {
  useLensNav('feed');
  const queryClient = useQueryClient();

  const [newPost, setNewPost] = useState('');
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');

  const { data: feedPosts, isLoading } = useQuery({
    queryKey: ['feed-posts', activeTab],
    queryFn: () => api.get('/api/dtus', { params: { limit: 50 } }).then(r =>
      r.data?.dtus?.map((dtu: any) => ({
        id: dtu.id,
        author: {
          id: dtu.authorId || 'user',
          name: dtu.authorName || 'Concord User',
          handle: dtu.authorHandle || 'user',
          verified: Math.random() > 0.7
        },
        content: dtu.content?.slice(0, 280) || dtu.title,
        createdAt: dtu.createdAt,
        likes: Math.floor(Math.random() * 1000),
        reposts: Math.floor(Math.random() * 500),
        replies: Math.floor(Math.random() * 100),
        views: Math.floor(Math.random() * 10000),
        liked: false,
        reposted: false,
        bookmarked: false,
        dtuId: dtu.id
      })) || []
    ),
  });

  const { data: trending } = useQuery({
    queryKey: ['trending'],
    queryFn: () => api.get('/api/tags').then(r =>
      r.data?.tags?.slice(0, 5).map((tag: string, i: number) => ({
        id: tag,
        category: 'Trending in Lattice',
        topic: `#${tag}`,
        posts: Math.floor(Math.random() * 50000)
      })) || []
    ),
  });

  const postMutation = useMutation({
    mutationFn: (content: string) => api.post('/api/dtus', { content, tags: ['post'] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
      setNewPost('');
    },
  });

  const likeMutation = useMutation({
    mutationFn: (postId: string) => api.post(`/api/dtus/${postId}/like`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed-posts'] }),
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.floor(diff / 60000)}m`;
    if (hours < 24) return `${hours}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="min-h-full bg-black flex">
      {/* Left Sidebar */}
      <aside className="w-20 xl:w-64 border-r border-gray-800 p-2 xl:p-4 flex flex-col items-center xl:items-start">
        <div className="text-3xl mb-6 p-3">📡</div>

        {[
          { icon: Home, label: 'Home', active: true },
          { icon: Search, label: 'Explore' },
          { icon: Bell, label: 'Notifications' },
          { icon: Mail, label: 'Messages' },
          { icon: Bookmark, label: 'Bookmarks' },
          { icon: User, label: 'Profile' },
        ].map(item => (
          <button
            key={item.label}
            className={cn(
              'flex items-center gap-4 p-3 rounded-full transition-colors w-full xl:w-auto',
              item.active ? 'font-bold' : 'text-gray-400 hover:bg-gray-900'
            )}
          >
            <item.icon className="w-6 h-6" />
            <span className="hidden xl:inline text-lg">{item.label}</span>
          </button>
        ))}

        <button className="mt-4 w-12 h-12 xl:w-full xl:h-auto xl:py-3 bg-neon-cyan text-black font-bold rounded-full hover:bg-neon-cyan/90 transition-colors">
          <span className="hidden xl:inline">Post</span>
          <span className="xl:hidden text-xl">+</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-xl border-r border-gray-800">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-xl font-bold text-white">Home</h1>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex">
            {['for-you', 'following'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  'flex-1 py-4 text-sm font-medium transition-colors relative',
                  activeTab === tab ? 'text-white' : 'text-gray-500 hover:bg-gray-900'
                )}
              >
                {tab === 'for-you' ? 'For you' : 'Following'}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-neon-cyan rounded-full" />
                )}
              </button>
            ))}
          </div>
        </header>

        {/* Compose */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex-shrink-0" />
            <div className="flex-1">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full bg-transparent text-xl text-white placeholder-gray-600 resize-none focus:outline-none"
                rows={2}
              />
              <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                <div className="flex items-center gap-1 text-neon-cyan">
                  <button className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors">
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors">
                    <BarChart3 className="w-5 h-5" />
                  </button>
                  <button className="p-2 rounded-full hover:bg-neon-cyan/10 transition-colors">
                    <MapPin className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={() => postMutation.mutate(newPost)}
                  disabled={!newPost.trim() || postMutation.isPending}
                  className="px-4 py-1.5 bg-neon-cyan text-black font-bold rounded-full hover:bg-neon-cyan/90 disabled:opacity-50 transition-colors"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div>
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-800 rounded w-1/4" />
                    <div className="h-4 bg-gray-800 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            feedPosts?.map((post: FeedPost) => (
              <article
                key={post.id}
                className="p-4 border-b border-gray-800 hover:bg-gray-900/50 transition-colors cursor-pointer"
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-1 text-sm">
                      <span className="font-bold text-white hover:underline">
                        {post.author.name}
                      </span>
                      {post.author.verified && (
                        <Verified className="w-4 h-4 text-neon-cyan fill-neon-cyan" />
                      )}
                      <span className="text-gray-500">@{post.author.handle}</span>
                      <span className="text-gray-500">·</span>
                      <span className="text-gray-500 hover:underline">
                        {formatTime(post.createdAt)}
                      </span>
                      <button className="ml-auto p-1 text-gray-500 hover:text-neon-cyan hover:bg-neon-cyan/10 rounded-full">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content */}
                    <p className="text-white mt-1 whitespace-pre-wrap">{post.content}</p>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-3 max-w-md text-gray-500">
                      <button className="flex items-center gap-2 group">
                        <div className="p-2 rounded-full group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        <span className="text-sm group-hover:text-blue-500">{formatNumber(post.replies)}</span>
                      </button>
                      <button className={cn(
                        'flex items-center gap-2 group',
                        post.reposted && 'text-green-500'
                      )}>
                        <div className="p-2 rounded-full group-hover:bg-green-500/10 group-hover:text-green-500 transition-colors">
                          <Repeat2 className="w-4 h-4" />
                        </div>
                        <span className="text-sm group-hover:text-green-500">{formatNumber(post.reposts)}</span>
                      </button>
                      <button
                        onClick={() => likeMutation.mutate(post.id)}
                        className={cn(
                          'flex items-center gap-2 group',
                          post.liked && 'text-pink-500'
                        )}
                      >
                        <div className="p-2 rounded-full group-hover:bg-pink-500/10 group-hover:text-pink-500 transition-colors">
                          <Heart className={cn('w-4 h-4', post.liked && 'fill-current')} />
                        </div>
                        <span className="text-sm group-hover:text-pink-500">{formatNumber(post.likes)}</span>
                      </button>
                      <button className="flex items-center gap-2 group">
                        <div className="p-2 rounded-full group-hover:bg-neon-cyan/10 group-hover:text-neon-cyan transition-colors">
                          <BarChart3 className="w-4 h-4" />
                        </div>
                        <span className="text-sm group-hover:text-neon-cyan">{formatNumber(post.views)}</span>
                      </button>
                      <div className="flex items-center">
                        <button className="p-2 rounded-full hover:bg-neon-cyan/10 hover:text-neon-cyan transition-colors">
                          <Bookmark className={cn('w-4 h-4', post.bookmarked && 'fill-current text-neon-cyan')} />
                        </button>
                        <button className="p-2 rounded-full hover:bg-neon-cyan/10 hover:text-neon-cyan transition-colors">
                          <Share className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className="w-80 p-4 hidden lg:block">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search"
            className="w-full pl-12 pr-4 py-3 bg-gray-900 border border-transparent rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
          />
        </div>

        {/* Trending */}
        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          <h2 className="text-xl font-bold text-white p-4">Trends for you</h2>
          {trending?.map((trend: TrendingTopic) => (
            <button
              key={trend.id}
              className="w-full p-4 hover:bg-gray-800 transition-colors text-left"
            >
              <p className="text-xs text-gray-500">{trend.category}</p>
              <p className="font-bold text-white">{trend.topic}</p>
              <p className="text-xs text-gray-500">{formatNumber(trend.posts)} posts</p>
            </button>
          ))}
          <button className="w-full p-4 text-neon-cyan hover:bg-gray-800 transition-colors text-left">
            Show more
          </button>
        </div>

        {/* Who to follow */}
        <div className="bg-gray-900 rounded-2xl overflow-hidden mt-4">
          <h2 className="text-xl font-bold text-white p-4">Who to follow</h2>
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 hover:bg-gray-800 transition-colors flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">Lattice User {i}</p>
                <p className="text-gray-500 text-sm truncate">@user{i}</p>
              </div>
              <button className="px-4 py-1.5 bg-white text-black font-bold rounded-full text-sm hover:bg-gray-200 transition-colors">
                Follow
              </button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
