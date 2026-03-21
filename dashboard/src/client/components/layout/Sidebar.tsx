import { useEffect, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useBoardStore } from '@/client/store/board-store.js';
import { useIssueStore } from '@/client/store/issue-store.js';
import { STATUS_COLORS } from '@/shared/constants.js';
import type { PhaseCard } from '@/shared/types.js';
import { useI18n } from '@/client/i18n/index.js';

// ---------------------------------------------------------------------------
// Sidebar — view navigation (NavLink) + phase list with status-colored dots
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  path: string;
  labelKey: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Kanban', path: '/kanban', labelKey: 'nav.kanban' },
  { label: 'Artifacts', path: '/artifacts', labelKey: 'nav.artifacts' },
  { label: 'Chat', path: '/chat', labelKey: 'nav.chat' },
  { label: 'Workflow', path: '/workflow', labelKey: 'nav.workflow' },
  { label: 'Requirement', path: '/requirement', labelKey: 'nav.requirement' },
];

const EMPTY_PHASES: PhaseCard[] = [];

const BASE_NAV_CLASSES = [
  'flex items-center gap-[var(--spacing-2)] px-[var(--spacing-2)] py-[var(--spacing-1-5)] rounded-[var(--radius-default)] text-left text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] w-full',
  'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
].join(' ');

const ACTIVE_NAV_CLASSES = 'bg-bg-active text-text-primary border-l-2 border-l-accent-blue';
const INACTIVE_NAV_CLASSES = 'text-text-secondary hover:text-text-primary hover:bg-bg-hover';

export function Sidebar() {
  const { t } = useI18n();
  const phases = useBoardStore((s) => s.board?.phases ?? EMPTY_PHASES);
  const selectedPhase = useBoardStore((s) => s.selectedPhase);
  const setSelectedPhase = useBoardStore((s) => s.setSelectedPhase);
  const issues = useIssueStore((s) => s.issues);
  const fetchIssues = useIssueStore((s) => s.fetchIssues);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void fetchIssues();
  }, [fetchIssues]);

  const issueCounts = useMemo(() => {
    const counts = { open: 0, in_progress: 0, resolved: 0, total: 0 };
    for (const issue of issues) {
      counts.total++;
      if (issue.status in counts) counts[issue.status as keyof typeof counts]++;
    }
    return counts;
  }, [issues]);

  const isKanbanView = location.pathname === '/kanban' || location.pathname === '/';

  return (
    <aside
      role="navigation"
      aria-label={t('nav.views')}
      className="w-[var(--size-sidebar-width)] bg-bg-secondary border-r border-border overflow-y-auto shrink-0"
    >
      {/* View navigation */}
      <div className="px-[var(--spacing-3)] pt-[var(--spacing-3)] pb-[var(--spacing-2)] border-b border-border-divider">
        <h2 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-[var(--letter-spacing-wide)] mb-[var(--spacing-2)]">
          {t('nav.views')}
        </h2>
        <nav className="flex flex-col gap-[var(--spacing-0-5)]">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${BASE_NAV_CLASSES} ${isActive ? ACTIVE_NAV_CLASSES : INACTIVE_NAV_CLASSES}`
              }
            >
              <span className="truncate">{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Issues summary */}
      {issues.length > 0 && (
        <div className="px-[var(--spacing-3)] py-[var(--spacing-2)] border-b border-border-divider">
          <h2 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-[var(--letter-spacing-wide)] mb-[var(--spacing-2)]">
            Issues
          </h2>
          <button
            type="button"
            onClick={() => navigate('/kanban')}
            className={`${BASE_NAV_CLASSES} ${INACTIVE_NAV_CLASSES}`}
          >
            <span className="truncate">{issueCounts.total} issues</span>
            {issueCounts.open > 0 && (
              <span className="text-[length:10px] text-text-tertiary ml-auto">{issueCounts.open} open</span>
            )}
          </button>
        </div>
      )}

      {/* Phase list */}
      <div className="px-[var(--spacing-3)] py-[var(--spacing-3)]">
        <h2 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-[var(--letter-spacing-wide)] mb-[var(--spacing-2)]">
          {t('sidebar.phases')}
        </h2>

        <nav className="flex flex-col gap-[var(--spacing-0-5)]" aria-label="Project phases">
          {phases.map((phase) => (
            <PhaseItem
              key={phase.phase}
              phase={phase}
              selected={selectedPhase === phase.phase}
              onSelect={() => {
                setSelectedPhase(selectedPhase === phase.phase ? null : phase.phase);
              }}
            />
          ))}
        </nav>

        {phases.length === 0 && (
          <p className="text-[length:var(--font-size-xs)] text-text-secondary italic px-[var(--spacing-1)]">
            {t('sidebar.no_phases_loaded')}
          </p>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// PhaseItem — single row in the sidebar
// ---------------------------------------------------------------------------

function PhaseItem({
  phase,
  selected,
  onSelect,
}: {
  phase: PhaseCard;
  selected: boolean;
  onSelect: () => void;
}) {
  const dotColor = STATUS_COLORS[phase.status];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={[
        'flex items-center gap-[var(--spacing-2)] px-[var(--spacing-2)] py-[var(--spacing-1-5)] rounded-[var(--radius-default)] text-left text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] w-full',
        'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'disabled:opacity-[var(--opacity-disabled)] disabled:pointer-events-none',
        selected
          ? 'bg-bg-active text-text-primary border-l-2 border-l-accent-blue'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
      ].join(' ')}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        aria-hidden="true"
        style={{ backgroundColor: dotColor }}
      />
      <span className="truncate">
        {phase.phase}. {phase.title}
      </span>
    </button>
  );
}
