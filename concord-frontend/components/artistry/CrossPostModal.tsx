'use client';

import { useState } from 'react';
import {
  X, ArrowRight, Music, Image, FileText, Code2, Video,
  Eye, Tag, Clock, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArtistryContentType, ArtistryPost } from '@/lib/artistry/types';

interface CrossPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CrossPostData) => void;
  contentType: ArtistryContentType;
  sourceLens: string;
  sourceArtifactId: string;
  defaultTitle: string;
  defaultDescription?: string;
  defaultTags?: string[];
}

export interface CrossPostData {
  title: string;
  description: string;
  tags: string[];
  previewStart: number;
  previewDuration: number;
}

const TYPE_PREVIEW_LIMITS: Record<ArtistryContentType, { label: string; maxPreview: string }> = {
  audio: { label: 'Audio preview clip', maxPreview: '30s or creator-set window' },
  image: { label: 'Full image viewable', maxPreview: 'Full resolution, no download' },
  video: { label: 'Video preview clip', maxPreview: '60s or creator-set window' },
  text: { label: 'Text excerpt', maxPreview: 'First 500 words or creator-set' },
  code: { label: 'Code preview', maxPreview: 'First 100 lines or creator-set' },
  interactive: { label: 'Screenshot or demo', maxPreview: 'Time-limited demo or static' },
  '3d': { label: 'Rotating thumbnail', maxPreview: 'Preview render only' },
};

export function CrossPostModal({
  isOpen,
  onClose,
  onSubmit,
  contentType,
  sourceLens,
  defaultTitle,
  defaultDescription = '',
  defaultTags = [],
}: CrossPostModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [tags, setTags] = useState<string[]>(defaultTags);
  const [tagInput, setTagInput] = useState('');
  const [previewStart, setPreviewStart] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(contentType === 'video' ? 60 : 30);

  if (!isOpen) return null;

  const previewInfo = TYPE_PREVIEW_LIMITS[contentType];

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-lattice-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-neon-cyan" />
            <h2 className="text-sm font-semibold">Promote on Artistry</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-neon-cyan/5 border border-neon-cyan/10 text-xs text-gray-300">
            <Info className="w-4 h-4 text-neon-cyan flex-shrink-0 mt-0.5" />
            <div>
              <p>Artistry is free discovery. <strong>No citations, no downloads.</strong></p>
              <p className="text-gray-500 mt-0.5">Viewers can only browse and click through to the {sourceLens} lens.</p>
            </div>
          </div>

          {/* Preview type */}
          <div className="flex items-center gap-2 p-2 rounded bg-white/5 text-xs">
            <Eye className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-400">{previewInfo.label}:</span>
            <span className="text-gray-300">{previewInfo.maxPreview}</span>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-neon-cyan/50"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Description <span className="text-gray-600">(max 500 chars)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 500))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-neon-cyan/50 resize-none"
              rows={3}
              maxLength={500}
            />
            <span className="text-[10px] text-gray-600 float-right">{description.length}/500</span>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Discovery tags</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-gray-300">
                  <Tag className="w-2.5 h-2.5" /> {tag}
                  <button onClick={() => setTags(tags.filter(t => t !== tag))} className="text-gray-500 hover:text-white ml-0.5">
                    <X className="w-2 h-2" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs focus:outline-none"
                placeholder="Add tag..."
              />
            </div>
          </div>

          {/* Preview window (audio/video only) */}
          {(contentType === 'audio' || contentType === 'video') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Preview start (s)
                </label>
                <input
                  type="number"
                  value={previewStart}
                  onChange={e => setPreviewStart(Math.max(0, Number(e.target.value)))}
                  min={0}
                  className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Duration (s)
                </label>
                <input
                  type="number"
                  value={previewDuration}
                  onChange={e => setPreviewDuration(Math.max(5, Math.min(contentType === 'video' ? 60 : 30, Number(e.target.value))))}
                  min={5}
                  max={contentType === 'video' ? 60 : 30}
                  className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/5 bg-white/[0.02]">
          <span className="text-[10px] text-gray-500">Free to post · No cost to browse</span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button
              onClick={() => onSubmit({ title, description, tags, previewStart, previewDuration })}
              disabled={!title.trim()}
              className="px-5 py-2 rounded-lg bg-neon-cyan text-black text-sm font-semibold hover:brightness-110 disabled:opacity-30 transition"
            >
              Post to Artistry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
