import { useState } from 'react';
import Wrench from 'lucide-react/dist/esm/icons/wrench.js';
import type { ToolUseEntry } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// ToolUseCard -- collapsible card showing tool name, status, input/result
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<ToolUseEntry['status'], { bg: string; color: string; label: string }> = {
  pending:   { bg: 'var(--color-status-bg-pending)',   color: 'var(--color-status-pending)',   label: 'Pending' },
  running:   { bg: 'var(--color-status-bg-executing)',  color: 'var(--color-status-executing)',  label: 'Running' },
  completed: { bg: 'var(--color-status-bg-completed)', color: 'var(--color-status-completed)', label: 'Completed' },
  failed:    { bg: 'var(--color-status-bg-blocked)',   color: 'var(--color-status-blocked)',   label: 'Failed' },
};

export function ToolUseCard({ entry }: { entry: ToolUseEntry }) {
  const [open, setOpen] = useState(false);
  const style = STATUS_STYLES[entry.status];

  return (
    <div className="flex gap-[6px]">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center shrink-0 pt-[12px]" style={{ marginLeft: '2px' }}>
        <span
          className="w-[8px] h-[8px] rounded-full shrink-0"
          style={{
            backgroundColor: entry.status === 'completed' ? 'var(--color-tint-completed)' : entry.status === 'running' ? 'var(--color-tint-executing)' : 'var(--color-bg-card)',
            border: `2px solid ${entry.status === 'completed' ? 'var(--color-accent-green)' : entry.status === 'running' ? 'var(--color-accent-yellow)' : 'var(--color-border)'}`,
          }}
        />
        <span
          className="w-[2px] flex-1 mt-0"
          style={{ backgroundColor: 'var(--color-border)' }}
        />
      </div>
    <div className="flex-1 min-w-0 contain-content pl-[8px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[6px] w-full py-[4px] text-left cursor-pointer transition-opacity hover:opacity-70"
        style={{ transitionDuration: 'var(--duration-fast)' }}
      >
        <Wrench size={14} className="shrink-0" strokeWidth={1.8} style={{ color: 'var(--color-text-tertiary)' }} />
        <span className="text-[12px] font-semibold text-text-primary truncate">
          {entry.name}
        </span>
        {entry.input && typeof entry.input === 'object' && 'file_path' in entry.input && (
          <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
            {String(entry.input.file_path).split('/').pop()}
          </span>
        )}
        <span
          className="ml-auto shrink-0 rounded-[var(--radius-full)] px-[var(--spacing-2)] py-[2px] text-[10px] font-semibold"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {style.label}
        </span>
      </button>
      {open && (
        <div className="mt-[4px] space-y-[4px]">
          <pre
            className="text-[11px] font-mono rounded-[6px] p-[6px_8px] overflow-x-auto max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words leading-[1.5]"
            style={{
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border-divider)',
            }}
          >
            {JSON.stringify(entry.input, null, 2)}
          </pre>
          {entry.result != null && (
            <pre
              className="text-[11px] font-mono rounded-[6px] p-[6px_8px] overflow-x-auto max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words leading-[1.5]"
              style={{
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-divider)',
              }}
            >
              {entry.result}
            </pre>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
