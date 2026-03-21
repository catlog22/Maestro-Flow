import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createBoardRoutes } from './board.js';
import { createPhaseRoutes } from './phases.js';
import { StateManager } from '../state/state-manager.js';
import { DashboardEventBus } from '../state/event-bus.js';
import type { BoardState, PhaseCard, ProjectState, SSEEvent } from '../../shared/types.js';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// L2 Integration: Board/Phase routes <-> StateManager <-> EventBus <-> FileSystem
// Tests real cross-module interactions with actual file I/O
// ---------------------------------------------------------------------------

let workflowRoot: string;
let eventBus: DashboardEventBus;
let stateManager: StateManager;
let app: Hono;

beforeEach(async () => {
  workflowRoot = join(tmpdir(), `board-int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  await mkdir(workflowRoot, { recursive: true });

  eventBus = new DashboardEventBus();
  stateManager = new StateManager(workflowRoot, eventBus);

  app = new Hono();
  app.route('/', createBoardRoutes(stateManager));
  app.route('/', createPhaseRoutes(stateManager));
});

afterEach(async () => {
  eventBus.removeAllListeners();
  await rm(workflowRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeStateJson(state: Partial<ProjectState>): Promise<void> {
  const full: ProjectState = {
    version: '1.0',
    project_name: 'test-project',
    current_milestone: 'M1',
    current_phase: 1,
    status: 'executing',
    phases_summary: { total: 2, completed: 0, in_progress: 1, pending: 1 },
    last_updated: new Date().toISOString(),
    accumulated_context: { key_decisions: [], blockers: [], deferred: [] },
    ...state,
  };
  await writeFile(join(workflowRoot, 'state.json'), JSON.stringify(full), 'utf-8');
}

async function writePhase(slug: string, phase: PhaseCard): Promise<void> {
  const phaseDir = join(workflowRoot, 'phases', slug);
  await mkdir(phaseDir, { recursive: true });
  await writeFile(join(phaseDir, 'index.json'), JSON.stringify(phase), 'utf-8');
}

async function writeTask(slug: string, taskFile: string, task: Record<string, unknown>): Promise<void> {
  const taskDir = join(workflowRoot, 'phases', slug, '.task');
  await mkdir(taskDir, { recursive: true });
  await writeFile(join(taskDir, taskFile), JSON.stringify(task), 'utf-8');
}

// ---------------------------------------------------------------------------
// Board + StateManager + EventBus integration
// ---------------------------------------------------------------------------

describe('Board routes + StateManager + EventBus integration', () => {
  it('GET /api/board returns empty board before buildInitialState', async () => {
    const res = await app.request('/api/board');
    expect(res.status).toBe(200);
    const body = (await res.json()) as BoardState;
    expect(body.phases).toEqual([]);
    expect(body.scratch).toEqual([]);
    expect(body.project.project_name).toBe('');
  });

  it('GET /api/board returns populated state after buildInitialState', async () => {
    await writeStateJson({ project_name: 'my-project', current_phase: 1 });
    await writePhase('01-setup', {
      phase: 1,
      title: 'Setup',
      status: 'executing',
      success_criteria: 'Project initialized',
    } as unknown as PhaseCard);

    await stateManager.buildInitialState();

    const res = await app.request('/api/board');
    expect(res.status).toBe(200);
    const body = (await res.json()) as BoardState;
    expect(body.project.project_name).toBe('my-project');
    expect(body.phases).toHaveLength(1);
    expect(body.phases[0].title).toBe('Setup');
  });

  it('buildInitialState emits board:full event via EventBus', async () => {
    await writeStateJson({});

    const events: SSEEvent[] = [];
    eventBus.on('board:full', (e) => events.push(e));

    await stateManager.buildInitialState();

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('board:full');
    expect(events[0].data).toBeDefined();
  });

  it('GET /api/project returns project state after buildInitialState', async () => {
    await writeStateJson({ project_name: 'proj-abc', status: 'planning' });
    await stateManager.buildInitialState();

    const res = await app.request('/api/project');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ProjectState;
    expect(body.project_name).toBe('proj-abc');
    expect(body.status).toBe('planning');
  });

  it('multiple phases are sorted by phase number', async () => {
    await writeStateJson({});
    await writePhase('03-verify', { phase: 3, title: 'Verify', status: 'pending' } as PhaseCard);
    await writePhase('01-setup', { phase: 1, title: 'Setup', status: 'completed' } as PhaseCard);
    await writePhase('02-build', { phase: 2, title: 'Build', status: 'executing' } as PhaseCard);

    await stateManager.buildInitialState();

    const res = await app.request('/api/board');
    const body = (await res.json()) as BoardState;
    expect(body.phases).toHaveLength(3);
    expect(body.phases[0].phase).toBe(1);
    expect(body.phases[1].phase).toBe(2);
    expect(body.phases[2].phase).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Phase routes + StateManager integration
// ---------------------------------------------------------------------------

describe('Phase routes + StateManager integration', () => {
  it('GET /api/phases returns all phases from StateManager', async () => {
    await writeStateJson({});
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'completed' } as PhaseCard);
    await writePhase('02-impl', { phase: 2, title: 'Implement', status: 'executing' } as PhaseCard);
    await stateManager.buildInitialState();

    const res = await app.request('/api/phases');
    expect(res.status).toBe(200);
    const body = (await res.json()) as PhaseCard[];
    expect(body).toHaveLength(2);
    expect(body[0].title).toBe('Init');
    expect(body[1].title).toBe('Implement');
  });

  it('GET /api/phases/:n returns specific phase', async () => {
    await writeStateJson({});
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'completed' } as PhaseCard);
    await stateManager.buildInitialState();

    const res = await app.request('/api/phases/1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as PhaseCard;
    expect(body.phase).toBe(1);
    expect(body.title).toBe('Init');
  });

  it('GET /api/phases/:n returns 404 for non-existent phase', async () => {
    await writeStateJson({});
    await stateManager.buildInitialState();

    const res = await app.request('/api/phases/99');
    expect(res.status).toBe(404);
  });

  it('GET /api/phases/:n returns 400 for invalid phase number', async () => {
    const res = await app.request('/api/phases/abc');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Invalid');
  });

  it('GET /api/phases/:n/tasks returns tasks for a phase', async () => {
    await writeStateJson({});
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'executing' } as PhaseCard);
    await writeTask('01-init', 'TASK-001.json', {
      id: 'TASK-001',
      title: 'Setup project',
      status: 'completed',
    });
    await writeTask('01-init', 'TASK-002.json', {
      id: 'TASK-002',
      title: 'Configure CI',
      status: 'pending',
    });
    await stateManager.buildInitialState();

    const res = await app.request('/api/phases/1/tasks');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body).toHaveLength(2);
    const ids = body.map((t) => t.id).sort();
    expect(ids).toEqual(['TASK-001', 'TASK-002']);
  });
});

// ---------------------------------------------------------------------------
// StateManager.applyFileChange + EventBus integration
// ---------------------------------------------------------------------------

describe('StateManager.applyFileChange + EventBus integration', () => {
  it('applyFileChange on state.json emits project:updated', async () => {
    await writeStateJson({ project_name: 'initial' });
    await stateManager.buildInitialState();

    const events: SSEEvent[] = [];
    eventBus.on('project:updated', (e) => events.push(e));

    // Update state.json on disk
    await writeStateJson({ project_name: 'updated-project', status: 'verifying' });
    await stateManager.applyFileChange(join(workflowRoot, 'state.json'));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('project:updated');

    // Board route should reflect the update
    const res = await app.request('/api/project');
    const body = (await res.json()) as ProjectState;
    expect(body.project_name).toBe('updated-project');
    expect(body.status).toBe('verifying');
  });

  it('applyFileChange on phase index.json emits phase:updated', async () => {
    await writeStateJson({});
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'pending' } as PhaseCard);
    await stateManager.buildInitialState();

    const events: SSEEvent[] = [];
    eventBus.on('phase:updated', (e) => events.push(e));

    // Update phase on disk
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'executing' } as PhaseCard);
    await stateManager.applyFileChange(join(workflowRoot, 'phases', '01-init', 'index.json'));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('phase:updated');

    // Board should reflect the updated status
    const res = await app.request('/api/phases/1');
    const body = (await res.json()) as PhaseCard;
    expect(body.status).toBe('executing');
  });

  it('applyFileChange on task file emits task:updated', async () => {
    await writeStateJson({});
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'executing' } as PhaseCard);
    await writeTask('01-init', 'TASK-001.json', { id: 'TASK-001', title: 'Setup', status: 'pending' });
    await stateManager.buildInitialState();

    const events: SSEEvent[] = [];
    eventBus.on('task:updated', (e) => events.push(e));

    await writeTask('01-init', 'TASK-001.json', { id: 'TASK-001', title: 'Setup', status: 'completed' });
    await stateManager.applyFileChange(
      join(workflowRoot, 'phases', '01-init', '.task', 'TASK-001.json'),
    );

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('task:updated');
  });

  it('new phase added via applyFileChange appears in board', async () => {
    await writeStateJson({});
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'completed' } as PhaseCard);
    await stateManager.buildInitialState();

    // Add a new phase
    await writePhase('02-build', { phase: 2, title: 'Build', status: 'pending' } as PhaseCard);
    await stateManager.applyFileChange(join(workflowRoot, 'phases', '02-build', 'index.json'));

    const res = await app.request('/api/board');
    const body = (await res.json()) as BoardState;
    expect(body.phases).toHaveLength(2);
    expect(body.phases[1].phase).toBe(2);
    expect(body.phases[1].title).toBe('Build');
  });
});
