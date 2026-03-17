// ---------------------------------------------------------------------------
// i18n Type Definitions
// ---------------------------------------------------------------------------

/**
 * Supported locales
 */
export type Locale = 'en' | 'zh-CN';

/**
 * Translation key structure - nested dot notation (e.g., 'nav.kanban')
 */
export type TranslationKey = string;

/**
 * Translation value type - use a recursive interface instead of type alias
 */
export interface LocaleMessages {
  [key: string]: string | LocaleMessages;
}

/**
 * i18n context state
 */
export interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}
