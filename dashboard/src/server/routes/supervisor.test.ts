import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createSupervisorRoutes } from './supervisor.js';
import type { ScheduledTask, ScheduledTaskType, TaskRunHistory } from '../../shared/schedule-types.js';
import type { CommandPattern, KnowledgeEntry, LearningStats } from '../../shared/learning-types.js';
import type { ExtensionInfo } from '../../shared/extension-types.js';

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

class MockLearningService {
  private stats: LearningStats = {
    totalCommands: 5,
    uniquePatterns: 2,
    topPatterns: [
      { command: 'gemini', frequency: 3, successRate: 0.9, avgDuration: 5000, lastUsed: '2026-01-01T00:00:00Z', contexts: ['a'] },
      { command: 'codex', frequency: 2, successRate: 1.0, avgDuration: 3000, lastUsed: '2026-01-01T01:00:00Z', contexts: ['b'] },
    ],
    suggestions: [],
    knowledgeBaseSize: 1,
  };
  private patterns: CommandPattern[] = this.stats.topPatterns;
  private kb: KnowledgeEntry[] = [
    { id: 'kb-1', topic: 'Testing', content: 'Use vitest', source: 'manual', usageCount: 0, lastAccessed: '2026-01-01T00:00:00Z', tags: ['test'] },
  ];

  getStats(): LearningStats { return this.stats; }
  getPatterns(): CommandPattern[] { return this.patterns; }
  getKnowledgeBase(): KnowledgeEntry[] { return this.kb; }
}

class MockSchedulerService {
  private tasks: Map<string, ScheduledTask> = new Map();
  private nextId = 1;

  listTasks(): ScheduledTask[] { return Array.from(this.tasks.values()); }

