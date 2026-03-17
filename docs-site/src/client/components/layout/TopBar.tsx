import { useState } from 'react';
import { useI18n } from '@/client/i18n/index.js';
import { SearchInput } from '@/client/components/navigation/index.js';

// ---------------------------------------------------------------------------
// TopBar — logo, search, language switcher, theme toggle
// ---------------------------------------------------------------------------

export function TopBar() {
  const { t, locale, setLocale } = useI18n();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Check localStorage or system preference
    try {
      const stored = localStorage.getItem('docs-site-theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // Ignore localStorage errors
    }
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Toggle between English and Chinese
  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'zh-CN' : 'en');
  };

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    try {
      localStorage.setItem('docs-site-theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    } catch {
      // Ignore errors
    }
  };

  return (
    <header
      role="banner"
      className="flex items-center justify-between px-[var(--spacing-4)] h-[var(--size-topbar-height)] bg-bg-secondary border-b border-border shrink-0"
    >
      {/* Left: logo/branding */}
      <div className="flex items-center gap-[var(--spacing-3)]">
        <span
          className="font-[var(--font-weight-semibold)] text-[length:var(--font-size-base)] text-text-primary tracking-[var(--letter-spacing-tight)]"
          aria-hidden="true"
        >
          Maestro
        </span>
        <span className="text-text-tertiary text-[length:var(--font-size-sm)]">|</span>
        <span className="text-text-secondary text-[length:var(--font-size-sm)]">
          {t('topbar.title')}
        </span>
      </div>

      {/* Right: search + language + theme */}
      <div className="flex items-center gap-[var(--spacing-3)]">
        {/* Search input */}
        <div className="hidden sm:block w-48 lg:w-64">
          <SearchInput placeholder={t('topbar.search_placeholder')} />
        </div>

        {/* Language switcher */}
        <button
          type="button"
          onClick={toggleLocale}
          aria-label={t('language_switcher.aria_label')}
          className={[
            'flex items-center gap-[var(--spacing-1-5)] px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-sm)]',
            'text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)]',
            'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
            'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
            'hover:bg-bg-hover',
            locale === 'zh-CN' ? 'text-accent-blue' : 'text-text-secondary',
          ].join(' ')}
        >
          <span className="tabular-nums">{locale === 'en' ? t('language_switcher.en') : t('language_switcher.zh')}</span>
          <span className="text-text-tertiary">/</span>
          <span className="tabular-nums">{locale === 'en' ? t('language_switcher.zh') : t('language_switcher.en')}</span>
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={t('theme_toggle.aria_label')}
          className={[
            'flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)]',
            'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
            'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
            'hover:bg-bg-hover',
            'text-text-secondary'
          ].join(' ')}
        >
          {theme === 'light' ? (
            // Moon icon (switch to dark)
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            // Sun icon (switch to light)
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
