// ---------------------------------------------------------------------------
// ProgressBar — horizontal bar with fraction label (e.g., "2/4 tasks")
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  completed: number;
  total: number;
  /** Optional color override (default: status-completed green) */
  color?: string;
}

export function ProgressBar({ completed, total, color }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const fillColor = color ?? 'var(--color-status-completed)';
  const isComplete = completed >= total && total > 0;

  return (
    <div className="flex items-center gap-[var(--spacing-2)] w-full">
      <div
        className="flex-1 h-[5px] rounded-full bg-border overflow-hidden"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${completed} of ${total} tasks completed`}
      >
        <div
          className={[
            'h-full rounded-full min-w-[6px]',
            'transition-[width] duration-[var(--duration-smooth)] ease-[var(--ease-out)]',
            'motion-reduce:transition-none',
            isComplete ? 'motion-safe:animate-[progress-complete_0.3s_ease-out]' : '',
          ].join(' ')}
          style={{ width: `${pct}%`, backgroundColor: fillColor }}
        />
      </div>
      <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] text-text-secondary font-mono whitespace-nowrap tabular-nums min-w-[32px]">
        {completed}/{total}
      </span>
    </div>
  );
}
