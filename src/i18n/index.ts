// ---------------------------------------------------------------------------
// index.ts — i18n entry point
//
// Usage:
//   import { t } from '../../i18n/index.js';
//   <Text>{t.install.modeTitle}</Text>
// ---------------------------------------------------------------------------

import { detectLocale, type Locale } from './detect.js';
import { en } from './locales/en.js';
import { zh } from './locales/zh.js';
import type { LocaleStrings } from './types.js';

const locales: Record<Locale, LocaleStrings> = { en, zh };

/** Current locale strings — detected from system language. */
export const t: LocaleStrings = locales[detectLocale()];
