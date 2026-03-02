import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AtlasViewer from '@/components/chat/AtlasViewer';

// ── Test Data Factories ──────────────────────────────────────────────

const makeMetrics = (overrides = {}) => ({
  initialized: true,
  coverage: {
    totalPaths: 250,
    totalTiles: 42,
    bestResolution_cm: 5,
    frequenciesActive: ['wifi', 'lora', 'bluetooth'],
  },
  stats: {
    signalsCollected: 1200,
    pathsModeled: 250,
    tilesReconstructed: 42,
    materialsClassified: 18,
    changesDetected: 7,
    queriesServed: 350,
  },
  ...overrides,
});

const makeTile = () => ({
  id: 'tile-abc-123',
  type: 'urban',
  coordinates: { lat_min: 40.7, lat_max: 40.8, lng_min: -74.0, lng_max: -73.9 },
  altitude_range: { top: 100, bottom: -5 },
  resolution_cm: 10,
  layers: {
    surface: { populated: true, pathCount: 15, angularDiversity: 0.8, avgImpact: 0.6, dominantMaterial: 'concrete' },
    subsurface: { populated: true, pathCount: 8, angularDiversity: 0.5, avgImpact: 0.4, dominantMaterial: 'soil' },
    interior: { populated: false, pathCount: 0, angularDiversity: 0, avgImpact: 0, dominantMaterial: 'unknown' },
    atmosphere: { populated: true, pathCount: 20, angularDiversity: 0.9, avgImpact: 0.3, dominantMaterial: 'air' },
  },
  frequency_sources: ['wifi_2.4ghz', 'wifi_5ghz', 'lora_868mhz'],
  node_count: 8,
  signal_paths_used: 45,
  confidence: 0.82,
  version: 3,
  created: new Date().toISOString(),
});

const makeCoverage = () => ({
  ok: true,
  totalNodes: 12,
  totalPaths: 250,
  totalTiles: 42,
  coveredArea_km2: 1.25,
  bestResolution_cm: 5,
  frequenciesActive: ['wifi', 'lora'],
  frequencyCapabilities: [
    { name: 'WiFi 2.4GHz', resolution_cm: 10, penetration: 'walls', range_m: 50 },
    { name: 'LoRa 868MHz', resolution_cm: 200, penetration: 'deep_ground', range_m: 5000 },
    { name: 'Bluetooth 5.0', resolution_cm: 5, penetration: 'thin_walls', range_m: 10 },
  ],
});

// ── Tests ────────────────────────────────────────────────────────────

