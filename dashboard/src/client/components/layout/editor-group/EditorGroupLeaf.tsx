import { memo, useCallback, useEffect, useRef } from 'react';
import { SplitSquareHorizontal, Rows } from 'lucide-react';
import { useLayoutContext, useLayoutSelector } from '@/client/components/layout/LayoutContext.js';
import { useEditorContent } from './EditorContentContext.js';
import { TabBar } from './TabBar.js';
import type { EditorGroupLeaf as EditorGroupLeafType, TabSession } from '@/client/types/layout-types.js';
import { MessageArea } from '@/client/pages/chat/MessageArea.js';
import { ChatInput } from '@/client/pages/chat/ChatInput.js';
import { ThoughtDisplay } from '@/client/pages/chat/ThoughtDisplay.js';
import { FileViewer } from '@/client/pages/chat/FileViewer.js';

// ---------------------------------------------------------------------------
// EditorGroupLeaf -- renders TabBar slot + content area for a leaf node
// ---------------------------------------------------------------------------
// - TabBar renders tabs for open sessions with drag-and-drop support
// - Inactive tab content preserved via CSS display:none (not conditional rendering)
// - Empty leaf renders a welcome view with quick-start cards
// - Split buttons visible in header (hover-reveal)
// ---------------------------------------------------------------------------

interface EditorGroupLeafProps {
  node: EditorGroupLeafType;
}

/** Maximum split depth allowed */
const MAX_SPLIT_DEPTH = 2;

/** Count the depth of a leaf node in the tree by walking from root */
function getNodeDepth(
  root: import('@/client/types/layout-types.js').EditorGroupNode,
  targetId: string,
): number {
  if (root.type === 'leaf') return root.id === targetId ? 0 : -1;
  const firstDepth = getNodeDepth(root.first, targetId);
  if (firstDepth >= 0) return firstDepth + 1;
  const secondDepth = getNodeDepth(root.second, targetId);
  if (secondDepth >= 0) return secondDepth + 1;
  return -1;
}

/** Welcome view shown when no tabs are open */
function WelcomeView() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-[320px]">
        <h2
          className="text-[length:var(--font-size-lg)] font-[var(--font-weight-semibold)] text-text-secondary mb-[var(--spacing-2)]"
        >
          Maestro Dashboard
        </h2>
        <p className="text-[length:var(--font-size-sm)] text-text-tertiary mb-[var(--spacing-4)]">
          Open a session or file to get started.
        </p>
        <div className="grid grid-cols-2 gap-[var(--spacing-2)]">
          <WelcomeCard label="New Chat" shortcut="Ctrl+Shift+C" />
          <WelcomeCard label="Open File" shortcut="Ctrl+O" />
          <WelcomeCard label="Workflow" shortcut="Ctrl+Shift+W" />
          <WelcomeCard label="Settings" shortcut="Ctrl+," />
        </div>
      </div>
    </div>
  );
}

function WelcomeCard({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="flex flex-col items-center gap-[var(--spacing-1)] p-[var(--spacing-3)] rounded-[var(--radius-default)] border border-border hover:bg-bg-hover cursor-pointer transition-colors">
      <span className="text-[length:var(--font-size-sm)] text-text-secondary">{label}</span>
      <span className="text-[length:var(--font-size-xs)] text-text-tertiary">{shortcut}</span>
    </div>
  );
}

/** Renders content based on tab type */
function TabContentRenderer({ tab }: { tab: TabSession }) {
  switch (tab.type) {
    case 'chat':
    case 'agent':
      return (
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-hidden">
            <MessageArea processId={tab.ref} />
          </div>
          <ThoughtDisplay processId={tab.ref} />
          <ChatInput processId={tab.ref} />
        </div>
      );
    case 'file':
      return <FileViewer filePath={tab.ref} onClose={() => {}} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-text-tertiary text-[length:var(--font-size-sm)]">
          {tab.title}
        </div>
      );
  }
}

