import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createCoordinatorRoutes } from './coordinator-routes.js';
import type { WorkflowCoordinator } from './workflow-coordinator.js';
import type { CoordinateSession } from '../../shared/coordinate-types.js';

// ---------------------------------------------------------------------------
// Mock WorkflowCoordinator
// ---------------------------------------------------------------------------

function createMockSession(overrides?: Partial<CoordinateSession>): CoordinateSession {
  return {
    sessionId: 'coord-test-abc12345',
    status: 'running',
    intent: 'implement feature X',
    chainName: 'analyze-plan-execute',
    tool: 'claude',
    autoMode: false,
    currentStep: 0,
    steps: [],
    avgQuality: null,
    ...overrides,
  };
}

function createMockCoordinator(): {
  coordinator: WorkflowCoordinator;
  mocks: Record<string, ReturnType<typeof vi.fn>>;
} {
  const session = createMockSession();

  const mocks = {
    start: vi.fn().mockResolvedValue(session),
    stop: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(session),
    clarify: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockReturnValue(session),
    destroy: vi.fn(),
  };

  return {
    coordinator: mocks as unknown as WorkflowCoordinator,
    mocks,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Coordinator Routes', () => {
  function createApp() {
    const { coordinator, mocks } = createMockCoordinator();
    const routes = createCoordinatorRoutes(coordinator);
    const app = new Hono();
    app.route('/', routes);
    return { app, coordinator, mocks };
  }

  // --- POST /api/coordinate/start ---
  describe('POST /api/coordinate/start', () => {
    it('starts a session with intent and returns session', async () => {
      const { app, mocks } = createApp();

      const res = await app.request('/api/coordinate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: 'implement feature X', tool: 'gemini' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.session).toBeDefined();
      expect(body.session.sessionId).toBe('coord-test-abc12345');
      expect(mocks.start).toHaveBeenCalledWith('implement feature X', {
        tool: 'gemini',
        autoMode: undefined,
        chainName: undefined,
        phase: undefined,
      });
    });

    it('returns 400 when intent is missing', async () => {
      const { app } = createApp();

      const res = await app.request('/api/coordinate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('intent');
    });

    it('returns 500 when start throws', async () => {
      const { app, mocks } = createApp();
      mocks.start.mockRejectedValueOnce(new Error('Session already running'));

      const res = await app.request('/api/coordinate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: 'do something' }),
      });
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('Session already running');
    });
  });

  // --- POST /api/coordinate/stop ---
  describe('POST /api/coordinate/stop', () => {
    it('stops the session and returns ok', async () => {
      const { app, mocks } = createApp();

      const res = await app.request('/api/coordinate/stop', { method: 'POST' });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(mocks.stop).toHaveBeenCalledOnce();
    });

    it('returns 500 when stop throws', async () => {
      const { app, mocks } = createApp();
      mocks.stop.mockRejectedValueOnce(new Error('Agent cleanup failed'));

      const res = await app.request('/api/coordinate/stop', { method: 'POST' });
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('Agent cleanup failed');
    });
  });

  // --- GET /api/coordinate/status ---
  describe('GET /api/coordinate/status', () => {
    it('returns current session state', async () => {
      const { app } = createApp();

      const res = await app.request('/api/coordinate/status');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.session).toBeDefined();
      expect(body.session.status).toBe('running');
      expect(body.session.intent).toBe('implement feature X');
    });

    it('returns null session when no session exists', async () => {
      const { app, mocks } = createApp();
      mocks.getSession.mockReturnValueOnce(null);

      const res = await app.request('/api/coordinate/status');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.session).toBeNull();
    });
  });

  // --- POST /api/coordinate/resume ---
  describe('POST /api/coordinate/resume', () => {
    it('resumes a session by id', async () => {
      const { app, mocks } = createApp();

      const res = await app.request('/api/coordinate/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'coord-test-abc12345' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.session).toBeDefined();
      expect(mocks.resume).toHaveBeenCalledWith('coord-test-abc12345');
    });

    it('resumes without sessionId (latest)', async () => {
      const { app, mocks } = createApp();

      const res = await app.request('/api/coordinate/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(mocks.resume).toHaveBeenCalledWith(undefined);
    });

    it('returns 404 when no session found', async () => {
      const { app, mocks } = createApp();
      mocks.resume.mockResolvedValueOnce(null);

      const res = await app.request('/api/coordinate/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error).toContain('No session found');
    });

    it('returns 500 when resume throws', async () => {
      const { app, mocks } = createApp();
      mocks.resume.mockRejectedValueOnce(new Error('Corrupt state file'));

      const res = await app.request('/api/coordinate/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('Corrupt state file');
    });
  });

  // --- POST /api/coordinate/clarify ---
  describe('POST /api/coordinate/clarify', () => {
    it('sends clarification response', async () => {
      const { app, mocks } = createApp();

      const res = await app.request('/api/coordinate/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'coord-test-abc12345', response: 'Use the staging DB' }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(mocks.clarify).toHaveBeenCalledWith('coord-test-abc12345', 'Use the staging DB');
    });

    it('returns 400 when sessionId is missing', async () => {
      const { app } = createApp();

      const res = await app.request('/api/coordinate/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: 'something' }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('sessionId');
    });

    it('returns 400 when response is missing', async () => {
      const { app } = createApp();

      const res = await app.request('/api/coordinate/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'coord-test-abc12345' }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain('response');
    });

    it('returns 500 when clarify throws', async () => {
      const { app, mocks } = createApp();
      mocks.clarify.mockRejectedValueOnce(new Error('Classification failed'));

      const res = await app.request('/api/coordinate/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'coord-test-abc12345', response: 'answer' }),
      });
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.error).toBe('Classification failed');
    });
  });
});
