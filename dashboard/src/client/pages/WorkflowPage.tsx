import { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ViewSwitcherContext } from '@/client/hooks/useViewSwitcher.js';
import type { ViewSwitcherConfig } from '@/client/hooks/useViewSwitcher.js';
import { useBoardStore } from '@/client/store/board-store.js';
import { PipelineBoardView } from '@/client/components/workflow/PipelineBoardView.js';
import { TimelineView } from '@/client/components/kanban/TimelineView.js';
import { CommandCenterView } from '@/client/components/workflow/CommandCenterView.js';
import { WfTableView } from '@/client/components/workflow/WfTableView.js';
import { SetupChecklist } from '@/client/components/workflow/SetupChecklist.js';
import { CoordinatePanel } from '@/client/components/workflow/CoordinatePanel.js';
import { DetailPanel } from '@/client/components/common/DetailPanel.js';
import { KanbanDetailPanel } from '@/client/components/kanban/KanbanDetailPanel.js';
import type { SelectedKanbanItem } from '@/shared/types.js';
import ColumnsIcon from 'lucide-react/dist/esm/icons/columns-3.js';
import ListIcon from 'lucide-react/dist/esm/icons/list.js';
import ActivityIcon from 'lucide-react/dist/esm/icons/activity.js';
import TableIcon from 'lucide-react/dist/esm/icons/table.js';
import PlayIcon from 'lucide-react/dist/esm/icons/play.js';

// ---------------------------------------------------------------------------
// WorkflowPage -- 3-view switcher: Board / Timeline / Center
// ---------------------------------------------------------------------------

type ActiveView = 'board' | 'timeline' | 'center' | 'table' | 'coordinate';

const VIEW_ORDER: ActiveView[] = ['board', 'timeline', 'center', 'table', 'coordinate'];

export function WorkflowPage() {
  const [activeView, setActiveView] = useState<ActiveView>('board');
  const [selectedItem, setSelectedItem] = useState<SelectedKanbanItem | null>(null);
  const { register, unregister } = useContext(ViewSwitcherContext);
  const { phases, board, selectedPhase, setSelectedPhase } = useBoardStore(useShallow((s) => ({
    phases: s.board?.phases ?? [],
    board: s.board,
    selectedPhase: s.selectedPhase,
    setSelectedPhase: s.setSelectedPhase,
  })));

  const handleSwitch = useCallback((index: number) => {
    setActiveView(VIEW_ORDER[index]);
    setSelectedPhase(null);
    setSelectedItem(null);
  }, [setSelectedPhase]);

  const handleSelectTask = useCallback((item: SelectedKanbanItem) => {
    setSelectedItem(item);
    setSelectedPhase(null);
  }, [setSelectedPhase]);

  const config: ViewSwitcherConfig = useMemo(() => ({
    items: [
      { label: 'Board', icon: <ColumnsIcon size={14} strokeWidth={2} />, shortcut: '1' },
      { label: 'Timeline', icon: <ListIcon size={14} strokeWidth={2} />, shortcut: '2' },
      { label: 'Center', icon: <ActivityIcon size={14} strokeWidth={2} />, shortcut: '3' },
      { label: 'Table', icon: <TableIcon size={14} strokeWidth={2} />, shortcut: '4' },
      { label: 'Coordinate', icon: <PlayIcon size={14} strokeWidth={2} />, shortcut: '5' },
    ],
    activeIndex: VIEW_ORDER.indexOf(activeView),
    onSwitch: handleSwitch,
  }), [activeView, handleSwitch]);

  useEffect(() => {
    register(config);
  }, [config, register]);

  useEffect(() => {
    return () => unregister();
  }, [unregister]);

  // Determine what to show in the detail panel: selectedItem (task) takes priority, then selectedPhase
  const activeDetail: SelectedKanbanItem | null = selectedItem ?? (selectedPhase !== null ? { type: 'phase', phaseId: selectedPhase } : null);
  const detailOpen = activeDetail !== null;
  const detailTitle = activeDetail?.type === 'task' ? 'Task Detail' : 'Phase Detail';

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 min-w-0 overflow-hidden">
        {activeView === 'coordinate' ? (
          <CoordinatePanel />
        ) : phases.length === 0 ? (
          <SetupChecklist project={board?.project} />
        ) : (
          <>
            {activeView === 'board' && <PipelineBoardView onSelectTask={handleSelectTask} />}
            {activeView === 'timeline' && (
              <TimelineView
                onSelectPhase={(id) => { setSelectedItem(null); setSelectedPhase(selectedPhase === id ? null : id); }}
                onSelectTask={handleSelectTask}
              />
            )}
            {activeView === 'center' && <CommandCenterView />}
            {activeView === 'table' && <WfTableView onSelectTask={handleSelectTask} />}
          </>
        )}
      </div>

      {/* Detail panel */}
      <DetailPanel
        open={detailOpen}
        onClose={() => { setSelectedPhase(null); setSelectedItem(null); }}
        title={detailTitle}
      >
        {activeDetail !== null && (
          <KanbanDetailPanel selectedItem={activeDetail} />
        )}
      </DetailPanel>
    </div>
  );
}
