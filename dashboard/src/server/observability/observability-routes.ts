// ---------------------------------------------------------------------------
// Observability REST API routes -- cross-component event timeline
// ---------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Hono } from 'hono';

/**
 * Observability routes following the Hono factory pattern.
 *
 * GET  /api/observability/timeline   cross-component event timeline
 */
export function createObservabilityRoutes(workflowRoot: string): Hono {
  const app = new Hono();

  // GET /api/observability/timeline -- read timeline.jsonl entries
  app.get('/api/observability/timeline', async (c) => {
    const limit = Number(c.req.query('limit')) || 200;
    const filePath = join(workflowRoot, '.workflow', 'timeline.jsonl');

    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      return c.json({ timeline: [] });
    }

    const lines = raw.split('\n').filter((l) => l.trim());
    const entries = lines
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return c.json({ timeline: entries });
  });

  return app;
}
