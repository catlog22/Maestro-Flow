// ---------------------------------------------------------------------------
// Collab Types — shared between server and client for human collaboration
// ---------------------------------------------------------------------------

export interface CollabMember {
  uid: string;
  name: string;
  email: string;
  status: 'online' | 'offline' | 'away';
  currentPhase?: string;
  currentTask?: string;
  lastSeen: string;
  joinedAt: string;
  role: string;
  host: string;
}

export interface CollabActivityEntry {
  ts: string;
  user: string;
  host: string;
  action: string;
  phase_id?: string;
  task_id?: string;
  target?: string;
}

export interface CollabPresence {
  uid: string;
  name: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: string;
}

export interface CollabAggregatedActivity {
  phase: string;
  task: string;
  count: number;
  members: string[];
  risk: 'none' | 'low' | 'medium' | 'high';
}

export interface CollabPreflightResult {
  exists: boolean;
  memberCount: number;
  hasActivity: boolean;
}

export const COLLAB_STATUS_COLORS: Record<'online' | 'offline' | 'away', string> = {
  online: '#22c55e',
  offline: '#9ca3af',
  away: '#eab308',
} as const;

/** Color per activity action type — shared across components */
export const COLLAB_ACTION_COLORS: Record<string, string> = {
  join: '#22c55e',
  phase_change: '#a78bfa',
  task_update: '#34d399',
  task_create: '#22c55e',
  task_assign: '#f59e0b',
  task_check: '#60a5fa',
  task_status: '#34d399',
  task_delete: '#ef4444',
  message: '#60a5fa',
  discussion: '#60a5fa',
  report: '#f59e0b',
  sync: '#06b6d4',
} as const;

// ---------------------------------------------------------------------------
// Collab Task Types
// ---------------------------------------------------------------------------

export type CollabTaskStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'pending_review'
  | 'done'
  | 'closed';

export type CollabTaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type CollabCheckAction = 'confirm' | 'reject' | 'comment';

export interface CollabCheckEntry {
  action: CollabCheckAction;
  author: string;
  comment: string;
  ts: string;
}

export interface CollabTask {
  id: string;
  title: string;
  description: string;
  status: CollabTaskStatus;
  priority: CollabTaskPriority;
  assignee: string | null;
  reporter: string;
  tags: string[];
  check_log: CollabCheckEntry[];
  created_at: string;
  updated_at: string;
}

export const COLLAB_TASK_STATUS_COLORS: Record<CollabTaskStatus, string> = {
  open: '#A09D97',
  assigned: '#f59e0b',
  in_progress: '#B89540',
  pending_review: '#5B8DB8',
  done: '#5A9E78',
  closed: '#6B6966',
} as const;

export const COLLAB_TASK_PRIORITY_COLORS: Record<CollabTaskPriority, string> = {
  low: '#9ca3af',
  medium: '#5B8DB8',
  high: '#f59e0b',
  critical: '#ef4444',
} as const;

export const COLLAB_TASK_TRANSITIONS: Record<CollabTaskStatus, CollabTaskStatus[]> = {
  open: ['assigned', 'closed'],
  assigned: ['in_progress', 'open'],
  in_progress: ['pending_review', 'assigned'],
  pending_review: ['done', 'in_progress'],
  done: ['closed'],
  closed: ['open'],
} as const;

export interface CollabTaskColumn {
  id: CollabTaskStatus;
  label: string;
  color: string;
}

export const COLLAB_TASK_COLUMNS: CollabTaskColumn[] = [
  { id: 'open', label: 'Open', color: COLLAB_TASK_STATUS_COLORS.open },
  { id: 'assigned', label: 'Assigned', color: COLLAB_TASK_STATUS_COLORS.assigned },
  { id: 'in_progress', label: 'In Progress', color: COLLAB_TASK_STATUS_COLORS.in_progress },
  { id: 'pending_review', label: 'Review', color: COLLAB_TASK_STATUS_COLORS.pending_review },
  { id: 'done', label: 'Done', color: COLLAB_TASK_STATUS_COLORS.done },
] as const;