export const EditorGroupLeaf = memo(function EditorGroupLeaf({ node }: EditorGroupLeafProps) {
  const { state, dispatch } = useLayoutContext();
  const focusedGroupId = useLayoutSelector((s) => s.focusedGroupId);
  const routedContent = useEditorContent();
  const isFocused = focusedGroupId === node.id;
  const isDefaultGroup = node.id === 'editor-group-1';

  // Refs for keyboard shortcut values
  const tabsRef = useRef(node.tabs);
  tabsRef.current = node.tabs;
  const activeTabIdRef = useRef(node.activeTabId);
  activeTabIdRef.current = node.activeTabId;
  const groupIdRef = useRef(node.id);
  groupIdRef.current = node.id;

  const handleTabClick = useCallback((tabId: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', groupId: node.id, tabId });
  }, [dispatch, node.id]);

  const handleTabClose = useCallback((tabId: string) => {
    dispatch({ type: 'CLOSE_TAB', groupId: node.id, tabId });
  }, [dispatch, node.id]);

  const handleSplitHorizontal = useCallback(() => {
    dispatch({ type: 'SPLIT_GROUP', groupId: node.id, direction: 'horizontal' });
  }, [dispatch, node.id]);

  const handleSplitVertical = useCallback(() => {
    dispatch({ type: 'SPLIT_GROUP', groupId: node.id, direction: 'vertical' });
  }, [dispatch, node.id]);

  const handleFocus = useCallback(() => {
    if (!isFocused) {
      dispatch({ type: 'SET_FOCUSED_GROUP', groupId: node.id });
    }
  }, [dispatch, node.id, isFocused]);

  // -- Keyboard shortcuts: Ctrl+Tab / Ctrl+Shift+Tab / Ctrl+W --
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tabs = tabsRef.current;
      const activeTabId = activeTabIdRef.current;
      const gid = groupIdRef.current;

      // Ctrl+Tab: cycle to next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        if (tabs.length < 2) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const nextIdx = (idx + 1) % tabs.length;
        dispatch({ type: 'SET_ACTIVE_TAB', groupId: gid, tabId: tabs[nextIdx].id });
        return;
      }

      // Ctrl+Shift+Tab: cycle to previous tab
      if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        if (tabs.length < 2) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const prevIdx = (idx - 1 + tabs.length) % tabs.length;
        dispatch({ type: 'SET_ACTIVE_TAB', groupId: gid, tabId: tabs[prevIdx].id });
        return;
      }

      // Ctrl+W: close active tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (!activeTabId) return;
        dispatch({ type: 'CLOSE_TAB', groupId: gid, tabId: activeTabId });
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  const canSplit = getNodeDepth(state.editorArea, node.id) < MAX_SPLIT_DEPTH;

  return (
    <div
      className={`flex flex-col h-full overflow-hidden ${
        isFocused ? '' : ''
      }`}
      onMouseDown={handleFocus}
      data-editor-group={node.id}
    >
      {/* Header row: TabBar + split buttons */}
      <div className="relative flex items-center shrink-0">
        <TabBar
          tabs={node.tabs}
          activeTabId={node.activeTabId}
          groupId={node.id}
          isFocused={isFocused}
          onTabSelect={handleTabClick}
          onTabClose={handleTabClose}
        />
        {/* Split buttons -- hover reveal, only when depth allows */}
        {canSplit && (
          <div className="flex items-center gap-[2px] px-[var(--spacing-1)] opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
            <button
              className="p-[var(--spacing-1)] rounded-[var(--radius-sm)] hover:bg-bg-active text-text-tertiary hover:text-text-secondary"
              onClick={handleSplitHorizontal}
              title="Split Right (Ctrl+\\)"
              aria-label="Split right"
            >
              <SplitSquareHorizontal size={14} />
            </button>
            <button
              className="p-[var(--spacing-1)] rounded-[var(--radius-sm)] hover:bg-bg-active text-text-tertiary hover:text-text-secondary"
              onClick={handleSplitVertical}
              title="Split Down (Ctrl+K Ctrl+\\)"
              aria-label="Split down"
            >
              <Rows size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden relative">
        {node.tabs.length === 0 ? (
          isDefaultGroup && routedContent ? (
            /* Render routed content (Outlet) in the default empty leaf */
            <div className="h-full overflow-y-auto">
              {routedContent}
            </div>
          ) : (
            <WelcomeView />
          )
        ) : (
          /* Render all tabs, hide inactive with display:none */
          node.tabs.map((tab) => (
            <div
              key={tab.id}
              className="absolute inset-0 flex flex-col overflow-hidden"
              style={{ display: tab.id === node.activeTabId ? 'flex' : 'none' }}
              data-tab-content={tab.id}
            >
              <TabContentRenderer tab={tab} />
            </div>
          ))
        )}
      </div>
    </div>
  );
});
