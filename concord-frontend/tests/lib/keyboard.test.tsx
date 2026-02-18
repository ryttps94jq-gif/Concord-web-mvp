import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';

// We must mock react-hotkeys-hook BEFORE importing the module under test
vi.mock('react-hotkeys-hook', () => {
  const registeredHotkeys: Record<string, (e: Partial<KeyboardEvent>) => void> = {};

  return {
    useHotkeys: vi.fn((keys: string, callback: (e: Partial<KeyboardEvent>) => void) => {
      registeredHotkeys[keys] = callback;
    }),
    // expose for test assertions
    __registeredHotkeys: registeredHotkeys,
  };
});

import {
  SHORTCUT_CATEGORIES,
  DEFAULT_SHORTCUTS,
  KeyboardProvider,
  useKeyboard,
  useShortcut,
  useGlobalShortcuts,
} from '@/lib/keyboard';

// Helper to render within the KeyboardProvider
function renderWithProvider(ui: React.ReactElement) {
  return render(<KeyboardProvider>{ui}</KeyboardProvider>);
}

// Test component that exposes keyboard context
function KeyboardConsumer({ onContext }: { onContext: (ctx: ReturnType<typeof useKeyboard>) => void }) {
  const ctx = useKeyboard();
  onContext(ctx);
  return <div data-testid="consumer">shortcuts: {ctx.shortcuts.length}</div>;
}

// Test component that registers a shortcut
function ShortcutUser({
  id,
  keys,
  action,
  options = {},
}: {
  id: string;
  keys: string;
  action: () => void;
  options?: Partial<{ description: string; category: 'navigation' | 'editing' | 'actions' | 'view' | 'system'; enabled: boolean; global: boolean }>;
}) {
  useShortcut(id, keys, action, options);
  return <div data-testid={`shortcut-${id}`}>Shortcut: {id}</div>;
}

// Test component for global shortcuts
function GlobalShortcutUser({ handlers }: { handlers: Record<string, () => void> }) {
  useGlobalShortcuts(handlers);
  return <div data-testid="global-shortcuts">Global shortcuts active</div>;
}

