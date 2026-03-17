import { useState, useEffect, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Columns from 'lucide-react/dist/esm/icons/columns-3.js';
import List from 'lucide-react/dist/esm/icons/list.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import { ViewSwitcherContext } from '@/client/hooks/useViewSwitcher.js';
import { useSpecsStore } from '@/client/store/specs-store.js';
import { SpecsKanbanView } from '@/client/components/specs/SpecsKanbanView.js';
import { SpecsTableView } from '@/client/components/specs/SpecsTableView.js';
import { SpecDetailPanel } from '@/client/components/specs/SpecDetailPanel.js';
import { SpecAddDialog } from '@/client/components/specs/SpecAddDialog.js';

// ---------------------------------------------------------------------------
// SpecsPage -- Specs Manager with 2 views: Kanban, Table
// ---------------------------------------------------------------------------

type SpecsView = 'kanban' | 'table';

const VIEW_ITEMS = [
  { label: 'Kanban', icon: <Columns size={14} strokeWidth={1.8} />, shortcut: '1' },
  { label: 'Table', icon: <List size={14} strokeWidth={1.8} />, shortcut: '2' },
] as const;

const VIEWS: SpecsView[] = ['kanban', 'table'];

const viewVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function SpecsPage() {
  const activeView = useSpecsStore((s) => s.activeView);
  const setActiveView = useSpecsStore((s) => s.setActiveView);
  const fetchEntries = useSpecsStore((s) => s.fetchEntries);
  const fetchFiles = useSpecsStore((s) => s.fetchFiles);
  const entries = useSpecsStore((s) => s.entries);
  const search = useSpecsStore((s) => s.search);
  const setSearch = useSpecsStore((s) => s.setSearch);
  const selectedEntry = useSpecsStore((s) => s.selectedEntry);
  const setSelectedEntry = useSpecsStore((s) => s.setSelectedEntry);
  const loading = useSpecsStore((s) => s.loading);
  const error = useSpecsStore((s) => s.error);

  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Register ViewSwitcher items in TopBar
  const { register, unregister } = useContext(ViewSwitcherContext);

  const handleViewSwitch = useCallback(
    (index: number) => setActiveView(VIEWS[index] as 'kanban' | 'table'),
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

  // Keyboard shortcut: 1/2 to switch views
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') setActiveView('kanban');
      else if (e.key === '2') setActiveView('table');
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [setActiveView]);

  // Fetch data on mount
  useEffect(() => {
    void fetchEntries();
    void fetchFiles();
  }, [fetchEntries, fetchFiles]);

  // Resolve selected entry object
  const selectedEntryObj = selectedEntry
    ? entries.find((e) => e.id === selectedEntry) ?? null
    : null;

  // Loading state
  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-[length:var(--font-size-sm)]">
        Loading specs...
      </div>
    );
  }

  // Error state
  if (error && entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <span className="text-status-failed text-[length:var(--font-size-sm)]">
          Failed to load specs
        </span>
        <span className="text-text-tertiary text-[length:var(--font-size-xs)]">{error}</span>
        <button
          type="button"
          onClick={() => void fetchEntries()}
          className="px-3 py-1 rounded-[var(--radius-md)] border border-border bg-bg-card text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-[10px] px-5 py-[10px] border-b border-border-divider shrink-0">
        <span className="text-[16px] font-bold text-text-primary">Specs</span>
        <span className="text-[11px] text-text-tertiary font-mono">
          {entries.length} entries
        </span>
        <div className="flex-1" />
        {/* Search box */}
        <div className="flex items-center gap-[6px] px-3 py-[5px] rounded-[8px] bg-bg-card border border-border w-[240px] focus-within:border-[#9178B5] transition-colors">
          <Search size={13} strokeWidth={2} className="text-text-quaternary shrink-0" />
          <input
            type="text"
            placeholder="Search specs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-none bg-transparent outline-none text-[12px] text-text-primary font-sans w-full placeholder:text-text-quaternary"
          />
        </div>
        {/* New Entry button */}
        <button
          type="button"
          onClick={() => setAddDialogOpen(true)}
          className="flex items-center gap-[6px] px-[14px] py-[6px] rounded-[8px] border-none bg-text-primary text-white text-[12px] font-semibold cursor-pointer font-sans hover:bg-[#1A1816] hover:-translate-y-px hover:shadow-md transition-all"
        >
          <Plus size={14} strokeWidth={2} />
          New Entry
        </button>
      </div>

      {/* Main area: views + detail panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* View area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <AnimatePresence mode="wait">
            {activeView === 'kanban' && (
              <motion.div
                key="kanban"
                className="flex-1 flex flex-col overflow-hidden"
                variants={viewVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <SpecsKanbanView onAddEntry={() => setAddDialogOpen(true)} />
              </motion.div>
            )}

            {activeView === 'table' && (
              <motion.div
                key="table"
                className="flex-1 flex flex-col overflow-hidden"
                variants={viewVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <SpecsTableView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedEntryObj && (
            <SpecDetailPanel
              entry={selectedEntryObj}
              onClose={() => setSelectedEntry(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Add dialog */}
      <SpecAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  );
}
