'use client';

import dynamic from 'next/dynamic';

/**
 * BlockEditor — lazy-loaded wrapper.
 *
 * The actual Tiptap implementation lives in BlockEditorCore.tsx and is loaded
 * on-demand via next/dynamic with SSR disabled (Tiptap relies on browser
 * APIs for contenteditable, selection, and DOM measurement).
 */

const BlockEditor = dynamic(
  () =>
    import('./BlockEditorCore').then((mod) => ({
      default: mod.BlockEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-white/5 rounded-lg h-64" />
    ),
  }
);

const SlashCommandMenu = dynamic(
  () =>
    import('./BlockEditorCore').then((mod) => ({
      default: mod.SlashCommandMenu,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-white/5 rounded-lg h-48" />
    ),
  }
);

export { BlockEditor, SlashCommandMenu };
export default BlockEditor;
