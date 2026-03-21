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
  | 'classifying'
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
  status: CoordinateStepStatus;
  processId: string | null;
  analysis: string | null;
  summary: string | null;
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
