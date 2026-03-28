// ---------------------------------------------------------------------------
// Coordinate Runner types -- session, step, and event payload interfaces
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step & session status enums
// ---------------------------------------------------------------------------

export type CoordinateStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export type CoordinateSessionStatus =
  | 'idle'
  | 'awaiting_clarification'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

// ---------------------------------------------------------------------------
// Core interfaces
// ---------------------------------------------------------------------------

/** Individual step within a coordinate chain */
export interface CoordinateStep {
  index: number;
  cmd: string;
  args: string;
  rawArgs?: string;
  status: CoordinateStepStatus;
  processId: string | null;
  analysis: string | null;
  summary: string | null;
  qualityScore?: number | null;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

/** Full coordinate session state */
export interface CoordinateSession {
  sessionId: string;
  status: CoordinateSessionStatus;
  intent: string;
  chainName: string | null;
  tool: string | null;
  autoMode: boolean;
  currentStep: number;
  steps: CoordinateStep[];
  avgQuality: number | null;
  snapshot?: unknown | null;
  classification?: unknown | null;
}

// ---------------------------------------------------------------------------
// Event payloads — one per coordinate SSE/WS event type
// ---------------------------------------------------------------------------

/** Payload for 'coordinate:status' — session-level state change */
export interface CoordinateStatusPayload {
  session: CoordinateSession;
}

/** Payload for 'coordinate:step' — step-level progress update */
export interface CoordinateStepPayload {
  sessionId: string;
  step: CoordinateStep;
}

/** Payload for 'coordinate:analysis' — intent classification result */
export interface CoordinateAnalysisPayload {
  sessionId: string;
  intent: string;
  chainName: string;
  steps: Array<{ cmd: string; args: string }>;
}

/** Payload for 'coordinate:clarification_needed' — intent needs user input */
export interface CoordinateClarificationPayload {
  sessionId: string;
  question: string;
}
