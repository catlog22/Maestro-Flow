import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  getTasksDir,
  getTaskFilePath,
  getNextTaskId,
  readTaskFile,
  writeTaskFile,
  createTask,
  getTask,
  updateTask,
  listTasks,
  deleteTask,
  assignTask,
  updateTaskStatus,
  addCheckEntry,
  validateStatusTransition,
} from '../team-tasks.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let prevRoot: string | undefined;

function setup(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'team-tasks-test-'));
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
// Tests
// ---------------------------------------------------------------------------

describe('team-tasks', () => {
  describe('getTasksDir', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('creates the tasks directory if it does not exist', () => {
      const dir = getTasksDir();
      expect(existsSync(dir)).toBe(true);
      expect(dir).toContain(join('.workflow', 'collab', 'tasks'));
    });

    it('returns the same path on subsequent calls', () => {
      const a = getTasksDir();
      const b = getTasksDir();
      expect(a).toBe(b);
    });
  });

  describe('getNextTaskId', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('starts at TASK-001', () => {
      expect(getNextTaskId()).toBe('TASK-001');
    });

    it('increments sequentially', () => {
      expect(getNextTaskId()).toBe('TASK-001');
      expect(getNextTaskId()).toBe('TASK-002');
      expect(getNextTaskId()).toBe('TASK-003');
    });

    it('pads to 3 digits', () => {
      // Simulate a counter at 99 so next is TASK-099, then TASK-100.
      writeFileSync(join(getTasksDir(), '.counter'), '99', 'utf-8');
      expect(getNextTaskId()).toBe('TASK-099');
      expect(getNextTaskId()).toBe('TASK-100');
    });
  });

  describe('createTask', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('creates a task file with correct defaults', () => {
      const task = createTask({
        title: 'Fix login bug',
        reporter: 'alice',
      });

      expect(task.id).toBe('TASK-001');
      expect(task.title).toBe('Fix login bug');
      expect(task.description).toBe('');
      expect(task.status).toBe('open');
      expect(task.priority).toBe('medium');
      expect(task.reporter).toBe('alice');
      expect(task.assignee).toBe(undefined);
      expect(task.check_log).toEqual([]);
      expect(task.tags).toBe(undefined);
      expect(task.external_refs).toBe(undefined);
      expect(task.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(task.updated_at).toBe(task.created_at);
      expect(task.updated_by).toBe('alice');

      const filePath = join(getTasksDir(), 'TASK-001.json');
      expect(existsSync(filePath)).toBe(true);
      const onDisk = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(onDisk.id).toBe('TASK-001');
    });

    it('uses provided options over defaults', () => {
      const task = createTask({
        title: 'Implement feature',
        description: 'Detailed description',
        priority: 'high',
        reporter: 'bob',
        tags: ['feature', 'v2'],
        external_refs: [{ type: 'github', id: '42', url: 'https://github.com/repo/issues/42' }],
      });

      expect(task.description).toBe('Detailed description');
      expect(task.priority).toBe('high');
      expect(task.tags).toEqual(['feature', 'v2']);
      expect(task.external_refs).toEqual([
        { type: 'github', id: '42', url: 'https://github.com/repo/issues/42' },
      ]);
    });
  });

  describe('getTask', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('returns null for unknown task', () => {
      expect(getTask('TASK-999')).toBe(null);
    });

    it('returns task that was created', () => {
      createTask({ title: 'Test task', reporter: 'alice' });
      const task = getTask('TASK-001');
      expect(task).not.toBe(null);
      expect(task!.title).toBe('Test task');
    });
  });

  describe('readTaskFile', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('returns null for missing file', () => {
      expect(readTaskFile('/nonexistent/path.json')).toBe(null);
    });

    it('returns null for invalid JSON', () => {
      const dir = getTasksDir();
      writeFileSync(join(dir, 'broken.json'), 'not-json', 'utf-8');
      expect(readTaskFile(join(dir, 'broken.json'))).toBe(null);
    });

    it('returns null for valid JSON missing required fields', () => {
      const dir = getTasksDir();
      writeFileSync(join(dir, 'partial.json'), JSON.stringify({ id: 'TASK-001' }), 'utf-8');
      expect(readTaskFile(join(dir, 'partial.json'))).toBe(null);
    });
  });

  describe('writeTaskFile', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('writes valid JSON to disk', () => {
      const task = {
        id: 'TASK-001',
        title: 'Test',
        description: '',
        status: 'open' as const,
        priority: 'medium' as const,
        reporter: 'alice',
        check_log: [],
        created_at: '2026-04-18T10:00:00.000Z',
        updated_at: '2026-04-18T10:00:00.000Z',
        updated_by: 'alice',
      };
      const filePath = join(getTasksDir(), 'TASK-001.json');
      writeTaskFile(filePath, task);
      const onDisk = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(onDisk.id).toBe('TASK-001');
      expect(onDisk.title).toBe('Test');
    });
  });

  describe('updateTask', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('merges partial fields into existing task', () => {
      createTask({ title: 'Original', reporter: 'alice' });
      const updated = updateTask('TASK-001', { title: 'Updated title', description: 'New desc' });
      expect(updated.title).toBe('Updated title');
      expect(updated.description).toBe('New desc');
      expect(updated.reporter).toBe('alice'); // unchanged
      expect(updated.id).toBe('TASK-001'); // immutable
    });

    it('throws for missing task', () => {
      expect(() => updateTask('TASK-999', { title: 'X' })).toThrow(/Task not found/);
    });

    it('throws on invalid status transition', () => {
      createTask({ title: 'Test', reporter: 'alice' });
      // open -> in_progress is invalid (must go through assigned first)
      expect(
        () => updateTask('TASK-001', { status: 'in_progress' }),
      ).toThrow(/Invalid status transition: open -> in_progress/);
    });

    it('allows valid status transition', () => {
      createTask({ title: 'Test', reporter: 'alice' });
      // open -> assigned is valid
      const updated = updateTask('TASK-001', { status: 'assigned', assignee: 'bob' });
      expect(updated.status).toBe('assigned');
      expect(updated.assignee).toBe('bob');
    });

    it('preserves created_at and id immutably', () => {
      const original = createTask({ title: 'Test', reporter: 'alice' });
      const updated = updateTask('TASK-001', {
        title: 'Changed',
        created_at: 'HACKED',
        id: 'HACKED',
      });
      expect(updated.created_at).toBe(original.created_at);
      expect(updated.id).toBe('TASK-001');
    });
  });

  describe('listTasks', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('returns empty array when no tasks exist', () => {
      expect(listTasks()).toEqual([]);
    });

    it('returns all tasks sorted by id', () => {
      createTask({ title: 'Third', reporter: 'alice' });
      createTask({ title: 'First', reporter: 'bob' });
      createTask({ title: 'Second', reporter: 'alice' });

      const tasks = listTasks();
      expect(tasks.length).toBe(3);
      expect(tasks[0].id).toBe('TASK-001');
      expect(tasks[1].id).toBe('TASK-002');
      expect(tasks[2].id).toBe('TASK-003');
    });

    it('filters by status', () => {
      createTask({ title: 'A', reporter: 'alice' });
      createTask({ title: 'B', reporter: 'bob' });
      updateTask('TASK-001', { status: 'assigned', assignee: 'bob' });

      const open = listTasks({ status: 'open' });
      expect(open.length).toBe(1);
      expect(open[0].title).toBe('B');
    });

    it('filters by assignee', () => {
      createTask({ title: 'A', reporter: 'alice' });
      createTask({ title: 'B', reporter: 'bob' });
      updateTask('TASK-001', { assignee: 'carol', status: 'assigned' });

      const carolTasks = listTasks({ assignee: 'carol' });
      expect(carolTasks.length).toBe(1);
      expect(carolTasks[0].title).toBe('A');
    });

    it('filters by reporter', () => {
      createTask({ title: 'A', reporter: 'alice' });
      createTask({ title: 'B', reporter: 'bob' });

      const aliceTasks = listTasks({ reporter: 'alice' });
      expect(aliceTasks.length).toBe(1);
      expect(aliceTasks[0].title).toBe('A');
    });

    it('filters by priority', () => {
      createTask({ title: 'Low', reporter: 'alice', priority: 'low' });
      createTask({ title: 'High', reporter: 'alice', priority: 'high' });

      const high = listTasks({ priority: 'high' });
      expect(high.length).toBe(1);
      expect(high[0].title).toBe('High');
    });

    it('skips malformed files', () => {
      createTask({ title: 'Valid', reporter: 'alice' });
      writeFileSync(join(getTasksDir(), 'broken.json'), 'not-json', 'utf-8');

      const tasks = listTasks();
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Valid');
    });
  });

  describe('deleteTask', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('removes the task file', () => {
      createTask({ title: 'Delete me', reporter: 'alice' });
      const filePath = getTaskFilePath('TASK-001');
      expect(existsSync(filePath)).toBe(true);

      deleteTask('TASK-001');
      expect(existsSync(filePath)).toBe(false);
    });

    it('throws for missing task', () => {
      expect(() => deleteTask('TASK-999')).toThrow(/Task not found/);
    });
  });

  describe('assignTask', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('assigns member and transitions open to assigned', () => {
      createTask({ title: 'Test', reporter: 'alice' });
      const updated = assignTask('TASK-001', 'bob');

      expect(updated.assignee).toBe('bob');
      expect(updated.status).toBe('assigned');
      expect(updated.updated_by).toBe('bob');
    });

    it('keeps current status if not open', () => {
      createTask({ title: 'Test', reporter: 'alice' });
      // Move to in_progress
      updateTask('TASK-001', { status: 'assigned', assignee: 'bob' });
      updateTask('TASK-001', { status: 'in_progress' });

      const updated = assignTask('TASK-001', 'carol');
      expect(updated.assignee).toBe('carol');
      expect(updated.status).toBe('in_progress'); // stays in_progress
    });

    it('throws for missing task', () => {
      expect(() => assignTask('TASK-999', 'bob')).toThrow(/Task not found/);
    });
  });

  describe('updateTaskStatus', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('follows valid transition open -> assigned', () => {
      createTask({ title: 'Test', reporter: 'alice' });
      const updated = updateTaskStatus('TASK-001', 'assigned', 'bob');
      expect(updated.status).toBe('assigned');
    });

    it('follows full lifecycle', () => {
      createTask({ title: 'Lifecycle', reporter: 'alice' });

      updateTaskStatus('TASK-001', 'assigned', 'bob');
      updateTaskStatus('TASK-001', 'in_progress', 'bob');
      updateTaskStatus('TASK-001', 'pending_review', 'bob');
      updateTaskStatus('TASK-001', 'done', 'alice');
      updateTaskStatus('TASK-001', 'closed', 'alice');
    });

    it('allows reopening a closed task', () => {
      createTask({ title: 'Reopen', reporter: 'alice' });
      updateTaskStatus('TASK-001', 'closed', 'alice');
      const reopened = updateTaskStatus('TASK-001', 'open', 'alice');
      expect(reopened.status).toBe('open');
    });

    it('throws on invalid transition', () => {
      createTask({ title: 'Test', reporter: 'alice' });
      expect(
        () => updateTaskStatus('TASK-001', 'done', 'alice'),
      ).toThrow(/Invalid status transition: open -> done/);
    });

    it('throws for missing task', () => {
      expect(
        () => updateTaskStatus('TASK-999', 'assigned', 'bob'),
      ).toThrow(/Task not found/);
    });
  });

  describe('addCheckEntry', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('appends entry to check_log with auto-generated timestamp', () => {
      createTask({ title: 'Test', reporter: 'alice' });
      const updated = addCheckEntry('TASK-001', {
        uid: 'bob',
        action: 'confirmed',
        comment: 'Looks good',
      });

      expect(updated.check_log.length).toBe(1);
      expect(updated.check_log[0].uid).toBe('bob');
      expect(updated.check_log[0].action).toBe('confirmed');
      expect(updated.check_log[0].comment).toBe('Looks good');
      expect(updated.check_log[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('appends without comment', () => {
      createTask({ title: 'Test', reporter: 'alice' });
      const updated = addCheckEntry('TASK-001', {
        uid: 'carol',
        action: 'rejected',
      });

      expect(updated.check_log.length).toBe(1);
      expect(updated.check_log[0].comment).toBe(undefined);
    });

    it('never overwrites existing entries', () => {
      createTask({ title: 'Test', reporter: 'alice' });

      addCheckEntry('TASK-001', { uid: 'bob', action: 'confirmed' });
      const updated = addCheckEntry('TASK-001', { uid: 'carol', action: 'commented', comment: 'Note' });

      expect(updated.check_log.length).toBe(2);
      expect(updated.check_log[0].uid).toBe('bob');
      expect(updated.check_log[1].uid).toBe('carol');
    });

    it('throws for missing task', () => {
      expect(
        () => addCheckEntry('TASK-999', { uid: 'bob', action: 'confirmed' }),
      ).toThrow(/Task not found/);
    });
  });

  describe('validateStatusTransition', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('allows transition to same status (no-op)', () => {
      expect(validateStatusTransition('open', 'open')).toBe(true);
      expect(validateStatusTransition('closed', 'closed')).toBe(true);
    });

    it('allows valid transitions', () => {
      expect(validateStatusTransition('open', 'assigned')).toBe(true);
      expect(validateStatusTransition('open', 'closed')).toBe(true);
      expect(validateStatusTransition('assigned', 'in_progress')).toBe(true);
      expect(validateStatusTransition('in_progress', 'pending_review')).toBe(true);
      expect(validateStatusTransition('pending_review', 'done')).toBe(true);
      expect(validateStatusTransition('done', 'closed')).toBe(true);
      expect(validateStatusTransition('closed', 'open')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(validateStatusTransition('open', 'in_progress')).toBe(false);
      expect(validateStatusTransition('open', 'done')).toBe(false);
      expect(validateStatusTransition('closed', 'in_progress')).toBe(false);
      expect(validateStatusTransition('done', 'open')).toBe(false);
      expect(validateStatusTransition('assigned', 'done')).toBe(false);
    });
  });
});
