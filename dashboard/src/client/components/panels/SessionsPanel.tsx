import { memo, useMemo, useCallback } from 'react';
import { useAgentStore } from '@/client/store/agent-store.js';
import { useLayoutContext, useLayoutSelector } from '@/client/components/layout/LayoutContext.js';
import type { AgentProcess, AgentProcessStatus } from '@/shared/agent-types.js';
import type { TabSession, EditorGroupNode, EditorGroupLeaf } from '@/client/types/layout-types.js';

// ---------------------------------------------------------------------------
// SessionsPanel -- Side Bar panel listing all agent sessions
// ---------------------------------------------------------------------------
// - Registered in panel-registry with id='sessions'
// - Groups sessions by status: active (running/spawning), paused, stopped/error
// - Each session row: process name, status dot, timestamp
// - Click opens in focused group; if tab already exists, focuses that pane
// ---------------------------------------------------------------------------

/** Status group definitions for sorting */
const STATUS_GROUPS: { label: string; statuses: AgentProcessStatus[] }[] = [
  { label: 'Active', statuses: ['running', 'spawning'] },
  { label: 'Paused', statuses: ['paused', 'stopping'] },
  { label: 'Stopped', statuses: ['stopped', 'error'] },
];

/** Status dot color mapping */
const STATUS_DOT_COLORS: Record<AgentProcessStatus, string> = {
  spawning: 'var(--color-accent-blue)',
  running: 'var(--color-accent-green, #4caf50)',
  paused: 'var(--color-accent-yellow)',
  stopping: 'var(--color-accent-orange)',
  stopped: 'var(--color-text-tertiary)',
  error: 'var(--color-accent-red, #e53935)',
};

/** Collect all leaf nodes from the editor tree */
function collectLeaves(node: EditorGroupNode): EditorGroupLeaf[] {
  if (node.type === 'leaf') return [node];
  return [...collectLeaves(node.first), ...collectLeaves(node.second)];
}

/** Format timestamp to HH:MM */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Get a short display name from the process */
function getProcessLabel(proc: AgentProcess): string {
  const prompt = proc.config.prompt;
  if (prompt.length <= 60) return prompt;
  return prompt.slice(0, 57) + '...';
}

export function SessionsPanel() {
  const processes = useAgentStore((s) => s.processes);
  const { state, dispatch } = useLayoutContext();
  const focusedGroupId = useLayoutSelector((s) => s.focusedGroupId);

  // Group and sort processes
  const groupedSessions = useMemo(() => {
    const allProcesses = Object.values(processes).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

    return STATUS_GROUPS.map((group) => ({
      label: group.label,
      sessions: allProcesses.filter((p) => group.statuses.includes(p.status)),
    })).filter((g) => g.sessions.length > 0);
  }, [processes]);

  // Click handler: open session in focused group or activate existing tab
  const handleSessionClick = useCallback(
    (proc: AgentProcess) => {
      const leaves = collectLeaves(state.editorArea);

      // Check if a tab with this process already exists in any group
      for (const leaf of leaves) {
        const existingTab = leaf.tabs.find((t) => t.ref === proc.id);
        if (existingTab) {
          // Focus the group and activate the tab
          dispatch({ type: 'SET_FOCUSED_GROUP', groupId: leaf.id });
          dispatch({ type: 'SET_ACTIVE_TAB', groupId: leaf.id, tabId: existingTab.id });
          return;
        }
      }

      // Open a new tab in the focused group
      const tab: TabSession = {
        id: `tab-${proc.id}`,
        type: 'agent',
        title: getProcessLabel(proc),
        ref: proc.id,
      };
      dispatch({ type: 'OPEN_TAB', groupId: focusedGroupId, tab });
    },
    [state.editorArea, focusedGroupId, dispatch],
  );

  if (groupedSessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-[var(--spacing-2)] p-[var(--spacing-4)] text-text-tertiary">
        <span className="text-[length:var(--font-size-sm)]">No sessions</span>
        <span className="text-[length:var(--font-size-xs)]">
          Start a new session from the command line
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {groupedSessions.map((group) => (
        <div key={group.label}>
          {/* Group header */}
          <div className="px-[var(--spacing-3)] py-[var(--spacing-1)] text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-[var(--letter-spacing-wide)]">
            {group.label}
          </div>
          {/* Session rows */}
          {group.sessions.map((proc) => (
            <SessionRow
              key={proc.id}
              process={proc}
              onClick={handleSessionClick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionRow -- individual session entry
// ---------------------------------------------------------------------------

interface SessionRowProps {
  process: AgentProcess;
  onClick: (proc: AgentProcess) => void;
}

const SessionRow = memo(function SessionRow({ process, onClick }: SessionRowProps) {
  const handleClick = useCallback(() => {
    onClick(process);
  }, [onClick, process]);

  const dotColor = STATUS_DOT_COLORS[process.status];
  const label = getProcessLabel(process);
  const time = formatTime(process.startedAt);

  return (
    <div
      className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-3)] py-[var(--spacing-1)] cursor-pointer hover:bg-bg-hover transition-colors group"
      onClick={handleClick}
      title={`${process.config.prompt}\n${process.type} · ${process.status} · ${time}`}
    >
      {/* Status dot */}
      <span
        className="w-[6px] h-[6px] rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
      />

      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="text-[length:var(--font-size-sm)] text-text-primary truncate">
          {label}
        </div>
        <div className="text-[length:var(--font-size-xs)] text-text-tertiary">
          {process.type} · {time}
        </div>
      </div>
    </div>
  );
});
