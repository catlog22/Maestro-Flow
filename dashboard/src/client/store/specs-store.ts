import { create } from 'zustand';
import { SPECS_API_ENDPOINTS } from '@/shared/constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpecType = 'bug' | 'pattern' | 'decision' | 'rule' | 'general';

export interface SpecEntry {
  id: string;
  type: SpecType;
  title: string;
  content: string;
  file: string;
  timestamp: string;
}

export interface SpecFile {
  name: string;
  path: string;
  title: string;
  category: string;
  entryCount: number;
}

type TypeFilter = 'all' | SpecType;
type SpecsView = 'kanban' | 'table';

export interface SpecsStore {
  entries: SpecEntry[];
  files: SpecFile[];
  loading: boolean;
  error: string | null;
  activeView: SpecsView;
  typeFilter: TypeFilter;
  search: string;
  selectedEntry: string | null;

  setActiveView: (view: SpecsView) => void;
  setTypeFilter: (filter: TypeFilter) => void;
  setSearch: (q: string) => void;
  setSelectedEntry: (id: string | null) => void;

  fetchEntries: () => Promise<void>;
  fetchFiles: () => Promise<void>;
  addEntry: (type: SpecType, content: string, file: string) => Promise<SpecEntry | null>;
  deleteEntry: (id: string) => Promise<void>;

  // Derived
  filteredEntries: () => SpecEntry[];
  entriesByType: () => Record<SpecType, SpecEntry[]>;
  typeCounts: () => Record<SpecType | 'all', number>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSpecsStore = create<SpecsStore>((set, get) => ({
  entries: [],
  files: [],
  loading: false,
  error: null,
  activeView: 'kanban',
  typeFilter: 'all',
  search: '',
  selectedEntry: null,

  setActiveView: (view) => set({ activeView: view }),
  setTypeFilter: (filter) => set({ typeFilter: filter }),
  setSearch: (q) => set({ search: q }),
  setSelectedEntry: (id) => set({ selectedEntry: id }),

  fetchEntries: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(SPECS_API_ENDPOINTS.SPECS);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = (await res.json()) as { entries: SpecEntry[] };
      set({ entries: data.entries ?? [], loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  fetchFiles: async () => {
    try {
      const res = await fetch(SPECS_API_ENDPOINTS.SPECS_FILES);
      if (!res.ok) return;
      const data = (await res.json()) as { files: SpecFile[] };
      set({ files: data.files ?? [] });
    } catch {
      // Non-critical
    }
  },

  addEntry: async (type, content, file) => {
    set({ error: null });
    try {
      const res = await fetch(SPECS_API_ENDPOINTS.SPECS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, file }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((errBody as { error: string }).error);
      }
      // Refresh full list to get correct IDs
      void get().fetchEntries();
      return null;
    } catch (err) {
      set({ error: String(err) });
      return null;
    }
  },

  deleteEntry: async (id) => {
    set({ error: null });
    const prev = get().entries;
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
    try {
      const res = await fetch(`${SPECS_API_ENDPOINTS.SPECS}/${id}`, { method: 'DELETE' });
      if (!res.ok) set({ entries: prev });
    } catch {
      set({ entries: prev });
    }
  },

  filteredEntries: () => {
    const { entries, typeFilter, search } = get();
    let result = entries;
    if (typeFilter !== 'all') result = result.filter((e) => e.type === typeFilter);
    if (search) {
      const lc = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(lc) ||
          e.content.toLowerCase().includes(lc) ||
          e.id.toLowerCase().includes(lc),
      );
    }
    return result;
  },

  entriesByType: () => {
    const entries = get().filteredEntries();
    const grouped: Record<SpecType, SpecEntry[]> = {
      bug: [],
      pattern: [],
      decision: [],
      rule: [],
      general: [],
    };
    for (const e of entries) {
      (grouped[e.type] ?? grouped.general).push(e);
    }
    return grouped;
  },

  typeCounts: () => {
    const { entries } = get();
    const counts: Record<string, number> = { all: entries.length, bug: 0, pattern: 0, decision: 0, rule: 0, general: 0 };
    for (const e of entries) counts[e.type] = (counts[e.type] ?? 0) + 1;
    return counts as Record<SpecType | 'all', number>;
  },
}));
