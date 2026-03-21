import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

import { Hono } from 'hono';

import type { StateManager } from '../state/state-manager.js';

export function createHealthRoute(workflowRoot: string, stateManager?: StateManager): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => {
    return c.json({
      status: 'ok',
      version: '0.1.0',
      workspace: stateManager ? stateManager.getWorkspaceRoot() : resolve(workflowRoot, '..'),
    });
  });

  app.post('/api/shutdown', (c) => {
    // Respond before shutting down so the client sees success
    setTimeout(() => {
      console.log('Shutdown requested via API, exiting...');
      process.exit(0);
    }, 200);
    return c.json({ status: 'shutting_down' });
  });

  app.post('/api/workspace', async (c) => {
    if (!stateManager) {
      return c.json({ error: 'stateManager not available' }, 500);
    }

    let body: { path?: string };
    try {
      body = await c.req.json<{ path?: string }>();
    } catch {
      return c.json({ error: 'invalid path' }, 400);
    }

    const newPath = body?.path;
    if (!newPath || !existsSync(join(newPath, '.workflow'))) {
      return c.json({ error: 'invalid path' }, 400);
    }

    try {
      await stateManager.resetForNewWorkspace(join(newPath, '.workflow'));
    } catch (err) {
      if (err instanceof Error && err.message.includes('already in progress')) {
        return c.json({ error: 'Workspace switch already in progress' }, 429);
      }
      throw err;
    }
    return c.json({ status: 'ok', workspace: newPath });
  });

  // Browse directories for workspace selection
  app.get('/api/workspace/browse', (c) => {
    const target = c.req.query('path') || resolve(workflowRoot, '..');
    const resolved = resolve(target);

    if (!existsSync(resolved)) {
      return c.json({ error: 'Path does not exist' }, 400);
    }

    try {
      const stat = statSync(resolved);
      if (!stat.isDirectory()) {
        return c.json({ error: 'Not a directory' }, 400);
      }

      const entries = readdirSync(resolved, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .map((d) => {
          const fullPath = join(resolved, d.name);
          const hasWorkflow = existsSync(join(fullPath, '.workflow'));
          return { name: d.name, path: fullPath, hasWorkflow };
        })
        .sort((a, b) => {
          // Workspaces first, then alphabetical
          if (a.hasWorkflow !== b.hasWorkflow) return a.hasWorkflow ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return c.json({
        current: resolved,
        parent: dirname(resolved) !== resolved ? dirname(resolved) : null,
        entries,
      });
    } catch {
      return c.json({ error: 'Cannot read directory' }, 400);
    }
  });

  return app;
}
