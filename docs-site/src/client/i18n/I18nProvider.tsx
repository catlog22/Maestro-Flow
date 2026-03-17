import { useEffect, useState, useMemo } from 'react';
import type { Locale, LocaleMessages, I18nState } from './types.js';
import { I18nContext } from './I18nContext.js';

// ---------------------------------------------------------------------------
// I18n Provider - wraps app and provides translation context
// ---------------------------------------------------------------------------

const LOCALE_STORAGE_KEY = 'docs-site-locale';
const DEFAULT_LOCALE: Locale = 'en';

/**
 * Dynamic import of locale files
 */
async function loadLocale(locale: Locale): Promise<LocaleMessages> {
  switch (locale) {
    case 'zh-CN':
      return (await import('./locales/zh-CN.json')).default;
    case 'en':
    default:
      return (await import('./locales/en.json')).default;
  }
}

/**
 * Get nested value from object using dot notation
 * @example
 * getNestedValue({ a: { b: 'c' } }, 'a.b') // returns 'c'
 */
function getNestedValue(obj: LocaleMessages, path: string): string {
  const keys = path.split('.');
  let value: any = obj;

  for (const key of keys) {
    if (value == null || typeof value !== 'object') {
      return path; // Return key if path not found
    }
    value = value[key];
  }

  return typeof value === 'string' ? value : path;
}

/**
 * Interpolate parameters into translation string
 * @example
 * interpolate('Hello {{name}}!', { name: 'World' }) // returns 'Hello World!'
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key]?.toString() ?? `{{${key}}}`;
  });
}

export interface I18nProviderProps {
  children: React.ReactNode;
  /** Initial locale (overrides localStorage) */
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // Check localStorage, then initialLocale, then default
    if (initialLocale) return initialLocale;

    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored === 'en' || stored === 'zh-CN') return stored;
    } catch {
      // Ignore localStorage errors
    }
    return DEFAULT_LOCALE;
  });

  const [messages, setMessages] = useState<LocaleMessages>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load locale messages when locale changes
  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      setIsLoading(true);
      try {
        const loaded = await loadLocale(locale);
        if (!cancelled) {
          setMessages(loaded);
          setIsLoading(false);
        }
      } catch (error) {
        console.error(`Failed to load locale "${locale}":`, error);
        if (!cancelled) {
          // Fallback to default locale
          if (locale !== DEFAULT_LOCALE) {
            const fallback = await loadLocale(DEFAULT_LOCALE);
            setMessages(fallback);
          }
          setIsLoading(false);
        }
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Translation function
  const t = useMemo(() => {
    return (key: string, params?: Record<string, string | number>): string => {
      const value = getNestedValue(messages, key);
      return interpolate(value, params);
    };
  }, [messages]);

  // Set locale and persist to localStorage
  const setLocale = useMemo(() => {
    return (newLocale: Locale) => {
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      } catch {
        // Ignore localStorage errors
      }
      setLocaleState(newLocale);
    };
  }, []);

  // Context value
  const value: I18nState = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  // Don't render until messages are loaded to prevent flashes
  if (isLoading) {
    return null;
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
