import { useLayoutContext, useLayoutSelector } from '@/client/components/layout/LayoutContext.js';
import { getSortedItems } from './status-bar-registry.js';
import { StatusBarItem } from './StatusBarItem.js';

// ---------------------------------------------------------------------------
// StatusBar -- 22px persistent bar with registry-based status items
// ---------------------------------------------------------------------------
// Always visible, even when Panel is collapsed.
// Items are sorted by priority within alignment groups (left / right).
// Clicking an item with a panelTabId expands the Panel to that tab.
// ---------------------------------------------------------------------------

export function StatusBar() {
  const { dispatch } = useLayoutContext();
  const panelVisible = useLayoutSelector((s) => s.panel.visible);

  const leftItems = getSortedItems('left');
  const rightItems = getSortedItems('right');

  function handleItemClick(tabId: string | undefined) {
    if (!tabId) return;
    dispatch({ type: 'SET_PANEL_ACTIVE_TAB', tabId });
    if (!panelVisible) {
      dispatch({ type: 'SET_PANEL_VISIBLE', visible: true });
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex items-center justify-between shrink-0 select-none',
        'h-[22px] bg-bg-secondary border-t border-border',
        'text-text-secondary text-[11px] font-medium',
      ].join(' ')}
    >
      {/* Left-aligned items */}
      <div className="flex items-center h-full">
        {leftItems.map((item) => {
          const Comp = item.component;
          const clickable = !!item.panelTabId;
          return (
            <StatusBarItem
              key={item.id}
              tooltip={item.id}
              clickable={clickable}
              onClick={clickable ? () => handleItemClick(item.panelTabId) : undefined}
            >
              <Comp />
            </StatusBarItem>
          );
        })}
      </div>

      {/* Right-aligned items */}
      <div className="flex items-center h-full">
        {rightItems.map((item) => {
          const Comp = item.component;
          const clickable = !!item.panelTabId;
          return (
            <StatusBarItem
              key={item.id}
              tooltip={item.id}
              clickable={clickable}
              onClick={clickable ? () => handleItemClick(item.panelTabId) : undefined}
            >
              <Comp />
            </StatusBarItem>
          );
        })}
      </div>
    </div>
  );
}
