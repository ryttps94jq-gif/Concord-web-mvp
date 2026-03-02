import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatRouteOverlay from '@/components/chat/ChatRouteOverlay';

const makeRoute = (overrides = {}) => ({
  actionType: 'QUERY',
  lenses: [{ lensId: 'healthcare', score: 0.9 }],
  primaryLens: 'healthcare',
  isMultiLens: false,
  confidence: 0.8,
  attribution: ['healthcare'],
  message: null,
  ...overrides,
});

describe('ChatRouteOverlay', () => {
  it('renders without crashing with valid route', () => {
    render(<ChatRouteOverlay route={makeRoute()} />);
    expect(screen.getByText('Query')).toBeInTheDocument();
  });

  it('returns null when route is null', () => {
    const { container } = render(
      <ChatRouteOverlay route={null as unknown as ReturnType<typeof makeRoute>} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null when route has no actionType', () => {
    const { container } = render(
      <ChatRouteOverlay route={makeRoute({ actionType: '' })} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null for low-confidence single-lens QUERY', () => {
    const { container } = render(
      <ChatRouteOverlay
        route={makeRoute({ confidence: 0.2, isMultiLens: false, actionType: 'QUERY' })}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders for low-confidence multi-lens QUERY', () => {
    render(
      <ChatRouteOverlay
        route={makeRoute({ confidence: 0.2, isMultiLens: true, actionType: 'QUERY' })}
      />
    );
    expect(screen.getByText('Query')).toBeInTheDocument();
  });

  it('renders correct action type badge for CREATE', () => {
    render(<ChatRouteOverlay route={makeRoute({ actionType: 'CREATE' })} />);
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('renders correct action type badge for ANALYZE', () => {
    render(<ChatRouteOverlay route={makeRoute({ actionType: 'ANALYZE' })} />);
    expect(screen.getByText('Analyze')).toBeInTheDocument();
  });

  it('renders correct action type badge for SIMULATE', () => {
    render(<ChatRouteOverlay route={makeRoute({ actionType: 'SIMULATE' })} />);
    expect(screen.getByText('Simulate')).toBeInTheDocument();
  });

  it('renders correct action type badge for TRADE', () => {
    render(<ChatRouteOverlay route={makeRoute({ actionType: 'TRADE' })} />);
    expect(screen.getByText('Trade')).toBeInTheDocument();
  });

  it('falls back to QUERY config for unknown action type', () => {
    render(<ChatRouteOverlay route={makeRoute({ actionType: 'UNKNOWN' })} />);
    expect(screen.getByText('Query')).toBeInTheDocument();
  });

  it('shows "Drawing from:" for multi-lens routes', () => {
    render(
      <ChatRouteOverlay
        route={makeRoute({
          isMultiLens: true,
          attribution: ['healthcare', 'finance', 'legal'],
        })}
      />
    );
    expect(screen.getByText(/Drawing from:/)).toBeInTheDocument();
    expect(screen.getByText('healthcare')).toBeInTheDocument();
    expect(screen.getByText('finance')).toBeInTheDocument();
    expect(screen.getByText('legal')).toBeInTheDocument();
  });

  it('shows lens attribution without "Drawing from:" for single-lens', () => {
    render(
      <ChatRouteOverlay
        route={makeRoute({
          isMultiLens: false,
          attribution: ['healthcare'],
        })}
      />
    );
    expect(screen.queryByText(/Drawing from:/)).not.toBeInTheDocument();
    expect(screen.getByText('healthcare')).toBeInTheDocument();
  });

  it('does not show attribution when attribution array is empty', () => {
    render(
      <ChatRouteOverlay route={makeRoute({ attribution: [] })} />
    );
    expect(screen.queryByText(/Drawing from:/)).not.toBeInTheDocument();
  });

  it('shows confidence percentage when >= 0.5', () => {
    render(<ChatRouteOverlay route={makeRoute({ confidence: 0.85 })} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('does not show confidence percentage when < 0.5', () => {
    render(
      <ChatRouteOverlay
        route={makeRoute({ confidence: 0.4, actionType: 'CREATE' })}
      />
    );
    expect(screen.queryByText('40%')).not.toBeInTheDocument();
  });

  it('renders confirmation buttons when requiresConfirmation is true', () => {
    render(
      <ChatRouteOverlay
        route={makeRoute({ actionType: 'CREATE' })}
        requiresConfirmation
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Proceed')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('fires onConfirm when Proceed is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ChatRouteOverlay
        route={makeRoute({ actionType: 'CREATE' })}
        requiresConfirmation
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Proceed'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('fires onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ChatRouteOverlay
        route={makeRoute({ actionType: 'CREATE' })}
        requiresConfirmation
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not render confirmation buttons when requiresConfirmation is false', () => {
    render(
      <ChatRouteOverlay route={makeRoute()} requiresConfirmation={false} />
    );
    expect(screen.queryByText('Proceed')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('truncates attribution to first 5 lenses', () => {
    const longAttribution = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    render(
      <ChatRouteOverlay
        route={makeRoute({ isMultiLens: true, attribution: longAttribution })}
      />
    );
    // Should show first 5, not 'f' or 'g'
    expect(screen.getByText('e')).toBeInTheDocument();
    expect(screen.queryByText('f')).not.toBeInTheDocument();
  });
});
