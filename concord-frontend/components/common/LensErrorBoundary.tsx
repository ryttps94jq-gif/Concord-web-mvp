'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Name of the component/area for user-facing messages */
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Component-level error boundary.
 *
 * Catches render errors in a specific subtree without crashing the entire app.
 * Use this around individual lens sections, panels, or widgets.
 *
 * Usage:
 *   <LensErrorBoundary name="Chat History">
 *     <ChatHistory />
 *   </LensErrorBoundary>
 */
export class LensErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[LensErrorBoundary${this.props.name ? `: ${this.props.name}` : ''}]`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { name } = this.props;
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center p-6 text-center bg-lattice-surface/50 border border-red-500/20 rounded-xl m-2"
        >
          <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">
            {name ? `${name} failed to load` : 'Something went wrong'}
          </h3>
          <p className="text-xs text-gray-400 mb-4 max-w-xs">
            {this.state.error?.message || 'An unexpected error occurred in this section.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 text-xs bg-lattice-elevated border border-lattice-border rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
