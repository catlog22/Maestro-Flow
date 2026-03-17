import Activity from 'lucide-react/dist/esm/icons/activity.js';
import type { StatusChangeEntry } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// StatusChange -- inline status change badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  spawning: 'var(--color-status-exploring)',
  running:  'var(--color-status-executing)',
  paused:   'var(--color-status-pending)',
  stopping: 'var(--color-accent-orange)',
  stopped:  'var(--color-status-pending)',
  error:    'var(--color-accent-red)',
};

const STATUS_BG: Record<string, string> = {
  spawning: 'var(--color-status-bg-exploring)',
  running:  'var(--color-status-bg-executing)',
  paused:   'var(--color-status-bg-pending)',
  stopping: 'var(--color-status-bg-verifying)',
  stopped:  'var(--color-status-bg-pending)',
  error:    'var(--color-status-bg-blocked)',
};

export function StatusChange({ entry }: { entry: StatusChangeEntry }) {
  const color = STATUS_COLORS[entry.status] ?? 'var(--color-text-tertiary)';
  const bg = STATUS_BG[entry.status] ?? 'var(--color-bg-secondary)';

  return (
    <div className="flex items-center justify-center gap-[var(--spacing-2)] py-[var(--spacing-1-5)]">
      <span className="flex-1 max-w-[80px] h-[1px]" style={{ backgroundColor: 'var(--color-border-divider)' }} />
      <span
        className="inline-flex items-center gap-[5px] rounded-[var(--radius-full)] px-[10px] py-[2px] text-[10px] font-semibold"
        style={{ backgroundColor: bg, color }}
      >
        <Activity size={10} strokeWidth={2} />
        {entry.status}
        {entry.reason && (
          <span className="text-text-tertiary">-- {entry.reason}</span>
        )}
      </span>
      <span className="flex-1 max-w-[80px] h-[1px]" style={{ backgroundColor: 'var(--color-border-divider)' }} />
    </div>
  );
}
