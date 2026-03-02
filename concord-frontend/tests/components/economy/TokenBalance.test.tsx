import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TokenBalance } from '@/components/economy/TokenBalance';

// ── Mock API ─────────────────────────────────────────────────────────

let mockBalanceData: unknown = { balance: 1234 };
let mockIsLoading = false;

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: (opts: { queryKey: unknown[] }) => ({
      data: mockBalanceData,
      isLoading: mockIsLoading,
      isError: false,
      refetch: vi.fn(),
    }),
  };
});

vi.mock('@/lib/api/client', () => ({
  apiHelpers: {
    economy: {
      balance: vi.fn().mockResolvedValue({ data: { balance: 1234 } }),
    },
  },
}));

// ── Tests ────────────────────────────────────────────────────────────

describe('TokenBalance', () => {
  beforeEach(() => {
    mockBalanceData = { balance: 1234 };
    mockIsLoading = false;
  });

  it('renders without crashing', () => {
    render(<TokenBalance />);
    expect(screen.getByText('tokens')).toBeInTheDocument();
  });

  it('displays the balance when loaded', () => {
    render(<TokenBalance />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('shows loading state with dots', () => {
    mockIsLoading = true;
    render(<TokenBalance />);
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('shows 0 when balance data is null', () => {
    mockBalanceData = null;
    render(<TokenBalance />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('reads tokens field as fallback', () => {
    mockBalanceData = { tokens: 5678 };
    render(<TokenBalance />);
    expect(screen.getByText('5,678')).toBeInTheDocument();
  });

  it('defaults to 0 when no balance or tokens field', () => {
    mockBalanceData = {};
    render(<TokenBalance />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('accepts optional userId prop', () => {
    render(<TokenBalance userId="user-123" />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });
});
