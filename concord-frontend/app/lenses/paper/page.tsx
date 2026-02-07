'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { FileText, Plus, Search, Calendar } from 'lucide-react';

export default function PaperLensPage() {
  useLensNav('paper');

  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data: papers } = useQuery({
    queryKey: ['papers', searchQuery, selectedTag],
    queryFn: () =>
      api
        .get('/api/papers', { params: { q: searchQuery, tag: selectedTag } })
        .then((r) => r.data),
  });

  const { data: tags } = useQuery({
    queryKey: ['paper-tags'],
    queryFn: () => api.get('/api/papers/tags').then((r) => r.data),
  });

  const createPaper = useMutation({
    mutationFn: (title: string) => api.post('/api/papers', { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['papers'] });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📄</span>
          <div>
            <h1 className="text-xl font-bold">Paper Lens</h1>
            <p className="text-sm text-gray-400">
              Research papers and knowledge artifacts
            </p>
          </div>
        </div>
        <button
          onClick={() => createPaper.mutate('Untitled Paper')}
          className="btn-neon purple"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          New Paper
        </button>
      </header>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search papers..."
            className="input-lattice pl-10"
          />
        </div>
        <select
          value={selectedTag || ''}
          onChange={(e) => setSelectedTag(e.target.value || null)}
          className="input-lattice w-auto"
        >
          <option value="">All Tags</option>
          {tags?.tags?.map((tag: string) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      {/* Papers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {papers?.papers?.length === 0 ? (
          <p className="col-span-full text-center py-12 text-gray-500">
            No papers found. Create your first paper!
          </p>
        ) : (
          papers?.papers?.map((paper: Record<string, unknown>) => (
            <div key={paper.id as string} className="lens-card hover:glow-purple cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <FileText className="w-8 h-8 text-neon-purple" />
                <span className="text-xs text-gray-400">
                  {(paper.wordCount as number) || 0} words
                </span>
              </div>
              <h3 className="font-semibold mb-2 line-clamp-2">{paper.title as string}</h3>
              <p className="text-sm text-gray-400 line-clamp-3 mb-3">
                {(paper.excerpt as string) || 'No content yet...'}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {(paper.tags as string[])?.slice(0, 3).map((tag: string) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded bg-neon-purple/20 text-neon-purple"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(paper.updatedAt as string).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
