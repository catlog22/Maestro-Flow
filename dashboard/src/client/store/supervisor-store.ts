import { create } from 'zustand';
import type { SupervisorTab } from '@/shared/execution-types.js';
import type { LearningStats, CommandPattern, KnowledgeEntry } from '@/shared/learning-types.js';
import type { ScheduledTask } from '@/shared/schedule-types.js';
import type { ExtensionInfo } from '@/shared/extension-types.js';

// ---------------------------------------------------------------------------
// SupervisorStore -- state for all 7 supervisor tab domains
// ---------------------------------------------------------------------------

export interface SupervisorStore {
  // State
  activeTab: SupervisorTab;
  learningStats: LearningStats | null;
  learningPatterns: CommandPattern[];
  knowledgeEntries: KnowledgeEntry[];
  scheduledTasks: ScheduledTask[];
  extensions: ExtensionInfo[];
  promptModes: string[];
  promptBindings: Record<string, string>;

  // WS event handlers (called from useWebSocket)
  onLearningUpdate: (stats: LearningStats) => void;
  onScheduleUpdate: (tasks: ScheduledTask[]) => void;
  onScheduleTriggered: (payload: { taskId: string; taskName: string; taskType: string }) => void;
  onExtensionLoaded: (payload: { extensions: ExtensionInfo[] }) => void;
  onExtensionError: (payload: { name: string; error: string }) => void;

  // REST action dispatchers
  fetchLearningStats: () => Promise<void>;
  fetchSchedules: () => Promise<void>;
  fetchExtensions: () => Promise<void>;
  fetchPromptModes: () => Promise<void>;

  // Schedule CRUD actions
  createSchedule: (task: Omit<ScheduledTask, 'id' | 'lastRun' | 'nextRun' | 'history'>) => Promise<void>;
  updateSchedule: (id: string, updates: Partial<ScheduledTask>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  toggleSchedule: (id: string, enabled: boolean) => Promise<void>;
  runSchedule: (id: string) => Promise<void>;

  // UI actions
  setActiveTab: (tab: SupervisorTab) => void;
}

export const useSupervisorStore = create<SupervisorStore>((set, get) => ({
  // Initial state
  activeTab: 'monitor',
  learningStats: null,
  learningPatterns: [],
  knowledgeEntries: [],
  scheduledTasks: [],
  extensions: [],
  promptModes: [],
  promptBindings: {},

  // -------------------------------------------------------------------------
  // WS event handlers
  // -------------------------------------------------------------------------

  onLearningUpdate: (stats) =>
    set({
      learningStats: stats,
      learningPatterns: stats.topPatterns,
    }),

  onScheduleUpdate: (tasks) =>
    set({ scheduledTasks: tasks }),

  onScheduleTriggered: (payload) =>
    set((state) => {
      const tasks = state.scheduledTasks.map((t) => {
        if (t.id !== payload.taskId) return t;
        return {
          ...t,
          lastRun: new Date().toISOString(),
          history: [
            ...t.history,
            {
              timestamp: new Date().toISOString(),
              status: 'success' as const,
              duration: 0,
            },
          ],
        };
      });
      return { scheduledTasks: tasks };
    }),

  onExtensionLoaded: (payload) =>
    set({ extensions: payload.extensions }),

  onExtensionError: (payload) =>
    set((state) => {
      const extensions = state.extensions.map((ext) => {
        if (ext.name !== payload.name) return ext;
        return { ...ext, status: 'disabled' as const };
      });
      return { extensions };
    }),

  // -------------------------------------------------------------------------
  // REST action dispatchers
  // -------------------------------------------------------------------------

  fetchLearningStats: async () => {
    try {
      const res = await fetch('/api/supervisor/learning/stats');
      if (!res.ok) return;
      const data = (await res.json()) as LearningStats;
      set({
        learningStats: data,
        learningPatterns: data.topPatterns,
      });
    } catch {
      // Best-effort fetch
    }
  },

  fetchSchedules: async () => {
    try {
      const res = await fetch('/api/supervisor/schedules');
      if (!res.ok) return;
      const data = (await res.json()) as ScheduledTask[];
      set({ scheduledTasks: data });
    } catch {
      // Best-effort fetch
    }
  },

  fetchExtensions: async () => {
    try {
      const res = await fetch('/api/supervisor/extensions');
      if (!res.ok) return;
      const data = (await res.json()) as ExtensionInfo[];
      set({ extensions: data });
    } catch {
      // Best-effort fetch
    }
  },

  fetchPromptModes: async () => {
    try {
      const res = await fetch('/api/supervisor/prompts');
      if (!res.ok) return;
      const data = (await res.json()) as { modes: string[]; bindings: Record<string, string> };
      set({
        promptModes: data.modes,
        promptBindings: data.bindings,
      });
    } catch {
      // Best-effort fetch
    }
  },

  // -------------------------------------------------------------------------
  // Schedule CRUD
  // -------------------------------------------------------------------------

  createSchedule: async (task) => {
    try {
      const res = await fetch('/api/supervisor/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      if (!res.ok) return;
      const created = (await res.json()) as ScheduledTask;
      set((state) => ({
        scheduledTasks: [...state.scheduledTasks, created],
      }));
    } catch {
      // Best-effort
    }
  },

  updateSchedule: async (id, updates) => {
    try {
      const res = await fetch(`/api/supervisor/schedules/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) return;
      const updated = (await res.json()) as ScheduledTask;
      set((state) => ({
        scheduledTasks: state.scheduledTasks.map((t) => (t.id === id ? updated : t)),
      }));
    } catch {
      // Best-effort
    }
  },

  deleteSchedule: async (id) => {
    try {
      const res = await fetch(`/api/supervisor/schedules/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) return;
      set((state) => ({
        scheduledTasks: state.scheduledTasks.filter((t) => t.id !== id),
      }));
    } catch {
      // Best-effort
    }
  },

  toggleSchedule: async (id, enabled) => {
    await get().updateSchedule(id, { enabled });
  },

  runSchedule: async (id) => {
    try {
      await fetch(`/api/supervisor/schedules/${encodeURIComponent(id)}/run`, {
        method: 'POST',
      });
    } catch {
      // Best-effort
    }
  },

  // -------------------------------------------------------------------------
  // UI actions
  // -------------------------------------------------------------------------

  setActiveTab: (tab) => set({ activeTab: tab }),
}));
