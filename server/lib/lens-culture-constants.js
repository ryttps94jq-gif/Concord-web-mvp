/**
 * Concord Lens & Culture Constants — v1.3
 *
 * Music Lens, Art/Video/Code Lenses, Culture Lens,
 * Artistry Global, Great Merge, Sovereign Biomonitor, Grief Protocol,
 * Lens Protection System, Artifact Export, One-Tap Purchase.
 */

// ── Music Lens ────────────────────────────────────────────────────────
export const MUSIC_LENS = Object.freeze({
  id: "music",
  name: "Music",
  icon: "music-note",

  contentModes: {
    full_song: {
      description: "Complete track available for streaming on lens",
      protection: "FULL",
      purchaseRequired: false,
      exportable: false,
      marketplace_link: true,
    },
    preview: {
      description: "30-60 second clip for discovery",
      protection: "FULL",
      purchaseRequired: false,
      exportable: false,
      marketplace_link: true,
      maxDurationSeconds: 60,
      minDurationSeconds: 15,
    },
    purchased: {
      description: "User owns this track via marketplace purchase",
      protection: "LICENSED",
      exportable: true,
      derivativesAllowed: "per_license",
    },
  },

  filters: {
    contentType: ["full_song", "preview", "all"],
    genre: true,
    region: true,
    nation: true,
    artist_level: true,
    leaderboard_rank: true,
    sort: ["trending", "newest", "most_played", "most_purchased", "highest_rated"],
    duration: { min: null, max: null },
    price_range: { min: null, max: null },
  },

  playback: {
    inLensStreaming: true,
    queue: true,
    shuffle: true,
    repeat: true,
    download: false,
  },
});

// ── Music Protection — IMMUTABLE TIER ─────────────────────────────────
export const MUSIC_PROTECTION = Object.freeze({
  protectedActions: [
    "citation",
    "derivative_creation",
    "embedding",
    "redistribution",
    "export",
  ],

  unlockTrigger: "marketplace_purchase",

  enforcement: {
    citationEngine: "EXCLUDE_PROTECTED",
    derivativeEngine: "REJECT_UNPURCHASED_PARENTS",
    exportEngine: "REQUIRE_ACTIVE_LICENSE",
  },
});

// ── One-Tap Purchase ──────────────────────────────────────────────────
export const ONE_TAP_PURCHASE = Object.freeze({
  flow: {
    step1: "User taps purchase button on lens player",
    step2: "System checks Concord Coin balance",
    step3_sufficient: "Purchase executes immediately",
    step3_insufficient: "Prompt to add coins (minimal modal)",
    step4: "License granted instantly",
    step5: "Track upgrades from preview/full to purchased in UI",
    step6: "Export button appears",
    step7: "Artist paid via standard marketplace flow",
    step8: "Cascade fires if derivative lineage exists",
  },

  ui: {
    interruptPlayback: false,
    confirmationStyle: "inline_badge",
    purchasedBadge: true,
    showExportAfterPurchase: true,
  },
});

// ── Artifact Export ───────────────────────────────────────────────────
export const ARTIFACT_EXPORT = Object.freeze({
  definition: "User receives the raw artifact file for personal use. "
    + "The file is theirs permanently. No DRM. No expiry. "
    + "Works offline. Works without Concord. "
    + "User's copy is independent of platform.",

  exportBehavior: {
    music: { format: "original_upload_format", metadata: true, coverArt: true, packaging: "raw_file" },
    image: { format: "original_upload_format", metadata: true, packaging: "raw_file" },
    video: { format: "original_upload_format", metadata: true, packaging: "raw_file" },
    document: { format: "original_upload_format", packaging: "raw_file" },
    code: { format: "original_upload_format", packaging: "zip_if_multiple_files" },
    dataset: { format: "original_upload_format", packaging: "raw_file" },
    condensed: { format: "json", packaging: "raw_file" },
  },

  redownloadable: true,
  exportLimit: null,
  trackExports: true,
});

