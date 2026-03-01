'use client';

import dynamic from 'next/dynamic';

/**
 * KnowledgeSpace3D — lazy-loaded wrapper.
 *
 * The actual Three.js / @react-three implementation lives in
 * KnowledgeSpace3DCanvas.tsx and is loaded on-demand via next/dynamic
 * with SSR disabled (Three.js requires a browser environment).
 */

const KnowledgeSpace3D = dynamic(
  () =>
    import('./KnowledgeSpace3DCanvas').then((mod) => ({
      default: mod.KnowledgeSpace3D,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-white/5 rounded-lg h-64" />
    ),
  }
);

export { KnowledgeSpace3D };
export default KnowledgeSpace3D;
