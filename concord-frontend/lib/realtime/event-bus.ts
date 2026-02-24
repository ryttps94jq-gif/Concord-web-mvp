/**
 * Frontend Event Bus — bridges socket events to React components.
 *
 * Any component can subscribe to any event without direct socket access.
 * The useSocket hook forwards ALL socket events here so the event bus
 * becomes the single fan-out point for real-time data.
 */

import { useEffect, useRef } from 'react';

type Listener = (data: unknown) => void;

const listeners = new Map<string, Set<Listener>>();

/** Subscribe to an event. Returns unsubscribe function. */
export function onEvent(event: string, listener: Listener): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(listener);
  return () => {
    listeners.get(event)?.delete(listener);
    if (listeners.get(event)?.size === 0) listeners.delete(event);
  };
}

/** Emit an event to all subscribers. */
export function emitEvent(event: string, data: unknown): void {
  listeners.get(event)?.forEach((fn) => {
    try {
      fn(data);
    } catch (e) {
      console.error(`[EventBus] Error in listener for ${event}:`, e);
    }
  });
}

/** Get count of active listeners (for debugging). */
export function getListenerCount(event?: string): number {
  if (event) return listeners.get(event)?.size ?? 0;
  let total = 0;
  listeners.forEach((set) => (total += set.size));
  return total;
}

/**
 * React hook — subscribe to a frontend event bus event.
 * Automatically cleans up on unmount.
 *
 * @example
 * useEvent('dtu:created', (data) => console.log('New DTU:', data));
 */
export function useEvent<T = unknown>(event: string, callback: (data: T) => void): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler: Listener = (data) => callbackRef.current(data as T);
    return onEvent(event, handler);
  }, [event]);
}

/**
 * Subscribe to multiple events with one call.
 *
 * @example
 * useEvents({
 *   'dtu:created': (d) => addDTU(d),
 *   'dtu:deleted': (d) => removeDTU(d),
 * });
 */
export function useEvents(eventMap: Record<string, Listener>): void {
  const mapRef = useRef(eventMap);
  mapRef.current = eventMap;

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    for (const [event, handler] of Object.entries(mapRef.current)) {
      unsubs.push(onEvent(event, handler));
    }
    return () => unsubs.forEach((u) => u());
    // Re-subscribe when event names change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(eventMap).join(',')]);
}
