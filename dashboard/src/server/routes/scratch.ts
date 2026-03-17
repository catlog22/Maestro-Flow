import { Hono } from 'hono';

import type { StateManager } from '../state/state-manager.js';

/**
 * Scratch routes.
 *
 * GET /api/scratch - all non-phase scratch tasks
 */
export function createScratchRoutes(stateManager: StateManager): Hono {
  const app = new Hono();

  app.get('/api/scratch', (c) => {
    const board = stateManager.getBoard();
    return c.json(board.scratch);
  });

  return app;
}
