import { Hono } from 'hono';

import type { StateManager } from '../state/state-manager.js';

/**
 * Board and project routes.
 *
 * GET /api/board    - full BoardState snapshot
 * GET /api/project  - project-level state (state.json)
 */
export function createBoardRoutes(stateManager: StateManager): Hono {
  const app = new Hono();

  app.get('/api/board', (c) => {
    return c.json(stateManager.getBoard());
  });

  app.get('/api/project', (c) => {
    return c.json(stateManager.getProject());
  });

  return app;
}
