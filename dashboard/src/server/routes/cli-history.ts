// ---------------------------------------------------------------------------
// CLI History REST API routes
// Lightweight filesystem reader for ~/.maestro/cli-history/ — avoids
// cross-rootDir import of CliHistoryStore from src/.
// ---------------------------------------------------------------------------

import { Hono } from 'hono';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, readdirSync, statSync } from 'node:fs';

interface ExecutionMeta {
  execId: string;
  tool: string;
  model?: string;
  mode: string;
  prompt: string;
  workDir: string;
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
}

function getCliHistoryDir(): string {
  const maestroHome = process.env.MAESTRO_HOME ?? join(homedir(), '.maestro');
  return join(maestroHome, 'cli-history');
}

/**
 * CLI history routes.
 *
 * GET /api/cli-history            - list recent executions (?limit=20)
 * GET /api/cli-history/:id/entries - load JSONL entries for an execution
 */
export function createCliHistoryRoutes(): Hono {
  const app = new Hono();

  // GET /api/cli-history
  app.get('/api/cli-history', (c) => {
    const limitParam = c.req.query('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 20;
    const dir = getCliHistoryDir();

    try {
      const files = readdirSync(dir)
        .filter(f => f.endsWith('.meta.json'))
        .map(f => ({
          name: f,
          mtime: statSync(join(dir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, limit);

      const results: ExecutionMeta[] = [];
      for (const f of files) {
        try {
          const raw = readFileSync(join(dir, f.name), 'utf-8');
          results.push(JSON.parse(raw) as ExecutionMeta);
        } catch {
          // skip corrupt meta files
        }
      }
      return c.json(results);
    } catch {
      // Directory doesn't exist or unreadable — return empty
      return c.json([]);
    }
  });

  // GET /api/cli-history/:id/entries
  app.get('/api/cli-history/:id/entries', (c) => {
    const id = c.req.param('id');

    // Whitelist validation: execId format is {prefix}-{HHmmss}-{hex4} or user-provided alphanumeric
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(id)) {
      return c.json({ error: 'Invalid execution ID' }, 400);
    }

    const dir = getCliHistoryDir();
    const jsonlPath = join(dir, `${id}.jsonl`);

    try {
      const raw = readFileSync(jsonlPath, 'utf-8');
      const entries: unknown[] = [];
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          entries.push(JSON.parse(trimmed));
        } catch {
          // skip malformed lines
        }
      }
      return c.json(entries);
    } catch {
      return c.json({ error: 'Execution not found' }, 404);
    }
  });

  return app;
}