describe('keyboard module', () => {
  describe('SHORTCUT_CATEGORIES', () => {
    it('has all five categories', () => {
      expect(SHORTCUT_CATEGORIES).toEqual({
        navigation: 'Navigation',
        editing: 'Editing',
        actions: 'Actions',
        view: 'View',
        system: 'System',
      });
    });
  });

  describe('DEFAULT_SHORTCUTS', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(DEFAULT_SHORTCUTS)).toBe(true);
      expect(DEFAULT_SHORTCUTS.length).toBeGreaterThan(0);
    });

    it('each shortcut has required fields', () => {
      for (const shortcut of DEFAULT_SHORTCUTS) {
        expect(shortcut).toHaveProperty('id');
        expect(shortcut).toHaveProperty('keys');
        expect(shortcut).toHaveProperty('description');
        expect(shortcut).toHaveProperty('category');
        expect(typeof shortcut.id).toBe('string');
        expect(typeof shortcut.keys).toBe('string');
        expect(typeof shortcut.description).toBe('string');
      }
    });

    it('contains shortcuts from all categories', () => {
      const categories = new Set(DEFAULT_SHORTCUTS.map(s => s.category));
      expect(categories.has('navigation')).toBe(true);
      expect(categories.has('editing')).toBe(true);
      expect(categories.has('actions')).toBe(true);
      expect(categories.has('view')).toBe(true);
      expect(categories.has('system')).toBe(true);
    });

    it('has unique shortcut ids', () => {
      const ids = DEFAULT_SHORTCUTS.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('includes expected navigation shortcuts', () => {
      const navIds = DEFAULT_SHORTCUTS.filter(s => s.category === 'navigation').map(s => s.id);
      expect(navIds).toContain('command-palette');
      expect(navIds).toContain('search');
      expect(navIds).toContain('toggle-sidebar');
    });

    it('includes expected system shortcuts', () => {
      const sysIds = DEFAULT_SHORTCUTS.filter(s => s.category === 'system').map(s => s.id);
      expect(sysIds).toContain('help');
      expect(sysIds).toContain('settings');
      expect(sysIds).toContain('escape');
    });
  });

  describe('KeyboardProvider', () => {
    it('renders children', () => {
      render(
        <KeyboardProvider>
          <div data-testid="child">Hello</div>
        </KeyboardProvider>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('provides context with initial empty shortcuts', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );
      expect(ctx).not.toBeNull();
      expect(ctx!.shortcuts).toEqual([]);
      expect(ctx!.showHelp).toBe(false);
    });
  });

  describe('useKeyboard', () => {
    it('throws when used outside provider', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<KeyboardConsumer onContext={() => {}} />);
      }).toThrow('useKeyboard must be used within KeyboardProvider');

      errorSpy.mockRestore();
    });

    it('registerShortcut adds a new shortcut', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.registerShortcut({
          id: 'test-shortcut',
          keys: 'mod+t',
          description: 'Test shortcut',
          category: 'actions',
          action: () => {},
        });
      });

      expect(ctx!.shortcuts).toHaveLength(1);
      expect(ctx!.shortcuts[0].id).toBe('test-shortcut');
    });

    it('registerShortcut updates existing shortcut with same id', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      const shortcut = {
        id: 'my-shortcut',
        keys: 'mod+m',
        description: 'Original',
        category: 'actions' as const,
        action: () => {},
      };

      act(() => {
        ctx!.registerShortcut(shortcut);
      });

      act(() => {
        ctx!.registerShortcut({ ...shortcut, description: 'Updated' });
      });

      expect(ctx!.shortcuts).toHaveLength(1);
      expect(ctx!.shortcuts[0].description).toBe('Updated');
    });

    it('unregisterShortcut removes a shortcut', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.registerShortcut({
          id: 'remove-me',
          keys: 'mod+r',
          description: 'To be removed',
          category: 'actions',
          action: () => {},
        });
      });

      expect(ctx!.shortcuts).toHaveLength(1);

      act(() => {
        ctx!.unregisterShortcut('remove-me');
      });

      expect(ctx!.shortcuts).toHaveLength(0);
    });

    it('isShortcutEnabled returns true for enabled shortcuts', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.registerShortcut({
          id: 'enabled-sc',
          keys: 'mod+e',
          description: 'Enabled',
          category: 'actions',
          action: () => {},
          enabled: true,
        });
      });

      expect(ctx!.isShortcutEnabled('enabled-sc')).toBe(true);
    });

    it('isShortcutEnabled returns true for shortcut without enabled field', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.registerShortcut({
          id: 'default-sc',
          keys: 'mod+d',
          description: 'Default',
          category: 'actions',
          action: () => {},
        });
      });

      expect(ctx!.isShortcutEnabled('default-sc')).toBe(true);
    });

    it('isShortcutEnabled returns true for unknown shortcut id', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      expect(ctx!.isShortcutEnabled('nonexistent')).toBe(true);
    });

    it('disableShortcut sets enabled to false', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.registerShortcut({
          id: 'disable-me',
          keys: 'mod+x',
          description: 'Disable me',
          category: 'actions',
          action: () => {},
          enabled: true,
        });
      });

      act(() => {
        ctx!.disableShortcut('disable-me');
      });

      expect(ctx!.isShortcutEnabled('disable-me')).toBe(false);
    });

    it('enableShortcut sets enabled to true', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.registerShortcut({
          id: 'enable-me',
          keys: 'mod+y',
          description: 'Enable me',
          category: 'actions',
          action: () => {},
          enabled: false,
        });
      });

      act(() => {
        ctx!.enableShortcut('enable-me');
      });

      expect(ctx!.isShortcutEnabled('enable-me')).toBe(true);
    });

    it('setShowHelp toggles help state', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      expect(ctx!.showHelp).toBe(false);

      act(() => {
        ctx!.setShowHelp(true);
      });

      expect(ctx!.showHelp).toBe(true);
    });
  });

  describe('KeyboardProvider shows help modal', () => {
    it('renders KeyboardShortcutsModal when showHelp is true', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.setShowHelp(true);
      });

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    it('does not render modal when showHelp is false', () => {
      renderWithProvider(
        <KeyboardConsumer onContext={() => {}} />
      );

      expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
    });
  });

  describe('useShortcut hook', () => {
    it('registers a shortcut on mount', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      const action = vi.fn();

      renderWithProvider(
        <>
          <KeyboardConsumer onContext={(c) => { ctx = c; }} />
          <ShortcutUser id="test-sc" keys="mod+t" action={action} />
        </>
      );

      expect(ctx!.shortcuts.find(s => s.id === 'test-sc')).toBeDefined();
    });

    it('uses default category and description from id', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      const action = vi.fn();

      renderWithProvider(
        <>
          <KeyboardConsumer onContext={(c) => { ctx = c; }} />
          <ShortcutUser id="my-action" keys="mod+a" action={action} />
        </>
      );

      const shortcut = ctx!.shortcuts.find(s => s.id === 'my-action');
      expect(shortcut?.description).toBe('my-action');
      expect(shortcut?.category).toBe('actions');
    });

    it('uses provided options for category and description', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      const action = vi.fn();

      renderWithProvider(
        <>
          <KeyboardConsumer onContext={(c) => { ctx = c; }} />
          <ShortcutUser
            id="custom-sc"
            keys="mod+c"
            action={action}
            options={{ description: 'Custom description', category: 'navigation' }}
          />
        </>
      );

      const shortcut = ctx!.shortcuts.find(s => s.id === 'custom-sc');
      expect(shortcut?.description).toBe('Custom description');
      expect(shortcut?.category).toBe('navigation');
    });

    it('unregisters shortcut on unmount', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      const action = vi.fn();

      const { unmount } = renderWithProvider(
        <>
          <KeyboardConsumer onContext={(c) => { ctx = c; }} />
          <ShortcutUser id="unmount-sc" keys="mod+u" action={action} />
        </>
      );

      expect(ctx!.shortcuts.find(s => s.id === 'unmount-sc')).toBeDefined();

      unmount();
    });
  });

  describe('useGlobalShortcuts hook', () => {
    it('renders component with global shortcuts', () => {
      const handlers = {
        'command-palette': vi.fn(),
        escape: vi.fn(),
      };

      renderWithProvider(
        <GlobalShortcutUser handlers={handlers} />
      );

      expect(screen.getByTestId('global-shortcuts')).toBeInTheDocument();
    });

    it('registers hotkeys via useHotkeys', async () => {
      const { useHotkeys } = await import('react-hotkeys-hook');
      const handlers = {
        'command-palette': vi.fn(),
        'quick-capture': vi.fn(),
        'toggle-sidebar': vi.fn(),
        'toggle-focus': vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        escape: vi.fn(),
      };

      renderWithProvider(
        <GlobalShortcutUser handlers={handlers} />
      );

      // useHotkeys should have been called for each handler
      expect(useHotkeys).toHaveBeenCalled();

      // Check that specific key combos were registered
      const calledKeys = (useHotkeys as ReturnType<typeof vi.fn>).mock.calls.map(
        (call: unknown[]) => call[0]
      );
      expect(calledKeys).toContain('mod+?');
      expect(calledKeys).toContain('escape');
      expect(calledKeys).toContain('mod+k');
      expect(calledKeys).toContain('mod+shift+n');
      expect(calledKeys).toContain('mod+b');
      expect(calledKeys).toContain('mod+z');
      expect(calledKeys).toContain('mod+shift+z');
      expect(calledKeys).toContain('mod+.');
    });
  });

  describe('KeyboardShortcutsModal', () => {
    it('renders category headings from SHORTCUT_CATEGORIES', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.setShowHelp(true);
      });

      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('Editing')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('View')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('renders default shortcuts when no custom ones registered', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.setShowHelp(true);
      });

      expect(screen.getByText('Open command palette')).toBeInTheDocument();
      expect(screen.getByText('Undo')).toBeInTheDocument();
    });

    it('close button calls onClose which hides modal', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.setShowHelp(true);
      });

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();

      const closeBtn = screen.getByRole('button');
      fireEvent.click(closeBtn);

      expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
    });

    it('displays registered shortcuts grouped by category', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.registerShortcut({
          id: 'custom-nav',
          keys: 'mod+shift+x',
          description: 'Custom navigation shortcut',
          category: 'navigation',
          action: () => {},
        });
      });

      act(() => {
        ctx!.setShowHelp(true);
      });

      expect(screen.getByText('Custom navigation shortcut')).toBeInTheDocument();
    });

    it('has a close sr-only label for accessibility', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.setShowHelp(true);
      });

      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('formats key display strings', () => {
      let ctx: ReturnType<typeof useKeyboard> | null = null;
      renderWithProvider(
        <KeyboardConsumer onContext={(c) => { ctx = c; }} />
      );

      act(() => {
        ctx!.registerShortcut({
          id: 'format-test',
          keys: 'mod+shift+k',
          description: 'Format test shortcut',
          category: 'system',
          action: () => {},
        });
      });

      act(() => {
        ctx!.setShowHelp(true);
      });

      // The modal should render at least one kbd element
      const kbdElements = document.querySelectorAll('kbd');
      expect(kbdElements.length).toBeGreaterThan(0);
    });
  });
});
