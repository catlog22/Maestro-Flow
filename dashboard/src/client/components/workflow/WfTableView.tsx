import { useMemo, useState, Fragment } from 'react';
import { useBoardStore } from '@/client/store/board-store.js';
import { StatusBadge } from '@/client/components/common/StatusBadge.js';
import { ProgressBar } from '@/client/components/common/ProgressBar.js';
import { STATUS_COLORS } from '@/shared/constants.js';
import type { SelectedKanbanItem } from '@/shared/types.js';
import { usePhaseTasks } from '@/client/hooks/usePhaseTasks.js';

// ---------------------------------------------------------------------------
// WfTableView — flat table of all workflow phases with expandable task rows
// ---------------------------------------------------------------------------

const TH = 'text-left px-[var(--spacing-3)] py-[var(--spacing-2)] text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-wide';

const STATUS_DOT_COLORS: Record<string, string> = {
  pending: 'var(--color-status-pending)',
  in_progress: 'var(--color-status-executing)',
  completed: 'var(--color-status-completed)',
  failed: 'var(--color-status-blocked)',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Queued',
  in_progress: 'Running',
  completed: 'Done',
  failed: 'Failed',
};

interface WfTableViewProps {
  onSelectTask?: (item: SelectedKanbanItem) => void;
}

function PhaseTaskSubRows({ phaseId, onSelectTask }: { phaseId: number; onSelectTask?: (item: SelectedKanbanItem) => void }) {
  const { tasks, loading } = usePhaseTasks(phaseId);

  if (loading) {
    return (
      <tr>
        <td colSpan={6} className="px-[var(--spacing-6)] py-[var(--spacing-2)] text-[length:var(--font-size-xs)] text-text-tertiary">
          Loading tasks...
        </td>
      </tr>
    );
  }

  if (tasks.length === 0) {
    return (
      <tr>
        <td colSpan={6} className="px-[var(--spacing-6)] py-[var(--spacing-2)] text-[length:var(--font-size-xs)] text-text-tertiary">
          No tasks
        </td>
      </tr>
    );
  }

  return (
    <>
      {tasks.map((task) => (
        <tr
          key={task.id}
          className="bg-[rgba(0,0,0,0.03)] border-t border-border-divider cursor-pointer hover:bg-bg-hover transition-colors"
          onClick={() => onSelectTask?.({ type: 'task', task, phaseId })}
        >
          <td className="px-[var(--spacing-3)] py-[var(--spacing-2)] pl-[var(--spacing-6)]">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: STATUS_DOT_COLORS[task.meta.status] ?? 'var(--color-status-pending)' }}
            />
          </td>
          <td className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-[length:var(--font-size-xs)] font-mono text-text-tertiary">
            {task.id}
          </td>
          <td colSpan={2} className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-[length:var(--font-size-xs)] text-text-primary">
            {task.title}
          </td>
          <td className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-center hidden sm:table-cell">
            <span className="text-[length:10px] text-text-tertiary tabular-nums">W{task.meta.wave}</span>
          </td>
          <td className="px-[var(--spacing-3)] py-[var(--spacing-2)] text-right hidden sm:table-cell">
            <span className="text-[length:10px] font-[var(--font-weight-medium)]" style={{ color: STATUS_DOT_COLORS[task.meta.status] ?? 'var(--color-text-tertiary)' }}>
              {STATUS_LABELS[task.meta.status] ?? task.meta.status}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}

export function WfTableView({ onSelectTask }: WfTableViewProps) {
  const phases = useBoardStore((s) => s.board?.phases ?? []);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

  const sorted = useMemo(() => [...phases].sort((a, b) => a.phase - b.phase), [phases]);

  function togglePhase(phaseNum: number) {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseNum)) next.delete(phaseNum);
      else next.add(phaseNum);
      return next;
    });
  }

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-[length:var(--font-size-sm)]">
        No phases available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Table header row with totals */}
      <div className="flex items-center gap-[var(--spacing-3)] px-[var(--spacing-4)] py-[var(--spacing-2-5)] border-b border-border-divider shrink-0 bg-bg-secondary">
        <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-primary">
          All Phases
        </span>
        <span className="text-[length:var(--font-size-xs)] text-text-tertiary bg-bg-card rounded-full px-[var(--spacing-1-5)] tabular-nums">
          {sorted.length}
        </span>
        <div className="ml-auto flex items-center gap-[var(--spacing-3)]">
          {(['executing', 'verifying', 'planning', 'completed'] as const).map((s) => {
            const count = sorted.filter((p) => p.status === s || (s === 'verifying' && p.status === 'testing')).length;
            if (count === 0) return null;
            return (
              <div key={s} className="flex items-center gap-[var(--spacing-1)]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                <span className="text-[length:10px] text-text-secondary tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-bg-secondary border-b border-border-divider">
              <th className={`${TH} w-[60px]`}>#</th>
              <th className={`${TH} w-[120px]`}>Status</th>
              <th className={TH}>Title</th>
              <th className={`${TH} hidden lg:table-cell`}>Goal</th>
              <th className={`${TH} w-[60px] text-center hidden sm:table-cell`}>Wave</th>
              <th className={`${TH} text-right w-[130px] hidden sm:table-cell`}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((phase, i) => {
              const { tasks_completed, tasks_total, current_wave } = phase.execution;
              const isExpanded = expandedPhases.has(phase.phase);
              const hasTasks = phase.plan.task_count > 0;
              return (
                <Fragment key={phase.phase}>
                  <tr
                    className={[
                      'border-t border-border-divider transition-colors',
                      i % 2 === 0 ? 'bg-bg-primary' : 'bg-[rgba(0,0,0,0.015)]',
                    ].join(' ')}
                  >
                    <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] text-[length:var(--font-size-xs)] font-mono text-text-tertiary whitespace-nowrap">
                      <div className="flex items-center gap-[var(--spacing-1)]">
                        {hasTasks && (
                          <button
                            type="button"
                            onClick={() => togglePhase(phase.phase)}
                            className="w-4 h-4 flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors"
                            aria-label={isExpanded ? 'Collapse tasks' : 'Expand tasks'}
                          >
                            <svg
                              className={`w-3 h-3 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                        )}
                        P-{String(phase.phase).padStart(2, '0')}
                      </div>
                    </td>
                    <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)]">
                      <StatusBadge status={phase.status} cardVariant />
                    </td>
                    <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] text-text-primary">
                      {phase.title}
                    </td>
                    <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] text-[length:var(--font-size-xs)] text-text-secondary hidden lg:table-cell max-w-[320px]">
                      <span className="line-clamp-1">{phase.goal}</span>
                    </td>
                    <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] text-center hidden sm:table-cell">
                      {phase.status === 'executing' && current_wave > 0 ? (
                        <span className="text-[length:10px] font-[var(--font-weight-semibold)] tabular-nums" style={{ color: STATUS_COLORS.executing }}>
                          W{current_wave}
                        </span>
                      ) : (
                        <span className="text-[length:var(--font-size-xs)] text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-[var(--spacing-3)] py-[var(--spacing-2-5)] hidden sm:table-cell">
                      {tasks_total > 0 ? (
                        <div className="flex items-center gap-[var(--spacing-2)] justify-end">
                          <div className="w-[56px]">
                            <ProgressBar completed={tasks_completed} total={tasks_total} color={STATUS_COLORS[phase.status]} />
                          </div>
                          <span className="text-[length:10px] text-text-tertiary tabular-nums w-[32px] text-right shrink-0">
                            {tasks_completed}/{tasks_total}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[length:var(--font-size-xs)] text-text-tertiary block text-right">—</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <PhaseTaskSubRows phaseId={phase.phase} onSelectTask={onSelectTask} />
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
