'use client';

import { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useUIStore } from '@/store/ui';

const TOAST_DURATION = 5000;

export function Toasts() {
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  return (
    <div role="region" aria-live="polite" aria-label="Notifications" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  onClose: () => void;
}

function Toast({ type, message, duration = TOAST_DURATION, onClose }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const config = {
    success: {
      icon: CheckCircle,
      bg: 'bg-neon-green/10',
      border: 'border-neon-green/30',
      text: 'text-neon-green',
    },
    error: {
      icon: AlertCircle,
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-500',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-500',
    },
    info: {
      icon: Info,
      bg: 'bg-neon-blue/10',
      border: 'border-neon-blue/30',
      text: 'text-neon-blue',
    },
  };

  const { icon: Icon, bg, border, text } = config[type];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bg} ${border} min-w-[300px] max-w-md animate-slide-in shadow-lg`}
    >
      <Icon className={`w-5 h-5 ${text} flex-shrink-0`} />
      <p className="flex-1 text-sm text-white">{message}</p>
      <button
        onClick={onClose}
        className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}

// Helper function to show toasts from anywhere
export function showToast(
  type: 'success' | 'error' | 'warning' | 'info',
  message: string,
  duration?: number
) {
  useUIStore.getState().addToast({ type, message, duration });
}
