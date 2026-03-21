import { describe, it, expect } from 'vitest';
import {
  buildAssessmentPrompt,
  COMMANDER_SYSTEM_PROMPT,
  COMMANDER_OUTPUT_SCHEMA,
} from './commander-prompts.js';
import type { AssessmentContext } from './commander-prompts.js';
import type { ProjectState } from '../../shared/types.js';

function makeProject(overrides: Partial<ProjectState> = {}): ProjectState {
  return {
    version: '1.0',
    project_name: 'test-project',
    current_milestone: 'M1',
    current_phase: 1,
    status: 'executing',
    phases_summary: { total: 2, completed: 0, in_progress: 1, pending: 1 },
    last_updated: '2026-01-01T00:00:00Z',
    accumulated_context: { key_decisions: [], blockers: [], deferred: [] },
    ...overrides,
  };
}

function makeContext(overrides: Partial<AssessmentContext> = {}): AssessmentContext {
  return {
    project: makeProject(),
    openIssues: [],
    runningWorkers: 0,
    maxWorkers: 3,
    recentDecisions: [],
    workDir: '/tmp/test',
    ...overrides,
  };
}

describe('commander-prompts', () => {
  describe('COMMANDER_SYSTEM_PROMPT', () => {
    it('is a non-empty string', () => {
      expect(typeof COMMANDER_SYSTEM_PROMPT).toBe('string');
      expect(COMMANDER_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    it('contains key role instructions', () => {
      expect(COMMANDER_SYSTEM_PROMPT).toContain('Commander Agent');
      expect(COMMANDER_SYSTEM_PROMPT).toContain('priority_actions');
      expect(COMMANDER_SYSTEM_PROMPT).toContain('execute_issue');
    });
  });

  describe('COMMANDER_OUTPUT_SCHEMA', () => {
    it('has json_schema type', () => {
      expect(COMMANDER_OUTPUT_SCHEMA.type).toBe('json_schema');
    });

    it('schema requires priority_actions, observations, risks', () => {
      const schema = COMMANDER_OUTPUT_SCHEMA.schema as Record<string, unknown>;
      expect(schema.required).toContain('priority_actions');
      expect(schema.required).toContain('observations');
      expect(schema.required).toContain('risks');
    });
  });

  describe('buildAssessmentPrompt', () => {
    it('includes project name and status', () => {
      const prompt = buildAssessmentPrompt(makeContext());
      expect(prompt).toContain('test-project');
      expect(prompt).toContain('executing');
    });

    it('includes worker capacity info', () => {
      const prompt = buildAssessmentPrompt(makeContext({ runningWorkers: 1, maxWorkers: 3 }));
      expect(prompt).toContain('Running: 1/3');
      expect(prompt).toContain('Available slots: 2');
    });

    it('shows (none) when no open issues', () => {
      const prompt = buildAssessmentPrompt(makeContext({ openIssues: [] }));
      expect(prompt).toContain('(none)');
    });

    it('lists open issues with state markers', () => {
      const context = makeContext({
        openIssues: [
          {
            id: 'ISS-1',
            title: 'Bug in auth',
            description: 'Auth fails',
            type: 'bug',
            priority: 'high',
            status: 'open',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'ISS-2',
            title: 'Add feature',
            description: 'New feature',
            type: 'feature',
            priority: 'medium',
            status: 'open',
            analysis: {
              root_cause: 'missing',
              impact: 'low',
              related_files: [],
              confidence: 0.8,
              suggested_approach: 'add it',
              analyzed_at: '2026-01-01T00:00:00Z',
              analyzed_by: 'test',
            },
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'ISS-3',
            title: 'Ready issue',
            description: 'Has solution',
            type: 'task',
            priority: 'low',
            status: 'open',
            analysis: {
              root_cause: 'x',
              impact: 'y',
              related_files: [],
              confidence: 0.9,
              suggested_approach: 'z',
              analyzed_at: '2026-01-01T00:00:00Z',
              analyzed_by: 'test',
            },
            solution: {
              steps: [{ description: 'do it' }],
              planned_at: '2026-01-01T00:00:00Z',
              planned_by: 'test',
            },
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const prompt = buildAssessmentPrompt(context);

      expect(prompt).toContain('[NEW]');
      expect(prompt).toContain('[ANALYZED]');
      expect(prompt).toContain('[READY]');
      expect(prompt).toContain('(has solution)');
      expect(prompt).toContain('HIGH');
      expect(prompt).toContain('ISS-1');
      expect(prompt).toContain('ISS-2');
      expect(prompt).toContain('ISS-3');
    });

    it('lists recent decisions', () => {
      const context = makeContext({
        recentDecisions: [
          {
            id: 'dec-1',
            timestamp: '2026-01-01T12:00:00Z',
            trigger: 'scheduled_tick',
            assessment: { priority_actions: [], observations: [], risks: [] },
            actions: [
              { type: 'execute_issue', target: 'ISS-1', reason: 'Fix', risk: 'low', executor: 'claude-code' },
            ],
            deferred: [],
          },
        ],
      });

      const prompt = buildAssessmentPrompt(context);
      expect(prompt).toContain('scheduled_tick');
      expect(prompt).toContain('1 actions dispatched');
    });

    it('lists blockers from project context', () => {
      const project = makeProject({
        accumulated_context: {
          key_decisions: [],
          blockers: ['Database migration pending', 'API key expired'],
          deferred: [],
        },
      });
      const prompt = buildAssessmentPrompt(makeContext({ project }));
      expect(prompt).toContain('Database migration pending');
      expect(prompt).toContain('API key expired');
    });

    it('shows current phase status', () => {
      const context = makeContext({
        currentPhase: {
          phase: 1,
          name: 'Setup',
          slug: 'phase-1-setup',
          status: 'executing',
          tasks_summary: { total: 2, completed: 1, in_progress: 1, pending: 0, failed: 0 },
        } as any,
      });
      const prompt = buildAssessmentPrompt(context);
      expect(prompt).toContain('executing');
    });

    it('shows unknown phase status when no current phase', () => {
      const prompt = buildAssessmentPrompt(makeContext({ currentPhase: undefined }));
      expect(prompt).toContain('unknown');
    });
  });
});
