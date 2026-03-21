import { create } from 'zustand';
import type { BoardState, PhaseCard, TaskCard } from '@/shared/types.js';

// ---------------------------------------------------------------------------
// Board store — global state for dashboard
// ---------------------------------------------------------------------------

function needsNormalization(p: PhaseCard): boolean {
  const raw = p as Record<string, unknown>;
  return !p.execution || !('verification' in raw) || !('validation' in raw) || !('uat' in raw) || !('reflection' in raw);
}

/** Fill missing optional-in-practice fields so components never crash on partial data */
function normalizePhase(p: PhaseCard): PhaseCard {
  if (!needsNormalization(p)) return p;
  const raw = p as Record<string, unknown>;
  return {
    ...p,
    goal: p.goal ?? '',
    success_criteria: p.success_criteria ?? [],
    requirements: p.requirements ?? [],
    spec_ref: p.spec_ref ?? null,
    plan: p.plan ?? { task_ids: [], task_count: 0, complexity: null, waves: [] },
    execution: p.execution ?? { method: '', started_at: null, completed_at: null, tasks_completed: 0, tasks_total: 0, current_wave: 0, commits: [] },
    verification: (raw.verification as PhaseCard['verification']) ?? { status: 'pending', verified_at: null, must_haves: [], gaps: [] },
    validation: (raw.validation as PhaseCard['validation']) ?? { status: 'pending', test_coverage: null, gaps: [] },
    uat: (raw.uat as PhaseCard['uat']) ?? { status: 'pending', test_count: 0, passed: 0, gaps: [] },
    reflection: (raw.reflection as PhaseCard['reflection']) ?? { rounds: 0, strategy_adjustments: [] },
  };
}

export interface BoardStore {
  board: BoardState | null;
  connected: boolean;
  selectedPhase: number | null;
  workspace: string | null;

  setBoard: (board: BoardState | null) => void;
  updatePhase: (phase: number, data: Partial<PhaseCard>) => void;
  updateTask: (taskId: string, data: Partial<TaskCard>) => void;
  setConnected: (status: boolean) => void;
  setSelectedPhase: (phase: number | null) => void;
  setWorkspace: (path: string | null) => void;
}

export const useBoardStore = create<BoardStore>((set) => ({
  board: null,
  connected: false,
  selectedPhase: null,
  workspace: null,

  setBoard: (board) => {
    if (board && board.phases.some((p) => needsNormalization(p))) {
      board = {
        ...board,
        phases: board.phases.map((p) => normalizePhase(p)),
      };
    }
    set({ board });
  },

  updatePhase: (phase, data) =>
    set((state) => {
      if (!state.board) return state;
      const phases = state.board.phases.map((p) =>
        p.phase === phase ? { ...p, ...data } : p,
      );
      return { board: { ...state.board, phases } };
    }),

  // NOTE: v0.1 limitation — TaskCard objects are not stored client-side.
  // This action bumps the parent phase's updated_at to trigger re-renders.
  // Full task data is fetched on-demand via GET /api/phases/:n/tasks.
  updateTask: (taskId, _data) =>
    set((state) => {
      if (!state.board) return state;
      const phases = state.board.phases.map((p) => {
        const idx = p.plan.task_ids.indexOf(taskId);
        if (idx === -1) return p;
        return { ...p, updated_at: new Date().toISOString() };
      });
      return { board: { ...state.board, phases } };
    }),

  setConnected: (status) => set({ connected: status }),

  setSelectedPhase: (phase) => set({ selectedPhase: phase }),

  setWorkspace: (path) => set({ workspace: path }),
}));
