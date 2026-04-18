import { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import { useLayoutContext, useLayoutSelector } from '@/client/components/layout/LayoutContext.js';

// ---------------------------------------------------------------------------
// PanelArea -- expandable panel with 3 tabs (Output, Problems, Execution)
// ---------------------------------------------------------------------------
// Lazy-loads tab content. Supports maximize state, resize, and Ctrl+J toggle.
// Panel state persisted in LayoutContext (visible, height, activeTabId, isMaximized).
// ---------------------------------------------------------------------------

// Lazy-loaded tab panels
const OutputPanel = lazy(() => import('./panels/OutputPanel.js').then((m) => ({ default: m.OutputPanel })));
const ProblemsPanel = lazy(() => import('./panels/ProblemsPanel.js').then((m) => ({ default: m.ProblemsPanel })));
const ExecutionPanel = lazy(() => import('./panels/ExecutionPanel.js').then((m) => ({ default: m.ExecutionPanel })));

interface TabDef {
  id: string;
  label: string;
  panel: React.ComponentType;
}

const TABS: TabDef[] = [
  { id: 'output', label: 'Output', panel: OutputPanel },
  { id: 'problems', label: 'Problems', panel: ProblemsPanel },
  { id: 'execution', label: 'Execution', panel: ExecutionPanel },
];

const DEFAULT_HEIGHT = 200;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 500;
const RESIZE_HANDLE_HEIGHT = 4;

export function PanelArea() {
  const { dispatch } = useLayoutContext();
  const visible = useLayoutSelector((s) => s.panel.visible);
  const activeTabId = useLayoutSelector((s) => s.panel.activeTabId);
  const isMaximized = useLayoutSelector((s) => s.panel.isMaximized);
  const height = useLayoutSelector((s) => s.panel.height);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const currentTabId = activeTabId ?? 'output';
  const activeTab = TABS.find((t) => t.id === currentTabId) ?? TABS[0];

  // Ctrl+J toggle panel visibility
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'j') {
        e.preventDefault();
        dispatch({ type: 'SET_PANEL_VISIBLE', visible: !visible });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, visible]);

  const handleClose = useCallback(() => {
    dispatch({ type: 'SET_PANEL_VISIBLE', visible: false });
  }, [dispatch]);

  const handleMaximize = useCallback(() => {
    dispatch({ type: 'SET_PANEL_MAXIMIZED', maximized: !isMaximized });
  }, [dispatch, isMaximized]);

  const handleTabClick = useCallback((tabId: string) => {
    dispatch({ type: 'SET_PANEL_ACTIVE_TAB', tabId });
  }, [dispatch]);

  // Resize handle drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;

    function handleMouseMove(ev: MouseEvent) {
      if (!isDragging.current) return;
      const delta = dragStartY.current - ev.clientY;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, dragStartHeight.current + delta));
      dispatch({ type: 'SET_PANEL_HEIGHT', height: newHeight });
    }

    function handleMouseUp() {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dispatch, height]);

  const handleDoubleClick = useCallback(() => {
    dispatch({ type: 'SET_PANEL_HEIGHT', height: DEFAULT_HEIGHT });
  }, [dispatch]);

  if (!visible) return null;

  const panelHeight = isMaximized ? '100%' : `${height}px`;

  return (
    <div
      ref={containerRef}
      className={['flex flex-col shrink-0 border-t border-border bg-bg-primary', isMaximized ? 'absolute inset-0 z-10' : ''].join(' ')}
      style={isMaximized ? undefined : { height: panelHeight }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between h-[30px] px-[var(--spacing-1)] border-b border-border shrink-0">
        {/* Tabs */}
        <div role="tablist" aria-label="Panel tabs" className="flex items-center h-full">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={tab.id === currentTabId}
              aria-controls={`panel-tabpanel-${tab.id}`}
              id={`panel-tab-${tab.id}`}
              onClick={() => handleTabClick(tab.id)}
              className={[
                'h-full px-[var(--spacing-2)] text-[11px] font-medium transition-colors duration-[var(--duration-fast)]',
                tab.id === currentTabId
                  ? 'text-text-primary border-b-2 border-text-primary'
                  : 'text-text-secondary hover:text-text-primary',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-[var(--spacing-0-5)]">
          <button
            type="button"
            onClick={handleMaximize}
            title={isMaximized ? 'Restore Panel' : 'Maximize Panel'}
            className="flex items-center justify-center w-[22px] h-[22px] rounded-[var(--radius-sm)] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-[var(--duration-fast)]"
          >
            {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Close Panel"
            className="flex items-center justify-center w-[22px] h-[22px] rounded-[var(--radius-sm)] text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-[var(--duration-fast)]"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div
        role="tabpanel"
        id={`panel-tabpanel-${currentTabId}`}
        aria-labelledby={`panel-tab-${currentTabId}`}
        className="flex-1 overflow-hidden"
      >
        <Suspense fallback={<PanelLoadingSkeleton />}>
          {visible && <activeTab.panel />}
        </Suspense>
      </div>

      {/* Resize handle (top edge, only when not maximized) */}
      {!isMaximized && (
        <div
          className="absolute top-0 left-0 right-0 cursor-ns-resize hover:bg-border-focused/30 transition-colors duration-[var(--duration-fast)]"
          style={{ height: RESIZE_HANDLE_HEIGHT }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize. Double-click to reset."
        />
      )}
    </div>
  );
}

// ---- Inline SVG icons ----

function MaximizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="1" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="1" width="10" height="10" rx="1" />
      <rect x="2" y="5" width="10" height="10" rx="1" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}

function PanelLoadingSkeleton() {
  return (
    <div className="flex items-center justify-center h-full text-text-secondary text-[11px] animate-pulse">
      Loading...
    </div>
  );
}
