import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const orig = await importOriginal() as Record<string, unknown>;
  return {
    ...orig,
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('./agents/quality-reviewer-agent.js', () => {
  const QualityReviewerAgent = vi.fn(function (this: any) {
    this.review = vi.fn().mockResolvedValue({
      qualityScore: 85,
      executionAssessment: 'Good',
      issues: [],
      nextStepHints: '',
      stepSummary: 'Step completed successfully',
    });
  });
  return { QualityReviewerAgent };
});

// ---------------------------------------------------------------------------
// Mock GraphWalkerFactory to avoid real graph walker initialization
// ---------------------------------------------------------------------------

const completedWalkerState = {
  status: 'completed',
  history: [
    {
      node_id: 'maestro-execute',
      node_type: 'command',
      entered_at: '2025-01-01T00:00:00Z',
      exited_at: '2025-01-01T00:01:00Z',
      outcome: 'success',
      exec_id: 'proc-1',
      summary: 'Executed successfully',
      quality_score: 90,
    },
  ],
};

// Default: never-resolving promise so session stays 'running' during tests.
// Tests that need completion call mockWalkerStart.mockResolvedValueOnce(completedWalkerState).
const mockWalkerStart = vi.fn().mockReturnValue(new Promise(() => {}));

const mockWalkerStop = vi.fn().mockResolvedValue(undefined);

const mockWalkerResume = vi.fn().mockResolvedValue({
  session_id: 'coord-resumed',
  status: 'completed',
  intent: 'resume intent',
  graph_id: 'execute',
  tool: 'claude',
  auto_mode: false,
  history: [],
});

const mockRouterResolve = vi.fn().mockReturnValue('execute');

vi.mock('./graph-walker-factory.js', () => {
  const GraphWalkerFactory = vi.fn(function (this: any) {
    this.create = vi.fn().mockResolvedValue({
      walker: {
        start: mockWalkerStart,
        stop: mockWalkerStop,
        resume: mockWalkerResume,
      },
      router: {
        resolve: mockRouterResolve,
      },
    });
  });
  return { GraphWalkerFactory };
});

vi.mock('./walker-event-bridge.js', () => {
  const WalkerEventBridge = vi.fn();
  return { WalkerEventBridge };
});

vi.mock('./dashboard-step-analyzer.js', () => {
  const DashboardStepAnalyzer = vi.fn();
  return { DashboardStepAnalyzer };
});

import { WorkflowCoordinator } from './workflow-coordinator.js';
import type { DashboardEventBus } from '../state/event-bus.js';
import type { AgentManager } from '../agents/agent-manager.js';
import type { StateManager } from '../state/state-manager.js';
import type { SSEEvent } from '../../shared/types.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockEventBus(): DashboardEventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as DashboardEventBus;
}

function createMockAgentManager(): AgentManager {
  return {
    spawn: vi.fn().mockResolvedValue({
      id: 'mock-proc-1',
      type: 'claude-code',
      status: 'running',
      config: { type: 'claude-code', prompt: 'test', workDir: '/tmp' },
      startedAt: new Date().toISOString(),
    }),
    stop: vi.fn().mockResolvedValue(undefined),
    getEntries: vi.fn().mockReturnValue([]),
  } as unknown as AgentManager;
}

function createMockStateManager(): StateManager {
  return {
    getProject: vi.fn().mockReturnValue({
      project_name: 'test-project',
      status: 'active',
      current_milestone: 'v1',
      current_phase: null,
      accumulated_context: { blockers: [] },
    }),
    getPhase: vi.fn().mockReturnValue(undefined),
    getBoard: vi.fn().mockReturnValue({}),
  } as unknown as StateManager;
}

