import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InitiativeChip, InitiativeList } from '@/components/chat/InitiativeChip';
import type { Initiative } from '@/components/chat/InitiativeChip';

// Mock fetch globally
const mockFetch = vi.fn(() => Promise.resolve({ ok: true }));
global.fetch = mockFetch as unknown as typeof fetch;

const makeInitiative = (overrides: Partial<Initiative> = {}): Initiative => ({
  id: 'init-1',
  triggerType: 'substrateDiscovery',
  message: 'New knowledge detected in your healthcare substrate.',
  priority: 'normal',
  score: 0.6,
  status: 'pending',
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('InitiativeChip', () => {
  const defaultProps = {
    initiative: makeInitiative(),
    onDismiss: vi.fn(),
    onAction: vi.fn(),
    onRespond: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<InitiativeChip {...defaultProps} />);
    expect(
      screen.getByText('New knowledge detected in your healthcare substrate.')
    ).toBeInTheDocument();
  });

  it('renders the alert role', () => {
    render(<InitiativeChip {...defaultProps} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows trigger type label for substrateDiscovery', () => {
    render(<InitiativeChip {...defaultProps} />);
    expect(screen.getByText('Discovery')).toBeInTheDocument();
  });

  it('shows trigger type label for citationAlert', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({ triggerType: 'citationAlert' })}
      />
    );
    expect(screen.getByText('Citation')).toBeInTheDocument();
  });

  it('shows trigger type label for genuineCheckIn', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({ triggerType: 'genuineCheckIn' })}
      />
    );
    expect(screen.getByText('Check-in')).toBeInTheDocument();
  });

  it('shows trigger type label for pendingWorkReminder', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({ triggerType: 'pendingWorkReminder' })}
      />
    );
    expect(screen.getByText('Pending Work')).toBeInTheDocument();
  });

  it('shows trigger type label for worldEventConnection', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({ triggerType: 'worldEventConnection' })}
      />
    );
    expect(screen.getByText('World Event')).toBeInTheDocument();
  });

  it('shows trigger type label for reflectiveFollowUp', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({ triggerType: 'reflectiveFollowUp' })}
      />
    );
    expect(screen.getByText('Reflection')).toBeInTheDocument();
  });

  it('shows trigger type label for morningContext', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({ triggerType: 'morningContext' })}
      />
    );
    expect(screen.getByText('Morning')).toBeInTheDocument();
  });

  it('uses default config for unknown trigger type', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({ triggerType: 'unknown_type' })}
      />
    );
    expect(screen.getByText('Initiative')).toBeInTheDocument();
  });

  it('shows priority dot with aria-label', () => {
    render(<InitiativeChip {...defaultProps} />);
    expect(screen.getByLabelText('normal priority')).toBeInTheDocument();
  });

  it('shows high priority dot with pulse animation', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({ priority: 'high' })}
      />
    );
    const dot = screen.getByLabelText('high priority');
    expect(dot).toHaveClass('animate-pulse');
  });

  it('shows action buttons from trigger config', () => {
    render(<InitiativeChip {...defaultProps} />);
    // substrateDiscovery has "Check it out" and "Tell me more"
    expect(screen.getByText('Check it out')).toBeInTheDocument();
    expect(screen.getByText('Tell me more')).toBeInTheDocument();
  });

  it('fires onAction and onRespond when an action button is clicked', () => {
    const onAction = vi.fn();
    const onRespond = vi.fn();
    render(
      <InitiativeChip
        {...defaultProps}
        onAction={onAction}
        onRespond={onRespond}
      />
    );

    fireEvent.click(screen.getByText('Check it out'));
    expect(onAction).toHaveBeenCalledWith('init-1', 'view_dtu', undefined);
    expect(onRespond).toHaveBeenCalledWith('init-1');
  });

  it('fires onDismiss when dismiss button is clicked', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<InitiativeChip {...defaultProps} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByLabelText('Dismiss initiative'));

    // onDismiss is called after 300ms delay
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(onDismiss).toHaveBeenCalledWith('init-1');
    vi.useRealTimers();
  });

  it('shows high relevance indicator when score > 0.7', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({ score: 0.85 })}
      />
    );
    // The high relevance indicator has a title with relevance score
    const indicator = screen.getByTitle('Relevance score: 85%');
    expect(indicator).toBeInTheDocument();
  });

  it('does not show high relevance indicator when score <= 0.7', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({ score: 0.5 })}
      />
    );
    expect(screen.queryByTitle(/Relevance score/)).not.toBeInTheDocument();
  });

  // ── Compact mode ────────────────────────────────────────────────

  it('renders compact mode', () => {
    render(<InitiativeChip {...defaultProps} compact />);
    expect(
      screen.getByText('New knowledge detected in your healthcare substrate.')
    ).toBeInTheDocument();
    // Compact mode has dismiss button
    expect(screen.getByLabelText('Dismiss initiative')).toBeInTheDocument();
    // Compact mode should not have action buttons
    expect(screen.queryByText('Check it out')).not.toBeInTheDocument();
  });

  // ── Metadata rendering ──────────────────────────────────────────

  it('shows CRETI score metadata for substrateDiscovery', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({
          triggerType: 'substrateDiscovery',
          metadata: { cretiScore: 16, domain: 'healthcare', totalNew: 3 },
        })}
      />
    );
    expect(screen.getByText('CRETI: 16')).toBeInTheDocument();
    expect(screen.getByText(/Domain: healthcare/)).toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('shows citation metadata for citationAlert', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({
          triggerType: 'citationAlert',
          metadata: { citingDtuTitle: 'Medical Research Paper', totalCitations: 5 },
        })}
      />
    );
    expect(screen.getByText(/Cited in: Medical Research Paper/)).toBeInTheDocument();
    expect(screen.getByText('5 citations total')).toBeInTheDocument();
  });

  it('shows pending work metadata', () => {
    render(
      <InitiativeChip
        {...defaultProps}
        initiative={makeInitiative({
          triggerType: 'pendingWorkReminder',
          metadata: { daysAgo: 5, pendingCount: 3 },
        })}
      />
    );
    expect(screen.getByText('5d idle')).toBeInTheDocument();
    expect(screen.getByText('3 pending items')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(
      <InitiativeChip {...defaultProps} className="custom-chip" />
    );
    expect(container.querySelector('.custom-chip')).toBeInTheDocument();
  });
});

