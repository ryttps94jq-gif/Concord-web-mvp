/**
 * Concord Legal Liability Framework Test Suite — v1.0
 *
 * Tests:
 *   - Core legal position constants
 *   - Universal and lens-specific disclaimers
 *   - DMCA compliance (submit, review, counter-notification)
 *   - Copyright strike system (three strikes, appeals)
 *   - Dispute resolution (open, update, types)
 *   - User agreements (record, check, types)
 *   - Disclaimer acknowledgment tracking
 *   - Content labeling (user, entity, derivative, promoted)
 *   - Liability shield per revenue stream
 *   - Legal dashboard
 *   - Constitutional invariants (Concord is never the seller)
 *
 * Run: node --test server/tests/legal-liability.test.js
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  LEGAL_POSITION,
  LENS_DISCLAIMER,
  LENS_SPECIFIC_DISCLAIMERS,
  DMCA_COMPLIANCE,
  DISPUTE_RESOLUTION,
  TERMS_OF_SERVICE,
  LIABILITY_SHIELD,
  CONTENT_LABELING,
  LEGAL_CONSTANTS,
} from "../lib/legal-liability-constants.js";

import {
  recordAgreement,
  hasAgreed,
  getUserAgreements,
  submitDMCANotice,
  reviewDMCANotice,
  submitCounterNotification,
  getDMCANotice,
  getDMCANotices,
  issueStrike,
  getStrikeCount,
  getUserStrikes,
  appealStrike,
  resolveAppeal,
  openDispute,
  updateDisputeStatus,
  getDispute,
  getDisputes,
  acknowledgeDisclaimer,
  hasAcknowledgedDisclaimer,
  getContentLabel,
  getDisclaimerForLens,
  getAllDisclaimers,
  getLegalDashboard,
} from "../economy/legal-liability.js";

// ── In-Memory SQLite Helper ─────────────────────────────────────────

let Database;
try {
  Database = (await import("better-sqlite3")).default;
} catch {
  // skip DB tests if sqlite not available
}

function createTestDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE user_agreements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      agreement_type TEXT NOT NULL
        CHECK (agreement_type IN (
          'account_creation', 'first_transaction',
          'first_upload', 'api_creation'
        )),
      version TEXT NOT NULL,
      agreed_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip_address TEXT
    );

    CREATE INDEX idx_agreements_user ON user_agreements(user_id);
    CREATE INDEX idx_agreements_type ON user_agreements(agreement_type);

    CREATE TABLE dmca_notices (
      id TEXT PRIMARY KEY,
      complainant_name TEXT NOT NULL,
      complainant_email TEXT NOT NULL,
      copyrighted_work TEXT NOT NULL,
      infringing_content_id TEXT NOT NULL,
      good_faith_statement BOOLEAN NOT NULL,
      accuracy_statement BOOLEAN NOT NULL,
      signature TEXT NOT NULL,
      status TEXT DEFAULT 'pending'
        CHECK (status IN (
          'pending', 'reviewed', 'content_removed',
          'counter_filed', 'restored', 'resolved'
        )),
      received_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      resolved_at TEXT,
      notes TEXT
    );

    CREATE INDEX idx_dmca_status ON dmca_notices(status);
    CREATE INDEX idx_dmca_content ON dmca_notices(infringing_content_id);

    CREATE TABLE copyright_strikes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      dmca_notice_id TEXT NOT NULL,
      strike_number INTEGER NOT NULL,
      action_taken TEXT NOT NULL,
      issued_at TEXT NOT NULL DEFAULT (datetime('now')),
      appealed BOOLEAN DEFAULT FALSE,
      appeal_result TEXT,
      FOREIGN KEY (dmca_notice_id) REFERENCES dmca_notices(id)
    );

    CREATE INDEX idx_strikes_user ON copyright_strikes(user_id);

    CREATE TABLE disputes (
      id TEXT PRIMARY KEY,
      dispute_type TEXT NOT NULL
        CHECK (dispute_type IN (
          'copyright', 'derivative_claim',
          'quality', 'fraudulent_listing'
        )),
      reporter_id TEXT NOT NULL,
      reported_content_id TEXT,
      reported_user_id TEXT,
      description TEXT NOT NULL,
      evidence_json TEXT DEFAULT '[]',
      status TEXT DEFAULT 'open'
        CHECK (status IN (
          'open', 'under_review', 'mediation',
          'resolved', 'escalated', 'dismissed'
        )),
      resolution TEXT,
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE INDEX idx_disputes_status ON disputes(status);
    CREATE INDEX idx_disputes_type ON disputes(dispute_type);

    CREATE TABLE disclaimer_acknowledgments (
      user_id TEXT NOT NULL,
      lens_id TEXT NOT NULL,
      acknowledged_at TEXT NOT NULL DEFAULT (datetime('now')),
      disclaimer_version TEXT NOT NULL,
      PRIMARY KEY (user_id, lens_id)
    );
  `);

  return db;
}

// ═══════════════════════════════════════════════════════════════════════
// CONSTITUTIONAL CONSTANTS TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("Legal Position Constants", () => {
  it("Concord is PLATFORM_PROVIDER", () => {
    assert.strictEqual(LEGAL_POSITION.entityType, "PLATFORM_PROVIDER");
  });

  it("Concord IS infrastructure provider and marketplace facilitator", () => {
    assert.ok(LEGAL_POSITION.concordIs.includes("infrastructure_provider"));
    assert.ok(LEGAL_POSITION.concordIs.includes("marketplace_facilitator"));
    assert.ok(LEGAL_POSITION.concordIs.includes("technology_platform"));
    assert.ok(LEGAL_POSITION.concordIs.includes("payment_processor_for_user_transactions"));
  });

  it("Concord is NOT a seller or publisher", () => {
    assert.ok(LEGAL_POSITION.concordIsNot.includes("seller_of_creative_works"));
    assert.ok(LEGAL_POSITION.concordIsNot.includes("publisher_of_user_content"));
    assert.ok(LEGAL_POSITION.concordIsNot.includes("licensor_of_creative_works"));
    assert.ok(LEGAL_POSITION.concordIsNot.includes("guarantor_of_content_quality"));
  });

  it("only direct sale is API access (B2B)", () => {
    assert.strictEqual(LEGAL_POSITION.directSales.apiAccess.type, "B2B_service");
    const keys = Object.keys(LEGAL_POSITION.directSales);
    assert.strictEqual(keys.length, 1, "Only one direct sale: API access");
  });

  it("has Section 230 and DMCA safe harbor basis", () => {
    assert.ok(LEGAL_POSITION.legalBasis.section230);
    assert.ok(LEGAL_POSITION.legalBasis.dmca);
    assert.ok(LEGAL_POSITION.legalBasis.marketplace);
  });
});

describe("Disclaimer Constants", () => {
  it("universal disclaimer is always accessible", () => {
    assert.strictEqual(LENS_DISCLAIMER.universal.alwaysAccessible, true);
    assert.strictEqual(LENS_DISCLAIMER.universal.dismissable, true);
    assert.ok(LENS_DISCLAIMER.universal.text.includes("Concord is not the seller"));
  });

  it("has lens-specific disclaimers for all key lenses", () => {
    const expected = ["music", "art", "code", "video", "knowledge", "culture", "marketplace", "derivative", "coin", "entity", "api"];
    for (const lens of expected) {
      assert.ok(LENS_SPECIFIC_DISCLAIMERS[lens], `Missing disclaimer for ${lens}`);
      assert.ok(LENS_SPECIFIC_DISCLAIMERS[lens].text.length > 50, `Disclaimer for ${lens} is too short`);
    }
  });

  it("music disclaimer states Concord is not the seller", () => {
    assert.ok(LENS_SPECIFIC_DISCLAIMERS.music.text.includes("not the seller"));
  });

  it("code disclaimer includes as-is warranty", () => {
    assert.ok(LENS_SPECIFIC_DISCLAIMERS.code.text.includes("as-is"));
  });

  it("culture disclaimer mentions chronological display", () => {
    assert.ok(LENS_SPECIFIC_DISCLAIMERS.culture.text.includes("chronologically"));
  });

  it("marketplace disclaimer states 5.46% is infrastructure fee", () => {
    assert.ok(LENS_SPECIFIC_DISCLAIMERS.marketplace.text.includes("5.46%"));
    assert.ok(LENS_SPECIFIC_DISCLAIMERS.marketplace.text.includes("infrastructure costs"));
  });

  it("entity disclaimer states entities are not human", () => {
    assert.ok(LENS_SPECIFIC_DISCLAIMERS.entity.text.includes("not human"));
  });
});

describe("DMCA Compliance Constants", () => {
  it("has 6 notice requirements", () => {
    assert.strictEqual(DMCA_COMPLIANCE.noticeRequirements.length, 6);
  });

  it("three-strike policy", () => {
    assert.strictEqual(DMCA_COMPLIANCE.repeatInfringer.policy, "Three strikes");
    assert.ok(DMCA_COMPLIANCE.repeatInfringer.appealsAvailable);
  });

  it("24-hour response time", () => {
    assert.strictEqual(DMCA_COMPLIANCE.responseTime, "24_hours");
  });
});

describe("Dispute Resolution Constants", () => {
  it("Concord is FACILITATOR_NOT_ARBITER", () => {
    assert.strictEqual(DISPUTE_RESOLUTION.role, "FACILITATOR_NOT_ARBITER");
  });

  it("handles four dispute types", () => {
    const types = Object.keys(DISPUTE_RESOLUTION.disputeTypes);
    assert.deepStrictEqual(types.sort(), ["copyright", "derivative_claim", "fraudulent_listing", "quality"]);
  });

  it("will not determine copyright ownership or force refunds", () => {
    assert.ok(DISPUTE_RESOLUTION.willNotDo.includes("determine_copyright_ownership"));
    assert.ok(DISPUTE_RESOLUTION.willNotDo.includes("force_refunds"));
    assert.ok(DISPUTE_RESOLUTION.willNotDo.includes("make_legal_judgments"));
  });

  it("quality disputes have creator_discretion refund policy", () => {
    assert.strictEqual(DISPUTE_RESOLUTION.disputeTypes.quality.refundPolicy, "creator_discretion");
  });
});

describe("Liability Shield Constants", () => {
  it("marketplace fees are platform infrastructure fee", () => {
    assert.strictEqual(LIABILITY_SHIELD.revenueStreams.marketplaceFees.classification, "platform_infrastructure_fee");
    assert.strictEqual(LIABILITY_SHIELD.revenueStreams.marketplaceFees.liability, "none_for_content");
  });

  it("cascade royalties are automated payment routing", () => {
    assert.strictEqual(LIABILITY_SHIELD.revenueStreams.cascadeRoyalties.classification, "automated_payment_routing");
    assert.strictEqual(LIABILITY_SHIELD.revenueStreams.cascadeRoyalties.liability, "none_for_royalty_disputes");
  });

  it("API billing is the only direct B2B service", () => {
    assert.strictEqual(LIABILITY_SHIELD.revenueStreams.apiBilling.classification, "b2b_saas_service");
    assert.strictEqual(LIABILITY_SHIELD.revenueStreams.apiBilling.liability, "standard_saas_liability");
    assert.strictEqual(LIABILITY_SHIELD.revenueStreams.apiBilling.liabilityCap, "trailing_12_month_fees");
  });

  it("Concord Coin is platform currency not a security", () => {
    assert.strictEqual(LIABILITY_SHIELD.revenueStreams.concordCoin.classification, "platform_transaction_currency");
    assert.strictEqual(LIABILITY_SHIELD.revenueStreams.concordCoin.liability, "backing_account_obligation_only");
  });
});

describe("Content Labeling Constants", () => {
  it("Concord NEVER endorses, owns, or curates", () => {
    assert.strictEqual(CONTENT_LABELING.concordEndorsement, "NEVER");
    assert.strictEqual(CONTENT_LABELING.concordOwnership, "NEVER");
    assert.strictEqual(CONTENT_LABELING.concordCuration, "NEVER");
  });

  it("entity-generated content is prominently labeled", () => {
    assert.strictEqual(CONTENT_LABELING.labels.entityGenerated.prominent, true);
    assert.strictEqual(CONTENT_LABELING.labels.entityGenerated.showEntity, true);
    assert.strictEqual(CONTENT_LABELING.labels.entityGenerated.showEntityType, true);
  });

  it("derivative content shows parent chain", () => {
    assert.strictEqual(CONTENT_LABELING.labels.derivative.showParentChain, true);
    assert.strictEqual(CONTENT_LABELING.labels.derivative.showOriginalCreator, true);
  });
});

describe("Terms of Service Constants", () => {
  it("account creation requires acknowledgment of platform role", () => {
    const terms = TERMS_OF_SERVICE.agreements.accountCreation.userAgreesTo;
    assert.ok(terms.includes("concord_is_platform_not_seller"));
    assert.ok(terms.includes("all_content_is_user_generated"));
  });

  it("first transaction requires peer-to-peer acknowledgment", () => {
    const terms = TERMS_OF_SERVICE.agreements.firstTransaction.userAgreesTo;
    assert.ok(terms.includes("all_sales_are_peer_to_peer"));
    assert.ok(terms.includes("concord_is_not_the_seller"));
    assert.ok(terms.includes("transaction_fee_is_infrastructure_cost"));
  });

  it("first upload requires originality assertion", () => {
    const terms = TERMS_OF_SERVICE.agreements.firstUpload.creatorAgreesTo;
    assert.ok(terms.includes("content_is_original_or_properly_licensed"));
    assert.ok(terms.includes("creator_retains_all_ip_rights"));
    assert.ok(terms.includes("concord_receives_platform_display_license_only"));
  });

  it("API creation has standard SaaS terms", () => {
    const terms = TERMS_OF_SERVICE.agreements.apiCreation.developerAgreesTo;
    assert.ok(terms.includes("api_is_provided_as_is"));
    assert.ok(terms.includes("no_reverse_engineering"));
  });
});

describe("Legal Constants", () => {
  it("three strike maximum", () => {
    assert.strictEqual(LEGAL_CONSTANTS.MAX_STRIKES, 3);
  });

  it("strike actions escalate correctly", () => {
    assert.strictEqual(LEGAL_CONSTANTS.STRIKE_1_ACTION, "warning_and_removal");
    assert.strictEqual(LEGAL_CONSTANTS.STRIKE_2_ACTION, "30_day_marketplace_suspension");
    assert.strictEqual(LEGAL_CONSTANTS.STRIKE_3_ACTION, "permanent_termination");
  });

  it("DMCA response within 24 hours", () => {
    assert.strictEqual(LEGAL_CONSTANTS.DMCA_RESPONSE_HOURS, 24);
  });

  it("counter-notice wait is 14 days", () => {
    assert.strictEqual(LEGAL_CONSTANTS.DMCA_COUNTER_NOTICE_WAIT_DAYS, 14);
  });

  it("API liability capped at 12 months", () => {
    assert.strictEqual(LEGAL_CONSTANTS.API_LIABILITY_CAP_MONTHS, 12);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CONTENT LABELING FUNCTION TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("Content Labeling", () => {
  it("labels user-generated content", () => {
    const label = getContentLabel({ creatorId: "user_123", creatorType: "human" });
    assert.strictEqual(label.badge, "Created by user");
  });

  it("labels entity-generated content prominently", () => {
    const label = getContentLabel({ creatorId: "entity_1", creatorType: "emergent" });
    assert.strictEqual(label.badge, "Created by autonomous entity");
    assert.strictEqual(label.prominent, true);
  });

  it("labels derivative content with parent chain", () => {
    const label = getContentLabel({ creatorId: "user_1", parentIds: ["dtu_parent_1", "dtu_parent_2"] });
    assert.strictEqual(label.badge, "Derivative work");
    assert.deepStrictEqual(label.parentIds, ["dtu_parent_1", "dtu_parent_2"]);
  });

  it("labels promoted content", () => {
    const label = getContentLabel({ creatorId: "user_1", promotedFrom: "regional" });
    assert.strictEqual(label.badge, "Promoted from [tier]");
    assert.strictEqual(label.promotedFrom, "regional");
  });

  it("defaults to user-generated for unknown content", () => {
    const label = getContentLabel({});
    assert.strictEqual(label.badge, "Created by user");
  });
});

describe("Disclaimer Retrieval", () => {
  it("returns universal + specific for known lens", () => {
    const disc = getDisclaimerForLens("music");
    assert.ok(disc.universal);
    assert.ok(disc.specific);
    assert.ok(disc.specific.text.includes("music"));
  });

  it("returns universal only for unknown lens", () => {
    const disc = getDisclaimerForLens("unknown_lens_xyz");
    assert.ok(disc.universal);
    assert.strictEqual(disc.specific, null);
  });

  it("getAllDisclaimers returns all lens-specific disclaimers", () => {
    const all = getAllDisclaimers();
    assert.ok(all.universal);
    assert.ok(all.lensSpecific.music);
    assert.ok(all.lensSpecific.art);
    assert.ok(all.lensSpecific.code);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DATABASE INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("User Agreements (DB)", () => {
  if (!Database) {
    it("skipped — better-sqlite3 not available", () => { assert.ok(true); });
    return;
  }

  let db;
  beforeEach(() => { db = createTestDb(); });

  it("records an agreement", () => {
    const result = recordAgreement(db, {
      userId: "user_1", agreementType: "account_creation", ipAddress: "1.2.3.4",
    });
    assert.ok(result.ok);
    assert.strictEqual(result.type, "account_creation");
    assert.strictEqual(result.version, LEGAL_CONSTANTS.ACCOUNT_AGREEMENT_VERSION);
  });

  it("checks if user has agreed", () => {
    assert.strictEqual(hasAgreed(db, "user_1", "account_creation"), false);
    recordAgreement(db, { userId: "user_1", agreementType: "account_creation" });
    assert.strictEqual(hasAgreed(db, "user_1", "account_creation"), true);
  });

  it("rejects invalid agreement type", () => {
    const result = recordAgreement(db, { userId: "user_1", agreementType: "invalid" });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, "invalid_agreement_type");
  });

  it("retrieves user agreement history", () => {
    recordAgreement(db, { userId: "user_1", agreementType: "account_creation" });
    recordAgreement(db, { userId: "user_1", agreementType: "first_transaction" });
    const agreements = getUserAgreements(db, "user_1");
    assert.strictEqual(agreements.length, 2);
  });
});

describe("DMCA Processing (DB)", () => {
  if (!Database) {
    it("skipped — better-sqlite3 not available", () => { assert.ok(true); });
    return;
  }

  let db;
  beforeEach(() => { db = createTestDb(); });

  const validNotice = {
    complainantName: "Rights Holder",
    complainantEmail: "holder@example.com",
    copyrightedWork: "Original Song XYZ",
    infringingContentId: "dtu_123",
    goodFaithStatement: true,
    accuracyStatement: true,
    signature: "Rights Holder",
  };

  it("submits a valid DMCA notice", () => {
    const result = submitDMCANotice(db, validNotice);
    assert.ok(result.ok);
    assert.strictEqual(result.status, "pending");
    assert.ok(result.noticeId);
  });

  it("rejects notice missing required fields", () => {
    const result = submitDMCANotice(db, { complainantName: "Test" });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, "missing_required_field");
  });

  it("rejects notice without sworn statements", () => {
    const result = submitDMCANotice(db, { ...validNotice, goodFaithStatement: false });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, "statements_required");
  });

  it("reviews and removes content", () => {
    const submitted = submitDMCANotice(db, validNotice);
    const review = reviewDMCANotice(db, submitted.noticeId, { valid: true, notes: "Confirmed infringement" });
    assert.ok(review.ok);
    assert.strictEqual(review.contentRemoved, true);

    const notice = getDMCANotice(db, submitted.noticeId);
    assert.strictEqual(notice.status, "content_removed");
  });

  it("supports counter-notification flow", () => {
    const submitted = submitDMCANotice(db, validNotice);
    reviewDMCANotice(db, submitted.noticeId, { valid: true });

    const counter = submitCounterNotification(db, submitted.noticeId, {
      uploaderName: "Uploader",
      uploaderEmail: "uploader@example.com",
      statement: "This is my original work",
      signature: "Uploader",
    });
    assert.ok(counter.ok);
    assert.strictEqual(counter.status, "counter_filed");

    const notice = getDMCANotice(db, submitted.noticeId);
    assert.strictEqual(notice.status, "counter_filed");
  });

  it("counter-notification only valid after content removal", () => {
    const submitted = submitDMCANotice(db, validNotice);
    // Don't review first — still pending
    const counter = submitCounterNotification(db, submitted.noticeId, {
      uploaderName: "Test", statement: "Test", signature: "Test",
    });
    assert.strictEqual(counter.ok, false);
    assert.strictEqual(counter.error, "invalid_state");
  });

  it("lists notices by status", () => {
    submitDMCANotice(db, validNotice);
    submitDMCANotice(db, { ...validNotice, infringingContentId: "dtu_456" });
    const pending = getDMCANotices(db, { status: "pending" });
    assert.strictEqual(pending.length, 2);
  });
});

describe("Copyright Strikes (DB)", () => {
  if (!Database) {
    it("skipped — better-sqlite3 not available", () => { assert.ok(true); });
    return;
  }

  let db;
  beforeEach(() => { db = createTestDb(); });

  function createNotice() {
    const result = submitDMCANotice(db, {
      complainantName: "Holder", complainantEmail: "h@test.com",
      copyrightedWork: "Work", infringingContentId: "dtu_1",
      goodFaithStatement: true, accuracyStatement: true, signature: "H",
    });
    return result.noticeId;
  }

  it("issues escalating strikes", () => {
    const n1 = createNotice();
    const n2 = createNotice();
    const n3 = createNotice();

    const s1 = issueStrike(db, { userId: "user_bad", dmcaNoticeId: n1 });
    assert.strictEqual(s1.strikeNumber, 1);
    assert.strictEqual(s1.actionTaken, "warning_and_removal");

    const s2 = issueStrike(db, { userId: "user_bad", dmcaNoticeId: n2 });
    assert.strictEqual(s2.strikeNumber, 2);
    assert.strictEqual(s2.actionTaken, "30_day_marketplace_suspension");

    const s3 = issueStrike(db, { userId: "user_bad", dmcaNoticeId: n3 });
    assert.strictEqual(s3.strikeNumber, 3);
    assert.strictEqual(s3.actionTaken, "permanent_termination");
  });

  it("counts active strikes", () => {
    const n1 = createNotice();
    issueStrike(db, { userId: "user_test", dmcaNoticeId: n1 });
    assert.strictEqual(getStrikeCount(db, "user_test"), 1);
    assert.strictEqual(getStrikeCount(db, "user_clean"), 0);
  });

  it("supports appeal flow", () => {
    const n1 = createNotice();
    const strike = issueStrike(db, { userId: "user_appeal", dmcaNoticeId: n1 });

    const appeal = appealStrike(db, strike.strikeId, { reason: "Fair use" });
    assert.ok(appeal.ok);

    // Can't appeal twice
    const double = appealStrike(db, strike.strikeId, { reason: "Again" });
    assert.strictEqual(double.ok, false);
    assert.strictEqual(double.error, "already_appealed");
  });

  it("overturned appeal removes strike from count", () => {
    const n1 = createNotice();
    const strike = issueStrike(db, { userId: "user_overturn", dmcaNoticeId: n1 });
    assert.strictEqual(getStrikeCount(db, "user_overturn"), 1);

    appealStrike(db, strike.strikeId, { reason: "Mistake" });
    resolveAppeal(db, strike.strikeId, { result: "overturned" });
    assert.strictEqual(getStrikeCount(db, "user_overturn"), 0);
  });
});

describe("Dispute Resolution (DB)", () => {
  if (!Database) {
    it("skipped — better-sqlite3 not available", () => { assert.ok(true); });
    return;
  }

  let db;
  beforeEach(() => { db = createTestDb(); });

  it("opens a dispute", () => {
    const result = openDispute(db, {
      reporterId: "user_1",
      disputeType: "quality",
      reportedContentId: "dtu_123",
      description: "Content does not match description",
    });
    assert.ok(result.ok);
    assert.strictEqual(result.status, "open");
    assert.strictEqual(result.concordRole, "communication_channel");
  });

  it("rejects invalid dispute type", () => {
    const result = openDispute(db, {
      reporterId: "user_1", disputeType: "invalid_type", description: "test",
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, "invalid_dispute_type");
  });

  it("updates dispute status through lifecycle", () => {
    const opened = openDispute(db, {
      reporterId: "user_1", disputeType: "copyright", description: "Infringement claim",
    });

    updateDisputeStatus(db, opened.disputeId, { status: "under_review" });
    let dispute = getDispute(db, opened.disputeId);
    assert.strictEqual(dispute.status, "under_review");

    updateDisputeStatus(db, opened.disputeId, {
      status: "resolved",
      resolution: "Content removed per DMCA process",
    });
    dispute = getDispute(db, opened.disputeId);
    assert.strictEqual(dispute.status, "resolved");
    assert.ok(dispute.resolution);
  });

  it("filters disputes by status and type", () => {
    openDispute(db, { reporterId: "u1", disputeType: "quality", description: "bad quality" });
    openDispute(db, { reporterId: "u2", disputeType: "copyright", description: "stolen" });
    openDispute(db, { reporterId: "u3", disputeType: "quality", description: "misleading" });

    const allOpen = getDisputes(db, { status: "open" });
    assert.strictEqual(allOpen.length, 3);

    const qualityOnly = getDisputes(db, { disputeType: "quality" });
    assert.strictEqual(qualityOnly.length, 2);
  });
});

describe("Disclaimer Acknowledgment (DB)", () => {
  if (!Database) {
    it("skipped — better-sqlite3 not available", () => { assert.ok(true); });
    return;
  }

  let db;
  beforeEach(() => { db = createTestDb(); });

  it("tracks disclaimer acknowledgment", () => {
    assert.strictEqual(hasAcknowledgedDisclaimer(db, "user_1", "music"), false);
    acknowledgeDisclaimer(db, { userId: "user_1", lensId: "music" });
    assert.strictEqual(hasAcknowledgedDisclaimer(db, "user_1", "music"), true);
  });

  it("acknowledges per user per lens", () => {
    acknowledgeDisclaimer(db, { userId: "user_1", lensId: "music" });
    assert.strictEqual(hasAcknowledgedDisclaimer(db, "user_1", "music"), true);
    assert.strictEqual(hasAcknowledgedDisclaimer(db, "user_1", "art"), false);
    assert.strictEqual(hasAcknowledgedDisclaimer(db, "user_2", "music"), false);
  });
});

describe("Legal Dashboard (DB)", () => {
  if (!Database) {
    it("skipped — better-sqlite3 not available", () => { assert.ok(true); });
    return;
  }

  let db;
  beforeEach(() => { db = createTestDb(); });

  it("returns comprehensive dashboard", () => {
    // Create some test data
    submitDMCANotice(db, {
      complainantName: "H", complainantEmail: "h@t.com",
      copyrightedWork: "W", infringingContentId: "d1",
      goodFaithStatement: true, accuracyStatement: true, signature: "H",
    });
    openDispute(db, { reporterId: "u1", disputeType: "quality", description: "test" });
    recordAgreement(db, { userId: "u1", agreementType: "account_creation" });

    const dashboard = getLegalDashboard(db);
    assert.ok(dashboard.ok);
    assert.strictEqual(dashboard.dmca.pending, 1);
    assert.strictEqual(dashboard.disputes.open, 1);
    assert.strictEqual(dashboard.agreements.total, 1);
    assert.ok(dashboard.legalPosition);
    assert.ok(dashboard.liabilityShield);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CONSTITUTIONAL INVARIANT TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("Constitutional Invariants", () => {
  it("every revenue stream has explicit liability position", () => {
    const streams = Object.keys(LIABILITY_SHIELD.revenueStreams);
    for (const stream of streams) {
      assert.ok(LIABILITY_SHIELD.revenueStreams[stream].legalPosition, `${stream} missing legal position`);
      assert.ok(LIABILITY_SHIELD.revenueStreams[stream].classification, `${stream} missing classification`);
      assert.ok(LIABILITY_SHIELD.revenueStreams[stream].liability, `${stream} missing liability`);
    }
  });

  it("no revenue stream classifies Concord as seller", () => {
    const streams = Object.values(LIABILITY_SHIELD.revenueStreams);
    for (const stream of streams) {
      assert.notStrictEqual(stream.classification, "seller");
      assert.notStrictEqual(stream.classification, "distributor");
      assert.notStrictEqual(stream.classification, "publisher");
    }
  });

  it("marketplace fee rate matches economic spec", () => {
    assert.strictEqual(LIABILITY_SHIELD.revenueStreams.marketplaceFees.rate, "5.46%");
  });

  it("all agreement types require platform-not-seller acknowledgment", () => {
    const accountTerms = TERMS_OF_SERVICE.agreements.accountCreation.userAgreesTo;
    assert.ok(accountTerms.includes("concord_is_platform_not_seller"));
    const txTerms = TERMS_OF_SERVICE.agreements.firstTransaction.userAgreesTo;
    assert.ok(txTerms.includes("concord_is_not_the_seller"));
  });

  it("Concord never endorses, owns, or curates content", () => {
    assert.strictEqual(CONTENT_LABELING.concordEndorsement, "NEVER");
    assert.strictEqual(CONTENT_LABELING.concordOwnership, "NEVER");
    assert.strictEqual(CONTENT_LABELING.concordCuration, "NEVER");
  });

  it("dispute resolution explicitly states what Concord will NOT do", () => {
    assert.ok(DISPUTE_RESOLUTION.willNotDo.length >= 6);
    assert.ok(DISPUTE_RESOLUTION.willNotDo.includes("guarantee_transaction_outcomes"));
  });
});
