import { Clock } from 'lucide-react';

// ---------------------------------------------------------------------------
// TimelinePanel -- workspace activity events timeline
// ---------------------------------------------------------------------------
// - Lists recent workspace events in reverse chronological order
// - Placeholder for future event subscription integration
// - Empty state when no events are available
// ---------------------------------------------------------------------------

interface TimelineEvent {
  id: string;
  type: 'file-change' | 'agent-action' | 'session-event' | 'system';
  label: string;
  timestamp: string;
}

export function TimelinePanel() {
  // Static placeholder. Real data will come from workspace event subscriptions
  // and the WebSocket event bus.
  const events: TimelineEvent[] = [];

  if (events.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-[var(--spacing-3)] py-[var(--spacing-2)]">
        <h3 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary uppercase tracking-[var(--letter-spacing-wide)]">
          Timeline
        </h3>
      </div>
      <div className="flex-1 overflow-auto">
        <ul className="py-[var(--spacing-1)]">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-[var(--spacing-2)] px-[var(--spacing-3)] py-[var(--spacing-1)] text-[length:var(--font-size-xs)] text-text-secondary hover:bg-bg-tertiary transition-colors"
            >
              <TimelineDot type={event.type} />
              <div className="flex-1 min-w-0">
                <span className="truncate block">{event.label}</span>
                <span className="text-text-tertiary opacity-60">{event.timestamp}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TimelineDot({ type }: { type: TimelineEvent['type'] }) {
  const colorMap: Record<string, string> = {
    'file-change': 'bg-accent-blue',
    'agent-action': 'bg-accent-green',
    'session-event': 'bg-accent-purple',
    'system': 'bg-text-tertiary',
  };

  return (
    <div
      className={`w-[6px] h-[6px] rounded-full mt-[5px] shrink-0 ${colorMap[type] ?? 'bg-text-tertiary'}`}
    />
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-[var(--spacing-2)] text-text-tertiary">
      <Clock size={24} />
      <p className="text-[length:var(--font-size-xs)]">No recent activity</p>
      <p className="text-[length:var(--font-size-xs)] opacity-60">
        Workspace events will appear here
      </p>
    </div>
  );
}
