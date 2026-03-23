// ---------------------------------------------------------------------------
// Schedule types -- scheduled tasks and run history
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Task run history
// ---------------------------------------------------------------------------

export interface TaskRunHistory {
  timestamp: string;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  result?: string;
}

// ---------------------------------------------------------------------------
// Scheduled task definition
// ---------------------------------------------------------------------------

export type ScheduledTaskType =
  | 'auto-dispatch'
  | 'cleanup'
  | 'report'
  | 'health-check'
  | 'learning-analysis'
  | 'custom';

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  taskType: ScheduledTaskType;
  config: Record<string, unknown>;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  history: TaskRunHistory[];
}
