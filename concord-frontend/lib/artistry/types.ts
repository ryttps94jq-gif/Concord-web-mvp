// ============================================================================
// Concord Artistry — Type System
// Cross-domain creative discovery feed.
// No citations. No downloads. No monetization. Pure discovery.
// ============================================================================

// ============================================================================
// Content Model
// ============================================================================

export type ArtistryContentType =
  | 'audio'
  | 'image'
  | 'video'
  | 'text'
  | 'code'
  | 'interactive'
  | '3d';

export interface ArtistryPost {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
  sourceLens: string; // music, art, code, creative, etc.
  sourceArtifactId: string;
  contentType: ArtistryContentType;
  preview: ArtistryPreview;
  title: string;
  description: string | null; // max 500 chars
  tags: string[];
  createdAt: string; // ISO datetime
  dedupeHash: string;
}

// ============================================================================
// Preview Types — type-specific preview data
// ============================================================================

export type ArtistryPreview =
  | AudioPreview
  | ImagePreview
  | VideoPreview
  | TextPreview
  | CodePreview
  | InteractivePreview
  | ThreeDPreview;

export interface AudioPreview {
  type: 'audio';
  previewUrl: string; // 30s clip or creator-set window
  waveformPeaks: number[];
  duration: number; // of the full track
  previewDuration: number; // of the clip
  bpm: number | null;
  key: string | null;
  genre: string | null;
  coverArtUrl: string | null;
}

export interface ImagePreview {
  type: 'image';
  imageUrl: string; // full resolution viewable, no download button
  thumbnailUrl: string;
  width: number;
  height: number;
  medium: string | null; // oil, digital, photography, etc.
}

export interface VideoPreview {
  type: 'video';
  previewUrl: string; // 60s clip or creator-set window
  thumbnailUrl: string;
  duration: number;
  previewDuration: number;
  resolution: string; // 1080p, 4K, etc.
}

export interface TextPreview {
  type: 'text';
  excerpt: string; // first 500 words or creator-set excerpt
  wordCount: number; // total
  genre: string | null; // fiction, poetry, essay, etc.
}

export interface CodePreview {
  type: 'code';
  excerpt: string; // first 100 lines or creator-set
  language: string;
  totalLines: number;
  description: string | null;
}

export interface InteractivePreview {
  type: 'interactive';
  thumbnailUrl: string;
  iframeUrl: string | null; // time-limited demo
  screenshots: string[];
  interactionType: string; // game, simulation, tool, etc.
}

export interface ThreeDPreview {
  type: '3d';
  thumbnailUrl: string; // rotating render
  modelFormat: string; // glTF, OBJ, etc.
  polyCount: number | null;
}

// ============================================================================
// Dedup Engine
// ============================================================================

export type DedupMethod =
  | 'chromaprint'   // audio: perceptual hash
  | 'phash'         // image: perceptual hash
  | 'simhash'       // text: MinHash/SimHash on n-grams
  | 'ast_similarity' // code: AST-based similarity
  | 'frame_phash';  // video: frame-sampled perceptual hash

export interface DedupResult {
  isDuplicate: boolean;
  similarity: number; // 0-1
  method: DedupMethod;
  matchedPostId: string | null;
  matchedPostTitle: string | null;
}

export const DEDUP_THRESHOLD = 0.95; // 95% similarity triggers rejection

export interface DedupAppeal {
  id: string;
  postId: string;
  matchedPostId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt: string | null;
}

// ============================================================================
// Feed
// ============================================================================

export type FeedMode = 'chronological' | 'discovery';

export interface FeedFilter {
  contentTypes: ArtistryContentType[];
  lenses: string[];
  tags: string[];
  timeRange: 'today' | 'week' | 'month' | 'all';
}

export interface DiscoveryPreferences {
  enabled: boolean;
  basedOn: ('lens_activity' | 'dtu_interactions' | 'explicit_preferences')[];
  explicitGenres: string[];
  explicitTags: string[];
}

// ============================================================================
// Artistry Page State
// ============================================================================

export interface ArtistryState {
  feedMode: FeedMode;
  filters: FeedFilter;
  discoveryPreferences: DiscoveryPreferences;
  posts: ArtistryPost[];
  loading: boolean;
  hasMore: boolean;
  cursor: string | null;
}
