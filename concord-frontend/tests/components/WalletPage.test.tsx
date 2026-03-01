import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the api client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  apiHelpers: {
    economy: {
      connectStatus: vi.fn(),
    },
  },
}));

// Mock useLensNav
vi.mock('@/hooks/useLensNav', () => ({
  useLensNav: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn(() => null),
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) =>
      React.createElement('div', { ...props, ref }, children)
    ),
    button: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLButtonElement>) =>
      React.createElement('button', { ...props, ref }, children)
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children),
}));

// Mock sub-components
vi.mock('@/components/wallet/PurchaseFlow', () => ({
  PurchaseFlow: ({ onClose }: { onClose?: () => void }) =>
    React.createElement('div', { 'data-testid': 'purchase-flow' }, 'Purchase Flow'),
}));

vi.mock('@/components/wallet/WithdrawFlow', () => ({
  WithdrawFlow: ({ onClose }: { onClose?: () => void }) =>
    React.createElement('div', { 'data-testid': 'withdraw-flow' }, 'Withdraw Flow'),
}));

import { api, apiHelpers } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

const mockedApiHelpers = apiHelpers as unknown as {
  economy: {
    connectStatus: ReturnType<typeof vi.fn>;
  };
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(React.Suspense, { fallback: 'Loading...' }, children)
    );
  };
}

describe('WalletPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Balance
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('balance')) {
        return Promise.resolve({
          data: { balance: 1250, totalCredits: 2000, totalDebits: 750, tokens: 1250 },
        });
      }
      if (url.includes('transactions')) {
        return Promise.resolve({
          data: {
            transactions: [
              {
                id: 'tx-1',
                type: 'purchase',
                amount: 100,
                description: 'Bought 100 CC',
                status: 'completed',
                created_at: '2026-02-28T10:00:00Z',
              },
              {
                id: 'tx-2',
                type: 'tip',
                amount: -5,
                description: 'Tipped @alice',
                status: 'completed',
                created_at: '2026-02-27T15:00:00Z',
              },
            ],
            total: 2,
            hasMore: false,
          },
        });
      }
      if (url.includes('withdrawals')) {
        return Promise.resolve({ data: { withdrawals: [] } });
      }
      return Promise.resolve({ data: {} });
    });

    mockedApiHelpers.economy.connectStatus.mockResolvedValue({
      data: { connected: true, stripeAccountId: 'acct_123', onboardingComplete: true },
    });
  });

  it('renders balance card with CC amount', async () => {
    // Dynamic import to avoid issues with module-level hooks
    const { default: WalletPage } = await import('@/app/lenses/wallet/page');
    render(React.createElement(WalletPage), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/1,250|1250/)).toBeDefined();
    });
  });

  it('renders Buy CC button', async () => {
    const { default: WalletPage } = await import('@/app/lenses/wallet/page');
    render(React.createElement(WalletPage), { wrapper: createWrapper() });

    await waitFor(() => {
      const buyBtn = screen.queryByText(/buy cc|buy tokens|purchase/i);
      expect(buyBtn).not.toBeNull();
    });
  });

  it('withdraw section shows for connected users', async () => {
    const { default: WalletPage } = await import('@/app/lenses/wallet/page');
    render(React.createElement(WalletPage), { wrapper: createWrapper() });

    await waitFor(() => {
      const withdrawBtn = screen.queryByText(/withdraw/i);
      expect(withdrawBtn).not.toBeNull();
    });
  });

  it('transaction history renders', async () => {
    const { default: WalletPage } = await import('@/app/lenses/wallet/page');
    render(React.createElement(WalletPage), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/bought 100 cc|tipped @alice/i)).toBeDefined();
    });
  });

  it('loading state during balance fetch', async () => {
    mockedApi.get.mockReturnValue(new Promise(() => {}));

    const { default: WalletPage } = await import('@/app/lenses/wallet/page');
    render(React.createElement(WalletPage), { wrapper: createWrapper() });

    // Should show loading state
    const loading = screen.queryByText(/loading/i) ||
      document.querySelector('.animate-spin, .animate-pulse');
    expect(loading).not.toBeNull();
  });

  it('renders transaction filter tabs', async () => {
    const { default: WalletPage } = await import('@/app/lenses/wallet/page');
    render(React.createElement(WalletPage), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('All')).toBeDefined();
      expect(screen.getByText('Purchases')).toBeDefined();
      expect(screen.getByText('Tips')).toBeDefined();
    });
  });
});
