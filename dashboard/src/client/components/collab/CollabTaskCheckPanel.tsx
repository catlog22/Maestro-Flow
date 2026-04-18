import { useState } from 'react';
import { useCollabStore } from '@/client/store/collab-store.js';
import type { CollabTask, CollabCheckAction } from '@/shared/collab-types.js';

// ---------------------------------------------------------------------------
// CollabTaskCheckPanel — confirm/reject/comment with timeline
// ---------------------------------------------------------------------------

const CHECK_ACTIONS: { action: CollabCheckAction; label: string; color: string }[] = [
  { action: 'confirm', label: 'Confirm', color: '#22c55e' },
  { action: 'reject', label: 'Reject', color: '#ef4444' },
  { action: 'comment', label: 'Comment', color: '#60a5fa' },
];

const ACTION_ICONS: Record<CollabCheckAction, string> = {
  confirm: '\u2713',
  reject: '\u2717',
  comment: '\u2026',
};

export function CollabTaskCheckPanel({ task }: { task: CollabTask }) {
  const addTaskCheck = useCollabStore((s) => s.addTaskCheck);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCheck(action: CollabCheckAction) {
    if (action !== 'comment' && !comment.trim()) return;
    setSubmitting(true);
    await addTaskCheck(task.id, action, comment.trim());
    setComment('');
    setSubmitting(false);
  }

  const log = task.check_log || [];

  return (
    <div>
      <label className="text-[11px] text-text-tertiary mb-1.5 block">
        Check Log ({log.length})
      </label>

      {/* Action buttons + comment input */}
      <div className="flex gap-1 mb-2">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 px-2 py-1 rounded border border-border bg-bg-primary text-[11px] text-text-primary outline-none focus:border-text-tertiary"
        />
        {CHECK_ACTIONS.map(({ action, label, color }) => (
          <button
            key={action}
            type="button"
            onClick={() => handleCheck(action)}
            disabled={submitting || (action !== 'comment' && !comment.trim())}
            className="px-2 py-1 rounded text-[11px] font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
            style={{ background: `${color}18`, color }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {log.length > 0 && (
        <div className="space-y-0 max-h-[200px] overflow-y-auto">
          {[...log].reverse().map((entry, i) => (
            <div
              key={i}
              className="flex items-start gap-2 py-1.5"
              style={{
                borderLeft: `2px solid ${entry.action === 'confirm' ? '#22c55e' : entry.action === 'reject' ? '#ef4444' : '#60a5fa'}`,
                paddingLeft: '8px',
                marginLeft: '4px',
              }}
            >
              <span className="text-[10px] text-text-quaternary shrink-0 w-14 tabular-nums">
                {formatRelativeTime(entry.ts)}
              </span>
              <span
                className="text-[10px] font-semibold shrink-0"
                style={{
                  color: entry.action === 'confirm' ? '#22c55e' : entry.action === 'reject' ? '#ef4444' : '#60a5fa',
                }}
              >
                {ACTION_ICONS[entry.action]} {entry.author}
              </span>
              {entry.comment && (
                <span className="text-[11px] text-text-secondary">{entry.comment}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
