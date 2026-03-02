/**
 * DTU Format Constants Test Suite
 *
 * Validates that all DTU format constant objects are:
 *   - Exported correctly
 *   - Frozen (immutable)
 *   - Contain expected structure and values
 *   - Cover the full spec: file format, binary layout, OS actions, viewer,
 *     codec, smart open, sharing, platform registration, IANA, format constants
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DTU_FILE_FORMAT,
  DTU_BINARY_LAYOUT,
  DTU_OS_ACTIONS,
  DTU_VIEWER,
  DTU_CODEC,
  DTU_SMART_OPEN,
  DTU_SHARING,
  DTU_PLATFORM_REGISTRATION,
  DTU_IANA_REGISTRATION,
  DTU_FORMAT_CONSTANTS,
} from "../lib/dtu-format-constants.js";

// ── DTU_FILE_FORMAT ─────────────────────────────────────────────────────────

describe("DTU_FILE_FORMAT", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(DTU_FILE_FORMAT));
  });

  it("has correct extension", () => {
    assert.equal(DTU_FILE_FORMAT.extension, ".dtu");
  });

  it("has correct MIME type", () => {
    assert.equal(DTU_FILE_FORMAT.mimeType, "application/vnd.concord.dtu");
  });

  it("defines all three extension variants", () => {
    assert.equal(DTU_FILE_FORMAT.extensions.single, ".dtu");
    assert.equal(DTU_FILE_FORMAT.extensions.mega, ".mega.dtu");
    assert.equal(DTU_FILE_FORMAT.extensions.hyper, ".hyper.dtu");
  });

  it("has magic bytes CDTU", () => {
    assert.equal(DTU_FILE_FORMAT.magicBytes, "CDTU");
  });

  it("has version 1", () => {
    assert.equal(DTU_FILE_FORMAT.version, 1);
  });

  it("has icon description", () => {
    assert.equal(typeof DTU_FILE_FORMAT.iconDescription, "string");
    assert.ok(DTU_FILE_FORMAT.iconDescription.length > 0);
  });
});

// ── DTU_BINARY_LAYOUT ───────────────────────────────────────────────────────

describe("DTU_BINARY_LAYOUT", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(DTU_BINARY_LAYOUT));
  });

  it("defines header fields with byte sizes", () => {
    const h = DTU_BINARY_LAYOUT.header;
    assert.equal(h.magicBytes, 4);
    assert.equal(h.version, 2);
    assert.equal(h.formatType, 1);
    assert.equal(h.totalSize, 8);
    assert.equal(h.headerChecksum, 4);
  });

  it("defines manifest fields", () => {
    const m = DTU_BINARY_LAYOUT.header.manifest;
    assert.equal(m.primaryType, 1);
    assert.equal(m.artifactPresent, 1);
    assert.equal(typeof m.artifactType, "number");
    assert.equal(typeof m.artifactSize, "number");
  });

  it("maps primary type codes to action names", () => {
    const types = DTU_BINARY_LAYOUT.primaryTypes;
    assert.equal(types[0x01], "play_audio");
    assert.equal(types[0x02], "display_image");
    assert.equal(types[0x03], "play_video");
    assert.equal(types[0x04], "render_document");
    assert.equal(types[0x05], "render_code");
    assert.equal(types[0x06], "display_research");
    assert.equal(types[0x07], "display_dataset");
    assert.equal(types[0x08], "display_3d_model");
    assert.equal(types[0x09], "mixed_content");
    assert.equal(types[0x0A], "condensed_knowledge");
    assert.equal(types[0x0B], "culture_memory");
  });

  it("defines all four layers", () => {
    assert.deepEqual(DTU_BINARY_LAYOUT.layers, [
      "humanLayer", "coreLayer", "machineLayer", "artifactLayer",
    ]);
  });

  it("defines metadata fields", () => {
    assert.ok(Array.isArray(DTU_BINARY_LAYOUT.metadata.fields));
    assert.ok(DTU_BINARY_LAYOUT.metadata.fields.includes("id"));
    assert.ok(DTU_BINARY_LAYOUT.metadata.fields.includes("createdAt"));
    assert.ok(DTU_BINARY_LAYOUT.metadata.fields.includes("lineage"));
    assert.ok(DTU_BINARY_LAYOUT.metadata.fields.includes("verification"));
  });
});

// ── DTU_OS_ACTIONS ──────────────────────────────────────────────────────────

describe("DTU_OS_ACTIONS", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(DTU_OS_ACTIONS));
  });

  it("defines primary actions for all content types", () => {
    const actions = DTU_OS_ACTIONS.primaryActions;
    const expectedTypes = [
      "play_audio", "display_image", "play_video", "render_document",
      "render_code", "display_research", "display_dataset", "mixed_content",
      "condensed_knowledge", "culture_memory",
    ];
    for (const type of expectedTypes) {
      assert.ok(actions[type], `Missing primary action for ${type}`);
      assert.ok(actions[type].action || actions[type].display, `No action/display for ${type}`);
    }
  });

  it("defines context menu items", () => {
    assert.ok(Array.isArray(DTU_OS_ACTIONS.contextMenu));
    assert.ok(DTU_OS_ACTIONS.contextMenu.length >= 5);

    const labels = DTU_OS_ACTIONS.contextMenu.map(item => item.label);
    assert.ok(labels.includes("Open"));
    assert.ok(labels.includes("View DTU Layers"));
    assert.ok(labels.includes("Extract Artifact"));
    assert.ok(labels.includes("Verify Authenticity"));
    assert.ok(labels.includes("Import to Concord"));
  });

  it("each context menu item has label and action", () => {
    for (const item of DTU_OS_ACTIONS.contextMenu) {
      assert.ok(typeof item.label === "string");
      assert.ok(typeof item.action === "string");
    }
  });
});

// ── DTU_VIEWER ──────────────────────────────────────────────────────────────

describe("DTU_VIEWER", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(DTU_VIEWER));
  });

  it("supports all major platforms", () => {
    assert.ok(DTU_VIEWER.platforms.includes("windows"));
    assert.ok(DTU_VIEWER.platforms.includes("macos"));
    assert.ok(DTU_VIEWER.platforms.includes("linux"));
    assert.ok(DTU_VIEWER.platforms.includes("ios"));
    assert.ok(DTU_VIEWER.platforms.includes("android"));
  });

  it("does not require account or internet", () => {
    assert.equal(DTU_VIEWER.requiresAccount, false);
    assert.equal(DTU_VIEWER.requiresInternet, false);
  });

  it("opens all format variants", () => {
    assert.ok(DTU_VIEWER.features.openFormats.includes(".dtu"));
    assert.ok(DTU_VIEWER.features.openFormats.includes(".mega.dtu"));
    assert.ok(DTU_VIEWER.features.openFormats.includes(".hyper.dtu"));
  });

  it("has built-in players for all media types", () => {
    const p = DTU_VIEWER.features.builtInPlayers;
    assert.equal(p.audio, true);
    assert.equal(p.image, true);
    assert.equal(p.video, true);
    assert.equal(p.document, true);
    assert.equal(p.code, true);
  });

  it("supports offline verification", () => {
    const v = DTU_VIEWER.features.offlineVerification;
    assert.equal(v.signatureCheck, true);
    assert.equal(v.integrityCheck, true);
    assert.equal(v.tamperDetection, true);
  });

  it("is read-only (cannot create/modify DTUs)", () => {
    assert.equal(DTU_VIEWER.limitations.createDTUs, false);
    assert.equal(DTU_VIEWER.limitations.modifyDTUs, false);
  });
});

// ── DTU_CODEC ───────────────────────────────────────────────────────────────

describe("DTU_CODEC", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(DTU_CODEC));
  });

  it("is named libdtu with MIT license", () => {
    assert.equal(DTU_CODEC.name, "libdtu");
    assert.equal(DTU_CODEC.license, "MIT");
  });

  it("supports multiple programming languages", () => {
    assert.ok(DTU_CODEC.languages.includes("c"));
    assert.ok(DTU_CODEC.languages.includes("rust"));
    assert.ok(DTU_CODEC.languages.includes("javascript"));
    assert.ok(DTU_CODEC.languages.includes("python"));
    assert.ok(DTU_CODEC.languages.length >= 6);
  });

  it("defines read API functions", () => {
    const api = DTU_CODEC.api.read;
    assert.ok(api.readHeader);
    assert.ok(api.readMetadata);
    assert.ok(api.readHumanLayer);
    assert.ok(api.extractArtifact);
    assert.ok(api.verify);
  });

  it("defines inspect API functions", () => {
    assert.ok(DTU_CODEC.api.inspect.getType);
    assert.ok(DTU_CODEC.api.inspect.hasArtifact);
  });

  it("defines streaming API", () => {
    assert.ok(DTU_CODEC.api.stream.streamArtifact);
  });

  it("defines third-party integrations", () => {
    assert.ok(DTU_CODEC.integrations.vlc);
    assert.ok(DTU_CODEC.integrations.vscode);
  });
});

// ── DTU_SMART_OPEN ──────────────────────────────────────────────────────────

describe("DTU_SMART_OPEN", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(DTU_SMART_OPEN));
  });

  it("defines routing priority order", () => {
    const p = DTU_SMART_OPEN.routingLogic.priority;
    assert.ok(Array.isArray(p));
    assert.ok(p.includes("concord_dtu_viewer"));
    assert.ok(p.includes("os_default_for_artifact_type"));
  });

  it("defines decompression targets", () => {
    const t = DTU_SMART_OPEN.decompression.targets;
    assert.ok(t.headerRead);
    assert.ok(t.metadataRead);
    assert.ok(t.artifactFirstByte);
  });
});

// ── DTU_SHARING ─────────────────────────────────────────────────────────────

describe("DTU_SHARING", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(DTU_SHARING));
  });

  it("lists sharing channels", () => {
    const ch = DTU_SHARING.channels;
    assert.ok(ch.email);
    assert.ok(ch.messaging);
    assert.ok(ch.cloud);
    assert.ok(ch.web);
  });

  it("verification survives all transport methods", () => {
    const v = DTU_SHARING.verificationPersistence;
    assert.equal(v.survivesCopyPaste, true);
    assert.equal(v.survivesCloudUpload, true);
    assert.equal(v.survivesEmailAttachment, true);
    assert.equal(v.survivesCompression, true);
  });

  it("describes recipient experiences", () => {
    assert.ok(DTU_SHARING.recipientExperience.hasViewer);
    assert.ok(DTU_SHARING.recipientExperience.noViewer);
    assert.ok(DTU_SHARING.recipientExperience.noHandler);
  });
});

// ── DTU_PLATFORM_REGISTRATION ───────────────────────────────────────────────

describe("DTU_PLATFORM_REGISTRATION", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(DTU_PLATFORM_REGISTRATION));
  });

  it("defines Windows registry settings", () => {
    const w = DTU_PLATFORM_REGISTRATION.windows.registry;
    assert.equal(w.extension, ".dtu");
    assert.equal(w.contentType, "application/vnd.concord.dtu");
  });

  it("defines macOS UTI", () => {
    const m = DTU_PLATFORM_REGISTRATION.macos.uti;
    assert.equal(m.identifier, "org.concord.dtu");
    assert.ok(m.conformsTo.includes("public.data"));
  });

  it("defines Linux MIME info", () => {
    const l = DTU_PLATFORM_REGISTRATION.linux.mimeInfo;
    assert.equal(l.type, "application/vnd.concord.dtu");
    assert.equal(l.glob, "*.dtu");
    assert.equal(l.magic, "CDTU");
  });

  it("defines iOS and Android entries", () => {
    assert.ok(DTU_PLATFORM_REGISTRATION.ios.uti);
    assert.ok(DTU_PLATFORM_REGISTRATION.android.intentFilter);
  });
});

// ── DTU_IANA_REGISTRATION ───────────────────────────────────────────────────

describe("DTU_IANA_REGISTRATION", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(DTU_IANA_REGISTRATION));
  });

  it("defines primary MIME type", () => {
    assert.equal(DTU_IANA_REGISTRATION.primary.type, "application");
    assert.equal(DTU_IANA_REGISTRATION.primary.subtype, "vnd.concord.dtu");
    assert.equal(DTU_IANA_REGISTRATION.primary.encoding, "binary");
  });

  it("defines mega and hyper subtypes", () => {
    assert.equal(DTU_IANA_REGISTRATION.mega.subtype, "vnd.concord.mega-dtu");
    assert.equal(DTU_IANA_REGISTRATION.hyper.subtype, "vnd.concord.hyper-dtu");
  });
});

// ── DTU_FORMAT_CONSTANTS ────────────────────────────────────────────────────

describe("DTU_FORMAT_CONSTANTS", () => {
  it("is frozen", () => {
    assert.ok(Object.isFrozen(DTU_FORMAT_CONSTANTS));
  });

  it("has correct MAGIC and FORMAT_VERSION", () => {
    assert.equal(DTU_FORMAT_CONSTANTS.MAGIC, "CDTU");
    assert.equal(DTU_FORMAT_CONSTANTS.FORMAT_VERSION, 1);
  });

  it("defines type codes", () => {
    assert.equal(DTU_FORMAT_CONSTANTS.TYPE_DTU, 0);
    assert.equal(DTU_FORMAT_CONSTANTS.TYPE_MEGA, 1);
    assert.equal(DTU_FORMAT_CONSTANTS.TYPE_HYPER, 2);
  });

  it("defines primary type codes matching binary layout", () => {
    assert.equal(DTU_FORMAT_CONSTANTS.PRIMARY_PLAY_AUDIO, 0x01);
    assert.equal(DTU_FORMAT_CONSTANTS.PRIMARY_DISPLAY_IMAGE, 0x02);
    assert.equal(DTU_FORMAT_CONSTANTS.PRIMARY_PLAY_VIDEO, 0x03);
    assert.equal(DTU_FORMAT_CONSTANTS.PRIMARY_RENDER_DOCUMENT, 0x04);
    assert.equal(DTU_FORMAT_CONSTANTS.PRIMARY_RENDER_CODE, 0x05);
    assert.equal(DTU_FORMAT_CONSTANTS.PRIMARY_DISPLAY_RESEARCH, 0x06);
    assert.equal(DTU_FORMAT_CONSTANTS.PRIMARY_DISPLAY_DATASET, 0x07);
    assert.equal(DTU_FORMAT_CONSTANTS.PRIMARY_DISPLAY_3D, 0x08);
    assert.equal(DTU_FORMAT_CONSTANTS.PRIMARY_MIXED, 0x09);
    assert.equal(DTU_FORMAT_CONSTANTS.PRIMARY_CONDENSED, 0x0A);
    assert.equal(DTU_FORMAT_CONSTANTS.PRIMARY_CULTURE, 0x0B);
  });

  it("defines compression codes", () => {
    assert.equal(DTU_FORMAT_CONSTANTS.COMPRESSION_NONE, 0);
    assert.equal(DTU_FORMAT_CONSTANTS.COMPRESSION_GZIP, 1);
    assert.equal(DTU_FORMAT_CONSTANTS.COMPRESSION_BROTLI, 2);
    assert.equal(DTU_FORMAT_CONSTANTS.COMPRESSION_ZSTD, 3);
  });

  it("defines layer bitfield values", () => {
    assert.equal(DTU_FORMAT_CONSTANTS.LAYER_HUMAN, 0b0001);
    assert.equal(DTU_FORMAT_CONSTANTS.LAYER_CORE, 0b0010);
    assert.equal(DTU_FORMAT_CONSTANTS.LAYER_MACHINE, 0b0100);
    assert.equal(DTU_FORMAT_CONSTANTS.LAYER_ARTIFACT, 0b1000);
  });

  it("layers are non-overlapping powers of 2", () => {
    const layers = [
      DTU_FORMAT_CONSTANTS.LAYER_HUMAN,
      DTU_FORMAT_CONSTANTS.LAYER_CORE,
      DTU_FORMAT_CONSTANTS.LAYER_MACHINE,
      DTU_FORMAT_CONSTANTS.LAYER_ARTIFACT,
    ];
    // All should be powers of 2
    for (const l of layers) {
      assert.equal(l & (l - 1), 0, `${l} is not a power of 2`);
    }
    // Bitwise OR of all should have no collisions
    const combined = layers.reduce((a, b) => a | b, 0);
    assert.equal(combined, 0b1111);
  });

  it("defines header size", () => {
    assert.equal(DTU_FORMAT_CONSTANTS.HEADER_SIZE, 48);
  });

  it("defines viewer download URL", () => {
    assert.ok(DTU_FORMAT_CONSTANTS.VIEWER_DOWNLOAD_URL.startsWith("https://"));
  });

  it("defines codec repo and license", () => {
    assert.ok(DTU_FORMAT_CONSTANTS.CODEC_REPO.includes("github.com"));
    assert.equal(DTU_FORMAT_CONSTANTS.CODEC_LICENSE, "MIT");
  });

  it("primary type codes are consistent between layout and constants", () => {
    // Verify the mapping is consistent
    assert.equal(DTU_BINARY_LAYOUT.primaryTypes[DTU_FORMAT_CONSTANTS.PRIMARY_PLAY_AUDIO], "play_audio");
    assert.equal(DTU_BINARY_LAYOUT.primaryTypes[DTU_FORMAT_CONSTANTS.PRIMARY_DISPLAY_IMAGE], "display_image");
    assert.equal(DTU_BINARY_LAYOUT.primaryTypes[DTU_FORMAT_CONSTANTS.PRIMARY_CULTURE], "culture_memory");
  });
});
