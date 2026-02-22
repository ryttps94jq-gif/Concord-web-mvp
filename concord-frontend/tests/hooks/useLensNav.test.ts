import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Shared spy that the mock factory captures
const mockSetActiveLens = vi.fn();

// Mock dependencies
vi.mock('@/store/ui', () => ({
  useUIStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ setActiveLens: mockSetActiveLens })
  ),
}));

vi.mock('@/lib/lens-registry', () => ({
  getLensById: vi.fn(),
}));

import { useLensNav } from '@/hooks/useLensNav';
import { getLensById } from '@/lib/lens-registry';

const mockedGetLensById = vi.mocked(getLensById);

describe('useLensNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls setActiveLens with the provided slug', () => {
    mockedGetLensById.mockReturnValue({
      id: 'chat',
      name: 'Chat',
      icon: vi.fn() as any,
      description: 'Chat lens',
      category: 'core',
      showInSidebar: true,
      showInCommandPalette: true,
      path: '/lenses/chat',
      order: 1,
    });

    renderHook(() => useLensNav('chat'));

    expect(mockSetActiveLens).toHaveBeenCalledWith('chat');
  });

  it('calls setActiveLens even when lens is not found in registry', () => {
    mockedGetLensById.mockReturnValue(undefined);

    renderHook(() => useLensNav('custom-lens'));

    expect(mockSetActiveLens).toHaveBeenCalledWith('custom-lens');
  });

  it('warns in development when lens is not in registry', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockedGetLensById.mockReturnValue(undefined);

    renderHook(() => useLensNav('nonexistent'));

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('nonexistent')
    );

    warnSpy.mockRestore();
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
  });

  it('does not warn in production when lens is not in registry', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockedGetLensById.mockReturnValue(undefined);

    renderHook(() => useLensNav('nonexistent'));

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
  });

  it('does not warn when lens exists in registry', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockedGetLensById.mockReturnValue({
      id: 'board',
      name: 'Board',
      icon: vi.fn() as any,
      description: 'Board',
      category: 'core',
      showInSidebar: true,
      showInCommandPalette: true,
      path: '/lenses/board',
      order: 2,
    });

    renderHook(() => useLensNav('board'));

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
  });

  it('updates when lensSlug changes', () => {
    mockedGetLensById.mockReturnValue(undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { rerender } = renderHook(
      ({ slug }: { slug: string }) => useLensNav(slug),
      { initialProps: { slug: 'chat' } }
    );

    expect(mockSetActiveLens).toHaveBeenCalledWith('chat');

    mockSetActiveLens.mockClear();

    rerender({ slug: 'board' });

    expect(mockSetActiveLens).toHaveBeenCalledWith('board');

    warnSpy.mockRestore();
  });
});
