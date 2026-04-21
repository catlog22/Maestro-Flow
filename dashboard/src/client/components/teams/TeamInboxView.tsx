import { useState, useEffect, useRef, useCallback } from 'react';
import Send from 'lucide-react/dist/esm/icons/send.js';
import { useTeamStore } from '@/client/store/team-store.js';
import { TEAM_API_ENDPOINTS } from '@/shared/constants.js';
import type { MailboxDispatchStatus, TeamMailboxMessage } from '@/shared/team-types.js';

// ---------------------------------------------------------------------------
// Dispatch status badge colors
// ---------------------------------------------------------------------------

const DISPATCH_COLORS: Record<MailboxDispatchStatus, { bg: string; text: string; dot: string }> = {
  pending: { bg: '#B8954018', text: '#B89540', dot: '#B89540' },
  delivered: { bg: '#5A9E7818', text: '#5A9E78', dot: '#5A9E78' },
  acknowledged: { bg: '#4A90D918', text: '#4A90D9', dot: '#4A90D9' },
  failed: { bg: '#C4655518', text: '#C46555', dot: '#C46555' },
};

// ---------------------------------------------------------------------------
// TeamInboxView - real-time message inbox with dispatch status badges
// ---------------------------------------------------------------------------

const VISIBLE_WINDOW = 100;

export function TeamInboxView() {
  const mailboxMessages = useTeamStore((s) => s.mailboxMessages);
  const activeSessionId = useTeamStore((s) => s.activeSessionId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [mailboxMessages.length]);

  // Determine if we should virtualize (render only last N messages)
  const shouldVirtualize = mailboxMessages.length > VISIBLE_WINDOW;
  const visibleMessages = shouldVirtualize
    ? mailboxMessages.slice(-VISIBLE_WINDOW)
    : mailboxMessages;

  const sendMessage = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || sending) return;

    // Use the active session's messages endpoint
    const sessionId = activeSessionId;
    if (!sessionId) return;

    setSending(true);
    setInputValue('');
    try {
      const url = `${TEAM_API_ENDPOINTS.SESSIONS}/${sessionId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        console.error('Failed to send message:', res.status);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
    setSending(false);
  }, [inputValue, sending, activeSessionId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-2 border-b border-border shrink-0">
        <span className="text-[13px] font-semibold text-text-primary">Inbox</span>
        <span className="text-[10px] font-medium text-text-tertiary bg-bg-hover px-1.5 py-0.5 rounded-full">
          {mailboxMessages.length}
        </span>
        {shouldVirtualize && (
          <span className="text-[9px] font-medium text-text-placeholder ml-1">
            showing latest {VISIBLE_WINDOW}
          </span>
        )}
      </div>

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        {visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary gap-1.5">
            <span className="text-[13px] font-medium">No messages yet</span>
            <span className="text-[11px]">Messages between agents will appear here</span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visibleMessages.map((msg) => (
              <InboxMessageRow key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      {activeSessionId && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border shrink-0">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            disabled={sending}
            className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-bg-secondary text-[12px] text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent-blue transition-colors disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!inputValue.trim() || sending}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-accent-blue text-white hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InboxMessageRow - single message with dispatch status badge
// ---------------------------------------------------------------------------

function InboxMessageRow({ message }: { message: TeamMailboxMessage }) {
  const colors = DISPATCH_COLORS[message.dispatch_status];

  // Format timestamp to HH:MM:SS
  const timeStr = message.timestamp
    ? message.timestamp.substring(11, 19)
    : '--:--:--';

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-bg-hover transition-colors group">
      {/* From avatar */}
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5"
        style={{ backgroundColor: colors.dot }}
      >
        {message.from.charAt(0).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-text-primary">{message.from}</span>
          <span className="text-[9px] text-text-placeholder">{'>'}</span>
          <span className="text-[11px] font-medium text-text-secondary">{message.to}</span>
          <span className="text-[9px] font-mono text-text-placeholder ml-auto">{timeStr}</span>
        </div>
        <div className="text-[11px] text-text-secondary truncate mt-0.5">{message.content}</div>
      </div>

      {/* Dispatch status badge */}
      <span
        className="shrink-0 text-[8px] font-semibold px-1.5 py-0.5 rounded-full"
        style={{ background: colors.bg, color: colors.text }}
      >
        {message.dispatch_status}
      </span>
    </div>
  );
}
