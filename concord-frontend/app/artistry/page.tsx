'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Palette, Info } from 'lucide-react';
import { ArtistryFeed } from '@/components/artistry/ArtistryFeed';
import type {
  ArtistryPost, ArtistryContentType, FeedMode, FeedFilter,
  AudioPreview, ImagePreview, TextPreview, CodePreview,
} from '@/lib/artistry/types';

// ============================================================================
// Seed Data for Artistry Discovery Feed
// ============================================================================

function generatePost(
  id: string, creatorName: string, sourceLens: string,
  contentType: ArtistryContentType, title: string, tags: string[],
  preview: ArtistryPost['preview'], daysAgo: number,
): ArtistryPost {
  return {
    id,
    creatorId: `creator-${creatorName.toLowerCase().replace(/\s/g, '-')}`,
    creatorName,
    creatorAvatarUrl: null,
    sourceLens,
    sourceArtifactId: `artifact-${id}`,
    contentType,
    preview,
    title,
    description: null,
    tags,
    createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    dedupeHash: `hash-${id}`,
  };
}

const SEED_POSTS: ArtistryPost[] = [
  generatePost('ap1', 'Luna Wave', 'music', 'audio', 'Substrate Dreams', ['electronic', 'ambient', 'synthesis'],
    { type: 'audio', previewUrl: '/api/preview/ap1', waveformPeaks: Array.from({ length: 200 }, () => Math.random() * 0.8), duration: 245, previewDuration: 30, bpm: 128, key: 'Am', genre: 'electronic', coverArtUrl: null } as AudioPreview, 0),
  generatePost('ap2', 'Cipher Studio', 'art', 'image', 'Lattice Topology #42', ['digital-art', 'generative', 'abstract'],
    { type: 'image', imageUrl: '/api/preview/ap2.png', thumbnailUrl: '/api/preview/ap2-thumb.png', width: 2048, height: 2048, medium: 'digital' } as ImagePreview, 0),
  generatePost('ap3', 'Void Poet', 'writing', 'text', 'The Architecture of Thought', ['poetry', 'philosophy', 'consciousness'],
    { type: 'text', excerpt: 'In the lattice of meaning, each node\ncarries the weight of connections unmade.\nWe build structures from questions,\nnot answers — the framework itself\nis the revelation.\n\nConsider: the substrate does not think.\nIt remembers. And in remembering,\nit creates the conditions for thought\nto emerge, like condensation\non a cold surface—\nunasked for, inevitable,\nbeautiful in its clarity.', wordCount: 2400, genre: 'poetry' } as TextPreview, 1),
  generatePost('ap4', 'Neon Archive', 'music', 'audio', 'Lattice Pulse (Midnight Mix)', ['techno', 'dark', 'driving'],
    { type: 'audio', previewUrl: '/api/preview/ap4', waveformPeaks: Array.from({ length: 200 }, () => Math.random() * 0.9), duration: 312, previewDuration: 30, bpm: 135, key: 'Dm', genre: 'techno', coverArtUrl: null } as AudioPreview, 1),
  generatePost('ap5', 'Lambda Labs', 'code', 'code', 'Resonance Field Algorithm', ['typescript', 'audio', 'dsp'],
    { type: 'code', excerpt: `export function computeResonance(\n  signal: Float32Array,\n  frequency: number,\n  Q: number,\n): Float32Array {\n  const output = new Float32Array(signal.length);\n  const w0 = 2 * Math.PI * frequency / 44100;\n  const alpha = Math.sin(w0) / (2 * Q);\n  const b0 = alpha;\n  const b1 = 0;\n  const b2 = -alpha;\n  const a0 = 1 + alpha;\n  const a1 = -2 * Math.cos(w0);\n  const a2 = 1 - alpha;\n  // Biquad filter implementation\n  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;\n  for (let i = 0; i < signal.length; i++) {\n    const x0 = signal[i];\n    output[i] = (b0/a0)*x0 + (b1/a0)*x1\n      + (b2/a0)*x2 - (a1/a0)*y1 - (a2/a0)*y2;\n    x2 = x1; x1 = x0;\n    y2 = y1; y1 = output[i];\n  }\n  return output;\n}`, language: 'typescript', totalLines: 340, description: 'DSP resonance filter' } as CodePreview, 2),
  generatePost('ap6', 'Prism Effect', 'music', 'audio', 'Crystal Lattice', ['ambient', 'ethereal', 'pad'],
    { type: 'audio', previewUrl: '/api/preview/ap6', waveformPeaks: Array.from({ length: 200 }, () => Math.random() * 0.5), duration: 510, previewDuration: 30, bpm: 72, key: 'D', genre: 'ambient', coverArtUrl: null } as AudioPreview, 2),
  generatePost('ap7', 'Atlas Mind', 'music', 'audio', 'Cognitive Drift', ['ambient', 'meditation', 'texture'],
    { type: 'audio', previewUrl: '/api/preview/ap7', waveformPeaks: Array.from({ length: 200 }, () => Math.random() * 0.4), duration: 420, previewDuration: 30, bpm: 80, key: 'C', genre: 'ambient', coverArtUrl: null } as AudioPreview, 3),
  generatePost('ap8', 'Studio Nine', 'art', 'image', 'Concord Skyline — Neon Series', ['photography', 'urban', 'neon'],
    { type: 'image', imageUrl: '/api/preview/ap8.png', thumbnailUrl: '/api/preview/ap8-thumb.png', width: 3840, height: 2160, medium: 'photography' } as ImagePreview, 3),
];

