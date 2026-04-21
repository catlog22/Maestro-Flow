import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { schema, handler } from '../team-tasks-mcp.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let prevRoot: string | undefined;

function setup(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'team-tasks-mcp-test-'));
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
// Schema tests
// ---------------------------------------------------------------------------

describe('team-tasks-mcp schema', () => {
  it('exports correct tool name', () => {
    expect(schema.name).toBe('team_task');
  });

  it('has required fields in inputSchema', () => {
    const props = schema.inputSchema.properties as Record<string, unknown>;
    expect(props).toHaveProperty('operation');
    expect(props).toHaveProperty('session_id');
    expect(schema.inputSchema.required).toContain('operation');
    expect(schema.inputSchema.required).toContain('session_id');
  });
});

// ---------------------------------------------------------------------------
// Handler tests
// ---------------------------------------------------------------------------

describe('team-tasks-mcp handler', () => {
  beforeEach(setup);
  afterEach(teardown);

  // ---- create ----

  describe('create', () => {
    it('creates task with auto-generated ID and returns {id, title, status: open}', async () => {
      const result = await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Fix login bug',
        description: 'Login fails on mobile',
        owner: 'agent-1',
        priority: 'high',
      });

      expect(result.success).toBe(true);
      const data = result.result as Record<string, unknown>;
      expect(data.id).toBe('ATASK-001');
      expect(data.title).toBe('Fix login bug');
      expect(data.status).toBe('open');
      expect(data.priority).toBe('high');
      expect(data.owner).toBe('agent-1');
      expect(data.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('creates task with default owner and priority', async () => {
      const result = await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Simple task',
      });

      expect(result.success).toBe(true);
      const data = result.result as Record<string, unknown>;
      expect(data.owner).toBe('agent');
      expect(data.status).toBe('open');
    });

    it('increments task ID sequentially', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'First',
      });
      const result = await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Second',
      });

      const data = result.result as Record<string, unknown>;
      expect(data.id).toBe('ATASK-002');
    });

    it('scopes tasks by session_id', async () => {
      const r1 = await handler({
        operation: 'create',
        session_id: 'session-a',
        title: 'Task A',
      });
      const r2 = await handler({
        operation: 'create',
        session_id: 'session-b',
        title: 'Task B',
      });

      // Both start at ATASK-001 because different session namespaces
      const d1 = r1.result as Record<string, unknown>;
      const d2 = r2.result as Record<string, unknown>;
      expect(d1.id).toBe('ATASK-001');
      expect(d2.id).toBe('ATASK-001');
    });

    it('fails without title', async () => {
      const result = await handler({
        operation: 'create',
        session_id: 'test-session',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('title');
    });

    it('creates task file on disk', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Disk task',
      });

      const taskDir = join(
        tmpDir,
        '.workflow',
        '.team',
        'test-session',
        'tasks',
      );
      expect(existsSync(join(taskDir, 'ATASK-001.json'))).toBe(true);
      const onDisk = JSON.parse(
        readFileSync(join(taskDir, 'ATASK-001.json'), 'utf-8'),
      );
      expect(onDisk.title).toBe('Disk task');
    });
  });

  // ---- update ----

  describe('update', () => {
    it('enforces valid state transitions', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Test task',
        owner: 'agent-1',
      });

      // open -> assigned (valid)
      const r1 = await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'assigned',
      });
      expect(r1.success).toBe(true);
      expect((r1.result as Record<string, unknown>).status).toBe('assigned');

      // assigned -> in_progress (valid)
      const r2 = await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'in_progress',
      });
      expect(r2.success).toBe(true);
      expect((r2.result as Record<string, unknown>).status).toBe(
        'in_progress',
      );
    });

    it('rejects invalid status transitions', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Test task',
      });

      // open -> in_progress is invalid (must go through assigned)
      const result = await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'in_progress',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status transition');
      expect(result.error).toContain('open -> in_progress');
    });

    it('rejects completed -> pending (done -> open is invalid)', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Test task',
        owner: 'agent-1',
      });

      // open -> assigned -> in_progress -> pending_review -> done
      await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'assigned',
      });
      await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'in_progress',
      });
      await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'pending_review',
      });
      await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'done',
      });

      // done -> open is invalid (must go closed -> open to reopen)
      const result = await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'open',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status transition: done -> open');
    });

    it('updates description and owner', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Test task',
        owner: 'agent-1',
      });

      const result = await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        description: 'Updated description',
        owner: 'agent-2',
      });

      expect(result.success).toBe(true);
      const data = result.result as Record<string, unknown>;
      expect(data.assignee).toBe('agent-2');
    });

    it('returns 404 error for non-existent task_id', async () => {
      const result = await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-999',
        status: 'assigned',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task not found');
      expect(result.error).toContain('ATASK-999');
    });

    it('fails without task_id', async () => {
      const result = await handler({
        operation: 'update',
        session_id: 'test-session',
        status: 'assigned',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('task_id');
    });
  });

  // ---- list ----

  describe('list', () => {
    it('returns empty array when no tasks exist', async () => {
      const result = await handler({
        operation: 'list',
        session_id: 'test-session',
      });

      expect(result.success).toBe(true);
      const data = result.result as Record<string, unknown>;
      expect(data.total).toBe(0);
      expect(data.tasks).toEqual([]);
    });

    it('returns all tasks for a session', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'First',
      });
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Second',
      });

      const result = await handler({
        operation: 'list',
        session_id: 'test-session',
      });

      const data = result.result as Record<string, unknown>;
      expect(data.total).toBe(2);
      const tasks = data.tasks as Array<Record<string, unknown>>;
      expect(tasks[0].id).toBe('ATASK-001');
      expect(tasks[1].id).toBe('ATASK-002');
    });

    it('with status filter returns only matching tasks', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Open task',
      });
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'To assign',
      });

      // Assign the second task
      await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-002',
        status: 'assigned',
      });

      const result = await handler({
        operation: 'list',
        session_id: 'test-session',
        status: 'assigned',
      });

      const data = result.result as Record<string, unknown>;
      expect(data.total).toBe(1);
      const tasks = data.tasks as Array<Record<string, unknown>>;
      expect(tasks[0].id).toBe('ATASK-002');
      expect(tasks[0].status).toBe('assigned');
    });

    it('with owner filter returns tasks matching reporter or assignee', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Owned by alice',
        owner: 'alice',
      });
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Owned by bob',
        owner: 'bob',
      });

      const result = await handler({
        operation: 'list',
        session_id: 'test-session',
        owner: 'alice',
      });

      const data = result.result as Record<string, unknown>;
      expect(data.total).toBe(1);
      const tasks = data.tasks as Array<Record<string, unknown>>;
      expect(tasks[0].title).toBe('Owned by alice');
    });

    it('scopes list to session_id', async () => {
      await handler({
        operation: 'create',
        session_id: 'session-a',
        title: 'A task',
      });
      await handler({
        operation: 'create',
        session_id: 'session-b',
        title: 'B task',
      });

      const result = await handler({
        operation: 'list',
        session_id: 'session-a',
      });

      const data = result.result as Record<string, unknown>;
      expect(data.total).toBe(1);
      const tasks = data.tasks as Array<Record<string, unknown>>;
      expect(tasks[0].title).toBe('A task');
    });
  });

  // ---- get ----

  describe('get', () => {
    it('returns single task with full details', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Full detail task',
        description: 'Detailed description',
        owner: 'agent-1',
        priority: 'critical',
      });

      const result = await handler({
        operation: 'get',
        session_id: 'test-session',
        task_id: 'ATASK-001',
      });

      expect(result.success).toBe(true);
      const task = result.result as Record<string, unknown>;
      expect(task.id).toBe('ATASK-001');
      expect(task.title).toBe('Full detail task');
      expect(task.description).toBe('Detailed description');
      expect(task.status).toBe('open');
      expect(task.priority).toBe('critical');
      expect(task.reporter).toBe('agent-1');
      expect(task.check_log).toEqual([]);
      expect(task.session_id).toBe('test-session');
    });

    it('returns 404 error for non-existent task_id', async () => {
      const result = await handler({
        operation: 'get',
        session_id: 'test-session',
        task_id: 'ATASK-999',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task not found');
      expect(result.error).toContain('ATASK-999');
    });

    it('fails without task_id', async () => {
      const result = await handler({
        operation: 'get',
        session_id: 'test-session',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('task_id');
    });
  });

  // ---- validation ----

  describe('param validation', () => {
    it('rejects invalid operation', async () => {
      const result = await handler({
        operation: 'delete',
        session_id: 'test-session',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid params');
    });

    it('rejects missing session_id', async () => {
      const result = await handler({
        operation: 'list',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid params');
    });

    it('rejects invalid status value', async () => {
      const result = await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid params');
    });

    it('rejects invalid priority value', async () => {
      const result = await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Test task',
        priority: 'urgent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid params');
    });
  });

  // ---- full lifecycle ----

  describe('full lifecycle transitions', () => {
    it('completes full lifecycle: open -> assigned -> in_progress -> pending_review -> done -> closed', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Lifecycle task',
        owner: 'agent-1',
      });

      const transitions: Array<{ status: string; expected: boolean }> = [
        { status: 'assigned', expected: true },
        { status: 'in_progress', expected: true },
        { status: 'pending_review', expected: true },
        { status: 'done', expected: true },
        { status: 'closed', expected: true },
      ];

      for (const { status, expected } of transitions) {
        const result = await handler({
          operation: 'update',
          session_id: 'test-session',
          task_id: 'ATASK-001',
          status,
        });
        expect(result.success).toBe(expected);
        if (expected) {
          const data = result.result as Record<string, unknown>;
          expect(data.status).toBe(status);
        }
      }
    });

    it('allows closed -> open (reopen)', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Reopen task',
        owner: 'agent-1',
      });

      // Walk through to closed
      for (const status of ['assigned', 'in_progress', 'pending_review', 'done', 'closed']) {
        await handler({
          operation: 'update',
          session_id: 'test-session',
          task_id: 'ATASK-001',
          status,
        });
      }

      // Reopen: closed -> open
      const result = await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'open',
      });
      expect(result.success).toBe(true);
      const data = result.result as Record<string, unknown>;
      expect(data.status).toBe('open');
    });
  });

  // ---- update field changes ----

  describe('update field changes', () => {
    it('updates description without changing status', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Test task',
        description: 'Original description',
      });

      const result = await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        description: 'Updated description',
      });

      expect(result.success).toBe(true);

      const getResult = await handler({
        operation: 'get',
        session_id: 'test-session',
        task_id: 'ATASK-001',
      });
      const task = getResult.result as Record<string, unknown>;
      expect(task.description).toBe('Updated description');
      expect(task.status).toBe('open');
    });

    it('updates updated_at and updated_by on update', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Test task',
        owner: 'agent-1',
      });

      const beforeGet = await handler({
        operation: 'get',
        session_id: 'test-session',
        task_id: 'ATASK-001',
      });
      const beforeTask = beforeGet.result as Record<string, unknown>;
      const createdAt = beforeTask.created_at;

      // Wait a bit and update
      const result = await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'assigned',
        owner: 'agent-2',
      });

      expect(result.success).toBe(true);
      const data = result.result as Record<string, unknown>;
      expect(data.updated_by).toBe('agent-2');
      expect(data.assignee).toBe('agent-2');

      // created_at should not change
      const afterGet = await handler({
        operation: 'get',
        session_id: 'test-session',
        task_id: 'ATASK-001',
      });
      const afterTask = afterGet.result as Record<string, unknown>;
      expect(afterTask.created_at).toBe(createdAt);
    });
  });

  // ---- create edge cases ----

  describe('create edge cases', () => {
    it('creates task with all fields', async () => {
      const result = await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Full task',
        description: 'Detailed description',
        owner: 'agent-1',
        priority: 'critical',
      });

      expect(result.success).toBe(true);
      const data = result.result as Record<string, unknown>;
      expect(data.title).toBe('Full task');
      expect(data.priority).toBe('critical');
      expect(data.owner).toBe('agent-1');
    });

    it('defaults priority to medium', async () => {
      const result = await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Default priority',
      });

      const getResult = await handler({
        operation: 'get',
        session_id: 'test-session',
        task_id: 'ATASK-001',
      });
      const task = getResult.result as Record<string, unknown>;
      expect(task.priority).toBe('medium');
    });

    it('defaults description to empty string', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'No description',
      });

      const getResult = await handler({
        operation: 'get',
        session_id: 'test-session',
        task_id: 'ATASK-001',
      });
      const task = getResult.result as Record<string, unknown>;
      expect(task.description).toBe('');
    });
  });

  // ---- list edge cases ----

  describe('list edge cases', () => {
    it('combined status and owner filters', async () => {
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Alice open',
        owner: 'alice',
      });
      await handler({
        operation: 'create',
        session_id: 'test-session',
        title: 'Bob open',
        owner: 'bob',
      });
      await handler({
        operation: 'update',
        session_id: 'test-session',
        task_id: 'ATASK-001',
        status: 'assigned',
      });

      const result = await handler({
        operation: 'list',
        session_id: 'test-session',
        status: 'open',
        owner: 'bob',
      });

      const data = result.result as Record<string, unknown>;
      expect(data.total).toBe(1);
      const tasks = data.tasks as Array<Record<string, unknown>>;
      expect(tasks[0].title).toBe('Bob open');
    });
  });
});
