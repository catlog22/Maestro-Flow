import { useState, useEffect, useRef } from 'react';
import { useBoardStore } from '@/client/store/board-store.js';
import type { TaskCard } from '@/shared/types.js';

// ---------------------------------------------------------------------------
// usePhaseTasks — lazy-fetches tasks for a phase, re-fetches on updated_at change
// ---------------------------------------------------------------------------

interface UsePhaseTasksResult {
  tasks: TaskCard[];
  loading: boolean;
  error: string | null;
}

export function usePhaseTasks(phaseId: number | null): UsePhaseTasksResult {
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phase = useBoardStore((s) =>
    phaseId !== null ? s.board?.phases.find((p) => p.phase === phaseId) : undefined,
  );
  const updatedAt = phase?.updated_at ?? null;
  const prevUpdatedAt = useRef<string | null>(null);

  useEffect(() => {
    if (phaseId === null) {
      setTasks([]);
      setLoading(false);
      setError(null);
      prevUpdatedAt.current = null;
      return;
    }

    if (updatedAt === prevUpdatedAt.current && tasks.length > 0) return;
    prevUpdatedAt.current = updatedAt;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/phases/${phaseId}/tasks`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: TaskCard[]) => {
        if (!cancelled) {
          setTasks(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [phaseId, updatedAt]);

  return { tasks, loading, error };
}
