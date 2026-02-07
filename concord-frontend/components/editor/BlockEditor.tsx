'use client';

import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Table as TableIcon,
  Minus,
  Undo,
  Redo,
  Highlighter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCallback, useState, useEffect } from 'react';

interface BlockEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  autoFocus?: boolean;
  className?: string;
  minHeight?: string;
}

export function BlockEditor({
  content = '',
  onChange,
  onSave,
  placeholder = 'Start writing...',
  editable = true,
  autoFocus = false,
  className,
  minHeight = '200px'
}: BlockEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty'
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-neon-cyan underline hover:text-neon-cyan/80'
        }
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full'
        }
      }),
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Highlight.configure({
        multicolor: true
      }),
      Typography,
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableCell,
      TableHeader
    ],
    content,
    editable,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);

      // Update word count
      const text = editor.state.doc.textContent;
      setWordCount(text.split(/\s+/).filter(Boolean).length);
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-invert prose-sm max-w-none focus:outline-none',
          'prose-headings:text-white prose-headings:font-semibold',
          'prose-p:text-gray-300 prose-p:leading-relaxed',
          'prose-a:text-neon-cyan prose-a:no-underline hover:prose-a:underline',
          'prose-code:text-neon-pink prose-code:bg-lattice-surface prose-code:px-1 prose-code:rounded',
          'prose-pre:bg-lattice-surface prose-pre:border prose-pre:border-lattice-border',
          'prose-blockquote:border-neon-purple prose-blockquote:text-gray-400',
          'prose-li:text-gray-300',
          'prose-hr:border-lattice-border'
        )
      }
    }
  });

  // Keyboard shortcuts for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editor || isSaving) return;

    setIsSaving(true);
    try {
      await onSave?.(editor.getHTML());
    } finally {
      setIsSaving(false);
    }
  }, [editor, onSave, isSaving]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;

    const url = window.prompt('Image URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn('relative', className)}>
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center gap-1 p-2 bg-lattice-bg/95 backdrop-blur border-b border-lattice-border mb-4 rounded-t-lg overflow-x-auto">
        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            icon={<Undo className="w-4 h-4" />}
            tooltip="Undo"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            icon={<Redo className="w-4 h-4" />}
            tooltip="Redo"
          />
        </ToolbarGroup>

        <ToolbarDivider />

        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            icon={<Heading1 className="w-4 h-4" />}
            tooltip="Heading 1"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            icon={<Heading2 className="w-4 h-4" />}
            tooltip="Heading 2"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            icon={<Heading3 className="w-4 h-4" />}
            tooltip="Heading 3"
          />
        </ToolbarGroup>

        <ToolbarDivider />

        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            icon={<Bold className="w-4 h-4" />}
            tooltip="Bold"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            icon={<Italic className="w-4 h-4" />}
            tooltip="Italic"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            icon={<Strikethrough className="w-4 h-4" />}
            tooltip="Strikethrough"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            icon={<Code className="w-4 h-4" />}
            tooltip="Code"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive('highlight')}
            icon={<Highlighter className="w-4 h-4" />}
            tooltip="Highlight"
          />
        </ToolbarGroup>

        <ToolbarDivider />

        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            icon={<List className="w-4 h-4" />}
            tooltip="Bullet List"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            icon={<ListOrdered className="w-4 h-4" />}
            tooltip="Numbered List"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            isActive={editor.isActive('taskList')}
            icon={<CheckSquare className="w-4 h-4" />}
            tooltip="Task List"
          />
        </ToolbarGroup>

        <ToolbarDivider />

        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            icon={<Quote className="w-4 h-4" />}
            tooltip="Quote"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            icon={<Minus className="w-4 h-4" />}
            tooltip="Divider"
          />
          <ToolbarButton
            onClick={setLink}
            isActive={editor.isActive('link')}
            icon={<Link2 className="w-4 h-4" />}
            tooltip="Link"
          />
          <ToolbarButton
            onClick={addImage}
            icon={<ImageIcon className="w-4 h-4" />}
            tooltip="Image"
          />
          <ToolbarButton
            onClick={insertTable}
            icon={<TableIcon className="w-4 h-4" />}
            tooltip="Table"
          />
        </ToolbarGroup>

        <div className="flex-1" />

        <span className="text-xs text-gray-500 mr-2">
          {wordCount} words
        </span>
      </div>

      {/* Bubble Menu for selection */}
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="flex items-center gap-1 p-1 bg-lattice-surface border border-lattice-border rounded-lg shadow-xl"
        >
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            icon={<Bold className="w-3.5 h-3.5" />}
            size="sm"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            icon={<Italic className="w-3.5 h-3.5" />}
            size="sm"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            isActive={editor.isActive('highlight')}
            icon={<Highlighter className="w-3.5 h-3.5" />}
            size="sm"
          />
          <ToolbarButton
            onClick={setLink}
            isActive={editor.isActive('link')}
            icon={<Link2 className="w-3.5 h-3.5" />}
            size="sm"
          />
        </BubbleMenu>
      )}

      {/* Floating Menu for empty lines */}
      {editor && (
        <FloatingMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="flex items-center gap-1 p-1 bg-lattice-surface border border-lattice-border rounded-lg shadow-xl"
        >
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            icon={<Heading1 className="w-3.5 h-3.5" />}
            size="sm"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            icon={<List className="w-3.5 h-3.5" />}
            size="sm"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            icon={<CheckSquare className="w-3.5 h-3.5" />}
            size="sm"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            icon={<Quote className="w-3.5 h-3.5" />}
            size="sm"
          />
        </FloatingMenu>
      )}

      {/* Editor Content */}
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// Toolbar components
function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-lattice-border mx-1" />;
}

interface ToolbarButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  isActive?: boolean;
  disabled?: boolean;
  tooltip?: string;
  size?: 'sm' | 'md';
}

function ToolbarButton({
  onClick,
  icon,
  isActive,
  disabled,
  tooltip,
  size = 'md'
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={cn(
        'rounded transition-colors',
        size === 'sm' ? 'p-1.5' : 'p-2',
        isActive
          ? 'bg-neon-cyan/20 text-neon-cyan'
          : 'text-gray-400 hover:text-white hover:bg-lattice-surface',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {icon}
    </button>
  );
}

// Slash command menu component
export function SlashCommandMenu({
  editor: _editor,
  items,
  onSelect
}: {
  editor: unknown;
  items: Array<{ icon: React.ElementType; label: string; description: string; command: () => void }>;
  onSelect: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        items[selectedIndex].command();
        onSelect();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedIndex, onSelect]);

  return (
    <div className="w-72 bg-lattice-surface border border-lattice-border rounded-lg shadow-xl overflow-hidden">
      <div className="p-2 border-b border-lattice-border">
        <p className="text-xs text-gray-400">Insert block</p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => {
                item.command();
                onSelect();
              }}
              className={cn(
                'w-full flex items-center gap-3 p-2 text-left transition-colors',
                index === selectedIndex
                  ? 'bg-neon-cyan/20 text-white'
                  : 'text-gray-300 hover:bg-lattice-surface'
              )}
            >
              <div className="p-1.5 rounded bg-lattice-border/50">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-gray-500">{item.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default BlockEditor;