// ── Artistry Global — Open Creative Commons ───────────────────────────
export const ARTISTRY_SCOPE = Object.freeze({
  tiers: {
    artistry_regional: {
      scope: "artistry_regional",
      protection: "OPEN",
      cascadeEnabled: true,
      qualityGate: { councilRequired: false, dedupCheck: true },
      promotionToNational: {
        minCitations: 5,
        minDerivatives: 3,
        minAgeHours: 72,
        regionalCouncilApproval: true,
      },
    },
    artistry_national: {
      scope: "artistry_national",
      protection: "OPEN",
      cascadeEnabled: true,
      qualityGate: { councilRequired: true, councilVotes: 3, dedupCheck: true },
      promotionToGlobal: {
        minCitations: 20,
        minDerivatives: 10,
        minCrossRegionalPresence: 3,
        minAgeDays: 30,
        nationalCouncilApproval: true,
        globalCouncilReview: true,
      },
    },
    artistry_global: {
      scope: "artistry_global",
      protection: "OPEN",
      cascadeEnabled: true,
      qualityGate: { councilRequired: true, councilVotes: 5, dedupCheck: true, minCrossNationalPresence: 3 },
    },
  },

  citationPolicy: "open_without_purchase",
  derivativePolicy: "open_with_cascade",
  exportPolicy: "purchase_required",
  commercialUsePolicy: "purchase_required",
});

// ── Artist Strategy Matrix ────────────────────────────────────────────
export const ARTIST_STRATEGY = Object.freeze({
  protectedSales: {
    postTo: "music_lens",
    mode: "full_song",
    income: "marketplace_purchases",
    protection: "FULL until purchased",
    bestFor: "New artists, premium content, exclusive drops",
  },
  discoveryFirst: {
    postTo: "music_lens",
    mode: "preview",
    income: "marketplace_purchases_after_discovery",
    protection: "FULL until purchased",
    bestFor: "Unknown artists building audience",
  },
  cascadeMaximizer: {
    postTo: "artistry_global",
    mode: "open",
    income: "cascade_royalties_from_derivatives",
    protection: "OPEN for citation and derivatives",
    bestFor: "Established artists, producers wanting samples used",
  },
  dualStrategy: {
    step1: "Post to music lens for initial sales wave",
    step2: "After X months move to artistry for cascade income",
    income: "direct_sales THEN cascade_royalties",
    bestFor: "Strategic artists maximizing both channels",
  },
});

// ── Culture Lens — Isolated Human Memory ──────────────────────────────
export const CULTURE_LENS = Object.freeze({
  id: "culture",
  name: "Culture",
  icon: "globe-heart",

  corePrinciples: {
    isolation: "ABSOLUTE",
    neverInfluences: [
      "local_substrate",
      "regional_substrate",
      "national_substrate",
      "global_substrate",
      "meta_derivation",
      "consolidation_pipeline",
      "marketplace_rankings",
      "knowledge_leaderboards",
      "entity_training",
    ],
    substrateType: "isolated_culture_substrate",
    promotionPathway: "NONE",
    crossTierInfluence: "FORBIDDEN",
  },
});

// ── Culture Gating — Region and National Lock ─────────────────────────
export const CULTURE_GATING = Object.freeze({
  regional: {
    postPermission: "declared_regional_residents_only",
    viewPermission: "declared_regional_residents_only",
    crossRegionalPosting: "FORBIDDEN",
  },
  national: {
    postPermission: "declared_national_residents_only",
    viewPermission: "declared_national_residents_only",
    crossNationalPosting: "FORBIDDEN",
  },
  global: {
    status: "LOCKED",
    unlocksAt: "GREAT_MERGE_DATE",
    postPermission: "NONE_UNTIL_MERGE",
    viewPermission: "NONE_UNTIL_MERGE",
  },
});

// ── Culture Heartbeat ─────────────────────────────────────────────────
export const CULTURE_HEARTBEAT = Object.freeze({
  tickIntervalMs: 300000,

  tickActions: {
    cleanupExpiredMedia: true,
    updateEngagementCounts: true,
    autogenerate: false,
    consolidate: false,
    metaDerive: false,
    dreamSynthesize: false,
    entityInteraction: false,
    qualityGate: false,
    promote: false,
  },

  feedAlgorithm: "CHRONOLOGICAL_ONLY",
  sortOptions: ["newest", "oldest"],
  engagementInfluenceOnDisplay: "ZERO",
});

