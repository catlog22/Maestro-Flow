import { create } from 'zustand';
import { TEAM_API_ENDPOINTS } from '@/shared/constants.js';
import type { TeamSessionSummary, TeamSessionDetail, TeamMailboxMessage, TeamPhaseState, TeamAgentStatus } from '@/shared/team-types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TeamView = 'cards' | 'table';

interface TeamStore {
  // State
  sessions: TeamSessionSummary[];
  activeSession: TeamSessionDetail | null;
  activeSessionId: string | null;
  activeView: TeamView;
  loading: boolean;
  error: string | null;

  // Real-time team state
  mailboxMessages: TeamMailboxMessage[];
  phaseState: TeamPhaseState | null;
  agentStatuses: TeamAgentStatus[];

  // TeamAgentBridge: maps sessionId -> role -> processId
  roleToProcessMap: Record<string, Record<string, string>>;

  // Filters
  statusFilter: string;
  skillFilter: string | null;
  searchQuery: string;

  // Actions
  fetchSessions: () => Promise<void>;
  fetchSessionDetail: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearActiveSession: () => void;
  setActiveView: (view: TeamView) => void;
  setStatusFilter: (status: string) => void;
  setSkillFilter: (skill: string | null) => void;
  setSearchQuery: (query: string) => void;

  // SSE team event handlers
  handleTeamMessage: (msg: TeamMailboxMessage) => void;
  handleDispatchUpdate: (msg: TeamMailboxMessage) => void;
  handlePhaseTransition: (phase: TeamPhaseState) => void;
  handleAgentStatusUpdate: (status: TeamAgentStatus) => void;

  // TeamAgentBridge actions
  registerAgentProcess: (sessionId: string, role: string, processId: string) => void;
  getProcessIdForRole: (sessionId: string, role: string) => string | undefined;

  // Derived
  filteredSessions: () => TeamSessionSummary[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTeamStore = create<TeamStore>((set, get) => ({
  sessions: [],
  activeSession: null,
  activeSessionId: null,
  activeView: 'cards',
  loading: false,
  error: null,
  statusFilter: 'all',
  skillFilter: null,
  searchQuery: '',
  mailboxMessages: [],
  phaseState: null,
  agentStatuses: [],
  roleToProcessMap: {},

  setActiveView: (view) => set({ activeView: view }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSkillFilter: (skill) => set({ skillFilter: skill }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearActiveSession: () => set({ activeSession: null, activeSessionId: null }),

  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(TEAM_API_ENDPOINTS.SESSIONS);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as TeamSessionSummary[];
      set({ sessions: data, loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  deleteSession: async (sessionId) => {
    const prev = get().sessions;
    set((s) => ({ sessions: s.sessions.filter((ss) => ss.sessionId !== sessionId) }));
    try {
      const res = await fetch(TEAM_API_ENDPOINTS.SESSIONS + '/' + sessionId, { method: 'DELETE' });
      if (!res.ok) set({ sessions: prev });
    } catch {
      set({ sessions: prev });
    }
  },

  fetchSessionDetail: async (sessionId) => {
    set({ loading: true, error: null, activeSessionId: sessionId });
    try {
      const res = await fetch(TEAM_API_ENDPOINTS.SESSIONS + '/' + sessionId);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as TeamSessionDetail;
      set({ activeSession: data, loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  filteredSessions: () => {
    const { sessions, statusFilter, skillFilter, searchQuery } = get();
    let result = sessions;
    if (statusFilter !== 'all') result = result.filter((s) => s.status === statusFilter);
    if (skillFilter) result = result.filter((s) => s.skill === skillFilter);
    if (searchQuery) {
      const lc = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(lc) ||
          s.sessionId.toLowerCase().includes(lc) ||
          s.roles.some((r) => r.toLowerCase().includes(lc)),
      );
    }
    return result;
  },

  // TeamAgentBridge actions

  registerAgentProcess: (sessionId, role, processId) => {
    set((s) => {
      const sessionRoles = s.roleToProcessMap[sessionId] ?? {};
      return {
        roleToProcessMap: {
          ...s.roleToProcessMap,
          [sessionId]: { ...sessionRoles, [role]: processId },
        },
      };
    });
  },

  getProcessIdForRole: (sessionId, role) => {
    return get().roleToProcessMap[sessionId]?.[role];
  },

  // SSE team event handlers

  handleTeamMessage: (msg) => {
    set((s) => {
      const idx = s.mailboxMessages.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        // Update existing message
        const updated = [...s.mailboxMessages];
        updated[idx] = msg;
        return { mailboxMessages: updated };
      }
      return { mailboxMessages: [...s.mailboxMessages, msg] };
    });
  },

  handleDispatchUpdate: (msg) => {
    set((s) => {
      const idx = s.mailboxMessages.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        const updated = [...s.mailboxMessages];
        updated[idx] = msg;
        return { mailboxMessages: updated };
      }
      // Dispatch update for unknown message -- add it
      return { mailboxMessages: [...s.mailboxMessages, msg] };
    });
  },

  handlePhaseTransition: (phase) => {
    set({ phaseState: phase });
  },

  handleAgentStatusUpdate: (status) => {
    set((s) => {
      const idx = s.agentStatuses.findIndex((a) => a.role === status.role);
      if (idx >= 0) {
        const updated = [...s.agentStatuses];
        updated[idx] = status;
        return { agentStatuses: updated };
      }
      return { agentStatuses: [...s.agentStatuses, status] };
    });
  },
}));
