'use client';

/**
 * useBrainHealth — Polls brain health status every 30s.
 * Returns online/offline state for each brain.
 */

import { useState, useEffect, useCallback } from 'react';

interface BrainState {
  online: boolean;
  model?: string;
  avgResponseTime?: number;
  totalRequests?: number;
}

interface BrainHealthStatus {
  conscious: BrainState | null;
  subconscious: BrainState | null;
  utility: BrainState | null;
}

const POLL_INTERVAL = 30000; // 30s

export function useBrainHealth() {
  const [brainStatus, setBrainStatus] = useState<BrainHealthStatus>({
    conscious: null,
    subconscious: null,
    utility: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/brain/health', {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        setBrainStatus(data);
      } else {
        setBrainStatus({
          conscious: { online: false },
          subconscious: { online: false },
          utility: { online: false },
        });
      }
    } catch {
      setBrainStatus({
        conscious: { online: false },
        subconscious: { online: false },
        utility: { online: false },
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [check]);

  return { brainStatus, isLoading, refresh: check };
}
