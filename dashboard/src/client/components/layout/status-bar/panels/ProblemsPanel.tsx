import { useAgentStore } from '@/client/store/agent-store.js';
import type { ErrorEntry } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// ProblemsPanel -- error/warning list with severity icons
// ---------------------------------------------------------------------------
// Shows problems from agent store entries that have error content.
// Click navigates to the relevant agent/session (future: file:line).
// ---------------------------------------------------------------------------

interface ProblemEntry {
  id: string;
  severity: 'error' | 'warning';
  message: string;
  source: string;
  timestamp: string;
}

export function ProblemsPanel() {
  const entriesMap = useAgentStore((s) => s.entries);

  // Collect error entries across all processes
  const problems: ProblemEntry[] = Object.entries(entriesMap).flatMap(
    ([processId, entries]) =>
      entries
        .filter((e): e is ErrorEntry => e.type === 'error')
        .map((e) => ({
          id: e.id,
          severity: 'error' as const,
          message: e.message,
          source: processId,
          timestamp: e.timestamp,
        }))
  );

  if (problems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-[length:var(--font-size-xs)]">
        No problems detected.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border text-text-secondary text-left">
            <th className="p-[var(--spacing-1)] w-[24px]"></th>
            <th className="p-[var(--spacing-1)]">Message</th>
            <th className="p-[var(--spacing-1)] w-[140px]">Source</th>
          </tr>
        </thead>
        <tbody>
          {problems.map((p) => (
            <tr
              key={p.id}
              className="border-b border-border hover:bg-bg-hover cursor-pointer transition-colors duration-[var(--duration-fast)]"
            >
              <td className="p-[var(--spacing-1)] text-center">
                <SeverityIcon severity={p.severity} />
              </td>
              <td className="p-[var(--spacing-1)] text-text-primary break-all">
                {p.message}
              </td>
              <td className="p-[var(--spacing-1)] text-text-secondary truncate">
                {p.source}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: 'error' | 'warning' }) {
  if (severity === 'error') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-status-blocked">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="8" y1="4.5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="1" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-status-exploring">
      <path d="M8 1.5L14.5 13H1.5L8 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="8" y1="6" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="1" />
    </svg>
  );
}
