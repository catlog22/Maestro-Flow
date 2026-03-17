import { useState, useMemo } from 'react';
import { useAgentStore } from '@/client/store/agent-store.js';
import type { ThinkingEntry } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// ThinkingBlock -- collapsible block for agent thinking/reasoning content
// ---------------------------------------------------------------------------

export function ThinkingBlock({ entry }: { entry: ThinkingEntry }) {
  const [open, setOpen] = useState(false);

  // Check if this thinking block is still streaming (next entry not yet arrived)
  const entries = useAgentStore((s) => s.entries[entry.processId] ?? []);
  const isPartial = useMemo(() => {
    const idx = entries.findIndex((e) => e.id === entry.id);
    if (idx === -1 || idx === entries.length - 1) return true;
    // If the next entry exists, thinking is complete
    const nextEntry = entries[idx + 1];
    if (!nextEntry) return true;
    // Calculate duration from timestamps
    return false;
  }, [entries, entry.id]);

  const durationLabel = useMemo(() => {
    if (isPartial) return 'Thinking...';
    const idx = entries.findIndex((e) => e.id === entry.id);
    const nextEntry = entries[idx + 1];
    if (!nextEntry) return 'Thinking...';
    const start = new Date(entry.timestamp).getTime();
    const end = new Date(nextEntry.timestamp).getTime();
    const seconds = Math.round((end - start) / 1000);
    if (seconds < 1) return 'Thought for <1s';
    return `Thought for ${seconds}s`;
  }, [entries, entry.id, entry.timestamp, isPartial]);

  return (
    <div className="contain-content">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-left text-[12px] leading-[1.6] italic py-[4px] cursor-pointer transition-colors"
        style={{ color: 'var(--color-text-tertiary)', transitionDuration: 'var(--duration-fast)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-tertiary)'; }}
      >
        <span
          className="not-italic font-semibold text-[10px] uppercase tracking-[0.04em] mr-[6px]"
          style={{ color: 'var(--color-accent-purple)' }}
        >
          Thinking
        </span>
        <span style={{ color: 'var(--color-accent-purple)' }}>
          {entry.content.slice(0, 60)}{entry.content.length > 60 ? '...' : ''}
        </span>
        <span
          className="not-italic text-[10px] font-mono ml-[4px]"
          style={{ color: 'var(--color-text-placeholder)' }}
        >
          {durationLabel.replace('Thought for ', '').replace('Thinking...', '...')}
        </span>
      </button>
      {open && (
        <div className="text-[12px] leading-[1.6] italic mt-[2px] pl-[2px] whitespace-pre-wrap break-words" style={{ color: 'var(--color-text-tertiary)' }}>
          {entry.content}
        </div>
      )}
    </div>
  );
}
