import { memo, useCallback, type DragEvent } from 'react';
import { X } from 'lucide-react';
import type { TabSession } from '@/client/types/layout-types.js';
import type { AgentProcessStatus } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// Tab -- individual tab with 5 visual states, drag initiation, status indicator
// ---------------------------------------------------------------------------
// - Visual states: default, hover, active, dragging, drop-target
// - Active tab visually connects to content area (filled bg + accent bottom border)
// - Close button visible on hover and on active tab
// - Process status indicator (dot): running=green, paused=yellow, stopped=gray
// - HTML5 DragData transfer: { type, tabId, sourceGroupId, processId }
// ---------------------------------------------------------------------------

/** Status dot color mapping */
const STATUS_DOT_COLORS: Record<string, string> = {
  spawning: 'var(--color-accent-blue)',
  running: 'var(--color-accent-green, #4caf50)',
  paused: 'var(--color-accent-yellow)',
  stopping: 'var(--color-accent-orange)',
  stopped: 'var(--color-text-tertiary)',
  error: 'var(--color-accent-red, #e53935)',
};

export interface TabProps {
  tab: TabSession;
  isActive: boolean;
  isFocused: boolean;
  /** Process status for the dot indicator */
  processStatus?: AgentProcessStatus;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onDragStart: (tabId: string, event: DragEvent<HTMLElement>) => void;
  groupId: string;
}

export const Tab = memo(function Tab({
  tab,
  isActive,
  isFocused,
  processStatus,
  onSelect,
  onClose,
  onDragStart,
  groupId,
}: TabProps) {
  const handleClick = useCallback(() => {
    onSelect(tab.id);
  }, [onSelect, tab.id]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose(tab.id);
    },
    [onClose, tab.id],
  );

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLElement>) => {
      onDragStart(tab.id, e);
    },
    [onDragStart, tab.id],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    // Allow drop on tabs for reorder
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Status dot color
  const dotColor = processStatus ? (STATUS_DOT_COLORS[processStatus] ?? 'var(--color-text-tertiary)') : undefined;

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      className={`
        group relative flex items-center gap-[var(--spacing-1)] h-[32px]
        min-w-[120px] max-w-[240px] px-[var(--spacing-2)] cursor-pointer
        select-none whitespace-nowrap transition-colors duration-100
        text-[length:var(--font-size-xs)]
        ${isActive
          ? 'bg-bg-primary text-text-primary border-b-[2px] border-b-accent-blue'
          : 'text-text-tertiary hover:bg-bg-hover border-b-[2px] border-b-transparent'
        }
        ${isFocused && isActive ? '' : ''}
      `}
      style={{ flexShrink: 1 }}
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      draggable
      data-tab-id={tab.id}
      data-group-id={groupId}
      title={tab.title}
    >
      {/* Status indicator dot */}
      {dotColor && (
        <span
          className="w-[6px] h-[6px] rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
      )}

      {/* Tab title with ellipsis truncation */}
      <span className="truncate flex-1 min-w-0">{tab.title}</span>

      {/* Close button -- visible on hover and active */}
      <button
        className={`
          p-[2px] rounded-[var(--radius-sm)] hover:bg-bg-active transition-opacity shrink-0
          ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
        `}
        onClick={handleClose}
        aria-label={`Close ${tab.title}`}
        tabIndex={-1}
      >
        <X size={12} className="text-text-tertiary" />
      </button>
    </div>
  );
});
