import { create } from 'zustand';
import { COLLAB_API_ENDPOINTS } from '@/shared/constants.js';
import type {
  CollabMember,
  CollabActivityEntry,
  CollabPresence,
  CollabAggregatedActivity,
  CollabPreflightResult,
  CollabTask,
} from '@/shared/collab-types.js';
import { COLLAB_TASK_COLUMNS } from '@/shared/collab-types.js';
import type { CollabTaskStatus, CollabCheckAction } from '@/shared/collab-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CollabTab = 'overview' | 'tasks' | 'analysis' | 'history';

interface CollabStoreState {
  // State
  members: CollabMember[];
  activity: CollabActivityEntry[];
  presence: CollabPresence[];
  aggregated: CollabAggregatedActivity[];
  loading: boolean;
  error: string | null;
  activeTab: CollabTab;
  statusFilter: string;
  typeFilter: string;
  memberFilter: string;

  // Task state
  tasks: CollabTask[];
  selectedTaskId: string | null;
  taskStatusFilter: string;
  taskAssigneeFilter: string;
  currentUser: CollabMember | null;

  // Async fetch actions
  fetchMembers: () => Promise<void>;
  fetchActivity: (limit?: number, since?: string) => Promise<void>;
  fetchPresence: () => Promise<void>;
  fetchAggregated: () => Promise<void>;
  fetchPreflight: () => Promise<CollabPreflightResult | null>;
  fetchTasks: (status?: string, assignee?: string) => Promise<void>;
  fetchWhoami: () => Promise<void>;

  // Write actions
  initCollab: () => Promise<{ success: boolean; error?: string }>;
  disableCollab: () => Promise<{ success: boolean; error?: string }>;
  addMember: (name: string, email?: string, role?: string) => Promise<{ success: boolean; error?: string }>;
  removeMember: (uid: string) => Promise<{ success: boolean; error?: string }>;
  createTask: (title: string, description?: string, priority?: string, tags?: string[]) => Promise<{ success: boolean; error?: string; taskId?: string }>;
  updateTaskStatus: (id: string, status: CollabTaskStatus) => Promise<{ success: boolean; error?: string }>;
  assignTask: (id: string, assignee: string | null) => Promise<{ success: boolean; error?: string }>;
  addTaskCheck: (id: string, action: CollabCheckAction, comment: string) => Promise<{ success: boolean; error?: string }>;
  deleteTask: (id: string) => Promise<{ success: boolean; error?: string }>;
  joinTeam: () => Promise<{ success: boolean; error?: string }>;

  // Setters
  setActiveTab: (tab: CollabTab) => void;
  setStatusFilter: (filter: string) => void;
  setTypeFilter: (filter: string) => void;
  setMemberFilter: (filter: string) => void;
  setSelectedTaskId: (id: string | null) => void;
  setTaskStatusFilter: (filter: string) => void;
  setTaskAssigneeFilter: (filter: string) => void;

  // Derived
  filteredMembers: () => CollabMember[];
  filteredActivity: () => CollabActivityEntry[];
  recentActivity: (limit: number) => CollabActivityEntry[];
  tasksByColumn: () => Map<string, CollabTask[]>;

