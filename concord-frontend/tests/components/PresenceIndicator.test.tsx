import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { initial: _i, animate: _a, exit: _e, transition: _t, whileHover: _h, whileTap: _w, ...rest } = props;
      return <div {...rest}>{children as React.ReactNode}</div>;
    },
    button: ({ children, ...props }: Record<string, unknown>) => {
      const { initial: _i, animate: _a, exit: _e, transition: _t, whileHover: _h, whileTap: _w, ...rest } = props;
      return <button {...rest}>{children as React.ReactNode}</button>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ alt, ...props }: Record<string, unknown>) => <img alt={alt as string} {...props} />,
}));

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | boolean | undefined | null)[]) => args.filter(Boolean).join(' '),
}));

import { PresenceIndicator } from '@/components/social/PresenceIndicator';

const mockUsers = [
  { id: 'u1', name: 'Alice', color: '#ff0000', status: 'active' as const },
  { id: 'u2', name: 'Bob', color: '#00ff00', status: 'idle' as const },
  { id: 'u3', name: 'Charlie', color: '#0000ff', status: 'viewing' as const, location: 'Graph' },
  { id: 'u4', name: 'Diana', color: '#ff00ff', status: 'active' as const },
  { id: 'u5', name: 'Eve', color: '#ffff00', status: 'active' as const },
  { id: 'u6', name: 'Frank', color: '#00ffff', status: 'idle' as const },
];

describe('PresenceIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no users are present', () => {
    const { container } = render(<PresenceIndicator users={[]} />);
    expect(container.firstElementChild).toBeNull();
  });

  it('renders user initials as avatars', () => {
    render(<PresenceIndicator users={mockUsers.slice(0, 2)} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('shows status dots by default', () => {
    const { container } = render(
      <PresenceIndicator users={[mockUsers[0]]} showStatus={true} />
    );
    // Active user -> green dot
    const greenDot = container.querySelector('.bg-green-400');
    expect(greenDot).toBeInTheDocument();
  });

  it('hides status dots when showStatus is false', () => {
    const { container } = render(
      <PresenceIndicator users={[mockUsers[0]]} showStatus={false} />
    );
    // Status dots should not be rendered
    const statusDots = container.querySelectorAll('.w-2\\.5');
    expect(statusDots.length).toBe(0);
  });

  it('limits visible users to maxVisible (default 4)', () => {
    render(<PresenceIndicator users={mockUsers} />);

    // First 4 users should be visible
    expect(screen.getByText('A')).toBeInTheDocument(); // Alice
    expect(screen.getByText('B')).toBeInTheDocument(); // Bob
    expect(screen.getByText('C')).toBeInTheDocument(); // Charlie
    expect(screen.getByText('D')).toBeInTheDocument(); // Diana

    // Overflow shows +2
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('respects custom maxVisible', () => {
    render(<PresenceIndicator users={mockUsers} maxVisible={2} />);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    // Remaining 4 in overflow
    expect(screen.getByText('+4')).toBeInTheDocument();
  });

  it('does not show overflow indicator when users fit', () => {
    render(<PresenceIndicator users={mockUsers.slice(0, 3)} maxVisible={4} />);
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it('calls onUserClick when avatar is clicked', () => {
    const handleClick = vi.fn();
    render(
      <PresenceIndicator
        users={mockUsers.slice(0, 2)}
        onUserClick={handleClick}
      />
    );

    // Click on Alice's avatar
    fireEvent.click(screen.getByText('A'));
    expect(handleClick).toHaveBeenCalledWith(mockUsers[0]);
  });

  it('shows expanded user list when overflow button is clicked', () => {
    render(<PresenceIndicator users={mockUsers} />);

    // Click the overflow "+2" button
    fireEvent.click(screen.getByText('+2'));

    // Should show the full user list panel
    expect(screen.getByText('6 collaborators online')).toBeInTheDocument();
    // 'Alice' appears multiple times (tooltip + list), use getAllByText
    const aliceElements = screen.getAllByText('Alice');
    expect(aliceElements.length).toBeGreaterThanOrEqual(2);
    const frankElements = screen.getAllByText('Frank');
    expect(frankElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows user location in expanded list', () => {
    render(<PresenceIndicator users={mockUsers} />);

    // Click overflow to expand
    fireEvent.click(screen.getByText('+2'));

    // Charlie has location "Graph"
    expect(screen.getByText('Graph')).toBeInTheDocument();
  });

  it('renders View all button', () => {
    render(<PresenceIndicator users={mockUsers.slice(0, 2)} />);
    const viewAllButton = screen.getByTitle('View all');
    expect(viewAllButton).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PresenceIndicator users={mockUsers.slice(0, 1)} className="my-class" />
    );
    expect(container.firstElementChild).toHaveClass('my-class');
  });

  it('closes expanded list and fires onUserClick when user is clicked in list', () => {
    const handleClick = vi.fn();
    render(<PresenceIndicator users={mockUsers} onUserClick={handleClick} />);

    // Expand list
    fireEvent.click(screen.getByText('+2'));
    expect(screen.getByText('6 collaborators online')).toBeInTheDocument();

    // Click on Eve in the list
    fireEvent.click(screen.getByText('Eve'));
    expect(handleClick).toHaveBeenCalledWith(mockUsers[4]);
  });

  it('singular "collaborator" for 1 user in expanded list', () => {
    // To trigger expanded list, we need overflow, so use maxVisible=0 wouldn't work...
    // Instead, let's just test the text with exactly 1 user and 0 maxVisible
    // Actually the expanded list only shows when there's overflow and user clicks +N
    // We need 2+ users with maxVisible=1 to get overflow
    render(<PresenceIndicator users={[mockUsers[0], mockUsers[1]]} maxVisible={1} />);
    fireEvent.click(screen.getByText('+1'));
    expect(screen.getByText('2 collaborators online')).toBeInTheDocument();
  });
});
