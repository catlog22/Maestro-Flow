import { lazy, Suspense, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { getPanelsBySide, getPanelById, movePanelSide } from '@/client/components/layout/panel-registry.js';
import { useLayoutSelector, useSidebarActions } from '@/client/components/layout/LayoutContext.js';
import type { PanelRegistration } from '@/client/types/layout-types.js';

// ---------------------------------------------------------------------------
// SecondarySideBar -- right-side collapsible panel with mini tab bar
// ---------------------------------------------------------------------------
// - Independent of Primary Side Bar state
// - Mini tab bar at top for switching between registered secondary panels
// - Resize handle on left edge
// - Collapse animation: width + opacity over --duration-smooth (300ms)
// - Content unmounted when collapsed
// - Context menu on panel header: 'Move to other Side Bar'
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

/** Resize handle on the left edge of the secondary sidebar */
function ResizeHandle({
  startWidth,
  onResize,
}: {
  startWidth: number;
  onResize: (startWidth: number, deltaX: number) => void;
}) {
  return (
    <div
      className="absolute top-0 left-0 bottom-0 w-[4px] cursor-col-resize z-10 hover:bg-accent-blue/20 active:bg-accent-blue/30 transition-colors"
      onMouseDown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const initialWidth = startWidth;
        function onMouseMove(moveEvent: MouseEvent) {
          // Moving left increases deltaX positively, but we want to shrink width
          // So we negate: deltaX = startX - moveX means shrinking when dragging left
          const deltaX = startX - moveEvent.clientX;
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

/** Context menu for panel mobility */
function PanelContextMenu({
  panelId,
  currentSide,
  onMove,
  onClose,
}: {
  panelId: string;
  currentSide: 'primary' | 'secondary';
  onMove: (panelId: string, toSide: 'primary' | 'secondary') => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const targetSide = currentSide === 'secondary' ? 'primary' : 'secondary';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute top-[28px] right-0 z-50 min-w-[180px] rounded-[var(--radius-sm)] border border-border shadow-lg bg-bg-secondary py-[var(--spacing-1)]"
    >
      <button
        type="button"
        className="w-full text-left px-[var(--spacing-3)] py-[var(--spacing-1)] text-[length:var(--font-size-xs)] text-text-primary hover:bg-bg-tertiary transition-colors"
        onClick={() => {
          onMove(panelId, targetSide);
          onClose();
        }}
      >
        Move to {targetSide === 'primary' ? 'Primary' : 'Secondary'} Side Bar
      </button>
    </div>
  );
}

export function SecondarySideBar() {
  const sidebarVisible = useLayoutSelector((s) => s.secondarySidebar.visible);
  const sidebarWidth = useLayoutSelector((s) => s.secondarySidebar.width);
  const activePanelId = useLayoutSelector((s) => s.secondarySidebar.activePanelId);
  const { setWidth, setActivePanel, movePanelToSide } = useSidebarActions('secondary');

  const [contextMenuPanelId, setContextMenuPanelId] = useState<string | null>(null);

  // Get all secondary panels from registry
  const secondaryPanels = useMemo(() => getPanelsBySide('secondary'), []);

  // Resolve active panel: use stored ID, fallback to first panel
  const effectiveActivePanelId = activePanelId && secondaryPanels.some((p) => p.id === activePanelId)
    ? activePanelId
    : secondaryPanels[0]?.id ?? null;

  const activePanel = useMemo(
    () => (effectiveActivePanelId ? getPanelById(effectiveActivePanelId) : undefined),
    [effectiveActivePanelId],
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

  // Panel mobility handler
  const handleMovePanel = useCallback((panelId: string, toSide: 'primary' | 'secondary') => {
    movePanelSide(panelId, toSide);
    movePanelToSide(panelId, toSide);
  }, [movePanelToSide]);

  if (!sidebarVisible) {
    return null;
  }

  return (
    <aside
      role="complementary"
      aria-label="Secondary Side Bar"
      className="relative flex flex-col bg-bg-secondary border-l border-border shrink-0 overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      {/* Resize handle on left edge */}
      <ResizeHandle startWidth={sidebarWidth} onResize={handleResize} />

      {/* Mini tab bar for panel switching (32px) */}
      <div className="flex items-center h-[32px] px-[var(--spacing-1)] shrink-0 border-b border-border-divider gap-[2px] overflow-x-auto">
        {secondaryPanels.map((panel) => {
          const isActive = panel.id === effectiveActivePanelId;
          const Icon = panel.icon;
          return (
            <button
              key={panel.id}
              type="button"
              title={panel.label}
              aria-label={panel.label}
              aria-pressed={isActive}
              className={[
                'flex items-center justify-center h-[24px] px-[var(--spacing-2)]',
                'rounded-[var(--radius-sm)] transition-colors shrink-0',
                'text-[length:var(--font-size-xs)]',
                isActive
                  ? 'bg-bg-tertiary text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary/50',
              ].join(' ')}
              onClick={() => setActivePanel(panel.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuPanelId(panel.id);
              }}
            >
              <Icon size={14} className="mr-[var(--spacing-1)]" />
              <span className="truncate max-w-[80px]">{panel.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel header with context menu trigger */}
      <div className="relative flex items-center justify-between h-[28px] px-[var(--spacing-3)] shrink-0">
        <h2 className="text-[length:var(--font-size-xs)] font-[var(--font-weight-semibold)] text-text-secondary uppercase tracking-[var(--letter-spacing-wide)] truncate">
          {activePanel?.label ?? ''}
        </h2>
        {contextMenuPanelId && (
          <PanelContextMenu
            panelId={contextMenuPanelId}
            currentSide="secondary"
            onMove={handleMovePanel}
            onClose={() => setContextMenuPanelId(null)}
          />
        )}
      </div>

      {/* Panel content -- lazy loaded with fade transition */}
      {activePanel && <PanelContent panel={activePanel} />}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// PanelContent -- lazy-loaded panel with Suspense and fade transition
// ---------------------------------------------------------------------------

function PanelContent({ panel }: { panel: PanelRegistration }) {
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
