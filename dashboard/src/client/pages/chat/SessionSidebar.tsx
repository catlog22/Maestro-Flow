import { useMemo, useState, useEffect } from 'react';
import { useAgentStore } from '@/client/store/agent-store.js';
import { cn } from '@/client/lib/utils.js';
import type { AgentProcess, AgentType, NormalizedEntry } from '@/shared/agent-types.js';

interface CliHistoryMeta {
  execId: string;
  tool: string;
  model?: string;
  mode: string;
  prompt: string;
  workDir: string;
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
}

// ---------------------------------------------------------------------------
// SessionSidebar -- process list sidebar with status indicators
// ---------------------------------------------------------------------------

const STATUS_DOT_COLORS: Record<string, string> = {
  spawning: 'var(--color-status-exploring)',
  running:  'var(--color-status-executing)',
  paused:   'var(--color-status-pending)',
  stopping: 'var(--color-accent-orange)',
  stopped:  'var(--color-status-pending)',
  error:    'var(--color-accent-red)',
};

function getAgentRingColor(type: AgentType): string {
  if (type.includes('claude')) return 'var(--color-accent-purple)';
  if (type.includes('codex'))  return 'var(--color-accent-green)';
  if (type.includes('gemini')) return 'var(--color-accent-blue)';
  return 'var(--color-accent-gray)';
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function ProcessItem({ process, isActive }: { process: AgentProcess; isActive: boolean }) {
  const setActiveProcessId = useAgentStore((s) => s.setActiveProcessId);
  const dotColor = STATUS_DOT_COLORS[process.status] ?? 'var(--color-text-tertiary)';
  const ringColor = getAgentRingColor(process.type);
  const isRunning = process.status === 'running' || process.status === 'spawning';

  return (
    <button
      type="button"
      onClick={() => setActiveProcessId(process.id)}
      className={cn(
        'w-full text-left px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-default)] transition-colors flex items-start gap-[var(--spacing-2)]',
        isActive ? 'bg-bg-active' : 'hover:bg-bg-hover',
      )}
      style={{
        transitionDuration: 'var(--duration-fast)',
        animation: isRunning ? 'sidebar-pulse 2s ease-in-out infinite' : undefined,
      }}
    >
      {/* Status dot with agent type ring */}
      <span className="relative mt-[5px] shrink-0">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{
            backgroundColor: dotColor,
            boxShadow: `0 0 0 2px ${ringColor}`,
          }}
        />
        {isRunning && (
          <span
            className="absolute inset-0 inline-block w-2 h-2 rounded-full animate-ping opacity-40 motion-reduce:hidden"
            style={{ backgroundColor: dotColor }}
          />
        )}
      </span>
      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-[var(--spacing-1)]">
          <span className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] text-text-primary truncate">
            {process.type}
          </span>
          <span className="text-[length:var(--font-size-xs)] text-text-tertiary shrink-0">
            {formatTime(process.startedAt)}
          </span>
        </div>
        <div className="text-[length:var(--font-size-xs)] text-text-tertiary truncate mt-[var(--spacing-0-5)]">
          {process.config.prompt.slice(0, 60)}{process.config.prompt.length > 60 ? '...' : ''}
        </div>
      </div>
    </button>
  );
}

