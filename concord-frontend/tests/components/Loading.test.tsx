import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Loading, LoadingSkeleton, CardSkeleton } from '@/components/common/Loading';

describe('Loading', () => {
  it('renders spinner without text', () => {
    render(<Loading />);

    // Should have the spinning loader
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('animate-spin');
  });

  it('renders with text', () => {
    render(<Loading text="Loading data..." />);

    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('applies size styles correctly', () => {
    const { rerender } = render(<Loading size="sm" />);
    let svg = document.querySelector('svg');
    expect(svg).toHaveClass('w-4', 'h-4');

    rerender(<Loading size="md" />);
    svg = document.querySelector('svg');
    expect(svg).toHaveClass('w-8', 'h-8');

    rerender(<Loading size="lg" />);
    svg = document.querySelector('svg');
    expect(svg).toHaveClass('w-12', 'h-12');
  });

  it('renders fullscreen mode', () => {
    render(<Loading fullScreen />);

    const container = document.querySelector('.fixed');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('inset-0', 'z-50');
  });

  it('does not render fullscreen by default', () => {
    render(<Loading />);

    const container = document.querySelector('.fixed');
    expect(container).not.toBeInTheDocument();
  });
});

describe('LoadingSkeleton', () => {
  it('renders with default styles', () => {
    render(<LoadingSkeleton />);

    const skeleton = document.querySelector('.bg-lattice-elevated');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('rounded');
  });

  it('applies custom className', () => {
    render(<LoadingSkeleton className="h-4 w-full" />);

    const skeleton = document.querySelector('.bg-lattice-elevated');
    expect(skeleton).toHaveClass('h-4', 'w-full');
  });

  it('renders with animation by default', () => {
    render(<LoadingSkeleton />);

    const skeleton = document.querySelector('.bg-lattice-elevated');
    expect(skeleton).toHaveClass('animate-pulse');
  });

  it('can disable animation', () => {
    render(<LoadingSkeleton animated={false} />);

    const skeleton = document.querySelector('.bg-lattice-elevated');
    expect(skeleton).not.toHaveClass('animate-pulse');
  });
});

describe('CardSkeleton', () => {
  it('renders card structure', () => {
    render(<CardSkeleton />);

    const card = document.querySelector('.lens-card');
    expect(card).toBeInTheDocument();
  });

  it('has multiple skeleton elements', () => {
    render(<CardSkeleton />);

    const skeletons = document.querySelectorAll('.bg-lattice-elevated');
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it('includes skeleton pills', () => {
    render(<CardSkeleton />);

    const pills = document.querySelectorAll('.rounded-full');
    expect(pills.length).toBeGreaterThanOrEqual(2);
  });
});
