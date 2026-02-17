'use client';

/**
 * CoreLensNav — Sub-tab navigation bar for core lenses.
 *
 * Renders a horizontal tab bar showing the core lens as the primary tab
 * and its absorbed lenses as secondary tabs. Clicking a tab navigates
 * to that lens's route while keeping the user within the core workspace.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  getAbsorbedLenses,
  getCoreLensConfig,
  type CoreLensId,
} from '@/lib/lens-registry';
import { cn } from '@/lib/utils';

interface CoreLensNavProps {
  /** Which core lens this nav belongs to */
  coreLensId: CoreLensId;
}

export function CoreLensNav({ coreLensId }: CoreLensNavProps) {
  const pathname = usePathname();
  const config = getCoreLensConfig(coreLensId);
  const absorbed = getAbsorbedLenses(coreLensId);

  if (!config || absorbed.length === 0) return null;

  const CoreIcon = config.icon;

  const tabs = [
    { id: config.id, label: config.name, path: config.path, icon: CoreIcon },
    ...absorbed.map((lens) => ({
      id: lens.id,
      label: lens.tabLabel || lens.name,
      path: lens.path,
      icon: lens.icon,
    })),
  ];

  return (
    <nav
      className="flex gap-1 border-b border-lattice-border px-4 overflow-x-auto no-scrollbar"
      aria-label={`${config.name} workspace navigation`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.path;
        return (
          <Link
            key={tab.id}
            href={tab.path}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              isActive
                ? `text-${config.color} border-${config.color}`
                : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
