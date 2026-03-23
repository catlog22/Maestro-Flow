import { useExecutionStore } from '@/client/store/execution-store.js';
import { AGENT_DOT_COLORS, AGENT_LABELS } from '@/shared/constants.js';
import type { AgentType } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// MonitorTab -- slot grid, queue list, stats summary
// ---------------------------------------------------------------------------

function formatElapsed(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function MonitorTab() {
  const slots = useExecutionStore((s) => s.slots);
  const queue = useExecutionStore((s) => s.queue);
  const status = useExecutionStore((s) => s.supervisorStatus);

  const slotList = Object.values(slots);

  return (
    <div className="flex flex-col gap-[var(--spacing-4)] p-[var(--spacing-4)] h-full overflow-y-auto">
      {/* Stats summary */}
      <div className="flex items-center gap-[var(--spacing-6)]">
        <StatCard label="Dispatched" value={status?.stats.totalDispatched ?? 0} />
        <StatCard label="Completed" value={status?.stats.totalCompleted ?? 0} color="var(--color-accent-green)" />
        <StatCard label="Failed" value={status?.stats.totalFailed ?? 0} color="var(--color-accent-red)" />
        <StatCard label="Active" value={slotList.length} color="var(--color-accent-blue)" />
        <StatCard label="Queued" value={queue.length} />
        {status?.enabled != null && (
          <div className="flex items-center gap-[var(--spacing-1)]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: status.enabled ? 'var(--color-accent-green)' : 'var(--color-text-tertiary)' }}
            />
            <span className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-secondary)' }}>
              {status.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        )}
      </div>

      {/* Active slots grid */}
      <div>
        <div
          className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] mb-[var(--spacing-2)]"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Active Slots
        </div>
        {slotList.length === 0 ? (
          <div className="text-[length:var(--font-size-xs)] py-[var(--spacing-3)] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            No active executions
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[var(--spacing-2)]">
            {slotList.map((slot) => {
              const dotColor = AGENT_DOT_COLORS[slot.executor as AgentType] ?? 'var(--color-text-tertiary)';
              const label = AGENT_LABELS[slot.executor as AgentType] ?? slot.executor;
              return (
                <div
                  key={slot.processId}
                  className="flex items-center gap-[var(--spacing-3)] px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-sm)]"
                  style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                  <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] shrink-0" style={{ color: 'var(--color-text-primary)' }}>
                    {slot.issueId}
                  </span>
                  <span className="text-[length:var(--font-size-xs)] shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                    {label}
                  </span>
                  <span className="text-[length:var(--font-size-xs)] shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                    Turn {slot.turnNumber}/{slot.maxTurns}
                  </span>
                  <span className="text-[length:var(--font-size-xs)] ml-auto shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                    {formatElapsed(slot.startedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Queue list */}
      <div>
        <div
          className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] mb-[var(--spacing-2)]"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Queue ({queue.length})
        </div>
        {queue.length === 0 ? (
          <div className="text-[length:var(--font-size-xs)] py-[var(--spacing-3)] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            Queue is empty
          </div>
        ) : (
          <div className="flex flex-col gap-[var(--spacing-1)]">
            {queue.map((issueId, i) => (
              <div
                key={issueId}
                className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-3)] py-[var(--spacing-1)] rounded-[var(--radius-sm)]"
                style={{ background: 'var(--color-bg-secondary)' }}
              >
                <span className="text-[length:var(--font-size-xs)] w-5 text-right shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                  {i + 1}
                </span>
                <span className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-primary)' }}>
                  {issueId}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard -- small stat display
// ---------------------------------------------------------------------------

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span
        className="text-[length:var(--font-size-lg)] font-[var(--font-weight-medium)]"
        style={{ color: color ?? 'var(--color-text-primary)' }}
      >
        {value}
      </span>
      <span className="text-[length:var(--font-size-xs)]" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
    </div>
  );
}