// ── InitiativeList ────────────────────────────────────────────────────

describe('InitiativeList', () => {
  const defaultListProps = {
    initiatives: [
      makeInitiative({ id: 'i-1', message: 'First initiative' }),
      makeInitiative({ id: 'i-2', message: 'Second initiative' }),
      makeInitiative({ id: 'i-3', message: 'Third initiative' }),
      makeInitiative({ id: 'i-4', message: 'Fourth initiative' }),
    ],
    onDismiss: vi.fn(),
    onAction: vi.fn(),
    onRespond: vi.fn(),
  };

  it('renders without crashing', () => {
    render(<InitiativeList {...defaultListProps} />);
    expect(screen.getByText('First initiative')).toBeInTheDocument();
  });

  it('returns null when initiatives array is empty', () => {
    const { container } = render(
      <InitiativeList {...defaultListProps} initiatives={[]} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('limits visible items to maxVisible (default 3)', () => {
    render(<InitiativeList {...defaultListProps} />);
    expect(screen.getByText('First initiative')).toBeInTheDocument();
    expect(screen.getByText('Second initiative')).toBeInTheDocument();
    expect(screen.getByText('Third initiative')).toBeInTheDocument();
    expect(screen.queryByText('Fourth initiative')).not.toBeInTheDocument();
  });

  it('shows overflow count button', () => {
    render(<InitiativeList {...defaultListProps} />);
    expect(screen.getByText('+1 more initiative')).toBeInTheDocument();
  });

  it('shows plural overflow text for multiple overflow items', () => {
    render(
      <InitiativeList
        {...defaultListProps}
        initiatives={[
          ...defaultListProps.initiatives,
          makeInitiative({ id: 'i-5', message: 'Fifth initiative' }),
        ]}
      />
    );
    expect(screen.getByText('+2 more initiatives')).toBeInTheDocument();
  });

  it('respects custom maxVisible prop', () => {
    render(<InitiativeList {...defaultListProps} maxVisible={2} />);
    expect(screen.getByText('First initiative')).toBeInTheDocument();
    expect(screen.getByText('Second initiative')).toBeInTheDocument();
    expect(screen.queryByText('Third initiative')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more initiatives')).toBeInTheDocument();
  });

  it('renders in compact mode', () => {
    render(<InitiativeList {...defaultListProps} compact />);
    // In compact mode, action buttons should not be shown
    expect(screen.queryByText('Check it out')).not.toBeInTheDocument();
  });
});
