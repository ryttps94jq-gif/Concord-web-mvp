import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FoundationCard from '@/components/chat/FoundationCard';

// ── Test Data Factories ──────────────────────────────────────────────

const makeStatus = (overrides = {}) => ({
  modules: [
    { name: 'Sense', key: 'sense', initialized: true, metrics: { sensitivity: 0.8 } },
    { name: 'Identity', key: 'identity', initialized: true, metrics: { fingerprints: 12 } },
    { name: 'Emergency', key: 'emergency', initialized: false, metrics: {} },
  ],
  emergencyMode: false,
  totalModules: 3,
  initializedModules: 2,
  ...overrides,
}) as any;

const makeReadings = () => [
  {
    id: 'r-1',
    subtype: 'wifi',
    channel: 'ch-1',
    measurements: { signal_strength: -42, noise_floor: -90, anomaly_score: 0.5 },
    created: new Date().toISOString(),
  },
  {
    id: 'r-2',
    subtype: 'bluetooth',
    channel: 'ch-2',
    measurements: { signal_strength: null, noise_floor: null, anomaly_score: 4.0 },
    created: new Date().toISOString(),
  },
];

const makeAlerts = () => [
  {
    id: 'a-1',
    severity: 9,
    subtype: 'fire',
    content: { situation: 'Building fire detected in sector 7' },
    created: new Date().toISOString(),
    verified: true,
  },
  {
    id: 'a-2',
    severity: 3,
    subtype: 'flood',
    content: { situation: 'Minor flooding in parking area' },
    created: new Date().toISOString(),
    verified: false,
  },
];

