import { useAgentStore } from '@/client/store/agent-store.js';
import type { NormalizedEntry } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// OutputPanel -- agent execution log viewer
// ---------------------------------------------------------------------------
// Shows streaming log entries from the agent store.
// Renders only the last 1000 lines across all processes.
// ---------------------------------------------------------------------------

const MAX_LINES = 1000;

/** Extract display text from a NormalizedEntry */
function getEntryText(entry: NormalizedEntry): string {
  switch (entry.type) {
    case 'assistant_message':
    case 'user_message':
    case 'thinking':
      return entry.content;
    case 'error':
      return entry.message;
    case 'command_exec':
      return `${entry.command}${entry.output ? `: ${entry.output}` : ''}`;
    case 'file_change':
      return `[${entry.action}] ${entry.path}`;
    case 'tool_use':
      return `${entry.name}(${JSON.stringify(entry.input).slice(0, 80)})`;
    case 'status_change':
      return `Status: ${entry.status}`;
    case 'token_usage':
      return `Tokens: +${entry.inputTokens}/${entry.outputTokens}`;
    case 'approval_request':
      return `Approval: ${entry.toolName}`;
    case 'approval_response':
      return `Approval ${entry.allowed ? 'granted' : 'denied'}`;
    default:
      return '';
  }
}

export function OutputPanel() {
  const entriesMap = useAgentStore((s) => s.entries);

  // Flatten all entries across processes, sort by timestamp
  const allEntries: NormalizedEntry[] = Object.values(entriesMap)
    .flat()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-MAX_LINES);

  if (allEntries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-[length:var(--font-size-xs)]">
        No output yet.
      </div>
    );
  }

  return (
    <div
      role="log"
      aria-live="polite"
      className="h-full overflow-y-auto p-[var(--spacing-2)] font-mono text-[11px] leading-[1.5] text-text-secondary"
    >
      {allEntries.map((entry, idx) => {
        const text = getEntryText(entry);
        if (!text) return null;
        return (
          <div key={entry.id ?? idx} className="flex gap-[var(--spacing-2)]">
            <span className="text-text-secondary/50 shrink-0">
              {formatTime(entry.timestamp)}
            </span>
            <span className="break-all">{text}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
