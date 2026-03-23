import { useEffect } from 'react';
import { useSupervisorStore } from '@/client/store/supervisor-store.js';
import type { SupervisorTab } from '@/shared/execution-types.js';
import { MonitorTab } from './supervisor/MonitorTab.js';
import { CommanderTab } from './supervisor/CommanderTab.js';
import { CoordinatorTab } from './supervisor/CoordinatorTab.js';
import { PromptsTab } from './supervisor/PromptsTab.js';
import { ExtensionsTab } from './supervisor/ExtensionsTab.js';
import { LearningTab } from './supervisor/LearningTab.js';
import { ScheduleTab } from './supervisor/ScheduleTab.js';

// ---------------------------------------------------------------------------
// SupervisorPage -- 7-tab layout for all supervisor domains
// ---------------------------------------------------------------------------

const TABS: { id: SupervisorTab; label: string }[] = [
  { id: 'monitor', label: 'Monitor' },
  { id: 'commander', label: 'Commander' },
  { id: 'coordinator', label: 'Coordinator' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'extensions', label: 'Extensions' },
  { id: 'learning', label: 'Learning' },
  { id: 'schedule', label: 'Schedule' },
];

export function SupervisorPage() {
  const activeTab = useSupervisorStore((s) => s.activeTab);
  const setActiveTab = useSupervisorStore((s) => s.setActiveTab);
  const fetchLearningStats = useSupervisorStore((s) => s.fetchLearningStats);
  const fetchSchedules = useSupervisorStore((s) => s.fetchSchedules);
  const fetchExtensions = useSupervisorStore((s) => s.fetchExtensions);
  const fetchPromptModes = useSupervisorStore((s) => s.fetchPromptModes);

  useEffect(() => {
    fetchLearningStats();
    fetchSchedules();
    fetchExtensions();
    fetchPromptModes();
  }, [fetchLearningStats, fetchSchedules, fetchExtensions, fetchPromptModes]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div
        className="shrink-0 flex items-center gap-[var(--spacing-1)] px-[var(--spacing-4)] pt-[var(--spacing-2)]"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'px-[var(--spacing-3)] py-[var(--spacing-2)] text-[length:var(--font-size-sm)] transition-colors',
              activeTab === tab.id
                ? 'text-text-primary font-[var(--font-weight-medium)] border-b-2 border-accent-blue'
                : 'text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'monitor' && <MonitorTab />}
        {activeTab === 'commander' && <CommanderTab />}
        {activeTab === 'coordinator' && <CoordinatorTab />}
        {activeTab === 'prompts' && <PromptsTab />}
        {activeTab === 'extensions' && <ExtensionsTab />}
        {activeTab === 'learning' && <LearningTab />}
        {activeTab === 'schedule' && <ScheduleTab />}
      </div>
    </div>
  );
}
