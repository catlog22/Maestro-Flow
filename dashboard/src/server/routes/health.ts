import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Hono } from 'hono';

import type { StateManager } from '../state/state-manager.js';

// ---------------------------------------------------------------------------
// Version helpers
// ---------------------------------------------------------------------------

function readCurrentVersion(): string {
  try {
    // Compiled JS at dashboard/dist-server/.../routes/health.js
    // Walk up to project root to find package.json
    const dir = dirname(fileURLToPath(import.meta.url));
    // Try multiple levels to find package.json with name "maestro-flow"
    let cur = dir;
    for (let i = 0; i < 8; i++) {
      const pkgPath = join(cur, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === 'maestro-flow') return (pkg.version as string) ?? '0.0.0';
      }
      const parent = dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
  } catch { /* fallback below */ }
  return '0.0.0';
}

const CURRENT_VERSION = readCurrentVersion();

// ---------------------------------------------------------------------------
// npm registry version cache (non-blocking, 30-min TTL)
// ---------------------------------------------------------------------------

const PACKAGE_NAME = 'maestro-flow';
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const VERSION_CHECK_TTL_MS = 30 * 60 * 1000;

let versionCache: { latest: string; checkedAt: number } | null = null;

function triggerVersionCheck(): void {
  if (versionCache && Date.now() - versionCache.checkedAt < VERSION_CHECK_TTL_MS) return;
  // Fire-and-forget — never blocks the response
  fetch(REGISTRY_URL, { signal: AbortSignal.timeout(5000) })
    .then((r) => r.json())
    .then((data: any) => {
      if (data?.version) {
        versionCache = { latest: data.version as string, checkedAt: Date.now() };
      }
    })
    .catch(() => { /* silently ignore */ });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function createHealthRoute(workflowRoot: string, stateManager?: StateManager): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => {
    triggerVersionCheck();
    return c.json({
      status: 'ok',
      version: CURRENT_VERSION,
      latestVersion: versionCache?.latest ?? null,
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
