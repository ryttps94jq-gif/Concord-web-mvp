import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IntelligenceCard from '@/components/chat/IntelligenceCard';

// ── Test Data Factories ──────────────────────────────────────────────

const makeMetrics = (overrides = {}) => ({
  initialized: true,
  classifierActive: true,
  classifier: {
    totalClassified: 500,
    routedPublic: 300,
    routedResearch: 150,
    routedSovereign: 50,
    ambiguousUpgraded: 25,
  },
  tiers: {
    public: {
      categories: { weather: 120, geology: 80, energy: 60, ocean: 40 },
      totalDTUs: 300,
    },
    research: {
      entries: 150,
      activeGrants: 3,
      pendingApplications: 2,
      totalDTUs: 150,
    },
    sovereign: {
      count: 50,
      categories: { classified: 30, personal: 20 },
      isolated: true,
    },
  },
  uptime: 86400000,
  ...overrides,
});

const makePublicData = (overrides = {}) => ({
  ok: true,
  tier: 'public',
  category: 'weather',
  count: 2,
  total: 120,
  data: [
    {
      id: 'pub-1',
      type: 'sensor',
      tier: 'public',
      category: 'weather',
      classification: 'auto',
      created: new Date().toISOString(),
      confidence: 0.92,
      sources: 5,
      data: { summary: 'Temperature anomaly detected in sector A', measurements: {} },
      coverage_area: { center: { lat: 40.7, lng: -74.0 }, radius_km: 10 },
      commercially_licensable: true,
    },
    {
      id: 'pub-2',
      type: 'sensor',
      tier: 'public',
      category: 'weather',
      classification: 'auto',
      created: new Date().toISOString(),
      confidence: 0.45,
      sources: 2,
      data: { summary: null, measurements: {} },
      coverage_area: { center: { lat: 41.0, lng: -73.5 }, radius_km: 5 },
      commercially_licensable: true,
    },
  ],
  ...overrides,
});

const makeClassifierStatus = () => ({
  active: true,
  stats: {
    totalClassified: 500,
    routedPublic: 300,
    routedResearch: 150,
    routedSovereign: 50,
    ambiguousUpgraded: 25,
  },
  thresholds: { sensitivity: 0.7, sovereign: 0.9 },
});

// ── Tests ────────────────────────────────────────────────────────────

