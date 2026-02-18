import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock scrollIntoView which jsdom doesn't implement
Element.prototype.scrollIntoView = vi.fn();

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock lens-registry — icon must be defined inside the factory since vi.mock is hoisted
vi.mock('@/lib/lens-registry', () => {
  const _Icon = (props: { className?: string }) => Object.assign(document.createElement('span'), { className: props?.className || '' });
  return {
    getCommandPaletteLenses: () => [
      {
        id: 'resonance',
        name: 'Resonance',
        description: 'View system resonance',
        path: '/lenses/resonance',
        icon: ({ className }: { className?: string }) => <span data-testid="mock-icon" className={className}>I</span>,
        category: 'core',
      },
      {
        id: 'marketplace',
        name: 'Marketplace',
        description: 'Browse the marketplace',
        path: '/lenses/marketplace',
        icon: ({ className }: { className?: string }) => <span data-testid="mock-icon" className={className}>I</span>,
        category: 'governance',
      },
    ],
    getParentCoreLens: (id: string) => {
      if (id === 'marketplace') return 'board';
      return null;
    },
    getCoreLensConfig: (id: string) => {
      if (id === 'board') return { name: 'Board' };
      return null;
    },
    LENS_CATEGORIES: {
      core: { label: 'Core' },
      governance: { label: 'Governance' },
    },
  };
});

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Search: ({ className }: { className?: string }) => <span data-testid="search-icon" className={className} />,
  ArrowRight: ({ className }: { className?: string }) => <span data-testid="arrow-icon" className={className} />,
}));

import { CommandPalette } from '@/components/shell/CommandPalette';

describe('CommandPalette', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when not open', () => {
    const { container } = render(<CommandPalette isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders dialog when open', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders search input with placeholder', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search lenses, commands...')).toBeInTheDocument();
  });

  it('shows default commands including Go to Dashboard', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  it('shows action commands', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText('Create New DTU')).toBeInTheDocument();
  });

  it('shows lens navigation commands', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText('Go to Resonance')).toBeInTheDocument();
  });

  it('shows parent context for absorbed lenses', () => {
    render(<CommandPalette {...defaultProps} />);
    // Marketplace is absorbed into Board, so it shows "Board > Marketplace"
    expect(screen.getByText('Go to Board > Marketplace')).toBeInTheDocument();
  });

  it('filters commands based on search query', () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search lenses, commands...');
    fireEvent.change(input, { target: { value: 'dashboard' } });

    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Create New DTU')).not.toBeInTheDocument();
  });

  it('shows "No results" when query matches nothing', () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search lenses, commands...');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });

    expect(screen.getByText(/No results found/)).toBeInTheDocument();
  });

  it('shows result count in footer', () => {
    render(<CommandPalette {...defaultProps} />);
    // 2 action commands + 2 lens commands = 4
    expect(screen.getByText('4 results')).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen={true} onClose={onClose} />);

    const backdrop = document.querySelector('[aria-hidden="true"]')!;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText('Search lenses, commands...');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates on Enter and calls onClose', () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen={true} onClose={onClose} />);

    const input = screen.getByPlaceholderText('Search lenses, commands...');
    fireEvent.keyDown(input, { key: 'Enter' });

    // First item is "Go to Dashboard"
    expect(mockPush).toHaveBeenCalledWith('/');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates with ArrowDown and ArrowUp', () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search lenses, commands...');

    // Arrow down selects second item
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Arrow down again selects third
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Arrow up goes back to second
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    // Now press Enter - should trigger the second command (Create New DTU)
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalledWith('/lenses/chat?new=true');
  });

  it('does not go below last item with ArrowDown', () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search lenses, commands...');

    // Press ArrowDown many times
    for (let i = 0; i < 20; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    }

    // Should still be able to press Enter on the last item
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockPush).toHaveBeenCalled();
  });

  it('does not go above first item with ArrowUp', () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search lenses, commands...');

    // Press ArrowUp (should stay at 0)
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    fireEvent.keyDown(input, { key: 'Enter' });
    // First item is Dashboard
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('navigates when command button is clicked', () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen={true} onClose={onClose} />);

    const dashButton = screen.getByText('Go to Dashboard').closest('button')!;
    fireEvent.click(dashButton);

    expect(mockPush).toHaveBeenCalledWith('/');
    expect(onClose).toHaveBeenCalled();
  });

  it('resets query when searching changes', () => {
    render(<CommandPalette {...defaultProps} />);

    const input = screen.getByPlaceholderText('Search lenses, commands...');
    fireEvent.change(input, { target: { value: 'res' } });

    // selectedIndex resets to 0 on query change
    fireEvent.keyDown(input, { key: 'Enter' });
    // "Go to Resonance" should be the first filtered result
    expect(mockPush).toHaveBeenCalledWith('/lenses/resonance');
  });
});
