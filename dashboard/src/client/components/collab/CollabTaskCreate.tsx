import { useState } from 'react';
import { useCollabStore } from '@/client/store/collab-store.js';
import {
  COLLAB_TASK_PRIORITY_COLORS,
} from '@/shared/collab-types.js';
import type { CollabTaskPriority } from '@/shared/collab-types.js';

// ---------------------------------------------------------------------------
// CollabTaskCreate — modal for creating a new task
// ---------------------------------------------------------------------------

const PRIORITIES: CollabTaskPriority[] = ['low', 'medium', 'high', 'critical'];

export function CollabTaskCreate({ onClose }: { onClose: () => void }) {
  const createTask = useCollabStore((s) => s.createTask);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<CollabTaskPriority>('medium');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAddTag() {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError(null);
    const result = await createTask(title.trim(), description.trim(), priority, tags);
    setSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error ?? 'Failed to create task');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[420px] max-h-[80vh] bg-bg-primary border border-border rounded-lg shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-[14px] font-semibold text-text-primary">New Task</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary text-[14px]"
            >
              x
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {/* Title */}
            <div>
              <label className="text-[11px] text-text-tertiary mb-1 block">Title *</label>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full px-2.5 py-1.5 rounded border border-border bg-bg-primary text-[12px] text-text-primary outline-none focus:border-text-tertiary"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] text-text-tertiary mb-1 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details..."
                rows={3}
                className="w-full px-2.5 py-1.5 rounded border border-border bg-bg-primary text-[12px] text-text-primary outline-none focus:border-text-tertiary resize-none"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="text-[11px] text-text-tertiary mb-1 block">Priority</label>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => {
                  const color = COLLAB_TASK_PRIORITY_COLORS[p];
                  const active = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className="px-2 py-1 rounded text-[11px] capitalize transition-all"
                      style={{
                        background: active ? `${color}18` : 'transparent',
                        color: active ? color : 'var(--color-text-tertiary)',
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-[11px] text-text-tertiary mb-1 block">Tags</label>
              <div className="flex gap-1 flex-wrap mb-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-bg-tertiary text-text-secondary flex items-center gap-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="text-text-quaternary hover:text-text-primary"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  placeholder="Add tag"
                  className="flex-1 px-2 py-1 rounded border border-border bg-bg-primary text-[11px] text-text-primary outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-2 py-1 rounded text-[11px] text-text-secondary border border-border hover:bg-bg-secondary"
                >
                  Add
                </button>
              </div>
            </div>

            {error && <p className="text-[11px] text-accent-red">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-[11px] text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-3 py-1.5 rounded text-[11px] font-semibold bg-text-primary text-bg-primary hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