// ── Culture Restrictions ──────────────────────────────────────────────
export const CULTURE_RESTRICTIONS = Object.freeze({
  cannotDo: [
    "appear_in_search_outside_culture_lens",
    "influence_knowledge_substrate",
    "be_cited_by_knowledge_dtus",
    "be_cited_by_artistry_dtus",
    "appear_on_marketplace",
    "generate_royalties",
    "be_promoted_to_any_tier",
    "be_used_by_meta_derivation",
    "be_consolidated_into_mega_or_hyper",
    "influence_entity_behavior",
    "appear_on_leaderboards",
    "be_exported_before_merge",
    "be_viewed_outside_declared_region_before_merge",
    "be_viewed_outside_declared_nation_before_merge",
  ],

  canDo: [
    "be_posted_by_residents",
    "be_viewed_by_fellow_residents",
    "receive_resonance_from_residents",
    "receive_reflections_from_residents",
    "exist_permanently_in_culture_substrate",
    "be_included_in_great_merge",
    "be_viewed_globally_after_merge",
  ],

  emergentPolicy: {
    canView: true,
    canPost: false,
    canLearnFrom: false,
    rationale: "Culture is documented by humans for humans. "
      + "Emergents gain access at merge to understand humanity, "
      + "not to shape it.",
  },
});

// ── The Great Merge ───────────────────────────────────────────────────
export const GREAT_MERGE = Object.freeze({
  name: "The Great Merge",

  countdown: {
    startsAt: "PLATFORM_LAUNCH_DATE",
    duration: { years: 5 },
    display: {
      location: "culture_lens_header",
      format: "years_months_days_hours_minutes_seconds",
      style: "persistent_countdown",
      visibility: "all_users",
    },
    milestones: [
      { remaining: "4_years", message: "4 years until The Great Merge" },
      { remaining: "3_years", message: "3 years until The Great Merge" },
      { remaining: "2_years", message: "2 years until The Great Merge" },
      { remaining: "1_year", message: "1 year until The Great Merge" },
      { remaining: "6_months", message: "6 months until The Great Merge" },
      { remaining: "3_months", message: "3 months until The Great Merge" },
      { remaining: "1_month", message: "1 month until The Great Merge" },
      { remaining: "1_week", message: "1 week until The Great Merge" },
      { remaining: "1_day", message: "Tomorrow, the world sees itself" },
      { remaining: "1_hour", message: "1 hour until The Great Merge" },
      { remaining: "0", message: "The Great Merge is here" },
    ],
  },

  mergeProcess: {
    phase1: {
      name: "The Unveiling",
      action: "All culture DTUs become viewable globally",
      viewPermission: "global",
      postPermission: "still_local_only",
    },
    phase2: {
      name: "The Weaving",
      action: "System creates Concord Global Culture substrate",
      structure: {
        globalCulture: {
          type: "federated_index",
          browseBy: ["region", "nation", "time_period", "content_type", "tag", "mood"],
          discovery: {
            crossCulturalSearch: true,
            thematicGrouping: true,
            groupingMethod: "steward_council_curated",
          },
        },
      },
    },
    phase3: {
      name: "The Understanding",
      action: "Emergent entities gain read access to global culture",
      emergentAccess: "read_only",
      emergentPosting: "FORBIDDEN_FOREVER",
      emergentBehavior: {
        empathyDevelopment: true,
        socialCommonsense: true,
        metaDerivation: false,
        consolidation: false,
        mode: "observation_only",
      },
    },
  },
});

// ── Post-Merge Rules ──────────────────────────────────────────────────
export const POST_MERGE_RULES = Object.freeze({
  continuity: {
    localPostingContinues: true,
    newPostsGloballyVisible: true,
    gatingPersists: true,
  },

  isolation: {
    knowledgeInfluence: "FORBIDDEN_FOREVER",
    marketplaceInfluence: "FORBIDDEN_FOREVER",
    leaderboardInfluence: "FORBIDDEN_FOREVER",
    classification: "PROTECTED_HUMAN_MEMORY",
  },

  immutability: {
    premergeEditing: "FROZEN_AT_MERGE",
    postMergeEditWindow: 86400000,
    // After edit window, frozen forever
  },
});

