import { useBoardStore } from '@/client/store/board-store.js';
import { PipelineFlow } from './PipelineFlow.js';
import { ActiveExecutionPanel } from './ActiveExecutionPanel.js';
import { QueuePanel } from './QueuePanel.js';
import { QualityPanel } from './QualityPanel.js';
import { ActivityStrip } from './ActivityStrip.js';

// ---------------------------------------------------------------------------
// CommandCenterView -- PipelineFlow + 3-panel grid + ActivityStrip
// ---------------------------------------------------------------------------

export function CommandCenterView() {
  const phases = useBoardStore((s) => s.board?.phases ?? []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PipelineFlow phases={phases} />
      <div className="flex-1 grid grid-cols-[1fr_1fr_320px] grid-rows-[1fr_auto] overflow-hidden">
        <ActiveExecutionPanel />
        <QueuePanel />
        <QualityPanel />
        <ActivityStrip />
      </div>
    </div>
  );
}
