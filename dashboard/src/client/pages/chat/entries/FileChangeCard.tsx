import { useState } from 'react';
import FileCode from 'lucide-react/dist/esm/icons/file-code.js';
import FilePlus from 'lucide-react/dist/esm/icons/file-plus.js';
import FileX from 'lucide-react/dist/esm/icons/file-x.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import type { FileChangeEntry } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// FileChangeCard -- file change card with path, action badge, optional diff
// ---------------------------------------------------------------------------

const ACTION_CONFIG: Record<FileChangeEntry['action'], { icon: typeof FileCode; color: string; bg: string; label: string }> = {
  create: { icon: FilePlus,  color: 'var(--color-accent-green)',  bg: 'var(--color-status-bg-completed)', label: 'Create' },
  modify: { icon: FileCode,  color: 'var(--color-accent-yellow)', bg: 'var(--color-status-bg-executing)',  label: 'Modify' },
  delete: { icon: FileX,     color: 'var(--color-accent-red)',    bg: 'var(--color-status-bg-blocked)',    label: 'Delete' },
};

export function FileChangeCard({ entry }: { entry: FileChangeEntry }) {
  const [open, setOpen] = useState(false);
  const cfg = ACTION_CONFIG[entry.action];
  const Icon = cfg.icon;
  const hasDiff = entry.diff != null && entry.diff.length > 0;

  return (
    <div
      className="rounded-[10px] border border-border overflow-hidden contain-content transition-shadow"
      style={{ backgroundColor: 'var(--color-bg-card)', transitionDuration: 'var(--duration-slow)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(45,42,38,0.06)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      <button
        type="button"
        onClick={() => hasDiff && setOpen((v) => !v)}
        className={`flex items-center gap-[var(--spacing-2)] w-full px-[var(--spacing-3)] py-[var(--spacing-2)] text-left transition-colors ${hasDiff ? 'hover:bg-bg-hover cursor-pointer' : 'cursor-default'}`}
        style={{ transitionDuration: 'var(--duration-fast)' }}
      >
        <Icon size={14} className="shrink-0" strokeWidth={1.8} style={{ color: cfg.color }} />
        <span className="text-[11px] font-mono truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {entry.path}
        </span>
        <span
          className="ml-auto shrink-0 rounded-[var(--radius-sm)] px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.03em]"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
        {hasDiff && (
          <ChevronRight
            size={14}
            className="shrink-0 transition-transform text-text-tertiary"
            style={{
              transitionDuration: 'var(--duration-fast)',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        )}
      </button>
      {open && hasDiff && (
        <div className="border-t border-border-divider">
          <pre
            className="text-[length:var(--font-size-xs)] font-mono p-[var(--spacing-3)] overflow-x-auto max-h-[300px] overflow-y-auto"
            style={{ background: 'var(--code-bg)', color: 'var(--code-t1)' }}
          >
            {entry.diff!.split('\n').map((line, i) => {
              const isAdd = line.startsWith('+');
              const isDel = line.startsWith('-');
              return (
                <div
                  key={i}
                  style={{
                    background: isAdd
                      ? 'rgba(90, 158, 120, 0.1)'
                      : isDel
                        ? 'rgba(196, 101, 85, 0.1)'
                        : undefined,
                    color: isAdd
                      ? '#5A9E78'
                      : isDel
                        ? '#C46555'
                        : undefined,
                  }}
                >
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </div>
  );
}
