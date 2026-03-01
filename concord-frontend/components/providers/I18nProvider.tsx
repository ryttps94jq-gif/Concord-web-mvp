'use client';

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LOCALE,
  detectLocale,
  setLocale as coreSetLocale,
  onLocaleChange,
  isRTL as checkRTL,
  type Locale,
} from '@/lib/i18n';
import { applyDocumentDirection, applyDocumentLang } from '@/lib/i18n/rtl';

// ── Context ─────────────────────────────────────────────────────────────────

export interface I18nContextValue {
  /** Current active locale */
  locale: Locale;
  /** Whether the current locale is RTL */
  isRTL: boolean;
  /** Change the active locale */
  setLocale: (locale: Locale) => Promise<void>;
  /** Whether translations have been loaded */
  ready: boolean;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────

interface I18nProviderProps {
  /** Override the initial locale (useful for SSR or testing) */
  initialLocale?: Locale;
  children: ReactNode;
}

/**
 * I18nProvider wraps the application and provides internationalization context.
 *
 * Responsibilities:
 * - Detects user's preferred locale from localStorage or browser settings
 * - Loads translation messages for the active locale
 * - Sets the HTML `dir` attribute (ltr/rtl)
 * - Sets the HTML `lang` attribute
 * - Provides translation context to child components via React Context
 *
 * Usage:
 *   <I18nProvider>
 *     <App />
 *   </I18nProvider>
 */
export function I18nProvider({ initialLocale, children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  // Initialize locale on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const detected = initialLocale ?? detectLocale();
      try {
        await coreSetLocale(detected);
        if (!cancelled) {
          setLocaleState(detected);
          applyDocumentDirection(detected);
          applyDocumentLang(detected);
          setReady(true);
        }
      } catch (error) {
        console.error('[I18nProvider] Failed to initialize locale:', error);
        // Fall back to default locale
        if (!cancelled) {
          await coreSetLocale(DEFAULT_LOCALE);
          setLocaleState(DEFAULT_LOCALE);
          applyDocumentDirection(DEFAULT_LOCALE);
          applyDocumentLang(DEFAULT_LOCALE);
          setReady(true);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [initialLocale]);

  // Subscribe to external locale changes (e.g., from other tabs)
  useEffect(() => {
    const unsubscribe = onLocaleChange((newLocale) => {
      setLocaleState(newLocale);
      applyDocumentDirection(newLocale);
      applyDocumentLang(newLocale);
    });

    return unsubscribe;
  }, []);

  // Listen for storage events (cross-tab sync)
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key === 'concord_locale' && e.newValue) {
        const newLocale = e.newValue as Locale;
        coreSetLocale(newLocale).then(() => {
          setLocaleState(newLocale);
          applyDocumentDirection(newLocale);
          applyDocumentLang(newLocale);
        });
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  /**
   * Change the active locale. This triggers:
   * 1. Loading new translation messages
   * 2. Updating the HTML dir/lang attributes
   * 3. Persisting the preference to localStorage
   * 4. Notifying all subscribers
   */
  const setLocale = useCallback(async (newLocale: Locale) => {
    try {
      await coreSetLocale(newLocale);
      setLocaleState(newLocale);
      applyDocumentDirection(newLocale);
      applyDocumentLang(newLocale);
    } catch (error) {
      console.error('[I18nProvider] Failed to change locale:', error);
    }
  }, []);

  const contextValue: I18nContextValue = {
    locale,
    isRTL: checkRTL(locale),
    setLocale,
    ready,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}
