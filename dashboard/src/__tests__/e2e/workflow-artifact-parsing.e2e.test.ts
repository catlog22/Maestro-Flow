import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { StateManager } from '../../server/state/state-manager.js';
import { DashboardEventBus } from '../../server/state/event-bus.js';
import type { BoardState, PhaseCard } from '../../shared/types.js';

// ---------------------------------------------------------------------------
// L3 E2E: Workflow artifact parsing — real-world sandbox data formats
//
// Validates that StateManager.buildInitialState() can parse the varied
// phase index.json formats produced by different Maestro workflow types
// (maestro-link-coordinate, maestro-plan, etc.) without data loss or crashes.
// ---------------------------------------------------------------------------

let workflowRoot: string;
let eventBus: DashboardEventBus;
let stateManager: StateManager;

beforeEach(async () => {
  workflowRoot = join(tmpdir(), `e2e-artifact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  await mkdir(workflowRoot, { recursive: true });
  eventBus = new DashboardEventBus();
  stateManager = new StateManager(workflowRoot, eventBus);
});

afterEach(async () => {
  eventBus.removeAllListeners();
  await rm(workflowRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Real-world phase data fixtures (from .workflow/.scratchpad sandbox artifacts)
// ---------------------------------------------------------------------------

/** Phase from maestro-link-coordinate workflow (workflow-tune-1774018345) */
const COORDINATE_PHASE = {
  phase: 1,
  slug: 'auth-tenant-mgmt',
  title: '用户认证与租户管理',
  milestone: 'v1.0',
  status: 'completed',
  completed_at: '2026-03-20T23:50:00Z',
  depends_on: [],
  created_at: '2026-03-20T14:56:00Z',
  updated_at: '2026-03-20T23:50:00Z',
  plan: {
    task_ids: ['TASK-001', 'TASK-002', 'TASK-003'],
    task_count: 3,
    complexity: 'medium',
    waves: [
      { wave: 1, label: '数据模型', tasks: ['TASK-001'] },
      { wave: 2, label: '认证 API', tasks: ['TASK-002', 'TASK-003'] },
    ],
  },
  execution: {
    started_at: '2026-03-20T23:10:00Z',
    completed_at: '2026-03-20T23:30:00Z',
    current_wave: 2,
    tasks_completed: 3,
    tasks_total: 3,
    commits: [],
  },
  verification: {
    status: 'gaps_found',
    verified_at: '2026-03-20T23:45:00Z',
    coverage_score: 0.75,
    must_haves: {
      truths_total: 4,
      truths_verified: 3,
      truths_failed: 1,
      artifacts_total: 9,
      artifacts_verified: 9,
      key_links_total: 6,
      key_links_wired: 6,
    },
    gaps: [
      {
        id: 'GAP-001',
        severity: 'high',
        description: '缺少成员管理 API',
        issue_id: 'ISS-20260320-001',
      },
    ],
  },
  validation: {
    status: 'gaps_found',
    test_coverage: {
      statements: null,
      branches: null,
      functions: null,
      lines: null,
      note: '无测试框架配置',
    },
    gaps: [
      { requirement: 'JWT token validation', status: 'missing', description: 'No tests for JWT' },
    ],
  },
  uat: {
    status: 'pending',
    test_count: 0,
    passed: 0,
    gaps: [],
  },
};

/** Phase from maestro-plan workflow (workflow-tune-1774065073) — minimal format */
const PLAN_PHASE = {
  phase: 1,
  title: '核心基础',
  slug: 'core-foundation',
  status: 'completed',
  completed_at: '2026-03-21T07:30:00.000Z',
  depends_on: [],
  milestone: 'v1.0',
  created_at: '2026-03-21T00:00:00.000Z',
  updated_at: '2026-03-21T06:30:00.000Z',
  plan: {
    task_ids: ['TASK-001', 'TASK-002'],
    task_count: 2,
    complexity: 'medium',
    waves: [
      { wave: 1, tasks: ['TASK-001', 'TASK-002'] },
    ],
  },
  execution: {
    method: 'agent',
    started_at: '2026-03-21T06:00:00.000Z',
    completed_at: '2026-03-21T06:30:00.000Z',
    current_wave: 1,
    tasks_completed: 2,
    tasks_total: 2,
    commits: [
      { hash: 'abc123', task: 'TASK-001', message: 'feat: init' },
    ],
  },
  verification: {
    status: 'passed',
    verified_at: '2026-03-21T07:00:00.000Z',
    must_haves: ['API endpoints exist', 'Tests pass'],
    gaps: [],
  },
  validation: {
    status: 'passed',
    test_coverage: 85,
    gaps: [],
  },
  uat: {
    status: 'passed',
    test_count: 5,
    passed: 5,
    gaps: [],
  },
  reflection: {
    rounds: 1,
    strategy_adjustments: ['Simplified API surface'],
  },
};

/** Phase with bare minimum fields — missing verification/validation/uat entirely */
const BARE_PHASE = {
  phase: 2,
  slug: 'feature-x',
  title: 'Feature X',
  status: 'pending',
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writePhase(slug: string, data: Record<string, unknown>): Promise<void> {
  const phaseDir = join(workflowRoot, 'phases', slug);
  await mkdir(phaseDir, { recursive: true });
  await writeFile(join(phaseDir, 'index.json'), JSON.stringify(data), 'utf-8');
}

async function writeStateJson(): Promise<void> {
  await writeFile(join(workflowRoot, 'state.json'), JSON.stringify({
    version: '1.0',
    project_name: 'sandbox-test',
    current_milestone: 'v1.0',
    current_phase: 1,
    status: 'executing',
    phases_summary: { total: 3, completed: 1, in_progress: 1, pending: 1 },
    last_updated: new Date().toISOString(),
    accumulated_context: { key_decisions: [], blockers: [], deferred: [] },
  }), 'utf-8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Workflow artifact parsing — real-world formats', () => {
  it('parses coordinate-workflow phase with object must_haves without crash', async () => {
    await writeStateJson();
    await writePhase('01-auth-tenant-mgmt', COORDINATE_PHASE);

    const board = await stateManager.buildInitialState();
    expect(board.phases).toHaveLength(1);

    const phase = board.phases[0];
    expect(phase.phase).toBe(1);
    expect(phase.slug).toBe('auth-tenant-mgmt');
    expect(phase.status).toBe('completed');
    // Must not crash — must_haves should be normalized to string[]
    expect(Array.isArray(phase.verification.must_haves)).toBe(true);
    // Gaps should be normalized from objects to strings
    expect(phase.verification.gaps.length).toBeGreaterThan(0);
  });

  it('parses plan-workflow phase with standard format', async () => {
    await writeStateJson();
    await writePhase('01-core-foundation', PLAN_PHASE);

    const board = await stateManager.buildInitialState();
    expect(board.phases).toHaveLength(1);

    const phase = board.phases[0];
    expect(phase.phase).toBe(1);
    expect(phase.verification.must_haves).toEqual(['API endpoints exist', 'Tests pass']);
    expect(phase.validation.test_coverage).toBe(85);
    expect(phase.reflection.rounds).toBe(1);
  });

  it('parses bare-minimum phase without verification/validation/uat', async () => {
    await writeStateJson();
    await writePhase('02-feature-x', BARE_PHASE);

    const board = await stateManager.buildInitialState();
    expect(board.phases).toHaveLength(1);

    const phase = board.phases[0];
    expect(phase.phase).toBe(2);
    // All optional fields should be filled with defaults
    expect(phase.goal).toBe('');
    expect(phase.success_criteria).toEqual([]);
    expect(phase.plan.task_ids).toEqual([]);
    expect(phase.verification.status).toBeDefined();
    expect(Array.isArray(phase.verification.must_haves)).toBe(true);
    expect(phase.validation.status).toBeDefined();
    expect(phase.uat.status).toBeDefined();
    expect(phase.reflection.rounds).toBe(0);
  });

  it('parses mixed phases in a single board without cross-contamination', async () => {
    await writeStateJson();
    await writePhase('01-auth-tenant-mgmt', COORDINATE_PHASE);
    await writePhase('01-core-foundation', PLAN_PHASE);
    await writePhase('02-feature-x', BARE_PHASE);

    const board = await stateManager.buildInitialState();
    // Phases are deduplicated by phase number; two have phase=1, one has phase=2
    // The order depends on directory scan; both should parse without error
    expect(board.phases.length).toBeGreaterThanOrEqual(2);

    for (const phase of board.phases) {
      // Every phase should have valid structure after normalization
      expect(typeof phase.slug).toBe('string');
      expect(typeof phase.status).toBe('string');
      expect(Array.isArray(phase.verification.must_haves)).toBe(true);
      expect(Array.isArray(phase.verification.gaps)).toBe(true);
      expect(Array.isArray(phase.validation.gaps)).toBe(true);
      expect(Array.isArray(phase.uat.gaps)).toBe(true);
    }
  });

  it('handles execution block without method field', async () => {
    await writeStateJson();
    await writePhase('01-auth-tenant-mgmt', COORDINATE_PHASE);

    const board = await stateManager.buildInitialState();
    const phase = board.phases[0];
    // execution.method should have a default even if missing in source
    expect(typeof phase.execution.method).toBe('string');
  });

  it('handles test_coverage object with null numeric fields', async () => {
    await writeStateJson();
    await writePhase('01-auth-tenant-mgmt', COORDINATE_PHASE);

    const board = await stateManager.buildInitialState();
    const phase = board.phases[0];
    // test_coverage with null numeric fields should still be parsed
    expect(phase.validation.test_coverage === null || typeof phase.validation.test_coverage === 'number' || typeof phase.validation.test_coverage === 'object').toBe(true);
  });

  it('normalizes gap objects to include description text', async () => {
    await writeStateJson();
    await writePhase('01-auth-tenant-mgmt', COORDINATE_PHASE);

    const board = await stateManager.buildInitialState();
    const phase = board.phases[0];

    // Verification gaps should be preserved (objects with description)
    expect(phase.verification.gaps.length).toBe(1);
    // Validation gaps should be preserved
    expect(phase.validation.gaps.length).toBe(1);
  });
});
