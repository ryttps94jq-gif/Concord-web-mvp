'use client';

import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface SafeCardProps {
  children: ReactNode;
  /** Label shown in the error fallback (e.g. "DTU Card", "Chat Message") */
  label?: string;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** CSS classes for the fallback container */
  className?: string;
}

interface SafeCardState {
  hasError: boolean;
}

/**
 * Lightweight per-component error boundary for list items.
 *
 * Wraps individual cards, messages, or list items so that one
 * crashing component doesn't take down the entire lens page.
 *
 * Usage:
 *   {items.map(item => (
 *     <SafeCard key={item.id} label="DTU Card">
 *       <DTUCard dtu={item} />
 *     </SafeCard>
 *   ))}
 */
export class SafeCard extends Component<SafeCardProps, SafeCardState> {
  state: SafeCardState = { hasError: false };

  static getDerivedStateFromError(): SafeCardState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[SafeCard] ${this.props.label || 'Component'} crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className={this.props.className || 'p-3 rounded-lg border border-amber-500/20 bg-amber-500/5'}
          role="alert"
        >
          <div className="flex items-center gap-2 text-amber-400 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{this.props.label || 'Component'} failed to render</span>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="ml-auto text-amber-300 hover:text-white underline text-xs"
              aria-label={`Retry rendering ${this.props.label || 'component'}`}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SafeCard;
