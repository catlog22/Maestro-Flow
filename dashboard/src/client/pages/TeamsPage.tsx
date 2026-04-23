import { useState, useEffect, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid.js';
import List from 'lucide-react/dist/esm/icons/list.js';
import { ViewSwitcherContext } from '@/client/hooks/useViewSwitcher.js';
import { useTeamStore } from '@/client/store/team-store.js';
import { TeamSessionsList } from '@/client/components/teams/TeamSessionsList.js';
import { TeamSessionDetail } from '@/client/components/teams/TeamSessionDetail.js';
import { TeamInteractionView } from '@/client/components/teams/TeamInteractionView.js';

// ---------------------------------------------------------------------------
// TeamsPage — Team Sessions with Cards/Table views + detail drill-down
// ---------------------------------------------------------------------------

type TeamView = 'cards' | 'table';

const VIEW_ITEMS = [
  { label: 'Cards', icon: <LayoutGrid size={14} strokeWidth={1.8} />, shortcut: '1' },
  { label: 'Table', icon: <List size={14} strokeWidth={1.8} />, shortcut: '2' },
] as const;

const VIEWS: TeamView[] = ['cards', 'table'];

const viewVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function TeamsPage() {
  const activeView = useTeamStore((s) => s.activeView);
  const setActiveView = useTeamStore((s) => s.setActiveView);
  const activeSessionId = useTeamStore((s) => s.activeSessionId);
  const activeSession = useTeamStore((s) => s.activeSession);
  const fetchSessions = useTeamStore((s) => s.fetchSessions);
  const loading = useTeamStore((s) => s.loading);
  const error = useTeamStore((s) => s.error);

  // Register ViewSwitcher items in TopBar
  const { register, unregister } = useContext(ViewSwitcherContext);

  const handleViewSwitch = useCallback(
    (index: number) => setActiveView(VIEWS[index]),
    [setActiveView],
  );

  useEffect(() => {
    if (!activeSessionId) {
      register({
        items: VIEW_ITEMS.map((v) => ({ label: v.label, icon: v.icon, shortcut: v.shortcut })),
        activeIndex: VIEWS.indexOf(activeView),
        onSwitch: handleViewSwitch,
      });
    } else {
      unregister();
    }
  }, [activeView, activeSessionId, register, unregister, handleViewSwitch]);

  useEffect(() => {
    return () => unregister();
  }, [unregister]);

  // Keyboard shortcut: 1/2 to switch views (only in list mode)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (activeSessionId) return;
      if (e.key === '1') setActiveView('cards');
      else if (e.key === '2') setActiveView('table');
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setActiveView, activeSessionId]);

  // Fetch data on mount
  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  // Loading state
  if (loading && !activeSessionId) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-[length:var(--font-size-sm)]">
        Loading team sessions...
      </div>
    );
  }

  // Error state
  if (error && !activeSessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <span className="text-status-failed text-[length:var(--font-size-sm)]">
          Failed to load team sessions
        </span>
        <span className="text-text-tertiary text-[length:var(--font-size-xs)]">{error}</span>
        <button
          type="button"
          onClick={() => void fetchSessions()}
          className="px-3 py-1 rounded-[var(--radius-md)] text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-all"
          style={{ border: 'var(--style-btn-secondary-border)', background: 'var(--style-btn-secondary-bg)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Detail mode — interactive view for active sessions, read-only for completed/archived
  if (activeSessionId) {
    if (activeSession?.status === 'active') {
      return <TeamInteractionView />;
    }
    return <TeamSessionDetail />;
  }

  // List mode
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          className="flex-1 flex flex-col overflow-hidden"
          variants={viewVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <TeamSessionsList viewMode={activeView} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
