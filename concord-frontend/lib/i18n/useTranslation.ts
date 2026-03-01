'use client';

import { useCallback, useContext } from 'react';
import { I18nContext } from '@/components/providers/I18nProvider';
import {
  t as globalT,
  formatNumber as globalFormatNumber,
  formatDate as globalFormatDate,
  formatCurrency as globalFormatCurrency,
  setLocale as globalSetLocale,
  type Locale,
} from './index';

/**
 * React hook for accessing translations and locale utilities.
 *
 * Usage:
 *   const { t, locale, isRTL, formatNumber } = useTranslation();
 *   // Or with a namespace prefix:
 *   const { t } = useTranslation('chat');
 *   t('title') // resolves "chat.title"
 */
export function useTranslation(namespace?: string) {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error(
      'useTranslation must be used within an <I18nProvider>. ' +
        'Wrap your app with <I18nProvider> to use translations.'
    );
  }

  const { locale, isRTL: rtl } = context;

  /**
   * Translate a key, optionally prefixed with the namespace.
   * If a namespace is provided, keys are resolved as "namespace.key".
   * If the namespaced key is not found, falls back to a global key lookup.
   */
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      if (namespace) {
        const namespacedKey = `${namespace}.${key}`;
        const result = globalT(namespacedKey, params);
        // If the result equals the namespaced key, the translation was not found.
        // Try the key without namespace as fallback.
        if (result === namespacedKey) {
          return globalT(key, params);
        }
        return result;
      }
      return globalT(key, params);
    },
    [namespace, locale] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * Change the active locale.
   */
  const changeLocale = useCallback(async (newLocale: Locale) => {
    await globalSetLocale(newLocale);
  }, []);

  /**
   * Format a number for the current locale.
   */
  const formatNumber = useCallback(
    (n: number): string => {
      return globalFormatNumber(n, locale);
    },
    [locale]
  );

  /**
   * Format a date for the current locale.
   */
  const formatDate = useCallback(
    (date: Date | string, style?: 'short' | 'medium' | 'long'): string => {
      return globalFormatDate(date, style, locale);
    },
    [locale]
  );

  /**
   * Format a currency amount for the current locale.
   */
  const formatCurrency = useCallback(
    (amount: number, currency?: 'CC' | 'USD'): string => {
      return globalFormatCurrency(amount, currency, locale);
    },
    [locale]
  );

  return {
    t,
    locale,
    setLocale: changeLocale,
    isRTL: rtl,
    formatNumber,
    formatDate,
    formatCurrency,
  };
}
