import { useI18nContext } from '../I18nContext.js';

// ---------------------------------------------------------------------------
// useI18n Hook - convenient access to translation function
// ---------------------------------------------------------------------------

/**
 * Hook for accessing i18n translation function
 * @returns Translation function and locale state
 *
 * @example
 * const { t, locale, setLocale } = useI18n();
 * <h1>{t('nav.kanban')}</h1>
 * <p>{t('welcome', { name: 'User' })}</p>
 */
export function useI18n() {
  const { locale, setLocale, t } = useI18nContext();

  return {
    /** Current locale */
    locale,
    /** Set locale (persists to localStorage) */
    setLocale,
    /**
     * Translate a key with optional parameter interpolation
     * @param key - Dot-notation translation key (e.g., 'nav.kanban')
     * @param params - Optional parameters for interpolation (e.g., { name: 'John' })
     * @returns Translated string
     */
    t,
  };
}
