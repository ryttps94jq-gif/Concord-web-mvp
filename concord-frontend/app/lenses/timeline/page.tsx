'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ThumbsUp,
  Heart,
  Laugh,
  Frown,
  Angry,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Image as ImageIcon,
  Video,
  Smile,
  Users,
  Globe,
  Lock,
  Clock,
  Home,
  Tv,
  Store,
  Users2,
  Bookmark,
  CalendarDays,
  Flag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorState } from '@/components/common/EmptyState';

interface Post {
  id: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  images?: string[];
  createdAt: string;
  privacy: 'public' | 'friends' | 'private';
  reactions: {
    like: number;
    love: number;
    haha: number;
    sad: number;
    angry: number;
  };
  userReaction?: string;
  comments: number;
  shares: number;
  dtuId?: string;
}

interface Friend {
  id: string;
  name: string;
  avatar?: string;
  mutualFriends: number;
  online: boolean;
}

interface Story {
  id: string;
  author: {
    name: string;
    avatar?: string;
  };
  preview?: string;
  viewed: boolean;
}

const REACTIONS = [
  { id: 'like', icon: ThumbsUp, color: 'text-blue-500', label: 'Like' },
  { id: 'love', icon: Heart, color: 'text-red-500', label: 'Love' },
  { id: 'haha', icon: Laugh, color: 'text-yellow-500', label: 'Haha' },
  { id: 'sad', icon: Frown, color: 'text-yellow-500', label: 'Sad' },
  { id: 'angry', icon: Angry, color: 'text-orange-500', label: 'Angry' },
];

