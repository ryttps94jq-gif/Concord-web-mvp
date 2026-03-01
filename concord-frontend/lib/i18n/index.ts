/**
 * Core i18n module for Concord Cognitive Engine.
 *
 * Lightweight internationalization system supporting 10 locales,
 * RTL layouts, and locale-specific formatting.
 */

// Supported locales
export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ar', 'he', 'pt', 'ko'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

// RTL locales
export const RTL_LOCALES: Locale[] = ['ar', 'he'];

// Default locale
export const DEFAULT_LOCALE: Locale = 'en';

// Locale display names (in their native language)
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  zh: '中文',
  ar: 'العربية',
  he: 'עברית',
  pt: 'Português',
  ko: '한국어',
};

// BCP 47 language tags for Intl APIs
const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  ja: 'ja-JP',
  zh: 'zh-CN',
  ar: 'ar-SA',
  he: 'he-IL',
  pt: 'pt-BR',
  ko: 'ko-KR',
};

// Translation cache
const translationCache: Partial<Record<Locale, Record<string, unknown>>> = {};

// Current locale state
let currentLocale: Locale = DEFAULT_LOCALE;

// Listeners for locale changes
type LocaleChangeListener = (locale: Locale) => void;
const listeners: Set<LocaleChangeListener> = new Set();

/**
 * Subscribe to locale changes. Returns an unsubscribe function.
 */
export function onLocaleChange(listener: LocaleChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Load translation messages for a locale. Lazily imports the JSON file.
 */
async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  if (translationCache[locale]) {
    return translationCache[locale]!;
  }

  try {
    let messages: Record<string, unknown>;
    switch (locale) {
      case 'en':
        messages = (await import('./locales/en.json')).default;
        break;
      case 'es':
        messages = (await import('./locales/es.json')).default;
        break;
      case 'fr':
        messages = (await import('./locales/fr.json')).default;
        break;
      case 'de':
        messages = (await import('./locales/de.json')).default;
        break;
      case 'ja':
        messages = (await import('./locales/ja.json')).default;
        break;
      case 'zh':
        messages = (await import('./locales/zh.json')).default;
        break;
      case 'ar':
        messages = (await import('./locales/ar.json')).default;
        break;
      case 'he':
        messages = (await import('./locales/he.json')).default;
        break;
      case 'pt':
        messages = (await import('./locales/pt.json')).default;
        break;
      case 'ko':
        messages = (await import('./locales/ko.json')).default;
        break;
      default:
        messages = (await import('./locales/en.json')).default;
    }
    translationCache[locale] = messages;
    return messages;
  } catch {
    // Fallback to English if locale file is missing
    if (locale !== 'en') {
      return loadMessages('en');
    }
    return {};
  }
}

/**
 * Resolve a dot-separated key path from a nested object.
 * Example: resolveKey({ chat: { title: "Chat" } }, "chat.title") => "Chat"
 */
function resolveKey(obj: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Interpolate parameters into a translation string.
 * Supports {{param}} syntax.
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
}

/**
 * Translate a key. Synchronous — requires messages to be preloaded.
 * Falls back to the key itself if translation is not found.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const messages = translationCache[currentLocale];
  if (!messages) {
    return interpolate(key, params);
  }

  const value = resolveKey(messages, key);
  if (value === undefined) {
    // Fallback to English
    const enMessages = translationCache['en'];
    if (enMessages) {
      const enValue = resolveKey(enMessages, key);
      if (enValue !== undefined) {
        return interpolate(enValue, params);
      }
    }
    return interpolate(key, params);
  }

  return interpolate(value, params);
}

/**
 * Set the current locale. Loads translation messages if not cached.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    console.warn(`[i18n] Unsupported locale: ${locale}. Falling back to ${DEFAULT_LOCALE}.`);
    locale = DEFAULT_LOCALE;
  }

  // Ensure English is always loaded as fallback
  if (!translationCache['en']) {
    await loadMessages('en');
  }

  await loadMessages(locale);
  currentLocale = locale;

  // Persist preference
  if (typeof window !== 'undefined') {
    localStorage.setItem('concord_locale', locale);
  }

  // Notify listeners
  listeners.forEach((listener) => listener(locale));
}

/**
 * Get the current locale.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Get the BCP 47 tag for the current locale.
 */
export function getLocaleTag(locale?: Locale): string {
  return LOCALE_TAGS[locale ?? currentLocale];
}

/**
 * Check if the current (or given) locale is RTL.
 */
export function isRTL(locale?: Locale): boolean {
  return RTL_LOCALES.includes(locale ?? currentLocale);
}

/**
 * Format a number for the current locale.
 */
export function formatNumber(n: number, locale?: Locale): string {
  const tag = getLocaleTag(locale);
  try {
    return new Intl.NumberFormat(tag).format(n);
  } catch {
    return String(n);
  }
}

/**
 * Format a date for the current locale.
 */
export function formatDate(
  date: Date | string,
  style: 'short' | 'medium' | 'long' = 'medium',
  locale?: Locale
): string {
  const tag = getLocaleTag(locale);
  const d = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    short: { month: 'numeric', day: 'numeric', year: '2-digit' } as const,
    medium: { month: 'short', day: 'numeric', year: 'numeric' } as const,
    long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } as const,
  }[style];

  try {
    return new Intl.DateTimeFormat(tag, options).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

/**
 * Format a currency amount. Supports Concord Credits (CC) and USD.
 */
export function formatCurrency(
  amount: number,
  currency: 'CC' | 'USD' = 'CC',
  locale?: Locale
): string {
  const tag = getLocaleTag(locale);

  if (currency === 'CC') {
    // Concord Credits use a custom symbol
    const formatted = formatNumber(amount, locale);
    return `${formatted} CC`;
  }

  try {
    return new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * Detect the user's preferred locale from the browser or stored preference.
 */
export function detectLocale(): Locale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  // Check localStorage first
  const stored = localStorage.getItem('concord_locale') as Locale | null;
  if (stored && SUPPORTED_LOCALES.includes(stored)) {
    return stored;
  }

  // Check browser language
  const browserLang = navigator.language?.split('-')[0] as Locale;
  if (browserLang && SUPPORTED_LOCALES.includes(browserLang)) {
    return browserLang;
  }

  // Check navigator.languages
  if (navigator.languages) {
    for (const lang of navigator.languages) {
      const code = lang.split('-')[0] as Locale;
      if (SUPPORTED_LOCALES.includes(code)) {
        return code;
      }
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Preload messages for a locale without changing the current locale.
 */
export async function preloadLocale(locale: Locale): Promise<void> {
  await loadMessages(locale);
}

/**
 * Check if a locale is currently loaded in the cache.
 */
export function isLocaleLoaded(locale: Locale): boolean {
  return !!translationCache[locale];
}
