import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from '@/client/components/layout/TopBar.js';
import { ActivityBar } from '@/client/components/layout/activity-bar/ActivityBar.js';
import { PrimarySideBar } from '@/client/components/layout/sidebar/PrimarySideBar.js';
import { SecondarySideBar } from '@/client/components/layout/sidebar/SecondarySideBar.js';
import { LayoutProvider, useLayoutSelector, useSidebarActions, useLayoutContext } from '@/client/components/layout/LayoutContext.js';
import { EditorGroupContainer } from '@/client/components/layout/editor-group/EditorGroupContainer.js';
import { StatusBar, PanelArea } from '@/client/components/layout/status-bar/index.js';
import { useBoardStore } from '@/client/store/board-store.js';
import { useAgentStore } from '@/client/store/agent-store.js';
import { useWebSocket } from '@/client/hooks/useWebSocket.js';
import { API_ENDPOINTS } from '@/shared/constants.js';
import { useI18n } from '@/client/i18n/index.js';
import { SettingsDialog } from '@/client/components/settings/SettingsDialog.js';
import { OrchestratorStatusBar } from '@/client/components/kanban/OrchestratorStatusBar.js';
import type { BoardState } from '@/shared/types.js';

// ---------------------------------------------------------------------------
// AppLayout -- shared layout with TopBar + Sidebar + routed content (Outlet)
// ---------------------------------------------------------------------------

/**
 * Inner layout that consumes LayoutContext.
 * Separated so LayoutProvider wraps the entire tree.
 */
