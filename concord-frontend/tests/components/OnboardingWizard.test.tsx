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
  AnimatePresence: ({ children, mode: _mode }: { children: React.ReactNode; mode?: string }) => <>{children}</>,
}));

// Mock cn utility
vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | boolean | undefined | null)[]) => args.filter(Boolean).join(' '),
}));

import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

describe('OnboardingWizard', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    onAction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<OnboardingWizard {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when isOpen is true', () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('shows first step "Welcome to Concord" initially', () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText('Welcome to Concord')).toBeInTheDocument();
    expect(screen.getByText(/Five workspaces/)).toBeInTheDocument();
  });

  it('shows step counter as 1 / 7', () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText('1 / 7')).toBeInTheDocument();
  });

  it('has Back button disabled on first step', () => {
    render(<OnboardingWizard {...defaultProps} />);
    const backButton = screen.getByLabelText('Previous step');
    expect(backButton).toBeDisabled();
  });

  it('shows Next button on non-last steps', () => {
    render(<OnboardingWizard {...defaultProps} />);
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('advances to second step when Next is clicked', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Next step'));

    expect(screen.getByText(/Chat/)).toBeInTheDocument();
    expect(screen.getByText('2 / 7')).toBeInTheDocument();
  });

  it('goes back to previous step when Back is clicked', () => {
    render(<OnboardingWizard {...defaultProps} />);

    // Go to step 2
    fireEvent.click(screen.getByLabelText('Next step'));
    expect(screen.getByText('2 / 7')).toBeInTheDocument();

    // Go back to step 1
    fireEvent.click(screen.getByLabelText('Previous step'));
    expect(screen.getByText('1 / 7')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Concord')).toBeInTheDocument();
  });

  it('navigates through all 7 steps', () => {
    render(<OnboardingWizard {...defaultProps} />);

    const stepTitles = [
      'Welcome to Concord',
      'Chat',
      'Board',
      'Graph',
      'Code',
      'Studio',
      "You're Ready",
    ];

    for (let i = 0; i < stepTitles.length; i++) {
      expect(screen.getByText(new RegExp(stepTitles[i]))).toBeInTheDocument();
      expect(screen.getByText(`${i + 1} / 7`)).toBeInTheDocument();
      if (i < stepTitles.length - 1) {
        fireEvent.click(screen.getByLabelText('Next step'));
      }
    }
  });

  it('shows Get Started on the last step instead of Next', () => {
    render(<OnboardingWizard {...defaultProps} />);

    // Navigate to last step (step 7)
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByLabelText('Next step'));
    }

    expect(screen.getByText("You're Ready")).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('calls onComplete and onClose when Get Started is clicked on last step', () => {
    render(<OnboardingWizard {...defaultProps} />);

    // Navigate to last step
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByLabelText('Next step'));
    }

    fireEvent.click(screen.getByLabelText('Finish onboarding'));

    expect(defaultProps.onComplete).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when skip button is clicked', () => {
    render(<OnboardingWizard {...defaultProps} />);
    const skipButton = screen.getByLabelText('Skip onboarding');
    fireEvent.click(skipButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders progress dots for all 7 steps', () => {
    render(<OnboardingWizard {...defaultProps} />);
    // There are 7 step dot buttons
    const dots = screen.getAllByLabelText(/Go to step/);
    expect(dots.length).toBe(7);
  });

  it('allows jumping to a step by clicking a progress dot', () => {
    render(<OnboardingWizard {...defaultProps} />);
    const dot3 = screen.getByLabelText('Go to step 3: Board \u2014 Get Things Done');
    fireEvent.click(dot3);
    expect(screen.getByText('3 / 7')).toBeInTheDocument();
    expect(screen.getByText(/Board/)).toBeInTheDocument();
  });

  it('shows "Try it now" action button on workspace steps', () => {
    render(<OnboardingWizard {...defaultProps} />);

    // Step 1 (Welcome) has no action
    expect(screen.queryByText('Try it now')).not.toBeInTheDocument();

    // Step 2 (Chat) has an action
    fireEvent.click(screen.getByLabelText('Next step'));
    expect(screen.getByText('Try it now')).toBeInTheDocument();
  });

  it('calls onAction when "Try it now" is clicked', () => {
    render(<OnboardingWizard {...defaultProps} />);

    // Navigate to Chat step
    fireEvent.click(screen.getByLabelText('Next step'));

    fireEvent.click(screen.getByText('Try it now'));
    expect(defaultProps.onAction).toHaveBeenCalledWith('openChat');
  });

  it('shows Includes section for workspace steps', () => {
    render(<OnboardingWizard {...defaultProps} />);

    // Navigate to Chat step
    fireEvent.click(screen.getByLabelText('Next step'));

    expect(screen.getByText(/Includes:/)).toBeInTheDocument();
    expect(screen.getByText('Threads, Forum, Daily, Governance')).toBeInTheDocument();
  });

  it('handles Escape key to close', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('handles ArrowRight key to advance', () => {
    render(<OnboardingWizard {...defaultProps} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 7')).toBeInTheDocument();
  });

  it('handles ArrowLeft key to go back', () => {
    render(<OnboardingWizard {...defaultProps} />);

    // Go forward first
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 7')).toBeInTheDocument();

    // Go back
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 7')).toBeInTheDocument();
  });
});
