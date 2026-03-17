// ---------------------------------------------------------------------------
// Issue REST API routes -- JSONL-backed CRUD for issues
// ---------------------------------------------------------------------------

import { Hono } from 'hono';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type {
  Issue,
  CreateIssueRequest,
  UpdateIssueRequest,
  IssueType,
  IssuePriority,
  IssueStatus,
} from '../../shared/issue-types.js';
import {
  VALID_ISSUE_TYPES,
  VALID_ISSUE_PRIORITIES,
  VALID_ISSUE_STATUSES,
} from '../../shared/issue-types.js';

// ---------------------------------------------------------------------------
// JSONL helpers
// ---------------------------------------------------------------------------

/** Generate a unique issue ID: ISS-{timestamp_base36}-{random_4char} */
function generateIssueId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `ISS-${ts}-${rand}`;
}

/** Read all issues from a JSONL file. Returns [] if file does not exist. */
async function readIssuesJsonl(filePath: string): Promise<Issue[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch {
    return [];
  }
  const issues: Issue[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      issues.push(JSON.parse(trimmed) as Issue);
    } catch {
      // Skip malformed lines
    }
  }
  return issues;
}

/** Write all issues to a JSONL file (one JSON object per line). */
async function writeIssuesJsonl(filePath: string, issues: Issue[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const content = issues.map((i) => JSON.stringify(i)).join('\n') + '\n';
  await writeFile(filePath, content, 'utf-8');
}

/** Append a single issue to the JSONL file. */
async function appendIssueJsonl(filePath: string, issue: Issue): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  let existing = '';
  try {
    existing = await readFile(filePath, 'utf-8');
  } catch {
    // File does not exist yet
  }
  const sep = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  await writeFile(filePath, existing + sep + JSON.stringify(issue) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Write lock — simple single-writer guard for JSONL file operations
// ---------------------------------------------------------------------------

let writeLock: Promise<void> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeLock;
  let resolve!: () => void;
  writeLock = new Promise<void>((r) => { resolve = r; });
  return prev.then(fn).finally(resolve);
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

/**
 * Issue routes following the Hono factory pattern.
 *
 * GET    /api/issues         - list all issues (optional ?status=&type= filters)
 * POST   /api/issues         - create a new issue
 * PATCH  /api/issues/:id     - update an existing issue
 * DELETE /api/issues/:id     - delete an issue
 */
export function createIssueRoutes(workflowRoot: string): Hono {
  const app = new Hono();
  const jsonlPath = join(workflowRoot, 'issues', 'issues.jsonl');

  // GET /api/issues
  app.get('/api/issues', async (c) => {
    try {
      let issues = await readIssuesJsonl(jsonlPath);

      const statusFilter = c.req.query('status');
      if (statusFilter && VALID_ISSUE_STATUSES.has(statusFilter)) {
        issues = issues.filter((i) => i.status === statusFilter);
      }

      const typeFilter = c.req.query('type');
      if (typeFilter && VALID_ISSUE_TYPES.has(typeFilter)) {
        issues = issues.filter((i) => i.type === typeFilter);
      }

      return c.json(issues);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // POST /api/issues
  app.post('/api/issues', async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();

      // Validate required fields
      if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
        return c.json({ error: 'Missing or invalid "title" field' }, 400);
      }
      if (!body.description || typeof body.description !== 'string') {
        return c.json({ error: 'Missing or invalid "description" field' }, 400);
      }

      // Validate optional enum fields
      if (body.type !== undefined && !VALID_ISSUE_TYPES.has(body.type as string)) {
        return c.json({ error: `Invalid "type": ${String(body.type)}` }, 400);
      }
      if (body.priority !== undefined && !VALID_ISSUE_PRIORITIES.has(body.priority as string)) {
        return c.json({ error: `Invalid "priority": ${String(body.priority)}` }, 400);
      }

      const now = new Date().toISOString();
      const issue: Issue = {
        id: generateIssueId(),
        title: (body.title as string).trim(),
        description: body.description as string,
        type: (body.type as IssueType | undefined) ?? 'task',
        priority: (body.priority as IssuePriority | undefined) ?? 'medium',
        status: 'open',
        created_at: now,
        updated_at: now,
      };

      // Attach optional source fields
      if (body.source_entry_id && typeof body.source_entry_id === 'string') {
        issue.source_entry_id = body.source_entry_id;
      }
      if (body.source_process_id && typeof body.source_process_id === 'string') {
        issue.source_process_id = body.source_process_id;
      }

      await withWriteLock(() => appendIssueJsonl(jsonlPath, issue));
      return c.json(issue, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // PATCH /api/issues/:id
  app.patch('/api/issues/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<Record<string, unknown>>();

      // Validate optional enum fields
      if (body.type !== undefined && !VALID_ISSUE_TYPES.has(body.type as string)) {
        return c.json({ error: `Invalid "type": ${String(body.type)}` }, 400);
      }
      if (body.priority !== undefined && !VALID_ISSUE_PRIORITIES.has(body.priority as string)) {
        return c.json({ error: `Invalid "priority": ${String(body.priority)}` }, 400);
      }
      if (body.status !== undefined && !VALID_ISSUE_STATUSES.has(body.status as string)) {
        return c.json({ error: `Invalid "status": ${String(body.status)}` }, 400);
      }

      let updated: Issue | null = null;

      await withWriteLock(async () => {
        const issues = await readIssuesJsonl(jsonlPath);
        const idx = issues.findIndex((i) => i.id === id);
        if (idx === -1) return;

        const patch: Partial<UpdateIssueRequest> = {};
        if (body.title !== undefined && typeof body.title === 'string') patch.title = body.title.trim();
        if (body.description !== undefined && typeof body.description === 'string') patch.description = body.description;
        if (body.type !== undefined) patch.type = body.type as IssueType;
        if (body.priority !== undefined) patch.priority = body.priority as IssuePriority;
        if (body.status !== undefined) patch.status = body.status as IssueStatus;

        issues[idx] = {
          ...issues[idx],
          ...patch,
          updated_at: new Date().toISOString(),
        };
        updated = issues[idx];
        await writeIssuesJsonl(jsonlPath, issues);
      });

      if (!updated) {
        return c.json({ error: `Issue not found: ${id}` }, 404);
      }
      return c.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  // DELETE /api/issues/:id
  app.delete('/api/issues/:id', async (c) => {
    try {
      const id = c.req.param('id');
      let found = false;

      await withWriteLock(async () => {
        const issues = await readIssuesJsonl(jsonlPath);
        const filtered = issues.filter((i) => i.id !== id);
        if (filtered.length < issues.length) {
          found = true;
          await writeIssuesJsonl(jsonlPath, filtered);
        }
      });

      if (!found) {
        return c.json({ error: `Issue not found: ${id}` }, 404);
      }
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: message }, 500);
    }
  });

  return app;
}
