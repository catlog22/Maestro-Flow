import { useEffect, useMemo, useState } from 'react';
import type { TaskCard, TaskStatus } from '@/shared/types.js';
import { TaskRow } from './TaskRow.js';
import { TaskDetailDrawer } from './TaskDetailDrawer.js';

// ---------------------------------------------------------------------------
// TasksTabPanel — task list with filter bar and detail drawer
// ---------------------------------------------------------------------------

interface TasksTabPanelProps {
  phaseId: number | null;
}

type StatusFilter = TaskStatus | 'all';

const FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse">
      <span className="w-8 h-5 rounded bg-[var(--color-bg-hover)]" />
      <span className="w-20 h-5 rounded bg-[var(--color-bg-hover)]" />
      <span className="flex-1 h-5 rounded bg-[var(--color-bg-hover)]" />
      <span className="w-16 h-5 rounded-full bg-[var(--color-bg-hover)]" />
    </div>
  );
}

export function TasksTabPanel({ phaseId }: TasksTabPanelProps) {
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTask, setSelectedTask] = useState<TaskCard | null>(null);

  useEffect(() => {
    if (phaseId === null) {
      setTasks([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/phases/${phaseId}/tasks`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) {
            setTasks([]);
            setLoading(false);
            return;
          }
          throw new Error(`Failed to load tasks (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setTasks(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        setLoading(false);
      });

    return () => controller.abort();
  }, [phaseId]);

  const filteredTasks = useMemo(
    () =>
      statusFilter === 'all'
        ? tasks
        : tasks.filter((t) => t.meta.status === statusFilter),
    [tasks, statusFilter],
  );

  const countByStatus = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: tasks.length,
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
    };
    for (const t of tasks) {
      counts[t.meta.status] = (counts[t.meta.status] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0 flex-wrap">
        {FILTER_OPTIONS.map((opt) => {
          const active = statusFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={[
                'px-2.5 py-1 text-xs rounded-full border transition-colors duration-[var(--duration-fast)]',
                active
                  ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-accent-blue)] border-[var(--color-accent-blue)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-text-tertiary)]',
              ].join(' ')}
            >
              {opt.label} ({countByStatus[opt.value]})
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="divide-y divide-[var(--color-border)]">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-tertiary)]">
            {tasks.length === 0 ? 'No tasks for this phase' : 'No tasks match the selected filter'}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {filteredTasks.map((task) => (
              <li key={task.id}>
                <TaskRow task={task} onClick={() => setSelectedTask(task)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
