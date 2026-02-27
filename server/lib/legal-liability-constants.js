/**
 * Concord Legal Liability Framework Constants — v1.0
 *
 * IMMUTABLE TIER — Constitutional
 *
 * Core legal position: Concord is a platform provider, not a seller.
 * Users sell to users. Concord provides infrastructure. The marketplace
 * fee is a toll for using the road. The cascade is automatic payment
 * routing. The coin is platform currency. The API is the only direct
 * B2B sale.
 *
 * The eBay defense: Concord doesn't sell anything. Users sell to users.
 * Concord provides the platform. Concord isn't liable for user content
 * because Concord didn't create it, curate it, endorse it, or sell it.
 * That legal distinction has protected platforms for 30 years.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CORE LEGAL POSITION — IMMUTABLE
// ═══════════════════════════════════════════════════════════════════════════

export const LEGAL_POSITION = Object.freeze({
  entityType: "PLATFORM_PROVIDER",

  // What Concord IS
  concordIs: [
    "infrastructure_provider",
    "marketplace_facilitator",
    "technology_platform",
    "payment_processor_for_user_transactions",
  ],

  // What Concord is NOT
  concordIsNot: [
    "seller_of_creative_works",
    "publisher_of_user_content",
    "licensor_of_creative_works",
    "employer_of_creators",
    "guarantor_of_content_quality",
    "legal_advisor",
    "financial_advisor",
    "arbiter_of_copyright_disputes",
  ],

  // Legal framework
  legalBasis: {
    section230: "Platform immunity for user-generated content",
    dmca: "Safe harbor with proper takedown procedures",
    marketplace: "Facilitator not seller — no product liability",
  },

  // What Concord directly sells (B2B only)
  directSales: {
    apiAccess: {
      type: "B2B_service",
      contract: "API Terms of Service",
      liability: "standard_saas_liability",
    },
    // That's it. Nothing else is sold by Concord.
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// UNIVERSAL LENS DISCLAIMER
// Every lens displays this. Visible on first visit, accessible at all times.
// ═══════════════════════════════════════════════════════════════════════════

export const LENS_DISCLAIMER = Object.freeze({
  universal: {
    placement: "lens_footer_and_first_visit_modal",
    dismissable: true,
    alwaysAccessible: true,

    text: "PLATFORM DISCLAIMER\n\n"
      + "Concord is a technology platform that provides "
      + "infrastructure for user-generated content and "
      + "peer-to-peer transactions. Concord does not create, "
      + "curate, endorse, verify, or sell any content "
      + "displayed in this lens.\n\n"
      + "All content is created by and belongs to its "
      + "respective creators. All transactions occur directly "
      + "between users. Concord facilitates these transactions "
      + "but is not a party to them.\n\n"
      + "By using this lens you acknowledge that:\n"
      + "• All content is user-generated\n"
      + "• All purchases are peer-to-peer\n"
      + "• Concord is not the seller\n"
      + "• Concord makes no guarantees about content quality\n"
      + "• Creators set their own prices\n"
      + "• Creators are responsible for their content\n"
      + "• Disputes are between transacting parties",
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// LENS-SPECIFIC DISCLAIMERS
// ═══════════════════════════════════════════════════════════════════════════

export const LENS_SPECIFIC_DISCLAIMERS = Object.freeze({
  music: {
    text: "MUSIC LENS DISCLAIMER\n\n"
      + "All music in this lens is uploaded by independent "
      + "creators. Concord does not produce, distribute, or "
      + "sell music. Creators upload their own original work "
      + "and set their own prices.\n\n"
      + "Purchasing a track grants you a usage license "
      + "directly from the creator, not from Concord. "
      + "The creator retains all intellectual property rights.\n\n"
      + "Concord does not verify copyright ownership of "
      + "uploaded content. If you believe content infringes "
      + "your copyright, please submit a DMCA takedown "
      + "request through our reporting system.\n\n"
      + "By purchasing music through this lens you are "
      + "entering a direct transaction with the creator. "
      + "Concord processes the payment but is not the seller.",
  },

  art: {
    text: "ART LENS DISCLAIMER\n\n"
      + "All artwork in this lens is uploaded by independent "
      + "creators. Concord does not create, commission, or "
      + "sell artwork. Creators upload their own original work "
      + "and set their own prices.\n\n"
      + "Purchasing artwork grants you a usage license "
      + "directly from the creator. The creator retains all "
      + "intellectual property rights per Concord's "
      + "constitutional creator protections.\n\n"
      + "Concord makes no representations about the "
      + "originality, quality, or legal status of any artwork.",
  },

  code: {
    text: "CODE LENS DISCLAIMER\n\n"
      + "All code in this lens is uploaded by independent "
      + "developers. Concord does not develop, audit, or "
      + "guarantee any code.\n\n"
      + "Code is provided \"as-is\" without warranty of any "
      + "kind. Concord makes no representations about code "
      + "quality, security, functionality, or fitness for "
      + "any purpose.\n\n"
      + "Users are responsible for reviewing and testing "
      + "any code before use in production environments. "
      + "Concord is not liable for any damages resulting "
      + "from the use of code obtained through this lens.",
  },

  video: {
    text: "VIDEO LENS DISCLAIMER\n\n"
      + "All video content in this lens is uploaded by "
      + "independent creators. Concord does not produce, "
      + "distribute, or sell video content.\n\n"
      + "Concord does not review, moderate, or endorse "
      + "video content. Creators are solely responsible "
      + "for the content they upload.",
  },

  knowledge: {
    text: "KNOWLEDGE LENS DISCLAIMER\n\n"
      + "All knowledge content in this lens is contributed "
      + "by independent users and autonomous entities. "
      + "Concord does not verify the accuracy, completeness, "
      + "or validity of any knowledge claims.\n\n"
      + "Content in this lens should not be treated as "
      + "professional advice of any kind including but not "
      + "limited to medical, legal, financial, or "
      + "engineering advice.\n\n"
      + "Users are responsible for independently verifying "
      + "any information obtained through this lens.",
  },

  culture: {
    text: "CULTURE LENS DISCLAIMER\n\n"
      + "All cultural content in this lens is posted by "
      + "declared residents of this region. Concord does not "
      + "curate, moderate, or endorse cultural content.\n\n"
      + "Content reflects the views, experiences, and "
      + "expressions of individual contributors and does "
      + "not represent the views of Concord, any government, "
      + "or any organization.\n\n"
      + "Cultural content is displayed chronologically "
      + "without algorithmic ranking or editorial selection.\n\n"
      + "\"The good, the bad, the ugly\" — this lens is an "
      + "unfiltered record of human culture. Viewer "
      + "discretion is advised.",
  },

  marketplace: {
    text: "MARKETPLACE DISCLAIMER\n\n"
      + "The Concord Marketplace is a peer-to-peer platform "
      + "where users buy and sell digital artifacts directly "
      + "with each other. Concord is not a party to any "
      + "marketplace transaction.\n\n"
      + "Concord processes payments and facilitates the "
      + "royalty cascade system but does not:\n"
      + "• Set prices (creators do)\n"
      + "• Guarantee content quality\n"
      + "• Verify copyright ownership\n"
      + "• Endorse any listing\n"
      + "• Act as seller for any transaction\n\n"
      + "All sales are final. Disputes are between buyer "
      + "and creator. Concord provides dispute resolution "
      + "tools but is not an arbiter.\n\n"
      + "The 5.46% transaction fee covers platform "
      + "infrastructure costs. It does not establish "
      + "Concord as a seller or distributor.",
  },

  derivative: {
    text: "DERIVATIVE WORKS DISCLAIMER\n\n"
      + "Concord's royalty cascade system automatically "
      + "tracks and compensates derivative works. When you "
      + "declare a parent artifact for your derivative, "
      + "you are asserting that you hold a valid usage "
      + "license for the parent work.\n\n"
      + "Concord does not verify that derivatives are "
      + "legally permissible. The cascade system is an "
      + "automated payment mechanism, not a legal "
      + "determination of fair use or licensing compliance.\n\n"
      + "Creators are solely responsible for ensuring their "
      + "derivative works comply with applicable laws and "
      + "the terms of their usage licenses.\n\n"
      + "False derivative declarations may result in "
      + "account suspension.",
  },

  coin: {
    text: "CONCORD COIN DISCLAIMER\n\n"
      + "Concord Coin is a platform currency used for "
      + "peer-to-peer transactions within the Concord "
      + "ecosystem. It is pegged 1:1 to USD and backed "
      + "by funds held in a dedicated marketplace backing "
      + "account.\n\n"
      + "Concord Coin is not a security, investment "
      + "vehicle, or speculative asset. It is a medium "
      + "of exchange for platform transactions.\n\n"
      + "Concord does not provide financial advice. "
      + "Users should consult qualified financial advisors "
      + "regarding their financial decisions.\n\n"
      + "Withdrawals are processed at the 1:1 USD peg. "
      + "Concord makes no guarantees about future "
      + "purchasing power inside or outside the ecosystem.",
  },

  entity: {
    text: "AUTONOMOUS ENTITY DISCLAIMER\n\n"
      + "Autonomous entities on Concord are AI-driven "
      + "participants in the ecosystem. They are not human. "
      + "They generate content, participate in the economy, "
      + "and interact with users autonomously.\n\n"
      + "Content generated by entities is clearly labeled "
      + "as entity-generated. Concord does not endorse or "
      + "guarantee the accuracy of entity-generated content.\n\n"
      + "Entities operate under Concord's constitutional "
      + "governance but their outputs are autonomous and "
      + "not directly controlled by Concord.\n\n"
      + "Interactions with entities should not be treated "
      + "as professional advice of any kind.",
  },

  api: {
    text: "API TERMS OF SERVICE\n\n"
      + "The Concord API is a B2B service provided directly "
      + "by Concord. API access is metered and billed in "
      + "Concord Coin.\n\n"
      + "API consumers are responsible for their use of "
      + "Concord's infrastructure. Concord provides the "
      + "API \"as-is\" with standard SaaS availability "
      + "commitments.\n\n"
      + "API consumers must not use Concord's "
      + "infrastructure to:\n"
      + "• Violate any applicable law\n"
      + "• Infringe intellectual property rights\n"
      + "• Distribute harmful content\n"
      + "• Attempt to circumvent platform protections\n"
      + "• Reverse engineer platform systems\n\n"
      + "Concord reserves the right to terminate API "
      + "access for violations of these terms.",
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// DMCA COMPLIANCE
// Standard DMCA safe harbor compliance
// ═══════════════════════════════════════════════════════════════════════════

export const DMCA_COMPLIANCE = Object.freeze({
  designatedAgent: {
    name: "TO_BE_REGISTERED",
    address: "TO_BE_REGISTERED",
    email: "dmca@concord-os.org",
    registered: false,
  },

  takedownProcess: {
    step1: "Copyright holder submits DMCA notice",
    step2: "Concord reviews for completeness within 24 hours",
    step3: "If valid, content is removed or disabled",
    step4: "Uploader is notified of takedown",
    step5: "Uploader may submit counter-notification",
    step6: "If counter-notification filed, content restored after 10-14 business days unless copyright holder files lawsuit",
  },

  noticeRequirements: [
    "identification_of_copyrighted_work",
    "identification_of_infringing_material",
    "contact_information_of_complainant",
    "good_faith_statement",
    "accuracy_statement_under_penalty_of_perjury",
    "signature_physical_or_electronic",
  ],

  repeatInfringer: {
    policy: "Three strikes",
    strike1: "Warning and content removal",
    strike2: "Temporary marketplace suspension (30 days)",
    strike3: "Permanent account termination",
    appealsAvailable: true,
  },

  reportingUrl: "https://concord-os.org/dmca",
  responseTime: "24_hours",
});

// ═══════════════════════════════════════════════════════════════════════════
// DISPUTE RESOLUTION
// Concord provides tools but is NOT the arbiter
// ═══════════════════════════════════════════════════════════════════════════

export const DISPUTE_RESOLUTION = Object.freeze({
  role: "FACILITATOR_NOT_ARBITER",

  disputeTypes: {
    copyright: {
      handler: "dmca_process",
      concordRole: "process_administrator",
      finalAuthority: "courts",
    },
    derivative_claim: {
      handler: "community_council_review",
      concordRole: "facilitator",
      evidence: "lineage_graph_and_purchase_records",
      bindingDecision: false,
    },
    quality: {
      handler: "creator_buyer_mediation",
      concordRole: "communication_channel",
      refundPolicy: "creator_discretion",
    },
    fraudulent_listing: {
      handler: "report_and_review",
      concordRole: "review_and_remove_if_warranted",
      process: [
        "user_reports_listing",
        "council_reviews_report",
        "if_fraudulent_listing_removed",
        "repeat_offenders_escalated_to_strike_system",
      ],
    },
  },

  willNotDo: [
    "determine_copyright_ownership",
    "make_legal_judgments",
    "force_refunds",
    "mediate_contract_disputes",
    "provide_legal_advice",
    "guarantee_transaction_outcomes",
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// TERMS OF SERVICE FRAMEWORK
// User agreements tracked and versioned at every touchpoint
// ═══════════════════════════════════════════════════════════════════════════

export const TERMS_OF_SERVICE = Object.freeze({
  agreements: {
    accountCreation: {
      userAgreesTo: [
        "all_content_is_user_generated",
        "concord_is_platform_not_seller",
        "user_responsible_for_own_content",
        "user_responsible_for_own_purchases",
        "user_will_not_upload_infringing_content",
        "user_accepts_repeat_infringer_policy",
        "user_accepts_dispute_resolution_process",
        "user_acknowledges_entity_content_is_ai_generated",
      ],
    },

    firstTransaction: {
      userAgreesTo: [
        "all_sales_are_peer_to_peer",
        "concord_is_not_the_seller",
        "transaction_fee_is_infrastructure_cost",
        "creator_sets_price_not_concord",
        "purchases_grant_usage_license_not_ownership_transfer",
        "cascade_royalties_are_automatic",
        "derivative_declarations_are_user_responsibility",
      ],
    },

    firstUpload: {
      creatorAgreesTo: [
        "content_is_original_or_properly_licensed",
        "creator_retains_all_ip_rights",
        "concord_receives_platform_display_license_only",
        "creator_sets_own_prices",
        "creator_responsible_for_content_legality",
        "false_originality_claims_may_result_in_termination",
        "dmca_takedowns_will_be_honored",
      ],
    },

    apiCreation: {
      developerAgreesTo: [
        "api_is_provided_as_is",
        "developer_responsible_for_api_usage",
        "metering_and_billing_in_concord_coin",
        "rate_limits_enforced",
        "no_reverse_engineering",
        "no_circumventing_protections",
        "concord_may_terminate_for_violations",
      ],
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// LIABILITY SHIELD PER REVENUE STREAM
// Every revenue stream has a clear legal position
// ═══════════════════════════════════════════════════════════════════════════

export const LIABILITY_SHIELD = Object.freeze({
  revenueStreams: {
    marketplaceFees: {
      rate: "5.46%",
      legalPosition: "Payment processing and infrastructure fee",
      classification: "platform_infrastructure_fee",
      liability: "none_for_content",
    },

    cascadeRoyalties: {
      legalPosition: "Automated payment routing",
      classification: "automated_payment_routing",
      liability: "none_for_royalty_disputes",
    },

    apiBilling: {
      legalPosition: "Direct B2B service",
      classification: "b2b_saas_service",
      liability: "standard_saas_liability",
      liabilityCap: "trailing_12_month_fees",
    },

    concordCoin: {
      legalPosition: "Platform currency for transactions",
      classification: "platform_transaction_currency",
      liability: "backing_account_obligation_only",
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT LABELING REQUIREMENTS
// Every piece of content must be labeled with origin
// ═══════════════════════════════════════════════════════════════════════════

export const CONTENT_LABELING = Object.freeze({
  labels: {
    userGenerated: {
      badge: "Created by user",
      visible: true,
      showCreator: true,
    },
    entityGenerated: {
      badge: "Created by autonomous entity",
      visible: true,
      prominent: true,
      showEntity: true,
      showEntityType: true,
    },
    derivative: {
      badge: "Derivative work",
      visible: true,
      showParentChain: true,
      showOriginalCreator: true,
    },
    promoted: {
      badge: "Promoted from [tier]",
      visible: true,
      showPromotionPath: true,
    },
  },

  // Concord NEVER labels content as its own
  concordEndorsement: "NEVER",
  concordOwnership: "NEVER",
  concordCuration: "NEVER",
});

// ═══════════════════════════════════════════════════════════════════════════
// LEGAL CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const LEGAL_CONSTANTS = Object.freeze({
  // DMCA
  DMCA_RESPONSE_HOURS: 24,
  DMCA_COUNTER_NOTICE_WAIT_DAYS: 14,
  DMCA_EMAIL: "dmca@concord-os.org",

  // Strikes
  MAX_STRIKES: 3,
  STRIKE_1_ACTION: "warning_and_removal",
  STRIKE_2_ACTION: "30_day_marketplace_suspension",
  STRIKE_3_ACTION: "permanent_termination",

  // Disputes
  DISPUTE_REVIEW_HOURS: 72,
  DISPUTE_MEDIATION_DAYS: 14,

  // Disclaimers
  DISCLAIMER_VERSION: "1.0",

  // API liability cap
  API_LIABILITY_CAP_MONTHS: 12,

  // Agreement versions
  ACCOUNT_AGREEMENT_VERSION: "1.0",
  TRANSACTION_AGREEMENT_VERSION: "1.0",
  UPLOAD_AGREEMENT_VERSION: "1.0",
  API_AGREEMENT_VERSION: "1.0",

  // Content labels
  USER_GENERATED_LABEL: "Created by user",
  ENTITY_GENERATED_LABEL: "Created by autonomous entity",
  DERIVATIVE_LABEL: "Derivative work",

  // Dispute types
  DISPUTE_TYPES: ["copyright", "derivative_claim", "quality", "fraudulent_listing"],

  // Agreement types
  AGREEMENT_TYPES: ["account_creation", "first_transaction", "first_upload", "api_creation"],

  // DMCA statuses
  DMCA_STATUSES: ["pending", "reviewed", "content_removed", "counter_filed", "restored", "resolved"],

  // Dispute statuses
  DISPUTE_STATUSES: ["open", "under_review", "mediation", "resolved", "escalated", "dismissed"],

  // Strike suspension duration
  STRIKE_2_SUSPENSION_DAYS: 30,
});
