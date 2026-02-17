/**
 * useEditorModal — Shared editor modal state hook
 *
 * Eliminates the repeated pattern of showEditor/editingItem/formState
 * found across 10+ lenses. Provides open/close/save lifecycle with
 * automatic form state management.
 *
 * Usage:
 *   const editor = useEditorModal<MyDataType>({
 *     onSave: async (data, id) => id ? update(id, data) : create(data),
 *     onDelete: async (id) => remove(id),
 *   });
 *
 *   editor.openNew({ status: 'draft' });
 *   editor.openEdit(existingItem);
 *   editor.close();
 */

import { useState, useCallback } from 'react';
import type { LensItem } from './use-lens-data';

interface EditorModalOptions<T> {
  /** Called on save with merged form data and optional existing ID */
  onSave: (data: { title: string; data: Partial<T>; meta?: Record<string, unknown> }, id: string | null) => Promise<unknown>;
  /** Called on delete with item ID */
  onDelete?: (id: string) => Promise<unknown>;
  /** Default form values for new items */
  defaults?: Partial<T>;
}

interface EditorModalState<T> {
  isOpen: boolean;
  isEditing: boolean;
  editingId: string | null;
  editingItem: LensItem<T> | null;
  title: string;
  data: Partial<T>;
  isSaving: boolean;
  isDeleting: boolean;
}

export function useEditorModal<T = Record<string, unknown>>(options: EditorModalOptions<T>) {
  const { onSave, onDelete, defaults = {} as Partial<T> } = options;

  const [state, setState] = useState<EditorModalState<T>>({
    isOpen: false,
    isEditing: false,
    editingId: null,
    editingItem: null,
    title: '',
    data: { ...defaults },
    isSaving: false,
    isDeleting: false,
  });

  const openNew = useCallback((initialData?: Partial<T>) => {
    setState({
      isOpen: true,
      isEditing: false,
      editingId: null,
      editingItem: null,
      title: '',
      data: { ...defaults, ...initialData },
      isSaving: false,
      isDeleting: false,
    });
  }, [defaults]);

  const openEdit = useCallback((item: LensItem<T>) => {
    setState({
      isOpen: true,
      isEditing: true,
      editingId: item.id,
      editingItem: item,
      title: item.title,
      data: { ...item.data },
      isSaving: false,
      isDeleting: false,
    });
  }, []);

  const close = useCallback(() => {
    setState(s => ({ ...s, isOpen: false }));
  }, []);

  const setTitle = useCallback((title: string) => {
    setState(s => ({ ...s, title }));
  }, []);

  const setData = useCallback((updater: Partial<T> | ((prev: Partial<T>) => Partial<T>)) => {
    setState(s => ({
      ...s,
      data: typeof updater === 'function'
        ? (updater as (prev: Partial<T>) => Partial<T>)(s.data)
        : { ...s.data, ...updater },
    }));
  }, []);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setState(s => ({ ...s, data: { ...s.data, [key]: value } }));
  }, []);

  const save = useCallback(async (meta?: Record<string, unknown>) => {
    setState(s => ({ ...s, isSaving: true }));
    try {
      await onSave(
        { title: state.title, data: state.data, meta },
        state.editingId
      );
      setState(s => ({ ...s, isOpen: false, isSaving: false }));
    } catch {
      setState(s => ({ ...s, isSaving: false }));
      throw new Error('Save failed');
    }
  }, [onSave, state.title, state.data, state.editingId]);

  const remove = useCallback(async () => {
    if (!onDelete || !state.editingId) return;
    setState(s => ({ ...s, isDeleting: true }));
    try {
      await onDelete(state.editingId);
      setState(s => ({ ...s, isOpen: false, isDeleting: false }));
    } catch {
      setState(s => ({ ...s, isDeleting: false }));
      throw new Error('Delete failed');
    }
  }, [onDelete, state.editingId]);

  return {
    ...state,
    openNew,
    openEdit,
    close,
    setTitle,
    setData,
    setField,
    save,
    remove,
  };
}
