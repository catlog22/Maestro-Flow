import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2.js';
import Circle from 'lucide-react/dist/esm/icons/circle.js';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js';
import Ban from 'lucide-react/dist/esm/icons/ban.js';
import type { WorkflowStep } from '@/client/utils/parseWorkflow.js';

// ---------------------------------------------------------------------------
// FlowNode — visual node for a single workflow step in the flow diagram
// ---------------------------------------------------------------------------

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

interface FlowNodeProps {
  step: WorkflowStep;
  status?: StepStatus;
  isActive?: boolean;
}

function getContainerClasses(status: StepStatus): string {
  const base =
    'flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg border-2 min-w-[140px] max-w-[180px] transition-all duration-200 shrink-0';
  switch (status) {
    case 'completed':
      return `${base} border-green-500 bg-green-950/20`;
    case 'in_progress':
      return `${base} border-[var(--color-accent-blue)] bg-blue-950/20`;
    case 'blocked':
      return `${base} border-red-500 bg-red-950/20`;
    default:
      return `${base} border-[var(--color-border)] bg-[var(--color-bg-secondary)]`;
  }
}

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 size={18} className="text-green-500 shrink-0" />;
    case 'in_progress':
      return (
        <Loader2
          size={18}
          className="text-[var(--color-accent-blue)] shrink-0 animate-spin"
          style={{ animationDuration: '2s' }}
        />
      );
    case 'blocked':
      return <Ban size={18} className="text-red-500 shrink-0" />;
    default:
      return <Circle size={18} className="text-[var(--color-text-tertiary)] shrink-0" />;
  }
}

export function FlowNode({ step, status = 'pending', isActive = false }: FlowNodeProps) {
  return (
    <div
      className={getContainerClasses(status)}
      style={isActive ? { boxShadow: '0 0 0 2px var(--color-accent-blue)' } : undefined}
      role="listitem"
      aria-label={`Step ${step.stepNumber}: ${step.title}`}
    >
      {/* Status icon */}
      <StatusIcon status={status} />

      {/* Step number badge */}
      <span className="text-xs font-mono bg-[var(--color-bg-active)] px-2 py-0.5 rounded text-[var(--color-text-secondary)]">
        Step {step.stepNumber}
      </span>

      {/* Title */}
      <p className="text-sm font-medium text-center text-[var(--color-text-primary)] line-clamp-2">
        {step.title}
      </p>
    </div>
  );
}