export default function TimelineLensPage() {
  useLensNav('timeline');
  const queryClient = useQueryClient();

  const [_newPost, setNewPost] = useState('');
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);

  const { data: postsData, isLoading, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['timeline-posts', limit],
    queryFn: () => api.get('/api/dtus/paginated', { params: { limit, offset: 0, tags: 'timeline' } }).then(r => r.data),
  });

  const posts =
    postsData?.items?.map((dtu: Record<string, unknown>) => ({
        id: dtu.id,
        author: {
          id: dtu.authorId || 'user',
          name: dtu.authorName || 'Concord User',
        },
        content: dtu.content || dtu.title,
        createdAt: dtu.createdAt,
        privacy: 'public',
        reactions: {
          like: Math.floor(Math.random() * 100),
          love: Math.floor(Math.random() * 50),
          haha: Math.floor(Math.random() * 20),
          sad: Math.floor(Math.random() * 10),
          angry: Math.floor(Math.random() * 5),
        },
        comments: Math.floor(Math.random() * 50),
        shares: Math.floor(Math.random() * 20),
        dtuId: dtu.id
      })) || [];


  const { data: friends, isError: isError2, error: error2, refetch: refetch2,} = useQuery({
    queryKey: ['friends'],
    queryFn: () => Promise.resolve([
      { id: '1', name: 'Alice Chen', mutualFriends: 12, online: true },
      { id: '2', name: 'Bob Smith', mutualFriends: 8, online: true },
      { id: '3', name: 'Carol Davis', mutualFriends: 5, online: false },
      { id: '4', name: 'David Lee', mutualFriends: 15, online: true },
      { id: '5', name: 'Eve Wilson', mutualFriends: 3, online: false },
    ] as Friend[]),
  });

  const { data: stories, isError: isError3, error: error3, refetch: refetch3,} = useQuery({
    queryKey: ['stories'],
    queryFn: () => Promise.resolve([
      { id: '1', author: { name: 'Your Story' }, viewed: false },
      { id: '2', author: { name: 'Alice' }, viewed: false },
      { id: '3', author: { name: 'Bob' }, viewed: true },
      { id: '4', author: { name: 'Carol' }, viewed: false },
      { id: '5', author: { name: 'David' }, viewed: true },
    ] as Story[]),
  });

  const _postMutation = useMutation({
    mutationFn: (content: string) => api.post('/api/dtus', { content, tags: ['timeline'] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-posts'] });
      setNewPost('');
    },
  });

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const getTotalReactions = (reactions: Post['reactions']) => {
    return Object.values(reactions).reduce((a, b) => a + b, 0);
  };

  const getTopReactions = (reactions: Post['reactions']) => {
    return Object.entries(reactions)
      .filter(([_, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([type]) => REACTIONS.find(r => r.id === type));
  };


  if (isError || isError2 || isError3) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message || error2?.message || error3?.message} onRetry={() => { refetch(); refetch2(); refetch3(); }} />
      </div>
    );
  }
  return (
    <div className="min-h-full bg-[#18191a]">
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="bg-[#242526] rounded-lg p-3 flex items-center justify-between text-sm">
          <span className="text-gray-300">Timeline defaults to 30 posts for speed.</span>
          <Link href="/lenses/global" className="text-blue-400 hover:text-blue-300">View all in Global</Link>
        </div>
      </div>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#242526] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl">📅</span>
            <span className="text-2xl font-bold text-blue-500">Timeline Lens</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 bg-[#3a3b3c] rounded-full hover:bg-[#4a4b4c] transition-colors">
              <Home className="w-5 h-5 text-white" />
            </button>
            <button className="p-2 bg-[#3a3b3c] rounded-full hover:bg-[#4a4b4c] transition-colors">
              <Tv className="w-5 h-5 text-gray-400" />
            </button>
            <button className="p-2 bg-[#3a3b3c] rounded-full hover:bg-[#4a4b4c] transition-colors">
              <Store className="w-5 h-5 text-gray-400" />
            </button>
            <button className="p-2 bg-[#3a3b3c] rounded-full hover:bg-[#4a4b4c] transition-colors">
              <Users2 className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 flex gap-4">
        {/* Left Sidebar */}
        <aside className="w-64 hidden lg:block space-y-1">
          {[
            { icon: Users, label: 'Friends' },
            { icon: Users2, label: 'Groups' },
            { icon: Tv, label: 'Watch' },
            { icon: Clock, label: 'Memories' },
            { icon: Bookmark, label: 'Saved' },
            { icon: CalendarDays, label: 'Events' },
            { icon: Flag, label: 'Pages' },
          ].map(item => (
            <button
              key={item.label}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#3a3b3c] transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-[#3a3b3c] flex items-center justify-center">
                <item.icon className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-white text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Main Feed */}
        <main className="flex-1 max-w-xl mx-auto space-y-4">
          {/* Stories */}
          <div className="bg-[#242526] rounded-lg p-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {stories?.map((story, i) => (
                <button
                  key={story.id}
                  className={cn(
                    'flex-shrink-0 w-28 h-48 rounded-xl overflow-hidden relative',
                    i === 0 ? 'bg-[#3a3b3c]' : 'bg-gradient-to-br from-blue-500 to-purple-500'
                  )}
                >
                  {i === 0 ? (
                    <div className="h-full flex flex-col items-center justify-end pb-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center border-4 border-[#242526] -mt-5">
                        <span className="text-white text-2xl">+</span>
                      </div>
                      <span className="text-white text-xs mt-2">Create story</span>
                    </div>
                  ) : (
                    <>
                      <div className={cn(
                        'absolute top-2 left-2 w-10 h-10 rounded-full border-4',
                        story.viewed ? 'border-gray-600' : 'border-blue-500'
                      )}>
                        <div className="w-full h-full rounded-full bg-gray-700" />
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <span className="text-white text-xs font-medium">{story.author.name}</span>
                      </div>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Create Post */}
          <div className="bg-[#242526] rounded-lg p-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex-shrink-0" />
              <button
                className="flex-1 px-4 py-2.5 bg-[#3a3b3c] rounded-full text-left text-gray-400 hover:bg-[#4a4b4c] transition-colors"
                onClick={() => {}}
              >
                What's on your mind?
              </button>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                <Video className="w-5 h-5 text-red-500" />
                <span className="text-gray-300 text-sm">Live video</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                <ImageIcon className="w-5 h-5 text-green-500" />
                <span className="text-gray-300 text-sm">Photo/video</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                <Smile className="w-5 h-5 text-yellow-500" />
                <span className="text-gray-300 text-sm">Feeling</span>
              </button>
            </div>
          </div>

          {/* Posts */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#242526] rounded-lg p-4 animate-pulse">
                  <div className="flex gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#3a3b3c]" />
                    <div className="space-y-2">
                      <div className="h-4 bg-[#3a3b3c] rounded w-32" />
                      <div className="h-3 bg-[#3a3b3c] rounded w-20" />
                    </div>
                  </div>
                  <div className="h-20 bg-[#3a3b3c] rounded" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="bg-[#242526] rounded-lg p-3 flex items-center justify-between text-xs text-gray-400">
                <span>Showing {posts.length} of {postsData?.total || posts.length} timeline DTUs</span>
                <button
                  className="px-3 py-1.5 rounded bg-[#3a3b3c] text-white disabled:opacity-50"
                  disabled={posts.length >= Number(postsData?.total || 0)}
                  onClick={() => setLimit((v) => v + 30)}
                >
                  Load more
                </button>
              </div>
            {posts?.map((post: Post) => (
              <article key={post.id} className="bg-[#242526] rounded-lg">
                {/* Post Header */}
                <div className="p-4 pb-0">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                      <div>
                        <h3 className="font-semibold text-white hover:underline cursor-pointer">
                          {post.author.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <span>{formatTime(post.createdAt)}</span>
                          <span>·</span>
                          {post.privacy === 'public' ? (
                            <Globe className="w-3 h-3" />
                          ) : post.privacy === 'friends' ? (
                            <Users className="w-3 h-3" />
                          ) : (
                            <Lock className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    </div>
                    <button className="p-2 rounded-full hover:bg-[#3a3b3c] transition-colors">
                      <MoreHorizontal className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Post Content */}
                <div className="px-4 py-3">
                  <p className="text-white whitespace-pre-wrap">{post.content}</p>
                </div>

                {/* Reactions Bar */}
                <div className="px-4 py-2 flex items-center justify-between text-gray-400 text-sm border-b border-gray-700">
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-1">
                      {getTopReactions(post.reactions).map(reaction => reaction && (
                        <div
                          key={reaction.id}
                          className={cn('w-5 h-5 rounded-full bg-[#3a3b3c] flex items-center justify-center', reaction.color)}
                        >
                          <reaction.icon className="w-3 h-3" />
                        </div>
                      ))}
                    </div>
                    <span className="ml-1">{getTotalReactions(post.reactions)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>{post.comments} comments</span>
                    <span>{post.shares} shares</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-4 py-1 flex items-center">
                  <div
                    className="relative flex-1"
                    onMouseEnter={() => setShowReactions(post.id)}
                    onMouseLeave={() => setShowReactions(null)}
                  >
                    <button className="w-full flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                      <ThumbsUp className="w-5 h-5 text-gray-400" />
                      <span className="text-gray-400 font-medium">Like</span>
                    </button>

                    {/* Reactions Popup */}
                    <AnimatePresence>
                      {showReactions === post.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.9 }}
                          className="absolute bottom-full left-0 mb-2 flex gap-1 p-2 bg-[#242526] rounded-full shadow-xl border border-gray-700"
                        >
                          {REACTIONS.map(reaction => (
                            <button
                              key={reaction.id}
                              className="p-2 rounded-full hover:bg-[#3a3b3c] hover:scale-125 transition-all"
                              title={reaction.label}
                            >
                              <reaction.icon className={cn('w-6 h-6', reaction.color)} />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                    <MessageCircle className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-400 font-medium">Comment</span>
                  </button>

                  <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-[#3a3b3c] transition-colors">
                    <Share2 className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-400 font-medium">Share</span>
                  </button>
                </div>

                {/* Comment Input */}
                <div className="px-4 py-3 flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex-shrink-0" />
                  <div className="flex-1 flex items-center bg-[#3a3b3c] rounded-full px-4">
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      className="flex-1 py-2 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
                    />
                    <div className="flex items-center gap-1">
                      <button className="p-1 text-gray-400 hover:text-gray-300">
                        <Smile className="w-5 h-5" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-gray-300">
                        <ImageIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            </>
          )}
        </main>

        {/* Right Sidebar */}
        <aside className="w-72 hidden xl:block space-y-4">
          {/* Friend Requests */}
          <div className="bg-[#242526] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Friend Requests</h3>
              <button className="text-blue-500 text-sm hover:underline">See all</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-500" />
              <div className="flex-1">
                <p className="font-medium text-white text-sm">New User</p>
                <p className="text-xs text-gray-400">5 mutual friends</p>
                <div className="flex gap-2 mt-2">
                  <button className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-md hover:bg-blue-600">
                    Confirm
                  </button>
                  <button className="px-3 py-1.5 bg-[#3a3b3c] text-white text-xs font-medium rounded-md hover:bg-[#4a4b4c]">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="bg-[#242526] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Contacts</h3>
            </div>
            <div className="space-y-1">
              {friends?.map((friend: Friend) => (
                <button
                  key={friend.id}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[#3a3b3c] transition-colors"
                >
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-500" />
                    {friend.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#242526]" />
                    )}
                  </div>
                  <span className="text-white text-sm">{friend.name}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
