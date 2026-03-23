import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rm, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { DashboardEventBus } from '../state/event-bus.js';
import { TaskSchedulerService } from './task-scheduler-service.js';
import type { ScheduledTask, ScheduledTaskType } from '../../shared/schedule-types.js';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
class MockExecutionScheduler {
  private _enabled = true;
  enableAutoDispatch(): void { this._enabled = true; }
  disableAutoDispatch(): void { this._enabled = false; }
  getStatus(): { enabled: boolean } { return { enabled: this._enabled }; }
}

class MockLearningService {
  analyzeCalled = false;
  async analyze(): Promise<unknown> {
    this.analyzeCalled = true;
    return { totalCommands: 0, uniquePatterns: 0, topPatterns: [], suggestions: [], knowledgeBaseSize: 0 };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TaskSchedulerService', () => {
  let workflowRoot: string;
  let eventBus: DashboardEventBus;
  let execScheduler: MockExecutionScheduler;
  let learningService: MockLearningService;
  let service: TaskSchedulerService;
  const emittedEvents: { type: string; data: unknown }[] = [];

  beforeEach(async () => {
    workflowRoot = join(tmpdir(), `test-scheduler-${randomUUID()}`);
    await mkdir(workflowRoot, { recursive: true });

    eventBus = new DashboardEventBus();
    execScheduler = new MockExecutionScheduler();
    learningService = new MockLearningService();

    emittedEvents.length = 0;
    eventBus.on('supervisor:schedule_update', (data) => {
      emittedEvents.push({ type: 'schedule_update', data });
    });
    eventBus.on('supervisor:schedule_triggered', (data) => {
      emittedEvents.push({ type: 'schedule_triggered', data });
    });

    service = new TaskSchedulerService(
      eventBus,
      workflowRoot,
      execScheduler as any,
      learningService as any,
    );
  });

  afterEach(async () => {
    service.stop();
    await rm(workflowRoot, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  describe('lifecycle', () => {
    it('starts with empty task list', async () => {
      await service.start();
      expect(service.listTasks()).toHaveLength(0);
    });

    it('stops cleanly without errors', async () => {
      await service.start();
      expect(() => service.stop()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // CRUD - createTask
  // -------------------------------------------------------------------------
  describe('createTask()', () => {
    it('creates task with valid cron expression', async () => {
      await service.start();

      const task = await service.createTask({
        name: 'Test Cleanup',
        cronExpression: '0 0 * * *',
        taskType: 'cleanup',
        enabled: true,
        config: { retentionDays: 7 },
      });

      expect(task.id).toBeTruthy();
      expect(task.name).toBe('Test Cleanup');
      expect(task.cronExpression).toBe('0 0 * * *');
      expect(task.taskType).toBe('cleanup');
      expect(task.enabled).toBe(true);
      expect(task.lastRun).toBeNull();
      expect(task.history).toHaveLength(0);
    });

    it('rejects invalid cron expression', async () => {
      await service.start();

      await expect(
        service.createTask({
          name: 'Bad Cron',
          cronExpression: 'not-a-cron',
          taskType: 'custom',
          enabled: true,
          config: {},
        }),
      ).rejects.toThrow('Invalid cron expression');
    });

    it('persists task to schedules.json', async () => {
      await service.start();

      await service.createTask({
        name: 'Persisted Task',
        cronExpression: '*/5 * * * *',
        taskType: 'health-check',
        enabled: false,
        config: {},
      });

      const raw = await readFile(join(workflowRoot, 'schedules.json'), 'utf-8');
      const data = JSON.parse(raw) as ScheduledTask[];
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Persisted Task');
    });

    it('emits schedule_update event', async () => {
      await service.start();
      emittedEvents.length = 0;

      await service.createTask({
        name: 'Event Test',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      const updateEvents = emittedEvents.filter((e) => e.type === 'schedule_update');
      expect(updateEvents.length).toBeGreaterThan(0);
    });

    it('creates disabled task without registering cron job', async () => {
      await service.start();

      const task = await service.createTask({
        name: 'Disabled',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      // Task exists but no cron job should fire
      expect(service.listTasks()).toHaveLength(1);
      expect(task.enabled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // CRUD - getTask / listTasks
  // -------------------------------------------------------------------------
  describe('getTask() / listTasks()', () => {
    it('returns task by id', async () => {
      await service.start();
      const created = await service.createTask({
        name: 'Findable',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      const found = service.getTask(created.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('Findable');
    });

    it('returns undefined for unknown id', async () => {
      await service.start();
      expect(service.getTask('nonexistent')).toBeUndefined();
    });

    it('lists all tasks', async () => {
      await service.start();
      await service.createTask({ name: 'A', cronExpression: '0 * * * *', taskType: 'custom', enabled: false, config: {} });
      await service.createTask({ name: 'B', cronExpression: '0 * * * *', taskType: 'cleanup', enabled: false, config: {} });
      await service.createTask({ name: 'C', cronExpression: '0 * * * *', taskType: 'report', enabled: false, config: {} });

      expect(service.listTasks()).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // CRUD - updateTask
  // -------------------------------------------------------------------------
  describe('updateTask()', () => {
    it('updates task name', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Original',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      const updated = await service.updateTask(task.id, { name: 'Updated' });
      expect(updated.name).toBe('Updated');
    });

    it('updates cron expression with validation', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Cron Update',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      const updated = await service.updateTask(task.id, { cronExpression: '*/10 * * * *' });
      expect(updated.cronExpression).toBe('*/10 * * * *');
    });

    it('rejects invalid cron expression on update', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Bad Update',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      await expect(
        service.updateTask(task.id, { cronExpression: 'invalid' }),
      ).rejects.toThrow('Invalid cron expression');
    });

    it('throws for nonexistent task', async () => {
      await service.start();
      await expect(service.updateTask('fake-id', { name: 'X' })).rejects.toThrow('not found');
    });

    it('toggles enabled state', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Toggle',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      const enabled = await service.updateTask(task.id, { enabled: true });
      expect(enabled.enabled).toBe(true);

      const disabled = await service.updateTask(task.id, { enabled: false });
      expect(disabled.enabled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // CRUD - deleteTask
  // -------------------------------------------------------------------------
  describe('deleteTask()', () => {
    it('removes task from list', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Deletable',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      await service.deleteTask(task.id);
      expect(service.listTasks()).toHaveLength(0);
      expect(service.getTask(task.id)).toBeUndefined();
    });

    it('throws for nonexistent task', async () => {
      await service.start();
      await expect(service.deleteTask('fake')).rejects.toThrow('not found');
    });

    it('persists deletion to file', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Delete Persist',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      await service.deleteTask(task.id);

      const raw = await readFile(join(workflowRoot, 'schedules.json'), 'utf-8');
      const data = JSON.parse(raw) as ScheduledTask[];
      expect(data).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // runTask - manual trigger
  // -------------------------------------------------------------------------
  describe('runTask()', () => {
    it('executes health-check task type', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Health',
        cronExpression: '0 * * * *',
        taskType: 'health-check',
        enabled: false,
        config: {},
      });

      const result = await service.runTask(task.id);
      expect(result.status).toBe('success');
      expect(result.result).toContain('healthy');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('executes auto-dispatch task type', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Auto Dispatch',
        cronExpression: '0 * * * *',
        taskType: 'auto-dispatch',
        enabled: false,
        config: {},
      });

      const result = await service.runTask(task.id);
      expect(result.status).toBe('success');
    });

    it('executes learning-analysis task type', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Learn',
        cronExpression: '0 * * * *',
        taskType: 'learning-analysis',
        enabled: false,
        config: {},
      });

      const result = await service.runTask(task.id);
      expect(result.status).toBe('success');
      expect(learningService.analyzeCalled).toBe(true);
    });

    it('executes report task type', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Report',
        cronExpression: '0 * * * *',
        taskType: 'report',
        enabled: false,
        config: {},
      });

      const result = await service.runTask(task.id);
      expect(result.status).toBe('success');
      expect(result.result).toContain('Report written');
    });

    it('executes cleanup task type', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Cleanup',
        cronExpression: '0 * * * *',
        taskType: 'cleanup',
        enabled: false,
        config: { retentionDays: 30 },
      });

      const result = await service.runTask(task.id);
      expect(result.status).toBe('success');
    });

    it('executes custom task type', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Custom',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: { myKey: 'myValue' },
      });

      const result = await service.runTask(task.id);
      expect(result.status).toBe('success');
      expect(result.result).toContain('myKey');
    });

    it('throws for nonexistent task', async () => {
      await service.start();
      await expect(service.runTask('fake')).rejects.toThrow('not found');
    });

    it('records run in task history', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'History Test',
        cronExpression: '0 * * * *',
        taskType: 'health-check',
        enabled: false,
        config: {},
      });

      await service.runTask(task.id);
      await service.runTask(task.id);

      const updated = service.getTask(task.id);
      expect(updated!.history).toHaveLength(2);
      expect(updated!.lastRun).toBeTruthy();
    });

    it('bounds history to 50 entries', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Bounded',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: {},
      });

      for (let i = 0; i < 55; i++) {
        await service.runTask(task.id);
      }

      const updated = service.getTask(task.id);
      expect(updated!.history.length).toBeLessThanOrEqual(50);
    });
  });

  // -------------------------------------------------------------------------
  // Persistence & reload
  // -------------------------------------------------------------------------
  describe('persistence', () => {
    it('reloads tasks from file on restart', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'Reloadable',
        cronExpression: '0 * * * *',
        taskType: 'custom',
        enabled: false,
        config: { key: 'val' },
      });

      // Create a new service instance pointing to same workflowRoot
      const service2 = new TaskSchedulerService(eventBus, workflowRoot);
      await service2.start();

      const tasks = service2.listTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('Reloadable');
      expect(tasks[0].id).toBe(task.id);

      service2.stop();
    });

    it('survives missing schedules.json', async () => {
      // Service should start with empty list when no file
      await service.start();
      expect(service.listTasks()).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Task handlers - edge cases
  // -------------------------------------------------------------------------
  describe('task handler edge cases', () => {
    it('auto-dispatch reports already active when enabled', async () => {
      await service.start();
      const task = await service.createTask({
        name: 'AD',
        cronExpression: '0 * * * *',
        taskType: 'auto-dispatch',
        enabled: false,
        config: {},
      });

      // execScheduler is enabled by default
      const result = await service.runTask(task.id);
      expect(result.result).toContain('already active');
    });

    it('auto-dispatch enables when disabled', async () => {
      execScheduler.disableAutoDispatch();
      await service.start();

      const task = await service.createTask({
        name: 'AD2',
        cronExpression: '0 * * * *',
        taskType: 'auto-dispatch',
        enabled: false,
        config: {},
      });

      const result = await service.runTask(task.id);
      expect(result.result).toContain('enabled');
    });

    it('health-check reports issues when scheduler disabled', async () => {
      execScheduler.disableAutoDispatch();
      await service.start();

      const task = await service.createTask({
        name: 'HC',
        cronExpression: '0 * * * *',
        taskType: 'health-check',
        enabled: false,
        config: {},
      });

      const result = await service.runTask(task.id);
      expect(result.result).toContain('disabled');
    });
  });
});
