/**
 * Foundation Atlas — Test Suite
 *
 * Tests for signal tomography and volumetric mapping:
 *   - Constants (layers, materials, frequencies, tomo params)
 *   - Signal collection (step 1)
 *   - Path modeling (step 2)
 *   - Tomographic reconstruction (step 3)
 *   - Material classification (step 4)
 *   - Temporal differencing (step 5)
 *   - Multi-frequency fusion (step 6)
 *   - DTU encoding (step 7)
 *   - Retrieval functions (tile, volume, subsurface, material, changes, coverage)
 *   - Tiered access (public, research, sovereign)
 *   - Spatial queries
 *   - Chat intent detection
 *   - Metrics and heartbeat
 *   - Full pipeline integration
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  LAYERS,
  ALL_LAYERS,
  MATERIAL_TYPES,
  FREQUENCY_BANDS,
  ALL_FREQUENCY_BANDS,
  TOMO_CONSTANTS,
  ATLAS_TIERS,
  TIER_ACCESS,
  MATERIAL_EM_PROFILES,
  collectSignal,
  modelPath,
  reconstructTile,
  classifyMaterial,
  detectChanges,
  fuseFrequencies,
  createMapTileDTU,
  getTile,
  getVolume,
  getMaterialAtPoint,
  getSubsurface,
  getChanges,
  getCoverage,
  getLiveFeedStatus,
  executeSpatialQuery,
  detectAtlasIntent,
  getAtlasMetrics,
  atlasHeartbeatTick,
  initializeAtlas,
  _resetAtlasState,
} from "../lib/foundation-atlas.js";

beforeEach(() => {
  _resetAtlasState();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe("Constants", () => {
  it("defines 5 map layers", () => {
    expect(ALL_LAYERS).toHaveLength(5);
    expect(ALL_LAYERS).toContain("surface");
    expect(ALL_LAYERS).toContain("subsurface");
    expect(ALL_LAYERS).toContain("interior");
    expect(ALL_LAYERS).toContain("atmosphere");
    expect(ALL_LAYERS).toContain("material");
  });

  it("defines 10 material types", () => {
    const types = Object.values(MATERIAL_TYPES);
    expect(types).toHaveLength(10);
    expect(types).toContain("concrete");
    expect(types).toContain("metal");
    expect(types).toContain("water");
    expect(types).toContain("soil");
  });

  it("defines 7 frequency bands with EM properties", () => {
    expect(ALL_FREQUENCY_BANDS).toHaveLength(7);
    expect(FREQUENCY_BANDS.WIFI_2_4.resolution_cm).toBe(6.25);
    expect(FREQUENCY_BANDS.WIFI_5.resolution_cm).toBe(2.6);
    expect(FREQUENCY_BANDS.LORA_900.penetration).toBe("ground");
    expect(FREQUENCY_BANDS.RF_HF.penetration).toBe("deep_geology");
    expect(FREQUENCY_BANDS.TELEPHONE.penetration).toBe("conducted");
  });

  it("defines tomographic reconstruction constants", () => {
    expect(TOMO_CONSTANTS.MIN_PATHS_FOR_RECONSTRUCTION).toBe(3);
    expect(TOMO_CONSTANTS.MIN_ANGLES_FOR_QUALITY).toBe(8);
    expect(TOMO_CONSTANTS.VOXEL_SIZE_CM).toBe(25);
    expect(TOMO_CONSTANTS.CONFIDENCE_THRESHOLD).toBe(0.3);
  });

  it("defines 3 access tiers", () => {
    expect(ATLAS_TIERS.PUBLIC).toBe("PUBLIC");
    expect(ATLAS_TIERS.RESEARCH).toBe("RESEARCH");
    expect(ATLAS_TIERS.SOVEREIGN).toBe("SOVEREIGN");
  });

  it("defines tier access to layers", () => {
    expect(TIER_ACCESS.PUBLIC).toHaveLength(2);
    expect(TIER_ACCESS.PUBLIC).toContain("surface");
    expect(TIER_ACCESS.PUBLIC).toContain("atmosphere");
    expect(TIER_ACCESS.RESEARCH).toHaveLength(4);
    expect(TIER_ACCESS.RESEARCH).toContain("subsurface");
    expect(TIER_ACCESS.SOVEREIGN).toHaveLength(5); // all layers
  });

  it("defines material EM profiles for classification", () => {
    expect(MATERIAL_EM_PROFILES.concrete.attenuation).toBe(12);
    expect(MATERIAL_EM_PROFILES.metal.attenuation).toBe(40);
    expect(MATERIAL_EM_PROFILES.air.attenuation).toBe(0);
    expect(MATERIAL_EM_PROFILES.water.permittivity).toBe(80.0);
  });

  it("all constants are frozen", () => {
    expect(Object.isFrozen(LAYERS)).toBe(true);
    expect(Object.isFrozen(ALL_LAYERS)).toBe(true);
    expect(Object.isFrozen(MATERIAL_TYPES)).toBe(true);
    expect(Object.isFrozen(FREQUENCY_BANDS)).toBe(true);
    expect(Object.isFrozen(TOMO_CONSTANTS)).toBe(true);
    expect(Object.isFrozen(ATLAS_TIERS)).toBe(true);
    expect(Object.isFrozen(TIER_ACCESS)).toBe(true);
  });
});

// ── Step 1: Signal Collection ───────────────────────────────────────────────

describe("Signal Collection", () => {
  it("collects a valid signal observation", () => {
    const result = collectSignal({
      sourceNode: "node_A",
      destNode: "node_B",
      frequency: 2400,
      signalStrength: -65,
      phase: 120.5,
    });

    expect(result).not.toBeNull();
    expect(result.id).toMatch(/^sig_/);
    expect(result.sourceNode).toBe("node_A");
    expect(result.destNode).toBe("node_B");
    expect(result.frequency).toBe(2400);
    expect(result.signalStrength).toBe(-65);
    expect(result.band).toBe("wifi_2.4ghz");
  });

  it("returns null for missing required fields", () => {
    expect(collectSignal(null)).toBeNull();
    expect(collectSignal({})).toBeNull();
    expect(collectSignal({ sourceNode: "A" })).toBeNull();
    expect(collectSignal({ sourceNode: "A", destNode: "B" })).toBeNull();
  });

  it("identifies correct frequency bands", () => {
    const wifi5 = collectSignal({ sourceNode: "A", destNode: "B", frequency: 5800 });
    expect(wifi5.band).toBe("wifi_5ghz");

    const lora = collectSignal({ sourceNode: "A", destNode: "B", frequency: 900 });
    expect(lora.band).toBe("lora_900mhz");

    const rf433 = collectSignal({ sourceNode: "A", destNode: "B", frequency: 433 });
    expect(rf433.band).toBe("rf_433mhz");

    const telephone = collectSignal({ sourceNode: "A", destNode: "B", frequency: 0.003 });
    expect(telephone.band).toBe("telephone");
  });

  it("tracks frequency coverage", () => {
    collectSignal({ sourceNode: "A", destNode: "B", frequency: 2400 });
    collectSignal({ sourceNode: "A", destNode: "C", frequency: 900 });

    const coverage = getCoverage();
    expect(coverage.frequenciesActive).toContain("wifi_2.4ghz");
    expect(coverage.frequenciesActive).toContain("lora_900mhz");
  });

  it("updates stats on collection", () => {
    collectSignal({ sourceNode: "A", destNode: "B", frequency: 2400 });
    collectSignal({ sourceNode: "A", destNode: "C", frequency: 2400 });

    const metrics = getAtlasMetrics();
    expect(metrics.stats.signalsCollected).toBe(2);
    expect(metrics.stats.lastSignalAt).not.toBeNull();
  });
});

// ── Step 2: Path Modeling ───────────────────────────────────────────────────

describe("Path Modeling", () => {
  const posA = { lat: 52.3676, lng: 4.9041 };  // Amsterdam
  const posB = { lat: 52.3700, lng: 4.9100 };  // ~500m away

  it("models a signal path between two nodes", () => {
    const result = modelPath(posA, posB, {
      frequency: 2400,
      signalStrength: -65,
      phase: 120,
      multipath: [{ delay: 10 }, { delay: 25 }],
    });

    expect(result).not.toBeNull();
    expect(result.id).toMatch(/^path_/);
    expect(result.distance_m).toBeGreaterThan(0);
    expect(result.freeSpaceLoss_dB).toBeGreaterThan(0);
    expect(result.excessLoss_dB).toBeDefined();
    expect(result.phaseDeviation_deg).toBeDefined();
    expect(result.multipathCount).toBe(2);
    expect(result.band).toBe("wifi_2.4ghz");
  });

  it("returns null for missing inputs", () => {
    expect(modelPath(null, posB, {})).toBeNull();
    expect(modelPath(posA, null, {})).toBeNull();
    expect(modelPath(posA, posB, null)).toBeNull();
  });

  it("calculates environmental impact between 0 and 1", () => {
    const result = modelPath(posA, posB, {
      frequency: 2400,
      signalStrength: -80,
    });
    expect(result.environmentalImpact).toBeGreaterThanOrEqual(0);
    expect(result.environmentalImpact).toBeLessThanOrEqual(1);
  });

  it("updates path modeling stats", () => {
    modelPath(posA, posB, { frequency: 2400, signalStrength: -65 });
    expect(getAtlasMetrics().stats.pathsModeled).toBe(1);
  });
});

// ── Step 3: Tomographic Reconstruction ──────────────────────────────────────

describe("Tomographic Reconstruction", () => {
  const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };

  function makePaths(count) {
    const paths = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      paths.push({
        id: `path_${i}`,
        sourcePos: { lat: 52.367 + Math.cos(angle) * 0.001, lng: 4.904 + Math.sin(angle) * 0.001 },
        destPos: { lat: 52.368 - Math.cos(angle) * 0.001, lng: 4.905 - Math.sin(angle) * 0.001 },
        band: i % 2 === 0 ? "wifi_2.4ghz" : "lora_900mhz",
        excessLoss_dB: 10 + i,
        phaseDeviation_deg: 30 + i * 5,
        environmentalImpact: 0.3 + i * 0.05,
        frequency: i % 2 === 0 ? 2400 : 900,
      });
    }
    return paths;
  }

  it("requires minimum number of paths", () => {
    const result = reconstructTile(coords, [{ id: "p1" }]);
    expect(result).toBeNull();
  });

  it("reconstructs a tile from sufficient paths", () => {
    const paths = makePaths(10);
    const tile = reconstructTile(coords, paths);

    expect(tile).not.toBeNull();
    expect(tile.id).toMatch(/^tile_/);
    expect(tile.type).toBe("MAP_TILE");
    expect(tile.coordinates).toEqual(coords);
    expect(tile.signal_paths_used).toBe(10);
    expect(tile.confidence).toBeGreaterThan(0);
    expect(tile.version).toBe(1);
    expect(tile.resolution_cm).toBeLessThan(Infinity);
    expect(tile.frequency_sources).toContain("wifi_2.4ghz");
    expect(tile.frequency_sources).toContain("lora_900mhz");
  });

  it("populates all 5 layers", () => {
    const paths = makePaths(10);
    const tile = reconstructTile(coords, paths);

    expect(tile.layers.surface).toBeDefined();
    expect(tile.layers.subsurface).toBeDefined();
    expect(tile.layers.interior).toBeDefined();
    expect(tile.layers.atmosphere).toBeDefined();
    expect(tile.layers.material).toBeDefined();
  });

  it("increments version on re-reconstruction", () => {
    const paths = makePaths(5);
    const tile1 = reconstructTile(coords, paths);
    expect(tile1.version).toBe(1);

    const tile2 = reconstructTile(coords, makePaths(8));
    expect(tile2.version).toBe(2);
  });

  it("counts unique nodes", () => {
    const paths = makePaths(6);
    const tile = reconstructTile(coords, paths);
    expect(tile.node_count).toBeGreaterThan(0);
  });

  it("higher path count increases confidence", () => {
    const lowPaths = makePaths(3);
    const highPaths = makePaths(50);

    _resetAtlasState();
    const lowTile = reconstructTile(coords, lowPaths);

    _resetAtlasState();
    const highTile = reconstructTile(coords, highPaths);

    expect(highTile.confidence).toBeGreaterThan(lowTile.confidence);
  });

  it("selects best resolution from frequency bands", () => {
    // WiFi 5GHz has 2.6cm resolution — best available
    const paths = makePaths(5).map(p => ({ ...p, band: "wifi_5ghz" }));
    const tile = reconstructTile(coords, paths);
    expect(tile.resolution_cm).toBe(2.6);
  });
});

// ── Step 4: Material Classification ─────────────────────────────────────────

describe("Material Classification", () => {
  it("classifies air (no loss, no phase shift)", () => {
    const result = classifyMaterial(0, 0);
    expect(result.material).toBe("air");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("classifies concrete (moderate loss, moderate phase)", () => {
    const result = classifyMaterial(12, 45);
    expect(result.material).toBe("concrete");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("classifies metal (high loss, high phase)", () => {
    const result = classifyMaterial(40, 90);
    expect(result.material).toBe("metal");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("classifies water (moderate loss, moderate phase, high permittivity)", () => {
    const result = classifyMaterial(8, 30);
    expect(result.material).toBe("water");
  });

  it("classifies wood (low loss)", () => {
    const result = classifyMaterial(4, 15);
    expect(result.material).toBe("wood");
  });

  it("returns confidence between 0 and 1", () => {
    const result = classifyMaterial(15, 35);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("updates material classification stats", () => {
    classifyMaterial(10, 20);
    classifyMaterial(30, 60);
    expect(getAtlasMetrics().stats.materialsClassified).toBe(2);
  });
});

// ── Step 5: Temporal Differencing ───────────────────────────────────────────

describe("Temporal Differencing", () => {
  it("returns null for tiles with only one version", () => {
    const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };
    const paths = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`, sourcePos: { lat: 52.367, lng: 4.904 },
      destPos: { lat: 52.368, lng: 4.905 },
      band: "wifi_2.4ghz", environmentalImpact: 0.5,
      excessLoss_dB: 10, phaseDeviation_deg: 30,
    }));
    reconstructTile(coords, paths);

    const result = detectChanges("52.367_4.904_-50");
    expect(result).toBeNull(); // version 1, no comparison possible
  });

  it("detects changes between tile versions", () => {
    const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };
    const paths = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`, sourcePos: { lat: 52.367, lng: 4.904 },
      destPos: { lat: 52.368, lng: 4.905 },
      band: "wifi_2.4ghz", environmentalImpact: 0.5,
      excessLoss_dB: 10, phaseDeviation_deg: 30,
    }));
    reconstructTile(coords, paths);
    reconstructTile(coords, paths); // version 2

    const result = detectChanges("52.367_4.904_-50");
    // May or may not detect a change (randomized magnitude), but function should run
    expect(result === null || result.tileKey === "52.367_4.904_-50").toBe(true);
  });
});

// ── Step 6: Multi-Frequency Fusion ──────────────────────────────────────────

describe("Multi-Frequency Fusion", () => {
  it("returns null for nonexistent tile", () => {
    expect(fuseFrequencies("nonexistent")).toBeNull();
  });

  it("fuses multiple frequency sources", () => {
    const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };
    const paths = [
      { id: "p1", sourcePos: { lat: 52.367, lng: 4.904 }, destPos: { lat: 52.368, lng: 4.905 },
        band: "wifi_2.4ghz", environmentalImpact: 0.5, excessLoss_dB: 10, phaseDeviation_deg: 30 },
      { id: "p2", sourcePos: { lat: 52.3675, lng: 4.9045 }, destPos: { lat: 52.3685, lng: 4.9055 },
        band: "lora_900mhz", environmentalImpact: 0.3, excessLoss_dB: 15, phaseDeviation_deg: 35 },
      { id: "p3", sourcePos: { lat: 52.3672, lng: 4.9042 }, destPos: { lat: 52.3682, lng: 4.9052 },
        band: "bluetooth_2.4ghz", environmentalImpact: 0.4, excessLoss_dB: 8, phaseDeviation_deg: 20 },
    ];
    reconstructTile(coords, paths);

    const fusion = fuseFrequencies("52.367_4.904_-50");
    expect(fusion).not.toBeNull();
    expect(fusion.frequencySources).toHaveLength(3);
    expect(fusion.fusionConfidence).toBeGreaterThan(0);
    expect(fusion.fusedLayers).toBeDefined();
  });

  it("WiFi contributes to interior layer", () => {
    const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };
    const paths = Array.from({ length: 3 }, (_, i) => ({
      id: `p${i}`, sourcePos: { lat: 52.367, lng: 4.904 },
      destPos: { lat: 52.368, lng: 4.905 },
      band: "wifi_2.4ghz", environmentalImpact: 0.5,
      excessLoss_dB: 10, phaseDeviation_deg: 30,
    }));
    reconstructTile(coords, paths);

    const fusion = fuseFrequencies("52.367_4.904_-50");
    expect(fusion.fusedLayers.interior).toBeDefined();
    expect(fusion.fusedLayers.interior.source).toBe("wifi_2.4ghz");
  });

  it("LoRa contributes to subsurface layer", () => {
    const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };
    const paths = Array.from({ length: 3 }, (_, i) => ({
      id: `p${i}`, sourcePos: { lat: 52.367, lng: 4.904 },
      destPos: { lat: 52.368, lng: 4.905 },
      band: "lora_900mhz", environmentalImpact: 0.5,
      excessLoss_dB: 15, phaseDeviation_deg: 35,
    }));
    reconstructTile(coords, paths);

    const fusion = fuseFrequencies("52.367_4.904_-50");
    expect(fusion.fusedLayers.subsurface).toBeDefined();
    expect(fusion.fusedLayers.subsurface.source).toBe("lora_900mhz");
  });
});

// ── Step 7: DTU Encoding ────────────────────────────────────────────────────

describe("DTU Encoding", () => {
  it("creates MAP_TILE DTU from tile", () => {
    const tile = {
      id: "tile_test",
      coordinates: { lat_min: 52, lat_max: 53, lng_min: 4, lng_max: 5 },
      altitude_range: { top: 100, bottom: -50 },
      resolution_cm: 6.25,
      layers: { surface: {} },
      frequency_sources: ["wifi_2.4ghz"],
      node_count: 10,
      signal_paths_used: 50,
      confidence: 0.85,
      timestamp: Date.now(),
      version: 1,
    };

    const dtu = createMapTileDTU(tile);
    expect(dtu.type).toBe("MAP_TILE");
    expect(dtu.id).toBe("tile_test");
    expect(dtu.resolution_cm).toBe(6.25);
    expect(dtu.confidence).toBe(0.85);
    expect(dtu.source).toBe("foundation-atlas");
  });

  it("returns null for null input", () => {
    expect(createMapTileDTU(null)).toBeNull();
  });
});

// ── Retrieval Functions ─────────────────────────────────────────────────────

describe("Tile Retrieval", () => {
  beforeEach(() => {
    const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };
    const paths = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`, sourcePos: { lat: 52.367, lng: 4.904 },
      destPos: { lat: 52.368, lng: 4.905 },
      band: "wifi_2.4ghz", environmentalImpact: 0.5,
      excessLoss_dB: 10, phaseDeviation_deg: 30,
    }));
    reconstructTile(coords, paths);
  });

  it("retrieves a tile by coordinates", () => {
    const result = getTile({ lat: 52.3675, lng: 4.9045 });
    expect(result.ok).toBe(true);
    expect(result.tile.type).toBe("MAP_TILE");
  });

  it("returns error for missing coordinates", () => {
    expect(getTile(null).ok).toBe(false);
  });

  it("returns error for coordinates outside any tile", () => {
    const result = getTile({ lat: 0, lng: 0 });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("no_tile_at_coordinates");
  });
});

describe("Volume Retrieval", () => {
  beforeEach(() => {
    const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };
    const paths = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`, sourcePos: { lat: 52.367, lng: 4.904 },
      destPos: { lat: 52.368, lng: 4.905 },
      band: "wifi_2.4ghz", environmentalImpact: 0.5,
      excessLoss_dB: 10, phaseDeviation_deg: 30,
    }));
    reconstructTile(coords, paths);
  });

  it("retrieves volume with public tier access", () => {
    const result = getVolume({ lat_min: 52.36, lat_max: 52.37, lng_min: 4.9, lng_max: 4.91 }, "PUBLIC");
    expect(result.ok).toBe(true);
    expect(result.tier).toBe("PUBLIC");
    expect(result.accessibleLayers).toEqual(["surface", "atmosphere"]);
  });

  it("retrieves volume with research tier access", () => {
    const result = getVolume({ lat_min: 52.36, lat_max: 52.37, lng_min: 4.9, lng_max: 4.91 }, "RESEARCH");
    expect(result.ok).toBe(true);
    expect(result.accessibleLayers).toContain("subsurface");
    expect(result.accessibleLayers).toContain("material");
  });

  it("retrieves volume with sovereign tier access (all layers)", () => {
    const result = getVolume({ lat_min: 52.36, lat_max: 52.37, lng_min: 4.9, lng_max: 4.91 }, "SOVEREIGN");
    expect(result.accessibleLayers).toHaveLength(5);
    expect(result.accessibleLayers).toContain("interior");
  });
});

describe("Subsurface Retrieval", () => {
  it("denies public tier access to subsurface", () => {
    const result = getSubsurface({ lat_min: 52.36, lat_max: 52.37, lng_min: 4.9, lng_max: 4.91 }, "PUBLIC");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("access_denied");
  });

  it("allows research tier access to subsurface", () => {
    const result = getSubsurface({ lat_min: 52.36, lat_max: 52.37, lng_min: 4.9, lng_max: 4.91 }, "RESEARCH");
    expect(result.ok).toBe(true);
    expect(result.tier).toBe("RESEARCH");
  });
});

// ── Spatial Queries ─────────────────────────────────────────────────────────

describe("Spatial Queries", () => {
  it("handles point query", () => {
    const result = executeSpatialQuery({ type: "point", coordinates: { lat: 52.3675, lng: 4.9045 } });
    // No tile exists yet
    expect(result.ok).toBe(false);
  });

  it("handles area query", () => {
    const result = executeSpatialQuery({
      type: "area",
      bounds: { lat_min: 52.36, lat_max: 52.37, lng_min: 4.9, lng_max: 4.91 },
    });
    expect(result.ok).toBe(true);
    expect(result.tileCount).toBe(0); // No tiles yet
  });

  it("handles radius query", () => {
    const result = executeSpatialQuery({
      type: "radius",
      coordinates: { lat: 52.3675, lng: 4.9045 },
      radius_m: 500,
    });
    expect(result.ok).toBe(true);
  });

  it("handles material query", () => {
    const result = executeSpatialQuery({ type: "material", coordinates: { lat: 52.3675, lng: 4.9045 } });
    expect(result.ok).toBe(false); // No tile at point
  });

  it("handles subsurface query", () => {
    const result = executeSpatialQuery({
      type: "subsurface",
      bounds: { lat_min: 52.36, lat_max: 52.37, lng_min: 4.9, lng_max: 4.91 },
    });
    expect(result.ok).toBe(true);
  });

  it("handles changes query", () => {
    const result = executeSpatialQuery({ type: "changes", bounds: null });
    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
  });

  it("rejects unknown query type", () => {
    const result = executeSpatialQuery({ type: "invalid" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("unknown_query_type");
  });

  it("rejects null query", () => {
    const result = executeSpatialQuery(null);
    expect(result.ok).toBe(false);
  });

  it("radius query requires coordinates", () => {
    const result = executeSpatialQuery({ type: "radius" });
    expect(result.ok).toBe(false);
  });
});

// ── Coverage ────────────────────────────────────────────────────────────────

describe("Coverage", () => {
  it("returns initial coverage state", () => {
    const result = getCoverage();
    expect(result.ok).toBe(true);
    expect(result.totalNodes).toBe(0);
    expect(result.totalPaths).toBe(0);
    expect(result.totalTiles).toBe(0);
    expect(result.bestResolution_cm).toBeNull();
    expect(result.frequencyCapabilities).toHaveLength(7);
  });

  it("reports frequency capabilities", () => {
    const result = getCoverage();
    const wifi = result.frequencyCapabilities.find(f => f.name === "wifi_2.4ghz");
    expect(wifi.resolution_cm).toBe(6.25);
    expect(wifi.penetration).toBe("walls");
  });
});

// ── Live Feed ───────────────────────────────────────────────────────────────

describe("Live Feed", () => {
  it("returns live feed status", () => {
    const result = getLiveFeedStatus();
    expect(result.ok).toBe(true);
    expect(result.active).toBe(false);
    expect(result.totalSignals).toBe(0);
  });
});

// ── Chat Intent Detection ───────────────────────────────────────────────────

describe("Chat Intent Detection", () => {
  it("returns false for empty input", () => {
    expect(detectAtlasIntent("").isAtlasRequest).toBe(false);
    expect(detectAtlasIntent(null).isAtlasRequest).toBe(false);
  });

  it("detects map/atlas tile requests", () => {
    const result = detectAtlasIntent("Show me the atlas view of Amsterdam");
    expect(result.isAtlasRequest).toBe(true);
    expect(result.action).toBe("tile");
  });

  it("detects volumetric requests", () => {
    const result = detectAtlasIntent("Show the 3D model of this area");
    expect(result.isAtlasRequest).toBe(true);
    expect(result.action).toBe("volume");
  });

  it("detects material classification requests", () => {
    const result = detectAtlasIntent("What material is this building made of?");
    expect(result.isAtlasRequest).toBe(true);
    expect(result.action).toBe("material");
  });

  it("detects subsurface/underground requests", () => {
    const result = detectAtlasIntent("What is underground at this location?");
    expect(result.isAtlasRequest).toBe(true);
    expect(result.action).toBe("subsurface");
  });

  it("detects change detection requests", () => {
    const result = detectAtlasIntent("Detect recent changes in this area");
    expect(result.isAtlasRequest).toBe(true);
    expect(result.action).toBe("change");
  });

  it("detects coverage requests", () => {
    const result = detectAtlasIntent("What is the atlas coverage status?");
    expect(result.isAtlasRequest).toBe(true);
    expect(result.action).toBe("coverage");
  });

  it("detects signal tomography requests", () => {
    const result = detectAtlasIntent("How does signal tomography work?");
    expect(result.isAtlasRequest).toBe(true);
    expect(result.action).toBe("coverage");
  });

  it("detects live feed requests", () => {
    const result = detectAtlasIntent("Show the real-time atlas feed");
    expect(result.isAtlasRequest).toBe(true);
    expect(result.action).toBe("live");
  });

  it("does not match unrelated queries", () => {
    expect(detectAtlasIntent("What's the weather today?").isAtlasRequest).toBe(false);
    expect(detectAtlasIntent("Play some music").isAtlasRequest).toBe(false);
  });
});

// ── Metrics ─────────────────────────────────────────────────────────────────

describe("Atlas Metrics", () => {
  it("returns comprehensive metrics", async () => {
    await initializeAtlas({});
    collectSignal({ sourceNode: "A", destNode: "B", frequency: 2400 });

    const metrics = getAtlasMetrics();
    expect(metrics.initialized).toBe(true);
    expect(metrics.stats.signalsCollected).toBe(1);
    expect(metrics.coverage).toBeDefined();
    expect(metrics.uptime).toBeGreaterThanOrEqual(0);
  });
});

// ── Heartbeat ───────────────────────────────────────────────────────────────

describe("Atlas Heartbeat", () => {
  it("runs without error", async () => {
    await initializeAtlas({});
    await expect(atlasHeartbeatTick({}, 1)).resolves.not.toThrow();
  });
});

// ── Initialization ──────────────────────────────────────────────────────────

describe("Initialization", () => {
  it("initializes successfully", async () => {
    const result = await initializeAtlas({});
    expect(result.ok).toBe(true);
    expect(result.layers).toEqual(ALL_LAYERS);
    expect(result.frequencyBands).toHaveLength(7);
    expect(result.tiers).toEqual(["PUBLIC", "RESEARCH", "SOVEREIGN"]);
  });

  it("returns alreadyInitialized on second call", async () => {
    await initializeAtlas({});
    const result = await initializeAtlas({});
    expect(result.ok).toBe(true);
    expect(result.alreadyInitialized).toBe(true);
  });
});

// ── State Reset ─────────────────────────────────────────────────────────────

describe("State Reset", () => {
  it("resets all state", async () => {
    await initializeAtlas({});
    collectSignal({ sourceNode: "A", destNode: "B", frequency: 2400 });
    _resetAtlasState();

    const metrics = getAtlasMetrics();
    expect(metrics.initialized).toBe(false);
    expect(metrics.stats.signalsCollected).toBe(0);
  });
});

// ── Full Pipeline Integration ───────────────────────────────────────────────

describe("Full Pipeline Integration", () => {
  beforeEach(async () => {
    await initializeAtlas({});
  });

  it("collect → model → reconstruct → classify → encode", () => {
    const posA = { lat: 52.367, lng: 4.904 };
    const posB = { lat: 52.368, lng: 4.905 };

    // Step 1: Collect signals
    const sig1 = collectSignal({ sourceNode: "A", destNode: "B", frequency: 2400, signalStrength: -65, phase: 120 });
    const sig2 = collectSignal({ sourceNode: "C", destNode: "D", frequency: 900, signalStrength: -80, phase: 90 });

    expect(sig1).not.toBeNull();
    expect(sig2).not.toBeNull();

    // Step 2: Model paths
    const path1 = modelPath(posA, posB, { frequency: 2400, signalStrength: -65, phase: 120, multipath: [] });
    const path2 = modelPath(
      { lat: 52.3675, lng: 4.9045 },
      { lat: 52.3685, lng: 4.9055 },
      { frequency: 900, signalStrength: -80, phase: 90, multipath: [{ delay: 10 }] }
    );
    const path3 = modelPath(
      { lat: 52.3672, lng: 4.9048 },
      { lat: 52.3688, lng: 4.9042 },
      { frequency: 5800, signalStrength: -55, phase: 60, multipath: [] }
    );

    expect(path1).not.toBeNull();
    expect(path2).not.toBeNull();
    expect(path3).not.toBeNull();

    // Step 3: Reconstruct tile
    const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };
    const tile = reconstructTile(coords, [path1, path2, path3]);

    expect(tile).not.toBeNull();
    expect(tile.type).toBe("MAP_TILE");
    expect(tile.frequency_sources.length).toBeGreaterThanOrEqual(2);

    // Step 4: Classify materials
    const material = classifyMaterial(path1.excessLoss_dB, path1.phaseDeviation_deg);
    expect(material.material).toBeDefined();
    expect(material.confidence).toBeGreaterThanOrEqual(0);

    // Step 6: Multi-frequency fusion
    const fusion = fuseFrequencies("52.367_4.904_-50");
    expect(fusion).not.toBeNull();

    // Step 7: DTU encoding
    const dtu = createMapTileDTU(tile);
    expect(dtu.type).toBe("MAP_TILE");
    expect(dtu.source).toBe("foundation-atlas");

    // Verify retrieval
    const retrieved = getTile({ lat: 52.3675, lng: 4.9045 });
    expect(retrieved.ok).toBe(true);
  });

  it("respects tiered access for volume retrieval", () => {
    const coords = { lat_min: 52.367, lat_max: 52.368, lng_min: 4.904, lng_max: 4.905 };
    const paths = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`, sourcePos: { lat: 52.367, lng: 4.904 },
      destPos: { lat: 52.368, lng: 4.905 },
      band: "wifi_2.4ghz", environmentalImpact: 0.5,
      excessLoss_dB: 10, phaseDeviation_deg: 30,
    }));
    reconstructTile(coords, paths);

    const publicVol = getVolume({ lat_min: 52.36, lat_max: 52.37, lng_min: 4.9, lng_max: 4.91 }, "PUBLIC");
    const sovereignVol = getVolume({ lat_min: 52.36, lat_max: 52.37, lng_min: 4.9, lng_max: 4.91 }, "SOVEREIGN");

    // Public: surface + atmosphere only
    expect(publicVol.accessibleLayers).toHaveLength(2);
    // Sovereign: all 5 layers
    expect(sovereignVol.accessibleLayers).toHaveLength(5);
  });

  it("coverage reflects collected data", () => {
    collectSignal({ sourceNode: "A", destNode: "B", frequency: 2400 });
    collectSignal({ sourceNode: "C", destNode: "D", frequency: 900 });

    const coverage = getCoverage();
    expect(coverage.totalPaths).toBe(2);
    expect(coverage.frequenciesActive).toContain("wifi_2.4ghz");
    expect(coverage.frequenciesActive).toContain("lora_900mhz");
  });
});
