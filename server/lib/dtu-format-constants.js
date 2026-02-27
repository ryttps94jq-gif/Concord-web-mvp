/**
 * Universal DTU File Format Constants — v1.0
 *
 * .dtu — A self-describing, self-verifying, self-executing knowledge
 * container that works on every operating system. Click it and it
 * does the right thing. Share it anywhere. Verify it offline.
 * Import it back into Concord.
 *
 * The PDF of knowledge. Except it plays music, runs code, verifies
 * authenticity, tracks lineage, and pays creators.
 */

// ── DTU File Format ───────────────────────────────────────────────────
export const DTU_FILE_FORMAT = Object.freeze({
  extension: ".dtu",
  mimeType: "application/vnd.concord.dtu",

  extensions: {
    single: ".dtu",
    mega: ".mega.dtu",
    hyper: ".hyper.dtu",
  },

  magicBytes: "CDTU",
  version: 1,

  iconDescription: "Concord knowledge container",
});

// ── DTU Binary Layout ─────────────────────────────────────────────────
export const DTU_BINARY_LAYOUT = Object.freeze({
  header: {
    magicBytes: 4,
    version: 2,
    formatType: 1,
    totalSize: 8,
    headerChecksum: 4,

    manifest: {
      primaryType: 1,
      artifactPresent: 1,
      artifactType: 16,
      artifactSize: 8,
      layersPresent: 1,
      compressionType: 1,
    },
  },

  // Primary type codes
  primaryTypes: {
    0x01: "play_audio",
    0x02: "display_image",
    0x03: "play_video",
    0x04: "render_document",
    0x05: "render_code",
    0x06: "display_research",
    0x07: "display_dataset",
    0x08: "display_3d_model",
    0x09: "mixed_content",
    0x0A: "condensed_knowledge",
    0x0B: "culture_memory",
  },

  metadata: {
    fields: ["id", "createdAt", "creatorId", "regional", "national", "federationTier",
      "lineage", "economics", "license", "verification"],
  },

  layers: ["humanLayer", "coreLayer", "machineLayer", "artifactLayer"],
});

// ── OS Integration — File Associations ────────────────────────────────
export const DTU_OS_ACTIONS = Object.freeze({
  primaryActions: {
    play_audio: {
      action: "Open in default music player",
      fallback: "Open in Concord DTU Viewer",
      extraction: "Extract artifact layer → temp audio file → play",
    },
    display_image: {
      action: "Open in default image viewer",
      fallback: "Open in Concord DTU Viewer",
      extraction: "Extract artifact layer → temp image file → display",
    },
    play_video: {
      action: "Open in default video player",
      fallback: "Open in Concord DTU Viewer",
      extraction: "Extract artifact layer → temp video file → play",
    },
    render_document: {
      action: "Open in default document viewer",
      fallback: "Open in Concord DTU Viewer",
      extraction: "Extract artifact layer → temp document → render",
    },
    render_code: {
      action: "Open in default code editor",
      fallback: "Open in Concord DTU Viewer",
      extraction: "Extract artifact layer → temp source file → open",
    },
    display_research: {
      action: "Open in Concord DTU Viewer",
      display: "Render human layer as formatted document, show core layer as structured data, machine layer available on expand",
    },
    display_dataset: {
      action: "Open in default spreadsheet or Concord DTU Viewer",
      extraction: "Extract artifact layer → temp data file → open",
    },
    mixed_content: {
      action: "Open in Concord DTU Viewer",
      display: "Show all layers with artifact player/viewer inline",
    },
    condensed_knowledge: {
      action: "Open in Concord DTU Viewer",
      display: "Render human layer as readable knowledge, expandable core and machine layers",
    },
    culture_memory: {
      action: "Open in Concord DTU Viewer",
      display: "Render culture content chronologically with resonance/reflection data",
    },
  },

  contextMenu: [
    { label: "Open", action: "primary_action_based_on_type", icon: "play_or_view" },
    { label: "View DTU Layers", action: "open_in_dtu_viewer", description: "Show all four layers in structured viewer" },
    { label: "Extract Artifact", action: "extract_artifact_to_raw_file", description: "Extract the raw file (mp3, png, etc) from the DTU", available: "only_if_artifact_layer_present" },
    { label: "View Lineage", action: "show_lineage_graph", description: "Show derivative chain and creator attribution" },
    { label: "View License", action: "show_license_details", description: "Show licensing terms and export proof" },
    { label: "Verify Authenticity", action: "verify_signature", description: "Check Concord platform signature to prove legitimacy" },
    { label: "Import to Concord", action: "reimport_to_platform", description: "Import this DTU back into your Concord local substrate", available: "if_concord_installed" },
  ],
});

