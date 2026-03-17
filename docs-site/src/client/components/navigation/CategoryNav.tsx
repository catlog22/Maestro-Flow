import { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '@/client/i18n/index.js';
import type { Category } from '@/client/routes/route-config.js';

// ---------------------------------------------------------------------------
// CategoryNav — collapsible category navigation with active state
// ---------------------------------------------------------------------------

interface CategorySection {
  id: string;
  titleKey: string;
  items: string[];
  isOpen: boolean;
}

interface CategoryNavProps {
  categories: Category[];
  className?: string;
}

export function CategoryNav({ categories, className = '' }: CategoryNavProps) {
  const { t } = useI18n();
  const location = useLocation();

  // Build sections from inventory categories
  const defaultSections: CategorySection[] = useMemo(() => {
    const sections: CategorySection[] = categories.map((cat) => ({
      id: cat.id,
      titleKey: `categories.${cat.id.replace('-', '_')}`,
      items: [], // Items will be populated by commands/skills in that category
      isOpen: ['pipeline', 'spec', 'quality'].includes(cat.id), // Default open for main categories
    }));
    return sections;
  }, [categories]);

  const [sections, setSections] = useState<CategorySection[]>(defaultSections);

  // Check if a category is currently active
  const isCategoryActive = (categoryId: string): boolean => {
    return location.pathname.split('/')[1] === categoryId;
  };

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, isOpen: !section.isOpen } : section
      )
    );
  };

  return (
    <nav className={className} aria-label={t('sidebar.categories')}>
      {sections.map((section) => (
        <CategorySection
          key={section.id}
          section={section}
          isActive={isCategoryActive(section.id)}
          onToggle={() => toggleSection(section.id)}
        />
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// CategorySection — collapsible section with items
// ---------------------------------------------------------------------------

interface CategorySectionProps {
  section: CategorySection;
  isActive: boolean;
  onToggle: () => void;
}

function CategorySection({ section, isActive, onToggle }: CategorySectionProps) {
  const { t } = useI18n();

  return (
    <div className="mb-[var(--spacing-2)]">
      {/* Section header */}
      <NavLink
        to={`/${section.id}`}
        onClick={(e) => {
          // Prevent navigation if clicking the arrow
          if ((e.target as HTMLElement).closest('svg')) {
            e.preventDefault();
            onToggle();
          }
        }}
        className={({ isActive: linkIsActive }) => [
          'flex items-center justify-between w-full px-[var(--spacing-2)] py-[var(--spacing-1-5)]',
          'text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)]',
          'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
          'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
          'rounded-[var(--radius-default)]',
          linkIsActive || isActive
            ? 'text-accent-blue bg-bg-active'
            : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover',
        ].join(' ')}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="uppercase tracking-[var(--letter-spacing-wide)]">
          {t(section.titleKey)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          aria-expanded={section.isOpen}
          aria-label={`Toggle ${t(section.titleKey)} section`}
          className={[
            'p-1 rounded-sm hover:bg-bg-hover',
            'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
          ].join(' ')}
        >
          <svg
            className={[
              'w-3 h-3 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
              section.isOpen ? 'rotate-90' : '',
            ].join(' ')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </NavLink>

      {/* Section items will be populated by CategoryPage */}
      {section.isOpen && section.items.length > 0 && (
        <div className="ml-[var(--spacing-2)] mt-[var(--spacing-0-5)] flex flex-col gap-[var(--spacing-0-5)]">
          {section.items.map((item) => (
            <NavLink
              key={item}
              to={`/${section.id}/${item}`}
              className={({ isActive: linkIsActive }) => [
                'flex items-center gap-[var(--spacing-2)] px-[var(--spacing-2)] py-[var(--spacing-1-5)]',
                'text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)]',
                'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
                'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
                'rounded-[var(--radius-default)]',
                'border-l-2',
                linkIsActive
                  ? 'text-accent-blue bg-bg-active border-accent-blue'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-bg-hover hover:border-border-focused',
              ].join(' ')}
            >
              <span className="truncate">{item}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// useCategoryNav hook — keyboard navigation support
// ---------------------------------------------------------------------------

export function useCategoryNav() {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const handleKeyDown = (
    event: KeyboardEvent,
    itemCount: number,
    onActivate: (index: number) => void
  ) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < itemCount - 1 ? prev + 1 : prev;
          onActivate(next);
          return next;
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          onActivate(next);
          return next;
        });
        break;
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        onActivate(0);
        break;
      case 'End':
        event.preventDefault();
        setFocusedIndex(itemCount - 1);
        onActivate(itemCount - 1);
        break;
    }
  };

  return { focusedIndex, setFocusedIndex, handleKeyDown };
}
