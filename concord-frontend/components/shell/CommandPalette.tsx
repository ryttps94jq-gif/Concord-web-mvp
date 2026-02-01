'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MessageSquare, Code, Store, Activity, FileText, Book, ArrowRight } from 'lucide-react';

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
  category: 'navigation' | 'action' | 'search';
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: Command[] = [
    {
      id: 'nav-chat',
      name: 'Go to Chat',
      description: 'Open the Chat lens',
      icon: <MessageSquare className="w-4 h-4" />,
      action: () => router.push('/lenses/chat'),
      category: 'navigation',
    },
    {
      id: 'nav-code',
      name: 'Go to Code',
      description: 'Open the Code lens',
      icon: <Code className="w-4 h-4" />,
      action: () => router.push('/lenses/code'),
      category: 'navigation',
    },
    {
      id: 'nav-market',
      name: 'Go to Market',
      description: 'Open the Market lens',
      icon: <Store className="w-4 h-4" />,
      action: () => router.push('/lenses/market'),
      category: 'navigation',
    },
    {
      id: 'nav-resonance',
      name: 'Go to Resonance',
      description: 'View system health',
      icon: <Activity className="w-4 h-4" />,
      action: () => router.push('/lenses/resonance'),
      category: 'navigation',
    },
    {
      id: 'nav-paper',
      name: 'Go to Paper',
      description: 'Open research papers',
      icon: <FileText className="w-4 h-4" />,
      action: () => router.push('/lenses/paper'),
      category: 'navigation',
    },
    {
      id: 'nav-docs',
      name: 'Go to Docs',
      description: 'Open documentation',
      icon: <Book className="w-4 h-4" />,
      action: () => router.push('/lenses/docs'),
      category: 'navigation',
    },
    {
      id: 'action-new-dtu',
      name: 'Create New DTU',
      description: 'Start a new thought unit',
      icon: <ArrowRight className="w-4 h-4" />,
      action: () => router.push('/lenses/chat?new=true'),
      category: 'action',
    },
  ];

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl bg-lattice-surface border border-lattice-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-lattice-border">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, lenses, DTUs..."
            className="flex-1 bg-transparent text-white placeholder:text-gray-500 outline-none"
          />
          <kbd className="px-2 py-1 text-xs bg-lattice-elevated rounded text-gray-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No results found for "{query}"
            </div>
          ) : (
            <div className="p-2">
              {['navigation', 'action', 'search'].map((category) => {
                const categoryCommands = filteredCommands.filter(
                  (c) => c.category === category
                );
                if (categoryCommands.length === 0) return null;

                return (
                  <div key={category} className="mb-2">
                    <p className="px-2 py-1 text-xs text-gray-500 uppercase">
                      {category}
                    </p>
                    {categoryCommands.map((cmd) => {
                      const index = filteredCommands.indexOf(cmd);
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            cmd.action();
                            onClose();
                            setQuery('');
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            index === selectedIndex
                              ? 'bg-neon-blue/20 text-neon-blue'
                              : 'text-gray-300 hover:bg-lattice-elevated'
                          }`}
                        >
                          <span className="text-gray-400">{cmd.icon}</span>
                          <div className="flex-1 text-left">
                            <p className="font-medium">{cmd.name}</p>
                            <p className="text-xs text-gray-500">{cmd.description}</p>
                          </div>
                          {index === selectedIndex && (
                            <kbd className="px-2 py-1 text-xs bg-neon-blue/20 rounded">
                              Enter
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-lattice-border flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>Powered by Concord</span>
        </div>
      </div>
    </div>
  );
}
