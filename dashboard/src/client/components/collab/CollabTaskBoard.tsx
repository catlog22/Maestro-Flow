import { useCollabStore } from '@/client/store/collab-store.js';
import type { CollabTask } from '@/shared/collab-types.js';
import {
  COLLAB_TASK_COLUMNS,
  COLLAB_TASK_STATUS_COLORS,
} from '@/shared/collab-types.js';
import { CollabTaskCard } from './CollabTaskCard.js';
import { useState } from 'react';
import { CollabTaskCreate } from './CollabTaskCreate.js';

// ---------------------------------------------------------------------------
// CollabTaskBoard — 5-column kanban board for collab tasks
// ---------------------------------------------------------------------------

export function CollabTaskBoard() {
  const tasksByColumn = useCollabStore((s) => s.tasksByColumn());
  const members = useCollabStore((s) => s.members);
  const taskStatusFilter = useCollabStore((s) => s.taskStatusFilter);
  const taskAssigneeFilter = useCollabStore((s) => s.taskAssigneeFilter);
  const setTaskStatusFilter = useCollabStore((s) => s.setTaskStatusFilter);
  const setTaskAssigneeFilter = useCollabStore((s) => s.setTaskAssigneeFilter);
  const setSelectedTaskId = useCollabStore((s) => s.setSelectedTaskId);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <span className="text-[11px] text-text-tertiary mr-1">Status:</span>
        <FilterChip
          label="All"
          active={taskStatusFilter === 'all'}
          onClick={() => setTaskStatusFilter('all')}
        />
        {COLLAB_TASK_COLUMNS.map((col) => (
          <FilterChip
            key={col.id}
            label={col.label}
            color={col.color}
            active={taskStatusFilter === col.id}
            onClick={() => setTaskStatusFilter(col.id)}
          />
        ))}

        <span className="text-text-quaternary mx-2">|</span>

        <span className="text-[11px] text-text-tertiary mr-1">Assignee:</span>
        <select
          value={taskAssigneeFilter}
          onChange={(e) => setTaskAssigneeFilter(e.target.value)}
          className="px-1.5 py-1 rounded border border-border bg-bg-primary text-[11px] text-text-secondary outline-none"
        >
          <option value="all">Everyone</option>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.uid} value={m.uid}>{m.name}</option>
          ))}
        </select>

        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-2.5 py-1 rounded text-[11px] font-semibold bg-text-primary text-bg-primary hover:opacity-90 transition-opacity"
        >
          + New Task
        </button>
      </div>

      {/* Board columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-3 p-4" style={{ minWidth: COLLAB_TASK_COLUMNS.length * 280 }}>
          {COLLAB_TASK_COLUMNS.map((col) => {
            const tasks = tasksByColumn.get(col.id) || [];
            return (
              <div
                key={col.id}
                className="flex flex-col min-w-[280px] w-[280px] bg-bg-secondary rounded-lg border border-border"
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: col.color }}
                  />
                  <span className="text-[12px] font-semibold text-text-primary">{col.label}</span>
                  <span className="text-[10px] text-text-quaternary ml-auto">{tasks.length}</span>
                </div>
                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {tasks.map((task) => (
                    <CollabTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTaskId(task.id)}
                    />
                  ))}
                  {tasks.length === 0 && (
                    <div className="text-[11px] text-text-quaternary text-center py-4">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && <CollabTaskCreate onClose={() => setShowCreate(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterChip — status filter pill
// ---------------------------------------------------------------------------

function FilterChip({ label, color, active, onClick }: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all"
      style={{
        background: active ? (color ? `${color}18` : 'var(--color-bg-tertiary)') : 'transparent',
        color: active ? (color || 'var(--color-text-primary)') : 'var(--color-text-tertiary)',
        fontWeight: active ? 600 : 400,
      }}
    >
      {color && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}
