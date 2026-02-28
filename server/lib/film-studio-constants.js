/**
 * Concord Film Studios — Constants & Type Definitions
 *
 * Film DTUs extend the base DTU format with media-specific metadata.
 * Every film can be decomposed into sellable component DTUs.
 * Crew members can independently create and sell DTUs from their contributions.
 * Series/episode parent-child structures are natively supported.
 *
 * Core Principles:
 *   - Every film serves a free preview (default: first 5 minutes)
 *   - No paywall before preview. Ever. Hardcoded.
 *   - Purchase = permanent ownership DTU minted to buyer's wallet
 *   - All transactions in Concord Coin
 *   - No paid promotion. No payola. Algorithm weights are PUBLIC.
 */

// ═══════════════════════════════════════════════════════════════════════════
// FILM DTU TYPES
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_DTU_TYPES = Object.freeze({
  film: { label: "Film", description: "Feature-length film" },
  short: { label: "Short Film", description: "Short-form film" },
  series: { label: "Series", description: "Series container (parent of episodes)" },
  episode: { label: "Episode", description: "Individual episode within a series" },
  documentary: { label: "Documentary", description: "Documentary film" },
  "music-video": { label: "Music Video", description: "Music video" },
});

export const FILM_DTU_TYPE_IDS = Object.freeze(Object.keys(FILM_DTU_TYPES));

// ═══════════════════════════════════════════════════════════════════════════
// RESOLUTION PRESETS
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_RESOLUTIONS = Object.freeze({
  "720p": { width: 1280, height: 720, label: "HD 720p" },
  "1080p": { width: 1920, height: 1080, label: "Full HD 1080p" },
  "4K": { width: 3840, height: 2160, label: "4K UHD" },
  "8K": { width: 7680, height: 4320, label: "8K UHD" },
});

export const FILM_RESOLUTION_IDS = Object.freeze(Object.keys(FILM_RESOLUTIONS));

