import { useEffect, useState, useMemo } from 'react';
import { useCollabStore } from '@/client/store/collab-store.js';
import type { CollabActivityEntry } from '@/shared/collab-types.js';
import { COLLAB_ACTION_COLORS } from '@/shared/collab-types.js';

// ---------------------------------------------------------------------------
// CollaborationTimeline — vertical timeline grouped by day with filters
// ---------------------------------------------------------------------------

const ACTION_ICONS: Record<string, string> = {
  init: '⚡',
  join: '→',
  leave: '←',
  phase_change: '◆',
  task_update: '●',
  message: '✉',
  sync: '↻',
  report: '📋',
  discussion: '💬',
};

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'init', label: 'Init' },
  { value: 'join', label: 'Join' },
  { value: 'phase_change', label: 'Phase changes' },
  { value: 'task_update', label: 'Task updates' },
  { value: 'message', label: 'Messages' },
  { value: 'sync', label: 'Sync' },
];

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getDateKey(iso: string): string {
  return new Date(iso).toDateString();
}

function getActionLabel(action: string): string {
  switch (action) {
    case 'init': return 'Initialized collaboration';
    case 'join': return 'Joined the team';
    case 'leave': return 'Left the team';
    case 'phase_change': return 'Changed phase';
    case 'task_update': return 'Updated task';
    case 'message': return 'Sent a message';
    case 'sync': return 'Synced activity';
    case 'report': return 'Generated report';
    case 'discussion': return 'Started discussion';
    default: return action;
  }
}

function getActionBgColor(action: string): string {
  const color = COLLAB_ACTION_COLORS[action] ?? '#9ca3af';
  return `${color}12`;
}

export function CollaborationTimeline() {
  const activity = useCollabStore((s) => s.filteredActivity());
  const allMembers = useCollabStore((s) => s.members);
  const memberFilter = useCollabStore((s) => s.memberFilter);
  const typeFilter = useCollabStore((s) => s.typeFilter);
  const setMemberFilter = useCollabStore((s) => s.setMemberFilter);
  const setTypeFilter = useCollabStore((s) => s.setTypeFilter);
  const fetchActivity = useCollabStore((s) => s.fetchActivity);
  const loading = useCollabStore((s) => s.loading);
  const [limit, setLimit] = useState(200);

  useEffect(() => {
    void fetchActivity(limit);
  }, [fetchActivity, limit]);

  // Group by day
  const grouped = useMemo(() => {
    const groups: { day: string; label: string; entries: CollabActivityEntry[] }[] = [];
    let currentDay = '';
    for (const entry of activity) {
      const dayKey = getDateKey(entry.ts);
      if (dayKey !== currentDay) {
        currentDay = dayKey;
        groups.push({ day: dayKey, label: formatDayLabel(entry.ts), entries: [] });
      }
      groups[groups.length - 1].entries.push(entry);
    }
    return groups;
  }, [activity]);

  // Stats
  const uniqueUsers = new Set(activity.map((e) => e.user)).size;
  const actionTypes = new Set(activity.map((e) => e.action)).size;

  if (loading && activity.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-[length:var(--font-size-sm)]">
        Loading history...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar — filters + stats */}
      <div className="flex items-center gap-3 flex-shrink-0 pb-4">
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="text-[length:var(--font-size-xs)] px-2.5 py-1.5 rounded-[var(--radius-md,6px)] border border-border bg-bg-primary text-text-primary outline-none focus:border-text-tertiary"
        >
          <option value="all">All members</option>
          {allMembers.map((m) => (
            <option key={m.uid} value={m.uid}>{m.name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-[length:var(--font-size-xs)] px-2.5 py-1.5 rounded-[var(--radius-md,6px)] border border-border bg-bg-primary text-text-primary outline-none focus:border-text-tertiary"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {(memberFilter !== 'all' || typeFilter !== 'all') && (
          <button
            type="button"
            onClick={() => { setMemberFilter('all'); setTypeFilter('all'); }}
            className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
          >
            Clear
          </button>
        )}
        {/* Stats */}
        <div className="ml-auto flex items-center gap-4 text-[11px] text-text-quaternary">
          <span>{activity.length} events</span>
          <span>{uniqueUsers} users</span>
          <span>{actionTypes} types</span>
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-quaternary">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="text-text-tertiary text-[length:var(--font-size-sm)]">No events match filters</span>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {grouped.map((group) => (
              <div key={group.day}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3 sticky top-0 bg-bg-primary z-10 py-1">
                  <span className="text-[length:var(--font-size-xs)] font-semibold text-text-primary">{group.label}</span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-text-quaternary">{group.entries.length} events</span>
                </div>

                {/* Events */}
                <div className="relative ml-5 pl-5 border-l-2 border-border">
                  <div className="flex flex-col gap-1">
                    {group.entries.map((entry, idx) => (
                      <TimelineRow key={`${entry.ts}-${entry.user}-${entry.action}-${idx}`} entry={entry} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {activity.length >= limit && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={() => setLimit((prev) => prev + 200)}
              className="px-3 py-1.5 rounded-[var(--radius-md,6px)] text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-all border border-border"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimelineRow — enriched event row in vertical timeline
// ---------------------------------------------------------------------------

function TimelineRow({ entry }: { entry: CollabActivityEntry }) {
  const color = COLLAB_ACTION_COLORS[entry.action] ?? '#9ca3af';
  const icon = ACTION_ICONS[entry.action] ?? '•';
  const initial = entry.user.charAt(0).toUpperCase();

  return (
    <div className="relative flex items-start gap-3 py-2 group hover:bg-bg-secondary/50 rounded-r-[var(--radius-md,6px)] px-3 -ml-[21px] transition-colors">
      {/* Dot on the timeline */}
      <div
        className="absolute -left-[8px] top-[14px] w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: color, backgroundColor: 'var(--color-bg-primary)' }}
      >
        <span style={{ fontSize: '7px', lineHeight: 1, color }}>{icon}</span>
      </div>

      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ml-2"
        style={{ backgroundColor: getActionBgColor(entry.action), color }}
      >
        {initial}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[length:var(--font-size-sm)] font-semibold text-text-primary">
            {entry.user}
          </span>
          <span className="text-[length:var(--font-size-xs)] text-text-secondary">
            {getActionLabel(entry.action)}
          </span>
        </div>
        {/* Extra details row */}
        <div className="flex items-center gap-3 mt-0.5">
          {entry.phase_id && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary border border-border text-text-tertiary">
              Phase {entry.phase_id}
            </span>
          )}
          {entry.task_id && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary border border-border text-text-tertiary">
              {entry.task_id}
            </span>
          )}
          {entry.target && (
            <span className="text-[10px] text-text-tertiary truncate max-w-[200px]" title={entry.target}>
              {entry.target}
            </span>
          )}
          {entry.host && (
            <span className="text-[10px] text-text-quaternary flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              {entry.host}
            </span>
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div className="flex flex-col items-end shrink-0 gap-0.5">
        <span className="text-[11px] text-text-tertiary tabular-nums">
          {formatTime(entry.ts)}
        </span>
        <span className="text-[10px] text-text-quaternary">
          {formatRelativeTime(entry.ts)}
        </span>
      </div>
    </div>
  );
}
