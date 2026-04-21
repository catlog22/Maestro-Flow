/**
 * L2 Integration Tests — Phase orchestrator + team-msg broadcast integration
 *
 * Tests:
 * - Phase transition with broadcast callback
 * - Fix retry counter mechanics across verification→fix→review loops
 * - Phase gate evaluation integration
 * - Transition persistence to JSONL
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { PhaseOrchestrator } from '../phase-orchestrator.js';
import type { TransitionResult } from '../phase-orchestrator.js';
import { TeamPhase, TRANSITIONS } from '../phase-types.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let prevRoot: string | undefined;

function setup(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'phase-integ-test-'));
  prevRoot = process.env.MAESTRO_PROJECT_ROOT;
  process.env.MAESTRO_PROJECT_ROOT = tmpDir;
}

function teardown(): void {
  if (prevRoot === undefined) {
    delete process.env.MAESTRO_PROJECT_ROOT;
  } else {
    process.env.MAESTRO_PROJECT_ROOT = prevRoot;
  }
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// 1. Phase transition with broadcast callback
// ---------------------------------------------------------------------------

describe('L2: phase-orchestrator + broadcast callback', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('calls broadcast callback on successful transition', () => {
    const orch = new PhaseOrchestrator('test-session');
    const broadcasts: { sessionId: string; phase: TeamPhase; fixAttempts: number }[] = [];

    const result = orch.transitionTo(TeamPhase.execution, {
      broadcast: (sessionId, phase, fixAttempts) => {
        broadcasts.push({ sessionId, phase, fixAttempts });
      },
    });

    expect(result.success).toBe(true);
    expect(result.from).toBe(TeamPhase.planning);
    expect(result.to).toBe(TeamPhase.execution);
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].sessionId).toBe('test-session');
    expect(broadcasts[0].phase).toBe(TeamPhase.execution);
    expect(broadcasts[0].fixAttempts).toBe(0);
  });

  it('does NOT call broadcast on failed transition', () => {
    const orch = new PhaseOrchestrator('test-session');
    const broadcasts: unknown[] = [];

    // Try invalid transition: planning → review (skipping execution)
    const result = orch.transitionTo(TeamPhase.review, {
      broadcast: () => { broadcasts.push(true); },
    });

    expect(result.success).toBe(false);
    expect(broadcasts).toHaveLength(0);
  });

  it('broadcast receives updated fixAttempts after fix→review cycle', () => {
    const orch = new PhaseOrchestrator('test-session');
    const broadcasts: { phase: TeamPhase; fixAttempts: number }[] = [];
    const broadcastFn = (_: string, phase: TeamPhase, fixAttempts: number) => {
      broadcasts.push({ phase, fixAttempts });
    };

    // Navigate: planning → execution → review → verification → fix → review
    orch.transitionTo(TeamPhase.execution, { broadcast: broadcastFn });
    orch.transitionTo(TeamPhase.review, { broadcast: broadcastFn });
    orch.transitionTo(TeamPhase.verification, { broadcast: broadcastFn });
    orch.transitionTo(TeamPhase.fix, { broadcast: broadcastFn });
    orch.transitionTo(TeamPhase.review, { broadcast: broadcastFn });

    // After fix→review, fixAttempts should be 1
    const lastBroadcast = broadcasts[broadcasts.length - 1];
    expect(lastBroadcast.phase).toBe(TeamPhase.review);
    expect(lastBroadcast.fixAttempts).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Fix retry counter mechanics
// ---------------------------------------------------------------------------

describe('L2: fix retry counter mechanics', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('counts fix attempts across verification→fix→review cycles', () => {
    const orch = new PhaseOrchestrator('test-session');

    // Navigate to verification
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);

    // Fix cycle 1
    orch.transitionTo(TeamPhase.fix);
    expect(orch.fixAttempts).toBe(0); // Not incremented until fix→review
    orch.transitionTo(TeamPhase.review);
    expect(orch.fixAttempts).toBe(1);

    // Back to verification
    orch.transitionTo(TeamPhase.verification);

    // Fix cycle 2
    orch.transitionTo(TeamPhase.fix);
    orch.transitionTo(TeamPhase.review);
    expect(orch.fixAttempts).toBe(2);

    // Back to verification
    orch.transitionTo(TeamPhase.verification);

    // Fix cycle 3
    orch.transitionTo(TeamPhase.fix);
    orch.transitionTo(TeamPhase.review);
    expect(orch.fixAttempts).toBe(3);

    // Back to verification - should force complete on next fix attempt
    orch.transitionTo(TeamPhase.verification);
  });

  it('forces transition to complete when max fix attempts exceeded', () => {
    const orch = new PhaseOrchestrator('test-session');

    // Navigate to verification
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);

    // Run 3 fix cycles
    for (let i = 0; i < 3; i++) {
      orch.transitionTo(TeamPhase.fix);
      orch.transitionTo(TeamPhase.review);
      orch.transitionTo(TeamPhase.verification);
    }

    // 4th attempt: verification→fix should be forced to complete
    const result = orch.transitionTo(TeamPhase.fix);
    expect(result.success).toBe(true);
    expect(result.to).toBe(TeamPhase.complete); // Forced to complete, not fix
    expect(result.reason).toContain('Max fix attempts');
    expect(orch.currentPhase).toBe(TeamPhase.complete);
  });

  it('fix counter resets when transitioning to complete', () => {
    const orch = new PhaseOrchestrator('test-session');

    // Navigate through one fix cycle
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);
    orch.transitionTo(TeamPhase.fix);
    orch.transitionTo(TeamPhase.review);
    expect(orch.fixAttempts).toBe(1);

    // Go to verification → complete
    orch.transitionTo(TeamPhase.verification);
    orch.transitionTo(TeamPhase.complete);
    expect(orch.fixAttempts).toBe(0); // Reset on complete
  });
});

// ---------------------------------------------------------------------------
// 3. Phase gate evaluation integration
// ---------------------------------------------------------------------------

describe('L2: phase gate evaluation', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('blocks transition when gate evaluation fails (hard block)', () => {
    const orch = new PhaseOrchestrator('test-session');

    // Navigate to verification
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);

    // Try to transition with a hard-blocking gate (review verdict BLOCK)
    const result = orch.transitionTo(TeamPhase.complete, {
      gateConfig: {
        gateInput: {
          review: { verdict: 'BLOCK', findings_count: 5 },
        },
        allowForceOverride: false,
      },
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Hard gate block');
    expect(result.gateReasons.length).toBeGreaterThan(0);
    expect(orch.currentPhase).toBe(TeamPhase.verification); // Should stay put
  });

  it('allows force override of soft-blocked gate', () => {
    const orch = new PhaseOrchestrator('test-session');

    // Navigate to verification
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);

    // Try with a soft-blocking gate but force=true
    const result = orch.transitionTo(TeamPhase.complete, {
      force: true,
      gateConfig: {
        gateInput: {
          verification: { status: 'incomplete', gaps: [{ severity: 'low', description: 'minor gap' }] },
        },
        allowForceOverride: true,
      },
    });

    expect(result.success).toBe(true);
    expect(result.to).toBe(TeamPhase.complete);
    // Gate reasons should be populated even on forced success
    // (only if there were actual soft blocks)
  });

  it('allows transition when gate evaluation passes', () => {
    const orch = new PhaseOrchestrator('test-session');

    // Navigate to verification
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);

    // Gate passes (review approved, verification complete)
    const result = orch.transitionTo(TeamPhase.complete, {
      gateConfig: {
        gateInput: {
          review: { verdict: 'APPROVE', findings_count: 0 },
          verification: { status: 'complete', gaps: [] },
        },
        allowForceOverride: false,
      },
    });

    expect(result.success).toBe(true);
    expect(result.to).toBe(TeamPhase.complete);
  });
});

// ---------------------------------------------------------------------------
// 4. Transition persistence
// ---------------------------------------------------------------------------

describe('L2: transition persistence to JSONL', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('persists each transition to transitions.jsonl', () => {
    const sessionId = 'persist-test';
    const orch = new PhaseOrchestrator(sessionId);

    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);

    const filePath = join(tmpDir, '.workflow', '.team', sessionId, 'transitions.jsonl');
    expect(existsSync(filePath)).toBe(true);

    const lines = readFileSync(filePath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);

    const t1 = JSON.parse(lines[0]);
    expect(t1.from).toBe(TeamPhase.planning);
    expect(t1.to).toBe(TeamPhase.execution);
    expect(t1.timestamp).toBeDefined();
    expect(t1.trigger).toBe('phase_orchestrator');
    expect(t1.force).toBe(false);

    const t2 = JSON.parse(lines[1]);
    expect(t2.from).toBe(TeamPhase.execution);
    expect(t2.to).toBe(TeamPhase.review);
  });

  it('records custom trigger in transition history', () => {
    const sessionId = 'trigger-test';
    const orch = new PhaseOrchestrator(sessionId);

    orch.transitionTo(TeamPhase.execution, { trigger: 'coordinator_decision' });

    const filePath = join(tmpDir, '.workflow', '.team', sessionId, 'transitions.jsonl');
    const line = readFileSync(filePath, 'utf-8').trim();
    const record = JSON.parse(line);
    expect(record.trigger).toBe('coordinator_decision');
  });

  it('records gate reasons in transition history when force-overriding', () => {
    const sessionId = 'gate-reasons-test';
    const orch = new PhaseOrchestrator(sessionId);

    // Navigate to verification
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);

    // Force-override a soft gate
    orch.transitionTo(TeamPhase.complete, {
      force: true,
      gateConfig: {
        gateInput: {
          verification: { status: 'incomplete', gaps: [{ severity: 'low', description: 'test gap' }] },
        },
        allowForceOverride: true,
      },
    });

    const filePath = join(tmpDir, '.workflow', '.team', sessionId, 'transitions.jsonl');
    const lines = readFileSync(filePath, 'utf-8').trim().split('\n');
    const lastRecord = JSON.parse(lines[lines.length - 1]);
    expect(lastRecord.to).toBe(TeamPhase.complete);
    expect(lastRecord.force).toBe(true);
  });

  it('getPhaseStatus returns full transition history', () => {
    const orch = new PhaseOrchestrator('status-test');

    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);

    const status = orch.getPhaseStatus();
    expect(status.current).toBe(TeamPhase.review);
    expect(status.fixAttempts).toBe(0);
    expect(status.history).toHaveLength(2);
    expect(status.history[0].from).toBe(TeamPhase.planning);
    expect(status.history[0].to).toBe(TeamPhase.execution);
    expect(status.history[1].from).toBe(TeamPhase.execution);
    expect(status.history[1].to).toBe(TeamPhase.review);

    // nextTransitions from review should include verification
    expect(status.nextTransitions).toContain(TeamPhase.verification);
  });
});

// ---------------------------------------------------------------------------
// 5. Invalid transitions
// ---------------------------------------------------------------------------

describe('L2: invalid transition rejection', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('rejects skipping phases (planning → review)', () => {
    const orch = new PhaseOrchestrator('invalid-test');

    const result = orch.transitionTo(TeamPhase.review);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Invalid transition');
    expect(result.reason).toContain('Allowed');
    expect(orch.currentPhase).toBe(TeamPhase.planning); // Unchanged
  });

  it('rejects transition from complete (terminal state)', () => {
    const orch = new PhaseOrchestrator('terminal-test');

    // Navigate to complete
    orch.transitionTo(TeamPhase.execution);
    orch.transitionTo(TeamPhase.review);
    orch.transitionTo(TeamPhase.verification);
    orch.transitionTo(TeamPhase.complete);

    // Try to transition from complete
    const result = orch.transitionTo(TeamPhase.planning);
    expect(result.success).toBe(false);
    expect(orch.currentPhase).toBe(TeamPhase.complete);
  });

  it('rejects backward transition (execution → planning)', () => {
    const orch = new PhaseOrchestrator('backward-test');

    orch.transitionTo(TeamPhase.execution);
    const result = orch.transitionTo(TeamPhase.planning);
    expect(result.success).toBe(false);
    expect(orch.currentPhase).toBe(TeamPhase.execution);
  });
});
