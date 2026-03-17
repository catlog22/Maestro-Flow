import { useEffect } from 'react';
import { useBoardStore } from '@/client/store/board-store.js';
import { PhaseListItem } from './PhaseListItem.js';

// ---------------------------------------------------------------------------
// PhaseSidebar — left panel showing project info + scrollable phase list
// ---------------------------------------------------------------------------

interface PhaseSidebarProps {
  selectedPhaseId: number | null;
  onSelect: (id: number) => void;
}

export function PhaseSidebar({ selectedPhaseId, onSelect }: PhaseSidebarProps) {
  const phases = useBoardStore((s) => s.board?.phases ?? []);
  const project = useBoardStore((s) => s.board?.project ?? null);

  // Auto-select first phase when phases load and nothing is selected
  useEffect(() => {
    if (selectedPhaseId === null && phases.length > 0) {
      onSelect(phases[0].phase);
    }
  }, [phases, selectedPhaseId, onSelect]);

  const summary = project?.phases_summary;
  const totalPhases = summary?.total ?? phases.length;
  const completedPhases = summary?.completed ?? 0;
  const progressPercent = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0;

  return (
    <aside className="w-[280px] shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col overflow-hidden">
      {/* Header: project name + status + progress */}
      <div className="px-[var(--spacing-3)] pt-[var(--spacing-3)] pb-[var(--spacing-2)] border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center justify-between gap-[var(--spacing-2)] mb-[var(--spacing-1)]">
          <h2
            className="text-sm font-semibold text-[var(--color-text-primary)] truncate"
            title={project?.project_name ?? ''}
          >
            {project?.project_name ?? 'No project loaded'}
          </h2>
          {project && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-active)] text-[var(--color-text-secondary)] shrink-0">
              {project.status}
            </span>
          )}
        </div>

        {/* Overall phase progress */}
        {summary && (
          <div className="mt-[var(--spacing-2)]">
            <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mb-1">
              <span>Phases</span>
              <span>{completedPhases}/{totalPhases}</span>
            </div>
            <div className="h-1 rounded-full bg-[var(--color-bg-hover)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-accent-blue)] transition-all duration-[var(--duration-normal)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Phase list */}
      <nav className="flex-1 overflow-y-auto py-[var(--spacing-1)]" aria-label="Project phases">
        {phases.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)] italic px-[var(--spacing-3)] py-[var(--spacing-2)]">
            No phases loaded
          </p>
        ) : (
          phases.map((phase) => (
            <PhaseListItem
              key={phase.phase}
              phase={phase}
              selected={selectedPhaseId === phase.phase}
              onSelect={() => onSelect(phase.phase)}
            />
          ))
        )}
      </nav>
    </aside>
  );
}
