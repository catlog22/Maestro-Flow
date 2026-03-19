import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Columns2 from 'lucide-react/dist/esm/icons/columns-2.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import { useAgentStore } from '@/client/store/agent-store.js';
import { useResizableSplit } from '@/client/hooks/useResizableSplit.js';
import { useApprovalKeyboard } from '@/client/hooks/useApprovalKeyboard.js';
import { sendWsMessage } from '@/client/hooks/useWebSocket.js';
import { MessageArea } from './MessageArea.js';
import { ChatInput } from './ChatInput.js';
import { ThoughtDisplay } from './ThoughtDisplay.js';
import { HistoryPanel } from './SessionSidebar.js';
import { AGENT_DOT_COLORS, AGENT_LABELS } from '@/shared/constants.js';
import type { AgentProcess, AgentType } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

const STATUS_LABELS: Record<string, string> = {
  spawning: 'Starting…',
  running: 'Running',
  paused: 'Paused',
  stopping: 'Stopping…',
  stopped: 'Stopped',
  error: 'Error',
};

// ---------------------------------------------------------------------------
// WelcomeView
// ---------------------------------------------------------------------------

function WelcomeView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center" style={{ marginTop: '-5vh' }}>
      <div className="w-full px-4" style={{ maxWidth: 'clamp(360px, calc(100% - 32px), 780px)' }}>
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: 'var(--color-tint-exploring)' }}
          >
            <MessageSquare size={24} strokeWidth={1.5} style={{ color: 'var(--color-accent-blue)' }} />
          </div>
          <h1 className="text-xl font-semibold mb-2 text-center" style={{ color: 'var(--color-text-primary)' }}>
            Start a new conversation
          </h1>
          <p className="text-[13px] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
            Select an agent, type a message, and press Enter to begin.
          </p>
        </div>
        <ChatInput />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabButton — session tab with dismiss + hover tooltip
// ---------------------------------------------------------------------------

