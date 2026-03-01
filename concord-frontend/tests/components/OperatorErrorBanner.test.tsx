import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next/navigation
const mockPathname = vi.fn().mockReturnValue('/dashboard');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// Mock lucide-react — explicit named exports (Proxy crashes vitest)
vi.mock('lucide-react', async () => {
  const React = await import('react');
  const makeMockIcon = (name: string) => {
    const Icon = React.forwardRef<SVGSVGElement, Record<string, unknown>>((props, ref) =>
      React.createElement('span', { 'data-testid': `icon-${name}`, ref, ...props })
    );
    Icon.displayName = name;
    return Icon;
  };
  return {
    __esModule: true,
    AlertTriangle: makeMockIcon('AlertTriangle'),
    Copy: makeMockIcon('Copy'),
    Shield: makeMockIcon('Shield'),
    X: makeMockIcon('X'),
    Info: makeMockIcon('Info'),
    AlertCircle: makeMockIcon('AlertCircle'),
    ChevronDown: makeMockIcon('ChevronDown'),
    ChevronUp: makeMockIcon('ChevronUp'),
  };
});

// Mock UI store
const mockClearRequestErrors = vi.fn();
const mockUIStoreState = {
  requestErrors: [] as unknown[],
  clearRequestErrors: mockClearRequestErrors,
  authPosture: { mode: 'jwt', usesJwt: true, usesApiKey: false },
};

vi.mock('@/store/ui', () => ({
  useUIStore: (selector: (s: Record<string, unknown>) => unknown) => selector(mockUIStoreState as unknown as Record<string, unknown>),
}));

import { OperatorErrorBanner } from '@/components/common/OperatorErrorBanner';

describe('OperatorErrorBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/dashboard');
    mockUIStoreState.requestErrors = [];
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders null when there are no errors', () => {
    const { container } = render(<OperatorErrorBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('renders null on suppressed paths', () => {
    mockUIStoreState.requestErrors = [
      { id: 'err-1', at: new Date().toISOString(), message: 'Test error', reason: 'Something broke' },
    ];
    mockPathname.mockReturnValue('/login');

    const { container } = render(<OperatorErrorBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('renders null on root path', () => {
    mockUIStoreState.requestErrors = [
      { id: 'err-1', at: new Date().toISOString(), message: 'Test error' },
    ];
    mockPathname.mockReturnValue('/');

    const { container } = render(<OperatorErrorBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('renders error banner with the latest error', () => {
    mockUIStoreState.requestErrors = [
      { id: 'err-1', at: new Date().toISOString(), message: 'First error', reason: 'First reason' },
      { id: 'err-2', at: new Date().toISOString(), message: 'Second error', reason: 'Permission denied in module X' },
    ];

    render(<OperatorErrorBanner />);
    // Component starts dismissed — click the indicator to expand
    const showBtn = screen.getByLabelText('Show debug panel');
    fireEvent.click(showBtn);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Permission denied in module X')).toBeInTheDocument();
  });

  it('shows message when reason is not available', () => {
    mockUIStoreState.requestErrors = [
      { id: 'err-1', at: new Date().toISOString(), message: 'Something went wrong' },
    ];

    render(<OperatorErrorBanner />);
    // Expand the banner first
    fireEvent.click(screen.getByLabelText('Show debug panel'));
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays auth mode badge', () => {
    mockUIStoreState.requestErrors = [
      { id: 'err-1', at: new Date().toISOString(), message: 'Error' },
    ];

    render(<OperatorErrorBanner />);
    fireEvent.click(screen.getByLabelText('Show debug panel'));
    expect(screen.getByText('jwt')).toBeInTheDocument();
  });

  it('copies debug bundle to clipboard on Debug button click', async () => {
    mockUIStoreState.requestErrors = [
      { id: 'err-1', at: new Date().toISOString(), message: 'Error' },
    ];

    render(<OperatorErrorBanner />);
    fireEvent.click(screen.getByLabelText('Show debug panel'));
    const debugBtn = screen.getByLabelText('Copy debug bundle to clipboard');
    fireEvent.click(debugBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('clears errors and dismisses on dismiss button click', () => {
    mockUIStoreState.requestErrors = [
      { id: 'err-1', at: new Date().toISOString(), message: 'Error' },
    ];

    render(<OperatorErrorBanner />);
    fireEvent.click(screen.getByLabelText('Show debug panel'));
    const dismissBtn = screen.getByLabelText('Dismiss error banner');
    fireEvent.click(dismissBtn);

    expect(mockClearRequestErrors).toHaveBeenCalled();
  });
});
