'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/store/ui';
import {
  MessageSquare, MessageCircle, Code, FlaskConical, Store, FileText,
  Book, Layout, Calendar, Share2, Sparkles, Target, Activity, Users,
  User, Dna, Atom, Orbit, DollarSign, Gamepad2, Glasses, Newspaper,
  Music, Brain, Wand2, Home, ChevronLeft, ChevronRight
} from 'lucide-react';

const lenses = [
  { id: 'dashboard', name: 'Dashboard', icon: Home, path: '/' },
  { id: 'chat', name: 'Chat', icon: MessageSquare, path: '/lenses/chat' },
  { id: 'thread', name: 'Thread', icon: MessageCircle, path: '/lenses/thread' },
  { id: 'code', name: 'Code', icon: Code, path: '/lenses/code' },
  { id: 'lab', name: 'Lab', icon: FlaskConical, path: '/lenses/lab' },
  { id: 'market', name: 'Market', icon: Store, path: '/lenses/market' },
  { id: 'paper', name: 'Paper', icon: FileText, path: '/lenses/paper' },
  { id: 'docs', name: 'Docs', icon: Book, path: '/lenses/docs' },
  { id: 'board', name: 'Board', icon: Layout, path: '/lenses/board' },
  { id: 'calendar', name: 'Calendar', icon: Calendar, path: '/lenses/calendar' },
  { id: 'graph', name: 'Graph', icon: Share2, path: '/lenses/graph' },
  { id: 'fractal', name: 'Fractal', icon: Sparkles, path: '/lenses/fractal' },
  { id: 'questmarket', name: 'Questmarket', icon: Target, path: '/lenses/questmarket' },
  { id: 'resonance', name: 'Resonance', icon: Activity, path: '/lenses/resonance' },
  { id: 'council', name: 'Council', icon: Users, path: '/lenses/council' },
  { id: 'anon', name: 'Anon', icon: User, path: '/lenses/anon' },
  { id: 'bio', name: 'Bio', icon: Dna, path: '/lenses/bio' },
  { id: 'chem', name: 'Chem', icon: Atom, path: '/lenses/chem' },
  { id: 'physics', name: 'Physics', icon: Orbit, path: '/lenses/physics' },
  { id: 'finance', name: 'Finance', icon: DollarSign, path: '/lenses/finance' },
  { id: 'game', name: 'Game', icon: Gamepad2, path: '/lenses/game' },
  { id: 'ar', name: 'AR', icon: Glasses, path: '/lenses/ar' },
  { id: 'news', name: 'News', icon: Newspaper, path: '/lenses/news' },
  { id: 'music', name: 'Music', icon: Music, path: '/lenses/music' },
  { id: 'ml', name: 'ML', icon: Brain, path: '/lenses/ml' },
  { id: 'custom', name: 'Custom', icon: Wand2, path: '/lenses/custom' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-lattice-surface border-r border-lattice-border z-40 transition-all duration-300 flex flex-col ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-lattice-border">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧠</span>
            <span className="font-bold text-gradient-neon">Concord</span>
          </div>
        )}
        {sidebarCollapsed && <span className="text-2xl mx-auto">🧠</span>}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-1.5 rounded-lg hover:bg-lattice-elevated text-gray-400 hover:text-white transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 no-scrollbar">
        <div className="space-y-1">
          {lenses.map((lens) => {
            const Icon = lens.icon;
            const isActive = pathname === lens.path;

            return (
              <Link
                key={lens.id}
                href={lens.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-neon-blue/20 text-neon-blue'
                    : 'text-gray-400 hover:bg-lattice-elevated hover:text-white'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? lens.name : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium truncate">{lens.name}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-lattice-border">
        {!sidebarCollapsed ? (
          <div className="text-xs text-gray-500">
            <p>Concord OS v2.3</p>
            <p className="text-neon-green">70% Sovereign</p>
          </div>
        ) : (
          <div className="text-center">
            <span className="text-xs text-neon-green">70%</span>
          </div>
        )}
      </div>
    </aside>
  );
}
