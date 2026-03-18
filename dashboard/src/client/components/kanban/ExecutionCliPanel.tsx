import { useCallback } from 'react';
import { useExecutionStore } from '@/client/store/execution-store.js';
import { useIssueStore } from '@/client/store/issue-store.js';
import { useAgentStore } from '@/client/store/agent-store.js';
import { MessageArea } from '@/client/pages/chat/MessageArea.js';
import { ChatInput } from '@/client/pages/chat/ChatInput.js';
import { sendWsMessage } from '@/client/hooks/useWebSocket.js';

// ---------------------------------------------------------------------------
// ExecutionCliPanel — slide-out panel showing agent output for an issue
// ---------------------------------------------------------------------------

const EXECUTOR_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini',
  qwen: 'Qwen',
  opencode: 'OpenCode',
};

export function ExecutionCliPanel() {
  const cliPanelIssueId = useExecutionStore((s) => s.cliPanelIssueId);
  const closeCliPanel = useExecutionStore((s) => s.closeCliPanel);
  const getSlotForIssue = useExecutionStore((s) => s.getSlotForIssue);

  const issues = useIssueStore((s) => s.issues);
  const issue = issues.find((i) => i.id === cliPanelIssueId);
  const slot = cliPanelIssueId ? getSlotForIssue(cliPanelIssueId) : undefined;
  const processId = slot?.processId ?? issue?.execution?.processId ?? null;

  const processes = useAgentStore((s) => s.processes);
  const process = processId ? processes[processId] : undefined;

  const handleStop = useCallback(() => {
    if (processId) {
      sendWsMessage({ action: 'stop', processId });
    }
  }, [processId]);

  if (!cliPanelIssueId || !issue) return null;

  const isRunning = process?.status === 'running' || process?.status === 'spawning';
  const executionStatus = issue.execution?.status ?? 'idle';
  const resolvedExecutor = slot?.executor ?? issue.executor ?? 'claude-code';
  const executorLabel = EXECUTOR_LABELS[resolvedExecutor] ?? 'Agent';

  return (
    <div className="flex flex-col h-full border-l border-border-divider bg-bg-primary w-[480px] shrink-0">
      {/* Header */}
      <div className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-3)] py-[var(--spacing-2)] border-b border-border-divider shrink-0">
        {/* Issue title */}
        <h3 className="text-[length:var(--font-size-sm)] font-[var(--font-weight-semibold)] text-text-primary truncate flex-1">
          {issue.title}
        </h3>

        {/* Executor badge */}
        <span className="text-[length:10px] font-[var(--font-weight-medium)] px-2 py-[2px] rounded-full bg-bg-hover text-text-secondary shrink-0">
          {executorLabel}
        </span>

        {/* Status */}
        <span className={[
          'text-[length:10px] font-[var(--font-weight-medium)] px-2 py-[2px] rounded-full shrink-0',
          executionStatus === 'running' ? 'bg-[#B8954020] text-[#B89540]' :
          executionStatus === 'completed' ? 'bg-[#5A9E7820] text-[#5A9E78]' :
          executionStatus === 'failed' ? 'bg-[#C4655520] text-[#C46555]' :
          'bg-bg-hover text-text-secondary',
        ].join(' ')}>
          {executionStatus}
        </span>

        {/* Stop button */}
        {isRunning && (
          <button
            type="button"
            onClick={handleStop}
            className="text-[length:var(--font-size-xs)] px-2 py-1 rounded-[var(--radius-sm)] border border-[#C46555] text-[#C46555] hover:bg-[#C4655510] transition-colors shrink-0"
          >
            Stop
          </button>
        )}

        {/* Close button */}
        <button
          type="button"
          onClick={closeCliPanel}
          className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
          aria-label="Close panel"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Message area — reuse from chat page */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <MessageArea processId={processId} />
      </div>

      {/* Footer: full ChatInput — executor prop disables input for non-interactive agents */}
      <ChatInput processId={processId} executor={resolvedExecutor} />
    </div>
  );
}
