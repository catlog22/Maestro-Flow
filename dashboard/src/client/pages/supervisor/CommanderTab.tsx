import { useExecutionStore } from '@/client/store/execution-store.js';
import { sendWsMessage } from '@/client/hooks/useWebSocket.js';

// ---------------------------------------------------------------------------
// CommanderTab -- commander state panel + assessment + decision history
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  idle: 'var(--color-text-tertiary)',
  thinking: 'var(--color-accent-blue)',
  dispatching: 'var(--color-accent-green)',
  paused: 'var(--color-accent-orange, #B89540)',
};

export function CommanderTab() {
  const commanderState = useExecutionStore((s) => s.commanderState);
  const recentDecisions = useExecutionStore((s) => s.recentDecisions);

  const handleStart = () => sendWsMessage({ action: 'commander:start' });
  const handlePause = () => sendWsMessage({ action: 'commander:pause' });
  const handleStop = () => sendWsMessage({ action: 'commander:stop' });

  const isActive = commanderState?.status === 'thinking' || commanderState?.status === 'dispatching';
  const isPaused = commanderState?.status === 'paused';

  const latestDecision = recentDecisions.length > 0 ? recentDecisions[recentDecisions.length - 1] : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel -- commander state */}
      <div
        className="w-[300px] shrink-0 flex flex-col gap-[var(--spacing-4)] p-[var(--spacing-4)] overflow-y-auto"
        style={{ borderRight: '1px solid var(--color-border)' }}
      >
        {/* Status */}
        <div>
          <div className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] mb-[var(--spacing-2)]" style={{ color: 'var(--color-text-primary)' }}>
            Commander
          </div>
          <div className="flex items-center gap-[var(--spacing-2)] mb-[var(--spacing-3)]">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[commanderState?.status ?? 'idle'] ?? 'var(--color-text-tertiary)' }}
            />
            <span className="text-[length:var(--font-size-sm)]" style={{ color: 'var(--color-text-primary)' }}>
              {commanderState?.status ?? 'idle'}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-[var(--spacing-2)]">
            {!isActive && !isPaused && (
              <button
                type="button"
                onClick={handleStart}
                className="px-[var(--spacing-3)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] font-medium"
                style={{ background: 'var(--color-accent-green)', color: '#fff' }}
              >
                Start
              </button>
            )}
            {isActive && (
              <button
                type="button"
                onClick={handlePause}
                className="px-[var(--spacing-3)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] font-medium"
                style={{ background: 'var(--color-accent-orange, #B89540)', color: '#fff' }}
              >
                Pause
              </button>
            )}
            {(isActive || isPaused) && (
              <button
                type="button"
                onClick={handleStop}
                className="px-[var(--spacing-3)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] font-medium"
                style={{ background: 'var(--color-accent-red)', color: '#fff' }}
              >
                Stop
              </button>
            )}
            {isPaused && (
              <button
                type="button"
                onClick={handleStart}
                className="px-[var(--spacing-3)] py-[var(--spacing-1)] rounded-[var(--radius-sm)] text-[length:var(--font-size-xs)] font-medium"
                style={{ background: 'var(--color-accent-blue)', color: '#fff' }}
              >
                Resume
              </button>
            )}
          </div>
        </div>

        {/* Metrics */}
        {commanderState && (
          <div className="flex flex-col gap-[var(--spacing-1)]">
            <MetricRow label="Ticks" value={String(commanderState.tickCount)} />
            <MetricRow label="Workers" value={String(commanderState.activeWorkers)} />
            <MetricRow label="Session" value={commanderState.sessionId} />
            {commanderState.lastTickAt && (
              <MetricRow label="Last Tick" value={new Date(commanderState.lastTickAt).toLocaleTimeString()} />
            )}
          </div>
        )}

        {/* Latest assessment */}
        {latestDecision?.assessment && (
          <div>
            <div className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] mb-[var(--spacing-1)]" style={{ color: 'var(--color-text-secondary)' }}>
              Latest Assessment
            </div>
            {latestDecision.assessment.observations.length > 0 && (
              <div className="mb-[var(--spacing-2)]">
                <div className="text-[length:var(--font-size-xs)] mb-[var(--spacing-1)]" style={{ color: 'var(--color-text-tertiary)' }}>
                  Observations
                </div>
                {latestDecision.assessment.observations.map((obs, i) => (
                  <div key={i} className="text-[length:var(--font-size-xs)] pl-[var(--spacing-2)]" style={{ color: 'var(--color-text-secondary)' }}>
                    - {obs}
                  </div>
                ))}
              </div>
            )}
            {latestDecision.assessment.risks.length > 0 && (
              <div>
                <div className="text-[length:var(--font-size-xs)] mb-[var(--spacing-1)]" style={{ color: 'var(--color-text-tertiary)' }}>
                  Risks
                </div>
                {latestDecision.assessment.risks.map((risk, i) => (
                  <div key={i} className="text-[length:var(--font-size-xs)] pl-[var(--spacing-2)]" style={{ color: 'var(--color-accent-red)' }}>
                    - {risk}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right panel -- decision history */}
      <div className="flex-1 flex flex-col overflow-hidden p-[var(--spacing-4)]">
        <div className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] mb-[var(--spacing-2)]" style={{ color: 'var(--color-text-primary)' }}>
          Decision History ({recentDecisions.length})
        </div>
        {recentDecisions.length === 0 ? (
          <div className="text-[length:var(--font-size-xs)] py-[var(--spacing-3)] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            No decisions yet
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col gap-[var(--spacing-1)]">
            {recentDecisions.slice().reverse().map((decision) => {
              const time = new Date(decision.timestamp);
              const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}`;
              return (
                <div
                  key={decision.id}
                  className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-2)] py-[var(--spacing-1)] rounded-[var(--radius-sm)]"
                  style={{ background: 'var(--color-bg-secondary)' }}
                >
                  <span className="text-[length:var(--font-size-xs)] shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>{timeStr}</span>
                  <span className="text-[length:var(--font-size-xs)] shrink-0" style={{ color: 'var(--color-text-secondary)' }}>{decision.trigger}</span>
                  <span className="text-[length:var(--font-size-xs)] shrink-0" style={{ color: 'var(--color-text-primary)' }}>
                    {decision.actions.length} action{decision.actions.length !== 1 ? 's' : ''}
                  </span>
                  {decision.deferred.length > 0 && (
                    <span className="text-[length:var(--font-size-xs)] shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                      ({decision.deferred.length} deferred)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricRow
// ---------------------------------------------------------------------------

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[length:var(--font-size-xs)]">
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  );
}