describe('IntelligenceCard', () => {
  // ── type="overview" ────────────────────────────────────────────

  describe('type="overview"', () => {
    it('renders Foundation Intelligence header', () => {
      render(<IntelligenceCard type="overview" metrics={makeMetrics()} />);
      expect(screen.getByText('Foundation Intelligence')).toBeInTheDocument();
    });

    it('returns null when metrics is undefined', () => {
      const { container } = render(<IntelligenceCard type="overview" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows Classifier Active badge when active', () => {
      render(<IntelligenceCard type="overview" metrics={makeMetrics()} />);
      expect(screen.getByText('Classifier Active')).toBeInTheDocument();
    });

    it('shows Inactive badge when classifier not active', () => {
      render(
        <IntelligenceCard
          type="overview"
          metrics={makeMetrics({ classifierActive: false })}
        />
      );
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('shows tier DTU counts', () => {
      render(<IntelligenceCard type="overview" metrics={makeMetrics()} />);
      // Public tier
      expect(screen.getByText('300')).toBeInTheDocument();
      // Research tier
      expect(screen.getByText('150')).toBeInTheDocument();
      // Sovereign tier
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('shows tier labels', () => {
      render(<IntelligenceCard type="overview" metrics={makeMetrics()} />);
      expect(screen.getByText('Public')).toBeInTheDocument();
      expect(screen.getByText('Research')).toBeInTheDocument();
      expect(screen.getByText('Sovereign')).toBeInTheDocument();
    });

    it('shows classifier stats', () => {
      render(<IntelligenceCard type="overview" metrics={makeMetrics()} />);
      expect(screen.getByText('Classified: 500')).toBeInTheDocument();
      expect(screen.getByText('Upgraded: 25')).toBeInTheDocument();
    });

    it('toggles categories on button click', () => {
      render(<IntelligenceCard type="overview" metrics={makeMetrics()} />);

      expect(screen.queryByText('weather')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Show categories'));
      expect(screen.getByText('weather')).toBeInTheDocument();
      expect(screen.getByText('geology')).toBeInTheDocument();
      expect(screen.getByText('energy')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Hide categories'));
      expect(screen.queryByText('weather')).not.toBeInTheDocument();
    });
  });

  // ── type="public" ──────────────────────────────────────────────

  describe('type="public"', () => {
    it('renders public intelligence header with category', () => {
      render(
        <IntelligenceCard type="public" publicData={makePublicData()} />
      );
      expect(screen.getByText('weather Intelligence')).toBeInTheDocument();
      expect(screen.getByText('PUBLIC')).toBeInTheDocument();
    });

    it('returns null when publicData is undefined', () => {
      const { container } = render(<IntelligenceCard type="public" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows "No intelligence data yet" when count is 0', () => {
      render(
        <IntelligenceCard
          type="public"
          publicData={makePublicData({ count: 0, data: [] })}
        />
      );
      expect(screen.getByText('No intelligence data yet')).toBeInTheDocument();
    });

    it('shows DTU summaries', () => {
      render(
        <IntelligenceCard type="public" publicData={makePublicData()} />
      );
      expect(
        screen.getByText('Temperature anomaly detected in sector A')
      ).toBeInTheDocument();
    });

    it('shows confidence percentages', () => {
      render(
        <IntelligenceCard type="public" publicData={makePublicData()} />
      );
      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();
    });

    it('shows total entries', () => {
      render(
        <IntelligenceCard type="public" publicData={makePublicData()} />
      );
      expect(
        screen.getByText('120 total entries | Commercially licensable')
      ).toBeInTheDocument();
    });
  });

  // ── type="classifier" ──────────────────────────────────────────

  describe('type="classifier"', () => {
    it('renders Sovereign Classifier header', () => {
      render(
        <IntelligenceCard
          type="classifier"
          classifierStatus={makeClassifierStatus()}
        />
      );
      expect(screen.getByText('Sovereign Classifier')).toBeInTheDocument();
    });

    it('returns null when classifierStatus is undefined', () => {
      const { container } = render(
        <IntelligenceCard type="classifier" />
      );
      expect(container.innerHTML).toBe('');
    });

    it('shows Active badge when classifier is active', () => {
      render(
        <IntelligenceCard
          type="classifier"
          classifierStatus={makeClassifierStatus()}
        />
      );
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows tier routing percentages', () => {
      render(
        <IntelligenceCard
          type="classifier"
          classifierStatus={makeClassifierStatus()}
        />
      );
      // 300/500 = 60% public
      expect(screen.getByText('60%')).toBeInTheDocument();
      // 150/500 = 30% research
      expect(screen.getByText('30%')).toBeInTheDocument();
      // 50/500 = 10% sovereign
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('shows threshold values', () => {
      render(
        <IntelligenceCard
          type="classifier"
          classifierStatus={makeClassifierStatus()}
        />
      );
      expect(screen.getByText('Sensitivity: 0.7')).toBeInTheDocument();
      expect(screen.getByText('Sovereign: 0.9')).toBeInTheDocument();
    });
  });

  // ── type="research" ────────────────────────────────────────────

  describe('type="research"', () => {
    it('renders Research Partition header', () => {
      render(<IntelligenceCard type="research" metrics={makeMetrics()} />);
      expect(screen.getByText('Research Partition')).toBeInTheDocument();
      expect(screen.getByText('RESTRICTED')).toBeInTheDocument();
    });

    it('returns null when metrics is undefined', () => {
      const { container } = render(<IntelligenceCard type="research" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows research stats', () => {
      render(<IntelligenceCard type="research" metrics={makeMetrics()} />);
      // Entries
      const entries = screen.getAllByText('150');
      expect(entries.length).toBeGreaterThanOrEqual(1);
      // Active Grants
      expect(screen.getByText('3')).toBeInTheDocument();
      // Pending
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows governance text', () => {
      render(<IntelligenceCard type="research" metrics={makeMetrics()} />);
      expect(
        screen.getByText(
          'Lineage tracking enforced | Transfer prohibited | Governance-approved access only'
        )
      ).toBeInTheDocument();
    });
  });

  // ── Unknown type ───────────────────────────────────────────────

  it('returns null for unknown type', () => {
    const { container } = render(
      <IntelligenceCard type={'unknown' as 'overview'} />
    );
    expect(container.innerHTML).toBe('');
  });
});
