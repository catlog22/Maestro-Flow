import { create } from 'zustand';
import type { AgentProcess, AgentProcessStatus, NormalizedEntry, ApprovalRequest } from '@/shared/agent-types.js';

// ---------------------------------------------------------------------------
// Agent store — global state for agent processes, entries, and approvals
// ---------------------------------------------------------------------------

export interface AgentStore {
  processes: Record<string, AgentProcess>;
  entries: Record<string, NormalizedEntry[]>;
  pendingApprovals: Record<string, ApprovalRequest>;
  activeProcessId: string | null;

  addProcess: (process: AgentProcess) => void;
  removeProcess: (processId: string) => void;
  updateProcessStatus: (processId: string, status: AgentProcessStatus) => void;
  addEntry: (processId: string, entry: NormalizedEntry) => void;
  setApproval: (approval: ApprovalRequest) => void;
  clearApproval: (approvalId: string) => void;
  setActiveProcessId: (processId: string | null) => void;
  clearAll: () => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  processes: {},
  entries: {},
  pendingApprovals: {},
  activeProcessId: null,

  addProcess: (process) =>
    set((state) => ({
      processes: { ...state.processes, [process.id]: process },
      entries: { ...state.entries, [process.id]: state.entries[process.id] ?? [] },
    })),

  removeProcess: (processId) =>
    set((state) => {
      const { [processId]: _, ...remaining } = state.processes;
      return { processes: remaining };
    }),

  updateProcessStatus: (processId, status) =>
    set((state) => {
      const existing = state.processes[processId];
      if (!existing) return state;
      return {
        processes: { ...state.processes, [processId]: { ...existing, status } },
      };
    }),

  addEntry: (processId, entry) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [processId]: [...(state.entries[processId] ?? []), entry],
      },
    })),

  setApproval: (approval) =>
    set((state) => ({
      pendingApprovals: { ...state.pendingApprovals, [approval.id]: approval },
    })),

  clearApproval: (approvalId) =>
    set((state) => {
      const { [approvalId]: _, ...remaining } = state.pendingApprovals;
      return { pendingApprovals: remaining };
    }),

  setActiveProcessId: (processId) => set({ activeProcessId: processId }),

  clearAll: () => set({ processes: {}, entries: {}, pendingApprovals: {}, activeProcessId: null }),
}));
