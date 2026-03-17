import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import ShieldX from 'lucide-react/dist/esm/icons/shield-x.js';
import type { ApprovalResponseEntry } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// ApprovalResponse -- inline badge showing approval decision
// ---------------------------------------------------------------------------

export function ApprovalResponse({ entry }: { entry: ApprovalResponseEntry }) {
  const Icon = entry.allowed ? ShieldCheck : ShieldX;
  const color = entry.allowed ? 'var(--color-accent-green)' : 'var(--color-accent-red)';
  const bg = entry.allowed ? 'var(--color-status-bg-completed)' : 'var(--color-status-bg-blocked)';
  const label = entry.allowed ? 'Allowed' : 'Denied';

  return (
    <div className="flex items-center justify-center">
      <span
        className="inline-flex items-center gap-[var(--spacing-1-5)] rounded-[var(--radius-full)] px-[var(--spacing-3)] py-[var(--spacing-1)] text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)]"
        style={{ backgroundColor: bg, color }}
      >
        <Icon size={12} />
        {label}
      </span>
    </div>
  );
}
