// ---------------------------------------------------------------------------
// detect.ts — detect system locale for i18n
// ---------------------------------------------------------------------------

export type Locale = 'en' | 'zh';

/**
 * Detect the user's preferred locale.
 *
 * Priority:
 *   1. MAESTRO_LOCALE env var (explicit override)
 *   2. Intl.DateTimeFormat().resolvedOptions().locale (cross-platform)
 *   3. LANG / LC_ALL / LC_MESSAGES env vars (Unix fallback)
 *
 * Returns 'zh' for any Chinese variant (zh-CN, zh-TW, zh-HK, etc.), else 'en'.
 */
export function detectLocale(): Locale {
  // 1. Explicit override
  const env = process.env.MAESTRO_LOCALE;
  if (env) {
    const lower = env.toLowerCase().trim();
    if (lower.startsWith('zh')) return 'zh';
    return 'en';
  }

  // 2. Intl API (works on Windows, macOS, Linux)
  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (intlLocale && intlLocale.toLowerCase().startsWith('zh')) return 'zh';
  } catch {
    // Intl not available — fall through
  }

  // 3. Unix env vars
  const langEnv = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES;
  if (langEnv && langEnv.toLowerCase().startsWith('zh')) return 'zh';

  return 'en';
}
