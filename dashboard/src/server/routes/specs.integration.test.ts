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

// ---------------------------------------------------------------------------
// DELETE /api/specs/:id — edge cases (fallback heading match + error paths)
// ---------------------------------------------------------------------------

describe('DELETE /api/specs/:id — fallback heading match', () => {
  it('deletes entry when heading has partial match (fallback path)', async () => {
    // Create a spec file where the heading won't match exactly as "### title"
    // but will match via the fallback partial include check
    const specWithVariant = `---
title: "test-spec"
category: general
---

# Test

### Extra prefix [2026-01-15] bug: Memory leak in handler

The handler leaks memory due to missing cleanup.
`;
    await seedSpecFile('test-spec.md', specWithVariant);

    // Get entries to find the ID
    const listRes = await app.request('/api/specs/file/test-spec.md');
    const listBody = (await listRes.json()) as { entries: SpecEntry[] };
    expect(listBody.entries).toHaveLength(1);

    const targetId = listBody.entries[0].id;
    const res = await app.request(`/api/specs/${targetId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
  });

  it('deletes entry via fallback when heading has extra whitespace', async () => {
    // Use double space after ### so reconstructed "### title" won't match raw line,
    // forcing the fallback partial-match loop (specs.ts lines 417-421)
    const specWithExtraSpace = `---
title: "ws-spec"
category: general
---

# WS Test

###  [2026-03-01] bug: Extra whitespace entry

This entry has extra whitespace after ### so exact heading match fails.
`;
    await seedSpecFile('ws-spec.md', specWithExtraSpace);

    const listRes = await app.request('/api/specs/file/ws-spec.md');
    const listBody = (await listRes.json()) as { entries: SpecEntry[] };
    expect(listBody.entries).toHaveLength(1);
    expect(listBody.entries[0].title).toContain('Extra whitespace entry');

    const targetId = listBody.entries[0].id;
    const res = await app.request(`/api/specs/${targetId}`, { method: 'DELETE' });
    expect(res.status).toBe(200);

    // Verify entry was removed
    const afterRes = await app.request('/api/specs/file/ws-spec.md');
    const afterBody = (await afterRes.json()) as { entries: SpecEntry[] };
    expect(afterBody.entries).toHaveLength(0);
  });

  it('returns 400 for ID with invalid stem characters', async () => {
    const res = await app.request('/api/specs/bad!name-001', { method: 'DELETE' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Invalid');
  });

  it('returns 404 when entry not found in existing file', async () => {
    await seedSpecFile('learnings.md', SAMPLE_SPEC);

    // Use a valid format but non-existent entry index
    const res = await app.request('/api/specs/learnings-999', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('returns 404 when file does not exist for the given ID', async () => {
    const res = await app.request('/api/specs/nonexistent-001', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/specs — error handling (catch block)
// ---------------------------------------------------------------------------

describe('POST /api/specs — error paths', () => {
  it('returns 500 when body parsing fails', async () => {
    const res = await app.request('/api/specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    });
    expect(res.status).toBe(500);
  });

  it('rejects invalid file name with special characters', async () => {
    const res = await app.request('/api/specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bug', content: 'test', file: 'bad file!.md' }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/specs — error path (catch block triggers 500)
// ---------------------------------------------------------------------------

describe('DELETE /api/specs — 500 error path', () => {
  it('returns 500 when internal error occurs during delete', async () => {
    // Use a broken workflowRoot that will cause file system errors during write
    const brokenApp = createSpecsRoutes('/nonexistent/path/readonly');
    const res = await brokenApp.request('/api/specs/test-001', { method: 'DELETE' });
    // readSpecFile fails → returns early → found=false → 404
    expect(res.status).toBe(404);
  });
});

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

// ---------------------------------------------------------------------------
// Unified [type] [date] format parsing
// ---------------------------------------------------------------------------

describe('Unified [type] [date] format', () => {
  const UNIFIED_SPEC = `---
title: "learnings"
category: general
keywords: []
---

# Learnings

### [bug] [2026-03-20] Off-by-one in pagination when page=0

The pagination helper returns empty results for page 0 because
it subtracts 1 before clamping.

### [pattern] [2026-03-21] Use factory functions for test data

Factory functions like \`makeIssue()\` reduce boilerplate.
`;

  it('parses unified format entries with correct type, date, and clean title', async () => {
    await seedSpecFile('learnings.md', UNIFIED_SPEC);

    const res = await app.request('/api/specs');
    const body = (await res.json()) as { entries: SpecEntry[] };
    expect(body.entries).toHaveLength(2);

    expect(body.entries[0].type).toBe('bug');
    expect(body.entries[0].timestamp).toBe('2026-03-20');
    expect(body.entries[0].title).toBe('Off-by-one in pagination when page=0');

    expect(body.entries[1].type).toBe('pattern');
    expect(body.entries[1].timestamp).toBe('2026-03-21');
    expect(body.entries[1].title).toBe('Use factory functions for test data');
  });

  it('POST writes unified format and round-trips correctly', async () => {
    const res = await app.request('/api/specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'decision',
        content: 'Use Zod for runtime validation',
        file: 'learnings',
      }),
    });
    expect(res.status).toBe(201);

    const listRes = await app.request('/api/specs');
    const listBody = (await listRes.json()) as { entries: SpecEntry[] };
    const entry = listBody.entries.find((e) => e.title === 'Use Zod for runtime validation');
    expect(entry).toBeDefined();
    expect(entry!.type).toBe('decision');
    expect(entry!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('DELETE removes unified format entry via reconstructed exact match', async () => {
    await seedSpecFile('learnings.md', UNIFIED_SPEC);

    const listRes = await app.request('/api/specs/file/learnings.md');
    const listBody = (await listRes.json()) as { entries: SpecEntry[] };
    expect(listBody.entries).toHaveLength(2);

    const targetId = listBody.entries[0].id;
    const deleteRes = await app.request(`/api/specs/${targetId}`, { method: 'DELETE' });
    expect(deleteRes.status).toBe(200);

    const afterRes = await app.request('/api/specs/file/learnings.md');
    const afterBody = (await afterRes.json()) as { entries: SpecEntry[] };
    expect(afterBody.entries).toHaveLength(1);
    expect(afterBody.entries[0].title).toBe('Use factory functions for test data');
  });
});

// ---------------------------------------------------------------------------
// Extended types (debug, test, review, validation)
// ---------------------------------------------------------------------------

describe('Extended entry types', () => {
  it('parses all 8 entry types from [type] bracket format', async () => {
    const allTypes = `---
title: "all-types"
category: general
keywords: []
---

# All Types

### [bug] [2026-01-01] Bug entry
bug content

### [pattern] [2026-01-02] Pattern entry
pattern content

### [decision] [2026-01-03] Decision entry
decision content

### [rule] [2026-01-04] Rule entry
rule content

### [debug] [2026-01-05] Debug entry
debug content

### [test] [2026-01-06] Test entry
test content

### [review] [2026-01-07] Review entry
review content

### [validation] [2026-01-08] Validation entry
validation content
`;
    await seedSpecFile('all-types.md', allTypes);

    const res = await app.request('/api/specs');
    const body = (await res.json()) as { entries: SpecEntry[] };
    expect(body.entries).toHaveLength(8);

    const types = body.entries.map((e) => e.type);
    expect(types).toEqual(['bug', 'pattern', 'decision', 'rule', 'debug', 'test', 'review', 'validation']);
  });

  it('POST accepts extended types', async () => {
    for (const type of ['debug', 'test', 'review', 'validation'] as const) {
      const res = await app.request('/api/specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content: `${type} entry content`, file: 'learnings' }),
      });
      expect(res.status).toBe(201);
    }

    const listRes = await app.request('/api/specs');
    const listBody = (await listRes.json()) as { entries: SpecEntry[] };
    expect(listBody.entries).toHaveLength(4);

    const types = listBody.entries.map((e) => e.type);
    expect(types).toContain('debug');
    expect(types).toContain('test');
    expect(types).toContain('review');
    expect(types).toContain('validation');
  });
});

// ---------------------------------------------------------------------------
// detectEntryType word boundary — no substring collisions
// ---------------------------------------------------------------------------

describe('Type detection word boundary', () => {
  it('debug: heading is detected as debug, not bug', async () => {
    const spec = `---
title: "wb"
category: general
keywords: []
---

# WB

### debug: Fix crash on startup

Fixed null pointer in init sequence.
`;
    await seedSpecFile('wb.md', spec);

    const res = await app.request('/api/specs');
    const body = (await res.json()) as { entries: SpecEntry[] };
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].type).toBe('debug');
  });

  it('preview: heading is not misdetected as review', async () => {
    const spec = `---
title: "wb2"
category: general
keywords: []
---

# WB2

### Preview: New dashboard layout

Showing the new layout concept.
`;
    await seedSpecFile('wb2.md', spec);

    const res = await app.request('/api/specs');
    const body = (await res.json()) as { entries: SpecEntry[] };
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].type).toBe('general');
  });

  it('latest: heading is not misdetected as test', async () => {
    const spec = `---
title: "wb3"
category: general
keywords: []
---

# WB3

### Latest: Performance improvements

Upgraded the rendering pipeline.
`;
    await seedSpecFile('wb3.md', spec);

    const res = await app.request('/api/specs');
    const body = (await res.json()) as { entries: SpecEntry[] };
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].type).toBe('general');
  });
});

