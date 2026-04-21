/**
 * Phase Types - TeamPhase enum, transition rules, and gate configuration
 * for the Phase Orchestrator.
 *
 * Defines the canonical set of team workflow phases, the valid transitions
 * between them, and configuration for phase-gate evaluation.
 */

import type { PhaseGateInput } from '../tools/phase-gate-evaluator.js';

// ---------------------------------------------------------------------------
// TeamPhase enum
// ---------------------------------------------------------------------------

export enum TeamPhase {
  planning = 'planning',
  execution = 'execution',
  review = 'review',
  verification = 'verification',
  fix = 'fix',
  complete = 'complete',
}

// ---------------------------------------------------------------------------
// Transition rule
// ---------------------------------------------------------------------------

export interface TransitionRule {
  /** Target phase */
  to: TeamPhase;
  /** Maximum consecutive transitions to this target (null = unlimited) */
  maxRetries: number | null;
}

// ---------------------------------------------------------------------------
// TRANSITIONS map
// ---------------------------------------------------------------------------

/**
 * Valid phase transitions.
 * Key = source phase, Value = array of allowed target phases with retry limits.
 *
 * Main flow: planning -> execution -> review -> verification -> complete
 * Fix loop:  verification -> fix -> review (max 3 fix retries)
 */
export const TRANSITIONS: ReadonlyMap<TeamPhase, readonly TransitionRule[]> = new Map([
  [TeamPhase.planning, [{ to: TeamPhase.execution, maxRetries: null }]],
  [TeamPhase.execution, [{ to: TeamPhase.review, maxRetries: null }]],
  [TeamPhase.review, [{ to: TeamPhase.verification, maxRetries: null }]],
  [TeamPhase.verification, [
    { to: TeamPhase.complete, maxRetries: null },
    { to: TeamPhase.fix, maxRetries: null },
  ]],
  [TeamPhase.fix, [{ to: TeamPhase.review, maxRetries: 3 }]],
  [TeamPhase.complete, []],
]);

// ---------------------------------------------------------------------------
// PhaseGateConfig
// ---------------------------------------------------------------------------

export interface PhaseGateConfig {
  /** Phase gate input for evaluation (review/verification/validation status) */
  gateInput: PhaseGateInput;
  /** Whether to allow force-overriding soft blocks */
  allowForceOverride: boolean;
}

// ---------------------------------------------------------------------------
// Phase transition record (history entry)
// ---------------------------------------------------------------------------

export interface PhaseTransitionRecord {
  from: TeamPhase;
  to: TeamPhase;
  timestamp: string;
  trigger: string;
  force: boolean;
  gateReasons: string[];
}

// ---------------------------------------------------------------------------
// Phase status
// ---------------------------------------------------------------------------

export interface PhaseStatus {
  current: TeamPhase;
  fixAttempts: number;
  history: PhaseTransitionRecord[];
  nextTransitions: TeamPhase[];
}
