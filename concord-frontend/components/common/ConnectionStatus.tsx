'use client';

/**
 * ConnectionStatus — Shows banner when backend is offline or serving stale data.
 * Checks /api/brain/health every 15s and shows a top banner if offline.
 */

import { useState, useEffect } from 'react';

export function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/brain/health', {
          signal: AbortSignal.timeout(5000),
        });
        setOnline(res.ok);
        setStale(res.headers.get('X-Concord-Stale') === 'true');
      } catch {
        setOnline(false);
      }
    };

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  if (online && !stale) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600/90 text-black text-center text-sm py-1">
      {stale
        ? 'Showing cached data. Reconnecting...'
        : 'Connection lost. Working offline with cached data.'}
    </div>
  );
}

export default ConnectionStatus;
