import { useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import type { NormalizedEntry, EntryType } from '@/shared/agent-types.js';
import type { CreateIssueRequest } from '@/shared/issue-types.js';
import { cn } from '@/client/lib/utils.js';

// ---------------------------------------------------------------------------
// EntryContextMenu -- right-click wrapper for chat entries
// Shows "Create Issue" for supported entry types.
// ---------------------------------------------------------------------------

/** Entry types that support "Create Issue" action */
const ISSUABLE_TYPES: ReadonlySet<EntryType> = new Set([
  'assistant_message',
  'error',
  'command_exec',
  'tool_use',
]);

/** Extract pre-fill data from a NormalizedEntry for issue creation */
export function entryToIssuePrefill(entry: NormalizedEntry): Partial<CreateIssueRequest> {
  const base: Partial<CreateIssueRequest> = {
    source_entry_id: entry.id,
    source_process_id: entry.processId,
  };

  switch (entry.type) {
    case 'assistant_message':
      return {
        ...base,
        title: `Issue from assistant message`,
        description: entry.content.slice(0, 2000),
      };
    case 'error':
      return {
        ...base,
        title: `Error: ${entry.message.slice(0, 100)}`,
        description: entry.message + (entry.code ? `\nCode: ${entry.code}` : ''),
        type: 'bug',
        priority: 'high',
      };
    case 'command_exec':
      return {
        ...base,
        title: `Issue from command: ${entry.command.slice(0, 80)}`,
        description: [
          `Command: ${entry.command}`,
          entry.exitCode !== undefined ? `Exit code: ${entry.exitCode}` : '',
          entry.output ? `Output:\n${entry.output.slice(0, 1500)}` : '',
        ].filter(Boolean).join('\n'),
        type: entry.exitCode !== 0 ? 'bug' : 'task',
      };
    case 'tool_use':
      return {
        ...base,
        title: `Issue from tool: ${entry.name}`,
        description: [
          `Tool: ${entry.name}`,
          `Status: ${entry.status}`,
          `Input: ${JSON.stringify(entry.input, null, 2).slice(0, 500)}`,
          entry.result ? `Result: ${entry.result.slice(0, 1000)}` : '',
        ].filter(Boolean).join('\n'),
        type: entry.status === 'failed' ? 'bug' : 'task',
      };
    default:
      return base;
  }
}

interface EntryContextMenuProps {
  entry: NormalizedEntry;
  children: ReactNode;
  onCreateIssue: (prefill: Partial<CreateIssueRequest>) => void;
}

export function EntryContextMenu({ entry, children, onCreateIssue }: EntryContextMenuProps) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isIssuable = ISSUABLE_TYPES.has(entry.type);

  const handleContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      if (!isIssuable) return;
      e.preventDefault();
      setMenuPos({ x: e.clientX, y: e.clientY });
    },
    [isIssuable],
  );

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!menuPos) return;

    function handleClick() {
      setMenuPos(null);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuPos(null);
    }

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuPos]);

  const handleCreateIssue = useCallback(() => {
    setMenuPos(null);
    onCreateIssue(entryToIssuePrefill(entry));
  }, [entry, onCreateIssue]);

  return (
    <div onContextMenu={handleContextMenu} className="relative">
      {children}

      {menuPos && (
        <div
          ref={menuRef}
          className={cn(
            'fixed z-[100] min-w-[160px] rounded-[var(--radius-default)]',
            'border border-border bg-bg-primary shadow-lg',
            'py-[var(--spacing-1)]',
            'animate-in fade-in-0 zoom-in-95',
          )}
          style={{ left: menuPos.x, top: menuPos.y }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleCreateIssue}
            className={cn(
              'flex items-center gap-[var(--spacing-2)] w-full px-[var(--spacing-3)] py-[var(--spacing-1-5)]',
              'text-left text-[length:var(--font-size-sm)] text-text-secondary',
              'hover:bg-bg-hover hover:text-text-primary',
              'transition-colors duration-[var(--duration-fast)]',
            )}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Create Issue
          </button>
        </div>
      )}
    </div>
  );
}
