'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/realtime/socket';

type PlatformEvent = {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
};

/**
 * Hook that subscribes to real-time platform events via Socket.io
 * and auto-invalidates relevant React Query caches.
 *
 * Events handled:
 *   - dtu:created / dtu:updated / dtu:deleted → invalidate ['dtus'], ['scope-dtus']
 *   - pipeline:completed → invalidate ['pipeline-metrics']
 *   - beacon:check → invalidate ['beacon-check']
 *   - heartbeat:tick → invalidate all periodic queries
 */
export function usePlatformEvents() {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<PlatformEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const listenerRef = useRef(false);

  const addEvent = useCallback((type: string, data: Record<string, unknown>) => {
    setEvents((prev) => [
      { type, data, timestamp: new Date().toISOString() },
      ...prev.slice(0, 49), // Keep last 50 events
    ]);
  }, []);

  useEffect(() => {
    if (listenerRef.current) return;
    listenerRef.current = true;

    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    if (!socket) return;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onDtuCreated = (data: Record<string, unknown>) => {
      addEvent('dtu:created', data);
      queryClient.invalidateQueries({ queryKey: ['dtus'] });
      queryClient.invalidateQueries({ queryKey: ['scope-dtus'] });
      queryClient.invalidateQueries({ queryKey: ['scope-metrics'] });
    };

    const onDtuUpdated = (data: Record<string, unknown>) => {
      addEvent('dtu:updated', data);
      queryClient.invalidateQueries({ queryKey: ['dtus'] });
    };

    const onDtuDeleted = (data: Record<string, unknown>) => {
      addEvent('dtu:deleted', data);
      queryClient.invalidateQueries({ queryKey: ['dtus'] });
      queryClient.invalidateQueries({ queryKey: ['scope-dtus'] });
    };

    const onPipelineCompleted = (data: Record<string, unknown>) => {
      addEvent('pipeline:completed', data);
      queryClient.invalidateQueries({ queryKey: ['pipeline-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-intent'] });
    };

    const onBeaconCheck = (data: Record<string, unknown>) => {
      addEvent('beacon:check', data);
      queryClient.invalidateQueries({ queryKey: ['beacon-check'] });
    };

    const onHeartbeatTick = (data: Record<string, unknown>) => {
      addEvent('heartbeat:tick', data);
      // Periodic refresh of key metrics
      queryClient.invalidateQueries({ queryKey: ['pipeline-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['beacon-check'] });
      queryClient.invalidateQueries({ queryKey: ['dedup-scan'] });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('dtu:created', onDtuCreated);
    socket.on('dtu:updated', onDtuUpdated);
    socket.on('dtu:deleted', onDtuDeleted);
    socket.on('pipeline:completed', onPipelineCompleted);
    socket.on('beacon:check', onBeaconCheck);
    socket.on('heartbeat:tick', onHeartbeatTick);

    // Check current connection state
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('dtu:created', onDtuCreated);
      socket.off('dtu:updated', onDtuUpdated);
      socket.off('dtu:deleted', onDtuDeleted);
      socket.off('pipeline:completed', onPipelineCompleted);
      socket.off('beacon:check', onBeaconCheck);
      socket.off('heartbeat:tick', onHeartbeatTick);
      listenerRef.current = false;
    };
  }, [queryClient, addEvent]);

  return { events, connected };
}
