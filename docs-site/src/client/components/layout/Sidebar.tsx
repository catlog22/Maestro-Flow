import { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '@/client/i18n/index.js';
import { inventoryData, getCommandsByCategory, getCommandSlug, type Command, type Skill } from '@/client/routes/route-config.js';

// ---------------------------------------------------------------------------
// Sidebar — collapsible category navigation
// ---------------------------------------------------------------------------

interface CategorySection {
  id: string;
  titleKey: string;
  commands: Command[];
  claudeSkills: Skill[];
  codexSkills: Skill[];
  isOpen: boolean;
}

export function Sidebar() {
  const { t } = useI18n();
  const location = useLocation();

  // Build sections from inventory data
  const defaultSections: CategorySection[] = useMemo(() => {
    return inventoryData.categories.map((cat) => ({
      id: cat.id,
      titleKey: `categories.${cat.id.replace('-', '_')}`,
      commands: getCommandsByCategory(cat.id),
      claudeSkills: inventoryData.claude_skills.filter((s) => s.category === cat.id),
      codexSkills: inventoryData.codex_skills.filter((s) => s.category === cat.id),
      isOpen: ['pipeline', 'spec', 'quality'].includes(cat.id), // Default open for main categories
    }));
  }, []);

  const [sections, setSections] = useState<CategorySection[]>(defaultSections);

  // Check if a category or item is currently active
  const isActivePath = (categoryId: string, itemSlug?: string): boolean => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    if (pathParts[0] === categoryId) {
      if (itemSlug) {
        return pathParts[1] === itemSlug;
      }
      return true;
    }
    return false;
  };

  const toggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === id ? { ...section, isOpen: !section.isOpen } : section
      )
    );
  };

  const expandAll = () => {
    setSections((prev) => prev.map((s) => ({ ...s, isOpen: true })));
  };

  const collapseAll = () => {
    setSections((prev) => prev.map((s) => ({ ...s, isOpen: false })));
  };

  return (
    <aside
      role="navigation"
      aria-label={t('sidebar.categories')}
      className="w-[var(--size-sidebar-width)] bg-bg-secondary border-r border-border overflow-y-auto shrink-0"
    >
      {/* Expand/Collapse controls */}
      <div className="flex items-center justify-between px-[var(--spacing-3)] py-[var(--spacing-2)] border-b border-border">
        <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-[var(--letter-spacing-wide)]">
          {t('sidebar.categories')}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={expandAll}
            aria-label={t('sidebar.expand_all')}
            className={[
              'p-1 rounded-sm hover:bg-bg-hover',
              'transition-all duration-[var(--duration-fast)]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
              'text-text-tertiary hover:text-text-secondary',
            ].join(' ')}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={collapseAll}
            aria-label={t('sidebar.collapse_all')}
            className={[
              'p-1 rounded-sm hover:bg-bg-hover',
              'transition-all duration-[var(--duration-fast)]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
              'text-text-tertiary hover:text-text-secondary',
            ].join(' ')}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Category sections */}
      <nav className="px-[var(--spacing-3)] py-[var(--spacing-3)]" aria-label="Command categories">
        {sections.map((section) => (
          <CategorySection
            key={section.id}
            section={section}
            isActive={isActivePath(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </nav>
    </aside>
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
          if ((e.target as HTMLElement).closest('button')) {
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
        {(section.commands.length > 0 || section.claudeSkills.length > 0 || section.codexSkills.length > 0) && (
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
        )}
      </NavLink>

      {/* Section items */}
      {section.isOpen && (
        <div className="ml-[var(--spacing-2)] mt-[var(--spacing-0-5)] flex flex-col gap-[var(--spacing-0-5)]">
          {/* Commands */}
          {section.commands.map((cmd) => (
            <SidebarItem
              key={cmd.name}
              category={section.id}
              item={getCommandSlug(cmd.name)}
              type="command"
            />
          ))}

          {/* Claude Skills */}
          {section.claudeSkills.map((skill) => (
            <SidebarItem
              key={skill.name}
              category="skills"
              item={skill.name}
              type="claude-skill"
            />
          ))}

          {/* Codex Skills */}
          {section.codexSkills.map((skill) => (
            <SidebarItem
              key={skill.name}
              category="codex"
              item={skill.name}
              type="codex-skill"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarItem — individual navigation item
// ---------------------------------------------------------------------------

interface SidebarItemProps {
  category: string;
  item: string;
  type: 'command' | 'claude-skill' | 'codex-skill';
}

function SidebarItem({ category, item, type }: SidebarItemProps) {
  const href = `/${category}/${item}`;
  const location = useLocation();
  const isActive = location.pathname === href;

  // Get icon based on type
  const getIcon = () => {
    switch (type) {
      case 'command':
        return (
          <svg className="w-3 h-3 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'claude-skill':
        return (
          <svg className="w-3 h-3 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case 'codex-skill':
        return (
          <svg className="w-3 h-3 text-accent-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
    }
  };

  return (
    <NavLink
      to={href}
      className={[
        'flex items-center gap-[var(--spacing-2)] px-[var(--spacing-2)] py-[var(--spacing-1-5)]',
        'text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)]',
        'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'rounded-[var(--radius-default)]',
        'border-l-2',
        isActive
          ? 'text-accent-blue bg-bg-active border-accent-blue'
          : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-bg-hover hover:border-border-focused',
      ].join(' ')}
    >
      {getIcon()}
      <span className="truncate">{item}</span>
    </NavLink>
  );
}


