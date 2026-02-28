/**
 * Concord Film Studios — Frontend Type Definitions
 *
 * Film DTUs extend the base DTU/creative artifact model with
 * media-specific metadata. Integrates with existing marketplace types.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Film DTU Types
// ═══════════════════════════════════════════════════════════════════════════

export type FilmType = 'film' | 'short' | 'series' | 'episode' | 'documentary' | 'music-video';
export type FilmResolution = '720p' | '1080p' | '4K' | '8K';
export type PreviewType = 'first-5-min' | 'trailer-cut' | 'creator-selected-segment';
export type RemixPermission = 'open' | 'licensed' | 'restricted';

export type FilmRemixType =
  | 're-cut'
  | 'commentary-overlay'
  | 'mashup'
  | 'soundtrack-replacement'
  | 'translation-dub'
  | 'accessibility-enhancement'
  | 'parody-comedy'
  | 'educational-analysis'
  | 'vfx-enhancement'
  | 'alternate-ending'
  | 'highlight-reel';

export type FilmComponentType =
  | 'full-film'
  | 'soundtrack'
  | 'score'
  | 'dialogue'
  | 'foley-sfx'
  | 'scene'
  | 'behind-the-scenes'
  | 'commentary'
  | 'screenplay'
  | 'storyboard'
  | 'vfx-breakdown'
  | 'lighting-setup'
  | 'costume-set-design'
  | 'stems-package'
  | 'full-bundle';

export type CrewRole =
  | 'director'
  | 'cinematographer'
  | 'sound-designer'
  | 'colorist'
  | 'editor'
  | 'composer'
  | 'set-designer'
  | 'costume-designer'
  | 'stunt-coordinator'
  | 'gaffer'
  | 'vfx-artist'
  | 'producer'
  | 'screenwriter';

// ═══════════════════════════════════════════════════════════════════════════
// Core Interfaces
// ═══════════════════════════════════════════════════════════════════════════

export interface AudioTrack {
  id: string;
  language: string;
  type: 'dialogue' | 'commentary' | 'isolated-score' | 'mixed';
  label: string;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  format: 'srt' | 'vtt' | 'ass';
  label: string;
}

export interface FilmStems {
  video?: string;
  dialogue?: string;
  music?: string;
  foley?: string;
  vfx_layers?: string[];
}

export interface FilmDTU {
  id: string;
  artifactId: string;
  creatorId: string;
  filmType: FilmType;
  durationSeconds?: number;
  previewDurationSeconds: number;
  resolution?: FilmResolution;
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  stems: FilmStems;
  previewType: PreviewType;
  previewTrailerDtuId?: string;
  previewSegmentStartMs?: number;
  previewSegmentEndMs?: number;
  remixPermissions: RemixPermission;
  parentCitations: string[];
  seriesId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FilmPreview {
  filmDtuId: string;
  title: string;
  description?: string;
  filmType: FilmType;
  durationSeconds?: number;
  resolution?: FilmResolution;
  previewType: PreviewType;
  previewDurationSeconds: number;
  requiresAuth: false;
  price?: number;
  rating?: number;
  ratingCount?: number;
  purchaseCount?: number;
  previewStartMs?: number;
  previewEndMs?: number;
  streamPath?: string;
  trailerDtuId?: string;
}

export interface FilmComponent {
  id: string;
  filmDtuId: string;
  artifactId?: string;
  creatorId: string;
  componentType: FilmComponentType;
  label: string;
  description?: string;
  price?: number;
  isMega: boolean;
  sceneNumber?: number;
  sceneStartMs?: number;
  sceneEndMs?: number;
  status: 'draft' | 'active' | 'paused' | 'delisted';
  purchaseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FilmCrewMember {
  id: string;
  filmDtuId: string;
  userId: string;
  role: CrewRole;
  displayName?: string;
  revenueSharePct: number;
  createdAt: string;
}

export interface FilmCrewDTU {
  id: string;
  crewId: string;
  filmDtuId: string;
  artifactId?: string;
  crewContributionType: string;
  title: string;
  description?: string;
  price?: number;
  status: 'draft' | 'active' | 'paused' | 'delisted';
  purchaseCount: number;
  role: CrewRole;
  displayName?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilmSeriesBundle {
  id: string;
  seriesDtuId: string;
  creatorId: string;
  bundleType: 'per-episode' | 'per-season' | 'per-series';
  seasonNumber?: number;
  bundlePrice: number;
  individualTotal?: number;
  discountPct: number;
  status: 'active' | 'paused' | 'delisted';
  purchaseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FilmRemix {
  id: string;
  remixDtuId: string;
  sourceDtuId: string;
  remixType: FilmRemixType;
  transformationHash?: string;
  transformationScore?: number;
  title?: string;
  price?: number;
  createdAt: string;
}

export interface FilmRemixLineageEntry {
  filmDtuId: string;
  title: string;
  creatorId: string;
  remixType: FilmRemixType;
  depth: number;
}

export interface WatchParty {
  id: string;
  filmDtuId: string;
  hostUserId: string;
  status: 'pending' | 'active' | 'paused' | 'ended';
  startedAt?: string;
  endedAt?: string;
  currentPositionMs: number;
  createdAt: string;
}

export interface GiftTransfer {
  id: string;
  licenseId: string;
  fromUserId: string;
  toUserId: string;
  filmDtuId: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
  resolvedAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Preview Analytics
// ═══════════════════════════════════════════════════════════════════════════

export interface PreviewAnalytics {
  totalViews: number;
  completions: number;
  purchases: number;
  conversionRate: number;
  dropOffBuckets: Record<string, number>;
  geoDistribution: Array<{ region: string; count: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Creator Analytics
// ═══════════════════════════════════════════════════════════════════════════

export interface CreatorFilmAnalytics {
  totalFilms: number;
  films: Array<{
    id: string;
    filmType: FilmType;
    title: string;
    price?: number;
    purchaseCount: number;
    rating?: number;
    ratingCount?: number;
    derivativeCount?: number;
  }>;
  revenue: {
    directSales: number;
    componentSales: number;
    total: number;
  };
  citationMap: Array<{
    remixType: FilmRemixType;
    sourceDtuId: string;
    remixTitle: string;
    sourceTitle: string;
  }>;
  geoDistribution: Array<{ region: string; count: number }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Discovery
// ═══════════════════════════════════════════════════════════════════════════

export interface FilmDiscoveryScores {
  purchaseVolume: number;
  citationCount: number;
  completionRate: number;
  previewConversion: number;
  creatorReputation: number;
  recencyScore: number;
  composite: number;
}

export interface FilmDiscoveryWeights {
  purchase_volume: { weight: number; description: string };
  citation_count: { weight: number; description: string };
  completion_rate: { weight: number; description: string };
  preview_conversion: { weight: number; description: string };
  creator_reputation: { weight: number; description: string };
  recency: { weight: number; description: string };
}
