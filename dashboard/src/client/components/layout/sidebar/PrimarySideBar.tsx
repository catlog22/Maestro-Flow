import { lazy, Suspense, useCallback, useMemo } from 'react';
import { getPanelById } from '@/client/components/layout/panel-registry.js';
import { useLayoutSelector, useSidebarActions } from '@/client/components/layout/LayoutContext.js';
import type { PanelRegistration } from '@/client/types/layout-types.js';

// ---------------------------------------------------------------------------
// PrimarySideBar -- collapsible panel controlled by Activity Bar
// ---------------------------------------------------------------------------
// - Panel content switches based on activityBar.activePanelId
// - Fade-only transitions (opacity 0->1, no slide/scale)
// - Lazy-loaded panels via React.lazy + Suspense
// - Width persistence via LayoutContext
// - Resizable via drag handle
// ---------------------------------------------------------------------------

/** Skeleton fallback shown during lazy load */
function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--spacing-2)] p-[var(--spacing-3)]">
      <div className="h-[14px] w-[60%] rounded-[var(--radius-sm)] bg-bg-tertiary animate-pulse" />
      <div className="h-[14px] w-[80%] rounded-[var(--radius-sm)] bg-bg-tertiary animate-pulse" />
      <div className="h-[14px] w-[45%] rounded-[var(--radius-sm)] bg-bg-tertiary animate-pulse" />
      <div className="mt-[var(--spacing-2)] h-[32px] w-full rounded-[var(--radius-sm)] bg-bg-tertiary animate-pulse" />
      <div className="h-[32px] w-full rounded-[var(--radius-sm)] bg-bg-tertiary animate-pulse" />
    </div>
  );
}

/** Resize handle on the right edge of the sidebar */
function ResizeHandle({
  startWidth,
  onResize,
}: {
  startWidth: number;
  onResize: (startWidth: number, deltaX: number) => void;
}) {
  return (
    <div
      className="absolute top-0 right-0 bottom-0 w-[4px] cursor-col-resize z-10 hover:bg-accent-blue/20 active:bg-accent-blue/30 transition-colors"
      onMouseDown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const initialWidth = startWidth;
        function onMouseMove(moveEvent: MouseEvent) {
          const deltaX = moveEvent.clientX - startX;
          onResize(initialWidth, deltaX);
        }
        function onMouseUp() {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      }}
    />
  );
}

export function PrimarySideBar() {
  const activePanelId = useLayoutSelector((s) => s.activityBar.activePanelId);
  const sidebarVisible = useLayoutSelector((s) => s.primarySidebar.visible);
  const sidebarWidth = useLayoutSelector((s) => s.primarySidebar.width);
  const { setWidth } = useSidebarActions('primary');

  // Look up active panel from registry
  const activePanel = useMemo(
    () => (activePanelId ? getPanelById(activePanelId) : undefined),
    [activePanelId],
  );

  // Resize handler -- clamp to [200, 480]
  const handleResize = useCallback((startWidth: number, deltaX: number) => {
    setWidth(
      Math.max(
        200, // --size-sidebar-min
        Math.min(480, startWidth + deltaX), // --size-sidebar-max
      ),
    );
  }, [setWidth]);

  if (!sidebarVisible || !activePanel) {
    return null;
  }

  return (
    <aside
      role="complementary"
      aria-label={`${activePanel.label} panel`}
      className="relative flex flex-col bg-bg-secondary border-r border-border shrink-0 overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      {/* Resize handle on right edge */}
      <ResizeHandle startWidth={sidebarWidth} onResize={handleResize} />

      {/* Panel header -- title + action buttons (32px) */}
      <div className="flex items-center justify-between h-[32px] px-[var(--spacing-3)] shrink-0 border-b border-border-divider">
        <h2 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary uppercase tracking-[var(--letter-spacing-wide)] truncate">
          {activePanel.label}
        </h2>
      </div>

      {/* Panel content -- lazy loaded with fade transition */}
      <PanelContent panel={activePanel} />
    </aside>
  );
}

// ---------------------------------------------------------------------------
// PanelContent -- lazy-loaded panel with Suspense and fade transition
// ---------------------------------------------------------------------------

function PanelContent({ panel }: { panel: PanelRegistration }) {
  // Lazy-create the component from the registry's factory function
  const LazyComponent = useMemo(
    () => lazy(panel.component),
    [panel],
  );

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <Suspense fallback={<PanelSkeleton />}>
        <LazyComponent />
      </Suspense>
    </div>
  );
}
