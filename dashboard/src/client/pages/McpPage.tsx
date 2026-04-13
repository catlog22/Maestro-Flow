import { useState, useEffect, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import List from 'lucide-react/dist/esm/icons/list.js';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid.js';
import Package from 'lucide-react/dist/esm/icons/package.js';
import { ViewSwitcherContext } from '@/client/hooks/useViewSwitcher.js';
import { useMcpStore } from '@/client/store/mcp-store.js';
import { McpListView } from '@/client/components/mcp/McpListView.js';
import { McpCardsView } from '@/client/components/mcp/McpCardsView.js';
import { McpTemplatesView } from '@/client/components/mcp/McpTemplatesView.js';
import { McpEditDialog } from '@/client/components/mcp/McpEditDialog.js';
import { InstallWizardDialog } from '@/client/components/install/InstallWizardDialog.js';

// ---------------------------------------------------------------------------
// McpPage -- MCP Manager with 3 views: List, Cards, Templates
// ---------------------------------------------------------------------------

type McpView = 'list' | 'cards' | 'templates';

const VIEW_ITEMS = [
  { label: 'List', icon: <List size={14} strokeWidth={1.8} />, shortcut: '1' },
  { label: 'Cards', icon: <LayoutGrid size={14} strokeWidth={1.8} />, shortcut: '2' },
  { label: 'Templates', icon: <Package size={14} strokeWidth={1.8} />, shortcut: '3' },
] as const;

const VIEWS: McpView[] = ['list', 'cards', 'templates'];

const viewVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function McpPage() {
  const activeView = useMcpStore((s) => s.activeView);
  const setActiveView = useMcpStore((s) => s.setActiveView);
  const fetchConfig = useMcpStore((s) => s.fetchConfig);
  const fetchTemplates = useMcpStore((s) => s.fetchTemplates);
  const loading = useMcpStore((s) => s.loading);
  const error = useMcpStore((s) => s.error);

  // Register ViewSwitcher items in TopBar
  const { register, unregister } = useContext(ViewSwitcherContext);

  const handleViewSwitch = useCallback(
    (index: number) => setActiveView(VIEWS[index]),
    [setActiveView],
  );

  useEffect(() => {
    register({
      items: VIEW_ITEMS.map((v) => ({ label: v.label, icon: v.icon, shortcut: v.shortcut })),
      activeIndex: VIEWS.indexOf(activeView),
      onSwitch: handleViewSwitch,
    });
  }, [activeView, register, handleViewSwitch]);

  useEffect(() => {
    return () => unregister();
  }, [unregister]);

  // Keyboard shortcut: 1/2/3 to switch views
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') setActiveView('list');
      else if (e.key === '2') setActiveView('cards');
      else if (e.key === '3') setActiveView('templates');
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setActiveView]);

  // Fetch data on mount
  useEffect(() => {
    void fetchConfig();
    void fetchTemplates();
  }, [fetchConfig, fetchTemplates]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-[length:var(--font-size-sm)]">
        Loading MCP configuration...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <span className="text-status-failed text-[length:var(--font-size-sm)]">
          Failed to load MCP config
        </span>
        <span className="text-text-tertiary text-[length:var(--font-size-xs)]">{error}</span>
        <button
          type="button"
          onClick={() => void fetchConfig()}
          className="px-3 py-1 rounded-[var(--radius-md)] text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-all"
          style={{ border: 'var(--style-btn-secondary-border)', background: 'var(--style-btn-secondary-bg)' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <InstallWizardDialog />
      <McpEditDialog />
      <AnimatePresence mode="wait">
        {activeView === 'list' && (
          <motion.div
            key="list"
            className="flex-1 flex flex-col overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <McpListView />
          </motion.div>
        )}

        {activeView === 'cards' && (
          <motion.div
            key="cards"
            className="flex-1 flex flex-col overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <McpCardsView />
          </motion.div>
        )}

        {activeView === 'templates' && (
          <motion.div
            key="templates"
            className="flex-1 flex flex-col overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <McpTemplatesView />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