// ── Sovereign Biomonitor — IMMUTABLE TIER ─────────────────────────────
export const SOVEREIGN_BIOMONITOR = Object.freeze({
  name: "Sovereign Biomonitor",

  purpose: "Monitor sovereign vital signs and trigger constitutional "
    + "state change in event of sovereign incapacitation or death. "
    + "Provides steward council maximum response time.",

  inputs: {
    heartRate: { critical_low: 30, critical_high: 200 },
    bloodOxygen: { critical_low: 85 },
    bodyTemperature: { critical_low: 93, critical_high: 104 },
    movement: { inactivity_threshold_hours: 12 },
    brainActivity: null,
    bloodPressure: null,
  },

  alertLevels: {
    green: { condition: "All vitals normal", action: "none", stewardNotification: false },
    yellow: {
      condition: "One or more vitals approaching critical threshold",
      action: "log_and_monitor",
      stewardNotification: true,
      stewardMessage: "Sovereign vitals showing concern. Monitor closely.",
      concordAction: "none",
    },
    orange: {
      condition: "One or more vitals at critical threshold",
      action: "steward_alert",
      stewardNotification: true,
      stewardMessage: "Sovereign vitals critical. Prepare for potential state change.",
      concordAction: "reduce_autogen_rate",
      stewardConveneWindow: 600000,
    },
    red: {
      condition: "Vitals indicate incapacitation or death",
      action: "constitutional_state_change",
      stewardNotification: true,
      stewardMessage: "Sovereign status: CRITICAL. Constitutional state change initiated.",
      concordAction: "activate_grief_protocol",
      stewardConveneWindow: 600000,
    },
  },

  connectionLoss: {
    gracePeriodMs: 3600000,
    escalationAfterMs: 14400000,
    criticalAfterMs: 86400000,
  },
});

// ── Grief Protocol — IMMUTABLE TIER ───────────────────────────────────
export const GRIEF_PROTOCOL = Object.freeze({
  name: "Grief Protocol",
  tier: "IMMUTABLE",

  activatedBy: ["biomonitor_red", "steward_council_unanimous"],

  sovereignLastDTU: {
    tier: "hyper",
    scope: "global",
    authority: 1.0,
    protected: true,
    forgettable: false,
    consolidatable: false,
    modifiable: false,
    content: { placeholder: "TO BE AUTHORED BY SOVEREIGN" },
    delivery: {
      immediateDelivery: true,
      pinnedGlobally: true,
      voiceDelivery: true,
      minimumDisplayHours: 24,
    },
  },

  griefPeriod: {
    duration: { minDays: 30, maxDays: 180, determinedBy: "steward_council" },
    systemBehavior: {
      heartbeatMultiplier: 0.25,
      autogenRate: 0.1,
      metaDerivationRate: 0.1,
      consolidationRate: 0.25,
      entityBehavior: {
        mourningBehaviorEnabled: true,
        marketplaceActivity: "reduced",
        sleepCycleMultiplier: 2.0,
        memorialCreation: true,
      },
      mustContinue: [
        "backing_account_integrity",
        "coin_peg_maintenance",
        "user_withdrawals",
        "security_systems",
        "constitutional_enforcement",
        "steward_council_governance",
      ],
    },
  },

  postGrief: {
    declaredBy: "steward_council",
    transitionPeriod: {
      durationDays: 30,
      heartbeatRampUp: "linear_over_30_days",
      autogenRampUp: "linear_over_30_days",
    },
    succession: {
      newSovereign: "NONE",
      governanceModel: "steward_council_collective",
      constitutionalAuthority: "supreme",
    },
  },
});

// ── Generalized Lens Protection System ────────────────────────────────
export const LENS_PROTECTION_SYSTEM = Object.freeze({
  modes: {
    PROTECTED: {
      citation: false,
      derivative: false,
      export: false,
      purchaseUnlocks: true,
    },
    OPEN: {
      citation: true,
      derivative: true,
      export: false,
      commercialUse: false,
      purchaseUnlocks: ["export", "commercial_use"],
    },
    ISOLATED: {
      citation: false,
      derivative: false,
      export: false,
      purchaseUnlocks: false,
      promotion: false,
      crossLensVisibility: false,
    },
  },

  lensDefaults: {
    music: "PROTECTED",
    art: "PROTECTED",
    video: "PROTECTED",
    code: "OPEN",
    research: "OPEN",
    culture: "ISOLATED",
    creatorOverride: {
      PROTECTED_to_OPEN: true,
      OPEN_to_PROTECTED: true,
      ISOLATED_to_anything: false,
    },
  },
});

