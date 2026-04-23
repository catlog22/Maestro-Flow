import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Send from 'lucide-react/dist/esm/icons/send.js';
import Loader from 'lucide-react/dist/esm/icons/loader.js';
import { useAgentStore } from '@/client/store/agent-store.js';
import { useTeamStore } from '@/client/store/team-store.js';
import { sendWsMessage } from '@/client/hooks/useWebSocket.js';
import { AgentStatusBadge } from './AgentStatusBadge.js';
import type { TeamAgentRoleStatus } from '@/shared/team-types.js';
import type { NormalizedEntry } from '@/shared/agent-types.js';
import { AGENT_STATUS_COLORS } from '@/shared/team-types.js';

// ---------------------------------------------------------------------------
// AgentChatSlot — Per-agent interaction card with message timeline + input
// ---------------------------------------------------------------------------

export interface AgentChatSlotProps {
  role: string;
  sessionId: string;
  status: TeamAgentRoleStatus;
}

/** Extract display text from a NormalizedEntry for the chat timeline */
function entryToDisplay(entry: NormalizedEntry): { text: string; kind: 'user' | 'assistant' | 'system' } | null {
  switch (entry.type) {
    case 'user_message':
      return { text: entry.content, kind: 'user' };
    case 'assistant_message':
      return entry.content ? { text: entry.content, kind: 'assistant' } : null;
    case 'thinking':
      return { text: entry.content, kind: 'system' };
    case 'error':
      return { text: entry.message, kind: 'system' };
    case 'tool_use':
      return { text: `${entry.name}(${JSON.stringify(entry.input).slice(0, 60)})`, kind: 'system' };
    case 'file_change':
      return { text: `[${entry.action}] ${entry.path}`, kind: 'system' };
    case 'command_exec':
      return { text: `$ ${entry.command}`, kind: 'system' };
    case 'status_change':
      return { text: `Status: ${entry.status}`, kind: 'system' };
    default:
      return null;
  }
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function AgentChatSlot({ role, sessionId, status }: AgentChatSlotProps) {
  const [input, setInput] = useState('');
  const timelineRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Resolve processId via bridge
  const processId = useTeamStore((s) => s.getProcessIdForRole(sessionId, role));

  // Get entries for this process
  const entries = useAgentStore((s) => (processId ? s.entries[processId] ?? [] : []));
  const isStreaming = useAgentStore((s) => (processId ? s.processStreaming[processId] ?? false : false));

  // Filter entries to displayable ones
  const displayEntries = useMemo(() => {
    const result: { entry: NormalizedEntry; display: { text: string; kind: 'user' | 'assistant' | 'system' } }[] = [];
    for (const entry of entries) {
      const display = entryToDisplay(entry);
      if (display) result.push({ entry, display });
    }
    return result;
  }, [entries]);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    const el = timelineRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [displayEntries.length]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendWsMessage({
      action: 'team:message',
      sessionId,
      to: role,
      content: trimmed,
    });
    setInput('');
    textareaRef.current?.focus();
  }, [input, sessionId, role]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Escape') {
        setInput('');
      }
    },
    [handleSend],
  );

  const borderColor = AGENT_STATUS_COLORS[status];
  const isConnected = !!processId;

  return (
    <div
      className="flex flex-col rounded-xl border bg-bg-primary overflow-hidden"
      style={{ borderColor: `${borderColor}40` }}
    >
      {/* SlotHeader */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-divider bg-bg-secondary shrink-0">
        <AgentStatusBadge status={status} role={role} />
        <div className="flex-1" />
        {isStreaming && (
          <Loader size={12} className="text-text-tertiary animate-spin" />
        )}
      </div>

      {/* MessageTimeline */}
      <div
        ref={timelineRef}
        className="flex-1 overflow-y-auto p-3 min-h-[160px] max-h-[400px] flex flex-col gap-1.5"
      >
        {!isConnected && (
          <div className="flex items-center justify-center h-full text-text-tertiary text-[11px] italic">
            Connecting...
          </div>
        )}
        {isConnected && displayEntries.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-tertiary text-[11px] italic">
            Waiting for activity...
          </div>
        )}
        <AnimatePresence initial={false}>
          {displayEntries.map(({ entry, display }) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={[
                'text-[11px] leading-relaxed px-2 py-1 rounded-md max-w-[95%]',
                display.kind === 'user'
                  ? 'self-end bg-accent-muted text-text-primary'
                  : display.kind === 'assistant'
                    ? 'self-start bg-bg-secondary text-text-primary'
                    : 'self-start bg-bg-hover text-text-tertiary font-mono text-[10px]',
              ].join(' ')}
            >
              <div className="flex items-start gap-1.5">
                <span className="text-text-placeholder text-[9px] shrink-0 mt-0.5">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="break-words whitespace-pre-wrap">{display.text}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* SlotInput */}
      <div className="flex items-end gap-2 px-3 py-2 border-t border-border-divider bg-bg-secondary shrink-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${role}...`}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-bg-primary px-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent-muted transition-colors"
          aria-label={`Send message to ${role}`}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
          title={`Send to ${role}`}
          aria-label={`Send message to ${role}`}
        >
          <Send size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