// ── Concord DTU Viewer ────────────────────────────────────────────────
export const DTU_VIEWER = Object.freeze({
  name: "Concord DTU Viewer",
  platforms: ["windows", "macos", "linux", "ios", "android"],
  size: "< 10MB",
  requiresAccount: false,
  requiresInternet: false,

  features: {
    openFormats: [".dtu", ".mega.dtu", ".hyper.dtu"],
    layerViewer: {
      human: "Formatted readable text",
      core: "Structured data with expandable sections",
      machine: "Technical view with verification status",
      artifact: "Inline player/viewer for any media type",
    },
    builtInPlayers: { audio: true, image: true, video: true, document: true, code: true },
    offlineVerification: { signatureCheck: true, integrityCheck: true, tamperDetection: true },
    lineageViewer: { graphDisplay: true, creatorAttribution: true, generationDepth: true },
    extractArtifact: { extractToFile: true, preserveMetadata: true },
  },

  limitations: {
    createDTUs: false,
    modifyDTUs: false,
    marketplace: false,
    accountRequired: false,
  },
});

// ── DTU Codec — Open Source Library ───────────────────────────────────
export const DTU_CODEC = Object.freeze({
  name: "libdtu",
  license: "MIT",
  languages: ["c", "rust", "javascript", "python", "go", "java", "swift", "kotlin"],

  api: {
    read: {
      readHeader: "(filepath) => DTUHeader",
      readMetadata: "(filepath) => DTUMetadata",
      readHumanLayer: "(filepath) => HumanLayer",
      readCoreLayer: "(filepath) => CoreLayer",
      readMachineLayer: "(filepath) => MachineLayer",
      extractArtifact: "(filepath, outputPath) => void",
      verify: "(filepath) => VerificationResult",
    },
    inspect: {
      getType: "(filepath) => primaryType",
      getSize: "(filepath) => totalSize",
      hasArtifact: "(filepath) => boolean",
      getArtifactType: "(filepath) => mimeType",
      getLayers: "(filepath) => layerBitfield",
    },
    stream: {
      streamArtifact: "(filepath) => ReadableStream",
    },
  },

  integrations: {
    vlc: "Plugin to play audio/video DTUs directly in VLC",
    vscode: "Extension to open code DTUs with syntax highlighting",
    finder: "QuickLook plugin for macOS to preview DTUs",
    explorer: "Preview handler for Windows Explorer",
    nautilus: "Thumbnailer for Linux file managers",
  },
});

// ── Smart Open Behavior ──────────────────────────────────────────────
export const DTU_SMART_OPEN = Object.freeze({
  routingLogic: {
    priority: [
      "concord_dtu_viewer",
      "os_default_for_artifact_type",
      "prompt_install_viewer",
    ],
    tempExtraction: {
      location: "system_temp_directory",
      cleanup: "on_app_close",
      naming: "original_title_from_human_layer",
    },
  },

  decompression: {
    headerCompression: "none",
    metadataDecompression: "on_access",
    artifactDecompression: "streaming",
    targets: {
      headerRead: "< 1ms",
      metadataRead: "< 10ms",
      artifactFirstByte: "< 50ms",
      fullDecompression: "proportional_to_size",
    },
  },
});

// ── DTU Sharing ──────────────────────────────────────────────────────
export const DTU_SHARING = Object.freeze({
  channels: {
    email: "Attach .dtu like any file",
    messaging: "Send via iMessage, WhatsApp, Telegram, etc",
    airdrop: "AirDrop on Apple devices",
    bluetooth: "Bluetooth transfer",
    usb: "Copy to USB drive",
    cloud: "Upload to any cloud storage",
    web: "Download link from any server",
  },

  recipientExperience: {
    hasViewer: "Double click → opens perfectly with all layers",
    noViewer: "Double click → OS extracts artifact → plays in default app",
    noHandler: "Prompt to download free Concord DTU Viewer (< 10MB)",
  },

  verificationPersistence: {
    survivesCopyPaste: true,
    survivesCloudUpload: true,
    survivesEmailAttachment: true,
    survivesCompression: true,
  },

  reimport: {
    importFlow: "Drag .dtu into Concord → validates signature → "
      + "imports to local substrate → available in all lenses",
  },
});

