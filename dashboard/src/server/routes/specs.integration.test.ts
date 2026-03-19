import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createSpecsRoutes } from './specs.js';
import type { SpecEntry } from './specs.js';

// ---------------------------------------------------------------------------
// L2 Integration: Specs routes <-> file system (markdown parsing + CRUD)
// Tests real cross-module interaction: route handlers → file I/O → markdown parser
// ---------------------------------------------------------------------------

let workflowRoot: string;
let app: ReturnType<typeof createSpecsRoutes>;

beforeEach(async () => {
  workflowRoot = join(tmpdir(), `specs-int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  await mkdir(workflowRoot, { recursive: true });
  app = createSpecsRoutes(workflowRoot);
});

afterEach(async () => {
  await rm(workflowRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedSpecFile(fileName: string, content: string): Promise<void> {
  const specsDir = join(workflowRoot, 'specs');
  await mkdir(specsDir, { recursive: true });
  await writeFile(join(specsDir, fileName), content, 'utf-8');
}

const SAMPLE_SPEC = `---
title: "learnings"
readMode: optional
priority: medium
category: general
keywords: []
---

# Learnings

## [2026-01-15] bug: Memory leak in WebSocket handler

The WebSocket handler was not cleaning up event listeners on disconnect,
causing memory to grow unboundedly over time.

## [2026-01-20] pattern: Use factory functions for test data

Factory functions like \`makeIssue()\` reduce boilerplate and ensure
consistent test data across test suites.
`;

// ---------------------------------------------------------------------------
// GET /api/specs — list all entries
// ---------------------------------------------------------------------------

describe('GET /api/specs — entries across files', () => {
  it('returns empty entries when no spec files exist', async () => {
    const res = await app.request('/api/specs');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: SpecEntry[] };
    expect(body.entries).toEqual([]);
  });

  it('parses entries from spec file with frontmatter', async () => {
    await seedSpecFile('learnings.md', SAMPLE_SPEC);

    const res = await app.request('/api/specs');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: SpecEntry[] };
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].type).toBe('bug');
    expect(body.entries[0].title).toContain('Memory leak');
    expect(body.entries[0].timestamp).toBe('2026-01-15');
    expect(body.entries[1].type).toBe('pattern');
  });

  it('aggregates entries from multiple files', async () => {
    await seedSpecFile('learnings.md', SAMPLE_SPEC);
    await seedSpecFile('rules.md', `---
title: "rules"
category: rules
---

# Rules

### [2026-02-01] rule: Always use ESM imports

All imports must use .js extensions for ESM compatibility.
`);

    const res = await app.request('/api/specs');
    const body = (await res.json()) as { entries: SpecEntry[] };
    expect(body.entries.length).toBeGreaterThanOrEqual(3);
    const types = body.entries.map((e) => e.type);
    expect(types).toContain('bug');
    expect(types).toContain('pattern');
    expect(types).toContain('rule');
  });
});

// ---------------------------------------------------------------------------
// GET /api/specs/files — list files with metadata
// ---------------------------------------------------------------------------