describe('AtlasViewer', () => {
  // ── type="overview" ────────────────────────────────────────────

  describe('type="overview"', () => {
    it('renders Foundation Atlas header', () => {
      render(<AtlasViewer type="overview" metrics={makeMetrics()} />);
      expect(screen.getByText('Foundation Atlas')).toBeInTheDocument();
    });

    it('returns null when metrics is undefined', () => {
      const { container } = render(<AtlasViewer type="overview" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows Tomography Active when initialized', () => {
      render(<AtlasViewer type="overview" metrics={makeMetrics()} />);
      expect(screen.getByText('Tomography Active')).toBeInTheDocument();
    });

    it('shows Inactive when not initialized', () => {
      render(
        <AtlasViewer
          type="overview"
          metrics={makeMetrics({ initialized: false })}
        />
      );
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('shows stats', () => {
      render(<AtlasViewer type="overview" metrics={makeMetrics()} />);
      // Signal count
      expect(screen.getByText('1200')).toBeInTheDocument();
      // Paths modeled
      expect(screen.getByText('250')).toBeInTheDocument();
      // Tiles reconstructed
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('shows metadata line', () => {
      render(<AtlasViewer type="overview" metrics={makeMetrics()} />);
      expect(screen.getByText('Materials: 18')).toBeInTheDocument();
      expect(screen.getByText('Changes: 7')).toBeInTheDocument();
      expect(screen.getByText('Queries: 350')).toBeInTheDocument();
    });

    it('shows best resolution', () => {
      render(<AtlasViewer type="overview" metrics={makeMetrics()} />);
      expect(screen.getByText(/Best resolution: 5cm/)).toBeInTheDocument();
    });

    it('hides resolution when bestResolution_cm is null', () => {
      render(
        <AtlasViewer
          type="overview"
          metrics={makeMetrics({
            coverage: { ...makeMetrics().coverage, bestResolution_cm: null },
          })}
        />
      );
      expect(screen.queryByText(/Best resolution/)).not.toBeInTheDocument();
    });
  });

  // ── type="tile" ────────────────────────────────────────────────

  describe('type="tile"', () => {
    it('renders Map Tile header', () => {
      render(<AtlasViewer type="tile" tile={makeTile()} />);
      expect(screen.getByText('Map Tile')).toBeInTheDocument();
    });

    it('returns null when tile is undefined', () => {
      const { container } = render(<AtlasViewer type="tile" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows confidence badge', () => {
      render(<AtlasViewer type="tile" tile={makeTile()} />);
      expect(screen.getByText('82% confidence')).toBeInTheDocument();
    });

    it('shows tile metadata', () => {
      render(<AtlasViewer type="tile" tile={makeTile()} />);
      expect(screen.getByText('10cm')).toBeInTheDocument(); // resolution
      expect(screen.getByText('v3')).toBeInTheDocument(); // version
      expect(screen.getByText('45')).toBeInTheDocument(); // signal paths
      expect(screen.getByText('8')).toBeInTheDocument(); // nodes
    });

    it('shows frequency source tags', () => {
      render(<AtlasViewer type="tile" tile={makeTile()} />);
      expect(screen.getByText('wifi_2.4ghz')).toBeInTheDocument();
      expect(screen.getByText('wifi_5ghz')).toBeInTheDocument();
      expect(screen.getByText('lora_868mhz')).toBeInTheDocument();
    });

    it('toggles layer details on click', () => {
      render(<AtlasViewer type="tile" tile={makeTile()} />);

      // Initially hidden
      expect(screen.queryByText('Surface')).not.toBeInTheDocument();

      // Click to show layers
      fireEvent.click(screen.getByText('Show layers'));
      expect(screen.getByText('Surface')).toBeInTheDocument();
      expect(screen.getByText('Subsurface')).toBeInTheDocument();
      expect(screen.getByText('Atmosphere')).toBeInTheDocument();
      expect(screen.getByText('concrete')).toBeInTheDocument();
      expect(screen.getByText('soil')).toBeInTheDocument();

      // Click to hide
      fireEvent.click(screen.getByText('Hide layers'));
      expect(screen.queryByText('Surface')).not.toBeInTheDocument();
    });

    it('uses different badge color for low confidence', () => {
      const lowConfidenceTile = { ...makeTile(), confidence: 0.3 };
      render(<AtlasViewer type="tile" tile={lowConfidenceTile} />);
      expect(screen.getByText('30% confidence')).toBeInTheDocument();
    });
  });

  // ── type="coverage" ────────────────────────────────────────────

  describe('type="coverage"', () => {
    it('renders Tomography Coverage header', () => {
      render(<AtlasViewer type="coverage" coverage={makeCoverage()} />);
      expect(screen.getByText('Tomography Coverage')).toBeInTheDocument();
    });

    it('returns null when coverage is undefined', () => {
      const { container } = render(<AtlasViewer type="coverage" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows coverage stats', () => {
      render(<AtlasViewer type="coverage" coverage={makeCoverage()} />);
      expect(screen.getByText('250')).toBeInTheDocument(); // signal paths
      expect(screen.getByText('42')).toBeInTheDocument(); // tiles
      expect(screen.getByText('1.250 km\u00B2')).toBeInTheDocument(); // area
      // "5cm" appears for both the best resolution stat and the Bluetooth band
      const fiveCms = screen.getAllByText('5cm');
      expect(fiveCms.length).toBeGreaterThanOrEqual(1);
    });

    it('shows N/A when bestResolution is null', () => {
      render(
        <AtlasViewer
          type="coverage"
          coverage={{ ...makeCoverage(), bestResolution_cm: null }}
        />
      );
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('shows frequency bands', () => {
      render(<AtlasViewer type="coverage" coverage={makeCoverage()} />);
      expect(screen.getByText('WiFi 2.4GHz')).toBeInTheDocument();
      expect(screen.getByText('LoRa 868MHz')).toBeInTheDocument();
      expect(screen.getByText('Bluetooth 5.0')).toBeInTheDocument();
    });

    it('shows penetration labels', () => {
      render(<AtlasViewer type="coverage" coverage={makeCoverage()} />);
      expect(screen.getByText('walls')).toBeInTheDocument();
      expect(screen.getByText('deep ground')).toBeInTheDocument();
      expect(screen.getByText('thin walls')).toBeInTheDocument();
    });
  });

  // ── type="timeline" ────────────────────────────────────────────

  describe('type="timeline"', () => {
    it('renders Temporal Changes header', () => {
      render(<AtlasViewer type="timeline" metrics={makeMetrics()} />);
      expect(screen.getByText('Temporal Changes')).toBeInTheDocument();
    });

    it('returns null when metrics is undefined', () => {
      const { container } = render(<AtlasViewer type="timeline" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows change count', () => {
      render(<AtlasViewer type="timeline" metrics={makeMetrics()} />);
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(
        screen.getByText('Physical changes detected')
      ).toBeInTheDocument();
    });

    it('shows description text about what changes include', () => {
      render(<AtlasViewer type="timeline" metrics={makeMetrics()} />);
      expect(
        screen.getByText(/construction, demolition, weather effects/)
      ).toBeInTheDocument();
    });
  });

  // ── Unknown type ───────────────────────────────────────────────

  it('returns null for unknown type', () => {
    const { container } = render(
      <AtlasViewer type={'unknown' as 'overview'} />
    );
    expect(container.innerHTML).toBe('');
  });
});
