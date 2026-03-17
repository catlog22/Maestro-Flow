import type { ReactNode } from 'react';
import { useI18n } from '@/client/i18n/index.js';
import { Breadcrumbs } from '@/client/components/navigation/index.js';
import { inventoryData } from '@/client/routes/route-config.js';

// ---------------------------------------------------------------------------
// MainContent — wrapper for the main content area (route outlet)
// ---------------------------------------------------------------------------

interface MainContentProps {
  children?: ReactNode;
  showBreadcrumbs?: boolean;
}

export function MainContent({ children, showBreadcrumbs = true }: MainContentProps) {
  const { t } = useI18n();
  return (
    <main
      role="main"
      aria-label={t('accessibility.main_content')}
      className="flex-1 overflow-y-auto bg-bg-primary"
    >
      {/* Skip to content link (hidden until focused) */}
      <a
        href="#main-content"
        className={[
          'sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4',
          'focus:z-50 focus:px-4 focus:py-2',
          'bg-bg-primary border border-border rounded-[var(--radius-default)]',
          'focus:shadow-[var(--shadow-focus-ring)]',
          'text-text-primary text-[length:var(--font-size-sm)]',
        ].join(' ')}
      >
        {t('accessibility.skip_to_content')}
      </a>

      <div id="main-content" className="p-[var(--spacing-4)] sm:p-[var(--spacing-4)] max-sm:p-[var(--spacing-2)]">
        {/* Breadcrumbs navigation */}
        {showBreadcrumbs && (
          <div className="mb-[var(--spacing-4)]">
            <Breadcrumbs categories={inventoryData.categories} />
          </div>
        )}

        {/* Content */}
        {children}
      </div>
    </main>
  );
}
