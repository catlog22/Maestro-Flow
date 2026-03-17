import { Hono } from 'hono';

import type { StateManager } from '../state/state-manager.js';

/**
 * Phase routes.
 *
 * GET /api/phases          - all phases as PhaseCard[]
 * GET /api/phases/:n       - single phase detail
 * GET /api/phases/:n/tasks - tasks for a specific phase
 */
export function createPhaseRoutes(stateManager: StateManager): Hono {
  const app = new Hono();

  app.get('/api/phases', (c) => {
    const board = stateManager.getBoard();
    return c.json(board.phases);
  });

  app.get('/api/phases/:n', (c) => {
    const n = parseInt(c.req.param('n'), 10);
    if (Number.isNaN(n)) {
      return c.json({ error: 'Invalid phase number' }, 400);
    }

    const phase = stateManager.getPhase(n);
    if (!phase) {
      return c.json({ error: `Phase ${n} not found` }, 404);
    }

    return c.json(phase);
  });

  app.get('/api/phases/:n/tasks', async (c) => {
    const n = parseInt(c.req.param('n'), 10);
    if (Number.isNaN(n)) {
      return c.json({ error: 'Invalid phase number' }, 400);
    }

    const phase = stateManager.getPhase(n);
    if (!phase) {
      return c.json({ error: `Phase ${n} not found` }, 404);
    }

    const tasks = await stateManager.getTasks(n);
    return c.json(tasks);
  });

  return app;
}
