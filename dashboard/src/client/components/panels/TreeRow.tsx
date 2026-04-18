import { memo, useCallback, useRef, useEffect, type ReactNode } from 'react';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import { FileIcon } from './FileIcon.js';
import type { FileNode } from '@/client/hooks/useArtifacts.js';
import type { FlatTreeNode } from '@/client/hooks/useWorkspaceTree.js';
import type { ContextMenuAction } from './FileContextMenu.js';

// ---------------------------------------------------------------------------
// TreeRow -- single row in the workspace tree
// ---------------------------------------------------------------------------
// 24px height, 16px indent per depth level, expand arrow, file icon, filename
// Supports keyboard focus and selection highlighting
// ---------------------------------------------------------------------------

export interface TreeRowProps {
  flatNode: FlatTreeNode;
  isSelected: boolean;
  isExpanded: boolean;
  isSearching: boolean;
  onClick: (node: FileNode) => void;
  onDoubleClick: (node: FileNode) => void;
  onToggleExpand: (node: FileNode) => void;
  onContextMenuAction: (action: ContextMenuAction, node: FileNode) => void;
  /** Injected context menu wrapper via render prop */
  contextMenuWrapper?: (node: FileNode, children: ReactNode) => ReactNode;
  /** Keyboard navigation focus index */
  tabIndex?: number;
}

const INDENT_PER_LEVEL = 16;
const ROW_HEIGHT = 24;

export const TreeRow = memo(function TreeRow({
  flatNode,
  isSelected,
  isExpanded,
  isSearching,
  onClick,
  onDoubleClick,
  onToggleExpand,
  contextMenuWrapper,
  tabIndex,
}: TreeRowProps) {
  const { node, depth } = flatNode;
  const rowRef = useRef<HTMLDivElement>(null);

  const isDir = node.type === 'directory';
  const indentPx = depth * INDENT_PER_LEVEL;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isDir) {
        onToggleExpand(node);
      } else {
        onClick(node);
      }
    },
    [isDir, onToggleExpand, onClick, node],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDoubleClick(node);
    },
    [onDoubleClick, node],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (isDir) {
          onToggleExpand(node);
        } else {
          onDoubleClick(node);
        }
      }
    },
    [isDir, onToggleExpand, onDoubleClick, node],
  );

  // Scroll into view when selected via keyboard
  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelected]);

  const rowContent = (
    <div
      ref={rowRef}
      role="treeitem"
      aria-expanded={isDir ? isExpanded : undefined}
      aria-selected={isSelected}
      tabIndex={tabIndex ?? -1}
      className={[
        'flex items-center w-full text-left cursor-pointer select-none',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border-focused)]',
        isSelected
          ? 'bg-bg-active'
          : 'hover:bg-bg-hover',
      ].join(' ')}
      style={{
        height: ROW_HEIGHT,
        paddingLeft: indentPx,
        paddingRight: 8,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      title={node.path}
    >
      {/* Indent guides -- vertical lines per depth level */}
      {Array.from({ length: depth }, (_, i) => (
        <span
          key={i}
          className="shrink-0 self-stretch"
          style={{
            width: INDENT_PER_LEVEL,
            borderLeft: '1px solid var(--color-border-divider)',
            marginLeft: i === 0 ? 0 : -INDENT_PER_LEVEL,
            position: 'relative',
            left: 0,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Expand/collapse arrow */}
      <span
        className="flex items-center justify-center shrink-0"
        style={{ width: 16 }}
      >
        {isDir ? (
          <ChevronRight
            size={12}
            strokeWidth={2}
            className={[
              'text-text-tertiary transition-transform duration-[var(--duration-normal)]',
              isExpanded || isSearching ? 'rotate-90' : '',
            ].join(' ')}
          />
        ) : null}
      </span>

      {/* File/folder icon */}
      <span className="shrink-0 mr-[var(--spacing-1)]">
        <FileIcon
          extension={node.extension}
          filename={node.name}
          isDirectory={isDir}
          isExpanded={isExpanded || isSearching}
          size={14}
        />
      </span>

      {/* Name */}
      <span
        className={[
          'truncate text-[length:var(--font-size-sm)]',
          isDir
            ? 'font-[var(--font-weight-semibold)] text-text-primary'
            : isSelected
              ? 'text-text-primary'
              : 'text-text-secondary',
        ].join(' ')}
      >
        {node.name}
      </span>

      {/* Loading indicator for unloaded directories */}
      {isDir && !node.isLoaded && (isExpanded || isSearching) && (
        <span className="ml-auto text-text-tertiary text-[length:var(--font-size-xs)] shrink-0 animate-pulse">
          ...
        </span>
      )}
    </div>
  );

  // Wrap with context menu if provider is given
  if (contextMenuWrapper) {
    return <>{contextMenuWrapper(node, rowContent)}</>;
  }

  return rowContent;
});