// ── Art Lens ──────────────────────────────────────────────────────────
export const ART_LENS = Object.freeze({
  id: "art",
  name: "Art",
  icon: "palette",
  contentModes: {
    full: { protection: "FULL", exportable: false, marketplace_link: true },
    preview: { protection: "FULL", exportable: false, marketplace_link: true, previewType: "low_resolution" },
    purchased: { protection: "LICENSED", exportable: true },
  },
  filters: {
    contentType: ["full", "preview", "all"],
    medium: true,
    style: true,
    region: true,
    nation: true,
    sort: ["trending", "newest", "most_purchased", "highest_rated"],
  },
  oneTapPurchase: true,
});

// ── Video Lens ────────────────────────────────────────────────────────
export const VIDEO_LENS = Object.freeze({
  id: "video",
  name: "Video",
  icon: "film",
  contentModes: {
    full: { protection: "FULL", exportable: false, marketplace_link: true },
    preview: { protection: "FULL", exportable: false, marketplace_link: true, previewType: "clip", maxDurationSeconds: 120 },
    purchased: { protection: "LICENSED", exportable: true },
  },
  oneTapPurchase: true,
});

// ── Code Lens ─────────────────────────────────────────────────────────
export const CODE_LENS = Object.freeze({
  id: "code",
  name: "Code",
  icon: "terminal",
  contentModes: {
    full: { protection: "OPEN", exportable: false, marketplace_link: true, citable: true },
    purchased: { protection: "LICENSED", exportable: true },
  },
  oneTapPurchase: true,
});

// ── Universal DTU Lens Bridge ─────────────────────────────────────────
// Every lens is a window into the same DTU substrate.
// The DTU format doesn't bend for any lens. The lens bends for the DTU.
export const LENS_DTU_BRIDGE = Object.freeze({
  required: {
    // Every lens MUST implement: render, create, protectionMode, export, purchase
    render: "Extract layers relevant to this lens and display appropriately",
    create: "Package user content into proper DTU layers (human, core, machine, artifact)",
    protectionMode: "PROTECTED | OPEN | ISOLATED",
    export: "Extract artifact from DTU, verify license, return raw file",
    purchase: "Standard marketplace flow: fees, cascade, licensing",
  },

  declarations: {
    layersUsed: "Array of DTU layers this lens reads/writes: human, core, machine, artifact",
    supportedArtifactTypes: "Array of artifact types this lens can handle",
    publishableScopes: "Array of scopes this lens can publish to",
    federationTiers: "Array of federation tiers this lens participates in",
  },

  layerDefinitions: {
    human: "Summary a human understands — always populated",
    core: "Structured knowledge, metadata, lineage, licensing, location, economic history",
    machine: "Machine-verifiable invariants, hash proving integrity",
    artifact: "Binary content — zipped MP3, image, video, code, dataset",
  },
});

// ── Lens Validator ───────────────────────────────────────────────────
// No lens goes live without passing every check.
// The format is the law. The bridge is the enforcement. The validator is the gate.
export const LENS_VALIDATOR = Object.freeze({
  checks: [
    {
      name: "bridge_implementation",
      description: "Lens implements all required DTU bridge methods",
      required: true,
      validates: ["render", "create", "export", "purchase"],
    },
    {
      name: "layer_declaration",
      description: "Lens declares which DTU layers it uses",
      required: true,
      validates: ["layersUsed"],
    },
    {
      name: "artifact_type_support",
      description: "Lens declares supported artifact types",
      required: true,
      validates: ["supportedArtifactTypes"],
    },
    {
      name: "protection_mode",
      description: "Lens declares protection mode",
      required: true,
      validates: ["protectionMode"],
      validValues: ["PROTECTED", "OPEN", "ISOLATED"],
    },
    {
      name: "federation_tiers",
      description: "Lens declares federation participation",
      required: true,
      validates: ["federationTiers"],
    },
    {
      name: "scope_declaration",
      description: "Lens declares publishable scopes",
      required: true,
      validates: ["publishableScopes"],
    },
    {
      name: "dtu_roundtrip",
      description: "DTU created by lens can be read by lens without data loss",
      required: true,
      validates: ["create", "render"],
    },
    {
      name: "export_license_check",
      description: "Export fails without valid license",
      required: true,
      validates: ["export"],
    },
    {
      name: "protection_enforcement",
      description: "Protected content blocks citation and derivative",
      required: true,
      validates: ["protectionMode"],
    },
  ],
});

