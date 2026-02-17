import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Loading, LoadingSkeleton, CardSkeleton } from '@/components/common/Loading';

/**
 * The project's Loading component (Loading.tsx) exports three items:
 * - Loading — a spinner with size/text/fullScreen variants
 * - LoadingSkeleton — a pulsing placeholder bar
 * - CardSkeleton — a card-shaped skeleton
 *
 * The existing Loading.test.tsx already covers the basic cases.
 * This file adds coverage for edge cases and combinations.
 */

describe('Loading — additional coverage', () => {
  it('renders default medium size when no size prop is given', () => {
    render(<Loading />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveClass('w-8', 'h-8');
  });

  it('renders text below the spinner when text is provided', () => {
    render(<Loading text="Please wait..." />);
    const textEl = screen.getByText('Please wait...');
    expect(textEl).toBeInTheDocument();
    expect(textEl.tagName).toBe('P');
    expect(textEl).toHaveClass('text-sm', 'text-gray-400');
  });

  it('does not render a text element when text is not provided', () => {
    const { container } = render(<Loading />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBe(0);
  });

  it('fullScreen renders with fixed positioning and overlay', () => {
    render(<Loading fullScreen text="Loading..." />);
    const overlay = document.querySelector('.fixed');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass('inset-0', 'z-50');
    // Text should still be visible in fullscreen
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('small spinner has correct dimensions', () => {
    render(<Loading size="sm" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveClass('w-4', 'h-4');
  });

  it('large spinner has correct dimensions', () => {
    render(<Loading size="lg" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveClass('w-12', 'h-12');
  });

  it('spinner always has animate-spin and neon-cyan color', () => {
    render(<Loading />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveClass('animate-spin');
    expect(svg).toHaveClass('text-neon-cyan');
  });
});

describe('LoadingSkeleton — additional coverage', () => {
  it('renders a div element', () => {
    const { container } = render(<LoadingSkeleton />);
    const skeleton = container.firstElementChild;
    expect(skeleton?.tagName).toBe('DIV');
  });

  it('has bg-lattice-elevated class', () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.firstElementChild).toHaveClass('bg-lattice-elevated');
  });

  it('has rounded class', () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.firstElementChild).toHaveClass('rounded');
  });

  it('applies animate-pulse by default', () => {
    const { container } = render(<LoadingSkeleton />);
    expect(container.firstElementChild).toHaveClass('animate-pulse');
  });

  it('omits animate-pulse when animated is false', () => {
    const { container } = render(<LoadingSkeleton animated={false} />);
    expect(container.firstElementChild).not.toHaveClass('animate-pulse');
  });

  it('merges custom className with base styles', () => {
    const { container } = render(
      <LoadingSkeleton className="h-8 w-32 my-custom-class" />
    );
    const el = container.firstElementChild;
    expect(el).toHaveClass('bg-lattice-elevated', 'rounded', 'h-8', 'w-32', 'my-custom-class');
  });
});

describe('CardSkeleton — additional coverage', () => {
  it('renders lens-card wrapper', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector('.lens-card')).toBeInTheDocument();
  });

  it('renders at least 4 skeleton bars', () => {
    const { container } = render(<CardSkeleton />);
    const skeletons = container.querySelectorAll('.bg-lattice-elevated');
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it('includes rounded-full pill elements', () => {
    const { container } = render(<CardSkeleton />);
    const pills = container.querySelectorAll('.rounded-full');
    expect(pills.length).toBeGreaterThanOrEqual(2);
  });

  it('has space-y-3 for vertical spacing', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector('.space-y-3')).toBeInTheDocument();
  });
});