function HistoryItem({ meta, isActive }: { meta: CliHistoryMeta; isActive: boolean }) {
  const { addProcess, addEntry, setActiveProcessId } = useAgentStore.getState();

  const handleClick = async () => {
    const processId = `cli-history-${meta.execId}`;

    // If already loaded, just activate
    if (useAgentStore.getState().processes[processId]) {
      setActiveProcessId(processId);
      return;
    }

    // Create synthetic process and load entries
    const syntheticProcess: AgentProcess = {
      id: processId,
      type: (meta.tool === 'claude' ? 'claude-code' : meta.tool) as AgentType,
      status: 'stopped',
      config: {
        type: (meta.tool === 'claude' ? 'claude-code' : meta.tool) as AgentType,
        prompt: meta.prompt,
        workDir: meta.workDir,
      },
      startedAt: meta.startedAt,
    };
    addProcess(syntheticProcess);
    setActiveProcessId(processId);

    try {
      const res = await fetch(`/api/cli-history/${encodeURIComponent(meta.execId)}/entries`);
      if (res.ok) {
        const entries = await res.json() as NormalizedEntry[];
        for (const entry of entries) {
          addEntry(processId, { ...entry, processId } as NormalizedEntry);
        }
      }
    } catch {
      // Silent fail — process is shown but entries may be empty
    }
  };

  const ringColor = getAgentRingColor(
    (meta.tool === 'claude' ? 'claude-code' : meta.tool) as AgentType,
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full text-left px-[var(--spacing-3)] py-[var(--spacing-2)] rounded-[var(--radius-default)] transition-colors flex items-start gap-[var(--spacing-2)]',
        isActive ? 'bg-bg-active' : 'hover:bg-bg-hover',
      )}
      style={{ transitionDuration: 'var(--duration-fast)' }}
    >
      <span className="relative mt-[5px] shrink-0">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{
            backgroundColor: 'var(--color-text-tertiary)',
            boxShadow: `0 0 0 2px ${ringColor}`,
          }}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-[var(--spacing-1)]">
          <span className="text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)] text-text-primary truncate">
            {meta.tool}
          </span>
          <span className="text-[length:var(--font-size-xs)] text-text-tertiary shrink-0">
            {formatTime(meta.startedAt)}
          </span>
        </div>
        <div className="text-[length:var(--font-size-xs)] text-text-tertiary truncate mt-[var(--spacing-0-5)]">
          {meta.prompt.slice(0, 60)}{meta.prompt.length > 60 ? '...' : ''}
        </div>
      </div>
    </button>
  );
}

export function SessionSidebar() {
  const processes = useAgentStore((s) => s.processes);
  const activeProcessId = useAgentStore((s) => s.activeProcessId);
  const [history, setHistory] = useState<CliHistoryMeta[]>([]);

  useEffect(() => {
    fetch('/api/cli-history?limit=20')
      .then(r => r.ok ? r.json() : [])
      .then((data: CliHistoryMeta[]) => setHistory(data))
      .catch(() => {});
  }, []);

  const sortedProcesses = useMemo(() => {
    return Object.values(processes).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }, [processes]);

  // Filter history items that aren't already shown as active processes
  const activeIds = useMemo(() => new Set(Object.keys(processes)), [processes]);
  const filteredHistory = useMemo(
    () => history.filter(m => !activeIds.has(m.execId) && !activeIds.has(`cli-history-${m.execId}`)),
    [history, activeIds],
  );

  return (
    <div
      className="w-[280px] shrink-0 border-r overflow-y-auto flex flex-col"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
    >
      <div className="px-[var(--spacing-3)] py-[var(--spacing-3)] border-b" style={{ borderColor: 'var(--color-border-divider)' }}>
        <span className="text-[length:var(--font-size-sm)] font-[var(--font-weight-semibold)] text-text-primary">
          Sessions
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-[var(--spacing-2)] space-y-[var(--spacing-0-5)]">
        {sortedProcesses.length === 0 && filteredHistory.length === 0 ? (
          <div className="px-[var(--spacing-3)] py-[var(--spacing-4)] text-center text-[length:var(--font-size-xs)] text-text-tertiary">
            No active sessions
          </div>
        ) : (
          <>
            {sortedProcesses.map((proc) => (
              <ProcessItem
                key={proc.id}
                process={proc}
                isActive={proc.id === activeProcessId}
              />
            ))}
            {filteredHistory.length > 0 && sortedProcesses.length > 0 && (
              <div
                className="border-t mx-[var(--spacing-2)] my-[var(--spacing-2)]"
                style={{ borderColor: 'var(--color-border-divider)' }}
              />
            )}
            {filteredHistory.length > 0 && (
              <div className="px-[var(--spacing-3)] pt-[var(--spacing-1)] pb-[var(--spacing-1)]">
                <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-medium)] text-text-tertiary">
                  History
                </span>
              </div>
            )}
            {filteredHistory.map((meta) => (
              <HistoryItem
                key={meta.execId}
                meta={meta}
                isActive={activeProcessId === `cli-history-${meta.execId}`}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
