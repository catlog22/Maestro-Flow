import { CoordinatePanel } from '@/client/components/workflow/CoordinatePanel.js';

// ---------------------------------------------------------------------------
// CoordinatorTab -- wrapper that renders the existing CoordinatePanel
// ---------------------------------------------------------------------------

export function CoordinatorTab() {
  return (
    <div className="h-full overflow-hidden">
      <CoordinatePanel />
    </div>
  );
}
