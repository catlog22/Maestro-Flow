import { memo, useCallback, useRef, type DragEvent } from 'react';
import { Tab } from './Tab.js';
import { useLayoutContext, useLayoutSelector } from '@/client/components/layout/LayoutContext.js';
import { useAgentStore } from '@/client/store/agent-store.js';
import type { TabSession, EditorGroupNode, EditorGroupLeaf } from '@/client/types/layout-types.js';

// ---------------------------------------------------------------------------
// TabBar -- 35px horizontal tab strip within each EditorGroupLeaf
// ---------------------------------------------------------------------------
// - Renders tabs for open sessions in the group
// - HTML5 Drag and Drop: reorder within group, move between groups
// - Horizontal scroll for overflow with gradient fade at edges
// - Tab visual states: default, hover, active, dragging, drop-target
// - DragData format: { type: 'maestro-tab-drag', tabId, sourceGroupId, processId }
// ---------------------------------------------------------------------------

/** MIME type for tab drag data */
const TAB_DRAG_MIME = 'application/json';
const TAB_DRAG_TYPE = 'maestro-tab-drag';

export interface TabDragData {
  type: typeof TAB_DRAG_TYPE;
  tabId: string;
  sourceGroupId: string;
  processId?: string;
}

export interface TabBarProps {
  tabs: TabSession[];
  activeTabId: string | null;
  groupId: string;
  isFocused: boolean;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

/** Collect all leaf nodes from the editor tree */
function collectLeaves(node: EditorGroupNode): EditorGroupLeaf[] {
  if (node.type === 'leaf') return [node];
  return [...collectLeaves(node.first), ...collectLeaves(node.second)];
}

export const TabBar = memo(function TabBar({
  tabs,
  activeTabId,
  groupId,
  isFocused,
  onTabSelect,
  onTabClose,
}: TabBarProps) {
  const { state, dispatch } = useLayoutContext();
  const processes = useAgentStore((s) => s.processes);
  const scrollRef = useRef<HTMLDivElement>(null);

  // -- Drag initiation --
  const handleDragStart = useCallback(
    (tabId: string, event: DragEvent<HTMLElement>) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      const dragData: TabDragData = {
        type: TAB_DRAG_TYPE,
        tabId,
        sourceGroupId: groupId,
        processId: tab.ref,
      };

      event.dataTransfer.setData(TAB_DRAG_MIME, JSON.stringify(dragData));
      event.dataTransfer.effectAllowed = 'move';
    },
    [tabs, groupId],
  );

  // -- Drop handling (reorder + cross-group move) --
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData(TAB_DRAG_MIME);
      if (!raw) return;

      let dragData: TabDragData;
      try {
        dragData = JSON.parse(raw);
      } catch {
        return;
      }

      if (dragData.type !== TAB_DRAG_TYPE) return;

      // Find the tab in the source group
      const sourceLeaf = collectLeaves(state.editorArea).find(
        (l) => l.id === dragData.sourceGroupId,
      );
      if (!sourceLeaf) return;

      const tab = sourceLeaf.tabs.find((t) => t.id === dragData.tabId);
      if (!tab) return;

      if (dragData.sourceGroupId === groupId) {
        // Reorder within same group -- just activate (full reorder is a future enhancement)
        dispatch({ type: 'SET_ACTIVE_TAB', groupId, tabId: dragData.tabId });
      } else {
        // Move between groups: close in source, open in target
        dispatch({ type: 'CLOSE_TAB', groupId: dragData.sourceGroupId, tabId: dragData.tabId });
        dispatch({ type: 'OPEN_TAB', groupId, tab });
      }
    },
    [state.editorArea, groupId, dispatch],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  if (tabs.length === 0) return null;

  return (
    <div
      className="flex items-center h-[var(--size-tabbar-height)] min-h-[var(--size-tabbar-height)] bg-bg-secondary overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      data-tab-bar={groupId}
    >
      {/* Scrollable tab container */}
      <div
        ref={scrollRef}
        className="flex items-end h-full overflow-x-auto scrollbar-none"
        role="tablist"
        aria-label="Open sessions"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          // Get process status for the dot indicator
          const process = tab.ref ? processes[tab.ref] : undefined;
          const processStatus = process?.status;

          return (
            <Tab
              key={tab.id}
              tab={tab}
              isActive={isActive}
              isFocused={isFocused}
              processStatus={processStatus}
              onSelect={onTabSelect}
              onClose={onTabClose}
              onDragStart={handleDragStart}
              groupId={groupId}
            />
          );
        })}
      </div>
    </div>
  );
});
