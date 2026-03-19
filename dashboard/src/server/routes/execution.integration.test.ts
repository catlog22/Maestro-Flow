import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

import { createExecutionRoutes } from './execution.js';
import type { ExecutionScheduler } from '../execution/execution-scheduler.js';

// ---------------------------------------------------------------------------
// L2 Integration: Execution routes <-> ExecutionScheduler
// Tests route handler → scheduler method dispatch with validation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Mock ExecutionScheduler with state tracking
// ---------------------------------------------------------------------------

interface SchedulerCall {
  method: string;
  args: unknown[];
}

function createMockScheduler(): { scheduler: ExecutionScheduler; calls: SchedulerCall[] } {
  const calls: SchedulerCall[] = [];
  const status = {
    enabled: false,
    running: [],
    queued: [],
    maxConcurrency: 3,
  };

  const scheduler = {
    executeIssue: vi.fn(async (issueId: string, executor?: string) => {
      calls.push({ method: 'executeIssue', args: [issueId, executor] });
    }),
    executeBatch: vi.fn(async (ids: string[], executor?: string, max?: number) => {
      calls.push({ method: 'executeBatch', args: [ids, executor, max] });
    }),
    cancelIssue: vi.fn(async (id: string) => {
      calls.push({ method: 'cancelIssue', args: [id] });
    }),
    getStatus: vi.fn(() => status),
    updateConfig: vi.fn((config: Record<string, unknown>) => {
      calls.push({ method: 'updateConfig', args: [config] });
    }),
    startSupervisor: vi.fn(() => {
      status.enabled = true;
      calls.push({ method: 'startSupervisor', args: [] });
    }),
    stopSupervisor: vi.fn(() => {
      status.enabled = false;
      calls.push({ method: 'stopSupervisor', args: [] });
    }),
  } as unknown as ExecutionScheduler;

  return { scheduler, calls };
}

function createApp() {
  const { scheduler, calls } = createMockScheduler();
  const routes = createExecutionRoutes(scheduler);
  const app = new Hono();
  app.route('/', routes);
  return { app, scheduler, calls };
}

// ---------------------------------------------------------------------------
// Dispatch routes
// ---------------------------------------------------------------------------

describe('Execution routes + Scheduler integration', () => {
  describe('POST /api/execution/dispatch', () => {
    it('dispatches single issue to scheduler', async () => {
      const { app, calls } = createApp();
      const res = await app.request('/api/execution/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: 'ISS-001' }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; issueId: string };
      expect(body.ok).toBe(true);
      expect(body.issueId).toBe('ISS-001');
      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('executeIssue');
      expect(calls[0].args[0]).toBe('ISS-001');
    });

    it('dispatches with executor override', async () => {
      const { app, calls } = createApp();
      const res = await app.request('/api/execution/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: 'ISS-002', executor: 'gemini' }),
      });

      expect(res.status).toBe(200);
      expect(calls[0].args).toEqual(['ISS-002', 'gemini']);
    });

    it('rejects missing issueId', async () => {
      const { app } = createApp();
      const res = await app.request('/api/execution/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('issueId');
    });

    it('rejects invalid executor', async () => {
      const { app } = createApp();
      const res = await app.request('/api/execution/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: 'ISS-001', executor: 'invalid-tool' }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('executor');
    });

    it('returns 500 when scheduler throws', async () => {
      const { app, scheduler } = createApp();
      (scheduler.executeIssue as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Issue not found in store'),
      );

      const res = await app.request('/api/execution/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: 'ISS-missing' }),
      });

      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('Issue not found in store');
    });
  });

  // ---------------------------------------------------------------------------
  // Batch dispatch
  // ---------------------------------------------------------------------------

  describe('POST /api/execution/batch', () => {
    it('dispatches batch of issues', async () => {
      const { app, calls } = createApp();
      const res = await app.request('/api/execution/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIds: ['ISS-001', 'ISS-002', 'ISS-003'] }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; count: number };
      expect(body.ok).toBe(true);
      expect(body.count).toBe(3);
      expect(calls[0].method).toBe('executeBatch');
      expect(calls[0].args[0]).toEqual(['ISS-001', 'ISS-002', 'ISS-003']);
    });

    it('passes executor and maxConcurrency to scheduler', async () => {
      const { app, calls } = createApp();
      const res = await app.request('/api/execution/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueIds: ['ISS-001'],
          executor: 'codex',
          maxConcurrency: 5,
        }),
      });

      expect(res.status).toBe(200);
      expect(calls[0].args).toEqual([['ISS-001'], 'codex', 5]);
    });

    it('rejects empty issueIds array', async () => {
      const { app } = createApp();
      const res = await app.request('/api/execution/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIds: [] }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects non-array issueIds', async () => {
      const { app } = createApp();
      const res = await app.request('/api/execution/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIds: 'ISS-001' }),
      });

      expect(res.status).toBe(400);
    });

    it('rejects negative maxConcurrency', async () => {
      const { app } = createApp();
      const res = await app.request('/api/execution/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIds: ['ISS-001'], maxConcurrency: -1 }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // Cancel + Status
  // ---------------------------------------------------------------------------

  describe('POST /api/execution/cancel/:id', () => {
    it('cancels a running issue', async () => {
      const { app, calls } = createApp();
      const res = await app.request('/api/execution/cancel/ISS-001', { method: 'POST' });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
      expect(calls[0].method).toBe('cancelIssue');
      expect(calls[0].args[0]).toBe('ISS-001');
    });
  });

  describe('GET /api/execution/status', () => {
    it('returns scheduler status snapshot', async () => {
      const { app } = createApp();
      const res = await app.request('/api/execution/status');

      expect(res.status).toBe(200);
      const body = (await res.json()) as { enabled: boolean; maxConcurrency: number };
      expect(body.enabled).toBe(false);
      expect(body.maxConcurrency).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Supervisor control
  // ---------------------------------------------------------------------------

  describe('PUT /api/execution/supervisor', () => {
    it('starts supervisor when enabled=true', async () => {
      const { app, calls } = createApp();
      const res = await app.request('/api/execution/supervisor', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; status: { enabled: boolean } };
      expect(body.ok).toBe(true);
      expect(calls.some((c) => c.method === 'startSupervisor')).toBe(true);
    });

    it('stops supervisor when enabled=false', async () => {
      const { app, calls } = createApp();
      const res = await app.request('/api/execution/supervisor', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(200);
      expect(calls.some((c) => c.method === 'stopSupervisor')).toBe(true);
    });

    it('updates config and starts supervisor in one call', async () => {
      const { app, calls } = createApp();
      const res = await app.request('/api/execution/supervisor', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, config: { maxConcurrency: 10 } }),
      });

      expect(res.status).toBe(200);
      expect(calls.some((c) => c.method === 'updateConfig')).toBe(true);
      expect(calls.some((c) => c.method === 'startSupervisor')).toBe(true);
    });
  });
});
