import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock framer-motion to avoid animation complexity in tests
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

import { CommentThread } from '@/components/collaboration/CommentThread';

const mockUsers = {
  'user-1': { id: 'user-1', name: 'Alice', color: '#ff0000' },
  'user-2': { id: 'user-2', name: 'Bob', color: '#00ff00' },
};

const mockComments = [
  {
    id: 'comment-1',
    userId: 'user-1',
    content: 'This is the first comment',
    createdAt: new Date().toISOString(),
    resolved: false,
    reactions: {} as Record<string, string[]>,
    replies: [],
  },
  {
    id: 'comment-2',
    userId: 'user-2',
    content: 'A resolved comment',
    createdAt: new Date().toISOString(),
    resolved: true,
    reactions: { '👍': ['user-1'] } as Record<string, string[]>,
    replies: [],
  },
];

describe('CommentThread', () => {
  const defaultProps = {
    comments: mockComments,
    users: mockUsers,
    currentUserId: 'user-1',
    onAddComment: vi.fn(),
    onResolve: vi.fn(),
    onReact: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Comments header with count', () => {
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('displays each comment content', () => {
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText('This is the first comment')).toBeInTheDocument();
    expect(screen.getByText('A resolved comment')).toBeInTheDocument();
  });

  it('displays user names for each comment', () => {
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows Resolved badge on resolved comments', () => {
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('shows empty state when no comments', () => {
    render(<CommentThread {...defaultProps} comments={[]} />);
    expect(screen.getByText('No comments yet')).toBeInTheDocument();
    expect(screen.getByText('Start the conversation!')).toBeInTheDocument();
  });

  it('renders reactions with counts', () => {
    render(<CommentThread {...defaultProps} />);
    // The second comment has a thumbs up reaction with 1 user
    const reactionButton = screen.getByText((content) => content.includes('\uD83D\uDC4D') && content.includes('1'));
    expect(reactionButton).toBeInTheDocument();
  });

  it('calls onReact when a reaction is clicked', () => {
    render(<CommentThread {...defaultProps} />);
    // Click existing reaction on comment-2
    const reactionButton = screen.getByText((content) => content.includes('\uD83D\uDC4D') && content.includes('1'));
    fireEvent.click(reactionButton);
    expect(defaultProps.onReact).toHaveBeenCalledWith('comment-2', '👍');
  });

  it('renders new comment input at bottom', () => {
    render(<CommentThread {...defaultProps} />);
    const input = screen.getByPlaceholderText('Add a comment...');
    expect(input).toBeInTheDocument();
  });

  it('calls onAddComment when submitting a new comment', () => {
    render(<CommentThread {...defaultProps} />);
    const input = screen.getByPlaceholderText('Add a comment...');

    fireEvent.change(input, { target: { value: 'My new comment' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(defaultProps.onAddComment).toHaveBeenCalledWith('My new comment', undefined);
  });

  it('does not submit empty comment', () => {
    render(<CommentThread {...defaultProps} />);
    const input = screen.getByPlaceholderText('Add a comment...');

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(defaultProps.onAddComment).not.toHaveBeenCalled();
  });

  it('does not submit whitespace-only comment', () => {
    render(<CommentThread {...defaultProps} />);
    const input = screen.getByPlaceholderText('Add a comment...');

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(defaultProps.onAddComment).not.toHaveBeenCalled();
  });

  it('renders current user initial in the new comment avatar', () => {
    render(<CommentThread {...defaultProps} />);
    // Alice's initial A should appear for the current user avatar at the bottom
    const avatars = screen.getAllByText('A');
    expect(avatars.length).toBeGreaterThanOrEqual(1);
  });

  it('shows reply toggle for comments with replies', () => {
    const commentsWithReplies = [
      {
        id: 'parent-1',
        userId: 'user-1',
        content: 'Parent comment',
        createdAt: new Date().toISOString(),
        resolved: false,
        reactions: {},
        replies: [
          {
            id: 'reply-1',
            userId: 'user-2',
            content: 'A reply',
            createdAt: new Date().toISOString(),
            resolved: false,
            reactions: {},
          },
        ],
      },
    ];

    render(<CommentThread {...defaultProps} comments={commentsWithReplies} />);
    expect(screen.getByText('1 reply')).toBeInTheDocument();
  });

  it('expands replies when toggle is clicked', () => {
    const commentsWithReplies = [
      {
        id: 'parent-1',
        userId: 'user-1',
        content: 'Parent comment',
        createdAt: new Date().toISOString(),
        resolved: false,
        reactions: {},
        replies: [
          {
            id: 'reply-1',
            userId: 'user-2',
            content: 'A reply',
            createdAt: new Date().toISOString(),
            resolved: false,
            reactions: {},
          },
        ],
      },
    ];

    render(<CommentThread {...defaultProps} comments={commentsWithReplies} />);

    const toggle = screen.getByText('1 reply');
    fireEvent.click(toggle);

    expect(screen.getByText('A reply')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CommentThread {...defaultProps} className="my-custom-class" />
    );
    expect(container.firstElementChild).toHaveClass('my-custom-class');
  });
});
