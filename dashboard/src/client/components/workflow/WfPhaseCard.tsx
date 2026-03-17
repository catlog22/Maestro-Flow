import type { PhaseCard } from '@/shared/types.js';
import { StatusBadge } from '@/client/components/common/StatusBadge.js';
import { ProgressBar } from '@/client/components/common/ProgressBar.js';
import { STATUS_COLORS } from '@/shared/constants.js';
import { useBoardStore } from '@/client/store/board-store.js';

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
}

export function WfPhaseCard({ phase }: WfPhaseCardProps) {
  const setSelectedPhase = useBoardStore((s) => s.setSelectedPhase);
  const { tasks_completed, tasks_total, current_wave } = phase.execution;
  const color = STATUS_COLORS[phase.status];
  const hasGaps = phase.verification.gaps.length > 0;

  return (
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
      {/* Top row: badge + ID */}
      <div className="flex items-center justify-between mb-[var(--spacing-1-5)]">
        <StatusBadge status={phase.status} cardVariant />
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
  );
}
