/**
 * useTabSystem — Shared tab management hook
 *
 * Eliminates the repeated pattern of activeTab/MODE_TABS/currentType
 * found across lenses with multi-tab architecture (accounting, education,
 * legal, nonprofit, reasoning).
 *
 * Usage:
 *   const tabs = useTabSystem({
 *     tabs: [
 *       { id: 'Students', icon: Users, artifactType: 'Student' },
 *       { id: 'Courses', icon: BookOpen, artifactType: 'Course' },
 *     ],
 *     defaultTab: 'Students',
 *   });
 *
 *   tabs.activeTab    // 'Students'
 *   tabs.currentType  // 'Student'
 *   tabs.setActiveTab('Courses')
 */

import { useState, useMemo, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface TabDefinition {
  id: string;
  icon: LucideIcon;
  artifactType: string;
  label?: string;
}

interface TabSystemOptions {
  tabs: TabDefinition[];
  defaultTab?: string;
}

export function useTabSystem(options: TabSystemOptions) {
  const { tabs, defaultTab } = options;
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  const currentTab = useMemo(
    () => tabs.find(t => t.id === activeTab) || tabs[0],
    [tabs, activeTab]
  );

  const currentType = currentTab?.artifactType || '';

  const switchTab = useCallback((tabId: string) => {
    setActiveTab(tabId);
  }, []);

  return {
    tabs,
    activeTab,
    setActiveTab: switchTab,
    currentTab,
    currentType,
  };
}
