// ---------------------------------------------------------------------------
// KanbanTaskRow — compact inline task row for kanban phase expansion
// ---------------------------------------------------------------------------

/** Type badge color mapping */
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  feat: { bg: 'rgba(74,144,217,0.12)', text: 'var(--color-status-exploring)' },
  feature: { bg: 'rgba(74,144,217,0.12)', text: 'var(--color-status-exploring)' },
  fix: { bg: 'rgba(208,84,84,0.12)', text: 'var(--color-status-blocked)' },
  refac: { bg: 'rgba(139,107,191,0.12)', text: 'var(--color-status-planning)' },
  refactor: { bg: 'rgba(139,107,191,0.12)', text: 'var(--color-status-planning)' },
  docs: { bg: 'rgba(160,157,151,0.12)', text: 'var(--color-status-pending)' },
  test: { bg: 'rgba(91,141,184,0.12)', text: 'var(--color-status-testing)' },
};

/** Status chip color mapping */
const STATUS_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  in_progress: { bg: 'rgba(201,155,45,0.1)', text: 'var(--color-status-executing)' },
  running: { bg: 'rgba(201,155,45,0.1)', text: 'var(--color-status-executing)' },
  pending: { bg: 'rgba(160,157,151,0.1)', text: 'var(--color-status-pending)' },
  queued: { bg: 'rgba(160,157,151,0.1)', text: 'var(--color-status-pending)' },
  completed: { bg: 'rgba(61,155,111,0.1)', text: 'var(--color-status-completed)' },
  done: { bg: 'rgba(61,155,111,0.1)', text: 'var(--color-status-completed)' },
  failed: { bg: 'rgba(208,84,84,0.1)', text: 'var(--color-status-blocked)' },
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'Running',
  running: 'Running',
  pending: 'Queued',
  queued: 'Queued',
  completed: 'Done',
  done: 'Done',
  failed: 'Failed',
};

/** Short type label for display */
function shortType(type: string): string {
  const map: Record<string, string> = { feature: 'feat', refactor: 'refac' };
  return map[type] ?? type;
}

interface KanbanTaskRowProps {
  task: { id: string; title: string; type: string; status: string };
}

export function KanbanTaskRow({ task }: KanbanTaskRowProps) {
  const typeColor = TYPE_COLORS[task.type] ?? TYPE_COLORS[shortType(task.type)] ?? TYPE_COLORS.feat;
  const statusColor = STATUS_CHIP_COLORS[task.status] ?? STATUS_CHIP_COLORS.pending;
  const statusLabel = STATUS_LABELS[task.status] ?? task.status;

  return (
    <div className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-2-5)] py-[var(--spacing-1-5)] rounded-[var(--radius-default)] bg-bg-card text-[length:var(--font-size-xs)] cursor-pointer transition-colors duration-[var(--duration-fast)] hover:bg-bg-hover">
      {/* Task ID */}
      <span className="font-mono text-[length:10px] text-text-tertiary min-w-[60px] shrink-0">
        {task.id}
      </span>

      {/* Type badge */}
      <span
        className="text-[length:9px] font-[var(--font-weight-semibold)] uppercase px-[7px] py-[2px] rounded-full shrink-0"
        style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
      >
        {shortType(task.type)}
      </span>

      {/* Title */}
      <span className="flex-1 text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
        {task.title}
      </span>

      {/* Status chip */}
      <span
        className="text-[length:10px] font-[var(--font-weight-semibold)] px-[7px] py-[2px] rounded-full shrink-0"
        style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
      >
        {statusLabel}
      </span>
    </div>
  );
}
