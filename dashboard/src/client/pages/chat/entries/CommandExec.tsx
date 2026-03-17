import { useState } from 'react';
import Terminal from 'lucide-react/dist/esm/icons/terminal.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import type { CommandExecEntry } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// CommandExec -- terminal-style command execution display
// ---------------------------------------------------------------------------

export function CommandExec({ entry }: { entry: CommandExecEntry }) {
  const [open, setOpen] = useState(false);
  const hasOutput = entry.output != null && entry.output.length > 0;
  const isError = entry.exitCode != null && entry.exitCode !== 0;

  return (
    <div
      className="rounded-[10px] border overflow-hidden contain-content font-mono"
      style={{
        backgroundColor: 'var(--code-bg)',
        borderColor: isError ? 'var(--color-accent-red)' : 'var(--code-border)',
      }}
    >
      <button
        type="button"
        onClick={() => hasOutput && setOpen((v) => !v)}
        className={`flex items-center gap-[var(--spacing-2)] w-full px-[var(--spacing-3)] py-[var(--spacing-2)] text-left transition-colors ${hasOutput ? 'cursor-pointer' : 'cursor-default'}`}
        style={{
          transitionDuration: 'var(--duration-fast)',
        }}
        onMouseEnter={(e) => { if (hasOutput) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        <Terminal size={14} className="shrink-0" style={{ color: 'var(--code-t2)' }} />
        <span className="text-[12px] font-medium truncate" style={{ color: 'var(--code-t1)' }}>
          {entry.command}
        </span>
        {entry.exitCode != null && (
          <span
            className="ml-auto shrink-0 text-[10px] font-semibold px-[7px] py-[2px] rounded-[var(--radius-sm)]"
            style={{
              color: isError ? '#D4A07A' : '#A3BE8C',
              backgroundColor: isError ? 'rgba(196,101,85,0.15)' : 'rgba(90,158,120,0.15)',
            }}
          >
            exit {entry.exitCode}
          </span>
        )}
        {hasOutput && (
          <ChevronRight
            size={14}
            className="shrink-0 transition-transform"
            style={{
              color: 'var(--code-t2)',
              transitionDuration: 'var(--duration-fast)',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        )}
      </button>
      {open && hasOutput && (
        <div style={{ borderTop: '1px solid var(--code-border)' }}>
          <pre
            className="text-[11px] leading-[1.5] p-[var(--spacing-3)] overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words"
            style={{ color: 'var(--code-t2)' }}
          >
            {entry.output}
          </pre>
        </div>
      )}
    </div>
  );
}
