'use client';

import { AlertTriangle, Copy, Shield } from 'lucide-react';
import { useMemo } from 'react';
import { useUIStore } from '@/store/ui';

function reasonToAction(reason?: string): string {
  if (!reason) return 'Check request details and try again.';
  const normalized = reason.toLowerCase();
  if (normalized.includes('login required')) return 'Log in and retry the action.';
  if (normalized.includes('api key missing')) return 'Attach an x-api-key header or switch AUTH_MODE to jwt/hybrid.';
  if (normalized.includes('origin blocked')) return 'Add your frontend origin to ALLOWED_ORIGINS and redeploy.';
  if (normalized.includes('permission denied')) return 'Use an account/key with the required permission.';
  return 'Review the debug bundle and server logs for this request ID.';
}

export function OperatorErrorBanner() {
  const requestErrors = useUIStore((state) => state.requestErrors);
  const clearRequestErrors = useUIStore((state) => state.clearRequestErrors);
  const authPosture = useUIStore((state) => state.authPosture);

  const latest = requestErrors[requestErrors.length - 1];

  const debugBundle = useMemo(() => {
    return JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        authPosture,
        recentErrors: requestErrors,
      },
      null,
      2
    );
  }, [authPosture, requestErrors]);

  const copyDebugBundle = async () => {
    try {
      await navigator.clipboard.writeText(debugBundle);
    } catch {
      // no-op fallback
    }
  };

  if (!latest) return null;

  const reason = latest.reason || latest.message;

  return (
    <div className="sticky top-0 z-40 border-b border-red-500/40 bg-red-500/10 backdrop-blur px-4 py-3">
      <div className="flex flex-wrap items-start gap-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-red-200">{reason}</p>
          <p className="text-red-100/80">Next step: {reasonToAction(reason)}</p>
          {latest.requestId && <p className="text-xs text-red-100/70">Request ID: {latest.requestId}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded border border-white/15 bg-black/20 px-2 py-1 text-xs text-gray-200">
            <Shield className="h-3 w-3" /> AUTH_MODE={authPosture.mode}
          </span>
          <button
            onClick={copyDebugBundle}
            className="inline-flex items-center gap-1 rounded border border-white/20 px-2 py-1 text-xs text-white hover:bg-white/10"
          >
            <Copy className="h-3 w-3" /> Copy debug bundle
          </button>
          <button
            onClick={clearRequestErrors}
            className="rounded border border-white/20 px-2 py-1 text-xs text-white hover:bg-white/10"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
