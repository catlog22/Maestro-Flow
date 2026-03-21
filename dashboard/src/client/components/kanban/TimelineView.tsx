import { useState } from 'react';
import { useBoardStore } from '@/client/store/board-store.js';
import { STATUS_COLORS } from '@/shared/constants.js';
import { ProgressBar } from '@/client/components/common/ProgressBar.js';
import type { SelectedKanbanItem } from '@/shared/types.js';
import { usePhaseTasks } from '@/client/hooks/usePhaseTasks.js';

// ---------------------------------------------------------------------------
// TimelineView — gantt-style horizontal bars with week ruler and today marker
// ---------------------------------------------------------------------------

interface TimelineViewProps {
  onSelectPhase: (id: number) => void;
  onSelectTask?: (item: SelectedKanbanItem) => void;
}

const WEEK_COUNT = 6;
const WEEK_LABELS = Array.from({ length: WEEK_COUNT }, (_, i) => `Week ${i + 1}`);

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

function TimelineTaskRows({ phaseId, onSelectTask }: { phaseId: number; onSelectTask?: (item: SelectedKanbanItem) => void }) {
  const { tasks, loading } = usePhaseTasks(phaseId);

  if (loading) {
    return (
      <div
        className="grid items-center py-[var(--spacing-1)] border-b border-border-divider"
        style={{ gridTemplateColumns: '180px 1fr' }}
      >
        <div className="pl-[var(--spacing-6)] text-[length:var(--font-size-xs)] text-text-tertiary">Loading...</div>
        <div />
      </div>
    );
  }

  if (tasks.length === 0) return null;

  return (
    <>
      {tasks.map((task) => (
        <div
          key={task.id}
          className="grid items-center py-[var(--spacing-1)] border-b border-border-divider bg-[rgba(0,0,0,0.02)] cursor-pointer hover:bg-bg-hover transition-colors duration-[var(--duration-fast)]"
          style={{ gridTemplateColumns: '180px 1fr' }}
          onClick={() => onSelectTask?.({ type: 'task', task, phaseId })}
        >
          <div className="flex items-center gap-[var(--spacing-2)] pl-[var(--spacing-6)] text-[length:var(--font-size-xs)]">
            <span
              className="w-[6px] h-[6px] rounded-full shrink-0"
              style={{ backgroundColor: STATUS_DOT_COLORS[task.meta.status] ?? 'var(--color-status-pending)' }}
            />
            <span className="font-mono text-[length:10px] text-text-tertiary shrink-0">{task.id}</span>
            <span className="text-text-secondary truncate">{task.title}</span>
            <span className="ml-auto pr-[var(--spacing-3)] text-[length:10px] font-[var(--font-weight-medium)] shrink-0" style={{ color: STATUS_DOT_COLORS[task.meta.status] ?? 'var(--color-text-tertiary)' }}>
              {STATUS_LABELS[task.meta.status] ?? task.meta.status}
            </span>
          </div>
          <div />
        </div>
      ))}
    </>
  );
}

