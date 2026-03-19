import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { StateManager } from '../../server/state/state-manager.js';
import { DashboardEventBus } from '../../server/state/event-bus.js';
import { SSEHub } from '../../server/sse/sse-hub.js';
import { createBoardRoutes } from '../../server/routes/board.js';
import { createPhaseRoutes } from '../../server/routes/phases.js';
import { createEventsRoute } from '../../server/routes/events.js';
import type { BoardState, PhaseCard, ProjectState, SSEEvent } from '../../shared/types.js';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// L3 E2E: SSE State Sync — Full pipeline from filesystem to SSE client
//
// Flow: filesystem write -> StateManager.buildInitialState/applyFileChange
//       -> EventBus emit -> SSEHub broadcast -> SSE client receives event
// ---------------------------------------------------------------------------

let workflowRoot: string;
let eventBus: DashboardEventBus;
let stateManager: StateManager;
let sseHub: SSEHub;
let app: Hono;

beforeEach(async () => {
  workflowRoot = join(tmpdir(), `e2e-sse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  await mkdir(workflowRoot, { recursive: true });

  eventBus = new DashboardEventBus();
  stateManager = new StateManager(workflowRoot, eventBus);
  sseHub = new SSEHub(eventBus, { maxConnections: 5, heartbeatMs: 60_000 });

  app = new Hono();
  app.route('/', createBoardRoutes(stateManager));
  app.route('/', createPhaseRoutes(stateManager));
  app.route('/', createEventsRoute(stateManager, eventBus, sseHub));
});

afterEach(async () => {
  sseHub.destroy();
  eventBus.removeAllListeners();
  await rm(workflowRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeStateJson(state: Partial<ProjectState>): Promise<void> {
  const full: ProjectState = {
    version: '1.0',
    project_name: 'e2e-project',
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

async function writeScratch(slug: string, card: Record<string, unknown>): Promise<void> {
  const scratchDir = join(workflowRoot, 'scratch', slug);
  await mkdir(scratchDir, { recursive: true });
  await writeFile(join(scratchDir, 'index.json'), JSON.stringify(card), 'utf-8');
}

// ---------------------------------------------------------------------------
// E2E: Full SSE pipeline — buildInitialState -> EventBus -> SSEHub -> clients
// ---------------------------------------------------------------------------

describe('E2E: SSE state sync pipeline', () => {
  it('buildInitialState broadcasts board:full to all SSE clients', async () => {
    await writeStateJson({ project_name: 'sse-test' });
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'executing' } as PhaseCard);

    // Register SSE clients
    const client1Messages: string[] = [];
    const client2Messages: string[] = [];
    sseHub.addClient((chunk) => client1Messages.push(chunk), () => {});
    sseHub.addClient((chunk) => client2Messages.push(chunk), () => {});

    expect(sseHub.getClientCount()).toBe(2);

    // Build state triggers board:full event -> EventBus -> SSEHub -> clients
    await stateManager.buildInitialState();

    // Both clients should receive board:full event
    expect(client1Messages.length).toBeGreaterThanOrEqual(1);
    expect(client2Messages.length).toBeGreaterThanOrEqual(1);

    const boardEvent1 = client1Messages.find((m) => m.includes('board:full'));
    expect(boardEvent1).toBeDefined();
    expect(boardEvent1).toContain('"sse-test"');

    const boardEvent2 = client2Messages.find((m) => m.includes('board:full'));
    expect(boardEvent2).toBeDefined();
  });

  it('applyFileChange on state.json broadcasts project:updated to SSE clients', async () => {
    await writeStateJson({ project_name: 'initial' });
    await stateManager.buildInitialState();

    const messages: string[] = [];
    sseHub.addClient((chunk) => messages.push(chunk), () => {});

    // Update state.json on disk and apply change
    await writeStateJson({ project_name: 'updated-via-sse', status: 'verifying' });
    await stateManager.applyFileChange(join(workflowRoot, 'state.json'));

    const projectEvent = messages.find((m) => m.includes('project:updated'));
    expect(projectEvent).toBeDefined();
    expect(projectEvent).toContain('updated-via-sse');

    // Board route should also reflect the update
    const res = await app.request('/api/project');
    const body = (await res.json()) as ProjectState;
    expect(body.project_name).toBe('updated-via-sse');
    expect(body.status).toBe('verifying');
  });

  it('applyFileChange on phase index.json broadcasts phase:updated to SSE clients', async () => {
    await writeStateJson({});
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'pending' } as PhaseCard);
    await stateManager.buildInitialState();

    const messages: string[] = [];
    sseHub.addClient((chunk) => messages.push(chunk), () => {});

    // Update phase on disk
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'executing' } as PhaseCard);
    await stateManager.applyFileChange(join(workflowRoot, 'phases', '01-init', 'index.json'));

    const phaseEvent = messages.find((m) => m.includes('phase:updated'));
    expect(phaseEvent).toBeDefined();
    expect(phaseEvent).toContain('"executing"');

    // Phase route should also reflect update
    const res = await app.request('/api/phases/1');
    const body = (await res.json()) as PhaseCard;
    expect(body.status).toBe('executing');
  });

  it('applyFileChange on task file broadcasts task:updated to SSE clients', async () => {
    await writeStateJson({});
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'executing' } as PhaseCard);
    await writeTask('01-init', 'TASK-001.json', { id: 'TASK-001', title: 'Setup', status: 'pending' });
    await stateManager.buildInitialState();

    const messages: string[] = [];
    sseHub.addClient((chunk) => messages.push(chunk), () => {});

    // Update task on disk
    await writeTask('01-init', 'TASK-001.json', { id: 'TASK-001', title: 'Setup', status: 'completed' });
    await stateManager.applyFileChange(
      join(workflowRoot, 'phases', '01-init', '.task', 'TASK-001.json'),
    );

    const taskEvent = messages.find((m) => m.includes('task:updated'));
    expect(taskEvent).toBeDefined();
    expect(taskEvent).toContain('TASK-001');
  });

  it('applyFileChange on scratch index.json broadcasts scratch:updated to SSE clients', async () => {
    await writeStateJson({});
    await stateManager.buildInitialState();

    const messages: string[] = [];
    sseHub.addClient((chunk) => messages.push(chunk), () => {});

    await writeScratch('quick-fix', { id: 'quick-fix', title: 'Quick Fix', status: 'pending' });
    await stateManager.applyFileChange(
      join(workflowRoot, 'scratch', 'quick-fix', 'index.json'),
    );

    const scratchEvent = messages.find((m) => m.includes('scratch:updated'));
    expect(scratchEvent).toBeDefined();
    expect(scratchEvent).toContain('quick-fix');
  });

  it('failed SSE client write causes automatic cleanup', async () => {
    await writeStateJson({});
    await stateManager.buildInitialState();

    const goodMessages: string[] = [];
    sseHub.addClient((chunk) => goodMessages.push(chunk), () => {});
    sseHub.addClient(
      () => { throw new Error('broken client'); },
      () => {},
    );

    expect(sseHub.getClientCount()).toBe(2);

    // Emit an event — broken client should be cleaned up
    eventBus.emit('project:updated', {
      version: '1.0',
      project_name: 'test',
      current_milestone: '',
      current_phase: 0,
      status: 'idle',
      phases_summary: { total: 0, completed: 0, in_progress: 0, pending: 0 },
      last_updated: new Date().toISOString(),
      accumulated_context: { key_decisions: [], blockers: [], deferred: [] },
    });

    expect(sseHub.getClientCount()).toBe(1);
    expect(goodMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('SSEHub respects maxConnections limit', () => {
    // Hub configured with maxConnections: 5
    for (let i = 0; i < 5; i++) {
      const id = sseHub.addClient(() => {}, () => {});
      expect(id).not.toBeNull();
    }

    // 6th client should be rejected
    const rejectedId = sseHub.addClient(() => {}, () => {});
    expect(rejectedId).toBeNull();
    expect(sseHub.getClientCount()).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// E2E: Multi-phase board refresh scenario
// ---------------------------------------------------------------------------

describe('E2E: Multi-phase board state lifecycle', () => {
  it('full lifecycle: empty board -> add phases -> update state -> verify SSE events', async () => {
    const allMessages: string[] = [];
    sseHub.addClient((chunk) => allMessages.push(chunk), () => {});

    // Step 1: Start with empty board
    let res = await app.request('/api/board');
    let board = (await res.json()) as BoardState;
    expect(board.phases).toHaveLength(0);

    // Step 2: Write initial state + phases to filesystem
    await writeStateJson({ project_name: 'lifecycle-test', current_phase: 1, status: 'executing' });
    await writePhase('01-setup', { phase: 1, title: 'Setup', status: 'completed' } as PhaseCard);
    await writePhase('02-build', { phase: 2, title: 'Build', status: 'executing' } as PhaseCard);
    await writePhase('03-verify', { phase: 3, title: 'Verify', status: 'pending' } as PhaseCard);

    // Step 3: Build initial state (triggers board:full SSE event)
    await stateManager.buildInitialState();

    // Step 4: Verify board is populated
    res = await app.request('/api/board');
    board = (await res.json()) as BoardState;
    expect(board.project.project_name).toBe('lifecycle-test');
    expect(board.phases).toHaveLength(3);
    expect(board.phases[0].status).toBe('completed');
    expect(board.phases[1].status).toBe('executing');
    expect(board.phases[2].status).toBe('pending');

    // Step 5: Simulate phase transition via file change
    await writePhase('02-build', { phase: 2, title: 'Build', status: 'completed' } as PhaseCard);
    await stateManager.applyFileChange(join(workflowRoot, 'phases', '02-build', 'index.json'));

    await writePhase('03-verify', { phase: 3, title: 'Verify', status: 'executing' } as PhaseCard);
    await stateManager.applyFileChange(join(workflowRoot, 'phases', '03-verify', 'index.json'));

    await writeStateJson({ project_name: 'lifecycle-test', current_phase: 3, status: 'verifying' });
    await stateManager.applyFileChange(join(workflowRoot, 'state.json'));

    // Step 6: Verify final board state
    res = await app.request('/api/board');
    board = (await res.json()) as BoardState;
    expect(board.project.current_phase).toBe(3);
    expect(board.project.status).toBe('verifying');
    expect(board.phases[1].status).toBe('completed');
    expect(board.phases[2].status).toBe('executing');

    // Step 7: Verify SSE events were delivered
    const boardFullEvents = allMessages.filter((m) => m.includes('board:full'));
    const phaseUpdatedEvents = allMessages.filter((m) => m.includes('phase:updated'));
    const projectUpdatedEvents = allMessages.filter((m) => m.includes('project:updated'));

    expect(boardFullEvents.length).toBeGreaterThanOrEqual(1);
    expect(phaseUpdatedEvents.length).toBeGreaterThanOrEqual(2);
    expect(projectUpdatedEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('tasks are readable after phase setup and file changes', async () => {
    await writeStateJson({});
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'executing' } as PhaseCard);
    await writeTask('01-init', 'TASK-001.json', { id: 'TASK-001', title: 'Task A', status: 'pending' });
    await writeTask('01-init', 'TASK-002.json', { id: 'TASK-002', title: 'Task B', status: 'pending' });
    await stateManager.buildInitialState();

    // Verify tasks via phase route
    let res = await app.request('/api/phases/1/tasks');
    let tasks = (await res.json()) as Array<{ id: string; status: string }>;
    expect(tasks).toHaveLength(2);

    // Update a task and verify via SSE + route
    const messages: string[] = [];
    sseHub.addClient((chunk) => messages.push(chunk), () => {});

    await writeTask('01-init', 'TASK-001.json', { id: 'TASK-001', title: 'Task A', status: 'completed' });
    await stateManager.applyFileChange(
      join(workflowRoot, 'phases', '01-init', '.task', 'TASK-001.json'),
    );

    // SSE event for task update
    const taskEvent = messages.find((m) => m.includes('task:updated'));
    expect(taskEvent).toBeDefined();

    // Re-read tasks — should still return 2 tasks (one completed, one pending)
    res = await app.request('/api/phases/1/tasks');
    tasks = (await res.json()) as Array<{ id: string; status: string }>;
    expect(tasks).toHaveLength(2);
    const completedTask = tasks.find((t) => t.id === 'TASK-001');
    expect(completedTask?.status).toBe('completed');
  });
});
