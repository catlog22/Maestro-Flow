import type { PhaseCard } from '@/shared/types.js';
import { useBoardStore } from '@/client/store/board-store.js';
import { STATUS_COLORS } from '@/shared/constants.js';
import PlayIcon from 'lucide-react/dist/esm/icons/play.js';

// ---------------------------------------------------------------------------
// ActiveExecutionPanel -- shows the current executing phase with wave details
// ---------------------------------------------------------------------------

export function ActiveExecutionPanel() {
  const phases = useBoardStore((s) => s.board?.phases ?? []);
  const executing = phases.find((p) => p.status === 'executing') ?? null;

  return (
    <div className="flex flex-col overflow-hidden border-r border-r-border-divider border-b border-b-border-divider">
      {/* Header */}
      <div className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-4)] py-[var(--spacing-2-5)] border-b border-border-divider shrink-0">
        <PlayIcon size={14} strokeWidth={2} className="text-text-tertiary" />
        <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] uppercase tracking-wider text-text-tertiary">
          Active Execution
        </span>
        {executing && executing.execution.current_wave > 0 && (
          <span
            className="ml-auto text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] px-[var(--spacing-1-5)] py-px rounded-full"
            style={{
              backgroundColor: 'rgba(184, 149, 64, 0.12)',
              color: STATUS_COLORS.executing,
            }}
          >
            Wave {executing.execution.current_wave}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-[var(--spacing-4)] py-[var(--spacing-3)]">
        {!executing ? (
          <div className="text-[length:var(--font-size-sm)] text-text-tertiary italic text-center py-[var(--spacing-6)]">
            No active execution
          </div>
        ) : (
          <ExecutionContent phase={executing} />
        )}
      </div>
    </div>
  );
}

function ExecutionContent({ phase }: { phase: PhaseCard }) {
  const { tasks_completed, tasks_total, current_wave } = phase.execution;
  const pct = tasks_total > 0 ? Math.round((tasks_completed / tasks_total) * 100) : 0;
  const color = STATUS_COLORS[phase.status];

  return (
    <>
      {/* Phase info */}
      <div className="flex items-center gap-[var(--spacing-2-5)] mb-[var(--spacing-3)]">
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[length:var(--font-size-base)] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {phase.phase}
        </div>
        <div>
          <div className="text-[length:var(--font-size-base)] font-bold text-text-primary">{phase.title}</div>
          {phase.goal && (
            <div className="text-[length:var(--font-size-xs)] text-text-tertiary">{phase.goal}</div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-[var(--spacing-3-5)]">
        <div className="h-1.5 bg-border rounded-full overflow-hidden mb-1">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%`, backgroundColor: 'var(--color-status-completed)' }}
          />
        </div>
        <div className="flex justify-between text-[length:var(--font-size-xs)] text-text-tertiary">
          <span>{tasks_completed} of {tasks_total} tasks complete</span>
          <span>{pct}%</span>
        </div>
      </div>

      {/* Wave info */}
      {current_wave > 0 && (
        <div className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary mb-[var(--spacing-1-5)]">
          Wave {current_wave}
        </div>
      )}
      {phase.plan.task_ids.length > 0 && (
        <div className="flex flex-col gap-1">
          {phase.plan.task_ids.map((taskId) => (
            <div
              key={taskId}
              className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-2-5)] py-[var(--spacing-1-5)] rounded-[var(--radius-md)] bg-bg-primary border border-border-divider text-[length:var(--font-size-sm)]"
            >
              <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-text-quaternary" />
              <span className="flex-1 text-text-primary font-[var(--font-weight-medium)] truncate">{taskId}</span>
              <span className="text-[length:var(--font-size-xs)] font-mono text-text-quaternary">{taskId}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
