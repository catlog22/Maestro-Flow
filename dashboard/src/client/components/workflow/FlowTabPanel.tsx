import { useState, useEffect } from 'react';
import { useBoardStore } from '@/client/store/board-store.js';
import { API_ENDPOINTS } from '@/shared/constants.js';
import { parseWorkflow } from '@/client/utils/parseWorkflow.js';
import type { WorkflowStep } from '@/client/utils/parseWorkflow.js';
import { FlowNode } from './FlowNode.js';

// ---------------------------------------------------------------------------
// FlowTabPanel — shows the step flow diagram for a selected phase
// ---------------------------------------------------------------------------

interface FlowTabPanelProps {
  phaseId: number | null;
}

// ---------------------------------------------------------------------------
// Arrow connector between flow nodes
// ---------------------------------------------------------------------------

function Arrow() {
  return (
    <div className="flex items-center shrink-0 px-1">
      <div className="w-6 h-0.5 bg-[var(--color-border)]" />
      <div
        style={{
          borderLeft: '6px solid var(--color-border)',
          borderTop: '4px solid transparent',
          borderBottom: '4px solid transparent',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FlowTabPanel({ phaseId }: FlowTabPanelProps) {
  const phases = useBoardStore((s) => s.board?.phases ?? []);
  const phase = phaseId !== null ? phases.find((p) => p.phase === phaseId) ?? null : null;

  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phase) {
      setSteps([]);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchWorkflow() {
      if (!phase) return;
      setLoading(true);
      setError(null);
      setSteps([]);

      // Build candidate paths from slug and title
      const slugFromSlug = phase.slug;
      const slugFromTitle = phase.title.toLowerCase().replace(/\s+/g, '-');
      const candidates = [
        `workflows/${slugFromSlug}.md`,
        `workflows/${slugFromTitle}.md`,
      ];

      // Deduplicate in case slug and derived title are the same
      const uniqueCandidates = Array.from(new Set(candidates));

      let content: string | null = null;

      for (const path of uniqueCandidates) {
        try {
          const res = await fetch(`${API_ENDPOINTS.ARTIFACTS}/${path}`);
          if (res.ok) {
            content = await res.text();
            break;
          }
        } catch {
          // Try next candidate
        }
      }

      if (cancelled) return;

      if (content === null) {
        setError('No workflow document found for this phase.');
        setLoading(false);
        return;
      }

      const parsed = parseWorkflow(content);
      setSteps(parsed);
      setLoading(false);
    }

    fetchWorkflow();

    return () => {
      cancelled = true;
    };
  // Depend on primitive phase identifiers — stable values that represent which phase is shown
  }, [phase?.phase, phase?.slug, phase?.title]);

  // Empty state — no phase selected
  if (!phase) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)] text-sm">
        Select a phase to view its workflow
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)] text-sm animate-pulse">
        Loading workflow...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        {/* Goal callout */}
        <div className="border-l-4 border-[var(--color-accent-blue)] bg-[var(--color-bg-secondary)] px-4 py-3 rounded-r-lg text-sm mb-6">
          <p className="font-medium text-[var(--color-text-secondary)] mb-1">Phase Goal</p>
          <p className="text-[var(--color-text-primary)]">{phase.goal}</p>
        </div>

        {/* Error state */}
        {error && (
          <div
            className="border-l-4 px-4 py-3 rounded-r-lg text-sm mb-6"
            style={{
              borderColor: 'var(--color-status-blocked)',
              backgroundColor: 'var(--color-status-bg-blocked)',
              color: 'var(--color-status-blocked)',
            }}
          >
            <p className="font-medium mb-1">Workflow Not Found</p>
            <p className="text-xs opacity-80">
              Could not locate a workflow document for phase &quot;{phase.title}&quot;.
              Expected at <code>workflows/{phase.slug}.md</code>.
            </p>
          </div>
        )}

        {/* Step flow */}
        {steps.length > 0 && (
          <div
            className="flex items-start gap-0 overflow-x-auto pb-4"
            role="list"
            aria-label={`Workflow steps for ${phase.title}`}
          >
            {steps.map((step, i) => (
              <div key={step.stepNumber} className="flex items-center">
                <FlowNode step={step} />
                {i < steps.length - 1 && <Arrow />}
              </div>
            ))}
          </div>
        )}

        {/* No steps parsed but no error — document exists but has no Step headings */}
        {steps.length === 0 && !error && (
          <p className="text-sm text-[var(--color-text-tertiary)] italic">
            No step headings found in the workflow document.
          </p>
        )}
      </div>
    </div>
  );
}
