import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WalletBadge } from '@/components/economy/WalletBadge';

// ── Mock dependencies ────────────────────────────────────────────────

let mockBalanceData: unknown = null;

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: () => ({
      data: mockBalanceData,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
  };
});

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { tokens: 100 } }),
  },
}));

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe('WalletBadge', () => {
  beforeEach(() => {
    mockBalanceData = null;
  });

  it('renders without crashing', () => {
    render(<WalletBadge />);
    // Should show a balance number (defaults to 0.00)
    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  it('links to marketplace wallet tab', () => {
    const { container } = render(<WalletBadge />);
    const link = container.querySelector('a');
    expect(link).toHaveAttribute('href', '/lenses/marketplace?tab=wallet');
  });

  it('displays tokens balance', () => {
    mockBalanceData = { tokens: 250 };
    render(<WalletBadge />);
    expect(screen.getByText('250.00')).toBeInTheDocument();
  });

  it('displays balance field as fallback', () => {
    mockBalanceData = { balance: 42.5 };
    render(<WalletBadge />);
    expect(screen.getByText('42.50')).toBeInTheDocument();
  });

  it('displays 0.00 when balance data is null', () => {
    mockBalanceData = null;
    render(<WalletBadge />);
    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  it('displays 0.00 when balance data is empty object', () => {
    mockBalanceData = {};
    render(<WalletBadge />);
    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  it('prefers tokens over balance when both exist', () => {
    mockBalanceData = { tokens: 100, balance: 200 };
    render(<WalletBadge />);
    // WalletBadge uses: balance?.tokens ?? balance?.balance ?? 0
    expect(screen.getByText('100.00')).toBeInTheDocument();
  });
});
