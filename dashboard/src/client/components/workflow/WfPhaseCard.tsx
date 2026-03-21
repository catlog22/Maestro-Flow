import { useState } from 'react';
import type { PhaseCard, SelectedKanbanItem } from '@/shared/types.js';
import { StatusBadge } from '@/client/components/common/StatusBadge.js';
import { ProgressBar } from '@/client/components/common/ProgressBar.js';
import { STATUS_COLORS } from '@/shared/constants.js';
import { useBoardStore } from '@/client/store/board-store.js';
import { usePhaseTasks } from '@/client/hooks/usePhaseTasks.js';
import { KanbanTaskRow } from '@/client/components/kanban/TaskRow.js';

// ---------------------------------------------------------------------------
// WfPhaseCard -- workflow board card with tinted bg, status, progress, wave
// ---------------------------------------------------------------------------

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

interface WfPhaseCardProps {
  phase: PhaseCard;
  onSelectTask?: (item: SelectedKanbanItem) => void;
}

export function WfPhaseCard({ phase, onSelectTask }: WfPhaseCardProps) {
  const setSelectedPhase = useBoardStore((s) => s.setSelectedPhase);
  const [expanded, setExpanded] = useState(false);
  const { tasks, loading } = usePhaseTasks(expanded ? phase.phase : null);
  const { tasks_completed, tasks_total, current_wave } = phase.execution;
  const color = STATUS_COLORS[phase.status];
  const hasGaps = phase.verification.gaps.length > 0;
  const hasTasks = phase.plan.task_count > 0;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setSelectedPhase(phase.phase)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedPhase(phase.phase);
          }
        }}
        className="rounded-[10px] px-[var(--spacing-3-5)] py-[var(--spacing-3)] cursor-pointer transition-all duration-[var(--duration-normal)] ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]"
        style={{ backgroundColor: TINT_VARS[phase.status] ?? 'var(--color-tint-pending)' }}
      >
        {/* Top row: badge + expand toggle + ID */}
        <div className="flex items-center justify-between mb-[var(--spacing-1-5)]">
          <div className="flex items-center gap-[var(--spacing-1-5)]">
            {hasTasks && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="w-4 h-4 flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors"
                aria-label={expanded ? 'Collapse tasks' : 'Expand tasks'}
              >
                <svg
                  className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
            <StatusBadge status={phase.status} cardVariant />
          </div>
          <span className="text-[length:var(--font-size-xs)] font-mono text-text-tertiary">
            P-{String(phase.phase).padStart(2, '0')}
          </span>
        </div>

        {/* Title */}
        <div className="text-[length:var(--font-size-base)] font-[var(--font-weight-semibold)] text-text-primary mb-[var(--spacing-0-5)]">
          {phase.title}
        </div>

        {/* Goal */}
        {phase.goal && (
          <p className="text-[12px] text-text-secondary leading-[var(--line-height-normal)] line-clamp-2 mb-[var(--spacing-2)]">
            {phase.goal}
          </p>
        )}

        {/* Progress */}
        {tasks_total > 0 && (
          <ProgressBar completed={tasks_completed} total={tasks_total} color={color} />
        )}

        {/* Wave indicator */}
        {phase.status === 'executing' && current_wave > 0 && (
          <div className="flex items-center gap-[var(--spacing-1-5)] text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] mt-[var(--spacing-1-5)]" style={{ color }}>
            <span className="inline-block w-[5px] h-[5px] rounded-full animate-pulse motion-reduce:animate-none" style={{ backgroundColor: color }} />
            Wave {current_wave} active
          </div>
        )}

        {/* Verification gaps */}
        {hasGaps && (
          <div
            className="inline-flex items-center gap-[var(--spacing-1)] mt-[var(--spacing-1-5)] text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] px-[var(--spacing-2)] py-[var(--spacing-0-5)] rounded-full"
            style={{ backgroundColor: 'rgba(196, 101, 85, 0.1)', color: 'var(--color-status-blocked)' }}
          >
            {phase.verification.gaps.length} Gap{phase.verification.gaps.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Expanded task list */}
      {expanded && (
        <div className="mt-[var(--spacing-1)] flex flex-col gap-[var(--spacing-1)]">
          {loading ? (
            <div className="text-[length:var(--font-size-xs)] text-text-tertiary px-[var(--spacing-3)] py-[var(--spacing-2)]">
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-[length:var(--font-size-xs)] text-text-tertiary px-[var(--spacing-3)] py-[var(--spacing-2)]">
              No tasks
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelectTask?.({ type: 'task', task, phaseId: phase.phase })}
              >
                <KanbanTaskRow task={{ id: task.id, title: task.title, type: task.type, status: task.meta.status }} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
