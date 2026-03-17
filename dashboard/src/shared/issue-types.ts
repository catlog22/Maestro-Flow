// ---------------------------------------------------------------------------
// Issue type system -- types for the Issue tracking feature
// ---------------------------------------------------------------------------

/** Issue classification */
export type IssueType = 'bug' | 'feature' | 'improvement' | 'task';

/** Issue priority levels */
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';

/** Issue lifecycle status */
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

// ---------------------------------------------------------------------------
// Core interfaces
// ---------------------------------------------------------------------------

/** Full Issue record (stored in JSONL) */
export interface Issue {
  id: string;
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  source_entry_id?: string;
  source_process_id?: string;
  created_at: string;
  updated_at: string;
}

/** Request body for creating a new issue */
export interface CreateIssueRequest {
  title: string;
  description: string;
  type?: IssueType;
  priority?: IssuePriority;
  source_entry_id?: string;
  source_process_id?: string;
}

/** Request body for updating an existing issue */
export interface UpdateIssueRequest {
  title?: string;
  description?: string;
  type?: IssueType;
  priority?: IssuePriority;
  status?: IssueStatus;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export const VALID_ISSUE_TYPES: ReadonlySet<string> = new Set<string>([
  'bug', 'feature', 'improvement', 'task',
]);

export const VALID_ISSUE_PRIORITIES: ReadonlySet<string> = new Set<string>([
  'low', 'medium', 'high', 'urgent',
]);

export const VALID_ISSUE_STATUSES: ReadonlySet<string> = new Set<string>([
  'open', 'in_progress', 'resolved', 'closed',
]);
