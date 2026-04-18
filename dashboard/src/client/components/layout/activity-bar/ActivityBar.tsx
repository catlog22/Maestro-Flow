import { useEffect, useCallback, useRef, useState } from 'react';
import { getPanelsBySide } from '@/client/components/layout/panel-registry.js';
import { useLayoutSelector, useSidebarActions } from '@/client/components/layout/LayoutContext.js';
import { ActivityBarItem } from './ActivityBarItem.js';

// ---------------------------------------------------------------------------
// ActivityBar -- 48px vertical icon bar (VS Code standard)
// ---------------------------------------------------------------------------
// Reads primary panels from panel-registry, renders ActivityBarItem for each.
// Three-state toggle behavior:
//   1) Click active + sidebar visible -> collapse sidebar
//   2) Click different panel -> switch content
//   3) Click any with sidebar hidden -> show sidebar + set active
// Keyboard: Ctrl+B toggles sidebar visibility, arrow keys navigate items
// ---------------------------------------------------------------------------

export function ActivityBar() {
  const activePanelId = useLayoutSelector((s) => s.activityBar.activePanelId);
  const sidebarVisible = useLayoutSelector((s) => s.primarySidebar.visible);
  const { toggleVisible, setActivePanel } = useSidebarActions('primary');

  const primaryPanels = getPanelsBySide('primary');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLElement>(null);

  // Three-state toggle click handler
  const handleItemClick = useCallback((panelId: string) => {
    if (panelId === activePanelId && sidebarVisible) {
      // State 1: same panel + visible -> collapse
      toggleVisible();
    } else if (panelId !== activePanelId) {
      // State 2: different panel -> switch
      setActivePanel(panelId);
      if (!sidebarVisible) {
        // State 3: sidebar hidden -> also show
        toggleVisible();
      }
    } else {
      // Same panel but sidebar hidden -> show
      if (!sidebarVisible) {
        toggleVisible();
      }
    }
  }, [activePanelId, sidebarVisible, toggleVisible, setActivePanel]);

  // Ctrl+B keyboard shortcut to toggle sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleVisible();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleVisible]);

  // Arrow key navigation between items
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = Math.min(focusedIndex + 1, primaryPanels.length - 1);
      setFocusedIndex(next);
      containerRef.current?.querySelectorAll('button')[next]?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = Math.max(focusedIndex - 1, 0);
      setFocusedIndex(prev);
      containerRef.current?.querySelectorAll('button')[prev]?.focus();
    }
  }, [focusedIndex, primaryPanels.length]);

  return (
    <nav
      ref={containerRef}
      role="navigation"
      aria-label="Activity Bar"
      className={[
        'flex flex-col items-center pt-[6px] gap-[2px]',
        'w-[var(--size-activitybar-width)] shrink-0',
        'bg-bg-secondary border-r border-border',
      ].join(' ')}
      onKeyDown={handleKeyDown}
    >
      {/* Primary panel icons */}
      {primaryPanels.map((panel) => (
        <ActivityBarItem
          key={panel.id}
          id={panel.id}
          icon={panel.icon}
          label={panel.label}
          isActive={activePanelId === panel.id}
          badge={panel.badge?.() ?? null}
          onClick={() => handleItemClick(panel.id)}
          shortcut={ACTIVITY_BAR_SHORTCUTS[panel.id]}
        />
      ))}

      {/* Bottom spacer -- pushes Settings to bottom */}
      <div className="flex-1" />

      {/* Session dots area (agent process indicators) */}
      {/* Will be populated by IMPL-005 session tab bar integration */}
    </nav>
  );
}

// Keyboard shortcuts for Activity Bar panels (Ctrl+Shift+key)
const ACTIVITY_BAR_SHORTCUTS: Record<string, string> = {
  explorer: 'Ctrl+Shift+E',
  sessions: 'Ctrl+Shift+S',
  kanban: 'Ctrl+Shift+K',
  workflow: 'Ctrl+Shift+W',
  search: 'Ctrl+Shift+F',
  more: '',
  settings: '',
};