const makeNeuralReadiness = (overrides = {}) => ({
  ready: true,
  readiness: 0.85,
  checks: {
    cortex_initialized: true,
    memory_loaded: true,
    inference_engine: false,
  },
  simulationMode: false,
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────

describe('FoundationCard', () => {
  // ── type="status" ──────────────────────────────────────────────

  describe('type="status"', () => {
    it('renders Foundation Sovereignty header', () => {
      render(<FoundationCard type="status" status={makeStatus()} />);
      expect(screen.getByText('Foundation Sovereignty')).toBeInTheDocument();
    });

    it('returns null when status prop is undefined', () => {
      const { container } = render(<FoundationCard type="status" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows initialized/total module count', () => {
      render(<FoundationCard type="status" status={makeStatus()} />);
      expect(screen.getByText('2/3 Active')).toBeInTheDocument();
    });

    it('shows EMERGENCY badge when emergencyMode is true', () => {
      render(
        <FoundationCard
          type="status"
          status={makeStatus({ emergencyMode: true })}
        />
      );
      expect(screen.getByText('EMERGENCY')).toBeInTheDocument();
    });

    it('renders module list with ON/OFF states', () => {
      render(<FoundationCard type="status" status={makeStatus()} />);
      const onTexts = screen.getAllByText('ON');
      const offTexts = screen.getAllByText('OFF');
      expect(onTexts.length).toBe(2); // sense, identity
      expect(offTexts.length).toBe(1); // emergency
    });

    it('shows module names', () => {
      render(<FoundationCard type="status" status={makeStatus()} />);
      expect(screen.getByText('Sense')).toBeInTheDocument();
      expect(screen.getByText('Identity')).toBeInTheDocument();
      expect(screen.getByText('Emergency')).toBeInTheDocument();
    });

    it('toggles details on button click', () => {
      render(<FoundationCard type="status" status={makeStatus()} />);

      // Click to show details
      fireEvent.click(screen.getByText('Show details'));
      expect(screen.getByText('Hide details')).toBeInTheDocument();
      // Details should show metrics for initialized modules
      expect(screen.getByText('sensitivity')).toBeInTheDocument();

      // Click to hide
      fireEvent.click(screen.getByText('Hide details'));
      expect(screen.getByText('Show details')).toBeInTheDocument();
    });
  });

  // ── type="sense" ───────────────────────────────────────────────

  describe('type="sense"', () => {
    it('renders Sensor Readings header', () => {
      render(<FoundationCard type="sense" readings={makeReadings()} />);
      expect(screen.getByText('Sensor Readings')).toBeInTheDocument();
    });

    it('returns null when readings prop is undefined', () => {
      const { container } = render(<FoundationCard type="sense" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows reading count', () => {
      render(<FoundationCard type="sense" readings={makeReadings()} />);
      expect(screen.getByText('2 readings')).toBeInTheDocument();
    });

    it('shows "No sensor readings yet" when array is empty', () => {
      render(<FoundationCard type="sense" readings={[]} />);
      expect(screen.getByText('No sensor readings yet')).toBeInTheDocument();
    });

    it('shows subtypes for each reading', () => {
      render(<FoundationCard type="sense" readings={makeReadings()} />);
      expect(screen.getByText('wifi')).toBeInTheDocument();
      expect(screen.getByText('bluetooth')).toBeInTheDocument();
    });

    it('shows signal strength when available', () => {
      render(<FoundationCard type="sense" readings={makeReadings()} />);
      expect(screen.getByText('-42 dBm')).toBeInTheDocument();
    });
  });

  // ── type="emergency" ───────────────────────────────────────────

  describe('type="emergency"', () => {
    it('renders Emergency Alerts header', () => {
      render(<FoundationCard type="emergency" alerts={makeAlerts()} />);
      expect(screen.getByText('Emergency Alerts')).toBeInTheDocument();
    });

    it('returns null when alerts prop is undefined', () => {
      const { container } = render(<FoundationCard type="emergency" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows "No active emergencies" when alerts array is empty', () => {
      render(<FoundationCard type="emergency" alerts={[]} />);
      expect(screen.getByText('No active emergencies')).toBeInTheDocument();
    });

    it('shows severity badges', () => {
      render(<FoundationCard type="emergency" alerts={makeAlerts()} />);
      expect(screen.getByText('SEV 9')).toBeInTheDocument();
      expect(screen.getByText('SEV 3')).toBeInTheDocument();
    });

    it('shows alert situation descriptions', () => {
      render(<FoundationCard type="emergency" alerts={makeAlerts()} />);
      expect(
        screen.getByText('Building fire detected in sector 7')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Minor flooding in parking area')
      ).toBeInTheDocument();
    });

    it('shows subtype labels', () => {
      render(<FoundationCard type="emergency" alerts={makeAlerts()} />);
      expect(screen.getByText('fire')).toBeInTheDocument();
      expect(screen.getByText('flood')).toBeInTheDocument();
    });
  });

  // ── type="neural" ──────────────────────────────────────────────

  describe('type="neural"', () => {
    it('renders Neural Interface Readiness header', () => {
      render(
        <FoundationCard type="neural" neuralReadiness={makeNeuralReadiness()} />
      );
      expect(screen.getByText('Neural Interface Readiness')).toBeInTheDocument();
    });

    it('returns null when neuralReadiness prop is undefined', () => {
      const { container } = render(<FoundationCard type="neural" />);
      expect(container.innerHTML).toBe('');
    });

    it('shows Ready badge when ready is true', () => {
      render(
        <FoundationCard type="neural" neuralReadiness={makeNeuralReadiness()} />
      );
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('shows Preparing badge when ready is false', () => {
      render(
        <FoundationCard
          type="neural"
          neuralReadiness={makeNeuralReadiness({ ready: false })}
        />
      );
      expect(screen.getByText('Preparing')).toBeInTheDocument();
    });

    it('shows Simulation badge when simulationMode is true', () => {
      render(
        <FoundationCard
          type="neural"
          neuralReadiness={makeNeuralReadiness({ simulationMode: true })}
        />
      );
      expect(screen.getByText('Simulation')).toBeInTheDocument();
    });

    it('shows readiness percentage', () => {
      render(
        <FoundationCard type="neural" neuralReadiness={makeNeuralReadiness()} />
      );
      expect(screen.getByText('85% ready')).toBeInTheDocument();
    });

    it('shows check items', () => {
      render(
        <FoundationCard type="neural" neuralReadiness={makeNeuralReadiness()} />
      );
      expect(screen.getByText('cortex initialized')).toBeInTheDocument();
      expect(screen.getByText('memory loaded')).toBeInTheDocument();
      expect(screen.getByText('inference engine')).toBeInTheDocument();
    });
  });

  // ── default/unknown type ───────────────────────────────────────

  describe('unknown type', () => {
    it('returns null for unhandled type', () => {
      const { container } = render(
        <FoundationCard type={'unknown' as 'status'} />
      );
      expect(container.innerHTML).toBe('');
    });
  });
});
