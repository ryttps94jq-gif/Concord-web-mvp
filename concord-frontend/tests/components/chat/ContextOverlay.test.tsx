import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContextOverlay } from '@/components/chat/ContextOverlay';

// Mock the api module
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/lib/api/client';

const mockContextData = {
  ok: true,
  workingSet: [
    {
      id: 'dtu_abc123',
      title: 'Physics Fundamentals',
      tier: 'regular',
      tags: ['science', 'physics'],
      score: 0.85,
      sources: {
        queryMatch: true,
        edgeSpread: false,
        globalWarmth: true,
        userProfileSeed: false,
        autogen: false,
      },
    },
    {
      id: 'mega_def456',
      title: 'Science Mega Summary',
      tier: 'mega',
      tags: ['science', 'consolidated'],
      score: 0.72,
      sources: {
        queryMatch: false,
        edgeSpread: true,
        globalWarmth: false,
        userProfileSeed: false,
        autogen: false,
      },
    },
  ],
  totalActivated: 5,
  entityState: { valence: 0.65, fatigue: 0.3 },
  conversationSummary: 'We discussed quantum physics and relativity.',
  tokenBudget: {
    contextWindow: 32768,
    budgets: { systemPrompt: 4915, conversationSummary: 3276, dtuContext: 16384, responseSpace: 8192 },
    ratios: { systemPrompt: 0.15, conversationSummary: 0.10, dtuContext: 0.50, responseSpace: 0.25 },
  },
  sources: {
    conversationSummary: 'available',
    semanticSearch: 2,
    entityState: 'available',
    megaHyperConsolidation: 1,
  },
};

describe('ContextOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when not open', () => {
    const { container } = render(
      <ContextOverlay sessionId="s1" isOpen={false} onClose={() => {}} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders overlay when open', () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockContextData });
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Context Working Set')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    (api.get as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Loading context...')).toBeInTheDocument();
  });

  it('displays DTU count after loading', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockContextData });
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('2 DTUs')).toBeInTheDocument();
    });
  });

  it('displays DTU titles', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockContextData });
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Physics Fundamentals')).toBeInTheDocument();
      expect(screen.getByText('Science Mega Summary')).toBeInTheDocument();
    });
  });

  it('displays tier badges', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockContextData });
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('regular')).toBeInTheDocument();
      expect(screen.getByText('mega')).toBeInTheDocument();
    });
  });

  it('displays conversation summary', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockContextData });
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('We discussed quantum physics and relativity.')).toBeInTheDocument();
    });
  });

  it('displays token budget bar', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockContextData });
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Token Budget/)).toBeInTheDocument();
      expect(screen.getByText(/32,768 tokens/)).toBeInTheDocument();
    });
  });

  it('calls onClose when X button clicked', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockContextData });
    const onClose = vi.fn();
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={onClose} />);
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('expands DTU details on click', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockContextData });
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Physics Fundamentals')).toBeInTheDocument();
    });

    // Click on DTU to expand
    fireEvent.click(screen.getByText('Physics Fundamentals'));

    // Should show tags
    await waitFor(() => {
      expect(screen.getByText('science')).toBeInTheDocument();
      expect(screen.getByText('physics')).toBeInTheDocument();
    });
  });

  it('shows error message on fetch failure', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('passes correct params to API', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockContextData });
    render(<ContextOverlay sessionId="test-session" lens="physics" isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('sessionId=test-session')
      );
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('lens=physics')
      );
    });
  });

  it('displays empty working set message', async () => {
    const emptyData = { ...mockContextData, workingSet: [], totalActivated: 0 };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: emptyData });
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/No DTUs in working set/)).toBeInTheDocument();
    });
  });

  it('shows entity state when available', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockContextData });
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Entity State')).toBeInTheDocument();
    });
  });

  it('displays source activation badges', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockContextData });
    render(<ContextOverlay sessionId="s1" isOpen={true} onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Physics Fundamentals')).toBeInTheDocument();
    });

    // Expand first DTU
    fireEvent.click(screen.getByText('Physics Fundamentals'));

    await waitFor(() => {
      // Query source badge should be visible (queryMatch: true)
      expect(screen.getByText('Query')).toBeInTheDocument();
      // Global warmth badge should be visible (globalWarmth: true)
      expect(screen.getByText('Global')).toBeInTheDocument();
    });
  });
});
