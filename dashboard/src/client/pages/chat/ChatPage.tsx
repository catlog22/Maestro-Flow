import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useAgentStore } from '@/client/store/agent-store.js';
import { MessageArea } from './MessageArea.js';
import { ChatInput } from './ChatInput.js';
import type { AgentProcess, AgentType } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// ChatPage -- tab bar + split-pane chat layout (matches design-chat-v1a)
// ---------------------------------------------------------------------------

const AGENT_DOT_COLORS: Record<AgentType, string> = {
  'claude-code': 'var(--color-accent-purple)',
  codex: 'var(--color-accent-green)',
  gemini: 'var(--color-accent-blue)',
  qwen: 'var(--color-accent-orange)',
  opencode: 'var(--color-text-tertiary)',
};

const AGENT_LABELS: Record<AgentType, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini',
  qwen: 'Qwen',
  opencode: 'OpenCode',
};

export function ChatPage() {
  const processes = useAgentStore((s) => s.processes);
  const activeProcessId = useAgentStore((s) => s.activeProcessId);
  const setActiveProcessId = useAgentStore((s) => s.setActiveProcessId);

  const [splitOpen, setSplitOpen] = useState(false);
  const [splitProcessId, setSplitProcessId] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(50);
  const draggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedProcesses = useMemo(() => {
    return Object.values(processes).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }, [processes]);

  // Auto-select first process if none selected
  useEffect(() => {
    if (!activeProcessId && sortedProcesses.length > 0) {
      setActiveProcessId(sortedProcesses[0].id);
    }
  }, [activeProcessId, sortedProcesses, setActiveProcessId]);

  const activeProcess = activeProcessId ? processes[activeProcessId] : null;
  const splitProcess = splitProcessId ? processes[splitProcessId] : null;

  const toggleSplit = useCallback(() => {
    if (splitOpen) {
      setSplitOpen(false);
      setSplitProcessId(null);
    } else {
      // Open split with first non-active process
      const other = sortedProcesses.find((p) => p.id !== activeProcessId);
      if (other) {
        setSplitProcessId(other.id);
        setSplitOpen(true);
        setSplitRatio(50);
      }
    }
  }, [splitOpen, sortedProcesses, activeProcessId]);

  // Drag handler for split divider
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.max(25, Math.min(75, pct)));
    };
    const onUp = () => { draggingRef.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Floating tab bar */}
      <div className="sticky top-0 z-30 flex justify-center pt-2 pointer-events-none">
        <div
          className="inline-flex items-center gap-[2px] border rounded-[12px] p-[3px] pointer-events-auto"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            borderColor: 'var(--color-border)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          }}
        >
          {sortedProcesses.map((proc) => (
            <TabButton
              key={proc.id}
              process={proc}
              isActive={proc.id === activeProcessId}
              onClick={() => setActiveProcessId(proc.id)}
            />
          ))}
          {sortedProcesses.length > 1 && (
            <>
              <div className="w-px h-4" style={{ backgroundColor: 'var(--color-border-divider)', margin: '0 2px' }} />
              <button
                type="button"
                onClick={toggleSplit}
                className="flex items-center px-2 py-[5px] rounded-[9px] border-none bg-transparent cursor-pointer transition-all duration-150"
                style={{
                  color: splitOpen ? 'var(--color-accent-blue)' : 'var(--color-text-tertiary)',
                  backgroundColor: splitOpen ? 'var(--color-tint-exploring)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!splitOpen) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-hover)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!splitOpen) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)';
                  }
                }}
                aria-label="Toggle split view"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="3" x2="12" y2="21" />
                </svg>
              </button>
            </>
          )}
          <button
            type="button"
            className="w-7 h-7 rounded-[8px] border-none bg-transparent flex items-center justify-center cursor-pointer transition-all duration-150"
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Split container */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Pane 1 (primary) */}
        <div className="flex flex-col min-w-0 overflow-hidden" style={{ flex: splitOpen ? `0 0 ${splitRatio}%` : '1' }}>
          <MessageArea processId={activeProcessId} />
          <ChatInput />
        </div>

        {/* Split divider */}
        {splitOpen && (
          <div
            className="w-[5px] shrink-0 cursor-col-resize relative transition-colors duration-150"
            style={{ backgroundColor: 'var(--color-border)' }}
            onMouseDown={handleDividerMouseDown}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-accent-orange)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-border)'; }}
          />
        )}

        {/* Pane 2 (split) */}
        {splitOpen && splitProcess && (
          <div
            className="flex flex-col min-w-0 overflow-hidden border-l"
            style={{ flex: `0 0 ${100 - splitRatio}%`, borderColor: 'var(--color-border)' }}
          >
            <SplitPaneLabel process={splitProcess} onClose={toggleSplit} />
            <MessageArea processId={splitProcessId} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabButton — session tab in the floating bar
// ---------------------------------------------------------------------------

function TabButton({
  process,
  isActive,
  onClick,
}: {
  process: AgentProcess;
  isActive: boolean;
  onClick: () => void;
}) {
  const dotColor = AGENT_DOT_COLORS[process.type] ?? 'var(--color-text-tertiary)';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-[6px] px-3 py-[5px] rounded-[9px] border-none text-[11px] font-medium cursor-pointer transition-all duration-150"
      style={{
        backgroundColor: isActive ? 'var(--color-text-primary)' : 'transparent',
        color: isActive ? '#fff' : 'var(--color-text-tertiary)',
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
      <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      {AGENT_LABELS[process.type] ?? process.type}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SplitPaneLabel — header for the second split pane
// ---------------------------------------------------------------------------

function SplitPaneLabel({ process, onClose }: { process: AgentProcess; onClose: () => void }) {
  const dotColor = AGENT_DOT_COLORS[process.type] ?? 'var(--color-text-tertiary)';

  return (
    <div
      className="flex items-center gap-[6px] px-4 py-[6px] text-[11px] font-semibold shrink-0 border-b"
      style={{
        color: 'var(--color-text-secondary)',
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border-divider)',
      }}
    >
      <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: dotColor }} />
      {AGENT_LABELS[process.type] ?? process.type}
      <button
        type="button"
        onClick={onClose}
        className="ml-auto w-[18px] h-[18px] rounded flex items-center justify-center border-none bg-transparent cursor-pointer transition-all duration-100"
        style={{ color: 'var(--color-text-placeholder)' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-tint-blocked)';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-accent-red)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'var(--color-text-placeholder)';
        }}
        aria-label="Close split pane"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