export function TimelineView({ onSelectPhase, onSelectTask }: TimelineViewProps) {
  const board = useBoardStore((s) => s.board);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

  if (!board || board.phases.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-[length:var(--font-size-sm)]">
        No phases to display
      </div>
    );
  }

  const phases = board.phases;
  const totalPhases = phases.length;

  // Compute overall progress
  const totalTasks = phases.reduce((sum, p) => sum + p.execution.tasks_total, 0);
  const completedTasks = phases.reduce((sum, p) => sum + p.execution.tasks_completed, 0);
  const overallPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Calculate "today" position as a percentage based on first executing phase progress
  const executingPhase = phases.find((p) => p.status === 'executing');
  const executingIndex = executingPhase ? phases.indexOf(executingPhase) : -1;
  const todayPct = executingIndex >= 0 && executingPhase
    ? (() => {
        const barStart = (executingIndex / totalPhases) * 100;
        const barWidth = (1 / totalPhases) * 100;
        const phaseProgress = executingPhase.execution.tasks_total > 0
          ? executingPhase.execution.tasks_completed / executingPhase.execution.tasks_total
          : 0;
        return barStart + barWidth * phaseProgress;
      })()
    : -1;

  function togglePhase(phaseNum: number) {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseNum)) next.delete(phaseNum);
      else next.add(phaseNum);
      return next;
    });
  }

  return (
    <div className="p-[var(--spacing-4)] h-full overflow-auto">
      {/* Header: label + week ruler */}
      <div
        className="grid border-b border-border pb-[var(--spacing-2)] mb-[var(--spacing-1)]"
        style={{ gridTemplateColumns: '180px 1fr' }}
      >
        <span className="text-[length:11px] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-[0.04em]">
          Phase
        </span>
        <div className="flex justify-between">
          {WEEK_LABELS.map((w) => (
            <span key={w} className="text-[length:10px] text-text-tertiary">
              {w}
            </span>
          ))}
        </div>
      </div>

      {/* Phase rows */}
      {phases.map((phase, i) => {
        const color = STATUS_COLORS[phase.status];
        const barLeft = (i / totalPhases) * 100;
        const barWidth = (1 / totalPhases) * 100;
        const progress = phase.execution.tasks_total > 0
          ? phase.execution.tasks_completed / phase.execution.tasks_total
          : 0;
        // Dim future phases
        const opacity = phase.status === 'pending' ? 0.5 : phase.status === 'completed' ? 1 : 0.85;
        const hasTasks = phase.plan.task_count > 0;
        const isExpanded = expandedPhases.has(phase.phase);

        return (
          <div key={phase.phase}>
            <div
              className="grid items-center py-[var(--spacing-1-5)] border-b border-border-divider cursor-pointer hover:bg-bg-hover transition-colors duration-[var(--duration-fast)]"
              style={{ gridTemplateColumns: '180px 1fr' }}
              onClick={() => onSelectPhase(phase.phase)}
            >
              {/* Label */}
              <div className="flex items-center gap-[var(--spacing-2)] text-[length:var(--font-size-xs)]">
                {hasTasks && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); togglePhase(phase.phase); }}
                    className="w-4 h-4 flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors shrink-0"
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
                {!hasTasks && <span className="w-4 shrink-0" />}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="font-[var(--font-weight-medium)] text-text-primary truncate">
                  {phase.title}
                </span>
                <span className="ml-auto pr-[var(--spacing-3)] font-mono text-[length:10px] text-text-tertiary">
                  {phase.execution.tasks_completed}/{phase.execution.tasks_total}
                </span>
              </div>

              {/* Track */}
              <div className="relative h-7 bg-bg-secondary rounded-[var(--radius-default)] overflow-visible">
                <div
                  className="absolute top-1 h-5 rounded-[var(--radius-default)] flex items-center px-[var(--spacing-2)] text-[length:10px] font-[var(--font-weight-semibold)] text-white transition-[width] duration-300 ease-[var(--ease-out)]"
                  style={{
                    left: `${barLeft}%`,
                    width: `${barWidth}%`,
                    backgroundColor: color,
                    opacity,
                  }}
                >
                  {/* Progress inner fill */}
                  {progress > 0 && progress < 1 && (
                    <div
                      className="absolute top-0 left-0 h-full rounded-[var(--radius-default)] opacity-30 bg-white"
                      style={{ width: `${progress * 100}%` }}
                    />
                  )}
                  <span className="relative z-[1] whitespace-nowrap">
                    P-{String(phase.phase).padStart(2, '0')}
                    {progress > 0 && progress < 1 ? ` (${Math.round(progress * 100)}%)` : ''}
                  </span>
                </div>

                {/* Today marker — only render on the executing phase's row */}
                {todayPct >= 0 && executingPhase?.phase === phase.phase && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-[var(--color-status-blocked)] z-[5] rounded-sm"
                    style={{ left: `${todayPct}%` }}
                  >
                    <span className="absolute -top-[18px] -left-3 text-[length:9px] font-[var(--font-weight-semibold)] text-[var(--color-status-blocked)]">
                      Today
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded task rows */}
            {isExpanded && (
              <TimelineTaskRows phaseId={phase.phase} onSelectTask={onSelectTask} />
            )}
          </div>
        );
      })}

      {/* Summary bar */}
      <div className="mt-[var(--spacing-5)] pt-[var(--spacing-3)] border-t border-border flex items-center gap-[var(--spacing-5)]">
        <span className="text-[length:var(--font-size-xs)] text-text-secondary">
          <strong className="font-[var(--font-weight-semibold)] text-text-primary">Overall:</strong>{' '}
          {completedTasks}/{totalTasks} tasks complete ({overallPct}%)
        </span>
        <div className="w-[200px]">
          <ProgressBar completed={completedTasks} total={totalTasks} />
        </div>
      </div>
    </div>
  );
}
