import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCollabStore } from '@/client/store/collab-store.js';
import type { CollabTask } from '@/shared/collab-types.js';
import {
  COLLAB_TASK_TRANSITIONS,
  COLLAB_TASK_STATUS_COLORS,
} from '@/shared/collab-types.js';
import { CollabTaskCheckPanel } from './CollabTaskCheckPanel.js';

// ---------------------------------------------------------------------------
// CollabTaskDetail — right-side slide-in detail panel
// ---------------------------------------------------------------------------

export function CollabTaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const tasks = useCollabStore((s) => s.tasks);
  const members = useCollabStore((s) => s.members);
  const updateTaskStatus = useCollabStore((s) => s.updateTaskStatus);
  const assignTask = useCollabStore((s) => s.assignTask);
  const deleteTask = useCollabStore((s) => s.deleteTask);
  const setSelectedTaskId = useCollabStore((s) => s.setSelectedTaskId);

  const task = tasks.find((t) => t.id === taskId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  useEffect(() => {
    if (task) setTitleValue(task.title);
  }, [task]);

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-[12px]">
        Task not found
      </div>
    );
  }

  const allowedTransitions = COLLAB_TASK_TRANSITIONS[task.status] || [];
  const statusColor = COLLAB_TASK_STATUS_COLORS[task.status];

  async function handleTransition(newStatus: string) {
    await updateTaskStatus(task.id, newStatus as CollabTask['status']);
  }

  async function handleAssign(assignee: string) {
    await assignTask(task.id, assignee || null);
  }

  async function handleDelete() {
    await deleteTask(task.id);
    setSelectedTaskId(null);
    onClose();
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-text-quaternary">{task.id}</span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: `${statusColor}18`, color: statusColor }}
          >
            {task.status.replace('_', ' ')}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-text-tertiary hover:text-text-primary text-[14px] leading-none"
        >
          x
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        {editingTitle ? (
          <input
            autoFocus
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setEditingTitle(false);
              if (e.key === 'Escape') { setTitleValue(task.title); setEditingTitle(false); }
            }}
            className="w-full text-[14px] font-semibold bg-transparent border-b border-border outline-none text-text-primary py-1"
          />
        ) : (
          <h3
            className="text-[14px] font-semibold text-text-primary cursor-pointer hover:text-accent-blue"
            onClick={() => setEditingTitle(true)}
          >
            {task.title}
          </h3>
        )}

        {/* Description */}
        <div>
          <label className="text-[11px] text-text-tertiary mb-1 block">Description</label>
          <p className="text-[12px] text-text-secondary leading-relaxed whitespace-pre-wrap">
            {task.description || 'No description'}
          </p>
        </div>

        {/* Status transition buttons */}
        {allowedTransitions.length > 0 && (
          <div>
            <label className="text-[11px] text-text-tertiary mb-1.5 block">Move to</label>
            <div className="flex flex-wrap gap-1.5">
              {allowedTransitions.map((target) => {
                const color = COLLAB_TASK_STATUS_COLORS[target];
                return (
                  <button
                    key={target}
                    type="button"
                    onClick={() => handleTransition(target)}
                    className="px-2 py-1 rounded text-[11px] font-medium transition-opacity hover:opacity-80"
                    style={{ background: `${color}18`, color }}
                  >
                    {target.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Assignee */}
        <div>
          <label className="text-[11px] text-text-tertiary mb-1.5 block">Assignee</label>
          <select
            value={task.assignee || ''}
            onChange={(e) => handleAssign(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-border bg-bg-primary text-[12px] text-text-secondary outline-none"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.uid} value={m.uid}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div>
            <label className="text-[11px] text-text-tertiary mb-1 block">Tags</label>
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-bg-tertiary text-text-secondary">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Check panel */}
        <CollabTaskCheckPanel task={task} />

        {/* Meta */}
        <div className="text-[10px] text-text-quaternary space-y-0.5 pt-2 border-t border-border">
          <div>Created: {new Date(task.created_at).toLocaleString()}</div>
          <div>Updated: {new Date(task.updated_at).toLocaleString()}</div>
          {task.reporter && <div>Reporter: {task.reporter}</div>}
        </div>
      </div>

      {/* Footer — delete */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <button
          type="button"
          onClick={handleDelete}
          className="px-2.5 py-1.5 rounded text-[11px] text-accent-red border border-accent-red/30 hover:bg-accent-red/10 transition-colors"
        >
          Delete Task
        </button>
      </div>
    </div>
  );
}
