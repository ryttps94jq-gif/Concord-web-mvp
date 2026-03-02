import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionHistory } from '@/components/economy/TransactionHistory';

// ── Mock API ─────────────────────────────────────────────────────────

let mockData: unknown = null;
let mockIsLoading = false;

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({
      data: mockData,
      isLoading: mockIsLoading,
      isError: false,
      refetch: vi.fn(),
    }),
  };
});

vi.mock('@/lib/api/client', () => ({
  apiHelpers: {
    economy: {
      history: vi.fn().mockResolvedValue({ data: { transactions: [] } }),
    },
  },
}));

// ── Tests ────────────────────────────────────────────────────────────

describe('TransactionHistory', () => {
  beforeEach(() => {
    mockData = null;
    mockIsLoading = false;
  });

  it('renders loading state with skeleton items', () => {
    mockIsLoading = true;
    const { container } = render(<TransactionHistory />);
    // Should show 3 skeleton loading placeholders
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
  });

  it('shows empty state when no transactions', () => {
    mockData = { transactions: [] };
    render(<TransactionHistory />);
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  it('shows empty state when data is null', () => {
    mockData = null;
    render(<TransactionHistory />);
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  it('shows empty state when transactions field is missing', () => {
    mockData = {};
    render(<TransactionHistory />);
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  it('reads items array as fallback', () => {
    mockData = {
      items: [
        { id: 'tx-1', type: 'earn', amount: 100, description: 'Earned from bounty' },
      ],
    };
    render(<TransactionHistory />);
    expect(screen.getByText('Earned from bounty')).toBeInTheDocument();
    expect(screen.getByText('+100')).toBeInTheDocument();
  });

  it('reads history array as fallback', () => {
    mockData = {
      history: [
        { id: 'tx-2', type: 'spend', amount: -50, description: 'Purchase' },
      ],
    };
    render(<TransactionHistory />);
    expect(screen.getByText('Purchase')).toBeInTheDocument();
  });

  it('renders transaction list with descriptions', () => {
    mockData = {
      transactions: [
        { id: '1', type: 'earn', amount: 200, description: 'DTU contribution reward' },
        { id: '2', type: 'spend', amount: -75, description: 'Marketplace purchase' },
        { id: '3', type: 'transfer', amount: 50, description: 'Transfer received' },
      ],
    };
    render(<TransactionHistory />);
    expect(screen.getByText('DTU contribution reward')).toBeInTheDocument();
    expect(screen.getByText('Marketplace purchase')).toBeInTheDocument();
    expect(screen.getByText('Transfer received')).toBeInTheDocument();
  });

  it('shows positive amounts with + prefix in green', () => {
    mockData = {
      transactions: [
        { id: '1', type: 'earn', amount: 100, description: 'Reward' },
      ],
    };
    render(<TransactionHistory />);
    const amountEl = screen.getByText('+100');
    expect(amountEl).toHaveClass('text-neon-green');
  });

  it('shows negative amounts in red', () => {
    mockData = {
      transactions: [
        { id: '2', type: 'spend', amount: -50, description: 'Spend' },
      ],
    };
    render(<TransactionHistory />);
    const amountEl = screen.getByText('-50');
    expect(amountEl).toHaveClass('text-red-400');
  });

  it('falls back to type as description when description is empty', () => {
    mockData = {
      transactions: [{ id: '1', type: 'credit', amount: 10 }],
    };
    render(<TransactionHistory />);
    expect(screen.getByText('credit')).toBeInTheDocument();
  });

  it('falls back to "Transaction" when type and description are empty', () => {
    mockData = {
      transactions: [{ id: '1', amount: 10 }],
    };
    render(<TransactionHistory />);
    expect(screen.getByText('Transaction')).toBeInTheDocument();
  });

  it('shows formatted date when timestamp is provided', () => {
    mockData = {
      transactions: [
        {
          id: '1',
          type: 'earn',
          amount: 100,
          description: 'Test',
          timestamp: '2025-06-15T12:00:00.000Z',
        },
      ],
    };
    render(<TransactionHistory />);
    // Should show "Jun 15" or equivalent localized format
    expect(screen.getByText(/Jun/)).toBeInTheDocument();
  });

  it('shows formatted date from created_at as fallback', () => {
    mockData = {
      transactions: [
        {
          id: '1',
          type: 'earn',
          amount: 100,
          description: 'Test',
          created_at: '2025-03-20T12:00:00.000Z',
        },
      ],
    };
    render(<TransactionHistory />);
    expect(screen.getByText(/Mar/)).toBeInTheDocument();
  });

  it('uses index as key when id is not present', () => {
    mockData = {
      transactions: [
        { type: 'earn', amount: 50, description: 'No ID tx 1' },
        { type: 'earn', amount: 75, description: 'No ID tx 2' },
      ],
    };
    render(<TransactionHistory />);
    expect(screen.getByText('No ID tx 1')).toBeInTheDocument();
    expect(screen.getByText('No ID tx 2')).toBeInTheDocument();
  });

  it('accepts limit prop (though it is forwarded to API, not affecting render)', () => {
    mockData = {
      transactions: [
        { id: '1', type: 'earn', amount: 10, description: 'Tx' },
      ],
    };
    render(<TransactionHistory limit={5} />);
    expect(screen.getByText('Tx')).toBeInTheDocument();
  });
});
