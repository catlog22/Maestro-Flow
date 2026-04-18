import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import Search from 'lucide-react/dist/esm/icons/search.js';
import ChevronsDownUp from 'lucide-react/dist/esm/icons/chevrons-down-up.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import { useWorkspaceTree } from '@/client/hooks/useWorkspaceTree.js';
import { useLayoutContext, useLayoutSelector } from '@/client/components/layout/LayoutContext.js';
import { eventBus } from '@/client/lib/event-bus.js';
import { TreeRow } from './TreeRow.js';
import { FileContextMenu, type ContextMenuAction } from './FileContextMenu.js';
import type { FileNode } from '@/client/hooks/useArtifacts.js';

// ---------------------------------------------------------------------------
// ExplorerPanel -- workspace file tree in Primary Side Bar
// ---------------------------------------------------------------------------
// - Search bar at top with 200ms debounce
// - Virtualized tree via react-virtuoso with FlatTreeNode[] data
// - Panel header with collapse-all and refresh buttons
// - Double-click dispatches OPEN_FILE_IN_EDITOR
// - Single-click dispatches FILE_PREVIEW_REQUEST
// - Context menu with 8 file/directory operations
// - Keyboard navigation: arrow keys, Enter, F2 (rename), Delete
// ---------------------------------------------------------------------------

const VIRTUAL_SCROLL_THRESHOLD = 200;
const ROW_HEIGHT = 24;

