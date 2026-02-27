'use client';

import { useState } from 'react';

/**
 * useSessionId — Persistent session ID across all lens navigations.
 *
 * Stored in sessionStorage (survives navigation, dies on tab close).
 * New session created on fresh visit or explicit "new conversation".
 */
export function useSessionId(): string {
  const [sessionId] = useState(() => {
    if (typeof window === 'undefined') return 'default';
    const existing = sessionStorage.getItem('concord_session_id');
    if (existing) return existing;
    const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('concord_session_id', newId);
    return newId;
  });

  return sessionId;
}

/**
 * Reset the current session — starts a new conversation.
 */
export function resetSessionId(): string {
  if (typeof window === 'undefined') return 'default';
  const newId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem('concord_session_id', newId);
  return newId;
}