  async createTask(input: Omit<ScheduledTask, 'id' | 'lastRun' | 'nextRun' | 'history'>): Promise<ScheduledTask> {
    const task: ScheduledTask = {
      ...input,
      id: `task-${this.nextId++}`,
      lastRun: null,
      nextRun: null,
      history: [],
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async updateTask(id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask> {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Scheduled task not found: ${id}`);
    Object.assign(task, updates);
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.tasks.has(id)) throw new Error(`Scheduled task not found: ${id}`);
    this.tasks.delete(id);
  }

  async runTask(id: string): Promise<TaskRunHistory> {
    if (!this.tasks.has(id)) throw new Error(`Scheduled task not found: ${id}`);
    return { timestamp: new Date().toISOString(), status: 'success', duration: 100, result: 'ok' };
  }
}

class MockExtensionManager {
  listExtensions(): ExtensionInfo[] {
    return [
      { name: 'standard', version: '1.0.0', type: 'builder', description: 'builder: standard', status: 'enabled' },
      { name: 'claude-code', version: '1.0.0', type: 'adapter', description: 'adapter: claude-code', status: 'enabled' },
    ];
  }
}

class MockPromptRegistry {
  private builders = new Map<string, { build: (ctx: any) => Promise<string> }>([
    ['standard', { build: async (ctx: any) => `Rendered: ${JSON.stringify(ctx)}` }],
  ]);

  list(): string[] { return Array.from(this.builders.keys()); }
  get(name: string) { return this.builders.get(name); }
}

// ---------------------------------------------------------------------------
// Helper to make requests to Hono app
// ---------------------------------------------------------------------------
function createApp() {
  const learning = new MockLearningService();
  const scheduler = new MockSchedulerService();
  const extensions = new MockExtensionManager();
  const prompts = new MockPromptRegistry();

  const routes = createSupervisorRoutes(
    learning as any,
    scheduler as any,
    extensions as any,
    prompts as any,
  );

  return { app: routes, learning, scheduler, extensions, prompts };
}

function req(app: Hono, method: string, path: string, body?: unknown) {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Supervisor REST Routes', () => {
  // -------------------------------------------------------------------------
  // Prompt endpoints
  // -------------------------------------------------------------------------
  describe('GET /api/supervisor/prompts', () => {
    it('returns list of registered builders', async () => {
      const { app } = createApp();
      const res = await req(app, 'GET', '/api/supervisor/prompts');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.builders).toEqual(['standard']);
    });
  });

  describe('PUT /api/supervisor/prompts/config', () => {
    it('accepts valid bindings object', async () => {
      const { app } = createApp();
      const res = await req(app, 'PUT', '/api/supervisor/prompts/config', {
        bindings: { 'deep-analysis': 'standard' },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('rejects missing bindings', async () => {
      const { app } = createApp();
      const res = await req(app, 'PUT', '/api/supervisor/prompts/config', {});
      expect(res.status).toBe(400);
    });

    it('rejects non-object bindings', async () => {
      const { app } = createApp();
      const res = await req(app, 'PUT', '/api/supervisor/prompts/config', { bindings: 'string' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/supervisor/prompts/preview', () => {
    it('renders template with provided context', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/prompts/preview', {
        builder: 'standard',
        context: { mode: 'test' },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.preview).toContain('test');
    });

    it('returns 404 for unknown builder', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/prompts/preview', {
        builder: 'nonexistent',
        context: {},
      });
      expect(res.status).toBe(404);
    });

    it('rejects missing builder field', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/prompts/preview', { context: {} });
      expect(res.status).toBe(400);
    });

    it('rejects missing context field', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/prompts/preview', { builder: 'standard' });
      expect(res.status).toBe(400);
    });

    it('rejects array as context', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/prompts/preview', {
        builder: 'standard',
        context: [1, 2, 3],
      });
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Schedule endpoints
  // -------------------------------------------------------------------------
  describe('GET /api/supervisor/schedules', () => {
    it('returns empty task list initially', async () => {
      const { app } = createApp();
      const res = await req(app, 'GET', '/api/supervisor/schedules');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tasks).toEqual([]);
    });
  });

  describe('POST /api/supervisor/schedules', () => {
    it('creates a new schedule', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/schedules', {
        name: 'Test',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: true,
        config: { foo: 'bar' },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.task.name).toBe('Test');
      expect(data.task.id).toBeTruthy();
    });

    it('rejects missing name', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/schedules', {
        cronExpression: '0 * * * *',
        taskType: 'custom',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('name');
    });

    it('rejects missing cronExpression', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/schedules', {
        name: 'Test',
        taskType: 'custom',
      });
      expect(res.status).toBe(400);
    });

    it('rejects missing taskType', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/schedules', {
        name: 'Test',
        cronExpression: '0 * * * *',
      });
      expect(res.status).toBe(400);
    });

    it('defaults enabled to true', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/schedules', {
        name: 'Default',
        cronExpression: '0 * * * *',
        taskType: 'custom',
      });
      const data = await res.json();
      expect(data.task.enabled).toBe(true);
    });

    it('defaults config to empty object', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/schedules', {
        name: 'No Config',
        cronExpression: '0 * * * *',
        taskType: 'custom',
      });
      const data = await res.json();
      expect(data.task.config).toEqual({});
    });
  });

  describe('PUT /api/supervisor/schedules/:id', () => {
    it('updates existing schedule', async () => {
      const { app, scheduler } = createApp();

      // Create a task first
      const created = await scheduler.createTask({
        name: 'Old',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      const res = await req(app, 'PUT', `/api/supervisor/schedules/${created.id}`, {
        name: 'New Name',
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.task.name).toBe('New Name');
    });

    it('returns 404 for nonexistent task', async () => {
      const { app } = createApp();
      const res = await req(app, 'PUT', '/api/supervisor/schedules/nonexistent', {
        name: 'X',
      });
      expect(res.status).toBe(404);
    });

    it('only passes known fields to service', async () => {
      const { app, scheduler } = createApp();
      const created = await scheduler.createTask({
        name: 'Fields',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      const res = await req(app, 'PUT', `/api/supervisor/schedules/${created.id}`, {
        name: 'Updated',
        unknownField: 'should-be-dropped',
        enabled: true,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.task.name).toBe('Updated');
      expect(data.task.enabled).toBe(true);
    });
  });

  describe('DELETE /api/supervisor/schedules/:id', () => {
    it('deletes existing schedule', async () => {
      const { app, scheduler } = createApp();
      const created = await scheduler.createTask({
        name: 'Delete Me',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      const res = await req(app, 'DELETE', `/api/supervisor/schedules/${created.id}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('returns 404 for nonexistent task', async () => {
      const { app } = createApp();
      const res = await req(app, 'DELETE', '/api/supervisor/schedules/fake');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/supervisor/schedules/:id/run', () => {
    it('runs existing schedule', async () => {
      const { app, scheduler } = createApp();
      const created = await scheduler.createTask({
        name: 'Runnable',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      const res = await req(app, 'POST', `/api/supervisor/schedules/${created.id}/run`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.result.status).toBe('success');
    });

    it('returns 404 for nonexistent task', async () => {
      const { app } = createApp();
      const res = await req(app, 'POST', '/api/supervisor/schedules/fake/run');
      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // Learning endpoints
  // -------------------------------------------------------------------------
  describe('GET /api/supervisor/learning/stats', () => {
    it('returns learning stats', async () => {
      const { app } = createApp();
      const res = await req(app, 'GET', '/api/supervisor/learning/stats');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.totalCommands).toBe(5);
      expect(data.uniquePatterns).toBe(2);
      expect(data.topPatterns).toHaveLength(2);
    });
  });

  describe('GET /api/supervisor/learning/patterns', () => {
    it('returns command patterns', async () => {
      const { app } = createApp();
      const res = await req(app, 'GET', '/api/supervisor/learning/patterns');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.patterns).toHaveLength(2);
      expect(data.patterns[0].command).toBe('gemini');
    });
  });

  describe('GET /api/supervisor/learning/kb', () => {
    it('returns knowledge base entries', async () => {
      const { app } = createApp();
      const res = await req(app, 'GET', '/api/supervisor/learning/kb');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.entries).toHaveLength(1);
      expect(data.entries[0].topic).toBe('Testing');
    });
  });

  // -------------------------------------------------------------------------
  // Extension endpoints
  // -------------------------------------------------------------------------
  describe('GET /api/supervisor/extensions', () => {
    it('returns registered extensions', async () => {
      const { app } = createApp();
      const res = await req(app, 'GET', '/api/supervisor/extensions');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.extensions).toHaveLength(2);
      expect(data.extensions[0].name).toBe('standard');
      expect(data.extensions[1].name).toBe('claude-code');
    });
  });
});
