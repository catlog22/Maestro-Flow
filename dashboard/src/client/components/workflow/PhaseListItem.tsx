import type { PhaseCard } from '@/shared/types.js';
import { STATUS_COLORS } from '@/shared/constants.js';

// ---------------------------------------------------------------------------
// PhaseListItem — single phase row in PhaseSidebar
// ---------------------------------------------------------------------------

interface PhaseListItemProps {
  phase: PhaseCard;
  selected: boolean;
  onSelect: () => void;
}

export function PhaseListItem({ phase, selected, onSelect }: PhaseListItemProps) {
  const dotColor = STATUS_COLORS[phase.status];
  const tasksCompleted = phase.execution.tasks_completed;
  const tasksTotal = phase.execution.tasks_total;
  const progressPercent = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={[
        'flex flex-col gap-[var(--spacing-1)] px-[var(--spacing-2)] py-[var(--spacing-1-5)] text-left w-full',
        'transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        selected
          ? 'bg-[var(--color-bg-active)] border-l-2 border-l-[var(--color-accent-blue)]'
          : 'hover:bg-[var(--color-bg-hover)]',
      ].join(' ')}
    >
      {/* Top row: dot + badge + title + task count */}
      <div className="flex items-center gap-[var(--spacing-2)]">
        {/* Status dot */}
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          aria-hidden="true"
          style={{ backgroundColor: dotColor }}
        />

        {/* Phase number badge */}
        <span className="bg-[var(--color-bg-active)] text-xs font-mono px-1 rounded shrink-0">
          {phase.phase}
        </span>

        {/* Title */}
        <span
          className={[
            'text-sm font-medium truncate flex-1',
            selected ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]',
          ].join(' ')}
        >
          {phase.title}
        </span>

        {/* Task count */}
        <span className="text-xs text-[var(--color-text-tertiary)] shrink-0">
          {tasksCompleted}/{tasksTotal}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-[var(--color-bg-hover)] overflow-hidden ml-[calc(var(--spacing-2)*2+0.625rem)]">
        <div
          className="h-full rounded-full transition-all duration-[var(--duration-normal)]"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: dotColor,
          }}
        />
      </div>
    </button>
  );
}
