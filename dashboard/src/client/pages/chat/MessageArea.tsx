import { useState, useCallback, useEffect, useRef } from 'react';
import { useAgentStore } from '@/client/store/agent-store.js';
import { EntryRenderer } from './entries/index.js';
import { EntryContextMenu } from './entries/EntryContextMenu.js';
import { CreateIssueDialog } from '@/client/components/issues/CreateIssueDialog.js';
import type { CreateIssueRequest } from '@/shared/issue-types.js';

// Stable empty array to avoid infinite re-render from Zustand selector
const EMPTY_ENTRIES: never[] = [];

// ---------------------------------------------------------------------------
// MessageArea -- scrollable message list for a given process
// ---------------------------------------------------------------------------

export function MessageArea({ processId }: { processId: string | null }) {
  const entries = useAgentStore((s) =>
    processId ? (s.entries[processId] ?? EMPTY_ENTRIES) : EMPTY_ENTRIES,
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  // Issue creation state
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issuePrefill, setIssuePrefill] = useState<Partial<CreateIssueRequest> | undefined>();

  const handleCreateIssue = useCallback((prefill: Partial<CreateIssueRequest>) => {
    setIssuePrefill(prefill);
    setIssueDialogOpen(true);
  }, []);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (!processId) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-[length:var(--font-size-sm)]">
        Select a session or start a new conversation
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-[length:var(--font-size-sm)]">
        No messages yet
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-3 pb-6">
        <div className="max-w-[780px] mx-auto flex flex-col gap-[4px]">
          {entries.map((entry) => (
            <EntryContextMenu key={entry.id} entry={entry} onCreateIssue={handleCreateIssue}>
              <EntryRenderer entry={entry} />
            </EntryContextMenu>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <CreateIssueDialog
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
        prefill={issuePrefill}
      />
    </>
  );
}
