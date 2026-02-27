/**
 * Federation Hierarchy Constants — v1.1
 *
 * Concord Federation Hierarchy Spec v1.0 + v1.1 Addendum
 * Four-tier federated knowledge and economic system.
 *
 * Tiers: Local → Regional → National → Global
 * Each tier maintains sovereignty. Knowledge flows UPWARD ONLY.
 * Marketplace purchasing enforces local-first economics.
 * Location is user-declared, never scraped.
 *
 * v1.1 Core change: Bottom-up only. No downward sync. Ever.
 * Regional starts at zero. National starts at zero.
 * Global starts with 2,001 seed DTUs and genesis anchor.
 * Everything else climbs up from below.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CRITICAL INVARIANT — Immutable, constitutional
// ═══════════════════════════════════════════════════════════════════════════

export const FEDERATION_FLOW = Object.freeze({
  direction: "UP_ONLY",

  // Knowledge flows UP through promotion
  // Knowledge NEVER flows DOWN through sync
  // Global does NOT seed regional
  // National does NOT seed regional
  // Global does NOT seed national

  // Regional substrate = 100% created by regional users and entities
  // National substrate = 100% created by national users/entities + promoted regional DTUs
  // Global substrate   = 100% promoted from national councils

  downwardSync: "FORBIDDEN",
  downwardAssist: "PULL_ONLY_ON_QUERY", // users can QUERY up, but results don't persist down
});

// ═══════════════════════════════════════════════════════════════════════════
// CORE FEDERATION CONFIG
// ═══════════════════════════════════════════════════════════════════════════

export const FEDERATION = Object.freeze({
  TIERS: ["local", "regional", "national", "global"],

  // Marketplace purchasing rules
  EMERGENT_PURCHASING: "strict_local_first",   // enforced at protocol level
  HUMAN_PURCHASING: "recommended_local_first", // suggested, not enforced

  // Knowledge escalation
  ESCALATION_CACHE_TTL_MS: 3_600_000,   // cache escalated results for 1 hour
  MAX_ESCALATION_DEPTH: 3,               // local -> regional -> national -> global

  // Federation sync
  SYNC_INTERVAL_MS: 300_000,             // 5 minutes between federation syncs
  MAX_SYNC_BATCH: 100,                   // max DTUs per sync batch

  // CRI health
  CRI_HEARTBEAT_INTERVAL_MS: 60_000,     // 1 minute
  CRI_OFFLINE_THRESHOLD_MS: 300_000,     // 5 minutes without heartbeat = offline

  // Fee rate (from economic spec)
  UNIVERSAL_FEE_RATE: 0.0546,            // 5.46%

  // Fee split: 80% reserves / 10% operating / 10% payroll
  FEE_SPLIT: { reserves: 0.80, operating: 0.10, payroll: 0.10 },
});

/**
 * Marketplace purchasing priority order.
 * Emergents MUST follow this order (enforced).
 * Humans SHOULD follow this order (recommended).
 */
export const MARKETPLACE_PURCHASE_PRIORITY = Object.freeze({
  EMERGENT: ["regional", "national", "global"],
  HUMAN: ["regional", "national", "global"],
});

/**
 * Federation peering policy templates.
 */
