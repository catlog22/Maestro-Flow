import { useState, useEffect } from 'react';
import { useAgentStore } from '@/client/store/agent-store.js';
import { useApprovalKeyboard } from '@/client/hooks/useApprovalKeyboard.js';
import { useWorkspaceTree } from '@/client/hooks/useWorkspaceTree.js';
import { HistoryPanel } from './SessionSidebar.js';
import { TreeBrowser } from '@/client/components/artifacts/TreeBrowser.js';
import { ChatWorkspace } from '@/client/components/chat/ChatWorkspace.js';
import { ChatSidebarContext } from '@/client/components/chat/ChatSidebarContext.js';

// ---------------------------------------------------------------------------
// ChatPage — VS Code-style multi-split layout
// ---------------------------------------------------------------------------
// ChatWorkspace renders EditorGroupContainer which manages tabs, splits,
// workspace mode switcher, and split buttons — all in the header row.
// ChatPage handles side panel state and provides toggle callbacks via context.
// ---------------------------------------------------------------------------

export function ChatPage() {
  const activeProcessId = useAgentStore((s) => s.activeProcessId);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const workspace = useWorkspaceTree();

  useApprovalKeyboard(activeProcessId);

  return (
    <ChatSidebarContext value={{ fileTreeOpen, setFileTreeOpen, historyOpen, setHistoryOpen }}>
      <div className="h-full flex min-w-0 overflow-hidden relative">
        {/* Collapsible file tree panel (left sidebar) */}
        <div
          className="shrink-0 flex flex-col overflow-hidden border-r transition-[width] duration-200 ease-[var(--ease-notion)]"
          style={{
            width: fileTreeOpen ? 260 : 0,
            borderColor: fileTreeOpen ? 'var(--color-border)' : 'transparent',
          }}
        >
          {fileTreeOpen && (
            <TreeBrowser
              tree={workspace.tree}
              selectedPath={null}
              onSelectFile={() => {}}
              loading={workspace.loading}
            />
          )}
        </div>

        {/* Main workspace area — EditorGroupContainer with tabs + splits */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <ChatWorkspace />
        </div>

        {/* Collapsible history panel (right sidebar) */}
        <HistoryPanel open={historyOpen} />
      </div>
    </ChatSidebarContext>
  );
}
