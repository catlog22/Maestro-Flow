// ---------------------------------------------------------------------------
// Execution Journal types — append-only event log for crash recovery
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Base event
// ---------------------------------------------------------------------------

export interface JournalEventBase {
  type: string;
  timestamp: string;
  issueId: string;
}

// ---------------------------------------------------------------------------
// Issue lifecycle events
// ---------------------------------------------------------------------------

export interface IssueQueuedEvent extends JournalEventBase {
  type: 'issue:queued';
}

export interface IssueDispatchedEvent extends JournalEventBase {
  type: 'issue:dispatched';
  processId: string;
  executor: string;
}

export interface IssueCompletedEvent extends JournalEventBase {
  type: 'issue:completed';
  processId: string;
  result?: {
    summary?: string;
    commitHash?: string;
    filesChanged?: number;
  };
}

export interface IssueFailedEvent extends JournalEventBase {
  type: 'issue:failed';
  processId: string;
  error: string;
  retryCount: number;
}

// ---------------------------------------------------------------------------
// Wave execution events
// ---------------------------------------------------------------------------

export interface WaveStartedEvent extends JournalEventBase {
  type: 'wave:started';
  sessionId: string;
  taskCount: number;
  decomposition?: unknown;
}

export interface WaveTaskCompletedEvent extends JournalEventBase {
  type: 'wave:task_completed';
  sessionId: string;
  taskId: string;
  waveIndex: number;
}

// ---------------------------------------------------------------------------
// Commander / checkpoint events
// ---------------------------------------------------------------------------

export interface CommanderDecisionEvent extends JournalEventBase {
  type: 'commander:decision';
  action: string;
  reason: string;
}

export interface CheckpointEvent extends JournalEventBase {
  type: 'checkpoint:saved';
  data?: unknown;
}

// ---------------------------------------------------------------------------
// Union type
// ---------------------------------------------------------------------------

export type JournalEvent =
  | IssueQueuedEvent
  | IssueDispatchedEvent
  | IssueCompletedEvent
  | IssueFailedEvent
  | WaveStartedEvent
  | WaveTaskCompletedEvent
  | CommanderDecisionEvent
  | CheckpointEvent;

// ---------------------------------------------------------------------------
// Recovery action — output of journal analysis
// ---------------------------------------------------------------------------

export interface RecoveryAction {
  issueId: string;
  action: 'retry' | 'skip' | 'resume-wave';
  reason: string;
  /** For resume-wave: which tasks were already completed */
  completedTaskIds?: string[];
}
