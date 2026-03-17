import type { PhaseCard as PhaseCardType } from '@/shared/types.js';
import { useBoardStore } from '@/client/store/board-store.js';
import { StatusBadge } from '@/client/components/common/StatusBadge.js';
import { ProgressBar } from '@/client/components/common/ProgressBar.js';
import { useI18n } from '@/client/i18n/index.js';
import { STATUS_COLORS } from '@/shared/constants.js';

// ---------------------------------------------------------------------------
// PhaseCard — kanban card showing phase status, title, goal, progress, wave
// ---------------------------------------------------------------------------

/** Maps phase status to its CSS tint variable */
const TINT_VARS: Record<string, string> = {
  pending: 'var(--color-tint-pending)',
  exploring: 'var(--color-tint-exploring)',
  planning: 'var(--color-tint-planning)',
  executing: 'var(--color-tint-executing)',
  verifying: 'var(--color-tint-verifying)',
  testing: 'var(--color-tint-testing)',
  completed: 'var(--color-tint-completed)',
  blocked: 'var(--color-tint-blocked)',
};

interface PhaseCardProps {
  phase: PhaseCardType;
}

export function PhaseCard({ phase }: PhaseCardProps) {
  const { t } = useI18n();
  const setSelectedPhase = useBoardStore((s) => s.setSelectedPhase);
  const selectedPhase = useBoardStore((s) => s.selectedPhase);
  const isSelected = selectedPhase === phase.phase;

  function handleClick() {
    setSelectedPhase(isSelected ? null : phase.phase);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  const { tasks_completed, tasks_total, current_wave } = phase.execution;
  const waveLabel = t('kanban.wave');

  return (
    <article role="listitem">
      <div
        role="button"
        tabIndex={0}
        aria-label={t('kanban.phase_aria', {
          phase: phase.phase,
          title: phase.title,
          status: phase.status,
          completed: tasks_completed,
          total: tasks_total,
        })}
        aria-pressed={isSelected}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={[
          'rounded-[10px] px-[var(--spacing-4)] py-[var(--spacing-3)] space-y-[var(--spacing-2)] cursor-pointer',
          'transition-all duration-[var(--duration-normal)] ease-[var(--ease-spring)]',
          'hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-0.5',
          'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
          'active:scale-[0.98] active:shadow-sm active:duration-[var(--duration-fast)]',
          isSelected
            ? 'shadow-[inset_0_0_0_2px_var(--color-accent-blue)]'
            : '',
        ].join(' ')}
        style={{ backgroundColor: TINT_VARS[phase.status] ?? 'var(--color-tint-pending)' }}
      >
        {/* Row 1: Status badge + phase number */}
        <div className="flex items-center justify-between">
          <StatusBadge status={phase.status} cardVariant />
          <span className="text-[length:var(--font-size-xs)] font-mono text-text-tertiary">
            P-{String(phase.phase).padStart(2, '0')}
          </span>
        </div>

        {/* Row 2: Title */}
        <h4 className="text-[length:var(--font-size-base)] font-[var(--font-weight-semibold)] text-text-primary leading-[var(--line-height-tight)]">
          {phase.title}
        </h4>

        {/* Row 3: Goal (truncated to 2 lines) */}
        {phase.goal && (
          <p className="text-[length:var(--font-size-sm)] text-text-secondary leading-[var(--line-height-normal)] line-clamp-2">
            {phase.goal}
          </p>
        )}

        {/* Row 4: Progress bar */}
        {tasks_total > 0 && (
          <ProgressBar completed={tasks_completed} total={tasks_total} color={STATUS_COLORS[phase.status]} />
        )}

        {/* Row 5: Wave indicator (when executing) */}
        {phase.status === 'executing' && current_wave > 0 && (
          <div className="flex items-center gap-[var(--spacing-1-5)] text-[length:var(--font-size-xs)] text-status-executing">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-status-executing animate-pulse motion-reduce:animate-none" />
            <span>{waveLabel} {current_wave}</span>
          </div>
        )}
      </div>
    </article>
  );
}