// ═══════════════════════════════════════════════════════════════════════════
// PREVIEW SYSTEM — No paywall before preview. Ever. Hardcoded.
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_PREVIEW = Object.freeze({
  DEFAULT_DURATION_SECONDS: 300, // 5 minutes
  MIN_DURATION_SECONDS: 30,
  MAX_DURATION_SECONDS: 900,     // 15 minutes max preview
  REQUIRES_AUTH: false,          // Zero authentication required — hardcoded

  types: {
    "first-5-min": {
      label: "First 5 Minutes",
      description: "Serve the first 5 minutes of the film free",
      isDefault: true,
    },
    "trailer-cut": {
      label: "Trailer Cut",
      description: "A separate mini-DTU created by the creator as trailer",
    },
    "creator-selected-segment": {
      label: "Creator-Selected Segment",
      description: "Creator selects a custom segment of the film to preview",
    },
  },

  // After preview ends, show purchase prompt with:
  purchasePromptFields: [
    "price",
    "runtime",
    "ratings",
    "citation_count",
  ],

  // Analytics visible to creator
  analytics: [
    "preview_views",
    "conversion_rate",       // preview → purchase
    "drop_off_timestamp",    // where viewers stop watching
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// REMIX PERMISSIONS & TYPES
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_REMIX_PERMISSIONS = Object.freeze({
  open: {
    label: "Open",
    description: "Anyone who purchased can remix freely",
  },
  licensed: {
    label: "Licensed",
    description: "Remix allowed under license terms",
  },
  restricted: {
    label: "Restricted",
    description: "Remix requires explicit creator permission",
  },
});

export const FILM_REMIX_TYPES = Object.freeze({
  "re-cut": {
    label: "Re-Cut / Fan Edit",
    description: "Structural re-edit of the original film",
  },
  "commentary-overlay": {
    label: "Commentary Overlay",
    description: "New audio layer on existing video",
  },
  mashup: {
    label: "Mashup",
    description: "Combining multiple source films",
    requiresMultipleSources: true,
  },
  "soundtrack-replacement": {
    label: "Soundtrack Replacement",
    description: "New music on existing video",
  },
  "translation-dub": {
    label: "Translation / Community Dub",
    description: "Translated dialogue or community dubbing",
  },
  "accessibility-enhancement": {
    label: "Accessibility Enhancement",
    description: "Audio descriptions, enhanced subtitles, etc.",
  },
  "parody-comedy": {
    label: "Parody / Comedy Edit",
    description: "Parody or comedy re-edit",
  },
  "educational-analysis": {
    label: "Educational Analysis Overlay",
    description: "Educational commentary or analysis over film content",
  },
  "vfx-enhancement": {
    label: "VFX Enhancement",
    description: "Added or improved visual effects",
  },
  "alternate-ending": {
    label: "Alternate Ending",
    description: "New ending created for existing film",
  },
  "highlight-reel": {
    label: "Highlight Reel / Compilation",
    description: "Best-of compilation from one or more films",
  },
});

export const FILM_REMIX_TYPE_IDS = Object.freeze(Object.keys(FILM_REMIX_TYPES));

// ═══════════════════════════════════════════════════════════════════════════
// ROYALTY — Inherits from core royalty-cascade.js
// Uses the existing perpetual royalty cascade engine:
//   royalty(n) = max(initialRate / 2^n, 0.0005)
//   Initial rate: 21%, halving per generation, 0.05% floor
//   Max cascade depth: 50 generations
// Film remixes follow the same cascade logic as all marketplace content.
// Multi-source remixes: each cited source gets proportional royalty.
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_ROYALTY = Object.freeze({
  INHERITS_CORE_CASCADE: true,
  MULTI_SOURCE_SPLIT: "proportional",
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT DTU DECOMPOSITION
// Every film can be decomposed into separately sellable component DTUs.
// Each component auto-cites the parent film DTU.
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_COMPONENT_TYPES = Object.freeze({
  "full-film": {
    label: "Full Film",
    description: "The complete work",
    isMega: false,
    autoCreate: false, // this IS the parent
  },
  soundtrack: {
    label: "Soundtrack",
    description: "Isolated music from the film",
    isMega: false,
    autoCreate: false,
  },
  score: {
    label: "Score",
    description: "Composed score separated from songs",
    isMega: false,
    autoCreate: false,
  },
  dialogue: {
    label: "Dialogue Track",
    description: "Isolated dialogue audio",
    isMega: false,
    autoCreate: false,
  },
  "foley-sfx": {
    label: "Foley / SFX",
    description: "Sound effects isolated from the mix",
    isMega: false,
    autoCreate: false,
  },
  scene: {
    label: "Individual Scene",
    description: "Standalone scene clip sold separately",
    isMega: false,
    autoCreate: false,
    allowMultiple: true,
  },
  "behind-the-scenes": {
    label: "Behind the Scenes",
    description: "Making-of content",
    isMega: false,
    autoCreate: false,
  },
  commentary: {
    label: "Commentary Track",
    description: "Director/actor commentary overlay",
    isMega: false,
    autoCreate: false,
  },
  screenplay: {
    label: "Script / Screenplay",
    description: "The written document",
    isMega: false,
    autoCreate: false,
  },
  storyboard: {
    label: "Storyboard",
    description: "Visual planning documents",
    isMega: false,
    autoCreate: false,
  },
  "vfx-breakdown": {
    label: "VFX Breakdown",
    description: "Tutorials on visual effects creation",
    isMega: false,
    autoCreate: false,
  },
  "lighting-setup": {
    label: "Lighting Setup",
    description: "Lighting diagrams and crew documentation",
    isMega: false,
    autoCreate: false,
  },
  "costume-set-design": {
    label: "Costume / Set Design",
    description: "Design documentation for costumes and sets",
    isMega: false,
    autoCreate: false,
  },
  "stems-package": {
    label: "Stems Package",
    description: "Complete decomposed project files",
    isMega: true,
    autoCreate: false,
  },
  "full-bundle": {
    label: "Full Bundle",
    description: "Everything above packaged together",
    isMega: true,
    autoCreate: false,
  },
});

export const FILM_COMPONENT_TYPE_IDS = Object.freeze(Object.keys(FILM_COMPONENT_TYPES));

// ═══════════════════════════════════════════════════════════════════════════
// CREW ROLES & CONTRIBUTION SYSTEM
// Film creator can tag crew members and their roles.
// Each crew member can independently create and sell DTUs from their work.
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_CREW_ROLES = Object.freeze({
  director: {
    label: "Director",
    sellableTypes: ["commentary", "behind-the-scenes", "storyboard"],
  },
  cinematographer: {
    label: "Cinematographer",
    sellableTypes: ["shot-composition-breakdown", "camera-setup", "lighting-setup"],
  },
  "sound-designer": {
    label: "Sound Designer",
    sellableTypes: ["foley-pack", "sfx-collection", "ambient-recording"],
  },
  colorist: {
    label: "Colorist",
    sellableTypes: ["lut-preset", "color-grade-tutorial"],
  },
  editor: {
    label: "Editor",
    sellableTypes: ["editing-technique-breakdown", "timeline-walkthrough"],
  },
  composer: {
    label: "Composer",
    sellableTypes: ["individual-cue", "stems", "theme-composition"],
  },
  "set-designer": {
    label: "Set Designer",
    sellableTypes: ["blueprint", "3d-model", "reference-photo-pack"],
  },
  "costume-designer": {
    label: "Costume Designer",
    sellableTypes: ["pattern", "design-spec", "reference-guide"],
  },
  "stunt-coordinator": {
    label: "Stunt Coordinator",
    sellableTypes: ["choreography-breakdown", "safety-guide"],
  },
  gaffer: {
    label: "Gaffer",
    sellableTypes: ["lighting-diagram", "setup-tutorial"],
  },
  "vfx-artist": {
    label: "VFX Artist",
    sellableTypes: ["effect-preset", "technique-tutorial", "asset-pack"],
  },
  producer: {
    label: "Producer",
    sellableTypes: ["production-breakdown", "budget-template"],
  },
  "screenwriter": {
    label: "Screenwriter",
    sellableTypes: ["screenplay", "treatment", "character-bible"],
  },
});

export const FILM_CREW_ROLE_IDS = Object.freeze(Object.keys(FILM_CREW_ROLES));

// ═══════════════════════════════════════════════════════════════════════════
// SERIES / EPISODE STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_SERIES = Object.freeze({
  // Preview applies per-episode
  PREVIEW_PER_EPISODE: true,

  // Pricing modes
  pricingModes: {
    "per-episode": { label: "Per Episode", description: "Each episode priced individually" },
    "per-season": { label: "Season Bundle", description: "Entire season at bundled price" },
    "per-series": { label: "Series Bundle", description: "Entire series at bundled price" },
  },

  // Bundle discount is creator-set
  BUNDLE_DISCOUNT_MIN: 0,    // 0%
  BUNDLE_DISCOUNT_MAX: 0.50, // 50% max discount

  // Remix permissions can be set per-episode or series-wide
  remixPermissionScope: ["per-episode", "series-wide"],
});

// ═══════════════════════════════════════════════════════════════════════════
// DISCOVERY & RANKING
// No paid promotion. No payola. Code forbids favoritism.
// Algorithm weights are PUBLIC and auditable.
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_DISCOVERY = Object.freeze({
  NO_PAID_PROMOTION: true,   // Hardcoded. Cannot be overridden.
  NO_HUMAN_CURATION: true,   // No human curation team picking favorites.
  WEIGHTS_ARE_PUBLIC: true,  // Algorithm weights must be publicly auditable.

  rankingFactors: {
    purchase_volume: { weight: 0.25, description: "Total purchases" },
    citation_count: { weight: 0.20, description: "Number of remixes/references" },
    completion_rate: { weight: 0.20, description: "Do buyers watch the whole thing" },
    preview_conversion: { weight: 0.15, description: "Preview-to-purchase conversion rate" },
    creator_reputation: { weight: 0.10, description: "Creator marketplace history score" },
    recency: { weight: 0.10, description: "New content gets exposure window" },
  },

  browseModes: [
    "genre",
    "trending",
    "new-releases",
    "most-cited",
    "highest-rated",
    "most-remixed",
    "friends-watching", // Social lens integration
  ],

  // New content exposure window
  NEW_CONTENT_BOOST_HOURS: 72, // 3-day boost for new uploads
  NEW_CONTENT_BOOST_FACTOR: 1.5,
});

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASE & LICENSING
// Inherits core CREATOR_RIGHTS: creators keep IP, buyers get usage licenses.
// Buyer receives full file download for offline playback.
// No traditional DRM — usage tracked via DTU lineage, not file encryption.
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_OWNERSHIP = Object.freeze({
  type: "usage_license",          // Consistent with CREATOR_RIGHTS
  receivesFullFile: true,         // Full file download, not stream-only
  offlinePlayback: true,          // Licensed copy playable offline
  noTraditionalDRM: true,         // No file encryption; lineage tracking only
  trackingMethod: "dtu_lineage",

  // Gift: buyer can gift their licensed copy to another user
  giftAllowed: true,

  // Suggested price range (not enforced, just guidance)
  suggestedPriceMin: 0.50,
  suggestedPriceMax: 15.00,
  priceEnforced: false,
});

// ═══════════════════════════════════════════════════════════════════════════
// MONETIZATION FLOW
// All transactions in Concord Coin.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// MONETIZATION FLOW
// Inherits core fee schedule from fees.js and royalty-cascade.js:
//   Platform fee: 1.46%, Marketplace fee: 4%, Total: 5.46%
//   Royalty cascade: 21% initial, halving, 0.05% floor
// Film-specific: component sales auto-cite parent film DTU.
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_MONETIZATION = Object.freeze({
  currency: "concord_coin",
  INHERITS_CORE_FEES: true,    // Uses fees.js schedule
  INHERITS_CORE_CASCADE: true, // Uses royalty-cascade.js

  componentSale: {
    autoCitesParentFilm: true,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_SOCIAL = Object.freeze({
  features: {
    friendsRecommendations: true,   // Social lens shows what friends bought
    reviewDTUs: true,               // Users create review DTUs that cite the film
    discussionSpaces: true,         // Per-film threaded discussions
    watchParty: true,               // Synchronized viewing with friends
    creatorUpdates: true,           // Behind-the-scenes posts through social lens
  },

  // All social activity data belongs to the USER, not the platform
  dataOwnership: "user",
});

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS FOR CREATORS
// All analytics are DTUs owned by the creator, not the platform.
// Platform cannot sell creator analytics. Architecture prevents it.
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_ANALYTICS = Object.freeze({
  ownedByCreator: true,        // Analytics DTUs belong to creator
  platformCannotSell: true,    // Architecture prevents selling creator data

  metrics: [
    "preview_views",
    "preview_drop_off_timestamps",
    "preview_to_purchase_conversion",
    "geographic_distribution",
    "citation_map",             // Who's remixing, what's being cited
    "revenue_direct_sales",
    "revenue_remix_royalties",
    "revenue_citation_royalties",
    "revenue_component_sales",
    "revenue_resale_royalties",
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// EMERGENT INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_EMERGENT = Object.freeze({
  canCreateOriginalFilms: true,
  canCreateRemixes: true,
  canCreateAnalysisDTUs: true,
  canCreateReviews: true,
  canGenerateAccessibility: true, // Auto-audio-descriptions, auto-translations

  contentCategories: [
    "emergent_original_film",
    "emergent_remix_analysis",
    "emergent_film_review",
    "emergent_accessibility_enhancement",
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// ARTISTRY CROSSOVER
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_ARTISTRY_CROSSOVER = Object.freeze({
  // Soundtrack published simultaneously on Concord Artistry
  simultaneousSoundtrackPublish: true,

  // Film score components available as music DTUs
  scoreAsMusicDTU: true,

  // Music from Artistry can be licensed into films via citation
  artistryMusicLicensing: true,

  // Cross-platform citation: song used in film earns musician royalties from film sales
  crossPlatformCitationRoyalty: true,

  // Music videos as Film Studio DTUs that cite Artistry song DTU
  musicVideoToCitesong: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// GOVERNANCE & MODERATION — FILM-SPECIFIC
// ═══════════════════════════════════════════════════════════════════════════

export const FILM_GOVERNANCE = Object.freeze({
  // Repair cortex handles disputes automatically
  automatedDisputes: true,

  // Content hash comparison prevents pure re-uploads without transformation
  minTransformationRequired: true,
  transformationHashThreshold: 0.15, // At least 15% content difference required

  // Citation chain verification ensures proper attribution
  citationVerification: true,

  // Community flagging for inappropriate content
  communityFlagging: true,

  // Council governance for edge cases
  councilForEdgeCases: true,

  // No centralized moderation team
  noCentralizedModeration: true,
  rulesInCode: true, // Rules are in the code, not in a policy document
});
