// Common UI Components
export * from './common/Button';
export * from './common/Modal';
export * from './common/Loading';
export * from './common/Toasts';
export * from './common/Skeleton';
export * from './common/EmptyState';
export * from './common/OfflineIndicator';

// Editor Components
export * from './editor/BlockEditor';
// Note: SlashCommands exports are included via BlockEditor to avoid duplicate export conflict
export * from './editor/BacklinksPanel';

// Capture Components
export * from './capture/QuickCapture';

// Search Components
export * from './search/GlobalSearch';

// Layout Components
export * from './layout/SplitPane';
export * from './layout/FocusMode';

// Graph Components
export * from './graphs/ResonanceEmpireGraph';
export * from './graphs/FractalEmpireExplorer';
export * from './graphs/InteractiveGraph';
export * from './graphs/KnowledgeSpace3D';

// Cognitive Components
export * from './cognitive/ThoughtStream';
export * from './cognitive/LineageTree';

// AI Components
export * from './ai/AIAssistPanel';
export * from './ai/InlineCompletion';

// Social Components
export * from './social/PresenceIndicator';

// Gamification Components
export * from './gamification/Achievements';

// Whiteboard Components
// ExcalidrawWrapper removed - whiteboard page uses custom canvas implementation

// List Components
export * from './lists/VirtualDTUList';

// Shell Components
export * from './shell/AppShell';
export * from './shell/Sidebar';
export * from './shell/Topbar';
export * from './shell/CommandPalette';

// Onboarding Components
export * from './onboarding/OnboardingWizard';

// Versioning Components
export * from './versioning/VersionHistory';

// SRS (Spaced Repetition) Components
export * from './srs/SRSReview';

// Collaboration Components
export * from './collaboration/CommentThread';

// Database Components
export * from './database/DatabaseTable';

// Daily Notes Components
export * from './daily/DailyNotes';

// Calendar Components
export * from './calendar/CalendarView';

// Kanban Components
export * from './kanban/KanbanBoard';

// Voice Components
export * from './voice/VoiceRecorder';

// Admin Components
export * from './admin/AdminDashboard';

// Feed Components
export * from './feeds/RSSFeedManager';

// Reminder Components
export * from './reminders/ReminderList';

// Theme Components
export * from './themes/ThemeSelector';

// Platform Components (v5.5.0)
export { default as PipelineMonitor } from './platform/PipelineMonitor';
export { default as NerveCenter } from './platform/NerveCenter';
export { default as EmpiricalGatesPanel } from './platform/EmpiricalGatesPanel';
export { default as ScopeControls, ScopeBadge } from './platform/ScopeControls';
export { usePlatformEvents } from './platform/usePlatformEvents';
