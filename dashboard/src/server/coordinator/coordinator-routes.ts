// ---------------------------------------------------------------------------
// Coordinator REST API routes -- start, stop, status, resume, clarify
// ---------------------------------------------------------------------------

import { Hono } from 'hono';

import type { WorkflowCoordinator } from './workflow-coordinator.js';

/**
 * Coordinator routes following the Hono factory pattern.
 *
 * POST  /api/coordinate/start    start a new coordinate session
 * POST  /api/coordinate/stop     stop the current session
 * GET   /api/coordinate/status   current session state
 * POST  /api/coordinate/resume   resume a stopped/persisted session
 * POST  /api/coordinate/clarify  answer a clarification question
 */
export function createCoordinatorRoutes(coordinator: WorkflowCoordinator): Hono {
  const app = new Hono();

  // POST /api/coordinate/start -- start a new coordinate session
  app.post('/api/coordinate/start', async (c) => {
    try {
      const body = await c.req.json<{
        intent: string;
        tool?: string;
        autoMode?: boolean;
        chainName?: string;
        phase?: string;
      }>();
      if (!body.intent) {
        return c.json({ error: 'Missing required field: intent' }, 400);
      }
      const session = await coordinator.start(body.intent, {
        tool: body.tool,
        autoMode: body.autoMode,
        chainName: body.chainName,
        phase: body.phase,
      });
      return c.json({ ok: true, session });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/coordinate/stop -- stop the current session
  app.post('/api/coordinate/stop', async (c) => {
    try {
      await coordinator.stop();
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // GET /api/coordinate/status -- current session snapshot
  app.get('/api/coordinate/status', (c) => {
    const session = coordinator.getSession();
    return c.json({ session });
  });

  // POST /api/coordinate/resume -- resume a persisted session
  app.post('/api/coordinate/resume', async (c) => {
    try {
      const body = await c.req.json<{ sessionId?: string }>().catch(() => ({} as { sessionId?: string }));
      const session = await coordinator.resume(body.sessionId);
      if (!session) {
        return c.json({ error: 'No session found to resume' }, 404);
      }
      return c.json({ ok: true, session });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/coordinate/clarify -- answer a clarification question
  app.post('/api/coordinate/clarify', async (c) => {
    try {
      const body = await c.req.json<{ sessionId: string; response: string }>();
      if (!body.sessionId || !body.response) {
        return c.json({ error: 'Missing required fields: sessionId, response' }, 400);
      }
      await coordinator.clarify(body.sessionId, body.response);
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