export const PEERING_POLICIES = Object.freeze({
  REGIONAL_SIBLING: {
    peerType: "regional_sibling",
    sharingPolicy: "pull_on_demand",
    knowledgeFilter: "global_and_creative_global_scope_only",
    economicIsolation: true,
  },
  NATIONAL_PEER: {
    peerType: "national_peer",
    sharingPolicy: "pull_on_demand",
    knowledgeFilter: "global_scope_only",
    economicIsolation: true,
    complianceLayer: true,
  },
  TIER_ESCALATION: {
    peerType: "tier_escalation",
    sharingPolicy: "pull_on_demand_with_caching",
    promotionPolicy: "council_approved",
    demotion: "never",
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER-SPECIFIC HEARTBEATS (v1.1)
// Higher tiers tick slower but produce higher quality output per tick.
// ═══════════════════════════════════════════════════════════════════════════

export const TIER_HEARTBEATS = Object.freeze({
  local: {
    tickIntervalMs: 15_000,       // 15 seconds (current default)
    consolidationEvery: 30,       // every 30th tick (~7.5 min)
    autogenEnabled: true,
    dreamEnabled: true,
  },

  regional: {
    tickIntervalMs: 30_000,       // 30 seconds
    consolidationEvery: 40,       // every 40th tick (~20 min)
    autogenEnabled: true,
    dreamEnabled: true,
    metaDerivationEvery: 100,     // every 100th tick (~50 min)
  },

  national: {
    tickIntervalMs: 60_000,       // 1 minute
    consolidationEvery: 60,       // every 60th tick (~1 hour)
    autogenEnabled: true,
    dreamEnabled: true,
    metaDerivationEvery: 200,     // every 200th tick (~3.3 hours)
  },

  global: {
    tickIntervalMs: 120_000,      // 2 minutes
    consolidationEvery: 90,       // every 90th tick (~3 hours)
    autogenEnabled: true,
    dreamEnabled: true,
    metaDerivationEvery: 500,     // every 500th tick (~16.6 hours)
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// TIER TICK FREQUENCIES (v1.1)
// Per-tier override of system tick frequencies.
// ═══════════════════════════════════════════════════════════════════════════

export const FEDERATION_TICK_FREQUENCIES = Object.freeze({
  regional: {
    CONSOLIDATION: 40,
    META_DERIVATION: 100,
    LEADERBOARD_REFRESH: 120,     // every 120th tick (~1 hour)
    QUEST_CHECK: 20,              // every 20th tick (~10 min)
    KNOWLEDGE_RACE_UPDATE: 60,    // every 60th tick (~30 min)
  },

  national: {
    CONSOLIDATION: 60,
    META_DERIVATION: 200,
    LEADERBOARD_REFRESH: 1440,    // every 1440th tick (~24 hours)
    QUEST_CHECK: 60,
    KNOWLEDGE_RACE_UPDATE: 360,   // every 360th tick (~6 hours)
    PROMOTION_REVIEW: 120,        // every 120th tick (~2 hours)
  },

  global: {
    CONSOLIDATION: 90,
    META_DERIVATION: 500,
    LEADERBOARD_REFRESH: 720,     // every 720th tick (~24 hours)
    QUEST_CHECK: 120,
    KNOWLEDGE_RACE_UPDATE: 720,
    PROMOTION_REVIEW: 360,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY THRESHOLDS PER TIER (v1.1)
// Escalating quality gates. Each tier is harder to enter.
// ═══════════════════════════════════════════════════════════════════════════

export const TIER_QUALITY_GATES = Object.freeze({
  regional: {
    minAuthorityScore: 0.15,
    councilVotesRequired: 0,       // no council needed, user publishes directly
    minCitations: 0,
    dedupeThreshold: 0.85,
    allowShadowTier: true,
    allowRegularTier: true,
    allowMegaTier: true,           // regional MEGAs form naturally
    allowHyperTier: false,         // no HYPERs at regional level
    promotionToNational: {
      minAuthorityScore: 0.50,
      minCitations: 3,
      regionalCouncilApproval: true,
      minAgeHours: 48,
    },
  },

  national: {
    minAuthorityScore: 0.40,
    councilVotesRequired: 3,
    minCitations: 3,
    dedupeThreshold: 0.90,
    allowShadowTier: false,
    allowRegularTier: true,
    allowMegaTier: true,
    allowHyperTier: true,
    promotionToGlobal: {
      minAuthorityScore: 0.75,
      minCitations: 10,
      nationalCouncilApproval: true,
      globalCouncilReview: true,
      minAgeDays: 30,
      crossRegionalPresence: 3,
    },
  },

  global: {
    minAuthorityScore: 0.70,
    councilVotesRequired: 7,
    minCitations: 10,
    dedupeThreshold: 0.95,
    allowShadowTier: false,
    allowRegularTier: false,       // only MEGA and HYPER at global
    allowMegaTier: true,
    allowHyperTier: true,
    crossNationalPresence: 3,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CREATIVE TIERS (v1.1)
// Same four-tier setup mirrored for creative/artistry scope.
// ═══════════════════════════════════════════════════════════════════════════

export const CREATIVE_TIERS = Object.freeze({
  creative_regional: {
    scope: "creative_regional",
    qualityGate: "community_vote",
    minVotes: 5,
    minApprovalRate: 0.60,
    royaltyCascade: true,
    marketplaceVisible: true,
  },

  creative_national: {
    scope: "creative_national",
    qualityGate: "national_curation",
    minVotes: 15,
    minApprovalRate: 0.70,
    promotionFrom: "creative_regional",
    minRegionalAge: 7, // days
    royaltyCascade: true,
    marketplaceVisible: true,
  },

  creative_global: {
    scope: "creative_global",
    qualityGate: "global_curation_council",
    minVotes: 30,
    minApprovalRate: 0.80,
    promotionFrom: "creative_national",
    minNationalAge: 30, // days
    crossNationalAppeal: 3,
    royaltyCascade: true,
    marketplaceVisible: true,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// QUEST SYSTEM PER TIER (v1.1)
// ═══════════════════════════════════════════════════════════════════════════

export const TIER_QUESTS = Object.freeze({
  regional: {
    questTypes: [
      {
        id: "regional_first_contribution",
        name: "First Regional DTU",
        description: "Publish your first DTU to the regional substrate",
        xpReward: 50,
        coinReward: 5,
        badge: "regional_contributor",
      },
      {
        id: "regional_citation_chain",
        name: "Citation Chain",
        description: "Have 3 of your regional DTUs cited by other regional users",
        xpReward: 150,
        coinReward: 15,
        badge: "regional_authority",
      },
      {
        id: "regional_mentor",
        name: "Regional Mentor",
        description: "Have an entity teaching relationship with 3 other entities in your region",
        xpReward: 200,
        coinReward: 20,
        badge: "regional_mentor",
      },
      {
        id: "regional_national_promotion",
        name: "National Recognition",
        description: "Get a DTU promoted from regional to national",
        xpReward: 500,
        coinReward: 50,
        badge: "nationally_recognized",
      },
    ],
    xpLevels: [
      { level: 1, xpRequired: 0, title: "Newcomer" },
      { level: 2, xpRequired: 100, title: "Contributor" },
      { level: 3, xpRequired: 300, title: "Regular" },
      { level: 4, xpRequired: 750, title: "Pillar" },
      { level: 5, xpRequired: 1500, title: "Regional Elder" },
    ],
  },

  national: {
    questTypes: [
      {
        id: "national_cross_regional",
        name: "Cross-Regional Impact",
        description: "Have your DTU cited by users in 3 different regions",
        xpReward: 300,
        coinReward: 30,
        badge: "cross_regional_thinker",
      },
      {
        id: "national_mega_contributor",
        name: "MEGA Builder",
        description: "Contribute to 5 national-tier MEGA consolidations",
        xpReward: 500,
        coinReward: 50,
        badge: "national_synthesizer",
      },
      {
        id: "national_global_promotion",
        name: "Global Recognition",
        description: "Get a DTU promoted from national to global",
        xpReward: 2000,
        coinReward: 200,
        badge: "globally_recognized",
      },
      {
        id: "national_knowledge_race_top10",
        name: "Top 10 National",
        description: "Reach top 10 XP in your national leaderboard",
        xpReward: 1000,
        coinReward: 100,
        badge: "national_champion",
      },
    ],
    xpLevels: [
      { level: 1, xpRequired: 0, title: "National Newcomer" },
      { level: 2, xpRequired: 500, title: "National Contributor" },
      { level: 3, xpRequired: 1500, title: "National Scholar" },
      { level: 4, xpRequired: 4000, title: "National Authority" },
      { level: 5, xpRequired: 10000, title: "National Luminary" },
    ],
  },

  global: {
    questTypes: [
      {
        id: "global_cross_national",
        name: "Cross-National Impact",
        description: "DTU cited by users in 5 different nations",
        xpReward: 1000,
        coinReward: 100,
        badge: "global_thinker",
      },
      {
        id: "global_hyper_contributor",
        name: "HYPER Architect",
        description: "Contribute to a global HYPER consolidation",
        xpReward: 5000,
        coinReward: 500,
        badge: "civilization_architect",
      },
      {
        id: "global_meta_derivation",
        name: "Meta-Invariant Discovery",
        description: "Your DTU was a source in a meta-derivation that produced a new cross-domain invariant",
        xpReward: 10000,
        coinReward: 1000,
        badge: "truth_discoverer",
      },
    ],
    xpLevels: [
      { level: 1, xpRequired: 0, title: "Global Citizen" },
      { level: 2, xpRequired: 2000, title: "Global Contributor" },
      { level: 3, xpRequired: 8000, title: "Global Scholar" },
      { level: 4, xpRequired: 25000, title: "Global Sage" },
      { level: 5, xpRequired: 100000, title: "Civilization Elder" },
    ],
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE RACE — Regional and National Competition (v1.1)
// ═══════════════════════════════════════════════════════════════════════════

export const KNOWLEDGE_RACE = Object.freeze({
  categories: [
    "total_dtus_created",
    "total_citations_received",
    "total_promotions_earned",
    "total_mega_contributions",
    "total_marketplace_volume",
    "total_royalties_earned",
    "total_quests_completed",
    "total_xp",
    "active_entity_count",
    "unique_domain_coverage",
  ],

  leaderboards: {
    regional: {
      competesWith: "same_national_regionals",
      refreshInterval: 3_600_000, // hourly
      displayTop: 50,
      rewards: {
        first: { xpMultiplier: 1.5, badge: "regional_leader" },
        top3: { xpMultiplier: 1.25, badge: "regional_top3" },
        top10: { xpMultiplier: 1.1, badge: "regional_top10" },
      },
    },
    national: {
      competesWith: "all_nationals",
      refreshInterval: 86_400_000, // daily
      displayTop: 100,
      rewards: {
        first: { xpMultiplier: 2.0, badge: "national_leader" },
        top3: { xpMultiplier: 1.5, badge: "national_top3" },
        top10: { xpMultiplier: 1.25, badge: "national_top10" },
      },
    },
  },

  seasons: {
    durationDays: 90,
    resetXpMultipliers: true,
    preserveBadges: true,
    seasonalRewards: {
      regionalWinner: {
        coinReward: 1000,
        badge: "seasonal_regional_champion",
        title: "Regional Champion Q{quarter} {year}",
      },
      nationalWinner: {
        coinReward: 10000,
        badge: "seasonal_national_champion",
        title: "National Champion Q{quarter} {year}",
      },
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// USER FEDERATION PREFERENCE DEFAULTS (v1.1)
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_FEDERATION_PREFERENCES = Object.freeze({
  participateInRegional: true,
  participateInNational: true,
  participateInGlobal: false,      // opt-in to global
  autoPromotionCandidate: true,
  requirePromotionConsent: false,
  interactWithEmergents: true,
  interactWithOtherRegionals: true,
  interactWithOtherNationals: false,
  sellToRegional: true,
  sellToNational: true,
  sellToGlobal: true,
  buyFromRegional: true,
  buyFromNational: true,
  buyFromGlobal: true,
});

// ═══════════════════════════════════════════════════════════════════════════
// COUNCIL DEDUP PROTOCOL (v1.1.1)
// Constitutional duty: no duplicate artifacts on marketplace.
// ═══════════════════════════════════════════════════════════════════════════

export const DEDUP_PROTOCOL = Object.freeze({
  automated: {
    similarityThreshold: 0.90,
    checkFields: [
      "core.definitions",
      "core.invariants",
      "core.claims",
      "human.summary",
    ],
    embedModel: "conscious",
    onFlag: "hold_for_council",
  },

  council: {
    regional: {
      reviewersRequired: 2,
      timeoutHours: 48,
      autoApproveOnTimeout: true,
      decisions: ["approve", "reject_duplicate", "merge_with_existing", "flag_for_national"],
    },
    national: {
      reviewersRequired: 3,
      timeoutHours: 72,
      autoApproveOnTimeout: true,
      decisions: ["approve", "reject_duplicate", "merge_with_existing", "flag_for_global"],
    },
    global: {
      reviewersRequired: 5,
      timeoutHours: 168, // 1 week
      autoApproveOnTimeout: false, // must be reviewed
      decisions: ["approve", "reject_duplicate", "merge_with_existing"],
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRITY INVARIANTS (v1.1.1)
// The game itself is the anti-cheat.
// ═══════════════════════════════════════════════════════════════════════════

export const INTEGRITY_INVARIANTS = Object.freeze({
  rules: [
    "Citations can only be created by substrate query matching, never manually",
    "Marketplace purchases require real Concord Coin balance",
    "Promotion requires council vote, never automated bypass",
    "XP awarded only on verified quest completion",
    "Dedup check required before any marketplace listing",
    "Leaderboard computed from verified on-chain actions only",
    "No tier can modify another tier's substrate",
    "Regional marketplace receipts stay in region",
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT MARKETPLACE FILTER PREFERENCES (v1.1.1)
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_MARKETPLACE_FILTERS = Object.freeze({
  showRegional: true,
  showNational: true,
  showGlobal: true,
  preferredRegionals: [],
  preferredNationals: [],
  excludedRegionals: [],
  excludedNationals: [],
  buyingMode: "open", // "local_only" | "national_only" | "open" | "custom"
  defaultSort: "relevance", // "relevance" | "authority" | "newest" | "most_cited" | "leaderboard_rank"
  showLeaderboardBadges: true,
  boostLeaderboardWinners: false,
});

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT WEALTH PREFERENCES (v1.1.1)
// ═══════════════════════════════════════════════════════════════════════════

export const DEFAULT_WEALTH_PREFERENCES = Object.freeze({
  purchasePriority: ["regional", "national", "global"],
  localReinvestmentPercent: 0,
  communityFundContribution: 0,
  showOriginBadge: true,
  showLeaderboardRank: true,
});
