/**
 * Transition Recorder — Records phase/milestone transitions in state.json
 *
 * Provides pure functions for building transition entries and appending
 * them to the transition_history array in .workflow/state.json.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { evaluatePhaseGate } from './phase-gate-evaluator.js';
import { localISO, safeRename } from '../utils/state-schema.js';
import type { TransitionSnapshot, TransitionEntry } from '../utils/state-schema.js';
import type { PhaseGateInput } from './phase-gate-evaluator.js';

// Re-export canonical types from state-schema
export type { TransitionSnapshot, TransitionEntry } from '../utils/state-schema.js';

export interface BuildTransitionOpts {
  type: 'phase' | 'milestone';
  fromPhase: number | null;
  toPhase: number | null;
  milestone: string;
  trigger: string;
  force: boolean;
  phasesCompleted: number;
  phasesTotal: number;
  deferredCount: number;
  verificationStatus: string;
  learningsCount: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a transition entry from the given parameters.
 * Pure function — no I/O.
 */
export function buildTransitionEntry(opts: BuildTransitionOpts): TransitionEntry {
  return {
    type: opts.type,
    from_phase: opts.fromPhase,
    to_phase: opts.toPhase,
    milestone: opts.milestone,
    transitioned_at: localISO(),
    trigger: opts.trigger,
    force: opts.force,
    snapshot: {
      phases_completed: opts.phasesCompleted,
      phases_total: opts.phasesTotal,
      deferred_count: opts.deferredCount,
      verification_status: opts.verificationStatus,
      learnings_count: opts.learningsCount,
    },
  };
}

/**
 * Append a transition entry to state.json's transition_history[].
 * Creates the array if it doesn't exist.
 *
 * For phase-completion transitions, evaluates the phase gate first.
 * Throws if the gate blocks and force is false.
 */
export function appendTransition(statePath: string, entry: TransitionEntry): void {
  if (!existsSync(statePath)) return;

  // Gate check: validate phase readiness before allowing completion
  if (entry.type === 'phase' && entry.from_phase != null) {
    const phaseIndex = loadPhaseIndex(statePath, entry.from_phase);
    if (phaseIndex) {
      const gate = evaluatePhaseGate(phaseIndex);
      if (!gate.allowed) {
        if (!gate.overridable || !entry.force) {
          const tag = gate.overridable ? '[GATE_BLOCKED]' : '[GATE_HARD_BLOCK]';
          throw new Error(
            `${tag} Phase ${entry.from_phase} cannot be completed:\n` +
            gate.reasons.map((r) => `  - ${r}`).join('\n') +
            (gate.overridable ? '\nUse force=true to override soft blocks.' : '\nResolve BLOCK verdict before completing.'),
          );
        }
        // Force override — record the reasons in snapshot for audit
        entry.snapshot.verification_status =
          `force_override: ${gate.reasons.join('; ')}`;
      }
    }
  }

  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  if (!Array.isArray(state.transition_history)) {
    state.transition_history = [];
  }
  state.transition_history.push(entry);
  state.last_updated = localISO();

  const tmpPath = statePath + '.tmp';
  writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
  safeRename(tmpPath, statePath);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load phase index.json from the phases directory sibling to state.json.
 * Returns null if not found.
 */
function loadPhaseIndex(statePath: string, phaseNum: number): PhaseGateInput | null {
  const workflowDir = dirname(statePath);
  const phasesDir = join(workflowDir, 'phases');
  if (!existsSync(phasesDir)) return null;

  // Find directory starting with the phase number prefix (e.g. "01-")
  try {
    const prefix = String(phaseNum).padStart(2, '0') + '-';
    const entries = readdirSync(phasesDir);
    const phaseSlug = entries.find((e) => e.startsWith(prefix));
    if (!phaseSlug) return null;

    const indexPath = join(phasesDir, phaseSlug, 'index.json');
    if (!existsSync(indexPath)) return null;
    return JSON.parse(readFileSync(indexPath, 'utf8')) as PhaseGateInput;
  } catch {
    return null;
  }
}
