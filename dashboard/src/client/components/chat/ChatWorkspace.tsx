import { useEffect, useCallback, useRef } from 'react';
import { useLayoutContext, useLayoutSelector } from '@/client/components/layout/LayoutContext.js';
import { EditorGroupContainer } from '@/client/components/layout/editor-group/EditorGroupContainer.js';
import { useAgentStore } from '@/client/store/agent-store.js';
import { useUIPrefsStore } from '@/client/store/ui-prefs-store.js';
import { AGENT_LABELS } from '@/shared/constants.js';
import { MessageSquare } from 'lucide-react';
import { ChatInput } from '@/client/pages/chat/ChatInput.js';

// ---------------------------------------------------------------------------
// ChatWorkspace — connects agent-store sessions to LayoutContext editor tabs
// ---------------------------------------------------------------------------
// - Syncs agent processes as chat tabs in the editor group
// - Syncs activeProcessId with LayoutContext focused tab
// - Renders EditorGroupContainer which handles all split/tab UI
// ---------------------------------------------------------------------------

/** Get the first leaf node from a tree */
function getFirstLeaf(node: import('@/client/types/layout-types.js').EditorGroupNode): import('@/client/types/layout-types.js').EditorGroupLeaf {
  return node.type === 'leaf' ? node : getFirstLeaf(node.first);
}

export function ChatWorkspace() {
  const { state, dispatch } = useLayoutContext();
  const processes = useAgentStore((s) => s.processes);
  const activeProcessId = useAgentStore((s) => s.activeProcessId);
  const setActiveProcessId = useAgentStore((s) => s.setActiveProcessId);
  const stylePreset = useUIPrefsStore((s) => s.stylePreset);

  const defaultGroup = getFirstLeaf(state.editorArea);
  const defaultGroupId = defaultGroup.id;

  // Track which process IDs are already represented as tabs
  const tabbedProcessIds = useRef<Set<string>>(new Set());

  // Sync agent processes → editor group tabs
  useEffect(() => {
    const processIds = new Set(Object.keys(processes));

    // Add tabs for new processes
    for (const [procId, proc] of Object.entries(processes)) {
      if (!tabbedProcessIds.current.has(procId)) {
        tabbedProcessIds.current.add(procId);
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

    // Close tabs for removed processes
    for (const tabbedId of tabbedProcessIds.current) {
      if (!processIds.has(tabbedId)) {
        tabbedProcessIds.current.delete(tabbedId);
        dispatch({
          type: 'CLOSE_TAB',
          groupId: defaultGroupId,
          tabId: `chat-${tabbedId}`,
        });
      }
    }
  }, [processes, defaultGroupId, dispatch]);

  // Sync activeProcessId → LayoutContext active tab
  useEffect(() => {
    if (activeProcessId) {
      const tabId = `chat-${activeProcessId}`;
      // Check if tab exists in default group
      const leaf = getFirstLeaf(state.editorArea);
      const hasTab = leaf.tabs.some((t) => t.id === tabId);
      if (hasTab) {
        dispatch({ type: 'SET_ACTIVE_TAB', groupId: leaf.id, tabId });
      }
    }
  }, [activeProcessId, state.editorArea, dispatch]);

  // Sync LayoutContext tab changes → agent-store activeProcessId
  const handleTabChange = useCallback(() => {
    const leaf = getFirstLeaf(state.editorArea);
    if (leaf.activeTabId && leaf.activeTabId.startsWith('chat-')) {
      const processId = leaf.activeTabId.replace('chat-', '');
      if (processId !== activeProcessId && processes[processId]) {
        setActiveProcessId(processId);
      }
    }
  }, [state.editorArea, activeProcessId, processes, setActiveProcessId]);

  // Watch for tab focus changes via focusedGroupId
  const prevFocusedTabRef = useRef<string | null>(null);
  useEffect(() => {
    const leaf = getFirstLeaf(state.editorArea);
    if (leaf.activeTabId !== prevFocusedTabRef.current) {
      prevFocusedTabRef.current = leaf.activeTabId;
      handleTabChange();
    }
  }, [state.editorArea, handleTabChange]);

  // Show welcome view when no active session
  const showWelcome = !activeProcessId && Object.keys(processes).length === 0;

  if (showWelcome) {
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
