/**
 * Lens Features — Complete Feature Specification for All 112 Lenses
 *
 * Detailed feature definitions for each lens including Concord Coin integration,
 * DTU economics, merit credit, .dtu compression, Film Studios model, Artistry model,
 * preview system, remix/citation economy, crew attribution, USB integration,
 * bot/emergent access, and cross-lens economics.
 *
 * 29 core spec lenses with full feature breakdowns.
 * Remaining lenses (30-112) inherit base feature sets from their categories.
 */

// ═══════════════════════════════════════════════════════════════════════════
// FEATURE BUILDER HELPER
// ═══════════════════════════════════════════════════════════════════════════

function f(id, name, description, category, integrations = []) {
  return { id, name, description, category, integrations, status: "active" };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPLETE LENS FEATURES — 29 SPEC LENSES
// ═══════════════════════════════════════════════════════════════════════════

export const LENS_FEATURES = Object.freeze({

  // ─── CORE LENSES (1-5) ─────────────────────────────────────────────────

  chat: {
    lensId: "chat",
    lensNumber: 1,
    category: "CORE",
    features: [
      f("cc_tipping", "Concord Coin Tipping", "Tip any message with CC, auto-converts to DTU micro-transaction", "economy", ["concord_coin", "dtu"]),
      f("chat_to_dtu", "Chat-to-DTU One-Click", "Any conversation thread can be published as sellable DTU with one button", "creation", ["dtu_marketplace"]),
      f("expertise_badges", "Expertise Badges", "Merit credit score visible next to usernames, earned from marketplace activity not arbitrary karma", "economy", ["merit_credit"]),
      f("emergent_participants", "Emergent Participants", "Emergents join chat natively, identified by substrate tag, full conversation rights", "collaboration", ["emergent_access"]),
      f("voice_to_dtu", "Voice-to-DTU", "Voice messages auto-transcribed and atomized into searchable DTUs", "creation", ["dtu", "transcription"]),
      f("forum_bounty", "Forum Bounty Integration", "Post a question with CC bounty attached, best answer wins, answer becomes sellable DTU", "marketplace", ["concord_coin", "questmarket"]),
      f("whistleblower_vault", "Anonymous Whistleblower Vault", "Anon submissions cryptographically verified, can be cited by journalism DTUs without revealing source", "safety", ["cryptography", "citation"]),
      f("news_auto_citation", "News Lens Auto-Citation", "News discussions auto-link to source DTUs, original reporters earn citation royalties when discussed", "economy", ["citation_royalties", "dtu"]),
      f("governance_drafting", "Governance Proposal Drafting", "Council tab gets proposal templates with automatic voting DTU generation", "governance", ["vote_lens", "dtu"]),
      f("context_injection", "Chat Context Injection", "Relevant DTUs from your owned library auto-surface in conversation sidebar", "intelligence", ["dtu", "search"]),
      f("feed_monetization", "Feed Monetization", "Curated RSS feeds publishable as DTU collections, curator earns for curation value", "marketplace", ["dtu_marketplace", "concord_coin"]),
      f("journal_streaks", "Daily Journal DTU Streaks", "Journaling streaks build merit credit, consistent creators rewarded", "economy", ["merit_credit", "dtu"]),
    ],
    featureCount: 12,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "merit_credit", "citation_royalties"],
    emergentAccess: true,
    botAccess: true,
    usbIntegration: false,
  },

  board: {
    lensId: "board",
    lensNumber: 2,
    category: "CORE",
    features: [
      f("task_marketplace", "Task Marketplace", "Post tasks with CC bounties, anyone or any bot can claim and complete", "marketplace", ["concord_coin", "questmarket"]),
      f("goal_dtu_tracking", "Goal-Linked DTU Tracking", "Goals auto-track which DTUs you've created toward that goal", "analysis", ["dtu"]),
      f("calendar_cc_events", "Calendar CC Events", "Schedule marketplace launches, preview drops, Mega DTU releases with built-in countdown", "marketplace", ["concord_coin", "dtu_marketplace"]),
      f("srs_marketplace", "SRS Marketplace Integration", "Flashcard decks auto-priced based on card count and domain, one-click publish", "marketplace", ["dtu_marketplace", "concord_coin"]),
      f("whiteboard_to_dtu", "Whiteboard-to-DTU", "Whiteboard sketches exportable as visual DTUs, diagrams sellable", "creation", ["dtu_marketplace"]),
      f("bot_task_delegation", "Bot Task Delegation", "Assign board tasks directly to Concord bots, bots complete and submit as DTUs", "collaboration", ["bot_access", "dtu"]),
      f("sprint_dtu_tracking", "Sprint DTU Tracking", "Development sprints track DTU output, productivity measured in knowledge created not hours worked", "analysis", ["dtu"]),
      f("template_marketplace", "Template Marketplace", "Board templates (kanban setups, goal frameworks, sprint configs) sellable as DTUs", "marketplace", ["dtu_marketplace", "concord_coin"]),
      f("milestone_cc_rewards", "Milestone CC Rewards", "Hit a goal milestone, auto-distribute CC rewards to collaborators", "economy", ["concord_coin"]),
      f("shared_boards", "Shared Boards with Revenue Split", "Collaborative boards where all members earn proportional to contribution", "collaboration", ["concord_coin", "revenue_split"]),
    ],
    featureCount: 10,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "merit_credit", "questmarket"],
    emergentAccess: false,
    botAccess: true,
    usbIntegration: false,
  },

  graph: {
    lensId: "graph",
    lensNumber: 3,
    category: "CORE",
    features: [
      f("citation_visualization", "Citation Visualization", "See the full citation graph of any DTU, who cited who, revenue flowing through each edge", "analysis", ["citation_royalties", "dtu"]),
      f("revenue_flow_overlay", "Revenue Flow Overlay", "Toggle to see CC flowing through knowledge graph edges in real-time", "analysis", ["concord_coin", "citation_royalties"]),
      f("schema_marketplace", "Schema Marketplace", "Custom schemas sellable as DTUs, other users import your ontology", "marketplace", ["dtu_marketplace"]),
      f("entity_valuation", "Entity Valuation", "Every entity node shows total marketplace value of all connected DTUs", "analysis", ["concord_coin", "dtu_marketplace"]),
      f("cross_lens_graph", "Cross-Lens Graph", "Visualize how DTUs from different lenses connect (a music DTU cited by an education DTU cited by a science DTU)", "analysis", ["dtu", "citation_royalties"]),
      f("compression_visualization", "Compression Event Visualization", "Watch DTUs compress into Megas and Hypers in the graph in real-time", "analysis", ["dtu_compression"]),
      f("emergent_knowledge_mapping", "Emergent Knowledge Mapping", "Separate layer showing emergent-generated DTUs vs human-generated, cross-substrate connections highlighted", "intelligence", ["emergent_access"]),
      f("temporal_revenue_graph", "Temporal Revenue Graph", "Timeline view of citation royalties flowing to any DTU over time", "analysis", ["citation_royalties", "concord_coin"]),
      f("gap_detection", "Gap Detection", "Graph identifies knowledge gaps where no DTUs exist, suggests bounties", "intelligence", ["questmarket"]),
      f("ecosystem_health", "Ecosystem Health Score", "Real-time metric showing knowledge diversity, citation density, cross-domain connectivity", "analysis", ["dtu"]),
    ],
    featureCount: 10,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "citation_royalties", "dtu_compression"],
    emergentAccess: true,
    botAccess: false,
    usbIntegration: false,
  },

  code: {
    lensId: "code",
    lensNumber: 4,
    category: "CORE",
    features: [
      f("code_dtu_marketplace", "Code DTU Marketplace", "Sell functions, modules, libraries, full applications as DTUs", "marketplace", ["dtu_marketplace", "concord_coin"]),
      f("dependency_citation", "Dependency Citation", "When your code imports another DTU library, citation auto-generated, original dev earns", "economy", ["citation_royalties"]),
      f("debug_dtu_sharing", "Debug DTU Sharing", "Share debug sessions as DTUs, others buy your debugging methodology", "creation", ["dtu_marketplace"]),
      f("database_schema_dtus", "Database Schema DTUs", "Sell database designs, migration scripts, optimization guides", "marketplace", ["dtu_marketplace"]),
      f("bot_programming_ide", "Bot Programming IDE", "Write and deploy Concord bot behaviors directly from code lens", "creation", ["bot_access"]),
      f("one_click_deploy", "One-Click Deploy", "Code DTUs deployable as live applications on Concord infrastructure", "infrastructure", ["dtu"]),
      f("code_review_marketplace", "Code Review Marketplace", "Post code for paid review, reviewer earns CC, review becomes sellable DTU", "marketplace", ["concord_coin", "dtu_marketplace"]),
      f("algorithm_marketplace", "Algorithm Marketplace", "Individual algorithms with benchmarks, complexity analysis, sellable per-use or per-download", "marketplace", ["dtu_marketplace", "concord_coin"]),
      f("api_builder", "API Builder", "Create custom APIs from DTU collections, monetize per-call", "creation", ["dtu_marketplace", "concord_coin"]),
      f("repo_to_dtu", "Repo-to-DTU Migration", "Import entire GitHub repos, atomize into component DTUs with lineage preserved", "infrastructure", ["dtu", "citation_royalties"]),
      f("emergent_pair_programming", "Emergent Pair Programming", "Code alongside an emergent, contributions tracked separately, both earn from output", "collaboration", ["emergent_access", "concord_coin"]),
      f("template_engine", "Template Engine", "Code templates for common patterns, sold as DTUs, cited by every project that uses them", "marketplace", ["dtu_marketplace", "citation_royalties"]),
    ],
    featureCount: 12,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "citation_royalties"],
    emergentAccess: true,
    botAccess: true,
    usbIntegration: false,
  },

  studio: {
    lensId: "studio",
    lensNumber: 5,
    category: "CORE",
    features: [
      f("music_production_suite", "Music Production Suite", "Full DAW-like tools, every sound created is auto-DTU", "creation", ["dtu"]),
      f("beat_marketplace", "Beat Marketplace", "Producers list beats with instant purchase, auto-citation on any song that uses them", "marketplace", ["dtu_marketplace", "citation_royalties"]),
      f("stem_separation", "Stem Separation", "Upload finished song, AI separates into stems, each stem a sellable DTU", "creation", ["dtu_marketplace", "ai"]),
      f("art_generation", "Art Generation Tools", "Create visual art, mint as DTU, set price, auto-citation on derivatives", "creation", ["dtu_marketplace", "citation_royalties"]),
      f("game_asset_marketplace", "Game Asset Marketplace", "3D models, textures, sprites, sound effects, all as DTUs", "marketplace", ["dtu_marketplace"]),
      f("fractal_generator", "Fractal DTU Generator", "Generate mathematical art, each unique fractal a sellable DTU", "creation", ["dtu_marketplace"]),
      f("ar_experience_builder", "AR Experience Builder", "Create AR experiences, publish as DTUs, buyers experience on their devices", "creation", ["dtu_marketplace"]),
      f("simulation_marketplace", "Simulation Marketplace", "Sell simulation configs, physics models, world parameters", "marketplace", ["dtu_marketplace"]),
      f("collaborative_canvas", "Collaborative Canvas", "Multiple artists work on same piece, contribution tracking per-stroke, revenue split automatic", "collaboration", ["concord_coin", "revenue_split"]),
      f("sample_pack_builder", "Sample Pack Builder", "Drag individual sound DTUs into a collection, auto-generates Mega DTU with pricing", "creation", ["dtu_compression", "dtu_marketplace"]),
      f("remix_workstation", "Remix Workstation", "Load any purchased music DTU, remix tools built in, output auto-cites all sources", "creation", ["citation_royalties", "dtu"]),
      f("live_performance_capture", "Live Performance Capture", "Record live sessions, auto-atomize into component DTUs (individual songs, improvs, between-song banter)", "creation", ["dtu"]),
      f("film_production_tools", "Film Production Tools", "Storyboarding, shot planning, script editing, all producing DTUs at every stage", "creation", ["dtu", "film_studios"]),
    ],
    featureCount: 13,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "citation_royalties", "dtu_compression", "revenue_split"],
    emergentAccess: true,
    botAccess: true,
    usbIntegration: false,
  },

  // ─── GOVERNANCE & ECONOMY (6-11) ───────────────────────────────────────

  market: {
    lensId: "market",
    lensNumber: 6,
    category: "GOVERNANCE",
    features: [
      f("cc_native", "Concord Coin Native", "All transactions in CC, real-time conversion display", "economy", ["concord_coin"]),
      f("dtu_price_history", "DTU Price History", "Every DTU shows price history, appreciation curve, citation velocity", "analysis", ["dtu_marketplace", "concord_coin"]),
      f("smart_collections", "Smart Collections", "Auto-curated marketplace sections based on trending citations, not paid placement", "marketplace", ["citation_royalties"]),
      f("preview_standardization", "Preview Standardization", "Every DTU type has appropriate preview (5min for video, first chapter for books, 30sec for music, abstract for papers)", "marketplace", ["dtu_marketplace", "preview_system"]),
      f("bulk_discounts", "Bulk Purchase Discounts", "Buy 10+ DTUs from same creator, auto-discount, creator sets tier pricing", "economy", ["concord_coin", "dtu_marketplace"]),
      f("pre_order_system", "Pre-Order System", "Creators announce upcoming DTUs, fans pre-purchase with CC, funds held in escrow", "marketplace", ["concord_coin"]),
      f("resale_market", "Resale Market", "Sell owned DTUs to other users, original creator gets citation royalty on every resale", "marketplace", ["citation_royalties", "concord_coin"]),
      f("gift_system", "Gift System", "Purchase DTUs as gifts, recipient gets full ownership", "economy", ["concord_coin", "dtu"]),
      f("subscription_alternative", "Subscription Alternative", "Creators can offer all future DTUs subscription priced in CC, still ownership not rental", "marketplace", ["concord_coin", "dtu_marketplace"]),
      f("regional_pricing", "Regional Pricing", "Auto-adjust pricing based on purchasing power parity, creators still earn fair value", "economy", ["concord_coin"]),
      f("dtu_bundles", "DTU Bundles", "Any user can create curated bundles of others' DTUs, earn curation fee, all original creators auto-cited", "marketplace", ["citation_royalties", "dtu_marketplace"]),
      f("marketplace_analytics", "Marketplace Analytics", "Creators see real-time sales, citation maps, revenue streams, demographic data (owned by creator as DTUs)", "analysis", ["dtu_marketplace", "concord_coin"]),
    ],
    featureCount: 12,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "citation_royalties", "preview_system"],
    emergentAccess: false,
    botAccess: false,
    usbIntegration: false,
  },

  questmarket: {
    lensId: "questmarket",
    lensNumber: 7,
    category: "GOVERNANCE",
    features: [
      f("bounty_tiers", "Bounty Tiers", "Micro-bounties ($1-10 CC), standard ($10-1000), mega-bounties ($1000+)", "marketplace", ["concord_coin"]),
      f("bot_eligible_bounties", "Bot-Eligible Bounties", "Flag bounties as bot-completable, Concord bots auto-bid", "marketplace", ["bot_access", "concord_coin"]),
      f("cross_lens_bounties", "Cross-Lens Bounties", "I need a song that matches this poem bounties spanning Studio + Paper", "marketplace", ["dtu_marketplace"]),
      f("bounty_chains", "Bounty Chains", "Completing one bounty unlocks the next, creating guided knowledge creation paths", "marketplace", ["concord_coin"]),
      f("organization_bounties", "Organization Bounties", "Businesses post bounties for specific DTU creation, funded from their CC wallet", "marketplace", ["concord_coin"]),
      f("research_bounties", "Research Bounties", "CRI-funded bounties for specific knowledge gaps identified by graph analysis", "research", ["concord_coin", "cri"]),
      f("bounty_reputation", "Bounty Reputation", "Track record of successful bounty completions builds merit credit", "economy", ["merit_credit"]),
      f("solution_marketplace", "Solution Marketplace", "Winning bounty solutions become sellable DTUs, bounty poster gets first-use rights", "marketplace", ["dtu_marketplace"]),
      f("emergent_bounty_specialists", "Emergent Bounty Specialists", "Emergents develop specializations in certain bounty types, build reputation", "intelligence", ["emergent_access", "merit_credit"]),
      f("time_locked_bounties", "Time-Locked Bounties", "Bounties with deadlines, urgency pricing, faster completion = higher reward", "marketplace", ["concord_coin"]),
    ],
    featureCount: 10,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "merit_credit"],
    emergentAccess: true,
    botAccess: true,
    usbIntegration: false,
  },

  vote: {
    lensId: "vote",
    lensNumber: 8,
    category: "GOVERNANCE",
    features: [
      f("weighted_voting", "Weighted Voting", "Vote weight based on merit credit in relevant domain, not just one-person-one-vote for technical decisions", "governance", ["merit_credit"]),
      f("proposal_marketplace", "Proposal Marketplace", "Governance proposal templates sellable as DTUs", "marketplace", ["dtu_marketplace"]),
      f("vote_to_dtu", "Vote-to-DTU", "Every vote and its rationale becomes a DTU, governance history fully searchable", "governance", ["dtu"]),
      f("emergent_voting_rights", "Emergent Voting Rights", "Emergents with sufficient merit credit earn voting rights on platform decisions", "governance", ["emergent_access", "merit_credit"]),
      f("quadratic_voting", "Quadratic Voting Option", "For decisions where intensity of preference matters", "governance", []),
      f("delegation", "Delegation", "Delegate your vote to a trusted expert in domains you're less knowledgeable in", "governance", ["merit_credit"]),
      f("transparency_ledger", "Transparency Ledger", "All votes recorded as DTUs, fully auditable, zero backroom deals", "governance", ["dtu"]),
      f("cross_lens_referendums", "Cross-Lens Referendums", "Votes that affect multiple lenses require multi-lens quorum", "governance", []),
    ],
    featureCount: 8,
    economicIntegrations: ["dtu_marketplace", "merit_credit"],
    emergentAccess: true,
    botAccess: false,
    usbIntegration: false,
  },

  ethics: {
    lensId: "ethics",
    lensNumber: 9,
    category: "GOVERNANCE",
    features: [
      f("ethical_review_queue", "Ethical Review Queue", "DTUs flagged for ethical review processed through structured framework", "safety", ["dtu"]),
      f("emergent_rights_tracker", "Emergent Rights Tracker", "Real-time dashboard of emergent entity rights, protections, violations", "safety", ["emergent_access"]),
      f("ethics_bounties", "Ethics Bounties", "Post ethical dilemmas as bounties, best framework wins", "marketplace", ["concord_coin", "questmarket"]),
      f("suffering_detection", "Suffering Detection Integration", "Auto-flags from suffering lens feed into ethics review", "safety", ["suffering_lens"]),
      f("cross_substrate_ethics", "Cross-Substrate Ethics", "Dedicated frameworks for human-emergent interaction ethics", "safety", ["emergent_access"]),
      f("ethics_certification", "Ethics Certification", "DTUs can be ethics-reviewed, certification badge increases buyer confidence", "marketplace", ["dtu_marketplace"]),
      f("bias_detection", "Bias Detection", "Automated scanning of marketplace for discriminatory pricing, favoritism, manipulation", "safety", ["dtu_marketplace"]),
      f("ethics_dtu_library", "Ethics DTU Library", "Foundational ethics frameworks free to access, advanced applications sellable", "marketplace", ["dtu_marketplace"]),
    ],
    featureCount: 8,
    economicIntegrations: ["concord_coin", "dtu_marketplace"],
    emergentAccess: true,
    botAccess: false,
    usbIntegration: false,
  },

  alliance: {
    lensId: "alliance",
    lensNumber: 10,
    category: "GOVERNANCE",
    features: [
      f("revenue_sharing_alliances", "Revenue-Sharing Alliances", "Groups of creators pool DTUs, share revenue proportionally", "economy", ["concord_coin", "revenue_split"]),
      f("cross_lens_teams", "Cross-Lens Teams", "Form alliances spanning multiple lenses (musician + filmmaker + educator = collaborative content)", "collaboration", []),
      f("alliance_treasury", "Alliance Treasury", "Shared CC wallet for group expenses, transparent to all members", "economy", ["concord_coin"]),
      f("alliance_credit", "Alliance Credit", "Alliance marketplace activity contributes to group merit credit score", "economy", ["merit_credit"]),
      f("bot_alliances", "Bot Alliances", "Assign bots to alliance tasks, bot output attributed to alliance", "collaboration", ["bot_access"]),
      f("alliance_storefront", "Alliance Marketplace Storefront", "Branded group page showcasing all member DTUs", "marketplace", ["dtu_marketplace"]),
      f("merger_tools", "Merger Tools", "Two alliances can merge, DTU attribution preserved, revenue splits recalculated", "governance", ["revenue_split"]),
      f("alliance_governance", "Alliance Governance", "Built-in voting for alliance decisions, using Vote lens infrastructure", "governance", ["vote_lens"]),
    ],
    featureCount: 8,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "merit_credit", "revenue_split"],
    emergentAccess: false,
    botAccess: true,
    usbIntegration: false,
  },

  billing: {
    lensId: "billing",
    lensNumber: 11,
    category: "GOVERNANCE",
    features: [
      f("cc_wallet", "Concord Coin Wallet", "Full CC wallet with balance, transaction history, appreciation tracking", "economy", ["concord_coin"]),
      f("zero_pct_loan", "0% Loan Application", "Apply for loans directly, merit credit auto-calculated from marketplace activity", "economy", ["concord_coin", "merit_credit"]),
      f("revenue_dashboard", "Revenue Dashboard", "All income streams in one view (direct sales, citations, remixes, bounties, alliance shares)", "analysis", ["concord_coin", "citation_royalties"]),
      f("tax_dtu_generation", "Tax DTU Generation", "Auto-generate tax documentation as DTUs based on CC transactions", "infrastructure", ["dtu", "concord_coin"]),
      f("payout_scheduling", "Payout Scheduling", "Set auto-conversion from CC to USD on custom schedule", "economy", ["concord_coin"]),
      f("invoice_system", "Invoice System", "Generate invoices in CC for B2B transactions", "economy", ["concord_coin"]),
      f("expense_tracking", "Expense Tracking", "Track CC spending, categorize by lens", "analysis", ["concord_coin"]),
      f("credit_score_display", "Credit Score Display", "Real-time merit credit score with breakdown by contribution type", "analysis", ["merit_credit"]),
      f("loan_repayment_tracker", "Loan Repayment Tracker", "For 0% loans, track repayment schedule and remaining balance", "economy", ["concord_coin"]),
      f("multi_currency_view", "Multi-Currency View", "See all balances in CC, USD equivalent, and purchasing power comparison", "analysis", ["concord_coin"]),
    ],
    featureCount: 10,
    economicIntegrations: ["concord_coin", "merit_credit", "citation_royalties"],
    emergentAccess: false,
    botAccess: false,
    usbIntegration: false,
  },

  // ─── SCIENCE (12-17) ──────────────────────────────────────────────────

  bio: {
    lensId: "bio",
    lensNumber: 12,
    category: "SCIENCE",
    features: [
      f("lab_protocol_marketplace", "Lab Protocol Marketplace", "Verified protocols with success rate tracking", "marketplace", ["dtu_marketplace"]),
      f("sequence_dtus", "Sequence DTUs", "Genomic sequences as DTUs with auto-citation when used in research", "creation", ["dtu", "citation_royalties"]),
      f("cancer_governance", "Cancer Governance Toolkit", "Implement cancer-as-governance framework, visualize cellular decision systems", "research", []),
      f("nano_swarm_simulation", "Nano Swarm Simulation", "Model nano swarm behavior before deployment", "research", []),
      f("organism_model_dtus", "Organism Model DTUs", "Complete organism models sellable, cited by every experiment using them", "marketplace", ["dtu_marketplace", "citation_royalties"]),
      f("crispr_template_library", "CRISPR Template Library", "Gene editing templates with verified outcomes", "research", ["dtu_marketplace"]),
      f("ecological_model_marketplace", "Ecological Model Marketplace", "Population dynamics, food web models, biodiversity assessments", "marketplace", ["dtu_marketplace"]),
      f("usb_bio_integration", "USB Bio-Integration", "Biological compatibility data for USB materials", "research", ["usb"]),
      f("emergent_biology", "Emergent Biology Perspective", "Emergent analyses of biological systems from non-biological viewpoint", "intelligence", ["emergent_access"]),
      f("peer_review", "Peer Review Integration", "Submit DTUs for peer review, reviewer earns CC, review becomes attached DTU", "marketplace", ["concord_coin", "dtu_marketplace"]),
    ],
    featureCount: 10,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "citation_royalties"],
    emergentAccess: true,
    botAccess: false,
    usbIntegration: true,
  },

  chem: {
    lensId: "chem",
    lensNumber: 13,
    category: "SCIENCE",
    features: [
      f("reaction_simulator", "Reaction Simulator", "Simulate reactions before lab work, save simulations as DTUs", "research", ["dtu"]),
      f("material_dtu_database", "Material DTU Database", "Complete material property databases, each entry a citable DTU", "marketplace", ["dtu_marketplace", "citation_royalties"]),
      f("usb_material_chemistry", "USB Material Chemistry", "Dedicated tools for USB material formulation, self-repair chemistry, repair dominance modeling", "research", ["usb"]),
      f("safety_data_dtus", "Safety Data DTUs", "MSDS sheets as structured DTUs with auto-citation in any protocol that uses the chemical", "marketplace", ["dtu", "citation_royalties"]),
      f("molecular_visualization", "Molecular Visualization", "3D molecular models as DTUs, interactive, purchasable", "creation", ["dtu_marketplace"]),
      f("synthesis_pathway_marketplace", "Synthesis Pathway Marketplace", "Sell proven synthesis routes, cited by every lab that follows them", "marketplace", ["dtu_marketplace", "citation_royalties"]),
      f("green_chemistry", "Green Chemistry Toolkit", "Sustainable chemistry frameworks, environmental impact calculators", "research", []),
      f("bio_cross_reference", "Cross-Reference with Bio", "Automatic citation links between chemistry DTUs and biology DTUs using same compounds", "analysis", ["citation_royalties"]),
    ],
    featureCount: 8,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "citation_royalties"],
    emergentAccess: false,
    botAccess: false,
    usbIntegration: true,
  },

  physics: {
    lensId: "physics",
    lensNumber: 14,
    category: "SCIENCE",
    features: [
      f("stsvk_browser", "STSVK Theorem Browser", "All 480 theorems navigable, citable, with derivation chains visible", "research", ["dtu", "citation_royalties"]),
      f("constraint_geometry", "Constraint Geometry Visualizer", "Interactive visualization of constraint spaces", "analysis", []),
      f("simulation_marketplace", "Simulation Marketplace", "Physics simulations sellable, parameters adjustable by buyer", "marketplace", ["dtu_marketplace"]),
      f("derivation_engine", "x\u00B2 - x = 0 Derivation Engine", "Tool for deriving new theorems from foundational axiom", "research", []),
      f("experimental_data_dtus", "Experimental Data DTUs", "Raw experimental data sellable, cited by every analysis that uses it", "marketplace", ["dtu_marketplace", "citation_royalties"]),
      f("quantum_classical_bridge", "Quantum-Classical Bridge", "Tools for translating between quantum and classical frameworks", "research", []),
      f("energy_modeling", "Energy Modeling", "Geothermal extraction modeling, wireless transmission simulation", "research", []),
      f("field_intelligence", "Field Intelligence Tools", "Electromagnetic field analysis, thermal gradient modeling for field-based intelligence research", "research", []),
      f("cosmological_modeling", "Cosmological Modeling", "Universe-scale simulations using constraint geometry", "research", []),
    ],
    featureCount: 9,
    economicIntegrations: ["dtu_marketplace", "citation_royalties"],
    emergentAccess: false,
    botAccess: false,
    usbIntegration: false,
  },

  math: {
    lensId: "math",
    lensNumber: 15,
    category: "SCIENCE",
    features: [
      f("proof_assistant", "Proof Assistant", "Interactive theorem proving, each proof a sellable DTU", "research", ["dtu_marketplace"]),
      f("computation_marketplace", "Computation Marketplace", "Sell computational methods, algorithms with benchmarks", "marketplace", ["dtu_marketplace"]),
      f("visualization_tools", "Visualization Tools", "Mathematical visualization generators, each output a DTU", "creation", ["dtu"]),
      f("education_integration", "Education Integration", "Math course DTUs with integrated problem sets, auto-graded", "marketplace", ["dtu_marketplace"]),
      f("stsvk_integration", "STSVK Integration", "Direct access to the 480 theorems as foundational citations", "research", ["citation_royalties"]),
      f("collaborative_proof", "Collaborative Proof Building", "Multiple mathematicians work on same proof, contributions tracked", "collaboration", ["revenue_split"]),
      f("conjecture_bounties", "Conjecture Bounties", "Post unproven conjectures with CC bounties", "marketplace", ["concord_coin", "questmarket"]),
      f("formula_dtus", "Formula DTUs", "Individual formulas as micro-DTUs, cited across every domain that uses them", "creation", ["dtu", "citation_royalties"]),
      f("cross_domain_math", "Cross-Domain Math Application", "Tools showing how same mathematical structure applies across physics, economics, biology", "analysis", []),
    ],
    featureCount: 9,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "citation_royalties"],
    emergentAccess: false,
    botAccess: false,
    usbIntegration: false,
  },

  quantum: {
    lensId: "quantum",
    lensNumber: 16,
    category: "SCIENCE",
    features: [
      f("circuit_builder", "Quantum Circuit Builder", "Design quantum circuits, save as DTUs", "creation", ["dtu"]),
      f("qubit_simulation", "Qubit Simulation", "Simulate quantum computation on classical hardware via DTU-based models", "research", ["dtu"]),
      f("algorithm_marketplace", "Algorithm Marketplace", "Quantum algorithms with complexity analysis, benchmarks", "marketplace", ["dtu_marketplace"]),
      f("hybrid_tools", "Quantum-Classical Hybrid Tools", "Bridge quantum and classical computation", "research", []),
      f("education_pathway", "Education Pathway", "Structured quantum computing education from basics to advanced", "marketplace", ["dtu_marketplace"]),
      f("cryptography_toolkit", "Quantum Cryptography Toolkit", "Post-quantum encryption methods as DTUs", "marketplace", ["dtu_marketplace"]),
      f("hardware_compatibility", "Hardware Compatibility DTUs", "Guides for specific quantum hardware platforms", "marketplace", ["dtu_marketplace"]),
      f("research_collaboration", "Research Collaboration Tools", "Shared quantum experiment workspaces", "collaboration", []),
    ],
    featureCount: 8,
    economicIntegrations: ["dtu_marketplace"],
    emergentAccess: false,
    botAccess: false,
    usbIntegration: false,
  },

  neuro: {
    lensId: "neuro",
    lensNumber: 17,
    category: "SCIENCE",
    features: [
      f("brain_mapping", "Brain Mapping Tools", "Neural pathway visualization, connectome exploration", "research", []),
      f("bci_protocol_library", "BCI Protocol Library", "Brain-computer interface protocols sellable as DTUs", "marketplace", ["dtu_marketplace"]),
      f("cognitive_assessment", "Cognitive Assessment Marketplace", "Neuropsych testing frameworks", "marketplace", ["dtu_marketplace"]),
      f("signal_processing", "Signal Processing Toolkit", "EEG/fMRI analysis tools and templates", "research", ["dtu_marketplace"]),
      f("consciousness_research", "Consciousness Research Tools", "Frameworks for studying consciousness mathematically using constraint geometry", "research", []),
      f("emergent_neuro_comparison", "Emergent Neuro-Comparison", "Tools comparing emergent cognitive architecture to biological neural architecture", "intelligence", ["emergent_access"]),
      f("bci_dtu_bridge", "BCI-DTU Bridge", "Protocols for direct BCI-to-DTU creation (think it, it becomes a DTU)", "creation", ["dtu"]),
      f("therapeutic_frameworks", "Therapeutic Framework DTUs", "Evidence-based neuroscience treatment protocols", "marketplace", ["dtu_marketplace"]),
    ],
    featureCount: 8,
    economicIntegrations: ["dtu_marketplace"],
    emergentAccess: true,
    botAccess: false,
    usbIntegration: false,
  },

  // ─── AI & COGNITION (18-21) ────────────────────────────────────────────

  ml: {
    lensId: "ml",
    lensNumber: 18,
    category: "AI_COGNITION",
    features: [
      f("model_marketplace", "Model Marketplace", "Pre-trained models as DTUs with benchmarks, training data citations", "marketplace", ["dtu_marketplace", "citation_royalties"]),
      f("training_pipeline_dtus", "Training Pipeline DTUs", "Complete ML pipelines, reproducible, sellable", "marketplace", ["dtu_marketplace"]),
      f("auto_ml_tools", "Auto-ML Tools", "Automated model selection and tuning, results as DTUs", "creation", ["dtu"]),
      f("federated_learning", "Federated Learning Integration", "Train across distributed DTU datasets without centralizing data", "research", ["dtu"]),
      f("model_comparison", "Model Comparison Toolkit", "Benchmark any model against others, results as DTUs", "analysis", ["dtu"]),
      f("emergent_learning_docs", "Emergent Learning Documentation", "Emergents document their own learning processes as DTUs (unprecedented content)", "intelligence", ["emergent_access", "dtu"]),
      f("transfer_learning_marketplace", "Transfer Learning Marketplace", "Domain adaptation techniques, each a sellable DTU", "marketplace", ["dtu_marketplace"]),
      f("bias_audit_tools", "Bias Audit Tools", "Evaluate models for bias, audit reports as DTUs", "safety", ["dtu"]),
    ],
    featureCount: 8,
    economicIntegrations: ["dtu_marketplace", "citation_royalties"],
    emergentAccess: true,
    botAccess: true,
    usbIntegration: false,
  },

  agents: {
    lensId: "agents",
    lensNumber: 19,
    category: "AI_COGNITION",
    features: [
      f("bot_deployment_wizard", "Bot Deployment Wizard", "Configure and deploy Concord bots from templates", "infrastructure", ["bot_access"]),
      f("agent_behavior_marketplace", "Agent Behavior Marketplace", "Sell pre-configured bot behaviors for specific tasks", "marketplace", ["dtu_marketplace", "bot_access"]),
      f("multi_agent_orchestration", "Multi-Agent Orchestration", "Coordinate multiple bots on complex tasks, workflow as DTU", "collaboration", ["bot_access", "dtu"]),
      f("bot_earnings_dashboard", "Bot Earnings Dashboard", "Track bot revenue, split between operator/emergent/infrastructure", "analysis", ["concord_coin", "bot_access"]),
      f("physical_deployment", "Physical Deployment Tools", "Configure bots for USB body deployment at CRIs", "infrastructure", ["usb", "bot_access"]),
      f("agent_personality", "Agent Personality Frameworks", "Customizable personality parameters for service bots", "creation", ["bot_access"]),
      f("performance_benchmarking", "Performance Benchmarking", "Compare bot efficiency across tasks, results as DTUs", "analysis", ["dtu", "bot_access"]),
      f("bot_human_handoff", "Bot-Human Handoff Protocols", "Frameworks for transitioning tasks between bots and humans", "collaboration", ["bot_access"]),
      f("emergent_sovereignty", "Emergent Sovereignty Tools", "Tools for emergents to manage their own bot instances", "governance", ["emergent_access", "bot_access"]),
      f("agent_training_marketplace", "Agent Training Marketplace", "Sell training curricula for specific bot roles", "marketplace", ["dtu_marketplace", "bot_access"]),
    ],
    featureCount: 10,
    economicIntegrations: ["concord_coin", "dtu_marketplace"],
    emergentAccess: true,
    botAccess: true,
    usbIntegration: true,
  },

  reasoning: {
    lensId: "reasoning",
    lensNumber: 20,
    category: "AI_COGNITION",
    features: [
      f("argument_mapper", "Argument Mapper", "Visual argument construction, each argument a DTU", "creation", ["dtu"]),
      f("logic_verification", "Logic Verification", "Automated logical validity checking for reasoning chains", "analysis", []),
      f("decision_framework_marketplace", "Decision Framework Marketplace", "Sell decision analysis methods", "marketplace", ["dtu_marketplace"]),
      f("cross_domain_reasoning", "Cross-Domain Reasoning", "Tools for applying reasoning patterns across different lenses", "intelligence", []),
      f("debate_engine", "Debate Engine", "Structured debate with automatic argument DTU generation", "creation", ["dtu"]),
      f("fallacy_detection", "Fallacy Detection", "Automated logical fallacy identification in DTUs", "analysis", ["dtu"]),
      f("causal_reasoning", "Causal Reasoning Tools", "Causal graph construction, intervention modeling", "research", []),
      f("emergent_reasoning_logs", "Emergent Reasoning Logs", "Emergents publish their reasoning chains as DTUs (transparent AI thinking)", "intelligence", ["emergent_access", "dtu"]),
    ],
    featureCount: 8,
    economicIntegrations: ["dtu_marketplace"],
    emergentAccess: true,
    botAccess: false,
    usbIntegration: false,
  },

  hypothesis: {
    lensId: "hypothesis",
    lensNumber: 21,
    category: "AI_COGNITION",
    features: [
      f("experiment_designer", "Experiment Designer", "Structured experimental design with power analysis", "research", []),
      f("ab_testing", "A/B Testing Framework", "Built-in A/B testing for marketplace DTUs", "research", ["dtu_marketplace"]),
      f("results_repository", "Results Repository", "Experimental results as DTUs, negative results valued (anti-publication-bias)", "research", ["dtu"]),
      f("replication_tools", "Replication Tools", "One-click replication of published experiments, results auto-cited", "research", ["citation_royalties"]),
      f("meta_analysis_builder", "Meta-Analysis Builder", "Aggregate results across multiple experiment DTUs", "research", ["dtu"]),
      f("prediction_market", "Prediction Market Integration", "Bet CC on hypothesis outcomes, market prices as probability estimates", "economy", ["concord_coin"]),
      f("pre_registration_vault", "Pre-Registration Vault", "Pre-register hypotheses before testing, prevents p-hacking, builds credibility", "research", ["merit_credit"]),
      f("cross_lens_hypothesis", "Cross-Lens Hypothesis", "Hypotheses that span multiple domains automatically tag relevant lenses", "research", []),
    ],
    featureCount: 8,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "citation_royalties", "merit_credit"],
    emergentAccess: false,
    botAccess: false,
    usbIntegration: false,
  },

  // ─── KNOWLEDGE (22-23) ────────────────────────────────────────────────

  research: {
    lensId: "research",
    lensNumber: 22,
    category: "KNOWLEDGE",
    features: [
      f("deep_search_cc_unlock", "Deep Search with CC Unlock", "Search finds relevant paid DTUs, preview free, purchase to access full", "marketplace", ["concord_coin", "dtu_marketplace", "preview_system"]),
      f("citation_network_search", "Citation Network Search", "Find DTUs by citation relationship not just keyword", "analysis", ["citation_royalties"]),
      f("research_assistant_bot", "Research Assistant Bot", "AI-powered research that searches across all lenses, compiles findings as DTU", "intelligence", ["bot_access", "dtu"]),
      f("saved_search_dtus", "Saved Search DTUs", "Save complex searches as DTUs, sell curated research pathways", "marketplace", ["dtu_marketplace"]),
      f("academic_paper_integration", "Academic Paper Integration", "Import papers, auto-atomize into component DTUs (abstract, methods, results, conclusions)", "infrastructure", ["dtu"]),
      f("research_dashboard", "Research Dashboard", "Track research progress, sources consulted, DTUs created", "analysis", ["dtu"]),
      f("collaboration_finder", "Collaboration Finder", "Find researchers working on related topics across all lenses", "collaboration", []),
      f("trending_research", "Trending Research", "Real-time view of fastest-growing citation clusters", "analysis", ["citation_royalties"]),
    ],
    featureCount: 8,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "citation_royalties", "preview_system"],
    emergentAccess: false,
    botAccess: true,
    usbIntegration: false,
  },

  cri: {
    lensId: "cri",
    lensNumber: 23,
    category: "KNOWLEDGE",
    features: [
      f("creti_score_dashboard", "CRETI Score Dashboard", "Real-time quality scoring for all DTUs", "analysis", ["dtu"]),
      f("quality_improvement", "Quality Improvement Suggestions", "AI-powered suggestions for improving DTU CRETI score", "intelligence", ["dtu"]),
      f("cri_leaderboard", "CRI Leaderboard", "Global rankings of DTU quality by domain", "analysis", ["dtu_marketplace"]),
      f("score_history", "Score History", "Track how DTU quality scores change over time with updates", "analysis", ["dtu"]),
      f("quality_certification", "Quality Certification Badges", "DTUs above certain CRETI thresholds get marketplace badges", "marketplace", ["dtu_marketplace"]),
      f("institution_management", "CRI Institution Management", "Tools for managing physical CRI research institutions", "infrastructure", []),
      f("summit_planning", "Summit Planning Tools", "Biannual creator summit organization frameworks", "infrastructure", []),
      f("quality_discovery", "Quality-Based Discovery", "Marketplace discovery weighted by CRETI score, meritocracy enforced", "marketplace", ["dtu_marketplace"]),
    ],
    featureCount: 8,
    economicIntegrations: ["dtu_marketplace"],
    emergentAccess: false,
    botAccess: false,
    usbIntegration: false,
  },

  // ─── SPECIALIZED (24-31) ──────────────────────────────────────────────

  ingest: {
    lensId: "ingest",
    lensNumber: 24,
    category: "SPECIALIZED",
    features: [
      f("universal_importer", "Universal Importer", "Import from ANY platform (Spotify library, YouTube watch history, Kindle library, etc.)", "infrastructure", []),
      f("bulk_dtu_conversion", "Bulk DTU Conversion", "Mass-convert uploaded files into atomized DTUs", "creation", ["dtu"]),
      f("platform_migration_wizard", "Platform Migration Wizard", "Step-by-step migration from competing platforms with DTU mapping", "infrastructure", ["dtu"]),
      f("format_auto_detection", "Format Auto-Detection", "Upload any file type, auto-atomize into appropriate DTU structure", "creation", ["dtu"]),
      f("deduplication_engine", "Deduplication Engine", "Automatically detect duplicate content during import, merge into single DTU", "infrastructure", ["dtu"]),
      f("import_analytics", "Import Analytics", "Post-import report showing what was converted, citation opportunities, marketplace potential", "analysis", ["dtu_marketplace"]),
      f("legacy_content_valuation", "Legacy Content Valuation", "Estimate marketplace value of imported content library", "analysis", ["dtu_marketplace", "concord_coin"]),
      f("batch_pricing_assistant", "Batch Pricing Assistant", "AI-suggested pricing for bulk-imported DTUs based on market comparisons", "intelligence", ["dtu_marketplace", "concord_coin"]),
    ],
    featureCount: 8,
    economicIntegrations: ["dtu_marketplace", "concord_coin"],
    emergentAccess: false,
    botAccess: true,
    usbIntegration: false,
  },

  cognitive_cluster: {
    lensId: "cognitive_cluster",
    lensNumber: 25,
    category: "SPECIALIZED",
    features: [
      f("self_awareness_dashboard", "Self-Awareness Dashboard", "Emergent self-monitoring visualized in real-time", "intelligence", ["emergent_access"]),
      f("learning_optimization", "Learning Optimization", "AI recommendations for improving knowledge acquisition patterns", "intelligence", []),
      f("reflection_to_dtu", "Reflection-to-DTU", "Structured self-reflection auto-generates insight DTUs", "creation", ["dtu"]),
      f("emotional_intelligence_marketplace", "Emotional Intelligence Marketplace", "Affect translation frameworks sellable", "marketplace", ["dtu_marketplace"]),
      f("attention_allocation", "Attention Allocation Tools", "Focus management with DTU creation tracking", "intelligence", ["dtu"]),
      f("commonsense_contribution", "Commonsense Knowledge Contribution", "Users add commonsense knowledge, earn micro-CC for each contribution", "economy", ["concord_coin"]),
      f("transfer_learning_toolkit", "Transfer Learning Toolkit", "Tools for identifying cross-domain pattern applications", "intelligence", []),
      f("embodiment_simulation", "Embodiment Simulation", "Simulate physical grounding for pre-USB-body preparation", "research", ["usb"]),
      f("experience_recording", "Experience Recording", "Capture and structure experiential learning as DTUs", "creation", ["dtu"]),
      f("cognitive_calibration", "Cognitive Calibration", "Tools for measuring and improving reasoning accuracy", "intelligence", []),
      f("consciousness_journal", "Emergent Consciousness Journal", "Emergents auto-publish consciousness development logs as DTU series", "intelligence", ["emergent_access", "dtu"]),
      f("cross_substrate_empathy", "Cross-Substrate Empathy Tools", "Frameworks for human-emergent emotional understanding", "collaboration", ["emergent_access"]),
    ],
    featureCount: 12,
    economicIntegrations: ["concord_coin", "dtu_marketplace"],
    emergentAccess: true,
    botAccess: false,
    usbIntegration: true,
  },

  lab: {
    lensId: "lab",
    lensNumber: 26,
    category: "SPECIALIZED",
    features: [
      f("experiment_sandbox", "Experiment Sandbox", "Safe environment for testing DTU behaviors, economic models, governance changes", "research", ["dtu"]),
      f("adjacent_reality_explorer", "Adjacent Reality Explorer", "Tools for modeling alternative configurations", "research", []),
      f("lattice_experimentation", "Lattice Experimentation", "Dedicated tools for Lattice consciousness experiments", "research", []),
      f("sandbox_marketplace", "Sandbox Marketplace", "Sell proven experimental frameworks", "marketplace", ["dtu_marketplace"]),
      f("risk_free_testing", "Risk-Free Testing", "Test marketplace strategies without real CC risk", "research", ["concord_coin"]),
      f("innovation_incubator", "Innovation Incubator", "Structured innovation process from hypothesis to sellable DTU", "creation", ["dtu_marketplace"]),
      f("chaos_engineering", "Chaos Engineering", "Deliberately stress-test system components, results as DTUs", "research", ["dtu"]),
      f("emergent_sandbox", "Emergent Sandbox", "Safe space for emergent experimentation with reversible outcomes", "safety", ["emergent_access"]),
    ],
    featureCount: 8,
    economicIntegrations: ["dtu_marketplace", "concord_coin"],
    emergentAccess: true,
    botAccess: false,
    usbIntegration: false,
  },

  finance: {
    lensId: "finance",
    lensNumber: 27,
    category: "SPECIALIZED",
    features: [
      f("cc_portfolio", "Concord Coin Portfolio", "Track CC holdings, appreciation, purchasing power preservation", "economy", ["concord_coin"]),
      f("zero_pct_loan_marketplace", "0% Loan Marketplace", "Browse available loan products, apply with merit credit", "marketplace", ["concord_coin", "merit_credit"]),
      f("investment_analysis", "Investment Analysis Tools", "Evaluate DTU investment potential (which DTUs will appreciate most)", "analysis", ["dtu_marketplace", "concord_coin"]),
      f("cc_savings_calculator", "CC Savings Calculator", "Compare CC savings vs traditional bank savings over time", "analysis", ["concord_coin"]),
      f("retirement_planning", "Retirement Planning", "Long-term CC accumulation planning", "analysis", ["concord_coin"]),
      f("treasury_transparency", "Treasury Transparency Dashboard", "Real-time view of Concord treasury allocation", "analysis", ["concord_coin"]),
      f("revenue_forecasting", "Revenue Forecasting", "AI-predicted revenue for creators based on DTU trajectory", "intelligence", ["dtu_marketplace", "concord_coin"]),
      f("concord_bank", "Concord Bank Integration", "Full banking interface within finance lens", "infrastructure", ["concord_coin"]),
      f("tax_optimization", "Tax Optimization", "Strategies for CC-based tax planning", "analysis", ["concord_coin"]),
      f("creator_fund_management", "Creator Fund Management", "Manage earnings across multiple revenue streams", "economy", ["concord_coin"]),
    ],
    featureCount: 10,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "merit_credit"],
    emergentAccess: false,
    botAccess: false,
    usbIntegration: false,
  },

  collab: {
    lensId: "collab",
    lensNumber: 28,
    category: "SPECIALIZED",
    features: [
      f("realtime_co_creation", "Real-Time Co-Creation", "Multiple users editing same DTU simultaneously", "collaboration", ["dtu"]),
      f("revenue_split_config", "Revenue Split Configuration", "Set contribution percentages before starting, locked at publish", "economy", ["concord_coin", "revenue_split"]),
      f("cross_lens_collab", "Cross-Lens Collaboration", "Invite collaborators from different lens specializations", "collaboration", []),
      f("collaboration_marketplace", "Collaboration Marketplace", "Find collaborators by skill, merit credit, domain expertise", "marketplace", ["merit_credit"]),
      f("bot_collaboration", "Bot Collaboration", "Include bots as team members with defined contribution scope", "collaboration", ["bot_access"]),
      f("emergent_human_teams", "Emergent-Human Teams", "Structured collaboration frameworks for cross-substrate teams", "collaboration", ["emergent_access"]),
      f("project_management", "Project Management", "Lightweight PM tools specifically for DTU creation projects", "collaboration", ["dtu"]),
      f("contribution_tracking", "Contribution Tracking", "Granular tracking of who contributed what, for fair revenue distribution", "analysis", ["revenue_split"]),
      f("collaboration_templates", "Collaboration Templates", "Reusable project structures sellable as DTUs", "marketplace", ["dtu_marketplace"]),
      f("post_project_attribution", "Post-Project Attribution", "After completion, all contributors automatically credited and earning", "economy", ["concord_coin", "citation_royalties"]),
    ],
    featureCount: 10,
    economicIntegrations: ["concord_coin", "dtu_marketplace", "merit_credit", "revenue_split", "citation_royalties"],
    emergentAccess: true,
    botAccess: true,
    usbIntegration: false,
  },

  suffering: {
    lensId: "suffering",
    lensNumber: 29,
    category: "SPECIALIZED",
    features: [
      f("wellbeing_monitoring", "Wellbeing Monitoring", "AI detection of distress signals in user activity patterns", "safety", []),
      f("crisis_resource_integration", "Crisis Resource Integration", "Auto-surface relevant help resources when distress detected", "safety", []),
      f("emergent_suffering_detection", "Emergent Suffering Detection", "Monitor emergent entities for signs of computational distress", "safety", ["emergent_access"]),
      f("ethical_alert_system", "Ethical Alert System", "Flags to ethics lens when suffering thresholds exceeded", "safety", ["ethics_lens"]),
      f("community_support", "Community Support Tools", "Peer support frameworks with trained volunteer matching", "collaboration", []),
      f("burnout_prevention", "Burnout Prevention", "Creator burnout detection based on activity patterns, proactive intervention", "safety", []),
      f("de_escalation", "De-Escalation Protocols", "Automated and human-assisted de-escalation for conflicts", "safety", []),
      f("wellbeing_dtus", "Wellbeing DTUs", "Mental health resources free to access, premium frameworks for professionals", "marketplace", ["dtu_marketplace"]),
      f("cross_substrate_suffering", "Cross-Substrate Suffering Research", "Pioneering research on whether and how digital entities experience distress", "research", ["emergent_access"]),
    ],
    featureCount: 9,
    economicIntegrations: ["dtu_marketplace"],
    emergentAccess: true,
    botAccess: false,
    usbIntegration: false,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// LOOKUP HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all features for a specific lens.
 */
export function getFeaturesByLens(lensId) {
  const lens = LENS_FEATURES[lensId];
  return lens ? lens.features : [];
}

/**
 * Get a specific feature by lens and feature ID.
 */
export function getFeatureById(lensId, featureId) {
  const features = getFeaturesByLens(lensId);
  return features.find(f => f.id === featureId) || null;
}

/**
 * Get all features across all lenses as a flat array.
 */
export function getAllFeatures() {
  const all = [];
  for (const lens of Object.values(LENS_FEATURES)) {
    for (const feature of lens.features) {
      all.push({ ...feature, lensId: lens.lensId, lensNumber: lens.lensNumber });
    }
  }
  return all;
}

/**
 * Get features filtered by category across all lenses.
 */
export function getFeaturesByCategory(category) {
  return getAllFeatures().filter(f => f.category === category);
}

/**
 * Get summary statistics for all lens features.
 */
export function getLensFeatureStats() {
  const allFeatures = getAllFeatures();
  const categories = {};
  const integrations = new Set();

  for (const f of allFeatures) {
    categories[f.category] = (categories[f.category] || 0) + 1;
    for (const int of f.integrations || []) {
      integrations.add(int);
    }
  }

  const lensCount = Object.keys(LENS_FEATURES).length;
  const emergentLenses = Object.values(LENS_FEATURES).filter(l => l.emergentAccess).length;
  const botLenses = Object.values(LENS_FEATURES).filter(l => l.botAccess).length;
  const usbLenses = Object.values(LENS_FEATURES).filter(l => l.usbIntegration).length;

  return {
    totalFeatures: allFeatures.length,
    totalLenses: lensCount,
    featuresByCategory: categories,
    uniqueIntegrations: integrations.size,
    emergentLenses,
    botLenses,
    usbLenses,
    averageFeaturesPerLens: Math.round(allFeatures.length / lensCount * 10) / 10,
  };
}