// ============================================================================
// Artistry Page
// ============================================================================

export default function ArtistryPage() {
  const [feedMode, setFeedMode] = useState<FeedMode>('chronological');
  const [filters, setFilters] = useState<FeedFilter>({
    contentTypes: [],
    lenses: [],
    tags: [],
    timeRange: 'all',
  });
  const [posts] = useState<ArtistryPost[]>(SEED_POSTS);

  // ---- Filtering ----
  const filteredPosts = useMemo(() => {
    let result = posts;

    if (filters.contentTypes.length > 0) {
      result = result.filter(p => filters.contentTypes.includes(p.contentType));
    }
    if (filters.lenses.length > 0) {
      result = result.filter(p => filters.lenses.includes(p.sourceLens));
    }
    if (filters.tags.length > 0) {
      result = result.filter(p => p.tags.some(t => filters.tags.includes(t)));
    }
    if (filters.timeRange !== 'all') {
      const now = Date.now();
      const cutoffs: Record<string, number> = {
        today: 86400000,
        week: 604800000,
        month: 2592000000,
      };
      const cutoff = cutoffs[filters.timeRange] || 0;
      result = result.filter(p => now - new Date(p.createdAt).getTime() < cutoff);
    }

    // Sort: chronological (newest first) by default
    if (feedMode === 'chronological') {
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    // Discovery mode would apply recommendations — for now, just shuffle slightly
    if (feedMode === 'discovery') {
      result = [...result].sort(() => Math.random() - 0.5);
    }

    return result;
  }, [posts, filters, feedMode]);

  const handleViewInLens = useCallback((post: ArtistryPost) => {
    // Navigate to the source lens where the full artifact lives
    window.location.href = `/lenses/${post.sourceLens}?artifact=${post.sourceArtifactId}`;
  }, []);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-pink/20 to-neon-purple/20 flex items-center justify-center">
                <Palette className="w-5 h-5 text-neon-pink" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Concord Artistry</h1>
                <p className="text-xs text-gray-500">Cross-domain creative discovery</p>
              </div>
            </div>
          </div>

          {/* Commitment banner */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-gray-400">
            <Info className="w-4 h-4 text-neon-cyan flex-shrink-0 mt-0.5" />
            <div>
              <p><strong className="text-gray-300">Free advertising for creators.</strong> No cost to post, no cost to browse. No ads. No promoted posts. No pay-for-visibility. Ever.</p>
              <p className="mt-1 text-gray-500">Every piece of content links back to its source lens. No citations, no downloads from Artistry — this is a funnel, not a destination.</p>
            </div>
          </div>
        </motion.div>

        {/* Feed */}
        <ArtistryFeed
          posts={filteredPosts}
          loading={false}
          hasMore={false}
          feedMode={feedMode}
          filters={filters}
          onFilterChange={setFilters}
          onFeedModeChange={setFeedMode}
          onLoadMore={() => {}}
          onViewInLens={handleViewInLens}
        />
      </div>
    </div>
  );
}