function TabButton({
  process,
  isActive,
  onClick,
  onDismiss,
}: {
  process: AgentProcess;
  isActive: boolean;
  onClick: () => void;
  onDismiss?: () => void;
}) {
  const dotColor = AGENT_DOT_COLORS[process.type] ?? 'var(--color-text-tertiary)';
  const label = AGENT_LABELS[process.type] ?? process.type;

  const tooltipText = `${label} · ${STATUS_LABELS[process.status] ?? process.status}\n${process.config.prompt.slice(0, 100)}${process.config.prompt.length > 100 ? '…' : ''}\n${formatTime(process.startedAt)} · ${process.type}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltipText}
      className="group/tab flex items-center gap-[6px] px-3 py-[5px] rounded-[9px] border-none text-[11px] font-medium cursor-pointer transition-all duration-150 shrink-0 relative"
      style={{
        backgroundColor: isActive ? 'var(--color-text-primary)' : 'transparent',
        color: isActive ? '#fff' : 'var(--color-text-tertiary)',
        paddingRight: onDismiss ? '22px' : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-hover)';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)';
        }
      }}
    >
      <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: isActive ? '#fff' : dotColor }} />
      {label}

      {/* Dismiss X */}
      {onDismiss && (
        <span
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="absolute right-[6px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-sm flex items-center justify-center opacity-0 group-hover/tab:opacity-100 transition-opacity duration-100"
          style={{ color: isActive ? 'rgba(255,255,255,0.6)' : 'var(--color-text-placeholder)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = isActive ? '#fff' : 'var(--color-accent-red)';
            e.currentTarget.style.backgroundColor = isActive ? 'rgba(255,255,255,0.15)' : 'var(--color-tint-blocked)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = isActive ? 'rgba(255,255,255,0.6)' : 'var(--color-text-placeholder)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <X size={10} strokeWidth={2} />
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// GlobalTabBar — always-visible, shows session tabs (non-split) or just
//                utility buttons (split mode)
// ---------------------------------------------------------------------------

function GlobalTabBar({
  sortedProcesses,
  activeProcessId,
  splitOpen,
  historyOpen,
  onSelectProcess,
  onDismissProcess,
  onNewSession,
  onToggleSplit,
  onToggleHistory,
}: {
  sortedProcesses: AgentProcess[];
  activeProcessId: string | null;
  splitOpen: boolean;
  historyOpen: boolean;
  onSelectProcess: (id: string) => void;
  onDismissProcess: (id: string) => void;
  onNewSession: () => void;
  onToggleSplit: () => void;
  onToggleHistory: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 flex justify-center pt-2 pointer-events-none shrink-0">
      <div
        className="inline-flex items-center gap-[2px] border rounded-[12px] p-[3px] pointer-events-auto"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          maxWidth: 'calc(100% - 32px)',
        }}
      >
        {/* Session tabs — only in non-split mode */}
        {!splitOpen && (sortedProcesses.length > 0 || activeProcessId === null) && (
          <div
            className="flex items-center gap-[2px] overflow-x-auto"
            style={{ scrollbarWidth: 'thin', maxWidth: 'min(600px, 60vw)' }}
            onWheel={(e) => {
              // Convert vertical scroll to horizontal scroll for the tab list
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.currentTarget.scrollLeft += e.deltaY;
                e.preventDefault();
              }
            }}
          >
            {sortedProcesses.map((proc) => (
              <TabButton
                key={proc.id}
                process={proc}
                isActive={proc.id === activeProcessId}
                onClick={() => onSelectProcess(proc.id)}
                onDismiss={() => onDismissProcess(proc.id)}
              />
            ))}
            {/* "New" tab — shown when in new-session mode */}
            {activeProcessId === null && (
              <button
                type="button"
                className="flex items-center gap-[6px] px-3 py-[5px] rounded-[9px] border-none text-[11px] font-medium cursor-pointer shrink-0"
                style={{
                  backgroundColor: 'var(--color-text-primary)',
                  color: '#fff',
                }}
              >
                <Plus size={10} strokeWidth={2.5} />
                New
              </button>
            )}
          </div>
        )}

        {/* Split toggle — only when 2+ sessions */}
        {sortedProcesses.length > 1 && (
          <>
            {!splitOpen && sortedProcesses.length > 0 && (
              <div className="w-px h-4 shrink-0" style={{ backgroundColor: 'var(--color-border-divider)', margin: '0 2px' }} />
            )}
            <IconButton
              icon={<Columns2 size={14} strokeWidth={1.8} />}
              isActive={splitOpen}
              onClick={onToggleSplit}
              label="Toggle split view"
            />
          </>
        )}

        {/* New session */}
        <button
          type="button"
          onClick={onNewSession}
          className="w-7 h-7 rounded-[8px] border-none bg-transparent flex items-center justify-center cursor-pointer transition-all duration-150 shrink-0"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)';
          }}
          aria-label="New session"
        >
          <Plus size={14} strokeWidth={2} />
        </button>

        {/* History toggle */}
        <div className="w-px h-4 shrink-0" style={{ backgroundColor: 'var(--color-border-divider)', margin: '0 2px' }} />
        <IconButton
          icon={<Clock size={14} strokeWidth={1.8} />}
          isActive={historyOpen}
          onClick={onToggleHistory}
          label="Toggle history"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaneTabBar — per-pane floating tab bar (used in split mode)
// ---------------------------------------------------------------------------

function PaneTabBar({
  sortedProcesses,
  currentProcessId,
  onSelectProcess,
  onClose,
}: {
  sortedProcesses: AgentProcess[];
  currentProcessId: string | null;
  onSelectProcess: (id: string) => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex justify-center pt-[6px] pb-[2px] pointer-events-none shrink-0">
      <div
        className="inline-flex items-center gap-[2px] border rounded-[10px] p-[2px] pointer-events-auto"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor: 'var(--color-border)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          maxWidth: 'calc(100% - 16px)',
        }}
      >
        <div
          className="flex items-center gap-[2px] overflow-x-auto"
          style={{ scrollbarWidth: 'thin', maxWidth: 'min(400px, 100%)' }}
          onWheel={(e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              e.currentTarget.scrollLeft += e.deltaY;
              e.preventDefault();
            }
          }}
        >
          {sortedProcesses.map((proc) => (
            <TabButton
              key={proc.id}
              process={proc}
              isActive={proc.id === currentProcessId}
              onClick={() => onSelectProcess(proc.id)}
            />
          ))}
        </div>

        {/* Close pane button */}
        {onClose && (
          <>
            <div className="w-px h-3 shrink-0" style={{ backgroundColor: 'var(--color-border-divider)', margin: '0 1px' }} />
            <button
              type="button"
              onClick={onClose}
              className="w-[22px] h-[22px] rounded-[6px] border-none bg-transparent flex items-center justify-center cursor-pointer transition-all duration-100 shrink-0"
              style={{ color: 'var(--color-text-placeholder)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-tint-blocked)';
                (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-red)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--color-text-placeholder)';
              }}
              aria-label="Close pane"
            >
              <X size={10} strokeWidth={2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IconButton — small toggle button for the tab bar
// ---------------------------------------------------------------------------

function IconButton({
  icon,
  isActive,
  onClick,
  label,
}: {
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center px-2 py-[5px] rounded-[9px] border-none bg-transparent cursor-pointer transition-all duration-150 shrink-0"
      style={{
        color: isActive ? 'var(--color-accent-blue)' : 'var(--color-text-tertiary)',
        backgroundColor: isActive ? 'var(--color-tint-exploring)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-hover)';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)';
        }
      }}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ChatPage
// ---------------------------------------------------------------------------

export function ChatPage() {
  const processes = useAgentStore((s) => s.processes);
  const activeProcessId = useAgentStore((s) => s.activeProcessId);
  const setActiveProcessId = useAgentStore((s) => s.setActiveProcessId);
  const dismissProcess = useAgentStore((s) => s.dismissProcess);

  const [splitOpen, setSplitOpen] = useState(false);
  const [splitProcessId, setSplitProcessId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { ratio: splitRatio, setRatio: setSplitRatio, handleMouseDown: handleDividerMouseDown, containerRef } = useResizableSplit({ defaultRatio: 50, minRatio: 25, maxRatio: 75 });

  const sortedProcesses = useMemo(() => {
    return Object.values(processes).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }, [processes]);

  const isNewSessionModeRef = useRef(false);
  const processCount = Object.keys(processes).length;
  const prevProcessCountRef = useRef(processCount);
  const sortedProcessesRef = useRef(sortedProcesses);
  sortedProcessesRef.current = sortedProcesses;

  useEffect(() => {
    const prevCount = prevProcessCountRef.current;
    prevProcessCountRef.current = processCount;

    if (isNewSessionModeRef.current) {
      if (processCount > prevCount) {
        isNewSessionModeRef.current = false;
        const first = sortedProcessesRef.current[0];
        if (first) setActiveProcessId(first.id);
      }
      return;
    }

    if (!activeProcessId && processCount > 0) {
      const first = sortedProcessesRef.current[0];
      if (first) setActiveProcessId(first.id);
    }
  }, [activeProcessId, processCount, setActiveProcessId]);

  const splitProcess = splitProcessId ? processes[splitProcessId] : null;
  const showWelcome = !activeProcessId;

  useApprovalKeyboard(activeProcessId);

  useEffect(() => {
    if (splitOpen && splitProcessId && !processes[splitProcessId]) {
      setSplitOpen(false);
      setSplitProcessId(null);
    }
  }, [splitOpen, splitProcessId, processes]);

  const toggleSplit = useCallback(() => {
    if (splitOpen) {
      setSplitOpen(false);
      setSplitProcessId(null);
    } else {
      const other = sortedProcesses.find((p) => p.id !== activeProcessId);
      if (other) {
        setSplitProcessId(other.id);
        setSplitOpen(true);
        setSplitRatio(50);
      }
    }
  }, [splitOpen, sortedProcesses, activeProcessId, setSplitRatio]);

  const handleDismissProcess = useCallback((processId: string) => {
    const proc = processes[processId];
    if (proc && (proc.status === 'running' || proc.status === 'spawning')) {
      sendWsMessage({ action: 'stop', processId });
    }
    dismissProcess(processId);
  }, [processes, dismissProcess]);

  const handleNewSession = useCallback(() => {
    isNewSessionModeRef.current = true;
    setActiveProcessId(null);
  }, [setActiveProcessId]);

  return (
    <div className="h-full flex min-w-0 overflow-hidden relative">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

      {/* Global tab bar — always visible */}
      <GlobalTabBar
        sortedProcesses={sortedProcesses}
        activeProcessId={activeProcessId}
        splitOpen={splitOpen}
        historyOpen={historyOpen}
        onSelectProcess={setActiveProcessId}
        onDismissProcess={handleDismissProcess}
        onNewSession={handleNewSession}
        onToggleSplit={toggleSplit}
        onToggleHistory={() => setHistoryOpen(!historyOpen)}
      />

      {showWelcome ? (
        <WelcomeView />
      ) : (
        <div ref={containerRef} className="flex-1 flex overflow-hidden min-h-0">
          {/* Pane 1 */}
          <div className="flex flex-col min-w-0 overflow-hidden" style={{ flex: splitOpen ? `0 0 ${splitRatio}%` : '1' }}>
            {/* Per-pane tab bar in split mode */}
            {splitOpen && (
              <PaneTabBar
                sortedProcesses={sortedProcesses}
                currentProcessId={activeProcessId}
                onSelectProcess={setActiveProcessId}
              />
            )}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <MessageArea processId={activeProcessId} />
            </div>
            <ThoughtDisplay processId={activeProcessId} />
            {splitOpen ? (
              <ChatInput processId={activeProcessId} executor={processes[activeProcessId!]?.type} />
            ) : (
              <ChatInput />
            )}
          </div>

          {/* Divider */}
          {splitOpen && (
            <div
              className="w-[5px] shrink-0 cursor-col-resize relative transition-colors duration-150"
              style={{ backgroundColor: 'var(--color-border)' }}
              onMouseDown={handleDividerMouseDown}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-accent-orange)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-border)'; }}
            />
          )}

          {/* Pane 2 */}
          {splitOpen && (
            <div
              className="flex flex-col min-w-0 overflow-hidden border-l"
              style={{ flex: `0 0 ${100 - splitRatio}%`, borderColor: 'var(--color-border)' }}
            >
              <PaneTabBar
                sortedProcesses={sortedProcesses}
                currentProcessId={splitProcessId}
                onSelectProcess={setSplitProcessId}
                onClose={toggleSplit}
              />
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <MessageArea processId={splitProcessId} />
              </div>
              <ThoughtDisplay processId={splitProcessId} />
              <ChatInput
                processId={splitProcessId}
                executor={splitProcess?.type}
              />
            </div>
          )}
        </div>
      )}
      </div>

      <HistoryPanel open={historyOpen} />
    </div>
  );
}
