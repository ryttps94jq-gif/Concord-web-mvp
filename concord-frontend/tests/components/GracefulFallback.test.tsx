import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GracefulFallback } from '@/components/common/GracefulFallback';

// Mock the useBrainHealth hook
const mockBrainHealth = vi.fn();

vi.mock('@/hooks/useBrainHealth', () => ({
  useBrainHealth: () => mockBrainHealth(),
}));

describe('GracefulFallback', () => {
  beforeEach(() => {
    mockBrainHealth.mockReturnValue({
      brainStatus: {
        conscious: { online: true },
        subconscious: { online: true },
        utility: { online: true },
      },
      isLoading: false,
    });
  });

  it('renders children when brain is online', () => {
    render(
      <GracefulFallback feature="AI Chat" brainRequired="conscious">
        <div data-testid="child">Chat Interface</div>
      </GracefulFallback>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('shows fallback when brain is offline', () => {
    mockBrainHealth.mockReturnValue({
      brainStatus: {
        conscious: { online: false },
        subconscious: { online: true },
        utility: { online: true },
      },
      isLoading: false,
    });

    render(
      <GracefulFallback feature="AI Chat" brainRequired="conscious">
        <div data-testid="child">Chat Interface</div>
      </GracefulFallback>
    );
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
    expect(screen.getByText(/AI Chat temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Your data is safe/i)).toBeInTheDocument();
  });

  it('always renders children when brainRequired is none', () => {
    mockBrainHealth.mockReturnValue({
      brainStatus: {
        conscious: { online: false },
        subconscious: { online: false },
        utility: { online: false },
      },
      isLoading: false,
    });

    render(
      <GracefulFallback feature="Patient Records" brainRequired="none">
        <div data-testid="non-ai">Patient Form</div>
      </GracefulFallback>
    );
    expect(screen.getByTestId('non-ai')).toBeInTheDocument();
  });

  it('renders children optimistically while loading', () => {
    mockBrainHealth.mockReturnValue({
      brainStatus: {
        conscious: null,
        subconscious: null,
        utility: null,
      },
      isLoading: true,
    });

    render(
      <GracefulFallback feature="Symptom Analysis" brainRequired="utility">
        <div data-testid="child">Analyzer</div>
      </GracefulFallback>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('shows fallback message when utility brain is null', () => {
    mockBrainHealth.mockReturnValue({
      brainStatus: {
        conscious: { online: true },
        subconscious: { online: true },
        utility: null,
      },
      isLoading: false,
    });

    render(
      <GracefulFallback feature="Lens AI" brainRequired="utility">
        <div>Content</div>
      </GracefulFallback>
    );
    expect(screen.getByText(/Lens AI temporarily unavailable/i)).toBeInTheDocument();
  });
});
