/**
 * RTL (Right-to-Left) layout utilities for Concord Cognitive Engine.
 *
 * Provides helpers for CSS direction detection, logical property mapping,
 * and icon flipping for RTL locales (Arabic, Hebrew).
 */

import { isRTL as checkRTL, type Locale } from './index';

// ── Direction Detection ─────────────────────────────────────────────────────

/**
 * Get the CSS direction value for a locale.
 */
export function getDirection(locale?: Locale): 'ltr' | 'rtl' {
  return checkRTL(locale) ? 'rtl' : 'ltr';
}

/**
 * Get the text-align value appropriate for the locale.
 */
export function getTextAlign(locale?: Locale): 'left' | 'right' {
  return checkRTL(locale) ? 'right' : 'left';
}

/**
 * Get the opposite text-align value (for end-aligned content).
 */
export function getTextAlignEnd(locale?: Locale): 'left' | 'right' {
  return checkRTL(locale) ? 'left' : 'right';
}

// ── Logical Property Helpers ────────────────────────────────────────────────

export type LogicalSide = 'start' | 'end';
export type PhysicalSide = 'left' | 'right';

/**
 * Convert a logical side (start/end) to a physical side (left/right)
 * based on the current text direction.
 *
 * Example:
 *   logicalToPhysical('start') => 'left' (LTR) or 'right' (RTL)
 *   logicalToPhysical('end')   => 'right' (LTR) or 'left' (RTL)
 */
export function logicalToPhysical(side: LogicalSide, locale?: Locale): PhysicalSide {
  const rtl = checkRTL(locale);
  if (side === 'start') {
    return rtl ? 'right' : 'left';
  }
  return rtl ? 'left' : 'right';
}

/**
 * Generate RTL-aware margin/padding inline styles.
 * Uses CSS logical properties (margin-inline-start, etc.) which are
 * natively RTL-aware. Falls back to physical properties for older browsers.
 *
 * Usage:
 *   const style = inlineSpacing('margin', 'start', '1rem');
 *   // Returns: { marginInlineStart: '1rem' }
 */
export function inlineSpacing(
  property: 'margin' | 'padding',
  side: LogicalSide,
  value: string | number
): Record<string, string | number> {
  const logicalProperty =
    side === 'start'
      ? `${property}InlineStart`
      : `${property}InlineEnd`;

  return { [logicalProperty]: value };
}

/**
 * Generate RTL-aware positioning styles using logical properties.
 *
 * Usage:
 *   const style = inlinePosition('start', '1rem');
 *   // Returns: { insetInlineStart: '1rem' }
 */
export function inlinePosition(
  side: LogicalSide,
  value: string | number
): Record<string, string | number> {
  const logicalProperty =
    side === 'start' ? 'insetInlineStart' : 'insetInlineEnd';

  return { [logicalProperty]: value };
}

/**
 * Generate RTL-aware border-radius styles.
 *
 * Usage:
 *   const style = inlineBorderRadius('start', '8px');
 *   // LTR: { borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px' }
 *   // RTL: { borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }
 */
export function inlineBorderRadius(
  side: LogicalSide,
  value: string | number,
  locale?: Locale
): Record<string, string | number> {
  const physical = logicalToPhysical(side, locale);

  if (physical === 'left') {
    return {
      borderTopLeftRadius: value,
      borderBottomLeftRadius: value,
    };
  }
  return {
    borderTopRightRadius: value,
    borderBottomRightRadius: value,
  };
}

// ── Icon Flipping ───────────────────────────────────────────────────────────

/**
 * CSS transform to flip an icon horizontally in RTL mode.
 * Useful for directional icons (arrows, chevrons, etc.).
 *
 * Usage:
 *   <Icon style={rtlFlipStyle()} />
 */
export function rtlFlipStyle(locale?: Locale): Record<string, string> {
  if (checkRTL(locale)) {
    return { transform: 'scaleX(-1)' };
  }
  return {};
}

/**
 * Get Tailwind CSS class for RTL icon flipping.
 *
 * Usage:
 *   <Icon className={rtlFlipClass()} />
 *   // Returns "rtl:scale-x-[-1]" if RTL, "" otherwise
 */
export function rtlFlipClass(locale?: Locale): string {
  return checkRTL(locale) ? 'scale-x-[-1]' : '';
}

/**
 * Determine if a specific icon should be flipped in RTL.
 * Some icons (like search, settings) should NOT be flipped.
 * Directional icons (arrows, chevrons, navigation) SHOULD be flipped.
 */
const DIRECTIONAL_ICONS = new Set([
  'arrow-left',
  'arrow-right',
  'chevron-left',
  'chevron-right',
  'arrow-back',
  'arrow-forward',
  'navigate-back',
  'navigate-forward',
  'reply',
  'forward',
  'undo',
  'redo',
  'indent',
  'outdent',
  'external-link',
  'logout',
  'login',
]);

/**
 * Check if an icon name is directional and should be flipped in RTL.
 */
export function shouldFlipIcon(iconName: string): boolean {
  return DIRECTIONAL_ICONS.has(iconName.toLowerCase());
}

/**
 * Get the appropriate flip class for a named icon in RTL context.
 *
 * Usage:
 *   <Icon name="arrow-right" className={iconFlipClass('arrow-right')} />
 */
export function iconFlipClass(iconName: string, locale?: Locale): string {
  if (checkRTL(locale) && shouldFlipIcon(iconName)) {
    return 'scale-x-[-1]';
  }
  return '';
}

// ── Tailwind RTL Utilities ──────────────────────────────────────────────────

/**
 * Generate RTL-aware Tailwind class pairs.
 * Maps logical directions to physical Tailwind classes.
 *
 * Usage:
 *   rtlClass('ml-4', 'mr-4')
 *   // LTR: 'ml-4'
 *   // RTL: 'mr-4'
 */
export function rtlClass(ltrClass: string, rtlClassValue: string, locale?: Locale): string {
  return checkRTL(locale) ? rtlClassValue : ltrClass;
}

/**
 * Apply the document direction attribute to the HTML element.
 * Called by I18nProvider when locale changes.
 */
export function applyDocumentDirection(locale?: Locale): void {
  if (typeof document === 'undefined') return;

  const dir = getDirection(locale);
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.style.direction = dir;
}

/**
 * Apply the lang attribute to the HTML element.
 */
export function applyDocumentLang(locale: string): void {
  if (typeof document === 'undefined') return;

  document.documentElement.setAttribute('lang', locale);
}
