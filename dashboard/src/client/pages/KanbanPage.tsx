import { useState, useEffect, useContext, useCallback } from 'react';
import { useBoardStore } from '@/client/store/board-store.js';
import { ViewSwitcherContext } from '@/client/hooks/useViewSwitcher.js';
import { FilterChipBar } from '@/client/components/common/FilterChipBar.js';
import { DetailPanel } from '@/client/components/common/DetailPanel.js';
import { KanbanBoard } from '@/client/components/kanban/KanbanBoard.js';
import { TimelineView } from '@/client/components/kanban/TimelineView.js';
import { KanbanDetailPanel } from '@/client/components/kanban/KanbanDetailPanel.js';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';

// ---------------------------------------------------------------------------
// KanbanPage — Kanban + Timeline views with filter bar and detail panel
// ---------------------------------------------------------------------------

const FILTER_CHIPS = ['All', 'Executing', 'Planning', 'Pending'] as const;

type ActiveView = 'kanban' | 'timeline';

export function KanbanPage() {
  const [activeView, setActiveView] = useState<ActiveView>('kanban');
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const { register, unregister } = useContext(ViewSwitcherContext);
  const selectedPhase = useBoardStore((s) => s.selectedPhase);
  const setSelectedPhase = useBoardStore((s) => s.setSelectedPhase);
  const board = useBoardStore((s) => s.board);

  const detailOpen = selectedPhase !== null;

  const handleViewSwitch = useCallback((index: number) => {
    setActiveView(index === 0 ? 'kanban' : 'timeline');
  }, []);

  useEffect(() => {
    register({
      items: [
        { label: 'Kanban', icon: <LayoutGrid size={14} />, shortcut: 'K' },
        { label: 'Timeline', icon: <Clock size={14} />, shortcut: 'T' },
      ],
      activeIndex: activeView === 'kanban' ? 0 : 1,
      onSwitch: handleViewSwitch,
    });
  }, [register, activeView, handleViewSwitch]);

  useEffect(() => {
    return () => unregister();
  }, [unregister]);

  function handleSelectPhase(id: number) {
    setSelectedPhase(selectedPhase === id ? null : id);
  }

  function handleCloseDetail() {
    setSelectedPhase(null);
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-[length:var(--font-size-sm)]">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="px-[var(--spacing-4)] py-[var(--spacing-2)] border-b border-border-divider shrink-0">
        <FilterChipBar
          chips={[...FILTER_CHIPS]}
          active={activeFilter}
          onSelect={setActiveFilter}
        />
      </div>

      {/* Content + Detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-auto min-w-0">
          {activeView === 'kanban' ? (
            <KanbanBoard onSelectPhase={handleSelectPhase} />
          ) : (
            <TimelineView onSelectPhase={handleSelectPhase} />
          )}
        </div>

        {/* Detail panel */}
        <DetailPanel
          open={detailOpen}
          onClose={handleCloseDetail}
          title="Phase Detail"
        >
          {selectedPhase !== null && (
            <KanbanDetailPanel phaseId={selectedPhase} />
          )}
        </DetailPanel>
      </div>
    </div>
  );
}
