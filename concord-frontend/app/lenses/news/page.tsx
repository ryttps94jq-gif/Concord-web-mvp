'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Newspaper, Clock, Tag, TrendingUp, Bookmark, Share2 } from 'lucide-react';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  timestamp: string;
  imageUrl?: string;
  trending: boolean;
  bookmarked: boolean;
}

export default function NewsLensPage() {
  useLensNav('news');

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: news } = useQuery({
    queryKey: ['news', selectedCategory],
    queryFn: () =>
      api.get('/api/news', { params: { category: selectedCategory } }).then((r) => r.data),
  });

  const { data: trending } = useQuery({
    queryKey: ['news-trending'],
    queryFn: () => api.get('/api/news/trending').then((r) => r.data),
  });

  const categories = [
    { id: 'all', name: 'All' },
    { id: 'dtu', name: 'DTU Updates' },
    { id: 'growth', name: 'Growth OS' },
    { id: 'market', name: 'Market' },
    { id: 'governance', name: 'Governance' },
    { id: 'community', name: 'Community' },
  ];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📰</span>
          <div>
            <h1 className="text-xl font-bold">News Lens</h1>
            <p className="text-sm text-gray-400">
              System updates, announcements, and trends
            </p>
          </div>
        </div>
      </header>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              selectedCategory === category.id
                ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                : 'bg-lattice-surface text-gray-400 hover:text-white'
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main News Feed */}
        <div className="lg:col-span-2 space-y-4">
          {news?.articles?.length === 0 ? (
            <div className="panel p-8 text-center text-gray-500">
              <Newspaper className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No news articles yet</p>
            </div>
          ) : (
            news?.articles?.map((article: NewsArticle) => (
              <article key={article.id} className="lens-card hover:glow-blue cursor-pointer">
                <div className="flex gap-4">
                  {article.imageUrl && (
                    <div className="w-24 h-24 rounded-lg bg-lattice-elevated flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold line-clamp-2">{article.title}</h3>
                      {article.trending && (
                        <TrendingUp className="w-4 h-4 text-neon-pink flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                      {article.summary}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(article.timestamp).toLocaleDateString()}
                        </span>
                        <span>{article.source}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="text-gray-400 hover:text-neon-blue">
                          <Bookmark className="w-4 h-4" />
                        </button>
                        <button className="text-gray-400 hover:text-neon-purple">
                          <Share2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Trending Topics */}
          <div className="panel p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-neon-pink" />
              Trending Topics
            </h3>
            <div className="space-y-2">
              {trending?.topics?.map((topic: Record<string, unknown>, index: number) => (
                <div
                  key={topic.id as string}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-lattice-elevated cursor-pointer"
                >
                  <span className="text-gray-500 text-sm w-6">{index + 1}</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{topic.name as string}</p>
                    <p className="text-xs text-gray-500">{topic.count as number} mentions</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="panel p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4 text-neon-blue" />
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Articles Today</span>
                <span className="font-mono">{news?.stats?.today || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active Sources</span>
                <span className="font-mono">{news?.stats?.sources || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Your Bookmarks</span>
                <span className="font-mono">{news?.stats?.bookmarks || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
