import type { TaskCard as TaskCardType, TaskType, TaskStatus } from '@/shared/types.js';
import { useI18n } from '@/client/i18n/index.js';

// ---------------------------------------------------------------------------
// TaskCard — compact card showing task ID, type, title, wave, status
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<TaskType, { bg: string; text: string }> = {
  feature: { bg: 'var(--color-status-bg-exploring)', text: 'var(--color-status-exploring)' },
  fix: { bg: 'var(--color-status-bg-blocked)', text: 'var(--color-status-blocked)' },
  refactor: { bg: 'var(--color-status-bg-planning)', text: 'var(--color-status-planning)' },
  test: { bg: 'var(--color-status-bg-testing)', text: 'var(--color-status-testing)' },
  docs: { bg: 'var(--color-status-bg-pending)', text: 'var(--color-status-pending)' },
};

/** Translation keys for each task status */
const TASK_STATUS_LABEL_KEYS: Record<TaskStatus, string> = {
  pending: 'taskStatus.pending',
  in_progress: 'taskStatus.in_progress',
  completed: 'taskStatus.completed',
  failed: 'taskStatus.failed',
};

/** Background and text colors for task status pill badges */
const TASK_STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
  pending: { bg: 'var(--color-status-bg-pending)', text: 'var(--color-status-pending)' },
  in_progress: { bg: 'var(--color-status-bg-executing)', text: 'var(--color-status-executing)' },
  completed: { bg: 'var(--color-status-bg-completed)', text: 'var(--color-status-completed)' },
  failed: { bg: 'var(--color-status-bg-blocked)', text: 'var(--color-status-blocked)' },
};

interface TaskCardProps {
  task: TaskCardType;
}

export function TaskCard({ task }: TaskCardProps) {
  const { t } = useI18n();
  const typeStyle = TYPE_STYLES[task.type] ?? TYPE_STYLES.feature;
  const statusLabel = t(TASK_STATUS_LABEL_KEYS[task.meta.status]);
  const waveLabel = t('kanban.wave');

  return (
    <div
      role="listitem"
      tabIndex={0}
      aria-label={`${task.type}: ${task.title}. Status: ${statusLabel}`}
      className={[
        'rounded-[var(--radius-default)] bg-bg-card px-[var(--spacing-3)] py-[var(--spacing-2)] space-y-[var(--spacing-1-5)] shadow-sm',
        'transition-all duration-[var(--duration-normal)] ease-[var(--ease-notion)]',
        'hover:-translate-y-px hover:shadow-md',
        'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
        'active:scale-[0.98] active:duration-[var(--duration-fast)]',
        'disabled:opacity-[var(--opacity-disabled)]',
      ].join(' ')}
    >
      {/* Row 1: ID badge + type chip */}
      <div className="flex items-center gap-[var(--spacing-2)]">
        <span className="text-[length:var(--font-size-xs)] font-mono font-[var(--font-weight-medium)] text-text-tertiary">
          {task.id}
        </span>
        <span
          className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] px-2 py-[var(--spacing-0-5)] rounded-full"
          style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
        >
          {task.type}
        </span>
      </div>

      {/* Row 2: Title */}
      <p className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] text-text-primary leading-snug line-clamp-1">
        {task.title}
      </p>

      {/* Row 3: Wave + status */}
      <div className="flex items-center justify-between text-[length:var(--font-size-xs)] text-text-tertiary">
        <span>{waveLabel} {task.meta.wave}</span>
        <span
          className="font-[var(--font-weight-medium)] px-2 py-[var(--spacing-0-5)] rounded-full"
          style={{
            backgroundColor: TASK_STATUS_COLORS[task.meta.status]?.bg ?? 'var(--color-status-bg-pending)',
            color: TASK_STATUS_COLORS[task.meta.status]?.text ?? 'var(--color-status-pending)',
          }}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
