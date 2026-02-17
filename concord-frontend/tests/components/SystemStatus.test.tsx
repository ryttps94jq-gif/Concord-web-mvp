import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Wifi: ({ className }: { className?: string }) => <span data-testid="wifi-icon" className={className} />,
  WifiOff: ({ className }: { className?: string }) => <span data-testid="wifi-off-icon" className={className} />,
  Shield: ({ className }: { className?: string }) => <span data-testid="shield-icon" className={className} />,
  AlertTriangle: ({ className }: { className?: string }) => <span data-testid="alert-icon" className={className} />,
  ChevronDown: ({ className }: { className?: string }) => <span data-testid="chevron-down" className={className} />,
  ChevronUp: ({ className }: { className?: string }) => <span data-testid="chevron-up" className={className} />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | boolean | undefined | null)[]) => args.filter(Boolean).join(' '),
}));

// Mock API client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { ok: true, version: '5.0.0', infrastructure: { auth: { mode: 'jwt' } } } }),
  },
}));

// Mock UI store
const mockClearRequestErrors = vi.fn();
const mockUIStoreState = {
  requestErrors: [] as any[],
  clearRequestErrors: mockClearRequestErrors,
  authPosture: { mode: 'jwt', usesJwt: true, usesApiKey: false },
};

vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (s: any) => any) => selector(mockUIStoreState),
}));

import { SystemStatus } from '@/components/common/SystemStatus';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('SystemStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUIStoreState.requestErrors = [];
  });

  it('renders the "System OK" button when healthy and no errors', async () => {
    render(<SystemStatus />, { wrapper: createWrapper() });

    // Before query resolves, component renders in some state
    // The "System OK" button shows when isHealthy and no errors
    expect(screen.getByText('System OK')).toBeInTheDocument();
  });

  it('expands on click of System OK button', async () => {
    render(<SystemStatus />, { wrapper: createWrapper() });

    const okButton = screen.getByText('System OK');
    fireEvent.click(okButton);

    expect(screen.getByText('System Status')).toBeInTheDocument();
  });

  it('shows expanded panel with auth mode info', () => {
    render(<SystemStatus />, { wrapper: createWrapper() });

    // Click to expand
    fireEvent.click(screen.getByText('System OK'));

    // Should show auth mode
    expect(screen.getByText('Auth Mode:')).toBeInTheDocument();
  });

  it('shows error count badge when there are errors', () => {
    mockUIStoreState.requestErrors = [
      { id: 'err-1', at: new Date().toISOString(), message: 'Error 1', status: 500, method: 'GET', path: '/api/test', reason: 'Server error' },
    ];

    render(<SystemStatus />, { wrapper: createWrapper() });

    // With errors the full panel should show, not just "System OK" button
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows recent errors in expanded view', () => {
    mockUIStoreState.requestErrors = [
      { id: 'err-1', at: new Date().toISOString(), message: 'Bad request', status: 400, method: 'POST', path: '/api/dtus', reason: 'Invalid payload' },
    ];

    render(<SystemStatus />, { wrapper: createWrapper() });

    // Click to expand
    const header = screen.getByText('System Status');
    fireEvent.click(header.closest('button')!);

    expect(screen.getByText('Recent Errors')).toBeInTheDocument();
    expect(screen.getByText('400')).toBeInTheDocument();
    expect(screen.getByText('Invalid payload')).toBeInTheDocument();
  });

  it('clears errors when Clear button is clicked', () => {
    mockUIStoreState.requestErrors = [
      { id: 'err-1', at: new Date().toISOString(), message: 'Error', status: 500, method: 'GET', path: '/test', reason: 'fail' },
    ];

    render(<SystemStatus />, { wrapper: createWrapper() });

    // Expand
    const header = screen.getByText('System Status');
    fireEvent.click(header.closest('button')!);

    const clearBtn = screen.getByText('Clear');
    fireEvent.click(clearBtn);

    expect(mockClearRequestErrors).toHaveBeenCalled();
  });

  it('collapses when Collapse button is clicked', () => {
    render(<SystemStatus />, { wrapper: createWrapper() });

    // Expand first
    fireEvent.click(screen.getByText('System OK'));
    expect(screen.getByText('Collapse')).toBeInTheDocument();

    // Collapse
    fireEvent.click(screen.getByText('Collapse'));
    expect(screen.queryByText('Collapse')).not.toBeInTheDocument();
  });
});
