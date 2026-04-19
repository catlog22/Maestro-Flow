import { useEffect, useMemo, useRef } from 'react';
import { useLayoutContext, useLayoutSelector } from '@/client/components/layout/LayoutContext.js';
import { EditorGroupContainer } from '@/client/components/layout/editor-group/EditorGroupContainer.js';
import { useAgentStore } from '@/client/store/agent-store.js';
import { AGENT_LABELS } from '@/shared/constants.js';
import { MessageSquare } from 'lucide-react';
import { ChatInput } from '@/client/pages/chat/ChatInput.js';

// ---------------------------------------------------------------------------
// ChatWorkspace — connects agent-store sessions to LayoutContext editor tabs
// ---------------------------------------------------------------------------
// Single-direction sync: agent-store → LayoutContext (one-way)
// Tab selection in LayoutContext does NOT write back to agent-store to avoid loops
// ---------------------------------------------------------------------------

/** Get the first leaf node from a tree */
function getFirstLeaf(node: import('@/client/types/layout-types.js').EditorGroupNode): import('@/client/types/layout-types.js').EditorGroupLeaf {
  return node.type === 'leaf' ? node : getFirstLeaf(node.first);
}

export function ChatWorkspace() {
  const { dispatch } = useLayoutContext();
  const editorArea = useLayoutSelector((s) => s.editorArea);
  const processes = useAgentStore((s) => s.processes);
  const activeProcessId = useAgentStore((s) => s.activeProcessId);
  const setActiveProcessId = useAgentStore((s) => s.setActiveProcessId);

  // Stable ref to the default group ID (doesn't change unless tree is restructured)
  const defaultGroupId = getFirstLeaf(editorArea).id;

  // Track which process IDs have been synced as tabs (persists across renders)
  const syncedProcessIds = useRef<Set<string>>(new Set());

  // Filter: only show active processes as tabs (not stopped/error older than 2 min)
  const activeProcessEntries = useMemo(() => {
    const TWO_MIN = 2 * 60 * 1000;
    const now = Date.now();
    return Object.entries(processes).filter(([id, proc]) => {
      // Always show running/spawning/paused
      if (proc.status === 'running' || proc.status === 'spawning' || proc.status === 'paused') return true;
      // Show active process regardless
      if (id === activeProcessId) return true;
      // Show recently stopped (within 2 min)
      if (proc.status === 'stopped' || proc.status === 'error') {
        const age = now - new Date(proc.startedAt).getTime();
        return age < TWO_MIN;
      }
      return false;
    });
  }, [processes, activeProcessId]);

  // Sync agent processes → LayoutContext tabs (one-way: agent-store → layout)
  useEffect(() => {
    const activeIds = new Set(activeProcessEntries.map(([id]) => id));
    const leaf = getFirstLeaf(editorArea);
    const existingTabRefs = new Set(leaf.tabs.map((t) => t.ref));

    // Open tabs for active processes
    for (const [procId, proc] of activeProcessEntries) {
      if (!existingTabRefs.has(procId)) {
        const label = AGENT_LABELS[proc.type] ?? proc.type;
        dispatch({
          type: 'OPEN_TAB',
          groupId: defaultGroupId,
          tab: {
            id: `chat-${procId}`,
            type: 'chat',
            title: label,
            ref: procId,
            icon: MessageSquare,
          },
        });
      }
    }

    // Close tabs for removed/dismissed processes
    for (const tab of leaf.tabs) {
      if (tab.type === 'chat' && tab.ref && !activeIds.has(tab.ref)) {
        dispatch({
          type: 'CLOSE_TAB',
          groupId: defaultGroupId,
          tabId: tab.id,
        });
      }
    }
  }, [activeProcessEntries, defaultGroupId, dispatch, editorArea]);

  // Sync activeProcessId → LayoutContext active tab (one-way)
  useEffect(() => {
    if (!activeProcessId) return;
    const tabId = `chat-${activeProcessId}`;
    const leaf = getFirstLeaf(editorArea);
    const hasTab = leaf.tabs.some((t) => t.id === tabId);
    if (hasTab && leaf.activeTabId !== tabId) {
      dispatch({ type: 'SET_ACTIVE_TAB', groupId: leaf.id, tabId });
    }
  }, [activeProcessId, editorArea, dispatch]);

  // Show welcome view when no active processes exist
  const hasProcesses = activeProcessEntries.length > 0;

  if (!hasProcesses) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ marginTop: '-5vh' }}>
        <div className="w-full px-4" style={{ maxWidth: 'clamp(360px, calc(100% - 32px), 780px)' }}>
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: 'var(--color-tint-exploring)' }}
            >
              <MessageSquare size={24} strokeWidth={1.5} style={{ color: 'var(--color-accent-blue)' }} />
            </div>
            <h1 className="text-xl font-semibold mb-2 text-center" style={{ color: 'var(--color-text-primary)' }}>
              Start a new conversation
            </h1>
            <p className="text-[13px] text-center" style={{ color: 'var(--color-text-tertiary)' }}>
              Select an agent, type a message, and press Enter to begin.
            </p>
          </div>
          <ChatInput />
        </div>
      </div>
    );
  }

  return (
    <EditorGroupContainer />
  );
}
