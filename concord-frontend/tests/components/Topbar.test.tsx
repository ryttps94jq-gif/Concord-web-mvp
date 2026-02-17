import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), pathname: '/' }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'resonance-quick') {
      return { data: { coherence: 0.85, dtuCount: 42 } };
    }
    if (queryKey[0] === 'notifications-count') {
      return { data: { count: 3 } };
    }
    return { data: null };
  },
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock UI store
const mockUIStore = {
  sidebarCollapsed: false,
  setCommandPaletteOpen: vi.fn(),
  activeLens: null as string | null,
  setSidebarOpen: vi.fn(),
};

vi.mock('@/store/ui', () => ({
  useUIStore: () => mockUIStore,
}));

// Mock API client
vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

// Mock socket
vi.mock('@/lib/realtime/socket', () => ({
  disconnectSocket: vi.fn(),
}));

// Mock lens registry
vi.mock('@/lib/lens-registry', () => ({
  getLensById: (id: string) => {
    if (id === 'chat') return { name: 'Chat', icon: ({ className }: { className?: string }) => <span className={className}>ChatIcon</span> };
    return null;
  },
}));

// Mock OfflineIndicator components
vi.mock('@/components/common/OfflineIndicator', () => ({
  SyncStatusDot: ({ status }: { status: string }) => <span data-testid="sync-dot">{status}</span>,
  useOnlineStatus: () => ({ isOnline: true, wasOffline: false }),
}));

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | boolean | undefined | null)[]) => args.filter(Boolean).join(' '),
}));

import { Topbar } from '@/components/shell/Topbar';

describe('Topbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUIStore.sidebarCollapsed = false;
    mockUIStore.activeLens = null;
  });

  it('renders with banner role', () => {
    render(<Topbar />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('displays Dashboard as default title when no active lens', () => {
    render(<Topbar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('displays active lens name when activeLens is set', () => {
    mockUIStore.activeLens = 'chat';
    render(<Topbar />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('renders command palette trigger with correct aria-label', () => {
    render(<Topbar />);
    const searchButton = screen.getByLabelText('Open command palette');
    expect(searchButton).toBeInTheDocument();
  });

  it('calls setCommandPaletteOpen when search button is clicked', () => {
    render(<Topbar />);
    const searchButton = screen.getByLabelText('Open command palette');
    fireEvent.click(searchButton);
    expect(mockUIStore.setCommandPaletteOpen).toHaveBeenCalledWith(true);
  });

  it('renders mobile navigation menu button', () => {
    render(<Topbar />);
    const menuButton = screen.getByLabelText('Open navigation menu');
    expect(menuButton).toBeInTheDocument();
  });

  it('calls setSidebarOpen when mobile menu is clicked', () => {
    render(<Topbar />);
    const menuButton = screen.getByLabelText('Open navigation menu');
    fireEvent.click(menuButton);
    expect(mockUIStore.setSidebarOpen).toHaveBeenCalledWith(true);
  });

  it('renders notification bell button', () => {
    render(<Topbar />);
    // The notifications button includes the count in aria-label
    const bellButton = screen.getByLabelText(/Notifications/);
    expect(bellButton).toBeInTheDocument();
  });

  it('shows notification count badge when count > 0', () => {
    render(<Topbar />);
    // Mocked to 3 notifications
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders user menu button', () => {
    render(<Topbar />);
    const userButton = screen.getByLabelText('User menu');
    expect(userButton).toBeInTheDocument();
    expect(userButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens user menu on click and shows menu items', () => {
    render(<Topbar />);
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);

    expect(userButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('navigates to system health when clicking menu item', () => {
    render(<Topbar />);
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);

    fireEvent.click(screen.getByText('System Health'));
    expect(mockPush).toHaveBeenCalledWith('/lenses/resonance');
  });

  it('closes user menu on Escape key', () => {
    render(<Topbar />);
    const userButton = screen.getByLabelText('User menu');
    fireEvent.click(userButton);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('renders sync status indicator', () => {
    render(<Topbar />);
    expect(screen.getByTestId('sync-dot')).toBeInTheDocument();
  });

  it('displays resonance percentage', () => {
    render(<Topbar />);
    // 0.85 * 100 = 85%
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('displays DTU count', () => {
    render(<Topbar />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
