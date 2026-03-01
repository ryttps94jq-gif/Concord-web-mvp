'use client';

import dynamic from 'next/dynamic';

/**
 * InteractiveGraph — lazy-loaded wrapper.
 *
 * The actual Cytoscape.js implementation lives in InteractiveGraphCore.tsx
 * and is loaded on-demand via next/dynamic with SSR disabled
 * (Cytoscape requires a browser DOM environment).
 */

const InteractiveGraph = dynamic(
  () =>
    import('./InteractiveGraphCore').then((mod) => ({
      default: mod.InteractiveGraph,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-white/5 rounded-lg h-64" />
    ),
  }
);

export { InteractiveGraph };
export default InteractiveGraph;
