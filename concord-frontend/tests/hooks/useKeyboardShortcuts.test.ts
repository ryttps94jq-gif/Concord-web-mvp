import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';

// Mock react-hotkeys-hook
vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
}));

import {
  KeyboardProvider,
  useKeyboard,
  DEFAULT_SHORTCUTS,
  SHORTCUT_CATEGORIES,
} from '@/lib/keyboard';

// Helper: wraps renderHook with the KeyboardProvider
function renderKeyboardHook<T>(hook: () => T) {
  return renderHook(hook, {
    wrapper: ({ children }) => createElement(KeyboardProvider, null, children),
  });
}

describe('DEFAULT_SHORTCUTS', () => {
  it('contains at least 20 shortcuts', () => {
    expect(DEFAULT_SHORTCUTS.length).toBeGreaterThanOrEqual(20);
  });

  it('includes command-palette shortcut with mod+k', () => {
    const cmdPalette = DEFAULT_SHORTCUTS.find(s => s.id === 'command-palette');
    expect(cmdPalette).toBeDefined();
    expect(cmdPalette?.keys).toBe('mod+k');
    expect(cmdPalette?.category).toBe('navigation');
    expect(cmdPalette?.global).toBe(true);
  });

  it('includes save shortcut with mod+s', () => {
    const save = DEFAULT_SHORTCUTS.find(s => s.id === 'save');
    expect(save).toBeDefined();
    expect(save?.keys).toBe('mod+s');
    expect(save?.category).toBe('editing');
  });

  it('includes escape shortcut', () => {
    const escape = DEFAULT_SHORTCUTS.find(s => s.id === 'escape');
    expect(escape).toBeDefined();
    expect(escape?.keys).toBe('escape');
    expect(escape?.category).toBe('system');
  });

  it('all shortcuts have required fields', () => {
    for (const shortcut of DEFAULT_SHORTCUTS) {
      expect(shortcut.id).toBeTruthy();
      expect(shortcut.keys).toBeTruthy();
      expect(shortcut.description).toBeTruthy();
      expect(shortcut.category).toBeTruthy();
      expect(Object.keys(SHORTCUT_CATEGORIES)).toContain(shortcut.category);
    }
  });
});

describe('SHORTCUT_CATEGORIES', () => {
  it('has 5 categories', () => {
    expect(Object.keys(SHORTCUT_CATEGORIES)).toHaveLength(5);
  });

  it('contains navigation, editing, actions, view, system', () => {
    expect(SHORTCUT_CATEGORIES).toHaveProperty('navigation', 'Navigation');
    expect(SHORTCUT_CATEGORIES).toHaveProperty('editing', 'Editing');
    expect(SHORTCUT_CATEGORIES).toHaveProperty('actions', 'Actions');
    expect(SHORTCUT_CATEGORIES).toHaveProperty('view', 'View');
    expect(SHORTCUT_CATEGORIES).toHaveProperty('system', 'System');
  });
});

describe('useKeyboard (via KeyboardProvider)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if used outside KeyboardProvider', () => {
    // Suppress console.error from React for the expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useKeyboard())).toThrow(
      'useKeyboard must be used within KeyboardProvider'
    );
    spy.mockRestore();
  });

  it('returns initial empty shortcuts array', () => {
    const { result } = renderKeyboardHook(() => useKeyboard());
    expect(result.current.shortcuts).toEqual([]);
  });

  it('starts with showHelp as false', () => {
    const { result } = renderKeyboardHook(() => useKeyboard());
    expect(result.current.showHelp).toBe(false);
  });

  it('registerShortcut adds a shortcut', () => {
    const { result } = renderKeyboardHook(() => useKeyboard());

    act(() => {
      result.current.registerShortcut({
        id: 'test-shortcut',
        keys: 'mod+t',
        description: 'Test shortcut',
        category: 'actions',
        action: vi.fn(),
        enabled: true,
      });
    });

    expect(result.current.shortcuts).toHaveLength(1);
    expect(result.current.shortcuts[0].id).toBe('test-shortcut');
    expect(result.current.shortcuts[0].keys).toBe('mod+t');
  });

  it('registerShortcut updates existing shortcut with same id', () => {
    const { result } = renderKeyboardHook(() => useKeyboard());

    act(() => {
      result.current.registerShortcut({
        id: 'test-shortcut',
        keys: 'mod+t',
        description: 'Original',
        category: 'actions',
        action: vi.fn(),
      });
    });

    act(() => {
      result.current.registerShortcut({
        id: 'test-shortcut',
        keys: 'mod+shift+t',
        description: 'Updated',
        category: 'view',
        action: vi.fn(),
      });
    });

    expect(result.current.shortcuts).toHaveLength(1);
    expect(result.current.shortcuts[0].description).toBe('Updated');
    expect(result.current.shortcuts[0].keys).toBe('mod+shift+t');
  });

  it('unregisterShortcut removes a shortcut', () => {
    const { result } = renderKeyboardHook(() => useKeyboard());

    act(() => {
      result.current.registerShortcut({
        id: 'to-remove',
        keys: 'mod+r',
        description: 'Remove me',
        category: 'actions',
        action: vi.fn(),
      });
    });

    expect(result.current.shortcuts).toHaveLength(1);

    act(() => {
      result.current.unregisterShortcut('to-remove');
    });

    expect(result.current.shortcuts).toHaveLength(0);
  });

  it('isShortcutEnabled returns true by default', () => {
    const { result } = renderKeyboardHook(() => useKeyboard());

    act(() => {
      result.current.registerShortcut({
        id: 'enabled-test',
        keys: 'mod+e',
        description: 'Enabled test',
        category: 'actions',
        action: vi.fn(),
      });
    });

    expect(result.current.isShortcutEnabled('enabled-test')).toBe(true);
  });

  it('disableShortcut and enableShortcut toggle enabled state', () => {
    const { result } = renderKeyboardHook(() => useKeyboard());

    act(() => {
      result.current.registerShortcut({
        id: 'toggle-test',
        keys: 'mod+x',
        description: 'Toggle test',
        category: 'actions',
        action: vi.fn(),
        enabled: true,
      });
    });

    act(() => {
      result.current.disableShortcut('toggle-test');
    });

    expect(result.current.isShortcutEnabled('toggle-test')).toBe(false);

    act(() => {
      result.current.enableShortcut('toggle-test');
    });

    expect(result.current.isShortcutEnabled('toggle-test')).toBe(true);
  });

  it('setShowHelp updates the showHelp state', () => {
    const { result } = renderKeyboardHook(() => useKeyboard());

    act(() => {
      result.current.setShowHelp(true);
    });

    expect(result.current.showHelp).toBe(true);

    act(() => {
      result.current.setShowHelp(false);
    });

    expect(result.current.showHelp).toBe(false);
  });
});
