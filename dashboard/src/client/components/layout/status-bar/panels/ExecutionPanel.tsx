import { useExecutionStore } from '@/client/store/execution-store.js';
import { useAgentStore } from '@/client/store/agent-store.js';

// ---------------------------------------------------------------------------
// ExecutionPanel -- active execution status with wave progress display
// ---------------------------------------------------------------------------
// Shows execution slots from ExecutionStore and active agent processes.
// ---------------------------------------------------------------------------

export function ExecutionPanel() {
  const slots = useExecutionStore((s) => s.slots);
  const supervisorStatus = useExecutionStore((s) => s.supervisorStatus);
  const processes = useAgentStore((s) => s.processes);

  const slotList = Object.values(slots);
  const activeProcesses = Object.values(processes).filter(
    (p) => p.status === 'running'
  );

  return (
    <div className="h-full overflow-y-auto p-[var(--spacing-2)] text-[11px]">
      {/* Supervisor status */}
      {supervisorStatus && (
        <div className="mb-[var(--spacing-2)] pb-[var(--spacing-2)] border-b border-border">
          <div className="font-medium text-text-primary mb-[var(--spacing-1)]">Supervisor</div>
          <div className="flex items-center gap-[var(--spacing-2)] text-text-secondary">
            <span
              className={[
                'w-[6px] h-[6px] rounded-full shrink-0',
                supervisorStatus.enabled ? 'bg-status-completed' : 'bg-text-secondary/40',
              ].join(' ')}
            />
            <span>{supervisorStatus.enabled ? 'Active' : 'Paused'}</span>
            {supervisorStatus.lastTickAt && (
              <span className="ml-auto text-text-secondary/60">
                Last tick: {formatRelative(supervisorStatus.lastTickAt)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Running slots from supervisor */}
      {supervisorStatus && supervisorStatus.running.length > 0 && (
        <div className="mb-[var(--spacing-2)] pb-[var(--spacing-2)] border-b border-border">
          <div className="font-medium text-text-primary mb-[var(--spacing-1)]">
            Running ({supervisorStatus.running.length})
          </div>
          {supervisorStatus.running.map((slot) => (
            <div key={slot.processId} className="flex items-center gap-[var(--spacing-2)] text-text-secondary py-[var(--spacing-0-5)]">
              <span className="w-[6px] h-[6px] rounded-full shrink-0 bg-status-exploring animate-pulse" />
              <span className="truncate">{slot.issueId}</span>
              <span className="ml-auto">Turn {slot.turnNumber}/{slot.maxTurns}</span>
            </div>
          ))}
        </div>
      )}

      {/* Execution slots */}
      {slotList.length > 0 && (
        <div className="mb-[var(--spacing-2)] pb-[var(--spacing-2)] border-b border-border">
          <div className="font-medium text-text-primary mb-[var(--spacing-1)]">
            Execution Slots ({slotList.length})
          </div>
          {slotList.map((slot) => (
            <div key={slot.processId} className="flex items-center gap-[var(--spacing-2)] text-text-secondary py-[var(--spacing-0-5)]">
              <span className="w-[6px] h-[6px] rounded-full shrink-0 bg-status-exploring animate-pulse" />
              <span className="truncate">{slot.issueId}</span>
              <span className="ml-auto">{slot.executor}</span>
            </div>
          ))}
        </div>
      )}

      {/* Active agents */}
      {activeProcesses.length > 0 && (
        <div>
          <div className="font-medium text-text-primary mb-[var(--spacing-1)]">
            Active Agents ({activeProcesses.length})
          </div>
          {activeProcesses.map((proc) => (
            <div key={proc.id} className="flex items-center gap-[var(--spacing-2)] text-text-secondary py-[var(--spacing-0-5)]">
              <span className="w-[6px] h-[6px] rounded-full shrink-0 bg-status-exploring animate-pulse" />
              <span className="truncate">{proc.type}</span>
              <span className="ml-auto">{proc.status}</span>
            </div>
          ))}
        </div>
      )}

      {slotList.length === 0 && activeProcesses.length === 0 && !supervisorStatus && (
        <div className="flex items-center justify-center h-full text-text-secondary text-[length:var(--font-size-xs)]">
          No active executions.
        </div>
      )}
    </div>
  );
}

function formatRelative(timestamp: string): string {
  const ts = new Date(timestamp).getTime();
  const diff = Date.now() - ts;
  if (isNaN(diff)) return '';
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
}
