import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorModal } from '@/lib/hooks/use-editor-modal';

interface TestData {
  description: string;
  priority: string;
}

describe('useEditorModal', () => {
  const mockOnSave = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue({ ok: true });
    mockOnDelete.mockResolvedValue({ ok: true });
  });

  function createHook(options = {}) {
    return renderHook(() =>
      useEditorModal<TestData>({
        onSave: mockOnSave,
        onDelete: mockOnDelete,
        ...options,
      })
    );
  }

  describe('initial state', () => {
    it('starts closed with default empty state', () => {
      const { result } = createHook();

      expect(result.current.isOpen).toBe(false);
      expect(result.current.isEditing).toBe(false);
      expect(result.current.editingId).toBeNull();
      expect(result.current.editingItem).toBeNull();
      expect(result.current.title).toBe('');
      expect(result.current.data).toEqual({});
      expect(result.current.isSaving).toBe(false);
      expect(result.current.isDeleting).toBe(false);
    });

    it('applies defaults to initial data', () => {
      const { result } = renderHook(() =>
        useEditorModal<TestData>({
          onSave: mockOnSave,
          defaults: { description: 'default desc', priority: 'low' },
        })
      );

      expect(result.current.data).toEqual({
        description: 'default desc',
        priority: 'low',
      });
    });
  });

  describe('openNew', () => {
    it('opens the modal for new item creation', () => {
      const { result } = createHook();

      act(() => {
        result.current.openNew();
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.isEditing).toBe(false);
      expect(result.current.editingId).toBeNull();
      expect(result.current.editingItem).toBeNull();
      expect(result.current.title).toBe('');
    });

    it('applies initial data over defaults', () => {
      const { result } = renderHook(() =>
        useEditorModal<TestData>({
          onSave: mockOnSave,
          defaults: { description: 'default', priority: 'low' },
        })
      );

      act(() => {
        result.current.openNew({ priority: 'high' });
      });

      expect(result.current.data).toEqual({
        description: 'default',
        priority: 'high',
      });
    });

    it('resets saving/deleting state', () => {
      const { result } = createHook();

      act(() => {
        result.current.openNew();
      });

      expect(result.current.isSaving).toBe(false);
      expect(result.current.isDeleting).toBe(false);
    });
  });

  describe('openEdit', () => {
    const mockItem = {
      id: 'item-1',
      title: 'Existing Item',
      data: { description: 'test desc', priority: 'medium' } as TestData,
      meta: { tags: [], status: 'active', visibility: 'public' },
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      version: 1,
    };

    it('opens the modal for editing', () => {
      const { result } = createHook();

      act(() => {
        result.current.openEdit(mockItem);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.isEditing).toBe(true);
      expect(result.current.editingId).toBe('item-1');
      expect(result.current.editingItem).toEqual(mockItem);
      expect(result.current.title).toBe('Existing Item');
      expect(result.current.data).toEqual({
        description: 'test desc',
        priority: 'medium',
      });
    });
  });

  describe('close', () => {
    it('closes the modal', () => {
      const { result } = createHook();

      act(() => {
        result.current.openNew();
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.close();
      });
      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('setTitle', () => {
    it('updates the title', () => {
      const { result } = createHook();

      act(() => {
        result.current.openNew();
      });

      act(() => {
        result.current.setTitle('New Title');
      });

      expect(result.current.title).toBe('New Title');
    });
  });

  describe('setData', () => {
    it('merges partial data object', () => {
      const { result } = createHook();

      act(() => {
        result.current.openNew({ description: 'initial', priority: 'low' });
      });

      act(() => {
        result.current.setData({ priority: 'high' });
      });

      expect(result.current.data).toEqual({
        description: 'initial',
        priority: 'high',
      });
    });

    it('accepts an updater function', () => {
      const { result } = createHook();

      act(() => {
        result.current.openNew({ description: 'initial', priority: 'low' });
      });

      act(() => {
        result.current.setData((prev) => ({
          ...prev,
          description: prev.description + ' updated',
        }));
      });

      expect(result.current.data.description).toBe('initial updated');
    });
  });

  describe('setField', () => {
    it('sets a specific field', () => {
      const { result } = createHook();

      act(() => {
        result.current.openNew({ description: '', priority: 'low' });
      });

      act(() => {
        result.current.setField('priority', 'critical' as never);
      });

      expect(result.current.data.priority).toBe('critical');
    });
  });

  describe('save', () => {
    it('calls onSave with data and null id for new items', async () => {
      const { result } = createHook();

      act(() => {
        result.current.openNew();
      });

      act(() => {
        result.current.setTitle('My Item');
        result.current.setData({ description: 'desc', priority: 'high' });
      });

      await act(async () => {
        await result.current.save();
      });

      expect(mockOnSave).toHaveBeenCalledWith(
        {
          title: 'My Item',
          data: { description: 'desc', priority: 'high' },
          meta: undefined,
        },
        null
      );
      expect(result.current.isOpen).toBe(false);
    });

    it('calls onSave with data and id for existing items', async () => {
      const { result } = createHook();

      act(() => {
        result.current.openEdit({
          id: 'item-1',
          title: 'Existing',
          data: { description: 'old', priority: 'low' } as TestData,
          meta: { tags: [], status: 'active', visibility: 'public' },
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
          version: 1,
        });
      });

      await act(async () => {
        await result.current.save({ extraMeta: true });
      });

      expect(mockOnSave).toHaveBeenCalledWith(
        {
          title: 'Existing',
          data: { description: 'old', priority: 'low' },
          meta: { extraMeta: true },
        },
        'item-1'
      );
    });

    it('sets isSaving during save', async () => {
      let resolvePromise: (v: unknown) => void;
      mockOnSave.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { result } = createHook();

      act(() => {
        result.current.openNew();
        result.current.setTitle('Test');
      });

      let savePromise: Promise<void>;
      act(() => {
        savePromise = result.current.save();
      });

      // isSaving should be true while saving
      expect(result.current.isSaving).toBe(true);

      await act(async () => {
        resolvePromise!({ ok: true });
        await savePromise!;
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('throws on save failure and resets isSaving', async () => {
      mockOnSave.mockRejectedValue(new Error('Server error'));

      const { result } = createHook();

      act(() => {
        result.current.openNew();
        result.current.setTitle('Test');
      });

      await expect(
        act(async () => {
          await result.current.save();
        })
      ).rejects.toThrow('Save failed');

      expect(result.current.isSaving).toBe(false);
      // Modal should remain open on failure
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('remove', () => {
    it('calls onDelete with the editing item id', async () => {
      const { result } = createHook();

      act(() => {
        result.current.openEdit({
          id: 'item-1',
          title: 'Item',
          data: {} as TestData,
          meta: { tags: [], status: 'active', visibility: 'public' },
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
          version: 1,
        });
      });

      await act(async () => {
        await result.current.remove();
      });

      expect(mockOnDelete).toHaveBeenCalledWith('item-1');
      expect(result.current.isOpen).toBe(false);
    });

    it('does nothing when no editingId', async () => {
      const { result } = createHook();

      act(() => {
        result.current.openNew();
      });

      await act(async () => {
        await result.current.remove();
      });

      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('does nothing when onDelete is not provided', async () => {
      const { result } = renderHook(() =>
        useEditorModal<TestData>({ onSave: mockOnSave })
      );

      act(() => {
        result.current.openEdit({
          id: 'item-1',
          title: 'Item',
          data: {} as TestData,
          meta: { tags: [], status: 'active', visibility: 'public' },
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
          version: 1,
        });
      });

      await act(async () => {
        await result.current.remove();
      });

      // Should not throw, just do nothing
      expect(result.current.isOpen).toBe(true);
    });

    it('sets isDeleting during delete', async () => {
      let resolvePromise: (v: unknown) => void;
      mockOnDelete.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const { result } = createHook();

      act(() => {
        result.current.openEdit({
          id: 'item-1',
          title: 'Item',
          data: {} as TestData,
          meta: { tags: [], status: 'active', visibility: 'public' },
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
          version: 1,
        });
      });

      let deletePromise: Promise<void>;
      act(() => {
        deletePromise = result.current.remove();
      });

      expect(result.current.isDeleting).toBe(true);

      await act(async () => {
        resolvePromise!({ ok: true });
        await deletePromise!;
      });

      expect(result.current.isDeleting).toBe(false);
    });

    it('throws on delete failure and resets isDeleting', async () => {
      mockOnDelete.mockRejectedValue(new Error('Delete error'));

      const { result } = createHook();

      act(() => {
        result.current.openEdit({
          id: 'item-1',
          title: 'Item',
          data: {} as TestData,
          meta: { tags: [], status: 'active', visibility: 'public' },
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
          version: 1,
        });
      });

      await expect(
        act(async () => {
          await result.current.remove();
        })
      ).rejects.toThrow('Delete failed');

      expect(result.current.isDeleting).toBe(false);
      expect(result.current.isOpen).toBe(true);
    });
  });
});
