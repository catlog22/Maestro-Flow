import { useBoardStore } from '@/client/store/board-store.js';
import { STATUS_COLORS } from '@/shared/constants.js';
import type { PhaseCard } from '@/shared/types.js';

// ---------------------------------------------------------------------------
// ActivityStrip -- horizontal scrollable recent activity feed
// ---------------------------------------------------------------------------

interface ActivityItem {
  color: string;
  time: string;
  text: string;
}

function deriveActivities(phases: PhaseCard[]): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const p of phases) {
    const color = STATUS_COLORS[p.status];
    const label = `P-${String(p.phase).padStart(2, '0')} ${p.title}`;

    if (p.status === 'executing' && p.execution.current_wave > 0) {
      items.push({ color, time: '', text: `Wave ${p.execution.current_wave} active -- ${label}` });
    }
    if (p.status === 'verifying' && p.verification.gaps.length > 0) {
      items.push({
        color: STATUS_COLORS.blocked,
        time: '',
        text: `${p.verification.gaps.length} gap(s) -- ${label}`,
      });
    }
    if (p.status === 'completed') {
      items.push({ color, time: '', text: `Completed -- ${label}` });
    }
  }

  return items.slice(0, 6);
}

export function ActivityStrip() {
  const phases = useBoardStore((s) => s.board?.phases ?? []);
  const activities = deriveActivities(phases);

  if (activities.length === 0) return null;

  return (
    <div className="col-span-full flex items-center gap-[var(--spacing-4)] px-[var(--spacing-4)] py-[var(--spacing-2)] border-t border-border bg-bg-secondary overflow-x-auto shrink-0">
      <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] uppercase tracking-wider text-text-quaternary whitespace-nowrap">
        Activity
      </span>
      {activities.map((item, i) => (
        <span key={i} className="flex items-center gap-[var(--spacing-1-5)] text-[length:var(--font-size-xs)] text-text-secondary whitespace-nowrap shrink-0">
          <span
            className="inline-block w-[5px] h-[5px] rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          {item.text}
          {i < activities.length - 1 && (
            <span className="inline-block w-px h-3.5 bg-border-divider ml-[var(--spacing-4)]" />
          )}
        </span>
      ))}
    </div>
  );
}
