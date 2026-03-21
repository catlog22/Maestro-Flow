import { useCallback } from 'react';
import { useExecutionStore } from '@/client/store/execution-store.js';
import { sendWsMessage } from '@/client/hooks/useWebSocket.js';

// ---------------------------------------------------------------------------
// SupervisorStatusBar — bottom bar showing supervisor state
// ---------------------------------------------------------------------------

export function SupervisorStatusBar() {
  const status = useExecutionStore((s) => s.supervisorStatus);

  const handleToggle = useCallback(() => {
    sendWsMessage({
      action: 'supervisor:toggle',
      enabled: !status?.enabled,
    });
  }, [status?.enabled]);

  // Compute relative time for last tick
  const lastTickLabel = status?.lastTickAt
    ? formatRelative(status.lastTickAt)
    : 'never';

  return (
    <div className="flex items-center gap-[var(--spacing-3)] px-[var(--spacing-4)] py-[var(--spacing-1-5)] border-t border-border-divider bg-bg-secondary text-[length:var(--font-size-xs)] shrink-0">
      {/* Toggle indicator */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-[var(--spacing-1)] text-text-secondary hover:text-text-primary transition-colors"
      >
        <span
          className={[
            'w-2 h-2 rounded-full',
            status?.enabled ? 'bg-[#5A9E78]' : 'bg-text-tertiary',
          ].join(' ')}
        />
        <span className="font-[var(--font-weight-medium)]">
          Supervisor {status?.enabled ? 'ON' : 'OFF'}
        </span>
      </button>

      {status?.enabled && (
        <>
          <div className="w-px h-3 bg-border-divider" />

          <span className="text-text-secondary">
            Running: <span className="text-text-primary font-[var(--font-weight-medium)]">{status.running.length}</span>
          </span>

          <span className="text-text-secondary">
            Queued: <span className="text-text-primary font-[var(--font-weight-medium)]">{status.queued.length}</span>
          </span>

          {status.retrying.length > 0 && (
            <span className="text-[#B89540]">
              Retrying: <span className="font-[var(--font-weight-medium)]">{status.retrying.length}</span>
            </span>
          )}

          <span className="text-text-tertiary">
            Last tick: {lastTickLabel}
          </span>

          {status.stats.totalDispatched > 0 && (
            <>
              <div className="w-px h-3 bg-border-divider" />
              <span className="text-text-tertiary">
                {status.stats.totalCompleted}/{status.stats.totalDispatched} done
                {status.stats.totalFailed > 0 && (
                  <span className="text-[#C46555]"> ({status.stats.totalFailed} failed)</span>
                )}
              </span>
            </>
          )}
        </>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const secs = Math.floor(diffMs / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}
