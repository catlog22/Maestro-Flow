import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js';
import Terminal from 'lucide-react/dist/esm/icons/terminal.js';
import Columns from 'lucide-react/dist/esm/icons/columns.js';
import Send from 'lucide-react/dist/esm/icons/send.js';
import Radio from 'lucide-react/dist/esm/icons/radio.js';
import User from 'lucide-react/dist/esm/icons/user.js';
import { useMeetingRoomStore } from '@/client/store/meeting-room-store.js';
import { sendWsMessage } from '@/client/hooks/useWebSocket.js';
import { ChatTimeline } from '@/client/components/meeting-room/ChatTimeline.js';
import { TerminalPanelGrid } from '@/client/components/meeting-room/TerminalPanelGrid.js';
import { AgentStatusBar } from '@/client/components/meeting-room/AgentStatusBar.js';
import { ResizableChatTerminalSplit } from '@/client/components/meeting-room/ResizableChatTerminalSplit.js';
import type { LayoutMode } from '@/client/store/meeting-room-store.js';

// ---------------------------------------------------------------------------
// MeetingRoomPage — /meeting-room/:sessionId
// ---------------------------------------------------------------------------

const LAYOUT_TABS: { mode: LayoutMode; icon: typeof MessageSquare; label: string }[] = [
  { mode: 'chat', icon: MessageSquare, label: 'Chat' },
  { mode: 'terminal', icon: Terminal, label: 'Terminal' },
  { mode: 'split', icon: Columns, label: 'Split' },
];

export function MeetingRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [input, setInput] = useState('');

  const setSessionId = useMeetingRoomStore((s) => s.setSessionId);
  const layoutMode = useMeetingRoomStore((s) => s.layoutMode);
  const setLayoutMode = useMeetingRoomStore((s) => s.setLayoutMode);
  const inputTarget = useMeetingRoomStore((s) => s.inputTarget);
  const setInputTarget = useMeetingRoomStore((s) => s.setInputTarget);
  const sendMessage = useMeetingRoomStore((s) => s.sendMessage);
  const agents = useMeetingRoomStore((s) => s.agents);
  const reset = useMeetingRoomStore((s) => s.reset);

  // Subscribe to room on mount, unsubscribe + reset on unmount
  useEffect(() => {
    if (!sessionId) return;

    setSessionId(sessionId);

    // Subscribe to room events
    sendWsMessage({ action: 'room:subscribe', sessionId });

    // Request snapshot to hydrate state
    sendWsMessage({ action: 'room:snapshot', sessionId });

    return () => {
      sendWsMessage({ action: 'room:unsubscribe', sessionId });
      reset();
    };
  }, [sessionId, setSessionId, reset]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput('');
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-[length:var(--font-size-sm)]">
        No session ID provided
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border-divider bg-bg-secondary shrink-0">
        <span className="text-[length:var(--font-size-sm)] font-semibold text-text-primary">
          Meeting Room
        </span>
        <span className="text-[11px] text-text-tertiary font-mono">
          {sessionId}
        </span>
        <div className="flex-1" />

        {/* Layout mode tabs */}
        <div className="flex items-center gap-0.5 bg-bg-primary rounded-lg p-0.5">
          {LAYOUT_TABS.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setLayoutMode(mode)}
              className={[
                'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors',
                layoutMode === mode
                  ? 'bg-bg-hover text-text-primary font-medium'
                  : 'text-text-tertiary hover:text-text-primary',
              ].join(' ')}
              title={label}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {layoutMode === 'chat' && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <ChatTimeline />
          </div>
        )}
        {layoutMode === 'terminal' && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <TerminalPanelGrid />
          </div>
        )}
        {layoutMode === 'split' && (
          <ResizableChatTerminalSplit
            chatPanel={<ChatTimeline />}
            terminalPanel={<TerminalPanelGrid />}
          />
        )}
      </div>

      {/* Input bar */}
      <div className="flex items-end gap-2 px-4 py-2 border-t border-border-divider bg-bg-secondary shrink-0">
        {/* Input target selector */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setInputTarget({ mode: 'broadcast' })}
            className={[
              'flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] transition-colors',
              inputTarget.mode === 'broadcast'
                ? 'bg-bg-hover text-text-primary font-medium'
                : 'text-text-tertiary hover:text-text-primary',
            ].join(' ')}
            title="Broadcast to all agents"
          >
            <Radio size={11} />
            <span>All</span>
          </button>
          {agents.map((agent) => (
            <button
              key={agent.role}
              type="button"
              onClick={() => setInputTarget({ mode: 'direct', role: agent.role })}
              className={[
                'flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] transition-colors',
                inputTarget.mode === 'direct' && inputTarget.role === agent.role
                  ? 'bg-bg-hover text-text-primary font-medium'
                  : 'text-text-tertiary hover:text-text-primary',
              ].join(' ')}
              title={`Send to ${agent.role}`}
            >
              <User size={11} />
              <span>{agent.role}</span>
            </button>
          ))}
        </div>

        {/* Input */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            inputTarget.mode === 'broadcast'
              ? 'Broadcast to all agents...'
              : `Message ${inputTarget.role}...`
          }
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-bg-primary px-3 py-1.5 text-[12px] text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent-muted transition-colors"
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
          title="Send"
        >
          <Send size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Agent status bar */}
      <AgentStatusBar />
    </div>
  );
}
