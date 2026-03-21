import { create } from 'zustand';
import { sendWsMessage } from '@/client/hooks/useWebSocket.js';
import type {
  ExpandedRequirement,
  ExpansionDepth,
  RequirementProgressPayload,
  RequirementExpandedPayload,
  RequirementCommittedPayload,
  RequirementErrorPayload,
} from '@/shared/requirement-types.js';

// ---------------------------------------------------------------------------
// Requirement store -- state for requirement expansion lifecycle
// ---------------------------------------------------------------------------

/** Stored result of a committed requirement for board page access */
export interface CommittedResult {
  requirementId: string;
  mode: 'issues' | 'coordinate';
  issueIds?: string[];
  coordinateSessionId?: string;
}

export interface RequirementStore {
  currentRequirement: ExpandedRequirement | null;
  isLoading: boolean;
  error: string | null;
  progressMessage: string | null;
  committedResult: CommittedResult | null;

  // Actions that send WS messages
  expand: (text: string, depth?: ExpansionDepth) => void;
  refine: (feedback: string) => void;
  commit: (mode: 'issues' | 'coordinate') => void;
  resetRequirement: () => void;

  // WS event handlers (called from useWebSocket)
  onProgress: (payload: RequirementProgressPayload) => void;
  onExpanded: (payload: RequirementExpandedPayload) => void;
  onCommitted: (payload: RequirementCommittedPayload) => void;
  onError: (payload: RequirementErrorPayload) => void;

  // Local item editing
  updateItem: (itemId: string, updates: Partial<ExpandedRequirement['items'][number]>) => void;
}

export const useRequirementStore = create<RequirementStore>((set, get) => ({
  currentRequirement: null,
  isLoading: false,
  error: null,
  progressMessage: null,
  committedResult: null,

  expand: (text, depth) => {
    set({
      isLoading: true,
      error: null,
      progressMessage: null,
      currentRequirement: {
        id: '',
        status: 'expanding',
        userInput: text,
        title: '',
        summary: '',
        items: [],
        depth: depth ?? 'standard',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    try {
      sendWsMessage({
        action: 'requirement:expand',
        text,
        depth,
      });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  refine: (feedback) => {
    const req = get().currentRequirement;
    if (!req) return;
    set({
      isLoading: true,
      error: null,
      progressMessage: null,
      currentRequirement: { ...req, status: 'expanding' },
    });
    try {
      sendWsMessage({
        action: 'requirement:refine',
        requirementId: req.id,
        feedback,
      });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  commit: (mode) => {
    const req = get().currentRequirement;
    if (!req) return;
    set({
      isLoading: true,
      error: null,
      progressMessage: null,
      currentRequirement: { ...req, status: 'committing' },
    });
    try {
      sendWsMessage({
        action: 'requirement:commit',
        requirementId: req.id,
        mode,
      });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  resetRequirement: () => {
    set({
      currentRequirement: null,
      isLoading: false,
      error: null,
      progressMessage: null,
      committedResult: null,
    });
  },

  onProgress: (payload) => {
    set((state) => {
      const req = state.currentRequirement;
      if (!req) return state;
      return {
        currentRequirement: { ...req, status: payload.status },
        progressMessage: payload.message ?? null,
      };
    });
  },

  onExpanded: (payload) => {
    set({
      currentRequirement: payload.requirement,
      isLoading: false,
      progressMessage: null,
    });
  },

  onCommitted: (payload) => {
    set((state) => {
      const req = state.currentRequirement;
      if (!req || req.id !== payload.requirementId) return state;
      return {
        currentRequirement: { ...req, status: 'done' },
        isLoading: false,
        progressMessage: null,
        committedResult: {
          requirementId: payload.requirementId,
          mode: payload.mode,
          issueIds: payload.issueIds,
          coordinateSessionId: payload.coordinateSessionId,
        },
      };
    });
  },

  onError: (payload) => {
    set((state) => {
      const req = state.currentRequirement;
      const updated = req
        ? { ...req, status: 'failed' as const, error: payload.error }
        : null;
      return {
        currentRequirement: updated,
        isLoading: false,
        error: payload.error,
        progressMessage: null,
      };
    });
  },

  updateItem: (itemId, updates) => {
    set((state) => {
      const req = state.currentRequirement;
      if (!req) return state;
      return {
        currentRequirement: {
          ...req,
          items: req.items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item,
          ),
        },
      };
    });
  },
}));
