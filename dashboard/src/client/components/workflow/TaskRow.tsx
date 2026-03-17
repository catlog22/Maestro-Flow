import type { TaskCard, TaskStatus } from '@/shared/types.js';

// ---------------------------------------------------------------------------
// TaskRow — single task row in the TASKS tab list
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: TaskCard;
  onClick: () => void;
}

const STATUS_CHIP: Record<TaskStatus, string> = {
  pending: 'bg-[var(--color-bg-hover)] text-[var(--color-text-tertiary)]',
  in_progress: 'bg-blue-950/40 text-blue-400',
  completed: 'bg-green-950/40 text-green-400',
  failed: 'bg-red-950/40 text-red-400',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  failed: 'Failed',
};

export function TaskRow({ task, onClick }: TaskRowProps) {
  const status = task.meta.status;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 p-3 w-full hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors duration-[var(--duration-fast)]"
    >
      {/* Wave badge */}
      <span className="bg-[var(--color-bg-active)] text-[var(--color-text-tertiary)] font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0">
        W{task.meta.wave}
      </span>

      {/* Task ID */}
      <span className="font-mono text-xs bg-blue-950/30 text-blue-400 px-1.5 py-0.5 rounded shrink-0">
        {task.id}
      </span>

      {/* Title */}
      <span className="text-sm font-medium text-[var(--color-text-primary)] flex-1 text-left line-clamp-1">
        {task.title}
      </span>

      {/* Status chip */}
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${STATUS_CHIP[status]}`}>
        {STATUS_LABELS[status]}
      </span>

      {/* Type tag */}
      <span className="text-[10px] text-[var(--color-text-tertiary)] shrink-0 hidden sm:block">
        {task.action}
      </span>
    </button>
  );
}