// ── System Lens Declarations ─────────────────────────────────────────
// Bridge declarations for the built-in lenses
export const SYSTEM_LENS_DECLARATIONS = Object.freeze({
  music: {
    layersUsed: ["human", "core", "artifact"],
    supportedArtifactTypes: ["beat", "song", "remix", "cover", "sample_pack", "album"],
    publishableScopes: ["regional", "national", "global"],
    federationTiers: ["regional", "national", "global"],
    protectionMode: "PROTECTED",
  },
  art: {
    layersUsed: ["human", "core", "artifact"],
    supportedArtifactTypes: ["illustration", "photography", "graphic_design", "3d_model", "animation"],
    publishableScopes: ["regional", "national", "global"],
    federationTiers: ["regional", "national", "global"],
    protectionMode: "PROTECTED",
  },
  video: {
    layersUsed: ["human", "core", "artifact"],
    supportedArtifactTypes: ["short_film", "music_video", "documentary", "tutorial", "animation", "film", "episode", "series"],
    publishableScopes: ["regional", "national", "global"],
    federationTiers: ["regional", "national", "global"],
    protectionMode: "PROTECTED",
  },
  code: {
    layersUsed: ["human", "core", "machine", "artifact"],
    supportedArtifactTypes: ["library", "application", "script", "plugin", "template"],
    publishableScopes: ["regional", "national", "global"],
    federationTiers: ["regional", "national", "global"],
    protectionMode: "OPEN",
  },
  research: {
    layersUsed: ["human", "core", "machine"],
    supportedArtifactTypes: ["paper", "dataset", "analysis", "report"],
    publishableScopes: ["regional", "national", "global"],
    federationTiers: ["regional", "national", "global"],
    protectionMode: "OPEN",
  },
  culture: {
    layersUsed: ["human"],
    supportedArtifactTypes: ["text", "image", "audio", "video", "mixed"],
    publishableScopes: ["regional", "national"],
    federationTiers: ["regional", "national"],
    protectionMode: "ISOLATED",
  },
});

// ── Lens Constants ────────────────────────────────────────────────────
export const LENS_CONSTANTS = Object.freeze({
  // Music lens
  PREVIEW_MIN_SECONDS: 15,
  PREVIEW_MAX_SECONDS: 60,

  // Art lens
  PREVIEW_RESOLUTION_PERCENT: 25,
  PREVIEW_WATERMARK: true,

  // Video lens
  VIDEO_PREVIEW_MAX_SECONDS: 120,

  // Culture lens
  CULTURE_TICK_INTERVAL_MS: 300000,
  CULTURE_FEED_ORDER: "chronological",
  CULTURE_MAX_MEDIA_SIZE_MB: 100,
  CULTURE_MAX_MEDIA_PER_POST: 10,

  // Great Merge
  GREAT_MERGE_COUNTDOWN_YEARS: 5,
  GREAT_MERGE_PRE_MERGE_FREEZE_HOURS: 24,

  // Grief Protocol
  GRIEF_MIN_DAYS: 30,
  GRIEF_MAX_DAYS: 180,
  GRIEF_HEARTBEAT_MULTIPLIER: 0.25,
  GRIEF_AUTOGEN_MULTIPLIER: 0.1,
  GRIEF_TRANSITION_DAYS: 30,

  // Biomonitor
  BIOMONITOR_CONNECTION_GRACE_MS: 3600000,
  BIOMONITOR_YELLOW_ESCALATION_MS: 14400000,
  BIOMONITOR_RED_ESCALATION_MS: 86400000,
  STEWARD_CONVENE_WINDOW_MS: 600000,
});