describe('GET /api/specs/files — file listing', () => {
  it('returns file metadata with entry counts', async () => {
    await seedSpecFile('learnings.md', SAMPLE_SPEC);

    const res = await app.request('/api/specs/files');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { files: Array<{ name: string; entryCount: number; title: string }> };
    expect(body.files).toHaveLength(1);
    expect(body.files[0].name).toBe('learnings.md');
    expect(body.files[0].title).toBe('learnings');
    expect(body.files[0].entryCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/specs/file/:name — read specific file
// ---------------------------------------------------------------------------

describe('GET /api/specs/file/:name — specific file', () => {
  it('returns file content and parsed entries', async () => {
    await seedSpecFile('learnings.md', SAMPLE_SPEC);

    const res = await app.request('/api/specs/file/learnings.md');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; content: string; entries: SpecEntry[] };
    expect(body.name).toBe('learnings.md');
    expect(body.content).toContain('Memory leak');
    expect(body.entries).toHaveLength(2);
  });

  it('returns 404 for non-existent file', async () => {
    const res = await app.request('/api/specs/file/nope.md');
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid file name', async () => {
    // Hono normalizes path traversal before the handler sees the param,
    // so use a name that fails the regex but won't be normalized away.
    const res = await app.request('/api/specs/file/bad file!.md');
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/specs — add new entry (cross-module: route → parser → file I/O)
// ---------------------------------------------------------------------------

describe('POST /api/specs — add entry (integration with file I/O)', () => {
  it('creates new entry in existing file', async () => {
    await seedSpecFile('learnings.md', SAMPLE_SPEC);

    const res = await app.request('/api/specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'bug',
        content: 'Race condition in event bus causes duplicate events',
        file: 'learnings',
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; id: string };
    expect(body.success).toBe(true);
    expect(body.id).toBeTruthy();

    // Verify persistence: read back via GET
    const listRes = await app.request('/api/specs/file/learnings.md');
    const listBody = (await listRes.json()) as { entries: SpecEntry[] };
    expect(listBody.entries).toHaveLength(3);
    const newEntry = listBody.entries.find((e) => e.title.includes('Race condition'));
    expect(newEntry).toBeDefined();
    expect(newEntry!.type).toBe('bug');
  });

  it('creates new file when file does not exist', async () => {
    // No specs dir yet
    const res = await app.request('/api/specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'decision',
        content: 'Use Vitest instead of Jest for ESM support',
        file: 'decisions',
      }),
    });

    expect(res.status).toBe(201);

    // Verify file was created
    const readRes = await app.request('/api/specs/file/decisions.md');
    expect(readRes.status).toBe(200);
    const readBody = (await readRes.json()) as { entries: SpecEntry[] };
    expect(readBody.entries).toHaveLength(1);
  });

  it('rejects missing content', async () => {
    const res = await app.request('/api/specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bug', file: 'learnings' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('content');
  });

  it('rejects missing file', async () => {
    const res = await app.request('/api/specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bug', content: 'Some bug' }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('file');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/specs/:id — remove entry (integration: route → parser → file rewrite)
// ---------------------------------------------------------------------------

describe('DELETE /api/specs/:id — remove entry', () => {
  it('deletes entry and persists to file', async () => {
    await seedSpecFile('learnings.md', SAMPLE_SPEC);

    // First, get the entries to find an ID
    const listRes = await app.request('/api/specs/file/learnings.md');
    const listBody = (await listRes.json()) as { entries: SpecEntry[] };
    const targetId = listBody.entries[0].id;

    const res = await app.request(`/api/specs/${targetId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    // Verify removal — check by title since IDs are position-based and shift after deletion
    const targetTitle = listBody.entries[0].title;
    const afterRes = await app.request('/api/specs/file/learnings.md');
    const afterBody = (await afterRes.json()) as { entries: SpecEntry[] };
    expect(afterBody.entries).toHaveLength(1);
    expect(afterBody.entries.find((e) => e.title === targetTitle)).toBeUndefined();
  });

  it('returns 404 for non-existent entry', async () => {
    await seedSpecFile('learnings.md', SAMPLE_SPEC);

    const res = await app.request('/api/specs/learnings-999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid ID format', async () => {
    const res = await app.request('/api/specs/noid', { method: 'DELETE' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Full CRUD cycle: create → read → delete → verify gone
// ---------------------------------------------------------------------------

describe('Full CRUD integration cycle', () => {
  it('create entry → list → delete → verify empty', async () => {
    // Create
    const createRes = await app.request('/api/specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'pattern',
        content: 'Always use temp dirs for filesystem tests',
        file: 'test-patterns',
      }),
    });
    expect(createRes.status).toBe(201);
    const { id } = (await createRes.json()) as { id: string };

    // List
    const listRes = await app.request('/api/specs');
    const listBody = (await listRes.json()) as { entries: SpecEntry[] };
    expect(listBody.entries.some((e) => e.id === id)).toBe(true);

    // Delete
    const deleteRes = await app.request(`/api/specs/${id}`, { method: 'DELETE' });
    expect(deleteRes.status).toBe(200);

    // Verify gone
    const afterRes = await app.request('/api/specs');
    const afterBody = (await afterRes.json()) as { entries: SpecEntry[] };
    expect(afterBody.entries.find((e) => e.id === id)).toBeUndefined();
  });
});
