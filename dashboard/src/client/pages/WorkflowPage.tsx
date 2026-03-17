import { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { ViewSwitcherContext } from '@/client/hooks/useViewSwitcher.js';
import type { ViewSwitcherConfig } from '@/client/hooks/useViewSwitcher.js';
import { PipelineBoardView } from '@/client/components/workflow/PipelineBoardView.js';
import { PhaseTimelineView } from '@/client/components/workflow/PhaseTimelineView.js';
import { CommandCenterView } from '@/client/components/workflow/CommandCenterView.js';
import ColumnsIcon from 'lucide-react/dist/esm/icons/columns-3.js';
import ListIcon from 'lucide-react/dist/esm/icons/list.js';
import ActivityIcon from 'lucide-react/dist/esm/icons/activity.js';

// ---------------------------------------------------------------------------
// WorkflowPage -- 3-view switcher: Board / Timeline / Center
// ---------------------------------------------------------------------------

type ActiveView = 'board' | 'timeline' | 'center';

const VIEW_ORDER: ActiveView[] = ['board', 'timeline', 'center'];

export function WorkflowPage() {
  const [activeView, setActiveView] = useState<ActiveView>('board');
  const { register, unregister } = useContext(ViewSwitcherContext);

  const handleSwitch = useCallback((index: number) => {
    setActiveView(VIEW_ORDER[index]);
  }, []);

  const config: ViewSwitcherConfig = useMemo(() => ({
    items: [
      { label: 'Board', icon: <ColumnsIcon size={14} strokeWidth={2} />, shortcut: '1' },
      { label: 'Timeline', icon: <ListIcon size={14} strokeWidth={2} />, shortcut: '2' },
      { label: 'Center', icon: <ActivityIcon size={14} strokeWidth={2} />, shortcut: '3' },
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

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 min-w-0 overflow-hidden">
        {activeView === 'board' && <PipelineBoardView />}
        {activeView === 'timeline' && <PhaseTimelineView />}
        {activeView === 'center' && <CommandCenterView />}
      </div>
    </div>
  );
}