  // Cleanup
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCollabStore = create<CollabStoreState>((set, get) => ({
  members: [],
  activity: [],
  presence: [],
  aggregated: [],
  loading: false,
  error: null,
  activeTab: 'overview',
  statusFilter: 'all',
  typeFilter: 'all',
  memberFilter: 'all',
  tasks: [],
  selectedTaskId: null,
  taskStatusFilter: 'all',
  taskAssigneeFilter: 'all',
  currentUser: null,

  // -- Async fetch actions ---------------------------------------------------

  fetchMembers: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(COLLAB_API_ENDPOINTS.MEMBERS);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as CollabMember[];
      set({ members: data, loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  fetchActivity: async (limit?: number, since?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      if (since !== undefined) params.set('since', since);
      const qs = params.toString();
      const url = qs
        ? `${COLLAB_API_ENDPOINTS.ACTIVITY}?${qs}`
        : COLLAB_API_ENDPOINTS.ACTIVITY;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as CollabActivityEntry[];
      set({ activity: data, loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  fetchPresence: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(COLLAB_API_ENDPOINTS.STATUS);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      // API returns { online, total, members: CollabPresence[] }
      const members = Array.isArray(data) ? data : (data.members ?? []);
      set({ presence: members as CollabPresence[], loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  fetchAggregated: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(COLLAB_API_ENDPOINTS.AGGREGATED);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as CollabAggregatedActivity[];
      set({ aggregated: data, loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  fetchPreflight: async () => {
    try {
      const res = await fetch(COLLAB_API_ENDPOINTS.PREFLIGHT);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return (await res.json()) as CollabPreflightResult;
    } catch (err) {
      set({ error: String(err) });
      return null;
    }
  },

  // -- Write actions -----------------------------------------------------------

  initCollab: async () => {
    try {
      const res = await fetch('/api/collab/init', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` };
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  disableCollab: async () => {
    try {
      const res = await fetch('/api/collab/disable', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` };
      get().clearAll();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  addMember: async (name, email, role) => {
    try {
      const res = await fetch('/api/collab/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: email || '', role: role || 'member' }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` };
      // Re-fetch members list
      await get().fetchMembers();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  removeMember: async (uid) => {
    try {
      const res = await fetch(`/api/collab/members/${encodeURIComponent(uid)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` };
      await get().fetchMembers();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  // -- Task fetch actions ----------------------------------------------------

  fetchTasks: async (status?: string, assignee?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      const s = status ?? get().taskStatusFilter;
      const a = assignee ?? get().taskAssigneeFilter;
      if (s && s !== 'all') params.set('status', s);
      if (a && a !== 'all') params.set('assignee', a);
      const qs = params.toString();
      const url = qs ? `${COLLAB_API_ENDPOINTS.TASKS}?${qs}` : COLLAB_API_ENDPOINTS.TASKS;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as CollabTask[];
      set({ tasks: data, loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  fetchWhoami: async () => {
    try {
      const res = await fetch(COLLAB_API_ENDPOINTS.WHOAMI);
      if (!res.ok) return;
      const data = await res.json();
      set({ currentUser: data as CollabMember | null });
    } catch {
      // Silently fail — non-critical
    }
  },

  // -- Task write actions ----------------------------------------------------

  createTask: async (title, description, priority, tags) => {
    try {
      const { currentUser } = get();
      const res = await fetch(COLLAB_API_ENDPOINTS.TASKS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || '',
          priority: priority || 'medium',
          reporter: currentUser?.uid || '',
          tags: tags || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` };
      await get().fetchTasks();
      return { success: true, taskId: data.id };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  updateTaskStatus: async (id, status) => {
    try {
      const url = COLLAB_API_ENDPOINTS.TASK_DETAIL.replace(':id', id);
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` };
      await get().fetchTasks();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  assignTask: async (id, assignee) => {
    try {
      const url = COLLAB_API_ENDPOINTS.TASK_ASSIGN.replace(':id', id);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` };
      await get().fetchTasks();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  addTaskCheck: async (id, action, comment) => {
    try {
      const { currentUser } = get();
      const url = COLLAB_API_ENDPOINTS.TASK_CHECK.replace(':id', id);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, author: currentUser?.uid || '', comment }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` };
      await get().fetchTasks();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  deleteTask: async (id) => {
    try {
      const url = COLLAB_API_ENDPOINTS.TASK_DETAIL.replace(':id', id);
      const res = await fetch(url, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` };
      if (get().selectedTaskId === id) set({ selectedTaskId: null });
      await get().fetchTasks();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  joinTeam: async () => {
    try {
      const res = await fetch(COLLAB_API_ENDPOINTS.JOIN, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error ?? `HTTP ${res.status}` };
      await Promise.all([get().fetchMembers(), get().fetchWhoami()]);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },

  // -- Setters ---------------------------------------------------------------
  // Note: SSE event routing is handled centrally by useSSE.ts which calls
  // store actions directly on collab events. No store-level subscribe/unsubscribe needed.

  setActiveTab: (tab) => set({ activeTab: tab }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setTypeFilter: (filter) => set({ typeFilter: filter }),
  setMemberFilter: (filter) => set({ memberFilter: filter }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setTaskStatusFilter: (filter) => set({ taskStatusFilter: filter }),
  setTaskAssigneeFilter: (filter) => set({ taskAssigneeFilter: filter }),

  // -- Derived ---------------------------------------------------------------

  filteredMembers: () => {
    const { members, statusFilter } = get();
    if (statusFilter === 'all') return members;
    return members.filter((m) => m.status === statusFilter);
  },

  filteredActivity: () => {
    const { activity, typeFilter, memberFilter } = get();
    let result = activity;
    if (typeFilter !== 'all') {
      result = result.filter((a) => a.action === typeFilter);
    }
    if (memberFilter !== 'all') {
      result = result.filter((a) => a.user === memberFilter);
    }
    return result;
  },

  recentActivity: (limit) => {
    const { activity } = get();
    return activity.slice(-limit);
  },

  tasksByColumn: () => {
    const { tasks } = get();
    const map = new Map<string, CollabTask[]>();
    for (const col of COLLAB_TASK_COLUMNS) {
      map.set(col.id, []);
    }
    // Also add 'closed' column
    map.set('closed', []);
    for (const task of tasks) {
      const col = map.get(task.status);
      if (col) col.push(task);
    }
    return map;
  },

  // -- Cleanup ---------------------------------------------------------------

  clearAll: () =>
    set({
      members: [],
      activity: [],
      presence: [],
      aggregated: [],
      loading: false,
      error: null,
      activeTab: 'overview',
      statusFilter: 'all',
      typeFilter: 'all',
      memberFilter: 'all',
      tasks: [],
      selectedTaskId: null,
      taskStatusFilter: 'all',
      taskAssigneeFilter: 'all',
      currentUser: null,
    }),
}));
