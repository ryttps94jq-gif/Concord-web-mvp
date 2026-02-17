import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = vi.fn();

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), pathname: '/' }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock lens-registry
vi.mock('@/lib/lens-registry', () => ({
  getCommandPaletteLenses: () => [
    {
      id: 'chat',
      name: 'Chat',
      path: '/lenses/chat',
      description: 'AI conversations',
      icon: ({ className }: { className?: string }) => <span className={className}>ChatIcon</span>,
      category: 'core',
    },
    {
      id: 'board',
      name: 'Board',
      path: '/lenses/board',
      description: 'Kanban boards',
      icon: ({ className }: { className?: string }) => <span className={className}>BoardIcon</span>,
      category: 'core',
    },
  ],
  getParentCoreLens: () => null,
  getCoreLensConfig: () => null,
  LENS_CATEGORIES: {
    core: { label: 'Core Workspaces' },
    tools: { label: 'Tools' },
  },
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

  it('does not render when isOpen is false', () => {
    render(<CommandPalette isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when isOpen is true', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('renders search input with correct placeholder', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search lenses, commands...');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('role', 'combobox');
  });

  it('focuses input when opened', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search lenses, commands...');
    expect(input).toHaveFocus();
  });

  it('renders command list with listbox role', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('renders default action commands', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Create New DTU')).toBeInTheDocument();
  });

  it('renders lens navigation commands', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText('Go to Chat')).toBeInTheDocument();
    expect(screen.getByText('Go to Board')).toBeInTheDocument();
  });

  it('filters commands based on search query', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search lenses, commands...');

    fireEvent.change(input, { target: { value: 'chat' } });

    expect(screen.getByText('Go to Chat')).toBeInTheDocument();
    // Board and Dashboard should be filtered out
    expect(screen.queryByText('Go to Board')).not.toBeInTheDocument();
    expect(screen.queryByText('Go to Dashboard')).not.toBeInTheDocument();
  });

  it('shows no results message for unmatched query', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search lenses, commands...');

    fireEvent.change(input, { target: { value: 'xyznonexistent' } });

    expect(screen.getByText(/No results found/)).toBeInTheDocument();
  });

  it('shows result count in the footer', () => {
    render(<CommandPalette {...defaultProps} />);
    // 2 action commands + 2 lens commands = 4 results
    expect(screen.getByText('4 results')).toBeInTheDocument();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search lenses, commands...');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    render(<CommandPalette {...defaultProps} />);
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();

    fireEvent.click(backdrop!);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates with ArrowDown and ArrowUp keys', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search lenses, commands...');

    // First item should be selected by default
    const firstOption = screen.getAllByRole('option')[0];
    expect(firstOption).toHaveAttribute('aria-selected', 'true');

    // ArrowDown to select second item
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');

    // ArrowUp to go back to first item
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const updatedOptions = screen.getAllByRole('option');
    expect(updatedOptions[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('executes selected command on Enter and closes', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search lenses, commands...');

    // Default selection is first item = "Go to Dashboard"
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockPush).toHaveBeenCalledWith('/');
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('executes command on click', () => {
    render(<CommandPalette {...defaultProps} />);

    // Click on "Go to Chat"
    const chatOption = screen.getByText('Go to Chat').closest('button')!;
    fireEvent.click(chatOption);

    expect(mockPush).toHaveBeenCalledWith('/lenses/chat');
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('resets query and selection index when closed and reopened', () => {
    const { rerender } = render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search lenses, commands...');

    fireEvent.change(input, { target: { value: 'chat' } });

    // Close
    rerender(<CommandPalette isOpen={false} onClose={defaultProps.onClose} />);
    // Reopen
    rerender(<CommandPalette {...defaultProps} />);

    const newInput = screen.getByPlaceholderText('Search lenses, commands...');
    expect(newInput).toHaveValue('');
  });

  it('renders ESC hint in the search bar', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText('ESC')).toBeInTheDocument();
  });

  it('renders footer navigation hints', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText(/Navigate/)).toBeInTheDocument();
    expect(screen.getByText(/Select/)).toBeInTheDocument();
    expect(screen.getByText(/Close/)).toBeInTheDocument();
  });
});
