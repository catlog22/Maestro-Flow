import { useBoardStore } from '@/client/store/board-store.js';

// ---------------------------------------------------------------------------
// SummaryBar -- bottom bar with aggregate stats for the pipeline board
// ---------------------------------------------------------------------------

export function SummaryBar() {
  const board = useBoardStore((s) => s.board);
  const phases = board?.phases ?? [];

  const phasesComplete = phases.filter((p) => p.status === 'completed').length;
  const phasesTotal = phases.length;
  const tasksComplete = phases.reduce((sum, p) => sum + p.execution.tasks_completed, 0);
  const tasksTotal = phases.reduce((sum, p) => sum + p.execution.tasks_total, 0);
  const pct = tasksTotal > 0 ? Math.round((tasksComplete / tasksTotal) * 100) : 0;
  const milestone = board?.project?.current_milestone ?? '';

  return (
    <div className="flex items-center gap-[var(--spacing-5)] px-[var(--spacing-5)] py-[var(--spacing-2)] border-t border-border bg-bg-secondary text-[12px] shrink-0">
      {milestone && (
        <span className="font-[var(--font-weight-semibold)] text-text-primary">{milestone}</span>
      )}
      <span className="text-text-secondary">
        Phases: <strong className="font-[var(--font-weight-semibold)] text-text-primary">{phasesComplete}/{phasesTotal}</strong> complete
      </span>
      <span className="text-text-secondary">
        Tasks: <strong className="font-[var(--font-weight-semibold)] text-text-primary">{tasksComplete}/{tasksTotal}</strong>
      </span>
      <div className="flex items-center gap-[var(--spacing-2)] w-36">
        <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%`, backgroundColor: 'var(--color-status-completed)' }}
          />
        </div>
        <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] text-text-secondary font-mono tabular-nums">
          {pct}%
        </span>
      </div>
    </div>
  );
}
