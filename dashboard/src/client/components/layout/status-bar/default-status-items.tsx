import { registerStatusBarItem } from './status-bar-registry.js';
import { useBoardStore } from '@/client/store/board-store.js';
import { useAgentStore } from '@/client/store/agent-store.js';

// ---------------------------------------------------------------------------
// Default Status Bar Items -- self-registration on import
// ---------------------------------------------------------------------------

// -- Connection indicator (migrated from TopBar) --
function ConnectionIndicator() {
  const connected = useBoardStore((s) => s.connected);
  return (
    <span className="flex items-center gap-[var(--spacing-1)]">
      <span
        className={[
          'w-[7px] h-[7px] rounded-full',
          'transition-colors duration-[var(--duration-smooth)] ease-[var(--ease-notion)]',
          connected ? 'bg-status-completed animate-pulse' : 'bg-status-blocked',
        ].join(' ')}
      />
      <span>{connected ? 'Connected' : 'Disconnected'}</span>
    </span>
  );
}

registerStatusBarItem({
  id: 'connection',
  alignment: 'right',
  priority: 100,
  component: ConnectionIndicator,
});

// -- Phase indicator --
function PhaseIndicator() {
  const project = useBoardStore((s) => s.board?.project);
  if (!project) return null;
  return (
    <span>
      Phase {project.current_phase}/{project.phases_summary.total}
    </span>
  );
}

registerStatusBarItem({
  id: 'phase',
  alignment: 'right',
  priority: 90,
  component: PhaseIndicator,
});

// -- Agent count --
function AgentCountIndicator() {
  const processCount = useAgentStore((s) => Object.keys(s.processes).length);
  if (processCount === 0) return null;
  return (
    <span>{processCount} agent{processCount !== 1 ? 's' : ''}</span>
  );
}

registerStatusBarItem({
  id: 'agent-count',
  alignment: 'right',
  priority: 80,
  component: AgentCountIndicator,
  panelTabId: 'execution',
});

// -- Workspace branch --
function WorkspaceIndicator() {
  const workspace = useBoardStore((s) => s.workspace);
  if (!workspace) return null;
  // Show just the last path segment
  const name = workspace.split('/').pop() || workspace.split('\\').pop() || workspace;
  return <span>{name}</span>;
}

registerStatusBarItem({
  id: 'workspace',
  alignment: 'left',
  priority: 100,
  component: WorkspaceIndicator,
});

// -- Error count --
function ErrorCountIndicator() {
  const entriesMap = useAgentStore((s) => s.entries);
  const errorCount = Object.values(entriesMap).reduce((count, entries) => {
    return count + entries.filter((e) => e.type === 'error').length;
  }, 0);
  if (errorCount === 0) return null;
  return (
    <span className="text-status-blocked">
      {errorCount} error{errorCount !== 1 ? 's' : ''}
    </span>
  );
}

registerStatusBarItem({
  id: 'errors',
  alignment: 'left',
  priority: 90,
  component: ErrorCountIndicator,
  panelTabId: 'problems',
});