// ── Platform Registration ────────────────────────────────────────────
export const DTU_PLATFORM_REGISTRATION = Object.freeze({
  windows: {
    registry: {
      extension: ".dtu",
      contentType: "application/vnd.concord.dtu",
      perceivedType: "document",
      handler: "ConcordDTUViewer",
      thumbnailHandler: true,
      previewHandler: true,
    },
    installer: "MSI or MSIX package",
  },

  macos: {
    uti: {
      identifier: "org.concord.dtu",
      conformsTo: ["public.data", "public.content"],
      description: "Concord Knowledge Container",
      extensions: ["dtu"],
      mimeTypes: ["application/vnd.concord.dtu"],
      quickLookGenerator: true,
    },
    installer: "DMG with .app bundle",
  },

  linux: {
    mimeInfo: {
      type: "application/vnd.concord.dtu",
      glob: "*.dtu",
      magic: "CDTU",
      comment: "Concord Knowledge Container",
      thumbnailer: true,
    },
    installer: "AppImage, deb, rpm, flatpak, snap",
  },

  ios: {
    uti: "org.concord.dtu",
    documentProvider: true,
    shareExtension: true,
    installer: "App Store (free viewer app)",
  },

  android: {
    intentFilter: {
      action: "android.intent.action.VIEW",
      mimeType: "application/vnd.concord.dtu",
      extensions: ["dtu"],
    },
    installer: "Play Store (free viewer app)",
  },
});

// ── IANA MIME Type Registration ───────────────────────────────────────
export const DTU_IANA_REGISTRATION = Object.freeze({
  primary: {
    type: "application",
    subtype: "vnd.concord.dtu",
    requiredParameters: [],
    optionalParameters: ["version", "format"],
    encoding: "binary",
    restrictions: "none",
    published: true,
  },
  mega: { type: "application", subtype: "vnd.concord.mega-dtu" },
  hyper: { type: "application", subtype: "vnd.concord.hyper-dtu" },
});

// ── DTU Format Constants ─────────────────────────────────────────────
export const DTU_FORMAT_CONSTANTS = Object.freeze({
  MAGIC: "CDTU",
  FORMAT_VERSION: 1,

  // Type codes
  TYPE_DTU: 0,
  TYPE_MEGA: 1,
  TYPE_HYPER: 2,

  // Primary type codes
  PRIMARY_PLAY_AUDIO: 0x01,
  PRIMARY_DISPLAY_IMAGE: 0x02,
  PRIMARY_PLAY_VIDEO: 0x03,
  PRIMARY_RENDER_DOCUMENT: 0x04,
  PRIMARY_RENDER_CODE: 0x05,
  PRIMARY_DISPLAY_RESEARCH: 0x06,
  PRIMARY_DISPLAY_DATASET: 0x07,
  PRIMARY_DISPLAY_3D: 0x08,
  PRIMARY_MIXED: 0x09,
  PRIMARY_CONDENSED: 0x0A,
  PRIMARY_CULTURE: 0x0B,

  // Compression codes
  COMPRESSION_NONE: 0,
  COMPRESSION_GZIP: 1,
  COMPRESSION_BROTLI: 2,
  COMPRESSION_ZSTD: 3,

  // Layer bitfield
  LAYER_HUMAN: 0b0001,
  LAYER_CORE: 0b0010,
  LAYER_MACHINE: 0b0100,
  LAYER_ARTIFACT: 0b1000,

  // Header size
  HEADER_SIZE: 48,

  // Viewer
  VIEWER_DOWNLOAD_URL: "https://concord-os.org/viewer",
  VIEWER_MAX_SIZE_MB: 10,

  // Codec
  CODEC_REPO: "https://github.com/concord-os/libdtu",
  CODEC_LICENSE: "MIT",
});
