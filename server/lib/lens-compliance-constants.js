/**
 * Universal Lens Compliance Framework Constants — v1.0
 *
 * One spec to rule them all. Every lens — system, user-created, emergent-created —
 * must pass compliance before going live and maintain compliance while active.
 *
 * 106 lenses + user-created + emergent-created.
 * Each must implement: DTU bridge, protection modes, artifact layer handling,
 * one-tap purchase, export flow, vault integration, API billing compatibility,
 * federation tier compliance, culture isolation, creative marketplace wiring,
 * leaderboard reporting, quest system hooks, DTU file format encode/decode.
 *
 * Missing ANY = broken lens. Broken lens = broken trust.
 * The compliance validator is the immune system for the entire lens architecture.
 */

// ═══════════════════════════════════════════════════════════════════════════
// LENS CLASSIFICATION SYSTEM
// Not all lenses need all features. Classify each lens so compliance
// checks match capability.
// ═══════════════════════════════════════════════════════════════════════════

export const LENS_CLASSIFICATION = Object.freeze({
  classes: {
    KNOWLEDGE: {
      description: "Knowledge creation and discovery",
      requiresArtifactLayer: false,
      marketplaceEligible: true,
      protectionDefault: "OPEN",
      exportable: true,
      creativeMarketplace: false,
      cultureLens: false,
      examples: [
        "research", "mathematics", "physics", "philosophy",
        "history", "psychology", "linguistics", "economics",
        "biology", "chemistry", "medicine", "law",
        "engineering", "astronomy", "geology", "ecology",
      ],
    },

    CREATIVE: {
      description: "Creative artifact creation and showcase",
      requiresArtifactLayer: true,
      marketplaceEligible: true,
      protectionDefault: "PROTECTED",
      exportable: true,
      creativeMarketplace: true,
      cultureLens: false,
      examples: [
        "music", "art", "video", "code", "design",
        "photography", "animation", "writing", "podcast",
        "game_design", "architecture", "fashion", "film",
        "typography", "sound_design", "3d_modeling",
      ],
    },

    SOCIAL: {
      description: "Community interaction and discussion",
      requiresArtifactLayer: false,
      marketplaceEligible: false,
      protectionDefault: "OPEN",
      exportable: false,
      creativeMarketplace: false,
      cultureLens: false,
      examples: [
        "forum", "threads", "anonymous", "voice",
        "feed", "daily", "governance", "debate",
      ],
    },

    CULTURE: {
      description: "Cultural documentation and preservation",
      requiresArtifactLayer: false,
      marketplaceEligible: false,
      protectionDefault: "ISOLATED",
      exportable: false,
      creativeMarketplace: false,
      cultureLens: true,
      examples: ["culture"],
    },

    UTILITY: {
      description: "Functional tools and utilities",
      requiresArtifactLayer: false,
      marketplaceEligible: false,
      protectionDefault: "OPEN",
      exportable: false,
      creativeMarketplace: false,
      cultureLens: false,
      examples: [
        "calendar", "news", "weather", "calculator",
        "translator", "converter", "timer",
      ],
    },

    HYBRID: {
      description: "Multi-class lens combining knowledge and creative",
      requiresArtifactLayer: true,
      marketplaceEligible: true,
      protectionDefault: "PROTECTED",
      exportable: true,
      creativeMarketplace: true,
      cultureLens: false,
      examples: [
        "data_visualization", "interactive_education",
        "scientific_illustration", "technical_writing",
        "culinary", "fitness", "wellness",
      ],
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// LENS INTERFACE — What Every Lens Must Implement
// Class determines which tiers are required vs optional
// ═══════════════════════════════════════════════════════════════════════════

export const LENS_INTERFACE = Object.freeze({
  // ── TIER 1 — REQUIRED FOR ALL LENSES ─────────────────────────────────
  tier1_universal: {
    id: {
      type: "string",
      required: true,
      description: "Unique lens identifier",
      validation: "lowercase_alphanumeric_underscore",
    },
    name: {
      type: "string",
      required: true,
      description: "Display name",
    },
    icon: {
      type: "string",
      required: true,
      description: "Icon identifier",
    },
    classification: {
      type: "enum",
      required: true,
      values: ["KNOWLEDGE", "CREATIVE", "SOCIAL", "CULTURE", "UTILITY", "HYBRID"],
      description: "Lens class determines compliance requirements",
    },
    version: {
      type: "string",
      required: true,
      description: "Semantic version of lens implementation",
    },

    dtuBridge: {
      render: {
        signature: "(dtu: DTU, context: RenderContext) => RenderedOutput",
        required: true,
        description: "How this lens displays a DTU to the user",
      },
      create: {
        signature: "(input: UserInput, context: CreateContext) => DTU",
        required: true,
        description: "How this lens packages user content into a DTU",
      },
      validate: {
        signature: "(dtu: DTU) => ValidationResult",
        required: true,
        description: "Verify a DTU is valid for this lens",
      },
      layersUsed: {
        type: "array",
        required: true,
        values: ["human", "core", "machine", "artifact"],
        description: "Which DTU layers this lens reads/writes",
        minItems: 1,
      },
    },

    protectionMode: {
      type: "enum",
      required: true,
      values: ["PROTECTED", "OPEN", "ISOLATED"],
      description: "Default content protection for this lens",
    },

    federationTiers: {
      type: "array",
      required: true,
      values: ["local", "regional", "national", "global"],
      description: "Which federation tiers this lens participates in",
    },

    searchable: {
      type: "boolean",
      required: true,
      description: "Whether content in this lens appears in search",
    },
    filters: {
      type: "object",
      required: true,
      description: "Available filter options for browsing",
    },
  },

  // ── TIER 2 — REQUIRED FOR MARKETPLACE LENSES ─────────────────────────
  tier2_marketplace: {
    marketplace: {
      listable: { type: "boolean", required: true, description: "Can content be listed on marketplace" },
      pricingModel: { type: "enum", required: true, values: ["fixed", "variable", "free", "pay_what_you_want"] },
      oneTapPurchase: {
        signature: "(userId: string, dtuId: string) => PurchaseResult",
        required: true,
        description: "Inline purchase without leaving lens",
      },
    },
    export: {
      exportable: { type: "boolean", required: true },
      exportFormat: {
        signature: "(dtu: DTU, license: License) => ExportedFile",
        required: true,
        description: "How to extract artifact for export",
      },
      dtuFileEncode: {
        signature: "(dtu: DTU) => Buffer",
        required: true,
        description: "Encode DTU into .dtu file format",
      },
      dtuFileDecode: {
        signature: "(buffer: Buffer) => DTU",
        required: true,
        description: "Decode .dtu file back into DTU",
      },
    },
    vault: {
      store: {
        signature: "(artifact: Buffer, metadata: object) => VaultEntry",
        required: true,
        description: "Store artifact in single-origin vault",
      },
      retrieve: {
        signature: "(vaultHash: string) => ReadableStream",
        required: true,
        description: "Stream artifact from vault",
      },
      sharedVault: true,
    },
    cascade: {
      derivativeTypes: { type: "array", required: true, description: "What kinds of derivatives this lens supports" },
      declarationFlow: {
        signature: "(childDtu: DTU, parentIds: string[]) => DeclarationResult",
        required: true,
        description: "How derivatives declare their parents",
      },
    },
  },

  // ── TIER 3 — REQUIRED FOR CREATIVE LENSES ────────────────────────────
  tier3_creative: {
    contentModes: {
      type: "object",
      required: true,
      description: "What content modes this lens supports",
      minModes: 2,
      mustInclude: ["purchased"],
    },
    preview: {
      supportsPreview: { type: "boolean", required: true },
      previewGenerator: {
        signature: "(fullContent: Buffer) => PreviewContent",
        required: false,
        description: "Generate preview from full content",
      },
      previewConstraints: { type: "object", description: "Limits on preview (duration, resolution, etc)" },
    },
    artistryIntegration: {
      supportsArtistry: {
        type: "boolean",
        required: true,
        description: "Can content be posted to artistry open commons",
      },
      artistryMigration: {
        signature: "(dtu: DTU) => ArtistryDTU",
        required: false,
        description: "Migrate from protected lens to open artistry",
      },
    },
    artifactTypes: {
      type: "array",
      required: true,
      description: "Supported artifact MIME types",
      minItems: 1,
    },
    xpReporting: {
      onSale: { signature: "(sale: Sale) => XPEvent", required: true },
      onDerivative: { signature: "(derivative: Derivative) => XPEvent", required: true },
      onPromotion: { signature: "(promotion: Promotion) => XPEvent", required: true },
    },
  },

  // ── TIER 4 — CULTURE LENS ONLY ───────────────────────────────────────
  tier4_culture: {
    isolation: {
      crossLensVisibility: false,
      promotionPathway: "NONE",
      citationEnabled: false,
      derivativeEnabled: false,
      exportEnabled: false,
      marketplaceEnabled: false,
      searchExternalEnabled: false,
      metaDerivationIncluded: false,
      consolidationIncluded: false,
    },
    gating: {
      postPermission: "declared_residents_only",
      viewPermission: "declared_residents_only_until_merge",
      validateResidency: {
        signature: "(userId: string, regionId: string) => boolean",
        required: true,
      },
    },
    feedOrder: "CHRONOLOGICAL_ONLY",
    algorithmicRanking: false,
    mergeReady: {
      freezeContent: {
        signature: "(mergeDate: Date) => FreezeResult",
        required: true,
      },
      indexForGlobal: {
        signature: "(cultureDtus: DTU[]) => GlobalCultureIndex",
        required: true,
      },
    },
  },

  // ── TIER 5 — API COMPATIBILITY (ALL LENSES) ──────────────────────────
  tier5_api: {
    apiCategorization: {
      signature: "(operation: string) => 'read' | 'write' | 'compute' | 'storage' | 'cascade'",
      required: true,
      description: "Map lens operations to API billing categories",
    },
    apiParity: {
      description: "API calls through this lens produce identical results to UI interactions",
      required: true,
    },
    consumerDetection: {
      signature: "(request: Request) => 'ui' | 'api'",
      required: true,
      description: "Determine if request is from UI (free) or API (metered)",
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE VALIDATOR — 12-phase automated audit system
// Runs against every lens before it goes live.
// Runs again on every lens update.
// Runs nightly against all active lenses.
// ═══════════════════════════════════════════════════════════════════════════

export const LENS_COMPLIANCE_VALIDATOR = Object.freeze({
  name: "Lens Compliance Validator",

  triggers: {
    onLensCreate: true,
    onLensUpdate: true,
    nightlyAudit: true,
    onSystemUpgrade: true,
    manual: true,
  },

  phases: [
    {
      name: "structure",
      description: "Verify lens declares all required fields",
      checks: [
        "has_id", "has_name", "has_icon", "has_classification",
        "has_version", "has_protection_mode", "has_federation_tiers",
        "has_filters", "has_searchable_flag",
      ],
    },
    {
      name: "dtu_bridge",
      description: "Verify DTU round-trip integrity",
      checks: [
        "render_function_exists", "create_function_exists",
        "validate_function_exists", "layers_declared",
        "roundtrip_integrity", "empty_input_handled",
        "malformed_input_rejected", "all_declared_layers_populated",
      ],
    },
    {
      name: "dtu_file_format",
      description: "Verify .dtu encode/decode works for this lens",
      checks: [
        "encode_produces_valid_header", "magic_bytes_correct",
        "primary_type_correct_for_lens", "decode_recovers_all_layers",
        "roundtrip_binary_integrity", "artifact_layer_preserved",
        "metadata_preserved", "signature_valid_after_encode",
      ],
    },
    {
      name: "protection",
      description: "Verify protection mode is enforced",
      checks: [
        "protected_blocks_citation", "protected_blocks_derivative",
        "protected_blocks_export_without_license",
        "open_allows_citation", "open_allows_derivative",
        "open_blocks_export_without_purchase",
        "isolated_blocks_everything", "isolated_no_cross_lens_visibility",
        "isolated_no_promotion_pathway",
        "creator_override_works", "creator_cannot_override_isolated",
      ],
    },
    {
      name: "marketplace",
      description: "Verify marketplace wiring",
      appliesTo: ["KNOWLEDGE", "CREATIVE", "HYBRID"],
      checks: [
        "listing_creates_valid_marketplace_entry",
        "one_tap_purchase_executes", "purchase_creates_license",
        "purchase_triggers_fee_split",
        "purchase_triggers_cascade_if_derivative",
        "export_requires_active_license",
        "export_produces_valid_file",
        "redownload_works_with_existing_license",
        "price_validation",
      ],
    },
    {
      name: "vault",
      description: "Verify single-origin storage compliance",
      appliesTo: ["CREATIVE", "HYBRID", "KNOWLEDGE"],
      checks: [
        "artifact_stored_in_shared_vault", "no_lens_specific_storage",
        "vault_hash_correct",
        "reference_count_incremented_on_create",
        "reference_count_decremented_on_delete",
        "dedup_works_for_identical_artifacts",
        "download_serves_from_vault",
        "no_per_user_copies_created",
      ],
    },
    {
      name: "creative",
      description: "Verify creative lens features",
      appliesTo: ["CREATIVE", "HYBRID"],
      checks: [
        "content_modes_defined", "purchased_mode_exists",
        "preview_generator_works_if_supported",
        "preview_respects_constraints",
        "artistry_migration_works_if_supported",
        "artifact_types_declared",
        "xp_reported_on_sale", "xp_reported_on_derivative",
        "xp_reported_on_promotion",
        "derivative_types_declared",
        "derivative_declaration_validates_license",
      ],
    },
    {
      name: "culture_isolation",
      description: "Verify culture lens is properly isolated",
      appliesTo: ["CULTURE"],
      checks: [
        "no_cross_lens_visibility", "no_promotion_pathway",
        "no_citation_enabled", "no_derivative_enabled",
        "no_export_enabled", "no_marketplace_enabled",
        "no_external_search", "no_meta_derivation_inclusion",
        "no_consolidation_inclusion", "residency_gating_enforced",
        "feed_is_chronological_only", "no_algorithmic_ranking",
        "merge_freeze_works", "global_index_generation_works",
        "emergent_posting_blocked", "emergent_viewing_allowed",
      ],
    },
    {
      name: "api_compatibility",
      description: "Verify API billing integration",
      checks: [
        "operations_categorizable", "ui_request_detected_as_free",
        "api_request_detected_as_metered",
        "api_produces_same_result_as_ui",
        "api_billing_headers_populated", "rate_limiting_respected",
      ],
    },
    {
      name: "federation",
      description: "Verify federation tier behavior",
      checks: [
        "declared_tiers_valid", "local_content_stays_local",
        "promotion_respects_quality_gates",
        "regional_requires_regional_authority",
        "national_requires_national_authority",
        "global_requires_global_authority",
        "query_up_works", "query_results_dont_persist_down",
      ],
    },
    {
      name: "leaderboard",
      description: "Verify lens reports to leaderboard correctly",
      checks: [
        "dtu_creation_counted", "citation_reception_counted",
        "promotion_counted", "marketplace_volume_counted",
        "xp_awarded_correctly",
      ],
    },
    {
      name: "quests",
      description: "Verify quest system integration",
      checks: [
        "first_dtu_quest_triggerable", "citation_chain_quest_triggerable",
        "promotion_quest_triggerable",
        "no_coin_rewards_in_quest_triggers", "xp_only_rewards",
      ],
    },
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// LENS CREATOR COMPLIANCE GATE
// User-created and emergent-created lenses must pass ALL compliance
// checks before going live. No exceptions.
// ═══════════════════════════════════════════════════════════════════════════

export const LENS_CREATOR_GATE = Object.freeze({
  flow: {
    step1: "Creator defines lens metadata and classification",
    step2: "Creator implements required interface methods",
    step3: "Creator submits for compliance validation",
    step4: "Automated validator runs ALL applicable phases",
    step5_pass: "Lens enters review queue for council approval",
    step5_fail: "Creator receives detailed failure report with fixes needed",
    step6: "Council reviews (3 votes for regional, 5 for national, 7 for global)",
    step7: "Lens goes live",
  },

  failedLensPolicy: {
    canGoLive: false,
    retryAllowed: true,
    retryLimit: null,
    failureReportProvided: true,
  },

  liveFailurePolicy: {
    action: "immediate_disable",
    notification: "creator_and_steward_council",
    gracePeriod: "24_hours_to_fix",
    resubmitAllowed: true,
  },

  inheritance: {
    updateGracePeriodDays: 30,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// LENS UPGRADE PROPAGATION — Pending upgrades for current specs
// ═══════════════════════════════════════════════════════════════════════════

export const PENDING_UPGRADES = Object.freeze([
  {
    name: "DTU File Format Support",
    description: "All marketplace lenses must support .dtu encode/decode",
    newChecks: [
      "encode_produces_valid_header", "magic_bytes_correct",
      "primary_type_correct_for_lens", "decode_recovers_all_layers",
      "roundtrip_binary_integrity", "artifact_layer_preserved",
      "metadata_preserved", "signature_valid_after_encode",
    ],
    appliesTo: ["KNOWLEDGE", "CREATIVE", "HYBRID"],
  },
  {
    name: "Single-Origin Vault Integration",
    description: "All artifact-bearing lenses must use shared vault",
    newChecks: [
      "artifact_stored_in_shared_vault", "no_lens_specific_storage",
      "vault_hash_correct", "reference_count_incremented_on_create",
      "no_per_user_copies_created",
    ],
    appliesTo: ["CREATIVE", "HYBRID"],
  },
  {
    name: "API Billing Compatibility",
    description: "All lenses must support consumer detection for billing",
    newChecks: [
      "operations_categorizable", "ui_request_detected_as_free",
      "api_request_detected_as_metered", "api_produces_same_result_as_ui",
    ],
    appliesTo: ["KNOWLEDGE", "CREATIVE", "SOCIAL", "CULTURE", "UTILITY", "HYBRID"],
  },
  {
    name: "Protection Mode Enforcement",
    description: "All lenses must enforce their declared protection mode",
    newChecks: [
      "protected_blocks_citation", "protected_blocks_derivative",
      "protected_blocks_export_without_license",
      "open_allows_citation", "open_blocks_export_without_purchase",
      "isolated_blocks_everything", "creator_cannot_override_isolated",
    ],
    appliesTo: ["KNOWLEDGE", "CREATIVE", "SOCIAL", "CULTURE", "UTILITY", "HYBRID"],
  },
]);

// ═══════════════════════════════════════════════════════════════════════════
// COMPLIANCE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const LENS_COMPLIANCE_CONSTANTS = Object.freeze({
  // Audit schedule
  NIGHTLY_AUDIT_HOUR: 3,

  // Grace periods
  UPGRADE_GRACE_PERIOD_DAYS: 30,
  FAILURE_FIX_GRACE_HOURS: 24,

  // Council review requirements
  REGIONAL_LENS_VOTES: 3,
  NATIONAL_LENS_VOTES: 5,
  GLOBAL_LENS_VOTES: 7,

  // Retry limits
  COMPLIANCE_RETRY_LIMIT: null,

  // Validation phases
  TOTAL_PHASES: 12,
  UNIVERSAL_PHASES: 5,
  MARKETPLACE_PHASES: 2,
  CREATIVE_PHASES: 1,
  CULTURE_PHASES: 1,
  API_PHASES: 1,
  FEDERATION_PHASES: 1,
  LEADERBOARD_PHASES: 1,

  // Lens classes
  CLASSES: ["KNOWLEDGE", "CREATIVE", "SOCIAL", "CULTURE", "UTILITY", "HYBRID"],

  // Maximum user-created lenses per account
  MAX_LENSES_PER_USER: 10,
  MAX_LENSES_PER_EMERGENT: 5,
});
