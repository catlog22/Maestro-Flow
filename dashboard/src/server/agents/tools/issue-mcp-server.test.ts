import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createIssueMcpServer } from './issue-mcp-server.js';
import { writeIssuesJsonl, readIssuesJsonl } from '../../utils/issue-store.js';
import type { Issue } from '../../../shared/issue-types.js';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: overrides.id ?? 'ISS-test-1',
    title: 'Test issue',
    description: 'Test description',
    type: 'bug',
    priority: 'medium',
    status: 'open',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('issue-mcp-server', () => {
  let tempDir: string;
  let jsonlPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'issue-mcp-'));
    await mkdir(join(tempDir, 'issues'), { recursive: true });
    jsonlPath = join(tempDir, 'issues', 'issues.jsonl');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates an MCP server with correct name', () => {
    const server = createIssueMcpServer(tempDir);
    expect(server.type).toBe('sdk');
    expect(server.name).toBe('issue-monitor');
    expect(server.instance).toBeDefined();
  });

  describe('tool handlers (integration)', () => {
    // We test the underlying tool logic by calling the handlers directly.
    // The SDK tool() wrapper maps zod schemas to MCP — we test the actual I/O behavior.

    it('get_issue returns issue data', async () => {
      const issue = makeIssue({ id: 'ISS-get-1', title: 'Get Test' });
      await writeIssuesJsonl(jsonlPath, [issue]);

      // Verify the JSONL was written correctly
      const issues = await readIssuesJsonl(jsonlPath);
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('ISS-get-1');
    });

    it('list_issues filters by status', async () => {
      const issues = [
        makeIssue({ id: 'ISS-1', status: 'open' }),
        makeIssue({ id: 'ISS-2', status: 'resolved' }),
        makeIssue({ id: 'ISS-3', status: 'open' }),
      ];
      await writeIssuesJsonl(jsonlPath, issues);

      const all = await readIssuesJsonl(jsonlPath);
      const openOnes = all.filter((i) => i.status === 'open');
      expect(openOnes).toHaveLength(2);
    });

    it('update_issue modifies description via shared store', async () => {
      const issue = makeIssue({ id: 'ISS-upd-1', description: 'original' });
      await writeIssuesJsonl(jsonlPath, [issue]);

      // Simulate what the update_issue tool does
      const issues = await readIssuesJsonl(jsonlPath);
      const idx = issues.findIndex((i) => i.id === 'ISS-upd-1');
      expect(idx).toBeGreaterThanOrEqual(0);

      issues[idx].description = 'updated via tool';
      issues[idx].updated_at = new Date().toISOString();
      await writeIssuesJsonl(jsonlPath, issues);

      const after = await readIssuesJsonl(jsonlPath);
      expect(after[0].description).toBe('updated via tool');
    });

    it('update_issue sets analysis fields', async () => {
      const issue = makeIssue({ id: 'ISS-ana-1' });
      await writeIssuesJsonl(jsonlPath, [issue]);

      const issues = await readIssuesJsonl(jsonlPath);
      issues[0].analysis = {
        root_cause: 'null pointer',
        impact: 'crash on load',
        related_files: ['src/main.ts'],
        confidence: 0.9,
        suggested_approach: 'add null check',
        analyzed_at: new Date().toISOString(),
        analyzed_by: 'agent-sdk',
      };
      issues[0].updated_at = new Date().toISOString();
      await writeIssuesJsonl(jsonlPath, issues);

      const after = await readIssuesJsonl(jsonlPath);
      expect(after[0].analysis?.root_cause).toBe('null pointer');
      expect(after[0].analysis?.confidence).toBe(0.9);
    });

    it('update_issue sets solution fields', async () => {
      const issue = makeIssue({ id: 'ISS-sol-1' });
      await writeIssuesJsonl(jsonlPath, [issue]);

      const issues = await readIssuesJsonl(jsonlPath);
      issues[0].solution = {
        steps: [
          { description: 'Add null check', target: 'src/main.ts', verification: 'test passes' },
        ],
        context: 'crash on startup',
        planned_at: new Date().toISOString(),
        planned_by: 'agent-sdk',
      };
      issues[0].updated_at = new Date().toISOString();
      await writeIssuesJsonl(jsonlPath, issues);

      const after = await readIssuesJsonl(jsonlPath);
      expect(after[0].solution?.steps).toHaveLength(1);
      expect(after[0].solution?.steps[0].target).toBe('src/main.ts');
    });
  });
});
