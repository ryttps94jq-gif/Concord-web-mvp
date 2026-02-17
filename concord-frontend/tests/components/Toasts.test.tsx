import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock store
const mockToasts: Array<{ id: string; type: string; message: string; duration?: number }> = [];
const mockRemoveToast = vi.fn();
const mockAddToast = vi.fn();

vi.mock('@/store/ui', () => ({
  useUIStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        toasts: mockToasts,
        removeToast: mockRemoveToast,
        addToast: mockAddToast,
      };
      return selector(state);
    },
    {
      getState: () => ({
        addToast: mockAddToast,
        removeToast: mockRemoveToast,
        toasts: mockToasts,
      }),
    }
  ),
}));

import { Toasts, showToast } from '@/components/common/Toasts';

describe('Toasts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToasts.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<Toasts />);
    // Container exists but has no toast children
    const toastContainer = container.firstElementChild;
    expect(toastContainer).toBeInTheDocument();
    expect(toastContainer?.children.length).toBe(0);
  });

  it('renders a success toast with correct message', () => {
    mockToasts.push({ id: '1', type: 'success', message: 'Operation successful' });
    render(<Toasts />);
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  it('renders an error toast with correct message', () => {
    mockToasts.push({ id: '2', type: 'error', message: 'Something went wrong' });
    render(<Toasts />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders a warning toast with correct message', () => {
    mockToasts.push({ id: '3', type: 'warning', message: 'Be careful' });
    render(<Toasts />);
    expect(screen.getByText('Be careful')).toBeInTheDocument();
  });

  it('renders an info toast with correct message', () => {
    mockToasts.push({ id: '4', type: 'info', message: 'Just so you know' });
    render(<Toasts />);
    expect(screen.getByText('Just so you know')).toBeInTheDocument();
  });

  it('renders multiple toasts at once', () => {
    mockToasts.push(
      { id: '1', type: 'success', message: 'First toast' },
      { id: '2', type: 'error', message: 'Second toast' },
      { id: '3', type: 'info', message: 'Third toast' }
    );
    render(<Toasts />);
    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
    expect(screen.getByText('Third toast')).toBeInTheDocument();
  });

  it('calls removeToast when close button is clicked', () => {
    mockToasts.push({ id: 'toast-1', type: 'success', message: 'Dismissable toast' });
    render(<Toasts />);

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(mockRemoveToast).toHaveBeenCalledWith('toast-1');
  });

  it('auto-dismisses toast after duration', () => {
    vi.useFakeTimers();
    mockToasts.push({ id: 'auto-1', type: 'info', message: 'Auto dismiss' });
    render(<Toasts />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockRemoveToast).toHaveBeenCalledWith('auto-1');
    vi.useRealTimers();
  });

  it('each toast type renders an svg icon', () => {
    mockToasts.push({ id: 'icon-1', type: 'success', message: 'With icon' });
    const { container } = render(<Toasts />);
    const svgs = container.querySelectorAll('svg');
    // At least 2 SVGs: the type icon + the close X icon
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });
});

describe('showToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls addToast on the store with correct params', () => {
    showToast('success', 'Test message');
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'Test message',
      duration: undefined,
    });
  });

  it('passes custom duration to addToast', () => {
    showToast('error', 'Error message', 10000);
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'Error message',
      duration: 10000,
    });
  });
});
