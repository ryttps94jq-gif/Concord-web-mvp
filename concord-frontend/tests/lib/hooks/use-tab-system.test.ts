import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTabSystem } from '@/lib/hooks/use-tab-system';

// Mock LucideIcon as simple functions
const MockIcon1 = () => null;
const MockIcon2 = () => null;
const MockIcon3 = () => null;

const testTabs = [
  { id: 'Students', icon: MockIcon1 as never, artifactType: 'Student', label: 'Students' },
  { id: 'Courses', icon: MockIcon2 as never, artifactType: 'Course', label: 'Courses' },
  { id: 'Grades', icon: MockIcon3 as never, artifactType: 'Grade', label: 'Grades' },
];

describe('useTabSystem', () => {
  describe('initialization', () => {
    it('defaults to first tab when no defaultTab', () => {
      const { result } = renderHook(() =>
        useTabSystem({ tabs: testTabs })
      );

      expect(result.current.activeTab).toBe('Students');
      expect(result.current.currentType).toBe('Student');
    });

    it('uses defaultTab when provided', () => {
      const { result } = renderHook(() =>
        useTabSystem({ tabs: testTabs, defaultTab: 'Courses' })
      );

      expect(result.current.activeTab).toBe('Courses');
      expect(result.current.currentType).toBe('Course');
    });

    it('returns empty string for activeTab when tabs is empty and no default', () => {
      const { result } = renderHook(() =>
        useTabSystem({ tabs: [] })
      );

      expect(result.current.activeTab).toBe('');
      expect(result.current.currentType).toBe('');
    });
  });

  describe('tabs property', () => {
    it('returns the provided tabs', () => {
      const { result } = renderHook(() =>
        useTabSystem({ tabs: testTabs })
      );

      expect(result.current.tabs).toEqual(testTabs);
      expect(result.current.tabs).toHaveLength(3);
    });
  });

  describe('currentTab', () => {
    it('returns the full tab definition for the active tab', () => {
      const { result } = renderHook(() =>
        useTabSystem({ tabs: testTabs })
      );

      expect(result.current.currentTab).toEqual(testTabs[0]);
      expect(result.current.currentTab?.id).toBe('Students');
      expect(result.current.currentTab?.artifactType).toBe('Student');
    });

    it('falls back to first tab when active tab does not exist', () => {
      const { result } = renderHook(() =>
        useTabSystem({ tabs: testTabs, defaultTab: 'Nonexistent' })
      );

      // Falls back to first tab
      expect(result.current.currentTab).toEqual(testTabs[0]);
    });
  });

  describe('currentType', () => {
    it('returns the artifactType of the current tab', () => {
      const { result } = renderHook(() =>
        useTabSystem({ tabs: testTabs, defaultTab: 'Grades' })
      );

      expect(result.current.currentType).toBe('Grade');
    });
  });

  describe('setActiveTab', () => {
    it('switches to a different tab', () => {
      const { result } = renderHook(() =>
        useTabSystem({ tabs: testTabs })
      );

      expect(result.current.activeTab).toBe('Students');

      act(() => {
        result.current.setActiveTab('Courses');
      });

      expect(result.current.activeTab).toBe('Courses');
      expect(result.current.currentType).toBe('Course');
      expect(result.current.currentTab?.id).toBe('Courses');
    });

    it('switches through all tabs', () => {
      const { result } = renderHook(() =>
        useTabSystem({ tabs: testTabs })
      );

      for (const tab of testTabs) {
        act(() => {
          result.current.setActiveTab(tab.id);
        });

        expect(result.current.activeTab).toBe(tab.id);
        expect(result.current.currentType).toBe(tab.artifactType);
      }
    });

    it('handles setting to non-existent tab id', () => {
      const { result } = renderHook(() =>
        useTabSystem({ tabs: testTabs })
      );

      act(() => {
        result.current.setActiveTab('Nonexistent');
      });

      // activeTab updates to 'Nonexistent', but currentTab falls back to first
      expect(result.current.activeTab).toBe('Nonexistent');
      expect(result.current.currentTab).toEqual(testTabs[0]);
    });
  });

  describe('re-rendering with new tabs', () => {
    it('maintains active tab across rerenders with same tabs', () => {
      const { result, rerender } = renderHook(
        ({ tabs }) => useTabSystem({ tabs }),
        { initialProps: { tabs: testTabs } }
      );

      act(() => {
        result.current.setActiveTab('Grades');
      });

      rerender({ tabs: testTabs });

      expect(result.current.activeTab).toBe('Grades');
    });
  });
});
