import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  generateIssueId,
  readIssuesJsonl,
  writeIssuesJsonl,
  appendIssueJsonl,
  withIssueWriteLock,
} from './issue-store.js';
import type { Issue } from '../../shared/issue-types.js';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: overrides.id ?? generateIssueId(),
    title: 'Test issue',
    description: 'Test description',
    type: 'bug',
    priority: 'medium',
    status: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('issue-store', () => {
  let tempDir: string;
  let jsonlPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'issue-store-'));
    jsonlPath = join(tempDir, 'issues', 'issues.jsonl');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('generateIssueId', () => {
    it('generates ISS- prefixed IDs', () => {
      const id = generateIssueId();
      expect(id).toMatch(/^ISS-[a-z0-9]+-[a-z0-9]+$/);
    });

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateIssueId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('readIssuesJsonl', () => {
    it('returns empty array for non-existent file', async () => {
      const issues = await readIssuesJsonl(jsonlPath);
      expect(issues).toEqual([]);
    });

    it('reads written issues', async () => {
      const issue = makeIssue({ id: 'ISS-test-1' });
      await writeIssuesJsonl(jsonlPath, [issue]);
      const issues = await readIssuesJsonl(jsonlPath);
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('ISS-test-1');
    });
  });

  describe('writeIssuesJsonl', () => {
    it('creates directory and writes JSONL', async () => {
      const issues = [makeIssue({ id: 'ISS-a' }), makeIssue({ id: 'ISS-b' })];
      await writeIssuesJsonl(jsonlPath, issues);

      const raw = await readFile(jsonlPath, 'utf-8');
      const lines = raw.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).id).toBe('ISS-a');
      expect(JSON.parse(lines[1]).id).toBe('ISS-b');
    });
  });

  describe('appendIssueJsonl', () => {
    it('appends to existing file', async () => {
      await writeIssuesJsonl(jsonlPath, [makeIssue({ id: 'ISS-first' })]);
      await appendIssueJsonl(jsonlPath, makeIssue({ id: 'ISS-second' }));

      const issues = await readIssuesJsonl(jsonlPath);
      expect(issues).toHaveLength(2);
      expect(issues[0].id).toBe('ISS-first');
      expect(issues[1].id).toBe('ISS-second');
    });

    it('creates file if it does not exist', async () => {
      await appendIssueJsonl(jsonlPath, makeIssue({ id: 'ISS-only' }));
      const issues = await readIssuesJsonl(jsonlPath);
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('ISS-only');
    });
  });

  describe('withIssueWriteLock', () => {
    it('serializes concurrent writes', async () => {
      const order: number[] = [];

      const p1 = withIssueWriteLock(async () => {
        await new Promise((r) => setTimeout(r, 50));
        order.push(1);
      });
      const p2 = withIssueWriteLock(async () => {
        order.push(2);
      });

      await Promise.all([p1, p2]);
      expect(order).toEqual([1, 2]);
    });

    it('propagates errors without breaking the lock', async () => {
      await expect(
        withIssueWriteLock(async () => { throw new Error('fail'); }),
      ).rejects.toThrow('fail');

      // Lock should still work after error
      const result = await withIssueWriteLock(async () => 'ok');
      expect(result).toBe('ok');
    });
  });
});
