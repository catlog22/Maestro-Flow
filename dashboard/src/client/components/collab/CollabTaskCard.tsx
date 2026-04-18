import type { CollabTask } from '@/shared/collab-types.js';
import {
  COLLAB_TASK_PRIORITY_COLORS,
  COLLAB_TASK_STATUS_COLORS,
} from '@/shared/collab-types.js';

// ---------------------------------------------------------------------------
// CollabTaskCard — compact card for task board column
// ---------------------------------------------------------------------------

export function CollabTaskCard({ task, onClick }: { task: CollabTask; onClick: () => void }) {
  const priorityColor = COLLAB_TASK_PRIORITY_COLORS[task.priority] || '#9ca3af';
  const statusColor = COLLAB_TASK_STATUS_COLORS[task.status] || '#9ca3af';
  const checkCount = task.check_log?.length || 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-2.5 rounded-md border border-border bg-bg-primary hover:border-text-tertiary transition-colors cursor-pointer"
    >
      {/* Row 1: priority badge + task ID */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: priorityColor }}
          title={task.priority}
        />
        <span className="text-[10px] text-text-quaternary font-mono">{task.id}</span>
        <div className="flex-1" />
        {task.tags.length > 0 && task.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="px-1 py-0 rounded text-[9px] bg-bg-tertiary text-text-tertiary"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Row 2: title */}
      <div className="text-[12px] text-text-primary font-medium leading-snug line-clamp-2 mb-1.5">
        {task.title}
      </div>

      {/* Row 3: assignee + check count */}
      <div className="flex items-center gap-2">
        {task.assignee ? (
          <div className="flex items-center gap-1">
            <span
              className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-semibold text-bg-primary"
              style={{ background: statusColor }}
            >
              {task.assignee.charAt(0).toUpperCase()}
            </span>
            <span className="text-[10px] text-text-secondary">{task.assignee}</span>
          </div>
        ) : (
          <span className="text-[10px] text-text-quaternary">Unassigned</span>
        )}
        {checkCount > 0 && (
          <span className="text-[10px] text-text-tertiary ml-auto">
            {checkCount} check{checkCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </button>
  );
}