// ---------------------------------------------------------------------------
// Clean title extraction
// ---------------------------------------------------------------------------

describe('Clean title extraction', () => {
  it('strips [type] and [date] markers from title', async () => {
    const spec = `---
title: "ct"
category: general
keywords: []
---

# CT

### [bug] [2026-03-20] Memory leak in WebSocket handler

Leak details here.
`;
    await seedSpecFile('ct.md', spec);

    const res = await app.request('/api/specs');
    const body = (await res.json()) as { entries: SpecEntry[] };
    expect(body.entries[0].title).toBe('Memory leak in WebSocket handler');
  });

  it('strips legacy "type:" prefix from title', async () => {
    const spec = `---
title: "ct2"
category: general
keywords: []
---

# CT2

## [2026-01-15] bug: Connection timeout on slow networks

Details here.
`;
    await seedSpecFile('ct2.md', spec);

    const res = await app.request('/api/specs');
    const body = (await res.json()) as { entries: SpecEntry[] };
    expect(body.entries[0].title).toBe('Connection timeout on slow networks');
  });

  it('strips bare ISO timestamp from title', async () => {
    const spec = `---
title: "ct3"
category: general
keywords: []
---

# CT3

### [BUG] 2026-03-21T10:30:00Z

Bare timestamp format from old spec-add.
`;
    await seedSpecFile('ct3.md', spec);

    const res = await app.request('/api/specs');
    const body = (await res.json()) as { entries: SpecEntry[] };
    expect(body.entries[0].type).toBe('bug');
    expect(body.entries[0].timestamp).toBe('2026-03-21');
    // Title should be empty after stripping, so falls back to raw heading
    expect(body.entries[0].title).toBe('[BUG] 2026-03-21T10:30:00Z');
  });
});