function createCoordinator() {
  const eventBus = createMockEventBus();
  const agentManager = createMockAgentManager();
  const stateManager = createMockStateManager();
  const coordinator = new WorkflowCoordinator(
    eventBus,
    agentManager,
    stateManager,
    '/tmp/test-workflow',
  );
  return { coordinator, eventBus, agentManager, stateManager };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkflowCoordinator', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- getSession ---
  describe('getSession', () => {
    it('returns null when no session is active', () => {
      const { coordinator } = createCoordinator();
      expect(coordinator.getSession()).toBeNull();
    });
  });

  // --- start ---
  describe('start', () => {
    it('creates a session via graph walker', async () => {
      const { coordinator } = createCoordinator();
      const session = await coordinator.start('implement the feature');

      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^coord-/);
      expect(session.intent).toBe('implement the feature');
      expect(session.tool).toBe('claude');
      expect(session.status).toBe('running');
    });

    it('uses router to resolve graph id from intent', async () => {
      const { coordinator } = createCoordinator();
      await coordinator.start('implement the feature');

      expect(mockRouterResolve).toHaveBeenCalledWith('implement the feature');
    });

    it('uses explicit chainName when provided', async () => {
      const { coordinator } = createCoordinator();
      const session = await coordinator.start('do something', { chainName: 'execute-verify' });

      expect(session.chainName).toBe('execute-verify');
      // Router should not be called when chainName is explicit
      expect(mockRouterResolve).not.toHaveBeenCalled();
    });

    it('uses specified tool', async () => {
      const { coordinator } = createCoordinator();
      const session = await coordinator.start('execute', { tool: 'gemini' });

      expect(session.tool).toBe('gemini');
    });

    it('throws if session is already running', async () => {
      const { coordinator } = createCoordinator();
      await coordinator.start('first task');

      await expect(
        coordinator.start('second task'),
      ).rejects.toThrow('A coordinate session is already running');
    });

    it('emits coordinate:status events', async () => {
      const { coordinator, eventBus } = createCoordinator();
      mockWalkerStart.mockResolvedValueOnce(completedWalkerState);
      await coordinator.start('execute the plan');
      await new Promise(r => setTimeout(r, 10));

      expect(eventBus.emit).toHaveBeenCalledWith('coordinate:status', expect.any(Object));
    });

    it('starts graph walker with correct options', async () => {
      const { coordinator } = createCoordinator();
      mockWalkerStart.mockReturnValueOnce(new Promise(() => {}));
      await coordinator.start('execute the plan', {
        tool: 'gemini',
        autoMode: true,
        phase: 'phase-1',
      });

      // Allow async walker to start
      await new Promise(r => setTimeout(r, 50));

      expect(mockWalkerStart).toHaveBeenCalledWith(
        'execute',
        'execute the plan',
        expect.objectContaining({
          tool: 'gemini',
          autoMode: true,
          inputs: { phase: 'phase-1', description: 'execute the plan' },
        }),
      );
    });
  });

  // --- stop ---
  describe('stop', () => {
    it('does nothing when no session exists', async () => {
      const { coordinator } = createCoordinator();
      await coordinator.stop(); // should not throw
    });

    it('stops graph walker and sets session to failed', async () => {
      const { coordinator } = createCoordinator();
      mockWalkerStart.mockReturnValueOnce(new Promise(() => {}));
      await coordinator.start('execute the plan');
      await coordinator.stop();

      const session = coordinator.getSession();
      expect(session?.status).toBe('failed');
      expect(mockWalkerStop).toHaveBeenCalled();
    });
  });

  // --- resume ---
  describe('resume', () => {
    it('resumes via graph walker', async () => {
      const { coordinator } = createCoordinator();
      const session = await coordinator.resume('some-session-id');

      expect(session).toBeDefined();
      expect(mockWalkerResume).toHaveBeenCalledWith('some-session-id');
    });

    it('returns null when walker resume fails', async () => {
      mockWalkerResume.mockRejectedValueOnce(new Error('no session'));
      const { coordinator } = createCoordinator();
      const result = await coordinator.resume('nonexistent');
      expect(result).toBeNull();
    });
  });

  // --- getSession returns copy ---
  describe('getSession returns a copy', () => {
    it('returns independent copy of session', async () => {
      const { coordinator } = createCoordinator();
      mockWalkerStart.mockResolvedValueOnce(completedWalkerState);
      await coordinator.start('execute the plan');
      await new Promise(r => setTimeout(r, 10));

      const s1 = coordinator.getSession();
      const s2 = coordinator.getSession();
      expect(s1).toEqual(s2);
      expect(s1).not.toBe(s2);
      expect(s1?.steps).not.toBe(s2?.steps);
    });
  });

  // --- destroy ---
  describe('destroy', () => {
    it('does not throw', () => {
      const { coordinator } = createCoordinator();
      coordinator.destroy(); // no-op, should not throw
    });
  });
});
