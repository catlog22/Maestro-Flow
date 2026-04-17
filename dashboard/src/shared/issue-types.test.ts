import { describe, it, expect } from 'vitest';

import type { Issue, IssueAnalysis, IssueSolution } from './issue-types.js';
import { getDisplayStatus, ISSUE_DISPLAY_STATUS_COLORS } from './constants.js';
import type { DisplayStatus } from './constants.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'ISS-test-001',
    title: 'Test issue',
    description: 'A test issue',
    type: 'bug',
    priority: 'medium',
    status: 'open',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const sampleAnalysis: IssueAnalysis = {
  root_cause: 'Memory leak in event handler',
  impact: 'High memory usage over time',
  related_files: ['src/handlers/event.ts'],
  confidence: 0.85,
  suggested_approach: 'Remove event listener on cleanup',
  analyzed_at: '2026-01-01T00:00:00Z',
  analyzed_by: 'claude-code',
};

const sampleSolution: IssueSolution = {
  steps: [{ description: 'Fix handler', target: 'event.ts', verification: 'No leak in profiler' }],
  context: 'Event handler module',
  planned_at: '2026-01-01T01:00:00Z',
  planned_by: 'claude-code',
};

// ---------------------------------------------------------------------------
// IssueAnalysis interface shape
// ---------------------------------------------------------------------------

describe('IssueAnalysis interface', () => {
  it('has all required fields with correct types', () => {
    const a: IssueAnalysis = sampleAnalysis;
    expect(typeof a.root_cause).toBe('string');
    expect(typeof a.impact).toBe('string');
    expect(Array.isArray(a.related_files)).toBe(true);
    expect(typeof a.confidence).toBe('number');
    expect(a.confidence).toBeGreaterThanOrEqual(0);
    expect(a.confidence).toBeLessThanOrEqual(1);
    expect(typeof a.suggested_approach).toBe('string');
    expect(typeof a.analyzed_at).toBe('string');
    expect(typeof a.analyzed_by).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Issue interface extensions
// ---------------------------------------------------------------------------

describe('Issue interface extensions', () => {
  it('analysis is optional', () => {
    const issue = makeIssue();
    expect(issue.analysis).toBeUndefined();
  });

  it('accepts analysis field', () => {
    const issue = makeIssue({ analysis: sampleAnalysis });
    expect(issue.analysis?.root_cause).toBe('Memory leak in event handler');
  });

  it('path is optional with correct union type', () => {
    const standalone = makeIssue({ path: 'standalone' });
    const workflow = makeIssue({ path: 'workflow' });
    expect(standalone.path).toBe('standalone');
    expect(workflow.path).toBe('workflow');
  });

  it('phase_id is optional', () => {
    const issue = makeIssue({ phase_id: 3 });
    expect(issue.phase_id).toBe(3);
  });

  it('solution accepts planned_at and planned_by', () => {
    const issue = makeIssue({ solution: sampleSolution });
    expect(issue.solution?.planned_at).toBe('2026-01-01T01:00:00Z');
    expect(issue.solution?.planned_by).toBe('claude-code');
  });
});

// ---------------------------------------------------------------------------
// getDisplayStatus derivation
// ---------------------------------------------------------------------------

describe('getDisplayStatus', () => {
  it('returns open for bare open issue', () => {
    expect(getDisplayStatus(makeIssue({ status: 'open' }))).toBe('open');
  });

  it('returns analyzing when open + analysis exists', () => {
    expect(getDisplayStatus(makeIssue({ status: 'open', analysis: sampleAnalysis }))).toBe('analyzing');
  });

  it('returns planned when open + solution exists', () => {
    expect(getDisplayStatus(makeIssue({ status: 'open', solution: sampleSolution }))).toBe('planned');
  });

  it('planned takes priority over analyzing when both exist', () => {
    expect(getDisplayStatus(makeIssue({
      status: 'open',
      analysis: sampleAnalysis,
      solution: sampleSolution,
    }))).toBe('planned');
  });

  it('returns in_progress for in_progress status regardless of metadata', () => {
    expect(getDisplayStatus(makeIssue({ status: 'in_progress', analysis: sampleAnalysis }))).toBe('in_progress');
  });

  it('returns resolved for resolved status', () => {
    expect(getDisplayStatus(makeIssue({ status: 'resolved' }))).toBe('resolved');
  });

  it('returns closed for closed status', () => {
    expect(getDisplayStatus(makeIssue({ status: 'closed' }))).toBe('closed');
  });
});

// ---------------------------------------------------------------------------
// ISSUE_DISPLAY_STATUS_COLORS
// ---------------------------------------------------------------------------

describe('ISSUE_DISPLAY_STATUS_COLORS', () => {
  it('has entries for all 8 display statuses', () => {
    const expected: DisplayStatus[] = ['open', 'registered', 'analyzing', 'planned', 'in_progress', 'resolved', 'closed', 'deferred'];
    for (const status of expected) {
      expect(ISSUE_DISPLAY_STATUS_COLORS[status]).toBeDefined();
      expect(typeof ISSUE_DISPLAY_STATUS_COLORS[status]).toBe('string');
    }
  });

  it('has exactly 8 entries', () => {
    expect(Object.keys(ISSUE_DISPLAY_STATUS_COLORS)).toHaveLength(8);
  });
});