export function ExplorerPanel() {
  const { state, dispatch } = useLayoutContext();
  const focusedGroupId = useLayoutSelector((s) => s.focusedGroupId);
  const secondaryVisible = useLayoutSelector((s) => s.secondarySidebar.visible);

  const {
    flatNodes,
    loading,
    expandedPaths,
    searchQuery,
    setSearchQuery,
    toggleExpand,
    collapseAll,
    refreshTree,
  } = useWorkspaceTree();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const useVirtualScrolling = flatNodes.length > VIRTUAL_SCROLL_THRESHOLD;

  // ---- Click handlers ----

  const handleSingleClick = useCallback(
    (node: FileNode) => {
      setSelectedPath(node.path);
      // Preview in secondary sidebar if visible
      if (secondaryVisible && node.type === 'file') {
        eventBus.dispatch('FILE_PREVIEW_REQUEST', { filePath: node.path });
      }
    },
    [secondaryVisible],
  );

  const handleDoubleClick = useCallback(
    (node: FileNode) => {
      if (node.type !== 'file') return;

      // Open as pinned tab in focused editor group
      const tab = {
        id: `tab-file-${node.path}`,
        type: 'file' as const,
        title: node.name,
        ref: node.path,
      };
      dispatch({ type: 'OPEN_TAB', groupId: focusedGroupId, tab });
    },
    [dispatch, focusedGroupId],
  );

  // ---- Context menu actions ----

  const handleContextMenuAction = useCallback(
    (action: ContextMenuAction, node: FileNode) => {
      switch (action) {
        case 'open':
          handleDoubleClick(node);
          break;
        case 'openToSide': {
          // Open in editor group (could split first if needed)
          const tab = {
            id: `tab-file-${node.path}`,
            type: 'file' as const,
            title: node.name,
            ref: node.path,
          };
          dispatch({ type: 'OPEN_TAB', groupId: focusedGroupId, tab });
          break;
        }
        case 'rename':
          // TODO: inline rename -- Phase 2 enhancement
          break;
        case 'delete':
          // TODO: confirm and delete -- Phase 2 enhancement
          break;
        case 'newFile':
        case 'newFolder':
          // TODO: create new file/folder in directory -- Phase 2 enhancement
          break;
      }
    },
    [handleDoubleClick, dispatch, focusedGroupId],
  );

  // ---- Keyboard navigation ----

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const total = flatNodes.length;
      if (total === 0) return;

      let newIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          newIndex = Math.min(focusedIndex + 1, total - 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          newIndex = Math.max(focusedIndex - 1, 0);
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = total - 1;
          break;
        case 'F2': {
          e.preventDefault();
          const focusedNode = flatNodes[focusedIndex];
          if (focusedNode) {
            handleContextMenuAction('rename', focusedNode.node);
          }
          return;
        }
        case 'Delete': {
          e.preventDefault();
          const delNode = flatNodes[focusedIndex];
          if (delNode) {
            handleContextMenuAction('delete', delNode.node);
          }
          return;
        }
        default:
          return;
      }

      setFocusedIndex(newIndex);
      if (flatNodes[newIndex]) {
        setSelectedPath(flatNodes[newIndex].node.path);
      }

      // Scroll virtual list to keep focused item visible
      if (virtuosoRef.current) {
        virtuosoRef.current.scrollIntoView({ index: newIndex });
      }
    },
    [focusedIndex, flatNodes, handleContextMenuAction],
  );

  // Reset focused index when search changes the list
  useEffect(() => {
    setFocusedIndex(-1);
  }, [searchQuery]);

  // ---- Context menu wrapper for TreeRow ----

  const contextMenuWrapper = useCallback(
    (node: FileNode, children: React.ReactNode) => (
      <FileContextMenu node={node} onAction={handleContextMenuAction}>
        {children}
      </FileContextMenu>
    ),
    [handleContextMenuAction],
  );

  // ---- Virtuoso row renderer ----

  const itemContent = useCallback(
    (index: number) => {
      const flatNode = flatNodes[index];
      if (!flatNode) return null;

      const isSelected = flatNode.node.path === selectedPath;
      const isExpanded = expandedPaths.has(flatNode.node.path);
      const isSearching = searchQuery.trim().length > 0;

      return (
        <TreeRow
          flatNode={flatNode}
          isSelected={isSelected}
          isExpanded={isExpanded}
          isSearching={isSearching}
          onClick={handleSingleClick}
          onDoubleClick={handleDoubleClick}
          onToggleExpand={toggleExpand}
          onContextMenuAction={handleContextMenuAction}
          contextMenuWrapper={contextMenuWrapper}
          tabIndex={index === focusedIndex ? 0 : -1}
        />
      );
    },
    [flatNodes, selectedPath, expandedPaths, searchQuery, focusedIndex, handleSingleClick, handleDoubleClick, toggleExpand, handleContextMenuAction, contextMenuWrapper],
  );

  // ---- Loading state ----

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-[var(--spacing-2)] p-[var(--spacing-4)] text-text-tertiary">
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-[length:var(--font-size-xs)]">Loading workspace...</span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-bg-primary"
      role="tree"
      aria-label="File explorer"
      onKeyDown={handleKeyDown}
    >
      {/* Panel header */}
      <div className="flex items-center gap-[var(--spacing-2)] px-[var(--spacing-3)] shrink-0" style={{ height: 28 }}>
        <span className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-tertiary uppercase tracking-[var(--letter-spacing-wide)]">
          Explorer
        </span>
        <div className="ml-auto flex items-center gap-[var(--spacing-0-5)]">
          {/* Collapse all */}
          <button
            type="button"
            onClick={collapseAll}
            className="p-[var(--spacing-0-5)] rounded-[var(--radius-sm)] text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="Collapse All"
          >
            <ChevronsDownUp size={14} />
          </button>
          {/* Refresh */}
          <button
            type="button"
            onClick={refreshTree}
            className="p-[var(--spacing-0-5)] rounded-[var(--radius-sm)] text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Search input */}
      <div className="px-[var(--spacing-2)] pb-[var(--spacing-1)] shrink-0">
        <div className={[
          'flex items-center gap-[var(--spacing-1-5)] px-[var(--spacing-2)]',
          'bg-bg-secondary border border-border-divider rounded-[var(--radius-md)]',
          'focus-within:border-accent-purple',
          'transition-colors duration-[var(--duration-fast)]',
        ].join(' ')} style={{ height: 26 }}>
          <Search size={12} strokeWidth={2} className="text-text-tertiary shrink-0" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            aria-label="Search files"
            className="w-full bg-transparent border-none outline-none text-[11px] text-text-primary placeholder:text-text-placeholder"
          />
        </div>
      </div>

      {/* Tree content */}
      <div className="flex-1 min-h-0">
        {flatNodes.length === 0 ? (
          <div className="p-[var(--spacing-3)] text-text-tertiary text-[length:var(--font-size-xs)] italic">
            {searchQuery ? 'No files match your search' : 'No files in workspace'}
          </div>
        ) : useVirtualScrolling ? (
          <Virtuoso
            ref={virtuosoRef}
            data={flatNodes}
            itemContent={itemContent}
            fixedItemHeight={ROW_HEIGHT}
            overscan={50}
          />
        ) : (
          <div className="overflow-y-auto h-full">
            {flatNodes.map((flatNode, index) => {
              const isSelected = flatNode.node.path === selectedPath;
              const isExpanded = expandedPaths.has(flatNode.node.path);
              const isSearching = searchQuery.trim().length > 0;

              return (
                <TreeRow
                  key={flatNode.node.path}
                  flatNode={flatNode}
                  isSelected={isSelected}
                  isExpanded={isExpanded}
                  isSearching={isSearching}
                  onClick={handleSingleClick}
                  onDoubleClick={handleDoubleClick}
                  onToggleExpand={toggleExpand}
                  onContextMenuAction={handleContextMenuAction}
                  contextMenuWrapper={contextMenuWrapper}
                  tabIndex={index === focusedIndex ? 0 : -1}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