function AppLayoutInner() {
  const { t } = useI18n();
  const connected = useBoardStore((s) => s.connected);
  const [fetchError, setFetchError] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const location = useLocation();
  const showOrchestrator = location.pathname.startsWith('/kanban');
  const sidebarVisible = useLayoutSelector((s) => s.primarySidebar.visible);
  const secondaryVisible = useLayoutSelector((s) => s.secondarySidebar.visible);
  const { toggleVisible: toggleSecondary } = useSidebarActions('secondary');
  const { dispatch } = useLayoutContext();

  // Establish WebSocket connection for real-time updates
  useWebSocket();

  // Fetch initial board + agent state on mount
  useEffect(() => {
    async function fetchInitialState() {
      try {
        const [boardRes, agentsRes, healthRes] = await Promise.all([
          fetch(API_ENDPOINTS.BOARD),
          fetch('/api/agents'),
          fetch(API_ENDPOINTS.HEALTH),
        ]);
        if (!boardRes.ok) {
          setFetchError(true);
          return;
        }
        const data: BoardState = await boardRes.json();
        useBoardStore.getState().setBoard(data);
        setFetchError(false);

        if (agentsRes.ok) {
          const agents = await agentsRes.json() as import('@/shared/agent-types.js').AgentProcess[];
          const { addProcess } = useAgentStore.getState();
          for (const proc of agents) {
            addProcess(proc);
          }
        }

        if (healthRes.ok) {
          const health = await healthRes.json() as { workspace?: string; version?: string; latestVersion?: string | null };
          if (health.workspace) {
            useBoardStore.getState().setWorkspace(health.workspace);
          }
          if (health.latestVersion && health.version && health.latestVersion !== health.version) {
            const dismissed = localStorage.getItem('maestro-update-dismissed');
            if (dismissed !== health.latestVersion) {
              setUpdateAvailable(health.latestVersion);
            }
          }
        }
      } catch {
        setFetchError(true);
      }
    }
    fetchInitialState();
  }, []);

  // Ctrl+Alt+B keyboard shortcut to toggle Secondary Side Bar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'b') {
        e.preventDefault();
        toggleSecondary();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSecondary]);

  // Responsive breakpoints: <1200px auto-collapse secondary, <900px auto-collapse primary
  // Uses matchMedia to detect breakpoint changes and dispatch sidebar visibility.
  // Only auto-collapses (never auto-expands); user can manually re-open via keyboard shortcuts.
  useEffect(() => {
    const mq1200 = window.matchMedia('(max-width: 1199px)');
    const mq900 = window.matchMedia('(max-width: 899px)');

    function handle1200(e: MediaQueryListEvent | MediaQueryList) {
      if ('matches' in e ? e.matches : false) {
        dispatch({ type: 'SET_SIDEBAR_VISIBLE', side: 'secondary', visible: false });
      }
    }

    function handle900(e: MediaQueryListEvent | MediaQueryList) {
      if ('matches' in e ? e.matches : false) {
        dispatch({ type: 'SET_SIDEBAR_VISIBLE', side: 'primary', visible: false });
        dispatch({ type: 'SET_SIDEBAR_VISIBLE', side: 'secondary', visible: false });
      }
    }

    // Check on mount
    if (mq900.matches) {
      handle900(mq900);
    } else if (mq1200.matches) {
      handle1200(mq1200);
    }

    mq1200.addEventListener('change', handle1200);
    mq900.addEventListener('change', handle900);

    return () => {
      mq1200.removeEventListener('change', handle1200);
      mq900.removeEventListener('change', handle900);
    };
  }, [dispatch]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg-primary">
      {/* Settings dialog (global overlay) */}
      <SettingsDialog />

      {/* Connection error banner */}
      {fetchError && !connected && (
        <div
          role="alert"
          aria-live="assertive"
          className="px-[var(--spacing-4)] py-[var(--spacing-2)] border-b text-[length:var(--font-size-xs)] text-center shrink-0 rounded-[var(--radius-default)] mx-[var(--spacing-3)] mt-[var(--spacing-2)]"
          style={{
            backgroundColor: 'var(--color-status-bg-blocked)',
            color: 'var(--color-status-blocked)',
            borderColor: 'var(--color-status-blocked)',
          }}
        >
          {t('connection_error')}
        </div>
      )}

      {/* Version update banner */}
      {updateAvailable && !updateDismissed && (
        <div
          role="status"
          className="px-[var(--spacing-4)] py-[var(--spacing-2)] border-b text-[length:var(--font-size-xs)] shrink-0 rounded-[var(--radius-default)] mx-[var(--spacing-3)] mt-[var(--spacing-2)] flex items-center justify-center gap-[var(--spacing-2)]"
          style={{
            backgroundColor: 'var(--color-status-bg-exploring)',
            color: 'var(--color-status-exploring)',
            borderColor: 'var(--color-status-exploring)',
          }}
        >
          <span>{t('update_available', { version: updateAvailable })}</span>
          <button
            type="button"
            onClick={() => {
              setUpdateDismissed(true);
              localStorage.setItem('maestro-update-dismissed', updateAvailable);
            }}
            className="ml-[var(--spacing-1)] hover:opacity-70 transition-opacity duration-[var(--duration-fast)]"
            aria-label={t('dismiss')}
          >
            &times;
          </button>
        </div>
      )}

      {/* Row 1: top bar spans full width */}
      <TopBar />

      {/* Row 2: Activity Bar + Primary Side Bar + Editor Group + Secondary Side Bar */}
      <div className="flex flex-1 overflow-hidden relative">
        <ActivityBar />
        {sidebarVisible && <PrimarySideBar />}
        <EditorGroupContainer>
          <Outlet />
          {showOrchestrator && <OrchestratorStatusBar />}
        </EditorGroupContainer>
        {secondaryVisible && <SecondarySideBar />}
      </div>

      {/* Row 3: expandable Panel area (above Status Bar, collapsible) */}
      <PanelArea />

      {/* Row 4: Status Bar (always visible at 22px) */}
      <StatusBar />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AppLayout -- wraps AppLayoutInner with LayoutProvider
// ---------------------------------------------------------------------------

export function AppLayout() {
  return (
    <LayoutProvider>
      <AppLayoutInner />
    </LayoutProvider>
  );
}
