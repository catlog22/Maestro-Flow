import { useState, lazy, Suspense } from 'react';
import { useI18n } from '@/client/i18n/index.js';
import { PhaseSidebar } from '@/client/components/workflow/PhaseSidebar.js';

// Lazy-loaded tab panels for chunk splitting
const FlowTabPanel = lazy(() =>
  import('@/client/components/workflow/FlowTabPanel.js').then((m) => ({ default: m.FlowTabPanel }))
);
const TasksTabPanel = lazy(() =>
  import('@/client/components/workflow/TasksTabPanel.js').then((m) => ({ default: m.TasksTabPanel }))
);
const DocumentTabPanel = lazy(() =>
  import('@/client/components/workflow/DocumentTabPanel.js').then((m) => ({ default: m.DocumentTabPanel }))
);
const StatusTabPanel = lazy(() =>
  import('@/client/components/workflow/StatusTabPanel.js').then((m) => ({ default: m.StatusTabPanel }))
);

// ---------------------------------------------------------------------------
// WorkflowViewerPage — phase-oriented workflow viewer with tabbed content
// ---------------------------------------------------------------------------

type ActiveTab = 'flow' | 'tasks' | 'document' | 'status';

const TABS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'flow', label: 'FLOW' },
  { id: 'tasks', label: 'TASKS' },
  { id: 'document', label: 'DOCUMENT' },
  { id: 'status', label: 'STATUS' },
];

const BASE_TAB_CLASSES = [
  'px-[var(--spacing-4)] py-[var(--spacing-2)] text-[length:var(--font-size-sm)] font-[var(--font-weight-medium)]',
  'border-b-2 transition-all duration-[var(--duration-fast)] ease-[var(--ease-notion)]',
  'focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus-ring)]',
].join(' ');

const ACTIVE_TAB_CLASSES = 'border-[var(--color-accent-blue)] text-[var(--color-text-primary)]';
const INACTIVE_TAB_CLASSES =
  'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]';

// Inline fallback for lazy-loaded tab panels
function TabPanelFallback() {
  return (
    <div className="flex items-center justify-center h-full text-text-tertiary text-[length:var(--font-size-sm)]">
      Loading...
    </div>
  );
}

export function WorkflowViewerPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ActiveTab>('flow');
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: phase sidebar */}
      <PhaseSidebar selectedPhaseId={selectedPhaseId} onSelect={setSelectedPhaseId} />

      {/* Right: tab bar + content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div
          className="flex shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
          role="tablist"
          aria-label={t('nav.workflow')}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${BASE_TAB_CLASSES} ${activeTab === tab.id ? ACTIVE_TAB_CLASSES : INACTIVE_TAB_CLASSES}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content area — placeholders for TASK-002/003/004/005 */}
        <div className="flex-1 overflow-hidden" role="tabpanel">
          <Suspense fallback={<TabPanelFallback />}>
            {activeTab === 'flow' && (
              <FlowTabPanel phaseId={selectedPhaseId} />
            )}
            {activeTab === 'tasks' && (
              <TasksTabPanel phaseId={selectedPhaseId} />
            )}
            {activeTab === 'document' && (
              <DocumentTabPanel phaseId={selectedPhaseId} />
            )}
            {activeTab === 'status' && (
              <StatusTabPanel phaseId={selectedPhaseId} />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
