import type { ReactNode } from 'react';
import { useI18n } from '@/client/i18n/index.js';

// ---------------------------------------------------------------------------
// MainContent — wrapper for the main content area (route outlet)
// ---------------------------------------------------------------------------

export function MainContent({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <main
      role="main"
      aria-label={t('accessibility.main_content')}
      className="flex-1 overflow-y-auto bg-bg-primary p-[var(--spacing-4)] sm:p-[var(--spacing-4)] max-sm:p-[var(--spacing-2)]"
    >
      {children}
    </main>
  );
}
