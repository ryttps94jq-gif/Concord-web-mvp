import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  EmptyState,
  EmptyDTUs,
  EmptySearch,
  EmptyGraph,
  EmptyChat,
  EmptyInbox,
  ErrorState,
  OfflineState,
  IllustratedEmptyState
} from '@/components/common/EmptyState';
import { Search } from 'lucide-react';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="No items found" />);

    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <EmptyState
        title="No items"
        description="Try adding some items"
      />
    );

    expect(screen.getByText('Try adding some items')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <EmptyState
        title="No results"
        icon={<Search data-testid="search-icon" />}
      />
    );

    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  it('renders primary action button', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{ label: 'Add Item', onClick }}
      />
    );

    const button = screen.getByRole('button', { name: /add item/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders secondary action button', () => {
    const primaryClick = vi.fn();
    const secondaryClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{ label: 'Add', onClick: primaryClick }}
        secondaryAction={{ label: 'Cancel', onClick: secondaryClick }}
      />
    );

    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('applies minimal variant styles', () => {
    render(
      <EmptyState
        title="Minimal"
        variant="minimal"
      />
    );

    const title = screen.getByText('Minimal');
    expect(title).toHaveClass('text-base');
  });

  it('applies custom className', () => {
    render(
      <EmptyState
        title="Custom"
        className="custom-class"
      />
    );

    const container = document.querySelector('.custom-class');
    expect(container).toBeInTheDocument();
  });
});

describe('EmptyDTUs', () => {
  it('renders DTU-specific empty state', () => {
    render(<EmptyDTUs />);

    expect(screen.getByText('No thoughts yet')).toBeInTheDocument();
  });

  it('shows forge button when onForge provided', () => {
    const onForge = vi.fn();
    render(<EmptyDTUs onForge={onForge} />);

    const button = screen.getByRole('button', { name: /forge your first dtu/i });
    fireEvent.click(button);
    expect(onForge).toHaveBeenCalled();
  });

  it('hides button when onForge not provided', () => {
    render(<EmptyDTUs />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('EmptySearch', () => {
  it('shows search query in message', () => {
    render(<EmptySearch query="test query" />);

    expect(screen.getByText(/test query/)).toBeInTheDocument();
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });
});

describe('EmptyGraph', () => {
  it('renders graph-specific empty state', () => {
    render(<EmptyGraph />);

    expect(screen.getByText('Your knowledge graph is empty')).toBeInTheDocument();
  });

  it('shows action button when onForge provided', () => {
    const onForge = vi.fn();
    render(<EmptyGraph onForge={onForge} />);

    expect(screen.getByRole('button', { name: /create first node/i })).toBeInTheDocument();
  });
});

describe('EmptyChat', () => {
  it('renders chat-specific empty state', () => {
    render(<EmptyChat />);

    expect(screen.getByText('Start a conversation')).toBeInTheDocument();
  });

  it('shows action button when onStart provided', () => {
    const onStart = vi.fn();
    render(<EmptyChat onStart={onStart} />);

    const button = screen.getByRole('button', { name: /begin chat/i });
    fireEvent.click(button);
    expect(onStart).toHaveBeenCalled();
  });
});

describe('EmptyInbox', () => {
  it('renders inbox zero message', () => {
    render(<EmptyInbox />);

    expect(screen.getByText('Inbox zero!')).toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders error message', () => {
    render(<ErrorState error="Something went wrong" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders default error message when no error provided', () => {
    render(<ErrorState />);

    expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
  });

  it('shows retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    const button = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('OfflineState', () => {
  it('renders offline message', () => {
    render(<OfflineState />);

    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });

  it('shows retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<OfflineState onRetry={onRetry} />);

    const button = screen.getByRole('button', { name: /retry connection/i });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('IllustratedEmptyState', () => {
  it('renders knowledge type', () => {
    render(<IllustratedEmptyState type="knowledge" />);

    expect(screen.getByText('Build your knowledge base')).toBeInTheDocument();
  });

  it('renders connection type', () => {
    render(<IllustratedEmptyState type="connection" />);

    expect(screen.getByText('Discover connections')).toBeInTheDocument();
  });

  it('renders idea type', () => {
    render(<IllustratedEmptyState type="idea" />);

    expect(screen.getByText('Let ideas flourish')).toBeInTheDocument();
  });

  it('shows action button when onAction provided', () => {
    const onAction = vi.fn();
    render(<IllustratedEmptyState type="knowledge" onAction={onAction} />);

    const button = screen.getByRole('button', { name: /get started/i });
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalled();
  });
});
