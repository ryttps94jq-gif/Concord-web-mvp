import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonCard,
  SkeletonDTU,
  SkeletonList,
  SkeletonTable,
  SkeletonStats
} from '@/components/common/Skeleton';

describe('Skeleton', () => {
  it('renders with default text variant', () => {
    render(<Skeleton />);

    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('h-4', 'rounded');
  });

  it('applies circular variant', () => {
    render(<Skeleton variant="circular" width={40} height={40} />);

    const skeleton = document.querySelector('.rounded-full');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveStyle({ width: '40px', height: '40px' });
  });

  it('applies rectangular variant', () => {
    render(<Skeleton variant="rectangular" />);

    const skeleton = document.querySelector('.rounded-none');
    expect(skeleton).toBeInTheDocument();
  });

  it('applies rounded variant', () => {
    render(<Skeleton variant="rounded" />);

    const skeleton = document.querySelector('.rounded-lg');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders multiple lines', () => {
    render(<Skeleton lines={3} />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
  });

  it('last line is shorter in multi-line mode', () => {
    render(<Skeleton lines={3} />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    const lastSkeleton = skeletons[skeletons.length - 1];
    expect(lastSkeleton).toHaveStyle({ width: '60%' });
  });

  it('applies custom width and height', () => {
    render(<Skeleton width={200} height={50} />);

    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toHaveStyle({ width: '200px', height: '50px' });
  });

  it('applies custom className', () => {
    render(<Skeleton className="custom-class" />);

    const skeleton = document.querySelector('.custom-class');
    expect(skeleton).toBeInTheDocument();
  });
});

describe('SkeletonCard', () => {
  it('renders card structure', () => {
    render(<SkeletonCard />);

    const card = document.querySelector('.rounded-lg');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('bg-lattice-surface', 'border-lattice-border');
  });

  it('contains avatar skeleton', () => {
    render(<SkeletonCard />);

    const avatar = document.querySelector('.rounded-full');
    expect(avatar).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<SkeletonCard className="w-full" />);

    const card = document.querySelector('.w-full');
    expect(card).toBeInTheDocument();
  });
});

describe('SkeletonDTU', () => {
  it('renders DTU card structure', () => {
    render(<SkeletonDTU />);

    const card = document.querySelector('.rounded-lg');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('bg-lattice-surface');
  });

  it('has circular element for tier indicator', () => {
    render(<SkeletonDTU />);

    const circular = document.querySelector('.rounded-full');
    expect(circular).toBeInTheDocument();
  });
});

describe('SkeletonList', () => {
  it('renders default 5 items', () => {
    render(<SkeletonList />);

    const items = document.querySelectorAll('.flex.items-center.gap-3');
    expect(items.length).toBe(5);
  });

  it('renders custom number of items', () => {
    render(<SkeletonList count={3} />);

    const items = document.querySelectorAll('.flex.items-center.gap-3');
    expect(items.length).toBe(3);
  });

  it('applies custom className', () => {
    render(<SkeletonList className="mt-4" />);

    const container = document.querySelector('.mt-4');
    expect(container).toBeInTheDocument();
  });
});

describe('SkeletonTable', () => {
  it('renders header row', () => {
    render(<SkeletonTable />);

    const header = document.querySelector('.border-b');
    expect(header).toBeInTheDocument();
  });

  it('renders default 5 rows', () => {
    render(<SkeletonTable />);

    // +1 for header row
    const rows = document.querySelectorAll('.flex.gap-4');
    expect(rows.length).toBe(6); // 1 header + 5 data rows
  });

  it('renders custom rows and columns', () => {
    render(<SkeletonTable rows={3} cols={2} />);

    // Check that each row has the correct number of columns
    const allSkeletons = document.querySelectorAll('.flex-1.h-4');
    // 2 cols * (1 header + 3 rows) = 8
    expect(allSkeletons.length).toBe(8);
  });
});

describe('SkeletonStats', () => {
  it('renders default 4 stat cards', () => {
    render(<SkeletonStats />);

    const cards = document.querySelectorAll('.rounded-lg.bg-lattice-surface');
    expect(cards.length).toBe(4);
  });

  it('renders custom number of cards', () => {
    render(<SkeletonStats count={2} />);

    const cards = document.querySelectorAll('.rounded-lg.bg-lattice-surface');
    expect(cards.length).toBe(2);
  });

  it('has responsive grid layout', () => {
    render(<SkeletonStats />);

    const grid = document.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-2', 'md:grid-cols-4');
  });
});
