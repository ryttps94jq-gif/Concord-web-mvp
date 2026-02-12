'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useLensData } from '@/lib/hooks/use-lens-data';
import { useState } from 'react';
import { FileText, Plus, Search, Calendar, FlaskConical, CheckCircle, AlertTriangle } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';
import { useMutation } from '@tanstack/react-query';
import { apiHelpers } from '@/lib/api/client';

export default function PaperLensPage() {
  useLensNav('paper');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { isError: isError, error: error, refetch: refetch, items: paperItems, create: createPaperArtifact } = useLensData('paper', 'project', {
    search: searchQuery || undefined,
    tags: selectedTag ? [selectedTag] : undefined,
  });

  // Derive papers and tags from lens data
  const papers = paperItems.map(item => ({
    id: item.id,
    title: item.title,
    excerpt: (item.data as Record<string, unknown>)?.excerpt as string || '',
    wordCount: (item.data as Record<string, unknown>)?.wordCount as number || 0,
    tags: item.meta?.tags || [],
    updatedAt: item.updatedAt,
  }));

  const allTags = Array.from(new Set(paperItems.flatMap(item => item.meta?.tags || [])));

  // v5.5.0: Empirical validation for paper claims
  const [validationResults, setValidationResults] = useState<Record<string, { passRate: number; issueCount: number; claimsChecked: number }>>({});
  const validateMutation = useMutation({
    mutationFn: async (artifact: { id: string; title: string; data: Record<string, unknown> }) => {
      const res = await apiHelpers.bridge.lensValidate(artifact);
      return { id: artifact.id, result: res.data };
    },
    onSuccess: (data) => {
      if (data.result?.ok) {
        setValidationResults(prev => ({
          ...prev,
          [data.id]: {
            passRate: data.result.passRate ?? 1,
            issueCount: data.result.issueCount ?? 0,
            claimsChecked: data.result.claimsChecked ?? 0,
          },
        }));
      }
    },
  });

  const handleValidatePaper = (item: { id: string; title: string; data: Record<string, unknown> }) => {
    validateMutation.mutate({ id: item.id, title: item.title, data: item.data as Record<string, unknown> });
  };

  const handleCreatePaper = () => {
    createPaperArtifact({ title: 'Untitled Paper', data: { wordCount: 0, excerpt: '' }, meta: { tags: [] } });
  };


  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
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
          onClick={handleCreatePaper}
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
          {allTags.map((tag: string) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      {/* Papers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {papers.length === 0 ? (
          <p className="col-span-full text-center py-12 text-gray-500">
            No papers found. Create your first paper!
          </p>
        ) : (
          papers.map((paper) => (
            <div key={paper.id} className="lens-card hover:glow-purple cursor-pointer">
              <div className="flex items-start justify-between mb-3">
                <FileText className="w-8 h-8 text-neon-purple" />
                <span className="text-xs text-gray-400">
                  {paper.wordCount || 0} words
                </span>
              </div>
              <h3 className="font-semibold mb-2 line-clamp-2">{paper.title}</h3>
              <p className="text-sm text-gray-400 line-clamp-3 mb-3">
                {paper.excerpt || 'No content yet...'}
              </p>
              {/* Empirical validation results */}
              {validationResults[paper.id] && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md mb-2 ${
                  validationResults[paper.id].passRate >= 0.8 ? 'bg-neon-green/10' : 'bg-neon-orange/10'
                }`}>
                  {validationResults[paper.id].passRate >= 0.8
                    ? <CheckCircle className="w-3 h-3 text-neon-green" />
                    : <AlertTriangle className="w-3 h-3 text-neon-orange" />
                  }
                  <span className="text-[10px] text-gray-300">
                    {Math.round(validationResults[paper.id].passRate * 100)}% pass
                    ({validationResults[paper.id].claimsChecked} claims, {validationResults[paper.id].issueCount} issues)
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {paper.tags?.slice(0, 3).map((tag: string) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 rounded bg-neon-purple/20 text-neon-purple"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const item = paperItems.find(p => p.id === paper.id);
                      if (item) handleValidatePaper({ id: item.id, title: item.title, data: item.data as Record<string, unknown> });
                    }}
                    className="text-xs px-2 py-0.5 rounded bg-neon-green/10 text-neon-green hover:bg-neon-green/20 transition-colors flex items-center gap-1"
                    title="Validate claims with empirical gates"
                  >
                    <FlaskConical className="w-3 h-3" />
                    Validate
                  </button>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(paper.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
