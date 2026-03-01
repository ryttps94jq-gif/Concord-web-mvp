'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  Heart,
  MessageCircle,
  UserPlus,
  Quote,
  Coins,
  Megaphone,
  Check,
  CheckCheck,
  Trash2,
  X,
  ChevronRight,
  Settings,
  Filter,
  Loader2,
  Eye,
  EyeOff,
  Music,
  Video,
  FileText,
  Star,
  AlertCircle,
} from 'lucide-react';
import { cn, formatRelativeTime, formatNumber } from '@/lib/utils';
import { api } from '@/lib/api/client';

// ── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | 'follow'
  | 'like'
  | 'comment'
  | 'citation'
  | 'tip'
  | 'mention'
  | 'system'
  | 'achievement'
  | 'content_update';

type NotificationFilter = 'all' | 'unread' | NotificationType;

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetTitle?: string;
  amount?: number;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface NotificationCenterProps {
  userId: string;
  isOpen?: boolean;
  onClose?: () => void;
  onNavigateToUser?: (userId: string) => void;
  onNavigateToContent?: (contentId: string) => void;
  mode?: 'panel' | 'dropdown';
  className?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const NOTIFICATION_CONFIG: Record<NotificationType, {
  icon: typeof Bell;
  color: string;
  bgColor: string;
}> = {
  follow: {
    icon: UserPlus,
    color: 'text-neon-cyan',
    bgColor: 'bg-neon-cyan/10',
  },
  like: {
    icon: Heart,
    color: 'text-neon-pink',
    bgColor: 'bg-neon-pink/10',
  },
  comment: {
    icon: MessageCircle,
    color: 'text-neon-blue',
    bgColor: 'bg-neon-blue/10',
  },
  citation: {
    icon: Quote,
    color: 'text-neon-purple',
    bgColor: 'bg-neon-purple/10',
  },
  tip: {
    icon: Coins,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  mention: {
    icon: Star,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
  },
  system: {
    icon: Megaphone,
    color: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
  },
  achievement: {
    icon: Star,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  content_update: {
    icon: AlertCircle,
    color: 'text-neon-blue',
    bgColor: 'bg-neon-blue/10',
  },
};

const FILTER_OPTIONS: Array<{ id: NotificationFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'follow', label: 'Follows' },
  { id: 'like', label: 'Likes' },
  { id: 'comment', label: 'Comments' },
  { id: 'citation', label: 'Citations' },
  { id: 'tip', label: 'Tips' },
  { id: 'system', label: 'System' },
];

// ── Mock data generator (used when API doesn't have notifications yet) ───────

function generateMockNotifications(): Notification[] {
  const now = Date.now();
  return [
    {
      id: 'notif-1',
      type: 'follow',
      title: 'New Follower',
      message: 'started following you',
      actorId: 'user-alice',
      actorName: 'Alice Chen',
      read: false,
      createdAt: new Date(now - 1000 * 60 * 5).toISOString(),
    },
    {
      id: 'notif-2',
      type: 'like',
      title: 'Content Liked',
      message: 'liked your DTU',
      actorId: 'user-bob',
      actorName: 'Bob Martinez',
      targetId: 'dtu-123',
      targetTitle: 'Neural Architecture Overview',
      read: false,
      createdAt: new Date(now - 1000 * 60 * 30).toISOString(),
    },
    {
      id: 'notif-3',
      type: 'comment',
      title: 'New Comment',
      message: 'commented on your media',
      actorId: 'user-carol',
      actorName: 'Carol Wu',
      targetId: 'media-456',
      targetTitle: 'Audio Track: Emergence',
      read: true,
      createdAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: 'notif-4',
      type: 'citation',
      title: 'DTU Cited',
      message: 'cited your DTU in their research',
      actorId: 'user-dave',
      actorName: 'Dave Kim',
      targetId: 'dtu-789',
      targetTitle: 'Lattice Theory Fundamentals',
      read: true,
      createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: 'notif-5',
      type: 'tip',
      title: 'Tip Received',
      message: 'sent you a tip',
      actorId: 'user-eve',
      actorName: 'Eve Johnson',
      targetId: 'dtu-101',
      targetTitle: 'Creative Synthesis',
      amount: 25,
      read: false,
      createdAt: new Date(now - 1000 * 60 * 60 * 12).toISOString(),
    },
    {
      id: 'notif-6',
      type: 'system',
      title: 'System Update',
      message: 'Media transcoding infrastructure updated. Faster processing now available.',
      read: true,
      createdAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: 'notif-7',
      type: 'achievement',
      title: 'Achievement Unlocked',
      message: 'You reached 100 citations across your published DTUs!',
      read: false,
      createdAt: new Date(now - 1000 * 60 * 60 * 48).toISOString(),
    },
  ];
}

// ── Single Notification Item ─────────────────────────────────────────────────

function NotificationItem({
  notification,
  onMarkRead,
  onNavigateToUser,
  onNavigateToContent,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onNavigateToUser?: (userId: string) => void;
  onNavigateToContent?: (contentId: string) => void;
}) {
  const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.system;
  const Icon = config.icon;

  const handleClick = useCallback(() => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    if (notification.targetId) {
      onNavigateToContent?.(notification.targetId);
    } else if (notification.actorId) {
      onNavigateToUser?.(notification.actorId);
    }
  }, [notification, onMarkRead, onNavigateToUser, onNavigateToContent]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10, height: 0 }}
      layout
      onClick={handleClick}
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-lattice-border/50 last:border-b-0',
        notification.read
          ? 'hover:bg-lattice-deep/50'
          : 'bg-neon-cyan/[0.02] hover:bg-neon-cyan/[0.05]'
      )}
    >
      {/* Icon */}
      <div className={cn('p-2 rounded-lg flex-shrink-0 mt-0.5', config.bgColor)}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Actor + action */}
            <p className="text-sm">
              {notification.actorName && (
                <button
                  onClick={e => { e.stopPropagation(); onNavigateToUser?.(notification.actorId!); }}
                  className="font-medium text-white hover:text-neon-cyan transition-colors"
                >
                  {notification.actorName}
                </button>
              )}
              {notification.actorName && ' '}
              <span className="text-gray-400">{notification.message}</span>
            </p>

            {/* Target */}
            {notification.targetTitle && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {notification.targetTitle}
              </p>
            )}

            {/* Tip amount */}
            {notification.type === 'tip' && notification.amount && (
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 text-xs font-medium">
                <Coins className="w-3 h-3" />
                {notification.amount} coins
              </span>
            )}

            {/* System messages show full text */}
            {(notification.type === 'system' || notification.type === 'achievement') && !notification.actorName && (
              <p className="text-sm text-gray-300 mt-0.5">{notification.message}</p>
            )}
          </div>

          {/* Unread indicator */}
          {!notification.read && (
            <div className="w-2 h-2 rounded-full bg-neon-cyan flex-shrink-0 mt-2" />
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs text-gray-600 mt-1">{formatRelativeTime(notification.createdAt)}</p>
      </div>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function NotificationCenter({
  userId,
  isOpen = true,
  onClose,
  onNavigateToUser,
  onNavigateToContent,
  mode = 'panel',
  className,
}: NotificationCenterProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────

  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      try {
        const res = await api.get('/api/social/notifications', {
          params: { userId, limit: 50 },
        });
        return (res.data.notifications || []) as Notification[];
      } catch {
        // Fallback to mock data if API doesn't exist yet
        return generateMockNotifications();
      }
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const notifications = notificationsQuery.data || [];

  // ── Filtering ────────────────────────────────────────────────────────

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read);
    return notifications.filter(n => n.type === filter);
  }, [notifications, filter]);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  // ── Mutations ────────────────────────────────────────────────────────

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      try {
        await api.post(`/api/social/notifications/${notificationId}/read`, { userId });
      } catch {
        // Optimistically handle if API doesn't exist
      }
    },
    onMutate: async (notificationId: string) => {
      // Optimistic update
      queryClient.setQueryData(['notifications', userId], (old: Notification[] | undefined) => {
        if (!old) return [];
        return old.map(n => n.id === notificationId ? { ...n, read: true } : n);
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      try {
        await api.post('/api/social/notifications/read-all', { userId });
      } catch {
        // Optimistically handle if API doesn't exist
      }
    },
    onMutate: async () => {
      queryClient.setQueryData(['notifications', userId], (old: Notification[] | undefined) => {
        if (!old) return [];
        return old.map(n => ({ ...n, read: true }));
      });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      try {
        await api.delete('/api/social/notifications', { data: { userId } });
      } catch {
        // Optimistically handle
      }
    },
    onMutate: async () => {
      queryClient.setQueryData(['notifications', userId], []);
    },
  });

  const handleMarkRead = useCallback((id: string) => {
    markReadMutation.mutate(id);
  }, [markReadMutation]);

  // ── Render ───────────────────────────────────────────────────────────

  const content = (
    <div className={cn(
      'flex flex-col',
      mode === 'dropdown' ? 'max-h-[480px]' : 'h-full',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-lattice-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-neon-cyan" />
          <h2 className="text-white font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-neon-cyan/20 text-neon-cyan text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="p-1.5 text-gray-400 hover:text-neon-cyan rounded-lg transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              showFilters ? 'text-neon-cyan bg-neon-cyan/10' : 'text-gray-400 hover:text-white'
            )}
            title="Filter notifications"
          >
            <Filter className="w-4 h-4" />
          </button>
          {notifications.length > 0 && (
            <button
              onClick={() => clearAllMutation.mutate()}
              className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
              title="Clear all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-lattice-border flex-shrink-0"
          >
            <div className="flex flex-wrap gap-1.5 px-4 py-2">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFilter(opt.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                    filter === opt.id
                      ? 'bg-neon-cyan/10 text-neon-cyan border-neon-cyan/30'
                      : 'text-gray-400 border-transparent hover:text-white hover:bg-lattice-deep'
                  )}
                >
                  {opt.label}
                  {opt.id === 'unread' && unreadCount > 0 && (
                    <span className="ml-1 text-neon-cyan">({unreadCount})</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto">
        {notificationsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-neon-cyan animate-spin" />
          </div>
        ) : filteredNotifications.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {filteredNotifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onNavigateToUser={onNavigateToUser}
                onNavigateToContent={onNavigateToContent}
              />
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <BellOff className="w-10 h-10 text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm font-medium">
              {filter === 'unread' ? 'All caught up!' : 'No notifications'}
            </p>
            <p className="text-gray-500 text-xs mt-1 text-center">
              {filter === 'unread'
                ? 'You have no unread notifications.'
                : filter === 'all'
                  ? 'Notifications will appear here when you receive them.'
                  : `No ${filter} notifications.`}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {filteredNotifications.length > 0 && mode === 'dropdown' && (
        <div className="border-t border-lattice-border px-4 py-2 flex-shrink-0">
          <button className="w-full text-center text-sm text-neon-cyan hover:text-neon-cyan/80 transition-colors py-1">
            View all notifications
          </button>
        </div>
      )}
    </div>
  );

  // For dropdown mode, wrap in positioned container
  if (mode === 'dropdown') {
    if (!isOpen) return null;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="absolute right-0 top-full mt-2 w-[400px] bg-lattice-surface border border-lattice-border rounded-xl shadow-2xl shadow-black/30 z-50 overflow-hidden"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Panel mode
  return (
    <div className={cn(
      'bg-lattice-surface border border-lattice-border rounded-xl overflow-hidden',
      className
    )}>
      {content}
    </div>
  );
}

// ── Notification Bell Button (for use in navbars) ────────────────────────────

interface NotificationBellProps {
  userId: string;
  onNavigateToUser?: (userId: string) => void;
  onNavigateToContent?: (contentId: string) => void;
  className?: string;
}

export function NotificationBell({
  userId,
  onNavigateToUser,
  onNavigateToContent,
  className,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      try {
        const res = await api.get('/api/social/notifications', {
          params: { userId, limit: 50 },
        });
        return (res.data.notifications || []) as Notification[];
      } catch {
        return generateMockNotifications();
      }
    },
    refetchInterval: 30000,
  });

  const unreadCount = useMemo(
    () => (notificationsQuery.data || []).filter((n: Notification) => !n.read).length,
    [notificationsQuery.data]
  );

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'relative p-2 rounded-lg transition-colors',
          isOpen ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-gray-400 hover:text-white hover:bg-lattice-deep'
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-neon-pink text-[10px] text-white font-bold flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <NotificationCenter
        userId={userId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onNavigateToUser={onNavigateToUser}
        onNavigateToContent={onNavigateToContent}
        mode="dropdown"
      />

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export default NotificationCenter;
