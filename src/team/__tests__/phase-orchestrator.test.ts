import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PhaseOrchestrator } from '../phase-orchestrator.js';
import { TeamPhase, TRANSITIONS } from '../phase-types.js';
import type { PhaseTransitionRecord } from '../phase-types.js';

const TEST_DIR = join(tmpdir(), `maestro-test-phase-${Date.now()}`);

function cleanup(): void {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// TeamPhase enum
// ---------------------------------------------------------------------------

describe('TeamPhase enum', () => {
  it('covers all 6 phases', () => {
    const phases = Object.values(TeamPhase);
    assert.strictEqual(phases.length, 6);
    assert.ok(phases.includes(TeamPhase.planning));
    assert.ok(phases.includes(TeamPhase.execution));
    assert.ok(phases.includes(TeamPhase.review));
    assert.ok(phases.includes(TeamPhase.verification));
    assert.ok(phases.includes(TeamPhase.fix));
    assert.ok(phases.includes(TeamPhase.complete));
  });
});

// ---------------------------------------------------------------------------
// TRANSITIONS map
// ---------------------------------------------------------------------------

describe('TRANSITIONS map', () => {
  it('allows planning -> execution', () => {
    const targets = TRANSITIONS.get(TeamPhase.planning)!;
    assert.ok(targets.some((r) => r.to === TeamPhase.execution));
  });

  it('allows execution -> review', () => {
    const targets = TRANSITIONS.get(TeamPhase.execution)!;
    assert.ok(targets.some((r) => r.to === TeamPhase.review));
  });

  it('allows review -> verification', () => {
    const targets = TRANSITIONS.get(TeamPhase.review)!;
    assert.ok(targets.some((r) => r.to === TeamPhase.verification));
  });

  it('allows verification -> complete and verification -> fix', () => {
    const targets = TRANSITIONS.get(TeamPhase.verification)!;
    assert.ok(targets.some((r) => r.to === TeamPhase.complete));
    assert.ok(targets.some((r) => r.to === TeamPhase.fix));
  });

  it('allows fix -> review with max 3 retries', () => {
    const targets = TRANSITIONS.get(TeamPhase.fix)!;
    const rule = targets.find((r) => r.to === TeamPhase.review);
    assert.ok(rule);
    assert.strictEqual(rule!.maxRetries, 3);
  });

  it('complete has no outgoing transitions', () => {
    const targets = TRANSITIONS.get(TeamPhase.complete)!;
    assert.strictEqual(targets.length, 0);
  });
});

// ---------------------------------------------------------------------------
// PhaseOrchestrator
// ---------------------------------------------------------------------------

describe('PhaseOrchestrator', () => {
  let orchestrator: PhaseOrchestrator;

  beforeEach(() => {
    cleanup();
    orchestrator = new PhaseOrchestrator('test-session');
  });

  afterEach(() => cleanup());

  it('starts in planning phase', () => {
    assert.strictEqual(orchestrator.currentPhase, TeamPhase.planning);
    assert.strictEqual(orchestrator.fixAttempts, 0);
  });

  // --- Valid transitions along main flow ---

  it('transitions planning -> execution', () => {
    const result = orchestrator.transitionTo(TeamPhase.execution);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.from, TeamPhase.planning);
    assert.strictEqual(result.to, TeamPhase.execution);
    assert.strictEqual(orchestrator.currentPhase, TeamPhase.execution);
  });

  it('transitions through full main flow to complete', () => {
    orchestrator.transitionTo(TeamPhase.execution);
    orchestrator.transitionTo(TeamPhase.review);
    orchestrator.transitionTo(TeamPhase.verification);
    const result = orchestrator.transitionTo(TeamPhase.complete);

    assert.strictEqual(result.success, true);
    assert.strictEqual(orchestrator.currentPhase, TeamPhase.complete);
  });

  // --- Invalid transitions ---

  it('rejects invalid transition planning -> review', () => {
    const result = orchestrator.transitionTo(TeamPhase.review);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'Invalid transition: planning -> review. Allowed: execution');
    assert.strictEqual(orchestrator.currentPhase, TeamPhase.planning);
  });

  it('rejects invalid transition from complete', () => {
    orchestrator.transitionTo(TeamPhase.execution);
    orchestrator.transitionTo(TeamPhase.review);
    orchestrator.transitionTo(TeamPhase.verification);
    orchestrator.transitionTo(TeamPhase.complete);

    const result = orchestrator.transitionTo(TeamPhase.planning);
    assert.strictEqual(result.success, false);
  });

  // --- Fix loop ---

  it('enters fix loop from verification', () => {
    orchestrator.transitionTo(TeamPhase.execution);
    orchestrator.transitionTo(TeamPhase.review);
    orchestrator.transitionTo(TeamPhase.verification);
    const result = orchestrator.transitionTo(TeamPhase.fix);

    assert.strictEqual(result.success, true);
    assert.strictEqual(orchestrator.currentPhase, TeamPhase.fix);
    assert.strictEqual(orchestrator.fixAttempts, 0); // incremented on fix->review, not on entering fix
  });

  it('fix -> review -> verification -> fix increments fix counter', () => {
    orchestrator.transitionTo(TeamPhase.execution);
    orchestrator.transitionTo(TeamPhase.review);
    orchestrator.transitionTo(TeamPhase.verification);

    // First fix cycle - counter increments on fix->review transition
    orchestrator.transitionTo(TeamPhase.fix);
    assert.strictEqual(orchestrator.fixAttempts, 0); // not yet incremented
    orchestrator.transitionTo(TeamPhase.review);
    assert.strictEqual(orchestrator.fixAttempts, 1); // now incremented
    orchestrator.transitionTo(TeamPhase.verification);

    // Second fix cycle
    orchestrator.transitionTo(TeamPhase.fix);
    assert.strictEqual(orchestrator.fixAttempts, 1);
    orchestrator.transitionTo(TeamPhase.review);
    assert.strictEqual(orchestrator.fixAttempts, 2);
  });

  it('forces transition to complete after max 3 fix attempts', () => {
    orchestrator.transitionTo(TeamPhase.execution);
    orchestrator.transitionTo(TeamPhase.review);
    orchestrator.transitionTo(TeamPhase.verification);

    // 3 fix cycles
    for (let i = 0; i < 3; i++) {
      orchestrator.transitionTo(TeamPhase.fix);
      orchestrator.transitionTo(TeamPhase.review);
      orchestrator.transitionTo(TeamPhase.verification);
    }

    assert.strictEqual(orchestrator.fixAttempts, 3);

    // 4th fix attempt should force to complete
    const result = orchestrator.transitionTo(TeamPhase.fix);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.to, TeamPhase.complete);
    assert.ok(result.reason?.includes('Max fix attempts'));
    assert.strictEqual(orchestrator.currentPhase, TeamPhase.complete);
  });

  // --- Phase gate evaluation ---

  it('rejects transition when hard gate block (review BLOCK)', () => {
    orchestrator.transitionTo(TeamPhase.execution);
    orchestrator.transitionTo(TeamPhase.review);
    orchestrator.transitionTo(TeamPhase.verification);

    const result = orchestrator.transitionTo(TeamPhase.complete, {
      gateConfig: {
        gateInput: {
          review: { verdict: 'BLOCK', findings_count: 5 },
        },
        allowForceOverride: false,
      },
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.reason?.includes('Hard gate block'));
    assert.ok(result.gateReasons.length > 0);
  });

  it('rejects soft block when force not enabled', () => {
    orchestrator.transitionTo(TeamPhase.execution);
    orchestrator.transitionTo(TeamPhase.review);
    orchestrator.transitionTo(TeamPhase.verification);

    const result = orchestrator.transitionTo(TeamPhase.complete, {
      gateConfig: {
        gateInput: {
          validation: { status: 'failed', test_coverage: { statements: 0, branches: 0, functions: 0, lines: 0 } },
        },
        allowForceOverride: false,
      },
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.reason?.includes('Gate blocked'));
  });

  it('allows soft block override with force and allowForceOverride', () => {
    orchestrator.transitionTo(TeamPhase.execution);
    orchestrator.transitionTo(TeamPhase.review);
    orchestrator.transitionTo(TeamPhase.verification);

    const result = orchestrator.transitionTo(TeamPhase.complete, {
      force: true,
      gateConfig: {
        gateInput: {
          validation: { status: 'failed', test_coverage: { statements: 0, branches: 0, functions: 0, lines: 0 } },
        },
        allowForceOverride: true,
      },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.to, TeamPhase.complete);
    assert.ok(result.gateReasons.length > 0);
  });

  it('allows transition with no gate config (all gates soft by default)', () => {
    orchestrator.transitionTo(TeamPhase.execution);
    orchestrator.transitionTo(TeamPhase.review);
    orchestrator.transitionTo(TeamPhase.verification);

    const result = orchestrator.transitionTo(TeamPhase.complete);
    assert.strictEqual(result.success, true);
  });

  // --- Broadcast ---

  it('calls broadcast callback on successful transition', () => {
    let capturedSession: string | undefined;
    let capturedPhase: TeamPhase | undefined;
    let capturedFix: number | undefined;

    const broadcast = (sessionId: string, phase: TeamPhase, fixAttempts: number) => {
      capturedSession = sessionId;
      capturedPhase = phase;
      capturedFix = fixAttempts;
    };

    orchestrator.transitionTo(TeamPhase.execution, { broadcast });
    assert.strictEqual(capturedSession, 'test-session');
    assert.strictEqual(capturedPhase, TeamPhase.execution);
    assert.strictEqual(capturedFix, 0);
  });

  // --- getPhaseStatus ---

  it('returns correct phase status', () => {
    orchestrator.transitionTo(TeamPhase.execution);
    const status = orchestrator.getPhaseStatus();

    assert.strictEqual(status.current, TeamPhase.execution);
    assert.strictEqual(status.fixAttempts, 0);
    assert.strictEqual(status.nextTransitions.length, 1);
    assert.strictEqual(status.nextTransitions[0], TeamPhase.review);
    assert.strictEqual(status.history.length, 1);
    assert.strictEqual(status.history[0].from, TeamPhase.planning);
    assert.strictEqual(status.history[0].to, TeamPhase.execution);
  });

  it('tracks history across multiple transitions', () => {
    orchestrator.transitionTo(TeamPhase.execution);
    orchestrator.transitionTo(TeamPhase.review);
    const status = orchestrator.getPhaseStatus();

    assert.strictEqual(status.history.length, 2);
    assert.strictEqual(status.history[0].from, TeamPhase.planning);
    assert.strictEqual(status.history[0].to, TeamPhase.execution);
    assert.strictEqual(status.history[1].from, TeamPhase.execution);
    assert.strictEqual(status.history[1].to, TeamPhase.review);
  });

  // --- Persistence ---

  it('persists transitions to transitions.jsonl', () => {
    // Override getProjectRoot via env for test
    process.env.MAESTRO_PROJECT_ROOT = TEST_DIR;

    const orchestrator2 = new PhaseOrchestrator('persist-test');
    orchestrator2.transitionTo(TeamPhase.execution);

    const transitionsPath = join(TEST_DIR, '.workflow', '.team', 'persist-test', 'transitions.jsonl');
    assert.ok(existsSync(transitionsPath));

    const content = readFileSync(transitionsPath, 'utf-8').trim();
    const record: PhaseTransitionRecord = JSON.parse(content);
    assert.strictEqual(record.from, TeamPhase.planning);
    assert.strictEqual(record.to, TeamPhase.execution);

    delete process.env.MAESTRO_PROJECT_ROOT;
  });
});
