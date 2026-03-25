import { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { ViewSwitcherContext } from '@/client/hooks/useViewSwitcher.js';
import type { ViewSwitcherConfig } from '@/client/hooks/useViewSwitcher.js';
import { useBoardStore } from '@/client/store/board-store.js';
import { PipelineBoardView } from '@/client/components/workflow/PipelineBoardView.js';
import { TimelineView } from '@/client/components/kanban/TimelineView.js';
import { CommandCenterView } from '@/client/components/workflow/CommandCenterView.js';
import { WfTableView } from '@/client/components/workflow/WfTableView.js';
import { SetupChecklist } from '@/client/components/workflow/SetupChecklist.js';
import { DetailPanel } from '@/client/components/common/DetailPanel.js';
import { KanbanDetailPanel } from '@/client/components/kanban/KanbanDetailPanel.js';
import type { SelectedKanbanItem } from '@/shared/types.js';
import { useExecutionStore } from '@/client/store/execution-store.js';
import ColumnsIcon from 'lucide-react/dist/esm/icons/columns-3.js';
import ListIcon from 'lucide-react/dist/esm/icons/list.js';
import ActivityIcon from 'lucide-react/dist/esm/icons/activity.js';
import TableIcon from 'lucide-react/dist/esm/icons/table.js';

// ---------------------------------------------------------------------------
// WorkflowPage -- 4-view switcher: Board / Timeline / Center / Table
// ---------------------------------------------------------------------------

type ActiveView = 'board' | 'timeline' | 'center' | 'table';

const VIEW_ORDER: ActiveView[] = ['board', 'timeline', 'center', 'table'];

export function WorkflowPage() {
  const [activeView, setActiveView] = useState<ActiveView>('board');
  const [selectedItem, setSelectedItem] = useState<SelectedKanbanItem | null>(null);
  const { register, unregister } = useContext(ViewSwitcherContext);
  const recentDecisions = useExecutionStore((s) => s.recentDecisions);
  const advanceRecommendations = useMemo(() => {
    return recentDecisions
      .flatMap((d) => d.actions.filter((a) => a.type === 'advance_phase'))
      .slice(-3);
  }, [recentDecisions]);

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Supervisor link bar */}
      <div className="flex items-center justify-end px-[var(--spacing-4)] py-[var(--spacing-1)] border-b border-border-divider bg-bg-secondary text-[length:var(--font-size-xs)]">
        {advanceRecommendations.length > 0 && (
          <div className="flex items-center gap-[var(--spacing-2)] mr-auto">
            <span className="inline-block w-[5px] h-[5px] rounded-full bg-accent-blue animate-pulse" />
            <span className="text-text-secondary">
              Commander recommends advancing: {advanceRecommendations.map(a => a.target).join(', ')}
            </span>
          </div>
        )}
        <Link
          to="/supervisor"
          className="text-text-secondary hover:text-text-primary transition-colors font-[var(--font-weight-medium)]"
        >
          Supervisor &rarr;
        </Link>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden">
          {phases.length === 0 ? (
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
    </div>
  );
}
