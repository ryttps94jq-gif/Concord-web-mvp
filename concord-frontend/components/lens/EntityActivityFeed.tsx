'use client';

/**
 * EntityActivityFeed — Shows entity activity within a specific lens domain.
 * Displays entity exploration, production, and growth events.
 * Can be embedded in any lens page to show what entities are doing.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { ds } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import { Bot, Zap, Eye, FileText, TrendingUp } from 'lucide-react';

interface EntityActivityFeedProps {
  domain: string;
  limit?: number;
  compact?: boolean;
  className?: string;
}

interface EntityEvent {
  id?: string;
  type?: string;
  entityId?: string;
  action?: string;
  domain?: string;
  message?: string;
  summary?: string;
  timestamp?: string;
  created_at?: string;
  meta?: Record<string, unknown>;
}

const EVENT_ICONS: Record<string, typeof Bot> = {
  'entity-explore': Eye,
  'entity-produce': FileText,
  'entity-growth': TrendingUp,
  'lens-production': Zap,
};

function getEventIcon(type: string) {
  for (const [key, Icon] of Object.entries(EVENT_ICONS)) {
    if (type.includes(key)) return Icon;
  }
  return Bot;
}

export function EntityActivityFeed({ domain, limit = 20, compact = false, className }: EntityActivityFeedProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['entity-activity', domain],
    queryFn: () =>
      api.get('/api/events/paginated', {
        params: { domain, type: 'entity', limit },
      }).then(r => r.data),
    refetchInterval: 30000,
    retry: false,
  });

  const events: EntityEvent[] = (data?.events || data?.items || []).filter(
    (e: EntityEvent) => e.domain === domain || !e.domain
  );

  if (isLoading) {
    return (
      <div className={cn('p-4 text-center text-gray-500 text-sm', className)}>
        Loading entity activity...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn('p-4 text-center', className)}>
        <Bot className="w-6 h-6 mx-auto mb-2 text-gray-600" />
        <p className="text-gray-500 text-xs">No entity activity in this domain yet.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn('space-y-1', className)}>
        {events.slice(0, 5).map((event, i) => {
          const Icon = getEventIcon(event.type || '');
          return (
            <div key={event.id || i} className="flex items-center gap-2 text-xs text-gray-400 py-1">
              <Icon className="w-3 h-3 text-neon-cyan flex-shrink-0" />
              <span className="truncate">{event.message || event.summary || event.type}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
        <Bot className="w-4 h-4 text-neon-cyan" />
        Entity Activity
        <span className="text-xs text-gray-500">({events.length})</span>
      </h3>

      <div className="space-y-2">
        {events.map((event, i) => {
          const Icon = getEventIcon(event.type || '');
          const ts = event.timestamp || event.created_at;
          return (
            <div
              key={event.id || i}
              className={cn(ds.panel, 'p-3 flex items-start gap-3')}
            >
              <div className="w-7 h-7 rounded-full bg-neon-cyan/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-neon-cyan" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-200 leading-relaxed">
                  {event.message || event.summary || event.type || 'Entity event'}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  {event.entityId && <span>Entity: {event.entityId.slice(0, 8)}</span>}
                  {event.action && <span>{event.action}</span>}
                  {ts && (
                    <span>
                      {new Date(ts).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
