import { NavLink, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useI18n } from '@/client/i18n/index.js';
import type { Category } from '@/client/routes/route-config.js';

// ---------------------------------------------------------------------------
// Breadcrumbs — navigation breadcrumb trail (Home > Category > Command)
// ---------------------------------------------------------------------------

interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent: boolean;
}

interface BreadcrumbsProps {
  categories: Category[];
  className?: string;
}

export function Breadcrumbs({ categories, className = '' }: BreadcrumbsProps) {
  const { t } = useI18n();
  const location = useLocation();

  const items = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    // Always add home
    breadcrumbs.push({
      label: t('nav.home'),
      href: '/',
      isCurrent: pathParts.length === 0,
    });

    if (pathParts.length === 0) {
      return breadcrumbs;
    }

    // Category level
    const categoryId = pathParts[0];
    const category = categories.find((c) => c.id === categoryId);
    if (category) {
      breadcrumbs.push({
        label: category.name,
        href: `/${categoryId}`,
        isCurrent: pathParts.length === 1,
      });
    }

    // Command/Skill level
    if (pathParts.length >= 2) {
      const slug = pathParts[1];
      // Convert slug back to readable name
      const label = slug.replace(/-/g, '-');
      breadcrumbs.push({
        label: label,
        href: `/${categoryId}/${slug}`,
        isCurrent: true,
      });
    }

    return breadcrumbs;
  }, [location.pathname, categories, t]);

  if (items.length <= 1) {
    return null; // Don't show breadcrumbs for home page
  }

  return (
    <nav
      className={className}
      aria-label="Breadcrumb"
      itemScope
      itemType="https://schema.org/BreadcrumbList"
    >
      <ol className="flex items-center gap-[var(--spacing-1)] text-[length:var(--font-size-sm)] text-text-secondary">
        {items.map((item, index) => (
          <li
            key={item.href || index}
            className="flex items-center"
            itemProp="itemListElement"
            itemScope
            itemType="https://schema.org/ListItem"
          >
            <meta itemProp="position" content={String(index + 1)} />

            {index > 0 && (
              <svg
                className="w-4 h-4 text-text-tertiary mx-[var(--spacing-1)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}

            {item.isCurrent ? (
              <span
                className="text-text-primary font-[var(--font-weight-medium)]"
                aria-current="page"
                itemProp="name"
              >
                {item.label}
              </span>
            ) : (
              <NavLink
                to={item.href!}
                className={[
                  'transition-colors duration-[var(--duration-fast)]',
                  'hover:text-accent-blue hover:underline',
                  'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)] rounded',
                ].join(' ')}
                itemProp="item"
              >
                <span itemProp="name">{item.label}</span>
              </NavLink>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// CompactBreadcrumbs — simplified version for mobile
// ---------------------------------------------------------------------------

interface CompactBreadcrumbsProps {
  maxItems?: number;
  categories: Category[];
  className?: string;
}

export function CompactBreadcrumbs({
  maxItems = 3,
  categories,
  className = '',
}: CompactBreadcrumbsProps) {
  const { t } = useI18n();
  const location = useLocation();

  const items = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    breadcrumbs.push({
      label: t('nav.home'),
      href: '/',
      isCurrent: pathParts.length === 0,
    });

    if (pathParts.length === 0) return breadcrumbs;

    const categoryId = pathParts[0];
    const category = categories.find((c) => c.id === categoryId);
    if (category) {
      breadcrumbs.push({
        label: category.name,
        href: `/${categoryId}`,
        isCurrent: pathParts.length === 1,
      });
    }

    if (pathParts.length >= 2) {
      breadcrumbs.push({
        label: pathParts[pathParts.length - 1],
        href: undefined,
        isCurrent: true,
      });
    }

    return breadcrumbs;
  }, [location.pathname, categories, t]);

  if (items.length <= 1) return null;

  // Truncate if too many items
  const displayItems =
    items.length > maxItems
      ? [items[0], { label: '...', href: undefined, isCurrent: false }, items[items.length - 1]]
      : items;

  return (
    <nav className={className} aria-label="Breadcrumb">
      <div className="flex items-center gap-[var(--spacing-1)] text-[length:var(--font-size-xs)] text-text-secondary">
        {displayItems.map((item, index) => (
          <span key={index} className="flex items-center">
            {index > 0 && <span className="mx-[var(--spacing-1)] text-text-tertiary">/</span>}
            {item.href && !item.isCurrent ? (
              <a
                href={item.href}
                className="hover:text-accent-blue transition-colors truncate max-w-[100px]"
              >
                {item.label}
              </a>
            ) : (
              <span className="text-text-primary font-medium truncate max-w-[120px]">
                {item.label}
              </span>
            )}
          </span>
        ))}
      </div>
    </nav>
  );
}
