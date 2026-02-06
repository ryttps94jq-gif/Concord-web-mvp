/**
 * FE-020: Design system tokens and reusable class patterns.
 *
 * Instead of repeating identical Tailwind class strings across lenses,
 * import these composable tokens. This prevents visual drift as the
 * lens count grows.
 *
 * Usage:
 *   import { ds } from '@/lib/design-system';
 *   <div className={ds.panel}>...</div>
 *   <button className={ds.btnPrimary}>Save</button>
 */

/** Panel / Card — the standard container used by most lenses. */
const panel =
  'bg-lattice-surface border border-lattice-border rounded-xl p-4';

const panelHover =
  `${panel} hover:border-neon-cyan/50 transition-colors cursor-pointer`;

/** Buttons */
const btnBase =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-lattice-void disabled:opacity-50 disabled:pointer-events-none';

const btnPrimary =
  `${btnBase} px-4 py-2 bg-neon-blue text-white hover:bg-neon-blue/80 focus:ring-neon-blue`;

const btnSecondary =
  `${btnBase} px-4 py-2 bg-lattice-elevated text-gray-200 hover:bg-lattice-elevated/80 border border-lattice-border focus:ring-gray-500`;

const btnDanger =
  `${btnBase} px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 focus:ring-red-500`;

const btnGhost =
  `${btnBase} px-3 py-2 text-gray-400 hover:text-white hover:bg-lattice-elevated`;

const btnSmall =
  `${btnBase} px-3 py-1.5 text-sm`;

const btnNeon = (color: 'blue' | 'purple' | 'cyan' | 'green' | 'pink' = 'blue') =>
  `${btnBase} px-4 py-2 bg-neon-${color}/20 text-neon-${color} border border-neon-${color}/50 hover:bg-neon-${color}/30 focus:ring-neon-${color}`;

/** Inputs */
const input =
  'w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-white placeholder:text-gray-500 outline-none focus:border-neon-blue transition-colors';

const textarea = `${input} resize-none`;

const select = input;

/** Labels & text */
const label = 'block text-sm text-gray-400 mb-1';
const heading1 = 'text-2xl font-bold text-white';
const heading2 = 'text-xl font-semibold text-white';
const heading3 = 'text-lg font-semibold text-white';
const textMuted = 'text-sm text-gray-400';
const textMono = 'font-mono text-sm';

/** Status badges */
const badge = (color: string) =>
  `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${color}/20 text-${color}`;

/** Layout helpers */
const pageContainer = 'p-6 space-y-6';
const sectionHeader = 'flex items-center justify-between';
const grid2 = 'grid grid-cols-1 md:grid-cols-2 gap-4';
const grid3 = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
const grid4 = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4';

/** Overlays */
const modalBackdrop = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-50';
const modalContainer =
  'fixed inset-0 z-50 flex items-center justify-center p-4';
const modalPanel =
  'bg-lattice-surface border border-lattice-border rounded-xl shadow-2xl overflow-hidden w-full';

export const ds = {
  panel,
  panelHover,
  btnBase,
  btnPrimary,
  btnSecondary,
  btnDanger,
  btnGhost,
  btnSmall,
  btnNeon,
  input,
  textarea,
  select,
  label,
  heading1,
  heading2,
  heading3,
  textMuted,
  textMono,
  badge,
  pageContainer,
  sectionHeader,
  grid2,
  grid3,
  grid4,
  modalBackdrop,
  modalContainer,
  modalPanel,
} as const;
