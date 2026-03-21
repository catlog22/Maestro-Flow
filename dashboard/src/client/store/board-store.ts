import { create } from 'zustand';
import type { BoardState, PhaseCard, TaskCard } from '@/shared/types.js';

// ---------------------------------------------------------------------------
// Board store — global state for dashboard
// ---------------------------------------------------------------------------

/** Coerce gap entries (may be strings or {description/requirement/id} objects) to string[] */
function normalizeGaps(gaps: unknown): string[] {
  if (!Array.isArray(gaps)) return [];
  return gaps.map((g) => {
    if (typeof g === 'string') return g;
    if (g && typeof g === 'object') {
      const obj = g as Record<string, unknown>;
      if (typeof obj.description === 'string') return obj.description;
      if (typeof obj.requirement === 'string') return obj.requirement;
      if (typeof obj.text === 'string') return obj.text;
      if (typeof obj.id === 'string') return `Gap ${obj.id}`;
    }
    return String(g);
  });
}

/** Fill missing optional-in-practice fields so components never crash on partial data */
function normalizePhase(p: PhaseCard): PhaseCard {
  const raw = p as unknown as Record<string, unknown>;
  const verification = (raw.verification as Record<string, unknown>) ?? {};
  const validation = (raw.validation as Record<string, unknown>) ?? {};
  const uat = (raw.uat as Record<string, unknown>) ?? {};
  return {
    ...p,
    goal: p.goal ?? '',
    success_criteria: p.success_criteria ?? [],
    requirements: p.requirements ?? [],
    spec_ref: p.spec_ref ?? null,
    plan: p.plan ?? { task_ids: [], task_count: 0, complexity: null, waves: [] },
    execution: p.execution ?? { method: '', started_at: null, completed_at: null, tasks_completed: 0, tasks_total: 0, current_wave: 0, commits: [] },
    verification: {
      status: String(verification.status ?? 'pending'),
      verified_at: (verification.verified_at as string) ?? null,
      must_haves: Array.isArray(verification.must_haves) ? verification.must_haves as string[] : [],
      gaps: normalizeGaps(verification.gaps),
    },
    validation: {
      status: String(validation.status ?? 'pending'),
      test_coverage: typeof validation.test_coverage === 'number'
        ? validation.test_coverage
        : (validation.test_coverage && typeof validation.test_coverage === 'object')
          ? validation.test_coverage as { statements: number; branches: number; functions: number; lines: number }
          : null,
      gaps: normalizeGaps(validation.gaps),
    },
    uat: {
      status: String(uat.status ?? 'pending'),
      test_count: typeof uat.test_count === 'number' ? uat.test_count : 0,
      passed: typeof uat.passed === 'number' ? uat.passed : 0,
      gaps: normalizeGaps(uat.gaps),
    },
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
    if (board) {
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
        p.phase === phase ? normalizePhase({ ...p, ...data }) : p,
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
