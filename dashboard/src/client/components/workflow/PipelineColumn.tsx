import { useState } from 'react';
import type { PhaseCard, SelectedKanbanItem } from '@/shared/types.js';
import { WfPhaseCard } from './WfPhaseCard.js';

// ---------------------------------------------------------------------------
// PipelineColumn -- board column with colored header dot, status name, cards
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 4;

interface PipelineColumnProps {
  status: string;
  color: string;
  phases: PhaseCard[];
  label: string;
  onSelectTask?: (item: SelectedKanbanItem) => void;
}

export function PipelineColumn({ color, phases, label, onSelectTask }: PipelineColumnProps) {
  const [expanded, setExpanded] = useState(false);
  // Phases with tasks first, empty ones sink to overflow
  const sorted = [...phases].sort((a, b) => (b.plan.task_count || 0) - (a.plan.task_count || 0));
  const hasOverflow = sorted.length > MAX_VISIBLE;
  const visible = expanded || !hasOverflow ? sorted : sorted.slice(0, MAX_VISIBLE);
  const hiddenCount = sorted.length - MAX_VISIBLE;

  return (
    <div className="flex flex-col w-[280px] shrink-0 bg-bg-secondary rounded-[12px] overflow-hidden">
      {/* Column header */}
      <div className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-3-5)] py-[var(--spacing-2-5)]">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[12px] font-[var(--font-weight-semibold)] text-text-primary">
          {label}
        </span>
        <span className="text-[length:var(--font-size-xs)] text-text-tertiary bg-bg-card px-[var(--spacing-1-5)] rounded-full">
          {phases.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-[var(--spacing-2)] pb-[var(--spacing-2)] flex flex-col gap-[var(--spacing-2)]">
        {visible.map((phase) => (
          <WfPhaseCard key={phase.phase} phase={phase} onSelectTask={onSelectTask} />
        ))}

        {/* Show more / Show less toggle */}
        {hasOverflow && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] text-text-tertiary hover:text-text-secondary py-[var(--spacing-1-5)] cursor-pointer transition-colors text-center"
          >
            {expanded ? 'Show less' : `+${hiddenCount} more`}
          </button>
        )}
      </div>
    </div>
  );
}
