import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShieldCard from '@/components/chat/ShieldCard';

// ── Test Data Factories ──────────────────────────────────────────────

const makeCleanScan = () => ({
  ok: true,
  clean: true,
  cached: false,
  hash: { sha256: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd' },
});

const makeThreatScan = () => ({
  ok: true,
  clean: false,
  cached: true,
  threat: {
    id: 'threat-1',
    subtype: 'trojan',
    severity: 8,
    hash: { sha256: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
    signatures: { clamav: 'Win.Trojan.Generic', yara: ['rule_trojan_generic'] },
    vector: 'email-attachment',
    behavior: ['file-encryption', 'registry-modification'],
    neutralization: 'Quarantine the file and scan with updated definitions.',
    first_seen: '2025-01-15T00:00:00.000Z',
    times_detected: 42,
  },
  hash: { sha256: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' },
});

const makeSecurityScore = () => ({
  score: 78,
  grade: 'B',
  breakdown: {
    scanCoverage: 85,
    threatRatio: 92,
    firewallCoverage: 65,
    recencyScore: 80,
    toolCoverage: 70,
  },
  stats: {
    totalScanned: 1500,
    threatsDetected: 12,
    cleanFiles: 1488,
    firewallRules: 45,
    recentThreats: 3,
  },
  recommendations: [
    'Enable full-depth scanning for archive files',
    'Update YARA rules to latest threat definitions',
  ],
});

const makeSweepClean = () => ({
  sweepId: 'sweep-1',
  status: 'complete',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: 12500,
  threatsFound: [],
  cleanCount: 50,
  scanCount: 50,
  toolsUsed: ['clamav', 'yara'],
});

const makeSweepWithThreats = () => ({
  sweepId: 'sweep-2',
  status: 'complete',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: 25000,
  threatsFound: [
    { dtuId: 'dtu-infected-001234567890', severity: 7 },
    { dtuId: 'dtu-infected-002345678901', severity: 9 },
  ],
  cleanCount: 48,
  scanCount: 50,
  toolsUsed: ['clamav', 'yara', 'suricata'],
});

const makeThreats = () => [
  {
    id: 't-1',
    subtype: 'ransomware',
    severity: 9,
    hash: { sha256: 'aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd' },
  },
  {
    id: 't-2',
    subtype: 'spyware',
    severity: 5,
    hash: { sha256: '1122334411223344112233441122334411223344112233441122334411223344' },
  },
];

const makePredictions = () => [
  { family: 'WannaCry', predictedVariant: 'WannaCry.v3.delta', confidence: 0.87 },
  { family: 'Emotet', predictedVariant: 'Emotet.2025.alpha', confidence: 0.64 },
];

// ── Tests ────────────────────────────────────────────────────────────

describe('ShieldCard', () => {
  // ── Scan type ──────────────────────────────────────────────────

  describe('type="scan" (clean)', () => {
    it('renders clean result', () => {
      render(<ShieldCard type="scan" scanResult={makeCleanScan()} />);
      expect(screen.getByText('File is Clean')).toBeInTheDocument();
    });

    it('shows clean confirmation text', () => {
      render(<ShieldCard type="scan" scanResult={makeCleanScan()} />);
      expect(
        screen.getByText(/No threats detected. File verified against the threat lattice./)
      ).toBeInTheDocument();
    });

    it('shows SHA256 hash', () => {
      render(<ShieldCard type="scan" scanResult={makeCleanScan()} />);
      expect(screen.getByText(/SHA256:/)).toBeInTheDocument();
    });
  });

  describe('type="scan" (threat)', () => {
    it('renders threat detected result', () => {
      render(<ShieldCard type="scan" scanResult={makeThreatScan()} />);
      expect(screen.getByText(/Threat Detected: TROJAN/)).toBeInTheDocument();
    });

    it('shows severity badge', () => {
      render(<ShieldCard type="scan" scanResult={makeThreatScan()} />);
      expect(screen.getByText('High (8/10)')).toBeInTheDocument();
    });

    it('shows cached badge when cached is true', () => {
      render(<ShieldCard type="scan" scanResult={makeThreatScan()} />);
      expect(screen.getByText('Cached')).toBeInTheDocument();
    });

    it('toggles expanded threat details', () => {
      render(<ShieldCard type="scan" scanResult={makeThreatScan()} />);

      // Initially no expanded details
      expect(screen.queryByText('Attack Vector:')).not.toBeInTheDocument();

      // Click expand
      const expandBtn = screen.getByRole('button', { name: '' });
      fireEvent.click(expandBtn);

      // Now expanded details should show
      expect(screen.getByText('Attack Vector:')).toBeInTheDocument();
      expect(screen.getByText('email-attachment')).toBeInTheDocument();
      expect(screen.getByText('Win.Trojan.Generic')).toBeInTheDocument();
      expect(screen.getByText('rule_trojan_generic')).toBeInTheDocument();
      expect(screen.getByText('file-encryption')).toBeInTheDocument();
      expect(screen.getByText('registry-modification')).toBeInTheDocument();
      expect(
        screen.getByText('Quarantine the file and scan with updated definitions.')
      ).toBeInTheDocument();
    });
  });

  // ── Score type ─────────────────────────────────────────────────

  describe('type="score"', () => {
    it('renders security score', () => {
      render(
        <ShieldCard type="score" securityScore={makeSecurityScore()} />
      );
      expect(screen.getByText('Security Score')).toBeInTheDocument();
      expect(screen.getByText('78/100')).toBeInTheDocument();
    });

    it('shows grade badge', () => {
      render(
        <ShieldCard type="score" securityScore={makeSecurityScore()} />
      );
      expect(screen.getByText('Grade B')).toBeInTheDocument();
    });

    it('toggles expanded breakdown', () => {
      render(
        <ShieldCard type="score" securityScore={makeSecurityScore()} />
      );

      // Initially not showing breakdown
      expect(screen.queryByText('Scan Coverage')).not.toBeInTheDocument();

      // Click expand button
      const buttons = screen.getAllByRole('button');
      const expandBtn = buttons.find((btn) =>
        btn.querySelector('svg')
      );
      fireEvent.click(expandBtn!);

      // Now shows breakdown
      expect(screen.getByText('Scan Coverage')).toBeInTheDocument();
      expect(screen.getByText('Threat Ratio')).toBeInTheDocument();
      expect(screen.getByText('Firewall Coverage')).toBeInTheDocument();
      expect(screen.getByText('1500 scanned')).toBeInTheDocument();
      expect(screen.getByText('12 threats')).toBeInTheDocument();
    });

    it('shows recommendations when expanded', () => {
      render(
        <ShieldCard type="score" securityScore={makeSecurityScore()} />
      );

      const buttons = screen.getAllByRole('button');
      const expandBtn = buttons.find((btn) => btn.querySelector('svg'));
      fireEvent.click(expandBtn!);

      expect(screen.getByText('Recommendations:')).toBeInTheDocument();
      expect(
        screen.getByText('Enable full-depth scanning for archive files')
      ).toBeInTheDocument();
    });
  });

  // ── Sweep type ─────────────────────────────────────────────────

  describe('type="sweep"', () => {
    it('renders clean sweep result', () => {
      render(<ShieldCard type="sweep" sweepResult={makeSweepClean()} />);
      expect(screen.getByText(/System Sweep Complete/)).toBeInTheDocument();
      expect(screen.getByText('50 scanned')).toBeInTheDocument();
      expect(screen.getByText('50 clean')).toBeInTheDocument();
    });

    it('renders sweep with threats', () => {
      render(
        <ShieldCard type="sweep" sweepResult={makeSweepWithThreats()} />
      );
      expect(screen.getByText('2 threats')).toBeInTheDocument();
    });

    it('shows tools used and duration when expanded', () => {
      render(<ShieldCard type="sweep" sweepResult={makeSweepClean()} />);

      const buttons = screen.getAllByRole('button');
      const expandBtn = buttons.find((btn) => btn.querySelector('svg'));
      fireEvent.click(expandBtn!);

      expect(screen.getByText(/Clamav, Yara/)).toBeInTheDocument();
      expect(screen.getByText(/12.5s/)).toBeInTheDocument();
    });
  });

  // ── Threats type ───────────────────────────────────────────────

  describe('type="threats"', () => {
    it('renders threat feed', () => {
      render(<ShieldCard type="threats" threats={makeThreats()} />);
      expect(screen.getByText('Threat Intelligence Feed')).toBeInTheDocument();
      expect(screen.getByText('2 recent threats')).toBeInTheDocument();
    });

    it('shows threat subtypes', () => {
      render(<ShieldCard type="threats" threats={makeThreats()} />);
      expect(screen.getByText('ransomware')).toBeInTheDocument();
      expect(screen.getByText('spyware')).toBeInTheDocument();
    });

    it('shows severity scores', () => {
      render(<ShieldCard type="threats" threats={makeThreats()} />);
      expect(screen.getByText('9/10')).toBeInTheDocument();
      expect(screen.getByText('5/10')).toBeInTheDocument();
    });
  });

  // ── Predictions type ───────────────────────────────────────────

  describe('type="prediction"', () => {
    it('renders predictions', () => {
      render(
        <ShieldCard type="prediction" predictions={makePredictions()} />
      );
      expect(screen.getByText('Prophet Predictions')).toBeInTheDocument();
      expect(screen.getByText('2 predicted variants')).toBeInTheDocument();
    });

    it('shows prediction details', () => {
      render(
        <ShieldCard type="prediction" predictions={makePredictions()} />
      );
      expect(screen.getByText('WannaCry')).toBeInTheDocument();
      expect(screen.getByText('WannaCry.v3.delta')).toBeInTheDocument();
      expect(screen.getByText('87%')).toBeInTheDocument();
      expect(screen.getByText('Emotet')).toBeInTheDocument();
      expect(screen.getByText('64%')).toBeInTheDocument();
    });
  });
});
