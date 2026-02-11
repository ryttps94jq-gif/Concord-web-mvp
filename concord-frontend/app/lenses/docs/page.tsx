'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useState } from 'react';
import { Book, ChevronRight, Search } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

export default function DocsLensPage() {
  useLensNav('docs');

  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: docs, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['documentation'],
    queryFn: () => api.get('/api/docs').then((r) => r.data),
  });

  const sections = [
    { id: 'getting-started', name: 'Getting Started', icon: '🚀' },
    { id: 'dtus', name: 'DTU System', icon: '💭' },
    { id: 'growth-os', name: 'Growth OS', icon: '🌱' },
    { id: 'lenses', name: 'Lenses', icon: '🔮' },
    { id: 'sovereignty', name: 'Sovereignty', icon: '🔒' },
    { id: 'api', name: 'API Reference', icon: '⚡' },
    { id: 'chicken', name: 'Chicken Governance', icon: '🐔' },
    { id: 'market', name: 'Market & Economy', icon: '💰' },
  ];


  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📚</span>
          <div>
            <h1 className="text-xl font-bold">Docs Lens</h1>
            <p className="text-sm text-gray-400">
              Concord system documentation and guides
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="panel p-4 space-y-2">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search docs..."
              className="input-lattice pl-10 text-sm"
            />
          </div>

          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setSelectedSection(section.id)}
              className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                selectedSection === section.id
                  ? 'bg-neon-blue/20 text-neon-blue'
                  : 'hover:bg-lattice-elevated text-gray-300'
              }`}
            >
              <span>{section.icon}</span>
              <span className="flex-1">{section.name}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 panel p-6">
          {selectedSection ? (
            <div className="prose prose-invert max-w-none">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Book className="w-5 h-5 text-neon-blue" />
                {sections.find((s) => s.id === selectedSection)?.name}
              </h2>
              <div className="text-gray-300 space-y-4">
                {docs?.sections?.[selectedSection] || (
                  <p className="text-gray-500">
                    Documentation for this section is being written...
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Book className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Welcome to Concord Docs</h2>
              <p className="text-gray-400 mb-6">
                Select a section from the sidebar to get started
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {sections.slice(0, 4).map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSection(section.id)}
                    className="lens-card text-center"
                  >
                    <span className="text-2xl">{section.icon}</span>
                    <p className="text-sm mt-2">{section.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
