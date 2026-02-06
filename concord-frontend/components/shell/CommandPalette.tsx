'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';
import { getCommandPaletteLenses, LENS_CATEGORIES, type LensCategory } from '@/lib/lens-registry';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Command {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

const paletteLenses = getCommandPaletteLenses();

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const commands: Command[] = useMemo(() => {
    // Navigation commands from the lens registry
    const navCommands: Command[] = paletteLenses.map((lens) => {
      const Icon = lens.icon;
      return {
        id: `nav-${lens.id}`,
        name: `Go to ${lens.name}`,
        description: lens.description,
        icon: <Icon className="w-4 h-4" />,
        action: () => router.push(lens.path),
        category: LENS_CATEGORIES[lens.category as LensCategory]?.label || lens.category,
      };
    });

    // Action commands
    const actionCommands: Command[] = [
      {
        id: 'nav-dashboard',
        name: 'Go to Dashboard',
        description: 'Return to the main dashboard',
        icon: <ArrowRight className="w-4 h-4" />,
        action: () => router.push('/'),
        category: 'Action',
      },
      {
        id: 'action-new-dtu',
        name: 'Create New DTU',
        description: 'Start a new thought unit',
        icon: <ArrowRight className="w-4 h-4" />,
        action: () => router.push('/lenses/chat?new=true'),
        category: 'Action',
      },
    ];

    return [...actionCommands, ...navCommands];
  }, [router]);

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
          setQuery('');
        }
        break;
      case 'Escape':
        onClose();
        setQuery('');
        break;
    }
  };

  if (!isOpen) return null;

  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-lattice-surface border border-lattice-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-lattice-border">
          <Search className="w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search lenses, commands..."
            className="flex-1 bg-transparent text-white placeholder:text-gray-500 outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={filteredCommands[selectedIndex]?.id}
          />
          <kbd className="px-2 py-1 text-xs bg-lattice-elevated rounded text-gray-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} id="command-list" role="listbox" className="max-h-80 overflow-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="p-2">
              {Object.entries(groupedCommands).map(([category, cmds]) => {
                const section = (
                  <div key={category} className="mb-2">
                    <p className="px-2 py-1 text-xs text-gray-500 uppercase">
                      {category}
                    </p>
                    {cmds.map((cmd) => {
                      const index = runningIndex++;
                      const isSelected = index === selectedIndex;
                      return (
                        <button
                          key={cmd.id}
                          id={cmd.id}
                          role="option"
                          aria-selected={isSelected}
                          data-selected={isSelected}
                          onClick={() => {
                            cmd.action();
                            onClose();
                            setQuery('');
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-neon-blue/20 text-neon-blue'
                              : 'text-gray-300 hover:bg-lattice-elevated'
                          }`}
                        >
                          <span className="text-gray-400">{cmd.icon}</span>
                          <div className="flex-1 text-left">
                            <p className="font-medium">{cmd.name}</p>
                            <p className="text-xs text-gray-500">{cmd.description}</p>
                          </div>
                          {isSelected && (
                            <kbd className="px-2 py-1 text-xs bg-neon-blue/20 rounded">
                              Enter
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
                return section;
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-lattice-border flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>&uarr;&darr; Navigate</span>
            <span>&crarr; Select</span>
            <span>ESC Close</span>
          </div>
          <span>{filteredCommands.length} results</span>
        </div>
      </div>
    </div>
  );
}
