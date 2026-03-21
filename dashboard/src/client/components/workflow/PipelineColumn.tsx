import type { PhaseCard, SelectedKanbanItem } from '@/shared/types.js';
import { WfPhaseCard } from './WfPhaseCard.js';

// ---------------------------------------------------------------------------
// PipelineColumn -- board column with colored header dot, status name, cards
// ---------------------------------------------------------------------------

interface PipelineColumnProps {
  status: string;
  color: string;
  phases: PhaseCard[];
  label: string;
  onSelectTask?: (item: SelectedKanbanItem) => void;
}

export function PipelineColumn({ color, phases, label, onSelectTask }: PipelineColumnProps) {
  return (
    <div className="flex flex-col min-w-[220px] flex-1 bg-bg-secondary rounded-[12px] overflow-hidden">
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
        {phases.map((phase) => (
          <WfPhaseCard key={phase.phase} phase={phase} onSelectTask={onSelectTask} />
        ))}
      </div>
    </div>
  );
}
