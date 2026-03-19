import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { StateManager } from '../../server/state/state-manager.js';
import { DashboardEventBus } from '../../server/state/event-bus.js';
import { SSEHub } from '../../server/sse/sse-hub.js';
import { createBoardRoutes } from '../../server/routes/board.js';
import { createPhaseRoutes } from '../../server/routes/phases.js';
import type { BoardState, PhaseCard, ProjectState, ScratchCard, SSEEvent } from '../../shared/types.js';
import { Hono } from 'hono';

// ---------------------------------------------------------------------------
// L3 E2E: Board + EventBus + SSEHub event flow
//
// Tests cross-cutting concerns: EventBus routing, SSEHub lifecycle,
// StateManager cache consistency, and multi-component event propagation
// ---------------------------------------------------------------------------

let workflowRoot: string;
let eventBus: DashboardEventBus;
let stateManager: StateManager;
let sseHub: SSEHub;
let app: Hono;

beforeEach(async () => {
  workflowRoot = join(tmpdir(), `e2e-board-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  await mkdir(workflowRoot, { recursive: true });

  eventBus = new DashboardEventBus();
  stateManager = new StateManager(workflowRoot, eventBus);
  sseHub = new SSEHub(eventBus, { maxConnections: 10, heartbeatMs: 60_000 });

  app = new Hono();
  app.route('/', createBoardRoutes(stateManager));
  app.route('/', createPhaseRoutes(stateManager));
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
    project_name: 'board-flow-test',
    current_milestone: 'M1',
    current_phase: 1,
    status: 'executing',
    phases_summary: { total: 1, completed: 0, in_progress: 1, pending: 0 },
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
// E2E: EventBus -> SSEHub event type routing
// ---------------------------------------------------------------------------

describe('E2E: EventBus event routing to SSEHub', () => {
  it('EventBus emits typed events that SSEHub broadcasts as formatted SSE messages', () => {
    const messages: string[] = [];
    sseHub.addClient((chunk) => messages.push(chunk), () => {});

    // Emit various event types
    eventBus.emit('project:updated', {
      version: '1.0',
      project_name: 'typed-test',
      current_milestone: 'M1',
      current_phase: 1,
      status: 'executing',
      phases_summary: { total: 1, completed: 0, in_progress: 1, pending: 0 },
      last_updated: new Date().toISOString(),
      accumulated_context: { key_decisions: [], blockers: [], deferred: [] },
    });

    eventBus.emit('phase:updated', {
      phase: 1,
      title: 'Phase 1',
      status: 'executing',
    } as PhaseCard);

    eventBus.emit('task:updated', {
      id: 'TASK-001',
      title: 'Task 1',
      status: 'completed',
    } as any);

    // Each event should be formatted as SSE: "event: <type>\ndata: <json>\n\n"
    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatch(/^event: project:updated\ndata: .+\n\n$/);
    expect(messages[1]).toMatch(/^event: phase:updated\ndata: .+\n\n$/);
    expect(messages[2]).toMatch(/^event: task:updated\ndata: .+\n\n$/);
  });

  it('SSEHub destroy stops event forwarding', () => {
    const messages: string[] = [];
    sseHub.addClient((chunk) => messages.push(chunk), () => {});

    // Emit before destroy
    eventBus.emit('heartbeat', null);
    expect(messages).toHaveLength(1);

    // Destroy hub
    sseHub.destroy();
    expect(sseHub.getClientCount()).toBe(0);

    // Emit after destroy — should NOT reach any client
    const preCount = messages.length;
    eventBus.emit('heartbeat', null);
    expect(messages.length).toBe(preCount);
  });

  it('multiple SSEHub instances receive events independently', () => {
    const hub2 = new SSEHub(eventBus, { maxConnections: 5, heartbeatMs: 60_000 });

    const messages1: string[] = [];
    const messages2: string[] = [];
    sseHub.addClient((chunk) => messages1.push(chunk), () => {});
    hub2.addClient((chunk) => messages2.push(chunk), () => {});

    eventBus.emit('heartbeat', null);

    expect(messages1).toHaveLength(1);
    expect(messages2).toHaveLength(1);

    hub2.destroy();
  });
});

// ---------------------------------------------------------------------------
// E2E: StateManager cache consistency under rapid updates
// ---------------------------------------------------------------------------

describe('E2E: StateManager cache consistency', () => {
  it('rapid phase updates maintain correct board state', async () => {
    await writeStateJson({});

    // Create initial phases
    for (let i = 1; i <= 5; i++) {
      await writePhase(`0${i}-phase`, {
        phase: i,
        title: `Phase ${i}`,
        status: 'pending',
      } as PhaseCard);
    }

    await stateManager.buildInitialState();

    // Rapidly update phases through different statuses
    const statuses = ['exploring', 'planning', 'executing', 'verifying', 'completed'] as const;

    for (let i = 1; i <= 5; i++) {
      await writePhase(`0${i}-phase`, {
        phase: i,
        title: `Phase ${i}`,
        status: statuses[i - 1],
      } as PhaseCard);
      await stateManager.applyFileChange(
        join(workflowRoot, 'phases', `0${i}-phase`, 'index.json'),
      );
    }

    // Verify all phases have correct states
    const res = await app.request('/api/board');
    const board = (await res.json()) as BoardState;
    expect(board.phases).toHaveLength(5);
    expect(board.phases[0].status).toBe('exploring');
    expect(board.phases[1].status).toBe('planning');
    expect(board.phases[2].status).toBe('executing');
    expect(board.phases[3].status).toBe('verifying');
    expect(board.phases[4].status).toBe('completed');
  });

  it('adding a new phase via applyFileChange inserts in sorted order', async () => {
    await writeStateJson({});
    await writePhase('01-first', { phase: 1, title: 'First', status: 'completed' } as PhaseCard);
    await writePhase('03-third', { phase: 3, title: 'Third', status: 'pending' } as PhaseCard);
    await stateManager.buildInitialState();

    // Insert phase 2 between 1 and 3
    await writePhase('02-second', { phase: 2, title: 'Second', status: 'executing' } as PhaseCard);
    await stateManager.applyFileChange(join(workflowRoot, 'phases', '02-second', 'index.json'));

    const res = await app.request('/api/board');
    const board = (await res.json()) as BoardState;
    expect(board.phases).toHaveLength(3);
    expect(board.phases[0].phase).toBe(1);
    expect(board.phases[1].phase).toBe(2);
    expect(board.phases[1].title).toBe('Second');
    expect(board.phases[2].phase).toBe(3);
  });

  it('scratch tasks are tracked independently from phases', async () => {
    await writeStateJson({});
    await writePhase('01-init', { phase: 1, title: 'Init', status: 'executing' } as PhaseCard);
    await writeScratch('hotfix-1', { id: 'hotfix-1', title: 'Hotfix 1', status: 'pending' });
    await writeScratch('hotfix-2', { id: 'hotfix-2', title: 'Hotfix 2', status: 'executing' });
    await stateManager.buildInitialState();

    const res = await app.request('/api/board');
    const board = (await res.json()) as BoardState;
    expect(board.phases).toHaveLength(1);
    expect(board.scratch).toHaveLength(2);

    // Update scratch via applyFileChange
    await writeScratch('hotfix-1', { id: 'hotfix-1', title: 'Hotfix 1', status: 'completed' });
    await stateManager.applyFileChange(join(workflowRoot, 'scratch', 'hotfix-1', 'index.json'));

    const res2 = await app.request('/api/board');
    const board2 = (await res2.json()) as BoardState;
    expect(board2.scratch).toHaveLength(2);
    const hotfix1 = board2.scratch.find((s) => s.id === 'hotfix-1');
    expect((hotfix1 as any)?.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// E2E: EventBus listener lifecycle
// ---------------------------------------------------------------------------

describe('E2E: EventBus listener management', () => {
  it('on/off correctly manages listeners for specific events', () => {
    const events: SSEEvent[] = [];
    const listener = (event: SSEEvent) => events.push(event);

    eventBus.on('phase:updated', listener);

    eventBus.emit('phase:updated', { phase: 1, title: 'P1', status: 'executing' } as PhaseCard);
    expect(events).toHaveLength(1);

    eventBus.off('phase:updated', listener);

    eventBus.emit('phase:updated', { phase: 1, title: 'P1', status: 'completed' } as PhaseCard);
    expect(events).toHaveLength(1); // No new event after off
  });

  it('onAny/offAny subscribes to all event types', () => {
    const events: SSEEvent[] = [];
    const listener = (event: SSEEvent) => events.push(event);

    eventBus.onAny(listener);

    eventBus.emit('phase:updated', { phase: 1, title: 'P1', status: 'executing' } as PhaseCard);
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
    eventBus.emit('heartbeat', null);

    expect(events).toHaveLength(3);

    eventBus.offAny(listener);

    eventBus.emit('heartbeat', null);
    expect(events).toHaveLength(3); // No new events
  });

  it('removeAllListeners cleans up everything', () => {
    const events: SSEEvent[] = [];

    eventBus.on('phase:updated', (e) => events.push(e));
    eventBus.on('project:updated', (e) => events.push(e));

    eventBus.removeAllListeners();

    eventBus.emit('phase:updated', { phase: 1, title: 'P1', status: 'executing' } as PhaseCard);
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

    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// E2E: Board state with missing/empty directories
// ---------------------------------------------------------------------------

describe('E2E: Board resilience with missing directories', () => {
  it('buildInitialState handles missing phases directory gracefully', async () => {
    await writeStateJson({ project_name: 'no-phases' });
    // No phases dir created

    const board = await stateManager.buildInitialState();
    expect(board.phases).toHaveLength(0);
    expect(board.project.project_name).toBe('no-phases');

    const res = await app.request('/api/board');
    expect(res.status).toBe(200);
  });

  it('buildInitialState handles missing state.json gracefully', async () => {
    // No state.json written, just empty workflowRoot
    const board = await stateManager.buildInitialState();
    expect(board.project.project_name).toBe('');
    expect(board.project.status).toBe('idle');
  });

  it('applyFileChange on non-matching path is a no-op', async () => {
    await writeStateJson({});
    await stateManager.buildInitialState();

    const messages: string[] = [];
    sseHub.addClient((chunk) => messages.push(chunk), () => {});

    // Apply change for a path that doesn't match any pattern
    await stateManager.applyFileChange(join(workflowRoot, 'random', 'file.txt'));

    expect(messages).toHaveLength(0);
  });

  it('getTasks for non-existent phase returns 404', async () => {
    await writeStateJson({});
    await stateManager.buildInitialState();

    const res = await app.request('/api/phases/99/tasks');
    expect(res.status).toBe(404);
  });
});
